import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';

interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  organization: string;
  iat: number;
  exp: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
        organization: string;
      };
    }
  }
}

export function authenticateToken(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: 'Access token required' });
    return;
  }

  try {
    const secret = process.env.JWT_SECRET || 'your-jwt-secret';
    const payload = jwt.verify(token, secret) as JWTPayload;
    
    req.user = {
      id: payload.userId,
      email: payload.email,
      role: payload.role,
      organization: payload.organization,
    };

    next();
  } catch (error) {
    logger.warn('Invalid token:', error);
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({ 
        error: 'Insufficient permissions',
        required: roles,
        current: req.user.role 
      });
      return;
    }

    next();
  };
}