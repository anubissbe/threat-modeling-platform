import { Router, Request, Response } from 'express';
import { pool } from '../config/database';
import { redisClient } from '../config/redis';
import { logger } from '../utils/logger';

export function createHealthRouter(): Router {
  const router = Router();

  router.get('/', async (_req: Request, res: Response) => {
    try {
      const health = {
        status: 'healthy',
        service: 'integration-service',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        checks: {
          database: 'unknown',
          redis: 'unknown',
        },
      };

      // Check database
      try {
        const client = await pool.connect();
        await client.query('SELECT 1');
        client.release();
        health.checks.database = 'healthy';
      } catch (error) {
        health.checks.database = 'unhealthy';
        health.status = 'degraded';
        logger.error('Database health check failed:', error);
      }

      // Check Redis
      try {
        await redisClient.ping();
        health.checks.redis = 'healthy';
      } catch (error) {
        health.checks.redis = 'unhealthy';
        health.status = 'degraded';
        logger.error('Redis health check failed:', error);
      }

      const statusCode = health.status === 'healthy' ? 200 : 503;
      res.status(statusCode).json(health);
    } catch (error) {
      logger.error('Health check error:', error);
      res.status(503).json({
        status: 'unhealthy',
        service: 'integration-service',
        timestamp: new Date().toISOString(),
        error: 'Health check failed',
      });
    }
  });

  router.get('/ready', async (_req: Request, res: Response) => {
    try {
      // Check if all dependencies are ready
      const dbReady = await checkDatabaseReady();
      const redisReady = await checkRedisReady();

      if (dbReady && redisReady) {
        res.status(200).json({ ready: true });
      } else {
        res.status(503).json({ 
          ready: false,
          details: {
            database: dbReady,
            redis: redisReady,
          }
        });
      }
    } catch (error) {
      logger.error('Readiness check error:', error);
      res.status(503).json({ ready: false, error: 'Readiness check failed' });
    }
  });

  router.get('/live', (_req: Request, res: Response) => {
    res.status(200).json({ alive: true });
  });

  return router;
}

async function checkDatabaseReady(): Promise<boolean> {
  try {
    const client = await pool.connect();
    // Check if our tables exist
    const result = await client.query(`
      SELECT COUNT(*) FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('integrations', 'integration_mappings', 'integration_logs', 'webhook_events')
    `);
    client.release();
    
    return parseInt(result.rows[0].count) === 4;
  } catch (error) {
    logger.error('Database readiness check failed:', error);
    return false;
  }
}

async function checkRedisReady(): Promise<boolean> {
  try {
    const pong = await redisClient.ping();
    return pong === 'PONG';
  } catch (error) {
    logger.error('Redis readiness check failed:', error);
    return false;
  }
}