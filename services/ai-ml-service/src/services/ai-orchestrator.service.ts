import { logger, mlLogger } from '../utils/logger';
import { ThreatClassifierService } from './threat-classifier.service';
import { VulnerabilityPredictorService } from './vulnerability-predictor.service';
import { MitigationRecommenderService } from './mitigation-recommender.service';
import { PatternRecognizerService } from './pattern-recognizer.service';
import { ThreatIntelligenceService } from './threat-intelligence.service';
import { CacheService } from './cache.service';
import { ThreatIntelligenceNLPService } from './threat-intelligence-nlp.service';
import { EntityExtractionService } from './entity-extraction.service';
import { SentimentAnalysisService } from './sentiment-analysis.service';
import { SecurityTextClassifierService } from './security-text-classifier.service';
import {
  AnalysisRequest,
  AnalysisResponse,
  AnalysisOptions,
  PredictionRequest,
  PredictionResponse,
  ModelType,
  RiskLevel,
  PredictedThreat,
  VulnerabilityPrediction,
  ThreatPattern,
  MitigationRecommendation,
  ThreatIntelligence,
} from '../types';
import { config } from '../config';

export class AIOrchestrator {
  private threatClassifier: ThreatClassifierService;
  private vulnerabilityPredictor: VulnerabilityPredictorService;
  private mitigationRecommender: MitigationRecommenderService;
  private patternRecognizer: PatternRecognizerService;
  private threatIntelligence: ThreatIntelligenceService;
  private cache: CacheService;
  private threatIntelligenceNLP: ThreatIntelligenceNLPService;
  private entityExtraction: EntityExtractionService;
  private sentimentAnalysis: SentimentAnalysisService;
  private securityTextClassifier: SecurityTextClassifierService;

  constructor() {
    this.threatClassifier = new ThreatClassifierService();
    this.vulnerabilityPredictor = new VulnerabilityPredictorService();
    this.mitigationRecommender = new MitigationRecommenderService();
    this.patternRecognizer = new PatternRecognizerService();
    this.threatIntelligence = new ThreatIntelligenceService();
    this.cache = new CacheService();
    this.threatIntelligenceNLP = new ThreatIntelligenceNLPService();
    this.entityExtraction = new EntityExtractionService();
    this.sentimentAnalysis = new SentimentAnalysisService();
    this.securityTextClassifier = new SecurityTextClassifierService();
  }

  /**
   * Initialize all AI/ML services
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing AI orchestrator...');
      
      await Promise.all([
        this.threatClassifier.initialize(),
        this.vulnerabilityPredictor.initialize(),
        this.mitigationRecommender.initialize(),
        this.patternRecognizer.initialize(),
        this.threatIntelligence.initialize(),
        this.threatIntelligenceNLP.initialize(),
        this.entityExtraction.initialize(),
        this.sentimentAnalysis.initialize(),
        this.securityTextClassifier.initialize(),
      ]);

      mlLogger.systemStartup(9, this.cache.getSize());
      logger.info('AI orchestrator initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize AI orchestrator:', error);
      throw error;
    }
  }

  /**
   * Perform comprehensive AI analysis
   */
  async analyze(request: AnalysisRequest): Promise<AnalysisResponse> {
    const startTime = Date.now();
    const cacheKey = this.generateCacheKey(request);

    try {
      // Check cache first
      const cached = await this.cache.get<AnalysisResponse>(cacheKey);
      if (cached) {
        mlLogger.cacheHit('analysis', cacheKey);
        return cached;
      }

      mlLogger.cacheMiss('analysis', cacheKey);

      // Run parallel predictions based on options
      const options = request.options || this.getDefaultOptions();
      const predictions = await this.runParallelPredictions(request, options);

      // Aggregate and correlate results
      const analysis = this.aggregateResults(predictions, request);

      // Generate summary
      const summary = this.generateSummary(analysis);

      const response: AnalysisResponse = {
        success: true,
        projectId: request.projectId,
        analysis,
        summary,
        timestamp: new Date(),
      };

      // Cache the response
      await this.cache.set(cacheKey, response, config.CACHE_TTL);

      const processingTime = Date.now() - startTime;
      mlLogger.performanceMetric('comprehensive-analysis', processingTime, {
        componentsAnalyzed: request.components.length,
        modelsUsed: Object.keys(predictions).length,
      });

      return response;

    } catch (error: any) {
      logger.error('Analysis failed:', error);
      throw error;
    }
  }

