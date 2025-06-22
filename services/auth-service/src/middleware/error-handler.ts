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

    // Log error with context
    logger.error('Request error', {
      requestId,
      method,
      url,
      userAgent,
      ip,
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
        code: 'INVALID_TOKEN',
      });
    }

    if (error.code === 'FST_JWT_EXPIRED') {
      return reply.status(401).send({
        error: 'Authentication Error',
        message: 'Token has expired',
        statusCode: 401,
        requestId,
        code: 'TOKEN_EXPIRED',
      });
    }

    // Rate limit errors
    if (error.statusCode === 429) {
      return reply.status(429).send({
        error: 'Rate Limit Exceeded',
        message: 'Too many requests. Please try again later.',
        statusCode: 429,
        requestId,
        code: 'RATE_LIMIT_EXCEEDED',
      });
    }

    // Database errors
    if (error.code === '23505') { // PostgreSQL unique violation
      return reply.status(409).send({
        error: 'Conflict',
        message: 'Resource already exists',
        statusCode: 409,
        requestId,
        code: 'RESOURCE_EXISTS',
      });
    }

    if (error.code === '23503') { // PostgreSQL foreign key violation
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Referenced resource does not exist',
        statusCode: 400,
        requestId,
        code: 'INVALID_REFERENCE',
      });
    }

    if (error.code === '23502') { // PostgreSQL not null violation
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Required field is missing',
        statusCode: 400,
        requestId,
        code: 'MISSING_REQUIRED_FIELD',
      });
    }

    // Custom application errors
    switch (error.code) {
      case 'USER_NOT_FOUND':
        return reply.status(404).send({
          error: 'Not Found',
          message: 'User not found',
          statusCode: 404,
          requestId,
          code: 'USER_NOT_FOUND',
        });

      case 'INVALID_CREDENTIALS':
        return reply.status(401).send({
          error: 'Authentication Failed',
          message: 'Invalid email or password',
          statusCode: 401,
          requestId,
          code: 'INVALID_CREDENTIALS',
        });

      case 'ACCOUNT_LOCKED':
        return reply.status(423).send({
          error: 'Account Locked',
          message: 'Account is locked due to too many failed login attempts',
          statusCode: 423,
          requestId,
          code: 'ACCOUNT_LOCKED',
        });

      case 'MFA_REQUIRED':
        return reply.status(403).send({
          error: 'MFA Required',
          message: 'Multi-factor authentication is required',
          statusCode: 403,
          requestId,
          code: 'MFA_REQUIRED',
        });

      case 'INVALID_MFA_TOKEN':
        return reply.status(400).send({
          error: 'Invalid MFA Token',
          message: 'The provided MFA token is invalid',
          statusCode: 400,
          requestId,
          code: 'INVALID_MFA_TOKEN',
        });

      case 'EMAIL_NOT_VERIFIED':
        return reply.status(403).send({
          error: 'Email Not Verified',
          message: 'Please verify your email address',
          statusCode: 403,
          requestId,
          code: 'EMAIL_NOT_VERIFIED',
        });

      case 'PASSWORD_RESET_REQUIRED':
        return reply.status(403).send({
          error: 'Password Reset Required',
          message: 'You must reset your password before continuing',
          statusCode: 403,
          requestId,
          code: 'PASSWORD_RESET_REQUIRED',
        });

      case 'SESSION_EXPIRED':
        return reply.status(401).send({
          error: 'Session Expired',
          message: 'Your session has expired. Please log in again.',
          statusCode: 401,
          requestId,
          code: 'SESSION_EXPIRED',
        });

      case 'INSUFFICIENT_PERMISSIONS':
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'You do not have permission to perform this action',
          statusCode: 403,
          requestId,
          code: 'INSUFFICIENT_PERMISSIONS',
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
        code: error.code,
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
      code: 'ROUTE_NOT_FOUND',
    });
  });
};

function getErrorName(statusCode: number): string {
  switch (statusCode) {
    case 400: return 'Bad Request';
    case 401: return 'Unauthorized';
    case 403: return 'Forbidden';
    case 404: return 'Not Found';
    case 405: return 'Method Not Allowed';
    case 409: return 'Conflict';
    case 422: return 'Unprocessable Entity';
    case 423: return 'Locked';
    case 429: return 'Too Many Requests';
    case 500: return 'Internal Server Error';
    case 502: return 'Bad Gateway';
    case 503: return 'Service Unavailable';
    case 504: return 'Gateway Timeout';
    default: return 'Error';
  }
}

// Custom error classes
export class AuthenticationError extends Error {
  statusCode = 401;
  code = 'AUTHENTICATION_ERROR';
  
  constructor(message = 'Authentication failed') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends Error {
  statusCode = 403;
  code = 'AUTHORIZATION_ERROR';
  
  constructor(message = 'Authorization failed') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export class ValidationError extends Error {
  statusCode = 400;
  code = 'VALIDATION_ERROR';
  
  constructor(message = 'Validation failed') {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends Error {
  statusCode = 404;
  code = 'NOT_FOUND';
  
  constructor(message = 'Resource not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends Error {
  statusCode = 409;
  code = 'CONFLICT';
  
  constructor(message = 'Resource conflict') {
    super(message);
    this.name = 'ConflictError';
  }
}

export class RateLimitError extends Error {
  statusCode = 429;
  code = 'RATE_LIMIT_EXCEEDED';
  
  constructor(message = 'Rate limit exceeded') {
    super(message);
    this.name = 'RateLimitError';
  }
}

export default fp(errorHandler, {
  name: 'error-handler',
});