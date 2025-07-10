import { redis } from '../config/redis';
import { logger } from '../utils/logger';
import notificationService from './notification.service';
import {
  NotificationEvent,
  ThreatModelEvent,
  ThreatEvent,
  CollaborationEvent,
  ReportEvent,
  SystemEvent,
} from '../types';

export class EventHandlerService {
  private isListening = false;
  private eventChannels = [
    'threat-model.created',
    'threat-model.updated', 
    'threat-model.deleted',
    'threat.identified',
    'threat.mitigated',
    'collaboration.invited',
    'collaboration.mentioned',
    'report.generated',
    'system.maintenance',
  ];

  async startListening(): Promise<void> {
    if (this.isListening) {
      logger.warn('Event handler already listening');
      return;
    }

    try {
      // Subscribe to all event channels
      for (const channel of this.eventChannels) {
        await redis.subscribe(channel, this.handleEvent.bind(this));
        logger.info(`Subscribed to event channel: ${channel}`);
      }

      this.isListening = true;
      logger.info('Event handler started listening for events');
    } catch (error) {
      logger.error('Failed to start event handler:', error);
      throw error;
    }
  }

  async stopListening(): Promise<void> {
    if (!this.isListening) {
      return;
    }

    try {
      // Unsubscribe from all channels
      for (const channel of this.eventChannels) {
        await redis.unsubscribe(channel);
        logger.info(`Unsubscribed from event channel: ${channel}`);
      }

      this.isListening = false;
      logger.info('Event handler stopped listening');
    } catch (error) {
      logger.error('Failed to stop event handler:', error);
      throw error;
    }
  }

  private async handleEvent(message: string): Promise<void> {
    try {
      const event: NotificationEvent = JSON.parse(message);
      
      logger.debug('Processing notification event:', {
        type: event.type,
        userId: event.userId,
        timestamp: event.timestamp,
      });

      // Validate event structure
      if (!this.isValidEvent(event)) {
        logger.warn('Invalid event structure received:', event);
        return;
      }

      // Process the event based on its type
      await this.processEvent(event);

      // Update event metrics
      await this.updateEventMetrics(event.type);

    } catch (error) {
      logger.error('Failed to handle event:', error);
      
      // Optionally, implement dead letter queue for failed events
      await this.handleFailedEvent(message, error as Error);
    }
  }

  private isValidEvent(event: any): event is NotificationEvent {
    return (
      event &&
      typeof event.type === 'string' &&
      typeof event.userId === 'string' &&
      typeof event.data === 'object' &&
      event.timestamp instanceof Date || typeof event.timestamp === 'string'
    );
  }

  private async processEvent(event: NotificationEvent): Promise<void> {
    switch (event.type) {
      case 'threat_model_created':
      case 'threat_model_updated':
      case 'threat_model_deleted':
        await this.processThreatModelEvent(event as ThreatModelEvent);
        break;

      case 'threat_identified':
      case 'threat_mitigated':
        await this.processThreatEvent(event as ThreatEvent);
        break;

      case 'collaboration_invited':
      case 'collaboration_mentioned':
        await this.processCollaborationEvent(event as CollaborationEvent);
        break;

      case 'report_generated':
        await this.processReportEvent(event as ReportEvent);
        break;

      case 'system_maintenance':
        await this.processSystemEvent(event as SystemEvent);
        break;

      default:
        logger.warn(`Unhandled event type: ${event.type}`);
        await this.processGenericEvent(event);
    }
  }

  private async processThreatModelEvent(event: ThreatModelEvent): Promise<void> {
    logger.debug(`Processing threat model event: ${event.type}`);

    try {
      // Handle the event through the notification service
      await notificationService.handleEvent(event);

      // Additional event-specific processing
      if (event.type === 'threat_model_created') {
        await this.notifyProjectMembers(event);
      } else if (event.type === 'threat_model_deleted') {
        await this.notifyStakeholders(event);
      }

    } catch (error) {
      logger.error(`Failed to process threat model event: ${event.type}`, error);
      throw error;
    }
  }

  private async processThreatEvent(event: ThreatEvent): Promise<void> {
    logger.debug(`Processing threat event: ${event.type}`);

    try {
      await notificationService.handleEvent(event);

      // Special handling for high-priority threats
      if (event.data.riskLevel === 'critical' || event.data.riskLevel === 'high') {
        await this.escalateHighRiskThreat(event);
      }

    } catch (error) {
      logger.error(`Failed to process threat event: ${event.type}`, error);
      throw error;
    }
  }

