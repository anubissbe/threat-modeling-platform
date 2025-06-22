/**
 * Behavioral Pattern Detection Service
 * Specialized detection for insider threats and behavioral anomalies
 */

import { EventEmitter } from 'events';
import * as tf from '@tensorflow/tfjs-node';
import { logger } from '../utils/logger';

// Behavioral pattern interfaces
export interface BehavioralPattern {
  id: string;
  name: string;
  description: string;
  threat_type: 'malicious_insider' | 'negligent_insider' | 'compromised_insider' | 'external_masquerader';
  behavioral_category: 'access_pattern' | 'data_usage' | 'communication' | 'productivity' | 'system_interaction';
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  user_profile: UserProfile;
  normal_behavior: NormalBehaviorProfile;
  anomaly_indicators: BehavioralAnomalyIndicator[];
  contextual_factors: ContextualFactor[];
  temporal_aspects: TemporalBehaviorAspect[];
  psychological_indicators: PsychologicalIndicator[];
  escalation_patterns: EscalationPattern[];
}

export interface UserProfile {
  role: string;
  department: string;
  seniority_level: string;
  access_privileges: string[];
  typical_work_hours: string;
  location_constraints: string[];
  device_preferences: string[];
  historical_risk_score: number;
  behavioral_baselines: BehavioralBaseline[];
}

export interface BehavioralBaseline {
  metric: string;
  baseline_value: number;
  variation_tolerance: number;
  measurement_period: string;
  confidence_level: number;
  last_updated: Date;
  trend_direction: 'stable' | 'increasing' | 'decreasing' | 'volatile';
}

export interface NormalBehaviorProfile {
  login_patterns: LoginPattern;
  file_access_patterns: FileAccessPattern;
  email_patterns: EmailPattern;
  application_usage: ApplicationUsagePattern;
  network_behavior: NetworkBehaviorPattern;
  productivity_metrics: ProductivityMetrics;
  collaboration_patterns: CollaborationPattern;
}

export interface BehavioralAnomalyIndicator {
  indicator_id: string;
  indicator_name: string;
  description: string;
  severity_weight: number;
  detection_method: 'statistical' | 'ml_based' | 'rule_based' | 'hybrid';
  threshold_config: ThresholdConfiguration;
  temporal_sensitivity: number;
  contextual_dependencies: string[];
  false_positive_rate: number;
}

export interface ContextualFactor {
  factor_type: 'organizational' | 'personal' | 'environmental' | 'technical';
  factor_name: string;
  influence_weight: number;
  values: ContextualValue[];
  interaction_effects: InteractionEffect[];
}

export interface TemporalBehaviorAspect {
  aspect_type: 'periodicity' | 'trend' | 'seasonality' | 'event_correlation';
  time_scale: 'minutes' | 'hours' | 'days' | 'weeks' | 'months';
  pattern_description: string;
  stability_score: number;
  predictability: number;
}

export interface PsychologicalIndicator {
  indicator_type: 'stress' | 'dissatisfaction' | 'financial_pressure' | 'grievance' | 'loyalty';
  measurement_method: 'behavioral_proxy' | 'text_analysis' | 'pattern_analysis';
  confidence_level: number;
  risk_contribution: number;
  observable_behaviors: string[];
}

export interface EscalationPattern {
  pattern_id: string;
  description: string;
  escalation_stages: EscalationStage[];
  trigger_conditions: TriggerCondition[];
  intervention_points: InterventionPoint[];
  severity_progression: number[];
}

// Supporting interfaces
export interface LoginPattern {
  typical_login_times: TimeRange[];
  login_frequency: FrequencyMetrics;
  login_locations: LocationMetrics;
  device_consistency: DeviceConsistency;
  session_duration: SessionDurationMetrics;
  failed_login_tolerance: number;
}

export interface FileAccessPattern {
  typical_file_types: string[];
  access_frequency: FrequencyMetrics;
  access_volume: VolumeMetrics;
  sensitive_data_access: SensitiveDataAccess;
  download_patterns: DownloadPattern;
  modification_patterns: ModificationPattern;
}

export interface EmailPattern {
  email_volume: VolumeMetrics;
  communication_network: CommunicationNetwork;
  external_communication: ExternalCommunication;
  attachment_behavior: AttachmentBehavior;
  content_analysis: ContentAnalysis;
  timing_patterns: TimingPattern;
}

export interface ApplicationUsagePattern {
  application_portfolio: string[];
  usage_frequency: Record<string, FrequencyMetrics>;
  feature_utilization: Record<string, number>;
  installation_patterns: InstallationPattern;
  performance_patterns: PerformancePattern;
}

export interface NetworkBehaviorPattern {
  bandwidth_usage: BandwidthUsage;
  protocol_distribution: ProtocolDistribution;
  connection_patterns: ConnectionPattern;
  data_transfer_patterns: DataTransferPattern;
  remote_access_behavior: RemoteAccessBehavior;
}

export interface ProductivityMetrics {
  work_output_volume: VolumeMetrics;
  task_completion_rate: number;
  quality_indicators: QualityIndicator[];
  collaboration_frequency: number;
  innovation_indicators: InnovationIndicator[];
}

export interface CollaborationPattern {
  team_interaction_frequency: number;
  communication_style: CommunicationStyle;
  knowledge_sharing: KnowledgeSharing;
  project_participation: ProjectParticipation;
  mentoring_activities: MentoringActivity[];
}

export interface ThresholdConfiguration {
  static_threshold?: number;
  dynamic_threshold?: DynamicThreshold;
  adaptive_threshold?: AdaptiveThreshold;
  contextual_thresholds?: ContextualThreshold[];
}

export interface ContextualValue {
  value: any;
  weight: number;
  conditions: string[];
  temporal_validity: TemporalValidity;
}

export interface InteractionEffect {
  interacting_factors: string[];
  effect_type: 'multiplicative' | 'additive' | 'suppressive' | 'moderating';
  effect_strength: number;
}

