// import * as brain from 'brain.js'; // Temporarily disabled for testing
import { KNN } from 'ml-knn';
import { logger, mlLogger } from '../utils/logger';
import {
  ModelType,
  ThreatPattern,
  PatternIndicator,
  PredictionRequest,
  PredictionResponse,
  ThreatIntelligence,
  Evidence,
} from '../types';
import { config } from '../config';

export class PatternRecognizerService {
  private lstm: brain.recurrent.LSTM | null = null;
  private knn: KNN | null = null;
  private patternDatabase: Map<string, StoredPattern> = new Map();
  private sequenceAnalyzer: SequenceAnalyzer;
  private anomalyDetector: AnomalyDetector;

  constructor() {
    this.sequenceAnalyzer = new SequenceAnalyzer();
    this.anomalyDetector = new AnomalyDetector();
    this.initializePatternDatabase();
  }

  /**
   * Initialize pattern recognition models
   */
  async initialize(): Promise<void> {
    try {
      const startTime = Date.now();
      
      // Initialize LSTM for sequence pattern recognition
      this.lstm = new brain.recurrent.LSTM({
        hiddenLayers: [20, 20],
        activation: 'sigmoid',
        learningRate: 0.01,
      });

      // Train with initial patterns
      await this.trainInitialPatterns();

      // Initialize KNN for similarity matching
      this.knn = new KNN(this.getTrainingData(), this.getTrainingLabels(), {
        k: 5,
        distance: this.customDistanceFunction,
      });

      mlLogger.modelLoaded(ModelType.PATTERN_RECOGNIZER, '1.0.0', Date.now() - startTime);
      logger.info('Pattern recognizer service initialized');
    } catch (error) {
      logger.error('Failed to initialize pattern recognizer:', error);
      throw error;
    }
  }

  /**
   * Initialize pattern database
   */
  private initializePatternDatabase(): void {
    // Attack pattern: SQL Injection attempts
    this.patternDatabase.set('sql-injection-pattern', {
      id: 'sql-injection-pattern',
      name: 'SQL Injection Attack Pattern',
      category: 'Injection',
      indicators: [
        { type: 'keyword', value: "' OR '1'='1", weight: 0.9 },
        { type: 'keyword', value: 'UNION SELECT', weight: 0.85 },
        { type: 'keyword', value: 'DROP TABLE', weight: 0.9 },
        { type: 'regex', value: '/\\bOR\\s+\\d+\\s*=\\s*\\d+/i', weight: 0.8 },
        { type: 'behavior', value: 'multiple-failed-queries', weight: 0.7 },
      ],
      confidence: 0,
      frequency: 0,
      lastSeen: new Date(),
      attackSequence: ['input-validation-bypass', 'sql-query-manipulation', 'data-extraction'],
    });

    // Attack pattern: Brute force authentication
    this.patternDatabase.set('brute-force-pattern', {
      id: 'brute-force-pattern',
      name: 'Brute Force Authentication Pattern',
      category: 'Authentication',
      indicators: [
        { type: 'behavior', value: 'rapid-login-attempts', weight: 0.9 },
        { type: 'metric', value: 'failed-auth-count>10', weight: 0.85 },
        { type: 'timing', value: 'requests-per-minute>30', weight: 0.8 },
        { type: 'pattern', value: 'sequential-username-attempts', weight: 0.75 },
      ],
      confidence: 0,
      frequency: 0,
      lastSeen: new Date(),
      attackSequence: ['reconnaissance', 'credential-testing', 'account-takeover'],
    });

    // Attack pattern: Data exfiltration
    this.patternDatabase.set('data-exfiltration-pattern', {
      id: 'data-exfiltration-pattern',
      name: 'Data Exfiltration Pattern',
      category: 'Data Theft',
      indicators: [
        { type: 'behavior', value: 'large-data-transfer', weight: 0.8 },
        { type: 'timing', value: 'off-hours-activity', weight: 0.7 },
        { type: 'destination', value: 'unknown-external-ip', weight: 0.85 },
        { type: 'volume', value: 'unusual-data-volume', weight: 0.8 },
      ],
      confidence: 0,
      frequency: 0,
      lastSeen: new Date(),
      attackSequence: ['access-gained', 'data-collection', 'data-transfer', 'cleanup'],
    });

    // Attack pattern: Privilege escalation
    this.patternDatabase.set('privilege-escalation-pattern', {
      id: 'privilege-escalation-pattern',
      name: 'Privilege Escalation Pattern',
      category: 'Access Control',
      indicators: [
        { type: 'behavior', value: 'role-change-attempt', weight: 0.9 },
        { type: 'api', value: 'admin-endpoint-access', weight: 0.85 },
        { type: 'token', value: 'jwt-manipulation', weight: 0.8 },
        { type: 'system', value: 'config-file-access', weight: 0.75 },
      ],
      confidence: 0,
      frequency: 0,
      lastSeen: new Date(),
      attackSequence: ['initial-access', 'privilege-discovery', 'exploitation', 'persistence'],
    });

    // Attack pattern: XSS attempts
    this.patternDatabase.set('xss-pattern', {
      id: 'xss-pattern',
      name: 'Cross-Site Scripting Pattern',
      category: 'Injection',
      indicators: [
        { type: 'keyword', value: '<script>', weight: 0.9 },
        { type: 'keyword', value: 'javascript:', weight: 0.85 },
        { type: 'keyword', value: 'onerror=', weight: 0.8 },
        { type: 'regex', value: '/<.*on\\w+\\s*=/i', weight: 0.8 },
        { type: 'encoding', value: 'html-entity-encoded', weight: 0.7 },
      ],
      confidence: 0,
      frequency: 0,
      lastSeen: new Date(),
      attackSequence: ['payload-injection', 'script-execution', 'data-theft'],
    });

    // Add more patterns...
  }

