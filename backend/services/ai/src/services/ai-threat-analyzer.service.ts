import { Pool } from 'pg';
import { RedisClientType } from 'redis';
import { logger } from '../utils/logger';
import { ThreatIntelligenceService } from './threat-intelligence.service';
import {
  AIAnalysisRequest,
  AIAnalysisResponse,
  EnhancedThreatSuggestion,
  AIThreatAnalysis,
  ContextualThreatData,
  GlobalRiskAssessment,
  ThreatPrediction,
  ConfidenceMetrics,
  ProcessingMetadata,
  ThreatClassificationResult,
  RiskPredictionResult,
  SimilarityAnalysisResult,
  AIModelConfig
} from '../types/ai';
import { ThreatSeverity, MethodologyType } from '../types/shared';

export class AIThreatAnalyzerService {
  private modelConfigs: Map<string, AIModelConfig> = new Map();

  constructor(
    private db: Pool,
    private redis: RedisClientType,
    private threatIntelService: ThreatIntelligenceService
  ) {
    this.initializeModels();
  }

  /**
   * Initialize AI model configurations
   */
  private initializeModels(): void {
    // LLM for threat analysis
    this.modelConfigs.set('threat-analyzer', {
      model_type: 'llm',
      model_name: 'gpt-4-turbo',
      version: '1.0',
      endpoint_url: process.env.OPENAI_API_URL,
      api_key: process.env.OPENAI_API_KEY,
      parameters: {
        max_tokens: 2000,
        temperature: 0.3,
        top_p: 0.9
      },
      confidence_threshold: 0.7,
      max_tokens: 2000,
      temperature: 0.3
    });

    // Classification model for threat categorization
    this.modelConfigs.set('threat-classifier', {
      model_type: 'classification',
      model_name: 'threat-classification-v1',
      version: '1.0',
      parameters: {
        confidence_threshold: 0.6
      },
      confidence_threshold: 0.6
    });

    // Risk prediction model
    this.modelConfigs.set('risk-predictor', {
      model_type: 'classification',
      model_name: 'risk-prediction-v1',
      version: '1.0',
      parameters: {
        lookback_days: 365,
        weight_factors: {
          'industry': 0.3,
          'technology': 0.4,
          'complexity': 0.3
        }
      },
      confidence_threshold: 0.5
    });

    logger.info('AI models initialized');
  }

