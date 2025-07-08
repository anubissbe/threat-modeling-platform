import { v4 as uuidv4 } from 'uuid';
import { database } from '../config/database';
import { redis } from '../config/redis';
import { logger } from '../utils/logger';
import {
  BaseNotification,
  NotificationStatus,
  NotificationPriority,
  NotificationType,
  SendNotificationRequest,
  ScheduleNotificationRequest,
  NotificationListResponse,
  NotificationEvent,
  NotificationJob,
  RetryableError,
} from '../types';
import { NotificationProvider } from '../providers/base.provider';
import { EmailProvider } from '../providers/email.provider';
import { SlackProvider } from '../providers/slack.provider';
import { TeamsProvider } from '../providers/teams.provider';
import { SMSProvider } from '../providers/sms.provider';
import { WebhookProvider } from '../providers/webhook.provider';

export class NotificationService {
  private providers: Map<NotificationType, NotificationProvider>;
  private retryDelays = [1000, 5000, 15000, 30000, 60000]; // Progressive delays in ms

  constructor() {
    this.providers = new Map();
    this.initializeProviders();
  }

  private initializeProviders(): void {
    try {
      this.providers.set('email', new EmailProvider());
      this.providers.set('slack', new SlackProvider());
      this.providers.set('teams', new TeamsProvider());
      this.providers.set('sms', new SMSProvider());
      this.providers.set('webhook', new WebhookProvider());
      
      logger.info('Notification providers initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize notification providers:', error);
    }
  }

