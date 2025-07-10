// Core Security Tool Types
export type SecurityToolType = 
  | 'siem'           // Security Information and Event Management
  | 'vulnerability-scanner'
  | 'cloud-security'
  | 'ticketing'
  | 'soar'           // Security Orchestration, Automation and Response
  | 'threat-intelligence'
  | 'endpoint-protection'
  | 'network-security';

export type SIEMPlatform = 'splunk' | 'qradar' | 'elastic' | 'sentinel' | 'chronicle' | 'sumologic' | 'custom';
export type VulnerabilityScanner = 'nessus' | 'qualys' | 'rapid7' | 'openvas' | 'acunetix' | 'burp' | 'custom';
export type CloudPlatform = 'aws' | 'azure' | 'gcp' | 'alibaba' | 'oracle' | 'ibm';
export type TicketingPlatform = 'jira' | 'servicenow' | 'remedy' | 'zendesk' | 'freshservice' | 'custom';

export type IntegrationStatus = 'connected' | 'disconnected' | 'error' | 'configuring' | 'testing';
export type SyncDirection = 'inbound' | 'outbound' | 'bidirectional';
export type SeverityLevel = 'critical' | 'high' | 'medium' | 'low' | 'info';

// Base Integration Configuration
export interface SecurityToolIntegration {
  id: string;
  name: string;
  type: SecurityToolType;
  platform: string;
  description?: string;
  
  // Connection Details
  connectionConfig: ConnectionConfig;
  status: IntegrationStatus;
  lastConnected?: Date;
  lastSync?: Date;
  
  // Sync Configuration
  syncEnabled: boolean;
  syncDirection: SyncDirection;
  syncInterval?: number; // minutes
  syncFilter?: SyncFilter;
  
  // Mapping Configuration
  fieldMappings: FieldMapping[];
  severityMapping: SeverityMapping;
  
  // Features
  features: IntegrationFeatures;
  
  // Metadata
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  version: string;
}

export interface ConnectionConfig {
  endpoint: string;
  authType: 'api-key' | 'oauth2' | 'basic' | 'token' | 'certificate';
  credentials: Record<string, any>; // Encrypted in storage
  timeout?: number; // seconds
  retryAttempts?: number;
  sslVerify?: boolean;
  proxyConfig?: ProxyConfig;
  customHeaders?: Record<string, string>;
}

export interface ProxyConfig {
  host: string;
  port: number;
  protocol: 'http' | 'https' | 'socks5';
  auth?: {
    username: string;
    password: string;
  };
}

export interface SyncFilter {
  timeRange?: {
    start: Date;
    end: Date;
  };
  severities?: SeverityLevel[];
  categories?: string[];
  tags?: string[];
  customFilters?: Record<string, any>;
}

export interface FieldMapping {
  sourceField: string;
  targetField: string;
  transformation?: 'direct' | 'uppercase' | 'lowercase' | 'date' | 'custom';
  transformFunction?: string; // Custom transformation function
  required: boolean;
  defaultValue?: any;
}

export interface SeverityMapping {
  critical: string[];
  high: string[];
  medium: string[];
  low: string[];
  info: string[];
}

export interface IntegrationFeatures {
  alertIngestion: boolean;
  eventCorrelation: boolean;
  ticketCreation: boolean;
  bidirectionalSync: boolean;
  automatedResponse: boolean;
  customWebhooks: boolean;
  bulkOperations: boolean;
  realTimeStreaming: boolean;
}

// SIEM Integration Types
export interface SIEMIntegration extends SecurityToolIntegration {
  platform: SIEMPlatform;
  siemConfig: SIEMConfig;
}

export interface SIEMConfig {
  searchIndex?: string;
  searchApp?: string;
  correlationRules: CorrelationRule[];
  alertThresholds: AlertThreshold[];
  eventTransformation?: EventTransformation;
}

export interface CorrelationRule {
  id: string;
  name: string;
  description: string;
  query: string;
  timeWindow: number; // minutes
  threshold: number;
  aggregateField?: string;
  groupBy?: string[];
  actions: RuleAction[];
  enabled: boolean;
}

export interface AlertThreshold {
  metric: string;
  operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'ne';
  value: number;
  timeWindow: number; // minutes
  severity: SeverityLevel;
}