  /**
   * Train initial patterns
   */
  private async trainInitialPatterns(): Promise<void> {
    if (!this.lstm) return;

    const trainingData = [
      { input: "admin' OR '1'='1", output: 'sql-injection' },
      { input: 'SELECT * FROM users WHERE id=1 UNION SELECT password', output: 'sql-injection' },
      { input: 'rapid login attempts from same IP', output: 'brute-force' },
      { input: 'multiple failed authentication attempts', output: 'brute-force' },
      { input: '<script>alert("XSS")</script>', output: 'xss' },
      { input: 'javascript:void(0)', output: 'xss' },
      { input: 'large data transfer to external IP', output: 'data-exfiltration' },
      { input: 'unusual database query volume', output: 'data-exfiltration' },
      { input: 'attempting to access admin functions', output: 'privilege-escalation' },
      { input: 'JWT token manipulation detected', output: 'privilege-escalation' },
    ];

    this.lstm.train(trainingData, { iterations: 100, log: false });
  }

  /**
   * Get training data for KNN
   */
  private getTrainingData(): number[][] {
    // Convert patterns to feature vectors
    const data: number[][] = [];
    
    this.patternDatabase.forEach(pattern => {
      const features = this.patternToFeatures(pattern);
      data.push(features);
    });

    return data;
  }

  /**
   * Get training labels for KNN
   */
  private getTrainingLabels(): number[] {
    return Array.from(this.patternDatabase.keys()).map((_, index) => index);
  }

