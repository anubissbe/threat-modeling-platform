// Core Compliance Framework Types
export type ComplianceFramework = 
  | 'gdpr'           // General Data Protection Regulation (EU)
  | 'hipaa'          // Health Insurance Portability and Accountability Act (US)
  | 'soc2'           // SOC 2 Type II
  | 'pci-dss'        // Payment Card Industry Data Security Standard
  | 'iso27001'       // ISO/IEC 27001
  | 'nist'           // NIST Cybersecurity Framework
  | 'cis'            // CIS Controls
  | 'owasp'          // OWASP Top 10
  | 'ccpa'           // California Consumer Privacy Act
  | 'fedramp'        // Federal Risk and Authorization Management Program
  | 'sox'            // Sarbanes-Oxley Act
  | 'fisma'          // Federal Information Security Management Act
  | 'cobit'          // Control Objectives for Information and Related Technologies
  | 'coso'           // Committee of Sponsoring Organizations
  | 'basel'          // Basel III
  | 'swift'          // SWIFT Customer Security Programme
  | 'pci-ssp'        // PCI Software Security Framework
  | 'fips'           // Federal Information Processing Standards
  | 'common-criteria' // Common Criteria for Information Technology Security Evaluation
  | 'custom';        // Custom compliance framework

export type ComplianceStatus = 'compliant' | 'non-compliant' | 'partially-compliant' | 'not-assessed' | 'in-progress' | 'remediation-required';

export type CompliancePriority = 'critical' | 'high' | 'medium' | 'low';

export type AssessmentType = 'automated' | 'manual' | 'hybrid' | 'external-audit' | 'self-assessment';

export type RemediationStatus = 'pending' | 'in-progress' | 'completed' | 'failed' | 'deferred' | 'accepted-risk';

// Core Compliance Control Interface
export interface ComplianceControl {
  id: string;
  framework: ComplianceFramework;
  controlId: string;                    // e.g., "GDPR-7.2", "SOC2-CC6.1"
  title: string;
  description: string;
  category: string;                     // e.g., "Access Control", "Data Protection"
  subcategory?: string;
  
  // Requirements and Implementation
  requirements: string[];
  implementationGuidance: string;
  evidenceRequirements: string[];
  testProcedures: string[];
  
  // Assessment and Status
  status: ComplianceStatus;
  priority: CompliancePriority;
  lastAssessed?: Date;
  nextAssessment?: Date;
  assessmentType: AssessmentType;
  
  // Risk and Impact
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  businessImpact: string;
  technicalImpact: string;
  regulatoryImpact: string;
  
  // Implementation Details
  implementationStatus: 'not-started' | 'in-progress' | 'implemented' | 'needs-review';
  implementationNotes?: string;
  implementationEvidence?: string[];
  compensatingControls?: string[];
  
  // Remediation
  remediationPlan?: RemediationPlan;
  
  // Relationships
  dependencies?: string[];              // IDs of other controls this depends on
  relatedControls?: string[];          // Related controls in same/other frameworks
  mappedThreats?: string[];            // STRIDE threats this control addresses
  mappedAssets?: string[];             // Assets this control protects
  
  // Metadata
  owner?: string;                      // Responsible person/team
  reviewer?: string;                   // Control reviewer
  approver?: string;                   // Control approver
  tags?: string[];
  customFields?: Record<string, any>;
  
  createdAt: Date;
  updatedAt: Date;
  version: string;
}

// Remediation Planning
export interface RemediationPlan {
  id: string;
  controlId: string;
  title: string;
  description: string;
  
  // Planning
  priority: CompliancePriority;
  effort: 'low' | 'medium' | 'high' | 'very-high';
  estimatedCost?: number;
  estimatedDuration?: number;          // days
  
  // Implementation
  status: RemediationStatus;
  assignedTo?: string;
  dueDate?: Date;
  startDate?: Date;
  completionDate?: Date;
  
  // Tasks and Progress
  tasks: RemediationTask[];
  progressPercentage: number;
  
