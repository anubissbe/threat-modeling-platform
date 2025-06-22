import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import { logger, notificationLogger } from '../utils/logger';
import { notificationQueue } from './queue.service';
import { preferenceService } from './preference.service';
import { templateService } from './template.service';
import {
  NotificationRequest,
  NotificationChannel,
  NotificationEvent,
  NotificationResult,
  EmailNotification,
  SMSNotification,
  SlackNotification,
  WebhookNotification,
  BulkNotificationRequest,
  NotificationHistory,
} from '../types';

export class NotificationService {
  constructor() {}

  async initialize(): Promise<void> {
    logger.info('Initializing notification service');
    
    try {
      await templateService.initialize();
      logger.info('Notification service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize notification service:', error);
      throw error;
    }
  }

  async send(request: NotificationRequest): Promise<string> {
    const notificationId = uuidv4();
    
    try {
      // Validate request
      this.validateRequest(request);

      // Get enabled channels for the user
      const enabledChannels = await preferenceService.getEnabledChannelsForEvent(
        request.userId,
        request.event
      );

      if (enabledChannels.length === 0) {
        logger.info(`No enabled channels for user ${request.userId} and event ${request.event}`);
        return notificationId;
      }

      // Send to each enabled channel
      const promises = enabledChannels.map(async (channel) => {
        // Check if we should send to this channel
        const shouldSend = await preferenceService.shouldSendNotification(
          request.userId,
          channel,
          request.event
        );

        if (!shouldSend) {
          logger.debug(`Skipping ${channel} for user ${request.userId} due to preferences`);
          return;
        }

        // Create channel-specific notification
        const notification = await this.createChannelNotification(
          channel,
          request,
          notificationId
        );

        // Queue the notification
        await notificationQueue.enqueue(channel, notification, {
          priority: this.getPriority(request.priority),
          delay: request.delay,
        });
      });

      await Promise.all(promises);

      // Store notification history
      await this.storeNotificationHistory(notificationId, request, enabledChannels);

      logger.info(`Notification ${notificationId} queued for ${enabledChannels.length} channel(s)`);
      return notificationId;

    } catch (error: any) {
      logger.error(`Failed to send notification ${notificationId}:`, error);
      throw error;
    }
  }

  async sendBulk(request: BulkNotificationRequest): Promise<string[]> {
    const batchId = `bulk-${Date.now()}`;
    notificationLogger.batchStarted(batchId, request.userIds.length);

    try {
      const results = await Promise.all(
        request.userIds.map(async (userId) => {
          const individualRequest: NotificationRequest = {
            ...request,
            userId,
          };
          return this.send(individualRequest);
        })
      );

      const succeeded = results.filter(Boolean).length;
      const failed = results.length - succeeded;
      
      notificationLogger.batchCompleted(batchId, succeeded, failed, 0);

      return results;
    } catch (error: any) {
      logger.error(`Bulk notification ${batchId} failed:`, error);
      throw error;
    }
  }

  async sendImmediate(
    channel: NotificationChannel,
    notification: any
  ): Promise<NotificationResult> {
    // Send notification immediately without queuing
    const job = await notificationQueue.enqueue(channel, notification, {
      priority: 10, // High priority
    });

    // Wait for job completion
    return new Promise((resolve, reject) => {
      job.finished().then(resolve).catch(reject);
    });
  }

  private async createChannelNotification(
    channel: NotificationChannel,
    request: NotificationRequest,
    notificationId: string
  ): Promise<any> {
    const baseData = {
      ...request.data,
      notificationId,
      userId: request.userId,
      event: request.event,
      timestamp: new Date(),
    };

    switch (channel) {
      case 'email':
        return this.createEmailNotification(request, baseData);
      case 'sms':
        return this.createSMSNotification(request, baseData);
      case 'slack':
        return this.createSlackNotification(request, baseData);
      case 'webhook':
        return this.createWebhookNotification(request, baseData);
      default:
        throw new Error(`Unsupported channel: ${channel}`);
    }
  }

  private async createEmailNotification(
    request: NotificationRequest,
    data: any
  ): Promise<EmailNotification> {
    const notification: EmailNotification = {
      to: request.recipient || await this.getUserEmail(request.userId),
      subject: request.subject || this.getDefaultSubject(request.event),
      template: request.template || this.getDefaultTemplate('email', request.event),
      templateData: data,
      priority: request.priority,
    };

    // Add custom email fields if provided
    if (request.data?.cc) notification.cc = request.data.cc;
    if (request.data?.bcc) notification.bcc = request.data.bcc;
    if (request.data?.attachments) notification.attachments = request.data.attachments;

    return notification;
  }

  private async createSMSNotification(
    request: NotificationRequest,
    data: any
  ): Promise<SMSNotification> {
    const notification: SMSNotification = {
      to: request.recipient || await this.getUserPhone(request.userId),
      template: request.template || this.getDefaultTemplate('sms', request.event),
      templateData: data,
    };

    return notification;
  }