export interface EscalationStage {
  stage_number: number;
  stage_name: string;
  behavioral_changes: BehavioralChange[];
  risk_indicators: RiskIndicator[];
  duration_estimate: number;
  reversibility: number;
}

export interface TriggerCondition {
  condition_type: 'threshold_breach' | 'pattern_change' | 'external_event' | 'temporal_event';
  condition_parameters: Record<string, any>;
  sensitivity: number;
}

export interface InterventionPoint {
  stage: number;
  intervention_type: 'automated' | 'human' | 'hybrid';
  effectiveness_probability: number;
  cost_estimate: number;
  recommended_actions: string[];
}

// Metrics and measurement interfaces
export interface TimeRange {
  start_time: string;
  end_time: string;
  days_of_week: number[];
  exceptions: string[];
}

export interface FrequencyMetrics {
  average_frequency: number;
  frequency_variance: number;
  peak_frequencies: number[];
  cyclical_patterns: CyclicalFrequency[];
}

export interface LocationMetrics {
  primary_locations: string[];
  location_diversity: number;
  unusual_location_threshold: number;
  travel_patterns: TravelPattern[];
}

export interface DeviceConsistency {
  primary_devices: string[];
  device_switching_frequency: number;
  new_device_tolerance: number;
  device_fingerprint_stability: number;
}

export interface SessionDurationMetrics {
  average_duration: number;
  duration_variance: number;
  short_session_threshold: number;
  long_session_threshold: number;
}

export interface VolumeMetrics {
  average_volume: number;
  volume_variance: number;
  peak_volumes: number[];
  volume_trends: VolumeTrend[];
}

export interface SensitiveDataAccess {
  access_frequency: number;
  data_categories: string[];
  access_justification_rate: number;
  bulk_access_threshold: number;
}

export interface DownloadPattern {
  download_frequency: FrequencyMetrics;
  file_size_distribution: number[];
  download_timing: TimingPattern;
  bulk_download_threshold: number;
}

export interface ModificationPattern {
  modification_frequency: FrequencyMetrics;
  modification_types: string[];
  batch_modification_threshold: number;
  modification_timing: TimingPattern;
}

export interface CommunicationNetwork {
  internal_contacts: number;
  external_contacts: number;
  communication_centrality: number;
  network_evolution: NetworkEvolution;
}

export interface ExternalCommunication {
  external_email_ratio: number;
  domain_diversity: number;
  suspicious_domain_contacts: number;
  encrypted_communication_ratio: number;
}

export interface AttachmentBehavior {
  attachment_frequency: number;
  attachment_size_distribution: number[];
  attachment_types: string[];
  encryption_usage: number;
}

export interface ContentAnalysis {
  sentiment_trends: SentimentTrend[];
  topic_distribution: TopicDistribution;
  language_patterns: LanguagePattern;
  urgency_indicators: UrgencyIndicator[];
}

export interface TimingPattern {
  timing_regularity: number;
  off_hours_activity: number;
  burst_activity_frequency: number;
  timing_predictability: number;
}

// Analysis result interfaces
export interface BehavioralAnalysisResult {
  user_id: string;
  analysis_timestamp: Date;
  overall_risk_score: number;
  risk_category: 'low' | 'medium' | 'high' | 'critical';
  behavioral_deviations: BehavioralDeviation[];
  anomaly_summary: AnomalySummary;
  pattern_matches: BehavioralPatternMatch[];
  trend_analysis: TrendAnalysisResult;
  recommendations: Recommendation[];
  confidence_metrics: ConfidenceMetrics;
}

export interface BehavioralDeviation {
  metric: string;
  current_value: number;
  baseline_value: number;
  deviation_magnitude: number;
  significance_level: number;
  trend_direction: string;
  contextual_factors: string[];
}

export interface AnomalySummary {
  total_anomalies: number;
  anomaly_distribution: Record<string, number>;
  severity_breakdown: Record<string, number>;
  temporal_clustering: TemporalCluster[];
  correlation_patterns: CorrelationPattern[];
}

export interface BehavioralPatternMatch {
  pattern_id: string;
  pattern_name: string;
  match_confidence: number;
  matched_indicators: string[];
  risk_contribution: number;
  escalation_stage: number;
  recommended_monitoring: string[];
}

export interface TrendAnalysisResult {
  short_term_trends: TrendMetric[];
  long_term_trends: TrendMetric[];
  change_points: ChangePoint[];
  seasonality_effects: SeasonalityEffect[];
  forecast_trends: ForecastTrend[];
}

export interface Recommendation {
  recommendation_type: 'monitoring' | 'intervention' | 'investigation' | 'policy_change';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  description: string;
  rationale: string;
  expected_impact: string;
  implementation_effort: string;
}

export interface ConfidenceMetrics {
  overall_confidence: number;
  data_quality_score: number;
  baseline_stability: number;
  model_confidence: number;
  temporal_confidence: number;
}

// Additional supporting interfaces
export interface DynamicThreshold {
  base_threshold: number;
  adjustment_factors: AdjustmentFactor[];
  update_frequency: string;
  smoothing_factor: number;
}

export interface AdaptiveThreshold {
  learning_rate: number;
  adaptation_window: number;
  stability_requirement: number;
  reset_conditions: string[];
}

export interface ContextualThreshold {
  context_condition: string;
  threshold_value: number;
  confidence_adjustment: number;
}

export interface TemporalValidity {
  start_date: Date;
  end_date?: Date;
  time_of_day?: TimeRange;
  seasonal_validity?: string[];
}

export interface BehavioralChange {
  change_type: string;
  magnitude: number;
  detectability: number;
  reversibility: number;
  indicators: string[];
}

export interface RiskIndicator {
  indicator_name: string;
  risk_weight: number;
  detection_confidence: number;
  false_positive_rate: number;
}

export interface CyclicalFrequency {
  cycle_period: string;
  amplitude: number;
  phase_shift: number;
  stability: number;
}

export interface TravelPattern {
  travel_frequency: number;
  typical_destinations: string[];
  travel_duration_distribution: number[];
  business_vs_personal_ratio: number;
}