  /**
   * Run predictions in parallel
   */
  private async runParallelPredictions(
    request: AnalysisRequest,
    options: AnalysisOptions
  ): Promise<PredictionResults> {
    const predictions: PredictionResults = {};
    const promises: Promise<void>[] = [];

    // Always run threat classification
    promises.push(
      this.runThreatClassification(request).then(result => {
        predictions.threats = result;
      })
    );

    // Conditional predictions based on options
    if (options.includeVulnerabilityPrediction !== false) {
      promises.push(
        this.runVulnerabilityPrediction(request).then(result => {
          predictions.vulnerabilities = result;
        })
      );
    }

    if (options.includePatternRecognition !== false) {
      promises.push(
        this.runPatternRecognition(request).then(result => {
          predictions.patterns = result;
        })
      );
    }

    if (options.includeThreatIntelligence) {
      promises.push(
        this.runThreatIntelligence(request).then(result => {
          predictions.intelligence = result;
        })
      );
    }

    // Add NLP analysis if enabled
    if (options.includeNLPAnalysis !== false) {
      promises.push(
        this.runNLPAnalysis(request).then(result => {
          predictions.nlpAnalysis = result;
        })
      );

      promises.push(
        this.runEntityExtraction(request).then(result => {
          predictions.entities = result;
        })
      );

      promises.push(
        this.runSentimentAnalysis(request).then(result => {
          predictions.sentiment = result;
        })
      );

      promises.push(
        this.runSecurityTextClassification(request).then(result => {
          predictions.textClassification = result;
        })
      );
    }

    await Promise.all(promises);

    // Run mitigation recommendations after threats are identified
    if (options.includeMitigationRecommendations !== false && predictions.threats) {
      predictions.mitigations = await this.runMitigationRecommendation(
        predictions.threats,
        predictions.vulnerabilities
      );
    }

    return predictions;
  }

  /**
   * Run threat classification
   */
  private async runThreatClassification(request: AnalysisRequest): Promise<PredictionResponse> {
    const predictionRequest: PredictionRequest = {
      modelType: ModelType.THREAT_CLASSIFIER,
      input: {
        components: request.components,
        threatModel: request.threatModel,
      },
      context: {
        projectId: request.projectId,
      },
      options: {
        threshold: request.options?.confidenceThreshold,
      },
    };

    return this.threatClassifier.classifyThreats(predictionRequest);
  }

  /**
   * Run vulnerability prediction
   */
  private async runVulnerabilityPrediction(request: AnalysisRequest): Promise<PredictionResponse> {
    const predictionRequest: PredictionRequest = {
      modelType: ModelType.VULNERABILITY_PREDICTOR,
      input: request.components,
      context: {
        projectId: request.projectId,
      },
      options: {
        threshold: request.options?.confidenceThreshold,
      },
    };

    return this.vulnerabilityPredictor.predictVulnerabilities(predictionRequest);
  }

  /**
   * Run pattern recognition
   */
  private async runPatternRecognition(request: AnalysisRequest): Promise<PredictionResponse> {
    const predictionRequest: PredictionRequest = {
      modelType: ModelType.PATTERN_RECOGNIZER,
      input: {
        text: this.componentsToText(request.components),
        components: request.components,
        events: this.extractEvents(request),
      },
      context: {
        projectId: request.projectId,
      },
    };

    return this.patternRecognizer.recognizePatterns(predictionRequest);
  }

  /**
   * Run threat intelligence query
   */
  private async runThreatIntelligence(request: AnalysisRequest): Promise<PredictionResponse> {
    const predictionRequest: PredictionRequest = {
      modelType: 'THREAT_INTELLIGENCE' as any,
      input: {
        description: this.componentsToText(request.components),
        technologies: this.extractTechnologies(request.components),
        indicators: this.extractIndicators(request),
      },
    };

    return this.threatIntelligence.queryIntelligence(predictionRequest);
  }

