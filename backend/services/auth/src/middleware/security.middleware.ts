import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import mongoSanitize from 'express-mongo-sanitize';
import hpp from 'hpp';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import { securityConfig } from '../config/security';
import { auditService, AuditEventType } from '../services/audit.service';
import { logger } from '../utils/logger';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      requestId: string;
      startTime: number;
      clientIp: string;
    }
  }
}

/**
 * Request ID middleware - adds unique ID to each request
 */
export const requestIdMiddleware = (req: Request, res: Response, next: NextFunction) => {
  req.requestId = uuidv4();
  req.startTime = Date.now();
  res.setHeader('X-Request-ID', req.requestId);
  next();
};

/**
 * Client IP extraction middleware
 */
export const clientIpMiddleware = (req: Request, _res: Response, next: NextFunction) => {
  // Extract real IP from various headers
  req.clientIp = (
    req.headers['x-real-ip'] as string ||
    req.headers['x-forwarded-for']?.toString().split(',')[0] ||
    req.socket.remoteAddress ||
    ''
  ).trim();
  next();
};

/**
 * Security headers middleware using Helmet
 */
export const securityHeadersMiddleware = helmet({
  contentSecurityPolicy: {
    directives: securityConfig.headers.contentSecurityPolicy.directives,
  },
  hsts: securityConfig.headers.hsts,
  noSniff: true,
  xssFilter: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  permittedCrossDomainPolicies: false,
});

/**
 * CORS middleware
 */
export const corsMiddleware = cors(securityConfig.cors);

/**
 * Rate limiting middleware
 */
export const rateLimitMiddleware = rateLimit({
  ...securityConfig.rateLimit,
  keyGenerator: (req: Request) => req.clientIp,
  handler: async (req: Request, res: Response) => {
    await auditService.logEvent({
      eventType: AuditEventType.RATE_LIMIT_EXCEEDED,
      ipAddress: req.clientIp,
      userAgent: req.headers['user-agent'] || '',
      action: `Rate limit exceeded for ${req.method} ${req.path}`,
      result: 'FAILURE',
      metadata: {
        method: req.method,
        path: req.path,
      },
    });

    res.status(429).json({
      error: 'Too many requests',
      message: securityConfig.rateLimit.message,
      retryAfter: (req as any).rateLimit?.resetTime,
    });
  },
});

/**
 * Authentication-specific rate limiting
 */
export const authRateLimitMiddleware = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
});

/**
 * Input sanitization middleware
 */
export const sanitizationMiddleware = [
  // Prevent NoSQL injection attacks
  mongoSanitize({
    replaceWith: '_',
    onSanitize: ({ req, key }) => {
      logger.warn(`Sanitized potentially malicious input`, {
        requestId: req.requestId,
        key,
        clientIp: req.clientIp,
      });
    },
  }),
  
  // Prevent HTTP Parameter Pollution
  hpp({
    whitelist: ['sort', 'fields', 'page', 'limit'], // Allow these parameters to have arrays
  }),
];

/**
 * Request logging middleware
 */
export const requestLoggingMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Log request
  logger.info('Incoming request', {
    requestId: req.requestId,
    method: req.method,
    path: req.path,
    clientIp: req.clientIp,
    userAgent: req.headers['user-agent'],
  });

  // Log response
  const originalSend = res.send;
  res.send = function(data) {
    const duration = Date.now() - req.startTime;
    
    logger.info('Outgoing response', {
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      clientIp: req.clientIp,
    });

    // Audit log for data access
    if (req.method === 'GET' && res.statusCode === 200 && req.path.includes('/api/')) {
      auditService.logEvent({
        eventType: AuditEventType.DATA_READ,
        userId: (req as any).user?.id,
        username: (req as any).user?.username,
        ipAddress: req.clientIp,
        userAgent: req.headers['user-agent'] || '',
        action: `Accessed ${req.method} ${req.path}`,
        result: 'SUCCESS',
        metadata: {
          duration,
          responseSize: data.length,
        },
      });
    }

    return originalSend.call(this, data);
  };

  next();
};

/**
 * SQL injection prevention middleware
 */
