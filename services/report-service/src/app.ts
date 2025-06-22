import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import { config } from './config';
import { logger } from './utils/logger';
import { ReportQueueService } from './services/report-queue.service';
import { ReportStorageService } from './services/report-storage.service';
import { ReportController } from './controllers/report.controller';
import { reportRoutes } from './routes/report.routes';
import * as path from 'path';

export async function createApp(): Promise<FastifyInstance> {
  const fastify = Fastify({
    logger: false, // Use our custom logger
    trustProxy: true,
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'requestId',
  });

  try {
    // Initialize services
    const queueService = new ReportQueueService();
    const storageService = new ReportStorageService();
    
    await queueService.initialize();
    await storageService.initialize();

    // Store services in Fastify instance
    fastify.decorate('queueService', queueService);
    fastify.decorate('storageService', storageService);

    // Register security plugins
    await fastify.register(helmet, {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          fontSrc: ["'self'", 'data:'],
        },
      },
    });

    await fastify.register(cors, {
      origin: (origin, callback) => {
        const allowedOrigins = config.CORS_ORIGINS?.split(',') || ['http://localhost:3000'];
        
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
      max: config.RATE_LIMIT_MAX,
      timeWindow: config.RATE_LIMIT_WINDOW,
      errorResponseBuilder: (request, context) => {
        return {
          success: false,
          error: 'Rate limit exceeded',
          message: 'Too many requests from this IP, please try again later',
          retryAfter: Math.round(context.ttl / 1000),
          statusCode: 429,
          timestamp: new Date(),
        };
      },
    });

    // Multipart support for file uploads
    await fastify.register(multipart, {
      limits: {
        fileSize: config.MAX_REPORT_SIZE_MB * 1024 * 1024,
      },
    });

    // Static file serving for local report storage
    if (config.STORAGE_TYPE === 'local') {
      await fastify.register(fastifyStatic, {
        root: path.join(process.cwd(), config.STORAGE_PATH),
        prefix: '/reports/',
        decorateReply: false,
      });
    }

    // Request logging
    fastify.addHook('onRequest', async (request, reply) => {
      logger.info('Incoming request', {
        method: request.method,
        url: request.url,
        userAgent: request.headers['user-agent'],
        ip: request.ip,
        requestId: request.id,
      });
    });

    // Response logging
    fastify.addHook('onResponse', async (request, reply) => {
      const responseTime = reply.getResponseTime();
      
      logger.info('Request completed', {
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        responseTime: `${responseTime}ms`,
        requestId: request.id,
        userId: (request as any).user?.id,
      });

      // Log slow requests
      if (responseTime > 5000) {
        logger.warn('Slow request detected', {
          url: request.url,
          responseTime,
        });
      }
    });

    // Error handling
    fastify.setErrorHandler(async (error, request, reply) => {
      logger.error('Request error', {
        error: error.message,
        stack: config.NODE_ENV === 'development' ? error.stack : undefined,
        method: request.method,
        url: request.url,
        requestId: request.id,
      });

      // Don't expose internal errors in production
      if (config.NODE_ENV === 'production') {
        reply.status(500).send({
          success: false,
          error: 'Internal server error',
          message: 'An unexpected error occurred',
          statusCode: 500,
          requestId: request.id,
          timestamp: new Date(),
        });
      } else {
        reply.status(500).send({
          success: false,
          error: error.message,
          stack: error.stack,
          statusCode: 500,
          requestId: request.id,
          timestamp: new Date(),
        });
      }
    });

    // Not found handler
    fastify.setNotFoundHandler(async (request, reply) => {
      logger.warn('Route not found', {
        method: request.method,
        url: request.url,
        requestId: request.id,
      });

      reply.status(404).send({
        success: false,
        error: 'Route not found',
        message: `The requested endpoint ${request.method} ${request.url} does not exist`,
        statusCode: 404,
        requestId: request.id,
        timestamp: new Date(),
      });
    });

    // Create controller
    const reportController = new ReportController(queueService, storageService);

    // Register routes
    await fastify.register(reportRoutes, {
      prefix: '/api/reports',
      controller: reportController,
    });

    // Root endpoint
    fastify.get('/', async (request, reply) => {
      reply.send({
        service: 'Report Generation Service',
        version: '1.0.0',
        status: 'running',
        endpoints: {
          generate: '/api/reports/generate',
          status: '/api/reports/status/:jobId',
          download: '/api/reports/download/:reportId',
          list: '/api/reports',
          health: '/api/reports/health',
        },
      });
    });

    // Swagger documentation (development only)
    if (config.NODE_ENV === 'development') {
      await fastify.register(require('@fastify/swagger'), {
        swagger: {
          info: {
            title: 'Report Generation Service API',
            description: 'Generate PDF and HTML reports for threat models',
            version: '1.0.0',
          },
          host: `localhost:${config.PORT}`,
          schemes: ['http'],
          consumes: ['application/json'],
          produces: ['application/json'],
          tags: [
            { name: 'Reports', description: 'Report generation endpoints' },
            { name: 'Admin', description: 'Administrative endpoints' },
            { name: 'Health', description: 'Health check endpoints' },
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
        // Shutdown services
        await queueService.shutdown();
        
        // Close server
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

    logger.info('Report service application initialized successfully');
    
    return fastify;

  } catch (error) {
    logger.error('Failed to initialize application', { error });
    throw error;
  }
}