import Redis from 'ioredis';
import { logger } from '../utils/logger';

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  maxRetriesPerRequest?: number;
  retryDelayOnFailover?: number;
  enableReadyCheck?: boolean;
  lazyConnect?: boolean;
}

class RedisManager {
  private client: Redis;
  private subscriber: Redis;
  private publisher: Redis;
  private isConnected = false;

  constructor(config: RedisConfig) {
    const redisConfig = {
      host: config.host,
      port: config.port,
      ...(config.password && { password: config.password }),
      db: config.db || 0,
      maxRetriesPerRequest: config.maxRetriesPerRequest || 3,
      retryDelayOnFailover: config.retryDelayOnFailover || 100,
      enableReadyCheck: config.enableReadyCheck !== false,
      lazyConnect: config.lazyConnect !== false,
    };

    this.client = new Redis(redisConfig);
    this.subscriber = new Redis(redisConfig);
    this.publisher = new Redis(redisConfig);

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.client.on('connect', () => {
      logger.info('Redis client connected');
      this.isConnected = true;
    });

    this.client.on('error', (error) => {
      logger.error('Redis client error:', error);
      this.isConnected = false;
    });

    this.subscriber.on('connect', () => {
      logger.info('Redis subscriber connected');
    });

    this.subscriber.on('error', (error) => {
      logger.error('Redis subscriber error:', error);
    });

    this.publisher.on('connect', () => {
      logger.info('Redis publisher connected');
    });

    this.publisher.on('error', (error) => {
      logger.error('Redis publisher error:', error);
    });
  }

  async connect(): Promise<void> {
    try {
      await Promise.all([
        this.client.connect(),
        this.subscriber.connect(),
        this.publisher.connect(),
      ]);
      logger.info('All Redis connections established');
    } catch (error) {
      logger.error('Redis connection failed:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await Promise.all([
        this.client.disconnect(),
        this.subscriber.disconnect(),
        this.publisher.disconnect(),
      ]);
      this.isConnected = false;
      logger.info('All Redis connections closed');
    } catch (error) {
      logger.error('Redis disconnection failed:', error);
      throw error;
    }
  }

  getClient(): Redis {
    return this.client;
  }

  getSubscriber(): Redis {
    return this.subscriber;
  }

  getPublisher(): Redis {
    return this.publisher;
  }

  async publish(channel: string, message: string): Promise<number> {
    return this.publisher.publish(channel, message);
  }

  async subscribe(channel: string, callback: (message: string) => void): Promise<void> {
    await this.subscriber.subscribe(channel);
    this.subscriber.on('message', (receivedChannel, message) => {
      if (receivedChannel === channel) {
        callback(message);
      }
    });
  }

  async unsubscribe(channel: string): Promise<void> {
    await this.subscriber.unsubscribe(channel);
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (ttl) {
      await this.client.setex(key, ttl, value);
    } else {
      await this.client.set(key, value);
    }
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async del(key: string): Promise<number> {
    return this.client.del(key);
  }

  async exists(key: string): Promise<number> {
    return this.client.exists(key);
  }

  isHealthy(): boolean {
    return this.isConnected;
  }
}

// Create Redis instance
const config: RedisConfig = {
  host: process.env['REDIS_HOST'] || 'localhost',
  port: parseInt(process.env['REDIS_PORT'] || '6379'),
  ...(process.env['REDIS_PASSWORD'] && { password: process.env['REDIS_PASSWORD'] }),
  db: parseInt(process.env['REDIS_DB'] || '0'),
};

export const redis = new RedisManager(config);

// Auto-connect on import
redis.connect().catch((error) => {
  logger.error('Failed to connect to Redis on startup:', error);
  process.exit(1);
});

export default redis;