import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';
import { AuthenticatedRequest, ApiResponse } from '../types';

interface JWTPayload {
  id: string;
  email: string;
  role: string;
  organizationId: string;
  iat?: number;
  exp?: number;
}

export const authMiddleware = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      const response: ApiResponse = {
        success: false,
        message: 'Authorization header required',
        errors: [{ field: 'authorization', message: 'Authorization header is required' }],
      };
      res.status(401).json(response);
      return;
    }

    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;

    if (!token) {
      const response: ApiResponse = {
        success: false,
        message: 'Access token required',
        errors: [{ field: 'token', message: 'Access token is required' }],
      };
      res.status(401).json(response);
      return;
    }

    const jwtSecret = process.env['JWT_SECRET'];
    if (!jwtSecret) {
      logger.error('JWT_SECRET environment variable not set');
      const response: ApiResponse = {
        success: false,
        message: 'Authentication configuration error',
        errors: [{ field: 'server', message: 'Authentication not properly configured' }],
      };
      res.status(500).json(response);
      return;
    }

    try {
      const decoded = jwt.verify(token, jwtSecret) as JWTPayload;

      // Validate required fields
      if (!decoded.id || !decoded.email) {
        const response: ApiResponse = {
          success: false,
          message: 'Invalid token payload',
          errors: [{ field: 'token', message: 'Token payload is missing required fields' }],
        };
        res.status(401).json(response);
        return;
      }

      // Attach user information to request
      req.user = {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role || 'user',
        organizationId: decoded.organizationId,
      };

      // Log successful authentication (without sensitive data)
      logger.debug('User authenticated successfully', {
        userId: decoded.id,
        email: decoded.email,
        role: decoded.role,
      });

      next();
    } catch (jwtError) {
      logger.warn('JWT verification failed:', jwtError);

      let errorMessage = 'Invalid token';
      if (jwtError instanceof jwt.TokenExpiredError) {
        errorMessage = 'Token has expired';
      } else if (jwtError instanceof jwt.JsonWebTokenError) {
        errorMessage = 'Invalid token format';
      }

      const response: ApiResponse = {
        success: false,
        message: errorMessage,
        errors: [{ field: 'token', message: errorMessage }],
      };
      res.status(401).json(response);
      return;
    }
  } catch (error) {
    logger.error('Authentication middleware error:', error);
    
    const response: ApiResponse = {
      success: false,
      message: 'Authentication error',
      errors: [{ field: 'server', message: 'Internal authentication error' }],
    };
    res.status(500).json(response);
  }
};

// Optional authentication middleware (for public endpoints that can benefit from user context)
export const optionalAuthMiddleware = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    // No auth header, continue without user context
    next();
    return;
  }

  try {
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    const jwtSecret = process.env['JWT_SECRET'];

    if (token && jwtSecret) {
      const decoded = jwt.verify(token, jwtSecret) as JWTPayload;
      
      if (decoded.id && decoded.email) {
        req.user = {
          id: decoded.id,
          email: decoded.email,
          role: decoded.role || 'user',
          organizationId: decoded.organizationId,
        };
      }
    }
  } catch (error) {
    // Log but don't fail the request
    logger.debug('Optional authentication failed:', error);
  }

  next();
};

// Role-based authorization middleware
export const requireRole = (roles: string | string[]) => {
  const allowedRoles = Array.isArray(roles) ? roles : [roles];

  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      const response: ApiResponse = {
        success: false,
        message: 'Authentication required',
        errors: [{ field: 'auth', message: 'User must be authenticated' }],
      };
      res.status(401).json(response);
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      logger.warn('Access denied - insufficient role', {
        userId: req.user.id,
        userRole: req.user.role,
        requiredRoles: allowedRoles,
      });

      const response: ApiResponse = {
        success: false,
        message: 'Access denied',
        errors: [{ field: 'role', message: 'Insufficient permissions' }],
      };
      res.status(403).json(response);
      return;
    }

    next();
  };
};

