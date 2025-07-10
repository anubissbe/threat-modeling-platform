import { Request, Response, NextFunction } from 'express';
import { SecurityToolError } from '../types/security-tools';
import { logger } from '../utils/logger';

export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;
  code?: string;
  details?: any;

  constructor(
    message: string,
    statusCode: number = 500,
    isOperational: boolean = true,
    code?: string,
    details?: any
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.code = code;
    this.details = details;

    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  err: Error | AppError | SecurityToolError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Log error
  logger.error('Error handler caught:', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    body: req.body,
    query: req.query,
    params: req.params,
    user: (req as any).user
  });

  // Default error values
  let statusCode = 500;
  let message = 'Internal server error';
  let code = 'INTERNAL_ERROR';
  let details: any = undefined;

  // Handle different error types
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    code = err.code || code;
    details = err.details;
  } else if ('code' in err && 'toolType' in err) {
    // SecurityToolError
    const toolError = err as SecurityToolError;
    statusCode = 500;
    message = toolError.message;
    code = toolError.code;
    details = {
      toolType: toolError.toolType,
      platform: toolError.platform,
      integrationId: toolError.integrationId,
      ...toolError.details
    };
  } else if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation error';
    code = 'VALIDATION_ERROR';
    details = err.message;
  } else if (err.name === 'UnauthorizedError') {
    statusCode = 401;
    message = 'Unauthorized';
    code = 'UNAUTHORIZED';
  } else if (err.message.includes('not found')) {
    statusCode = 404;
    message = err.message;
    code = 'NOT_FOUND';
  }

  // Send error response
  res.status(statusCode).json({
    success: false,
    error: {
      message,
      code,
      details,
      timestamp: new Date().toISOString(),
      path: req.path,
      method: req.method
    }
  });
};

export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export const notFound = (req: Request, res: Response): void => {
  res.status(404).json({
    success: false,
    error: {
      message: 'Resource not found',
      code: 'NOT_FOUND',
      path: req.path,
      method: req.method
    }
  });
};

// Specific error handlers for security tools
export const handleIntegrationError = (
  error: any,
  integrationId: string,
  toolType: string,
  platform: string
): AppError => {
  logger.error('Integration error:', {
    integrationId,
    toolType,
    platform,
    error: error.message,
    stack: error.stack
  });

  if (error.code === 'ECONNREFUSED') {
    return new AppError(
      'Unable to connect to security tool',
      503,
      true,
      'CONNECTION_REFUSED',
      { integrationId, toolType, platform }
    );
  }

  if (error.code === 'ETIMEDOUT') {
    return new AppError(
      'Connection to security tool timed out',
      504,
      true,
      'CONNECTION_TIMEOUT',
      { integrationId, toolType, platform }
    );
  }

  if (error.response?.status === 401) {
    return new AppError(
      'Authentication failed with security tool',
      401,
      true,
      'AUTHENTICATION_FAILED',
      { integrationId, toolType, platform }
    );
  }

  if (error.response?.status === 403) {
    return new AppError(
      'Access denied by security tool',
      403,
      true,
      'ACCESS_DENIED',
      { integrationId, toolType, platform }
    );
  }

  if (error.response?.status === 429) {
    return new AppError(
      'Rate limit exceeded for security tool',
      429,
      true,
      'RATE_LIMIT_EXCEEDED',
      { 
        integrationId, 
        toolType, 
        platform,
        retryAfter: error.response.headers['retry-after']
      }
    );
  }

  return new AppError(
    error.message || 'Security tool integration error',
    500,
    true,
    'INTEGRATION_ERROR',
    { integrationId, toolType, platform }
  );
};

export const handleCorrelationError = (
  error: any,
  engineId: string,
  ruleId?: string
): AppError => {
  logger.error('Correlation error:', {
    engineId,
    ruleId,
    error: error.message,
    stack: error.stack
  });

  return new AppError(
    'Threat correlation failed',
    500,
    true,
    'CORRELATION_ERROR',
    { engineId, ruleId, originalError: error.message }
  );
};

export const handleDatabaseError = (error: any): AppError => {
  logger.error('Database error:', {
    error: error.message,
    code: error.code,
    stack: error.stack
  });

  if (error.code === '23505') {
    return new AppError(
      'Duplicate entry',
      409,
      true,
      'DUPLICATE_ENTRY'
    );
  }

  if (error.code === '23503') {
    return new AppError(
      'Foreign key constraint violation',
      400,
      true,
      'CONSTRAINT_VIOLATION'
    );
  }

  return new AppError(
    'Database operation failed',
    500,
    false,
    'DATABASE_ERROR'
  );
};