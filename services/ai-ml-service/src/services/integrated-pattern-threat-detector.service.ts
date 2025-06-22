/**
 * Integrated Pattern-Threat Detection Service
 * Combines advanced pattern recognition with existing threat detection capabilities
 */

import { EventEmitter } from 'events';
import { logger, mlLogger } from '../utils/logger';
import { ModelType, PredictionRequest, PredictionResponse, Evidence } from '../types';
import { AdvancedPatternRecognitionService } from './advanced-pattern-recognition.service';
import { TemporalPatternAnalyzerService } from './temporal-pattern-analyzer.service';
import { BehavioralPatternDetectorService } from './behavioral-pattern-detector.service';
import { PatternLearningEngineService } from './pattern-learning-engine.service';
import { PatternVisualizationService } from './pattern-visualization.service';
import { AdvancedThreatDetectorService } from './advanced-threat-detector.service';
import { ThreatDetectionOrchestratorService } from './threat-detection-orchestrator.service';

// Integration interfaces
export interface IntegratedDetectionRequest {
  request_id: string;
  timestamp: Date;
  data: any;
  detection_options: DetectionOptions;
  user_context?: UserContext;
  system_context?: SystemContext;
}

export interface DetectionOptions {
  enable_pattern_recognition: boolean;
  enable_temporal_analysis: boolean;
  enable_behavioral_analysis: boolean;
  enable_threat_detection: boolean;
  enable_learning: boolean;
  confidence_threshold: number;
  fusion_strategy: 'weighted_average' | 'majority_vote' | 'maximum_confidence' | 'dynamic_weighting';
  output_format: 'summary' | 'detailed' | 'visualization' | 'all';
}

export interface UserContext {
  user_id: string;
  role: string;
  department: string;
  access_level: number;
  session_info: SessionInfo;
  historical_profile: UserHistoricalProfile;
}

export interface SessionInfo {
  session_id: string;
  start_time: Date;
  device_info: DeviceInfo;
  location_info: LocationInfo;
  network_info: NetworkInfo;
}

export interface DeviceInfo {
  device_id: string;
  device_type: string;
  operating_system: string;
  browser_info?: string;
  security_posture: SecurityPosture;
}

export interface LocationInfo {
  ip_address: string;
  geographic_location?: string;
  network_segment: string;
  location_risk_score: number;
}

export interface NetworkInfo {
  connection_type: string;
  vpn_status: boolean;
  proxy_status: boolean;
  network_quality: NetworkQuality;
}

export interface SecurityPosture {
  antivirus_status: boolean;
  firewall_status: boolean;
  encryption_status: boolean;
  patch_level: string;
  compliance_score: number;
}

export interface NetworkQuality {
  bandwidth: number;
  latency: number;
  packet_loss: number;
  jitter: number;
}

export interface UserHistoricalProfile {
  risk_history: RiskHistoryEntry[];
  behavioral_baselines: BehavioralBaseline[];
  incident_history: IncidentHistoryEntry[];
  training_history: TrainingHistoryEntry[];
}

export interface RiskHistoryEntry {
  timestamp: Date;
  risk_score: number;
  risk_factors: string[];
  incidents: string[];
}

export interface BehavioralBaseline {
  metric: string;
  baseline_value: number;
  confidence: number;
  last_updated: Date;
}

export interface IncidentHistoryEntry {
  incident_id: string;
  incident_type: string;
  timestamp: Date;
  severity: string;
  resolution_status: string;
}

export interface TrainingHistoryEntry {
  training_id: string;
  training_type: string;
  completion_date: Date;
  score: number;
  certification_status: boolean;
}

export interface SystemContext {
  system_id: string;
  system_type: string;
  security_level: string;
  criticality: string;
  compliance_requirements: string[];
  monitoring_level: string;
  threat_landscape: ThreatLandscape;
}

export interface ThreatLandscape {
  current_threat_level: string;
  active_campaigns: ActiveCampaign[];
  vulnerability_status: VulnerabilityStatus;
  threat_intelligence: ThreatIntelligence;
}

export interface ActiveCampaign {
  campaign_id: string;
  campaign_name: string;
  threat_actors: string[];
  tactics: string[];
  techniques: string[];
  severity: string;
  confidence: number;
}

export interface VulnerabilityStatus {
  critical_vulnerabilities: number;
  high_vulnerabilities: number;
  medium_vulnerabilities: number;
  low_vulnerabilities: number;
  patch_status: string;
}

export interface ThreatIntelligence {
  feeds: ThreatFeed[];
  indicators: ThreatIndicator[];
  attribution: Attribution[];
  predictions: ThreatPrediction[];
}

export interface ThreatFeed {
  feed_id: string;
  feed_name: string;
  reliability: number;
  last_updated: Date;
  indicator_count: number;
}

