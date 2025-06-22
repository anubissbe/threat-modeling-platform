import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { logger } from '../utils/logger';
import { config } from '../config';

interface RequestLogData {
  requestId: string;
  method: string;
  url: string;
  ip: string;
  userAgent: string;
  contentType?: string;
  contentLength?: number;
  userId?: string;
  organizationId?: string;
  responseTime?: number;
  statusCode?: number;
  responseSize?: number;
}

const requestLogger: FastifyPluginAsync = async (fastify) => {
  // Add request logging hook
  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    // Add start time for response time calculation
    request.startTime = Date.now();

    // Log incoming request (only in debug mode)
    if (config.LOG_LEVEL === 'debug') {
      const logData: RequestLogData = {
        requestId: request.id,
        method: request.method,
        url: request.url,
        ip: request.ip,
        userAgent: request.headers['user-agent'] || 'unknown',
        contentType: request.headers['content-type'],
        contentLength: request.headers['content-length'] ? parseInt(request.headers['content-length']) : undefined,
      };

      logger.debug('Incoming request', logData);
    }
  });

  // Add authentication context to logs
  fastify.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    // This hook runs after authentication middleware
    if (request.user) {
      request.userId = request.user.sub;
      request.organizationId = request.user.org;
    }
  });

  // Log response
  fastify.addHook('onSend', async (request: FastifyRequest, reply: FastifyReply, payload) => {
    const responseTime = Date.now() - (request.startTime || Date.now());
    const payloadSize = payload ? Buffer.byteLength(payload) : 0;

    const logData: RequestLogData = {
      requestId: request.id,
      method: request.method,
      url: request.url,
      ip: request.ip,
      userAgent: request.headers['user-agent'] || 'unknown',
      userId: request.userId,
      organizationId: request.organizationId,
      responseTime,
      statusCode: reply.statusCode,
      responseSize: payloadSize,
    };

    // Determine log level based on status code
    if (reply.statusCode >= 500) {
      logger.error('Request completed with server error', logData);
    } else if (reply.statusCode >= 400) {
      logger.warn('Request completed with client error', logData);
    } else if (config.LOG_LEVEL === 'debug' || responseTime > 1000) {
      logger.info('Request completed', logData);
    }

    // Add performance metrics headers in development
    if (config.NODE_ENV === 'development') {
      reply.header('X-Response-Time', `${responseTime}ms`);
      reply.header('X-Request-ID', request.id);
    }
  });

  // Log errors
  fastify.addHook('onError', async (request: FastifyRequest, reply: FastifyReply, error) => {
    const responseTime = Date.now() - (request.startTime || Date.now());

    logger.error('Request error occurred', {
      requestId: request.id,
      method: request.method,
      url: request.url,
      ip: request.ip,
      userAgent: request.headers['user-agent'] || 'unknown',
      userId: request.userId,
      organizationId: request.organizationId,
      responseTime,
      error: {
        name: error.name,
        message: error.message,
        code: error.code,
        stack: config.NODE_ENV === 'development' ? error.stack : undefined,
      },
    });
  });

  // Security-focused request logging
  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    // Log suspicious patterns
    const suspiciousPatterns = [
      /[<>'"]/g, // Potential XSS
      /union.*select/i, // SQL injection
      /script.*alert/i, // XSS attempts
      /\.\.\/|\.\.\\/, // Path traversal
      /<script|javascript:|vbscript:/i, // Script injection
    ];

    const urlPath = request.url;
    const userAgent = request.headers['user-agent'] || '';
    
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(urlPath) || pattern.test(userAgent)) {
        logger.warn('Suspicious request pattern detected', {
          requestId: request.id,
          ip: request.ip,
          url: urlPath,
          userAgent,
          pattern: pattern.toString(),
        });
        break;
      }
    }

    // Log requests with unusual headers
    const unusualHeaders = [
      'x-forwarded-for',
      'x-real-ip',
      'x-originating-ip',
      'x-remote-ip',
    ];

    for (const header of unusualHeaders) {
      if (request.headers[header]) {
        logger.info('Request with proxy headers', {
          requestId: request.id,
          ip: request.ip,
          header,
          value: request.headers[header],
        });
      }
    }
  });

  // Performance monitoring
  fastify.addHook('onSend', async (request: FastifyRequest, reply: FastifyReply) => {
    const responseTime = Date.now() - (request.startTime || Date.now());

    // Log slow requests
    if (responseTime > 1000) { // More than 1 second
      logger.warn('Slow request detected', {
        requestId: request.id,
        method: request.method,
        url: request.url,
        responseTime,
        statusCode: reply.statusCode,
      });
    }

    // Log large responses
    const contentLength = reply.getHeader('content-length');
    if (contentLength && parseInt(contentLength as string) > 1024 * 1024) { // More than 1MB
      logger.warn('Large response detected', {
        requestId: request.id,
        method: request.method,
        url: request.url,
        responseSize: contentLength,
        statusCode: reply.statusCode,
      });
    }
  });
};

// Extend Fastify request interface
declare module 'fastify' {
  interface FastifyRequest {
    startTime?: number;
    userId?: string;
    organizationId?: string;
  }
}

export default fp(requestLogger, {
  name: 'request-logger',
});