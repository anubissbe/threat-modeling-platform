import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';
import { InfrastructureRequest } from '../types/infrastructure';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const infraReq = req as InfrastructureRequest;
  
  // Skip auth for health check
  if (req.path === '/health') {
    return next();
  }

  const token = req.header('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    logger.warn('Authentication failed: No token provided', { 
      path: req.path, 
      ip: infraReq.clientIp 
    });
    
    res.status(401).json({
      success: false,
      error: 'Access denied. No token provided.',
      timestamp: new Date(),
      requestId: infraReq.requestId
    });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    infraReq.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role || 'user',
      permissions: decoded.permissions || []
    };
    
    next();
  } catch (error) {
    logger.warn('Authentication failed: Invalid token', { 
      path: req.path, 
      ip: infraReq.clientIp,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    res.status(401).json({
      success: false,
      error: 'Invalid token.',
      timestamp: new Date(),
      requestId: infraReq.requestId
    });
  }
}