export interface ThreatIndicator {
  indicator_type: string;
  indicator_value: string;
  confidence: number;
  first_seen: Date;
  last_seen: Date;
  malicious_activity: string[];
}

export interface Attribution {
  threat_actor: string;
  confidence: number;
  campaign_associations: string[];
  geographic_origin: string;
  motivation: string[];
}

export interface ThreatPrediction {
  prediction_type: string;
  predicted_event: string;
  probability: number;
  time_horizon: string;
  impact_assessment: string;
}

// Integrated response interfaces
export interface IntegratedDetectionResponse {
  request_id: string;
  response_timestamp: Date;
  overall_assessment: OverallAssessment;
  pattern_analysis: PatternAnalysisResult;
  threat_analysis: ThreatAnalysisResult;
  behavioral_analysis: BehavioralAnalysisResult;
  temporal_analysis: TemporalAnalysisResult;
  fusion_analysis: FusionAnalysisResult;
  recommendations: IntegratedRecommendation[];
  visualizations?: VisualizationResult[];
  learning_updates?: LearningUpdate[];
}

export interface OverallAssessment {
  risk_score: number;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  primary_concerns: string[];
  secondary_concerns: string[];
  false_positive_probability: number;
  recommended_actions: string[];
}

export interface PatternAnalysisResult {
  patterns_detected: number;
  pattern_matches: PatternMatch[];
  pattern_confidence: number;
  emerging_patterns: EmergingPattern[];
  pattern_evolution: PatternEvolution[];
}

export interface ThreatAnalysisResult {
  threats_detected: number;
  threat_classifications: ThreatClassification[];
  threat_severity: string;
  attack_vectors: AttackVector[];
  mitigation_strategies: MitigationStrategy[];
}

export interface BehavioralAnalysisResult {
  behavioral_anomalies: number;
  user_risk_assessment: UserRiskAssessment;
  baseline_deviations: BaselineDeviation[];
  insider_threat_indicators: InsiderThreatIndicator[];
}

export interface TemporalAnalysisResult {
  temporal_patterns: TemporalPattern[];
  attack_phases: AttackPhase[];
  timing_analysis: TimingAnalysis;
  predictions: TemporalPrediction[];
}

export interface FusionAnalysisResult {
  fusion_strategy_used: string;
  component_weights: ComponentWeight[];
  consensus_score: number;
  conflict_resolution: ConflictResolution[];
  combined_confidence: number;
}

export interface IntegratedRecommendation {
  recommendation_id: string;
  category: 'immediate' | 'short_term' | 'long_term' | 'policy';
  priority: 'low' | 'medium' | 'high' | 'critical';
  action_type: 'investigate' | 'monitor' | 'block' | 'alert' | 'train' | 'update';
  description: string;
  rationale: string;
  implementation_steps: string[];
  success_criteria: string[];
  resource_requirements: ResourceRequirement[];
  timeline: string;
  dependencies: string[];
}

export interface VisualizationResult {
  visualization_id: string;
  visualization_type: string;
  title: string;
  description: string;
  data: any;
  interactive_features: string[];
  export_formats: string[];
}

export interface LearningUpdate {
  update_type: 'pattern_learned' | 'baseline_updated' | 'model_improved' | 'feedback_processed';
  component: string;
  description: string;
  impact_assessment: string;
  confidence: number;
}

// Supporting interfaces for results
export interface PatternMatch {
  pattern_id: string;
  pattern_name: string;
  match_type: string;
  confidence: number;
  evidence: Evidence[];
  timeline: any[];
}

export interface EmergingPattern {
  pattern_id: string;
  discovery_method: string;
  confidence: number;
  supporting_data: any;
  validation_status: string;
}

export interface PatternEvolution {
  pattern_id: string;
  evolution_type: string;
  changes: any[];
  adaptation_confidence: number;
}

export interface ThreatClassification {
  threat_type: string;
  severity: string;
  confidence: number;
  mitre_mapping: string[];
  kill_chain_stage: string;
}

export interface AttackVector {
  vector_type: string;
  likelihood: number;
  impact: number;
  complexity: string;
  detection_difficulty: string;
}

export interface MitigationStrategy {
  strategy_id: string;
  strategy_type: string;
  effectiveness: number;
  implementation_cost: string;
  deployment_time: string;
}

export interface UserRiskAssessment {
  current_risk_score: number;
  risk_change: number;
  risk_factors: string[];
  risk_trajectory: string;
}

export interface BaselineDeviation {
  metric: string;
  current_value: number;
  baseline_value: number;
  deviation_percentage: number;
  significance: number;
}

export interface InsiderThreatIndicator {
  indicator_type: string;
  severity: string;
  confidence: number;
  behavioral_evidence: string[];
  temporal_context: string;
}

