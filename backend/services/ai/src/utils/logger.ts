import winston from 'winston';
import path from 'path';

// Custom log format
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.prettyPrint()
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    
    // Add metadata if present
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta, null, 2)}`;
    }
    
    return msg;
  })
);

// Create logs directory if it doesn't exist
const logsDir = path.join(process.cwd(), 'logs');

// Configure transports based on environment
const transports: winston.transport[] = [];

// Always add console transport
transports.push(
  new winston.transports.Console({
    format: process.env.NODE_ENV === 'production' ? logFormat : consoleFormat,
    level: process.env.LOG_LEVEL || 'info'
  })
);

// Add file transports in production or if explicitly enabled
if (process.env.NODE_ENV === 'production' || process.env.ENABLE_FILE_LOGGING === 'true') {
  // Error log file
  transports.push(
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      format: logFormat,
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5
    })
  );

  // Combined log file
  transports.push(
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      format: logFormat,
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5
    })
  );

  // AI service specific log file
  transports.push(
    new winston.transports.File({
      filename: path.join(logsDir, 'ai-service.log'),
      format: logFormat,
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5
    })
  );
}

// Create logger instance
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: {
    service: 'ai-service',
    version: process.env.SERVICE_VERSION || '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  },
  transports,
  // Handle uncaught exceptions
  exceptionHandlers: [
    new winston.transports.Console({
      format: consoleFormat
    }),
    ...(process.env.NODE_ENV === 'production' ? [
      new winston.transports.File({
        filename: path.join(logsDir, 'exceptions.log'),
        format: logFormat
      })
    ] : [])
  ],
  // Handle unhandled promise rejections
  rejectionHandlers: [
    new winston.transports.Console({
      format: consoleFormat
    }),
    ...(process.env.NODE_ENV === 'production' ? [
      new winston.transports.File({
        filename: path.join(logsDir, 'rejections.log'),
        format: logFormat
      })
    ] : [])
  ]
});

// Create structured logging functions for different contexts
export const createContextLogger = (context: string, metadata?: Record<string, any>) => {
  return {
    error: (message: string, meta?: Record<string, any>) => 
      logger.error(message, { context, ...metadata, ...meta }),
    warn: (message: string, meta?: Record<string, any>) => 
      logger.warn(message, { context, ...metadata, ...meta }),
    info: (message: string, meta?: Record<string, any>) => 
      logger.info(message, { context, ...metadata, ...meta }),
    debug: (message: string, meta?: Record<string, any>) => 
      logger.debug(message, { context, ...metadata, ...meta })
  };
};

// Security event logger
export const securityLogger = createContextLogger('security');

// Performance logger
export const performanceLogger = createContextLogger('performance');

// AI analysis logger
export const aiLogger = createContextLogger('ai-analysis');

// Request logger middleware
export const requestLogger = (req: any, res: any, next: any) => {
  const start = Date.now();
  
  // Log incoming request
  logger.info('Incoming request', {
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    userId: req.user?.id
  });

  // Log response
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('Request completed', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userId: req.user?.id
    });
  });

  next();
};

// Error logger middleware
export const errorLogger = (err: any, req: any, res: any, next: any) => {
  logger.error('Request error', {
    error: err.message,
    stack: err.stack,
    method: req.method,
    url: req.url,
    userId: req.user?.id,
    ip: req.ip
  });

  next(err);
};

// Audit logger for sensitive operations
export const auditLogger = {
  threatAnalysis: (userId: string, threatModelId: string, analysisId: string) => {
    logger.info('Threat analysis performed', {
      context: 'audit',
      action: 'threat_analysis',
      userId,
      threatModelId,
      analysisId,
      timestamp: new Date().toISOString()
    });
  },
  
  threatIntelUpdate: (userId: string, feedId?: string) => {
    logger.info('Threat intelligence updated', {
      context: 'audit',
      action: 'threat_intel_update',
      userId,
      feedId,
      timestamp: new Date().toISOString()
    });
  },
  
  configurationChange: (userId: string, configType: string, changes: Record<string, any>) => {
    logger.info('Configuration changed', {
      context: 'audit',
      action: 'configuration_change',
      userId,
      configType,
      changes,
      timestamp: new Date().toISOString()
    });
  }
};

// Health check logger
export const healthLogger = {
  serviceStartup: (port: number) => {
    logger.info('AI service started', {
      context: 'health',
      port,
      timestamp: new Date().toISOString()
    });
  },
  
  serviceShutdown: () => {
    logger.info('AI service shutting down', {
      context: 'health',
      timestamp: new Date().toISOString()
    });
  },
  
  databaseConnection: (status: 'connected' | 'disconnected' | 'error', error?: string) => {
    logger.info('Database connection status', {
      context: 'health',
      status,
      error,
      timestamp: new Date().toISOString()
    });
  },
  
  redisConnection: (status: 'connected' | 'disconnected' | 'error', error?: string) => {
    logger.info('Redis connection status', {
      context: 'health',
      status,
      error,
      timestamp: new Date().toISOString()
    });
  }
};

// Ensure logs directory exists
import fs from 'fs';
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

export default logger;