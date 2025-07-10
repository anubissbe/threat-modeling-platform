import { z } from 'zod';
import {
  SecurityToolType,
  SIEMPlatform,
  VulnerabilityScanner,
  CloudPlatform,
  TicketingPlatform,
  SyncDirection,
  SeverityLevel,
  AssessmentType,
  ComplianceFramework
} from '../types/security-tools';

// Enum schemas
const SecurityToolTypeSchema = z.enum([
  'siem',
  'vulnerability-scanner',
  'cloud-security',
  'ticketing',
  'soar',
  'threat-intelligence',
  'endpoint-protection',
  'network-security'
]);

const SIEMPlatformSchema = z.enum([
  'splunk',
  'qradar',
  'elastic',
  'sentinel',
  'chronicle',
  'sumologic',
  'custom'
]);

const VulnerabilityScannerSchema = z.enum([
  'nessus',
  'qualys',
  'rapid7',
  'openvas',
  'acunetix',
  'burp',
  'custom'
]);

const CloudPlatformSchema = z.enum([
  'aws',
  'azure',
  'gcp',
  'alibaba',
  'oracle',
  'ibm'
]);

const TicketingPlatformSchema = z.enum([
  'jira',
  'servicenow',
  'remedy',
  'zendesk',
  'freshservice',
  'custom'
]);

const SyncDirectionSchema = z.enum(['inbound', 'outbound', 'bidirectional']);
const SeverityLevelSchema = z.enum(['critical', 'high', 'medium', 'low', 'info']);

// Connection configuration schemas
const ProxyConfigSchema = z.object({
  host: z.string(),
  port: z.number().min(1).max(65535),
  protocol: z.enum(['http', 'https', 'socks5']),
  auth: z.object({
    username: z.string(),
    password: z.string()
  }).optional()
});

const ConnectionConfigSchema = z.object({
  endpoint: z.string().url(),
  authType: z.enum(['api-key', 'oauth2', 'basic', 'token', 'certificate']),
  credentials: z.record(z.string()),
  timeout: z.number().min(1).max(300).optional(),
  retryAttempts: z.number().min(0).max(10).optional(),
  sslVerify: z.boolean().optional(),
  proxyConfig: ProxyConfigSchema.optional(),
  customHeaders: z.record(z.string()).optional()
});

// Sync configuration schemas
const SyncFilterSchema = z.object({
  timeRange: z.object({
    start: z.date(),
    end: z.date()
  }).optional(),
  severities: z.array(SeverityLevelSchema).optional(),
  categories: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  customFilters: z.record(z.any()).optional()
});

const FieldMappingSchema = z.object({
  sourceField: z.string(),
  targetField: z.string(),
  transformation: z.enum(['direct', 'uppercase', 'lowercase', 'date', 'custom']).optional(),
  transformFunction: z.string().optional(),
  required: z.boolean(),
  defaultValue: z.any().optional()
});

const SeverityMappingSchema = z.object({
  critical: z.array(z.string()),
  high: z.array(z.string()),
  medium: z.array(z.string()),
  low: z.array(z.string()),
  info: z.array(z.string())
});

// Integration features schema
const IntegrationFeaturesSchema = z.object({
  alertIngestion: z.boolean(),
  eventCorrelation: z.boolean(),
  ticketCreation: z.boolean(),
  bidirectionalSync: z.boolean(),
  automatedResponse: z.boolean(),
  customWebhooks: z.boolean(),
  bulkOperations: z.boolean(),
  realTimeStreaming: z.boolean()
});

// API Request Schemas
export const CreateIntegrationRequestSchema = z.object({
  name: z.string().min(1).max(255),
  type: SecurityToolTypeSchema,
  platform: z.string(),
  description: z.string().max(1000).optional(),
  connectionConfig: ConnectionConfigSchema.omit({ credentials: true }).extend({
    credentials: z.record(z.string())
  }),
  syncConfig: z.object({
    enabled: z.boolean(),
    direction: SyncDirectionSchema,
    interval: z.number().min(5).max(1440).optional(), // 5 minutes to 24 hours
    filter: SyncFilterSchema.optional()
  }).optional(),
  fieldMappings: z.array(FieldMappingSchema).optional(),
  severityMapping: SeverityMappingSchema.optional()
});

export const UpdateIntegrationRequestSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  connectionConfig: ConnectionConfigSchema.partial().optional(),
  syncEnabled: z.boolean().optional(),
  syncInterval: z.number().min(5).max(1440).optional(),
  syncFilter: SyncFilterSchema.optional(),
  fieldMappings: z.array(FieldMappingSchema).optional(),
  severityMapping: SeverityMappingSchema.optional()
});

export const TestConnectionRequestSchema = z.object({
  type: SecurityToolTypeSchema,
  platform: z.string(),
  connectionConfig: ConnectionConfigSchema.omit({ credentials: true }).extend({
    credentials: z.record(z.string())
  })
});

