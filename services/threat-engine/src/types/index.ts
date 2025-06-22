// Core threat modeling types
export interface ThreatAnalysisRequest {
  threatModelId: string;
  projectId?: string;
  methodology: ThreatModelingMethodology;
  components: Component[];
  dataFlows: DataFlow[];
  assumptions?: string[];
  securityRequirements?: SecurityRequirement[];
  options?: Partial<AnalysisOptions>;
}

export interface ThreatAnalysisResponse {
  threatModelId: string;
  methodology: ThreatModelingMethodology;
  threats: IdentifiedThreat[];
  riskAssessment: RiskAssessment;
  mitigationRecommendations: MitigationRecommendation[];
  analysisMetadata: AnalysisMetadata;
  confidence: number;
  processingTimeMs: number;
}

// Threat modeling methodologies
export enum ThreatModelingMethodology {
  STRIDE = 'stride',
  PASTA = 'pasta',
  VAST = 'vast',
  TRIKE = 'trike',
  OCTAVE = 'octave',
  LINDDUN = 'linddun',
  CUSTOM = 'custom',
}

// STRIDE categories
export enum StrideCategory {
  SPOOFING = 'spoofing',
  TAMPERING = 'tampering', 
  REPUDIATION = 'repudiation',
  INFORMATION_DISCLOSURE = 'information_disclosure',
  DENIAL_OF_SERVICE = 'denial_of_service',
  ELEVATION_OF_PRIVILEGE = 'elevation_of_privilege',
}

// PASTA stages
export enum PastaStage {
  DEFINE_OBJECTIVES = 'define_objectives',
  DEFINE_TECHNICAL_SCOPE = 'define_technical_scope',
  APPLICATION_DECOMPOSITION = 'application_decomposition',
  THREAT_ANALYSIS = 'threat_analysis',
  WEAKNESS_ANALYSIS = 'weakness_analysis',
  ATTACK_MODELING = 'attack_modeling',
  RISK_IMPACT_ANALYSIS = 'risk_impact_analysis',
}

// Component types from project service
export interface Component {
  id: string;
  name: string;
  type: ComponentType;
  description?: string;
  properties: ComponentProperties;
  position?: Position;
  connections: string[];
}

export enum ComponentType {
  PROCESS = 'process',
  DATA_STORE = 'data_store',
  EXTERNAL_ENTITY = 'external_entity',
  TRUST_BOUNDARY = 'trust_boundary',
}

export interface ComponentProperties {
  technology?: string;
  platform?: string;
  protocols: string[];
  authentication: string[];
  authorization: string[];
  encryption: string[];
  logging: string[];
  sensitive: boolean;
  internetFacing: boolean;
  privileged: boolean;
}

export interface Position {
  x: number;
  y: number;
  width?: number;
  height?: number;
}

// Data flow types
export interface DataFlow {
  id: string;
  name: string;
  sourceId: string;
  targetId: string;
  description?: string;
  dataType: string;
  protocol?: string;
  authentication?: string;
  encryption?: string;
  sensitive: boolean;
  bidirectional: boolean;
}

// Security requirements
export interface SecurityRequirement {
  id: string;
  category: SecurityCategory;
  requirement: string;
  priority: RequirementPriority;
  complianceFrameworks: string[];
}

export enum SecurityCategory {
  CONFIDENTIALITY = 'confidentiality',
  INTEGRITY = 'integrity',
  AVAILABILITY = 'availability',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  NON_REPUDIATION = 'non_repudiation',
  ACCOUNTABILITY = 'accountability',
}

