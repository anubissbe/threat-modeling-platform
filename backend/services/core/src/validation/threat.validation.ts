import { z } from 'zod';

export const createThreatSchema = z.object({
  threat_model_id: z.string().uuid('Invalid threat model ID'),
  name: z.string()
    .min(1, 'Threat name is required')
    .max(200, 'Threat name must be less than 200 characters'),
  description: z.string()
    .min(10, 'Description must be at least 10 characters')
    .max(2000, 'Description must be less than 2000 characters'),
  category: z.string()
    .min(1, 'Category is required')
    .max(50, 'Category must be less than 50 characters'),
  severity: z.enum(['critical', 'high', 'medium', 'low', 'info']).optional(),
  likelihood: z.enum(['very_high', 'high', 'medium', 'low', 'very_low']).optional(),
  status: z.enum(['identified', 'analyzing', 'mitigating', 'mitigated', 'accepted', 'transferred']).optional(),
  affected_assets: z.array(z.string()).optional(),
  threat_actors: z.array(z.string()).optional(),
  methodology_specific: z.record(z.any()).optional(),
});

export const updateThreatSchema = z.object({
  name: z.string()
    .min(1, 'Threat name is required')
    .max(200, 'Threat name must be less than 200 characters')
    .optional(),
  description: z.string()
    .min(10, 'Description must be at least 10 characters')
    .max(2000, 'Description must be less than 2000 characters')
    .optional(),
  category: z.string()
    .min(1, 'Category is required')
    .max(50, 'Category must be less than 50 characters')
    .optional(),
  severity: z.enum(['critical', 'high', 'medium', 'low', 'info']).optional(),
  likelihood: z.enum(['very_high', 'high', 'medium', 'low', 'very_low']).optional(),
  status: z.enum(['identified', 'analyzing', 'mitigating', 'mitigated', 'accepted', 'transferred']).optional(),
  affected_assets: z.array(z.string()).optional(),
  threat_actors: z.array(z.string()).optional(),
  methodology_specific: z.record(z.any()).optional(),
});

export const createMitigationSchema = z.object({
  name: z.string()
    .min(1, 'Mitigation name is required')
    .max(200, 'Mitigation name must be less than 200 characters'),
  description: z.string()
    .min(10, 'Description must be at least 10 characters')
    .max(2000, 'Description must be less than 2000 characters'),
  type: z.enum(['preventive', 'detective', 'corrective', 'deterrent', 'compensating']),
  effectiveness: z.enum(['very_high', 'high', 'medium', 'low', 'very_low']),
  cost: z.enum(['very_high', 'high', 'medium', 'low', 'very_low']).optional(),
  implementation_effort: z.enum(['very_high', 'high', 'medium', 'low', 'very_low']).optional(),
  status: z.enum(['proposed', 'approved', 'in_progress', 'implemented', 'verified', 'rejected']).optional(),
  assigned_to: z.string().optional(),
});

export const suggestThreatsSchema = z.object({
  threat_model_id: z.string().uuid('Invalid threat model ID'),
  methodology: z.enum(['STRIDE', 'PASTA', 'LINDDUN', 'VAST', 'DREAD', 'OCTAVE', 'TRIKE', 'CUSTOM']),
  context: z.object({
    assets: z.array(z.object({
      id: z.string(),
      name: z.string(),
      type: z.string(),
      sensitivity: z.string(),
    })).optional(),
    actors: z.array(z.object({
      id: z.string(),
      name: z.string(),
      type: z.string(),
      trust_level: z.string(),
    })).optional(),
    data_flows: z.array(z.object({
      id: z.string(),
      source: z.string(),
      destination: z.string(),
      encryption: z.string().optional(),
    })).optional(),
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