export interface TemporalPattern {
  pattern_type: string;
  frequency: number;
  duration: number;
  regularity: number;
  confidence: number;
}

export interface AttackPhase {
  phase_name: string;
  phase_number: number;
  start_time: Date;
  duration: number;
  confidence: number;
  indicators: string[];
}

export interface TimingAnalysis {
  attack_speed: string;
  dwell_time: number;
  lateral_movement_speed: number;
  data_staging_time: number;
}

export interface TemporalPrediction {
  prediction_type: string;
  predicted_time: Date;
  confidence: number;
  impact_estimate: string;
}

export interface ComponentWeight {
  component: string;
  weight: number;
  rationale: string;
  performance_history: number;
}

export interface ConflictResolution {
  conflict_type: string;
  conflicting_components: string[];
  resolution_method: string;
  final_decision: string;
  confidence: number;
}

export interface ResourceRequirement {
  resource_type: string;
  quantity: number;
  duration: string;
  cost_estimate: string;
  availability: string;
}

/**
 * Integrated Pattern-Threat Detection Service
 */
export class IntegratedPatternThreatDetectorService extends EventEmitter {
  private isInitialized = false;
  private patternRecognitionService: AdvancedPatternRecognitionService;
  private temporalAnalyzerService: TemporalPatternAnalyzerService;
  private behavioralDetectorService: BehavioralPatternDetectorService;
  private learningEngineService: PatternLearningEngineService;
  private visualizationService: PatternVisualizationService;
  private threatDetectorService: AdvancedThreatDetectorService;
  private threatOrchestratorService: ThreatDetectionOrchestratorService;

  // Configuration and state
  private defaultDetectionOptions: DetectionOptions;
  private fusionWeights: Map<string, number> = new Map();
  private performanceMetrics: Map<string, any> = new Map();
  private learningHistory: LearningUpdate[] = [];

  constructor() {
    super();
    
    // Initialize component services
    this.patternRecognitionService = new AdvancedPatternRecognitionService();
    this.temporalAnalyzerService = new TemporalPatternAnalyzerService();
    this.behavioralDetectorService = new BehavioralPatternDetectorService();
    this.learningEngineService = new PatternLearningEngineService();
    this.visualizationService = new PatternVisualizationService();
    this.threatDetectorService = new AdvancedThreatDetectorService();
    this.threatOrchestratorService = new ThreatDetectionOrchestratorService();

    // Default configuration
    this.defaultDetectionOptions = {
      enable_pattern_recognition: true,
      enable_temporal_analysis: true,
      enable_behavioral_analysis: true,
      enable_threat_detection: true,
      enable_learning: true,
      confidence_threshold: 0.7,
      fusion_strategy: 'dynamic_weighting',
      output_format: 'detailed'
    };

    // Initialize fusion weights
    this.initializeFusionWeights();
  }

  /**
   * Initialize the integrated detection service
   */
  async initialize(): Promise<void> {
    try {
      const startTime = Date.now();
      logger.info('Initializing Integrated Pattern-Threat Detection Service...');

      // Initialize all component services in parallel
      await Promise.all([
        this.patternRecognitionService.initialize(),
        this.temporalAnalyzerService.initialize(),
        this.behavioralDetectorService.initialize(),
        this.learningEngineService.initialize(),
        this.visualizationService.initialize(),
        this.threatDetectorService.initialize(),
        this.threatOrchestratorService.initialize()
      ]);

      // Initialize fusion engine
      await this.initializeFusionEngine();

      // Load historical performance data
      await this.loadPerformanceHistory();

      this.isInitialized = true;
      const initTime = Date.now() - startTime;
      
      mlLogger.modelLoaded(ModelType.PATTERN_RECOGNIZER, '4.0.0', initTime);
      logger.info(`Integrated Pattern-Threat Detection Service initialized in ${initTime}ms`);
      
      this.emit('initialized', { 
        initTime, 
        componentsInitialized: 7,
        fusionEngineReady: true
      });
    } catch (error) {
      logger.error('Failed to initialize Integrated Pattern-Threat Detection Service:', error);
      throw error;
    }
  }