export interface EventTransformation {
  inputFormat: 'json' | 'xml' | 'csv' | 'syslog' | 'cef' | 'leef';
  outputFormat: 'json' | 'xml' | 'csv' | 'cef' | 'leef';
  transformationRules: TransformationRule[];
}

export interface TransformationRule {
  field: string;
  operation: 'map' | 'split' | 'join' | 'regex' | 'calculate' | 'enrich';
  parameters: Record<string, any>;
}

export interface RuleAction {
  type: 'alert' | 'ticket' | 'email' | 'webhook' | 'script' | 'block' | 'isolate';
  parameters: Record<string, any>;
}

// SIEM Event Types
export interface SIEMEvent {
  id: string;
  timestamp: Date;
  source: string;
  eventType: string;
  severity: SeverityLevel;
  
  // Event Details
  title: string;
  description: string;
  category: string;
  subcategory?: string;
  
  // Attribution
  sourceIP?: string;
  destinationIP?: string;
  sourcePort?: number;
  destinationPort?: number;
  protocol?: string;
  user?: string;
  host?: string;
  
  // Threat Intelligence
  threatIndicators?: ThreatIndicator[];
  mitreAttackTechniques?: string[];
  
  // Raw Data
  rawEvent: any;
  normalizedEvent?: any;
  
  // Correlation
  correlationId?: string;
  relatedEvents?: string[];
  
  // Response
  status: 'new' | 'investigating' | 'resolved' | 'false-positive';
  assignee?: string;
  notes?: string[];
}

export interface ThreatIndicator {
  type: 'ip' | 'domain' | 'url' | 'hash' | 'email' | 'cve';
  value: string;
  confidence: number; // 0-100
  source: string;
  lastSeen: Date;
  tags?: string[];
}

// Splunk Specific Types
export interface SplunkIntegration extends SIEMIntegration {
  platform: 'splunk';
  splunkConfig: SplunkSpecificConfig;
}

export interface SplunkSpecificConfig extends SIEMConfig {
  managementPort: number;
  searchHeads?: string[];
  indexers?: string[];
  forwarders?: string[];
  apps: string[];
  savedSearches: SplunkSavedSearch[];
  dashboards: string[];
}

export interface SplunkSavedSearch {
  name: string;
  search: string;
  cronSchedule?: string;
  alertActions?: string[];
  alertThreshold?: number;
  alertComparator?: string;
}

// QRadar Specific Types
export interface QRadarIntegration extends SIEMIntegration {
  platform: 'qradar';
  qradarConfig: QRadarSpecificConfig;
}

export interface QRadarSpecificConfig extends SIEMConfig {
  domainId?: number;
  referenceSetNames: string[];
  offenseRules: QRadarOffenseRule[];
  customProperties: QRadarCustomProperty[];
}

export interface QRadarOffenseRule {
  id: number;
  name: string;
  enabled: boolean;
  testMode: boolean;
  ruleType: string;
  conditions: any[];
}

export interface QRadarCustomProperty {
  name: string;
  type: string;
  description: string;
  regex?: string;
}

// Vulnerability Scanner Integration Types
export interface VulnerabilityScannerIntegration extends SecurityToolIntegration {
  platform: VulnerabilityScanner;
  scannerConfig: VulnerabilityScannerConfig;
}

export interface VulnerabilityScannerConfig {
  scanPolicies: ScanPolicy[];
  assetGroups: AssetGroup[];
  reportTemplates: string[];
  automatedScanning: AutomatedScanConfig;
  vulnerabilityFilters: VulnerabilityFilter[];
}

export interface ScanPolicy {
  id: string;
  name: string;
  description: string;
  scanType: 'network' | 'web-app' | 'compliance' | 'configuration';
  targets: string[]; // IPs, domains, or CIDR ranges
  schedule?: ScanSchedule;
  credentialSets?: string[];
  pluginSets?: string[];
}

export interface ScanSchedule {
  frequency: 'once' | 'daily' | 'weekly' | 'monthly';
  time?: string; // HH:MM format
  dayOfWeek?: number; // 0-6
  dayOfMonth?: number; // 1-31
  timezone?: string;
}

export interface AssetGroup {
  id: string;
  name: string;
  description: string;
  assetIdentifiers: AssetIdentifier[];
  tags: string[];
  criticality: 'critical' | 'high' | 'medium' | 'low';
}

export interface AssetIdentifier {
  type: 'ip' | 'hostname' | 'mac' | 'netbios' | 'fqdn';
  value: string;
}

