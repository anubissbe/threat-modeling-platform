import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../utils/logger';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public override message: string,
    public isOperational = true,
    public code?: string
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, public details?: any) {
    super(400, message, true, 'VALIDATION_ERROR');
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(401, message, true, 'AUTHENTICATION_ERROR');
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Insufficient permissions') {
    super(403, message, true, 'AUTHORIZATION_ERROR');
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(404, `${resource} not found`, true, 'NOT_FOUND');
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, message, true, 'CONFLICT');
  }
}

export class IntegrationError extends AppError {
  constructor(provider: string, message: string, public details?: any) {
    super(502, `${provider} integration error: ${message}`, true, 'INTEGRATION_ERROR');
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Too many requests') {
    super(429, message, true, 'RATE_LIMIT_ERROR');
  }
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  // Log error
  logger.error('Error handler caught error:', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    user: (req as any).user?.id,
  });

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: err.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      },
    });
  }

  // Handle operational errors
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(err instanceof ValidationError && err.details ? { details: err.details } : {}),
        ...(err instanceof IntegrationError && err.details ? { details: err.details } : {}),
      },
    });
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid authentication token',
      },
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      error: {
        code: 'TOKEN_EXPIRED',
        message: 'Authentication token has expired',
      },
    });
  }

  // Handle database errors
  if (err.message?.includes('duplicate key') || err.message?.includes('UNIQUE')) {
    return res.status(409).json({
      success: false,
      error: {
        code: 'DUPLICATE_ENTRY',
        message: 'Resource already exists',
      },
    });
  }

  // Default error response
  const statusCode = (err as any).statusCode || 500;
  const message = process.env['NODE_ENV'] === 'production' 
    ? 'Internal server error' 
    : err.message;

  return res.status(statusCode).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message,
      ...(process.env['NODE_ENV'] !== 'production' ? { stack: err.stack } : {}),
    },
  });
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.url} not found`,
    },
  });
}

// Async error wrapper
export function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}