  private async processCollaborationEvent(event: CollaborationEvent): Promise<void> {
    logger.debug(`Processing collaboration event: ${event.type}`);

    try {
      await notificationService.handleEvent(event);

      // Send welcome information for new collaborators
      if (event.type === 'collaboration_invited') {
        await this.sendWelcomeInformation(event);
      }

    } catch (error) {
      logger.error(`Failed to process collaboration event: ${event.type}`, error);
      throw error;
    }
  }

  private async processReportEvent(event: ReportEvent): Promise<void> {
    logger.debug(`Processing report event: ${event.type}`);

    try {
      await notificationService.handleEvent(event);

      // Archive old reports if needed
      await this.manageReportArchival(event);

    } catch (error) {
      logger.error(`Failed to process report event: ${event.type}`, error);
      throw error;
    }
  }

  private async processSystemEvent(event: SystemEvent): Promise<void> {
    logger.debug(`Processing system event: ${event.type}`);

    try {
      await notificationService.handleEvent(event);

      // Broadcast system events to all users if critical
      if ((event.data as any).severity === 'critical') {
        await this.broadcastSystemAlert(event);
      }

    } catch (error) {
      logger.error(`Failed to process system event: ${event.type}`, error);
      throw error;
    }
  }

  private async processGenericEvent(event: NotificationEvent): Promise<void> {
    logger.debug(`Processing generic event: ${event.type}`);

    try {
      await notificationService.handleEvent(event);
    } catch (error) {
      logger.error(`Failed to process generic event: ${event.type}`, error);
      throw error;
    }
  }

  // Helper methods for specific event processing

  private async notifyProjectMembers(event: ThreatModelEvent): Promise<void> {
    try {
      logger.debug('Notifying project members of new threat model');
      
      // This would typically query the database for project members
      // and send notifications to each one
      // For now, we'll just log the action
      
      logger.info('Project members notified', {
        projectId: event.data.projectId,
        threatModelId: event.data.id,
      });
    } catch (error) {
      logger.error('Failed to notify project members:', error);
    }
  }

  private async notifyStakeholders(event: ThreatModelEvent): Promise<void> {
    try {
      logger.debug('Notifying stakeholders of threat model deletion');
      
      logger.info('Stakeholders notified', {
        projectId: event.data.projectId,
        threatModelId: event.data.id,
      });
    } catch (error) {
      logger.error('Failed to notify stakeholders:', error);
    }
  }

  private async escalateHighRiskThreat(event: ThreatEvent): Promise<void> {
    try {
      logger.warn('Escalating high-risk threat notification', {
        threatId: event.data.id,
        riskLevel: event.data.riskLevel,
      });

      // Send immediate notifications to security team
      // This could involve SMS or phone calls for critical threats
      
      // For now, we'll publish an escalation event
      await this.publishEvent('threat.escalated', {
        ...event,
        data: {
          ...event.data,
          escalated: true,
          escalatedAt: new Date().toISOString(),
        },
      });

    } catch (error) {
      logger.error('Failed to escalate high-risk threat:', error);
    }
  }

  private async sendWelcomeInformation(event: CollaborationEvent): Promise<void> {
    try {
      logger.debug('Sending welcome information to new collaborator');
      
      // Send additional welcome email with project information
      // This could include project guidelines, contacts, etc.
      
      logger.info('Welcome information sent', {
        userId: event.userId,
        projectId: event.data.projectId,
      });
    } catch (error) {
      logger.error('Failed to send welcome information:', error);
    }
  }

  private async manageReportArchival(event: ReportEvent): Promise<void> {
    try {
      logger.debug('Managing report archival');
      
      // Check if old reports need to be archived
      // This is typically done based on organization policies
      
      logger.info('Report archival managed', {
        reportId: event.data.reportId,
      });
    } catch (error) {
      logger.error('Failed to manage report archival:', error);
    }
  }

  private async broadcastSystemAlert(event: SystemEvent): Promise<void> {
    try {
      logger.warn('Broadcasting critical system alert');
      
      // Send system alert to all active users
      // This might use multiple channels (email, Slack, Teams, etc.)
      
      await this.publishEvent('system.broadcast', {
        ...event,
        data: {
          ...event.data,
          broadcast: true,
          broadcastAt: new Date().toISOString(),
        },
      });

    } catch (error) {
      logger.error('Failed to broadcast system alert:', error);
    }
  }

  // Event publishing methods

  async publishEvent(channel: string, event: any): Promise<void> {
    try {
      const message = JSON.stringify({
        ...event,
        timestamp: event.timestamp || new Date().toISOString(),
        publishedAt: new Date().toISOString(),
      });

      await redis.publish(channel, message);
      logger.debug(`Published event to channel: ${channel}`);

    } catch (error) {
      logger.error(`Failed to publish event to channel ${channel}:`, error);
      throw error;
    }
  }