  /**
   * Run mitigation recommendations
   */
  private async runMitigationRecommendation(
    threats: PredictionResponse,
    vulnerabilities?: PredictionResponse
  ): Promise<PredictionResponse> {
    // Combine threats and vulnerabilities
    const allThreats = this.combineThreatsAndVulnerabilities(threats, vulnerabilities);

    const predictionRequest: PredictionRequest = {
      modelType: ModelType.MITIGATION_RECOMMENDER,
      input: {
        threats: allThreats,
      },
    };

    return this.mitigationRecommender.recommendMitigations(predictionRequest);
  }

  /**
   * Aggregate results from all models
   */
  private aggregateResults(predictions: PredictionResults, request: AnalysisRequest): any {
    const threats = this.extractThreats(predictions.threats);
    const vulnerabilities = this.extractVulnerabilities(predictions.vulnerabilities);
    const patterns = this.extractPatterns(predictions.patterns);
    const mitigations = this.extractMitigations(predictions.mitigations);
    const intelligence = this.extractIntelligence(predictions.intelligence);

    // Process NLP results if available
    const nlpEnhancements = this.processNLPResults(predictions);

    // Correlate and enhance results
    const enhancedThreats = this.enhanceThreatsWithIntelligence(threats, intelligence);
    const nlpEnhancedThreats = this.enhanceThreatsWithNLP(enhancedThreats, nlpEnhancements);
    const correlatedResults = this.correlateResults(nlpEnhancedThreats, vulnerabilities, patterns);

    return {
      threats: correlatedResults.threats,
      vulnerabilities: correlatedResults.vulnerabilities,
      patterns,
      mitigations,
      intelligence,
      nlpAnalysis: nlpEnhancements,
    };
  }

  /**
   * Extract threats from prediction response
   */
  private extractThreats(response?: PredictionResponse): PredictedThreat[] {
    if (!response || !response.predictions) return [];

    return response.predictions.map((pred, index) => ({
      id: `threat-${index}`,
      type: pred.label,
      category: this.categorizeThread(pred.label),
      probability: pred.confidence,
      impact: this.assessImpact(pred.confidence),
      affectedComponents: [],
      description: pred.explanation || '',
      evidence: pred.evidence || [],
    }));
  }

  /**
   * Extract vulnerabilities from prediction response
   */
  private extractVulnerabilities(response?: PredictionResponse): VulnerabilityPrediction[] {
    if (!response || !response.predictions) return [];

    // The vulnerability predictor returns component-level predictions
    // We need to parse them appropriately
    const vulnerabilities: VulnerabilityPrediction[] = [];
    
    response.predictions.forEach(pred => {
      if (pred.suggestedMitigations) {
        // Extract vulnerability data from the prediction
        vulnerabilities.push({
          componentId: pred.label.replace('Component ', ''),
          vulnerabilities: [], // Would be populated from actual prediction data
          overallRisk: RiskLevel.MEDIUM,
          recommendations: pred.suggestedMitigations.map(m => m.title),
        });
      }
    });

    return vulnerabilities;
  }

  /**
   * Extract patterns from prediction response
   */
  private extractPatterns(response?: PredictionResponse): ThreatPattern[] {
    if (!response || !response.predictions) return [];

    return response.predictions.map((pred, index) => ({
      id: `pattern-${index}`,
      name: pred.label,
      category: 'Detected Pattern',
      indicators: pred.evidence?.map(e => ({
        type: 'evidence',
        value: e.description,
        weight: e.relevance,
      })) || [],
      confidence: pred.confidence,
      frequency: 1,
      lastSeen: new Date(),
    }));
  }