export interface VolumeTrend {
  trend_direction: string;
  trend_strength: number;
  trend_duration: string;
  trend_confidence: number;
}

export interface NetworkEvolution {
  contact_growth_rate: number;
  network_density_change: number;
  influential_contact_changes: number;
  community_membership_changes: number;
}

export interface SentimentTrend {
  sentiment_type: 'positive' | 'negative' | 'neutral';
  trend_direction: string;
  magnitude: number;
  confidence: number;
}

export interface TopicDistribution {
  topics: string[];
  probabilities: number[];
  topic_evolution: TopicEvolution[];
}

export interface LanguagePattern {
  vocabulary_complexity: number;
  sentiment_volatility: number;
  formality_level: number;
  emotional_indicators: EmotionalIndicator[];
}

export interface UrgencyIndicator {
  urgency_level: number;
  urgency_keywords: string[];
  temporal_urgency: number;
  escalation_language: number;
}

export interface TemporalCluster {
  cluster_start: Date;
  cluster_end: Date;
  anomaly_density: number;
  severity_concentration: number;
}

export interface CorrelationPattern {
  pattern_type: string;
  correlation_strength: number;
  temporal_lag: number;
  confidence: number;
}

export interface TrendMetric {
  metric_name: string;
  trend_direction: string;
  trend_strength: number;
  trend_confidence: number;
  trend_duration: string;
}

export interface ChangePoint {
  timestamp: Date;
  change_magnitude: number;
  change_type: string;
  significance: number;
  affected_metrics: string[];
}

export interface SeasonalityEffect {
  seasonal_type: string;
  amplitude: number;
  phase: number;
  significance: number;
}

export interface ForecastTrend {
  metric_name: string;
  forecast_horizon: string;
  predicted_values: number[];
  confidence_intervals: number[][];
  forecast_accuracy: number;
}

export interface AdjustmentFactor {
  factor_name: string;
  adjustment_multiplier: number;
  conditions: string[];
  temporal_validity: TemporalValidity;
}

export interface TopicEvolution {
  topic: string;
  trend_direction: string;
  change_rate: number;
  emergence_probability: number;
}

export interface EmotionalIndicator {
  emotion_type: string;
  intensity: number;
  frequency: number;
  trend_direction: string;
}

export interface InstallationPattern {
  installation_frequency: number;
  software_categories: string[];
  approval_compliance_rate: number;
  unusual_software_threshold: number;
}

export interface PerformancePattern {
  resource_usage_trends: ResourceUsageTrend[];
  performance_degradation_indicators: string[];
  efficiency_metrics: EfficiencyMetric[];
}

export interface BandwidthUsage {
  average_usage: number;
  peak_usage_times: string[];
  unusual_usage_threshold: number;
  upload_download_ratio: number;
}

export interface ProtocolDistribution {
  protocol_usage: Record<string, number>;
  unusual_protocols: string[];
  encryption_usage_ratio: number;
}

export interface ConnectionPattern {
  connection_frequency: FrequencyMetrics;
  destination_diversity: number;
  unusual_destinations: string[];
  connection_timing: TimingPattern;
}

export interface DataTransferPattern {
  transfer_volume_trends: VolumeTrend[];
  large_transfer_threshold: number;
  off_hours_transfer_ratio: number;
  external_transfer_ratio: number;
}

export interface RemoteAccessBehavior {
  remote_access_frequency: number;
  vpn_usage_patterns: VpnUsagePattern;
  remote_session_duration: SessionDurationMetrics;
  security_compliance_rate: number;
}

export interface QualityIndicator {
  quality_metric: string;
  score: number;
  trend_direction: string;
  benchmark_comparison: number;
}

export interface InnovationIndicator {
  innovation_type: string;
  frequency: number;
  impact_score: number;
  collaboration_component: number;
}

export interface CommunicationStyle {
  formality_level: number;
  response_time_patterns: ResponseTimePattern;
  communication_medium_preferences: Record<string, number>;
  meeting_participation: MeetingParticipation;
}

export interface KnowledgeSharing {
  sharing_frequency: number;
  knowledge_depth: number;
  recipient_diversity: number;
  documentation_contribution: number;
}

export interface ProjectParticipation {
  project_count: number;
  role_distribution: Record<string, number>;
  contribution_level: number;
  cross_functional_collaboration: number;
}

export interface MentoringActivity {
  mentoring_frequency: number;
  mentee_count: number;
  mentoring_effectiveness: number;
  knowledge_transfer_rate: number;
}

export interface VpnUsagePattern {
  vpn_usage_frequency: number;
  connection_duration: SessionDurationMetrics;
  endpoint_diversity: number;
  off_hours_usage: number;
}

export interface ResponseTimePattern {
  average_response_time: number;
  response_time_variance: number;
  urgency_sensitivity: number;
  time_of_day_patterns: TimingPattern;
}

export interface MeetingParticipation {
  meeting_frequency: number;
  participation_quality: number;
  leadership_instances: number;
  cross_team_meetings: number;
}

export interface ResourceUsageTrend {
  resource_type: string;
  usage_trend: string;
  efficiency_change: number;
  anomaly_frequency: number;
}

export interface EfficiencyMetric {
  metric_name: string;
  efficiency_score: number;
  trend_direction: string;
  optimization_potential: number;
}

/**
 * Behavioral Pattern Detection Service
 */
export class BehavioralPatternDetectorService extends EventEmitter {
  private isInitialized = false;
  private behavioralModel?: tf.LayersModel;
  private anomalyModel?: tf.LayersModel;
  private patterns: Map<string, BehavioralPattern> = new Map();
  private userProfiles: Map<string, UserProfile> = new Map();
  private behavioralBaselines: Map<string, Map<string, BehavioralBaseline>> = new Map();

  constructor() {
    super();
  }

