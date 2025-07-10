export interface ThreatModel {
  version: string;
  metadata: Metadata;
  system: System;
  dataFlows: DataFlow[];
  threats: Threat[];
  mitigations?: Mitigation[];
  assumptions?: string[];
  outOfScope?: string[];
}

export interface Metadata {
  name: string;
  description?: string;
  author: string;
  version?: string;
  created: string;
  updated: string;
  tags?: string[];
  compliance?: string[];
}

export interface System {
  name: string;
  type: SystemType;
  description?: string;
  architecture?: Architecture;
  components: Component[];
  trustBoundaries?: TrustBoundary[];
}

export type SystemType = 'web' | 'mobile' | 'api' | 'desktop' | 'embedded' | 'cloud' | 'hybrid';
export type Architecture = 'monolithic' | 'microservices' | 'serverless' | 'distributed';

export interface Component {
  id: string;
  name: string;
  type: ComponentType;
  description?: string;
  technology?: string;
  trust?: TrustLevel;
  encryption?: EncryptionConfig;
  authentication?: AuthType;
  authorization?: AuthzType;
  dataClassification?: DataClassification;
}

export type ComponentType = 
  | 'webserver' | 'appserver' | 'database' | 'cache' | 'queue'
  | 'loadbalancer' | 'firewall' | 'api' | 'frontend' | 'backend'
  | 'mobile-app' | 'desktop-app' | 'service' | 'function'
  | 'storage' | 'cdn' | 'dns' | 'identity-provider';

export type TrustLevel = 'trusted' | 'untrusted' | 'semi-trusted';
export type AuthType = 'none' | 'basic' | 'oauth2' | 'saml' | 'jwt' | 'certificate' | 'api-key';
export type AuthzType = 'none' | 'rbac' | 'abac' | 'acl';
export type DataClassification = 'public' | 'internal' | 'confidential' | 'restricted';

export interface EncryptionConfig {
  atRest: boolean;
  inTransit: boolean;
  algorithm?: string;
}

export interface DataFlow {
  id: string;
  name: string;
  description?: string;
  source: string;
  destination: string;
  protocol: Protocol;
  port?: number;
  authentication?: boolean;
  encryption?: boolean;
  dataType?: DataType;
  dataClassification?: DataClassification;
  bidirectional?: boolean;
}

export type Protocol = 'http' | 'https' | 'tcp' | 'udp' | 'websocket' | 'grpc' | 'amqp' | 'mqtt';
export type DataType = 'json' | 'xml' | 'binary' | 'text' | 'multimedia';

export interface TrustBoundary {
  id: string;
  name: string;
  type?: BoundaryType;
  components: string[];
}

export type BoundaryType = 'network' | 'process' | 'machine' | 'datacenter' | 'cloud';

export interface Threat {
  id: string;
  name: string;
  description?: string;
  category: ThreatCategory;
  severity: Severity;
  likelihood: Likelihood;
  components: string[];
  dataFlows?: string[];
  attackVector?: AttackVector;
  attackComplexity?: Complexity;
  privilegesRequired?: PrivilegeLevel;
  userInteraction?: UserInteraction;
  scope?: Scope;
  confidentialityImpact?: Impact;
  integrityImpact?: Impact;
  availabilityImpact?: Impact;
  cvssScore?: number;
  cweId?: string;
  mitreAttack?: MitreAttack;
}

export type ThreatCategory = 
  | 'spoofing' | 'tampering' | 'repudiation'
  | 'information-disclosure' | 'denial-of-service'
  | 'elevation-of-privilege' | 'lateral-movement'
  | 'data-exfiltration' | 'supply-chain';

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type Likelihood = 'certain' | 'likely' | 'possible' | 'unlikely' | 'rare';
export type AttackVector = 'network' | 'adjacent' | 'local' | 'physical';
export type Complexity = 'low' | 'high';
export type PrivilegeLevel = 'none' | 'low' | 'high';
export type UserInteraction = 'none' | 'required';
export type Scope = 'unchanged' | 'changed';
export type Impact = 'none' | 'low' | 'high';

export interface MitreAttack {
  tactic?: string;
  technique?: string;
  subtechnique?: string;
}

export interface Mitigation {
  id: string;
  name: string;
  description?: string;
  threats: string[];
  status: MitigationStatus;
  priority?: Severity;
  effort?: Effort;
  type?: MitigationType;
  components?: string[];
  verification?: Verification;
}

export type MitigationStatus = 'planned' | 'in-progress' | 'implemented' | 'verified';
export type Effort = 'low' | 'medium' | 'high';
export type MitigationType = 
  | 'preventive' | 'detective' | 'corrective'
  | 'deterrent' | 'compensating' | 'administrative'
  | 'technical' | 'physical';

export interface Verification {
  method?: VerificationMethod;
  lastVerified?: string;
  evidence?: string;
}

export type VerificationMethod = 'manual' | 'automated' | 'continuous';

// Analysis Results
export interface AnalysisResult {
  summary: AnalysisSummary;
  riskScore: number;
  findings: Finding[];
  recommendations: Recommendation[];
  complianceStatus: ComplianceStatus[];
}

export interface AnalysisSummary {
  totalComponents: number;
  totalDataFlows: number;
  totalThreats: number;
  totalMitigations: number;
  criticalThreats: number;
  highThreats: number;
  unmitigatedThreats: number;
  coveragePercentage: number;
}

export interface Finding {
  type: FindingType;
  severity: Severity;
  title: string;
  description: string;
  affectedComponents?: string[];
  recommendation?: string;
}

export type FindingType = 
  | 'unmitigated-threat'
  | 'missing-encryption'
  | 'weak-authentication'
  | 'trust-boundary-violation'
  | 'data-flow-risk'
  | 'compliance-gap';

export interface Recommendation {
  priority: Severity;
  title: string;
  description: string;
  effort: Effort;
  components?: string[];
}

export interface ComplianceStatus {
  framework: string;
  status: 'compliant' | 'partial' | 'non-compliant';
  gaps?: string[];
}

// Diff Types
export interface ThreatModelDiff {
  added: DiffSection;
  removed: DiffSection;
  modified: DiffSection;
  summary: DiffSummary;
}

export interface DiffSection {
  components?: Component[];
  dataFlows?: DataFlow[];
  threats?: Threat[];
  mitigations?: Mitigation[];
}

export interface DiffSummary {
  totalChanges: number;
  addedThreats: number;
  removedThreats: number;
  modifiedThreats: number;
  addedMitigations: number;
  removedMitigations: number;
  riskScoreChange: number;
}

// Export Formats
export type ExportFormat = 'json' | 'yaml' | 'markdown' | 'html' | 'pdf' | 'docx' | 'drawio';

export interface ExportOptions {
  format: ExportFormat;
  includeMetadata?: boolean;
  includeDiagrams?: boolean;
  includeAnalysis?: boolean;
  template?: string;
}