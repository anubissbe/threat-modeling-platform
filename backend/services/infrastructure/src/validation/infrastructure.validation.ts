import { z } from 'zod';

export const scaleRequestSchema = z.object({
  service: z.string().min(1, 'Service name is required'),
  instances: z.number().min(1, 'Instances must be at least 1'),
  force: z.boolean().optional(),
  reason: z.string().optional()
});

export const addServerSchema = z.object({
  host: z.string().min(1, 'Host is required'),
  port: z.number().min(1, 'Port must be at least 1').max(65535, 'Port must be less than 65536'),
  weight: z.number().min(1, 'Weight must be at least 1').optional()
});

export const maintenanceSchema = z.object({
  maintenance: z.boolean()
});

export const setCacheValueSchema = z.object({
  value: z.any(),
  ttl: z.number().min(0, 'TTL must be non-negative').optional()
});

export const configUpdateSchema = z.object({
  service: z.string().min(1, 'Service name is required'),
  config: z.object({}).passthrough(),
  restart: z.boolean().optional()
});

export const createMaintenanceWindowSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  startTime: z.string().datetime('Start time must be a valid datetime'),
  endTime: z.string().datetime('End time must be a valid datetime'),
  services: z.array(z.string()).min(1, 'At least one service is required'),
  type: z.enum(['planned', 'emergency']),
  impact: z.enum(['none', 'low', 'medium', 'high']),
  notifications: z.boolean().optional().default(true)
});

export const updateMaintenanceWindowSchema = z.object({
  title: z.string().min(1, 'Title is required').optional(),
  description: z.string().min(1, 'Description is required').optional(),
  startTime: z.string().datetime('Start time must be a valid datetime').optional(),
  endTime: z.string().datetime('End time must be a valid datetime').optional(),
  services: z.array(z.string()).min(1, 'At least one service is required').optional(),
  type: z.enum(['planned', 'emergency']).optional(),
  impact: z.enum(['none', 'low', 'medium', 'high']).optional(),
  notifications: z.boolean().optional(),
  status: z.enum(['scheduled', 'active', 'completed', 'cancelled']).optional()
});

export const createBackupJobSchema = z.object({
  type: z.enum(['full', 'incremental', 'differential']),
  destination: z.object({
    type: z.enum(['local', 's3', 'gcs', 'azure']),
    config: z.object({}).passthrough(),
    priority: z.number().min(1).optional().default(1)
  })
});

export const createScalingPolicySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  enabled: z.boolean().optional().default(true),
  minInstances: z.number().min(1, 'Minimum instances must be at least 1'),
  maxInstances: z.number().min(1, 'Maximum instances must be at least 1'),
  rules: z.array(z.object({
    metric: z.string().min(1, 'Metric is required'),
    threshold: z.number(),
    comparison: z.enum(['greater', 'less', 'equal']),
    duration: z.number().min(1, 'Duration must be at least 1'),
    action: z.enum(['scale-up', 'scale-down']),
    adjustment: z.number().min(1, 'Adjustment must be at least 1'),
    adjustmentType: z.enum(['absolute', 'percentage'])
  })).min(1, 'At least one rule is required'),
  cooldown: z.object({
    scaleUp: z.number().min(0, 'Scale up cooldown must be non-negative'),
    scaleDown: z.number().min(0, 'Scale down cooldown must be non-negative')
  })
});

export const updateScalingPolicySchema = z.object({
  name: z.string().min(1, 'Name is required').optional(),
  enabled: z.boolean().optional(),
  minInstances: z.number().min(1, 'Minimum instances must be at least 1').optional(),
  maxInstances: z.number().min(1, 'Maximum instances must be at least 1').optional(),
  rules: z.array(z.object({
    metric: z.string().min(1, 'Metric is required'),
    threshold: z.number(),
    comparison: z.enum(['greater', 'less', 'equal']),
    duration: z.number().min(1, 'Duration must be at least 1'),
    action: z.enum(['scale-up', 'scale-down']),
    adjustment: z.number().min(1, 'Adjustment must be at least 1'),
    adjustmentType: z.enum(['absolute', 'percentage'])
  })).min(1, 'At least one rule is required').optional(),
  cooldown: z.object({
    scaleUp: z.number().min(0, 'Scale up cooldown must be non-negative'),
    scaleDown: z.number().min(0, 'Scale down cooldown must be non-negative')
  }).optional()
});

