import {
  ThreatAnalysisRequest,
  ThreatAnalysisResponse,
  ThreatModelingMethodology,
  IdentifiedThreat,
  Component,
  MitigationRecommendation,
  AnalysisMetadata,
  ProcessingStep,
  ProcessingStatus,
  AnalysisWarning,
  WarningLevel,
  SystemRecommendation,
  RecommendationCategory,
  RequirementPriority,
  RiskAssessment,
} from '../types';
import { StrideEngine } from '../engines/stride.engine';
import { PastaEngine } from '../engines/pasta.engine';
import { ThreatPatternMatcher } from './pattern-matcher';
import { DreadCalculator } from './dread-calculator';
import { MitigationEngine } from './mitigation-engine';
import { logger, auditLogger } from '../utils/logger';
import { generateId } from '../utils/helpers';

export class ThreatAnalysisService {
  private strideEngine: StrideEngine;
  private pastaEngine: PastaEngine;
  private patternMatcher: ThreatPatternMatcher;
  private dreadCalculator: DreadCalculator;
  private mitigationEngine: MitigationEngine;

  constructor() {
    this.strideEngine = new StrideEngine();
    this.pastaEngine = new PastaEngine();
    this.patternMatcher = new ThreatPatternMatcher();
    this.dreadCalculator = new DreadCalculator();
    this.mitigationEngine = new MitigationEngine();
  }

  /**
   * Perform complete threat analysis using specified methodology
   */
  async analyzeThreatModel(
    request: ThreatAnalysisRequest,
    userId?: string
  ): Promise<ThreatAnalysisResponse> {
    const startTime = Date.now();
    const analysisId = generateId();

    try {
      // Audit log analysis start
      if (userId) {
        auditLogger.analysisStarted(
          userId,
          request.threatModelId,
          request.methodology
        );
      }

      logger.info('Starting threat analysis', {
        analysisId,
        threatModelId: request.threatModelId,
        methodology: request.methodology,
        componentsCount: request.components.length,
        dataFlowsCount: request.dataFlows.length,
      });

      // Validate request
      this.validateAnalysisRequest(request);

      let response: ThreatAnalysisResponse;

      // Route to appropriate analysis engine
      switch (request.methodology) {
        case ThreatModelingMethodology.STRIDE:
          response = await this.strideEngine.analyze(request);
          break;
        case ThreatModelingMethodology.PASTA:
          response = await this.pastaEngine.analyze(request);
          break;
        default:
          throw new Error(`Unsupported methodology: ${request.methodology}`);
      }

      // Enhance threats with pattern matching if enabled
      if (request.options?.enablePatternMatching !== false) {
        const patternThreats = await this.enhanceWithPatternMatching(
          request.components,
          response.threats
        );
        response.threats = [...response.threats, ...patternThreats];
      }

      // Apply DREAD scoring if enabled
      if (request.options?.enableDreadScoring) {
        response.threats = this.dreadCalculator.calculateBatchDreadScores(
          response.threats,
          request.components
        );
      }

      // Deduplicate threats
      response.threats = this.deduplicateThreats(response.threats);

      // Recalculate risk assessment with all threats
      response.riskAssessment = this.calculateFinalRiskAssessment(
        response.threats,
        response.riskAssessment
      );

      // Add service-level metadata
      response.analysisMetadata = this.enhanceMetadata(
        response.analysisMetadata,
        startTime,
        analysisId
      );

      const processingTime = Date.now() - startTime;

      // Audit log analysis completion
      if (userId) {
        auditLogger.analysisCompleted(
          userId,
          request.threatModelId,
          response.threats.length,
          processingTime
        );

        auditLogger.riskCalculated(
          userId,
          request.threatModelId,
          response.riskAssessment.overallRiskScore,
          response.riskAssessment.criticalThreats.length
        );
      }

      logger.info('Threat analysis completed', {
        analysisId,
        threatModelId: request.threatModelId,
        threatsFound: response.threats.length,
        processingTime,
        riskLevel: response.riskAssessment.riskLevel,
      });

      return response;
    } catch (error: any) {
      const processingTime = Date.now() - startTime;

      if (userId) {
        auditLogger.analysisFailed(
          userId,
          request.threatModelId,
          error.message
        );
      }

      logger.error('Threat analysis failed', {
        analysisId,
        threatModelId: request.threatModelId,
        error: error.message,
        processingTime,
      });

      throw error;
    }
  }

