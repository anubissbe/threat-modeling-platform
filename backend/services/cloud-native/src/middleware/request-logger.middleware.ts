import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { CloudNativeRequest } from '../types/cloud-native';
import { logger } from '../utils/logger';

export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const requestId = uuidv4();
  const startTime = new Date();
  
  // Add request metadata
  (req as CloudNativeRequest).requestId = requestId;
  (req as CloudNativeRequest).startTime = startTime;
  
  // Log request
  logger.info('Incoming request', {
    requestId,
    method: req.method,
    path: req.path,
    query: req.query,
    ip: req.ip,
    userAgent: req.get('user-agent')
  });
  
  // Log response
  const originalSend = res.send;
  res.send = function(data: any): Response {
    const duration = Date.now() - startTime.getTime();
    
    logger.info('Request completed', {
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`
    });
    
    return originalSend.call(this, data);
  };
  
  next();
}