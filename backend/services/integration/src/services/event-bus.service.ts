import { Redis } from 'ioredis';
import { EventEmitter } from 'events';
import { logger, logIntegrationEvent } from '../utils/logger';
import { PubSubChannels } from '../config/redis';
import { Integration, WebhookEvent } from '../types/integration';

export interface IntegrationEvent {
  type: string;
  integrationId?: string;
  userId?: string;
  data: any;
  timestamp: Date;
}

export class IntegrationEventBus extends EventEmitter {
  private publisher: Redis;
  private subscriber: Redis;
  private subscriptions: Set<string> = new Set();

  constructor(redis: Redis) {
    super();
    this.publisher = redis;
    this.subscriber = redis.duplicate();
  }

  async initialize(): Promise<void> {
    // Set up subscriber error handling
    this.subscriber.on('error', (error) => {
      logger.error('Redis subscriber error:', error);
    });

    // Subscribe to internal channels
    await this.subscribeToChannel(PubSubChannels.INTEGRATION_CREATED);
    await this.subscribeToChannel(PubSubChannels.INTEGRATION_UPDATED);
    await this.subscribeToChannel(PubSubChannels.INTEGRATION_DELETED);
    await this.subscribeToChannel(PubSubChannels.SYNC_STARTED);
    await this.subscribeToChannel(PubSubChannels.SYNC_COMPLETED);
    await this.subscribeToChannel(PubSubChannels.SYNC_FAILED);
    await this.subscribeToChannel(PubSubChannels.WEBHOOK_RECEIVED);
    await this.subscribeToChannel(PubSubChannels.WEBHOOK_PROCESSED);

    // Handle messages
    this.subscriber.on('message', (channel, message) => {
      try {
        const event = JSON.parse(message) as IntegrationEvent;
        this.emit(channel, event);
        this.emit('event', { channel, event });
        
        logIntegrationEvent(
          event.integrationId || 'system',
          `Event received: ${channel}`,
          { event }
        );
      } catch (error) {
        logger.error('Failed to process event:', { channel, message, error });
      }
    });

    logger.info('Integration event bus initialized');
  }

  async shutdown(): Promise<void> {
    // Unsubscribe from all channels
    if (this.subscriptions.size > 0) {
      await this.subscriber.unsubscribe(...Array.from(this.subscriptions));
    }

    // Close connections
    this.subscriber.disconnect();
    
    // Remove all listeners
    this.removeAllListeners();

    logger.info('Integration event bus shut down');
  }

  private async subscribeToChannel(channel: string): Promise<void> {
    await this.subscriber.subscribe(channel);
    this.subscriptions.add(channel);
    logger.debug(`Subscribed to channel: ${channel}`);
  }

  async publishEvent(channel: string, event: Omit<IntegrationEvent, 'timestamp'>): Promise<void> {
    const fullEvent: IntegrationEvent = {
      ...event,
      timestamp: new Date(),
    };

    try {
      await this.publisher.publish(channel, JSON.stringify(fullEvent));
      
      logIntegrationEvent(
        event.integrationId || 'system',
        `Event published: ${channel}`,
        { event: fullEvent }
      );
    } catch (error) {
      logger.error('Failed to publish event:', { channel, event, error });
      throw error;
    }
  }

  // Convenience methods for common events
  async publishIntegrationCreated(integration: Integration): Promise<void> {
    await this.publishEvent(PubSubChannels.INTEGRATION_CREATED, {
      type: 'integration.created',
      integrationId: integration.id,
      userId: integration.createdBy,
      data: {
        id: integration.id,
        name: integration.name,
        provider: integration.provider,
      },
    });
  }

  async publishIntegrationUpdated(integration: Integration, changes: any): Promise<void> {
    await this.publishEvent(PubSubChannels.INTEGRATION_UPDATED, {
      type: 'integration.updated',
      integrationId: integration.id,
      userId: integration.createdBy,
      data: {
        id: integration.id,
        changes,
      },
    });
  }

  async publishIntegrationDeleted(integrationId: string, userId: string): Promise<void> {
    await this.publishEvent(PubSubChannels.INTEGRATION_DELETED, {
      type: 'integration.deleted',
      integrationId,
      userId,
      data: { id: integrationId },
    });
  }

  async publishSyncStarted(integrationId: string, threatModelIds?: string[]): Promise<void> {
    await this.publishEvent(PubSubChannels.SYNC_STARTED, {
      type: 'sync.started',
      integrationId,
      data: { threatModelIds },
    });
  }

  async publishSyncCompleted(integrationId: string, result: any): Promise<void> {
    await this.publishEvent(PubSubChannels.SYNC_COMPLETED, {
      type: 'sync.completed',
      integrationId,
      data: result,
    });
  }

  async publishSyncFailed(integrationId: string, error: any): Promise<void> {
    await this.publishEvent(PubSubChannels.SYNC_FAILED, {
      type: 'sync.failed',
      integrationId,
      data: { error: error.message || error },
    });
  }

  async publishWebhookReceived(webhook: WebhookEvent): Promise<void> {
    await this.publishEvent(PubSubChannels.WEBHOOK_RECEIVED, {
      type: 'webhook.received',
      ...(webhook.integrationId && { integrationId: webhook.integrationId }),
      data: {
        provider: webhook.provider,
        eventType: webhook.eventType,
        webhookId: webhook.id,
      },
    });
  }

  async publishWebhookProcessed(webhookId: string, success: boolean, error?: string): Promise<void> {
    await this.publishEvent(PubSubChannels.WEBHOOK_PROCESSED, {
      type: 'webhook.processed',
      data: {
        webhookId,
        success,
        error,
      },
    });
  }

  // Subscribe to external events (from other services)
  async subscribeToThreatModelEvents(): Promise<void> {
    const channels = [
      'threat_model:created',
      'threat_model:updated',
      'threat_model:deleted',
    ];

    for (const channel of channels) {
      await this.subscribeToChannel(channel);
    }

    // Handle threat model events
    this.on('threat_model:created', async (event: any) => {
      // Handle new threat model - check if any integrations need to sync
      logger.info('Threat model created event received:', event);
    });

    this.on('threat_model:updated', async (event: any) => {
      // Handle threat model update - sync to external systems
      logger.info('Threat model updated event received:', event);
    });

    this.on('threat_model:deleted', async (event: any) => {
      // Handle threat model deletion - remove from external systems
      logger.info('Threat model deleted event received:', event);
    });
  }
}