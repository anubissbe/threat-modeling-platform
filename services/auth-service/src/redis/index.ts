import Redis from 'ioredis';
import { getRedisConfig } from '../config';
import { logger } from '../utils/logger';

let redis: Redis;

export async function connectRedis(): Promise<Redis> {
  if (redis) {
    return redis;
  }

  const redisConfig = getRedisConfig();
  
  redis = new Redis(redisConfig);

  // Event handlers
  redis.on('connect', () => {
    logger.info('Redis connection established');
  });

  redis.on('ready', () => {
    logger.info('Redis ready to accept commands');
  });

  redis.on('error', (error) => {
    logger.error('Redis connection error:', error);
  });

  redis.on('close', () => {
    logger.info('Redis connection closed');
  });

  redis.on('reconnecting', () => {
    logger.info('Redis reconnecting...');
  });

  // Test connection
  try {
    await redis.ping();
    logger.info('Redis connected successfully');
    return redis;
  } catch (error) {
    logger.error('Failed to connect to Redis:', error);
    throw error;
  }
}

export async function getRedis(): Promise<Redis> {
  if (!redis) {
    throw new Error('Redis not initialized. Call connectRedis() first.');
  }
  return redis;
}

export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    logger.info('Redis connection closed gracefully');
  }
}

// Session management utilities
export class SessionManager {
  private redis: Redis;
  private keyPrefix: string;

  constructor(redisInstance: Redis, keyPrefix = 'session:') {
    this.redis = redisInstance;
    this.keyPrefix = keyPrefix;
  }

  async create(sessionId: string, data: any, ttlSeconds: number): Promise<void> {
    const key = `${this.keyPrefix}${sessionId}`;
    await this.redis.setex(key, ttlSeconds, JSON.stringify(data));
  }

  async get(sessionId: string): Promise<any | null> {
    const key = `${this.keyPrefix}${sessionId}`;
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  async update(sessionId: string, data: any, ttlSeconds?: number): Promise<void> {
    const key = `${this.keyPrefix}${sessionId}`;
    if (ttlSeconds) {
      await this.redis.setex(key, ttlSeconds, JSON.stringify(data));
    } else {
      await this.redis.set(key, JSON.stringify(data));
    }
  }

  async delete(sessionId: string): Promise<void> {
    const key = `${this.keyPrefix}${sessionId}`;
    await this.redis.del(key);
  }

  async exists(sessionId: string): Promise<boolean> {
    const key = `${this.keyPrefix}${sessionId}`;
    const exists = await this.redis.exists(key);
    return exists === 1;
  }

  async extend(sessionId: string, ttlSeconds: number): Promise<void> {
    const key = `${this.keyPrefix}${sessionId}`;
    await this.redis.expire(key, ttlSeconds);
  }

  async deleteUserSessions(userId: string): Promise<void> {
    const pattern = `${this.keyPrefix}*`;
    const keys = await this.redis.keys(pattern);
    
    for (const key of keys) {
      const sessionData = await this.redis.get(key);
      if (sessionData) {
        const parsed = JSON.parse(sessionData);
        if (parsed.userId === userId) {
          await this.redis.del(key);
        }
      }
    }
  }
}

// Rate limiting utilities
export class RateLimiter {
  private redis: Redis;
  private keyPrefix: string;

  constructor(redisInstance: Redis, keyPrefix = 'rate_limit:') {
    this.redis = redisInstance;
    this.keyPrefix = keyPrefix;
  }

  async isAllowed(
    identifier: string,
    maxRequests: number,
    windowSeconds: number
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const key = `${this.keyPrefix}${identifier}`;
    const now = Date.now();
    const window = windowSeconds * 1000;
    const resetTime = Math.ceil((now + window) / 1000);

    // Use Redis pipeline for atomic operations
    const pipeline = this.redis.pipeline();
    pipeline.zremrangebyscore(key, 0, now - window);
    pipeline.zcard(key);
    pipeline.zadd(key, now, `${now}-${Math.random()}`);
    pipeline.expire(key, windowSeconds);

    const results = await pipeline.exec();
    const currentCount = results?.[1]?.[1] as number || 0;

    const allowed = currentCount < maxRequests;
    const remaining = Math.max(0, maxRequests - currentCount - 1);

    return {
      allowed,
      remaining,
      resetTime,
    };
  }

  async reset(identifier: string): Promise<void> {
    const key = `${this.keyPrefix}${identifier}`;
    await this.redis.del(key);
  }
}

// Token blacklist utilities
export class TokenBlacklist {
  private redis: Redis;
  private keyPrefix: string;

  constructor(redisInstance: Redis, keyPrefix = 'blacklist:') {
    this.redis = redisInstance;
    this.keyPrefix = keyPrefix;
  }

  async add(tokenId: string, expiresAt: Date): Promise<void> {
    const key = `${this.keyPrefix}${tokenId}`;
    const ttl = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
    
    if (ttl > 0) {
      await this.redis.setex(key, ttl, '1');
    }
  }

  async isBlacklisted(tokenId: string): Promise<boolean> {
    const key = `${this.keyPrefix}${tokenId}`;
    const exists = await this.redis.exists(key);
    return exists === 1;
  }

  async remove(tokenId: string): Promise<void> {
    const key = `${this.keyPrefix}${tokenId}`;
    await this.redis.del(key);
  }
}

export { redis };