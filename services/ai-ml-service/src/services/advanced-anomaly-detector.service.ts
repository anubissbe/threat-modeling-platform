/**
 * Advanced Anomaly Detection Service
 * Multi-algorithm anomaly detection for unknown threats
 */

import { EventEmitter } from 'events';
import * as natural from 'natural';
import { logger, mlLogger } from '../utils/logger';
import { ModelType, PredictionRequest, PredictionResponse, Evidence } from '../types';
import { config } from '../config';

// Anomaly detection interfaces
export interface AnomalyDetectionConfig {
  sensitivity: 'low' | 'medium' | 'high';
  algorithms: AnomalyAlgorithm[];
  time_windows: number[]; // seconds
  baseline_period: number; // days
  update_frequency: number; // hours
}

export interface AnomalyAlgorithm {
  name: string;
  type: 'statistical' | 'ml' | 'rule_based' | 'behavioral';
  enabled: boolean;
  parameters: Record<string, any>;
  weight: number;
}

export interface AnomalyResult {
  anomaly_id: string;
  algorithm: string;
  anomaly_type: 'point' | 'contextual' | 'collective';
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  score: number;
  threshold: number;
  description: string;
  affected_entities: string[];
  time_window: {
    start: Date;
    end: Date;
  };
  contributing_features: FeatureContribution[];
  evidence: Evidence[];
  recommendations: string[];
  metadata: {
    baseline_comparison: number;
    statistical_significance: number;
    false_positive_probability: number;
    detection_time: Date;
    processing_time_ms: number;
  };
}

export interface FeatureContribution {
  feature_name: string;
  importance: number;
  current_value: number;
  expected_value: number;
  deviation: number;
  description: string;
}

export interface BaselineProfile {
  entity_id: string;
  feature_statistics: Map<string, FeatureStatistics>;
  behavioral_patterns: BehavioralPattern[];
  temporal_patterns: TemporalPattern[];
  last_updated: Date;
  sample_count: number;
}

export interface FeatureStatistics {
  mean: number;
  std_dev: number;
  median: number;
  percentiles: number[];
  distribution_type: 'normal' | 'poisson' | 'exponential' | 'uniform' | 'custom';
  seasonal_components?: number[];
}

export interface BehavioralPattern {
  pattern_id: string;
  pattern_type: 'frequency' | 'sequence' | 'volume' | 'timing';
  normal_range: [number, number];
  confidence: number;
}

export interface TemporalPattern {
  time_of_day: number[];
  day_of_week: number[];
  monthly_trend: number[];
  seasonal_factor: number;
}

/**
 * Advanced Multi-Algorithm Anomaly Detection Engine
 */
export class AdvancedAnomalyDetectorService extends EventEmitter {
  private isInitialized = false;
  private config: AnomalyDetectionConfig;
  private baselineProfiles: Map<string, BaselineProfile> = new Map();
  private detectionAlgorithms: Map<string, AnomalyDetectionAlgorithm> = new Map();
  private recentAnomalies: AnomalyResult[] = [];
  private featureExtractor: AnomalyFeatureExtractor;

  constructor(config?: Partial<AnomalyDetectionConfig>) {
    super();
    this.config = {
      sensitivity: 'medium',
      algorithms: this.getDefaultAlgorithms(),
      time_windows: [60, 300, 3600, 86400], // 1min, 5min, 1hr, 1day
      baseline_period: 7, // days
      update_frequency: 6, // hours
      ...config
    };
    this.featureExtractor = new AnomalyFeatureExtractor();
  }

  /**
   * Initialize the anomaly detection system
   */
  async initialize(): Promise<void> {
    try {
      const startTime = Date.now();
      logger.info('Initializing Advanced Anomaly Detection System...');

      // Initialize detection algorithms
      await this.initializeAlgorithms();
      
      // Load baseline profiles
      await this.loadBaselineProfiles();
      
      // Initialize feature extractor
      await this.featureExtractor.initialize();

      this.isInitialized = true;
      const initTime = Date.now() - startTime;
      
      mlLogger.modelLoaded(ModelType.VULNERABILITY_PREDICTOR, '2.0.0', initTime);
      logger.info(`Advanced Anomaly Detection System initialized in ${initTime}ms`);
      
      this.emit('initialized', { initTime });
    } catch (error) {
      logger.error('Failed to initialize Advanced Anomaly Detection System:', error);
      throw error;
    }
  }