export enum RequirementPriority {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

// Analysis options
export interface AnalysisOptions {
  includeCommonThreats: boolean;
  includeDomainSpecificThreats: boolean;
  enableMlPredictions: boolean;
  enablePatternMatching: boolean;
  enableDreadScoring: boolean;
  riskCalculationMethod: RiskCalculationMethod;
  confidenceThreshold: number;
  maxThreatsPerComponent: number;
  includeAssetValuation: boolean;
  considerComplianceRequirements: boolean;
  includeDetailedRecommendations?: boolean;
}

export enum RiskCalculationMethod {
  DREAD = 'dread',
  CVSS = 'cvss',
  OWASP_RISK = 'owasp_risk',
  CUSTOM = 'custom',
}

// Identified threat
export interface IdentifiedThreat {
  id: string;
  title: string;
  description: string;
  category: ThreatCategory;
  strideCategories: StrideCategory[];
  severity: ThreatSeverity;
  likelihood: ThreatLikelihood;
  impact: ThreatImpact;
  riskScore: number;
  affectedComponents: string[];
  affectedDataFlows: string[];
  attackVectors: AttackVector[];
  prerequisites: string[];
  securityRequirements: string[];
  confidence: number;
  source: ThreatSource;
}

export enum ThreatCategory {
  SPOOFING = 'spoofing',
  TAMPERING = 'tampering',
  REPUDIATION = 'repudiation',
  INFORMATION_DISCLOSURE = 'information_disclosure',
  DENIAL_OF_SERVICE = 'denial_of_service',
  ELEVATION_OF_PRIVILEGE = 'elevation_of_privilege',
}

export enum ThreatSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum ThreatLikelihood {
  VERY_LOW = 'very_low',
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  VERY_HIGH = 'very_high',
}

export enum ThreatImpact {
  VERY_LOW = 'very_low',
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  VERY_HIGH = 'very_high',
}

export interface AttackVector {
  vector: string;
  complexity: AttackComplexity;
  requirements: string[];
  mitigations: string[];
}

export enum AttackComplexity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

export enum ThreatSource {
  PATTERN_MATCHING = 'pattern_matching',
  RULE_BASED = 'rule_based',
  ML_PREDICTION = 'ml_prediction',
  KNOWLEDGE_BASE = 'knowledge_base',
  USER_INPUT = 'user_input',
}

// Risk assessment
export interface RiskAssessment {
  overallRiskScore: number;
  riskLevel: RiskLevel;
  riskDistribution: RiskDistribution;
  criticalThreats: IdentifiedThreat[];
  riskFactors: RiskFactor[];
  complianceGaps: ComplianceGap[];
}

export enum RiskLevel {
  VERY_LOW = 'very_low',
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  VERY_HIGH = 'very_high',
  CRITICAL = 'critical',
}

export interface RiskDistribution {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export interface RiskFactor {
  factor: string;
  impact: number;
  description: string;
}

export interface ComplianceGap {
  framework: string;
  requirement: string;
  gap: string;
  severity: ThreatSeverity;
}

// Mitigation recommendations
export interface MitigationRecommendation {
  id: string;
  title: string;
  description: string;
  category: MitigationCategory;
  implementation: MitigationImplementation;
  applicableThreats: string[];
  effectiveness: number;
  cost: MitigationCost;
  effort: MitigationEffort;
  priority: MitigationPriority;
  steps: ImplementationStep[];
  alternatives: AlternativeMitigation[];
  complianceFrameworks: string[];
}

export enum MitigationCategory {
  PREVENTIVE = 'preventive',
  DETECTIVE = 'detective',
  CORRECTIVE = 'corrective',
  COMPENSATING = 'compensating',
}

export enum MitigationImplementation {
  TECHNICAL = 'technical',
  OPERATIONAL = 'operational',
  MANAGEMENT = 'management',
}

export enum MitigationCost {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  VERY_HIGH = 'very_high',
}

export enum MitigationEffort {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  VERY_HIGH = 'very_high',
}

export enum MitigationPriority {
  IMMEDIATE = 'immediate',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

export interface ImplementationStep {
  step: number;
  description: string;
  estimatedHours: number;
  dependencies: string[];
}

export interface AlternativeMitigation {
  title: string;
  description: string;
  effectiveness: number;
  cost: MitigationCost;
  effort: MitigationEffort;
}

// Analysis metadata
export interface AnalysisMetadata {
  timestamp: Date;
  version: string;
  methodology: ThreatModelingMethodology;
  totalThreats: number;
  componentsAnalyzed: number;
  dataFlowsAnalyzed: number;
  processingSteps: ProcessingStep[];
  warnings: AnalysisWarning[];
  recommendations: SystemRecommendation[];
  analysisId?: string;
  serviceVersion?: string;
  totalProcessingTime?: number;
  performanceMetrics?: {
    threatsPerSecond?: number;
    componentsPerSecond?: number;
  };
}

export interface ProcessingStep {
  step: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  status: ProcessingStatus;
  details?: any;
}

export enum ProcessingStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  SKIPPED = 'skipped',
}

export interface AnalysisWarning {
  level: WarningLevel;
  message: string;
  component?: string;
  suggestion?: string;
}

export enum WarningLevel {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
}

export interface SystemRecommendation {
  category: RecommendationCategory;
  recommendation: string;
  rationale: string;
  priority: RequirementPriority;
}

export enum RecommendationCategory {
  ARCHITECTURE = 'architecture',
  SECURITY_CONTROLS = 'security_controls',
  PROCESS_IMPROVEMENT = 'process_improvement',
  TOOL_INTEGRATION = 'tool_integration',
}

// DREAD scoring
export interface DreadScore {
  damage: number;
  reproducibility: number;
  exploitability: number;
  affectedUsers: number;
  discoverability: number;
  overallScore: number;
}

// CVSS scoring
export interface CvssScore {
  baseScore: number;
  temporalScore?: number;
  environmentalScore?: number;
  vector: string;
  severity: ThreatSeverity;
}

// Threat patterns
export interface ThreatPattern {
  id: string;
  name: string;
  description: string;
  category: ThreatCategory;
  applicableComponents: ComponentType[];
  conditions: PatternCondition[];
  threatTemplate: ThreatTemplate;
  confidence: number;
  lastUpdated: Date;
}

export interface PatternCondition {
  type: ConditionType;
  property: string;
  operator: ConditionOperator;
  value: any;
  weight: number;
}

export enum ConditionType {
  COMPONENT_PROPERTY = 'component_property',
  DATA_FLOW_PROPERTY = 'data_flow_property',
  RELATIONSHIP = 'relationship',
  SECURITY_REQUIREMENT = 'security_requirement',
}

export enum ConditionOperator {
  EQUALS = 'equals',
  NOT_EQUALS = 'not_equals',
  CONTAINS = 'contains',
  NOT_CONTAINS = 'not_contains',
  GREATER_THAN = 'greater_than',
  LESS_THAN = 'less_than',
  EXISTS = 'exists',
  NOT_EXISTS = 'not_exists',
}

export interface ThreatTemplate {
  title: string;
  description: string;
  category: ThreatCategory;
  strideCategories: StrideCategory[];
  severity: ThreatSeverity;
  likelihood: ThreatLikelihood;
  impact: ThreatImpact;
  attackVectors: AttackVector[];
  mitigationSuggestions: string[];
}

// Knowledge base
export interface KnowledgeBase {
  threats: ThreatKnowledge[];
  vulnerabilities: VulnerabilityKnowledge[];
  mitigations: MitigationKnowledge[];
  patterns: ThreatPattern[];
  lastUpdated: Date;
}

export interface ThreatKnowledge {
  id: string;
  name: string;
  description: string;
  category: ThreatCategory;
  cweIds: string[];
  owasp: string[];
  capec: string[];
  mitre: string[];
  references: Reference[];
}

export interface VulnerabilityKnowledge {
  id: string;
  cveId?: string;
  name: string;
  description: string;
  severity: ThreatSeverity;
  cvssScore?: CvssScore;
  affectedTechnologies: string[];
  exploitComplexity: AttackComplexity;
  references: Reference[];
}

export interface MitigationKnowledge {
  id: string;
  name: string;
  description: string;
  category: MitigationCategory;
  implementation: MitigationImplementation;
  effectiveness: number;
  applicableThreats: string[];
  applicableVulnerabilities: string[];
  cost: MitigationCost;
  effort: MitigationEffort;
  references: Reference[];
}

export interface Reference {
  title: string;
  url: string;
  type: ReferenceType;
}

export enum ReferenceType {
  STANDARD = 'standard',
  GUIDELINE = 'guideline',
  TOOL = 'tool',
  RESEARCH = 'research',
  VENDOR = 'vendor',
}

// Engine configuration
export interface EngineConfig {
  methodology: ThreatModelingMethodology;
  riskCalculationMethod: RiskCalculationMethod;
  confidenceThreshold: number;
  maxThreatsPerComponent: number;
  enablePatternMatching: boolean;
  enableMlPredictions: boolean;
  customRules: CustomRule[];
}

export interface CustomRule {
  id: string;
  name: string;
  description: string;
  conditions: PatternCondition[];
  actions: RuleAction[];
  enabled: boolean;
}

export interface RuleAction {
  type: ActionType;
  parameters: Record<string, any>;
}

export enum ActionType {
  ADD_THREAT = 'add_threat',
  MODIFY_RISK = 'modify_risk',
  ADD_MITIGATION = 'add_mitigation',
  SET_PRIORITY = 'set_priority',
  ADD_WARNING = 'add_warning',
}

// API response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: Date;
  processingTime?: number;
}

export interface ErrorResponse {
  error: string;
  message: string;
  statusCode: number;
  requestId?: string;
  details?: any;
  timestamp: Date;
}

// Pagination
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

// Async job types
export interface AnalysisJob {
  id: string;
  threatModelId: string;
  projectId: string;
  status: JobStatus;
  progress: number;
  startedAt: Date;
  completedAt?: Date;
  result?: ThreatAnalysisResponse;
  error?: string;
  metadata: JobMetadata;
}

export enum JobStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export interface JobMetadata {
  userId: string;
  methodology: ThreatModelingMethodology;
  options: AnalysisOptions;
  estimatedDuration?: number;
  retryCount?: number;
}

// Cache keys
export const CacheKeys = {
  THREAT_PATTERNS: 'threat:patterns',
  KNOWLEDGE_BASE: 'knowledge:base',
  THREAT_ANALYSIS: (id: string) => `analysis:${id}`,
  COMPONENT_THREATS: (componentId: string) => `component:threats:${componentId}`,
  MITIGATION_RECOMMENDATIONS: (threatId: string) => `mitigation:${threatId}`,
} as const;