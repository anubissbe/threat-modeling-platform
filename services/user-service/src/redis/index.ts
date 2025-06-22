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

// Cache utilities
export class CacheManager {
  private redis: Redis;
  private defaultTTL: number;

  constructor(redisInstance: Redis, defaultTTL = 3600) {
    this.redis = redisInstance;
    this.defaultTTL = defaultTTL;
  }

  async get<T>(key: string): Promise<T | null> {
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const serialized = JSON.stringify(value);
    if (ttl || this.defaultTTL) {
      await this.redis.setex(key, ttl || this.defaultTTL, serialized);
    } else {
      await this.redis.set(key, serialized);
    }
  }

  async delete(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async deletePattern(pattern: string): Promise<void> {
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.redis.exists(key);
    return result === 1;
  }

  async ttl(key: string): Promise<number> {
    return await this.redis.ttl(key);
  }

  async expire(key: string, seconds: number): Promise<void> {
    await this.redis.expire(key, seconds);
  }

  // Invalidate cache for a user
  async invalidateUser(userId: string): Promise<void> {
    await this.deletePattern(`user:${userId}:*`);
  }

  // Invalidate cache for an organization
  async invalidateOrganization(orgId: string): Promise<void> {
    await this.deletePattern(`org:${orgId}:*`);
  }

  // Invalidate cache for a team
  async invalidateTeam(teamId: string): Promise<void> {
    await this.deletePattern(`team:${teamId}:*`);
  }
}

// Lock manager for distributed operations
export class LockManager {
  private redis: Redis;
  private lockPrefix: string;

  constructor(redisInstance: Redis, lockPrefix = 'lock:') {
    this.redis = redisInstance;
    this.lockPrefix = lockPrefix;
  }

  async acquire(
    resource: string,
    ttl: number = 30
  ): Promise<string | null> {
    const lockKey = `${this.lockPrefix}${resource}`;
    const lockValue = `${Date.now()}-${Math.random()}`;

    const result = await this.redis.set(
      lockKey,
      lockValue,
      'EX',
      ttl,
      'NX'
    );

    return result === 'OK' ? lockValue : null;
  }

  async release(resource: string, lockValue: string): Promise<boolean> {
    const lockKey = `${this.lockPrefix}${resource}`;
    
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;

    const result = await this.redis.eval(script, 1, lockKey, lockValue);
    return result === 1;
  }

  async extend(resource: string, lockValue: string, ttl: number): Promise<boolean> {
    const lockKey = `${this.lockPrefix}${resource}`;
    
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("expire", KEYS[1], ARGV[2])
      else
        return 0
      end
    `;

    const result = await this.redis.eval(script, 1, lockKey, lockValue, ttl);
    return result === 1;
  }
}

export { redis };