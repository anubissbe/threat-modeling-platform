import { v4 as uuidv4 } from 'uuid';
import { pool, query } from '../config/database';
import { 
  CacheKeys, 
  setCache, 
  getCache, 
  deleteCache, 
  invalidateUserIntegrationCache 
} from '../config/redis';
import { encrypt, decrypt } from '../utils/encryption';
import { logger, logIntegrationEvent } from '../utils/logger';
import { 
  AppError, 
  NotFoundError, 
  ConflictError, 
  ValidationError 
} from '../middleware/error-handler';
import {
  Integration,
  IntegrationProvider,
  IntegrationStatus,
  IntegrationCredentials,
  CreateIntegrationRequest,
  UpdateIntegrationRequest,
  IntegrationLog,
} from '../types/integration';
import { IntegrationEventBus } from './event-bus.service';

export class IntegrationService {
  constructor(private eventBus: IntegrationEventBus) {}

  async createIntegration(
    userId: string,
    request: CreateIntegrationRequest
  ): Promise<Integration> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Check if integration with same name exists for user
      const existingResult = await client.query(
        'SELECT id FROM service_integrations WHERE name = $1 AND created_by = $2',
        [request.name, userId]
      );

      if (existingResult.rows.length > 0) {
        throw new ConflictError(`Integration with name '${request.name}' already exists`);
      }

      // Encrypt credentials
      const encryptedCredentials = encrypt(JSON.stringify(request.credentials));

