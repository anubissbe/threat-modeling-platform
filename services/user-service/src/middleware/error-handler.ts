import { FastifyPluginAsync, FastifyError } from 'fastify';
import fp from 'fastify-plugin';
import { logger } from '../utils/logger';
import { config } from '../config';

interface CustomError extends FastifyError {
  statusCode?: number;
  code?: string;
  validation?: any[];
}

const errorHandler: FastifyPluginAsync = async (fastify) => {
  fastify.setErrorHandler(async (error: CustomError, request, reply) => {
    const requestId = request.id;
    const method = request.method;
    const url = request.url;
    const userAgent = request.headers['user-agent'];
    const ip = request.ip;
    const userId = request.user?.sub;

    // Log error with context
    logger.error('Request error', {
      requestId,
      method,
      url,
      userAgent,
      ip,
      userId,
      error: {
        name: error.name,
        message: error.message,
        code: error.code,
        statusCode: error.statusCode,
        stack: config.NODE_ENV === 'development' ? error.stack : undefined,
      },
    });

    // Validation errors
    if (error.validation) {
      return reply.status(400).send({
        error: 'Validation Error',
        message: 'Request validation failed',
        statusCode: 400,
        requestId,
        details: error.validation.map((err: any) => ({
          field: err.instancePath || err.dataPath,
          message: err.message,
          value: err.data,
        })),
      });
    }

    // JWT errors
    if (error.code === 'FST_JWT_BAD_REQUEST' || error.code === 'FST_JWT_MALFORMED_TOKEN') {
      return reply.status(401).send({
        error: 'Authentication Error',
        message: 'Invalid or malformed token',
        statusCode: 401,
        requestId,
      });
    }

    if (error.code === 'FST_JWT_EXPIRED') {
      return reply.status(401).send({
        error: 'Authentication Error',
        message: 'Token has expired',
        statusCode: 401,
        requestId,
      });
    }

    // Rate limit errors
    if (error.statusCode === 429) {
      return reply.status(429).send({
        error: 'Rate Limit Exceeded',
        message: 'Too many requests. Please try again later.',
        statusCode: 429,
        requestId,
      });
    }

    // Database errors
    if (error.code === '23505') { // PostgreSQL unique violation
      return reply.status(409).send({
        error: 'Conflict',
        message: 'Resource already exists',
        statusCode: 409,
        requestId,
      });
    }

    if (error.code === '23503') { // PostgreSQL foreign key violation
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Referenced resource does not exist',
        statusCode: 400,
        requestId,
      });
    }

    if (error.code === '23502') { // PostgreSQL not null violation
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Required field is missing',
        statusCode: 400,
        requestId,
      });
    }

    // Custom application errors
    const customErrors: Record<string, { status: number; message: string }> = {
      'USER_NOT_FOUND': { status: 404, message: 'User not found' },
      'ORGANIZATION_NOT_FOUND': { status: 404, message: 'Organization not found' },
      'TEAM_NOT_FOUND': { status: 404, message: 'Team not found' },
      'ROLE_NOT_FOUND': { status: 404, message: 'Role not found' },
      'PERMISSION_NOT_FOUND': { status: 404, message: 'Permission not found' },
      'INVALID_CREDENTIALS': { status: 401, message: 'Invalid credentials' },
      'EMAIL_ALREADY_EXISTS': { status: 409, message: 'Email already exists' },
      'INSUFFICIENT_PERMISSIONS': { status: 403, message: 'Insufficient permissions' },
      'INVALID_TOKEN': { status: 401, message: 'Invalid or expired token' },
      'ORGANIZATION_LIMIT_REACHED': { status: 403, message: 'Organization limit reached' },
    };

    if (error.code && customErrors[error.code]) {
      const { status, message } = customErrors[error.code];
      return reply.status(status).send({
        error: error.code,
        message,
        statusCode: status,
        requestId,
      });
    }

    // HTTP status code errors
    if (error.statusCode) {
      const statusCode = error.statusCode;
      let message = error.message;

      // Sanitize error messages in production
      if (config.NODE_ENV === 'production' && statusCode >= 500) {
        message = 'An unexpected error occurred';
      }

      return reply.status(statusCode).send({
        error: getErrorName(statusCode),
        message,
        statusCode,
        requestId,
      });
    }

    // Default internal server error
    const statusCode = 500;
    const message = config.NODE_ENV === 'production' 
      ? 'An unexpected error occurred' 
      : error.message;

    return reply.status(statusCode).send({
      error: 'Internal Server Error',
      message,
      statusCode,
      requestId,
      ...(config.NODE_ENV === 'development' && { stack: error.stack }),
    });
  });

  // 404 handler
  fastify.setNotFoundHandler(async (request, reply) => {
    const requestId = request.id;
    
    logger.warn('Route not found', {
      requestId,
      method: request.method,
      url: request.url,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return reply.status(404).send({
      error: 'Not Found',
      message: `Route ${request.method} ${request.url} not found`,
      statusCode: 404,
      requestId,
    });
  });
};

function getErrorName(statusCode: number): string {
  const errorNames: Record<number, string> = {
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    405: 'Method Not Allowed',
    409: 'Conflict',
    422: 'Unprocessable Entity',
    423: 'Locked',
    429: 'Too Many Requests',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
    504: 'Gateway Timeout',
  };

  return errorNames[statusCode] || 'Error';
}

// Custom error classes
export class BadRequestError extends Error {
  statusCode = 400;
  
  constructor(message = 'Bad request') {
    super(message);
    this.name = 'BadRequestError';
  }
}

export class UnauthorizedError extends Error {
  statusCode = 401;
  
  constructor(message = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends Error {
  statusCode = 403;
  
  constructor(message = 'Forbidden') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends Error {
  statusCode = 404;
  
  constructor(message = 'Resource not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends Error {
  statusCode = 409;
  
  constructor(message = 'Resource conflict') {
    super(message);
    this.name = 'ConflictError';
  }
}

export class ValidationError extends Error {
  statusCode = 422;
  validation: any[];
  
  constructor(message = 'Validation failed', validation: any[] = []) {
    super(message);
    this.name = 'ValidationError';
    this.validation = validation;
  }
}

export default fp(errorHandler, {
  name: 'error-handler',
});