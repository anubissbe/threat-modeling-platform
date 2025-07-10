import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import Redis from 'ioredis';
import { logger } from '../utils/logger';
import {
  CacheConfig,
  CacheStats,
  CacheEntry
} from '../types/infrastructure';

export class CacheService extends EventEmitter {
  private config: CacheConfig;
  private redisClient: Redis | null = null;
  private memoryCache: Map<string, CacheEntry> = new Map();
  private stats: CacheStats;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(config: CacheConfig) {
    super();
    this.config = config;
    this.stats = this.initializeStats();
    this.initializeRedis();
    this.startCleanupTimer();
    
    logger.info('Cache service initialized', {
      redis: config.redis.enabled,
      memory: config.memory.enabled,
      distributed: config.distributed.enabled
    });
  }

  /**
   * Initialize cache statistics
   */
  private initializeStats(): CacheStats {
    return {
      hits: 0,
      misses: 0,
      hitRate: 0,
      keys: 0,
      memory: {
        used: 0,
        available: this.config.memory.maxSize,
        percentage: 0
      },
      operations: {
        get: 0,
        set: 0,
        del: 0,
        expire: 0
      }
    };
  }

  /**
   * Initialize Redis connection
   */
  private initializeRedis(): void {
    if (!this.config.redis.enabled) {
      return;
    }

    this.redisClient = new Redis({
      host: this.config.redis.host,
      port: this.config.redis.port,
      password: this.config.redis.password,
      db: this.config.redis.database,
      keyPrefix: this.config.redis.keyPrefix,
      maxRetriesPerRequest: this.config.redis.maxRetries,
      lazyConnect: true
    });

    this.redisClient.on('connect', () => {
      logger.info('Redis connected');
    });

    this.redisClient.on('error', (error) => {
      logger.error('Redis error', error);
      this.emit('redisError', error);
    });

    this.redisClient.on('reconnecting', () => {
      logger.info('Redis reconnecting');
    });
  }

