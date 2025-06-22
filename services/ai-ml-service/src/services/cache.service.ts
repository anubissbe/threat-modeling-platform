import { createClient, RedisClientType } from 'redis';
import { logger, mlLogger } from '../utils/logger';
import { config } from '../config';
import { CacheEntry } from '../types';

export class CacheService {
  private client: RedisClientType | null = null;
  private localCache: Map<string, CacheEntry<any>> = new Map();
  private hitCount: number = 0;
  private missCount: number = 0;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.initializeRedis();
    this.startCleanupTimer();
  }

  /**
   * Initialize Redis connection
   */
  private async initializeRedis(): Promise<void> {
    try {
      this.client = createClient({
        url: config.REDIS_URL,
        socket: {
          reconnectStrategy: (retries) => {
            if (retries > 10) {
              logger.error('Redis connection failed after 10 retries');
              return new Error('Redis connection failed');
            }
            return Math.min(retries * 100, 3000);
          },
        },
      });

      this.client.on('error', (err) => {
        logger.error('Redis client error:', err);
      });

      this.client.on('connect', () => {
        logger.info('Redis client connected');
      });

      await this.client.connect();
    } catch (error) {
      logger.warn('Redis connection failed, using local cache only:', error);
      this.client = null;
    }
  }

  /**
   * Start cleanup timer for expired entries
   */
  private startCleanupTimer(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredEntries();
    }, 60000); // Clean every minute
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      // Try Redis first
      if (this.client && this.client.isOpen) {
        const redisValue = await this.client.get(key);
        if (redisValue) {
          this.hitCount++;
          mlLogger.cacheHit('redis', key);
          return JSON.parse(redisValue);
        }
      }

      // Fallback to local cache
      const localEntry = this.localCache.get(key);
      if (localEntry && localEntry.expires > Date.now()) {
        localEntry.hits++;
        this.hitCount++;
        mlLogger.cacheHit('local', key);
        return localEntry.value;
      }

      this.missCount++;
      mlLogger.cacheMiss('all', key);
      return null;

    } catch (error) {
      logger.error('Cache get error:', error);
      this.missCount++;
      return null;
    }
  }

  /**
   * Set value in cache
   */
  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const ttl = ttlSeconds || config.CACHE_TTL;
    
    try {
      // Store in Redis if available
      if (this.client && this.client.isOpen) {
        await this.client.setEx(key, ttl, JSON.stringify(value));
      }

      // Also store in local cache
      this.setLocal(key, value, ttl);

    } catch (error) {
      logger.error('Cache set error:', error);
      // Ensure it's at least in local cache
      this.setLocal(key, value, ttl);
    }
  }

  /**
   * Set value in local cache
   */
  private setLocal<T>(key: string, value: T, ttlSeconds: number): void {
    // Check cache size limit
    if (this.localCache.size >= config.CACHE_MAX_SIZE) {
      this.evictOldestEntry();
    }

    this.localCache.set(key, {
      key,
      value,
      expires: Date.now() + (ttlSeconds * 1000),
      hits: 0,
    });
  }

  /**
   * Delete value from cache
   */
  async delete(key: string): Promise<void> {
    try {
      if (this.client && this.client.isOpen) {
        await this.client.del(key);
      }
      this.localCache.delete(key);
    } catch (error) {
      logger.error('Cache delete error:', error);
    }
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    try {
      if (this.client && this.client.isOpen) {
        await this.client.flushAll();
      }
      this.localCache.clear();
      this.hitCount = 0;
      this.missCount = 0;
    } catch (error) {
      logger.error('Cache clear error:', error);
    }
  }

  /**
   * Get cache keys matching pattern
   */
  async keys(pattern: string): Promise<string[]> {
    const keys: string[] = [];

    try {
      // Get Redis keys
      if (this.client && this.client.isOpen) {
        const redisKeys = await this.client.keys(pattern);
        keys.push(...redisKeys);
      }

      // Get local keys
      const regex = new RegExp(pattern.replace('*', '.*'));
      this.localCache.forEach((_, key) => {
        if (regex.test(key) && !keys.includes(key)) {
          keys.push(key);
        }
      });

    } catch (error) {
      logger.error('Cache keys error:', error);
    }

    return keys;
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      if (this.client && this.client.isOpen) {
        const exists = await this.client.exists(key);
        if (exists) return true;
      }

      const localEntry = this.localCache.get(key);
      return localEntry !== undefined && localEntry.expires > Date.now();

    } catch (error) {
      logger.error('Cache exists error:', error);
      return false;
    }
  }

  /**
   * Get remaining TTL for key
   */
  async ttl(key: string): Promise<number> {
    try {
      if (this.client && this.client.isOpen) {
        const ttl = await this.client.ttl(key);
        if (ttl > 0) return ttl;
      }

      const localEntry = this.localCache.get(key);
      if (localEntry && localEntry.expires > Date.now()) {
        return Math.floor((localEntry.expires - Date.now()) / 1000);
      }

      return -1;

    } catch (error) {
      logger.error('Cache ttl error:', error);
      return -1;
    }
  }

  /**
   * Cleanup expired entries from local cache
   */
  private cleanupExpiredEntries(): void {
    const now = Date.now();
    let removed = 0;

    this.localCache.forEach((entry, key) => {
      if (entry.expires <= now) {
        this.localCache.delete(key);
        removed++;
      }
    });

    if (removed > 0) {
      logger.debug(`Cleaned up ${removed} expired cache entries`);
    }
  }

  /**
   * Evict oldest entry when cache is full
   */
  private evictOldestEntry(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    this.localCache.forEach((entry, key) => {
      if (entry.expires < oldestTime) {
        oldestTime = entry.expires;
        oldestKey = key;
      }
    });

    if (oldestKey) {
      this.localCache.delete(oldestKey);
      logger.debug(`Evicted cache entry: ${oldestKey}`);
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    hitCount: number;
    missCount: number;
    hitRate: number;
    redisConnected: boolean;
  } {
    const totalRequests = this.hitCount + this.missCount;
    const hitRate = totalRequests > 0 ? this.hitCount / totalRequests : 0;

    return {
      size: this.localCache.size,
      hitCount: this.hitCount,
      missCount: this.missCount,
      hitRate,
      redisConnected: this.client !== null && this.client.isOpen,
    };
  }

  /**
   * Get cache size
   */
  getSize(): number {
    return this.localCache.size;
  }

  /**
   * Get hit rate
   */
  getHitRate(): number {
    const total = this.hitCount + this.missCount;
    return total > 0 ? this.hitCount / total : 0;
  }

  /**
   * Warm up cache with frequently accessed data
   */
  async warmUp(entries: Array<{ key: string; value: any; ttl?: number }>): Promise<void> {
    logger.info(`Warming up cache with ${entries.length} entries`);
    
    for (const entry of entries) {
      await this.set(entry.key, entry.value, entry.ttl);
    }
  }

  /**
   * Get most accessed keys
   */
  getMostAccessedKeys(limit: number = 10): Array<{ key: string; hits: number }> {
    const entries = Array.from(this.localCache.entries())
      .map(([key, entry]) => ({ key, hits: entry.hits }))
      .sort((a, b) => b.hits - a.hits)
      .slice(0, limit);

    return entries;
  }

  /**
   * Batch get multiple keys
   */
  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    const results: (T | null)[] = [];

    for (const key of keys) {
      const value = await this.get<T>(key);
      results.push(value);
    }

    return results;
  }

  /**
   * Batch set multiple key-value pairs
   */
  async mset(entries: Array<{ key: string; value: any; ttl?: number }>): Promise<void> {
    for (const entry of entries) {
      await this.set(entry.key, entry.value, entry.ttl);
    }
  }

  /**
   * Invalidate cache entries by pattern
   */
  async invalidatePattern(pattern: string): Promise<number> {
    const keys = await this.keys(pattern);
    
    for (const key of keys) {
      await this.delete(key);
    }

    logger.info(`Invalidated ${keys.length} cache entries matching pattern: ${pattern}`);
    return keys.length;
  }

  /**
   * Get cache memory usage estimate
   */
  getMemoryUsage(): { local: number; estimated: string } {
    let totalSize = 0;

    this.localCache.forEach(entry => {
      // Rough estimate of memory usage
      totalSize += JSON.stringify(entry).length;
    });

    return {
      local: totalSize,
      estimated: this.formatBytes(totalSize),
    };
  }

  /**
   * Format bytes to human readable
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Shutdown cache service
   */
  async shutdown(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    if (this.client) {
      await this.client.quit();
      this.client = null;
    }

    this.localCache.clear();
    logger.info('Cache service shutdown complete');
  }
}