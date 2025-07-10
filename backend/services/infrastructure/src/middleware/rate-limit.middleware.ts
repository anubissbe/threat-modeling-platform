import rateLimit from 'express-rate-limit';
import { logger } from '../utils/logger';
import { InfrastructureRequest } from '../types/infrastructure';

export const rateLimitMiddleware = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again later.',
    timestamp: new Date()
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  keyGenerator: (req) => {
    const infraReq = req as InfrastructureRequest;
    return infraReq.clientIp;
  },
  handler: (req, res) => {
    const infraReq = req as InfrastructureRequest;
    
    logger.warn('Rate limit exceeded', {
      ip: infraReq.clientIp,
      path: req.path,
      userAgent: infraReq.userAgent,
      requestId: infraReq.requestId
    });
    
    res.status(429).json({
      success: false,
      error: 'Rate limit exceeded. Please try again later.',
      timestamp: new Date(),
      requestId: infraReq.requestId
    });
  }
});