      // Create integration
      const id = uuidv4();
      const result = await client.query(
        `INSERT INTO service_integrations 
         (id, name, provider, config, credentials, status, sync_frequency_minutes, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          id,
          request.name,
          request.provider,
          JSON.stringify(request.config),
          encryptedCredentials,
          IntegrationStatus.ACTIVE,
          request.syncFrequencyMinutes || 60,
          userId,
        ]
      );

      const integration = this.mapRowToIntegration(result.rows[0]);

      // Log creation
      await this.logIntegrationAction(client, id, 'created', 'success');

      await client.query('COMMIT');

      // Publish event
      await this.eventBus.publishIntegrationCreated(integration);

      // Cache integration
      await setCache(CacheKeys.INTEGRATION(id), integration, 300);

      // Invalidate user cache
      await invalidateUserIntegrationCache(userId);

      logIntegrationEvent(id, 'Integration created', { provider: request.provider });

      return integration;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to create integration:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async getIntegration(id: string, userId?: string): Promise<Integration> {
    // Check cache first
    const cached = await getCache<Integration>(CacheKeys.INTEGRATION(id));
    if (cached) {
      // Verify user access if userId provided
      if (userId && cached.createdBy !== userId) {
        throw new NotFoundError('Integration');
      }
      return cached;
    }

    // Query database
    const result = await query<any>(
      'SELECT * FROM service_integrations WHERE id = $1',
      [id]
    );

    if (result.length === 0) {
      throw new NotFoundError('Integration');
    }

    const integration = this.mapRowToIntegration(result[0]);

    // Verify user access if userId provided
    if (userId && integration.createdBy !== userId) {
      throw new NotFoundError('Integration');
    }

    // Cache for 5 minutes
    await setCache(CacheKeys.INTEGRATION(id), integration, 300);

    return integration;
  }

  async listIntegrations(userId: string): Promise<Integration[]> {
    // Check cache first
    const cacheKey = CacheKeys.INTEGRATION_BY_USER(userId);
    const cached = await getCache<Integration[]>(cacheKey);
    if (cached) {
      return cached;
    }

    // Query database
    const result = await query<any>(
      'SELECT * FROM service_integrations WHERE created_by = $1 ORDER BY created_at DESC',
      [userId]
    );

    const integrations = result.map(row => this.mapRowToIntegration(row));

    // Cache for 1 minute
    await setCache(cacheKey, integrations, 60);

    return integrations;
  }

  async updateIntegration(
    id: string,
    userId: string,
    request: UpdateIntegrationRequest
  ): Promise<Integration> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Verify user has access to this integration
      await this.getIntegration(id, userId);

      // Build update query
      const updates: string[] = [];
      const values: any[] = [];
      let paramCount = 1;

      if (request.name !== undefined) {
        updates.push(`name = $${paramCount++}`);
        values.push(request.name);
      }

      if (request.config !== undefined) {
        updates.push(`config = $${paramCount++}`);
        values.push(JSON.stringify(request.config));
      }

      if (request.credentials !== undefined) {
        const encryptedCredentials = encrypt(JSON.stringify(request.credentials));
        updates.push(`credentials = $${paramCount++}`);
        values.push(encryptedCredentials);
      }

      if (request.status !== undefined) {
        updates.push(`status = $${paramCount++}`);
        values.push(request.status);
      }

      if (request.syncFrequencyMinutes !== undefined) {
        updates.push(`sync_frequency_minutes = $${paramCount++}`);
        values.push(request.syncFrequencyMinutes);
      }

      if (updates.length === 0) {
        throw new ValidationError('No fields to update');
      }

      updates.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(id);

      const updateQuery = `
        UPDATE service_integrations 
        SET ${updates.join(', ')}
        WHERE id = $${paramCount}
        RETURNING *
      `;

      const result = await client.query(updateQuery, values);
      const integration = this.mapRowToIntegration(result.rows[0]);

      // Log update
      await this.logIntegrationAction(
        client,
        id,
        'updated',
        'success',
        { changes: request }
      );

      await client.query('COMMIT');

      // Publish event
      await this.eventBus.publishIntegrationUpdated(integration, request);

      // Update cache
      await deleteCache([
        CacheKeys.INTEGRATION(id),
        CacheKeys.INTEGRATION_BY_USER(userId),
      ]);

      logIntegrationEvent(id, 'Integration updated', { changes: request });

      return integration;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to update integration:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async deleteIntegration(id: string, userId: string): Promise<void> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Verify ownership
      await this.getIntegration(id, userId);

      // Delete integration (cascades to mappings and logs)
      const result = await client.query(
        'DELETE FROM service_integrations WHERE id = $1 AND created_by = $2',
        [id, userId]
      );

      if (result.rowCount === 0) {
        throw new NotFoundError('Integration');
      }

      // Log deletion
      await this.logIntegrationAction(client, id, 'deleted', 'success');

      await client.query('COMMIT');

      // Publish event
      await this.eventBus.publishIntegrationDeleted(id, userId);

      // Clear cache
      await deleteCache([
        CacheKeys.INTEGRATION(id),
        CacheKeys.INTEGRATION_BY_USER(userId),
        CacheKeys.INTEGRATION_MAPPINGS(id),
      ]);

      logIntegrationEvent(id, 'Integration deleted');
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to delete integration:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async getIntegrationStatus(id: string): Promise<{
    status: IntegrationStatus;
    lastSyncAt?: Date;
    recentLogs: IntegrationLog[];
    mappingCount: number;
  }> {
    const integration = await this.getIntegration(id);

    // Get recent logs
    const logsResult = await query<any>(
      `SELECT * FROM integration_logs 
       WHERE integration_id = $1 
       ORDER BY created_at DESC 
       LIMIT 10`,
      [id]
    );

    const logs = logsResult.map(row => ({
      id: row.id,
      integrationId: row.integration_id,
      action: row.action,
      status: row.status,
      details: row.details,
      errorMessage: row.error_message,
      startedAt: new Date(row.started_at),
      ...(row.completed_at && { completedAt: new Date(row.completed_at) }),
      createdAt: new Date(row.created_at),
    })) as IntegrationLog[];

    // Get mapping count
    const countResult = await query<any>(
      'SELECT COUNT(*) FROM integration_mappings WHERE integration_id = $1',
      [id]
    );

    return {
      status: integration.status,
      ...(integration.lastSyncAt && { lastSyncAt: integration.lastSyncAt }),
      recentLogs: logs,
      mappingCount: parseInt(countResult[0].count),
    };
  }

  async decryptCredentials(integration: Integration): Promise<IntegrationCredentials> {
    try {
      const decrypted = decrypt(integration.credentials);
      return JSON.parse(decrypted);
    } catch (error) {
      logger.error('Failed to decrypt credentials:', { integrationId: integration.id });
      throw new AppError(500, 'Failed to decrypt integration credentials');
    }
  }

  private mapRowToIntegration(row: any): Integration {
    return {
      id: row.id,
      name: row.name,
      provider: row.provider as IntegrationProvider,
      config: row.config,
      credentials: row.credentials,
      status: row.status as IntegrationStatus,
      ...(row.last_sync_at && { lastSyncAt: new Date(row.last_sync_at) }),
      syncFrequencyMinutes: row.sync_frequency_minutes,
      createdBy: row.created_by,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private async logIntegrationAction(
    client: any,
    integrationId: string,
    action: string,
    status: 'success' | 'failure',
    details?: any,
    errorMessage?: string
  ): Promise<void> {
    await client.query(
      `INSERT INTO integration_logs 
       (integration_id, action, status, details, error_message, completed_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        integrationId,
        action,
        status,
        details ? JSON.stringify(details) : null,
        errorMessage,
        new Date(),
      ]
    );
  }
}