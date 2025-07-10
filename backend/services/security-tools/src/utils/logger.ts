import winston from 'winston';
import path from 'path';

const logDir = process.env.LOG_DIR || path.join(__dirname, '../../logs');

// Custom format for security events
const securityFormat = winston.format.printf(({ level, message, timestamp, ...metadata }) => {
  let msg = `${timestamp} [${level}] ${message}`;
  
  if (metadata.securityEvent) {
    msg += ` | SECURITY_EVENT: ${JSON.stringify(metadata.securityEvent)}`;
  }
  
  if (metadata.integration) {
    msg += ` | INTEGRATION: ${metadata.integration.id} (${metadata.integration.type}/${metadata.integration.platform})`;
  }
  
  if (metadata.threat) {
    msg += ` | THREAT: ${metadata.threat.id} (${metadata.threat.severity})`;
  }
  
  if (metadata.error) {
    msg += ` | ERROR: ${metadata.error}`;
    if (metadata.stack) {
      msg += `\n${metadata.stack}`;
    }
  }
  
  return msg;
});

// Create logger instance
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss.SSS'
    }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'security-tools' },
  transports: [
    // Console transport for development
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple(),
        securityFormat
      )
    }),
    
    // File transport for all logs
    new winston.transports.File({
      filename: path.join(logDir, 'security-tools.log'),
      format: winston.format.combine(
        winston.format.uncolorize(),
        securityFormat
      ),
      maxsize: 10485760, // 10MB
      maxFiles: 10
    }),
    
    // Separate file for errors
    new winston.transports.File({
      filename: path.join(logDir, 'security-tools-error.log'),
      level: 'error',
      format: winston.format.combine(
        winston.format.uncolorize(),
        securityFormat
      ),
      maxsize: 10485760, // 10MB
      maxFiles: 10
    }),
    
    // Separate file for security events
    new winston.transports.File({
      filename: path.join(logDir, 'security-events.log'),
      format: winston.format.combine(
        winston.format.uncolorize(),
        winston.format.json()
      ),
      maxsize: 10485760, // 10MB
      maxFiles: 20
    })
  ],
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logDir, 'exceptions.log'),
      maxsize: 10485760,
      maxFiles: 5
    })
  ],
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logDir, 'rejections.log'),
      maxsize: 10485760,
      maxFiles: 5
    })
  ]
});

// Security-specific logging methods
export const logSecurityEvent = (
  eventType: string,
  data: any,
  metadata?: any
): void => {
  logger.info('Security event', {
    securityEvent: {
      type: eventType,
      timestamp: new Date().toISOString(),
      data
    },
    ...metadata
  });
};

export const logIntegrationActivity = (
  integrationId: string,
  activity: string,
  details?: any
): void => {
  logger.info(`Integration activity: ${activity}`, {
    integration: {
      id: integrationId,
      activity,
      timestamp: new Date().toISOString()
    },
    details
  });
};

export const logThreatDetection = (
  threat: any,
  source: string,
  metadata?: any
): void => {
  logger.warn('Threat detected', {
    threat: {
      id: threat.id,
      severity: threat.severity,
      title: threat.title,
      source,
      timestamp: new Date().toISOString()
    },
    ...metadata
  });
};

export const logCorrelationResult = (
  engineId: string,
  ruleId: string,
  eventCount: number,
  result: 'success' | 'failure',
  details?: any
): void => {
  const logLevel = result === 'success' ? 'info' : 'error';
  
  logger.log(logLevel, `Correlation ${result}`, {
    correlation: {
      engineId,
      ruleId,
      eventCount,
      result,
      timestamp: new Date().toISOString()
    },
    details
  });
};

export const logApiRequest = (
  method: string,
  path: string,
  userId?: string,
  metadata?: any
): void => {
  logger.info('API request', {
    api: {
      method,
      path,
      userId,
      timestamp: new Date().toISOString()
    },
    ...metadata
  });
};

export const logApiResponse = (
  method: string,
  path: string,
  statusCode: number,
  duration: number,
  metadata?: any
): void => {
  const logLevel = statusCode >= 400 ? 'error' : 'info';
  
  logger.log(logLevel, 'API response', {
    api: {
      method,
      path,
      statusCode,
      duration,
      timestamp: new Date().toISOString()
    },
    ...metadata
  });
};

// Audit logging for compliance
export const auditLog = (
  action: string,
  userId: string,
  resourceType: string,
  resourceId: string,
  changes?: any,
  metadata?: any
): void => {
  logger.info('Audit log', {
    audit: {
      action,
      userId,
      resourceType,
      resourceId,
      timestamp: new Date().toISOString(),
      changes
    },
    ...metadata
  });
};

// Performance logging
export const logPerformance = (
  operation: string,
  duration: number,
  metadata?: any
): void => {
  const logLevel = duration > 5000 ? 'warn' : 'info';
  
  logger.log(logLevel, `Performance: ${operation}`, {
    performance: {
      operation,
      duration,
      timestamp: new Date().toISOString()
    },
    ...metadata
  });
};

// Create child logger for specific components
export const createComponentLogger = (component: string): winston.Logger => {
  return logger.child({ component });
};

// Export logger methods for convenience
export const { error, warn, info, debug } = logger;