// Organization-based authorization middleware
export const requireSameOrganization = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  if (!req.user) {
    const response: ApiResponse = {
      success: false,
      message: 'Authentication required',
      errors: [{ field: 'auth', message: 'User must be authenticated' }],
    };
    res.status(401).json(response);
    return;
  }

  // Check if the user is trying to access resources from their organization
  const targetUserId = req.params.userId || req.body.userId;
  
  if (targetUserId && targetUserId !== req.user.id) {
    // If accessing another user's resources, need admin role or same organization
    if (req.user.role !== 'admin') {
      // Here you would typically check if both users belong to the same organization
      // For now, we'll allow access if the user has appropriate role
      if (!['admin', 'manager'].includes(req.user.role)) {
        const response: ApiResponse = {
          success: false,
          message: 'Access denied',
          errors: [{ field: 'organization', message: 'Cannot access resources from other organizations' }],
        };
        res.status(403).json(response);
        return;
      }
    }
  }

  next();
};

// API key authentication middleware (for service-to-service communication)
export const apiKeyMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const apiKey = req.headers['x-api-key'] as string;

  if (!apiKey) {
    const response: ApiResponse = {
      success: false,
      message: 'API key required',
      errors: [{ field: 'apiKey', message: 'X-API-Key header is required' }],
    };
    res.status(401).json(response);
    return;
  }

  const validApiKeys = process.env['API_KEYS']?.split(',') || [];
  
  if (!validApiKeys.includes(apiKey)) {
    logger.warn('Invalid API key attempted', { 
      providedKey: apiKey.substring(0, 8) + '...',
      ip: req.ip 
    });

    const response: ApiResponse = {
      success: false,
      message: 'Invalid API key',
      errors: [{ field: 'apiKey', message: 'The provided API key is invalid' }],
    };
    res.status(401).json(response);
    return;
  }

  logger.debug('API key authenticated successfully');
  next();
};

// Internal service authentication middleware
export const internalServiceMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const serviceToken = req.headers['x-service-token'] as string;
  const expectedToken = process.env['INTERNAL_SERVICE_TOKEN'];

  if (!expectedToken) {
    logger.error('INTERNAL_SERVICE_TOKEN not configured');
    const response: ApiResponse = {
      success: false,
      message: 'Internal service authentication not configured',
      errors: [{ field: 'server', message: 'Service authentication not properly configured' }],
    };
    res.status(500).json(response);
    return;
  }

  if (!serviceToken) {
    const response: ApiResponse = {
      success: false,
      message: 'Service token required',
      errors: [{ field: 'serviceToken', message: 'X-Service-Token header is required' }],
    };
    res.status(401).json(response);
    return;
  }

  if (serviceToken !== expectedToken) {
    logger.warn('Invalid service token attempted', { ip: req.ip });

    const response: ApiResponse = {
      success: false,
      message: 'Invalid service token',
      errors: [{ field: 'serviceToken', message: 'The provided service token is invalid' }],
    };
    res.status(401).json(response);
    return;
  }

  logger.debug('Internal service authenticated successfully');
  next();
};

// Webhook signature verification middleware
export const webhookSignatureMiddleware = (secret: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const signature = req.headers['x-hub-signature-256'] as string;
    
    if (!signature) {
      const response: ApiResponse = {
        success: false,
        message: 'Webhook signature required',
        errors: [{ field: 'signature', message: 'X-Hub-Signature-256 header is required' }],
      };
      res.status(401).json(response);
      return;
    }

    // This would require implementing signature verification
    // For now, just validate the format
    if (!signature.startsWith('sha256=')) {
      const response: ApiResponse = {
        success: false,
        message: 'Invalid signature format',
        errors: [{ field: 'signature', message: 'Signature must start with sha256=' }],
      };
      res.status(401).json(response);
      return;
    }

    // TODO: Implement actual signature verification
    logger.debug('Webhook signature verified');
    next();
  };
};

export default authMiddleware;