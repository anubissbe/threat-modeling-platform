import { Request, Response, NextFunction } from 'express';
import { CloudNativeRequest } from '../types/cloud-native';

/**
 * Type assertion wrapper for CloudNativeRequest handlers
 */
export function wrapCloudNativeHandler(
  handler: (req: CloudNativeRequest, res: Response) => Promise<void>
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await handler(req as CloudNativeRequest, res);
    } catch (error) {
      next(error);
    }
  };
}