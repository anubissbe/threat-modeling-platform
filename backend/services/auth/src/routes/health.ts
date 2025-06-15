import { Router, Request, Response } from 'express';
import { pool } from '../config/database';
import { logger } from '../utils/logger';

export function createHealthRouter(): Router {
  const router = Router();

  // Basic health check
  router.get('/', (req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      service: 'auth-service',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '0.1.0'
    });
  });

  // Detailed health check with dependencies
  router.get('/detailed', async (req: Request, res: Response) => {
    const health = {
      status: 'healthy',
      service: 'auth-service',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '0.1.0',
      checks: {
        database: 'unknown',
        memory: 'unknown'
      }
    };

    try {
      // Check database connection
      const client = await pool.connect();
      await client.query('SELECT 1');
      client.release();
      health.checks.database = 'healthy';
    } catch (error) {
      health.checks.database = 'unhealthy';
      health.status = 'unhealthy';
      logger.error('Database health check failed:', error);
    }

    // Check memory usage
    const memUsage = process.memoryUsage();
    const memUsageMB = {
      rss: Math.round(memUsage.rss / 1024 / 1024),
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
      external: Math.round(memUsage.external / 1024 / 1024)
    };

    // Consider unhealthy if heap usage is over 512MB
    if (memUsageMB.heapUsed > 512) {
      health.checks.memory = 'unhealthy';
      health.status = 'unhealthy';
    } else {
      health.checks.memory = 'healthy';
    }

    (health as any).memory = memUsageMB;

    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(health);
  });

  // Readiness check (for Kubernetes)
  router.get('/ready', async (req: Request, res: Response) => {
    try {
      // Check if service can handle requests
      const client = await pool.connect();
      await client.query('SELECT 1');
      client.release();
      
      res.json({
        status: 'ready',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Readiness check failed:', error);
      res.status(503).json({
        status: 'not ready',
        timestamp: new Date().toISOString(),
        error: 'Database connection failed'
      });
    }
  });

  // Liveness check (for Kubernetes)
  router.get('/live', (req: Request, res: Response) => {
    res.json({
      status: 'alive',
      timestamp: new Date().toISOString()
    });
  });

  return router;
}