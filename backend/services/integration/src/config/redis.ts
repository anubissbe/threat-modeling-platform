import Redis from 'ioredis';
import { logger } from '../utils/logger';

export let redisClient: Redis;
export let redisSubscriber: Redis;

export async function initializeRedis(): Promise<Redis> {
  const redisConfig: any = {
    host: process.env['REDIS_HOST'] || 'redis',
    port: parseInt(process.env['REDIS_PORT'] || '6379'),
    retryStrategy: (times: number) => {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: false,
  };

  // Only add password if it exists
  if (process.env['REDIS_PASSWORD']) {
    redisConfig.password = process.env['REDIS_PASSWORD'];
  }

  // Create main client
  redisClient = new Redis(redisConfig);
  
  // Create subscriber client
  redisSubscriber = new Redis(redisConfig);

  // Handle connection events
  redisClient.on('connect', () => {
    logger.info('Redis client connected');
  });

  redisClient.on('ready', () => {
    logger.info('Redis client ready');
  });

  redisClient.on('error', (err) => {
    logger.error('Redis client error:', err);
  });

  redisClient.on('close', () => {
    logger.info('Redis client connection closed');
  });

  redisSubscriber.on('connect', () => {
    logger.info('Redis subscriber connected');
  });

  redisSubscriber.on('error', (err) => {
    logger.error('Redis subscriber error:', err);
  });

  // Test connection
  try {
    await redisClient.ping();
    logger.info('Redis connection test successful');
  } catch (error) {
    logger.error('Redis connection test failed:', error);
    throw error;
  }

  return redisClient;
}

// Cache keys
export const CacheKeys = {
  INTEGRATION: (id: string) => `integration:${id}`,
  INTEGRATION_BY_USER: (userId: string) => `integrations:user:${userId}`,
  INTEGRATION_MAPPINGS: (integrationId: string) => `mappings:integration:${integrationId}`,
  WEBHOOK_SECRET: (provider: string, integrationId: string) => `webhook:secret:${provider}:${integrationId}`,
  SYNC_LOCK: (integrationId: string) => `sync:lock:${integrationId}`,
  RATE_LIMIT: (key: string) => `rate_limit:${key}`,
} as const;

// Pub/Sub channels
export const PubSubChannels = {
  INTEGRATION_CREATED: 'integration:created',
  INTEGRATION_UPDATED: 'integration:updated',
  INTEGRATION_DELETED: 'integration:deleted',
  SYNC_STARTED: 'sync:started',
  SYNC_COMPLETED: 'sync:completed',
  SYNC_FAILED: 'sync:failed',
  WEBHOOK_RECEIVED: 'webhook:received',
  WEBHOOK_PROCESSED: 'webhook:processed',
} as const;

// Cache utilities
export async function setCache(key: string, value: any, ttl?: number): Promise<void> {
  try {
    const data = JSON.stringify(value);
    if (ttl) {
      await redisClient.setex(key, ttl, data);
    } else {
      await redisClient.set(key, data);
    }
  } catch (error) {
    logger.error('Cache set error:', { key, error });
    throw error;
  }
}

export async function getCache<T>(key: string): Promise<T | null> {
  try {
    const data = await redisClient.get(key);
    if (!data) return null;
    return JSON.parse(data) as T;
  } catch (error) {
    logger.error('Cache get error:', { key, error });
    return null;
  }
}

export async function deleteCache(key: string | string[]): Promise<void> {
  try {
    if (Array.isArray(key)) {
      await redisClient.del(...key);
    } else {
      await redisClient.del(key);
    }
  } catch (error) {
    logger.error('Cache delete error:', { key, error });
    throw error;
  }
}

export async function invalidateUserIntegrationCache(userId: string): Promise<void> {
  const pattern = `integrations:user:${userId}*`;
  const keys = await redisClient.keys(pattern);
  if (keys.length > 0) {
    await deleteCache(keys);
  }
}