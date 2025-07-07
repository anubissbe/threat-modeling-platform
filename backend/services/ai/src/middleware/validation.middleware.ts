import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

/**
 * General request validation middleware
 * Performs basic validation on all requests
 */
export const validateRequestMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    // Content-Type validation for POST/PUT requests
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      const contentType = req.headers['content-type'];
      
      if (!contentType || !contentType.includes('application/json')) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_CONTENT_TYPE',
            message: 'Content-Type must be application/json'
          }
        });
        return;
      }
    }

    // Request size validation
    const contentLength = req.headers['content-length'];
    if (contentLength) {
      const sizeInMB = parseInt(contentLength) / (1024 * 1024);
      const maxSizeMB = 10; // 10MB limit
      
      if (sizeInMB > maxSizeMB) {
        res.status(413).json({
          success: false,
          error: {
            code: 'REQUEST_TOO_LARGE',
            message: `Request size exceeds ${maxSizeMB}MB limit`
          }
        });
        return;
      }
    }

    // Basic header validation
    const userAgent = req.headers['user-agent'];
    if (!userAgent) {
      logger.warn('Request without User-Agent header', { ip: req.ip });
    }

    // Security headers validation
    validateSecurityHeaders(req, res, next);
  } catch (error) {
    logger.error('Request validation error:', error);
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed'
      }
    });
  }
};

/**
 * Validate security-related headers
 */
const validateSecurityHeaders = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Check for suspicious headers that might indicate automated attacks
  const suspiciousHeaders = [
    'x-forwarded-host',
    'x-real-ip',
    'x-cluster-client-ip'
  ];

  for (const header of suspiciousHeaders) {
    const value = req.headers[header];
    if (value && typeof value === 'string') {
      // Basic validation to prevent header injection
      if (value.includes('\n') || value.includes('\r')) {
        logger.warn(`Suspicious header injection attempt: ${header}`, { 
          value, 
          ip: req.ip 
        });
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_HEADER',
            message: 'Invalid header value detected'
          }
        });
        return;
      }
    }
  }

  next();
};

/**
 * Validate UUID parameters
 */
export const validateUUIDParam = (paramName: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const value = req.params[paramName];
    
    if (!value) {
      res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_PARAMETER',
          message: `Parameter '${paramName}' is required`
        }
      });
      return;
    }

    // UUID v4 regex pattern
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    
    if (!uuidRegex.test(value)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_UUID',
          message: `Parameter '${paramName}' must be a valid UUID`
        }
      });
      return;
    }

    next();
  };
};

/**
 * Validate pagination parameters
 */
export const validatePaginationMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { page, limit } = req.query;

  // Validate page parameter
  if (page !== undefined) {
    const pageNum = parseInt(page as string);
    if (isNaN(pageNum) || pageNum < 1) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PAGE',
          message: 'Page must be a positive integer'
        }
      });
      return;
    }
    
    if (pageNum > 1000) {
      res.status(400).json({
        success: false,
        error: {
          code: 'PAGE_TOO_LARGE',
          message: 'Page number cannot exceed 1000'
        }
      });
      return;
    }
  }

  // Validate limit parameter
  if (limit !== undefined) {
    const limitNum = parseInt(limit as string);
    if (isNaN(limitNum) || limitNum < 1) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_LIMIT',
          message: 'Limit must be a positive integer'
        }
      });
      return;
    }
    
    if (limitNum > 100) {
      res.status(400).json({
        success: false,
        error: {
          code: 'LIMIT_TOO_LARGE',
          message: 'Limit cannot exceed 100'
        }
      });
      return;
    }
  }

  next();
};

/**
 * Sanitize input to prevent injection attacks
 */
export const sanitizeInputMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    // Sanitize query parameters
    if (req.query) {
      req.query = sanitizeObject(req.query);
    }

    // Sanitize request body
    if (req.body) {
      req.body = sanitizeObject(req.body);
    }

    next();
  } catch (error) {
    logger.error('Input sanitization error:', error);
    res.status(400).json({
      success: false,
      error: {
        code: 'SANITIZATION_ERROR',
        message: 'Input sanitization failed'
      }
    });
  }
};

/**
 * Recursively sanitize an object
 */
function sanitizeObject(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }

  if (typeof obj === 'object') {
    const sanitized: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const sanitizedKey = sanitizeString(key);
        sanitized[sanitizedKey] = sanitizeObject(obj[key]);
      }
    }
    return sanitized;
  }

  return obj;
}

/**
 * Sanitize a string value
 */
function sanitizeString(str: string): string {
  if (typeof str !== 'string') {
    return str;
  }

  // Remove null bytes
  str = str.replace(/\0/g, '');

  // Basic XSS prevention - remove script tags and javascript: protocols
  str = str.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  str = str.replace(/javascript:/gi, '');
  str = str.replace(/on\w+\s*=/gi, '');

  // SQL injection prevention for string values
  str = str.replace(/['";\\]/g, '');
  
  // LDAP injection prevention
  str = str.replace(/[()&|!]/g, '');

  // Command injection prevention
  str = str.replace(/[;&|`$]/g, '');

  // Trim whitespace
  str = str.trim();

  return str;
}

/**
 * Validate AI analysis request structure
 */
export const validateAIAnalysisRequest = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { threat_model_id, methodology, context } = req.body;

  // Basic required field validation
  if (!threat_model_id) {
    res.status(400).json({
      success: false,
      error: {
        code: 'MISSING_THREAT_MODEL_ID',
        message: 'threat_model_id is required'
      }
    });
    return;
  }

  if (!methodology) {
    res.status(400).json({
      success: false,
      error: {
        code: 'MISSING_METHODOLOGY',
        message: 'methodology is required'
      }
    });
    return;
  }

  if (!context) {
    res.status(400).json({
      success: false,
      error: {
        code: 'MISSING_CONTEXT',
        message: 'context is required'
      }
    });
    return;
  }

  // Validate methodology
  const validMethodologies = ['stride', 'linddun', 'pasta', 'vast', 'dread', 'trike'];
  if (!validMethodologies.includes(methodology.toLowerCase())) {
    res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_METHODOLOGY',
        message: `methodology must be one of: ${validMethodologies.join(', ')}`
      }
    });
    return;
  }

  // Validate context structure
  const requiredContextFields = [
    'system_components',
    'data_flows',
    'trust_boundaries',
    'assets',
    'existing_controls',
    'business_context'
  ];

  for (const field of requiredContextFields) {
    if (!context[field]) {
      res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_CONTEXT_FIELD',
          message: `context.${field} is required`
        }
      });
      return;
    }
  }

  // Validate arrays are actually arrays
  const arrayFields = [
    'system_components',
    'data_flows', 
    'trust_boundaries',
    'assets',
    'existing_controls'
  ];

  for (const field of arrayFields) {
    if (!Array.isArray(context[field])) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_CONTEXT_FIELD_TYPE',
          message: `context.${field} must be an array`
        }
      });
      return;
    }
  }

  next();
};

/**
 * Validate file upload parameters
 * TODO: Add multer types for file upload support
 */
export const validateFileUpload = (
  allowedMimeTypes: string[],
  maxSizeBytes: number
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    // TODO: Implement file upload validation when multer is added
    next();
  };
};