  /**
   * Extract mitigations from prediction response
   */
  private extractMitigations(response?: PredictionResponse): MitigationRecommendation[] {
    if (!response || !response.predictions) return [];

    return response.predictions.map((pred, index) => ({
      threatId: pred.label.replace('Threat ', ''),
      mitigations: pred.suggestedMitigations || [],
      priority: this.calculatePriority(pred.confidence),
      estimatedEffort: {
        hours: 40,
        complexity: 'medium' as const,
        requiredSkills: ['Security Engineering'],
      },
    }));
  }

  /**
   * Extract intelligence from prediction response
   */
  private extractIntelligence(response?: PredictionResponse): ThreatIntelligence[] {
    if (!response || !response.predictions) return [];

    return response.predictions.map((pred, index) => ({
      id: `intel-${index}`,
      source: 'INTERNAL' as any,
      type: pred.label,
      severity: this.assessSeverity(pred.confidence),
      description: pred.explanation || '',
      indicators: pred.evidence?.map(e => e.description) || [],
      mitigations: pred.suggestedMitigations?.map(m => m.title) || [],
      references: [],
      lastUpdated: new Date(),
    }));
  }

  /**
   * Enhance threats with intelligence data
   */
  private enhanceThreatsWithIntelligence(
    threats: PredictedThreat[],
    intelligence: ThreatIntelligence[]
  ): PredictedThreat[] {
    return threats.map(threat => {
      const relatedIntel = intelligence.find(intel => 
        intel.type.toLowerCase().includes(threat.type.toLowerCase())
      );

      if (relatedIntel) {
        return {
          ...threat,
          description: threat.description + ' ' + relatedIntel.description,
          evidence: [...threat.evidence, ...this.intelligenceToEvidence(relatedIntel)],
        };
      }

      return threat;
    });
  }

  /**
   * Convert intelligence to evidence
   */
  private intelligenceToEvidence(intel: ThreatIntelligence): any[] {
    return [{
      source: `Threat Intelligence - ${intel.source}`,
      relevance: 0.8,
      description: intel.description,
    }];
  }

  /**
   * Correlate results across models
   */
  private correlateResults(
    threats: PredictedThreat[],
    vulnerabilities: VulnerabilityPrediction[],
    patterns: ThreatPattern[]
  ): any {
    // Map threats to affected components
    threats.forEach(threat => {
      vulnerabilities.forEach(vuln => {
        if (this.isThreatRelatedToVulnerability(threat, vuln)) {
          threat.affectedComponents.push(vuln.componentId);
        }
      });
    });

    // Adjust threat probabilities based on patterns
    threats.forEach(threat => {
      const relatedPattern = patterns.find(p => 
        p.name.toLowerCase().includes(threat.type.toLowerCase())
      );
      
      if (relatedPattern) {
        threat.probability = Math.min(
          threat.probability * 1.2,
          0.95
        );
      }
    });

    return { threats, vulnerabilities };
  }

  /**
   * Check if threat is related to vulnerability
   */
  private isThreatRelatedToVulnerability(
    threat: PredictedThreat,
    vuln: VulnerabilityPrediction
  ): boolean {
    // Simple heuristic - in production this would be more sophisticated
    const threatTypes = threat.type.toLowerCase();
    const vulnTypes = vuln.recommendations.join(' ').toLowerCase();
    
    return threatTypes.split(' ').some(word => vulnTypes.includes(word));
  }

  /**
   * Generate analysis summary
   */
  private generateSummary(analysis: any): any {
    const threats = analysis.threats || [];
    const vulnerabilities = analysis.vulnerabilities || [];
    const patterns = analysis.patterns || [];
    const mitigations = analysis.mitigations || [];

    const criticalThreats = threats.filter((t: PredictedThreat) => 
      t.impact === 'critical' || t.probability > 0.8
    ).length;

    const highRiskComponents = new Set<string>();
    vulnerabilities.forEach((v: VulnerabilityPrediction) => {
      if (v.overallRisk === RiskLevel.HIGH || v.overallRisk === RiskLevel.CRITICAL) {
        highRiskComponents.add(v.componentId);
      }
    });

    const overallRisk = this.calculateOverallRisk(threats, vulnerabilities);
    const topRecommendations = this.getTopRecommendations(mitigations);

    return {
      totalThreats: threats.length,
      criticalThreats,
      highRiskComponents: Array.from(highRiskComponents),
      overallRiskLevel: overallRisk,
      topRecommendations,
      confidenceScore: this.calculateConfidenceScore(analysis),
    };
  }

