import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { InfrastructureRequest } from '../types/infrastructure';

export function requestMiddleware(req: Request, res: Response, next: NextFunction): void {
  const infraReq = req as InfrastructureRequest;
  
  // Add request ID
  infraReq.requestId = uuidv4();
  
  // Add timestamp
  infraReq.startTime = new Date();
  
  // Add client IP
  infraReq.clientIp = req.ip || req.connection.remoteAddress || 'unknown';
  
  // Add user agent
  infraReq.userAgent = req.get('user-agent') || 'unknown';
  
  // Add request ID to response headers
  res.setHeader('X-Request-ID', infraReq.requestId);
  
  next();
}