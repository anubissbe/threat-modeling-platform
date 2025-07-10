import winston from 'winston';

// Define log levels and colors
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};

const logColors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  debug: 'blue'
};

winston.addColors(logColors);

// Custom format for structured logging
const customFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, service = 'compliance-service', ...meta }) => {
    const logEntry = {
      timestamp,
      level,
      service,
      message,
      ...meta
    };
    return JSON.stringify(logEntry);
  })
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(({ timestamp, level, message, service = 'compliance-service', ...meta }) => {
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
    return `${timestamp} [${service}] ${level}: ${message} ${metaStr}`;
  })
);

// Create logger instance
const logger = winston.createLogger({
  levels: logLevels,
  level: process.env.LOG_LEVEL || 'info',
  format: customFormat,
  defaultMeta: { service: 'compliance-service' },
  transports: [
    // File transport for errors
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      tailable: true
    }),
    
    // File transport for all logs
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 10,
      tailable: true
    })
  ],
  
  // Handle exceptions and rejections
  exceptionHandlers: [
    new winston.transports.File({ filename: 'logs/exceptions.log' })
  ],
  rejectionHandlers: [
    new winston.transports.File({ filename: 'logs/rejections.log' })
  ]
});

// Add console transport in development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat,
    level: 'debug'
  }));
}

// Create logs directory if it doesn't exist
import * as fs from 'fs';
if (!fs.existsSync('logs')) {
  fs.mkdirSync('logs');
}