  // Risk Management
  riskAcceptance?: RiskAcceptance;
  
  // Documentation
  implementationNotes?: string;
  testResults?: string;
  evidence?: string[];
  
  createdAt: Date;
  updatedAt: Date;
}

export interface RemediationTask {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in-progress' | 'completed' | 'blocked';
  priority: CompliancePriority;
  assignedTo?: string;
  dueDate?: Date;
  completionDate?: Date;
  dependencies?: string[];
  notes?: string;
  estimatedHours?: number;
  actualHours?: number;
}

export interface RiskAcceptance {
  id: string;
  controlId: string;
  justification: string;
  acceptedBy: string;
  acceptanceDate: Date;
  reviewDate: Date;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  mitigatingFactors?: string[];
  conditions?: string[];
  expirationDate?: Date;
}

// Compliance Assessment
export interface ComplianceAssessment {
  id: string;
  name: string;
  description?: string;
  framework: ComplianceFramework;
  
  // Scope and Configuration
  scope: AssessmentScope;
  configuration: AssessmentConfiguration;
  
  // Status and Timeline
  status: 'planned' | 'in-progress' | 'completed' | 'failed' | 'cancelled';
  startDate?: Date;
  endDate?: Date;
  scheduledDate?: Date;
  
  // Results
  overallStatus: ComplianceStatus;
  complianceScore: number;             // 0-100
  totalControls: number;
  compliantControls: number;
  nonCompliantControls: number;
  partiallyCompliantControls: number;
  notAssessedControls: number;
  
  // Control Results
  controlResults: ControlAssessmentResult[];
  
  // Findings and Issues
  findings: ComplianceFinding[];
  recommendations: ComplianceRecommendation[];
  
  // Evidence and Documentation
  evidence: AssessmentEvidence[];
  reportPath?: string;
  
  // Metadata
  assessor?: string;
  reviewer?: string;
  approver?: string;
  version: string;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface AssessmentScope {
  frameworks: ComplianceFramework[];
  controls?: string[];                 // Specific control IDs to assess
  assets?: string[];                   // Assets to include in assessment
  threatModels?: string[];             // Threat models to assess
  excludedControls?: string[];         // Controls to exclude
  includeAutomated: boolean;
  includeManual: boolean;
  includeExternalAudit: boolean;
}

export interface AssessmentConfiguration {
  automatedTestsEnabled: boolean;
  evidenceCollectionEnabled: boolean;
  reportGeneration: boolean;
  notificationsEnabled: boolean;
  
  // Scheduling
  recurringAssessment: boolean;
  recurringInterval?: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annually';
  
  // Quality Settings
  requireEvidence: boolean;
  requireReview: boolean;
  requireApproval: boolean;
  
  // Custom Settings
  customParameters?: Record<string, any>;
}

export interface ControlAssessmentResult {
  controlId: string;
  status: ComplianceStatus;
  score: number;                       // 0-100
  confidence: number;                  // 0-100, confidence in assessment
  
  // Testing Results
  automatedTestResults?: AutomatedTestResult[];
  manualTestResults?: ManualTestResult[];
  
  // Evidence
  evidence: string[];
  evidenceQuality: 'poor' | 'fair' | 'good' | 'excellent';
  
  // Findings
  findings: string[];
  recommendations: string[];
  
  // Assessment Details
  assessmentMethod: AssessmentType;
  assessor?: string;
  assessmentDate: Date;
  reviewDate?: Date;
  
  // Comments and Notes
  notes?: string;
  reviewComments?: string;
}

export interface AutomatedTestResult {
  testId: string;
  testName: string;
  status: 'pass' | 'fail' | 'warning' | 'skip' | 'error';
  score: number;
  message: string;
  details?: Record<string, any>;
  executionTime: number;
  timestamp: Date;
}

export interface ManualTestResult {
  testId: string;
  testName: string;
  status: ComplianceStatus;
  assessor: string;
  assessmentDate: Date;
  findings: string;
  evidence: string[];
  recommendations: string[];
  confidence: number;
  notes?: string;
}

// Compliance Findings and Recommendations
export interface ComplianceFinding {
  id: string;
  controlId: string;
  title: string;
  description: string;
  
