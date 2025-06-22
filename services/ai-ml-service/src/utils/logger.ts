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

// ML-specific logging utilities
export const mlLogger = {
  modelLoaded: (modelType: string, version: string, loadTime: number) => {
    logger.info({
      event: 'MODEL_LOADED',
      modelType,
      version,
      loadTime,
      timestamp: new Date().toISOString(),
    });
  },

  predictionMade: (modelType: string, confidence: number, processingTime: number) => {
    logger.info({
      event: 'PREDICTION_MADE',
      modelType,
      confidence,
      processingTime,
      timestamp: new Date().toISOString(),
    });
  },

  predictionError: (modelType: string, error: string, input?: any) => {
    logger.error({
      event: 'PREDICTION_ERROR',
      modelType,
      error,
      input: config.NODE_ENV === 'development' ? input : undefined,
      timestamp: new Date().toISOString(),
    });
  },

  trainingStarted: (modelType: string, datasetSize: number, config: any) => {
    logger.info({
      event: 'TRAINING_STARTED',
      modelType,
      datasetSize,
      config,
      timestamp: new Date().toISOString(),
    });
  },

  trainingCompleted: (modelType: string, accuracy: number, loss: number, duration: number) => {
    logger.info({
      event: 'TRAINING_COMPLETED',
      modelType,
      accuracy,
      loss,
      duration,
      timestamp: new Date().toISOString(),
    });
  },

  trainingFailed: (modelType: string, error: string, epoch?: number) => {
    logger.error({
      event: 'TRAINING_FAILED',
      modelType,
      error,
      epoch,
      timestamp: new Date().toISOString(),
    });
  },

  modelSaved: (modelType: string, path: string, size: number) => {
    logger.info({
      event: 'MODEL_SAVED',
      modelType,
      path,
      size,
      timestamp: new Date().toISOString(),
    });
  },

  threatIntelligenceUpdate: (source: string, threatsCount: number, updateTime: number) => {
    logger.info({
      event: 'THREAT_INTELLIGENCE_UPDATE',
      source,
      threatsCount,
      updateTime,
      timestamp: new Date().toISOString(),
    });
  },

  patternDetected: (patternName: string, confidence: number, indicators: number) => {
    logger.info({
      event: 'PATTERN_DETECTED',
      patternName,
      confidence,
      indicators,
      timestamp: new Date().toISOString(),
    });
  },

  vulnerabilityPredicted: (componentId: string, vulnerabilityType: string, probability: number) => {
    logger.warn({
      event: 'VULNERABILITY_PREDICTED',
      componentId,
      vulnerabilityType,
      probability,
      timestamp: new Date().toISOString(),
    });
  },

  mitigationRecommended: (threatId: string, mitigationCount: number, priority: string) => {
    logger.info({
      event: 'MITIGATION_RECOMMENDED',
      threatId,
      mitigationCount,
      priority,
      timestamp: new Date().toISOString(),
    });
  },

  cacheHit: (modelType: string, key: string) => {
    logger.debug({
      event: 'CACHE_HIT',
      modelType,
      key,
      timestamp: new Date().toISOString(),
    });
  },

  cacheMiss: (modelType: string, key: string) => {
    logger.debug({
      event: 'CACHE_MISS',
      modelType,
      key,
      timestamp: new Date().toISOString(),
    });
  },

  performanceMetric: (operation: string, duration: number, metadata?: any) => {
    logger.info({
      event: 'PERFORMANCE_METRIC',
      operation,
      duration,
      metadata,
      timestamp: new Date().toISOString(),
    });
  },

  dataQualityIssue: (issue: string, severity: string, affectedData: any) => {
    logger.warn({
      event: 'DATA_QUALITY_ISSUE',
      issue,
      severity,
      affectedData: config.NODE_ENV === 'development' ? affectedData : undefined,
      timestamp: new Date().toISOString(),
    });
  },

  modelDrift: (modelType: string, driftScore: number, threshold: number) => {
    logger.warn({
      event: 'MODEL_DRIFT_DETECTED',
      modelType,
      driftScore,
      threshold,
      timestamp: new Date().toISOString(),
    });
  },

  systemStartup: (modelsLoaded: number, cacheSize: number) => {
    logger.info({
      event: 'SYSTEM_STARTUP',
      modelsLoaded,
      cacheSize,
      timestamp: new Date().toISOString(),
    });
  },

  systemShutdown: (reason: string, uptime: number) => {
    logger.info({
      event: 'SYSTEM_SHUTDOWN',
      reason,
      uptime,
      timestamp: new Date().toISOString(),
    });
  },
};

export default logger;