  /**
   * Custom distance function for KNN
   */
  private customDistanceFunction(a: number[], b: number[]): number {
    // Weighted euclidean distance
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      const weight = i < 5 ? 2 : 1; // Higher weight for first features
      sum += weight * Math.pow(a[i]! - b[i]!, 2);
    }
    return Math.sqrt(sum);
  }

  /**
   * Recognize patterns in input
   */
  async recognizePatterns(request: PredictionRequest): Promise<PredictionResponse> {
    const startTime = Date.now();

    try {
      if (!this.lstm || !this.knn) {
        throw new Error('Models not initialized');
      }

      const input = this.extractInput(request.input);
      const detectedPatterns: ThreatPattern[] = [];

      // LSTM sequence analysis
      const sequencePatterns = await this.analyzeSequences(input);
      detectedPatterns.push(...sequencePatterns);

      // KNN similarity matching
      const similarPatterns = this.findSimilarPatterns(input);
      detectedPatterns.push(...similarPatterns);

      // Anomaly detection
      const anomalies = this.anomalyDetector.detect(input);
      if (anomalies.length > 0) {
        detectedPatterns.push(...this.anomaliesToPatterns(anomalies));
      }

      // Behavioral analysis
      const behavioralPatterns = this.analyzeBehavior(input);
      detectedPatterns.push(...behavioralPatterns);

      // Deduplicate and rank patterns
      const rankedPatterns = this.rankPatterns(detectedPatterns);

      // Log significant patterns
      rankedPatterns.forEach(pattern => {
        if (pattern.confidence > 0.7) {
          mlLogger.patternDetected(pattern.name, pattern.confidence, pattern.indicators.length);
        }
      });

      const processingTime = Date.now() - startTime;
      const avgConfidence = this.calculateAverageConfidence(rankedPatterns);
      
      mlLogger.predictionMade(ModelType.PATTERN_RECOGNIZER, avgConfidence, processingTime);

      return {
        success: true,
        modelType: ModelType.PATTERN_RECOGNIZER,
        predictions: rankedPatterns.map(pattern => ({
          label: pattern.name,
          confidence: pattern.confidence,
          explanation: this.generatePatternExplanation(pattern),
          evidence: this.patternToEvidence(pattern),
          relatedThreats: this.getRelatedThreats(pattern),
        })),
        metadata: {
          modelVersion: '1.0.0',
          processingTime,
          dataQuality: this.assessDataQuality(input),
          confidenceRange: [
            Math.min(...rankedPatterns.map(p => p.confidence)),
            Math.max(...rankedPatterns.map(p => p.confidence)),
          ],
        },
        timestamp: new Date(),
      };

    } catch (error: any) {
      mlLogger.predictionError(ModelType.PATTERN_RECOGNIZER, error.message, request.input);
      throw error;
    }
  }

  /**
   * Extract input data
   */
  private extractInput(input: any): PatternInput {
    if (typeof input === 'string') {
      return { text: input, events: [], metrics: {} };
    }

    return {
      text: input.text || input.description || JSON.stringify(input),
      events: input.events || [],
      metrics: input.metrics || {},
      behaviors: input.behaviors || [],
      timestamps: input.timestamps || [],
    };
  }

  /**
   * Analyze sequences using LSTM
   */
  private async analyzeSequences(input: PatternInput): Promise<ThreatPattern[]> {
    const patterns: ThreatPattern[] = [];
    
    // Run LSTM prediction
    const lstmOutput = this.lstm!.run(input.text) as string;
    
    // Map LSTM output to patterns
    const matchedPattern = Array.from(this.patternDatabase.values()).find(
      pattern => pattern.name.toLowerCase().includes(lstmOutput.toLowerCase())
    );

    if (matchedPattern) {
      patterns.push({
        ...matchedPattern,
        confidence: 0.8, // Base confidence from LSTM
        frequency: 1,
        lastSeen: new Date(),
      });
    }

    // Analyze event sequences
    if (input.events && input.events.length > 0) {
      const sequencePatterns = this.sequenceAnalyzer.analyze(input.events);
      patterns.push(...sequencePatterns);
    }

    return patterns;
  }

  /**
   * Find similar patterns using KNN
   */
  private findSimilarPatterns(input: PatternInput): ThreatPattern[] {
    const features = this.inputToFeatures(input);
    const predictions = this.knn!.predict([features]);
    const patterns: ThreatPattern[] = [];

    const patternKeys = Array.from(this.patternDatabase.keys());
    const predictedIndex = predictions[0] as number;
    
    if (predictedIndex >= 0 && predictedIndex < patternKeys.length) {
      const patternKey = patternKeys[predictedIndex];
      const pattern = this.patternDatabase.get(patternKey!);
      
      if (pattern) {
        // Calculate confidence based on feature matching
        const confidence = this.calculatePatternConfidence(pattern, input);
        
        patterns.push({
          ...pattern,
          confidence,
          frequency: pattern.frequency + 1,
          lastSeen: new Date(),
        });
      }
    }

    return patterns;
  }

  /**
   * Analyze behavior patterns
   */
  private analyzeBehavior(input: PatternInput): ThreatPattern[] {
    const patterns: ThreatPattern[] = [];

    // Check for rapid requests
    if (input.metrics?.requestsPerMinute && input.metrics.requestsPerMinute > 50) {
      const bruteForce = this.patternDatabase.get('brute-force-pattern');
      if (bruteForce) {
        patterns.push({
          ...bruteForce,
          confidence: Math.min(input.metrics.requestsPerMinute / 100, 0.9),
          frequency: 1,
          lastSeen: new Date(),
        });
      }
    }

    // Check for data volume anomalies
    if (input.metrics?.dataTransferSize && input.metrics.dataTransferSize > 1000000) {
      const exfiltration = this.patternDatabase.get('data-exfiltration-pattern');
      if (exfiltration) {
        patterns.push({
          ...exfiltration,
          confidence: Math.min(input.metrics.dataTransferSize / 10000000, 0.85),
          frequency: 1,
          lastSeen: new Date(),
        });
      }
    }

    // Check for privilege-related behaviors
    if (input.behaviors?.includes('admin-access-attempt') || 
        input.behaviors?.includes('role-modification')) {
      const privEsc = this.patternDatabase.get('privilege-escalation-pattern');
      if (privEsc) {
        patterns.push({
          ...privEsc,
          confidence: 0.75,
          frequency: 1,
          lastSeen: new Date(),
        });
      }
    }

    return patterns;
  }

  /**
   * Convert anomalies to patterns
   */
  private anomaliesToPatterns(anomalies: Anomaly[]): ThreatPattern[] {
    return anomalies.map(anomaly => ({
      id: `anomaly-${Date.now()}`,
      name: `Anomalous ${anomaly.type} Pattern`,
      category: 'Anomaly',
      indicators: [
        { type: 'anomaly', value: anomaly.description, weight: anomaly.severity },
      ],
      confidence: anomaly.confidence,
      frequency: 1,
      lastSeen: new Date(),
    }));
  }

  /**
   * Rank patterns by relevance and confidence
   */
  private rankPatterns(patterns: ThreatPattern[]): ThreatPattern[] {
    // Remove duplicates
    const uniquePatterns = new Map<string, ThreatPattern>();
    
    patterns.forEach(pattern => {
      const existing = uniquePatterns.get(pattern.id);
      if (!existing || pattern.confidence > existing.confidence) {
        uniquePatterns.set(pattern.id, pattern);
      }
    });

    // Sort by confidence and recency
    return Array.from(uniquePatterns.values())
      .sort((a, b) => {
        // Primary sort by confidence
        const confDiff = b.confidence - a.confidence;
        if (Math.abs(confDiff) > 0.1) return confDiff;
        
        // Secondary sort by recency
        return b.lastSeen.getTime() - a.lastSeen.getTime();
      })
      .slice(0, 10); // Top 10 patterns
  }

  /**
   * Convert pattern to feature vector
   */
  private patternToFeatures(pattern: StoredPattern): number[] {
    const features: number[] = [];

    // Indicator features
    features.push(pattern.indicators.length);
    features.push(pattern.indicators.filter(i => i.type === 'keyword').length);
    features.push(pattern.indicators.filter(i => i.type === 'behavior').length);
    features.push(Math.max(...pattern.indicators.map(i => i.weight)));

    // Category features
    const categories = ['Injection', 'Authentication', 'Data Theft', 'Access Control'];
    categories.forEach(cat => {
      features.push(pattern.category === cat ? 1 : 0);
    });

    // Sequence features
    features.push(pattern.attackSequence?.length || 0);

    // Pad to fixed size
    while (features.length < 10) features.push(0);
    
    return features.slice(0, 10);
  }

  /**
   * Convert input to feature vector
   */
  private inputToFeatures(input: PatternInput): number[] {
    const features: number[] = [];

    // Text features
    features.push(input.text.length / 1000); // Normalized length
    features.push(this.countKeywords(input.text));
    features.push(this.countSuspiciousPatterns(input.text));

    // Event features
    features.push(input.events?.length || 0);

    // Metric features
    features.push(input.metrics?.requestsPerMinute || 0);
    features.push(input.metrics?.failureRate || 0);
    features.push(input.metrics?.dataTransferSize || 0);

    // Behavioral features
    features.push(input.behaviors?.length || 0);

    // Temporal features
    features.push(this.calculateTemporalScore(input.timestamps || []));

    // Normalize and pad
    const normalized = features.map(f => Math.min(f / 10, 1));
    while (normalized.length < 10) normalized.push(0);
    
    return normalized.slice(0, 10);
  }

  /**
   * Count keywords in text
   */
  private countKeywords(text: string): number {
    const keywords = [
      'admin', 'root', 'password', 'token', 'key', 'secret',
      'select', 'union', 'script', 'alert', 'drop', 'delete'
    ];

    const lowerText = text.toLowerCase();
    return keywords.filter(kw => lowerText.includes(kw)).length;
  }

  /**
   * Count suspicious patterns
   */
  private countSuspiciousPatterns(text: string): number {
    const patterns = [
      /['"]?\s*OR\s+\d+\s*=\s*\d+/i,
      /<script.*?>.*?<\/script>/i,
      /javascript:/i,
      /on\w+\s*=/i,
    ];

    return patterns.filter(pattern => pattern.test(text)).length;
  }

  /**
   * Calculate temporal score
   */
  private calculateTemporalScore(timestamps: Date[]): number {
    if (timestamps.length < 2) return 0;

    // Calculate frequency (events per minute)
    const sorted = timestamps.sort((a, b) => a.getTime() - b.getTime());
    const duration = sorted[sorted.length - 1]!.getTime() - sorted[0]!.getTime();
    const minutes = duration / 60000;
    
    return minutes > 0 ? timestamps.length / minutes : 0;
  }

  /**
   * Calculate pattern confidence
   */
  private calculatePatternConfidence(pattern: StoredPattern, input: PatternInput): number {
    let confidence = 0;
    let totalWeight = 0;

    pattern.indicators.forEach(indicator => {
      if (this.checkIndicator(indicator, input)) {
        confidence += indicator.weight;
      }
      totalWeight += indicator.weight;
    });

    return totalWeight > 0 ? confidence / totalWeight : 0;
  }

  /**
   * Check if indicator matches input
   */
  private checkIndicator(indicator: PatternIndicator, input: PatternInput): boolean {
    switch (indicator.type) {
      case 'keyword':
        return input.text.toLowerCase().includes(indicator.value.toLowerCase());
      
      case 'regex':
        return new RegExp(indicator.value.slice(1, -1)).test(input.text);
      
      case 'behavior':
        return input.behaviors?.includes(indicator.value) || false;
      
      case 'metric':
        return this.checkMetricIndicator(indicator.value, input.metrics || {});
      
      default:
        return false;
    }
  }

  /**
   * Check metric-based indicator
   */
  private checkMetricIndicator(indicator: string, metrics: Record<string, any>): boolean {
    const match = indicator.match(/(\w+)([><=]+)(\d+)/);
    if (!match) return false;

    const [, metric, operator, valueStr] = match;
    const value = parseInt(valueStr!);
    const metricValue = metrics[metric!];

    if (typeof metricValue !== 'number') return false;

    switch (operator) {
      case '>': return metricValue > value;
      case '>=': return metricValue >= value;
      case '<': return metricValue < value;
      case '<=': return metricValue <= value;
      case '=': return metricValue === value;
      default: return false;
    }
  }

  /**
   * Generate pattern explanation
   */
  private generatePatternExplanation(pattern: ThreatPattern): string {
    const indicatorCount = pattern.indicators.length;
    const confidence = (pattern.confidence * 100).toFixed(1);
    
    return `${pattern.name} detected with ${confidence}% confidence based on ${indicatorCount} indicators. ` +
           `This ${pattern.category} pattern suggests potential malicious activity.`;
  }

  /**
   * Convert pattern to evidence
   */
  private patternToEvidence(pattern: ThreatPattern): Evidence[] {
    return pattern.indicators.map(indicator => ({
      source: `Pattern Analysis - ${indicator.type}`,
      relevance: indicator.weight,
      description: `Indicator detected: ${indicator.value}`,
    }));
  }

  /**
   * Get related threats for pattern
   */
  private getRelatedThreats(pattern: ThreatPattern): string[] {
    const relatedMap: Record<string, string[]> = {
      'SQL Injection Attack Pattern': ['Database Breach', 'Data Theft', 'System Compromise'],
      'Brute Force Authentication Pattern': ['Account Takeover', 'Credential Theft', 'System Access'],
      'Data Exfiltration Pattern': ['Data Breach', 'Privacy Violation', 'Intellectual Property Theft'],
      'Privilege Escalation Pattern': ['System Takeover', 'Admin Access', 'Lateral Movement'],
      'Cross-Site Scripting Pattern': ['Session Hijacking', 'Phishing', 'Data Theft'],
    };

    return relatedMap[pattern.name] || ['Unknown Threat'];
  }

  /**
   * Calculate average confidence
   */
  private calculateAverageConfidence(patterns: ThreatPattern[]): number {
    if (patterns.length === 0) return 0;
    
    const sum = patterns.reduce((total, p) => total + p.confidence, 0);
    return sum / patterns.length;
  }

  /**
   * Assess data quality
   */
  private assessDataQuality(input: PatternInput): number {
    const factors = {
      hasText: input.text.length > 10 ? 1 : 0.5,
      hasEvents: (input.events?.length || 0) > 0 ? 1 : 0,
      hasMetrics: Object.keys(input.metrics || {}).length > 0 ? 1 : 0,
      hasBehaviors: (input.behaviors?.length || 0) > 0 ? 1 : 0,
      hasTimestamps: (input.timestamps?.length || 0) > 0 ? 1 : 0,
    };

    const sum = Object.values(factors).reduce((total, val) => total + val, 0);
    return sum / Object.keys(factors).length;
  }

  /**
   * Update pattern database with new observations
   */
  updatePatterns(observations: PatternObservation[]): void {
    observations.forEach(obs => {
      const pattern = this.patternDatabase.get(obs.patternId);
      if (pattern) {
        pattern.frequency++;
        pattern.lastSeen = new Date();
        pattern.confidence = Math.min(pattern.confidence * 1.1, 0.95);
        
        // Add new indicators if discovered
        if (obs.newIndicators) {
          pattern.indicators.push(...obs.newIndicators);
        }
      }
    });
  }

  /**
   * Get model statistics
   */
  getModelStats(): any {
    return {
      type: ModelType.PATTERN_RECOGNIZER,
      lstmTrained: this.lstm !== null,
      knnTrained: this.knn !== null,
      patternCount: this.patternDatabase.size,
      version: '1.0.0',
    };
  }
}