  // Classification
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'gap' | 'weakness' | 'deficiency' | 'non-compliance' | 'improvement';
  type: 'technical' | 'procedural' | 'policy' | 'documentation' | 'training';
  
  // Impact Assessment
  riskImpact: string;
  businessImpact: string;
  regulatoryImpact: string;
  
  // Evidence and Context
  evidence: string[];
  affectedAssets?: string[];
  affectedSystems?: string[];
  
  // Resolution
  status: 'open' | 'in-progress' | 'resolved' | 'accepted' | 'deferred';
  recommendedActions: string[];
  assignedTo?: string;
  dueDate?: Date;
  resolutionDate?: Date;
  resolutionNotes?: string;
  
  // Metadata
  discoveredBy?: string;
  discoveryDate: Date;
  lastUpdated: Date;
}

export interface ComplianceRecommendation {
  id: string;
  title: string;
  description: string;
  
  // Classification
  priority: CompliancePriority;
  category: 'preventive' | 'detective' | 'corrective' | 'compensating';
  type: 'technical' | 'procedural' | 'policy' | 'training' | 'organizational';
  
  // Implementation
  effort: 'low' | 'medium' | 'high' | 'very-high';
  estimatedCost?: number;
  estimatedBenefit: string;
  implementationSteps: string[];
  
  // Impact
  affectedControls: string[];
  expectedImprovement: string;
  riskReduction: string;
  
  // Status
  status: 'proposed' | 'approved' | 'in-progress' | 'implemented' | 'rejected';
  implementedBy?: string;
  implementationDate?: Date;
  
  createdAt: Date;
  updatedAt: Date;
}

// Evidence Management
export interface AssessmentEvidence {
  id: string;
  controlId: string;
  assessmentId: string;
  
  // Evidence Details
  type: 'document' | 'screenshot' | 'configuration' | 'log' | 'test-result' | 'certificate' | 'attestation';
  title: string;
  description?: string;
  
  // File Information
  fileName?: string;
  filePath?: string;
  fileSize?: number;
  mimeType?: string;
  hash?: string;                       // File integrity hash
  
  // Classification
  category: string;
  confidentiality: 'public' | 'internal' | 'confidential' | 'restricted';
  
  // Validation
  validated: boolean;
  validator?: string;
  validationDate?: Date;
  validationNotes?: string;
  
  // Retention
  retentionPeriod?: number;            // days
  expirationDate?: Date;
  
  // Metadata
  source: string;
  collectedBy?: string;
  collectionDate: Date;
  version?: string;
  tags?: string[];
  
  createdAt: Date;
  updatedAt: Date;
}

// Compliance Reporting
export interface ComplianceReport {
  id: string;
  name: string;
  description?: string;
  
  // Report Configuration
  type: 'assessment' | 'gap-analysis' | 'remediation' | 'executive' | 'detailed' | 'custom';
  format: 'pdf' | 'html' | 'excel' | 'csv' | 'json' | 'xml';
  template?: string;
  
  // Scope
  frameworks: ComplianceFramework[];
  assessmentIds?: string[];
  dateRange?: {
    startDate: Date;
    endDate: Date;
  };
  
  // Content Configuration
  includeExecutiveSummary: boolean;
  includeDetailedFindings: boolean;
  includeRecommendations: boolean;
  includeEvidence: boolean;
  includeCharts: boolean;
  includeTrendAnalysis: boolean;
  
  // Generation Status
  status: 'queued' | 'generating' | 'completed' | 'failed';
  filePath?: string;
  fileSize?: number;
  
  // Distribution
  recipients?: string[];
  distributionDate?: Date;
  
  // Security
  encrypted: boolean;
  passwordProtected: boolean;
  accessLevel: 'public' | 'internal' | 'confidential' | 'restricted';
  
  // Metadata
  generatedBy: string;
  generatedAt?: Date;
  expirationDate?: Date;
  version: string;
  
