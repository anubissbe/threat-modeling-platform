import { z } from 'zod';

// Compliance framework enum
const complianceFrameworkSchema = z.enum([
  'gdpr', 'hipaa', 'soc2', 'pci-dss', 'iso27001', 'nist', 'cis', 'owasp', 
  'ccpa', 'fedramp', 'sox', 'fisma', 'cobit', 'coso', 'basel', 'swift', 
  'pci-ssp', 'fips', 'common-criteria', 'custom'
]);

const complianceStatusSchema = z.enum([
  'compliant', 'non-compliant', 'partially-compliant', 'not-assessed', 'in-progress', 'remediation-required'
]);

const compliancePrioritySchema = z.enum(['critical', 'high', 'medium', 'low']);

const assessmentTypeSchema = z.enum(['automated', 'manual', 'hybrid', 'external-audit', 'self-assessment']);

// Assessment scope schema
const assessmentScopeSchema = z.object({
  frameworks: z.array(complianceFrameworkSchema).min(1, 'At least one framework is required'),
  controls: z.array(z.string()).optional(),
  assets: z.array(z.string()).optional(),
  threatModels: z.array(z.string()).optional(),
  excludedControls: z.array(z.string()).optional(),
  includeAutomated: z.boolean().default(true),
  includeManual: z.boolean().default(true),
  includeExternalAudit: z.boolean().default(false)
});

// Assessment configuration schema
const assessmentConfigurationSchema = z.object({
  automatedTestsEnabled: z.boolean().default(true),
  evidenceCollectionEnabled: z.boolean().default(true),
  reportGeneration: z.boolean().default(true),
  notificationsEnabled: z.boolean().default(true),
  recurringAssessment: z.boolean().default(false),
  recurringInterval: z.enum(['daily', 'weekly', 'monthly', 'quarterly', 'annually']).optional(),
  requireEvidence: z.boolean().default(false),
  requireReview: z.boolean().default(false),
  requireApproval: z.boolean().default(false),
  customParameters: z.record(z.any()).optional()
});

// Create assessment request schema
export const createAssessmentSchema = z.object({
  name: z.string().min(1, 'Assessment name is required').max(255, 'Name too long'),
  description: z.string().max(1000, 'Description too long').optional(),
  framework: complianceFrameworkSchema,
  scope: assessmentScopeSchema,
  configuration: assessmentConfigurationSchema,
  scheduledDate: z.string().datetime().optional()
});

// Update control request schema
export const updateControlSchema = z.object({
  status: complianceStatusSchema.optional(),
  implementationStatus: z.enum(['not-started', 'in-progress', 'implemented', 'needs-review']).optional(),
  implementationNotes: z.string().max(2000, 'Notes too long').optional(),
  evidence: z.array(z.string()).optional(),
  owner: z.string().max(255, 'Owner name too long').optional(),
  reviewer: z.string().max(255, 'Reviewer name too long').optional(),
  customFields: z.record(z.any()).optional()
});

// Remediation task schema
const remediationTaskSchema = z.object({
  title: z.string().min(1, 'Task title is required').max(255, 'Title too long'),
  description: z.string().max(1000, 'Description too long'),
  priority: compliancePrioritySchema,
  assignedTo: z.string().max(255, 'Assignee name too long').optional(),
  dueDate: z.string().datetime().optional(),
  dependencies: z.array(z.string()).optional(),
  notes: z.string().max(1000, 'Notes too long').optional(),
  estimatedHours: z.number().min(0).max(1000).optional(),
  status: z.enum(['pending', 'in-progress', 'completed', 'blocked']).default('pending')
});

// Create remediation plan request schema
export const createRemediationPlanSchema = z.object({
  controlId: z.string().min(1, 'Control ID is required'),
  title: z.string().min(1, 'Plan title is required').max(255, 'Title too long'),
  description: z.string().max(2000, 'Description too long'),
  priority: compliancePrioritySchema,
  assignedTo: z.string().max(255, 'Assignee name too long').optional(),
  dueDate: z.string().datetime().optional(),
  tasks: z.array(remediationTaskSchema).default([])
});

// Date range schema
const dateRangeSchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime()
}).refine(data => new Date(data.endDate) > new Date(data.startDate), {
  message: 'End date must be after start date'
});

