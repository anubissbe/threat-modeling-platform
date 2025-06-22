/**
 * Enhanced Pattern Recognition Service
 * Advanced attack pattern detection using multiple ML approaches
 */

import { EventEmitter } from 'events';
import * as natural from 'natural';
import { logger, mlLogger } from '../utils/logger';
import { ModelType, PredictionRequest, PredictionResponse, Evidence } from '../types';
import { config } from '../config';

// Pattern recognition interfaces
export interface AttackPattern {
  id: string;
  name: string;
  description: string;
  category: 'apt' | 'malware' | 'phishing' | 'insider' | 'lateral_movement' | 'data_exfiltration';
  severity: 'low' | 'medium' | 'high' | 'critical';
  stages: AttackStage[];
  indicators: PatternIndicator[];
  mitre_tactics: string[];
  mitre_techniques: string[];
  confidence_threshold: number;
}

export interface AttackStage {
  stage_id: number;
  name: string;
  description: string;
  expected_duration: number; // minutes
  indicators: PatternIndicator[];
  next_stages: number[];
}

export interface PatternIndicator {
  type: 'network' | 'process' | 'file' | 'registry' | 'api' | 'behavioral' | 'temporal';
  pattern: string;
  weight: number;
  is_optional: boolean;
  time_window?: number; // seconds
  context?: Record<string, any>;
}

export interface PatternMatch {
  pattern_id: string;
  pattern_name: string;
  confidence: number;
  matched_stages: number[];
  matched_indicators: PatternIndicator[];
  timeline: PatternEvent[];
  risk_score: number;
  predicted_next_stages: AttackStage[];
}

export interface PatternEvent {
  timestamp: Date;
  stage_id: number;
  indicator: PatternIndicator;
  evidence: Evidence;
  confidence: number;
}

/**
 * Enhanced Pattern Recognition Engine
 */
export class EnhancedPatternRecognizerService extends EventEmitter {
  private isInitialized = false;
  private attackPatterns: Map<string, AttackPattern> = new Map();
  private activeMatches: Map<string, PatternMatch> = new Map();
  private temporalAnalyzer: TemporalPatternAnalyzer;
  private sequenceDetector: SequenceDetector;
  private contextAnalyzer: ContextualAnalyzer;
  private predictionEngine: AttackPredictionEngine;

  constructor() {
    super();
    this.temporalAnalyzer = new TemporalPatternAnalyzer();
    this.sequenceDetector = new SequenceDetector();
    this.contextAnalyzer = new ContextualAnalyzer();
    this.predictionEngine = new AttackPredictionEngine();
  }

  /**
   * Initialize the enhanced pattern recognition system
   */
  async initialize(): Promise<void> {
    try {
      const startTime = Date.now();
      logger.info('Initializing Enhanced Pattern Recognition System...');

      // Load attack patterns
      await this.loadAttackPatterns();
      
      // Initialize analysis engines
      await this.temporalAnalyzer.initialize();
      await this.sequenceDetector.initialize();
      await this.contextAnalyzer.initialize();
      await this.predictionEngine.initialize();

      this.isInitialized = true;
      const initTime = Date.now() - startTime;
      
      mlLogger.modelLoaded(ModelType.PATTERN_RECOGNIZER, '2.0.0', initTime);
      logger.info(`Enhanced Pattern Recognition System initialized in ${initTime}ms`);
      
      this.emit('initialized', { initTime });
    } catch (error) {
      logger.error('Failed to initialize Enhanced Pattern Recognition System:', error);
      throw error;
    }
  }

  /**
   * Analyze patterns in real-time data
   */
  async recognizePatterns(request: PredictionRequest): Promise<PatternMatch[]> {
    if (!this.isInitialized) {
      throw new Error('Enhanced Pattern Recognizer not initialized');
    }

    const startTime = Date.now();
    
    try {
      // Extract events from input data
      const events = this.extractEvents(request.data);
      
      // Update active pattern matches
      const updatedMatches = await this.updateActiveMatches(events);
      
      // Detect new pattern initiations
      const newMatches = await this.detectNewPatterns(events);
      
      // Combine and analyze all matches
      const allMatches = [...updatedMatches, ...newMatches];
      
      // Predict next stages for active patterns
      const predictions = await this.predictNextStages(allMatches);
      
      // Filter by confidence threshold
      const significantMatches = allMatches.filter(match => 
        match.confidence >= 0.6
      );
      
      const processingTime = Date.now() - startTime;
      
      // Log pattern recognition metrics
      mlLogger.predictionMade(
        ModelType.PATTERN_RECOGNIZER,
        significantMatches.length > 0 ? Math.max(...significantMatches.map(m => m.confidence)) : 0,
        processingTime
      );
      
      // Emit pattern detection event
      this.emit('patterns_detected', {
        request,
        matches: significantMatches,
        predictions,
        processingTime,
        timestamp: new Date()
      });
      
      return significantMatches;
      
    } catch (error) {
      mlLogger.predictionError(ModelType.PATTERN_RECOGNIZER, error.message, request);
      throw error;
    }
  }