  createdAt: Date;
  updatedAt: Date;
}

// Framework-Specific Types

// GDPR Specific Types
export interface GDPRDataProcessing {
  id: string;
  purpose: string;
  legalBasis: 'consent' | 'contract' | 'legal-obligation' | 'vital-interests' | 'public-task' | 'legitimate-interests';
  dataCategories: string[];
  dataSubjects: string[];
  recipients?: string[];
  retentionPeriod: number;             // days
  crossBorderTransfers: boolean;
  transferMechanism?: string;
  automaticDecisionMaking: boolean;
  
  // Privacy Impact Assessment
  piaRequired: boolean;
  piaCompleted: boolean;
  piaDate?: Date;
  
  // Data Subject Rights
  rightsSupported: ('access' | 'rectification' | 'erasure' | 'restrict' | 'portability' | 'object' | 'withdraw-consent')[];
  
  createdAt: Date;
  updatedAt: Date;
}

// HIPAA Specific Types
export interface HIPAAEntity {
  id: string;
  type: 'covered-entity' | 'business-associate' | 'subcontractor';
  name: string;
  description?: string;
  
  // PHI Handling
  phiTypes: string[];
  phiVolume: 'low' | 'medium' | 'high' | 'very-high';
  
  // Agreements
  baaRequired: boolean;
  baaInPlace: boolean;
  baaDate?: Date;
  baaExpirationDate?: Date;
  
  // Safeguards
  administrativeSafeguards: string[];
  physicalSafeguards: string[];
  technicalSafeguards: string[];
  
  createdAt: Date;
  updatedAt: Date;
}

// SOC 2 Specific Types
export interface SOC2TrustPrinciple {
  principle: 'security' | 'availability' | 'processing-integrity' | 'confidentiality' | 'privacy';
  applicable: boolean;
  controlObjectives: string[];
  implementationStatus: ComplianceStatus;
  testingResults?: string;
  exceptions?: string[];
}

// PCI-DSS Specific Types
export interface PCIDSSEnvironment {
  id: string;
  name: string;
  level: 1 | 2 | 3 | 4;                // PCI compliance level
  
  // Cardholder Data Environment
  cdeScope: string[];
  cardDataFlow: string;
  storageLocations: string[];
  transmissionPaths: string[];
  
  // Network Segmentation
  segmentationImplemented: boolean;
  segmentationValidated: boolean;
  segmentationDate?: Date;
  
  // Quarterly Scanning
  scanningRequired: boolean;
  lastScan?: Date;
  nextScan?: Date;
  scanningVendor?: string;
  
  createdAt: Date;
  updatedAt: Date;
}

// Compliance Dashboard and Metrics
export interface ComplianceDashboard {
  organizationId: string;
  generatedAt: Date;
  
  // Overall Compliance Status
  overallScore: number;                // 0-100
  totalFrameworks: number;
  compliantFrameworks: number;
  
  // Framework Status
  frameworkStatus: Map<ComplianceFramework, FrameworkStatus>;
  
  // Trend Data
  trends: ComplianceTrend[];
  
  // Active Issues
  criticalFindings: number;
  highFindings: number;
  mediumFindings: number;
  lowFindings: number;
  
  // Upcoming Deadlines
  upcomingAssessments: UpcomingAssessment[];
  expiringCertifications: ExpiringCertification[];
  
  // Risk Indicators
  riskScore: number;                   // 0-100
  riskTrend: 'improving' | 'stable' | 'deteriorating';
  