export interface AutomatedScanConfig {
  enabled: boolean;
  scanOnAssetDiscovery: boolean;
  scanOnConfigChange: boolean;
  rescanInterval: number; // days
  maxConcurrentScans: number;
}

export interface VulnerabilityFilter {
  field: 'severity' | 'cvss' | 'age' | 'exploitability' | 'category';
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains';
  value: any;
}

// Vulnerability Data Model
export interface Vulnerability {
  id: string;
  scannerVulnId: string;
  
  // Identification
  cve?: string;
  cwe?: string;
  title: string;
  description: string;
  
  // Classification
  severity: SeverityLevel;
  cvssScore?: number;
  cvssVector?: string;
  category: string;
  family?: string;
  
  // Asset Information
  affectedAssets: AffectedAsset[];
  
  // Threat Context
  exploitAvailable: boolean;
  exploitMaturity?: 'functional' | 'poc' | 'unproven';
  malwareKnown: boolean;
  inTheWild: boolean;
  
  // Remediation
  solution: string;
  workaround?: string;
  patches?: Patch[];
  
  // Discovery
  firstSeen: Date;
  lastSeen: Date;
  scanId: string;
  
  // Risk Scoring
  riskScore: number;
  businessImpact?: string;
  
  // Status
  status: 'open' | 'remediated' | 'mitigated' | 'accepted' | 'false-positive';
  verificationStatus?: 'verified' | 'unverified' | 'false-positive';
  
  // Integration
  linkedTickets?: string[];
  linkedThreats?: string[];
}

export interface AffectedAsset {
  assetId: string;
  hostname?: string;
  ipAddress: string;
  port?: number;
  protocol?: string;
  service?: string;
  operatingSystem?: string;
  
  // Vulnerability Instance
  instanceId: string;
  output?: string;
  evidence?: string;
  
  // Status
  status: 'vulnerable' | 'remediated' | 'mitigated';
  lastChecked: Date;
}

export interface Patch {
  id: string;
  vendor: string;
  product: string;
  version: string;
  releaseDate: Date;
  downloadUrl?: string;
  installationNotes?: string;
}

// Cloud Security Center Integration Types
export interface CloudSecurityIntegration extends SecurityToolIntegration {
  platform: CloudPlatform;
  cloudConfig: CloudSecurityConfig;
}

export interface CloudSecurityConfig {
  accounts: CloudAccount[];
  regions?: string[];
  services: string[];
  complianceStandards: string[];
  automatedRemediation: RemediationConfig;
}

export interface CloudAccount {
  accountId: string;
  accountName: string;
  environment: 'production' | 'staging' | 'development' | 'test';
  tags?: Record<string, string>;
}

export interface RemediationConfig {
  enabled: boolean;
  approvalRequired: boolean;
  allowedActions: string[];
  excludedResources: string[];
  maxRemediationsPerHour: number;
}

// AWS Security Hub Types
export interface AWSSecurityHubIntegration extends CloudSecurityIntegration {
  platform: 'aws';
  awsConfig: AWSSecurityHubConfig;
}

export interface AWSSecurityHubConfig extends CloudSecurityConfig {
  hubArn: string;
  productArn?: string;
  standards: AWSSecurityStandard[];
  customInsights: AWSCustomInsight[];
}

export interface AWSSecurityStandard {
  standardArn: string;
  enabled: boolean;
  disabledControls?: string[];
}

export interface AWSCustomInsight {
  name: string;
  filters: any;
  groupByAttribute: string;
}

// Azure Security Center Types
export interface AzureSecurityCenterIntegration extends CloudSecurityIntegration {
  platform: 'azure';
  azureConfig: AzureSecurityCenterConfig;
}

export interface AzureSecurityCenterConfig extends CloudSecurityConfig {
  subscriptions: string[];
  resourceGroups?: string[];
  logAnalyticsWorkspaceId: string;
  securityContacts: AzureSecurityContact[];
  policies: AzureSecurityPolicy[];
}

export interface AzureSecurityContact {
  email: string;
  phone?: string;
  alertNotifications: boolean;
  alertsToAdmins: boolean;
}

export interface AzureSecurityPolicy {
  policyId: string;
  name: string;
  scope: string;
  parameters?: Record<string, any>;
}

