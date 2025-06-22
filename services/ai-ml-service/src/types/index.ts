// ML Model Types
export interface MLModel {
  id: string;
  name: string;
  version: string;
  type: ModelType;
  accuracy: number;
  lastUpdated: Date;
  config: ModelConfig;
}

export enum ModelType {
  THREAT_CLASSIFIER = 'threat_classifier',
  VULNERABILITY_PREDICTOR = 'vulnerability_predictor',
  MITIGATION_RECOMMENDER = 'mitigation_recommender',
  PATTERN_RECOGNIZER = 'pattern_recognizer',
  RISK_SCORER = 'risk_scorer',
}

export interface ModelConfig {
  inputShape?: number[];
  outputShape?: number[];
  hiddenLayers?: number[];
  activationFunction?: string;
  optimizer?: string;
  learningRate?: number;
  epochs?: number;
  batchSize?: number;
}

// Prediction Types
export interface PredictionRequest {
  modelType: ModelType;
  input: any;
  context?: PredictionContext;
  options?: PredictionOptions;
}

export interface PredictionContext {
  projectId?: string;
  componentType?: string;
  threatHistory?: string[];
  industryDomain?: string;
  complianceRequirements?: string[];
}

export interface PredictionOptions {
  threshold?: number;
  topK?: number;
  includeConfidence?: boolean;
  includeExplanation?: boolean;
}

export interface PredictionResponse {
  success: boolean;
  modelType: ModelType;
  predictions: Prediction[];
  metadata?: PredictionMetadata;
  timestamp: Date;
}

export interface Prediction {
  label: string;
  confidence: number;
  explanation?: string;
  evidence?: Evidence[];
  relatedThreats?: string[];
  suggestedMitigations?: Mitigation[];
}

export interface Evidence {
  source: string;
  relevance: number;
  description: string;
}

export interface PredictionMetadata {
  modelVersion: string;
  processingTime: number;
  dataQuality: number;
  confidenceRange: [number, number];
}

// Threat Intelligence Types
export interface ThreatIntelligence {
  id: string;
  source: ThreatIntelSource;
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  indicators: string[];
  mitigations: string[];
  references: string[];
  lastUpdated: Date;
}

export enum ThreatIntelSource {
  MITRE = 'mitre',
  NVD = 'nvd',
  VIRUSTOTAL = 'virustotal',
  INTERNAL = 'internal',
  COMMUNITY = 'community',
}

// Pattern Recognition Types
export interface ThreatPattern {
  id: string;
  name: string;
  category: string;
  indicators: PatternIndicator[];
  confidence: number;
  frequency: number;
  lastSeen: Date;
}

export interface PatternIndicator {
  type: string;
  value: string;
  weight: number;
}

// Vulnerability Prediction Types
export interface VulnerabilityPrediction {
  componentId: string;
  vulnerabilities: PredictedVulnerability[];
  overallRisk: RiskLevel;
  recommendations: string[];
}

export interface PredictedVulnerability {
  type: string;
  probability: number;
  impact: 'critical' | 'high' | 'medium' | 'low';
  exploitability: number;
  description: string;
  cwe?: string;
  cvss?: number;
}

export enum RiskLevel {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  MINIMAL = 'minimal',
}

// Mitigation Recommendation Types
export interface MitigationRecommendation {
  threatId: string;
  mitigations: Mitigation[];
  priority: 'immediate' | 'high' | 'medium' | 'low';
  estimatedEffort: EffortEstimate;
}

export interface Mitigation {
  id: string;
  title: string;
  description: string;
  category: string;
  effectiveness: number;
  implementation: ImplementationDetails;
  references: string[];
}

export interface ImplementationDetails {
  steps: string[];
  requiredTools?: string[];
  estimatedTime?: string;
  complexity: 'low' | 'medium' | 'high';
  prerequisites?: string[];
}

export interface EffortEstimate {
  hours: number;
  complexity: 'low' | 'medium' | 'high';
  requiredSkills: string[];
}

// Training Types
export interface TrainingData {
  id: string;
  type: ModelType;
  features: number[] | string[];
  label: string | number;
  metadata?: any;
}

export interface TrainingConfig {
  modelType: ModelType;
  dataPath: string;
  validationSplit: number;
  testSplit: number;
  epochs: number;
  batchSize: number;
  learningRate: number;
  earlyStoppingPatience?: number;
  callbacks?: TrainingCallback[];
}

