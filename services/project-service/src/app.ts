import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { connectDatabase, closeDatabase } from './database';
import { config } from './config';
import { logger } from './utils/logger';
import { projectRoutes } from './routes/projects.routes';
import { threatModelRoutes } from './routes/threat-models.routes';
import { healthRoutes } from './routes/health.routes';

export async function createApp(): Promise<FastifyInstance> {
  const app = Fastify({
    disableRequestLogging: config.NODE_ENV === 'production',
    trustProxy: true,
  });

  // Security middleware
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

  // CORS configuration
  await app.register(cors, {
    origin: config.CORS_ORIGINS,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Rate limiting
  await app.register(rateLimit, {
    max: config.RATE_LIMIT_MAX,
    timeWindow: config.RATE_LIMIT_WINDOW,
    errorResponseBuilder: (request, context) => {
      return {
        error: 'Rate limit exceeded',
        message: `Too many requests. Try again in ${Math.round(context.ttl / 1000)} seconds.`,
        statusCode: 429,
      };
    },
  });

  // Global error handler
  app.setErrorHandler(async (error, request, reply) => {
    logger.error('Unhandled error:', {
      error: error.message,
      stack: error.stack,
      url: request.url,
      method: request.method,
      requestId: request.id,
    });

    // Don't expose internal errors in production
    const message = config.NODE_ENV === 'production' 
      ? 'Internal server error'
      : error.message;

    const statusCode = error.statusCode || 500;

    reply.code(statusCode).send({
      error: message,
      statusCode,
      requestId: request.id,
    });
  });

  // Global not found handler
  app.setNotFoundHandler(async (request, reply) => {
    reply.code(404).send({
      error: 'Not Found',
      message: `Route ${request.method} ${request.url} not found`,
      statusCode: 404,
    });
  });

  // Register routes
  await app.register(healthRoutes);
  await app.register(projectRoutes, { prefix: '/api/v1' });
  await app.register(threatModelRoutes, { prefix: '/api/v1' });

  // Graceful shutdown handler
  const gracefulShutdown = async (signal: string) => {
    logger.info(`Received ${signal}, starting graceful shutdown`);
    
    try {
      await app.close();
      await closeDatabase();
      logger.info('Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      logger.error('Error during graceful shutdown:', error);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  return app;
}

export async function startServer(): Promise<void> {
  try {
    // Connect to database
    await connectDatabase();
    logger.info('Database connected successfully');

    // Create and start the app
    const app = await createApp();
    
    const address = await app.listen({
      port: config.PORT,
      host: config.HOST,
    });

    logger.info(`Project service started on ${address}`);
    logger.info(`Environment: ${config.NODE_ENV}`);
    logger.info(`Database: Connected to PostgreSQL`);
    
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start server if this file is run directly
if (require.main === module) {
  startServer();
}