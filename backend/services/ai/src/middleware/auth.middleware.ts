import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import { logger } from '../utils/logger';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        roles: string[];
        permissions: string[];
      };
    }
  }
}

export interface AuthConfig {
  jwtSecret: string;
  jwtRefreshSecret: string;
  authServiceUrl: string;
}

/**
 * Authentication middleware for AI service
 * Validates JWT tokens and sets user context
 */
export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: {
          code: 'MISSING_TOKEN',
          message: 'Authorization token is required'
        }
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify JWT token
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      logger.error('JWT_SECRET environment variable not set');
      res.status(500).json({
        success: false,
        error: {
          code: 'CONFIGURATION_ERROR',
          message: 'Authentication configuration error'
        }
      });
      return;
    }

    let decoded: any;
    try {
      decoded = jwt.verify(token, jwtSecret);
    } catch (jwtError) {
      logger.warn('Invalid JWT token:', jwtError);
      res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid or expired token'
        }
      });
      return;
    }

    // Extract user information from token
    const { userId, email, roles = [], permissions = [] } = decoded;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN_PAYLOAD',
          message: 'Invalid token payload'
        }
      });
      return;
    }

    // Optionally validate user still exists and is active
    // This could be done with a database check or Redis cache
    const userActive = await validateUserStatus(userId);
    if (!userActive) {
      res.status(401).json({
        success: false,
        error: {
          code: 'USER_INACTIVE',
          message: 'User account is inactive'
        }
      });
      return;
    }

    // Set user context on request
    req.user = {
      id: userId,
      email: email,
      roles: Array.isArray(roles) ? roles : [],
      permissions: Array.isArray(permissions) ? permissions : []
    };

    // Log the authenticated request
    logger.debug(`Authenticated request from user ${userId} for ${req.method} ${req.path}`);

    next();
  } catch (error) {
    logger.error('Authentication middleware error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'AUTH_ERROR',
        message: 'Authentication error occurred'
      }
    });
  }
};

/**
 * Validate user status (active/inactive)
 * In a production system, this would check a database or cache
 */
async function validateUserStatus(userId: string): Promise<boolean> {
  try {
    // Placeholder implementation
    // In production, this would:
    // 1. Check user status in database
    // 2. Verify account is not suspended/deleted
    // 3. Check session validity
    // 4. Potentially use Redis cache for performance
    
    return true; // Assume user is active for now
  } catch (error) {
    logger.error('Error validating user status:', error);
    return false;
  }
}

/**
 * Role-based authorization middleware
 * Checks if user has required roles
 */
export const requireRoles = (requiredRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'User authentication required'
        }
      });
      return;
    }

    const userRoles = req.user.roles || [];
    const hasRequiredRole = requiredRoles.some(role => userRoles.includes(role));

    if (!hasRequiredRole) {
      res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PRIVILEGES',
          message: `Required roles: ${requiredRoles.join(', ')}`
        }
      });
      return;
    }

    next();
  };
};

/**
 * Permission-based authorization middleware
 * Checks if user has required permissions
 */
export const requirePermissions = (requiredPermissions: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'User authentication required'
        }
      });
      return;
    }

    const userPermissions = req.user.permissions || [];
    const hasAllPermissions = requiredPermissions.every(permission => 
      userPermissions.includes(permission)
    );

    if (!hasAllPermissions) {
      res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: `Required permissions: ${requiredPermissions.join(', ')}`
        }
      });
      return;
    }

    next();
  };
};

/**
 * Optional authentication middleware
 * Sets user context if valid token is provided, but doesn't require it
 */
export const optionalAuthMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const jwtSecret = process.env.JWT_SECRET;
      
      if (jwtSecret) {
        try {
          const decoded: any = jwt.verify(token, jwtSecret);
          const { userId, email, roles = [], permissions = [] } = decoded;
          
          if (userId) {
            req.user = {
              id: userId,
              email: email,
              roles: Array.isArray(roles) ? roles : [],
              permissions: Array.isArray(permissions) ? permissions : []
            };
          }
        } catch (jwtError) {
          // Ignore invalid tokens for optional auth
          logger.debug('Invalid token in optional auth:', jwtError);
        }
      }
    }
    
    next();
  } catch (error) {
    logger.error('Optional auth middleware error:', error);
    next(); // Continue even if auth fails
  }
};