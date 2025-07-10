import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { logger } from '../utils/logger';
import { InfrastructureRequest } from '../types/infrastructure';

export function validateRequest(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const infraReq = req as InfrastructureRequest;
    
    try {
      schema.parse(req.body);
      next();
    } catch (error: any) {
      logger.warn('Request validation failed', {
        path: req.path,
        body: req.body,
        error: error.errors,
        requestId: infraReq.requestId
      });
      
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.errors,
        timestamp: new Date(),
        requestId: infraReq.requestId
      });
    }
  };
}