  /**
   * Get active attack patterns being tracked
   */
  getActivePatterns(): PatternMatch[] {
    return Array.from(this.activeMatches.values());
  }

  /**
   * Predict likely next stages for active attacks
   */
  async predictNextStages(matches: PatternMatch[]): Promise<AttackStage[]> {
    return await this.predictionEngine.predictNextStages(matches);
  }

  /**
   * Load attack patterns from various sources
   */
  private async loadAttackPatterns(): Promise<void> {
    // Load built-in patterns
    const builtinPatterns = this.getBuiltinAttackPatterns();
    builtinPatterns.forEach(pattern => this.attackPatterns.set(pattern.id, pattern));
    
    // TODO: Load from MLOps model registry
    // TODO: Load from MITRE ATT&CK framework
    // TODO: Load custom patterns from threat intelligence
    
    logger.info(`Loaded ${this.attackPatterns.size} attack patterns`);
  }

  /**
   * Extract events from raw data
   */
  private extractEvents(data: any): PatternEvent[] {
    const events: PatternEvent[] = [];
    const timestamp = new Date();
    
    // Extract different types of events
    if (data.network) {
      data.network.forEach((net: any) => {
        events.push({
          timestamp,
          stage_id: 0, // Will be determined during matching
          indicator: {
            type: 'network',
            pattern: net.pattern || net.activity,
            weight: 0.5,
            is_optional: false
          },
          evidence: {
            type: 'network',
            description: `Network activity: ${net.activity}`,
            confidence: 0.8,
            source: 'network-monitor'
          },
          confidence: 0.8
        });
      });
    }
    
    if (data.processes) {
      data.processes.forEach((proc: any) => {
        events.push({
          timestamp,
          stage_id: 0,
          indicator: {
            type: 'process',
            pattern: proc.name || proc.command,
            weight: 0.7,
            is_optional: false
          },
          evidence: {
            type: 'process',
            description: `Process activity: ${proc.command}`,
            confidence: 0.9,
            source: 'process-monitor'
          },
          confidence: 0.9
        });
      });
    }
    
    return events;
  }

  /**
   * Update existing active pattern matches
   */
  private async updateActiveMatches(events: PatternEvent[]): Promise<PatternMatch[]> {
    const updatedMatches: PatternMatch[] = [];
    
    for (const [matchId, match] of this.activeMatches) {
      const pattern = this.attackPatterns.get(match.pattern_id);
      if (!pattern) continue;
      
      // Check if new events match next expected stages
      const updatedMatch = await this.updatePatternMatch(match, pattern, events);
      
      if (updatedMatch) {
        this.activeMatches.set(matchId, updatedMatch);
        updatedMatches.push(updatedMatch);
      }
    }
    
    return updatedMatches;
  }

  /**
   * Detect new pattern initiations
   */
  private async detectNewPatterns(events: PatternEvent[]): Promise<PatternMatch[]> {
    const newMatches: PatternMatch[] = [];
    
    for (const [patternId, pattern] of this.attackPatterns) {
      // Check if events match initial stages of any pattern
      const match = await this.matchPatternInitiation(pattern, events);
      
      if (match && match.confidence >= pattern.confidence_threshold) {
        const matchId = `${patternId}-${Date.now()}`;
        this.activeMatches.set(matchId, match);
        newMatches.push(match);
      }
    }
    
    return newMatches;
  }

  /**
   * Match pattern initiation against events
   */
  private async matchPatternInitiation(pattern: AttackPattern, events: PatternEvent[]): Promise<PatternMatch | null> {
    const initialStages = pattern.stages.filter(stage => stage.stage_id === 0 || stage.stage_id === 1);
    
    let matchedIndicators: PatternIndicator[] = [];
    let matchedStages: number[] = [];
    let confidence = 0;
    
    for (const stage of initialStages) {
      const stageMatch = this.matchStageIndicators(stage, events);
      
      if (stageMatch.matched) {
        matchedIndicators.push(...stageMatch.indicators);
        matchedStages.push(stage.stage_id);
        confidence += stageMatch.confidence * 0.5; // Weight initial stages
      }
    }
    
    if (matchedStages.length > 0) {
      return {
        pattern_id: pattern.id,
        pattern_name: pattern.name,
        confidence: Math.min(confidence, 1.0),
        matched_stages: matchedStages,
        matched_indicators: matchedIndicators,
        timeline: events.filter(e => 
          matchedIndicators.some(ind => ind.pattern === e.indicator.pattern)
        ),
        risk_score: confidence * this.getSeverityScore(pattern.severity),
        predicted_next_stages: this.getPredictedNextStages(pattern, matchedStages)
      };
    }
    
    return null;
  }