  /**
   * Get available threat patterns for component types
   */
  async getAvailablePatterns(): Promise<any> {
    return {
      patterns: this.patternMatcher.getPatterns(),
      categoryCounts: this.getPatternCategoryCounts(),
    };
  }

  /**
   * Add custom threat pattern
   */
  async addCustomPattern(pattern: any, userId?: string): Promise<void> {
    this.patternMatcher.addPattern(pattern);
    
    if (userId) {
      auditLogger.knowledgeBaseUpdated(userId, 'pattern_added', 1);
    }

    logger.info('Custom pattern added', {
      patternId: pattern.id,
      userId,
    });
  }

  /**
   * Analyze single component for threats
   */
  async analyzeComponent(
    component: Component,
    methodology: ThreatModelingMethodology = ThreatModelingMethodology.STRIDE,
    userId?: string
  ): Promise<IdentifiedThreat[]> {
    const request: ThreatAnalysisRequest = {
      threatModelId: generateId(),
      methodology,
      components: [component],
      dataFlows: [],
      securityRequirements: [],
      options: {
        enablePatternMatching: true,
        enableDreadScoring: true,
      },
    };

    const response = await this.analyzeThreatModel(request, userId);
    return response.threats;
  }

  /**
   * Generate mitigation recommendations for threats
   */
  async generateMitigations(
    threats: IdentifiedThreat[],
    components: Component[],
    userId?: string
  ): Promise<MitigationRecommendation[]> {
    const recommendations = await this.mitigationEngine.generateRecommendations(
      threats,
      components
    );

    if (userId) {
      for (const threat of threats) {
        for (const recommendation of recommendations) {
          if (recommendation.applicableThreats.includes(threat.id)) {
            auditLogger.mitigationRecommended(
              userId,
              'single-analysis',
              threat.id,
              recommendation.id
            );
          }
        }
      }
    }

    return recommendations;
  }

  /**
   * Calculate risk metrics for threat model
   */
  async calculateRiskMetrics(
    threats: IdentifiedThreat[],
    components: Component[]
  ): Promise<RiskAssessment> {
    return this.calculateFinalRiskAssessment(threats, {
      overallRiskScore: 0,
      riskLevel: 'low' as any,
      riskDistribution: { critical: 0, high: 0, medium: 0, low: 0 },
      criticalThreats: [],
      riskFactors: [],
      complianceGaps: [],
    });
  }

  /**
   * Validate analysis request
   */
  private validateAnalysisRequest(request: ThreatAnalysisRequest): void {
    if (!request.threatModelId) {
      throw new Error('Threat model ID is required');
    }

    if (!request.components || request.components.length === 0) {
      throw new Error('At least one component is required for analysis');
    }

    if (!Object.values(ThreatModelingMethodology).includes(request.methodology)) {
      throw new Error(`Invalid methodology: ${request.methodology}`);
    }

    // Validate components
    for (const component of request.components) {
      if (!component.id || !component.name || !component.type) {
        throw new Error(`Invalid component: ${JSON.stringify(component)}`);
      }
    }

    // Validate data flows if present
    for (const dataFlow of request.dataFlows || []) {
      if (!dataFlow.id || !dataFlow.sourceId || !dataFlow.targetId) {
        throw new Error(`Invalid data flow: ${JSON.stringify(dataFlow)}`);
      }
    }
  }

  /**
   * Enhance threats with pattern matching
   */
  private async enhanceWithPatternMatching(
    components: Component[],
    existingThreats: IdentifiedThreat[]
  ): Promise<IdentifiedThreat[]> {
    const patternThreats: IdentifiedThreat[] = [];

    for (const component of components) {
      const componentThreats = await this.patternMatcher.findThreats(component);
      
      // Filter out threats that are too similar to existing ones
      const uniqueThreats = componentThreats.filter(patternThreat =>
        !this.isDuplicateThreat(patternThreat, existingThreats)
      );

      patternThreats.push(...uniqueThreats);
    }

    return patternThreats;
  }

