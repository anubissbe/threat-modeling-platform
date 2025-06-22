import pino from 'pino';
import { config } from '../config';

// Create logger instance
export const logger = pino({
  level: config.LOG_LEVEL,
  formatters: {
    level: (label) => {
      return { level: label.toUpperCase() };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  ...(config.NODE_ENV === 'development' && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        ignore: 'pid,hostname',
        translateTime: 'yyyy-mm-dd HH:MM:ss',
      },
    },
  }),
});

// Project-specific audit logging utilities
export const auditLogger = {
  projectCreated: (userId: string, projectId: string, name: string) => {
    logger.info({
      event: 'PROJECT_CREATED',
      userId,
      projectId,
      name,
      timestamp: new Date().toISOString(),
    });
  },

  projectUpdated: (userId: string, projectId: string, changes: any) => {
    logger.info({
      event: 'PROJECT_UPDATED',
      userId,
      projectId,
      changes,
      timestamp: new Date().toISOString(),
    });
  },

  projectDeleted: (userId: string, projectId: string) => {
    logger.info({
      event: 'PROJECT_DELETED',
      userId,
      projectId,
      timestamp: new Date().toISOString(),
    });
  },

  threatModelCreated: (userId: string, threatModelId: string, projectId: string, name: string) => {
    logger.info({
      event: 'THREAT_MODEL_CREATED',
      userId,
      threatModelId,
      projectId,
      name,
      timestamp: new Date().toISOString(),
    });
  },

  threatModelUpdated: (userId: string, threatModelId: string, changes: any) => {
    logger.info({
      event: 'THREAT_MODEL_UPDATED',
      userId,
      threatModelId,
      changes,
      timestamp: new Date().toISOString(),
    });
  },

  threatModelApproved: (userId: string, threatModelId: string, reviewerId: string) => {
    logger.info({
      event: 'THREAT_MODEL_APPROVED',
      userId,
      threatModelId,
      reviewerId,
      timestamp: new Date().toISOString(),
    });
  },

  threatModelRejected: (userId: string, threatModelId: string, reviewerId: string, reason: string) => {
    logger.info({
      event: 'THREAT_MODEL_REJECTED',
      userId,
      threatModelId,
      reviewerId,
      reason,
      timestamp: new Date().toISOString(),
    });
  },

  threatAdded: (userId: string, threatModelId: string, threatId: string, severity: string) => {
    logger.info({
      event: 'THREAT_ADDED',
      userId,
      threatModelId,
      threatId,
      severity,
      timestamp: new Date().toISOString(),
    });
  },

  threatMitigated: (userId: string, threatId: string, mitigationId: string) => {
    logger.info({
      event: 'THREAT_MITIGATED',
      userId,
      threatId,
      mitigationId,
      timestamp: new Date().toISOString(),
    });
  },

  mitigationImplemented: (userId: string, mitigationId: string, threatModelId: string) => {
    logger.info({
      event: 'MITIGATION_IMPLEMENTED',
      userId,
      mitigationId,
      threatModelId,
      timestamp: new Date().toISOString(),
    });
  },

  collaboratorAdded: (userId: string, projectId: string, collaboratorId: string, role: string) => {
    logger.info({
      event: 'COLLABORATOR_ADDED',
      userId,
      projectId,
      collaboratorId,
      role,
      timestamp: new Date().toISOString(),
    });
  },

  collaboratorRemoved: (userId: string, projectId: string, collaboratorId: string) => {
    logger.info({
      event: 'COLLABORATOR_REMOVED',
      userId,
      projectId,
      collaboratorId,
      timestamp: new Date().toISOString(),
    });
  },

  versionCreated: (userId: string, threatModelId: string, versionId: string, version: string) => {
    logger.info({
      event: 'VERSION_CREATED',
      userId,
      threatModelId,
      versionId,
      version,
      timestamp: new Date().toISOString(),
    });
  },

  commentAdded: (userId: string, projectId: string, commentId: string, type: string) => {
    logger.info({
      event: 'COMMENT_ADDED',
      userId,
      projectId,
      commentId,
      type,
      timestamp: new Date().toISOString(),
    });
  },

  exportGenerated: (userId: string, projectId: string, format: string, includeMetadata: boolean) => {
    logger.info({
      event: 'EXPORT_GENERATED',
      userId,
      projectId,
      format,
      includeMetadata,
      timestamp: new Date().toISOString(),
    });
  },

  suspiciousActivity: (userId: string, activity: string, details?: any) => {
    logger.warn({
      event: 'SUSPICIOUS_ACTIVITY',
      userId,
      activity,
      details,
      timestamp: new Date().toISOString(),
    });
  },

  securityEvent: (userId: string, event: string, severity: string, details?: any) => {
    logger.warn({
      event: 'SECURITY_EVENT',
      userId,
      securityEvent: event,
      severity,
      details,
      timestamp: new Date().toISOString(),
    });
  },
};

export default logger;