// Natural Language Processing Types

export interface NLPAnalysisRequest {
  text: string;
  context?: string;
  language?: string;
  analysisType: NLPAnalysisType;
  options?: NLPAnalysisOptions;
}

export type NLPAnalysisType =
  | 'threat-extraction'
  | 'requirement-analysis'
  | 'vulnerability-detection'
  | 'compliance-mapping'
  | 'risk-assessment'
  | 'technical-decomposition'
  | 'security-control-suggestion'
  | 'threat-narrative-generation'
  | 'report-generation'
  | 'query-understanding';

export interface NLPAnalysisOptions {
  includeConfidenceScores?: boolean;
  includeSuggestions?: boolean;
  includeExplanations?: boolean;
  maxResults?: number;
  minConfidence?: number;
  targetFramework?: ComplianceFramework;
  technicalLevel?: 'beginner' | 'intermediate' | 'expert';
  outputFormat?: 'structured' | 'narrative' | 'technical';
  reportType?: ReportType;
  format?: 'markdown' | 'html' | 'pdf' | 'docx';
  audience?: 'technical' | 'executive' | 'audit';
}

export interface NLPAnalysisResponse {
  requestId: string;
  timestamp: Date;
  analysisType: NLPAnalysisType;
  results: NLPResult[];
  metadata: NLPMetadata;
  suggestions?: NLPSuggestion[];
  confidence: number;
}

export interface NLPResult {
  type: string;
  value: any;
  confidence: number;
  explanation?: string;
  references?: string[];
  position?: TextPosition;
}

export interface TextPosition {
  start: number;
  end: number;
  text: string;
}

export interface NLPMetadata {
  processingTime: number;
  tokensProcessed: number;
  language: string;
  models: string[];
  version: string;
}

export interface NLPSuggestion {
  type: 'improvement' | 'clarification' | 'security' | 'compliance';
  text: string;
  rationale: string;
  priority: 'low' | 'medium' | 'high';
  actionable: boolean;
}

// Threat Extraction Types
export interface ExtractedThreat {
  id: string;
  name: string;
  description: string;
  category: ThreatCategory;
  attackVector: string;
  impactedAssets: string[];
  likelihood: number;
  impact: number;
  mitigations: string[];
  stride?: STRIDECategory[];
  cwe?: string[];
  capec?: string[];
  confidence: number;
}

export type ThreatCategory =
  | 'spoofing'
  | 'tampering'
  | 'repudiation'
  | 'information-disclosure'
  | 'denial-of-service'
  | 'elevation-of-privilege'
  | 'social-engineering'
  | 'physical-security'
  | 'supply-chain'
  | 'insider-threat';

export type STRIDECategory = 'S' | 'T' | 'R' | 'I' | 'D' | 'E';

// Requirement Analysis Types
export interface SecurityRequirement {
  id: string;
  text: string;
  type: RequirementType;
  priority: 'must-have' | 'should-have' | 'nice-to-have';
  category: string;
  testable: boolean;
  measurable: boolean;
  relatedThreats: string[];
  implementationNotes: string;
  verificationCriteria: string[];
}

export type RequirementType =
  | 'functional'
  | 'non-functional'
  | 'constraint'
  | 'assumption'
  | 'dependency';

// Vulnerability Detection Types
export interface DetectedVulnerability {
  id: string;
  name: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  cve?: string;
  cwe?: string;
  owasp?: string;
  affectedComponent: string;
  exploitability: number;
  remediation: string;
  references: string[];
  confidence: number;
}

// Compliance Mapping Types
export interface ComplianceMapping {
  framework: ComplianceFramework;
  requirements: ComplianceRequirement[];
  coverage: number;
  gaps: ComplianceGap[];
  recommendations: string[];
}

export type ComplianceFramework =
  | 'GDPR'
  | 'HIPAA'
  | 'PCI-DSS'
  | 'SOC2'
  | 'ISO27001'
  | 'NIST'
  | 'CIS'
  | 'OWASP'
  | 'CCPA'
  | 'FedRAMP';

export interface ComplianceRequirement {
  id: string;
  text: string;
  section: string;
  status: 'compliant' | 'partial' | 'non-compliant' | 'not-applicable';
  evidence: string[];
  controls: string[];
}

export interface ComplianceGap {
  requirement: string;
  currentState: string;
  desiredState: string;
  remediation: string;
  effort: 'low' | 'medium' | 'high';
  priority: number;
}

// Risk Assessment Types
export interface RiskAssessment {
  overallRisk: RiskLevel;
  riskScore: number;
  riskFactors: RiskFactor[];
  riskMatrix: RiskMatrixEntry[];
  recommendations: RiskRecommendation[];
  trends: RiskTrend[];
}

export type RiskLevel = 'critical' | 'high' | 'medium' | 'low' | 'minimal';

export interface RiskFactor {
  name: string;
  description: string;
  impact: number;
  likelihood: number;
  category: string;
  mitigations: string[];
}

export interface RiskMatrixEntry {
  threat: string;
  vulnerability: string;
  impact: number;
  likelihood: number;
  riskScore: number;
  treatmentStrategy: 'accept' | 'mitigate' | 'transfer' | 'avoid';
}

export interface RiskRecommendation {
  priority: number;
  action: string;
  rationale: string;
  effort: string;
  riskReduction: number;
}

export interface RiskTrend {
  period: string;
  riskLevel: RiskLevel;
  change: 'increasing' | 'stable' | 'decreasing';
  factors: string[];
}