  /**
   * Check if threat is duplicate of existing threats
   */
  private isDuplicateThreat(
    newThreat: IdentifiedThreat,
    existingThreats: IdentifiedThreat[]
  ): boolean {
    return existingThreats.some(existing => {
      // Check if same category and affects same components
      const sameCategory = existing.category === newThreat.category;
      const sameComponents = existing.affectedComponents.length === newThreat.affectedComponents.length &&
        existing.affectedComponents.every(id => newThreat.affectedComponents.includes(id));
      
      // Check title similarity (simple heuristic)
      const titleSimilarity = this.calculateStringSimilarity(
        existing.title.toLowerCase(),
        newThreat.title.toLowerCase()
      );

      return sameCategory && sameComponents && titleSimilarity > 0.7;
    });
  }

  /**
   * Calculate string similarity (Jaccard index)
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    const words1 = new Set(str1.split(/\s+/));
    const words2 = new Set(str2.split(/\s+/));
    
    const intersection = new Set([...words1].filter(word => words2.has(word)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }

  /**
   * Deduplicate threats based on similarity
   */
  private deduplicateThreats(threats: IdentifiedThreat[]): IdentifiedThreat[] {
    const uniqueThreats: IdentifiedThreat[] = [];
    const processed = new Set<string>();

    for (const threat of threats) {
      if (processed.has(threat.id)) continue;

      let isDuplicate = false;
      for (const unique of uniqueThreats) {
        if (this.isDuplicateThreat(threat, [unique])) {
          // Merge information from duplicate threat
          unique.confidence = Math.max(unique.confidence, threat.confidence);
          if (threat.riskScore > unique.riskScore) {
            unique.riskScore = threat.riskScore;
            unique.severity = threat.severity;
          }
          isDuplicate = true;
          break;
        }
      }

      if (!isDuplicate) {
        uniqueThreats.push(threat);
      }

      processed.add(threat.id);
    }

    return uniqueThreats;
  }

  /**
   * Calculate final risk assessment
   */
  private calculateFinalRiskAssessment(
    threats: IdentifiedThreat[],
    baseAssessment: RiskAssessment
  ): RiskAssessment {
    const riskDistribution = {
      critical: threats.filter(t => t.severity === 'critical').length,
      high: threats.filter(t => t.severity === 'high').length,
      medium: threats.filter(t => t.severity === 'medium').length,
      low: threats.filter(t => t.severity === 'low').length,
    };

    const overallRiskScore = threats.length > 0
      ? threats.reduce((sum, threat) => sum + threat.riskScore, 0) / threats.length
      : 0;

    let riskLevel: any = 'low';
    if (riskDistribution.critical > 0) {
      riskLevel = 'critical';
    } else if (riskDistribution.high > 3) {
      riskLevel = 'very_high';
    } else if (riskDistribution.high > 0) {
      riskLevel = 'high';
    } else if (riskDistribution.medium > 5) {
      riskLevel = 'medium';
    }

    const criticalThreats = threats
      .filter(t => t.severity === 'critical' || t.riskScore >= 15)
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, 10);

    return {
      ...baseAssessment,
      overallRiskScore,
      riskLevel,
      riskDistribution,
      criticalThreats,
    };
  }

  /**
   * Enhance metadata with service information
   */
  private enhanceMetadata(
    metadata: AnalysisMetadata,
    startTime: number,
    analysisId: string
  ): AnalysisMetadata {
    const processingTime = Date.now() - startTime;

    return {
      ...metadata,
      analysisId,
      serviceVersion: '1.0.0',
      totalProcessingTime: processingTime,
      performanceMetrics: {
        threatsPerSecond: metadata.totalThreats / (processingTime / 1000),
        componentsPerSecond: metadata.componentsAnalyzed / (processingTime / 1000),
      },
    };
  }

  /**
   * Get pattern category counts
   */
  private getPatternCategoryCounts(): Record<string, number> {
    const patterns = this.patternMatcher.getPatterns();
    const counts: Record<string, number> = {};

    for (const pattern of patterns) {
      const category = pattern.category;
      counts[category] = (counts[category] || 0) + 1;
    }

    return counts;
  }
}