  /**
   * Detect anomalies in real-time data
   */
  async detectAnomalies(request: PredictionRequest): Promise<AnomalyResult[]> {
    if (!this.isInitialized) {
      throw new Error('Advanced Anomaly Detector not initialized');
    }

    const startTime = Date.now();
    
    try {
      // Extract features from input data
      const features = await this.featureExtractor.extract(request.data);
      
      // Run multiple detection algorithms
      const results: AnomalyResult[] = [];
      
      for (const [algorithmName, algorithm] of this.detectionAlgorithms) {
        if (!algorithm.isEnabled()) continue;
        
        const algorithmResults = await algorithm.detect(features, this.baselineProfiles);
        results.push(...algorithmResults);
      }
      
      // Aggregate and rank results
      const aggregatedResults = this.aggregateResults(results);
      
      // Apply ensemble voting
      const finalResults = this.ensembleVoting(aggregatedResults);
      
      // Filter by confidence threshold
      const significantResults = finalResults.filter(result => 
        result.confidence >= this.getConfidenceThreshold()
      );
      
      // Update anomaly history
      this.updateAnomalyHistory(significantResults);
      
      const processingTime = Date.now() - startTime;
      
      // Log detection metrics
      mlLogger.predictionMade(
        ModelType.VULNERABILITY_PREDICTOR,
        significantResults.length > 0 ? Math.max(...significantResults.map(r => r.confidence)) : 0,
        processingTime
      );
      
      // Emit anomaly detection event
      this.emit('anomalies_detected', {
        request,
        results: significantResults,
        processingTime,
        timestamp: new Date()
      });
      
      return significantResults;
      
    } catch (error) {
      mlLogger.predictionError(ModelType.VULNERABILITY_PREDICTOR, error.message, request);
      throw error;
    }
  }

  /**
   * Update baseline profiles with new data
   */
  async updateBaselines(data: any): Promise<void> {
    const features = await this.featureExtractor.extract(data);
    
    for (const [entityId, entityFeatures] of features.entities) {
      let profile = this.baselineProfiles.get(entityId);
      
      if (!profile) {
        profile = this.createNewProfile(entityId);
        this.baselineProfiles.set(entityId, profile);
      }
      
      this.updateProfileWithData(profile, entityFeatures);
    }
    
    logger.info(`Updated ${features.entities.size} baseline profiles`);
  }

  /**
   * Get anomaly detection statistics
   */
  getDetectionStatistics(): {
    total_profiles: number;
    recent_anomalies: number;
    detection_rate: number;
    false_positive_rate: number;
    active_algorithms: string[];
  } {
    return {
      total_profiles: this.baselineProfiles.size,
      recent_anomalies: this.recentAnomalies.length,
      detection_rate: this.calculateDetectionRate(),
      false_positive_rate: this.calculateFalsePositiveRate(),
      active_algorithms: Array.from(this.detectionAlgorithms.keys())
        .filter(name => this.detectionAlgorithms.get(name)?.isEnabled())
    };
  }

  /**
   * Initialize detection algorithms
   */
  private async initializeAlgorithms(): Promise<void> {
    for (const algorithmConfig of this.config.algorithms) {
      if (!algorithmConfig.enabled) continue;
      
      let algorithm: AnomalyDetectionAlgorithm;
      
      switch (algorithmConfig.type) {
        case 'statistical':
          algorithm = new StatisticalAnomalyDetector(algorithmConfig);
          break;
        case 'ml':
          algorithm = new MLAnomalyDetector(algorithmConfig);
          break;
        case 'rule_based':
          algorithm = new RuleBasedAnomalyDetector(algorithmConfig);
          break;
        case 'behavioral':
          algorithm = new BehavioralAnomalyDetector(algorithmConfig);
          break;
        default:
          logger.warn(`Unknown algorithm type: ${algorithmConfig.type}`);
          continue;
      }
      
      await algorithm.initialize();
      this.detectionAlgorithms.set(algorithmConfig.name, algorithm);
    }
    
    logger.info(`Initialized ${this.detectionAlgorithms.size} anomaly detection algorithms`);
  }

