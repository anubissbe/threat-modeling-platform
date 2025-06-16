import { z } from 'zod';

export const createProjectSchema = z.object({
  name: z.string()
    .min(1, 'Project name is required')
    .max(100, 'Project name must be less than 100 characters'),
  description: z.string()
    .min(10, 'Description must be at least 10 characters')
    .max(1000, 'Description must be less than 1000 characters'),
  metadata: z.object({
    industry: z.string().optional(),
    compliance_requirements: z.array(z.string()).optional(),
    technology_stack: z.array(z.string()).optional(),
    deployment_environment: z.string().optional(),
    tags: z.array(z.string()).optional(),
    custom_fields: z.record(z.any()).optional(),
  }).optional(),
});

export const updateProjectSchema = z.object({
  name: z.string()
    .min(1, 'Project name is required')
    .max(100, 'Project name must be less than 100 characters')
    .optional(),
  description: z.string()
    .min(10, 'Description must be at least 10 characters')
    .max(1000, 'Description must be less than 1000 characters')
    .optional(),
  status: z.enum(['active', 'in_review', 'completed', 'archived']).optional(),
  risk_level: z.enum(['critical', 'high', 'medium', 'low', 'info']).optional(),
  metadata: z.object({
    industry: z.string().optional(),
    compliance_requirements: z.array(z.string()).optional(),
    technology_stack: z.array(z.string()).optional(),
    deployment_environment: z.string().optional(),
    tags: z.array(z.string()).optional(),
    custom_fields: z.record(z.any()).optional(),
  }).optional(),
});

export function validateRequest<T>(schema: z.ZodSchema<T>) {
  return (req: any, res: any, next: any) => {
    try {
      const validatedData = schema.parse(req.body);
      req.validatedData = validatedData;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessages = error.errors.map(err => 
          `${err.path.join('.')}: ${err.message}`
        );
        
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errorMessages,
        });
      }
      
      next(error);
    }
  };
}