// Generate report request schema
export const generateReportSchema = z.object({
  name: z.string().min(1, 'Report name is required').max(255, 'Name too long'),
  type: z.enum(['assessment', 'gap-analysis', 'remediation', 'executive', 'detailed', 'custom']),
  format: z.enum(['pdf', 'html', 'excel', 'csv', 'json', 'xml']),
  frameworks: z.array(complianceFrameworkSchema).min(1, 'At least one framework is required'),
  assessmentIds: z.array(z.string()).optional(),
  dateRange: dateRangeSchema.optional(),
  includeExecutiveSummary: z.boolean().default(true),
  includeDetailedFindings: z.boolean().default(true),
  includeRecommendations: z.boolean().default(true),
  includeEvidence: z.boolean().default(false),
  recipients: z.array(z.string().email()).optional()
});

// Search controls query schema
export const searchControlsSchema = z.object({
  frameworks: z.array(complianceFrameworkSchema).optional(),
  status: z.array(complianceStatusSchema).optional(),
  priority: z.array(compliancePrioritySchema).optional(),
  categories: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  owner: z.string().optional(),
  reviewer: z.string().optional(),
  lastAssessedBefore: z.string().datetime().optional(),
  lastAssessedAfter: z.string().datetime().optional(),
  implementationStatus: z.array(z.enum(['not-started', 'in-progress', 'implemented', 'needs-review'])).optional(),
  riskLevel: z.array(z.enum(['low', 'medium', 'high', 'critical'])).optional(),
  searchTerm: z.string().optional(),
  sortBy: z.enum(['priority', 'status', 'lastAssessed', 'title', 'framework']).optional(),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
  limit: z.number().min(1).max(1000).default(50),
  offset: z.number().min(0).default(0)
});

// Evidence upload schema
export const uploadEvidenceSchema = z.object({
  controlId: z.string().min(1, 'Control ID is required'),
  assessmentId: z.string().min(1, 'Assessment ID is required'),
  type: z.enum(['document', 'screenshot', 'configuration', 'log', 'test-result', 'certificate', 'attestation']),
  title: z.string().min(1, 'Evidence title is required').max(255, 'Title too long'),
  description: z.string().max(1000, 'Description too long').optional(),
  category: z.string().max(100, 'Category too long'),
  confidentiality: z.enum(['public', 'internal', 'confidential', 'restricted']).default('internal'),
  source: z.string().min(1, 'Source is required').max(255, 'Source too long'),
  tags: z.array(z.string()).optional(),
  retentionPeriod: z.number().min(1).max(36500).optional() // Up to 100 years in days
});

// Risk acceptance schema
export const riskAcceptanceSchema = z.object({
  controlId: z.string().min(1, 'Control ID is required'),
  justification: z.string().min(10, 'Justification must be at least 10 characters').max(2000, 'Justification too long'),
  riskLevel: z.enum(['low', 'medium', 'high', 'critical']),
  mitigatingFactors: z.array(z.string()).optional(),
  conditions: z.array(z.string()).optional(),
  reviewDate: z.string().datetime(),
  expirationDate: z.string().datetime().optional()
});

// Update assessment schema
export const updateAssessmentSchema = z.object({
  name: z.string().min(1, 'Assessment name is required').max(255, 'Name too long').optional(),
  description: z.string().max(1000, 'Description too long').optional(),
  status: z.enum(['planned', 'in-progress', 'completed', 'failed', 'cancelled']).optional(),
  scheduledDate: z.string().datetime().optional(),
  scope: assessmentScopeSchema.optional(),
  configuration: assessmentConfigurationSchema.optional()
});

// Control implementation schema
export const controlImplementationSchema = z.object({
  controlId: z.string().min(1, 'Control ID is required'),
  implementationDetails: z.string().min(10, 'Implementation details required').max(5000, 'Details too long'),
  implementationEvidence: z.array(z.string()).optional(),
  testResults: z.string().max(2000, 'Test results too long').optional(),
  implementationDate: z.string().datetime().optional(),
  implementedBy: z.string().max(255, 'Implementer name too long').optional(),
  reviewedBy: z.string().max(255, 'Reviewer name too long').optional(),
  approvedBy: z.string().max(255, 'Approver name too long').optional(),
  compensatingControls: z.array(z.string()).optional(),
  exceptions: z.array(z.string()).optional(),
  nextReviewDate: z.string().datetime().optional()
});

// Bulk update controls schema
export const bulkUpdateControlsSchema = z.object({
  controlIds: z.array(z.string()).min(1, 'At least one control ID is required'),
  updates: updateControlSchema
});

