import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { ApiResponse, ValidationError } from '../types';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
  code?: string;
  details?: any;
}

// Error handler middleware
export const errorHandler = (err: AppError, req: Request, res: Response, next: NextFunction): void => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal server error';
  let errors: ValidationError[] = [];

  // Log error details
  logger.error('Error caught by error handler:', {
    message: err.message,
    stack: err.stack,
    statusCode,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    body: req.method !== 'GET' ? req.body : undefined,
  });

  // Handle specific error types
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation failed';
    errors = handleValidationError(err);
  } else if (err.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid data format';
    errors = handleCastError(err);
  } else if (err.code === '11000') {
    statusCode = 409;
    message = 'Duplicate field value';
    errors = handleDuplicateFieldError(err);
  } else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
    errors = [{ field: 'token', message: 'Token is invalid' }];
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
    errors = [{ field: 'token', message: 'Token has expired' }];
  } else if (err.code === 'ECONNREFUSED') {
    statusCode = 503;
    message = 'Service temporarily unavailable';
    errors = [{ field: 'service', message: 'Unable to connect to external service' }];
  } else if (err.code === 'ETIMEDOUT') {
    statusCode = 408;
    message = 'Request timeout';
    errors = [{ field: 'timeout', message: 'Request took too long to complete' }];
  } else if (err.statusCode >= 400 && err.statusCode < 500) {
    // Client errors
    errors = [{ field: 'client', message: message }];
  } else if (err.statusCode >= 500) {
    // Server errors - don't expose internal details in production
    if (process.env['NODE_ENV'] === 'production') {
      message = 'Internal server error';
      errors = [{ field: 'server', message: 'An unexpected error occurred' }];
    } else {
      errors = [{ field: 'server', message: message }];
    }
  } else {
    // Unhandled errors
    if (process.env['NODE_ENV'] === 'production') {
      message = 'Internal server error';
      errors = [{ field: 'server', message: 'An unexpected error occurred' }];
    } else {
      errors = [{ field: 'unknown', message: message }];
    }
  }

  const response: ApiResponse = {
    success: false,
    message,
    errors,
  };

  // Add error details in development
  if (process.env['NODE_ENV'] === 'development') {
    response.errors = [
      ...errors,
      {
        field: 'debug',
        message: 'Debug information',
        value: {
          name: err.name,
          code: err.code,
          stack: err.stack,
        },
      },
    ];
  }

  res.status(statusCode).json(response);
};

// Handle validation errors
const handleValidationError = (err: any): ValidationError[] => {
  const errors: ValidationError[] = [];
  
  if (err.errors) {
    Object.values(err.errors).forEach((error: any) => {
      errors.push({
        field: error.path || error.field || 'unknown',
        message: error.message,
        value: error.value,
      });
    });
  } else {
    errors.push({
      field: 'validation',
      message: err.message,
    });
  }

  return errors;
};

// Handle cast errors (e.g., invalid ObjectId)
const handleCastError = (err: any): ValidationError[] => {
  return [{
    field: err.path || 'unknown',
    message: `Invalid ${err.kind}: ${err.value}`,
    value: err.value,
  }];
};

// Handle duplicate field errors
const handleDuplicateFieldError = (err: any): ValidationError[] => {
  const field = Object.keys(err.keyValue || {})[0] || 'unknown';
  const value = err.keyValue?.[field];
  
  return [{
    field,
    message: `${field} already exists`,
    value,
  }];
};

// Async error wrapper
export const asyncErrorHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Not found handler
export const notFoundHandler = (req: Request, res: Response): void => {
  const response: ApiResponse = {
    success: false,
    message: `Route ${req.originalUrl} not found`,
    errors: [{
      field: 'route',
      message: `Cannot ${req.method} ${req.originalUrl}`,
    }],
  };

  logger.warn('Route not found:', {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
  });

  res.status(404).json(response);
};

// Create custom error
export const createError = (message: string, statusCode: number = 500, code?: string): AppError => {
  const error = new Error(message) as AppError;
  error.statusCode = statusCode;
  error.isOperational = true;
  error.code = code;
  return error;
};

