import winston from 'winston';
import path from 'path';

const logLevel = process.env['LOG_LEVEL'] || 'info';
const nodeEnv = process.env['NODE_ENV'] || 'development';

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.printf(({ timestamp, level, message, ...metadata }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(metadata).length > 0) {
      msg += ` ${JSON.stringify(metadata)}`;
    }
    return msg;
  })
);

// Create transports
const transports: winston.transport[] = [];

// Console transport
if (nodeEnv !== 'test') {
  transports.push(
    new winston.transports.Console({
      format: nodeEnv === 'production' ? logFormat : consoleFormat,
    })
  );
}

// File transports for production
if (nodeEnv === 'production') {
  // Error log
  transports.push(
    new winston.transports.File({
      filename: path.join('logs', 'error.log'),
      level: 'error',
      format: logFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  );

  // Combined log
  transports.push(
    new winston.transports.File({
      filename: path.join('logs', 'combined.log'),
      format: logFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  );

  // Integration specific log
  transports.push(
    new winston.transports.File({
      filename: path.join('logs', 'integration.log'),
      format: logFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  );
}

// Create logger
export const logger = winston.createLogger({
  level: logLevel,
  format: logFormat,
  defaultMeta: { service: 'integration-service' },
  transports,
  exitOnError: false,
});

// Add request logging middleware
export function requestLogger(req: any, res: any, next: any) {
  const start = Date.now();
  const { method, url } = req;
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const { statusCode } = res;
    
    const logData = {
      method,
      url,
      statusCode,
      duration,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('user-agent'),
    };

    if (statusCode >= 400) {
      logger.warn('Request completed with error', logData);
    } else {
      logger.info('Request completed', logData);
    }
  });

  next();
}

// Utility functions for structured logging
export function logIntegrationEvent(
  integrationId: string,
  event: string,
  data?: any
) {
  logger.info('Integration event', {
    integrationId,
    event,
    ...data,
  });
}

export function logWebhookEvent(
  provider: string,
  event: string,
  data?: any
) {
  logger.info('Webhook event', {
    provider,
    event,
    ...data,
  });
}

export function logSyncEvent(
  integrationId: string,
  event: string,
  data?: any
) {
  logger.info('Sync event', {
    integrationId,
    event,
    ...data,
  });
}

export function logError(
  error: Error | unknown,
  context?: Record<string, any>
) {
  if (error instanceof Error) {
    logger.error(error.message, {
      stack: error.stack,
      ...context,
    });
  } else {
    logger.error('Unknown error', {
      error,
      ...context,
    });
  }
}