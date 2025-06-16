import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export interface ApiError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export function errorHandler(
  err: ApiError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  let { statusCode = 500, message } = err;

  // Don't expose internal errors in production
  if (process.env.NODE_ENV === 'production' && !err.isOperational) {
    statusCode = 500;
    message = 'Internal server error';
  }

  // Log error
  logger.error('API Error:', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    statusCode,
  });

  // Send error response
  const response: any = {
    success: false,
    error: message,
    statusCode,
  };

  // Include stack trace in development
  if (process.env.NODE_ENV === 'development') {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: `Route ${req.originalUrl} not found`,
    statusCode: 404,
  });
}

export function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export class ValidationError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
    this.isOperational = true;
  }
}

export class NotFoundError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string = 'Resource not found') {
    super(message);
    this.name = 'NotFoundError';
    this.statusCode = 404;
    this.isOperational = true;
  }
}

export class ConflictError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string = 'Resource conflict') {
    super(message);
    this.name = 'ConflictError';
    this.statusCode = 409;
    this.isOperational = true;
  }
}