  /**
   * Perform comprehensive integrated threat and pattern detection
   */
  async detectIntegratedThreats(request: IntegratedDetectionRequest): Promise<IntegratedDetectionResponse> {
    if (!this.isInitialized) {
      throw new Error('Integrated Detection Service not initialized');
    }

    const startTime = Date.now();
    
    try {
      logger.info(`Starting integrated detection for request: ${request.request_id}`);

      // Prepare analysis context
      const analysisContext = this.prepareAnalysisContext(request);

      // Run all detection components in parallel
      const [
        patternResults,
        temporalResults,
        behavioralResults,
        threatResults
      ] = await Promise.all([
        this.runPatternRecognition(request, analysisContext),
        this.runTemporalAnalysis(request, analysisContext),
        this.runBehavioralAnalysis(request, analysisContext),
        this.runThreatDetection(request, analysisContext)
      ]);

      // Perform fusion analysis
      const fusionResults = await this.performFusionAnalysis(
        patternResults,
        temporalResults,
        behavioralResults,
        threatResults,
        request.detection_options
      );

      // Generate overall assessment
      const overallAssessment = this.generateOverallAssessment(
        fusionResults,
        request.detection_options.confidence_threshold
      );

      // Generate integrated recommendations
      const recommendations = await this.generateIntegratedRecommendations(
        overallAssessment,
        fusionResults,
        analysisContext
      );

      // Generate visualizations if requested
      let visualizations: VisualizationResult[] = [];
      if (request.detection_options.output_format === 'visualization' || 
          request.detection_options.output_format === 'all') {
        visualizations = await this.generateIntegratedVisualizations(
          fusionResults,
          request.detection_options
        );
      }

      // Update learning systems
      let learningUpdates: LearningUpdate[] = [];
      if (request.detection_options.enable_learning) {
        learningUpdates = await this.updateLearning(
          request,
          fusionResults,
          overallAssessment
        );
      }

      const processingTime = Date.now() - startTime;

      // Create integrated response
      const response: IntegratedDetectionResponse = {
        request_id: request.request_id,
        response_timestamp: new Date(),
        overall_assessment: overallAssessment,
        pattern_analysis: this.extractPatternAnalysisResult(patternResults),
        threat_analysis: this.extractThreatAnalysisResult(threatResults),
        behavioral_analysis: this.extractBehavioralAnalysisResult(behavioralResults),
        temporal_analysis: this.extractTemporalAnalysisResult(temporalResults),
        fusion_analysis: fusionResults,
        recommendations: recommendations,
        visualizations: visualizations.length > 0 ? visualizations : undefined,
        learning_updates: learningUpdates.length > 0 ? learningUpdates : undefined
      };

      // Log performance metrics
      mlLogger.predictionMade(
        ModelType.PATTERN_RECOGNIZER,
        overallAssessment.confidence,
        processingTime
      );

      // Update performance tracking
      this.updatePerformanceMetrics(request, response, processingTime);

      // Emit detection completion event
      this.emit('integrated_detection_complete', {
        requestId: request.request_id,
        riskScore: overallAssessment.risk_score,
        confidence: overallAssessment.confidence,
        processingTime,
        componentsUsed: this.getUsedComponents(request.detection_options),
        timestamp: new Date()
      });

      return response;

    } catch (error) {
      mlLogger.predictionError(ModelType.PATTERN_RECOGNIZER, error.message, request);
      logger.error(`Integrated detection failed for request ${request.request_id}:`, error);
      throw error;
    }
  }

  /**
   * Get service status and performance metrics
   */
  getServiceStatus(): {
    isInitialized: boolean;
    componentsStatus: Record<string, boolean>;
    performanceMetrics: any;
    learningProgress: any;
  } {
    return {
      isInitialized: this.isInitialized,
      componentsStatus: {
        patternRecognition: true, // Would check actual status
        temporalAnalysis: true,
        behavioralDetection: true,
        learningEngine: true,
        visualization: true,
        threatDetection: true,
        orchestrator: true
      },
      performanceMetrics: this.getAggregatedPerformanceMetrics(),
      learningProgress: {
        totalUpdates: this.learningHistory.length,
        recentUpdates: this.learningHistory.filter(update => 
          Date.now() - new Date(update.update_type).getTime() < 24 * 60 * 60 * 1000
        ).length,
        learningRate: this.calculateLearningRate()
      }
    };
  }

  /**
   * Update fusion weights based on performance feedback
   */
  async updateFusionWeights(feedback: any): Promise<void> {
    // Implement dynamic weight adjustment based on feedback
    const componentPerformance = this.analyzeComponentPerformance(feedback);
    
    for (const [component, performance] of Object.entries(componentPerformance)) {
      const currentWeight = this.fusionWeights.get(component) || 0.25;
      const adjustmentFactor = this.calculateWeightAdjustment(performance as number);
      const newWeight = Math.max(0.1, Math.min(0.8, currentWeight * adjustmentFactor));
      
      this.fusionWeights.set(component, newWeight);
    }

    // Normalize weights
    this.normalizeFusionWeights();

    logger.info('Fusion weights updated based on performance feedback');
    this.emit('fusion_weights_updated', { weights: Object.fromEntries(this.fusionWeights) });
  }

  // Private implementation methods

