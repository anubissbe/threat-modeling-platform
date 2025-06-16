import { z } from 'zod';

const assetSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['data', 'application', 'service', 'infrastructure', 'physical']),
  description: z.string(),
  sensitivity: z.enum(['public', 'internal', 'confidential', 'secret', 'top_secret']),
  location: z.string().optional(),
  owner: z.string().optional(),
});

const actorSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['user', 'admin', 'system', 'external_system', 'attacker']),
  description: z.string(),
  trust_level: z.enum(['untrusted', 'partially_trusted', 'trusted', 'highly_trusted']),
  capabilities: z.array(z.string()).optional(),
});

const dataFlowSchema = z.object({
  id: z.string(),
  name: z.string(),
  source: z.string(),
  destination: z.string(),
  protocol: z.string().optional(),
  data_classification: z.enum(['public', 'internal', 'confidential', 'secret', 'top_secret']),
  authentication: z.string().optional(),
  encryption: z.string().optional(),
});

const scopeSchema = z.object({
  systems: z.array(z.string()).min(1, 'At least one system must be defined'),
  boundaries: z.array(z.string()),
  assets: z.array(assetSchema),
  actors: z.array(actorSchema),
  data_flows: z.array(dataFlowSchema),
});

export const createThreatModelSchema = z.object({
  project_id: z.string().uuid('Invalid project ID'),
  name: z.string()
    .min(1, 'Threat model name is required')
    .max(100, 'Threat model name must be less than 100 characters'),
  description: z.string()
    .min(10, 'Description must be at least 10 characters')
    .max(1000, 'Description must be less than 1000 characters'),
  methodology: z.enum(['STRIDE', 'PASTA', 'LINDDUN', 'VAST', 'DREAD', 'OCTAVE', 'TRIKE', 'CUSTOM']),
  scope: scopeSchema,
  assumptions: z.array(z.string()).optional(),
  metadata: z.object({
    tags: z.array(z.string()).optional(),
    reviewers: z.array(z.string()).optional(),
    approvers: z.array(z.string()).optional(),
    references: z.array(z.string()).optional(),
    compliance_mapping: z.record(z.array(z.string())).optional(),
    custom_fields: z.record(z.any()).optional(),
  }).optional(),
});

export const updateThreatModelSchema = z.object({
  name: z.string()
    .min(1, 'Threat model name is required')
    .max(100, 'Threat model name must be less than 100 characters')
    .optional(),
  description: z.string()
    .min(10, 'Description must be at least 10 characters')
    .max(1000, 'Description must be less than 1000 characters')
    .optional(),
  version: z.string().optional(),
  status: z.enum(['draft', 'in_review', 'approved', 'published', 'deprecated']).optional(),
  scope: scopeSchema.optional(),
  assumptions: z.array(z.string()).optional(),
  architecture_diagram: z.string().optional(),
  data_flow_diagram: z.string().optional(),
  metadata: z.object({
    tags: z.array(z.string()).optional(),
    reviewers: z.array(z.string()).optional(),
    approvers: z.array(z.string()).optional(),
    references: z.array(z.string()).optional(),
    compliance_mapping: z.record(z.array(z.string())).optional(),
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