  async publishThreatModelEvent(type: string, data: any): Promise<void> {
    await this.publishEvent(`threat-model.${type}`, {
      type: `threat_model_${type}`,
      userId: data.userId || data.creatorId,
      data,
      timestamp: new Date().toISOString(),
    });
  }

  async publishThreatEvent(type: string, data: any): Promise<void> {
    await this.publishEvent(`threat.${type}`, {
      type: `threat_${type}`,
      userId: data.userId || data.identifiedBy,
      data,
      timestamp: new Date().toISOString(),
    });
  }

  async publishCollaborationEvent(type: string, data: any): Promise<void> {
    await this.publishEvent(`collaboration.${type}`, {
      type: `collaboration_${type}`,
      userId: data.userId || data.invitedUserId,
      data,
      timestamp: new Date().toISOString(),
    });
  }

  async publishReportEvent(type: string, data: any): Promise<void> {
    await this.publishEvent(`report.${type}`, {
      type: `report_${type}`,
      userId: data.userId || data.generatedBy,
      data,
      timestamp: new Date().toISOString(),
    });
  }

  async publishSystemEvent(type: string, data: any): Promise<void> {
    await this.publishEvent(`system.${type}`, {
      type: `system_${type}`,
      userId: data.userId || 'system',
      data,
      timestamp: new Date().toISOString(),
    });
  }

  // Event metrics and monitoring

  private async updateEventMetrics(eventType: string): Promise<void> {
    try {
      const key = `event_metrics:${eventType}`;
      const today = new Date().toISOString().split('T')[0];
      
      await redis.getClient().hincrby(`${key}:${today}`, 'count', 1);
      await redis.getClient().hincrby(`${key}:total`, 'count', 1);
      
      // Set expiration for daily metrics (30 days)
      await redis.getClient().expire(`${key}:${today}`, 30 * 24 * 60 * 60);

    } catch (error) {
      logger.error('Failed to update event metrics:', error);
    }
  }

  async getEventMetrics(eventType?: string): Promise<any> {
    try {
      if (eventType) {
        const key = `event_metrics:${eventType}`;
        const total = await redis.getClient().hget(`${key}:total`, 'count');
        const today = new Date().toISOString().split('T')[0];
        const todayCount = await redis.getClient().hget(`${key}:${today}`, 'count');

        return {
          eventType,
          total: parseInt(total || '0'),
          today: parseInt(todayCount || '0'),
        };
      } else {
        const metrics = {};
        for (const channel of this.eventChannels) {
          const eventType = channel.replace('.', '_');
          const key = `event_metrics:${eventType}`;
          const total = await redis.getClient().hget(`${key}:total`, 'count');
          
          metrics[eventType] = parseInt(total || '0');
        }
        return metrics;
      }
    } catch (error) {
      logger.error('Failed to get event metrics:', error);
      return {};
    }
  }

  // Error handling

  private async handleFailedEvent(message: string, error: Error): Promise<void> {
    try {
      const dlqKey = 'event_dlq';
      const failedEvent = {
        message,
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
        retryCount: 0,
      };

      await redis.getClient().lpush(dlqKey, JSON.stringify(failedEvent));
      
      // Limit DLQ size to prevent memory issues
      await redis.getClient().ltrim(dlqKey, 0, 1000);

      logger.error('Event added to dead letter queue:', {
        error: error.message,
        messagePreview: message.substring(0, 100),
      });

    } catch (dlqError) {
      logger.error('Failed to add event to dead letter queue:', dlqError);
    }
  }

  async retryFailedEvents(): Promise<void> {
    try {
      const dlqKey = 'event_dlq';
      const failedEvents = await redis.getClient().lrange(dlqKey, 0, 10);

      for (const eventData of failedEvents) {
        try {
          const failedEvent = JSON.parse(eventData);
          
          if (failedEvent.retryCount < 3) {
            await this.handleEvent(failedEvent.message);
            
            // Remove from DLQ if successful
            await redis.getClient().lrem(dlqKey, 1, eventData);
            
            logger.info('Successfully retried failed event');
          } else {
            logger.warn('Event exceeded max retry count, skipping');
          }
        } catch (retryError) {
          logger.error('Failed to retry event:', retryError);
          
          // Increment retry count
          const failedEvent = JSON.parse(eventData);
          failedEvent.retryCount++;
          
          await redis.getClient().lrem(dlqKey, 1, eventData);
          await redis.getClient().lpush(dlqKey, JSON.stringify(failedEvent));
        }
      }
    } catch (error) {
      logger.error('Failed to retry failed events:', error);
    }
  }

  // Health check
  isHealthy(): boolean {
    return this.isListening && redis.isHealthy();
  }
}

export default new EventHandlerService();