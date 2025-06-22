import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { config } from './config';
import { logger } from './utils/logger';
import { routes } from './routes';
import { authMiddleware } from './middleware/auth';
import { notificationService } from './services/notification.service';

export async function createApp(): Promise<FastifyInstance> {
  // Create Fastify instance
  const app = Fastify({
    logger: false, // Use our custom logger
    trustProxy: true,
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'requestId',
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
      const message = statusCode === 500 ? 'Internal Server Error' : error.message;

      reply.status(statusCode).send({
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
    await notificationService.initialize();

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
    await notificationService.cleanup();
    
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
    user?: {
      id: string;
      email: string;
      roles: string[];
    };
  }
}