  /**
   * Update existing pattern match with new events
   */
  private async updatePatternMatch(
    match: PatternMatch, 
    pattern: AttackPattern, 
    events: PatternEvent[]
  ): Promise<PatternMatch | null> {
    const currentStages = match.matched_stages;
    const nextStages = pattern.stages.filter(stage => 
      currentStages.some(currentStage => {
        const stageObj = pattern.stages.find(s => s.stage_id === currentStage);
        return stageObj?.next_stages.includes(stage.stage_id);
      })
    );
    
    let newMatchedStages: number[] = [];
    let newMatchedIndicators: PatternIndicator[] = [];
    let confidenceBoost = 0;
    
    for (const stage of nextStages) {
      const stageMatch = this.matchStageIndicators(stage, events);
      
      if (stageMatch.matched) {
        newMatchedStages.push(stage.stage_id);
        newMatchedIndicators.push(...stageMatch.indicators);
        confidenceBoost += stageMatch.confidence * 0.3;
      }
    }
    
    if (newMatchedStages.length > 0) {
      return {
        ...match,
        confidence: Math.min(match.confidence + confidenceBoost, 1.0),
        matched_stages: [...match.matched_stages, ...newMatchedStages],
        matched_indicators: [...match.matched_indicators, ...newMatchedIndicators],
        timeline: [...match.timeline, ...events.filter(e => 
          newMatchedIndicators.some(ind => ind.pattern === e.indicator.pattern)
        )],
        risk_score: (match.confidence + confidenceBoost) * this.getSeverityScore(pattern.severity),
        predicted_next_stages: this.getPredictedNextStages(pattern, [...match.matched_stages, ...newMatchedStages])
      };
    }
    
    return match;
  }

  /**
   * Match stage indicators against events
   */
  private matchStageIndicators(stage: AttackStage, events: PatternEvent[]): {
    matched: boolean;
    confidence: number;
    indicators: PatternIndicator[];
  } {
    let matchedIndicators: PatternIndicator[] = [];
    let totalWeight = 0;
    let maxWeight = 0;
    
    for (const indicator of stage.indicators) {
      maxWeight += indicator.weight;
      
      for (const event of events) {
        if (this.matchIndicator(indicator, event)) {
          matchedIndicators.push(indicator);
          totalWeight += indicator.weight;
          break;
        }
      }
    }
    
    const confidence = maxWeight > 0 ? totalWeight / maxWeight : 0;
    const matched = confidence >= 0.5 || matchedIndicators.length >= Math.ceil(stage.indicators.length / 2);
    
    return { matched, confidence, indicators: matchedIndicators };
  }

  /**
   * Match individual indicator against event
   */
  private matchIndicator(indicator: PatternIndicator, event: PatternEvent): boolean {
    if (indicator.type !== event.indicator.type) {
      return false;
    }
    
    try {
      const pattern = new RegExp(indicator.pattern, 'i');
      return pattern.test(event.indicator.pattern);
    } catch {
      return indicator.pattern === event.indicator.pattern;
    }
  }

  /**
   * Get severity score for risk calculation
   */
  private getSeverityScore(severity: string): number {
    const scores = { low: 25, medium: 50, high: 75, critical: 100 };
    return scores[severity] || 50;
  }

  /**
   * Get predicted next stages for a pattern
   */
  private getPredictedNextStages(pattern: AttackPattern, currentStages: number[]): AttackStage[] {
    const nextStageIds = new Set<number>();
    
    for (const stageId of currentStages) {
      const stage = pattern.stages.find(s => s.stage_id === stageId);
      if (stage) {
        stage.next_stages.forEach(id => nextStageIds.add(id));
      }
    }
    
    return pattern.stages.filter(stage => nextStageIds.has(stage.stage_id));
  }