// Google Cloud Security Command Center Types
export interface GCPSecurityCenterIntegration extends CloudSecurityIntegration {
  platform: 'gcp';
  gcpConfig: GCPSecurityCenterConfig;
}

export interface GCPSecurityCenterConfig extends CloudSecurityConfig {
  organizationId: string;
  sources: GCPSecuritySource[];
  notificationConfigs: GCPNotificationConfig[];
}

export interface GCPSecuritySource {
  name: string;
  displayName: string;
  description: string;
}

export interface GCPNotificationConfig {
  name: string;
  pubsubTopic: string;
  streamingConfig?: any;
  filter?: string;
}

// Cloud Security Finding
export interface CloudSecurityFinding {
  id: string;
  findingId: string;
  platform: CloudPlatform;
  
  // Finding Details
  title: string;
  description: string;
  severity: SeverityLevel;
  confidence: number; // 0-100
  
  // Resource Information
  resourceType: string;
  resourceId: string;
  resourceName?: string;
  region?: string;
  accountId: string;
  
  // Compliance
  complianceStatus?: 'compliant' | 'non-compliant' | 'not-applicable';
  complianceStandards?: string[];
  controlId?: string;
  
  // Threat Information
  category: string;
  threatIntelligence?: ThreatIntelligence;
  
  // Remediation
  remediation?: CloudRemediation;
  
  // Timeline
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
  
  // Status
  status: 'active' | 'resolved' | 'suppressed';
  workflowStatus?: string;
  
  // Integration
  linkedVulnerabilities?: string[];
  linkedTickets?: string[];
}

export interface ThreatIntelligence {
  indicatorType: string;
  indicatorValue: string;
  source: string;
  confidence: number;
  lastObserved: Date;
  relatedFindings?: string[];
}

export interface CloudRemediation {
  description: string;
  recommendation: string;
  automationAvailable: boolean;
  automationId?: string;
  estimatedCost?: number;
  impact?: string;
  steps?: string[];
}

// Ticketing System Integration Types
export interface TicketingIntegration extends SecurityToolIntegration {
  platform: TicketingPlatform;
  ticketingConfig: TicketingConfig;
}

export interface TicketingConfig {
  projects: TicketingProject[];
  issueTypes: IssueTypeMapping[];
  workflows: WorkflowMapping[];
  customFields: CustomFieldMapping[];
  automationRules: TicketAutomationRule[];
}

export interface TicketingProject {
  projectId: string;
  projectKey: string;
  projectName: string;
  defaultAssignee?: string;
  components?: string[];
  versions?: string[];
}

export interface IssueTypeMapping {
  threatModelType: string;
  ticketType: string;
  template?: string;
}

export interface WorkflowMapping {
  ticketStatus: string;
  threatStatus: string;
  transitions?: WorkflowTransition[];
}

export interface WorkflowTransition {
  from: string;
  to: string;
  condition?: string;
  actions?: string[];
}

export interface CustomFieldMapping {
  fieldId: string;
  fieldName: string;
  threatModelField: string;
  required: boolean;
  defaultValue?: any;
}

export interface TicketAutomationRule {
  id: string;
  name: string;
  trigger: AutomationTrigger;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  enabled: boolean;
}

export interface AutomationTrigger {
  type: 'threat-created' | 'threat-updated' | 'severity-change' | 'vulnerability-linked' | 'schedule';
  parameters?: Record<string, any>;
}

export interface AutomationCondition {
  field: string;
  operator: string;
  value: any;
}

export interface AutomationAction {
  type: 'create-ticket' | 'update-ticket' | 'add-comment' | 'change-status' | 'assign' | 'link';
  parameters: Record<string, any>;
}

// Ticket Model
export interface SecurityTicket {
  id: string;
  externalId: string;
  platform: TicketingPlatform;
  
  // Ticket Details
  title: string;
  description: string;
  type: string;
  priority: string;
  severity: SeverityLevel;
  
  // Assignment
  assignee?: string;
  reporter: string;
  watchers?: string[];
  
  // Status
  status: string;
  resolution?: string;
  
  // Linked Items
  linkedThreats: string[];
  linkedVulnerabilities: string[];
  linkedFindings: string[];
  linkedTickets: string[];
  
  // Timeline
  createdAt: Date;
  updatedAt: Date;
  dueDate?: Date;
  resolvedAt?: Date;
  