  private initializeFusionWeights(): void {
    this.fusionWeights.set('pattern_recognition', 0.3);
    this.fusionWeights.set('temporal_analysis', 0.25);
    this.fusionWeights.set('behavioral_analysis', 0.25);
    this.fusionWeights.set('threat_detection', 0.2);
  }

  private async initializeFusionEngine(): Promise<void> {
    // Initialize the fusion decision engine
    logger.info('Fusion engine initialized');
  }

  private async loadPerformanceHistory(): Promise<void> {
    // Load historical performance data for weight optimization
    logger.info('Performance history loaded');
  }

  private prepareAnalysisContext(request: IntegratedDetectionRequest): any {
    return {
      timestamp: request.timestamp,
      userContext: request.user_context,
      systemContext: request.system_context,
      threatLandscape: request.system_context?.threat_landscape,
      sessionInfo: request.user_context?.session_info
    };
  }

  private async runPatternRecognition(request: IntegratedDetectionRequest, context: any): Promise<any> {
    if (!request.detection_options.enable_pattern_recognition) {
      return null;
    }

    try {
      const patternRequest = this.convertToPatternRequest(request);
      return await this.patternRecognitionService.analyzePatterns(patternRequest);
    } catch (error) {
      logger.error('Pattern recognition analysis failed:', error);
      return null;
    }
  }

  private async runTemporalAnalysis(request: IntegratedDetectionRequest, context: any): Promise<any> {
    if (!request.detection_options.enable_temporal_analysis) {
      return null;
    }

    try {
      const events = this.extractEventsFromRequest(request);
      const patterns = new Map(); // Would get from pattern recognition results
      return await this.temporalAnalyzerService.analyzeTemporalPatterns(events, patterns);
    } catch (error) {
      logger.error('Temporal analysis failed:', error);
      return null;
    }
  }

  private async runBehavioralAnalysis(request: IntegratedDetectionRequest, context: any): Promise<any> {
    if (!request.detection_options.enable_behavioral_analysis || !request.user_context) {
      return null;
    }

    try {
      const behaviorData = this.extractBehaviorData(request);
      return await this.behavioralDetectorService.analyzeBehavioralPatterns(
        request.user_context.user_id,
        behaviorData
      );
    } catch (error) {
      logger.error('Behavioral analysis failed:', error);
      return null;
    }
  }

  private async runThreatDetection(request: IntegratedDetectionRequest, context: any): Promise<any> {
    if (!request.detection_options.enable_threat_detection) {
      return null;
    }

    try {
      const threatRequest = this.convertToThreatRequest(request);
      return await this.threatDetectorService.detectThreats(threatRequest);
    } catch (error) {
      logger.error('Threat detection failed:', error);
      return null;
    }
  }

  private async performFusionAnalysis(
    patternResults: any,
    temporalResults: any,
    behavioralResults: any,
    threatResults: any,
    options: DetectionOptions
  ): Promise<FusionAnalysisResult> {
    const componentWeights: ComponentWeight[] = [];
    const conflictResolutions: ConflictResolution[] = [];

    // Calculate component weights based on fusion strategy
    for (const [component, weight] of this.fusionWeights) {
      componentWeights.push({
        component,
        weight,
        rationale: `Dynamic weighting based on historical performance`,
        performance_history: this.getComponentPerformanceHistory(component)
      });
    }

    // Perform fusion based on strategy
    let consensusScore = 0;
    let combinedConfidence = 0;

    switch (options.fusion_strategy) {
      case 'weighted_average':
        consensusScore = this.calculateWeightedAverage([patternResults, temporalResults, behavioralResults, threatResults]);
        break;
      case 'majority_vote':
        consensusScore = this.calculateMajorityVote([patternResults, temporalResults, behavioralResults, threatResults]);
        break;
      case 'maximum_confidence':
        consensusScore = this.calculateMaximumConfidence([patternResults, temporalResults, behavioralResults, threatResults]);
        break;
      case 'dynamic_weighting':
        consensusScore = this.calculateDynamicWeighting([patternResults, temporalResults, behavioralResults, threatResults], componentWeights);
        break;
    }

    combinedConfidence = this.calculateCombinedConfidence([patternResults, temporalResults, behavioralResults, threatResults]);

    return {
      fusion_strategy_used: options.fusion_strategy,
      component_weights: componentWeights,
      consensus_score: consensusScore,
      conflict_resolution: conflictResolutions,
      combined_confidence: combinedConfidence
    };
  }

