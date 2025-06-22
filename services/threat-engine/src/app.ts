import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { config } from './config';
import { logger } from './utils/logger';
import { registerRoutes } from './routes';
import { optionalAuthMiddleware } from './middleware/auth.middleware';

export async function createApp(): Promise<FastifyInstance> {
  const fastify = Fastify({
    logger: false, // Use our custom logger instead
    trustProxy: true,
  });

  try {
    // Register security plugins
    await fastify.register(helmet, {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
        },
      },
    });

    await fastify.register(cors, {
      origin: (origin, callback) => {
        const allowedOrigins = config.CORS_ORIGINS.split(',');
        
        // Allow requests with no origin (mobile apps, postman, etc.)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        
        callback(new Error('Not allowed by CORS'), false);
      },
      credentials: true,
    });

    // Rate limiting
    await fastify.register(rateLimit, {
      max: 100, // 100 requests
      timeWindow: '1 minute',
      errorResponseBuilder: (request, context) => {
        return {
          success: false,
          error: 'Rate limit exceeded',
          retryAfter: Math.round(context.ttl / 1000),
        };
      },
    });

    // Request logging middleware
    fastify.addHook('onRequest', async (request, reply) => {
      logger.info('Incoming request', {
        method: request.method,
        url: request.url,
        userAgent: request.headers['user-agent'],
        ip: request.ip,
        timestamp: new Date().toISOString(),
      });
    });

    // Optional authentication for all routes
    fastify.addHook('preHandler', optionalAuthMiddleware);

    // Response time tracking
    fastify.addHook('onResponse', async (request, reply) => {
      const responseTime = reply.getResponseTime();
      
      logger.info('Request completed', {
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        responseTime: `${responseTime}ms`,
        userId: (request as any).user?.id,
      });
    });

    // Error handling
    fastify.setErrorHandler(async (error, request, reply) => {
      logger.error('Request error', {
        error: error.message,
        stack: error.stack,
        method: request.method,
        url: request.url,
        userId: (request as any).user?.id,
      });

      // Don't expose internal errors in production
      if (config.NODE_ENV === 'production') {
        reply.status(500).send({
          success: false,
          error: 'Internal server error',
        });
      } else {
        reply.status(500).send({
          success: false,
          error: error.message,
          stack: error.stack,
        });
      }
    });

    // Not found handler
    fastify.setNotFoundHandler(async (request, reply) => {
      logger.warn('Route not found', {
        method: request.method,
        url: request.url,
        userId: (request as any).user?.id,
      });

      reply.status(404).send({
        success: false,
        error: 'Route not found',
      });
    });

    // Health check endpoint (before authentication)
    fastify.get('/health', async (request, reply) => {
      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'threat-engine',
        version: '1.0.0',
        environment: config.NODE_ENV,
      };
    });

    // Register application routes
    await registerRoutes(fastify);

    // Swagger documentation (development only)
    if (config.NODE_ENV === 'development') {
      await fastify.register(require('@fastify/swagger'), {
        swagger: {
          info: {
            title: 'Threat Modeling Engine API',
            description: 'Core threat analysis engine for threat modeling application',
            version: '1.0.0',
          },
          host: `localhost:${config.PORT}`,
          schemes: ['http'],
          consumes: ['application/json'],
          produces: ['application/json'],
          tags: [
            { name: 'Analysis', description: 'Threat analysis endpoints' },
            { name: 'Patterns', description: 'Threat pattern management' },
            { name: 'Mitigations', description: 'Mitigation recommendations' },
            { name: 'Risk', description: 'Risk assessment endpoints' },
            { name: 'Health', description: 'Service health endpoints' },
          ],
          securityDefinitions: {
            Bearer: {
              type: 'apiKey',
              name: 'Authorization',
              in: 'header',
              description: 'Enter: Bearer <token>',
            },
          },
          security: [{ Bearer: [] }],
        },
        exposeRoute: true,
      });

      await fastify.register(require('@fastify/swagger-ui'), {
        routePrefix: '/docs',
        uiConfig: {
          docExpansion: 'list',
          deepLinking: false,
        },
      });

      logger.info('Swagger documentation available at /docs');
    }

    // Graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully`);
      
      try {
        await fastify.close();
        logger.info('Server closed successfully');
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown', { error });
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    logger.info('Threat Engine application initialized successfully');
    
    return fastify;
  } catch (error) {
    logger.error('Failed to initialize application', { error });
    throw error;
  }
}

// Start server if this file is run directly
if (require.main === module) {
  const start = async () => {
    try {
      const app = await createApp();
      
      await app.listen({
        port: config.PORT,
        host: config.HOST,
      });

      logger.info(`Threat Engine server started`, {
        port: config.PORT,
        host: config.HOST,
        environment: config.NODE_ENV,
        nodeVersion: process.version,
      });

      // Log available routes in development
      if (config.NODE_ENV === 'development') {
        logger.info('Available routes:');
        app.printRoutes();
      }

    } catch (error) {
      logger.error('Failed to start server', { error });
      process.exit(1);
    }
  };

  start();
}