  // SLA
  slaStatus?: 'on-track' | 'at-risk' | 'breached';
  timeToResolution?: number; // minutes
  
  // Custom Fields
  customFields?: Record<string, any>;
  
  // Activity
  comments: TicketComment[];
  attachments: TicketAttachment[];
  history: TicketHistoryEntry[];
}

export interface TicketComment {
  id: string;
  author: string;
  body: string;
  createdAt: Date;
  updatedAt?: Date;
  internal: boolean;
}

export interface TicketAttachment {
  id: string;
  filename: string;
  size: number;
  mimeType: string;
  uploadedBy: string;
  uploadedAt: Date;
}

export interface TicketHistoryEntry {
  id: string;
  field: string;
  oldValue: any;
  newValue: any;
  changedBy: string;
  changedAt: Date;
}

// Real-time Correlation Types
export interface CorrelationEngine {
  id: string;
  name: string;
  description: string;
  
  // Rules
  rules: CorrelationEngineRule[];
  
  // Time Windows
  correlationWindow: number; // minutes
  lookbackPeriod: number; // minutes
  
  // Deduplication
  deduplicationEnabled: boolean;
  deduplicationFields: string[];
  
  // Enrichment
  enrichmentSources: EnrichmentSource[];
  
  // Output
  outputFormat: 'unified-threat' | 'custom';
  outputDestinations: OutputDestination[];
}

export interface CorrelationEngineRule {
  id: string;
  name: string;
  enabled: boolean;
  
  // Conditions
  sourceTypes: SecurityToolType[];
  conditions: RuleCondition[];
  aggregations?: RuleAggregation[];
  
  // Actions
  severity: SeverityLevel;
  tags: string[];
  actions: CorrelationAction[];
}

export interface RuleCondition {
  field: string;
  operator: string;
  value: any;
  caseInsensitive?: boolean;
}

export interface RuleAggregation {
  field: string;
  function: 'count' | 'sum' | 'avg' | 'min' | 'max' | 'unique';
  groupBy?: string[];
  having?: RuleCondition;
}

export interface CorrelationAction {
  type: 'create-threat' | 'update-threat' | 'create-ticket' | 'send-alert' | 'execute-playbook';
  parameters: Record<string, any>;
}

export interface EnrichmentSource {
  type: 'threat-intel' | 'asset-db' | 'user-db' | 'geo-ip' | 'custom';
  name: string;
  config: Record<string, any>;
}

export interface OutputDestination {
  type: 'database' | 'siem' | 'webhook' | 'message-queue';
  config: Record<string, any>;
}

// Unified Threat Model (Result of Correlation)
export interface UnifiedThreat {
  id: string;
  correlationId: string;
  
  // Threat Details
  title: string;
  description: string;
  severity: SeverityLevel;
  confidence: number; // 0-100
  
  // Sources
  sources: ThreatSource[];
  
  // Timeline
  firstSeen: Date;
  lastSeen: Date;
  eventCount: number;
  
  // Attribution
  actors?: string[];
  campaigns?: string[];
  techniques?: string[]; // MITRE ATT&CK
  
  // Impact
  affectedAssets: string[];
  affectedUsers?: string[];
  businessImpact?: string;
  
  // Response
  status: 'active' | 'investigating' | 'contained' | 'resolved';
  assignee?: string;
  responseActions: ResponseAction[];
  
  // Related Items
  relatedThreats?: string[];
  tickets?: string[];
  
  // Evidence
  evidence: Evidence[];
  
  // Risk Score
  riskScore: number; // 0-100
  riskFactors: RiskFactor[];
}

export interface ThreatSource {
  toolType: SecurityToolType;
  toolId: string;
  sourceId: string;
  timestamp: Date;
  rawData?: any;
}

export interface ResponseAction {
  id: string;
  type: string;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  executedBy?: string;
  executedAt?: Date;
  result?: any;
}

export interface Evidence {
  type: string;
  value: any;
  source: string;
  timestamp: Date;
  confidence: number;
}

export interface RiskFactor {
  factor: string;
  weight: number;
  description: string;
}

// Dashboard and Metrics Types
export interface SecurityPostureDashboard {
  generatedAt: Date;
  
  // Overall Metrics
  overallRiskScore: number;
  totalThreats: number;
  activeThreats: number;
  
  // By Tool Type
  toolMetrics: Map<SecurityToolType, ToolMetrics>;
  
