import { ThreatSeverity, MethodologyType } from './shared';

export interface AIThreatAnalysis {
  threat_id: string;
  confidence_score: number;
  risk_assessment: {
    likelihood: number; // 0-1 scale
    impact: number; // 0-1 scale
    risk_score: number; // calculated composite score
  };
  threat_classification: {
    category: string;
    subcategory?: string;
    cwe_references: string[];
    cve_references: string[];
    attack_patterns: string[];
  };
  intelligence_sources: {
    source: string;
    relevance_score: number;
    last_updated: Date;
  }[];
  recommendations: AIThreatRecommendation[];
  mitigation_suggestions: AIMitigationSuggestion[];
  similar_threats: SimilarThreat[];
}

export interface AIThreatRecommendation {
  type: 'immediate' | 'short_term' | 'long_term';
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  rationale: string;
  effort_estimate: string;
  confidence: number;
}

export interface AIMitigationSuggestion {
  id: string;
  name: string;
  description: string;
  effectiveness_score: number; // 0-1 scale
  implementation_complexity: 'low' | 'medium' | 'high';
  cost_estimate: 'low' | 'medium' | 'high';
  technology_requirements: string[];
  prerequisites: string[];
  success_indicators: string[];
  references: string[];
}

export interface SimilarThreat {
  threat_id: string;
  similarity_score: number; // 0-1 scale
  common_attributes: string[];
  lessons_learned: string[];
  mitigation_effectiveness: Record<string, number>;
}

export interface ThreatIntelligence {
  id: string;
  source: string;
  threat_type: string;
  indicators: {
    iocs: string[]; // Indicators of Compromise
    ttps: string[]; // Tactics, Techniques, and Procedures
    attack_vectors: string[];
  };
  severity: ThreatSeverity;
  confidence: number;
  first_seen: Date;
  last_seen: Date;
  geographic_regions: string[];
  industry_sectors: string[];
  description: string;
  references: string[];
}

export interface ContextualThreatData {
  system_components: SystemComponent[];
  data_flows: DataFlow[];
  trust_boundaries: TrustBoundary[];
  assets: Asset[];
  existing_controls: SecurityControl[];
  compliance_requirements?: string[];
  business_context: BusinessContext;
  deployment_environment?: string[];
  external_dependencies?: ExternalDependency[];
}

export interface ExternalDependency {
  id: string;
  name: string;
  type: 'saas' | 'infrastructure' | 'library' | 'service';
  criticality: 'low' | 'medium' | 'high' | 'critical';
  vendor?: string;
  version?: string;
}

export interface SystemComponent {
  id: string;
  name: string;
  type: 'process' | 'data_store' | 'external_entity' | 'trust_boundary';
  technologies: string[];
  protocols: string[];
  interfaces: string[];
  security_level: 'public' | 'internal' | 'confidential' | 'secret';
  criticality: 'low' | 'medium' | 'high' | 'critical';
}

export interface DataFlow {
  id: string;
  source: string;
  destination: string;
  data_types?: string[];
  data_classification?: string;
  sensitivity?: 'public' | 'internal' | 'confidential' | 'secret';
  encryption?: boolean;
  authentication_required?: boolean;
  protocols?: string[];
}

export interface TrustBoundary {
  id: string;
  name: string;
  description: string;
  security_level: number; // 1-5 scale
  components_inside: string[];
  components_outside: string[];
}

export interface Asset {
  id: string;
  name: string;
  type: 'data' | 'system' | 'process' | 'people';
  sensitivity: 'public' | 'internal' | 'confidential' | 'secret';
  criticality: 'low' | 'medium' | 'high' | 'critical';
  value: number; // Business value score
  dependencies: string[];
}

export interface SecurityControl {
  id: string;
  name: string;
  type: 'preventive' | 'detective' | 'corrective' | 'deterrent';
  category: string;
  effectiveness: number; // 0-1 scale
  coverage: string[]; // Which assets/components it protects
  maturity: 'initial' | 'developing' | 'defined' | 'managed' | 'optimizing';
}

export interface BusinessContext {
  industry: string;
  organization_size: 'small' | 'medium' | 'large' | 'enterprise';
  regulatory_environment: string[];
  risk_tolerance: 'low' | 'medium' | 'high';
  business_criticality: 'low' | 'medium' | 'high' | 'critical';
  geographic_scope: string[];
}

export interface AIModelConfig {
  model_type: 'llm' | 'classification' | 'clustering' | 'recommendation';
  model_name: string;
  version: string;
  endpoint_url?: string;
  api_key?: string;
  parameters: Record<string, any>;
  confidence_threshold: number;
  max_tokens?: number;
  temperature?: number;
}

