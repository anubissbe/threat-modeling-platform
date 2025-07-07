import { Request, Response, NextFunction } from 'express';
import { RedisClientType } from 'redis';
import { logger } from '../utils/logger';

// Rate limit store using Redis
class RedisRateLimitStore {
  constructor(private redis: RedisClientType) {}

  async increment(key: string, windowMs: number): Promise<{ totalHits: number; resetTime: Date }> {
    const multi = this.redis.multi();
    const now = Date.now();
    const resetTime = new Date(now + windowMs);

    // Use Redis pipeline for atomic operations
    multi.incr(key);
    multi.expire(key, Math.ceil(windowMs / 1000));
    
    const results = await multi.exec();
    const totalHits = results?.[0] as number || 1;

    return { totalHits, resetTime };
  }

  async get(key: string): Promise<number> {
    const value = await this.redis.get(key);
    return value ? parseInt(value, 10) : 0;
  }

  async reset(key: string): Promise<void> {
    await this.redis.del(key);
  }
}

interface RateLimitOptions {
  windowMs?: number;
  max?: number;
  keyGenerator?: (req: Request) => string;
  onLimitReached?: (req: Request, res: Response) => void;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

/**
 * Rate limiting middleware factory
 * Creates rate limiting middleware with specified limits
 */
export const rateLimitMiddleware = (
  maxRequests: number = 100,
  windowMinutes: number = 15,
  options: RateLimitOptions = {}
) => {
  const windowMs = (options.windowMs || windowMinutes * 60) * 1000;
  const max = options.max || maxRequests;
  
  // Default key generator uses user ID if authenticated, otherwise IP
  const defaultKeyGenerator = (req: Request): string => {
    const userId = req.user?.id;
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    return userId ? `rate_limit:user:${userId}` : `rate_limit:ip:${ip}`;
  };

  const keyGenerator = options.keyGenerator || defaultKeyGenerator;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Get Redis instance from app or create a new one
      const redis = (req.app.locals['redis'] as RedisClientType) || global.redisClient;
      
      if (!redis) {
        logger.warn('Redis not available for rate limiting, skipping...');
        return next();
      }

      const store = new RedisRateLimitStore(redis);
      const key = keyGenerator(req);
      
      // Get current count and increment
      const { totalHits, resetTime } = await store.increment(key, windowMs);

      // Set rate limit headers
      res.set({
        'X-RateLimit-Limit': max.toString(),
        'X-RateLimit-Remaining': Math.max(0, max - totalHits).toString(),
        'X-RateLimit-Reset': resetTime.toISOString(),
        'X-RateLimit-Used': totalHits.toString()
      });

      // Check if limit exceeded
      if (totalHits > max) {
        logger.warn(`Rate limit exceeded for key: ${key}, hits: ${totalHits}, limit: ${max}`);
        
        // Call custom limit reached handler if provided
        if (options.onLimitReached) {
          options.onLimitReached(req, res);
          return;
        }

        // Default rate limit response
        res.status(429).json({
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests, please try again later',
            details: {
              limit: max,
              window_ms: windowMs,
              reset_time: resetTime.toISOString()
            }
          }
        });
        return;
      }

      next();
    } catch (error) {
      logger.error('Rate limiting error:', error);
      // Don't block requests if rate limiting fails
      next();
    }
  };
};

/**
 * AI-specific rate limits for different endpoints
 */
export const aiAnalysisRateLimit = rateLimitMiddleware(10, 60, {
  keyGenerator: (req: Request) => {
    // More restrictive for AI analysis due to computational cost
    const userId = req.user?.id || 'anonymous';
    return `ai_analysis:${userId}`;
  },
  onLimitReached: (req, _res) => {
    logger.warn(`AI analysis rate limit reached for user: ${req.user?.id}`);
  }
});

export const aiMetricsRateLimit = rateLimitMiddleware(30, 60, {
  keyGenerator: (req: Request) => {
    // Separate limit for metrics endpoints
    const userId = req.user?.id || 'anonymous';
    return `ai_metrics:${userId}`;
  }
});

export const threatIntelUpdateRateLimit = rateLimitMiddleware(5, 300, {
  keyGenerator: (req: Request) => {
    // Very restrictive for threat intel updates (5 per 5 minutes)
    const userId = req.user?.id || 'anonymous';
    return `threat_intel_update:${userId}`;
  }
});

/**
 * Adaptive rate limiting based on user tier/subscription
 */
export const adaptiveRateLimit = (
  baseLimits: { requests: number; windowMinutes: number }
) => {
  return rateLimitMiddleware(baseLimits.requests, baseLimits.windowMinutes, {
    keyGenerator: (req: Request) => {
      const userId = req.user?.id || 'anonymous';
      const userTier = req.user?.roles?.includes('premium') ? 'premium' : 'basic';
      return `adaptive_limit:${userTier}:${userId}`;
    },
    // TODO: Fix adaptive rate limiting implementation
    // max: baseLimits.requests
  });
};

/**
 * Global rate limit for the entire AI service
 */
export const globalRateLimit = rateLimitMiddleware(1000, 60, {
  keyGenerator: () => 'global_ai_service',
  onLimitReached: (req, res) => {
    logger.error('Global AI service rate limit exceeded');
    res.status(503).json({
      success: false,
      error: {
        code: 'SERVICE_OVERLOADED',
        message: 'Service temporarily overloaded, please try again later'
      }
    });
  }
});

/**
 * Rate limit bypass for internal service calls
 */
export const internalServiceBypass = (req: Request, res: Response, next: NextFunction): void => {
  // Check for internal service header
  const internalToken = req.headers['x-internal-service-token'];
  const expectedToken = process.env.INTERNAL_SERVICE_TOKEN;
  
  if (internalToken && expectedToken && internalToken === expectedToken) {
    // Skip rate limiting for internal services
    req.isInternalService = true;
    next();
    return;
  }
  
  next();
};

// Extend Request interface for internal service flag
declare global {
  namespace Express {
    interface Request {
      isInternalService?: boolean;
    }
  }
}

/**
 * Rate limit status endpoint for monitoring
 */
export const getRateLimitStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const redis = (req.app.locals['redis'] as RedisClientType) || global.redisClient;
    
    if (!redis) {
      res.status(503).json({
        success: false,
        error: {
          code: 'REDIS_UNAVAILABLE',
          message: 'Rate limit status unavailable'
        }
      });
      return;
    }

    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'User authentication required'
        }
      });
      return;
    }

    // Get current rate limit status for different endpoints
    const keys = [
      `ai_analysis:${userId}`,
      `ai_metrics:${userId}`,
      `rate_limit:user:${userId}`
    ];

    const values = await Promise.all(
      keys.map(key => redis.get(key).then(val => val ? parseInt(val) : 0))
    );

    const status = {
      ai_analysis: { used: values[0], limit: 10, window: '1 hour' },
      ai_metrics: { used: values[1], limit: 30, window: '1 hour' },
      general: { used: values[2], limit: 100, window: '15 minutes' }
    };

    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    logger.error('Error getting rate limit status:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'STATUS_ERROR',
        message: 'Error retrieving rate limit status'
      }
    });
  }
};