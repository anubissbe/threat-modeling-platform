import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import { UserService } from '../services/user.service';
import { UserRole } from '../types/auth';
import { logger } from '../utils/logger';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: UserRole;
        organization: string;
      };
    }
  }
}

export function authenticateToken(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    res.status(401).json({ error: 'Access token required' });
    return;
  }

  const payload = verifyAccessToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }

  req.user = {
    id: payload.userId,
    email: payload.email,
    role: payload.role,
    organization: payload.organization,
  };

  next();
}

export function requireRole(...roles: UserRole[]) {
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

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  return requireRole(UserRole.ADMIN)(req, res, next);
}

export function requireSecurityAnalyst(req: Request, res: Response, next: NextFunction): void {
  return requireRole(UserRole.ADMIN, UserRole.SECURITY_ANALYST)(req, res, next);
}

export async function validateUserExists(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  try {
    const userService = new UserService();
    const user = await userService.getUserById(req.user.id);
    
    if (!user || !user.isActive) {
      res.status(401).json({ error: 'User account not found or inactive' });
      return;
    }

    next();
  } catch (error) {
    logger.error('Error validating user existence:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}