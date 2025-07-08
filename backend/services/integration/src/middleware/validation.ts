import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, z } from 'zod';
import { ValidationError } from './error-handler';

export function validateRequest(schema: AnyZodObject) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const details = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
        }));
        
        next(new ValidationError('Validation failed', details));
      } else {
        next(error);
      }
    }
  };
}

export function validateBody(schema: z.ZodSchema) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      req.body = await schema.parseAsync(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const details = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
        }));
        
        next(new ValidationError('Request body validation failed', details));
      } else {
        next(error);
      }
    }
  };
}

export function validateQuery(schema: z.ZodSchema) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      req.query = await schema.parseAsync(req.query);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const details = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
        }));
        
        next(new ValidationError('Query parameters validation failed', details));
      } else {
        next(error);
      }
    }
  };
}

export function validateParams(schema: z.ZodSchema) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      req.params = await schema.parseAsync(req.params);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const details = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
        }));
        
        next(new ValidationError('Route parameters validation failed', details));
      } else {
        next(error);
      }
    }
  };
}