export const SyncRequestSchema = z.object({
  integrationId: z.string().uuid(),
  fullSync: z.boolean().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional()
});

export const CorrelateEventsRequestSchema = z.object({
  timeRange: z.object({
    start: z.string().datetime(),
    end: z.string().datetime()
  }),
  sources: z.array(SecurityToolTypeSchema).optional(),
  severities: z.array(SeverityLevelSchema).optional(),
  correlationRules: z.array(z.string()).optional()
});

export const CreateTicketRequestSchema = z.object({
  threatId: z.string().uuid().optional(),
  vulnerabilityId: z.string().optional(),
  findingId: z.string().optional(),
  integrationId: z.string().uuid(),
  ticketData: z.object({
    title: z.string().min(1).max(500),
    description: z.string().min(1).max(50000),
    priority: z.string(),
    assignee: z.string().optional(),
    customFields: z.record(z.any()).optional()
  })
}).refine(
  data => data.threatId || data.vulnerabilityId || data.findingId,
  "At least one of threatId, vulnerabilityId, or findingId must be provided"
);

// Correlation Engine Schemas
const RuleConditionSchema = z.object({
  field: z.string(),
  operator: z.string(),
  value: z.any(),
  caseInsensitive: z.boolean().optional()
});

const RuleAggregationSchema = z.object({
  field: z.string(),
  function: z.enum(['count', 'sum', 'avg', 'min', 'max', 'unique']),
  groupBy: z.array(z.string()).optional(),
  having: RuleConditionSchema.optional()
});

const CorrelationActionSchema = z.object({
  type: z.enum(['create-threat', 'update-threat', 'create-ticket', 'send-alert', 'execute-playbook']),
  parameters: z.record(z.any())
});

export const CorrelationEngineRuleSchema = z.object({
  id: z.string(),
  name: z.string(),
  enabled: z.boolean(),
  sourceTypes: z.array(SecurityToolTypeSchema),
  conditions: z.array(RuleConditionSchema),
  aggregations: z.array(RuleAggregationSchema).optional(),
  severity: SeverityLevelSchema,
  tags: z.array(z.string()),
  actions: z.array(CorrelationActionSchema)
});

export const CreateCorrelationEngineSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000),
  rules: z.array(CorrelationEngineRuleSchema),
  correlationWindow: z.number().min(1).max(1440), // minutes
  lookbackPeriod: z.number().min(1).max(2880), // minutes
  deduplicationEnabled: z.boolean(),
  deduplicationFields: z.array(z.string()),
  enrichmentSources: z.array(z.object({
    type: z.enum(['threat-intel', 'asset-db', 'user-db', 'geo-ip', 'custom']),
    name: z.string(),
    config: z.record(z.any())
  })),
  outputFormat: z.enum(['unified-threat', 'custom']),
  outputDestinations: z.array(z.object({
    type: z.enum(['database', 'siem', 'webhook', 'message-queue']),
    config: z.record(z.any())
  }))
});

// SIEM-specific schemas
export const SIEMEventQuerySchema = z.object({
  query: z.string(),
  timeRange: z.object({
    start: z.date(),
    end: z.date()
  }).optional(),
  limit: z.number().min(1).max(10000).optional(),
  fields: z.array(z.string()).optional()
});

export const CreateSIEMAlertSchema = z.object({
  name: z.string(),
  query: z.string(),
  timeWindow: z.number().min(1).max(1440), // minutes
  threshold: z.number().min(1),
  severity: SeverityLevelSchema,
  actions: z.array(z.object({
    type: z.enum(['email', 'webhook', 'script', 'ticket']),
    parameters: z.record(z.any())
  }))
});

// Vulnerability Scanner schemas
export const CreateScanPolicySchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  scanType: z.enum(['network', 'web-app', 'compliance', 'configuration']),
  targets: z.array(z.string()).min(1),
  schedule: z.object({
    frequency: z.enum(['once', 'daily', 'weekly', 'monthly']),
    time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    dayOfWeek: z.number().min(0).max(6).optional(),
    dayOfMonth: z.number().min(1).max(31).optional(),
    timezone: z.string().optional()
  }).optional(),
  credentialSets: z.array(z.string()).optional(),
  pluginSets: z.array(z.string()).optional()
});

export const VulnerabilityScanRequestSchema = z.object({
  scanPolicyId: z.string(),
  targets: z.array(z.string()).optional(),
  immediate: z.boolean().optional()
});

// Cloud Security schemas
export const CloudAccountSchema = z.object({
  accountId: z.string(),
  accountName: z.string(),
  environment: z.enum(['production', 'staging', 'development', 'test']),
  tags: z.record(z.string()).optional()
});

