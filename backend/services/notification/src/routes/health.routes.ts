import { Router, Request, Response } from 'express';
import { database } from '../config/database';
import { redis } from '../config/redis';
import { logger } from '../utils/logger';
import { HealthStatus, ApiResponse } from '../types';

const router = Router();

/**
 * @route GET /health
 * @desc Health check endpoint
 * @access Public
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const healthStatus: HealthStatus = {
      status: 'healthy',
      timestamp: new Date(),
      details: {
        database: false,
        redis: false,
        providers: {
          email: false,
          slack: false,
          teams: false,
          sms: false,
          webhook: false,
          push: false,
        },
      },
    };

    // Check database connection
    try {
      await database.query('SELECT 1');
      healthStatus.details.database = true;
    } catch (error) {
      logger.error('Database health check failed:', error);
      healthStatus.status = 'unhealthy';
    }

    // Check Redis connection
    try {
      await redis.getClient().ping();
      healthStatus.details.redis = true;
    } catch (error) {
      logger.error('Redis health check failed:', error);
      healthStatus.status = 'unhealthy';
    }

    // Check notification providers
    try {
      // Email provider check
      if (process.env['SMTP_HOST'] && process.env['SMTP_USER']) {
        healthStatus.details.providers.email = true;
      }

      // Slack provider check
      if (process.env['SLACK_BOT_TOKEN']) {
        healthStatus.details.providers.slack = true;
      }

      // Teams provider check
      if (process.env['TEAMS_WEBHOOK_URL']) {
        healthStatus.details.providers.teams = true;
      }

      // SMS provider check
      if (process.env['TWILIO_ACCOUNT_SID'] && process.env['TWILIO_AUTH_TOKEN']) {
        healthStatus.details.providers.sms = true;
      }

      // Webhook provider check
      healthStatus.details.providers.webhook = true; // Always available

      // Push notifications
      healthStatus.details.providers.push = false; // Not implemented yet
    } catch (error) {
      logger.error('Provider health check failed:', error);
    }

    // Determine overall status
    if (!healthStatus.details.database || !healthStatus.details.redis) {
      healthStatus.status = 'unhealthy';
    } else if (Object.values(healthStatus.details.providers).filter(Boolean).length === 0) {
      healthStatus.status = 'degraded';
    }

    const response: ApiResponse<HealthStatus> = {
      success: healthStatus.status !== 'unhealthy',
      data: healthStatus,
    };

    const statusCode = healthStatus.status === 'unhealthy' ? 503 : 200;
    res.status(statusCode).json(response);
  } catch (error) {
    logger.error('Health check failed:', error);
    
    const response: ApiResponse = {
      success: false,
      message: 'Health check failed',
      errors: [{ field: 'general', message: (error as Error).message }],
    };

    res.status(503).json(response);
  }
});

/**
 * @route GET /health/detailed
 * @desc Detailed health check with metrics
 * @access Public
 */
router.get('/detailed', async (req: Request, res: Response) => {
  try {
    const startTime = Date.now();

    // Basic health check
    const basicHealth = await checkBasicHealth();
    
    // Get metrics
    const metrics = await getMetrics();
    
    // Get provider status
    const providerStatus = await checkProviderStatus();

    const responseTime = Date.now() - startTime;

    const detailedHealth = {
      ...basicHealth,
      metrics,
      providers: providerStatus,
      responseTime,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.env.npm_package_version || '1.0.0',
    };

    const response: ApiResponse = {
      success: basicHealth.status !== 'unhealthy',
      data: detailedHealth,
    };

    const statusCode = basicHealth.status === 'unhealthy' ? 503 : 200;
    res.status(statusCode).json(response);
  } catch (error) {
    logger.error('Detailed health check failed:', error);
    
    const response: ApiResponse = {
      success: false,
      message: 'Detailed health check failed',
      errors: [{ field: 'general', message: (error as Error).message }],
    };

    res.status(503).json(response);
  }
});

/**
 * @route GET /health/ready
 * @desc Readiness check for Kubernetes
 * @access Public
 */
router.get('/ready', async (req: Request, res: Response) => {
  try {
    // Check if service is ready to handle requests
    await database.query('SELECT 1');
    await redis.getClient().ping();

    res.status(200).json({ ready: true });
  } catch (error) {
    logger.error('Readiness check failed:', error);
    res.status(503).json({ ready: false, error: (error as Error).message });
  }
});

/**
 * @route GET /health/live
 * @desc Liveness check for Kubernetes
 * @access Public
 */
router.get('/live', (req: Request, res: Response) => {
  // Simple liveness check - just respond if the service is running
  res.status(200).json({ alive: true });
});

async function checkBasicHealth(): Promise<HealthStatus> {
  const healthStatus: HealthStatus = {
    status: 'healthy',
    timestamp: new Date(),
    details: {
      database: false,
      redis: false,
      providers: {
        email: false,
        slack: false,
        teams: false,
        sms: false,
        webhook: false,
        push: false,
      },
    },
  };

  // Check database
  try {
    await database.query('SELECT 1');
    healthStatus.details.database = true;
  } catch (error) {
    healthStatus.status = 'unhealthy';
  }

  // Check Redis
  try {
    await redis.getClient().ping();
    healthStatus.details.redis = true;
  } catch (error) {
    healthStatus.status = 'unhealthy';
  }

  return healthStatus;
}

async function getMetrics(): Promise<any> {
  try {
    // Get notification metrics from database
    const notificationStats = await database.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
        COUNT(CASE WHEN created_at > NOW() - INTERVAL '24 hours' THEN 1 END) as last_24h
      FROM notifications
    `);

    const typeStats = await database.query(`
      SELECT type, COUNT(*) as count
      FROM notifications
      WHERE created_at > NOW() - INTERVAL '24 hours'
      GROUP BY type
    `);

    return {
      notifications: notificationStats.rows[0],
      byType: typeStats.rows.reduce((acc, row) => {
        acc[row.type] = parseInt(row.count);
        return acc;
      }, {}),
    };
  } catch (error) {
    logger.error('Failed to get metrics:', error);
    return {};
  }
}

async function checkProviderStatus(): Promise<any> {
  const providerStatus = {
    email: {
      configured: !!(process.env['SMTP_HOST'] && process.env['SMTP_USER']),
      available: false,
    },
    slack: {
      configured: !!process.env['SLACK_BOT_TOKEN'],
      available: false,
    },
    teams: {
      configured: !!process.env['TEAMS_WEBHOOK_URL'],
      available: false,
    },
    sms: {
      configured: !!(process.env['TWILIO_ACCOUNT_SID'] && process.env['TWILIO_AUTH_TOKEN']),
      available: false,
    },
    webhook: {
      configured: true,
      available: true,
    },
  };

  // Test provider availability (simplified checks)
  try {
    // Email
    if (providerStatus.email.configured) {
      providerStatus.email.available = true; // Assume available if configured
    }

    // Slack
    if (providerStatus.slack.configured) {
      providerStatus.slack.available = true; // Would need to test API call
    }

    // Teams
    if (providerStatus.teams.configured) {
      providerStatus.teams.available = true; // Would need to test webhook
    }

    // SMS
    if (providerStatus.sms.configured) {
      providerStatus.sms.available = true; // Would need to test Twilio API
    }
  } catch (error) {
    logger.error('Provider status check failed:', error);
  }

  return providerStatus;
}

export default router;