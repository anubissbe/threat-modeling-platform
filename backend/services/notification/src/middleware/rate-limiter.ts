import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { redis } from '../config/redis';
import { logger } from '../utils/logger';
import { ApiResponse, AuthenticatedRequest } from '../types';

// Create rate limiter with Redis store
const createRateLimiter = (options: {
  windowMs: number;
  max: number;
  message: string;
  keyGenerator?: (req: Request) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}) => {
  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    message: {
      success: false,
      message: options.message,
      errors: [{ field: 'rate_limit', message: options.message }],
    } as ApiResponse,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: options.keyGenerator || ((req: Request) => {
      const authReq = req as AuthenticatedRequest;
      return authReq.user?.id || req.ip;
    }),
    skipSuccessfulRequests: options.skipSuccessfulRequests || false,
    skipFailedRequests: options.skipFailedRequests || false,
    handler: (req: Request, res: Response) => {
      logger.warn('Rate limit exceeded', {
        ip: req.ip,
        userId: (req as AuthenticatedRequest).user?.id,
        endpoint: req.path,
        method: req.method,
      });

      res.status(429).json({
        success: false,
        message: options.message,
        errors: [{ field: 'rate_limit', message: options.message }],
      } as ApiResponse);
    },
    store: redis.isHealthy() ? new RedisRateLimitStore() : undefined,
  });
};

// Custom Redis rate limit store
class RedisRateLimitStore {
  private prefix = 'rate_limit:';

  async increment(key: string): Promise<{ totalHits: number; totalHitsBeforeReset: number; remainingHits?: number; totalMillisecondsBeforeReset?: number }> {
    try {
      const redisKey = this.prefix + key;
      const current = await redis.getClient().incr(redisKey);
      
      if (current === 1) {
        // First request in window, set expiration
        await redis.getClient().expire(redisKey, 60); // 60 seconds default
      }

      const ttl = await redis.getClient().ttl(redisKey);
      
      return {
        totalHits: current,
        totalHitsBeforeReset: current,
        remainingHits: Math.max(0, 100 - current), // Default limit of 100
        totalMillisecondsBeforeReset: ttl * 1000,
      };
    } catch (error) {
      logger.error('Redis rate limit store error:', error);
      // Fallback to memory store behavior
      return { totalHits: 1, totalHitsBeforeReset: 1 };
    }
  }

  async decrement(key: string): Promise<void> {
    try {
      const redisKey = this.prefix + key;
      await redis.getClient().decr(redisKey);
    } catch (error) {
      logger.error('Redis rate limit store decrement error:', error);
    }
  }

  async resetKey(key: string): Promise<void> {
    try {
      const redisKey = this.prefix + key;
      await redis.getClient().del(redisKey);
    } catch (error) {
      logger.error('Redis rate limit store reset error:', error);
    }
  }
}

// General rate limiter for all notification endpoints
export const rateLimitMiddleware = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window per user/IP
  message: 'Too many requests, please try again later',
});

// Strict rate limiter for sending notifications
export const sendNotificationRateLimit = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 notifications per minute per user
  message: 'Too many notification requests, please slow down',
  keyGenerator: (req: Request) => {
    const authReq = req as AuthenticatedRequest;
    return `send:${authReq.user?.id || req.ip}`;
  },
});

// Rate limiter for bulk operations
export const bulkOperationRateLimit = createRateLimiter({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 3, // 3 bulk operations per 10 minutes
  message: 'Bulk operation rate limit exceeded',
  keyGenerator: (req: Request) => {
    const authReq = req as AuthenticatedRequest;
    return `bulk:${authReq.user?.id || req.ip}`;
  },
});

// Rate limiter for template operations
export const templateOperationRateLimit = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 template operations per minute
  message: 'Template operation rate limit exceeded',
  keyGenerator: (req: Request) => {
    const authReq = req as AuthenticatedRequest;
    return `template:${authReq.user?.id || req.ip}`;
  },
});

// Rate limiter for webhook endpoints (external services)
export const webhookRateLimit = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 webhook calls per minute per source
  message: 'Webhook rate limit exceeded',
  keyGenerator: (req: Request) => {
    // Use source IP for webhooks since they're external
    return `webhook:${req.ip}`;
  },
});

// Rate limiter for health check endpoints
export const healthCheckRateLimit = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 health checks per minute per source
  message: 'Health check rate limit exceeded',
  skipSuccessfulRequests: true,
});

// Rate limiter for authentication endpoints
export const authRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 login attempts per 15 minutes per IP
  message: 'Too many authentication attempts, please try again later',
  keyGenerator: (req: Request) => `auth:${req.ip}`,
  skipSuccessfulRequests: true,
});

