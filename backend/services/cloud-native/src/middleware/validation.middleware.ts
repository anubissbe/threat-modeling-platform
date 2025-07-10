import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { CloudNativeRequest } from '../types/cloud-native';
import { logger } from '../utils/logger';

// Validation schemas
const schemas: Record<string, z.ZodSchema> = {
  deploy: z.object({
    name: z.string().min(1).max(63).regex(/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/),
    namespace: z.string().min(1).max(63).regex(/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/),
    image: z.string().min(1).max(255),
    replicas: z.number().int().min(0).max(100).optional(),
    resources: z.object({
      requests: z.object({
        cpu: z.string().regex(/^\d+m?$/).optional(),
        memory: z.string().regex(/^\d+[KMG]i?$/).optional()
      }).optional(),
      limits: z.object({
        cpu: z.string().regex(/^\d+m?$/).optional(),
        memory: z.string().regex(/^\d+[KMG]i?$/).optional()
      }).optional()
    }).optional(),
    env: z.record(z.string()).optional(),
    ports: z.array(z.number().int().min(1).max(65535)).optional(),
    volumes: z.array(z.object({
      name: z.string().min(1).max(63),
      mountPath: z.string().min(1),
      type: z.enum(['configMap', 'secret', 'persistentVolume']),
      source: z.string().min(1)
    })).optional()
  }),
  
  scale: z.object({
    name: z.string().min(1).max(63).regex(/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/),
    namespace: z.string().min(1).max(63).regex(/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/),
    replicas: z.number().int().min(0).max(100)
  }),
  
  rollout: z.object({
    name: z.string().min(1).max(63).regex(/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/),
    namespace: z.string().min(1).max(63).regex(/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/),
    image: z.string().min(1).max(255),
    strategy: z.enum(['rolling', 'blue-green', 'canary']).optional(),
    canaryWeight: z.number().int().min(0).max(100).optional()
  }),
  
  'docker-build': z.object({
    dockerfile: z.string().min(1),
    context: z.string().min(1),
    tag: z.string().min(1).max(128),
    buildArgs: z.record(z.string()).optional()
  }),
  
  'docker-push': z.object({
    tag: z.string().min(1).max(128)
  }),
  
  manifest: z.object({
    yaml: z.string().min(1)
  })
};

export function validateRequest(schemaName: string) {
  return async function(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const schema = schemas[schemaName];
      
      if (!schema) {
        logger.error(`Validation schema not found: ${schemaName}`);
        next();
        return;
      }

      const validatedData = schema.parse(req.body);
      req.body = validatedData;
      
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.warn('Validation failed', error.errors);
        
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: error.errors,
          timestamp: new Date(),
          requestId: (req as CloudNativeRequest).requestId
        });
      } else {
        logger.error('Validation error', error);
        
        res.status(500).json({
          success: false,
          error: 'Validation error',
          timestamp: new Date(),
          requestId: (req as CloudNativeRequest).requestId
        });
      }
    }
  };
}