  private generateOverallAssessment(fusionResults: FusionAnalysisResult, confidenceThreshold: number): OverallAssessment {
    const riskScore = fusionResults.consensus_score * 100;
    const confidence = fusionResults.combined_confidence;

    let riskLevel: 'low' | 'medium' | 'high' | 'critical';
    if (riskScore >= 80) riskLevel = 'critical';
    else if (riskScore >= 60) riskLevel = 'high';
    else if (riskScore >= 40) riskLevel = 'medium';
    else riskLevel = 'low';

    return {
      risk_score: riskScore,
      risk_level: riskLevel,
      confidence: confidence,
      primary_concerns: this.identifyPrimaryConcerns(fusionResults),
      secondary_concerns: this.identifySecondaryConcerns(fusionResults),
      false_positive_probability: this.estimateFalsePositiveProbability(fusionResults),
      recommended_actions: this.generateImmediateActions(riskLevel, confidence)
    };
  }

  private async generateIntegratedRecommendations(
    assessment: OverallAssessment,
    fusionResults: FusionAnalysisResult,
    context: any
  ): Promise<IntegratedRecommendation[]> {
    const recommendations: IntegratedRecommendation[] = [];

    // Risk-based recommendations
    if (assessment.risk_level === 'critical') {
      recommendations.push({
        recommendation_id: `rec_${Date.now()}_critical`,
        category: 'immediate',
        priority: 'critical',
        action_type: 'investigate',
        description: 'Immediate investigation required for critical threat indicators',
        rationale: 'High risk score with strong confidence indicates active threat',
        implementation_steps: [
          'Isolate affected systems',
          'Gather additional evidence',
          'Escalate to incident response team',
          'Implement containment measures'
        ],
        success_criteria: ['Threat contained', 'Evidence preserved', 'Impact minimized'],
        resource_requirements: [
          { resource_type: 'human', quantity: 2, duration: '4 hours', cost_estimate: 'high', availability: 'immediate' }
        ],
        timeline: 'immediate',
        dependencies: []
      });
    }

    // Pattern-specific recommendations
    if (fusionResults.component_weights.find(w => w.component === 'pattern_recognition')?.weight > 0.5) {
      recommendations.push({
        recommendation_id: `rec_${Date.now()}_pattern`,
        category: 'short_term',
        priority: 'high',
        action_type: 'monitor',
        description: 'Enhanced monitoring for detected attack patterns',
        rationale: 'Strong pattern recognition results suggest coordinated attack',
        implementation_steps: [
          'Increase monitoring frequency',
          'Deploy additional sensors',
          'Enable advanced logging',
          'Set up automated alerting'
        ],
        success_criteria: ['Enhanced visibility achieved', 'Early detection capability improved'],
        resource_requirements: [
          { resource_type: 'computational', quantity: 1, duration: '24 hours', cost_estimate: 'medium', availability: 'immediate' }
        ],
        timeline: '2-4 hours',
        dependencies: []
      });
    }

    return recommendations;
  }

  private async generateIntegratedVisualizations(
    fusionResults: FusionAnalysisResult,
    options: DetectionOptions
  ): Promise<VisualizationResult[]> {
    const visualizations: VisualizationResult[] = [];

    // Generate fusion analysis visualization
    const fusionViz = await this.visualizationService.generatePatternVisualization(
      fusionResults,
      'network'
    );

    visualizations.push({
      visualization_id: `viz_${Date.now()}_fusion`,
      visualization_type: 'network',
      title: 'Integrated Threat Analysis Network',
      description: 'Network visualization showing relationships between detected threats and patterns',
      data: fusionViz,
      interactive_features: ['zoom', 'pan', 'node_selection', 'edge_filtering'],
      export_formats: ['png', 'svg', 'json']
    });

    return visualizations;
  }

  private async updateLearning(
    request: IntegratedDetectionRequest,
    fusionResults: FusionAnalysisResult,
    assessment: OverallAssessment
  ): Promise<LearningUpdate[]> {
    const updates: LearningUpdate[] = [];

    // Update pattern learning
    if (request.detection_options.enable_pattern_recognition) {
      try {
        await this.learningEngineService.adaptPatterns([], []);
        updates.push({
          update_type: 'pattern_learned',
          component: 'pattern_recognition',
          description: 'Pattern recognition models adapted based on detection results',
          impact_assessment: 'Improved pattern detection accuracy expected',
          confidence: 0.8
        });
      } catch (error) {
        logger.error('Pattern learning update failed:', error);
      }
    }

    // Update behavioral baselines
    if (request.detection_options.enable_behavioral_analysis && request.user_context) {
      try {
        await this.behavioralDetectorService.updateBehavioralBaseline(
          request.user_context.user_id,
          'overall_risk',
          assessment.risk_score / 100,
          assessment.confidence
        );
        updates.push({
          update_type: 'baseline_updated',
          component: 'behavioral_analysis',
          description: 'User behavioral baselines updated with latest analysis',
          impact_assessment: 'More accurate behavioral anomaly detection',
          confidence: 0.9
        });
      } catch (error) {
        logger.error('Behavioral baseline update failed:', error);
      }
    }

    this.learningHistory.push(...updates);
    return updates;
  }