// Helper interfaces and classes
interface StoredPattern extends ThreatPattern {
  attackSequence?: string[];
}

interface PatternInput {
  text: string;
  events?: string[];
  metrics?: Record<string, number>;
  behaviors?: string[];
  timestamps?: Date[];
}

interface PatternObservation {
  patternId: string;
  confidence: number;
  newIndicators?: PatternIndicator[];
}

interface Anomaly {
  type: string;
  description: string;
  severity: number;
  confidence: number;
}

// Sequence analyzer helper
class SequenceAnalyzer {
  analyze(events: string[]): ThreatPattern[] {
    const patterns: ThreatPattern[] = [];
    
    // Look for attack sequences
    const attackSequences = [
      ['login-failed', 'login-failed', 'login-failed'],
      ['data-access', 'bulk-export', 'external-transfer'],
      ['privilege-check', 'elevation-attempt', 'admin-access'],
    ];

    attackSequences.forEach((sequence, index) => {
      if (this.containsSequence(events, sequence)) {
        patterns.push({
          id: `sequence-${index}`,
          name: `Attack Sequence ${index + 1}`,
          category: 'Behavioral',
          indicators: sequence.map(s => ({ 
            type: 'event', 
            value: s, 
            weight: 0.8 
          })),
          confidence: 0.75,
          frequency: 1,
          lastSeen: new Date(),
        });
      }
    });

    return patterns;
  }