  /**
   * Initialize the behavioral pattern detector
   */
  async initialize(): Promise<void> {
    try {
      const startTime = Date.now();
      logger.info('Initializing Behavioral Pattern Detector...');

      // Initialize TensorFlow models
      await this.initializeModels();
      
      // Load behavioral patterns
      await this.loadBehavioralPatterns();
      
      // Load user profiles and baselines
      await this.loadUserProfiles();
      await this.loadBehavioralBaselines();

      this.isInitialized = true;
      const initTime = Date.now() - startTime;
      
      logger.info(`Behavioral Pattern Detector initialized in ${initTime}ms`);
      logger.info(`Loaded ${this.patterns.size} behavioral patterns`);
      logger.info(`Loaded ${this.userProfiles.size} user profiles`);
      
      this.emit('initialized', { 
        initTime, 
        patternsLoaded: this.patterns.size,
        userProfilesLoaded: this.userProfiles.size,
        baselinesLoaded: this.behavioralBaselines.size
      });
    } catch (error) {
      logger.error('Failed to initialize Behavioral Pattern Detector:', error);
      throw error;
    }
  }

  /**
   * Analyze behavioral patterns for insider threat detection
   */
  async analyzeBehavioralPatterns(
    userId: string,
    behaviorData: any,
    timeWindow: string = '30d'
  ): Promise<BehavioralAnalysisResult> {
    if (!this.isInitialized) {
      throw new Error('Behavioral Pattern Detector not initialized');
    }

    try {
      const analysisStart = Date.now();
      
      // Get user profile and baselines
      const userProfile = this.userProfiles.get(userId);
      const userBaselines = this.behavioralBaselines.get(userId);
      
      if (!userProfile || !userBaselines) {
        throw new Error(`User profile or baselines not found for user: ${userId}`);
      }

      // Extract behavioral features
      const behavioralFeatures = this.extractBehavioralFeatures(behaviorData, userProfile);
      
      // Detect behavioral deviations
      const deviations = await this.detectBehavioralDeviations(
        behavioralFeatures,
        userBaselines
      );
      
      // Analyze behavioral anomalies
      const anomalySummary = await this.analyzeBehavioralAnomalies(
        behavioralFeatures,
        userProfile
      );
      
      // Match against behavioral patterns
      const patternMatches = await this.matchBehavioralPatterns(
        behavioralFeatures,
        deviations,
        userProfile
      );
      
      // Perform trend analysis
      const trendAnalysis = await this.performTrendAnalysis(
        behavioralFeatures,
        timeWindow
      );
      
      // Calculate overall risk score
      const overallRiskScore = this.calculateOverallRiskScore(
        deviations,
        anomalySummary,
        patternMatches,
        userProfile
      );
      
      // Generate recommendations
      const recommendations = this.generateRecommendations(
        overallRiskScore,
        patternMatches,
        deviations,
        userProfile
      );
      
      // Calculate confidence metrics
      const confidenceMetrics = this.calculateConfidenceMetrics(
        behavioralFeatures,
        userBaselines,
        patternMatches
      );

      const analysisTime = Date.now() - analysisStart;
      
      const result: BehavioralAnalysisResult = {
        user_id: userId,
        analysis_timestamp: new Date(),
        overall_risk_score: overallRiskScore,
        risk_category: this.categorizeRisk(overallRiskScore),
        behavioral_deviations: deviations,
        anomaly_summary: anomalySummary,
        pattern_matches: patternMatches,
        trend_analysis: trendAnalysis,
        recommendations: recommendations,
        confidence_metrics: confidenceMetrics
      };

      // Emit analysis completion event
      this.emit('behavioral_analysis_complete', {
        userId,
        result,
        analysisTime,
        timestamp: new Date()
      });

      return result;

    } catch (error) {
      logger.error(`Behavioral analysis failed for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Update user behavioral baselines
   */
  async updateBehavioralBaseline(
    userId: string,
    metric: string,
    newValue: number,
    confidence: number = 0.9
  ): Promise<void> {
    let userBaselines = this.behavioralBaselines.get(userId);
    if (!userBaselines) {
      userBaselines = new Map();
      this.behavioralBaselines.set(userId, userBaselines);
    }

    const existingBaseline = userBaselines.get(metric);
    const now = new Date();

    if (existingBaseline) {
      // Update existing baseline with exponential smoothing
      const alpha = 0.1; // Smoothing factor
      const updatedValue = alpha * newValue + (1 - alpha) * existingBaseline.baseline_value;
      
      userBaselines.set(metric, {
        ...existingBaseline,
        baseline_value: updatedValue,
        last_updated: now,
        confidence_level: Math.max(confidence, existingBaseline.confidence_level * 0.95)
      });
    } else {
      // Create new baseline
      userBaselines.set(metric, {
        metric,
        baseline_value: newValue,
        variation_tolerance: 0.2, // 20% default tolerance
        measurement_period: '30d',
        confidence_level: confidence,
        last_updated: now,
        trend_direction: 'stable'
      });
    }

    this.emit('baseline_updated', { userId, metric, newValue, timestamp: now });
  }

  /**
   * Get behavioral insights for a user
   */
  getBehavioralInsights(userId: string): {
    riskProfile: any;
    behavioralTrends: any;
    recommendations: any;
  } {
    const userProfile = this.userProfiles.get(userId);
    const userBaselines = this.behavioralBaselines.get(userId);

    return {
      riskProfile: {
        currentRiskLevel: userProfile?.historical_risk_score || 0,
        riskFactors: this.identifyRiskFactors(userId),
        riskTrend: this.calculateRiskTrend(userId)
      },
      behavioralTrends: {
        baselines: userBaselines ? Array.from(userBaselines.values()) : [],
        trendAnalysis: this.getRecentTrends(userId),
        seasonalPatterns: this.getSeasonalPatterns(userId)
      },
      recommendations: {
        monitoringRecommendations: this.getMonitoringRecommendations(userId),
        interventionSuggestions: this.getInterventionSuggestions(userId),
        baselineUpdates: this.getBaselineUpdateRecommendations(userId)
      }
    };
  }

  /**
   * Initialize TensorFlow models for behavioral analysis
   */
  private async initializeModels(): Promise<void> {
    // Behavioral pattern recognition model
    this.behavioralModel = tf.sequential({
      layers: [
        tf.layers.dense({ 
          units: 128, 
          activation: 'relu', 
          inputShape: [50] // 50 behavioral features
        }),
        tf.layers.dropout({ rate: 0.3 }),
        tf.layers.dense({ units: 64, activation: 'relu' }),
        tf.layers.dropout({ rate: 0.3 }),
        tf.layers.dense({ units: 32, activation: 'relu' }),
        tf.layers.dense({ units: 4, activation: 'softmax' }) // 4 threat categories
      ]
    });

    this.behavioralModel.compile({
      optimizer: 'adam',
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });

    // Behavioral anomaly detection model (Autoencoder)
    const encoder = tf.sequential({
      layers: [
        tf.layers.dense({ units: 32, activation: 'relu', inputShape: [50] }),
        tf.layers.dense({ units: 16, activation: 'relu' }),
        tf.layers.dense({ units: 8, activation: 'relu' })
      ]
    });

    const decoder = tf.sequential({
      layers: [
        tf.layers.dense({ units: 16, activation: 'relu', inputShape: [8] }),
        tf.layers.dense({ units: 32, activation: 'relu' }),
        tf.layers.dense({ units: 50, activation: 'linear' })
      ]
    });

    this.anomalyModel = tf.sequential({
      layers: [encoder, decoder]
    });

    this.anomalyModel.compile({
      optimizer: 'adam',
      loss: 'meanSquaredError'
    });

    logger.info('Behavioral analysis models initialized');
  }

  /**
   * Load behavioral pattern definitions
   */
  private async loadBehavioralPatterns(): Promise<void> {
    const builtinPatterns = this.getBuiltinBehavioralPatterns();
    builtinPatterns.forEach(pattern => this.patterns.set(pattern.id, pattern));
    logger.info(`Loaded ${this.patterns.size} behavioral patterns`);
  }

  /**
   * Load user profiles
   */
  private async loadUserProfiles(): Promise<void> {
    // TODO: Load from database
    // For now, create sample profiles
    const sampleProfile: UserProfile = {
      role: 'analyst',
      department: 'security',
      seniority_level: 'mid',
      access_privileges: ['read_sensitive', 'write_reports'],
      typical_work_hours: '09:00-17:00',
      location_constraints: ['office', 'home'],
      device_preferences: ['laptop', 'mobile'],
      historical_risk_score: 25,
      behavioral_baselines: []
    };

    this.userProfiles.set('sample_user', sampleProfile);
    logger.info(`Loaded ${this.userProfiles.size} user profiles`);
  }

  /**
   * Load behavioral baselines
   */
  private async loadBehavioralBaselines(): Promise<void> {
    // TODO: Load from database
    logger.info('Behavioral baselines loaded');
  }

  /**
   * Extract behavioral features from raw data
   */
  private extractBehavioralFeatures(behaviorData: any, userProfile: UserProfile): number[] {
    const features: number[] = [];

    // Login pattern features
    features.push(behaviorData.login_frequency || 0);
    features.push(behaviorData.off_hours_logins || 0);
    features.push(behaviorData.failed_login_attempts || 0);
    features.push(behaviorData.new_device_logins || 0);
    features.push(behaviorData.location_diversity || 0);

    // File access features
    features.push(behaviorData.file_access_count || 0);
    features.push(behaviorData.sensitive_file_access || 0);
    features.push(behaviorData.bulk_downloads || 0);
    features.push(behaviorData.external_file_shares || 0);
    features.push(behaviorData.file_modification_rate || 0);

    // Email pattern features
    features.push(behaviorData.email_volume || 0);
    features.push(behaviorData.external_email_ratio || 0);
    features.push(behaviorData.attachment_volume || 0);
    features.push(behaviorData.encrypted_emails || 0);
    features.push(behaviorData.urgent_emails || 0);

    // Application usage features
    features.push(behaviorData.application_diversity || 0);
    features.push(behaviorData.unusual_software_usage || 0);
    features.push(behaviorData.administrative_tool_usage || 0);
    features.push(behaviorData.performance_degradation || 0);
    features.push(behaviorData.resource_consumption || 0);

    // Network behavior features
    features.push(behaviorData.bandwidth_usage || 0);
    features.push(behaviorData.external_connections || 0);
    features.push(behaviorData.unusual_protocols || 0);
    features.push(behaviorData.vpn_usage || 0);
    features.push(behaviorData.data_transfer_volume || 0);

    // Productivity features
    features.push(behaviorData.work_output_change || 0);
    features.push(behaviorData.collaboration_frequency || 0);
    features.push(behaviorData.meeting_participation || 0);
    features.push(behaviorData.innovation_indicators || 0);
    features.push(behaviorData.knowledge_sharing || 0);

    // Psychological indicators (derived from behavior)
    features.push(behaviorData.stress_indicators || 0);
    features.push(behaviorData.satisfaction_indicators || 0);
    features.push(behaviorData.engagement_level || 0);
    features.push(behaviorData.risk_taking_behavior || 0);
    features.push(behaviorData.policy_compliance || 0);

    // Temporal features
    features.push(behaviorData.activity_regularity || 0);
    features.push(behaviorData.schedule_adherence || 0);
    features.push(behaviorData.weekend_activity || 0);
    features.push(behaviorData.holiday_activity || 0);
    features.push(behaviorData.sudden_changes || 0);

    // Contextual features
    features.push(behaviorData.project_pressure || 0);
    features.push(behaviorData.organizational_changes || 0);
    features.push(behaviorData.personal_events || 0);
    features.push(behaviorData.financial_indicators || 0);
    features.push(behaviorData.social_indicators || 0);

    // Ensure we have exactly 50 features
    while (features.length < 50) {
      features.push(0);
    }

    return features.slice(0, 50);
  }

  /**
   * Detect behavioral deviations from baselines
   */
  private async detectBehavioralDeviations(
    features: number[],
    baselines: Map<string, BehavioralBaseline>
  ): Promise<BehavioralDeviation[]> {
    const deviations: BehavioralDeviation[] = [];
    const featureNames = this.getFeatureNames();

    for (let i = 0; i < features.length && i < featureNames.length; i++) {
      const featureName = featureNames[i];
      const currentValue = features[i];
      const baseline = baselines.get(featureName);

      if (baseline) {
        const deviationMagnitude = Math.abs(currentValue - baseline.baseline_value) / 
                                 Math.max(baseline.baseline_value, 1);
        
        if (deviationMagnitude > baseline.variation_tolerance) {
          deviations.push({
            metric: featureName,
            current_value: currentValue,
            baseline_value: baseline.baseline_value,
            deviation_magnitude: deviationMagnitude,
            significance_level: this.calculateSignificanceLevel(deviationMagnitude, baseline),
            trend_direction: currentValue > baseline.baseline_value ? 'increasing' : 'decreasing',
            contextual_factors: this.identifyContextualFactors(featureName, deviationMagnitude)
          });
        }
      }
    }

    return deviations;
  }

  /**
   * Analyze behavioral anomalies using ML model
   */
  private async analyzeBehavioralAnomalies(
    features: number[],
    userProfile: UserProfile
  ): Promise<AnomalySummary> {
    let totalAnomalies = 0;
    const anomalyDistribution: Record<string, number> = {};
    const severityBreakdown: Record<string, number> = {};

    if (this.anomalyModel) {
      const inputTensor = tf.tensor2d([features]);
      const reconstruction = this.anomalyModel.predict(inputTensor) as tf.Tensor;
      const reconstructionData = await reconstruction.data();
      
      // Calculate reconstruction error for anomaly detection
      let totalError = 0;
      for (let i = 0; i < features.length; i++) {
        const error = Math.abs(features[i] - reconstructionData[i]);
        totalError += error;
        
        if (error > 0.5) { // Anomaly threshold
          totalAnomalies++;
          const featureName = this.getFeatureNames()[i];
          anomalyDistribution[featureName] = error;
          
          if (error > 2.0) {
            severityBreakdown['critical'] = (severityBreakdown['critical'] || 0) + 1;
          } else if (error > 1.0) {
            severityBreakdown['high'] = (severityBreakdown['high'] || 0) + 1;
          } else {
            severityBreakdown['medium'] = (severityBreakdown['medium'] || 0) + 1;
          }
        }
      }

      inputTensor.dispose();
      reconstruction.dispose();
    }

    return {
      total_anomalies: totalAnomalies,
      anomaly_distribution: anomalyDistribution,
      severity_breakdown: severityBreakdown,
      temporal_clustering: [], // Placeholder
      correlation_patterns: [] // Placeholder
    };
  }

  /**
   * Match behavioral features against known patterns
   */
  private async matchBehavioralPatterns(
    features: number[],
    deviations: BehavioralDeviation[],
    userProfile: UserProfile
  ): Promise<BehavioralPatternMatch[]> {
    const matches: BehavioralPatternMatch[] = [];

    if (this.behavioralModel) {
      const inputTensor = tf.tensor2d([features]);
      const predictions = this.behavioralModel.predict(inputTensor) as tf.Tensor;
      const predictionData = await predictions.data();

      // Map predictions to threat categories
      const threatCategories = ['low_risk', 'medium_risk', 'high_risk', 'critical_risk'];
      const maxPredictionIndex = Array.from(predictionData).indexOf(Math.max(...predictionData));
      const maxConfidence = predictionData[maxPredictionIndex];

      if (maxConfidence > 0.6) {
        matches.push({
          pattern_id: `threat_${threatCategories[maxPredictionIndex]}`,
          pattern_name: `${threatCategories[maxPredictionIndex].replace('_', ' ')} Pattern`,
          match_confidence: maxConfidence,
          matched_indicators: deviations.slice(0, 5).map(d => d.metric),
          risk_contribution: maxConfidence * 100,
          escalation_stage: maxPredictionIndex + 1,
          recommended_monitoring: this.getRecommendedMonitoring(threatCategories[maxPredictionIndex])
        });
      }

      inputTensor.dispose();
      predictions.dispose();
    }

    return matches;
  }

  /**
   * Perform trend analysis on behavioral data
   */
  private async performTrendAnalysis(
    features: number[],
    timeWindow: string
  ): Promise<TrendAnalysisResult> {
    // Placeholder implementation
    return {
      short_term_trends: [],
      long_term_trends: [],
      change_points: [],
      seasonality_effects: [],
      forecast_trends: []
    };
  }

  /**
   * Calculate overall risk score
   */
  private calculateOverallRiskScore(
    deviations: BehavioralDeviation[],
    anomalySummary: AnomalySummary,
    patternMatches: BehavioralPatternMatch[],
    userProfile: UserProfile
  ): number {
    let riskScore = userProfile.historical_risk_score;

    // Add risk from deviations
    const deviationRisk = deviations.reduce((sum, dev) => sum + dev.significance_level * 10, 0);
    riskScore += deviationRisk;

    // Add risk from anomalies
    const anomalyRisk = anomalySummary.total_anomalies * 5;
    riskScore += anomalyRisk;

    // Add risk from pattern matches
    const patternRisk = patternMatches.reduce((sum, match) => sum + match.risk_contribution, 0);
    riskScore += patternRisk;

    return Math.min(riskScore, 100); // Cap at 100
  }

  /**
   * Generate recommendations based on analysis
   */
  private generateRecommendations(
    riskScore: number,
    patternMatches: BehavioralPatternMatch[],
    deviations: BehavioralDeviation[],
    userProfile: UserProfile
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];

    if (riskScore > 75) {
      recommendations.push({
        recommendation_type: 'intervention',
        priority: 'urgent',
        description: 'Immediate investigation required due to high risk score',
        rationale: 'Multiple high-severity behavioral anomalies detected',
        expected_impact: 'Prevent potential insider threat incident',
        implementation_effort: 'High'
      });
    } else if (riskScore > 50) {
      recommendations.push({
        recommendation_type: 'monitoring',
        priority: 'high',
        description: 'Increase monitoring frequency and depth',
        rationale: 'Elevated risk score indicates potential concern',
        expected_impact: 'Early detection of escalating risks',
        implementation_effort: 'Medium'
      });
    }

    if (deviations.length > 5) {
      recommendations.push({
        recommendation_type: 'investigation',
        priority: 'medium',
        description: 'Investigate cause of multiple behavioral changes',
        rationale: 'Significant deviation from normal behavior patterns',
        expected_impact: 'Understand root cause of behavioral changes',
        implementation_effort: 'Medium'
      });
    }

    return recommendations;
  }

  /**
   * Calculate confidence metrics
   */
  private calculateConfidenceMetrics(
    features: number[],
    baselines: Map<string, BehavioralBaseline>,
    patternMatches: BehavioralPatternMatch[]
  ): ConfidenceMetrics {
    const dataQualityScore = this.assessDataQuality(features);
    const baselineStability = this.assessBaselineStability(baselines);
    const modelConfidence = patternMatches.length > 0 
      ? Math.max(...patternMatches.map(m => m.match_confidence))
      : 0.5;

    return {
      overall_confidence: (dataQualityScore + baselineStability + modelConfidence) / 3,
      data_quality_score: dataQualityScore,
      baseline_stability: baselineStability,
      model_confidence: modelConfidence,
      temporal_confidence: 0.8 // Placeholder
    };
  }

  // Helper methods
  private categorizeRisk(riskScore: number): 'low' | 'medium' | 'high' | 'critical' {
    if (riskScore >= 75) return 'critical';
    if (riskScore >= 50) return 'high';
    if (riskScore >= 25) return 'medium';
    return 'low';
  }

  private getFeatureNames(): string[] {
    return [
      'login_frequency', 'off_hours_logins', 'failed_login_attempts', 'new_device_logins', 'location_diversity',
      'file_access_count', 'sensitive_file_access', 'bulk_downloads', 'external_file_shares', 'file_modification_rate',
      'email_volume', 'external_email_ratio', 'attachment_volume', 'encrypted_emails', 'urgent_emails',
      'application_diversity', 'unusual_software_usage', 'administrative_tool_usage', 'performance_degradation', 'resource_consumption',
      'bandwidth_usage', 'external_connections', 'unusual_protocols', 'vpn_usage', 'data_transfer_volume',
      'work_output_change', 'collaboration_frequency', 'meeting_participation', 'innovation_indicators', 'knowledge_sharing',
      'stress_indicators', 'satisfaction_indicators', 'engagement_level', 'risk_taking_behavior', 'policy_compliance',
      'activity_regularity', 'schedule_adherence', 'weekend_activity', 'holiday_activity', 'sudden_changes',
      'project_pressure', 'organizational_changes', 'personal_events', 'financial_indicators', 'social_indicators',
      'reserved1', 'reserved2', 'reserved3', 'reserved4', 'reserved5'
    ];
  }

  private calculateSignificanceLevel(deviation: number, baseline: BehavioralBaseline): number {
    return Math.min(deviation / baseline.variation_tolerance, 5.0);
  }

  private identifyContextualFactors(metric: string, deviation: number): string[] {
    // Placeholder for contextual factor identification
    return ['time_of_day', 'workload'];
  }

  private getRecommendedMonitoring(threatCategory: string): string[] {
    const monitoringMap: Record<string, string[]> = {
      'low_risk': ['periodic_review'],
      'medium_risk': ['weekly_monitoring', 'access_review'],
      'high_risk': ['daily_monitoring', 'privilege_review', 'manager_notification'],
      'critical_risk': ['real_time_monitoring', 'immediate_investigation', 'access_restriction']
    };
    return monitoringMap[threatCategory] || [];
  }

  private assessDataQuality(features: number[]): number {
    const nonZeroFeatures = features.filter(f => f !== 0).length;
    return nonZeroFeatures / features.length;
  }

  private assessBaselineStability(baselines: Map<string, BehavioralBaseline>): number {
    if (baselines.size === 0) return 0.5;
    
    const stableBaselines = Array.from(baselines.values()).filter(
      b => b.confidence_level > 0.7 && b.trend_direction === 'stable'
    ).length;
    
    return stableBaselines / baselines.size;
  }

  private identifyRiskFactors(userId: string): string[] {
    // Placeholder
    return ['behavioral_changes', 'access_anomalies'];
  }

  private calculateRiskTrend(userId: string): string {
    // Placeholder
    return 'stable';
  }

  private getRecentTrends(userId: string): any[] {
    // Placeholder
    return [];
  }

  private getSeasonalPatterns(userId: string): any[] {
    // Placeholder
    return [];
  }

  private getMonitoringRecommendations(userId: string): string[] {
    // Placeholder
    return ['increase_logging', 'review_access'];
  }

  private getInterventionSuggestions(userId: string): string[] {
    // Placeholder
    return ['manager_discussion', 'security_training'];
  }

  private getBaselineUpdateRecommendations(userId: string): string[] {
    // Placeholder
    return ['update_login_patterns', 'review_file_access'];
  }

  /**
   * Built-in behavioral pattern definitions
   */
  private getBuiltinBehavioralPatterns(): BehavioralPattern[] {
    return [
      {
        id: 'malicious-insider-pattern',
        name: 'Malicious Insider Threat',
        description: 'Pattern indicating intentional malicious activity by an insider',
        threat_type: 'malicious_insider',
        behavioral_category: 'access_pattern',
        risk_level: 'critical',
        user_profile: {
          role: 'any',
          department: 'any',
          seniority_level: 'any',
          access_privileges: ['sensitive_data_access'],
          typical_work_hours: 'flexible',
          location_constraints: [],
          device_preferences: [],
          historical_risk_score: 0,
          behavioral_baselines: []
        },
        normal_behavior: {
          login_patterns: {
            typical_login_times: [],
            login_frequency: { average_frequency: 1, frequency_variance: 0.2, peak_frequencies: [], cyclical_patterns: [] },
            login_locations: { primary_locations: [], location_diversity: 0, unusual_location_threshold: 0, travel_patterns: [] },
            device_consistency: { primary_devices: [], device_switching_frequency: 0, new_device_tolerance: 0, device_fingerprint_stability: 0 },
            session_duration: { average_duration: 0, duration_variance: 0, short_session_threshold: 0, long_session_threshold: 0 },
            failed_login_tolerance: 0
          },
          file_access_patterns: {
            typical_file_types: [],
            access_frequency: { average_frequency: 0, frequency_variance: 0, peak_frequencies: [], cyclical_patterns: [] },
            access_volume: { average_volume: 0, volume_variance: 0, peak_volumes: [], volume_trends: [] },
            sensitive_data_access: { access_frequency: 0, data_categories: [], access_justification_rate: 0, bulk_access_threshold: 0 },
            download_patterns: {
              download_frequency: { average_frequency: 0, frequency_variance: 0, peak_frequencies: [], cyclical_patterns: [] },
              file_size_distribution: [],
              download_timing: { timing_regularity: 0, off_hours_activity: 0, burst_activity_frequency: 0, timing_predictability: 0 },
              bulk_download_threshold: 0
            },
            modification_patterns: {
              modification_frequency: { average_frequency: 0, frequency_variance: 0, peak_frequencies: [], cyclical_patterns: [] },
              modification_types: [],
              batch_modification_threshold: 0,
              modification_timing: { timing_regularity: 0, off_hours_activity: 0, burst_activity_frequency: 0, timing_predictability: 0 }
            }
          },
          email_patterns: {
            email_volume: { average_volume: 0, volume_variance: 0, peak_volumes: [], volume_trends: [] },
            communication_network: { internal_contacts: 0, external_contacts: 0, communication_centrality: 0, network_evolution: { contact_growth_rate: 0, network_density_change: 0, influential_contact_changes: 0, community_membership_changes: 0 } },
            external_communication: { external_email_ratio: 0, domain_diversity: 0, suspicious_domain_contacts: 0, encrypted_communication_ratio: 0 },
            attachment_behavior: { attachment_frequency: 0, attachment_size_distribution: [], attachment_types: [], encryption_usage: 0 },
            content_analysis: {
              sentiment_trends: [],
              topic_distribution: { topics: [], probabilities: [], topic_evolution: [] },
              language_patterns: { vocabulary_complexity: 0, sentiment_volatility: 0, formality_level: 0, emotional_indicators: [] },
              urgency_indicators: []
            },
            timing_patterns: { timing_regularity: 0, off_hours_activity: 0, burst_activity_frequency: 0, timing_predictability: 0 }
          },
          application_usage: {
            application_portfolio: [],
            usage_frequency: {},
            feature_utilization: {},
            installation_patterns: { installation_frequency: 0, software_categories: [], approval_compliance_rate: 0, unusual_software_threshold: 0 },
            performance_patterns: { resource_usage_trends: [], performance_degradation_indicators: [], efficiency_metrics: [] }
          },
          network_behavior: {
            bandwidth_usage: { average_usage: 0, peak_usage_times: [], unusual_usage_threshold: 0, upload_download_ratio: 0 },
            protocol_distribution: { protocol_usage: {}, unusual_protocols: [], encryption_usage_ratio: 0 },
            connection_patterns: {
              connection_frequency: { average_frequency: 0, frequency_variance: 0, peak_frequencies: [], cyclical_patterns: [] },
              destination_diversity: 0,
              unusual_destinations: [],
              connection_timing: { timing_regularity: 0, off_hours_activity: 0, burst_activity_frequency: 0, timing_predictability: 0 }
            },
            data_transfer_patterns: {
              transfer_volume_trends: [],
              large_transfer_threshold: 0,
              off_hours_transfer_ratio: 0,
              external_transfer_ratio: 0
            },
            remote_access_behavior: {
              remote_access_frequency: 0,
              vpn_usage_patterns: {
                vpn_usage_frequency: 0,
                connection_duration: { average_duration: 0, duration_variance: 0, short_session_threshold: 0, long_session_threshold: 0 },
                endpoint_diversity: 0,
                off_hours_usage: 0
              },
              remote_session_duration: { average_duration: 0, duration_variance: 0, short_session_threshold: 0, long_session_threshold: 0 },
              security_compliance_rate: 0
            }
          },
          productivity_metrics: {
            work_output_volume: { average_volume: 0, volume_variance: 0, peak_volumes: [], volume_trends: [] },
            task_completion_rate: 0,
            quality_indicators: [],
            collaboration_frequency: 0,
            innovation_indicators: []
          },
          collaboration_patterns: {
            team_interaction_frequency: 0,
            communication_style: {
              formality_level: 0,
              response_time_patterns: {
                average_response_time: 0,
                response_time_variance: 0,
                urgency_sensitivity: 0,
                time_of_day_patterns: { timing_regularity: 0, off_hours_activity: 0, burst_activity_frequency: 0, timing_predictability: 0 }
              },
              communication_medium_preferences: {},
              meeting_participation: { meeting_frequency: 0, participation_quality: 0, leadership_instances: 0, cross_team_meetings: 0 }
            },
            knowledge_sharing: { sharing_frequency: 0, knowledge_depth: 0, recipient_diversity: 0, documentation_contribution: 0 },
            project_participation: { project_count: 0, role_distribution: {}, contribution_level: 0, cross_functional_collaboration: 0 },
            mentoring_activities: []
          }
        },
        anomaly_indicators: [
          {
            indicator_id: 'unusual-access-hours',
            indicator_name: 'Unusual Access Hours',
            description: 'Access outside normal working hours',
            severity_weight: 0.7,
            detection_method: 'statistical',
            threshold_config: {
              static_threshold: 0.1
            },
            temporal_sensitivity: 0.8,
            contextual_dependencies: ['user_role', 'project_deadlines'],
            false_positive_rate: 0.05
          }
        ],
        contextual_factors: [],
        temporal_aspects: [],
        psychological_indicators: [],
        escalation_patterns: []
      }
    ];
  }
}

export { BehavioralPatternDetectorService };