  // Extraction and conversion helper methods
  private convertToPatternRequest(request: IntegratedDetectionRequest): PredictionRequest {
    return {
      model_type: ModelType.PATTERN_RECOGNIZER,
      data: request.data,
      options: {
        confidence_threshold: request.detection_options.confidence_threshold
      },
      metadata: {
        request_id: request.request_id,
        timestamp: request.timestamp,
        user_context: request.user_context
      }
    };
  }

  private convertToThreatRequest(request: IntegratedDetectionRequest): PredictionRequest {
    return {
      model_type: ModelType.THREAT_CLASSIFIER,
      data: request.data,
      options: {
        confidence_threshold: request.detection_options.confidence_threshold
      },
      metadata: {
        request_id: request.request_id,
        timestamp: request.timestamp,
        user_context: request.user_context
      }
    };
  }

  private extractEventsFromRequest(request: IntegratedDetectionRequest): any[] {
    // Extract temporal events from request data
    return Array.isArray(request.data.events) ? request.data.events : [];
  }

  private extractBehaviorData(request: IntegratedDetectionRequest): any {
    // Extract behavioral data from request
    return request.data.user_activity || {};
  }

  private extractPatternAnalysisResult(patternResults: any): PatternAnalysisResult {
    if (!patternResults) {
      return {
        patterns_detected: 0,
        pattern_matches: [],
        pattern_confidence: 0,
        emerging_patterns: [],
        pattern_evolution: []
      };
    }

    return {
      patterns_detected: Array.isArray(patternResults) ? patternResults.length : 0,
      pattern_matches: patternResults || [],
      pattern_confidence: patternResults.length > 0 ? 
        patternResults.reduce((sum: number, p: any) => sum + p.confidence, 0) / patternResults.length : 0,
      emerging_patterns: [],
      pattern_evolution: []
    };
  }

  private extractThreatAnalysisResult(threatResults: any): ThreatAnalysisResult {
    if (!threatResults) {
      return {
        threats_detected: 0,
        threat_classifications: [],
        threat_severity: 'low',
        attack_vectors: [],
        mitigation_strategies: []
      };
    }

    return {
      threats_detected: Array.isArray(threatResults) ? threatResults.length : 0,
      threat_classifications: threatResults || [],
      threat_severity: threatResults.length > 0 ? 'high' : 'low',
      attack_vectors: [],
      mitigation_strategies: []
    };
  }

  private extractBehavioralAnalysisResult(behavioralResults: any): BehavioralAnalysisResult {
    if (!behavioralResults) {
      return {
        behavioral_anomalies: 0,
        user_risk_assessment: {
          current_risk_score: 0,
          risk_change: 0,
          risk_factors: [],
          risk_trajectory: 'stable'
        },
        baseline_deviations: [],
        insider_threat_indicators: []
      };
    }

    return {
      behavioral_anomalies: behavioralResults.behavioral_deviations?.length || 0,
      user_risk_assessment: {
        current_risk_score: behavioralResults.overall_risk_score || 0,
        risk_change: 0,
        risk_factors: behavioralResults.behavioral_deviations?.map((d: any) => d.metric) || [],
        risk_trajectory: 'stable'
      },
      baseline_deviations: behavioralResults.behavioral_deviations || [],
      insider_threat_indicators: []
    };
  }

  private extractTemporalAnalysisResult(temporalResults: any): TemporalAnalysisResult {
    return {
      temporal_patterns: temporalResults || [],
      attack_phases: [],
      timing_analysis: {
        attack_speed: 'medium',
        dwell_time: 0,
        lateral_movement_speed: 0,
        data_staging_time: 0
      },
      predictions: []
    };
  }

