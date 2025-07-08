import * as cron from 'node-cron';
import { query } from '../config/database';
import { redisClient, CacheKeys } from '../config/redis';
import { logger, logSyncEvent } from '../utils/logger';
import { IntegrationEventBus } from './event-bus.service';
import { IntegrationService } from './integration.service';
import { ConnectorFactory } from './connector-factory';
import { 
  SyncResult,
  IntegrationStatus
} from '../types/integration';

export class SyncService {
  private integrationService: IntegrationService;
  private scheduledJobs: Map<string, cron.ScheduledTask> = new Map();
  private activeSyncs: Set<string> = new Set();

  constructor(private eventBus: IntegrationEventBus) {
    this.integrationService = new IntegrationService(eventBus);
  }

  async initialize(): Promise<void> {
    // Load active integrations and schedule syncs
    await this.scheduleAllIntegrations();

    // Listen for integration events
    this.eventBus.on('integration:created', async (event) => {
      await this.scheduleIntegration(event.data.id);
    });

    this.eventBus.on('integration:updated', async (event) => {
      await this.rescheduleIntegration(event.data.id);
    });

    this.eventBus.on('integration:deleted', async (event) => {
      await this.unscheduleIntegration(event.data.id);
    });

    logger.info('Sync service initialized');
  }

