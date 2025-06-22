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

// Threat engine specific audit logging utilities
export const auditLogger = {
  analysisStarted: (userId: string, threatModelId: string, methodology: string) => {
    logger.info({
      event: 'ANALYSIS_STARTED',
      userId,
      threatModelId,
      methodology,
      timestamp: new Date().toISOString(),
    });
  },

  analysisCompleted: (userId: string, threatModelId: string, threatsFound: number, processingTime: number) => {
    logger.info({
      event: 'ANALYSIS_COMPLETED',
      userId,
      threatModelId,
      threatsFound,
      processingTime,
      timestamp: new Date().toISOString(),
    });
  },

  analysisFailed: (userId: string, threatModelId: string, error: string) => {
    logger.error({
      event: 'ANALYSIS_FAILED',
      userId,
      threatModelId,
      error,
      timestamp: new Date().toISOString(),
    });
  },

  threatIdentified: (userId: string, threatModelId: string, threatId: string, category: string, severity: string) => {
    logger.info({
      event: 'THREAT_IDENTIFIED',
      userId,
      threatModelId,
      threatId,
      category,
      severity,
      timestamp: new Date().toISOString(),
    });
  },

  mitigationRecommended: (userId: string, threatModelId: string, threatId: string, mitigationId: string) => {
    logger.info({
      event: 'MITIGATION_RECOMMENDED',
      userId,
      threatModelId,
      threatId,
      mitigationId,
      timestamp: new Date().toISOString(),
    });
  },

  riskCalculated: (userId: string, threatModelId: string, overallRisk: number, criticalThreats: number) => {
    logger.info({
      event: 'RISK_CALCULATED',
      userId,
      threatModelId,
      overallRisk,
      criticalThreats,
      timestamp: new Date().toISOString(),
    });
  },

  patternMatched: (userId: string, threatModelId: string, patternId: string, confidence: number) => {
    logger.info({
      event: 'PATTERN_MATCHED',
      userId,
      threatModelId,
      patternId,
      confidence,
      timestamp: new Date().toISOString(),
    });
  },

  mlPredictionMade: (userId: string, threatModelId: string, modelUsed: string, confidence: number) => {
    logger.info({
      event: 'ML_PREDICTION_MADE',
      userId,
      threatModelId,
      modelUsed,
      confidence,
      timestamp: new Date().toISOString(),
    });
  },

  knowledgeBaseUpdated: (userId: string, updateType: string, itemsUpdated: number) => {
    logger.info({
      event: 'KNOWLEDGE_BASE_UPDATED',
      userId,
      updateType,
      itemsUpdated,
      timestamp: new Date().toISOString(),
    });
  },

  engineConfigured: (userId: string, methodology: string, options: any) => {
    logger.info({
      event: 'ENGINE_CONFIGURED',
      userId,
      methodology,
      options,
      timestamp: new Date().toISOString(),
    });
  },

  performanceMetric: (operation: string, duration: number, itemsProcessed: number) => {
    logger.info({
      event: 'PERFORMANCE_METRIC',
      operation,
      duration,
      itemsProcessed,
      throughput: itemsProcessed / (duration / 1000), // items per second
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

  suspiciousActivity: (userId: string, activity: string, details?: any) => {
    logger.warn({
      event: 'SUSPICIOUS_ACTIVITY',
      userId,
      activity,
      details,
      timestamp: new Date().toISOString(),
    });
  },

  rateLimitExceeded: (userId: string, endpoint: string, limit: number) => {
    logger.warn({
      event: 'RATE_LIMIT_EXCEEDED',
      userId,
      endpoint,
      limit,
      timestamp: new Date().toISOString(),
    });
  },

  cacheHit: (key: string, operation: string) => {
    logger.debug({
      event: 'CACHE_HIT',
      key,
      operation,
      timestamp: new Date().toISOString(),
    });
  },

  cacheMiss: (key: string, operation: string) => {
    logger.debug({
      event: 'CACHE_MISS',
      key,
      operation,
      timestamp: new Date().toISOString(),
    });
  },

  databaseError: (operation: string, error: string, query?: string) => {
    logger.error({
      event: 'DATABASE_ERROR',
      operation,
      error,
      query: query?.substring(0, 200),
      timestamp: new Date().toISOString(),
    });
  },

  externalServiceCall: (service: string, endpoint: string, duration: number, status: number) => {
    logger.info({
      event: 'EXTERNAL_SERVICE_CALL',
      service,
      endpoint,
      duration,
      status,
      timestamp: new Date().toISOString(),
    });
  },

  jobQueued: (jobId: string, jobType: string, priority: string) => {
    logger.info({
      event: 'JOB_QUEUED',
      jobId,
      jobType,
      priority,
      timestamp: new Date().toISOString(),
    });
  },

  jobProcessed: (jobId: string, jobType: string, duration: number, status: string) => {
    logger.info({
      event: 'JOB_PROCESSED',
      jobId,
      jobType,
      duration,
      status,
      timestamp: new Date().toISOString(),
    });
  },

  dataExported: (userId: string, threatModelId: string, format: string, includeMetadata: boolean) => {
    logger.info({
      event: 'DATA_EXPORTED',
      userId,
      threatModelId,
      format,
      includeMetadata,
      timestamp: new Date().toISOString(),
    });
  },

  configurationChanged: (userId: string, configType: string, oldValue: any, newValue: any) => {
    logger.info({
      event: 'CONFIGURATION_CHANGED',
      userId,
      configType,
      oldValue,
      newValue,
      timestamp: new Date().toISOString(),
    });
  },

  userAction: (userId: string, action: string, resource: string, details?: any) => {
    logger.info({
      event: 'USER_ACTION',
      userId,
      action,
      resource,
      details,
      timestamp: new Date().toISOString(),
    });
  },

  systemHealthCheck: (component: string, status: string, metrics?: any) => {
    logger.info({
      event: 'SYSTEM_HEALTH_CHECK',
      component,
      status,
      metrics,
      timestamp: new Date().toISOString(),
    });
  },

  alertTriggered: (alertType: string, severity: string, message: string, details?: any) => {
    logger.warn({
      event: 'ALERT_TRIGGERED',
      alertType,
      severity,
      message,
      details,
      timestamp: new Date().toISOString(),
    });
  },
};

export default logger;