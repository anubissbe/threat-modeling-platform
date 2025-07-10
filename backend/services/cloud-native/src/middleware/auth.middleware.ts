import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { CloudNativeRequest } from '../types/cloud-native';
import { logger } from '../utils/logger';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
        timestamp: new Date(),
        requestId: (req as CloudNativeRequest).requestId
      });
      return;
    }

    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    (req as CloudNativeRequest).user = {
      id: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      permissions: decoded.permissions || []
    };

    next();
  } catch (error) {
    logger.error('Authentication failed', error);
    
    res.status(401).json({
      success: false,
      error: 'Invalid or expired token',
      timestamp: new Date(),
      requestId: (req as CloudNativeRequest).requestId
    });
  }
}