// Technical Decomposition Types
export interface TechnicalDecomposition {
  architecture: ArchitectureComponent[];
  dataFlows: DataFlow[];
  trustBoundaries: TrustBoundary[];
  attackSurface: AttackSurface[];
  dependencies: Dependency[];
}

export interface ArchitectureComponent {
  id: string;
  name: string;
  type: ComponentType;
  description: string;
  technologies: string[];
  interfaces: Interface[];
  securityControls: string[];
  threats: string[];
}

export type ComponentType =
  | 'web-application'
  | 'api'
  | 'database'
  | 'message-queue'
  | 'cache'
  | 'load-balancer'
  | 'cdn'
  | 'third-party-service'
  | 'mobile-app'
  | 'iot-device';

export interface DataFlow {
  id: string;
  source: string;
  destination: string;
  protocol: string;
  dataType: string;
  encryption: boolean;
  authentication: boolean;
  threats: string[];
}

export interface TrustBoundary {
  id: string;
  name: string;
  components: string[];
  crossingFlows: string[];
  securityRequirements: string[];
}

export interface AttackSurface {
  component: string;
  exposureType: 'public' | 'internal' | 'partner';
  protocols: string[];
  ports: number[];
  authentication: string[];
  vulnerabilities: string[];
}

export interface Dependency {
  name: string;
  version: string;
  type: 'library' | 'service' | 'infrastructure';
  vulnerabilities: string[];
  updates: string[];
  criticality: 'critical' | 'high' | 'medium' | 'low';
}

// Security Control Suggestion Types
export interface SecurityControlSuggestion {
  control: SecurityControl;
  rationale: string;
  effectiveness: number;
  implementationEffort: 'low' | 'medium' | 'high';
  costEstimate: string;
  mitigatedThreats: string[];
  complianceAlignment: string[];
}

export interface SecurityControl {
  id: string;
  name: string;
  type: ControlType;
  category: ControlCategory;
  description: string;
  implementation: string;
  verification: string;
  maintenance: string;
}

export type ControlType = 'preventive' | 'detective' | 'corrective' | 'compensating';

export type ControlCategory =
  | 'access-control'
  | 'encryption'
  | 'monitoring'
  | 'incident-response'
  | 'backup-recovery'
  | 'network-security'
  | 'application-security'
  | 'data-protection'
  | 'physical-security'
  | 'awareness-training';

// Query Understanding Types
export interface QueryIntent {
  intent: IntentType;
  entities: Entity[];
  context: QueryContext;
  suggestedActions: string[];
  clarificationNeeded?: string[];
}

export type IntentType =
  | 'find-threats'
  | 'assess-risk'
  | 'check-compliance'
  | 'suggest-controls'
  | 'explain-vulnerability'
  | 'generate-report'
  | 'analyze-architecture'
  | 'compare-options'
  | 'get-recommendations'
  | 'troubleshoot-issue';

export interface Entity {
  type: EntityType;
  value: string;
  normalized: string;
  confidence: number;
}

export type EntityType =
  | 'component'
  | 'threat'
  | 'vulnerability'
  | 'framework'
  | 'technology'
  | 'risk-level'
  | 'time-period'
  | 'action'
  | 'metric';

export interface QueryContext {
  domain: string;
  previousQueries: string[];
  currentFocus: string;
  userExpertise: string;
}

// Report Generation Types
export interface ReportGenerationRequest {
  reportType: ReportType;
  data: any;
  template?: string;
  format: 'markdown' | 'html' | 'pdf' | 'docx';
  language: string;
  audience: 'technical' | 'executive' | 'audit';
  sections?: ReportSection[];
}

export type ReportType =
  | 'threat-assessment'
  | 'risk-analysis'
  | 'compliance-audit'
  | 'security-posture'
  | 'incident-response'
  | 'vulnerability-scan'
  | 'architecture-review'
  | 'executive-summary';

export interface ReportSection {
  title: string;
  content: string;
  subsections?: ReportSection[];
  charts?: Chart[];
  tables?: Table[];
  recommendations?: string[];
}

export interface Chart {
  type: 'bar' | 'pie' | 'line' | 'radar' | 'heatmap';
  title: string;
  data: any;
  options?: any;
}

export interface Table {
  headers: string[];
  rows: string[][];
  caption?: string;
}

// Model Configuration Types
export interface NLPModelConfig {
  modelId: string;
  modelType: ModelType;
  provider: ModelProvider;
  version: string;
  endpoint?: string;
  apiKey?: string;
  maxTokens?: number;
  temperature?: number;
  cacheEnabled?: boolean;
  fallbackModel?: string;
}

export type ModelType =
  | 'text-generation'
  | 'text-classification'
  | 'named-entity-recognition'
  | 'question-answering'
  | 'summarization'
  | 'translation'
  | 'embedding';

export type ModelProvider =
  | 'openai'
  | 'anthropic'
  | 'huggingface'
  | 'google'
  | 'azure'
  | 'local';

// Training and Fine-tuning Types
export interface TrainingDataset {
  id: string;
  name: string;
  type: DatasetType;
  size: number;
  examples: TrainingExample[];
  validation: ValidationMetrics;
}

export type DatasetType =
  | 'threat-descriptions'
  | 'security-requirements'
  | 'vulnerability-reports'
  | 'compliance-documents'
  | 'architecture-diagrams'
  | 'incident-reports';

export interface TrainingExample {
  input: string;
  output: any;
  metadata?: any;
  weight?: number;
}

export interface ValidationMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  confusionMatrix?: number[][];
}

// Interface for external integrations
export interface Interface {
  name: string;
  type: 'rest' | 'graphql' | 'grpc' | 'websocket';
  endpoint: string;
  authentication: string;
}