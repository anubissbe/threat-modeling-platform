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
    service: 'file-service',
    env: config.NODE_ENV,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  serializers: {
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
    err: pino.stdSerializers.err,
  },
});

// File-specific logger functions
export const fileLogger = {
  uploaded: (fileId: string, filename: string, size: number, userId: string) => {
    logger.info({
      event: 'file.uploaded',
      fileId,
      filename,
      size,
      userId,
      timestamp: new Date().toISOString(),
    }, `File uploaded: ${filename} (${size} bytes) by user ${userId}`);
  },

  downloaded: (fileId: string, filename: string, userId: string, ip?: string) => {
    logger.info({
      event: 'file.downloaded',
      fileId,
      filename,
      userId,
      ip,
      timestamp: new Date().toISOString(),
    }, `File downloaded: ${filename} by user ${userId}`);
  },

  deleted: (fileId: string, filename: string, userId: string) => {
    logger.info({
      event: 'file.deleted',
      fileId,
      filename,
      userId,
      timestamp: new Date().toISOString(),
    }, `File deleted: ${filename} by user ${userId}`);
  },

  shared: (fileId: string, filename: string, shareToken: string, userId: string) => {
    logger.info({
      event: 'file.shared',
      fileId,
      filename,
      shareToken,
      userId,
      timestamp: new Date().toISOString(),
    }, `File shared: ${filename} by user ${userId}`);
  },

  processed: (fileId: string, operation: string, duration: number, success: boolean) => {
    logger.info({
      event: 'file.processed',
      fileId,
      operation,
      duration,
      success,
      timestamp: new Date().toISOString(),
    }, `File processed: ${operation} ${success ? 'succeeded' : 'failed'} in ${duration}ms`);
  },

  scanResult: (fileId: string, filename: string, clean: boolean, threats?: string[]) => {
    const level = clean ? 'info' : 'warn';
    logger[level]({
      event: 'file.scanned',
      fileId,
      filename,
      clean,
      threats,
      timestamp: new Date().toISOString(),
    }, `File scan: ${filename} is ${clean ? 'clean' : 'infected'}`);
  },

  accessGranted: (fileId: string, userId: string, permission: string, grantedBy: string) => {
    logger.info({
      event: 'file.access.granted',
      fileId,
      userId,
      permission,
      grantedBy,
      timestamp: new Date().toISOString(),
    }, `File access granted: ${permission} to user ${userId} by ${grantedBy}`);
  },

  accessRevoked: (fileId: string, userId: string, permission: string, revokedBy: string) => {
    logger.info({
      event: 'file.access.revoked',
      fileId,
      userId,
      permission,
      revokedBy,
      timestamp: new Date().toISOString(),
    }, `File access revoked: ${permission} from user ${userId} by ${revokedBy}`);
  },

  quotaExceeded: (userId: string, quota: number, used: number, attemptedSize: number) => {
    logger.warn({
      event: 'quota.exceeded',
      userId,
      quota,
      used,
      attemptedSize,
      timestamp: new Date().toISOString(),
    }, `Quota exceeded: User ${userId} attempted to upload ${attemptedSize} bytes but has ${quota - used} bytes remaining`);
  },

  storageError: (operation: string, key: string, error: Error) => {
    logger.error({
      event: 'storage.error',
      operation,
      key,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    }, `Storage error: ${operation} failed for key ${key}`);
  },

  validationFailed: (filename: string, rule: string, reason: string, userId: string) => {
    logger.warn({
      event: 'file.validation.failed',
      filename,
      rule,
      reason,
      userId,
      timestamp: new Date().toISOString(),
    }, `File validation failed: ${filename} failed ${rule} - ${reason}`);
  },

  performanceMetric: (operation: string, duration: number, metadata?: any) => {
    logger.debug({
      event: 'file.performance',
      operation,
      duration,
      metadata,
      timestamp: new Date().toISOString(),
    }, `Performance: ${operation} took ${duration}ms`);
  },

  thumbnailGenerated: (fileId: string, size: string, duration: number) => {
    logger.debug({
      event: 'thumbnail.generated',
      fileId,
      size,
      duration,
      timestamp: new Date().toISOString(),
    }, `Thumbnail generated: ${size} for file ${fileId} in ${duration}ms`);
  },

  cleanupStarted: (type: 'temp' | 'deleted', count: number) => {
    logger.info({
      event: 'cleanup.started',
      type,
      count,
      timestamp: new Date().toISOString(),
    }, `Cleanup started: ${type} files (${count} candidates)`);
  },

  cleanupCompleted: (type: 'temp' | 'deleted', processed: number, deleted: number, errors: number) => {
    logger.info({
      event: 'cleanup.completed',
      type,
      processed,
      deleted,
      errors,
      timestamp: new Date().toISOString(),
    }, `Cleanup completed: ${type} files - ${deleted}/${processed} deleted, ${errors} errors`);
  },

  versionCreated: (fileId: string, version: number, changes: string, userId: string) => {
    logger.info({
      event: 'version.created',
      fileId,
      version,
      changes,
      userId,
      timestamp: new Date().toISOString(),
    }, `Version created: ${version} for file ${fileId} - ${changes}`);
  },

  bulkOperation: (operation: string, fileCount: number, userId: string, duration: number) => {
    logger.info({
      event: 'bulk.operation',
      operation,
      fileCount,
      userId,
      duration,
      timestamp: new Date().toISOString(),
    }, `Bulk operation: ${operation} on ${fileCount} files by user ${userId} in ${duration}ms`);
  },
};

// Export child logger factory
export const createChildLogger = (context: Record<string, any>) => {
  return logger.child(context);
};