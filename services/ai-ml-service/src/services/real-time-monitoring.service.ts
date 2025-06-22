/**
 * Real-Time Monitoring Service for Task 3.3
 * Provides real-time pattern monitoring, alerting, and automated response capabilities
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { AdvancedPatternRecognitionService } from './advanced-pattern-recognition.service';
import { BehavioralPatternDetectorService } from './behavioral-pattern-detector.service';
import { PatternMatch, BehavioralAnalysisResult } from '../types';

export interface MonitoringSession {
  id: string;
  patterns: string[];
  config: MonitoringConfig;
  data_sources: string[];
  status: 'active' | 'paused' | 'stopped' | 'error';
  start_time: Date;
  last_check: Date;
  alerts_generated: number;
  matches_detected: number;
  statistics: MonitoringStatistics;
}

export interface MonitoringConfig {
  check_interval: number; // seconds
  alert_threshold: number; // confidence threshold
  notification_channels: string[];
  auto_response_enabled: boolean;
  escalation_rules: EscalationRule[];
  data_retention: DataRetentionConfig;
  performance_limits: PerformanceLimits;
}

export interface EscalationRule {
  condition: EscalationCondition;
  delay: number; // seconds
  actions: EscalationAction[];
  max_escalations: number;
}

export interface EscalationCondition {
  type: 'confidence_threshold' | 'pattern_count' | 'time_based' | 'severity_level';
  operator: 'greater_than' | 'less_than' | 'equals' | 'between';
  value: number | string;
  time_window?: number; // seconds
}

export interface EscalationAction {
  action_type: 'notification' | 'auto_block' | 'increase_monitoring' | 'trigger_investigation' | 'custom_script';
  parameters: Record<string, any>;
  priority: 'low' | 'medium' | 'high' | 'critical';
  target: string;
}

export interface DataRetentionConfig {
  max_storage_size: number; // MB
  retention_period: number; // days
  compression_enabled: boolean;
  auto_cleanup: boolean;
}

export interface PerformanceLimits {
  max_concurrent_analyses: number;
  max_memory_usage: number; // MB
  max_cpu_usage: number; // percentage
  timeout_duration: number; // seconds
}

export interface MonitoringStatistics {
  total_data_points: number;
  analysis_time_avg: number;
  memory_usage_avg: number;
  cpu_usage_avg: number;
  error_count: number;
  accuracy_metrics: AccuracyMetrics;
}

export interface AccuracyMetrics {
  true_positives: number;
  false_positives: number;
  true_negatives: number;
  false_negatives: number;
  precision: number;
  recall: number;
  f1_score: number;
}

export interface RealTimeAlert {
  id: string;
  monitoring_session_id: string;
  timestamp: Date;
  pattern_id: string;
  pattern_name: string;
  alert_type: 'pattern_match' | 'anomaly_detected' | 'threshold_exceeded' | 'system_alert';
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  details: AlertDetails;
  status: 'new' | 'acknowledged' | 'investigating' | 'resolved' | 'false_positive';
  escalated: boolean;
  response_actions: ResponseAction[];
}

export interface AlertDetails {
  matched_pattern: PatternMatch;
  triggering_data: any;
  context_information: any;
  related_alerts: string[];
  evidence_chain: Evidence[];
  recommendations: string[];
}

export interface Evidence {
  source: string;
  timestamp: Date;
  type: 'data_point' | 'correlation' | 'historical_pattern' | 'external_intelligence';
  content: any;
  confidence: number;
  relevance: number;
}

export interface ResponseAction {
  id: string;
  action_type: string;
  timestamp: Date;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  result: any;
  execution_time: number;
}

export interface DataSource {
  id: string;
  name: string;
  type: 'api' | 'file' | 'database' | 'stream' | 'webhook';
  connection_config: ConnectionConfig;
  data_format: 'json' | 'csv' | 'xml' | 'binary' | 'log';
  polling_interval: number; // seconds
  transformation_rules: TransformationRule[];
  status: 'connected' | 'disconnected' | 'error' | 'rate_limited';
  last_update: Date;
  metrics: DataSourceMetrics;
}

export interface ConnectionConfig {
  endpoint?: string;
  credentials?: any;
  headers?: Record<string, string>;
  timeout?: number;
  retry_config?: RetryConfig;
}

export interface RetryConfig {
  max_retries: number;
  backoff_strategy: 'linear' | 'exponential' | 'fixed';
  base_delay: number;
  max_delay: number;
}

export interface TransformationRule {
  field: string;
  operation: 'extract' | 'transform' | 'filter' | 'aggregate' | 'normalize';
  parameters: Record<string, any>;
  order: number;
}

export interface DataSourceMetrics {
  total_records: number;
  records_per_minute: number;
  error_rate: number;
  latency_avg: number;
  last_error?: string;
}

/**
 * Real-Time Monitoring Service
 */
