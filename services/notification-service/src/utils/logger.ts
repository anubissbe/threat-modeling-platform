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
    service: 'notification-service',
    env: config.NODE_ENV,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  serializers: {
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
    err: pino.stdSerializers.err,
  },
});

// Notification-specific logger functions
export const notificationLogger = {
  sent: (type: string, recipient: string, notificationId: string) => {
    logger.info({
      event: 'notification.sent',
      type,
      recipient,
      notificationId,
      timestamp: new Date().toISOString(),
    }, `Notification sent: ${type} to ${recipient}`);
  },

  delivered: (type: string, recipient: string, notificationId: string, provider?: string) => {
    logger.info({
      event: 'notification.delivered',
      type,
      recipient,
      notificationId,
      provider,
      timestamp: new Date().toISOString(),
    }, `Notification delivered: ${type} to ${recipient}`);
  },

  failed: (type: string, recipient: string, error: Error, notificationId?: string) => {
    logger.error({
      event: 'notification.failed',
      type,
      recipient,
      notificationId,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    }, `Notification failed: ${type} to ${recipient} - ${error.message}`);
  },

  bounced: (type: string, recipient: string, reason: string, notificationId?: string) => {
    logger.warn({
      event: 'notification.bounced',
      type,
      recipient,
      notificationId,
      reason,
      timestamp: new Date().toISOString(),
    }, `Notification bounced: ${type} to ${recipient} - ${reason}`);
  },

  queued: (type: string, recipient: string, jobId: string) => {
    logger.info({
      event: 'notification.queued',
      type,
      recipient,
      jobId,
      timestamp: new Date().toISOString(),
    }, `Notification queued: ${type} to ${recipient}`);
  },

  retrying: (type: string, recipient: string, attempt: number, notificationId?: string) => {
    logger.warn({
      event: 'notification.retry',
      type,
      recipient,
      notificationId,
      attempt,
      timestamp: new Date().toISOString(),
    }, `Retrying notification: ${type} to ${recipient} (attempt ${attempt})`);
  },

  templateRendered: (template: string, duration: number) => {
    logger.debug({
      event: 'notification.template.rendered',
      template,
      duration,
      timestamp: new Date().toISOString(),
    }, `Template rendered: ${template} in ${duration}ms`);
  },

  providerError: (provider: string, error: Error) => {
    logger.error({
      event: 'notification.provider.error',
      provider,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    }, `Provider error: ${provider} - ${error.message}`);
  },

  webhookSent: (url: string, status: number, duration: number) => {
    logger.info({
      event: 'notification.webhook.sent',
      url,
      status,
      duration,
      timestamp: new Date().toISOString(),
    }, `Webhook sent to ${url}: ${status} in ${duration}ms`);
  },

  webhookFailed: (url: string, error: Error, attempt?: number) => {
    logger.error({
      event: 'notification.webhook.failed',
      url,
      error: error.message,
      attempt,
      timestamp: new Date().toISOString(),
    }, `Webhook failed: ${url} - ${error.message}`);
  },

  batchStarted: (batchId: string, count: number) => {
    logger.info({
      event: 'notification.batch.started',
      batchId,
      count,
      timestamp: new Date().toISOString(),
    }, `Batch notification started: ${count} notifications`);
  },

  batchCompleted: (batchId: string, succeeded: number, failed: number, duration: number) => {
    logger.info({
      event: 'notification.batch.completed',
      batchId,
      succeeded,
      failed,
      total: succeeded + failed,
      duration,
      timestamp: new Date().toISOString(),
    }, `Batch completed: ${succeeded} succeeded, ${failed} failed in ${duration}ms`);
  },

  preferenceUpdated: (userId: string, channel: string, enabled: boolean) => {
    logger.info({
      event: 'notification.preference.updated',
      userId,
      channel,
      enabled,
      timestamp: new Date().toISOString(),
    }, `Preference updated: ${channel} ${enabled ? 'enabled' : 'disabled'} for user ${userId}`);
  },

  unsubscribed: (userId: string, channel: string, event?: string) => {
    logger.info({
      event: 'notification.unsubscribed',
      userId,
      channel,
      notificationEvent: event,
      timestamp: new Date().toISOString(),
    }, `User unsubscribed: ${userId} from ${channel}${event ? ` for ${event}` : ''}`);
  },

  performanceMetric: (operation: string, duration: number, metadata?: any) => {
    logger.debug({
      event: 'notification.performance',
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