// Dynamic rate limiter based on user role
export const dynamicRateLimit = (req: Request, res: Response, next: Function) => {
  const authReq = req as AuthenticatedRequest;
  const userRole = authReq.user?.role || 'guest';

  // Different limits based on user role
  const roleLimits = {
    admin: { windowMs: 60 * 1000, max: 200 },
    manager: { windowMs: 60 * 1000, max: 100 },
    user: { windowMs: 60 * 1000, max: 50 },
    guest: { windowMs: 60 * 1000, max: 20 },
  };

  const limits = roleLimits[userRole] || roleLimits.guest;

  const dynamicLimiter = createRateLimiter({
    windowMs: limits.windowMs,
    max: limits.max,
    message: `Rate limit exceeded for ${userRole} role`,
    keyGenerator: (req: Request) => {
      const authReq = req as AuthenticatedRequest;
      return `dynamic:${userRole}:${authReq.user?.id || req.ip}`;
    },
  });

  dynamicLimiter(req, res, next);
};

// Progressive rate limiter (increases restrictions on repeated violations)
export const progressiveRateLimit = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  message: 'Progressive rate limit exceeded',
  keyGenerator: (req: Request) => {
    const authReq = req as AuthenticatedRequest;
    return `progressive:${authReq.user?.id || req.ip}`;
  },
});

// Rate limiter for specific notification types
export const notificationTypeRateLimit = (type: string, limits: { windowMs: number; max: number }) => {
  return createRateLimiter({
    windowMs: limits.windowMs,
    max: limits.max,
    message: `Rate limit exceeded for ${type} notifications`,
    keyGenerator: (req: Request) => {
      const authReq = req as AuthenticatedRequest;
      return `${type}:${authReq.user?.id || req.ip}`;
    },
  });
};

// Email-specific rate limiter
export const emailRateLimit = notificationTypeRateLimit('email', {
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 emails per minute
});

// SMS-specific rate limiter (more restrictive due to cost)
export const smsRateLimit = notificationTypeRateLimit('sms', {
  windowMs: 60 * 1000, // 1 minute
  max: 2, // 2 SMS per minute
});

// Slack-specific rate limiter
export const slackRateLimit = notificationTypeRateLimit('slack', {
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 Slack messages per minute
});

// Global rate limiter bypass for emergency notifications
export const emergencyBypass = (req: Request, res: Response, next: Function) => {
  const authReq = req as AuthenticatedRequest;
  
  // Check if this is an emergency notification
  if (req.body.priority === 'urgent' && req.body.metadata?.emergency === true) {
    // Check if user has permission to send emergency notifications
    if (authReq.user?.role === 'admin' || authReq.user?.role === 'manager') {
      logger.info('Emergency notification bypass granted', {
        userId: authReq.user.id,
        role: authReq.user.role,
      });
      return next();
    }
  }

  // Apply normal rate limiting
  rateLimitMiddleware(req, res, next);
};

// Rate limit monitoring and alerts
export const monitorRateLimit = async (key: string, current: number, limit: number) => {
  try {
    const threshold = limit * 0.8; // Alert at 80% of limit
    
    if (current >= threshold) {
      logger.warn('Rate limit threshold reached', {
        key,
        current,
        limit,
        threshold,
        percentage: (current / limit) * 100,
      });

      // Could trigger alert to monitoring system here
      // await alertingService.sendAlert('rate_limit_threshold', { key, current, limit });
    }

    // Store metrics for analysis
    await redis.getClient().zadd(
      'rate_limit_metrics',
      Date.now(),
      JSON.stringify({ key, current, limit, timestamp: Date.now() })
    );

    // Keep only last 24 hours of metrics
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    await redis.getClient().zremrangebyscore('rate_limit_metrics', 0, oneDayAgo);
  } catch (error) {
    logger.error('Rate limit monitoring error:', error);
  }
};

// Get rate limit statistics
export const getRateLimitStats = async (key: string): Promise<any> => {
  try {
    const redisKey = `rate_limit:${key}`;
    const current = await redis.getClient().get(redisKey);
    const ttl = await redis.getClient().ttl(redisKey);

    return {
      current: parseInt(current || '0'),
      remaining: Math.max(0, 100 - parseInt(current || '0')),
      resetIn: ttl,
    };
  } catch (error) {
    logger.error('Error getting rate limit stats:', error);
    return { current: 0, remaining: 100, resetIn: 60 };
  }
};

export default rateLimitMiddleware;