  /**
   * Calculate overall risk level
   */
  private calculateOverallRisk(
    threats: PredictedThreat[],
    vulnerabilities: VulnerabilityPrediction[]
  ): RiskLevel {
    const threatScore = threats.reduce((sum, t) => 
      sum + t.probability * this.impactToScore(t.impact), 0
    );
    
    const vulnScore = vulnerabilities.reduce((sum, v) => 
      sum + this.riskLevelToScore(v.overallRisk), 0
    );

    const totalScore = threatScore + vulnScore;

    if (totalScore > 10) return RiskLevel.CRITICAL;
    if (totalScore > 7) return RiskLevel.HIGH;
    if (totalScore > 4) return RiskLevel.MEDIUM;
    if (totalScore > 1) return RiskLevel.LOW;
    return RiskLevel.MINIMAL;
  }

  /**
   * Get top recommendations
   */
  private getTopRecommendations(mitigations: MitigationRecommendation[]): string[] {
    const allMitigations = mitigations
      .filter(m => m.priority === 'immediate' || m.priority === 'high')
      .flatMap(m => m.mitigations)
      .slice(0, 5);

    return allMitigations.map(m => m.title);
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidenceScore(analysis: any): number {
    const scores: number[] = [];
    
    if (analysis.threats?.length > 0) {
      const avgThreatConf = analysis.threats.reduce((sum: number, t: PredictedThreat) => 
        sum + t.probability, 0
      ) / analysis.threats.length;
      scores.push(avgThreatConf);
    }

    if (analysis.patterns?.length > 0) {
      const avgPatternConf = analysis.patterns.reduce((sum: number, p: ThreatPattern) => 
        sum + p.confidence, 0
      ) / analysis.patterns.length;
      scores.push(avgPatternConf);
    }

    return scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0.5;
  }

  /**
   * Helper methods
   */
  private getDefaultOptions(): AnalysisOptions {
    return {
      includePatternRecognition: true,
      includeVulnerabilityPrediction: true,
      includeMitigationRecommendations: true,
      includeThreatIntelligence: false,
      confidenceThreshold: config.CONFIDENCE_THRESHOLD,
    };
  }

  private generateCacheKey(request: AnalysisRequest): string {
    return `analysis:${request.projectId}:${JSON.stringify(request.components).substring(0, 50)}`;
  }

  private componentsToText(components: any[]): string {
    return components.map(c => c.description || c.type || '').join(' ');
  }

  private extractTechnologies(components: any[]): string[] {
    return components.flatMap(c => c.technologies || []);
  }

  private extractIndicators(request: AnalysisRequest): string[] {
    // Extract potential indicators from components
    return [];
  }

  private extractEvents(request: AnalysisRequest): string[] {
    // Extract events if available
    return [];
  }

  private categorizeThread(type: string): string {
    const categories: Record<string, string> = {
      'spoofing': 'Authentication',
      'tampering': 'Integrity',
      'repudiation': 'Non-repudiation',
      'information disclosure': 'Confidentiality',
      'denial of service': 'Availability',
      'elevation of privilege': 'Authorization',
    };

    const lowerType = type.toLowerCase();
    for (const [key, value] of Object.entries(categories)) {
      if (lowerType.includes(key)) return value;
    }

    return 'General';
  }

  private assessImpact(confidence: number): string {
    if (confidence > 0.8) return 'critical';
    if (confidence > 0.6) return 'high';
    if (confidence > 0.4) return 'medium';
    return 'low';
  }

  private assessSeverity(confidence: number): 'critical' | 'high' | 'medium' | 'low' {
    if (confidence > 0.8) return 'critical';
    if (confidence > 0.6) return 'high';
    if (confidence > 0.4) return 'medium';
    return 'low';
  }

  private calculatePriority(confidence: number): 'immediate' | 'high' | 'medium' | 'low' {
    if (confidence > 0.8) return 'immediate';
    if (confidence > 0.6) return 'high';
    if (confidence > 0.4) return 'medium';
    return 'low';
  }

  private impactToScore(impact: string): number {
    const scores: Record<string, number> = {
      'critical': 1.0,
      'high': 0.8,
      'medium': 0.5,
      'low': 0.3,
    };
    return scores[impact] || 0.5;
  }

  private riskLevelToScore(risk: RiskLevel): number {
    const scores: Record<RiskLevel, number> = {
      [RiskLevel.CRITICAL]: 1.0,
      [RiskLevel.HIGH]: 0.8,
      [RiskLevel.MEDIUM]: 0.5,
      [RiskLevel.LOW]: 0.3,
      [RiskLevel.MINIMAL]: 0.1,
    };
    return scores[risk];
  }

  private combineThreatsAndVulnerabilities(
    threats: PredictionResponse,
    vulnerabilities?: PredictionResponse
  ): any[] {
    const allThreats: any[] = [];
    
    if (threats.predictions) {
      allThreats.push(...this.extractThreats(threats));
    }
    
    if (vulnerabilities?.predictions) {
      // Convert vulnerabilities to threat format for mitigation analysis
      vulnerabilities.predictions.forEach(vuln => {
        allThreats.push({
          id: `vuln-${vuln.label}`,
          type: vuln.label,
          description: vuln.explanation || '',
          probability: vuln.confidence,
          impact: 'high',
        });
      });
    }
    
    return allThreats;
  }

  /**
   * Run NLP analysis on threat intelligence documents
   */
  private async runNLPAnalysis(request: AnalysisRequest): Promise<any> {
    try {
      const text = this.componentsToText(request.components);
      const description = request.threatModel?.description || '';
      const fullText = `${text} ${description}`;

      const nlpRequest = {
        text: fullText,
        documentType: 'threat-model' as const,
        options: {
          includeEntities: true,
          includeRelationships: true,
          includeSummary: true,
        },
      };

      return await this.threatIntelligenceNLP.parseThreatIntelligence(nlpRequest);
    } catch (error) {
      logger.error('NLP analysis failed:', error);
      return null;
    }
  }

  /**
   * Run entity extraction on components
   */
  private async runEntityExtraction(request: AnalysisRequest): Promise<any> {
    try {
      const text = this.componentsToText(request.components);
      
      const extractionRequest = {
        text,
        options: {
          extractIOCs: true,
          extractTTPs: true,
          validateEntities: true,
          enrichEntities: true,
        },
      };

      return await this.entityExtraction.extractEntities(extractionRequest);
    } catch (error) {
      logger.error('Entity extraction failed:', error);
      return null;
    }
  }

  /**
   * Run sentiment analysis on security communications
   */
  private async runSentimentAnalysis(request: AnalysisRequest): Promise<any> {
    try {
      const text = this.componentsToText(request.components);
      
      const sentimentRequest = {
        text,
        context: {
          domain: 'security',
          documentType: 'threat-model',
        },
      };

      return await this.sentimentAnalysis.analyzeSentiment(sentimentRequest);
    } catch (error) {
      logger.error('Sentiment analysis failed:', error);
      return null;
    }
  }

  /**
   * Run security text classification
   */
  private async runSecurityTextClassification(request: AnalysisRequest): Promise<any> {
    try {
      const text = this.componentsToText(request.components);
      
      const classificationRequest = {
        text,
        options: {
          multiLabel: true,
          includeConfidence: true,
          topK: 5,
        },
      };

      return await this.securityTextClassifier.classifyText(classificationRequest);
    } catch (error) {
      logger.error('Text classification failed:', error);
      return null;
    }
  }

  /**
   * Process NLP results and extract key insights
   */
  private processNLPResults(predictions: PredictionResults): any {
    const nlpEnhancements: any = {
      entities: [],
      sentimentScore: 0,
      threatClassifications: [],
      extractedIndicators: [],
      summary: '',
    };

    // Process entity extraction results
    if (predictions.entities) {
      nlpEnhancements.entities = predictions.entities.entities || [];
      nlpEnhancements.extractedIndicators = [
        ...(predictions.entities.iocs || []),
        ...(predictions.entities.ttps || []),
      ];
    }

    // Process sentiment analysis
    if (predictions.sentiment) {
      nlpEnhancements.sentimentScore = predictions.sentiment.overallScore || 0;
      nlpEnhancements.threatPerception = predictions.sentiment.threatPerception || 'neutral';
      nlpEnhancements.urgency = predictions.sentiment.urgency || 'normal';
    }

    // Process text classification
    if (predictions.textClassification) {
      nlpEnhancements.threatClassifications = predictions.textClassification.classifications || [];
    }

    // Process NLP intelligence
    if (predictions.nlpAnalysis) {
      nlpEnhancements.summary = predictions.nlpAnalysis.summary || '';
      nlpEnhancements.keyFindings = predictions.nlpAnalysis.keyFindings || [];
      nlpEnhancements.relationships = predictions.nlpAnalysis.relationships || [];
    }

    return nlpEnhancements;
  }

  /**
   * Enhance threats with NLP insights
   */
  private enhanceThreatsWithNLP(threats: PredictedThreat[], nlpEnhancements: any): PredictedThreat[] {
    return threats.map(threat => {
      const enhancedThreat = { ...threat };

      // Enhance with extracted entities
      if (nlpEnhancements.entities) {
        const relatedEntities = nlpEnhancements.entities.filter((entity: any) =>
          entity.text.toLowerCase().includes(threat.type.toLowerCase()) ||
          threat.description.toLowerCase().includes(entity.text.toLowerCase())
        );

        if (relatedEntities.length > 0) {
          enhancedThreat.evidence = [
            ...enhancedThreat.evidence,
            ...relatedEntities.map((entity: any) => ({
              source: 'NLP Entity Extraction',
              relevance: entity.confidence || 0.7,
              description: `Detected ${entity.type}: ${entity.text}`,
            })),
          ];
        }
      }

      // Adjust threat probability based on sentiment
      if (nlpEnhancements.urgency === 'critical') {
        enhancedThreat.probability = Math.min(enhancedThreat.probability * 1.2, 0.95);
      }

      // Add NLP-based classifications
      if (nlpEnhancements.threatClassifications) {
        const relevantClassifications = nlpEnhancements.threatClassifications.filter((cls: any) =>
          cls.confidence > 0.6
        );

        enhancedThreat.nlpClassifications = relevantClassifications;
      }

      return enhancedThreat;
    });
  }

  /**
   * Get service health status
   */
  getHealth(): any {
    return {
      status: 'healthy',
      models: {
        threatClassifier: this.threatClassifier.getModelStats(),
        vulnerabilityPredictor: this.vulnerabilityPredictor.getModelStats(),
        mitigationRecommender: this.mitigationRecommender.getModelStats(),
        patternRecognizer: this.patternRecognizer.getModelStats(),
        threatIntelligence: this.threatIntelligence.getThreatStats(),
      },
      nlpServices: {
        threatIntelligenceNLP: 'initialized',
        entityExtraction: 'initialized',
        sentimentAnalysis: 'initialized',
        securityTextClassifier: 'initialized',
      },
      cache: {
        size: this.cache.getSize(),
        hitRate: this.cache.getHitRate(),
      },
      timestamp: new Date(),
    };
  }

  /**
   * Shutdown all services
   */
  async shutdown(): Promise<void> {
    this.threatIntelligence.shutdown();
    await this.cache.shutdown();
    
    mlLogger.systemShutdown('graceful', process.uptime());
    logger.info('AI orchestrator shutdown complete');
  }
}

interface PredictionResults {
  threats?: PredictionResponse;
  vulnerabilities?: PredictionResponse;
  patterns?: PredictionResponse;
  mitigations?: PredictionResponse;
  intelligence?: PredictionResponse;
  nlpAnalysis?: any;
  entities?: any;
  sentiment?: any;
  textClassification?: any;
}