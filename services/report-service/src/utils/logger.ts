import pino from 'pino';
import { config } from '../config';

// Create base logger
export const logger = pino({
  level: config.LOG_LEVEL,
  transport: config.LOG_PRETTY && config.NODE_ENV !== 'production'
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
  base: {
    service: 'report-service',
    env: config.NODE_ENV,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  serializers: {
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
    err: pino.stdSerializers.err,
  },
});

// Report-specific logger functions
export const reportLogger = {
  generationStarted: (reportId: string, type: string, format: string) => {
    logger.info({
      event: 'report.generation.started',
      reportId,
      type,
      format,
      timestamp: new Date().toISOString(),
    }, `Report generation started: ${type} (${format})`);
  },

  generationCompleted: (reportId: string, duration: number, pages?: number, size?: number) => {
    logger.info({
      event: 'report.generation.completed',
      reportId,
      duration,
      pages,
      size,
      timestamp: new Date().toISOString(),
    }, `Report generation completed in ${duration}ms`);
  },

  generationFailed: (reportId: string, error: Error, duration?: number) => {
    logger.error({
      event: 'report.generation.failed',
      reportId,
      error: error.message,
      stack: error.stack,
      duration,
      timestamp: new Date().toISOString(),
    }, `Report generation failed: ${error.message}`);
  },

  templateRendered: (templateId: string, duration: number) => {
    logger.debug({
      event: 'report.template.rendered',
      templateId,
      duration,
      timestamp: new Date().toISOString(),
    }, `Template rendered in ${duration}ms`);
  },

  chartGenerated: (chartType: string, duration: number) => {
    logger.debug({
      event: 'report.chart.generated',
      chartType,
      duration,
      timestamp: new Date().toISOString(),
    }, `Chart generated: ${chartType}`);
  },

  storageSaved: (reportId: string, storageType: string, size: number) => {
    logger.info({
      event: 'report.storage.saved',
      reportId,
      storageType,
      size,
      timestamp: new Date().toISOString(),
    }, `Report saved to ${storageType} storage`);
  },

  storageError: (reportId: string, error: Error) => {
    logger.error({
      event: 'report.storage.error',
      reportId,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    }, `Storage error: ${error.message}`);
  },

  queueJobAdded: (jobId: string, reportType: string) => {
    logger.info({
      event: 'report.queue.added',
      jobId,
      reportType,
      timestamp: new Date().toISOString(),
    }, `Report job added to queue`);
  },

  queueJobCompleted: (jobId: string, duration: number) => {
    logger.info({
      event: 'report.queue.completed',
      jobId,
      duration,
      timestamp: new Date().toISOString(),
    }, `Queue job completed in ${duration}ms`);
  },

  queueJobFailed: (jobId: string, error: Error, attempts: number) => {
    logger.error({
      event: 'report.queue.failed',
      jobId,
      error: error.message,
      attempts,
      timestamp: new Date().toISOString(),
    }, `Queue job failed after ${attempts} attempts`);
  },

  scheduleTriggered: (scheduleId: string, reportType: string) => {
    logger.info({
      event: 'report.schedule.triggered',
      scheduleId,
      reportType,
      timestamp: new Date().toISOString(),
    }, `Scheduled report triggered`);
  },

  notificationSent: (type: string, recipient: string, reportId: string) => {
    logger.info({
      event: 'report.notification.sent',
      type,
      recipient,
      reportId,
      timestamp: new Date().toISOString(),
    }, `Notification sent to ${recipient}`);
  },

  performanceMetric: (operation: string, duration: number, metadata?: any) => {
    logger.debug({
      event: 'report.performance',
      operation,
      duration,
      metadata,
      timestamp: new Date().toISOString(),
    }, `Performance: ${operation} took ${duration}ms`);
  },
};

// Export child logger factory
export const createChildLogger = (context: Record<string, any>) => {
  return logger.child(context);
};