export const CloudRemediationConfigSchema = z.object({
  enabled: z.boolean(),
  approvalRequired: z.boolean(),
  allowedActions: z.array(z.string()),
  excludedResources: z.array(z.string()),
  maxRemediationsPerHour: z.number().min(1).max(100)
});

// Ticketing schemas
export const TicketingProjectSchema = z.object({
  projectId: z.string(),
  projectKey: z.string(),
  projectName: z.string(),
  defaultAssignee: z.string().optional(),
  components: z.array(z.string()).optional(),
  versions: z.array(z.string()).optional()
});

export const AutomationRuleSchema = z.object({
  name: z.string(),
  trigger: z.object({
    type: z.enum(['threat-created', 'threat-updated', 'severity-change', 'vulnerability-linked', 'schedule']),
    parameters: z.record(z.any()).optional()
  }),
  conditions: z.array(z.object({
    field: z.string(),
    operator: z.string(),
    value: z.any()
  })),
  actions: z.array(z.object({
    type: z.enum(['create-ticket', 'update-ticket', 'add-comment', 'change-status', 'assign', 'link']),
    parameters: z.record(z.any())
  })),
  enabled: z.boolean()
});

// Dashboard query schemas
export const DashboardQuerySchema = z.object({
  timeRange: z.object({
    start: z.string().datetime(),
    end: z.string().datetime()
  }).optional(),
  toolTypes: z.array(SecurityToolTypeSchema).optional(),
  integrationIds: z.array(z.string().uuid()).optional(),
  metrics: z.array(z.enum([
    'risk-score',
    'threat-count',
    'vulnerability-count',
    'finding-count',
    'ticket-count',
    'correlation-metrics',
    'integration-health'
  ])).optional()
});

// Webhook configuration schema
export const WebhookConfigSchema = z.object({
  url: z.string().url(),
  events: z.array(z.enum([
    'integration.connected',
    'integration.disconnected',
    'integration.error',
    'sync.started',
    'sync.completed',
    'sync.failed',
    'threat.detected',
    'threat.correlated',
    'vulnerability.discovered',
    'finding.created',
    'ticket.created',
    'ticket.updated',
    'alert.triggered'
  ])),
  headers: z.record(z.string()).optional(),
  secret: z.string().optional(),
  enabled: z.boolean(),
  retryAttempts: z.number().min(0).max(5),
  retryDelay: z.number().min(1).max(60) // seconds
});

// Response schemas
export const IntegrationResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  type: SecurityToolTypeSchema,
  platform: z.string(),
  description: z.string().optional(),
  status: z.enum(['connected', 'disconnected', 'error', 'configuring', 'testing']),
  lastConnected: z.date().optional(),
  lastSync: z.date().optional(),
  syncEnabled: z.boolean(),
  syncDirection: SyncDirectionSchema,
  syncInterval: z.number().optional(),
  features: IntegrationFeaturesSchema,
  createdBy: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  version: z.string()
});

export const UnifiedThreatResponseSchema = z.object({
  id: z.string().uuid(),
  correlationId: z.string(),
  title: z.string(),
  description: z.string(),
  severity: SeverityLevelSchema,
  confidence: z.number().min(0).max(100),
  firstSeen: z.date(),
  lastSeen: z.date(),
  eventCount: z.number(),
  affectedAssets: z.array(z.string()),
  affectedUsers: z.array(z.string()).optional(),
  businessImpact: z.string().optional(),
  status: z.enum(['active', 'investigating', 'contained', 'resolved']),
  riskScore: z.number().min(0).max(100),
  riskFactors: z.array(z.object({
    factor: z.string(),
    weight: z.number(),
    description: z.string()
  }))
});

export const SecurityTicketResponseSchema = z.object({
  id: z.string(),
  externalId: z.string(),
  platform: TicketingPlatformSchema,
  title: z.string(),
  description: z.string(),
  type: z.string(),
  priority: z.string(),
  severity: SeverityLevelSchema,
  assignee: z.string().optional(),
  reporter: z.string(),
  status: z.string(),
  resolution: z.string().optional(),
  linkedThreats: z.array(z.string()),
  linkedVulnerabilities: z.array(z.string()),
  linkedFindings: z.array(z.string()),
  linkedTickets: z.array(z.string()),
  createdAt: z.date(),
  updatedAt: z.date(),
  dueDate: z.date().optional(),
  resolvedAt: z.date().optional(),
  slaStatus: z.enum(['on-track', 'at-risk', 'breached']).optional(),
  timeToResolution: z.number().optional()
});

// Error schema
export const SecurityToolErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  toolType: SecurityToolTypeSchema.optional(),
  platform: z.string().optional(),
  integrationId: z.string().uuid().optional(),
  details: z.record(z.any()).optional(),
  timestamp: z.date()
});