export const sqlInjectionPreventionMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const suspiciousPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|CREATE|ALTER|EXEC|EXECUTE)\b)/gi,
    /(--|\/\*|\*\/|xp_|sp_)/gi,
    /(\bOR\b\s*\d+\s*=\s*\d+)/gi,
    /(\bAND\b\s*\d+\s*=\s*\d+)/gi,
  ];

  const checkValue = (value: any, path: string): boolean => {
    if (typeof value === 'string') {
      for (const pattern of suspiciousPatterns) {
        if (pattern.test(value)) {
          logger.warn('Potential SQL injection attempt detected', {
            requestId: req.requestId,
            path,
            value: value.substring(0, 100),
            clientIp: req.clientIp,
          });
          return true;
        }
      }
    } else if (typeof value === 'object' && value !== null) {
      for (const key in value) {
        if (checkValue(value[key], `${path}.${key}`)) {
          return true;
        }
      }
    }
    return false;
  };

  // Check query parameters
  if (checkValue(req.query, 'query')) {
    res.status(400).json({ error: 'Invalid input detected' });
    return;
  }

  // Check body
  if (checkValue(req.body, 'body')) {
    res.status(400).json({ error: 'Invalid input detected' });
    return;
  }

  // Check params
  if (checkValue(req.params, 'params')) {
    res.status(400).json({ error: 'Invalid input detected' });
    return;
  }

  next();
};

/**
 * XSS prevention middleware
 */
export const xssPreventionMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const xssPatterns = [
    /<script[^>]*>.*?<\/script>/gi,
    /<iframe[^>]*>.*?<\/iframe>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
  ];

  const sanitizeValue = (value: any): any => {
    if (typeof value === 'string') {
      let sanitized = value;
      for (const pattern of xssPatterns) {
        sanitized = sanitized.replace(pattern, '');
      }
      return sanitized;
    } else if (Array.isArray(value)) {
      return value.map(sanitizeValue);
    } else if (typeof value === 'object' && value !== null) {
      const sanitized: any = {};
      for (const key in value) {
        sanitized[key] = sanitizeValue(value[key]);
      }
      return sanitized;
    }
    return value;
  };

  // Sanitize body
  if (req.body) {
    req.body = sanitizeValue(req.body);
  }

  next();
};

/**
 * File upload security middleware
 */
export const fileUploadSecurityMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (!(req as any).files) {
    return next();
  }

  const allowedMimeTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/pdf',
    'application/json',
    'text/plain',
  ];

  const maxFileSize = 10 * 1024 * 1024; // 10MB

  const files = Array.isArray((req as any).files) ? (req as any).files : Object.values((req as any).files).flat();

  for (const file of files) {
    // Check file size
    if (file.size > maxFileSize) {
      return res.status(400).json({
        error: 'File too large',
        message: `File ${file.name} exceeds maximum size of 10MB`,
      });
    }

    // Check MIME type
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return res.status(400).json({
        error: 'Invalid file type',
        message: `File type ${file.mimetype} is not allowed`,
      });
    }

    // Check file extension
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    const dangerousExtensions = ['exe', 'dll', 'sh', 'bat', 'cmd', 'com', 'scr'];
    
    if (fileExtension && dangerousExtensions.includes(fileExtension)) {
      return res.status(400).json({
        error: 'Dangerous file type',
        message: `File extension .${fileExtension} is not allowed`,
      });
    }
  }

  next();
};

/**
 * Apply all security middleware
 */
export const applySecurityMiddleware = (app: any) => {
  // Basic security
  app.use(requestIdMiddleware);
  app.use(clientIpMiddleware);
  app.use(securityHeadersMiddleware);
  app.use(corsMiddleware);
  
  // Rate limiting
  app.use('/api/', rateLimitMiddleware);
  app.use('/api/auth/', authRateLimitMiddleware);
  
  // Input validation and sanitization
  app.use(sanitizationMiddleware);
  app.use(sqlInjectionPreventionMiddleware);
  app.use(xssPreventionMiddleware);
  
  // Logging
  app.use(requestLoggingMiddleware);
  
  // Disable X-Powered-By header
  app.disable('x-powered-by');
  
  // Trust proxy (for accurate IP addresses behind reverse proxy)
  app.set('trust proxy', true);
};