import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import proxy from '@fastify/http-proxy';
import { config } from '../config';
import { logger, serviceLogger } from '../utils/logger';
import { ServiceDiscovery } from './service-discovery';
import { CircuitBreaker } from './circuit-breaker';
import { LoadBalancer } from './load-balancer';
import {
  RouteConfig,
  ServiceConfig,
  ProxyRequest,
  ProxyResponse,
  ErrorResponse,
} from '../types';

interface AuthenticatedRequest extends FastifyRequest {
  user?: {
    id: string;
    email: string;
    roles: string[];
    organizationId?: string;
    sessionId: string;
  };
}

export class ApiGateway {
  private serviceDiscovery: ServiceDiscovery;
  private circuitBreaker: CircuitBreaker;
  private loadBalancer: LoadBalancer;
  private routes: RouteConfig[] = [];

  constructor(
    serviceDiscovery: ServiceDiscovery,
    circuitBreaker: CircuitBreaker,
    loadBalancer: LoadBalancer
  ) {
    this.serviceDiscovery = serviceDiscovery;
    this.circuitBreaker = circuitBreaker;
    this.loadBalancer = loadBalancer;
    this.initializeRoutes();
  }

  /**
   * Initialize default routes
   */
  private initializeRoutes(): void {
    this.routes = [
      // Authentication routes
      {
        path: '/api/auth/*',
        serviceName: 'auth-service',
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        requireAuth: false, // Auth service handles its own auth
        rateLimit: { max: 100, windowMs: 60000 },
      },
      
      // User management routes
      {
        path: '/api/users/*',
        serviceName: 'user-service',
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        requireAuth: true,
        rateLimit: { max: 200, windowMs: 60000 },
      },
      
      // Project management routes
      {
        path: '/api/projects/*',
        serviceName: 'project-service',
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        requireAuth: true,
        rateLimit: { max: 500, windowMs: 60000 },
      },
      
      // Threat analysis routes
      {
        path: '/api/threats/*',
        serviceName: 'threat-engine',
        methods: ['GET', 'POST'],
        requireAuth: true,
        rateLimit: { max: 100, windowMs: 60000 }, // More restrictive for analysis
        timeout: 120000, // 2 minutes for complex analysis
      },
    ];

    serviceLogger.configurationLoaded(
      this.serviceDiscovery.getAllServices().length,
      this.routes.length
    );
  }

  /**
   * Register routes with Fastify instance
   */
  async registerRoutes(fastify: FastifyInstance): Promise<void> {
    // Register health check endpoint
    await this.registerHealthRoute(fastify);

    // Register service routes
    for (const route of this.routes) {
      await this.registerServiceRoute(fastify, route);
    }

    // Register catch-all route for unmatched paths
    await this.registerCatchAllRoute(fastify);

    logger.info(`Registered ${this.routes.length} service routes`);
  }

  /**
   * Register health check route
   */
  private async registerHealthRoute(fastify: FastifyInstance): Promise<void> {
    fastify.get('/health', async (request, reply) => {
      try {
        const systemHealth = await this.serviceDiscovery.getSystemHealth();
        
        if (systemHealth.status === 'healthy') {
          reply.send(systemHealth);
        } else {
          reply.status(503).send(systemHealth);
        }
      } catch (error: any) {
        logger.error('Health check failed:', error);
        reply.status(503).send({
          status: 'unhealthy',
          error: error.message,
          timestamp: new Date(),
        });
      }
    });
  }

  /**
   * Register a service route with proxy
   */
  private async registerServiceRoute(
    fastify: FastifyInstance,
    route: RouteConfig
  ): Promise<void> {
    const service = this.serviceDiscovery.getService(route.serviceName);
    if (!service) {
      logger.warn(`Service not found for route ${route.path}: ${route.serviceName}`);
      return;
    }

    // Register proxy for this route
    await fastify.register(proxy as any, {
      upstream: service.url,
      prefix: route.path.replace('/*', ''),
      rewritePrefix: service.prefix,
      http2: false,
      preHandler: async (request: AuthenticatedRequest, reply: FastifyReply) => {
        await this.handlePreRequest(request, reply, route);
      },
      replyOptions: {
        onResponse: async (request: AuthenticatedRequest, reply: FastifyReply, res: any) => {
          await this.handlePostResponse(request, reply, res, route);
        },
        onError: async (request: AuthenticatedRequest, reply: FastifyReply, error: any) => {
          await this.handleProxyError(request, reply, error, route);
        },
      },
      httpMethods: route.methods,
    });

    logger.debug(`Registered route: ${route.path} -> ${service.url}${service.prefix}`);
  }