  private async createSlackNotification(
    request: NotificationRequest,
    data: any
  ): Promise<SlackNotification> {
    const notification: SlackNotification = {
      channel: request.recipient || await this.getUserSlackChannel(request.userId),
      template: request.template || this.getDefaultTemplate('slack', request.event),
      templateData: data,
    };

    return notification;
  }

  private async createWebhookNotification(
    request: NotificationRequest,
    data: any
  ): Promise<WebhookNotification> {
    const notification: WebhookNotification = {
      url: request.recipient || await this.getUserWebhookUrl(request.userId),
      payload: data,
      event: request.event,
      id: data.notificationId,
      secret: request.data?.webhookSecret,
      auth: request.data?.webhookAuth,
    };

    return notification;
  }

  private validateRequest(request: NotificationRequest): void {
    if (!request.userId) {
      throw new Error('User ID is required');
    }

    if (!request.event) {
      throw new Error('Event type is required');
    }

    if (!request.data) {
      throw new Error('Notification data is required');
    }
  }

  private getPriority(priority?: string): number {
    const priorities: Record<string, number> = {
      low: 1,
      normal: 5,
      high: 8,
      critical: 10,
    };

    return priorities[priority || 'normal'] || 5;
  }

  private getDefaultSubject(event: NotificationEvent): string {
    const subjects: Record<NotificationEvent, string> = {
      'threat.detected': 'New Threat Detected',
      'threat.resolved': 'Threat Resolved',
      'project.completed': 'Project Completed',
      'project.updated': 'Project Updated',
      'report.generated': 'Report Generated',
      'security.alert': 'Security Alert',
      'user.mentioned': 'You were mentioned',
      'system.maintenance': 'System Maintenance Notice',
    };

    return subjects[event] || 'Notification';
  }

  private getDefaultTemplate(channel: NotificationChannel, event: NotificationEvent): string {
    return `${event.replace('.', '_')}`;
  }

  private async getUserEmail(userId: string): Promise<string> {
    // In a real implementation, this would fetch from user service
    return `user-${userId}@example.com`;
  }

  private async getUserPhone(userId: string): Promise<string> {
    // In a real implementation, this would fetch from user service
    return `+1555${userId.slice(-7)}`;
  }

  private async getUserSlackChannel(userId: string): Promise<string> {
    // In a real implementation, this would fetch from user service
    return `@user-${userId}`;
  }

  private async getUserWebhookUrl(userId: string): Promise<string> {
    // In a real implementation, this would fetch from user service
    return `https://api.example.com/webhooks/user/${userId}`;
  }

  private async storeNotificationHistory(
    notificationId: string,
    request: NotificationRequest,
    channels: NotificationChannel[]
  ): Promise<void> {
    const history: NotificationHistory = {
      id: notificationId,
      userId: request.userId,
      event: request.event,
      channels,
      data: request.data,
      status: 'queued',
      createdAt: new Date(),
    };

    // In a real implementation, this would be stored in a database
    logger.debug('Notification history stored', history);
  }

  // Administrative methods
  async getQueueStatus() {
    return await notificationQueue.getQueueStatus();
  }

  async pauseNotifications(): Promise<void> {
    await notificationQueue.pauseQueue();
    logger.info('Notifications paused');
  }

  async resumeNotifications(): Promise<void> {
    await notificationQueue.resumeQueue();
    logger.info('Notifications resumed');
  }

  async drainQueue(): Promise<void> {
    await notificationQueue.drainQueue();
    logger.info('Notification queue drained');
  }

  // Convenience methods for common notification types
  async sendThreatAlert(
    userId: string,
    threat: {
      id: string;
      title: string;
      severity: string;
      description: string;
    }
  ): Promise<string> {
    return this.send({
      userId,
      event: 'threat.detected',
      subject: `New ${threat.severity} Threat Detected: ${threat.title}`,
      priority: threat.severity === 'critical' ? 'critical' : 'high',
      data: { threat },
    });
  }

  async sendProjectUpdate(
    userId: string,
    project: {
      id: string;
      name: string;
      status: string;
    }
  ): Promise<string> {
    return this.send({
      userId,
      event: 'project.updated',
      subject: `Project Updated: ${project.name}`,
      data: { project },
    });
  }

  async sendSecurityAlert(
    userIds: string[],
    alert: {
      type: string;
      severity: string;
      message: string;
    }
  ): Promise<string[]> {
    return this.sendBulk({
      userIds,
      event: 'security.alert',
      subject: `Security Alert: ${alert.type}`,
      priority: 'critical',
      data: { alert },
    });
  }

  async cleanup(): Promise<void> {
    await notificationQueue.closeQueue();
    await preferenceService.cleanup();
    logger.info('Notification service cleaned up');
  }
}

// Export singleton instance
export const notificationService = new NotificationService();