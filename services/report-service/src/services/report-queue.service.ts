import { Queue, Worker, Job, QueueEvents } from 'bullmq';
import { config, getQueueRedisUrl } from '../config';
import { logger, reportLogger } from '../utils/logger';
import {
  ReportJob,
  ReportJobData,
  ReportQueueOptions,
  ReportStatus,
  ReportGenerationResult,
} from '../types';
import { ReportGeneratorService } from './report-generator.service';
import { v4 as uuidv4 } from 'uuid';

export class ReportQueueService {
  private queue: Queue<ReportJobData>;
  private worker: Worker<ReportJobData, ReportGenerationResult>;
  private queueEvents: QueueEvents;
  private reportGenerator: ReportGeneratorService;

  constructor() {
    const connection = {
      url: getQueueRedisUrl(),
    };

    // Initialize queue
    this.queue = new Queue('report-generation', {
      connection,
      defaultJobOptions: {
        attempts: config.QUEUE_MAX_ATTEMPTS,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: {
          age: 24 * 3600, // Keep completed jobs for 24 hours
          count: 100, // Keep last 100 completed jobs
        },
        removeOnFail: {
          age: 7 * 24 * 3600, // Keep failed jobs for 7 days
        },
      },
    });

    // Initialize queue events
    this.queueEvents = new QueueEvents('report-generation', { connection });

    // Initialize report generator
    this.reportGenerator = new ReportGeneratorService();

    // Initialize worker
    this.worker = new Worker<ReportJobData, ReportGenerationResult>(
      'report-generation',
      async (job: Job<ReportJobData>) => {
        return this.processReportJob(job);
      },
      {
        connection,
        concurrency: config.QUEUE_CONCURRENCY,
      }
    );

    this.setupEventHandlers();
    logger.info('Report queue service initialized');
  }

  /**
   * Initialize the queue service
   */
  async initialize(): Promise<void> {
    await this.reportGenerator.initialize();
    logger.info('Report queue service ready');
  }

  /**
   * Add report generation job to queue
   */
  async addReportJob(
    jobData: ReportJobData,
    options?: ReportQueueOptions
  ): Promise<string> {
    const jobId = uuidv4();
    
    try {
      const job = await this.queue.add('generate-report', jobData, {
        jobId,
        priority: options?.priority || 0,
        delay: options?.delay || 0,
        attempts: options?.attempts || config.QUEUE_MAX_ATTEMPTS,
        backoff: options?.backoff || {
          type: 'exponential',
          delay: 2000,
        },
      });

      reportLogger.queueJobAdded(job.id!, jobData.request.type);
      return job.id!;

    } catch (error) {
      logger.error('Failed to add report job to queue:', error);
      throw error;
    }
  }

  /**
   * Process report generation job
   */
  private async processReportJob(
    job: Job<ReportJobData>
  ): Promise<ReportGenerationResult> {
    const startTime = Date.now();
    const { data } = job;

    try {
      // Update job progress
      await job.updateProgress(10);

      // Generate the report
      const result = await this.reportGenerator.generateReport(
        data.request,
        data.threatModelData,
        data.projectData,
        data.userData,
        data.organizationData
      );

      // Update job progress
      await job.updateProgress(100);

      const duration = Date.now() - startTime;
      reportLogger.queueJobCompleted(job.id!, duration);

      return result;

    } catch (error: any) {
      const duration = Date.now() - startTime;
      reportLogger.queueJobFailed(job.id!, error, job.attemptsMade);
      
      throw error;
    }
  }

  /**
   * Get job by ID
   */
  async getJob(jobId: string): Promise<ReportJob | null> {
    const job = await this.queue.getJob(jobId);
    if (!job) return null;

    return this.mapJobToReportJob(job);
  }

  /**
   * Get jobs by status
   */
  async getJobsByStatus(
    status: ReportStatus,
    limit: number = 100
  ): Promise<ReportJob[]> {
    let jobs: Job<ReportJobData>[] = [];

    switch (status) {
      case ReportStatus.PENDING:
        jobs = await this.queue.getWaiting(0, limit - 1);
        break;
      case ReportStatus.PROCESSING:
        jobs = await this.queue.getActive(0, limit - 1);
        break;
      case ReportStatus.COMPLETED:
        jobs = await this.queue.getCompleted(0, limit - 1);
        break;
      case ReportStatus.FAILED:
        jobs = await this.queue.getFailed(0, limit - 1);
        break;
    }

    return jobs.map(job => this.mapJobToReportJob(job));
  }

