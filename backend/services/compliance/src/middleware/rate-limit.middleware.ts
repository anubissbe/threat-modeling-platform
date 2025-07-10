import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

class RateLimiter {
  private store: RateLimitStore = {};
  private windowMs: number;
  private maxRequests: number;

  constructor(windowMs: number = 15 * 60 * 1000, maxRequests: number = 100) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    
    // Clean up expired entries every minute
    setInterval(() => this.cleanup(), 60 * 1000);
  }

  private cleanup(): void {
    const now = Date.now();
    Object.keys(this.store).forEach(key => {
      if (this.store[key].resetTime < now) {
        delete this.store[key];
      }
    });
  }

  private getKey(req: Request): string {
    // Use IP address and user ID if available for more granular rate limiting
    const ip = req.ip || (req.connection as any)?.remoteAddress || 'unknown';
    const userId = (req as any).user?.id;
    return userId ? `${ip}:${userId}` : ip;
  }

  public middleware() {
    return (req: Request, res: Response, next: NextFunction): void => {
      const key = this.getKey(req);
      const now = Date.now();
      
      if (!this.store[key] || this.store[key].resetTime < now) {
        this.store[key] = {
          count: 1,
          resetTime: now + this.windowMs
        };
      } else {
        this.store[key].count++;
      }

      const { count, resetTime } = this.store[key];
      const remaining = Math.max(0, this.maxRequests - count);
      const resetTimeSeconds = Math.ceil((resetTime - now) / 1000);

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', this.maxRequests);
      res.setHeader('X-RateLimit-Remaining', remaining);
      res.setHeader('X-RateLimit-Reset', resetTimeSeconds);

      if (count > this.maxRequests) {
        logger.warn(`Rate limit exceeded for key: ${key}`, {
          count,
          limit: this.maxRequests,
          resetTime
        });

        res.status(429).json({
          success: false,
          error: 'Too many requests',
          details: {
            limit: this.maxRequests,
            remaining: 0,
            resetTime: resetTimeSeconds
          }
        });
        return;
      }

      next();
    };
  }
}

// Create rate limiter instances for different endpoints
const generalLimiter = new RateLimiter(15 * 60 * 1000, 100); // 100 requests per 15 minutes
const reportLimiter = new RateLimiter(60 * 60 * 1000, 10);   // 10 reports per hour
const assessmentLimiter = new RateLimiter(60 * 60 * 1000, 20); // 20 assessments per hour

export const rateLimitMiddleware = generalLimiter.middleware();
export const reportRateLimitMiddleware = reportLimiter.middleware();
export const assessmentRateLimitMiddleware = assessmentLimiter.middleware();