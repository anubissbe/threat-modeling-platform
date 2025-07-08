import { redis } from '../config/redis';
import { logger } from '../utils/logger';
import notificationService from './notification.service';
import { NotificationJob, NotificationType } from '../types';

export class QueueWorkerService {
  private isRunning = false;
  private workers: Map<string, boolean> = new Map();
  private pollingInterval = 1000; // 1 second
  private batchSize = 10;

  private queues: NotificationType[] = ['email', 'slack', 'teams', 'sms', 'webhook'];

  async startWorkers(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Queue workers already running');
      return;
    }

    try {
      this.isRunning = true;

      // Start a worker for each notification type
      for (const queueType of this.queues) {
        this.startWorker(queueType);
      }

      // Start scheduled notification processor
      this.startScheduledProcessor();

      // Start retry processor
      this.startRetryProcessor();

      logger.info('Queue workers started successfully');
    } catch (error) {
      logger.error('Failed to start queue workers:', error);
      throw error;
    }
  }

  async stopWorkers(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      this.isRunning = false;

      // Wait for all workers to finish
      const workerPromises = Array.from(this.workers.keys()).map(async (workerId) => {
        this.workers.set(workerId, false);
        logger.info(`Stopping worker: ${workerId}`);
      });

      await Promise.all(workerPromises);
      this.workers.clear();

      logger.info('All queue workers stopped');
    } catch (error) {
      logger.error('Error stopping queue workers:', error);
      throw error;
    }
  }

  private startWorker(queueType: NotificationType): void {
    const workerId = `worker-${queueType}`;
    this.workers.set(workerId, true);

    const processQueue = async () => {
      while (this.workers.get(workerId)) {
        try {
          await this.processQueueBatch(queueType);
          await this.delay(this.pollingInterval);
        } catch (error) {
          logger.error(`Worker ${workerId} error:`, error);
          await this.delay(this.pollingInterval * 2); // Backoff on error
        }
      }
    };

    processQueue().catch(error => {
      logger.error(`Worker ${workerId} crashed:`, error);
      this.workers.set(workerId, false);
    });

    logger.info(`Started worker: ${workerId}`);
  }

  private async processQueueBatch(queueType: NotificationType): Promise<void> {
    const queueName = `notifications:${queueType}`;
    
    try {
      // Get batch of jobs from priority queue
      const priorityJobs = await this.getPriorityJobs(queueType, this.batchSize);
      
      if (priorityJobs.length === 0) {
        // No priority jobs, check regular queue
        const regularJobs = await this.getRegularJobs(queueType, this.batchSize);
        
        if (regularJobs.length > 0) {
          await this.processJobs(regularJobs);
        }
      } else {
        await this.processJobs(priorityJobs);
      }
    } catch (error) {
      logger.error(`Error processing ${queueType} queue:`, error);
      throw error;
    }
  }

  private async getPriorityJobs(queueType: NotificationType, limit: number): Promise<NotificationJob[]> {
    try {
      // Get jobs from priority queue (sorted set)
      const priorityQueueName = 'notifications:priority';
      const jobs = await redis.getClient().zrevrange(priorityQueueName, 0, limit - 1, 'WITHSCORES');
      
      const priorityJobs: NotificationJob[] = [];
      
      for (let i = 0; i < jobs.length; i += 2) {
        try {
          const jobData = JSON.parse(jobs[i]);
          if (jobData.queueName === `notifications:${queueType}`) {
            const score = parseFloat(jobs[i + 1]);
            
            // Get the actual job from the queue
            const queueJob = await this.getJobFromQueue(jobData.notificationId, queueType);
            if (queueJob) {
              priorityJobs.push(queueJob);
              
              // Remove from priority queue
              await redis.getClient().zrem(priorityQueueName, jobs[i]);
            }
          }
        } catch (parseError) {
          logger.error('Error parsing priority job:', parseError);
        }
      }
      
      return priorityJobs;
    } catch (error) {
      logger.error('Error getting priority jobs:', error);
      return [];
    }
  }

  private async getRegularJobs(queueType: NotificationType, limit: number): Promise<NotificationJob[]> {
    try {
      const queueName = `notifications:${queueType}`;
      const jobsData = await redis.getClient().lrange(queueName, 0, limit - 1);
      
      const jobs: NotificationJob[] = [];
      
      for (const jobData of jobsData) {
        try {
          const job = JSON.parse(jobData);
          jobs.push(job);
          
          // Remove from queue
          await redis.getClient().lrem(queueName, 1, jobData);
        } catch (parseError) {
          logger.error('Error parsing regular job:', parseError);
          // Remove corrupted job
          await redis.getClient().lrem(queueName, 1, jobData);
        }
      }
      
      return jobs;
    } catch (error) {
      logger.error('Error getting regular jobs:', error);
      return [];
    }
  }

  private async getJobFromQueue(notificationId: string, queueType: NotificationType): Promise<NotificationJob | null> {
    try {
      const queueName = `notifications:${queueType}`;
      const jobsData = await redis.getClient().lrange(queueName, 0, -1);
      
      for (const jobData of jobsData) {
        try {
          const job = JSON.parse(jobData);
          if (job.notificationId === notificationId) {
            // Remove from queue
            await redis.getClient().lrem(queueName, 1, jobData);
            return job;
          }
        } catch (parseError) {
          logger.error('Error parsing job from queue:', parseError);
        }
      }
      
      return null;
    } catch (error) {
      logger.error('Error getting job from queue:', error);
      return null;
    }
  }

  private async processJobs(jobs: NotificationJob[]): Promise<void> {
    const promises = jobs.map(job => this.processJob(job));
    await Promise.allSettled(promises);
  }

  private async processJob(job: NotificationJob): Promise<void> {
    try {
      logger.debug(`Processing notification job: ${job.notificationId}`);
      
      // Update job status
      job.attempts++;
      
      // Process the notification
      await notificationService.processNotification(job.notificationId);
      
      logger.debug(`Successfully processed job: ${job.notificationId}`);
      
      // Update job metrics
      await this.updateJobMetrics(job.type, 'completed');
      
    } catch (error) {
      logger.error(`Failed to process job ${job.notificationId}:`, error);
      
      // Handle job retry
      await this.handleJobFailure(job, error as Error);
      
      // Update job metrics
      await this.updateJobMetrics(job.type, 'failed');
    }
  }

  private async handleJobFailure(job: NotificationJob, error: Error): Promise<void> {
    try {
      if (job.attempts < job.maxAttempts) {
        // Retry the job
        const retryDelay = this.calculateRetryDelay(job.attempts);
        const retryAt = new Date(Date.now() + retryDelay);
        
        await redis.getClient().zadd(
          'notifications:retry',
          retryAt.getTime(),
          JSON.stringify({
            ...job,
            retryAt: retryAt.toISOString(),
            lastError: error.message,
          })
        );
        
        logger.info(`Job ${job.notificationId} scheduled for retry in ${retryDelay}ms`);
      } else {
        // Move to dead letter queue
        await this.moveToDeadLetterQueue(job, error);
        logger.error(`Job ${job.notificationId} moved to dead letter queue after ${job.attempts} attempts`);
      }
    } catch (retryError) {
      logger.error(`Error handling job failure for ${job.notificationId}:`, retryError);
    }
  }

  private calculateRetryDelay(attempt: number): number {
    // Exponential backoff with jitter
    const baseDelay = 1000; // 1 second
    const maxDelay = 300000; // 5 minutes
    const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
    const jitter = Math.random() * 1000; // Up to 1 second jitter
    
    return Math.min(exponentialDelay + jitter, maxDelay);
  }

  private async moveToDeadLetterQueue(job: NotificationJob, error: Error): Promise<void> {
    try {
      const dlqData = {
        job,
        error: error.message,
        stack: error.stack,
        failedAt: new Date().toISOString(),
      };
      
      await redis.getClient().lpush('notifications:dlq', JSON.stringify(dlqData));
      
      // Limit DLQ size
      await redis.getClient().ltrim('notifications:dlq', 0, 1000);
      
    } catch (dlqError) {
      logger.error('Failed to move job to dead letter queue:', dlqError);
    }
  }

  private startScheduledProcessor(): void {
    const workerId = 'scheduled-processor';
    this.workers.set(workerId, true);

    const processScheduled = async () => {
      while (this.workers.get(workerId)) {
        try {
          await this.processScheduledNotifications();
          await this.delay(5000); // Check every 5 seconds
        } catch (error) {
          logger.error('Scheduled processor error:', error);
          await this.delay(10000); // Backoff on error
        }
      }
    };

    processScheduled().catch(error => {
      logger.error('Scheduled processor crashed:', error);
      this.workers.set(workerId, false);
    });

    logger.info('Started scheduled notification processor');
  }

  private async processScheduledNotifications(): Promise<void> {
    try {
      const now = Date.now();
      const scheduledJobs = await redis.getClient().zrangebyscore(
        'notifications:scheduled',
        0,
        now,
        'LIMIT',
        0,
        10
      );

      for (const notificationId of scheduledJobs) {
        try {
          // Process the scheduled notification
          await notificationService.processNotification(notificationId);
          
          // Remove from scheduled queue
          await redis.getClient().zrem('notifications:scheduled', notificationId);
          
          logger.debug(`Processed scheduled notification: ${notificationId}`);
        } catch (error) {
          logger.error(`Failed to process scheduled notification ${notificationId}:`, error);
        }
      }
    } catch (error) {
      logger.error('Error processing scheduled notifications:', error);
    }
  }

  private startRetryProcessor(): void {
    const workerId = 'retry-processor';
    this.workers.set(workerId, true);

    const processRetries = async () => {
      while (this.workers.get(workerId)) {
        try {
          await this.processRetryQueue();
          await this.delay(10000); // Check every 10 seconds
        } catch (error) {
          logger.error('Retry processor error:', error);
          await this.delay(15000); // Backoff on error
        }
      }
    };

    processRetries().catch(error => {
      logger.error('Retry processor crashed:', error);
      this.workers.set(workerId, false);
    });

    logger.info('Started retry processor');
  }

  private async processRetryQueue(): Promise<void> {
    try {
      const now = Date.now();
      const retryJobs = await redis.getClient().zrangebyscore(
        'notifications:retry',
        0,
        now,
        'LIMIT',
        0,
        5
      );

      for (const jobData of retryJobs) {
        try {
          const job = JSON.parse(jobData);
          
          // Re-queue the job
          await this.requeueJob(job);
          
          // Remove from retry queue
          await redis.getClient().zrem('notifications:retry', jobData);
          
          logger.debug(`Requeued job for retry: ${job.notificationId}`);
        } catch (error) {
          logger.error('Failed to process retry job:', error);
          // Remove corrupted job
          await redis.getClient().zrem('notifications:retry', jobData);
        }
      }
    } catch (error) {
      logger.error('Error processing retry queue:', error);
    }
  }

  private async requeueJob(job: NotificationJob): Promise<void> {
    try {
      const queueName = `notifications:${job.type}`;
      await redis.getClient().lpush(queueName, JSON.stringify(job));
      
      // Add to priority queue if high priority
      if (job.priority >= 75) {
        await redis.getClient().zadd(
          'notifications:priority',
          job.priority,
          JSON.stringify({ notificationId: job.notificationId, queueName })
        );
      }
    } catch (error) {
      logger.error('Failed to requeue job:', error);
      throw error;
    }
  }

  private async updateJobMetrics(type: NotificationType, status: 'completed' | 'failed'): Promise<void> {
    try {
      const date = new Date().toISOString().split('T')[0];
      const metricsKey = `job_metrics:${type}:${date}`;
      
      await redis.getClient().hincrby(metricsKey, status, 1);
      await redis.getClient().hincrby(metricsKey, 'total', 1);
      
      // Set expiration for daily metrics (30 days)
      await redis.getClient().expire(metricsKey, 30 * 24 * 60 * 60);
      
      // Update global metrics
      const globalKey = `job_metrics:global:${date}`;
      await redis.getClient().hincrby(globalKey, status, 1);
      await redis.getClient().hincrby(globalKey, 'total', 1);
      await redis.getClient().expire(globalKey, 30 * 24 * 60 * 60);
      
    } catch (error) {
      logger.error('Failed to update job metrics:', error);
    }
  }

  async getQueueStats(): Promise<any> {
    try {
      const stats = {};
      
      for (const queueType of this.queues) {
        const queueName = `notifications:${queueType}`;
        const queueLength = await redis.getClient().llen(queueName);
        
        stats[queueType] = {
          waiting: queueLength,
          workers: this.workers.has(`worker-${queueType}`) ? 1 : 0,
        };
      }

      // Get priority queue stats
      const priorityCount = await redis.getClient().zcard('notifications:priority');
      const scheduledCount = await redis.getClient().zcard('notifications:scheduled');
      const retryCount = await redis.getClient().zcard('notifications:retry');
      const dlqCount = await redis.getClient().llen('notifications:dlq');

      return {
        queues: stats,
        priority: priorityCount,
        scheduled: scheduledCount,
        retry: retryCount,
        deadLetter: dlqCount,
        workers: {
          running: Array.from(this.workers.values()).filter(Boolean).length,
          total: this.workers.size,
        },
      };
    } catch (error) {
      logger.error('Failed to get queue stats:', error);
      return {};
    }
  }

  async getJobMetrics(days: number = 7): Promise<any> {
    try {
      const metrics = {};
      const today = new Date();
      
      for (let i = 0; i < days; i++) {
        const date = new Date(today.getTime() - (i * 24 * 60 * 60 * 1000))
          .toISOString()
          .split('T')[0];
        
        const globalKey = `job_metrics:global:${date}`;
        const dayMetrics = await redis.getClient().hgetall(globalKey);
        
        metrics[date] = {
          completed: parseInt(dayMetrics.completed || '0'),
          failed: parseInt(dayMetrics.failed || '0'),
          total: parseInt(dayMetrics.total || '0'),
        };
      }
      
      return metrics;
    } catch (error) {
      logger.error('Failed to get job metrics:', error);
      return {};
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  isHealthy(): boolean {
    return this.isRunning && this.workers.size > 0;
  }
}

export default new QueueWorkerService();