  /**
   * Cancel a job
   */
  async cancelJob(jobId: string): Promise<boolean> {
    try {
      const job = await this.queue.getJob(jobId);
      if (!job) return false;

      await job.remove();
      logger.info(`Job ${jobId} cancelled`);
      return true;

    } catch (error) {
      logger.error(`Failed to cancel job ${jobId}:`, error);
      return false;
    }
  }

  /**
   * Retry a failed job
   */
  async retryJob(jobId: string): Promise<boolean> {
    try {
      const job = await this.queue.getJob(jobId);
      if (!job) return false;

      await job.retry();
      logger.info(`Job ${jobId} retried`);
      return true;

    } catch (error) {
      logger.error(`Failed to retry job ${jobId}:`, error);
      return false;
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    paused: boolean;
  }> {
    const [waiting, active, completed, failed, delayed, isPaused] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount(),
      this.queue.getDelayedCount(),
      this.queue.isPaused(),
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
      paused: isPaused,
    };
  }

  /**
   * Pause the queue
   */
  async pauseQueue(): Promise<void> {
    await this.queue.pause();
    logger.info('Report queue paused');
  }

  /**
   * Resume the queue
   */
  async resumeQueue(): Promise<void> {
    await this.queue.resume();
    logger.info('Report queue resumed');
  }

  /**
   * Clean old jobs
   */
  async cleanOldJobs(
    grace: number = 7 * 24 * 3600 * 1000, // 7 days
    limit: number = 1000
  ): Promise<string[]> {
    const jobs = await this.queue.clean(grace, limit);
    logger.info(`Cleaned ${jobs.length} old jobs from queue`);
    return jobs;
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    // Worker events
    this.worker.on('completed', (job: Job<ReportJobData>, result: ReportGenerationResult) => {
      logger.info(`Job ${job.id} completed successfully`);
    });

    this.worker.on('failed', (job: Job<ReportJobData> | undefined, error: Error) => {
      if (job) {
        logger.error(`Job ${job.id} failed:`, error);
      }
    });

    this.worker.on('active', (job: Job<ReportJobData>) => {
      logger.info(`Job ${job.id} started processing`);
    });

    this.worker.on('stalled', (jobId: string) => {
      logger.warn(`Job ${jobId} stalled`);
    });

    // Queue events
    this.queueEvents.on('waiting', ({ jobId }) => {
      logger.debug(`Job ${jobId} is waiting`);
    });

    this.queueEvents.on('progress', ({ jobId, data }) => {
      logger.debug(`Job ${jobId} progress: ${data}%`);
    });

    this.queueEvents.on('removed', ({ jobId }) => {
      logger.info(`Job ${jobId} removed from queue`);
    });

    // Error handling
    this.worker.on('error', (error: Error) => {
      logger.error('Worker error:', error);
    });

    this.queue.on('error', (error: Error) => {
      logger.error('Queue error:', error);
    });
  }

  /**
   * Map BullMQ job to ReportJob
   */
  private mapJobToReportJob(job: Job<ReportJobData>): ReportJob {
    const status = this.getJobStatus(job);
    
    return {
      id: job.id!,
      reportId: job.data.request.id || job.id!,
      type: job.data.request.type,
      format: job.data.request.format,
      status,
      priority: job.opts.priority || 0,
      attempts: job.attemptsMade,
      maxAttempts: job.opts.attempts || config.QUEUE_MAX_ATTEMPTS,
      data: job.data,
      result: job.returnvalue,
      error: job.failedReason,
      createdAt: new Date(job.timestamp),
      startedAt: job.processedOn ? new Date(job.processedOn) : undefined,
      completedAt: job.finishedOn ? new Date(job.finishedOn) : undefined,
    };
  }

  /**
   * Get job status from BullMQ job state
   */
  private getJobStatus(job: Job): ReportStatus {
    if (job.finishedOn && !job.failedReason) {
      return ReportStatus.COMPLETED;
    }
    if (job.failedReason) {
      return ReportStatus.FAILED;
    }
    if (job.processedOn) {
      return ReportStatus.PROCESSING;
    }
    return ReportStatus.PENDING;
  }

  /**
   * Shutdown the queue service
   */
  async shutdown(): Promise<void> {
    await this.worker.close();
    await this.queueEvents.close();
    await this.queue.close();
    await this.reportGenerator.shutdown();
    logger.info('Report queue service shut down');
  }
}