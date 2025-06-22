export interface User {
  id: string;
  email: string;
  name: string;
  organizationId?: string;
}

export enum ReportType {
  THREAT_MODEL = 'threat-model',
  EXECUTIVE_SUMMARY = 'executive-summary',
  TECHNICAL_DETAILED = 'technical-detailed',
  COMPLIANCE = 'compliance',
  RISK_ASSESSMENT = 'risk-assessment',
  MITIGATION_PLAN = 'mitigation-plan',
  AUDIT_LOG = 'audit-log',
}

export enum ReportFormat {
  PDF = 'pdf',
  HTML = 'html',
  DOCX = 'docx',
  MARKDOWN = 'markdown',
  JSON = 'json',
}

export enum ReportStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export interface ReportRequest {
  id?: string;
  type: ReportType;
  format: ReportFormat;
  projectId: string;
  threatModelId?: string;
  userId: string;
  options?: ReportOptions;
  metadata?: Record<string, any>;
}

export interface ReportOptions {
  includeExecutiveSummary?: boolean;
  includeDetailedThreats?: boolean;
  includeMitigations?: boolean;
  includeRiskMatrix?: boolean;
  includeCharts?: boolean;
  includeAppendix?: boolean;
  includeTimeline?: boolean;
  includeAttackTrees?: boolean;
  customSections?: CustomSection[];
  branding?: BrandingOptions;
  language?: string;
  timezone?: string;
}

export interface CustomSection {
  title: string;
  content: string;
  order: number;
  type: 'text' | 'markdown' | 'html' | 'chart';
}

export interface BrandingOptions {
  logo?: string;
  primaryColor?: string;
  secondaryColor?: string;
  fontFamily?: string;
  headerText?: string;
  footerText?: string;
  watermark?: string;
}

export interface Report {
  id: string;
  type: ReportType;
  format: ReportFormat;
  status: ReportStatus;
  projectId: string;
  threatModelId?: string;
  userId: string;
  organizationId?: string;
  filename: string;
  filepath?: string;
  url?: string;
  size?: number;
  pages?: number;
  generatedAt?: Date;
  expiresAt?: Date;
  error?: string;
  metadata?: ReportMetadata;
}

export interface ReportMetadata {
  title: string;
  subtitle?: string;
  author: string;
  version: string;
  date: string;
  confidentiality?: 'public' | 'internal' | 'confidential' | 'secret';
  tags?: string[];
  checksum?: string;
}

export interface ThreatModelData {
  id: string;
  name: string;
  description: string;
  version: string;
  createdAt: Date;
  updatedAt: Date;
  components: Component[];
  dataFlows: DataFlow[];
  threats: Threat[];
  mitigations: Mitigation[];
  assumptions: string[];
  dependencies: string[];
  metadata?: Record<string, any>;
}

export interface Component {
  id: string;
  name: string;
  type: string;
  description: string;
  trustLevel: 'trusted' | 'untrusted' | 'semi-trusted';
  technologies: string[];
  interfaces: string[];
  dataClassification?: string;
  threats?: Threat[];
}

export interface DataFlow {
  id: string;
  name: string;
  source: string;
  destination: string;
  protocol: string;
  dataClassification: string;
  authentication?: string;
  encryption?: string;
  threats?: Threat[];
}

export interface Threat {
  id: string;
  title: string;
  description: string;
  category: string; // STRIDE category
  severity: 'critical' | 'high' | 'medium' | 'low';
  likelihood: 'very-high' | 'high' | 'medium' | 'low' | 'very-low';
  impact: 'catastrophic' | 'major' | 'moderate' | 'minor' | 'negligible';
  riskScore: number;
  status: 'identified' | 'analyzed' | 'mitigated' | 'accepted' | 'transferred';
  affectedComponents: string[];
  mitigations?: Mitigation[];
  metadata?: ThreatMetadata;
}

export interface ThreatMetadata {
  stride?: string[];
  owasp?: string[];
  cwe?: string[];
  capec?: string[];
  attackVector?: string;
  exploitability?: number;
  prevalence?: number;
  detectability?: number;
  technicalImpact?: number;
  businessImpact?: number;
}

export interface Mitigation {
  id: string;
  title: string;
  description: string;
  type: 'preventive' | 'detective' | 'corrective' | 'compensating';
  status: 'proposed' | 'approved' | 'implemented' | 'verified' | 'rejected';
  priority: 'critical' | 'high' | 'medium' | 'low';
  effort: 'low' | 'medium' | 'high' | 'very-high';
  cost?: number;
  effectiveness: number; // 0-100
  implementationDate?: Date;
  owner?: string;
  verificationMethod?: string;
  residualRisk?: number;
}

export interface ChartData {
  type: 'bar' | 'pie' | 'doughnut' | 'line' | 'radar' | 'matrix';
  title: string;
  data: any;
  options?: any;
}

export interface ReportTemplate {
  id: string;
  name: string;
  type: ReportType;
  format: ReportFormat;
  description: string;
  template: string;
  styles?: string;
  assets?: string[];
  variables: TemplateVariable[];
  sections: TemplateSection[];
  active: boolean;
  version: string;
}

export interface TemplateVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object';
  required: boolean;
  default?: any;
  description?: string;
}

export interface TemplateSection {
  id: string;
  name: string;
  order: number;
  condition?: string;
  template: string;
  pageBreak?: boolean;
}

export interface ReportJob {
  id: string;
  reportId: string;
  type: ReportType;
  format: ReportFormat;
  status: ReportStatus;
  priority: number;
  attempts: number;
  maxAttempts: number;
  data: ReportJobData;
  result?: Report;
  error?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  scheduledFor?: Date;
}

export interface ReportJobData {
  request: ReportRequest;
  threatModelData: ThreatModelData;
  projectData: any;
  userData: User;
  organizationData?: any;
}

export interface ReportQueueOptions {
  priority?: number;
  delay?: number;
  attempts?: number;
  backoff?: {
    type: 'fixed' | 'exponential';
    delay: number;
  };
  removeOnComplete?: boolean;
  removeOnFail?: boolean;
}

export interface ReportGenerationResult {
  success: boolean;
  report?: Report;
  error?: string;
  warnings?: string[];
  duration?: number;
}

export interface ReportStorageProvider {
  save(report: Report, buffer: Buffer): Promise<string>;
  get(reportId: string): Promise<Buffer>;
  delete(reportId: string): Promise<void>;
  getUrl(reportId: string, expiresIn?: number): Promise<string>;
  exists(reportId: string): Promise<boolean>;
}

export interface ReportNotification {
  type: 'email' | 'webhook' | 'slack';
  recipient: string;
  subject?: string;
  message?: string;
  reportUrl?: string;
  metadata?: Record<string, any>;
}

export interface ReportSchedule {
  id: string;
  name: string;
  type: ReportType;
  format: ReportFormat;
  projectId: string;
  schedule: string; // Cron expression
  enabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
  options: ReportOptions;
  recipients: ReportNotification[];
  metadata?: Record<string, any>;
}