export interface ThreatPrediction {
  threat_type: string;
  probability: number; // 0-1 scale
  time_horizon: '1_month' | '3_months' | '6_months' | '1_year' | '2_years' | '3_years';
  contributing_factors: string[];
  recommended_preparations: string[];
  early_warning_indicators: string[];
}

export interface AIAnalysisRequest {
  threat_model_id: string;
  methodology: MethodologyType;
  context: ContextualThreatData;
  analysis_depth: 'basic' | 'standard' | 'comprehensive';
  focus_areas?: string[];
  exclude_categories?: string[];
  user_preferences?: {
    include_mitigations?: boolean;
    include_references?: boolean;
    confidence_threshold?: number;
    analysis_focus?: string[];
  };
}

export interface AIAnalysisResponse {
  analysis_id: string;
  threat_model_id: string;
  generated_threats: EnhancedThreatSuggestion[];
  risk_assessment: GlobalRiskAssessment;
  recommendations: AIThreatRecommendation[];
  predictions: ThreatPrediction[];
  confidence_metrics: ConfidenceMetrics;
  processing_metadata: ProcessingMetadata;
}

export interface EnhancedThreatSuggestion {
  id: string;
  name: string;
  description: string;
  category: string;
  methodology_specific: Record<string, any>;
  severity: ThreatSeverity;
  likelihood: number; // 0-1 scale
  confidence: number; // 0-1 scale
  affected_components: string[];
  attack_vectors: string[];
  prerequisites: string[];
  potential_impact: string[];
  detection_methods: string[];
  mitigation_suggestions: AIMitigationSuggestion[];
  intelligence_context: {
    recent_incidents: boolean;
    trending_threat: boolean;
    industry_specific: boolean;
    geographic_relevance: string[];
  };
  references: {
    cwe: string[];
    cve: string[];
    owasp: string[];
    external: string[];
  };
}

export interface GlobalRiskAssessment {
  overall_risk_score: number; // 0-100 scale
  risk_distribution: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  risk_trends: {
    increasing: string[];
    stable: string[];
    decreasing: string[];
  };
  critical_vulnerabilities: string[];
  compensating_controls: string[];
}

export interface ConfidenceMetrics {
  overall_confidence: number; // 0-1 scale
  model_agreement: number; // If using multiple models
  data_quality_score: number;
  completeness_score: number;
  uncertainty_factors: string[];
}

export interface ProcessingMetadata {
  processing_time_ms: number;
  models_used: string[];
  data_sources_consulted: string[];
  analysis_timestamp: Date;
  version: string;
  limitations: string[];
  accuracy_score?: number;
  confidence_level?: number;
}

// Threat Intelligence Integration Types
export interface ThreatFeed {
  id: string;
  name: string;
  provider: string;
  feed_type: 'commercial' | 'open_source' | 'government' | 'industry';
  format: 'stix' | 'json' | 'xml' | 'csv';
  update_frequency: string;
  reliability_score: number; // 0-1 scale
  endpoint_url: string;
  api_key?: string;
  last_updated: Date;
  active: boolean;
}

export interface STIXIndicator {
  id: string;
  type: string;
  pattern: string;
  labels: string[];
  confidence: number;
  valid_from: Date;
  valid_until?: Date;
  threat_types: string[];
  kill_chain_phases: string[];
  description?: string;
}

export interface ThreatActor {
  id: string;
  name: string;
  description: string;
  aliases: string[];
  sophistication: 'novice' | 'practitioner' | 'expert' | 'innovator';
  motivation: string[];
  capabilities: string[];
  target_industries: string[];
  target_regions: string[];
  ttps: string[]; // Tactics, Techniques, and Procedures
  first_seen: Date;
  last_seen: Date;
}

export interface AttackPattern {
  id: string;
  name: string;
  description: string;
  mitre_id?: string;
  tactics: string[];
  techniques: string[];
  platforms: string[];
  data_sources: string[];
  defense_bypassed: string[];
  prerequisites: string[];
  effective_permissions: string[];
  system_requirements: string[];
}

// ML Model Types
export interface ThreatClassificationResult {
  threat_type: string;
  confidence: number;
  reasoning: string[];
  alternative_classifications: {
    type: string;
    confidence: number;
  }[];
}

export interface RiskPredictionResult {
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  contributing_factors: {
    factor: string;
    weight: number;
    justification: string;
  }[];
  recommendations: string[];
}

export interface SimilarityAnalysisResult {
  similar_threats: {
    threat_id: string;
    similarity_score: number;
    common_attributes: string[];
  }[];
  pattern_matches: {
    pattern_type: string;
    match_score: number;
    description: string;
  }[];
}

