import fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { config } from './config';
import { logger } from './utils/logger';
import { routes } from './routes';
import {
  elasticsearchService,
  indexManagerService,
} from './services';
import { kafkaConsumerService } from './services/kafka-consumer.service';

export async function buildApp(): Promise<FastifyInstance> {
  const app = fastify({
    logger: logger,
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'requestId',
    genReqId: () => `search-${Date.now()}-${Math.random().toString(36).substring(2)}`,
    trustProxy: true,
  });

  // Security plugins
  await app.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  });

  // CORS
  await app.register(cors, {
    origin: config.CORS_ORIGINS.split(',').map(origin => origin.trim()),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-Session-ID',
      'X-Request-ID',
    ],
  });

  // Rate limiting
  await app.register(rateLimit, {
    max: config.RATE_LIMIT_MAX,
    timeWindow: config.RATE_LIMIT_WINDOW,
    skipOnError: true,
    keyGenerator: (request) => {
      // Use user ID if authenticated, otherwise use IP
      const userId = (request as any).user?.id;
      return userId || request.ip;
    },
    errorResponseBuilder: (request, context) => {
      return {
        error: 'Rate Limit Exceeded',
        message: `Too many requests. Limit: ${context.max} requests per ${Math.floor(context.ttl / 1000)} seconds`,
        retryAfter: Math.ceil(context.ttl / 1000),
      };
    },
  });

  // Swagger documentation
  await app.register(swagger, {
    openapi: {
      openapi: '3.0.0',
      info: {
        title: 'Search Service API',
        description: 'Elasticsearch-powered search service for threat modeling application',
        version: '1.0.0',
        contact: {
          name: 'API Support',
          email: 'support@threatmodel.com',
        },
        license: {
          name: 'MIT',
          url: 'https://opensource.org/licenses/MIT',
        },
      },
      servers: [
        {
          url: `http://localhost:${config.PORT}`,
          description: 'Development server',
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
      security: [
        {
          bearerAuth: [],
        },
      ],
      tags: [
        {
          name: 'Search',
          description: 'Search operations',
        },
        {
          name: 'Analytics',
          description: 'Search analytics and metrics',
        },
        {
          name: 'Admin',
          description: 'Administrative operations',
        },
      ],
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false,
    },
    staticCSP: true,
    transformStaticCSP: (header) => header,
  });

  // Global error handler
  app.setErrorHandler(async (error, request, reply) => {
    const statusCode = error.statusCode || 500;
    
    logger.error('Request error:', {
      error: error.message,
      stack: error.stack,
      url: request.url,
      method: request.method,
      statusCode,
      requestId: request.id,
      userId: (request as any).user?.id,
    });

    const errorResponse = {
      error: error.name || 'Internal Server Error',
      message: statusCode === 500 ? 'An internal server error occurred' : error.message,
      requestId: request.id,
      timestamp: new Date().toISOString(),
    };

    // Include stack trace in development
    if (config.NODE_ENV === 'development' && statusCode === 500) {
      (errorResponse as any).stack = error.stack;
    }

    reply.status(statusCode).send(errorResponse);
  });

  // Global not found handler
  app.setNotFoundHandler(async (request, reply) => {
    logger.warn('Route not found:', {
      url: request.url,
      method: request.method,
      requestId: request.id,
    });

    reply.status(404).send({
      error: 'Not Found',
      message: `Route ${request.method} ${request.url} not found`,
      requestId: request.id,
      timestamp: new Date().toISOString(),
    });
  });

  // Request logging hook
  app.addHook('onRequest', async (request, reply) => {
    logger.debug('Incoming request:', {
      method: request.method,
      url: request.url,
      headers: request.headers,
      requestId: request.id,
      ip: request.ip,
    });
  });

  // Response logging hook
  app.addHook('onSend', async (request, reply, payload) => {
    const responseTime = reply.getResponseTime();
    
    logger.debug('Outgoing response:', {
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      responseTime: `${responseTime}ms`,
      requestId: request.id,
    });
  });

  // Register routes
  await app.register(routes);

  return app;
}

export async function startApp(): Promise<FastifyInstance> {
  try {
    logger.info('Starting Search Service...');

    // Build the app
    const app = await buildApp();

    // Initialize services
    logger.info('Initializing services...');
    
    // Initialize Elasticsearch
    await elasticsearchService.initialize();
    
    // Initialize index manager
    await indexManagerService.initialize();
    
    // Initialize Kafka consumer for real-time indexing
    if (config.ENABLE_REAL_TIME_INDEXING) {
      await kafkaConsumerService.initialize();
    }

    // Setup graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      logger.info(`Received ${signal}, starting graceful shutdown...`);
      
      try {
        // Stop accepting new connections
        await app.close();
        
        // Shutdown services
        if (config.ENABLE_REAL_TIME_INDEXING) {
          await kafkaConsumerService.shutdown();
        }
        
        await elasticsearchService.close();
        
        logger.info('Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        logger.error('Error during graceful shutdown:', error);
        process.exit(1);
      }
    };

    // Handle shutdown signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.fatal('Uncaught exception:', error);
      gracefulShutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.fatal('Unhandled rejection at:', promise, 'reason:', reason);
      gracefulShutdown('unhandledRejection');
    });

    // Start the server
    const address = await app.listen({
      port: config.PORT,
      host: config.HOST,
    });

    logger.info(`Search Service started successfully`);
    logger.info(`Server listening on: ${address}`);
    logger.info(`Swagger documentation available at: ${address}/docs`);
    logger.info(`Health check available at: ${address}/health`);
    
    if (config.ENABLE_REAL_TIME_INDEXING) {
      logger.info('Real-time indexing is enabled via Kafka');
    } else {
      logger.info('Real-time indexing is disabled');
    }

    return app;

  } catch (error) {
    logger.fatal('Failed to start Search Service:', error);
    process.exit(1);
  }
}