  private containsSequence(events: string[], sequence: string[]): boolean {
    for (let i = 0; i <= events.length - sequence.length; i++) {
      let match = true;
      for (let j = 0; j < sequence.length; j++) {
        if (events[i + j] !== sequence[j]) {
          match = false;
          break;
        }
      }
      if (match) return true;
    }
    return false;
  }
}

// Anomaly detector helper
class AnomalyDetector {
  detect(input: PatternInput): Anomaly[] {
    const anomalies: Anomaly[] = [];

    // Check for unusual patterns
    if (input.text.length > 10000) {
      anomalies.push({
        type: 'size',
        description: 'Unusually large input size',
        severity: 0.7,
        confidence: 0.8,
      });
    }

    // Check for encoding anomalies
    if (this.hasEncodingAnomalies(input.text)) {
      anomalies.push({
        type: 'encoding',
        description: 'Suspicious character encoding detected',
        severity: 0.8,
        confidence: 0.75,
      });
    }

    return anomalies;
  }

  private hasEncodingAnomalies(text: string): boolean {
    // Check for multiple encoding layers
    const encodingPatterns = [
      /%[0-9a-fA-F]{2}/g, // URL encoding
      /&#x[0-9a-fA-F]+;/g, // HTML hex entities
      /\\x[0-9a-fA-F]{2}/g, // Hex escape
      /\\u[0-9a-fA-F]{4}/g, // Unicode escape
    ];

    let encodingCount = 0;
    encodingPatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches && matches.length > 5) {
        encodingCount++;
      }
    });

    return encodingCount >= 2;
  }
}