export interface TrainingCallback {
  type: 'checkpoint' | 'tensorboard' | 'custom';
  config: any;
}

export interface TrainingResult {
  modelId: string;
  accuracy: number;
  loss: number;
  validationAccuracy: number;
  validationLoss: number;
  epochs: number;
  trainingTime: number;
  confusion_matrix?: number[][];
  classification_report?: any;
}

// API Types
export interface AnalysisRequest {
  projectId: string;
  components: ComponentAnalysis[];
  threatModel?: any;
  options?: AnalysisOptions;
}

// Pattern Recognition Types
export interface PatternAnalysisRequest {
  data: any[];
  patterns: string[];
  analysis_type: 'sequential' | 'temporal' | 'structural' | 'behavioral';
  time_window?: string;
  confidence_threshold?: number;
  include_predictions?: boolean;
  options?: {
    use_lstm?: boolean;
    use_knn?: boolean;
    use_statistical?: boolean;
    ensemble_voting?: string;
  };
}

export interface PatternMatch {
  pattern_id: string;
  name: string;
  type: string;
  confidence: number;
  evidence: Evidence[];
  metadata: Record<string, any>;
  timestamp: Date;
}

export interface BehavioralAnalysisRequest {
  user_id: string;
  behavior_data: {
    login_frequency: number;
    off_hours_logins: number;
    failed_login_attempts: number;
    file_access_count: number;
    sensitive_file_access: number;
    email_volume: number;
    external_email_ratio: number;
    data_transfer_volume: number;
    application_diversity: number;
    vpn_usage: number;
    weekend_activity: number;
  };
  time_window: string;
  baseline_update: boolean;
}

export interface PatternVisualizationRequest {
  pattern_id: string;
  visualization_type: 'heatmap' | 'timeline' | 'network' | 'correlation';
  time_range?: {
    start: string;
    end: string;
  };
  filters?: any;
}

export interface RealTimeMonitoringRequest {
  monitor_id: string;
  pattern_types: string[];
  alert_threshold: number;
  notification_channels: string[];
}

export interface BehavioralAnalysisResult {
  user_id: string;
  risk_score: number;
  anomaly_indicators: string[];
  behavioral_patterns: any[];
  recommendations: string[];
  confidence: number;
  analysis_timestamp: string;
}

export interface ComponentAnalysis {
  id: string;
  type: string;
  description: string;
  dataFlow?: string[];
  technologies?: string[];
  interfaces?: string[];
  indicators?: string[];
}

export interface AnalysisOptions {
  includePatternRecognition?: boolean;
  includeVulnerabilityPrediction?: boolean;
  includeMitigationRecommendations?: boolean;
  includeThreatIntelligence?: boolean;
  includeNLPAnalysis?: boolean;
  confidenceThreshold?: number;
}

export interface AnalysisResponse {
  success: boolean;
  projectId: string;
  analysis: {
    threats: PredictedThreat[];
    vulnerabilities: VulnerabilityPrediction[];
    patterns: ThreatPattern[];
    mitigations: MitigationRecommendation[];
    intelligence?: ThreatIntelligence[];
  };
  summary: AnalysisSummary;
  timestamp: Date;
}

export interface PredictedThreat {
  id: string;
  type: string;
  category: string;
  probability: number;
  impact: string;
  affectedComponents: string[];
  description: string;
  evidence: Evidence[];
  nlpClassifications?: any[];
}

export interface AnalysisSummary {
  totalThreats: number;
  criticalThreats: number;
  highRiskComponents: string[];
  overallRiskLevel: RiskLevel;
  topRecommendations: string[];
  confidenceScore: number;
}

// Cache Types
export interface CacheEntry<T> {
  key: string;
  value: T;
  expires: number;
  hits: number;
}

// Error Types
export interface MLServiceError {
  code: string;
  message: string;
  details?: any;
  modelType?: ModelType;
  timestamp: Date;
}

// Health Check Types
export interface ModelHealth {
  modelType: ModelType;
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastPrediction?: Date;
  predictionCount: number;
  averageLatency: number;
  errorRate: number;
}

export interface ServiceHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  models: ModelHealth[];
  cache: {
    hitRate: number;
    size: number;
    maxSize: number;
  };
  timestamp: Date;
}