export class RealTimeMonitoringService extends EventEmitter {
  private isInitialized = false;
  private activeSessions: Map<string, MonitoringSession> = new Map();
  private dataSourceConnections: Map<string, DataSource> = new Map();
  private patternService: AdvancedPatternRecognitionService;
  private behavioralService: BehavioralPatternDetectorService;
  private alertQueue: RealTimeAlert[] = [];
  private monitoringIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor(
    patternService: AdvancedPatternRecognitionService,
    behavioralService: BehavioralPatternDetectorService
  ) {
    super();
    this.patternService = patternService;
    this.behavioralService = behavioralService;
  }

  /**
   * Initialize the real-time monitoring service
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing Real-Time Monitoring Service...');

      // Initialize data source connections
      await this.initializeDataSources();
      
      // Start monitoring engine
      await this.startMonitoringEngine();
      
      // Initialize alert processing
      await this.initializeAlertProcessing();

      this.isInitialized = true;
      logger.info('Real-Time Monitoring Service initialized successfully');

      this.emit('service_initialized', {
        timestamp: new Date(),
        data_sources: this.dataSourceConnections.size,
        active_sessions: this.activeSessions.size
      });

    } catch (error) {
      logger.error('Failed to initialize Real-Time Monitoring Service:', error);
      throw error;
    }
  }

  /**
   * Start monitoring for specific patterns
   */
  async startMonitoring(request: {
    patterns: string[];
    config: MonitoringConfig;
    data_sources: string[];
  }): Promise<string> {
    if (!this.isInitialized) {
      throw new Error('Real-Time Monitoring Service not initialized');
    }

    try {
      const sessionId = this.generateSessionId();
      
      logger.info(`Starting monitoring session ${sessionId}`, {
        patterns: request.patterns,
        data_sources: request.data_sources,
        check_interval: request.config.check_interval
      });

      const session: MonitoringSession = {
        id: sessionId,
        patterns: request.patterns,
        config: request.config,
        data_sources: request.data_sources,
        status: 'active',
        start_time: new Date(),
        last_check: new Date(),
        alerts_generated: 0,
        matches_detected: 0,
        statistics: {
          total_data_points: 0,
          analysis_time_avg: 0,
          memory_usage_avg: 0,
          cpu_usage_avg: 0,
          error_count: 0,
          accuracy_metrics: {
            true_positives: 0,
            false_positives: 0,
            true_negatives: 0,
            false_negatives: 0,
            precision: 0,
            recall: 0,
            f1_score: 0
          }
        }
      };

      this.activeSessions.set(sessionId, session);

      // Start periodic monitoring
      const interval = setInterval(() => {
        this.performPeriodicCheck(sessionId);
      }, session.config.check_interval * 1000);

      this.monitoringIntervals.set(sessionId, interval);

      this.emit('monitoring_started', {
        session_id: sessionId,
        patterns: request.patterns,
        timestamp: new Date()
      });

      return sessionId;

    } catch (error) {
      logger.error('Failed to start monitoring:', error);
      throw error;
    }
  }