// API Response Types
export interface AIHealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  models_available: string[];
  response_time_ms: number;
  error_rate: number;
  last_updated: Date;
}

export interface AIMetrics {
  requests_processed: number;
  average_processing_time: number;
  accuracy_metrics: Record<string, number>;
  model_performance: Record<string, {
    accuracy: number;
    precision: number;
    recall: number;
    f1_score: number;
  }>;
  threat_intelligence_freshness: Date;
}

// Enhanced AI Types for World's #1 Threat Modeling Platform
export interface PatternRecognitionResult {
  recognized_patterns: {
    pattern_id: string;
    pattern_name: string;
    match_score: number;
    threat_indicators: string[];
    mitigation_suggestions: string[];
  }[];
  anomaly_score: number;
  confidence: number;
  processing_time_ms: number;
}

export interface MachineLearningPrediction {
  prediction_type: 'threat_emergence' | 'attack_evolution' | 'risk_escalation';
  confidence: number;
  time_horizon: string;
  predicted_values: Record<string, number>;
  contributing_factors: string[];
  model_metadata: {
    algorithm: string;
    training_data_size: number;
    accuracy_score: number;
    last_trained: Date;
  };
}

export interface AutomatedThreatGeneration {
  generated_threats: {
    threat_id: string;
    name: string;
    description: string;
    category: string;
    confidence: number;
    novelty_score: number;
    methodology_alignment: MethodologyType;
    generation_reasoning: string;
  }[];
  generation_metadata: {
    model_used: string;
    creativity_score: number;
    relevance_score: number;
    total_generated: number;
  };
}

export interface DeepLearningAnalysis {
  threat_probability: number;
  threat_categories: string[];
  feature_importance: Record<string, number>;
  model_confidence: number;
  model_version: string;
  analysis_depth: 'surface' | 'deep' | 'comprehensive';
  neural_network_outputs: {
    layer_activations: Record<string, number[]>;
    attention_weights: Record<string, number>;
    gradient_magnitudes: Record<string, number>;
  };
}

export interface RealTimeIntelligence {
  live_threat_feeds: {
    feed_id: string;
    last_update: Date;
    threat_indicators: number;
    severity_distribution: Record<string, number>;
    confidence_level: number;
  }[];
  emerging_threats: {
    threat_type: string;
    emergence_velocity: number;
    geographic_spread: string[];
    affected_industries: string[];
    first_detection: Date;
  }[];
  threat_actor_activities: {
    actor_id: string;
    activity_level: 'low' | 'medium' | 'high' | 'critical';
    recent_campaigns: string[];
    target_sectors: string[];
    capability_evolution: string[];
  }[];
}


export interface PredictiveAnalyticsResult {
  short_term_predictions: {
    threat_type: string;
    probability: number;
    time_horizon: string;
    impact_assessment: number;
    preparation_recommendations: string[];
  }[];
  medium_term_trends: {
    trend_type: string;
    growth_rate: number;
    peak_probability: string;
    affected_sectors: string[];
    mitigation_window: string;
  }[];
  long_term_forecast: {
    paradigm_shifts: string[];
    technology_impacts: string[];
    regulatory_changes: string[];
    threat_landscape_evolution: string[];
  };
  confidence_intervals: Record<string, { lower: number; upper: number; }>;
}

export interface ThreatEvolutionAnalysis {
  historical_patterns: {
    threat_family: string;
    evolution_timeline: {
      date: Date;
      variant: string;
      capabilities: string[];
      impact_level: number;
    }[];
    prediction_accuracy: number;
  }[];
  mutation_indicators: {
    indicator_type: string;
    current_value: number;
    historical_average: number;
    trend_direction: 'increasing' | 'stable' | 'decreasing';
    significance_level: number;
  }[];
  adaptive_responses: {
    threat_adaptation: string;
    defensive_countermeasures: string[];
    effectiveness_score: number;
    implementation_priority: 'immediate' | 'short_term' | 'long_term';
  }[];
}

export interface CollaborativeIntelligence {
  crowd_sourced_threats: {
    submission_id: string;
    contributor: string;
    threat_description: string;
    verification_status: 'pending' | 'verified' | 'rejected';
    confidence_votes: number;
    expert_reviews: number;
    adoption_rate: number;
  }[];
  community_insights: {
    insight_type: string;
    description: string;
    supporting_evidence: string[];
    community_consensus: number;
    expert_validation: boolean;
  }[];
  collaborative_models: {
    model_id: string;
    contributors: number;
    accuracy_improvement: number;
    specialization_areas: string[];
    last_update: Date;
  }[];
}