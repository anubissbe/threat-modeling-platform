import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { config } from './config';
import { logger, serviceLogger } from './utils/logger';
import { ServiceDiscovery } from './services/service-discovery';
import { CircuitBreaker } from './services/circuit-breaker';
import { LoadBalancer } from './services/load-balancer';
import { ApiGateway } from './services/api-gateway';
import { MonitoringService } from './services/monitoring';
import { optionalAuthMiddleware } from './middleware/auth.middleware';

export async function createApp(): Promise<FastifyInstance> {
  const fastify = Fastify({
    logger: false, // Use our custom logger instead
    trustProxy: true,
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'requestId',
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

    // Global rate limiting
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

    // Initialize core services
    const serviceDiscovery = new ServiceDiscovery();
    const circuitBreaker = new CircuitBreaker();
    const loadBalancer = new LoadBalancer(serviceDiscovery);
    const monitoringService = new MonitoringService(serviceDiscovery, circuitBreaker, loadBalancer);
    const apiGateway = new ApiGateway(serviceDiscovery, circuitBreaker, loadBalancer);

    // Store services in Fastify instance for access in routes
    fastify.decorate('serviceDiscovery', serviceDiscovery);
    fastify.decorate('circuitBreaker', circuitBreaker);
    fastify.decorate('loadBalancer', loadBalancer);
    fastify.decorate('monitoring', monitoringService);
    fastify.decorate('apiGateway', apiGateway);

    // Request logging middleware
    fastify.addHook('onRequest', async (request, reply) => {
      logger.info('Incoming request', {
        method: request.method,
        url: request.url,
        userAgent: request.headers['user-agent'],
        ip: request.ip,
        requestId: request.id,
        timestamp: new Date().toISOString(),
      });
    });

    // Optional authentication for all routes (gateway will handle per-route auth)
    fastify.addHook('preHandler', optionalAuthMiddleware);

    // Response time tracking and logging
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

      // Record metrics for monitoring
      if ((request as any).serviceName) {
        if (reply.statusCode >= 400) {
          monitoringService.recordError((request as any).serviceName, responseTime);
        } else {
          monitoringService.recordRequest((request as any).serviceName, responseTime);
        }
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
        userId: (request as any).user?.id,
      });

      // Record error in monitoring
      if ((request as any).serviceName) {
        monitoringService.recordError((request as any).serviceName);
      }

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
        userId: (request as any).user?.id,
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

    // Register management routes
    await registerManagementRoutes(fastify, serviceDiscovery, monitoringService);

    // Register API gateway routes (this handles all service proxying)
    await apiGateway.registerRoutes(fastify);

    // Start monitoring
    monitoringService.startMonitoring();

    // Swagger documentation (development only)
    if (config.NODE_ENV === 'development') {
      await fastify.register(require('@fastify/swagger'), {
        swagger: {
          info: {
            title: 'Integration Service API',
            description: 'API Gateway and service orchestration for threat modeling application',
            version: '1.0.0',
          },
          host: `localhost:${config.PORT}`,
          schemes: ['http'],
          consumes: ['application/json'],
          produces: ['application/json'],
          tags: [
            { name: 'Gateway', description: 'API gateway endpoints' },
            { name: 'Health', description: 'Health check endpoints' },
            { name: 'Management', description: 'Service management endpoints' },
            { name: 'Monitoring', description: 'Monitoring and metrics endpoints' },
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
        // Stop monitoring
        monitoringService.shutdown();
        
        // Shutdown services
        await serviceDiscovery.shutdown();
        circuitBreaker.shutdown();
        loadBalancer.shutdown();
        
        // Close server
        await fastify.close();
        
        serviceLogger.systemShutdown(signal, process.uptime());
        logger.info('Server closed successfully');
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown', { error });
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Wait for services to be healthy before considering app ready
    logger.info('Waiting for services to become healthy...');
    const servicesReady = await serviceDiscovery.waitForAllServices(30000);
    
    if (!servicesReady) {
      logger.warn('Not all services are healthy, but continuing...');
    } else {
      logger.info('All services are healthy and ready');
    }

    serviceLogger.systemStartup(
      config.PORT,
      config.NODE_ENV,
      serviceDiscovery.getAllServices().length
    );

    logger.info('Integration service application initialized successfully');
    
    return fastify;
  } catch (error) {
    logger.error('Failed to initialize application', { error });
    throw error;
  }
}

/**
 * Register management routes for service administration
 */
async function registerManagementRoutes(
  fastify: FastifyInstance,
  serviceDiscovery: ServiceDiscovery,
  monitoring: MonitoringService
): Promise<void> {
  // System health endpoint
  fastify.get('/system/health', async (request, reply) => {
    try {
      const healthReport = monitoring.getHealthReport();
      
      if (healthReport.status === 'healthy') {
        reply.send(healthReport);
      } else {
        reply.status(503).send(healthReport);
      }
    } catch (error: any) {
      reply.status(503).send({
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date(),
      });
    }
  });

  // Service discovery endpoints
  fastify.get('/system/services', async (request, reply) => {
    const services = serviceDiscovery.getAllServices();
    const healthChecks = serviceDiscovery.getAllServiceHealth();
    
    reply.send({
      success: true,
      data: {
        services,
        health: healthChecks,
        summary: {
          total: services.length,
          healthy: healthChecks.filter(h => h.status === 'healthy').length,
          unhealthy: healthChecks.filter(h => h.status === 'unhealthy').length,
        },
      },
    });
  });

  // Monitoring metrics endpoint
  fastify.get('/system/metrics', async (request, reply) => {
    const systemMetrics = monitoring.getSystemMetrics();
    const serviceMetrics = monitoring.getAllServiceMetrics();
    
    reply.send({
      success: true,
      data: {
        system: systemMetrics,
        services: serviceMetrics,
      },
    });
  });

  // Circuit breaker status
  fastify.get('/system/circuit-breakers', async (request, reply) => {
    const circuitBreaker = (fastify as any).circuitBreaker;
    const stats = circuitBreaker.getStats();
    const states = circuitBreaker.getAllStates();
    
    reply.send({
      success: true,
      data: {
        stats,
        states: Object.fromEntries(states),
      },
    });
  });

  // Load balancer status
  fastify.get('/system/load-balancer', async (request, reply) => {
    const loadBalancer = (fastify as any).loadBalancer;
    const stats = loadBalancer.getAllStats();
    
    reply.send({
      success: true,
      data: stats,
    });
  });
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

      logger.info(`🚀 Integration Service started`, {
        port: config.PORT,
        host: config.HOST,
        environment: config.NODE_ENV,
        nodeVersion: process.version,
        processId: process.pid,
      });

      // Log available routes in development
      if (config.NODE_ENV === 'development') {
        logger.info('🔗 Available management endpoints:', {
          health: `http://${config.HOST}:${config.PORT}/system/health`,
          services: `http://${config.HOST}:${config.PORT}/system/services`,
          metrics: `http://${config.HOST}:${config.PORT}/system/metrics`,
          docs: `http://${config.HOST}:${config.PORT}/docs`,
        });
      }

    } catch (error) {
      logger.error('💥 Failed to start server', { 
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
      });
      process.exit(1);
    }
  };

  start();
}