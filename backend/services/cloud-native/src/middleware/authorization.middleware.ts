import { Request, Response, NextFunction } from 'express';
import { CloudNativeRequest } from '../types/cloud-native';
import { logger } from '../utils/logger';

export function authorize(roles: string[]) {
  return async function(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = (req as CloudNativeRequest).user;
      
      if (!user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
          timestamp: new Date(),
          requestId: (req as CloudNativeRequest).requestId
        });
        return;
      }

      if (!roles.includes(user.role)) {
        res.status(403).json({
          success: false,
          error: 'Insufficient permissions',
          timestamp: new Date(),
          requestId: (req as CloudNativeRequest).requestId
        });
        return;
      }

      next();
    } catch (error) {
      logger.error('Authorization failed', error);
      
      res.status(500).json({
        success: false,
        error: 'Authorization error',
        timestamp: new Date(),
        requestId: (req as CloudNativeRequest).requestId
      });
    }
  };
}