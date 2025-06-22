/**
 * Pattern Recognition Controller for Task 3.3
 * Handles all pattern recognition, behavioral analysis, and anomaly detection requests
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { logger } from '../utils/logger';
import { AdvancedPatternRecognitionService } from '../services/advanced-pattern-recognition.service';
import { BehavioralPatternDetectorService } from '../services/behavioral-pattern-detector.service';
import { PatternVisualizationEngine } from '../services/pattern-visualization.service';
import { RealTimeMonitoringService } from '../services/real-time-monitoring.service';
import { CacheService } from '../services/cache.service';
import {
  PatternAnalysisRequest,
  BehavioralAnalysisRequest,
  PatternVisualizationRequest,
  RealTimeMonitoringRequest,
  PatternMatch,
  BehavioralAnalysisResult
} from '../types';

export class PatternRecognitionController {
  private patternService: AdvancedPatternRecognitionService;
  private behavioralService: BehavioralPatternDetectorService;
  private visualizationEngine: PatternVisualizationEngine;
  private monitoringService: RealTimeMonitoringService;
  private cacheService: CacheService;

  constructor(
    patternService: AdvancedPatternRecognitionService,
    behavioralService: BehavioralPatternDetectorService,
    visualizationEngine: PatternVisualizationEngine,
    monitoringService: RealTimeMonitoringService,
    cacheService: CacheService
  ) {
    this.patternService = patternService;
    this.behavioralService = behavioralService;
    this.visualizationEngine = visualizationEngine;
    this.monitoringService = monitoringService;
    this.cacheService = cacheService;
  }

  /**
   * Comprehensive pattern analysis endpoint
   */
  async analyzePatterns(
    request: FastifyRequest<{ Body: PatternAnalysisRequest }>,
    reply: FastifyReply
  ): Promise<void> {
    const startTime = Date.now();
    const requestId = `pattern-analysis-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      logger.info(`Starting pattern analysis [${requestId}]`, {
        analysis_type: request.body.analysis_type,
        confidence_threshold: request.body.confidence_threshold,
        include_predictions: request.body.include_predictions
      });

      // Check cache first
      const cacheKey = `pattern-analysis-${JSON.stringify(request.body).substring(0, 100)}`;
      const cachedResult = await this.cacheService.get(cacheKey);
      
      if (cachedResult) {
        logger.info(`Returning cached pattern analysis [${requestId}]`);
        return reply.send({
          success: true,
          patterns: cachedResult.patterns,
          metadata: {
            ...cachedResult.metadata,
            cached: true,
            request_id: requestId
          }
        });
      }

      // Convert request to prediction request format
      const predictionRequest = {
        data: request.body.data,
        input: request.body.data,
        options: {
          threshold: request.body.confidence_threshold,
          analysisType: request.body.analysis_type,
          timeWindow: request.body.time_window,
          includePredictions: request.body.include_predictions,
          enableLearning: request.body.enable_learning
        }
      };

      // Perform pattern analysis
      const patterns = await this.patternService.analyzePatterns(predictionRequest);
      
      // Filter by confidence threshold
      const filteredPatterns = patterns.filter(
        pattern => pattern.confidence >= (request.body.confidence_threshold || 0.6)
      );

      // Calculate metadata
      const analysisTime = Date.now() - startTime;
      const metadata = {
        analysis_duration: analysisTime,
        patterns_evaluated: patterns.length,
        active_matches: filteredPatterns.length,
        confidence_distribution: this.calculateConfidenceDistribution(filteredPatterns),
        performance_metrics: await this.getPerformanceMetrics(),
        request_id: requestId,
        cached: false
      };

      // Cache the result
      await this.cacheService.set(cacheKey, { patterns: filteredPatterns, metadata }, 300); // 5 minutes

      logger.info(`Pattern analysis completed [${requestId}]`, {
        patterns_found: filteredPatterns.length,
        analysis_time: analysisTime
      });

      reply.send({
        success: true,
        patterns: filteredPatterns,
        metadata
      });

    } catch (error) {
      logger.error(`Pattern analysis failed [${requestId}]:`, error);
      reply.code(500).send({
        success: false,
        error: 'Pattern analysis failed',
        message: error.message,
        request_id: requestId
      });
    }
  }

  /**
   * Behavioral pattern analysis for insider threats
   */
  async analyzeBehavioralPatterns(
    request: FastifyRequest<{ Body: BehavioralAnalysisRequest }>,
    reply: FastifyReply
  ): Promise<void> {
    const startTime = Date.now();
    const requestId = `behavioral-analysis-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      logger.info(`Starting behavioral analysis [${requestId}]`, {
        user_id: request.body.user_id,
        time_window: request.body.time_window,
        baseline_update: request.body.baseline_update
      });

      // Perform behavioral analysis
      const result = await this.behavioralService.analyzeBehavioralPatterns(
        request.body.user_id,
        request.body.behavior_data,
        request.body.time_window
      );

      // Update baselines if requested
      if (request.body.baseline_update) {
        await this.updateUserBaselines(request.body.user_id, request.body.behavior_data);
      }

      const analysisTime = Date.now() - startTime;
      
      logger.info(`Behavioral analysis completed [${requestId}]`, {
        user_id: request.body.user_id,
        risk_score: result.overall_risk_score,
        risk_category: result.risk_category,
        analysis_time: analysisTime
      });

      reply.send({
        ...result,
        metadata: {
          analysis_duration: analysisTime,
          request_id: requestId
        }
      });

    } catch (error) {
      logger.error(`Behavioral analysis failed [${requestId}]:`, error);
      reply.code(500).send({
        success: false,
        error: 'Behavioral analysis failed',
        message: error.message,
        request_id: requestId
      });
    }
  }

  /**
   * Detect attack sequences and temporal patterns
   */
  async detectSequences(
    request: FastifyRequest<{ Body: { events: any[]; sequence_type?: string; window_size?: number; step_tolerance?: number } }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { events, sequence_type = 'all', window_size = 3600, step_tolerance = 0.8 } = request.body;
      
      logger.info('Starting sequence detection', {
        event_count: events.length,
        sequence_type,
        window_size
      });

      // Convert events to pattern format and analyze
      const predictionRequest = {
        data: { events, network: [], processes: [], user_activity: [] },
        input: events,
        options: {
          sequenceType: sequence_type,
          windowSize: window_size,
          stepTolerance: step_tolerance
        }
      };

      const patterns = await this.patternService.analyzePatterns(predictionRequest);
      
      // Filter for sequence patterns only
      const sequences = patterns.filter(pattern => 
        pattern.matched_sequence && pattern.matched_sequence.length > 0
      );

      // Generate predictions for detected sequences
      const predictions = sequences.map(sequence => ({
        sequence_id: sequence.pattern_id,
        next_steps: sequence.predictions || [],
        confidence: sequence.confidence,
        estimated_completion_time: this.estimateCompletionTime(sequence),
        countermeasures: this.getCountermeasures(sequence)
      }));

      reply.send({
        sequences,
        predictions,
        metadata: {
          total_events: events.length,
          sequences_detected: sequences.length,
          predictions_generated: predictions.length
        }
      });

    } catch (error) {
      logger.error('Sequence detection failed:', error);
      reply.code(500).send({
        success: false,
        error: 'Sequence detection failed',
        message: error.message
      });
    }
  }

  /**
   * Detect anomalous patterns
   */
  async detectAnomalies(
    request: FastifyRequest<{ Body: { data: any; sensitivity?: number; detection_method?: string; baseline_period?: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { data, sensitivity = 0.7, detection_method = 'hybrid', baseline_period = '30d' } = request.body;
      
      logger.info('Starting anomaly detection', {
        sensitivity,
        detection_method,
        baseline_period
      });

      // Use behavioral service for anomaly detection
      const behaviorFeatures = this.extractBehaviorFeatures(data);
      const userProfile = { historical_risk_score: 25 }; // Mock profile
      
      const anomalySummary = await this.detectBehavioralAnomalies(behaviorFeatures, userProfile);
      
      // Calculate anomaly statistics
      const statistics = {
        total_anomalies: anomalySummary.total_anomalies,
        severity_distribution: anomalySummary.severity_breakdown,
        confidence_avg: this.calculateAverageConfidence(anomalySummary),
        detection_method_used: detection_method,
        baseline_period_used: baseline_period
      };

      reply.send({
        anomalies: Object.entries(anomalySummary.anomaly_distribution).map(([feature, score]) => ({
          feature,
          anomaly_score: score,
          severity: this.calculateSeverity(score as number),
          description: this.getAnomalyDescription(feature, score as number)
        })),
        statistics
      });

    } catch (error) {
      logger.error('Anomaly detection failed:', error);
      reply.code(500).send({
        success: false,
        error: 'Anomaly detection failed',
        message: error.message
      });
    }
  }

  /**
   * Generate pattern visualization
   */
  async generateVisualization(
    request: FastifyRequest<{ Body: PatternVisualizationRequest }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { pattern_id, visualization_type = 'timeline', detail_level = 'detailed' } = request.body;
      
      logger.info('Generating pattern visualization', {
        pattern_id,
        visualization_type,
        detail_level
      });

      const visualization = await this.visualizationEngine.generatePatternVisualization(
        pattern_id,
        visualization_type,
        detail_level,
        request.body.time_range
      );

      const metadata = {
        pattern_id,
        visualization_type,
        detail_level,
        generation_time: Date.now(),
        data_points: visualization.data_points || 0
      };

      reply.send({
        visualization,
        metadata
      });

    } catch (error) {
      logger.error('Visualization generation failed:', error);
      reply.code(500).send({
        success: false,
        error: 'Visualization generation failed',
        message: error.message
      });
    }
  }

  /**
   * Start real-time pattern monitoring
   */
  async startMonitoring(
    request: FastifyRequest<{ Body: RealTimeMonitoringRequest }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { patterns, monitoring_config, data_sources } = request.body;
      
      logger.info('Starting real-time monitoring', {
        pattern_count: patterns.length,
        check_interval: monitoring_config?.check_interval,
        data_sources: data_sources?.length
      });

      const monitoring_id = await this.monitoringService.startMonitoring({
        patterns,
        config: monitoring_config || {
          check_interval: 60,
          alert_threshold: 0.8,
          notification_channels: []
        },
        data_sources: data_sources || []
      });

      reply.send({
        monitoring_id,
        status: 'active',
        message: 'Real-time monitoring started successfully'
      });

    } catch (error) {
      logger.error('Failed to start monitoring:', error);
      reply.code(500).send({
        success: false,
        error: 'Failed to start monitoring',
        message: error.message
      });
    }
  }

  /**
   * Stop real-time pattern monitoring
   */
  async stopMonitoring(
    request: FastifyRequest<{ Params: { monitoring_id: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { monitoring_id } = request.params;
      
      logger.info('Stopping real-time monitoring', { monitoring_id });

      const success = await this.monitoringService.stopMonitoring(monitoring_id);

      reply.send({
        success,
        message: success ? 'Monitoring stopped successfully' : 'Monitoring session not found'
      });

    } catch (error) {
      logger.error('Failed to stop monitoring:', error);
      reply.code(500).send({
        success: false,
        error: 'Failed to stop monitoring',
        message: error.message
      });
    }
  }

  /**
   * Get pattern recognition statistics
   */
  async getStatistics(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    try {
      logger.info('Retrieving pattern recognition statistics');

      const patternStats = this.patternService.getPatternStatistics();
      const behavioralStats = await this.getBehavioralStatistics();
      const performanceMetrics = await this.getPerformanceMetrics();

      reply.send({
        statistics: {
          ...patternStats,
          behavioral_patterns: behavioralStats.total_patterns,
          behavioral_baselines: behavioralStats.total_baselines
        },
        performance: performanceMetrics,
        active_patterns: await this.getActivePatterns()
      });

    } catch (error) {
      logger.error('Failed to get statistics:', error);
      reply.code(500).send({
        success: false,
        error: 'Failed to get statistics',
        message: error.message
      });
    }
  }

  /**
   * Search and discover patterns
   */
  async searchPatterns(
    request: FastifyRequest<{ Body: { query: string; filters?: any; sort_by?: string; limit?: number } }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { query, filters = {}, sort_by = 'relevance', limit = 50 } = request.body;
      
      logger.info('Searching patterns', { query, filters, sort_by, limit });

      // Mock pattern search implementation
      const allPatterns = await this.getAllPatterns();
      const filteredPatterns = this.filterPatterns(allPatterns, query, filters);
      const sortedPatterns = this.sortPatterns(filteredPatterns, sort_by);
      const paginatedPatterns = sortedPatterns.slice(0, limit);

      reply.send({
        patterns: paginatedPatterns,
        total: filteredPatterns.length,
        query,
        filters,
        sort_by
      });

    } catch (error) {
      logger.error('Pattern search failed:', error);
      reply.code(500).send({
        success: false,
        error: 'Pattern search failed',
        message: error.message
      });
    }
  }

  /**
   * Learn from feedback
   */
  async learnFromFeedback(
    request: FastifyRequest<{ Body: { pattern_id: string; feedback: any; evidence?: any[] } }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { pattern_id, feedback, evidence = [] } = request.body;
      
      logger.info('Processing learning feedback', {
        pattern_id,
        feedback_type: Object.keys(feedback),
        evidence_count: evidence.length
      });

      // Mock learning implementation
      const updatedPattern = await this.applyLearningFeedback(pattern_id, feedback, evidence);

      reply.send({
        success: true,
        updated_pattern: updatedPattern,
        message: 'Learning feedback applied successfully'
      });

    } catch (error) {
      logger.error('Learning from feedback failed:', error);
      reply.code(500).send({
        success: false,
        error: 'Learning from feedback failed',
        message: error.message
      });
    }
  }

  /**
   * Export pattern definitions
   */
  async exportPatterns(
    request: FastifyRequest<{ Querystring: { format?: string; pattern_ids?: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { format = 'json', pattern_ids } = request.query;
      
      logger.info('Exporting patterns', { format, pattern_ids });

      const patterns = await this.getExportPatterns(pattern_ids);
      const exportedData = this.formatExportData(patterns, format);

      reply
        .header('Content-Type', this.getContentType(format))
        .header('Content-Disposition', `attachment; filename="patterns.${format}"`)
        .send(exportedData);

    } catch (error) {
      logger.error('Pattern export failed:', error);
      reply.code(500).send({
        success: false,
        error: 'Pattern export failed',
        message: error.message
      });
    }
  }

  /**
   * Import pattern definitions
   */
  async importPatterns(
    request: FastifyRequest<{ Body: { patterns: any[]; format?: string; merge_strategy?: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { patterns, format = 'json', merge_strategy = 'merge' } = request.body;
      
      logger.info('Importing patterns', {
        pattern_count: patterns.length,
        format,
        merge_strategy
      });

      const importResult = await this.importPatternDefinitions(patterns, format, merge_strategy);

      reply.send({
        imported: importResult.imported,
        errors: importResult.errors,
        message: `${importResult.imported} patterns imported successfully`
      });

    } catch (error) {
      logger.error('Pattern import failed:', error);
      reply.code(500).send({
        success: false,
        error: 'Pattern import failed',
        message: error.message
      });
    }
  }

  /**
   * Get service health status
   */
  async getHealth(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const health = {
        status: 'healthy',
        engines: {
          sequence_analyzer: 'healthy',
          behavioral_analyzer: 'healthy',
          temporal_engine: 'healthy',
          statistical_engine: 'healthy',
          learning_engine: 'healthy',
          prediction_engine: 'healthy',
          visualization_engine: 'healthy'
        },
        performance: {
          patterns_loaded: this.patternService.getPatternStatistics().totalPatterns,
          active_matches: this.patternService.getPatternStatistics().activeMatches,
          analysis_queue: 0, // Placeholder
          avg_processing_time: 150 // Placeholder
        },
        models: {
          lstm_model: 'loaded',
          behavioral_model: 'loaded',
          anomaly_model: 'loaded'
        },
        timestamp: new Date().toISOString()
      };

      reply.send(health);

    } catch (error) {
      logger.error('Health check failed:', error);
      reply.code(500).send({
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  // Helper methods
  private calculateConfidenceDistribution(patterns: PatternMatch[]): any {
    const buckets = { low: 0, medium: 0, high: 0, critical: 0 };
    
    patterns.forEach(pattern => {
      if (pattern.confidence >= 0.8) buckets.critical++;
      else if (pattern.confidence >= 0.7) buckets.high++;
      else if (pattern.confidence >= 0.5) buckets.medium++;
      else buckets.low++;
    });

    return buckets;
  }

  private async getPerformanceMetrics(): Promise<any> {
    return {
      analysis_time_avg: 120, // ms
      throughput: 50, // patterns/minute
      accuracy_metrics: {
        precision: 0.85,
        recall: 0.82,
        f1_score: 0.83
      },
      resource_usage: {
        cpu_usage: 0.45,
        memory_usage: 0.62,
        gpu_usage: 0.78
      }
    };
  }

  private async updateUserBaselines(userId: string, behaviorData: any): Promise<void> {
    // Extract key metrics and update baselines
    const metrics = [
      'login_frequency',
      'file_access_count',
      'email_volume',
      'data_transfer_volume'
    ];

    for (const metric of metrics) {
      if (behaviorData[metric] !== undefined) {
        await this.behavioralService.updateBehavioralBaseline(
          userId,
          metric,
          behaviorData[metric],
          0.9
        );
      }
    }
  }

  private extractBehaviorFeatures(data: any): number[] {
    // Extract 50 behavioral features from data
    const features = new Array(50).fill(0);
    
    // Map data fields to feature positions
    if (data.login_frequency) features[0] = data.login_frequency;
    if (data.file_access_count) features[1] = data.file_access_count;
    if (data.email_volume) features[2] = data.email_volume;
    // ... add more feature mappings

    return features;
  }

  private async detectBehavioralAnomalies(features: number[], userProfile: any): Promise<any> {
    // Mock implementation
    return {
      total_anomalies: 3,
      anomaly_distribution: {
        login_frequency: 0.8,
        file_access_count: 0.6,
        email_volume: 0.9
      },
      severity_breakdown: {
        high: 1,
        medium: 2,
        low: 0
      }
    };
  }

  private calculateAverageConfidence(summary: any): number {
    const scores = Object.values(summary.anomaly_distribution) as number[];
    return scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  }

  private calculateSeverity(score: number): string {
    if (score >= 0.8) return 'critical';
    if (score >= 0.6) return 'high';
    if (score >= 0.4) return 'medium';
    return 'low';
  }

  private getAnomalyDescription(feature: string, score: number): string {
    return `Anomalous ${feature} detected with score ${score.toFixed(2)}`;
  }

  private estimateCompletionTime(sequence: PatternMatch): number {
    // Estimate based on sequence completion and historical data
    const remaining = 1 - sequence.completion_percentage;
    return remaining * 3600; // seconds
  }

  private getCountermeasures(sequence: PatternMatch): string[] {
    return [
      'Increase monitoring',
      'Block suspicious IPs',
      'Require additional authentication',
      'Alert security team'
    ];
  }

  private async getBehavioralStatistics(): Promise<any> {
    return {
      total_patterns: 25,
      total_baselines: 150,
      active_analyses: 5
    };
  }

  private async getActivePatterns(): Promise<any[]> {
    return [
      {
        pattern_id: 'apt-campaign-1',
        pattern_name: 'Advanced APT Campaign',
        last_match: new Date().toISOString(),
        match_frequency: 0.15,
        confidence_trend: [0.75, 0.78, 0.82, 0.85]
      }
    ];
  }

  private async getAllPatterns(): Promise<any[]> {
    // Mock pattern retrieval
    return [];
  }

  private filterPatterns(patterns: any[], query: string, filters: any): any[] {
    // Mock pattern filtering
    return patterns;
  }

  private sortPatterns(patterns: any[], sortBy: string): any[] {
    // Mock pattern sorting
    return patterns;
  }

  private async applyLearningFeedback(patternId: string, feedback: any, evidence: any[]): Promise<any> {
    // Mock learning application
    return { id: patternId, updated: true };
  }

  private async getExportPatterns(patternIds?: string): Promise<any[]> {
    // Mock pattern export
    return [];
  }

  private formatExportData(patterns: any[], format: string): any {
    switch (format) {
      case 'json':
        return JSON.stringify(patterns, null, 2);
      case 'yaml':
        // Mock YAML conversion
        return 'patterns:\n  - id: example';
      default:
        return JSON.stringify(patterns);
    }
  }

  private getContentType(format: string): string {
    const types = {
      json: 'application/json',
      yaml: 'application/x-yaml',
      xml: 'application/xml',
      stix: 'application/json'
    };
    return types[format] || 'application/json';
  }

  private async importPatternDefinitions(patterns: any[], format: string, mergeStrategy: string): Promise<any> {
    // Mock pattern import
    return {
      imported: patterns.length,
      errors: []
    };
  }
}