// Compliance-specific logging helpers
export const complianceLogger = {
  // Assessment logging
  assessmentCreated: (assessmentId: string, framework: string, userId: string) => {
    logger.info('Assessment created', {
      eventType: 'assessment_created',
      assessmentId,
      framework,
      userId,
      timestamp: new Date().toISOString()
    });
  },

  assessmentCompleted: (assessmentId: string, framework: string, score: number, duration: number) => {
    logger.info('Assessment completed', {
      eventType: 'assessment_completed',
      assessmentId,
      framework,
      score,
      duration,
      timestamp: new Date().toISOString()
    });
  },

  assessmentFailed: (assessmentId: string, framework: string, error: string) => {
    logger.error('Assessment failed', {
      eventType: 'assessment_failed',
      assessmentId,
      framework,
      error,
      timestamp: new Date().toISOString()
    });
  },

  // Control logging
  controlUpdated: (controlId: string, framework: string, previousStatus: string, newStatus: string, userId: string) => {
    logger.info('Control updated', {
      eventType: 'control_updated',
      controlId,
      framework,
      previousStatus,
      newStatus,
      userId,
      timestamp: new Date().toISOString()
    });
  },

  controlImplemented: (controlId: string, framework: string, implementedBy: string) => {
    logger.info('Control implemented', {
      eventType: 'control_implemented',
      controlId,
      framework,
      implementedBy,
      timestamp: new Date().toISOString()
    });
  },

  // Finding logging
  findingCreated: (findingId: string, controlId: string, severity: string, category: string) => {
    logger.warn('Finding created', {
      eventType: 'finding_created',
      findingId,
      controlId,
      severity,
      category,
      timestamp: new Date().toISOString()
    });
  },

  findingResolved: (findingId: string, controlId: string, resolvedBy: string, resolutionMethod: string) => {
    logger.info('Finding resolved', {
      eventType: 'finding_resolved',
      findingId,
      controlId,
      resolvedBy,
      resolutionMethod,
      timestamp: new Date().toISOString()
    });
  },

  // Remediation logging
  remediationPlanCreated: (planId: string, controlId: string, assignedTo: string, dueDate: string) => {
    logger.info('Remediation plan created', {
      eventType: 'remediation_plan_created',
      planId,
      controlId,
      assignedTo,
      dueDate,
      timestamp: new Date().toISOString()
    });
  },

  remediationCompleted: (planId: string, controlId: string, completedBy: string, actualDuration: number) => {
    logger.info('Remediation completed', {
      eventType: 'remediation_completed',
      planId,
      controlId,
      completedBy,
      actualDuration,
      timestamp: new Date().toISOString()
    });
  },

  remediationOverdue: (planId: string, controlId: string, assignedTo: string, daysPastDue: number) => {
    logger.warn('Remediation overdue', {
      eventType: 'remediation_overdue',
      planId,
      controlId,
      assignedTo,
      daysPastDue,
      timestamp: new Date().toISOString()
    });
  },

  // Report logging
  reportGenerated: (reportId: string, type: string, framework: string[], generatedBy: string, format: string) => {
    logger.info('Report generated', {
      eventType: 'report_generated',
      reportId,
      type,
      framework,
      generatedBy,
      format,
      timestamp: new Date().toISOString()
    });
  },

  reportDownloaded: (reportId: string, downloadedBy: string, ipAddress: string) => {
    logger.info('Report downloaded', {
      eventType: 'report_downloaded',
      reportId,
      downloadedBy,
      ipAddress,
      timestamp: new Date().toISOString()
    });
  },

  // Security logging
  unauthorizedAccess: (userId: string, resource: string, action: string, ipAddress: string) => {
    logger.warn('Unauthorized access attempt', {
      eventType: 'unauthorized_access',
      userId,
      resource,
      action,
      ipAddress,
      timestamp: new Date().toISOString()
    });
  },

  dataExport: (userId: string, dataType: string, recordCount: number, ipAddress: string) => {
    logger.info('Data export', {
      eventType: 'data_export',
      userId,
      dataType,
      recordCount,
      ipAddress,
      timestamp: new Date().toISOString()
    });
  },

  // Performance logging
  performanceMetric: (operation: string, duration: number, recordCount?: number) => {
    logger.debug('Performance metric', {
      eventType: 'performance_metric',
      operation,
      duration,
      recordCount,
      timestamp: new Date().toISOString()
    });
  },

  // Configuration logging
  configurationChanged: (userId: string, configType: string, previousValue: any, newValue: any) => {
    logger.info('Configuration changed', {
      eventType: 'configuration_changed',
      userId,
      configType,
      previousValue,
      newValue,
      timestamp: new Date().toISOString()
    });
  },

  // Integration logging
  integrationEvent: (integrationType: string, eventType: string, status: string, details?: any) => {
    logger.info('Integration event', {
      eventType: 'integration_event',
      integrationType,
      integrationEventType: eventType,
      status,
      details,
      timestamp: new Date().toISOString()
    });
  },

  // Error tracking
  businessLogicError: (operation: string, error: string, context: any) => {
    logger.error('Business logic error', {
      eventType: 'business_logic_error',
      operation,
      error,
      context,
      timestamp: new Date().toISOString()
    });
  },

  validationError: (operation: string, validationErrors: any[], inputData: any) => {
    logger.warn('Validation error', {
      eventType: 'validation_error',
      operation,
      validationErrors,
      inputData,
      timestamp: new Date().toISOString()
    });
  },

  // Compliance threshold breaches
  complianceThresholdBreached: (framework: string, currentScore: number, threshold: number, severity: string) => {
    logger.warn('Compliance threshold breached', {
      eventType: 'compliance_threshold_breached',
      framework,
      currentScore,
      threshold,
      severity,
      timestamp: new Date().toISOString()
    });
  },

  // Audit trail
  auditEvent: (userId: string, action: string, resource: string, resourceId: string, details: any) => {
    logger.info('Audit event', {
      eventType: 'audit_event',
      userId,
      action,
      resource,
      resourceId,
      details,
      timestamp: new Date().toISOString()
    });
  }
};

// Request logging middleware
export const requestLogger = winston.createLogger({
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/requests.log' })
  ]
});

// Performance monitoring
export class PerformanceMonitor {
  private startTime: number;
  private operation: string;

  constructor(operation: string) {
    this.operation = operation;
    this.startTime = Date.now();
  }

  end(additionalData?: any): void {
    const duration = Date.now() - this.startTime;
    complianceLogger.performanceMetric(this.operation, duration, additionalData?.recordCount);
    
    if (duration > 5000) { // Log slow operations (>5 seconds)
      logger.warn('Slow operation detected', {
        operation: this.operation,
        duration,
        ...additionalData
      });
    }
  }
}

// Helper function to create performance monitor
export const startPerformanceMonitor = (operation: string): PerformanceMonitor => {
  return new PerformanceMonitor(operation);
};

// Error formatting helper
export const formatError = (error: any): any => {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      ...(error as any).details
    };
  }
  return error;
};

// Context-aware logging
export const createContextLogger = (context: any) => {
  return {
    info: (message: string, meta?: any) => logger.info(message, { ...context, ...meta }),
    warn: (message: string, meta?: any) => logger.warn(message, { ...context, ...meta }),
    error: (message: string, meta?: any) => logger.error(message, { ...context, ...meta }),
    debug: (message: string, meta?: any) => logger.debug(message, { ...context, ...meta })
  };
};

export default logger;
export { logger };