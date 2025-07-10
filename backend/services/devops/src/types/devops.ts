export interface PipelineConfig {
  id: string;
  name: string;
  platform: 'github' | 'gitlab' | 'jenkins' | 'azure-devops' | 'bitbucket' | 'circleci';
  projectId: string;
  threatModelId: string;
  enabled: boolean;
  settings: PlatformSettings;
  triggers: PipelineTrigger[];
  stages: PipelineStage[];
  notifications: NotificationConfig;
  metadata: {
    createdBy: string;
    createdAt: Date;
    lastModifiedBy: string;
    lastModified: Date;
    version: number;
  };
}

export interface PlatformSettings {
  github?: {
    owner: string;
    repo: string;
    token?: string;
    webhookSecret?: string;
  };
  gitlab?: {
    projectId: string;
    token?: string;
    url?: string;
  };
  jenkins?: {
    url: string;
    username?: string;
    apiToken?: string;
    jobName: string;
  };
  azureDevops?: {
    organization: string;
    project: string;
    token?: string;
    pipelineId: string;
  };
  bitbucket?: {
    workspace: string;
    repo: string;
    appPassword?: string;
  };
  circleci?: {
    projectSlug: string;
    token?: string;
  };
}

export interface PipelineTrigger {
  type: 'push' | 'pull_request' | 'tag' | 'schedule' | 'manual' | 'webhook';
  branches?: string[];
  tags?: string[];
  schedule?: string; // Cron expression
  conditions?: TriggerCondition[];
}

export interface TriggerCondition {
  type: 'file_change' | 'commit_message' | 'author' | 'label';
  pattern: string;
  action: 'include' | 'exclude';
}

export interface PipelineStage {
  id: string;
  name: string;
  type: 'threat-scan' | 'vulnerability-scan' | 'compliance-check' | 'custom';
  order: number;
  enabled: boolean;
  config: StageConfig;
  failureAction: 'fail' | 'warn' | 'continue';
  timeout?: number;
}

export interface StageConfig {
  threatScan?: {
    modelId: string;
    scanType: 'full' | 'incremental' | 'targeted';
    components?: string[];
    severityThreshold?: 'low' | 'medium' | 'high' | 'critical';
    autoRemediate?: boolean;
  };
  vulnerabilityScan?: {
    scanners: string[];
    includeDevDependencies?: boolean;
    failOnCVSS?: number;
    ignorePatterns?: string[];
  };
  complianceCheck?: {
    frameworks: string[];
    controls?: string[];
    generateReport?: boolean;
  };
  custom?: {
    script: string;
    environment?: Record<string, string>;
    artifacts?: string[];
  };
}

export interface NotificationConfig {
  channels: NotificationChannel[];
  events: NotificationEvent[];
  recipients?: string[];
}

export interface NotificationChannel {
  type: 'email' | 'slack' | 'teams' | 'webhook' | 'jira' | 'github-issue';
  config: Record<string, any>;
  enabled: boolean;
}

export interface NotificationEvent {
  type: 'pipeline_start' | 'pipeline_complete' | 'pipeline_failed' | 'threat_found' | 'vulnerability_found' | 'compliance_failed';
  severity?: 'info' | 'warning' | 'error' | 'critical';
  template?: string;
}

export interface PipelineRun {
  id: string;
  pipelineId: string;
  runNumber: number;
  status: 'pending' | 'running' | 'success' | 'failed' | 'cancelled';
  trigger: {
    type: string;
    user?: string;
    commit?: string;
    branch?: string;
    message?: string;
  };
  startTime: Date;
  endTime?: Date;
  duration?: number;
  stages: StageResult[];
  summary: PipelineSummary;
  artifacts?: PipelineArtifact[];
}

export interface StageResult {
  stageId: string;
  name: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
  startTime: Date;
  endTime?: Date;
  duration?: number;
  output?: any;
  errors?: string[];
  warnings?: string[];
  findings?: Finding[];
}

export interface Finding {
  id: string;
  type: 'threat' | 'vulnerability' | 'compliance_issue' | 'code_quality';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  component?: string;
  file?: string;
  line?: number;
  recommendation?: string;
  references?: string[];
  cwe?: string;
  cve?: string;
  fixAvailable?: boolean;
  autoFixApplied?: boolean;
}