// Framework configuration schema
export const frameworkConfigurationSchema = z.object({
  framework: complianceFrameworkSchema,
  enabled: z.boolean().default(true),
  customControls: z.array(z.object({
    controlId: z.string().min(1, 'Control ID is required'),
    title: z.string().min(1, 'Title is required'),
    description: z.string().min(1, 'Description is required'),
    category: z.string().min(1, 'Category is required'),
    priority: compliancePrioritySchema,
    riskLevel: z.enum(['low', 'medium', 'high', 'critical']),
    requirements: z.array(z.string()),
    implementationGuidance: z.string(),
    evidenceRequirements: z.array(z.string()),
    testProcedures: z.array(z.string())
  })).optional(),
  customCategories: z.array(z.string()).optional(),
  assessmentFrequency: z.enum(['weekly', 'monthly', 'quarterly', 'annually']).default('quarterly'),
  automaticRemediationEnabled: z.boolean().default(false),
  notificationSettings: z.object({
    enabled: z.boolean().default(true),
    recipients: z.array(z.string().email()),
    events: z.array(z.enum([
      'assessment_completed', 'finding_created', 'remediation_due', 
      'control_updated', 'compliance_threshold_breached'
    ]))
  }).optional()
});

// Compliance policy schema
export const compliancePolicySchema = z.object({
  name: z.string().min(1, 'Policy name is required').max(255, 'Name too long'),
  description: z.string().max(2000, 'Description too long'),
  frameworks: z.array(complianceFrameworkSchema).min(1, 'At least one framework is required'),
  applicableRoles: z.array(z.string()).min(1, 'At least one role is required'),
  mandatoryControls: z.array(z.string()),
  exemptedControls: z.array(z.string()).optional(),
  assessmentSchedule: z.object({
    frequency: z.enum(['monthly', 'quarterly', 'annually']),
    startDate: z.string().datetime(),
    automated: z.boolean().default(true)
  }),
  escalationRules: z.object({
    criticalFindingsEscalation: z.number().min(1).max(24), // Hours
    highFindingsEscalation: z.number().min(1).max(168),    // Hours (1 week)
    remediationOverdueEscalation: z.number().min(1).max(720) // Hours (30 days)
  }),
  complianceThresholds: z.object({
    minimumScore: z.number().min(0).max(100).default(80),
    criticalControlsThreshold: z.number().min(0).max(100).default(95),
    warningThreshold: z.number().min(0).max(100).default(85)
  }),
  effectiveDate: z.string().datetime(),
  expirationDate: z.string().datetime().optional(),
  approver: z.string().min(1, 'Approver is required'),
  version: z.string().default('1.0')
});

// Validation helper functions
export function validateId(id: string): boolean {
  return /^[a-zA-Z0-9-_]{1,50}$/.test(id);
}

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validateDateRange(startDate: string, endDate: string): boolean {
  const start = new Date(startDate);
  const end = new Date(endDate);
  return end > start && start <= new Date();
}

export function validateFrameworkSupported(framework: string): boolean {
  const supportedFrameworks = [
    'gdpr', 'hipaa', 'soc2', 'pci-dss', 'iso27001', 'nist', 'cis', 'owasp',
    'ccpa', 'fedramp', 'sox', 'fisma', 'cobit', 'coso', 'basel', 'swift',
    'pci-ssp', 'fips', 'common-criteria', 'custom'
  ];
  return supportedFrameworks.includes(framework);
}

// Custom validation middleware for file uploads
export function validateFileUpload(req: any, res: any, next: any) {
  if (!req.files || !req.files.evidenceFile) {
    return res.status(400).json({
      success: false,
      error: 'Evidence file is required'
    });
  }

  const file = req.files.evidenceFile;
  const maxSize = 50 * 1024 * 1024; // 50MB
  const allowedTypes = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/gif',
    'text/plain',
    'application/json',
    'application/xml',
    'text/csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];

  if (file.size > maxSize) {
    return res.status(400).json({
      success: false,
      error: 'File size too large. Maximum size is 50MB.'
    });
  }

  if (!allowedTypes.includes(file.mimetype)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid file type. Allowed types: PDF, images, text files, Office documents.'
    });
  }

  next();
}

// Schema exports for external use
export const schemas = {
  createAssessment: createAssessmentSchema,
  updateControl: updateControlSchema,
  createRemediationPlan: createRemediationPlanSchema,
  generateReport: generateReportSchema,
  searchControls: searchControlsSchema,
  uploadEvidence: uploadEvidenceSchema,
  riskAcceptance: riskAcceptanceSchema,
  updateAssessment: updateAssessmentSchema,
  controlImplementation: controlImplementationSchema,
  bulkUpdateControls: bulkUpdateControlsSchema,
  frameworkConfiguration: frameworkConfigurationSchema,
  compliancePolicy: compliancePolicySchema
};