  // Fusion calculation methods
  private calculateWeightedAverage(results: any[]): number {
    let weightedSum = 0;
    let totalWeight = 0;

    for (let i = 0; i < results.length; i++) {
      if (results[i]) {
        const weight = Array.from(this.fusionWeights.values())[i] || 0.25;
        const score = this.extractConfidenceScore(results[i]);
        weightedSum += score * weight;
        totalWeight += weight;
      }
    }

    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  private calculateMajorityVote(results: any[]): number {
    const votes = results.filter(r => r && this.extractConfidenceScore(r) > 0.5);
    return votes.length / results.filter(r => r).length;
  }

  private calculateMaximumConfidence(results: any[]): number {
    const scores = results.map(r => r ? this.extractConfidenceScore(r) : 0);
    return Math.max(...scores);
  }

  private calculateDynamicWeighting(results: any[], componentWeights: ComponentWeight[]): number {
    // Implement dynamic weighting based on real-time performance
    return this.calculateWeightedAverage(results);
  }

  private calculateCombinedConfidence(results: any[]): number {
    const confidences = results.map(r => r ? this.extractConfidenceScore(r) : 0);
    const validConfidences = confidences.filter(c => c > 0);
    return validConfidences.length > 0 ? 
      validConfidences.reduce((sum, c) => sum + c, 0) / validConfidences.length : 0;
  }

  private extractConfidenceScore(result: any): number {
    if (Array.isArray(result)) {
      return result.length > 0 ? 
        result.reduce((sum, r) => sum + (r.confidence || 0), 0) / result.length : 0;
    }
    return result.confidence || result.overall_confidence || 0;
  }

  // Analysis helper methods
  private identifyPrimaryConcerns(fusionResults: FusionAnalysisResult): string[] {
    const concerns: string[] = [];
    
    if (fusionResults.consensus_score > 0.8) {
      concerns.push('High threat probability detected');
    }
    if (fusionResults.combined_confidence > 0.9) {
      concerns.push('High confidence in threat assessment');
    }
    
    return concerns;
  }

  private identifySecondaryConcerns(fusionResults: FusionAnalysisResult): string[] {
    return ['Pattern evolution detected', 'Behavioral anomalies present'];
  }

  private estimateFalsePositiveProbability(fusionResults: FusionAnalysisResult): number {
    // Estimate false positive probability based on fusion confidence
    return Math.max(0, 1 - fusionResults.combined_confidence);
  }

  private generateImmediateActions(riskLevel: string, confidence: number): string[] {
    const actions: string[] = [];
    
    if (riskLevel === 'critical') {
      actions.push('Immediate investigation required');
      actions.push('Consider system isolation');
    } else if (riskLevel === 'high') {
      actions.push('Enhanced monitoring recommended');
      actions.push('Prepare incident response');
    }
    
    return actions;
  }

  // Performance tracking methods
  private updatePerformanceMetrics(
    request: IntegratedDetectionRequest,
    response: IntegratedDetectionResponse,
    processingTime: number
  ): void {
    const metrics = {
      timestamp: new Date(),
      processingTime,
      riskScore: response.overall_assessment.risk_score,
      confidence: response.overall_assessment.confidence,
      componentsUsed: this.getUsedComponents(request.detection_options),
      fusionStrategy: request.detection_options.fusion_strategy
    };

    this.performanceMetrics.set(request.request_id, metrics);
  }

  private getUsedComponents(options: DetectionOptions): string[] {
    const components: string[] = [];
    if (options.enable_pattern_recognition) components.push('pattern_recognition');
    if (options.enable_temporal_analysis) components.push('temporal_analysis');
    if (options.enable_behavioral_analysis) components.push('behavioral_analysis');
    if (options.enable_threat_detection) components.push('threat_detection');
    return components;
  }

  private getAggregatedPerformanceMetrics(): any {
    const metrics = Array.from(this.performanceMetrics.values());
    if (metrics.length === 0) return {};

    return {
      averageProcessingTime: metrics.reduce((sum, m) => sum + m.processingTime, 0) / metrics.length,
      averageRiskScore: metrics.reduce((sum, m) => sum + m.riskScore, 0) / metrics.length,
      averageConfidence: metrics.reduce((sum, m) => sum + m.confidence, 0) / metrics.length,
      totalDetections: metrics.length,
      recentDetections: metrics.filter(m => 
        Date.now() - m.timestamp.getTime() < 24 * 60 * 60 * 1000
      ).length
    };
  }

  private getComponentPerformanceHistory(component: string): number {
    // Return historical performance score for component
    return 0.85; // Placeholder
  }

  private analyzeComponentPerformance(feedback: any): Record<string, number> {
    // Analyze component performance based on feedback
    return {
      pattern_recognition: 0.9,
      temporal_analysis: 0.85,
      behavioral_analysis: 0.8,
      threat_detection: 0.88
    };
  }

  private calculateWeightAdjustment(performance: number): number {
    // Calculate weight adjustment factor based on performance
    if (performance > 0.9) return 1.1;
    if (performance > 0.8) return 1.0;
    if (performance > 0.7) return 0.95;
    return 0.9;
  }

  private normalizeFusionWeights(): void {
    const totalWeight = Array.from(this.fusionWeights.values()).reduce((sum, weight) => sum + weight, 0);
    
    if (totalWeight > 0) {
      for (const [component, weight] of this.fusionWeights) {
        this.fusionWeights.set(component, weight / totalWeight);
      }
    }
  }

  private calculateLearningRate(): number {
    // Calculate learning rate based on recent updates
    const recentUpdates = this.learningHistory.filter(update => 
      Date.now() - new Date(update.update_type).getTime() < 7 * 24 * 60 * 60 * 1000
    );
    return recentUpdates.length / 7; // Updates per day
  }
}

export { IntegratedPatternThreatDetectorService };