  /**
   * Get built-in attack patterns
   */
  private getBuiltinAttackPatterns(): AttackPattern[] {
    return [
      {
        id: 'apt-lateral-movement',
        name: 'APT Lateral Movement',
        description: 'Advanced persistent threat lateral movement pattern',
        category: 'apt',
        severity: 'critical',
        stages: [
          {
            stage_id: 1,
            name: 'Initial Compromise',
            description: 'Initial system compromise',
            expected_duration: 30,
            indicators: [
              {
                type: 'process',
                pattern: '(powershell|cmd).*-enc.*',
                weight: 0.8,
                is_optional: false
              },
              {
                type: 'network',
                pattern: 'suspicious_outbound_connection',
                weight: 0.6,
                is_optional: true
              }
            ],
            next_stages: [2]
          },
          {
            stage_id: 2,
            name: 'Reconnaissance',
            description: 'Internal network reconnaissance',
            expected_duration: 60,
            indicators: [
              {
                type: 'process',
                pattern: '(net|nltest|whoami).*',
                weight: 0.7,
                is_optional: false
              },
              {
                type: 'network',
                pattern: 'internal_port_scan',
                weight: 0.8,
                is_optional: false
              }
            ],
            next_stages: [3, 4]
          },
          {
            stage_id: 3,
            name: 'Credential Harvesting',
            description: 'Credential theft and harvesting',
            expected_duration: 45,
            indicators: [
              {
                type: 'process',
                pattern: '(mimikatz|lsass|comsvcs)',
                weight: 0.9,
                is_optional: false
              },
              {
                type: 'file',
                pattern: '.*\\.dmp',
                weight: 0.7,
                is_optional: true
              }
            ],
            next_stages: [4]
          },
          {
            stage_id: 4,
            name: 'Lateral Movement',
            description: 'Moving to other systems',
            expected_duration: 120,
            indicators: [
              {
                type: 'network',
                pattern: '(smb|rdp|winrm)_connection',
                weight: 0.8,
                is_optional: false
              },
              {
                type: 'process',
                pattern: '(psexec|wmic|schtasks)',
                weight: 0.9,
                is_optional: false
              }
            ],
            next_stages: [5]
          },
          {
            stage_id: 5,
            name: 'Data Exfiltration',
            description: 'Stealing sensitive data',
            expected_duration: 90,
            indicators: [
              {
                type: 'network',
                pattern: 'large_data_transfer',
                weight: 0.8,
                is_optional: false
              },
              {
                type: 'file',
                pattern: '(zip|rar|7z).*creation',
                weight: 0.6,
                is_optional: true
              }
            ],
            next_stages: []
          }
        ],
        indicators: [],
        mitre_tactics: ['TA0008', 'TA0009', 'TA0010'],
        mitre_techniques: ['T1021', 'T1003', 'T1018'],
        confidence_threshold: 0.7
      },
      {
        id: 'ransomware-deployment',
        name: 'Ransomware Deployment',
        description: 'Ransomware attack pattern',
        category: 'malware',
        severity: 'critical',
        stages: [
          {
            stage_id: 1,
            name: 'Initial Infection',
            description: 'Initial ransomware deployment',
            expected_duration: 15,
            indicators: [
              {
                type: 'file',
                pattern: '.*\\.(exe|scr|bat|ps1).*',
                weight: 0.6,
                is_optional: false
              },
              {
                type: 'process',
                pattern: 'suspicious_process_creation',
                weight: 0.8,
                is_optional: false
              }
            ],
            next_stages: [2]
          },
          {
            stage_id: 2,
            name: 'File Encryption',
            description: 'Mass file encryption',
            expected_duration: 300,
            indicators: [
              {
                type: 'file',
                pattern: 'mass_file_modification',
                weight: 0.9,
                is_optional: false
              },
              {
                type: 'process',
                pattern: 'high_cpu_usage',
                weight: 0.7,
                is_optional: true
              }
            ],
            next_stages: [3]
          },
          {
            stage_id: 3,
            name: 'Ransom Note',
            description: 'Ransom note deployment',
            expected_duration: 5,
            indicators: [
              {
                type: 'file',
                pattern: '.*(readme|ransom|decrypt).*\\.(txt|html)',
                weight: 0.9,
                is_optional: false
              }
            ],
            next_stages: []
          }
        ],
        indicators: [],
        mitre_tactics: ['TA0040'],
        mitre_techniques: ['T1486'],
        confidence_threshold: 0.8
      }
    ];
  }
}

// Supporting classes
class TemporalPatternAnalyzer {
  async initialize(): Promise<void> {
    // Initialize temporal analysis models
  }
}

class SequenceDetector {
  async initialize(): Promise<void> {
    // Initialize sequence detection models
  }
}

class ContextualAnalyzer {
  async initialize(): Promise<void> {
    // Initialize contextual analysis models
  }
}

class AttackPredictionEngine {
  async initialize(): Promise<void> {
    // Initialize attack prediction models
  }

  async predictNextStages(matches: PatternMatch[]): Promise<AttackStage[]> {
    // Predict next stages based on current matches
    return [];
  }
}

export { EnhancedPatternRecognizerService };