  /**
   * Stop monitoring session
   */
  async stopMonitoring(sessionId: string): Promise<boolean> {
    try {
      const session = this.activeSessions.get(sessionId);
      if (!session) {
        logger.warn(`Monitoring session not found: ${sessionId}`);
        return false;
      }

      logger.info(`Stopping monitoring session ${sessionId}`);

      // Clear monitoring interval
      const interval = this.monitoringIntervals.get(sessionId);
      if (interval) {
        clearInterval(interval);
        this.monitoringIntervals.delete(sessionId);
      }

      // Update session status
      session.status = 'stopped';
      this.activeSessions.delete(sessionId);

      this.emit('monitoring_stopped', {
        session_id: sessionId,
        duration: Date.now() - session.start_time.getTime(),
        alerts_generated: session.alerts_generated,
        matches_detected: session.matches_detected,
        timestamp: new Date()
      });

      return true;

    } catch (error) {
      logger.error(`Failed to stop monitoring session ${sessionId}:`, error);
      return false;
    }
  }

  /**
   * Get monitoring session status
   */
  getMonitoringStatus(sessionId: string): MonitoringSession | null {
    return this.activeSessions.get(sessionId) || null;
  }

  /**
   * Get all active monitoring sessions
   */
  getActiveMonitoringSessions(): MonitoringSession[] {
    return Array.from(this.activeSessions.values());
  }

  /**
   * Get recent alerts
   */
  getRecentAlerts(limit: number = 50, severity?: string): RealTimeAlert[] {
    let alerts = this.alertQueue
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);

    if (severity) {
      alerts = alerts.filter(alert => alert.severity === severity);
    }

