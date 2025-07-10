import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    organization: string;
  };
}

export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      res.status(401).json({
        success: false,
        error: 'Authorization header required'
      });
      return;
    }

    const token = authHeader.split(' ')[1]; // Bearer TOKEN
    
    if (!token) {
      res.status(401).json({
        success: false,
        error: 'Token required'
      });
      return;
    }

    // For development, use a simple secret. In production, use proper JWT configuration
    const secret = process.env.JWT_SECRET || 'compliance-service-secret';
    
    try {
      const decoded = jwt.verify(token, secret) as any;
      
      req.user = {
        id: decoded.userId || decoded.id,
        email: decoded.email,
        role: decoded.role,
        organization: decoded.organization
      };
      
      next();
    } catch (jwtError) {
      logger.warn('Invalid JWT token:', jwtError);
      res.status(401).json({
        success: false,
        error: 'Invalid token'
      });
      return;
    }
  } catch (error) {
    logger.error('Authentication middleware error:', error);
    res.status(500).json({
      success: false,
      error: 'Authentication failed'
    });
  }
}

export function requireRole(allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        required: allowedRoles,
        current: req.user.role
      });
      return;
    }

    next();
  };
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  return requireRole(['admin', 'compliance_officer'])(req, res, next);
}

export function requireComplianceOfficer(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  return requireRole(['admin', 'compliance_officer', 'security_analyst'])(req, res, next);
}