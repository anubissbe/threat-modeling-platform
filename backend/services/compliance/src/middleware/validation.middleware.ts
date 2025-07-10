import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { logger } from '../utils/logger';

export function validateRequest(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const validationErrors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code
        }));

        logger.warn('Validation failed:', { errors: validationErrors, body: req.body });

        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validationErrors
        });
      } else {
        logger.error('Unexpected validation error:', error);
        res.status(500).json({
          success: false,
          error: 'Internal validation error'
        });
      }
    }
  };
}