  /**
   * Load baseline profiles from storage
   */
  private async loadBaselineProfiles(): Promise<void> {
    // TODO: Load from MLOps model registry or database
    logger.info('Baseline profiles loaded');
  }

  /**
   * Get default algorithm configurations
   */
  private getDefaultAlgorithms(): AnomalyAlgorithm[] {
    return [
      {
        name: 'z-score',
        type: 'statistical',
        enabled: true,
        parameters: { threshold: 3.0, window_size: 100 },
        weight: 0.3
      },
      {
        name: 'isolation-forest',
        type: 'ml',
        enabled: true,
        parameters: { contamination: 0.1, n_estimators: 100 },
        weight: 0.4
      },
      {
        name: 'lstm-autoencoder',
        type: 'ml',
        enabled: true,
        parameters: { sequence_length: 50, threshold_percentile: 95 },
        weight: 0.3
      },
      {
        name: 'rule-based',
        type: 'rule_based',
        enabled: true,
        parameters: { rules: 'default' },
        weight: 0.2
      },
      {
        name: 'behavioral-profile',
        type: 'behavioral',
        enabled: true,
        parameters: { deviation_threshold: 2.0 },
        weight: 0.4
      }
    ];
  }

  /**
   * Aggregate results from multiple algorithms
   */
  private aggregateResults(results: AnomalyResult[]): AnomalyResult[] {
    // Group by similar anomalies
    const groups = new Map<string, AnomalyResult[]>();
    
    for (const result of results) {
      const key = `${result.anomaly_type}-${result.affected_entities.join(',')}-${result.time_window.start.getTime()}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(result);
    }
    
    // Aggregate each group
    const aggregated: AnomalyResult[] = [];
    
    for (const [key, groupResults] of groups) {
      if (groupResults.length === 1) {
        aggregated.push(groupResults[0]);
        continue;
      }
      
      // Combine multiple detections of same anomaly
      const combinedResult = this.combineResults(groupResults);
      aggregated.push(combinedResult);
    }
    
    return aggregated;
  }

  /**
   * Ensemble voting across algorithms
   */
  private ensembleVoting(results: AnomalyResult[]): AnomalyResult[] {
    return results.map(result => {
      // Adjust confidence based on algorithm weights
      const algorithm = this.config.algorithms.find(a => a.name === result.algorithm);
      const weight = algorithm?.weight || 1.0;
      
      result.confidence *= weight;
      result.score *= weight;
      
      return result;
    }).sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Combine multiple detection results
   */
  private combineResults(results: AnomalyResult[]): AnomalyResult {
    const weights = results.map(r => {
      const algo = this.config.algorithms.find(a => a.name === r.algorithm);
      return algo?.weight || 1.0;
    });
    
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    const weightedConfidence = results.reduce((sum, r, i) => sum + r.confidence * weights[i], 0) / totalWeight;
    const weightedScore = results.reduce((sum, r, i) => sum + r.score * weights[i], 0) / totalWeight;
    
    // Use the result with highest confidence as base
    const baseResult = results.reduce((best, current) => 
      current.confidence > best.confidence ? current : best
    );
    
    return {
      ...baseResult,
      confidence: weightedConfidence,
      score: weightedScore,
      algorithm: 'ensemble',
      description: `Combined detection from ${results.length} algorithms`,
      evidence: results.flatMap(r => r.evidence),
      contributing_features: this.mergeFeatureContributions(results.flatMap(r => r.contributing_features))
    };
  }

  /**
   * Merge feature contributions from multiple results
   */
  private mergeFeatureContributions(contributions: FeatureContribution[]): FeatureContribution[] {
    const merged = new Map<string, FeatureContribution>();
    
    for (const contrib of contributions) {
      if (merged.has(contrib.feature_name)) {
        const existing = merged.get(contrib.feature_name)!;
        existing.importance = Math.max(existing.importance, contrib.importance);
        existing.deviation = Math.max(existing.deviation, contrib.deviation);
      } else {
        merged.set(contrib.feature_name, { ...contrib });
      }
    }
    
    return Array.from(merged.values()).sort((a, b) => b.importance - a.importance);
  }

  /**
   * Get confidence threshold based on sensitivity
   */
  private getConfidenceThreshold(): number {
    const thresholds = { low: 0.5, medium: 0.7, high: 0.85 };
    return thresholds[this.config.sensitivity];
  }

  /**
   * Create new baseline profile
   */
  private createNewProfile(entityId: string): BaselineProfile {
    return {
      entity_id: entityId,
      feature_statistics: new Map(),
      behavioral_patterns: [],
      temporal_patterns: [],
      last_updated: new Date(),
      sample_count: 0
    };
  }

  /**
   * Update profile with new data
   */
  private updateProfileWithData(profile: BaselineProfile, features: any): void {
    // Update feature statistics
    for (const [featureName, value] of Object.entries(features)) {
      if (typeof value !== 'number') continue;
      
      let stats = profile.feature_statistics.get(featureName);
      if (!stats) {
        stats = {
          mean: value,
          std_dev: 0,
          median: value,
          percentiles: [value],
          distribution_type: 'normal'
        };
        profile.feature_statistics.set(featureName, stats);
      } else {
        // Update running statistics
        const n = profile.sample_count;
        const newMean = (stats.mean * n + value) / (n + 1);
        const newVariance = ((stats.std_dev * stats.std_dev * n) + 
                           (value - newMean) * (value - stats.mean)) / (n + 1);
        
        stats.mean = newMean;
        stats.std_dev = Math.sqrt(newVariance);
        stats.percentiles.push(value);
        
        // Keep only recent percentiles
        if (stats.percentiles.length > 1000) {
          stats.percentiles = stats.percentiles.slice(-1000);
        }
      }
    }
    
    profile.sample_count++;
    profile.last_updated = new Date();
  }

  /**
   * Update anomaly history
   */
  private updateAnomalyHistory(results: AnomalyResult[]): void {
    this.recentAnomalies.push(...results);
    
    // Keep only recent anomalies (last 24 hours)
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    this.recentAnomalies = this.recentAnomalies.filter(
      a => a.metadata.detection_time > cutoff
    );
  }

  /**
   * Calculate detection rate
   */
  private calculateDetectionRate(): number {
    // TODO: Implement based on ground truth data
    return 0.85;
  }

  /**
   * Calculate false positive rate
   */
  private calculateFalsePositiveRate(): number {
    // TODO: Implement based on feedback data
    return 0.05;
  }
}

// Supporting classes
class AnomalyFeatureExtractor {
  async initialize(): Promise<void> {
    // Initialize feature extraction
  }

  async extract(data: any): Promise<{ entities: Map<string, any> }> {
    // Extract features grouped by entity
    const entities = new Map();
    
    // Extract features from different data types
    if (data.network) {
      entities.set('network', this.extractNetworkFeatures(data.network));
    }
    
    if (data.processes) {
      entities.set('processes', this.extractProcessFeatures(data.processes));
    }
    
    if (data.users) {
      for (const user of data.users) {
        entities.set(`user-${user.id}`, this.extractUserFeatures(user));
      }
    }
    
    return { entities };
  }

  private extractNetworkFeatures(networkData: any): any {
    return {
      connection_count: networkData.connections?.length || 0,
      bytes_transferred: networkData.bytes || 0,
      unique_destinations: new Set(networkData.destinations || []).size,
      connection_duration: networkData.duration || 0
    };
  }

  private extractProcessFeatures(processData: any): any {
    return {
      process_count: processData.length || 0,
      cpu_usage: processData.reduce((sum: number, p: any) => sum + (p.cpu || 0), 0),
      memory_usage: processData.reduce((sum: number, p: any) => sum + (p.memory || 0), 0),
      unique_commands: new Set(processData.map((p: any) => p.command || '')).size
    };
  }

  private extractUserFeatures(userData: any): any {
    return {
      login_count: userData.logins || 0,
      failed_logins: userData.failed_logins || 0,
      session_duration: userData.session_duration || 0,
      privilege_escalations: userData.privilege_escalations || 0
    };
  }
}

// Abstract base class for anomaly detection algorithms
abstract class AnomalyDetectionAlgorithm {
  protected config: AnomalyAlgorithm;
  protected initialized = false;

  constructor(config: AnomalyAlgorithm) {
    this.config = config;
  }

  abstract initialize(): Promise<void>;
  abstract detect(features: any, profiles: Map<string, BaselineProfile>): Promise<AnomalyResult[]>;

  isEnabled(): boolean {
    return this.config.enabled && this.initialized;
  }
}

// Statistical anomaly detection
class StatisticalAnomalyDetector extends AnomalyDetectionAlgorithm {
  async initialize(): Promise<void> {
    this.initialized = true;
  }

  async detect(features: any, profiles: Map<string, BaselineProfile>): Promise<AnomalyResult[]> {
    const results: AnomalyResult[] = [];
    const threshold = this.config.parameters.threshold || 3.0;
    
    for (const [entityId, entityFeatures] of features.entities) {
      const profile = profiles.get(entityId);
      if (!profile) continue;
      
      for (const [featureName, value] of Object.entries(entityFeatures)) {
        if (typeof value !== 'number') continue;
        
        const stats = profile.feature_statistics.get(featureName);
        if (!stats || stats.std_dev === 0) continue;
        
        const zScore = Math.abs((value - stats.mean) / stats.std_dev);
        
        if (zScore > threshold) {
          results.push({
            anomaly_id: `stat-${entityId}-${featureName}-${Date.now()}`,
            algorithm: this.config.name,
            anomaly_type: 'point',
            severity: zScore > 4 ? 'high' : 'medium',
            confidence: Math.min(zScore / threshold, 1.0),
            score: zScore,
            threshold,
            description: `Statistical anomaly in ${featureName} for ${entityId}`,
            affected_entities: [entityId],
            time_window: { start: new Date(), end: new Date() },
            contributing_features: [{
              feature_name: featureName,
              importance: 1.0,
              current_value: value,
              expected_value: stats.mean,
              deviation: zScore,
              description: `Z-score: ${zScore.toFixed(2)}`
            }],
            evidence: [{
              type: 'statistical',
              description: `Value ${value} deviates ${zScore.toFixed(2)} standard deviations from mean ${stats.mean.toFixed(2)}`,
              confidence: Math.min(zScore / threshold, 1.0),
              source: 'z-score-detector'
            }],
            recommendations: [
              'Investigate the source of unusual activity',
              'Check for configuration changes',
              'Review recent events for this entity'
            ],
            metadata: {
              baseline_comparison: (value - stats.mean) / stats.mean,
              statistical_significance: zScore,
              false_positive_probability: this.calculatePValue(zScore),
              detection_time: new Date(),
              processing_time_ms: 0
            }
          });
        }
      }
    }
    
    return results;
  }

  private calculatePValue(zScore: number): number {
    // Simplified p-value calculation for normal distribution
    return 2 * (1 - this.standardNormalCDF(Math.abs(zScore)));
  }

  private standardNormalCDF(x: number): number {
    // Approximation of standard normal CDF
    return 0.5 * (1 + this.erf(x / Math.sqrt(2)));
  }

  private erf(x: number): number {
    // Error function approximation
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = x >= 0 ? 1 : -1;
    x = Math.abs(x);

    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return sign * y;
  }
}

// Machine learning anomaly detection
class MLAnomalyDetector extends AnomalyDetectionAlgorithm {
  async initialize(): Promise<void> {
    // TODO: Initialize ML models (Isolation Forest, Autoencoder, etc.)
    this.initialized = true;
  }

  async detect(features: any, profiles: Map<string, BaselineProfile>): Promise<AnomalyResult[]> {
    // TODO: Implement ML-based anomaly detection
    return [];
  }
}

// Rule-based anomaly detection
class RuleBasedAnomalyDetector extends AnomalyDetectionAlgorithm {
  async initialize(): Promise<void> {
    this.initialized = true;
  }

  async detect(features: any, profiles: Map<string, BaselineProfile>): Promise<AnomalyResult[]> {
    // TODO: Implement rule-based detection
    return [];
  }
}

// Behavioral anomaly detection
class BehavioralAnomalyDetector extends AnomalyDetectionAlgorithm {
  async initialize(): Promise<void> {
    this.initialized = true;
  }

  async detect(features: any, profiles: Map<string, BaselineProfile>): Promise<AnomalyResult[]> {
    // TODO: Implement behavioral anomaly detection
    return [];
  }
}

export { AdvancedAnomalyDetectorService };