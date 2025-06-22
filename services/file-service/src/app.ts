import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { config } from './config';
import { logger } from './utils/logger';
import { routes } from './routes';
import { authMiddleware } from './middleware/auth';
import { fileService } from './services/file.service';

export async function createApp(): Promise<FastifyInstance> {
  // Create Fastify instance
  const app = Fastify({
    logger: false, // Use our custom logger
    trustProxy: true,
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'requestId',
    bodyLimit: config.MAX_FILE_SIZE,
  });

  try {
    // Register CORS
    await app.register(cors, {
      origin: config.CORS_ORIGINS.split(','),
      credentials: true,
    });

    // Register helmet for security headers
    await app.register(helmet, {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
        },
      },
    });

    // Register multipart for file uploads
    await app.register(multipart, {
      limits: {
        fileSize: config.MAX_FILE_SIZE,
        files: config.MAX_FILES_PER_REQUEST,
      },
      attachFieldsToBody: true,
    });

    // Register Swagger documentation
    await app.register(swagger, {
      swagger: {
        info: {
          title: 'File Service API',
          description: 'File management service for the Threat Modeling Application',
          version: '1.0.0',
        },
        host: `${config.HOST}:${config.PORT}`,
        schemes: ['http', 'https'],
        consumes: ['application/json', 'multipart/form-data'],
        produces: ['application/json', 'application/octet-stream'],
        tags: [
          { name: 'files', description: 'File operations' },
          { name: 'sharing', description: 'File sharing operations' },
          { name: 'image-processing', description: 'Image processing operations' },
          { name: 'bulk', description: 'Bulk operations' },
          { name: 'stats', description: 'Statistics and analytics' },
          { name: 'quota', description: 'Storage quota management' },
          { name: 'admin', description: 'Admin operations' },
          { name: 'health', description: 'Health check' },
        ],
        securityDefinitions: {
          Bearer: {
            type: 'apiKey',
            name: 'Authorization',
            in: 'header',
            description: 'JWT authorization header using the Bearer scheme. Example: "Bearer {token}"',
          },
        },
        security: [{ Bearer: [] }],
      },
    });

    // Register Swagger UI
    await app.register(swaggerUi, {
      routePrefix: '/documentation',
      uiConfig: {
        docExpansion: 'list',
        deepLinking: false,
      },
      staticCSP: true,
      transformStaticCSP: (header) => header,
      transformSpecification: (swaggerObject) => {
        return swaggerObject;
      },
      transformSpecificationClone: true,
    });

    // Register rate limiting
    await app.register(rateLimit, {
      max: config.RATE_LIMIT_MAX,
      timeWindow: config.RATE_LIMIT_WINDOW,
      errorResponseBuilder: (request, context) => ({
        error: 'Rate limit exceeded',
        message: `Too many requests from ${request.ip}. Try again later.`,
        retryAfter: Math.round(context.ttl / 1000),
      }),
    });

    // Add global hooks
    app.addHook('onRequest', async (request, reply) => {
      const start = Date.now();
      request.startTime = start;
      
      logger.info({
        method: request.method,
        url: request.url,
        userAgent: request.headers['user-agent'],
        ip: request.ip,
        requestId: request.id,
      }, 'Incoming request');
    });

    app.addHook('onResponse', async (request, reply) => {
      const duration = Date.now() - (request.startTime || Date.now());
      
      logger.info({
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        duration,
        requestId: request.id,
      }, 'Request completed');
    });

    app.addHook('onError', async (request, reply, error) => {
      logger.error({
        method: request.method,
        url: request.url,
        error: error.message,
        stack: error.stack,
        requestId: request.id,
      }, 'Request error');
    });

    // Register authentication middleware for protected routes
    app.register(async function (fastify) {
      fastify.addHook('preHandler', authMiddleware);
      
      // Register API routes
      await fastify.register(routes, { prefix: '/api/v1' });
    });

    // Error handler
    app.setErrorHandler(async (error, request, reply) => {
      logger.error({
        error: error.message,
        stack: error.stack,
        requestId: request.id,
      }, 'Unhandled error');

      const statusCode = error.statusCode || 500;
      let message = error.message;

      // Handle specific error types
      if (error.code === 'FST_ERR_MULTIPART_FILE_SIZE_TOO_LARGE') {
        message = `File too large. Maximum size: ${config.MAX_FILE_SIZE} bytes`;
        reply.status(413);
      } else if (error.code === 'FST_ERR_MULTIPART_FILES_LIMIT') {
        message = `Too many files. Maximum: ${config.MAX_FILES_PER_REQUEST} files`;
        reply.status(413);
      } else if (statusCode === 500) {
        message = 'Internal Server Error';
        reply.status(500);
      } else {
        reply.status(statusCode);
      }

      reply.send({
        success: false,
        error: message,
        requestId: request.id,
      });
    });

    // Not found handler
    app.setNotFoundHandler(async (request, reply) => {
      logger.warn({
        method: request.method,
        url: request.url,
        requestId: request.id,
      }, 'Route not found');

      reply.status(404).send({
        success: false,
        error: 'Route not found',
        requestId: request.id,
      });
    });

    // Initialize services
    await fileService.initialize();

    logger.info('Application initialized successfully');
    return app;

  } catch (error) {
    logger.error('Failed to initialize application:', error);
    throw error;
  }
}

// Graceful shutdown
export async function gracefulShutdown(app: FastifyInstance): Promise<void> {
  logger.info('Starting graceful shutdown...');

  try {
    // Close Fastify server
    await app.close();
    
    // Cleanup services
    await fileService.cleanup();
    
    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
}

// Handle process signals
export function setupProcessHandlers(app: FastifyInstance): void {
  const signals = ['SIGTERM', 'SIGINT', 'SIGUSR2'];
  
  signals.forEach((signal) => {
    process.on(signal, () => {
      logger.info(`Received ${signal}, starting graceful shutdown`);
      gracefulShutdown(app);
    });
  });

  process.on('uncaughtException', (error) => {
    logger.fatal('Uncaught exception:', error);
    gracefulShutdown(app);
  });

  process.on('unhandledRejection', (reason) => {
    logger.fatal('Unhandled rejection:', reason);
    gracefulShutdown(app);
  });
}

// Extend Fastify request interface
declare module 'fastify' {
  interface FastifyRequest {
    startTime?: number;
  }
}