  async shutdown(): Promise<void> {
    // Stop all scheduled jobs
    for (const [id, job] of this.scheduledJobs) {
      job.stop();
      logger.info(`Stopped sync job for integration ${id}`);
    }
    this.scheduledJobs.clear();

    // Wait for active syncs to complete
    const timeout = 30000; // 30 seconds
    const start = Date.now();
    while (this.activeSyncs.size > 0 && Date.now() - start < timeout) {
      logger.info(`Waiting for ${this.activeSyncs.size} active syncs to complete...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (this.activeSyncs.size > 0) {
      logger.warn(`Forcing shutdown with ${this.activeSyncs.size} active syncs`);
    }

    logger.info('Sync service shut down');
  }

  async syncIntegration(
    integrationId: string,
    options?: {
      threatModelIds?: string[];
      force?: boolean;
    }
  ): Promise<SyncResult> {
    // Check if sync is already in progress
    if (!options?.force && this.activeSyncs.has(integrationId)) {
      throw new Error('Sync already in progress for this integration');
    }

    // Acquire distributed lock
    const lockKey = CacheKeys.SYNC_LOCK(integrationId);
    const lockAcquired = await this.acquireLock(lockKey, 300); // 5 minute lock

    if (!lockAcquired && !options?.force) {
      throw new Error('Could not acquire sync lock. Another sync may be in progress.');
    }

    this.activeSyncs.add(integrationId);

    try {
      // Publish sync started event
      await this.eventBus.publishSyncStarted(integrationId, options?.threatModelIds);

      // Get integration
      const integration = await this.integrationService.getIntegration(integrationId);
      if (integration.status !== IntegrationStatus.ACTIVE) {
        throw new Error(`Integration is not active (status: ${integration.status})`);
      }

      // Get credentials
      const credentials = await this.integrationService.decryptCredentials(integration);

      // Create connector
      const connector = ConnectorFactory.createConnector(integration, credentials);

      // Get threat models to sync
      const threatModels = await this.getThreatModelsForSync(
        integrationId,
        options?.threatModelIds
      );

      logSyncEvent(integrationId, 'Sync started', {
        threatModelCount: threatModels.length,
        options,
      });

      // Perform sync
      const result = await connector.performSync(threatModels);

      // Update sync timestamp
      await this.updateLastSyncTime(integrationId);

      // Log sync result
      await this.logSyncResult(integrationId, result);

      // Publish sync completed event
      await this.eventBus.publishSyncCompleted(integrationId, result);

      logSyncEvent(integrationId, 'Sync completed', result);

      return result;
    } catch (error: any) {
      // Log sync error
      await this.logSyncError(integrationId, error);

      // Update integration status if needed
      if (error.message?.includes('Authentication failed')) {
        await this.updateIntegrationStatus(integrationId, IntegrationStatus.ERROR);
      }

      // Publish sync failed event
      await this.eventBus.publishSyncFailed(integrationId, error);

      logSyncEvent(integrationId, 'Sync failed', { error: error.message });

      throw error;
    } finally {
      // Release lock
      await this.releaseLock(lockKey);
      this.activeSyncs.delete(integrationId);
    }
  }

  private async scheduleAllIntegrations(): Promise<void> {
    const result = await query<any>(
      'SELECT id, sync_frequency_minutes FROM service_integrations WHERE status = $1',
      [IntegrationStatus.ACTIVE]
    );

    for (const row of result) {
      await this.scheduleIntegration(row.id, row.sync_frequency_minutes);
    }

    logger.info(`Scheduled ${result.length} integration sync jobs`);
  }

  private async scheduleIntegration(
    integrationId: string,
    frequencyMinutes?: number
  ): Promise<void> {
    if (!frequencyMinutes) {
      const integration = await this.integrationService.getIntegration(integrationId);
      frequencyMinutes = integration.syncFrequencyMinutes;
    }

    // Convert minutes to cron expression
    const cronExpression = this.minutesToCron(frequencyMinutes);

    // Cancel existing job if any
    const existingJob = this.scheduledJobs.get(integrationId);
    if (existingJob) {
      existingJob.stop();
    }

    // Schedule new job
    const job = cron.schedule(cronExpression, async () => {
      try {
        await this.syncIntegration(integrationId);
      } catch (error) {
        logger.error('Scheduled sync failed:', {
          integrationId,
          error,
        });
      }
    });

    this.scheduledJobs.set(integrationId, job);
    logger.info(`Scheduled sync job for integration ${integrationId} (every ${frequencyMinutes} minutes)`);
  }

  private async rescheduleIntegration(integrationId: string): Promise<void> {
    await this.unscheduleIntegration(integrationId);
    await this.scheduleIntegration(integrationId);
  }

  private async unscheduleIntegration(integrationId: string): Promise<void> {
    const job = this.scheduledJobs.get(integrationId);
    if (job) {
      job.stop();
      this.scheduledJobs.delete(integrationId);
      logger.info(`Unscheduled sync job for integration ${integrationId}`);
    }
  }

  private minutesToCron(minutes: number): string {
    if (minutes < 60) {
      return `*/${minutes} * * * *`;
    } else if (minutes === 60) {
      return '0 * * * *';
    } else if (minutes % 60 === 0) {
      const hours = minutes / 60;
      return `0 */${hours} * * *`;
    } else {
      // For non-standard intervals, run at specific minutes
      return `*/${minutes} * * * *`;
    }
  }

  private async getThreatModelsForSync(
    _integrationId: string,
    threatModelIds?: string[]
  ): Promise<any[]> {
    // This would typically query the threat model service
    // For now, return mock data
    const mockThreatModels = [
      {
        id: 'tm-1',
        name: 'E-Commerce Platform',
        projectName: 'E-Commerce Project',
        description: 'Threat model for the main e-commerce platform',
        methodology: 'STRIDE',
        version: '1.0',
        components: [],
        dataFlows: [],
        threats: [
          {
            title: 'SQL Injection in Login',
            severity: 'High',
          },
          {
            title: 'Session Hijacking',
            severity: 'Medium',
          },
        ],
        mitigations: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    if (threatModelIds && threatModelIds.length > 0) {
      return mockThreatModels.filter(tm => threatModelIds.includes(tm.id));
    }

    return mockThreatModels;
  }

  private async updateLastSyncTime(integrationId: string): Promise<void> {
    await query(
      'UPDATE service_integrations SET last_sync_at = CURRENT_TIMESTAMP WHERE id = $1',
      [integrationId]
    );
  }

  private async updateIntegrationStatus(
    integrationId: string,
    status: IntegrationStatus
  ): Promise<void> {
    await query(
      'UPDATE service_integrations SET status = $1 WHERE id = $2',
      [status, integrationId]
    );
  }

  private async logSyncResult(integrationId: string, result: SyncResult): Promise<void> {
    await query(
      `INSERT INTO integration_logs 
       (integration_id, action, status, details, completed_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
      [
        integrationId,
        'sync',
        result.success ? 'success' : 'failure',
        JSON.stringify(result),
      ]
    );
  }

  private async logSyncError(integrationId: string, error: any): Promise<void> {
    await query(
      `INSERT INTO integration_logs 
       (integration_id, action, status, error_message, details, completed_at)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
      [
        integrationId,
        'sync',
        'failure',
        error.message || 'Unknown error',
        JSON.stringify({ stack: error.stack }),
      ]
    );
  }

  private async acquireLock(key: string, ttl: number): Promise<boolean> {
    const result = await redisClient.set(key, '1', 'EX', ttl, 'NX');
    return result === 'OK';
  }

  private async releaseLock(key: string): Promise<void> {
    await redisClient.del(key);
  }
}