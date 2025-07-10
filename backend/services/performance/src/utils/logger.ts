/**
 * Performance Service Logger
 * 
 * Provides structured logging for the performance optimization service
 */

import winston from 'winston';

const logLevel = process.env.LOG_LEVEL || 'info';
const nodeEnv = process.env.NODE_ENV || 'development';

// Custom log format
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss',
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let logMessage = `${timestamp} [${level.toUpperCase()}]: ${message}`;
    
    if (Object.keys(meta).length > 0) {
      logMessage += ` ${JSON.stringify(meta)}`;
    }
    
    return logMessage;
  })
);

// Create logger instance
export const logger = winston.createLogger({
  level: logLevel,
  format: logFormat,
  defaultMeta: {
    service: 'performance-optimization-service',
    version: '1.0.0',
  },
  transports: [
    // Console transport
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
    
    // File transport for all logs
    new winston.transports.File({
      filename: 'logs/performance-service.log',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
    }),
    
    // Error log file
    new winston.transports.File({
      filename: 'logs/performance-errors.log',
      level: 'error',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 3,
    }),
  ],
  
  // Handle exceptions
  exceptionHandlers: [
    new winston.transports.File({
      filename: 'logs/performance-exceptions.log',
    }),
  ],
  
  // Exit on handled exceptions
  exitOnError: false,
});

// Add stream for morgan HTTP logging
logger.stream = {
  write: (message: string) => {
    logger.info(message.trim());
  },
} as any;

export default logger;