  async sendNotification(request: SendNotificationRequest): Promise<string> {
    const notificationId = uuidv4();
    
    try {
      // Create notification record
      const notification = await this.createNotification({
        id: notificationId,
        ...request,
        status: 'pending',
        priority: request.priority || 'medium',
        retryCount: 0,
        maxRetries: 3,
        metadata: request.metadata || {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // If template is specified, render it
      if (request.templateId) {
        await this.renderTemplate(notification, request.templateVariables || {});
      }

      // Add to queue for processing
      await this.enqueueNotification(notification);

      logger.info(`Notification queued successfully: ${notificationId}`);
      return notificationId;
    } catch (error) {
      logger.error(`Failed to send notification: ${notificationId}`, error);
      throw error;
    }
  }

  async scheduleNotification(request: ScheduleNotificationRequest): Promise<string> {
    const notificationId = uuidv4();
    
    try {
      // Create notification record with scheduled status
      const notification = await this.createNotification({
        id: notificationId,
        ...request,
        status: 'scheduled',
        priority: request.priority || 'medium',
        retryCount: 0,
        maxRetries: 3,
        metadata: request.metadata || {},
        scheduledAt: request.scheduledAt,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Schedule for future processing
      await this.scheduleForProcessing(notification);

      logger.info(`Notification scheduled successfully: ${notificationId} for ${request.scheduledAt}`);
      return notificationId;
    } catch (error) {
      logger.error(`Failed to schedule notification: ${notificationId}`, error);
      throw error;
    }
  }

  async processNotification(notificationId: string): Promise<void> {
    const startTime = Date.now();
    
    try {
      const notification = await this.getNotificationById(notificationId);
      if (!notification) {
        logger.warn(`Notification not found: ${notificationId}`);
        return;
      }

      if (notification.status === 'sent' || notification.status === 'cancelled') {
        logger.debug(`Notification already processed: ${notificationId}`);
        return;
      }

      // Check if it's time to send scheduled notifications
      if (notification.scheduledAt && new Date() < notification.scheduledAt) {
        logger.debug(`Notification not yet due: ${notificationId}`);
        return;
      }

      // Get provider for notification type
      const provider = this.providers.get(notification.type);
      if (!provider) {
        throw new Error(`No provider found for notification type: ${notification.type}`);
      }

      // Update status to processing
      await this.updateNotificationStatus(notificationId, 'pending');

      // Send notification
      await provider.send(notification);

      // Update status to sent
      await this.updateNotificationStatus(notificationId, 'sent', {
        sentAt: new Date(),
      });

      // Log successful delivery
      await this.logNotificationAttempt(notificationId, 'sent', {
        processingTimeMs: Date.now() - startTime,
      });

      logger.info(`Notification sent successfully: ${notificationId}`);
    } catch (error) {
      const processingTime = Date.now() - startTime;
      await this.handleNotificationError(notificationId, error as Error, processingTime);
    }
  }

  async cancelNotification(notificationId: string): Promise<void> {
    try {
      await this.updateNotificationStatus(notificationId, 'cancelled');
      
      // Remove from queue if present
      await this.removeFromQueue(notificationId);
      
      logger.info(`Notification cancelled: ${notificationId}`);
    } catch (error) {
      logger.error(`Failed to cancel notification: ${notificationId}`, error);
      throw error;
    }
  }

  async getNotifications(
    userId: string,
    page: number = 1,
    limit: number = 20,
    status?: NotificationStatus
  ): Promise<NotificationListResponse> {
    try {
      const offset = (page - 1) * limit;
      let query = `
        SELECT * FROM notifications 
        WHERE user_id = $1
      `;
      const params: any[] = [userId];

      if (status) {
        query += ' AND status = $2';
        params.push(status);
      }

      query += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
      params.push(limit, offset);

      const result = await database.query(query, params);
      
      // Get total count
      let countQuery = 'SELECT COUNT(*) FROM notifications WHERE user_id = $1';
      const countParams: any[] = [userId];
      
      if (status) {
        countQuery += ' AND status = $2';
        countParams.push(status);
      }
      
      const countResult = await database.query(countQuery, countParams);
      const total = parseInt(countResult.rows[0].count);

      return {
        notifications: result.rows.map(this.mapRowToNotification),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      logger.error('Failed to get notifications:', error);
      throw error;
    }
  }

  async handleEvent(event: NotificationEvent): Promise<void> {
    try {
      logger.debug(`Processing event: ${event.type} for user: ${event.userId}`);

      // Get user's subscriptions for this event type
      const subscriptions = await this.getUserSubscriptions(event.userId, event.type);
      
      if (subscriptions.length === 0) {
        logger.debug(`No subscriptions found for event: ${event.type}`);
        return;
      }

      // Process each subscription
      for (const subscription of subscriptions) {
        if (!subscription.enabled) continue;

        // Check if event matches filter criteria
        if (!this.matchesFilterCriteria(event, subscription.filterCriteria)) {
          continue;
        }

        // Get user preferences for this channel
        const preferences = await this.getUserPreferences(event.userId, subscription.channel);
        
        if (!preferences?.enabled) {
          logger.debug(`Notifications disabled for channel: ${subscription.channel}`);
          continue;
        }

        // Check quiet hours
        if (this.isInQuietHours(preferences)) {
          logger.debug(`Skipping notification due to quiet hours: ${subscription.channel}`);
          continue;
        }

        // Get template for this event type
        const template = await this.getTemplateByType(event.type);
        if (!template) {
          logger.warn(`No template found for event type: ${event.type}`);
          continue;
        }

        // Create notification request
        const notificationRequest: SendNotificationRequest = {
          userId: event.userId,
          type: subscription.channel,
          channel: await this.getChannelAddress(event.userId, subscription.channel),
          subject: template.subject,
          message: template.body,
          htmlMessage: template.htmlBody,
          priority: this.getEventPriority(event.type),
          templateId: template.id,
          templateVariables: event.data,
          metadata: {
            eventType: event.type,
            eventData: event.data,
            subscriptionId: subscription.id,
          },
        };

        // Send notification
        await this.sendNotification(notificationRequest);
      }
    } catch (error) {
      logger.error(`Failed to handle event: ${event.type}`, error);
      throw error;
    }
  }

  private async createNotification(notification: BaseNotification): Promise<BaseNotification> {
    const query = `
      INSERT INTO notifications (
        id, user_id, type, channel, subject, message, html_message, 
        metadata, status, priority, scheduled_at, retry_count, max_retries,
        template_id, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *
    `;

    const params = [
      notification.id,
      notification.userId,
      notification.type,
      notification.channel,
      notification.subject,
      notification.message,
      notification.htmlMessage,
      JSON.stringify(notification.metadata),
      notification.status,
      notification.priority,
      notification.scheduledAt,
      notification.retryCount,
      notification.maxRetries,
      notification.templateId,
      notification.createdAt,
      notification.updatedAt,
    ];

    const result = await database.query(query, params);
    return this.mapRowToNotification(result.rows[0]);
  }

  private async renderTemplate(notification: BaseNotification, variables: Record<string, any>): Promise<void> {
    if (!notification.templateId) return;

    const template = await this.getTemplateById(notification.templateId);
    if (!template) {
      logger.warn(`Template not found: ${notification.templateId}`);
      return;
    }

    // Simple template rendering (replace {{variable}} with values)
    let renderedSubject = template.subject;
    let renderedBody = template.body;
    let renderedHtmlBody = template.htmlBody;

    Object.entries(variables).forEach(([key, value]) => {
      const placeholder = `{{${key}}}`;
      const stringValue = String(value);
      
      renderedSubject = renderedSubject.replace(new RegExp(placeholder, 'g'), stringValue);
      renderedBody = renderedBody.replace(new RegExp(placeholder, 'g'), stringValue);
      if (renderedHtmlBody) {
        renderedHtmlBody = renderedHtmlBody.replace(new RegExp(placeholder, 'g'), stringValue);
      }
    });

    // Update notification with rendered content
    await this.updateNotification(notification.id, {
      subject: renderedSubject,
      message: renderedBody,
      htmlMessage: renderedHtmlBody,
    });
  }

  private async enqueueNotification(notification: BaseNotification): Promise<void> {
    const queueName = `notifications:${notification.type}`;
    const priority = this.getPriorityScore(notification.priority);
    
    const job: NotificationJob = {
      id: uuidv4(),
      notificationId: notification.id,
      type: notification.type,
      priority,
      attempts: 0,
      maxAttempts: notification.maxRetries,
      data: notification,
    };

    // Add to Redis queue
    await redis.getClient().lpush(queueName, JSON.stringify(job));
    
    // Add to priority queue
    await redis.getClient().zadd(
      'notifications:priority',
      priority,
      JSON.stringify({ notificationId: notification.id, queueName })
    );
  }

  private async scheduleForProcessing(notification: BaseNotification): Promise<void> {
    if (!notification.scheduledAt) return;

    const delay = notification.scheduledAt.getTime() - Date.now();
    
    if (delay <= 0) {
      // Schedule immediately
      await this.enqueueNotification(notification);
    } else {
      // Schedule for future processing
      await redis.getClient().zadd(
        'notifications:scheduled',
        notification.scheduledAt.getTime(),
        notification.id
      );
    }
  }

  private async handleNotificationError(
    notificationId: string,
    error: Error,
    processingTime: number
  ): Promise<void> {
    const notification = await this.getNotificationById(notificationId);
    if (!notification) return;

    const retryable = this.isRetryableError(error);
    const canRetry = retryable && notification.retryCount < notification.maxRetries;

    if (canRetry) {
      // Schedule retry
      const delay = this.getRetryDelay(notification.retryCount);
      const nextRetryAt = new Date(Date.now() + delay);

      await this.updateNotification(notificationId, {
        retryCount: notification.retryCount + 1,
        errorMessage: error.message,
        updatedAt: new Date(),
      });

      // Schedule retry
      await redis.getClient().zadd(
        'notifications:retry',
        nextRetryAt.getTime(),
        notificationId
      );

      logger.warn(`Notification will be retried: ${notificationId} in ${delay}ms`);
    } else {
      // Mark as failed
      await this.updateNotificationStatus(notificationId, 'failed', {
        errorMessage: error.message,
      });

      logger.error(`Notification failed permanently: ${notificationId}`, error);
    }

    // Log attempt
    await this.logNotificationAttempt(notificationId, 'failed', {
      errorMessage: error.message,
      processingTimeMs: processingTime,
    });
  }

  private async updateNotificationStatus(
    notificationId: string,
    status: NotificationStatus,
    additionalFields?: Record<string, any>
  ): Promise<void> {
    const fields = { status, updatedAt: new Date(), ...additionalFields };
    await this.updateNotification(notificationId, fields);
  }

  private async updateNotification(
    notificationId: string,
    fields: Record<string, any>
  ): Promise<void> {
    const setClause = Object.keys(fields)
      .map((key, index) => `${this.camelToSnake(key)} = $${index + 2}`)
      .join(', ');

    const query = `UPDATE notifications SET ${setClause} WHERE id = $1`;
    const params = [notificationId, ...Object.values(fields)];

    await database.query(query, params);
  }

  private async logNotificationAttempt(
    notificationId: string,
    status: NotificationStatus,
    details: Record<string, any> = {}
  ): Promise<void> {
    const notification = await this.getNotificationById(notificationId);
    if (!notification) return;

    const query = `
      INSERT INTO notification_logs (
        id, notification_id, status, error_message, response_data, 
        attempt_number, processing_time_ms, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `;

    const params = [
      uuidv4(),
      notificationId,
      status,
      details.errorMessage || null,
      JSON.stringify(details.responseData || {}),
      notification.retryCount + 1,
      details.processingTimeMs || null,
      new Date(),
    ];

    await database.query(query, params);
  }

  private async getNotificationById(id: string): Promise<BaseNotification | null> {
    const query = 'SELECT * FROM notifications WHERE id = $1';
    const result = await database.query(query, [id]);
    
    return result.rows[0] ? this.mapRowToNotification(result.rows[0]) : null;
  }

  private async getTemplateById(id: string): Promise<any> {
    const query = 'SELECT * FROM notification_templates WHERE id = $1 AND is_active = true';
    const result = await database.query(query, [id]);
    
    return result.rows[0] || null;
  }

  private async getTemplateByType(type: string): Promise<any> {
    const query = 'SELECT * FROM notification_templates WHERE type = $1 AND is_active = true';
    const result = await database.query(query, [type]);
    
    return result.rows[0] || null;
  }

  private async getUserSubscriptions(userId: string, eventType: string): Promise<any[]> {
    const query = `
      SELECT * FROM notification_subscriptions 
      WHERE user_id = $1 AND event_type = $2 AND enabled = true
    `;
    const result = await database.query(query, [userId, eventType]);
    
    return result.rows;
  }

  private async getUserPreferences(userId: string, channel: NotificationType): Promise<any> {
    const query = `
      SELECT * FROM notification_preferences 
      WHERE user_id = $1 AND channel = $2
    `;
    const result = await database.query(query, [userId, channel]);
    
    return result.rows[0] || null;
  }

  private async getChannelAddress(userId: string, channel: NotificationType): Promise<string> {
    // For now, return user email for email notifications
    // In a real implementation, this would fetch the appropriate channel address
    if (channel === 'email') {
      const query = 'SELECT email FROM users WHERE id = $1';
      const result = await database.query(query, [userId]);
      return result.rows[0]?.email || '';
    }
    
    return '';
  }

  private async removeFromQueue(notificationId: string): Promise<void> {
    // Remove from all relevant queues
    const queues = ['email', 'slack', 'teams', 'sms', 'webhook'];
    
    for (const queue of queues) {
      const queueName = `notifications:${queue}`;
      const jobs = await redis.getClient().lrange(queueName, 0, -1);
      
      for (let i = 0; i < jobs.length; i++) {
        const job = JSON.parse(jobs[i]);
        if (job.notificationId === notificationId) {
          await redis.getClient().lrem(queueName, 1, jobs[i]);
          break;
        }
      }
    }
  }

  private mapRowToNotification(row: any): BaseNotification {
    return {
      id: row.id,
      userId: row.user_id,
      type: row.type,
      channel: row.channel,
      subject: row.subject,
      message: row.message,
      htmlMessage: row.html_message,
      metadata: row.metadata || {},
      status: row.status,
      priority: row.priority,
      scheduledAt: row.scheduled_at,
      sentAt: row.sent_at,
      retryCount: row.retry_count,
      maxRetries: row.max_retries,
      errorMessage: row.error_message,
      templateId: row.template_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private getPriorityScore(priority: NotificationPriority): number {
    const scores = { urgent: 100, high: 75, medium: 50, low: 25 };
    return scores[priority] || 50;
  }

  private getEventPriority(eventType: string): NotificationPriority {
    const priorities: Record<string, NotificationPriority> = {
      'threat_identified': 'high',
      'system_maintenance': 'high',
      'threat_mitigated': 'medium',
      'report_generated': 'medium',
      'threat_model_created': 'low',
      'threat_model_updated': 'low',
      'collaboration_invited': 'low',
    };
    
    return priorities[eventType] || 'medium';
  }

  private matchesFilterCriteria(event: NotificationEvent, criteria: Record<string, any>): boolean {
    if (!criteria || Object.keys(criteria).length === 0) return true;

    // Simple criteria matching - can be extended
    for (const [key, value] of Object.entries(criteria)) {
      if (event.data[key] !== value) {
        return false;
      }
    }

    return true;
  }

  private isInQuietHours(preferences: any): boolean {
    if (!preferences?.quietHoursStart || !preferences?.quietHoursEnd) return false;

    const now = new Date();
    const timezone = preferences.timezone || 'UTC';
    
    // Simple quiet hours check - can be enhanced with proper timezone handling
    const currentHour = now.getHours();
    const startHour = parseInt(preferences.quietHoursStart.split(':')[0]);
    const endHour = parseInt(preferences.quietHoursEnd.split(':')[0]);

    if (startHour <= endHour) {
      return currentHour >= startHour && currentHour < endHour;
    } else {
      return currentHour >= startHour || currentHour < endHour;
    }
  }

  private isRetryableError(error: Error): boolean {
    const retryableErrors = [
      'ECONNREFUSED',
      'ENOTFOUND',
      'ETIMEDOUT',
      'ECONNRESET',
      'EPIPE',
    ];

    return retryableErrors.some(code => error.message.includes(code)) ||
           (error as RetryableError).retryable === true;
  }

  private getRetryDelay(attemptNumber: number): number {
    return this.retryDelays[Math.min(attemptNumber, this.retryDelays.length - 1)];
  }

  private camelToSnake(str: string): string {
    return str.replace(/([A-Z])/g, '_$1').toLowerCase();
  }
}

export default new NotificationService();