  /**
   * Register catch-all route for unmatched requests
   */
  private async registerCatchAllRoute(fastify: FastifyInstance): Promise<void> {
    fastify.all('*', async (request, reply) => {
      logger.warn(`Route not found: ${request.method} ${request.url}`);
      
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Route not found',
        message: `The requested endpoint ${request.method} ${request.url} does not exist`,
        statusCode: 404,
        timestamp: new Date(),
      };

      reply.status(404).send(errorResponse);
    });
  }

  /**
   * Handle pre-request processing
   */
  private async handlePreRequest(
    request: AuthenticatedRequest,
    reply: FastifyReply,
    route: RouteConfig
  ): Promise<void> {
    const startTime = Date.now();
    
    // Store request start time for metrics
    (request as any).startTime = startTime;

    // Check if service is available
    if (!this.serviceDiscovery.isServiceHealthy(route.serviceName)) {
      const error = `Service ${route.serviceName} is not available`;
      serviceLogger.requestFailed(
        route.serviceName,
        request.method,
        request.url,
        error,
        request.user?.id
      );

      reply.status(503).send({
        success: false,
        error: 'Service Unavailable',
        message: error,
        statusCode: 503,
        service: route.serviceName,
        timestamp: new Date(),
      });
      return;
    }

    // Check circuit breaker
    if (this.circuitBreaker.isOpen(route.serviceName)) {
      const error = `Circuit breaker is open for ${route.serviceName}`;
      serviceLogger.requestFailed(
        route.serviceName,
        request.method,
        request.url,
        error,
        request.user?.id
      );

      reply.status(503).send({
        success: false,
        error: 'Service Circuit Breaker Open',
        message: error,
        statusCode: 503,
        service: route.serviceName,
        timestamp: new Date(),
      });
      return;
    }

    // Authentication check (if required)
    if (route.requireAuth && !request.user) {
      serviceLogger.requestFailed(
        route.serviceName,
        request.method,
        request.url,
        'Authentication required',
        undefined
      );

      reply.status(401).send({
        success: false,
        error: 'Authentication Required',
        message: 'This endpoint requires authentication',
        statusCode: 401,
        timestamp: new Date(),
      });
      return;
    }

    logger.debug(`Proxying request: ${request.method} ${request.url} to ${route.serviceName}`);
  }

  /**
   * Handle post-response processing
   */
  private async handlePostResponse(
    request: AuthenticatedRequest,
    reply: FastifyReply,
    res: any,
    route: RouteConfig
  ): Promise<void> {
    const responseTime = Date.now() - ((request as any).startTime || Date.now());
    const statusCode = res.statusCode || reply.statusCode;

    // Log successful request
    serviceLogger.requestProxied(
      route.serviceName,
      request.method,
      request.url,
      statusCode,
      responseTime,
      request.user?.id
    );

    // Record success with circuit breaker
    this.circuitBreaker.recordSuccess(route.serviceName);

    // Log performance alerts if response time is high
    if (responseTime > 5000) { // 5 seconds
      serviceLogger.performanceAlert(
        'response_time',
        responseTime,
        5000,
        route.serviceName
      );
    }
  }

  /**
   * Handle proxy errors
   */
  private async handleProxyError(
    request: AuthenticatedRequest,
    reply: FastifyReply,
    error: any,
    route: RouteConfig
  ): Promise<void> {
    const responseTime = Date.now() - ((request as any).startTime || Date.now());

    // Log failed request
    serviceLogger.requestFailed(
      route.serviceName,
      request.method,
      request.url,
      error.message,
      request.user?.id
    );

    // Record failure with circuit breaker
    this.circuitBreaker.recordFailure(route.serviceName);

    // Determine appropriate error response
    let statusCode = 500;
    let errorMessage = 'Internal server error';

    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      statusCode = 503;
      errorMessage = 'Service unavailable';
    } else if (error.code === 'ETIMEDOUT') {
      statusCode = 504;
      errorMessage = 'Gateway timeout';
    }

    const errorResponse: ErrorResponse = {
      success: false,
      error: errorMessage,
      message: `Failed to proxy request to ${route.serviceName}: ${error.message}`,
      statusCode,
      service: route.serviceName,
      timestamp: new Date(),
    };

    reply.status(statusCode).send(errorResponse);
  }

  /**
   * Add a new route configuration
   */
  addRoute(route: RouteConfig): void {
    this.routes.push(route);
    logger.info(`Route added: ${route.path} -> ${route.serviceName}`);
  }

  /**
   * Remove a route configuration
   */
  removeRoute(path: string): boolean {
    const initialLength = this.routes.length;
    this.routes = this.routes.filter(r => r.path !== path);
    const removed = this.routes.length < initialLength;
    
    if (removed) {
      logger.info(`Route removed: ${path}`);
    }
    
    return removed;
  }

  /**
   * Get all configured routes
   */
  getRoutes(): RouteConfig[] {
    return [...this.routes];
  }

  /**
   * Find route configuration for a path
   */
  findRoute(path: string): RouteConfig | undefined {
    return this.routes.find(route => {
      const routePath = route.path.replace('/*', '');
      return path.startsWith(routePath);
    });
  }

  /**
   * Update route configuration
   */
  updateRoute(path: string, updates: Partial<RouteConfig>): boolean {
    const routeIndex = this.routes.findIndex(r => r.path === path);
    if (routeIndex === -1) return false;

    this.routes[routeIndex] = { ...this.routes[routeIndex], ...updates } as RouteConfig;
    logger.info(`Route updated: ${path}`);
    return true;
  }

  /**
   * Get gateway statistics
   */
  getStats(): {
    totalRoutes: number;
    servicesRegistered: number;
    healthyServices: number;
    activeCircuitBreakers: number;
  } {
    const services = this.serviceDiscovery.getAllServices();
    const healthyServices = this.serviceDiscovery.getHealthyServices();
    
    return {
      totalRoutes: this.routes.length,
      servicesRegistered: services.length,
      healthyServices: healthyServices.length,
      activeCircuitBreakers: this.circuitBreaker.getOpenCircuits().length,
    };
  }
}