export const acknowledgeAlertSchema = z.object({
  alertId: z.string().min(1, 'Alert ID is required'),
  acknowledgedBy: z.string().min(1, 'Acknowledged by is required'),
  note: z.string().optional()
});

export const createPerformanceProfileSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  enabled: z.boolean().optional().default(true),
  priority: z.number().min(1, 'Priority must be at least 1').optional().default(1),
  rules: z.array(z.object({
    condition: z.string().min(1, 'Condition is required'),
    action: z.enum(['cache', 'compress', 'throttle', 'redirect', 'block']),
    parameters: z.object({}).passthrough(),
    enabled: z.boolean().optional().default(true)
  })).min(1, 'At least one rule is required')
});

export const updatePerformanceProfileSchema = z.object({
  name: z.string().min(1, 'Name is required').optional(),
  enabled: z.boolean().optional(),
  priority: z.number().min(1, 'Priority must be at least 1').optional(),
  rules: z.array(z.object({
    condition: z.string().min(1, 'Condition is required'),
    action: z.enum(['cache', 'compress', 'throttle', 'redirect', 'block']),
    parameters: z.object({}).passthrough(),
    enabled: z.boolean().optional().default(true)
  })).min(1, 'At least one rule is required').optional()
});

export const serviceRegistrationSchema = z.object({
  name: z.string().min(1, 'Service name is required'),
  version: z.string().min(1, 'Version is required'),
  host: z.string().min(1, 'Host is required'),
  port: z.number().min(1, 'Port must be at least 1').max(65535, 'Port must be less than 65536'),
  tags: z.array(z.string()).optional().default([]),
  metadata: z.object({}).passthrough().optional().default({}),
  health: z.object({
    check: z.string().min(1, 'Health check URL is required'),
    interval: z.string().min(1, 'Health check interval is required'),
    timeout: z.string().min(1, 'Health check timeout is required'),
    ttl: z.string().min(1, 'Health check TTL is required')
  })
});

export const updateServiceRegistrationSchema = z.object({
  name: z.string().min(1, 'Service name is required').optional(),
  version: z.string().min(1, 'Version is required').optional(),
  host: z.string().min(1, 'Host is required').optional(),
  port: z.number().min(1, 'Port must be at least 1').max(65535, 'Port must be less than 65536').optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.object({}).passthrough().optional(),
  health: z.object({
    check: z.string().min(1, 'Health check URL is required'),
    interval: z.string().min(1, 'Health check interval is required'),
    timeout: z.string().min(1, 'Health check timeout is required'),
    ttl: z.string().min(1, 'Health check TTL is required')
  }).optional()
});

export type ScaleRequest = z.infer<typeof scaleRequestSchema>;
export type AddServerRequest = z.infer<typeof addServerSchema>;
export type MaintenanceRequest = z.infer<typeof maintenanceSchema>;
export type SetCacheValueRequest = z.infer<typeof setCacheValueSchema>;
export type ConfigUpdateRequest = z.infer<typeof configUpdateSchema>;
export type CreateMaintenanceWindowRequest = z.infer<typeof createMaintenanceWindowSchema>;
export type UpdateMaintenanceWindowRequest = z.infer<typeof updateMaintenanceWindowSchema>;
export type CreateBackupJobRequest = z.infer<typeof createBackupJobSchema>;
export type CreateScalingPolicyRequest = z.infer<typeof createScalingPolicySchema>;
export type UpdateScalingPolicyRequest = z.infer<typeof updateScalingPolicySchema>;
export type AcknowledgeAlertRequest = z.infer<typeof acknowledgeAlertSchema>;
export type CreatePerformanceProfileRequest = z.infer<typeof createPerformanceProfileSchema>;
export type UpdatePerformanceProfileRequest = z.infer<typeof updatePerformanceProfileSchema>;
export type ServiceRegistrationRequest = z.infer<typeof serviceRegistrationSchema>;
export type UpdateServiceRegistrationRequest = z.infer<typeof updateServiceRegistrationSchema>;