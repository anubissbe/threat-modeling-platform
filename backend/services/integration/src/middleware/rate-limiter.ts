import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { redisClient } from '../config/redis';
import { RateLimitError } from './error-handler';

// Redis store for distributed rate limiting
class RedisStore {
  constructor(
    private prefix: string = 'rate_limit'
  ) {}

  async increment(key: string): Promise<{ totalHits: number; resetTime: Date | undefined }> {
    if (!redisClient) {
      throw new Error('Redis client not initialized');
    }
    
    const multi = redisClient.multi();
    const keyWithPrefix = `${this.prefix}:${key}`;
    
    multi.incr(keyWithPrefix);
    multi.expire(keyWithPrefix, 60); // 1 minute window
    
    const results = await multi.exec();
    
    if (!results) {
      throw new Error('Redis operation failed');
    }
    
    const totalHits = results[0]?.[1] as number;
    const ttl = await redisClient.ttl(keyWithPrefix);
    
    return {
      totalHits,
      resetTime: ttl > 0 ? new Date(Date.now() + ttl * 1000) : undefined,
    };
  }

  async decrement(key: string): Promise<void> {
    if (!redisClient) {
      throw new Error('Redis client not initialized');
    }
    
    const keyWithPrefix = `${this.prefix}:${key}`;
    await redisClient.decr(keyWithPrefix);
  }

  async resetKey(key: string): Promise<void> {
    if (!redisClient) {
      throw new Error('Redis client not initialized');
    }
    
    const keyWithPrefix = `${this.prefix}:${key}`;
    await redisClient.del(keyWithPrefix);
  }
}

// Default rate limiter
export const rateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore('default_rate_limit') as any,
  keyGenerator: (req: Request) => {
    // Use user ID if authenticated, otherwise use IP
    return (req as any).user?.id || req.ip || 'anonymous';
  },
  handler: (_req: Request, _res: Response) => {
    throw new RateLimitError('Too many requests, please try again later');
  },
});

// Strict rate limiter for sensitive operations
export const strictRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per 15 minutes
  message: 'Too many attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore('strict_rate_limit') as any,
  keyGenerator: (req: Request) => {
    return (req as any).user?.id || req.ip || 'anonymous';
  },
  handler: (_req: Request, _res: Response) => {
    throw new RateLimitError('Too many attempts, please try again later');
  },
});

// Webhook rate limiter (more lenient for external services)
export const webhookRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 1000, // 1000 requests per minute
  message: 'Too many webhook requests',
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore('webhook_rate_limit') as any,
  keyGenerator: (req: Request) => {
    // Use provider and integration ID from URL
    const provider = req.params['provider'];
    const integrationId = req.params['id'];
    return `webhook:${provider}:${integrationId}`;
  },
  handler: (_req: Request, _res: Response) => {
    throw new RateLimitError('Too many webhook requests');
  },
});

// API rate limiter per integration
export const integrationApiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute per integration
  message: 'Too many API requests for this integration',
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore('integration_api_rate_limit') as any,
  keyGenerator: (req: Request) => {
    const integrationId = req.params['id'];
    const userId = (req as any).user?.id;
    return `api:${userId}:${integrationId}`;
  },
  handler: (_req: Request, _res: Response) => {
    throw new RateLimitError('Too many API requests for this integration');
  },
});

// Create custom rate limiter
export function createRateLimiter(options: {
  windowMs: number;
  max: number;
  keyPrefix: string;
  message?: string;
}) {
  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    message: options.message || 'Too many requests',
    standardHeaders: true,
    legacyHeaders: false,
    store: new RedisStore(`custom_${options.keyPrefix}`) as any,
    keyGenerator: (req: Request) => {
      const userId = (req as any).user?.id || req.ip || 'anonymous';
      return `${options.keyPrefix}:${userId}`;
    },
    handler: (_req: Request, _res: Response) => {
      throw new RateLimitError(options.message || 'Too many requests');
    },
  });
}