import { Queue, Worker, Job, QueueEvents } from 'bullmq';
import Redis from 'ioredis';
import { config, getQueueRedisUrl } from '../config';
import { logger, notificationLogger } from '../utils/logger';
import {
  NotificationJob,
  NotificationResult,
  NotificationChannel,
  EmailNotification,
  SMSNotification,
  SlackNotification,
  WebhookNotification,
} from '../types';
import { EmailProviderFactory } from './providers/email.provider';
import { SMSProviderFactory } from './providers/sms.provider';
import { SlackProviderFactory } from './providers/slack.provider';
import { HTTPWebhookProvider } from './providers/webhook.provider';
import { templateService } from './template.service';

export class NotificationQueueService {
  private queue: Queue<NotificationJob>;
  private worker: Worker<NotificationJob, NotificationResult>;
  private queueEvents: QueueEvents;
  private connection: Redis;

  constructor() {
    // Create Redis connection
    this.connection = new Redis(getQueueRedisUrl(), {
      maxRetriesPerRequest: null,
    });

    // Initialize queue
    this.queue = new Queue<NotificationJob>('notifications', {
      connection: this.connection,
      defaultJobOptions: {
        attempts: config.QUEUE_MAX_ATTEMPTS,
        backoff: {
          type: 'exponential',
          delay: config.NOTIFICATION_RETRY_DELAY_MS,
        },
        removeOnComplete: {
          age: 24 * 3600, // Keep completed jobs for 24 hours
          count: 1000, // Keep last 1000 completed jobs
        },
        removeOnFail: {
          age: 7 * 24 * 3600, // Keep failed jobs for 7 days
          count: 5000, // Keep last 5000 failed jobs
        },
      },
    });

    // Initialize worker
    this.worker = new Worker<NotificationJob, NotificationResult>(
      'notifications',
      async (job) => this.processNotification(job),
      {
        connection: this.connection,
        concurrency: config.QUEUE_CONCURRENCY,
      }
    );

    // Initialize queue events
    this.queueEvents = new QueueEvents('notifications', {
      connection: this.connection,
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.worker.on('completed', (job) => {
      logger.info(`Notification job completed: ${job.id}`);
    });

    this.worker.on('failed', (job, error) => {
      logger.error(`Notification job failed: ${job?.id}`, error);
    });

    this.worker.on('active', (job) => {
      logger.debug(`Processing notification job: ${job.id}`);
    });

    this.queueEvents.on('waiting', ({ jobId }) => {
      logger.debug(`Notification job waiting: ${jobId}`);
    });

    this.queueEvents.on('delayed', ({ jobId, delay }) => {
      logger.debug(`Notification job delayed: ${jobId} for ${delay}ms`);
    });
  }

  async enqueue(
    channel: NotificationChannel,
    notification: any,
    options?: {
      priority?: number;
      delay?: number;
      attempts?: number;
      jobId?: string;
    }
  ): Promise<Job<NotificationJob>> {
    const jobData: NotificationJob = {
      channel,
      notification,
      createdAt: new Date(),
    };

    const job = await this.queue.add(
      `${channel}-notification`,
      jobData,
      {
        priority: options?.priority,
        delay: options?.delay,
        attempts: options?.attempts || config.QUEUE_MAX_ATTEMPTS,
        jobId: options?.jobId,
      }
    );

    notificationLogger.queued(
      channel,
      this.getRecipient(notification),
      job.id!
    );

    return job;
  }

  async enqueueBatch(
    notifications: Array<{
      channel: NotificationChannel;
      notification: any;
      options?: any;
    }>
  ): Promise<Job<NotificationJob>[]> {
    const batchId = `batch-${Date.now()}`;
    notificationLogger.batchStarted(batchId, notifications.length);

    const jobs = await Promise.all(
      notifications.map((item, index) =>
        this.enqueue(item.channel, item.notification, {
          ...item.options,
          jobId: `${batchId}-${index}`,
        })
      )
    );

    return jobs;
  }

  private async processNotification(
    job: Job<NotificationJob>
  ): Promise<NotificationResult> {
    const { channel, notification } = job.data;
    const startTime = Date.now();

    try {
      let result: NotificationResult;

      switch (channel) {
        case 'email':
          result = await this.sendEmail(notification as EmailNotification);
          break;
        case 'sms':
          result = await this.sendSMS(notification as SMSNotification);
          break;
        case 'slack':
          result = await this.sendSlack(notification as SlackNotification);
          break;
        case 'webhook':
          result = await this.sendWebhook(notification as WebhookNotification);
          break;
        default:
          throw new Error(`Unsupported notification channel: ${channel}`);
      }

      const duration = Date.now() - startTime;
      notificationLogger.delivered(
        channel,
        this.getRecipient(notification),
        job.id!,
        result.provider
      );

      return {
        ...result,
        processingTime: duration,
      };

    } catch (error: any) {
      const duration = Date.now() - startTime;
      notificationLogger.failed(
        channel,
        this.getRecipient(notification),
        error,
        job.id!
      );

      // Check if this is the last attempt
      if (job.attemptsMade >= (job.opts.attempts || config.QUEUE_MAX_ATTEMPTS)) {
        // Move to dead letter queue or handle permanent failure
        await this.handlePermanentFailure(job, error);
      }

      throw error;
    }
  }

  private async sendEmail(notification: EmailNotification): Promise<NotificationResult> {
    // Render template if template name is provided
    if (notification.template) {
      const rendered = await templateService.render(
        `email/${notification.template}`,
        notification.templateData!
      );
      notification.html = rendered;
    }

    const provider = EmailProviderFactory.create();
    const result = await provider.send(notification);

    return {
      channel: 'email',
      success: result.accepted.length > 0,
      provider: 'email',
      metadata: result,
    };
  }

  private async sendSMS(notification: SMSNotification): Promise<NotificationResult> {
    // Render template if template name is provided
    if (notification.template) {
      const rendered = await templateService.render(
        `sms/${notification.template}`,
        notification.templateData!
      );
      notification.body = rendered;
    }

    const provider = SMSProviderFactory.create();
    const result = await provider.send(notification);

    return {
      channel: 'sms',
      success: result.status === 'sent' || result.status === 'delivered',
      provider: 'sms',
      metadata: result,
    };
  }

  private async sendSlack(notification: SlackNotification): Promise<NotificationResult> {
    // Render template if template name is provided
    if (notification.template) {
      const rendered = await templateService.render(
        `slack/${notification.template}`,
        notification.templateData!
      );
      notification.text = rendered;
    }

    const provider = SlackProviderFactory.create();
    const result = await provider.send(notification);

    return {
      channel: 'slack',
      success: result.ok,
      provider: 'slack',
      metadata: result,
    };
  }

  private async sendWebhook(notification: WebhookNotification): Promise<NotificationResult> {
    const provider = new HTTPWebhookProvider();
    const result = await provider.send(notification);

    return {
      channel: 'webhook',
      success: result.status >= 200 && result.status < 300,
      provider: 'webhook',
      metadata: result,
    };
  }

  private getRecipient(notification: any): string {
    if (notification.to) return notification.to;
    if (notification.channel) return notification.channel;
    if (notification.url) return notification.url;
    return 'unknown';
  }

  private async handlePermanentFailure(
    job: Job<NotificationJob>,
    error: Error
  ): Promise<void> {
    logger.error(`Notification permanently failed after ${job.attemptsMade} attempts`, {
      jobId: job.id,
      channel: job.data.channel,
      error: error.message,
    });

    // Store failure details for analysis
    await this.storeFailedNotification(job, error);

    // Send alert about critical notification failure if needed
    if (this.isCriticalNotification(job.data)) {
      await this.alertOnCriticalFailure(job, error);
    }
  }

  private async storeFailedNotification(
    job: Job<NotificationJob>,
    error: Error
  ): Promise<void> {
    // Implementation would store in database
    // For now, just log
    logger.error('Failed notification stored', {
      jobId: job.id,
      data: job.data,
      error: error.message,
      attempts: job.attemptsMade,
    });
  }

  private isCriticalNotification(data: NotificationJob): boolean {
    // Define what makes a notification critical
    return data.notification.priority === 'critical' ||
           data.notification.type === 'security_alert';
  }

  private async alertOnCriticalFailure(
    job: Job<NotificationJob>,
    error: Error
  ): Promise<void> {
    // Send alert through alternative channel
    logger.error('CRITICAL: Notification delivery failed', {
      jobId: job.id,
      channel: job.data.channel,
      error: error.message,
    });
  }

  // Queue management methods
  async getQueueStatus(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount(),
      this.queue.getDelayedCount(),
    ]);

    return { waiting, active, completed, failed, delayed };
  }

  async pauseQueue(): Promise<void> {
    await this.queue.pause();
    logger.info('Notification queue paused');
  }

  async resumeQueue(): Promise<void> {
    await this.queue.resume();
    logger.info('Notification queue resumed');
  }

  async drainQueue(): Promise<void> {
    await this.queue.drain();
    logger.info('Notification queue drained');
  }

  async closeQueue(): Promise<void> {
    await this.queueEvents.close();
    await this.worker.close();
    await this.queue.close();
    await this.connection.quit();
    logger.info('Notification queue closed');
  }
}

// Export singleton instance
export const notificationQueue = new NotificationQueueService();