  // Trends
  threatTrends: TrendData[];
  vulnerabilityTrends: TrendData[];
  
  // Top Items
  topThreats: UnifiedThreat[];
  topVulnerabilities: Vulnerability[];
  criticalFindings: CloudSecurityFinding[];
  
  // Coverage
  assetCoverage: number; // percentage
  toolCoverage: Map<SecurityToolType, number>;
  
  // Performance
  correlationMetrics: CorrelationMetrics;
  integrationHealth: Map<string, IntegrationHealth>;
}

export interface ToolMetrics {
  toolType: SecurityToolType;
  totalEvents: number;
  processedEvents: number;
  correlatedEvents: number;
  alertsGenerated: number;
  ticketsCreated: number;
  averageProcessingTime: number; // ms
}

export interface TrendData {
  timestamp: Date;
  value: number;
  change: number; // percentage
}

export interface CorrelationMetrics {
  totalCorrelations: number;
  successfulCorrelations: number;
  failedCorrelations: number;
  averageCorrelationTime: number; // ms
  deduplicationRate: number; // percentage
}

export interface IntegrationHealth {
  integrationId: string;
  status: IntegrationStatus;
  lastSync?: Date;
  syncErrors: number;
  dataLag?: number; // minutes
  availability: number; // percentage
}

// API Request/Response Types
export interface CreateIntegrationRequest {
  name: string;
  type: SecurityToolType;
  platform: string;
  description?: string;
  connectionConfig: Omit<ConnectionConfig, 'credentials'> & {
    credentials: Record<string, string>; // Will be encrypted
  };
  syncConfig?: {
    enabled: boolean;
    direction: SyncDirection;
    interval?: number;
    filter?: SyncFilter;
  };
  fieldMappings?: FieldMapping[];
  severityMapping?: SeverityMapping;
}

export interface UpdateIntegrationRequest {
  name?: string;
  description?: string;
  connectionConfig?: Partial<ConnectionConfig>;
  syncEnabled?: boolean;
  syncInterval?: number;
  syncFilter?: SyncFilter;
  fieldMappings?: FieldMapping[];
  severityMapping?: SeverityMapping;
  status?: IntegrationStatus;
  lastConnected?: Date;
  lastSync?: Date;
}

export interface TestConnectionRequest {
  type: SecurityToolType;
  platform: string;
  connectionConfig: Omit<ConnectionConfig, 'credentials'> & {
    credentials: Record<string, string>;
  };
}

export interface SyncRequest {
  integrationId: string;
  fullSync?: boolean;
  startDate?: string; // ISO date
  endDate?: string; // ISO date
}

export interface CorrelateEventsRequest {
  timeRange: {
    start: string; // ISO date
    end: string; // ISO date
  };
  sources?: SecurityToolType[];
  severities?: SeverityLevel[];
  correlationRules?: string[]; // Rule IDs
}

export interface CreateTicketRequest {
  threatId?: string;
  vulnerabilityId?: string;
  findingId?: string;
  integrationId: string;
  ticketData: {
    title: string;
    description: string;
    priority: string;
    assignee?: string;
    customFields?: Record<string, any>;
  };
}

// Error Types
export interface SecurityToolError {
  code: string;
  message: string;
  toolType?: SecurityToolType;
  platform?: string;
  integrationId?: string;
  details?: Record<string, any>;
  timestamp: Date;
}

// Event Types for Real-time Updates
export interface SecurityToolEvent {
  id: string;
  type: SecurityToolEventType;
  integrationId: string;
  timestamp: Date;
  data: any;
}

export type SecurityToolEventType =
  | 'integration.connected'
  | 'integration.disconnected'
  | 'integration.error'
  | 'sync.started'
  | 'sync.completed'
  | 'sync.failed'
  | 'threat.detected'
  | 'threat.correlated'
  | 'vulnerability.discovered'
  | 'finding.created'
  | 'ticket.created'
  | 'ticket.updated'
  | 'alert.triggered';

// Webhook Types
export interface WebhookConfig {
  id: string;
  url: string;
  events: SecurityToolEventType[];
  headers?: Record<string, string>;
  secret?: string;
  enabled: boolean;
  retryAttempts: number;
  retryDelay: number; // seconds
}

export interface WebhookPayload {
  event: SecurityToolEvent;
  integration: SecurityToolIntegration;
  timestamp: Date;
  signature?: string;
}