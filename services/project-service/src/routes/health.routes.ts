import { FastifyInstance } from 'fastify';
import { getDatabase } from '../database';
import { logger } from '../utils/logger';

export async function healthRoutes(fastify: FastifyInstance) {
  // Basic health check
  fastify.get('/health', async (request, reply) => {
    reply.send({
      status: 'ok',
      service: 'project-service',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
    });
  });

  // Detailed health check with dependencies
  fastify.get('/health/detailed', async (request, reply) => {
    const health = {
      status: 'ok',
      service: 'project-service',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      dependencies: {
        database: 'unknown',
      },
      system: {
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        nodeVersion: process.version,
        platform: process.platform,
      },
    };

    // Check database connectivity
    try {
      const db = await getDatabase();
      const result = await db.query('SELECT 1 as test');
      health.dependencies.database = result.rows[0]?.test === 1 ? 'healthy' : 'unhealthy';
    } catch (error: any) {
      health.dependencies.database = 'unhealthy';
      health.status = 'degraded';
      logger.error('Database health check failed:', error);
    }

    const statusCode = health.status === 'ok' ? 200 : 503;
    reply.code(statusCode).send(health);
  });

  // Readiness probe
  fastify.get('/ready', async (request, reply) => {
    try {
      // Check if all critical dependencies are available
      const db = await getDatabase();
      await db.query('SELECT 1');
      
      reply.send({ status: 'ready' });
    } catch (error: any) {
      logger.error('Readiness check failed:', error);
      reply.code(503).send({ 
        status: 'not ready',
        error: error.message 
      });
    }
  });

  // Liveness probe
  fastify.get('/live', async (request, reply) => {
    // Simple liveness check - if the server can respond, it's alive
    reply.send({ status: 'alive' });
  });
}