export interface PipelineSummary {
  totalFindings: number;
  findingsBySeverity: Record<string, number>;
  findingsByType: Record<string, number>;
  threatsDetected: number;
  vulnerabilitiesFound: number;
  complianceIssues: number;
  autoRemediations: number;
  riskScore: number;
  recommendation: 'pass' | 'review' | 'fail';
}

export interface PipelineArtifact {
  id: string;
  name: string;
  type: 'report' | 'log' | 'scan_result' | 'threat_model' | 'sbom';
  path: string;
  size: number;
  mimeType: string;
  checksum: string;
  metadata?: Record<string, any>;
}

export interface WebhookPayload {
  event: string;
  platform: string;
  data: any;
  signature?: string;
  timestamp: Date;
}

export interface IntegrationStatus {
  platform: string;
  connected: boolean;
  lastSync?: Date;
  error?: string;
  capabilities: string[];
  version?: string;
}

export interface ScanTemplate {
  id: string;
  name: string;
  description: string;
  platform: string;
  stages: PipelineStage[];
  variables?: Record<string, any>;
  tags: string[];
  public: boolean;
  rating: number;
  usageCount: number;
}

export interface RemediationAction {
  id: string;
  findingId: string;
  type: 'code_fix' | 'config_change' | 'dependency_update' | 'architecture_change';
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  automated: boolean;
  description: string;
  diff?: string;
  pullRequestUrl?: string;
  appliedBy?: string;
  appliedAt?: Date;
  result?: any;
}

export interface PipelineMetrics {
  pipelineId: string;
  period: 'day' | 'week' | 'month' | 'year';
  totalRuns: number;
  successRate: number;
  averageDuration: number;
  findingsOverTime: Array<{
    date: Date;
    count: number;
    severity: Record<string, number>;
  }>;
  topFindings: Finding[];
  remediationRate: number;
  mttr: number; // Mean Time To Remediation
  falsePositiveRate: number;
}

export interface CodeRepository {
  id: string;
  platform: string;
  url: string;
  branch: string;
  lastCommit?: string;
  threatModels: string[];
  scanHistory: PipelineRun[];
  settings: {
    autoScan: boolean;
    scanOnPush: boolean;
    scanOnPR: boolean;
    protectedBranches: string[];
    requiredChecks: string[];
  };
}

export interface SecurityGate {
  id: string;
  name: string;
  type: 'pre_commit' | 'pre_merge' | 'pre_deploy' | 'post_deploy';
  conditions: GateCondition[];
  actions: GateAction[];
  enabled: boolean;
}

export interface GateCondition {
  type: 'finding_count' | 'severity_threshold' | 'compliance_status' | 'risk_score';
  operator: 'equals' | 'greater_than' | 'less_than' | 'contains';
  value: any;
}

export interface GateAction {
  type: 'block' | 'warn' | 'notify' | 'approve' | 'create_issue';
  config: Record<string, any>;
}

export interface PipelineTemplate {
  id: string;
  name: string;
  description: string;
  platform: string;
  yaml: string;
  variables: Array<{
    name: string;
    type: string;
    default?: any;
    required: boolean;
    description?: string;
  }>;
  tags: string[];
  category: 'security' | 'compliance' | 'quality' | 'custom';
  author: string;
  version: string;
  downloads: number;
  rating: number;
}

export interface IntegrationCredentials {
  platform: string;
  credentials: Record<string, any>;
  expiresAt?: Date;
  scopes?: string[];
  validated: boolean;
  lastValidated?: Date;
}

export interface ScanPolicy {
  id: string;
  name: string;
  description: string;
  rules: PolicyRule[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  scope: {
    platforms?: string[];
    repositories?: string[];
    branches?: string[];
    filePatterns?: string[];
  };
}

export interface PolicyRule {
  id: string;
  type: 'threat_pattern' | 'vulnerability_pattern' | 'code_pattern' | 'config_pattern';
  pattern: string;
  action: 'flag' | 'block' | 'fix' | 'notify';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  autoFix?: {
    enabled: boolean;
    template: string;
  };
}