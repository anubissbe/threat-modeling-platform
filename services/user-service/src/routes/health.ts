import { FastifyPluginAsync } from 'fastify';
import { getDatabase } from '../database';
import { getRedis } from '../redis';
import { config } from '../config';
import { logger } from '../utils/logger';

interface HealthResponse {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  checks: {
    database: HealthCheck;
    redis: HealthCheck;
    memory: HealthCheck;
    authService: HealthCheck;
  };
}

interface HealthCheck {
  status: 'healthy' | 'unhealthy';
  message?: string;
  responseTime?: number;
  details?: any;
}

const healthRoutes: FastifyPluginAsync = async (fastify) => {
  // Health check endpoint
  fastify.get('/status', {
    schema: {
      tags: ['Health'],
      summary: 'Get service health status',
      description: 'Returns the current health status of the user service and its dependencies',
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['healthy', 'unhealthy', 'degraded'] },
            timestamp: { type: 'string', format: 'date-time' },
            uptime: { type: 'number' },
            version: { type: 'string' },
            environment: { type: 'string' },
            checks: {
              type: 'object',
              properties: {
                database: { $ref: '#/components/schemas/HealthCheck' },
                redis: { $ref: '#/components/schemas/HealthCheck' },
                memory: { $ref: '#/components/schemas/HealthCheck' },
                authService: { $ref: '#/components/schemas/HealthCheck' },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    const startTime = Date.now();
    
    try {
      // Perform health checks in parallel
      const [databaseCheck, redisCheck, memoryCheck, authServiceCheck] = await Promise.allSettled([
        checkDatabase(),
        checkRedis(),
        checkMemory(),
        checkAuthService(),
      ]);

      const checks = {
        database: getCheckResult(databaseCheck),
        redis: getCheckResult(redisCheck),
        memory: getCheckResult(memoryCheck),
        authService: getCheckResult(authServiceCheck),
      };

      // Determine overall status
      const unhealthyChecks = Object.values(checks).filter(check => check.status === 'unhealthy');
      const overallStatus = unhealthyChecks.length === 0 
        ? 'healthy' 
        : unhealthyChecks.length === Object.keys(checks).length 
          ? 'unhealthy' 
          : 'degraded';

      const response: HealthResponse = {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: config.SERVICE_VERSION,
        environment: config.NODE_ENV,
        checks,
      };

      const statusCode = overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 207 : 503;
      
      // Log health check results
      logger.info('Health check completed', {
        status: overallStatus,
        responseTime: Date.now() - startTime,
        checks: Object.fromEntries(
          Object.entries(checks).map(([key, value]) => [key, value.status])
        ),
      });

      return reply.status(statusCode).send(response);
    } catch (error) {
      logger.error('Health check failed:', error);
      
      return reply.status(503).send({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: config.SERVICE_VERSION,
        environment: config.NODE_ENV,
        error: 'Health check failed',
        message: error.message,
      });
    }
  });

  // Readiness probe endpoint
  fastify.get('/ready', {
    schema: {
      tags: ['Health'],
      summary: 'Readiness probe',
      description: 'Returns 200 when service is ready to accept requests',
      response: {
        200: {
          type: 'object',
          properties: {
            ready: { type: 'boolean' },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
        503: {
          type: 'object',
          properties: {
            ready: { type: 'boolean' },
            timestamp: { type: 'string', format: 'date-time' },
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      // Check critical dependencies
      await Promise.all([
        checkDatabase(),
        checkRedis(),
      ]);

      return reply.send({
        ready: true,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Readiness check failed:', error);
      
      return reply.status(503).send({
        ready: false,
        timestamp: new Date().toISOString(),
        error: error.message,
      });
    }
  });

  // Liveness probe endpoint
  fastify.get('/live', {
    schema: {
      tags: ['Health'],
      summary: 'Liveness probe',
      description: 'Returns 200 when service is alive and responding',
      response: {
        200: {
          type: 'object',
          properties: {
            alive: { type: 'boolean' },
            timestamp: { type: 'string', format: 'date-time' },
            uptime: { type: 'number' },
          },
        },
      },
    },
  }, async (request, reply) => {
    return reply.send({
      alive: true,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  // Metrics endpoint (basic)
  fastify.get('/metrics', {
    schema: {
      tags: ['Health'],
      summary: 'Basic metrics',
      description: 'Returns basic service metrics',
      response: {
        200: {
          type: 'object',
          properties: {
            timestamp: { type: 'string', format: 'date-time' },
            uptime: { type: 'number' },
            memory: { type: 'object' },
            cpu: { type: 'object' },
            process: { type: 'object' },
          },
        },
      },
    },
  }, async (request, reply) => {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    return reply.send({
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: {
        rss: memoryUsage.rss,
        heapTotal: memoryUsage.heapTotal,
        heapUsed: memoryUsage.heapUsed,
        external: memoryUsage.external,
        arrayBuffers: memoryUsage.arrayBuffers,
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system,
      },
      process: {
        pid: process.pid,
        version: process.version,
        platform: process.platform,
        arch: process.arch,
      },
    });
  });
};

// Helper functions for health checks
async function checkDatabase(): Promise<HealthCheck> {
  const startTime = Date.now();
  
  try {
    const db = await getDatabase();
    const result = await db.query('SELECT 1 as healthy');
    
    return {
      status: 'healthy',
      responseTime: Date.now() - startTime,
      details: {
        connected: true,
        totalConnections: db.totalCount,
        idleConnections: db.idleCount,
        waitingClients: db.waitingCount,
      },
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: error.message,
      responseTime: Date.now() - startTime,
    };
  }
}

async function checkRedis(): Promise<HealthCheck> {
  const startTime = Date.now();
  
  try {
    const redis = await getRedis();
    await redis.ping();
    
    return {
      status: 'healthy',
      responseTime: Date.now() - startTime,
      details: {
        connected: true,
        status: redis.status,
      },
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: error.message,
      responseTime: Date.now() - startTime,
    };
  }
}

async function checkMemory(): Promise<HealthCheck> {
  const memoryUsage = process.memoryUsage();
  const totalMemory = memoryUsage.heapTotal;
  const usedMemory = memoryUsage.heapUsed;
  const memoryUsagePercentage = (usedMemory / totalMemory) * 100;
  
  const isHealthy = memoryUsagePercentage < 85; // Consider unhealthy if > 85% memory usage
  
  return {
    status: isHealthy ? 'healthy' : 'unhealthy',
    message: isHealthy ? undefined : 'High memory usage detected',
    details: {
      heapUsed: usedMemory,
      heapTotal: totalMemory,
      usagePercentage: memoryUsagePercentage,
      rss: memoryUsage.rss,
      external: memoryUsage.external,
    },
  };
}

async function checkAuthService(): Promise<HealthCheck> {
  const startTime = Date.now();
  
  try {
    // Check auth service health endpoint
    const response = await fetch(`${config.AUTH_SERVICE_URL}/health/live`, {
      method: 'GET',
      headers: {
        'X-API-Key': config.API_KEY,
      },
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });

    const isHealthy = response.ok;
    
    return {
      status: isHealthy ? 'healthy' : 'unhealthy',
      responseTime: Date.now() - startTime,
      details: {
        statusCode: response.status,
      },
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: 'Auth service unreachable',
      responseTime: Date.now() - startTime,
    };
  }
}

function getCheckResult(settledResult: PromiseSettledResult<HealthCheck>): HealthCheck {
  if (settledResult.status === 'fulfilled') {
    return settledResult.value;
  } else {
    return {
      status: 'unhealthy',
      message: settledResult.reason?.message || 'Check failed',
    };
  }
}

export { healthRoutes };