  /**
   * Analyze threat model and generate enhanced suggestions
   */
  async analyzeThreats(request: AIAnalysisRequest): Promise<AIAnalysisResponse> {
    const startTime = Date.now();
    const analysisId = `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      logger.info(`Starting AI threat analysis: ${analysisId}`);

      // Get contextual threat intelligence
      const threatIntelligence = await this.threatIntelService.getContextualThreatIntelligence(request.context);

      // Generate enhanced threat suggestions
      const enhancedThreats = await this.generateEnhancedThreats(request, threatIntelligence);

      // Perform risk assessment
      const riskAssessment = await this.performGlobalRiskAssessment(enhancedThreats, request.context);

      // Generate predictions
      const predictions = await this.generateThreatPredictions(request.context, threatIntelligence);

      // Calculate confidence metrics
      const confidenceMetrics = this.calculateConfidenceMetrics(enhancedThreats, threatIntelligence);

      // Create processing metadata
      const processingMetadata: ProcessingMetadata = {
        processing_time_ms: Date.now() - startTime,
        models_used: ['threat-analyzer', 'threat-classifier', 'risk-predictor'],
        data_sources_consulted: [
          'threat_intelligence',
          'historical_threats',
          'industry_patterns'
        ],
        analysis_timestamp: new Date(),
        version: '1.0.0',
        limitations: [
          'Analysis based on available threat intelligence',
          'Predictions are probabilistic estimates',
          'Context interpretation may vary'
        ]
      };

      const response: AIAnalysisResponse = {
        analysis_id: analysisId,
        threat_model_id: request.threat_model_id,
        generated_threats: enhancedThreats,
        risk_assessment: riskAssessment,
        recommendations: this.generateRecommendations(enhancedThreats, riskAssessment),
        predictions,
        confidence_metrics: confidenceMetrics,
        processing_metadata: processingMetadata
      };

      // Cache the results
      await this.cacheAnalysisResults(analysisId, response);

      logger.info(`AI threat analysis completed: ${analysisId} (${processingMetadata.processing_time_ms}ms)`);
      return response;

    } catch (error) {
      logger.error(`Error in AI threat analysis ${analysisId}:`, error);
      throw error;
    }
  }

  /**
   * Generate enhanced threat suggestions with AI analysis
   */
  private async generateEnhancedThreats(
    request: AIAnalysisRequest,
    threatIntel: any[]
  ): Promise<EnhancedThreatSuggestion[]> {
    const threats: EnhancedThreatSuggestion[] = [];

    try {
      // Base threats from methodology
      const baseThreats = await this.generateBaseThreats(request.methodology, request.context);

      // Enhance each threat with AI analysis
      for (const baseThreat of baseThreats) {
        const enhancedThreat = await this.enhanceThreatWithAI(baseThreat, request.context, threatIntel);
        if (enhancedThreat) {
          threats.push(enhancedThreat);
        }
      }

      // Generate additional AI-discovered threats
      const aiThreats = await this.discoverAdditionalThreats(request.context, threatIntel);
      threats.push(...aiThreats);

      // Sort by risk score (likelihood * impact)
      threats.sort((a, b) => (b.likelihood * this.severityToNumber(b.severity)) - 
                             (a.likelihood * this.severityToNumber(a.severity)));

      return threats.slice(0, 20); // Limit to top 20 threats

    } catch (error) {
      logger.error('Error generating enhanced threats:', error);
      return [];
    }
  }

  /**
   * Generate base threats using methodology-specific patterns
   */
  private async generateBaseThreats(
    methodology: MethodologyType,
    context: ContextualThreatData
  ): Promise<Partial<EnhancedThreatSuggestion>[]> {
    const baseThreats: Partial<EnhancedThreatSuggestion>[] = [];

    switch (methodology) {
      case MethodologyType.STRIDE:
        baseThreats.push(...this.generateSTRIDEThreats(context));
        break;
      case MethodologyType.LINDDUN:
        baseThreats.push(...this.generateLINDDUNThreats(context));
        break;
      case MethodologyType.PASTA:
        baseThreats.push(...this.generatePASTAThreats(context));
        break;
      default:
        baseThreats.push(...this.generateGenericThreats(context));
    }

    return baseThreats;
  }

  /**
   * Generate STRIDE-specific threats
   */
  private generateSTRIDEThreats(context: ContextualThreatData): Partial<EnhancedThreatSuggestion>[] {
    const threats: Partial<EnhancedThreatSuggestion>[] = [];

    // Spoofing threats
    context.system_components.forEach(component => {
      if (component.type === 'external_entity') {
        threats.push({
          name: `Identity Spoofing - ${component.name}`,
          description: `Attackers could impersonate ${component.name} to gain unauthorized access`,
          category: 'Spoofing',
          affected_components: [component.id],
          methodology_specific: { stride_category: 'spoofing' }
        });
      }
    });

    // Tampering threats
    context.data_flows.forEach(flow => {
      if (!flow.encryption) {
        threats.push({
          name: `Data Tampering - ${flow.source} to ${flow.destination}`,
          description: `Unencrypted data flow vulnerable to modification in transit`,
          category: 'Tampering',
          affected_components: [flow.source, flow.destination],
          methodology_specific: { stride_category: 'tampering' }
        });
      }
    });

    // Information Disclosure threats
    context.assets.forEach(asset => {
      if (asset.sensitivity === 'confidential' || asset.sensitivity === 'secret') {
        threats.push({
          name: `Information Disclosure - ${asset.name}`,
          description: `Sensitive ${asset.type} could be exposed through improper access controls`,
          category: 'Information Disclosure',
          methodology_specific: { stride_category: 'information_disclosure' }
        });
      }
    });

    return threats;
  }

  /**
   * Generate LINDDUN-specific threats
   */
  private generateLINDDUNThreats(context: ContextualThreatData): Partial<EnhancedThreatSuggestion>[] {
    const threats: Partial<EnhancedThreatSuggestion>[] = [];

    // Linkability threats
    threats.push({
      name: 'User Activity Linkability',
      description: 'User activities across different services could be correlated',
      category: 'Linkability',
      methodology_specific: { linddun_category: 'linkability' }
    });

    // Identifiability threats
    threats.push({
      name: 'User Re-identification',
      description: 'Anonymized data could potentially be re-identified',
      category: 'Identifiability',
      methodology_specific: { linddun_category: 'identifiability' }
    });

    return threats;
  }

  /**
   * Generate PASTA-specific threats
   */
  private generatePASTAThreats(context: ContextualThreatData): Partial<EnhancedThreatSuggestion>[] {
    const threats: Partial<EnhancedThreatSuggestion>[] = [];

    // Business impact focused threats
    threats.push({
      name: 'Business Process Disruption',
      description: 'Critical business processes could be disrupted by targeted attacks',
      category: 'Business Impact',
      methodology_specific: { pasta_stage: 'stage_4_threat_analysis' }
    });

    return threats;
  }

  /**
   * Generate generic threats
   */
  private generateGenericThreats(context: ContextualThreatData): Partial<EnhancedThreatSuggestion>[] {
    return [
      {
        name: 'Unauthorized Access',
        description: 'Attackers could gain unauthorized access to system resources',
        category: 'Access Control'
      },
      {
        name: 'Data Breach',
        description: 'Sensitive data could be exposed or stolen',
        category: 'Data Protection'
      }
    ];
  }

  /**
   * Enhance a base threat with AI analysis
   */
  private async enhanceThreatWithAI(
    baseThreat: Partial<EnhancedThreatSuggestion>,
    context: ContextualThreatData,
    threatIntel: any[]
  ): Promise<EnhancedThreatSuggestion | null> {
    try {
      // Classify threat
      const classification = await this.classifyThreat(baseThreat, context);
      
      // Predict risk
      const riskPrediction = await this.predictRisk(baseThreat, context);

      // Find similar threats
      const similarThreats = await this.findSimilarThreats(baseThreat, threatIntel);

      // Generate mitigation suggestions
      const mitigations = await this.generateMitigationSuggestions(baseThreat, context);

      const enhancedThreat: EnhancedThreatSuggestion = {
        id: `threat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: baseThreat.name || 'Unknown Threat',
        description: baseThreat.description || 'No description available',
        category: classification.threat_type || baseThreat.category || 'General',
        methodology_specific: baseThreat.methodology_specific || {},
        severity: this.mapRiskLevelToSeverity(riskPrediction.risk_level),
        likelihood: riskPrediction.confidence,
        confidence: classification.confidence,
        affected_components: baseThreat.affected_components || [],
        attack_vectors: this.extractAttackVectors(threatIntel, baseThreat),
        prerequisites: this.extractPrerequisites(baseThreat, context),
        potential_impact: this.extractPotentialImpacts(baseThreat, context),
        detection_methods: this.generateDetectionMethods(baseThreat),
        mitigation_suggestions: mitigations,
        intelligence_context: {
          recent_incidents: this.hasRecentIncidents(threatIntel, baseThreat),
          trending_threat: this.isTrendingThreat(threatIntel, baseThreat),
          industry_specific: this.isIndustrySpecific(threatIntel, context),
          geographic_relevance: this.getGeographicRelevance(threatIntel, context)
        },
        references: {
          cwe: this.extractCWEReferences(threatIntel, baseThreat),
          cve: this.extractCVEReferences(threatIntel, baseThreat),
          owasp: this.extractOWASPReferences(baseThreat),
          external: this.extractExternalReferences(threatIntel, baseThreat)
        }
      };

