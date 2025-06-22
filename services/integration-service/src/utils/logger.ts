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

// Integration service specific logging utilities
export const serviceLogger = {
  serviceUp: (serviceName: string, url: string, responseTime: number) => {
    logger.info({
      event: 'SERVICE_UP',
      serviceName,
      url,
      responseTime,
      timestamp: new Date().toISOString(),
    });
  },

  serviceDown: (serviceName: string, url: string, error: string) => {
    logger.error({
      event: 'SERVICE_DOWN',
      serviceName,
      url,
      error,
      timestamp: new Date().toISOString(),
    });
  },

  requestProxied: (serviceName: string, method: string, path: string, statusCode: number, responseTime: number, userId?: string) => {
    logger.info({
      event: 'REQUEST_PROXIED',
      serviceName,
      method,
      path,
      statusCode,
      responseTime,
      userId,
      timestamp: new Date().toISOString(),
    });
  },

  requestFailed: (serviceName: string, method: string, path: string, error: string, userId?: string) => {
    logger.error({
      event: 'REQUEST_FAILED',
      serviceName,
      method,
      path,
      error,
      userId,
      timestamp: new Date().toISOString(),
    });
  },

  serviceRequestCompleted: (serviceName: string, method: string, path: string, statusCode: number, responseTime: number, userId?: string) => {
    logger.info({
      event: 'SERVICE_REQUEST_COMPLETED',
      serviceName,
      method,
      path,
      statusCode,
      responseTime,
      userId,
      timestamp: new Date().toISOString(),
    });
  },

  serviceRequestFailed: (serviceName: string, method: string, path: string, error: string, userId?: string) => {
    logger.error({
      event: 'SERVICE_REQUEST_FAILED',
      serviceName,
      method,
      path,
      error,
      userId,
      timestamp: new Date().toISOString(),
    });
  },

  circuitBreakerOpen: (serviceName: string, failureCount: number) => {
    logger.warn({
      event: 'CIRCUIT_BREAKER_OPEN',
      serviceName,
      failureCount,
      timestamp: new Date().toISOString(),
    });
  },

  circuitBreakerClosed: (serviceName: string) => {
    logger.info({
      event: 'CIRCUIT_BREAKER_CLOSED',
      serviceName,
      timestamp: new Date().toISOString(),
    });
  },

  rateLimitExceeded: (userId: string, path: string, limit: number) => {
    logger.warn({
      event: 'RATE_LIMIT_EXCEEDED',
      userId,
      path,
      limit,
      timestamp: new Date().toISOString(),
    });
  },

  authenticationFailed: (path: string, reason: string, ip?: string) => {
    logger.warn({
      event: 'AUTHENTICATION_FAILED',
      path,
      reason,
      ip,
      timestamp: new Date().toISOString(),
    });
  },

  authorizationFailed: (userId: string, path: string, requiredRole?: string) => {
    logger.warn({
      event: 'AUTHORIZATION_FAILED',
      userId,
      path,
      requiredRole,
      timestamp: new Date().toISOString(),
    });
  },

  healthCheckPerformed: (serviceName: string, status: string, responseTime: number) => {
    logger.debug({
      event: 'HEALTH_CHECK_PERFORMED',
      serviceName,
      status,
      responseTime,
      timestamp: new Date().toISOString(),
    });
  },

  loadBalancerAction: (serviceName: string, strategy: string, selectedInstance?: string) => {
    logger.debug({
      event: 'LOAD_BALANCER_ACTION',
      serviceName,
      strategy,
      selectedInstance,
      timestamp: new Date().toISOString(),
    });
  },

  cacheHit: (key: string, service: string) => {
    logger.debug({
      event: 'CACHE_HIT',
      key,
      service,
      timestamp: new Date().toISOString(),
    });
  },

  cacheMiss: (key: string, service: string) => {
    logger.debug({
      event: 'CACHE_MISS',
      key,
      service,
      timestamp: new Date().toISOString(),
    });
  },

  metricsCollected: (totalRequests: number, errorRate: number, avgResponseTime: number) => {
    logger.info({
      event: 'METRICS_COLLECTED',
      totalRequests,
      errorRate,
      avgResponseTime,
      timestamp: new Date().toISOString(),
    });
  },

  configurationLoaded: (servicesCount: number, routesCount: number) => {
    logger.info({
      event: 'CONFIGURATION_LOADED',
      servicesCount,
      routesCount,
      timestamp: new Date().toISOString(),
    });
  },

  serviceDiscoveryUpdate: (action: string, serviceName: string, details?: any) => {
    logger.info({
      event: 'SERVICE_DISCOVERY_UPDATE',
      action,
      serviceName,
      details,
      timestamp: new Date().toISOString(),
    });
  },

  securityEvent: (event: string, severity: string, details?: any) => {
    logger.warn({
      event: 'SECURITY_EVENT',
      securityEvent: event,
      severity,
      details,
      timestamp: new Date().toISOString(),
    });
  },

  performanceAlert: (metric: string, value: number, threshold: number, serviceName?: string) => {
    logger.warn({
      event: 'PERFORMANCE_ALERT',
      metric,
      value,
      threshold,
      serviceName,
      timestamp: new Date().toISOString(),
    });
  },

  systemStartup: (port: number, environment: string, servicesRegistered: number) => {
    logger.info({
      event: 'SYSTEM_STARTUP',
      port,
      environment,
      servicesRegistered,
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