  /**
   * Start cleanup timer for memory cache
   */
  private startCleanupTimer(): void {
    if (!this.config.memory.enabled) {
      return;
    }

    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredEntries();
    }, this.config.memory.checkPeriod);
  }

  /**
   * Clean up expired entries from memory cache
   */
  private cleanupExpiredEntries(): void {
    const now = Date.now();
    let removedCount = 0;

    for (const [key, entry] of this.memoryCache) {
      if (entry.ttl > 0 && now - entry.createdAt.getTime() > entry.ttl * 1000) {
        this.memoryCache.delete(key);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      logger.debug(`Cleaned up ${removedCount} expired cache entries`);
      this.updateStats();
    }
  }

  /**
   * Get value from cache
   */
  public async get<T = any>(key: string): Promise<T | null> {
    this.stats.operations.get++;

    try {
      // Try Redis first if enabled
      if (this.config.redis.enabled && this.redisClient) {
        const value = await this.redisClient.get(key);
        if (value !== null) {
          this.stats.hits++;
          this.updateHitRate();
          return JSON.parse(value);
        }
      }

      // Try memory cache if enabled
      if (this.config.memory.enabled) {
        const entry = this.memoryCache.get(key);
        if (entry && this.isEntryValid(entry)) {
          entry.lastAccessed = new Date();
          entry.accessCount++;
          this.stats.hits++;
          this.updateHitRate();
          return entry.value;
        }
      }

      this.stats.misses++;
      this.updateHitRate();
      return null;
    } catch (error) {
      logger.error(`Cache get error for key ${key}`, error);
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }
  }

  /**
   * Set value in cache
   */
  public async set<T = any>(key: string, value: T, ttl?: number): Promise<boolean> {
    this.stats.operations.set++;

    try {
      const serializedValue = JSON.stringify(value);
      const cacheEntry: CacheEntry<T> = {
        key,
        value,
        ttl: ttl || this.config.redis.ttl,
        createdAt: new Date(),
        lastAccessed: new Date(),
        accessCount: 0
      };

      // Set in Redis if enabled
      if (this.config.redis.enabled && this.redisClient) {
        if (ttl) {
          await this.redisClient.setex(key, ttl, serializedValue);
        } else {
          await this.redisClient.set(key, serializedValue);
        }
      }

      // Set in memory cache if enabled
      if (this.config.memory.enabled) {
        // Check memory limit
        if (this.memoryCache.size >= this.config.memory.maxSize) {
          this.evictLeastRecentlyUsed();
        }

        this.memoryCache.set(key, cacheEntry);
      }

      this.updateStats();
      return true;
    } catch (error) {
      logger.error(`Cache set error for key ${key}`, error);
      return false;
    }
  }

  /**
   * Delete value from cache
   */
  public async delete(key: string): Promise<boolean> {
    this.stats.operations.del++;

    try {
      let deleted = false;

      // Delete from Redis if enabled
      if (this.config.redis.enabled && this.redisClient) {
        const result = await this.redisClient.del(key);
        deleted = result > 0;
      }

      // Delete from memory cache if enabled
      if (this.config.memory.enabled) {
        const memoryDeleted = this.memoryCache.delete(key);
        deleted = deleted || memoryDeleted;
      }

      this.updateStats();
      return deleted;
    } catch (error) {
      logger.error(`Cache delete error for key ${key}`, error);
      return false;
    }
  }

  /**
   * Check if key exists in cache
   */
  public async exists(key: string): Promise<boolean> {
    try {
      // Check Redis first if enabled
      if (this.config.redis.enabled && this.redisClient) {
        const exists = await this.redisClient.exists(key);
        if (exists) {
          return true;
        }
      }

      // Check memory cache if enabled
      if (this.config.memory.enabled) {
        const entry = this.memoryCache.get(key);
        return entry !== undefined && this.isEntryValid(entry);
      }

      return false;
    } catch (error) {
      logger.error(`Cache exists error for key ${key}`, error);
      return false;
    }
  }

  /**
   * Set expiration for key
   */
  public async expire(key: string, ttl: number): Promise<boolean> {
    this.stats.operations.expire++;

    try {
      // Set expiration in Redis if enabled
      if (this.config.redis.enabled && this.redisClient) {
        const result = await this.redisClient.expire(key, ttl);
        return result === 1;
      }

      // Update TTL in memory cache if enabled
      if (this.config.memory.enabled) {
        const entry = this.memoryCache.get(key);
        if (entry) {
          entry.ttl = ttl;
          return true;
        }
      }

      return false;
    } catch (error) {
      logger.error(`Cache expire error for key ${key}`, error);
      return false;
    }
  }

  /**
   * Get multiple values from cache
   */
  public async mget<T = any>(keys: string[]): Promise<Map<string, T>> {
    const results = new Map<string, T>();

    for (const key of keys) {
      const value = await this.get<T>(key);
      if (value !== null) {
        results.set(key, value);
      }
    }

    return results;
  }

  /**
   * Set multiple values in cache
   */
  public async mset<T = any>(entries: Map<string, T>, ttl?: number): Promise<boolean> {
    let success = true;

    for (const [key, value] of entries) {
      const result = await this.set(key, value, ttl);
      if (!result) {
        success = false;
      }
    }

    return success;
  }

  /**
   * Get keys matching pattern
   */
  public async keys(pattern: string): Promise<string[]> {
    try {
      const keys: string[] = [];

      // Get keys from Redis if enabled
      if (this.config.redis.enabled && this.redisClient) {
        const redisKeys = await this.redisClient.keys(pattern);
        keys.push(...redisKeys);
      }

      // Get keys from memory cache if enabled
      if (this.config.memory.enabled) {
        const memoryKeys = Array.from(this.memoryCache.keys())
          .filter(key => this.matchesPattern(key, pattern));
        keys.push(...memoryKeys);
      }

      return [...new Set(keys)]; // Remove duplicates
    } catch (error) {
      logger.error(`Cache keys error for pattern ${pattern}`, error);
      return [];
    }
  }

  /**
   * Clear all cache entries
   */
  public async clear(): Promise<boolean> {
    try {
      // Clear Redis if enabled
      if (this.config.redis.enabled && this.redisClient) {
        await this.redisClient.flushdb();
      }

      // Clear memory cache if enabled
      if (this.config.memory.enabled) {
        this.memoryCache.clear();
      }

      this.updateStats();
      logger.info('Cache cleared');
      return true;
    } catch (error) {
      logger.error('Cache clear error', error);
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  public getStats(): CacheStats {
    this.updateStats();
    return { ...this.stats };
  }

  /**
   * Check if cache entry is valid
   */
  private isEntryValid(entry: CacheEntry): boolean {
    if (entry.ttl <= 0) {
      return true; // No expiration
    }

    const now = Date.now();
    const age = now - entry.createdAt.getTime();
    return age < entry.ttl * 1000;
  }

  /**
   * Evict least recently used entry
   */
  private evictLeastRecentlyUsed(): void {
    let oldestEntry: CacheEntry | null = null;
    let oldestKey: string | null = null;

    for (const [key, entry] of this.memoryCache) {
      if (!oldestEntry || entry.lastAccessed < oldestEntry.lastAccessed) {
        oldestEntry = entry;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.memoryCache.delete(oldestKey);
      logger.debug(`Evicted LRU cache entry: ${oldestKey}`);
    }
  }

  /**
   * Update cache statistics
   */
  private updateStats(): void {
    this.stats.keys = this.memoryCache.size;
    
    if (this.config.memory.enabled) {
      this.stats.memory.used = this.memoryCache.size;
      this.stats.memory.percentage = (this.memoryCache.size / this.config.memory.maxSize) * 100;
    }
  }

  /**
   * Update hit rate
   */
  private updateHitRate(): void {
    const totalRequests = this.stats.hits + this.stats.misses;
    this.stats.hitRate = totalRequests > 0 ? (this.stats.hits / totalRequests) * 100 : 0;
  }

  /**
   * Check if key matches pattern
   */
  private matchesPattern(key: string, pattern: string): boolean {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return regex.test(key);
  }

  /**
   * Get cache health status
   */
  public async getHealth(): Promise<{ redis: boolean; memory: boolean }> {
    const health = {
      redis: false,
      memory: true
    };

    // Check Redis health
    if (this.config.redis.enabled && this.redisClient) {
      try {
        await this.redisClient.ping();
        health.redis = true;
      } catch (error) {
        logger.error('Redis health check failed', error);
      }
    } else {
      health.redis = !this.config.redis.enabled; // True if Redis is disabled
    }

    return health;
  }

  /**
   * Get cache configuration
   */
  public getConfig(): CacheConfig {
    return { ...this.config };
  }

  /**
   * Update cache configuration
   */
  public updateConfig(newConfig: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info('Cache configuration updated', newConfig);
  }

  /**
   * Shutdown cache service
   */
  public async shutdown(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    if (this.redisClient) {
      await this.redisClient.quit();
    }

    this.memoryCache.clear();
    logger.info('Cache service shutdown');
  }
}