  // Performance Metrics
  averageRemediationTime: number;      // days
  controlsImplemented: number;
  controlsPending: number;
}

export interface FrameworkStatus {
  framework: ComplianceFramework;
  status: ComplianceStatus;
  score: number;
  totalControls: number;
  compliantControls: number;
  lastAssessment?: Date;
  nextAssessment?: Date;
  certificationStatus?: 'certified' | 'in-progress' | 'expired' | 'not-certified';
  certificationExpiry?: Date;
}

export interface ComplianceTrend {
  framework: ComplianceFramework;
  period: string;                      // e.g., "2024-Q1"
  score: number;
  change: number;                      // Change from previous period
  assessmentCount: number;
}

export interface UpcomingAssessment {
  id: string;
  framework: ComplianceFramework;
  type: AssessmentType;
  scheduledDate: Date;
  daysUntilDue: number;
  priority: CompliancePriority;
  status: 'scheduled' | 'overdue' | 'in-progress';
}

export interface ExpiringCertification {
  framework: ComplianceFramework;
  certificationType: string;
  expirationDate: Date;
  daysUntilExpiry: number;
  renewalRequired: boolean;
  renewalInProgress: boolean;
}

// API Request/Response Types
export interface CreateAssessmentRequest {
  name: string;
  description?: string;
  framework: ComplianceFramework;
  scope: AssessmentScope;
  configuration: AssessmentConfiguration;
  scheduledDate?: string;              // ISO date string
}

export interface UpdateControlRequest {
  status?: ComplianceStatus;
  implementationStatus?: 'not-started' | 'in-progress' | 'implemented' | 'needs-review';
  implementationNotes?: string;
  evidence?: string[];
  owner?: string;
  reviewer?: string;
  customFields?: Record<string, any>;
}

export interface CreateRemediationPlanRequest {
  controlId: string;
  title: string;
  description: string;
  priority: CompliancePriority;
  assignedTo?: string;
  dueDate?: string;                    // ISO date string
  tasks: Omit<RemediationTask, 'id'>[];
}

export interface GenerateReportRequest {
  name: string;
  type: 'assessment' | 'gap-analysis' | 'remediation' | 'executive' | 'detailed' | 'custom';
  format: 'pdf' | 'html' | 'excel' | 'csv' | 'json' | 'xml';
  frameworks: ComplianceFramework[];
  assessmentIds?: string[];
  dateRange?: {
    startDate: string;               // ISO date string
    endDate: string;                 // ISO date string
  };
  includeExecutiveSummary?: boolean;
  includeDetailedFindings?: boolean;
  includeRecommendations?: boolean;
  includeEvidence?: boolean;
  recipients?: string[];
}

// Error Types
export interface ComplianceError {
  code: string;
  message: string;
  details?: Record<string, any>;
  framework?: ComplianceFramework;
  controlId?: string;
  timestamp: Date;
}

// Search and Query Types
export interface ComplianceSearchQuery {
  frameworks?: ComplianceFramework[];
  status?: ComplianceStatus[];
  priority?: CompliancePriority[];
  categories?: string[];
  tags?: string[];
  owner?: string;
  reviewer?: string;
  lastAssessedBefore?: Date;
  lastAssessedAfter?: Date;
  implementationStatus?: ('not-started' | 'in-progress' | 'implemented' | 'needs-review')[];
  riskLevel?: ('low' | 'medium' | 'high' | 'critical')[];
  searchTerm?: string;
  sortBy?: 'priority' | 'status' | 'lastAssessed' | 'title' | 'framework';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

// Event Types for Audit Trail
export type ComplianceEventType =
  | 'assessment_created'
  | 'assessment_started'
  | 'assessment_completed'
  | 'control_updated'
  | 'finding_created'
  | 'finding_resolved'
  | 'remediation_plan_created'
  | 'remediation_completed'
  | 'report_generated'
  | 'evidence_uploaded'
  | 'framework_configured'
  | 'risk_accepted'
  | 'certification_renewed';

export interface ComplianceEvent {
  id: string;
  type: ComplianceEventType;
  description: string;
  
  // Context
  framework?: ComplianceFramework;
  controlId?: string;
  assessmentId?: string;
  findingId?: string;
  
  // Actor
  userId: string;
  userEmail: string;
  ipAddress?: string;
  userAgent?: string;
  
  // Data
  previousValue?: any;
  newValue?: any;
  metadata?: Record<string, any>;
  
  // Audit
  timestamp: Date;
  correlationId?: string;
}