// Database error handler
export const handleDatabaseError = (error: any): AppError => {
  logger.error('Database error:', error);

  if (error.code === '23505') {
    // PostgreSQL unique violation
    return createError('Duplicate entry', 409, 'DUPLICATE_ENTRY');
  } else if (error.code === '23503') {
    // PostgreSQL foreign key violation
    return createError('Referenced record not found', 400, 'FOREIGN_KEY_VIOLATION');
  } else if (error.code === '23502') {
    // PostgreSQL not null violation
    return createError('Required field missing', 400, 'NOT_NULL_VIOLATION');
  } else if (error.code === 'ECONNREFUSED') {
    return createError('Database connection failed', 503, 'DB_CONNECTION_FAILED');
  } else if (error.code === 'ETIMEDOUT') {
    return createError('Database query timeout', 408, 'DB_TIMEOUT');
  }

  return createError('Database operation failed', 500, 'DB_ERROR');
};

// Redis error handler
export const handleRedisError = (error: any): AppError => {
  logger.error('Redis error:', error);

  if (error.code === 'ECONNREFUSED') {
    return createError('Cache service unavailable', 503, 'REDIS_CONNECTION_FAILED');
  } else if (error.code === 'ETIMEDOUT') {
    return createError('Cache operation timeout', 408, 'REDIS_TIMEOUT');
  }

  return createError('Cache operation failed', 500, 'REDIS_ERROR');
};

// External service error handler
export const handleExternalServiceError = (error: any, serviceName: string): AppError => {
  logger.error(`${serviceName} service error:`, error);

  if (error.response) {
    // HTTP error response
    const status = error.response.status;
    const message = error.response.data?.message || error.message;

    if (status === 401) {
      return createError(`${serviceName} authentication failed`, 502, 'EXTERNAL_AUTH_FAILED');
    } else if (status === 403) {
      return createError(`${serviceName} access denied`, 502, 'EXTERNAL_ACCESS_DENIED');
    } else if (status === 404) {
      return createError(`${serviceName} resource not found`, 404, 'EXTERNAL_NOT_FOUND');
    } else if (status === 429) {
      return createError(`${serviceName} rate limit exceeded`, 429, 'EXTERNAL_RATE_LIMIT');
    } else if (status >= 500) {
      return createError(`${serviceName} service error`, 502, 'EXTERNAL_SERVER_ERROR');
    }

    return createError(`${serviceName} error: ${message}`, 502, 'EXTERNAL_ERROR');
  } else if (error.code === 'ECONNREFUSED') {
    return createError(`${serviceName} service unavailable`, 503, 'EXTERNAL_UNAVAILABLE');
  } else if (error.code === 'ETIMEDOUT') {
    return createError(`${serviceName} request timeout`, 408, 'EXTERNAL_TIMEOUT');
  }

  return createError(`${serviceName} operation failed`, 502, 'EXTERNAL_ERROR');
};

// Notification-specific error handler
export const handleNotificationError = (error: any, notificationType: string): AppError => {
  logger.error(`${notificationType} notification error:`, error);

  switch (notificationType) {
    case 'email':
      if (error.code === 'EAUTH') {
        return createError('Email authentication failed', 502, 'EMAIL_AUTH_FAILED');
      } else if (error.code === 'EENVELOPE') {
        return createError('Invalid email address', 400, 'EMAIL_INVALID_ADDRESS');
      }
      break;

    case 'slack':
      if (error.data?.error === 'channel_not_found') {
        return createError('Slack channel not found', 404, 'SLACK_CHANNEL_NOT_FOUND');
      } else if (error.data?.error === 'not_in_channel') {
        return createError('Bot not in Slack channel', 403, 'SLACK_NOT_IN_CHANNEL');
      }
      break;

    case 'sms':
      if (error.code === 21211) {
        return createError('Invalid phone number', 400, 'SMS_INVALID_NUMBER');
      } else if (error.code === 21608) {
        return createError('Phone number not verified', 400, 'SMS_NUMBER_NOT_VERIFIED');
      }
      break;

    case 'webhook':
      if (error.code === 'ENOTFOUND') {
        return createError('Webhook URL not found', 400, 'WEBHOOK_URL_NOT_FOUND');
      } else if (error.response?.status === 404) {
        return createError('Webhook endpoint not found', 404, 'WEBHOOK_ENDPOINT_NOT_FOUND');
      }
      break;
  }

  return createError(`${notificationType} notification failed`, 502, 'NOTIFICATION_FAILED');
};

// Global uncaught exception handler
export const handleUncaughtException = () => {
  process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught Exception:', error);
    process.exit(1);
  });
};

// Global unhandled rejection handler
export const handleUnhandledRejection = () => {
  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
  });
};

// Graceful shutdown handler
export const handleGracefulShutdown = () => {
  const shutdown = (signal: string) => {
    logger.info(`Received ${signal}, shutting down gracefully`);
    
    // Close server
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};

export default errorHandler;