    return alerts;
  }

  /**
   * Acknowledge alert
   */
  async acknowledgeAlert(alertId: string, userId: string): Promise<boolean> {
    try {
      const alert = this.alertQueue.find(a => a.id === alertId);
      if (!alert) {
        return false;
      }

      alert.status = 'acknowledged';
      
      logger.info(`Alert acknowledged: ${alertId} by user: ${userId}`);
      
      this.emit('alert_acknowledged', {
        alert_id: alertId,
        user_id: userId,
        timestamp: new Date()
      });

      return true;

    } catch (error) {
      logger.error(`Failed to acknowledge alert ${alertId}:`, error);
      return false;
    }
  }

  /**
   * Configure data source
   */
  async configureDataSource(dataSource: DataSource): Promise<boolean> {
    try {
      logger.info(`Configuring data source: ${dataSource.name}`);

      // Test connection
      const connectionTest = await this.testDataSourceConnection(dataSource);
      if (!connectionTest.success) {
        throw new Error(`Connection test failed: ${connectionTest.error}`);
      }

      dataSource.status = 'connected';
      dataSource.last_update = new Date();
      
      this.dataSourceConnections.set(dataSource.id, dataSource);

      this.emit('data_source_configured', {
        data_source_id: dataSource.id,
        name: dataSource.name,
        type: dataSource.type,
        timestamp: new Date()
      });

      return true;

    } catch (error) {
      logger.error(`Failed to configure data source ${dataSource.name}:`, error);
      return false;
    }
  }

  /**
   * Get monitoring statistics
   */
  getMonitoringStatistics(): any {
    const activeSessions = Array.from(this.activeSessions.values());
    const totalAlerts = this.alertQueue.length;
    const criticalAlerts = this.alertQueue.filter(a => a.severity === 'critical').length;

    return {
      active_sessions: activeSessions.length,
      total_patterns_monitored: activeSessions.reduce((sum, s) => sum + s.patterns.length, 0),
      total_alerts: totalAlerts,
      critical_alerts: criticalAlerts,
      data_sources_connected: Array.from(this.dataSourceConnections.values())
        .filter(ds => ds.status === 'connected').length,
      average_detection_time: this.calculateAverageDetectionTime(),
      system_performance: this.getSystemPerformanceMetrics()
    };
  }

  // Private methods

  /**
   * Initialize data sources
   */
  private async initializeDataSources(): Promise<void> {
    // Initialize default data sources
    const defaultSources = this.getDefaultDataSources();
    
    for (const source of defaultSources) {
      await this.configureDataSource(source);
    }

    logger.info(`Initialized ${this.dataSourceConnections.size} data sources`);
  }

  /**
   * Start monitoring engine
   */
  private async startMonitoringEngine(): Promise<void> {
    // Start background engine for monitoring coordination
    setInterval(() => {
      this.performSystemHealthCheck();
    }, 30000); // Every 30 seconds

    setInterval(() => {
      this.processAlertQueue();
    }, 5000); // Every 5 seconds

    logger.info('Monitoring engine started');
  }

  /**
   * Initialize alert processing
   */
  private async initializeAlertProcessing(): Promise<void> {
    // Initialize alert processing pipeline
    this.on('pattern_match_detected', this.handlePatternMatch.bind(this));
    this.on('anomaly_detected', this.handleAnomalyDetection.bind(this));
    this.on('threshold_exceeded', this.handleThresholdExceeded.bind(this));

    logger.info('Alert processing initialized');
  }

  /**
   * Perform periodic pattern check for a monitoring session
   */
  private async performPeriodicCheck(sessionId: string): Promise<void> {
    try {
      const session = this.activeSessions.get(sessionId);
      if (!session || session.status !== 'active') {
        return;
      }

      const startTime = Date.now();

      // Collect data from configured sources
      const data = await this.collectDataFromSources(session.data_sources);
      
      // Analyze patterns
      const patterns = await this.analyzePatterns(data, session.patterns);
      
      // Check for matches above threshold
      const significantMatches = patterns.filter(
        pattern => pattern.confidence >= session.config.alert_threshold
      );

      // Generate alerts for significant matches
      for (const match of significantMatches) {
        await this.generateAlert(sessionId, match, data);
      }

      // Update session statistics
      session.last_check = new Date();
      session.matches_detected += significantMatches.length;
      session.statistics.total_data_points += data.length || 0;
      session.statistics.analysis_time_avg = 
        (session.statistics.analysis_time_avg + (Date.now() - startTime)) / 2;

    } catch (error) {
      logger.error(`Periodic check failed for session ${sessionId}:`, error);
      const session = this.activeSessions.get(sessionId);
      if (session) {
        session.statistics.error_count++;
      }
    }
  }

  /**
   * Collect data from configured sources
   */
  private async collectDataFromSources(sourceIds: string[]): Promise<any[]> {
    const data: any[] = [];

    for (const sourceId of sourceIds) {
      const source = this.dataSourceConnections.get(sourceId);
      if (!source || source.status !== 'connected') {
        continue;
      }

      try {
        const sourceData = await this.fetchDataFromSource(source);
        data.push(...sourceData);
      } catch (error) {
        logger.error(`Failed to collect data from source ${source.name}:`, error);
        source.status = 'error';
      }
    }

    return data;
  }

  /**
   * Analyze patterns using pattern recognition service
   */
  private async analyzePatterns(data: any[], patternIds: string[]): Promise<PatternMatch[]> {
    try {
      const predictionRequest = {
        data: { events: data, network: [], processes: [], user_activity: [] },
        input: data,
        options: {
          patternIds,
          threshold: 0.5
        }
      };

      return await this.patternService.analyzePatterns(predictionRequest);

    } catch (error) {
      logger.error('Pattern analysis failed during monitoring:', error);
      return [];
    }
  }

  /**
   * Generate alert for pattern match
   */
  private async generateAlert(
    sessionId: string, 
    match: PatternMatch, 
    triggeringData: any[]
  ): Promise<void> {
    try {
      const alertId = this.generateAlertId();
      
      const alert: RealTimeAlert = {
        id: alertId,
        monitoring_session_id: sessionId,
        timestamp: new Date(),
        pattern_id: match.pattern_id,
        pattern_name: match.pattern_name,
        alert_type: 'pattern_match',
        severity: this.calculateAlertSeverity(match.confidence),
        confidence: match.confidence,
        details: {
          matched_pattern: match,
          triggering_data: triggeringData,
          context_information: {},
          related_alerts: [],
          evidence_chain: match.evidence_chain || [],
          recommendations: this.generateRecommendations(match)
        },
        status: 'new',
        escalated: false,
        response_actions: []
      };

      this.alertQueue.push(alert);

      // Update session alert count
      const session = this.activeSessions.get(sessionId);
      if (session) {
        session.alerts_generated++;
      }

      logger.info(`Alert generated: ${alertId} for pattern: ${match.pattern_name}`);

      this.emit('alert_generated', {
        alert_id: alertId,
        pattern_id: match.pattern_id,
        severity: alert.severity,
        confidence: match.confidence,
        timestamp: new Date()
      });

      // Check escalation rules
      await this.checkEscalationRules(alert, session);

    } catch (error) {
      logger.error('Failed to generate alert:', error);
    }
  }

  /**
   * Handle pattern match detection
   */
  private async handlePatternMatch(event: any): Promise<void> {
    logger.info('Pattern match detected', event);
    // Additional processing for pattern matches
  }

  /**
   * Handle anomaly detection
   */
  private async handleAnomalyDetection(event: any): Promise<void> {
    logger.info('Anomaly detected', event);
    // Additional processing for anomalies
  }

  /**
   * Handle threshold exceeded
   */
  private async handleThresholdExceeded(event: any): Promise<void> {
    logger.info('Threshold exceeded', event);
    // Additional processing for threshold violations
  }

  /**
   * Process alert queue
   */
  private async processAlertQueue(): Promise<void> {
    const unprocessedAlerts = this.alertQueue.filter(alert => alert.status === 'new');
    
    for (const alert of unprocessedAlerts) {
      try {
        await this.processAlert(alert);
      } catch (error) {
        logger.error(`Failed to process alert ${alert.id}:`, error);
      }
    }
  }

  /**
   * Process individual alert
   */
  private async processAlert(alert: RealTimeAlert): Promise<void> {
    // Send notifications
    await this.sendNotifications(alert);
    
    // Execute automated responses if enabled
    const session = this.activeSessions.get(alert.monitoring_session_id);
    if (session?.config.auto_response_enabled) {
      await this.executeAutomatedResponse(alert);
    }
  }

  /**
   * Send notifications for alert
   */
  private async sendNotifications(alert: RealTimeAlert): Promise<void> {
    const session = this.activeSessions.get(alert.monitoring_session_id);
    if (!session) return;

    for (const channel of session.config.notification_channels) {
      try {
        await this.sendNotificationToChannel(channel, alert);
      } catch (error) {
        logger.error(`Failed to send notification to ${channel}:`, error);
      }
    }
  }

  /**
   * Send notification to specific channel
   */
  private async sendNotificationToChannel(channel: string, alert: RealTimeAlert): Promise<void> {
    // Mock notification implementation
    logger.info(`Sending notification to ${channel}:`, {
      alert_id: alert.id,
      pattern: alert.pattern_name,
      severity: alert.severity,
      confidence: alert.confidence
    });
  }

  /**
   * Execute automated response
   */
  private async executeAutomatedResponse(alert: RealTimeAlert): Promise<void> {
    // Mock automated response implementation
    const action: ResponseAction = {
      id: this.generateActionId(),
      action_type: 'auto_block',
      timestamp: new Date(),
      status: 'pending',
      result: null,
      execution_time: 0
    };

    alert.response_actions.push(action);

    logger.info(`Executing automated response for alert ${alert.id}`);
  }

  /**
   * Check escalation rules
   */
  private async checkEscalationRules(
    alert: RealTimeAlert, 
    session: MonitoringSession | undefined
  ): Promise<void> {
    if (!session) return;

    for (const rule of session.config.escalation_rules) {
      if (this.evaluateEscalationCondition(rule.condition, alert, session)) {
        setTimeout(() => {
          this.executeEscalationActions(alert, rule.actions);
        }, rule.delay * 1000);
      }
    }
  }

  /**
   * Evaluate escalation condition
   */
  private evaluateEscalationCondition(
    condition: EscalationCondition, 
    alert: RealTimeAlert, 
    session: MonitoringSession
  ): boolean {
    switch (condition.type) {
      case 'confidence_threshold':
        return alert.confidence > (condition.value as number);
      case 'severity_level':
        return alert.severity === condition.value;
      default:
        return false;
    }
  }

  /**
   * Execute escalation actions
   */
  private async executeEscalationActions(
    alert: RealTimeAlert, 
    actions: EscalationAction[]
  ): Promise<void> {
    for (const action of actions) {
      try {
        await this.executeEscalationAction(alert, action);
      } catch (error) {
        logger.error(`Failed to execute escalation action:`, error);
      }
    }
  }

  /**
   * Execute single escalation action
   */
  private async executeEscalationAction(
    alert: RealTimeAlert, 
    action: EscalationAction
  ): Promise<void> {
    logger.info(`Executing escalation action: ${action.action_type} for alert: ${alert.id}`);
    
    alert.escalated = true;
    
    // Mock escalation action execution
    switch (action.action_type) {
      case 'notification':
        await this.sendEscalationNotification(alert, action);
        break;
      case 'auto_block':
        await this.executeAutoBlock(alert, action);
        break;
      case 'increase_monitoring':
        await this.increaseMonitoring(alert, action);
        break;
      default:
        logger.warn(`Unknown escalation action: ${action.action_type}`);
    }
  }

  /**
   * Perform system health check
   */
  private async performSystemHealthCheck(): Promise<void> {
    // Check system resources
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    // Check data source connections
    for (const [id, source] of this.dataSourceConnections) {
      if (source.status === 'connected') {
        try {
          await this.testDataSourceConnection(source);
        } catch (error) {
          logger.warn(`Data source ${source.name} connection lost`);
          source.status = 'disconnected';
        }
      }
    }

    // Emit health status
    this.emit('health_check', {
      timestamp: new Date(),
      memory_usage: memoryUsage,
      cpu_usage: cpuUsage,
      active_sessions: this.activeSessions.size,
      connected_sources: Array.from(this.dataSourceConnections.values())
        .filter(s => s.status === 'connected').length
    });
  }

  // Helper methods
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateActionId(): string {
    return `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private calculateAlertSeverity(confidence: number): 'low' | 'medium' | 'high' | 'critical' {
    if (confidence >= 0.9) return 'critical';
    if (confidence >= 0.8) return 'high';
    if (confidence >= 0.6) return 'medium';
    return 'low';
  }

  private generateRecommendations(match: PatternMatch): string[] {
    return [
      'Investigate the source of the detected pattern',
      'Review related system logs',
      'Consider implementing additional security measures',
      'Monitor for related suspicious activities'
    ];
  }

  private calculateAverageDetectionTime(): number {
    // Mock calculation
    return 2.5; // seconds
  }

  private getSystemPerformanceMetrics(): any {
    return {
      cpu_usage: 45, // percentage
      memory_usage: 68, // percentage
      network_io: 1.2, // MB/s
      disk_io: 0.8 // MB/s
    };
  }

  private getDefaultDataSources(): DataSource[] {
    return [
      {
        id: 'network_logs',
        name: 'Network Logs',
        type: 'api',
        connection_config: {
          endpoint: 'http://localhost:8080/api/logs',
          timeout: 30000
        },
        data_format: 'json',
        polling_interval: 60,
        transformation_rules: [],
        status: 'disconnected',
        last_update: new Date(),
        metrics: {
          total_records: 0,
          records_per_minute: 0,
          error_rate: 0,
          latency_avg: 0
        }
      }
    ];
  }

  private async testDataSourceConnection(source: DataSource): Promise<{ success: boolean; error?: string }> {
    try {
      // Mock connection test
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  private async fetchDataFromSource(source: DataSource): Promise<any[]> {
    // Mock data fetching
    return [];
  }

  private async sendEscalationNotification(alert: RealTimeAlert, action: EscalationAction): Promise<void> {
    logger.info(`Sending escalation notification for alert ${alert.id}`);
  }

  private async executeAutoBlock(alert: RealTimeAlert, action: EscalationAction): Promise<void> {
    logger.info(`Executing auto-block for alert ${alert.id}`);
  }

  private async increaseMonitoring(alert: RealTimeAlert, action: EscalationAction): Promise<void> {
    logger.info(`Increasing monitoring for alert ${alert.id}`);
  }
}

export { RealTimeMonitoringService };