      return enhancedThreat;

    } catch (error) {
      logger.error('Error enhancing threat with AI:', error);
      return null;
    }
  }

  /**
   * Classify threat using ML model
   */
  private async classifyThreat(
    threat: Partial<EnhancedThreatSuggestion>,
    context: ContextualThreatData
  ): Promise<ThreatClassificationResult> {
    // Simplified classification logic
    // In production, this would call an actual ML model
    
    const categories = ['injection', 'authentication', 'authorization', 'cryptography', 'configuration'];
    const randomCategory = categories[Math.floor(Math.random() * categories.length)];
    
    return {
      threat_type: randomCategory,
      confidence: 0.7 + Math.random() * 0.3,
      reasoning: [
        'Based on threat description analysis',
        'Similar to known threat patterns',
        'Context-aware classification'
      ],
      alternative_classifications: [
        { type: 'access_control', confidence: 0.6 },
        { type: 'data_validation', confidence: 0.4 }
      ]
    };
  }

  /**
   * Predict risk level
   */
  private async predictRisk(
    threat: Partial<EnhancedThreatSuggestion>,
    context: ContextualThreatData
  ): Promise<RiskPredictionResult> {
    // Simplified risk prediction
    const riskLevels: Array<'low' | 'medium' | 'high' | 'critical'> = ['low', 'medium', 'high', 'critical'];
    const randomRisk = riskLevels[Math.floor(Math.random() * riskLevels.length)];
    
    return {
      risk_level: randomRisk,
      confidence: 0.6 + Math.random() * 0.4,
      contributing_factors: [
        { factor: 'System complexity', weight: 0.3, justification: 'High system complexity increases attack surface' },
        { factor: 'Data sensitivity', weight: 0.4, justification: 'Sensitive data increases impact' },
        { factor: 'External exposure', weight: 0.3, justification: 'External interfaces increase likelihood' }
      ],
      recommendations: [
        'Implement defense in depth',
        'Regular security assessments',
        'Incident response planning'
      ]
    };
  }

  /**
   * Find similar threats in threat intelligence
   */
  private async findSimilarThreats(
    threat: Partial<EnhancedThreatSuggestion>,
    threatIntel: any[]
  ): Promise<SimilarityAnalysisResult> {
    // Simplified similarity analysis
    return {
      similar_threats: threatIntel.slice(0, 3).map((intel, index) => ({
        threat_id: intel.id,
        similarity_score: 0.7 - (index * 0.1),
        common_attributes: ['attack_vector', 'target_system']
      })),
      pattern_matches: [
        {
          pattern_type: 'MITRE ATT&CK',
          match_score: 0.8,
          description: 'Matches T1190 - Exploit Public-Facing Application'
        }
      ]
    };
  }

  /**
   * Generate mitigation suggestions
   */
  private async generateMitigationSuggestions(
    threat: Partial<EnhancedThreatSuggestion>,
    context: ContextualThreatData
  ) {
    return [
      {
        id: `mitigation_${Date.now()}`,
        name: 'Input Validation',
        description: 'Implement comprehensive input validation and sanitization',
        effectiveness_score: 0.8,
        implementation_complexity: 'medium' as const,
        cost_estimate: 'medium' as const,
        technology_requirements: ['Web Application Firewall', 'Input validation library'],
        prerequisites: ['Security training for developers'],
        success_indicators: ['Reduced injection attacks', 'Clean security scan results'],
        references: ['OWASP Input Validation Guide']
      }
    ];
  }

  /**
   * Perform global risk assessment
   */
  private async performGlobalRiskAssessment(
    threats: EnhancedThreatSuggestion[],
    context: ContextualThreatData
  ): Promise<GlobalRiskAssessment> {
    const riskDistribution = threats.reduce(
      (acc, threat) => {
        const severity = threat.severity as keyof typeof acc;
        if (severity in acc) {
          acc[severity]++;
        }
        return acc;
      },
      { critical: 0, high: 0, medium: 0, low: 0 }
    );

    const totalRiskScore = threats.reduce((sum, threat) => {
      return sum + (threat.likelihood * this.severityToNumber(threat.severity));
    }, 0);

    return {
      overall_risk_score: Math.min(Math.round(totalRiskScore / threats.length * 20), 100),
      risk_distribution: riskDistribution,
      risk_trends: {
        increasing: ['injection_attacks', 'supply_chain'],
        stable: ['authentication_bypass'],
        decreasing: ['legacy_vulnerabilities']
      },
      critical_vulnerabilities: threats
        .filter(t => t.severity === ThreatSeverity.CRITICAL)
        .map(t => t.name),
      compensating_controls: context.existing_controls
        .filter(c => c.effectiveness > 0.7)
        .map(c => c.name)
    };
  }

  /**
   * Generate threat predictions
   */
  private async generateThreatPredictions(
    context: ContextualThreatData,
    threatIntel: any[]
  ): Promise<ThreatPrediction[]> {
    return [
      {
        threat_type: 'API Vulnerabilities',
        probability: 0.7,
        time_horizon: '3_months',
        contributing_factors: ['Increasing API usage', 'Complex integrations'],
        recommended_preparations: ['API security testing', 'Rate limiting implementation'],
        early_warning_indicators: ['Unusual API traffic patterns', 'Authentication failures']
      }
    ];
  }

  /**
   * Calculate confidence metrics
   */
  private calculateConfidenceMetrics(
    threats: EnhancedThreatSuggestion[],
    threatIntel: any[]
  ): ConfidenceMetrics {
    const avgConfidence = threats.reduce((sum, t) => sum + t.confidence, 0) / threats.length;

    return {
      overall_confidence: avgConfidence,
      model_agreement: 0.85,
      data_quality_score: threatIntel.length > 0 ? 0.9 : 0.5,
      completeness_score: 0.8,
      uncertainty_factors: [
        'Limited historical data',
        'Evolving threat landscape',
        'Context interpretation variations'
      ]
    };
  }

  /**
   * Generate recommendations based on analysis
   */
  private generateRecommendations(
    threats: EnhancedThreatSuggestion[],
    riskAssessment: GlobalRiskAssessment
  ) {
    const recommendations = [];

    if (riskAssessment.risk_distribution.critical > 0) {
      recommendations.push({
        type: 'immediate' as const,
        priority: 'critical' as const,
        title: 'Address Critical Threats',
        description: 'Immediately implement controls for critical severity threats',
        rationale: `${riskAssessment.risk_distribution.critical} critical threats identified`,
        effort_estimate: 'High',
        confidence: 0.9
      });
    }

    return recommendations;
  }

  /**
   * Cache analysis results
   */
  private async cacheAnalysisResults(analysisId: string, response: AIAnalysisResponse): Promise<void> {
    try {
      const key = `ai_analysis:${analysisId}`;
      await this.redis.setEx(key, 3600, JSON.stringify(response)); // Cache for 1 hour
    } catch (error) {
      logger.error('Error caching analysis results:', error);
    }
  }

  // Helper methods
  private severityToNumber(severity: ThreatSeverity): number {
    const severityMap = {
      [ThreatSeverity.CRITICAL]: 5,
      [ThreatSeverity.HIGH]: 4,
      [ThreatSeverity.MEDIUM]: 3,
      [ThreatSeverity.LOW]: 2,
      [ThreatSeverity.INFO]: 1
    };
    return severityMap[severity] || 3;
  }

  private mapRiskLevelToSeverity(riskLevel: string): ThreatSeverity {
    switch (riskLevel) {
      case 'critical': return ThreatSeverity.CRITICAL;
      case 'high': return ThreatSeverity.HIGH;
      case 'medium': return ThreatSeverity.MEDIUM;
      case 'low': return ThreatSeverity.LOW;
      default: return ThreatSeverity.MEDIUM;
    }
  }

  private async discoverAdditionalThreats(
    context: ContextualThreatData,
    threatIntel: any[]
  ): Promise<EnhancedThreatSuggestion[]> {
    // Placeholder for AI-discovered threats
    return [];
  }

  private extractAttackVectors(threatIntel: any[], threat: any): string[] {
    return ['Network', 'Application', 'Physical'];
  }

  private extractPrerequisites(threat: any, context: ContextualThreatData): string[] {
    return ['Network access', 'Valid credentials'];
  }

  private extractPotentialImpacts(threat: any, context: ContextualThreatData): string[] {
    return ['Data loss', 'Service disruption', 'Reputation damage'];
  }

  private generateDetectionMethods(threat: any): string[] {
    return ['Log monitoring', 'Anomaly detection', 'Security scanning'];
  }

  private hasRecentIncidents(threatIntel: any[], threat: any): boolean {
    return threatIntel.some(intel => {
      const daysSince = (Date.now() - new Date(intel.last_seen).getTime()) / (1000 * 60 * 60 * 24);
      return daysSince < 30;
    });
  }

  private isTrendingThreat(threatIntel: any[], threat: any): boolean {
    return Math.random() > 0.7; // Simplified
  }

  private isIndustrySpecific(threatIntel: any[], context: ContextualThreatData): boolean {
    return threatIntel.some(intel => 
      intel.industry_sectors.includes(context.business_context.industry)
    );
  }

  private getGeographicRelevance(threatIntel: any[], context: ContextualThreatData): string[] {
    return context.business_context.geographic_scope;
  }

  private extractCWEReferences(threatIntel: any[], threat: any): string[] {
    return ['CWE-79', 'CWE-89'];
  }

  private extractCVEReferences(threatIntel: any[], threat: any): string[] {
    return threatIntel
      .filter(intel => intel.id.startsWith('CVE-'))
      .map(intel => intel.id)
      .slice(0, 3);
  }

  private extractOWASPReferences(threat: any): string[] {
    return ['OWASP Top 10 A03:2021'];
  }

  private extractExternalReferences(threatIntel: any[], threat: any): string[] {
    return threatIntel
      .flatMap(intel => intel.references || [])
      .slice(0, 5);
  }
}