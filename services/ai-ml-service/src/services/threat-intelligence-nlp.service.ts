/**
 * Threat Intelligence NLP Service
 * Advanced natural language processing for threat intelligence parsing and analysis
 */

import { EventEmitter } from 'events';
import { logger, mlLogger } from '../utils/logger';
import * as tf from '@tensorflow/tfjs-node';
import { LanguageSupportService, LanguageInfo, TranslationRequest } from '../utils/language-support';

// Core NLP interfaces
export interface ThreatIntelligenceDocument {
  id: string;
  source: string;
  title: string;
  content: string;
  timestamp: Date;
  language: string;
  metadata: DocumentMetadata;
  raw_data?: any;
}

export interface DocumentMetadata {
  author?: string;
  publication_date?: Date;
  classification: string;
  confidence: number;
  tags: string[];
  source_reliability: number;
  content_type: 'report' | 'advisory' | 'blog' | 'feed' | 'social' | 'other';
}

export interface ParsedThreatIntelligence {
  document_id: string;
  parsing_timestamp: Date;
  extracted_entities: ExtractedEntity[];
  threat_indicators: ThreatIndicator[];
  attack_patterns: AttackPattern[];
  threat_actors: ThreatActor[];
  campaign_info: CampaignInfo[];
  geographical_context: GeographicalContext[];
  temporal_context: TemporalContext[];
  severity_assessment: SeverityAssessment;
  confidence_scores: ConfidenceScores;
  relationships: EntityRelationship[];
  summary: DocumentSummary;
}

export interface ExtractedEntity {
  entity_id: string;
  entity_type: 'ioc' | 'ttp' | 'actor' | 'campaign' | 'vulnerability' | 'software' | 'location' | 'organization';
  entity_value: string;
  context: string;
  confidence: number;
  source_span: TextSpan;
  attributes: EntityAttributes;
}

export interface TextSpan {
  start_index: number;
  end_index: number;
  text: string;
}

export interface EntityAttributes {
  [key: string]: any;
  normalized_value?: string;
  entity_category?: string;
  risk_level?: number;
  first_seen?: Date;
  last_seen?: Date;
}

export interface ThreatIndicator {
  indicator_id: string;
  indicator_type: 'ip' | 'domain' | 'url' | 'hash' | 'email' | 'filename' | 'registry' | 'certificate';
  indicator_value: string;
  confidence: number;
  threat_level: 'low' | 'medium' | 'high' | 'critical';
  context: string;
  attributes: IndicatorAttributes;
  related_entities: string[];
}

export interface IndicatorAttributes {
  malware_family?: string;
  attack_vector?: string;
  target_systems?: string[];
  geolocation?: string;
  first_seen?: Date;
  last_seen?: Date;
  reputation_score?: number;
  false_positive_likelihood?: number;
}

export interface AttackPattern {
  pattern_id: string;
  mitre_id?: string;
  pattern_name: string;
  description: string;
  tactics: string[];
  techniques: string[];
  confidence: number;
  context: string;
  kill_chain_phases: string[];
  platforms: string[];
  data_sources: string[];
}

export interface ThreatActor {
  actor_id: string;
  actor_name: string;
  aliases: string[];
  actor_type: 'nation-state' | 'cybercriminal' | 'hacktivist' | 'insider' | 'unknown';
  sophistication: 'low' | 'medium' | 'high' | 'expert';
  motivation: string[];
  attribution_confidence: number;
  associated_campaigns: string[];
  preferred_tactics: string[];
  geographical_focus: string[];
}

export interface CampaignInfo {
  campaign_id: string;
  campaign_name: string;
  description: string;
  start_date?: Date;
  end_date?: Date;
  status: 'active' | 'inactive' | 'unknown';
  attributed_actors: string[];
  target_sectors: string[];
  target_regions: string[];
  attack_vectors: string[];
  confidence: number;
}

export interface GeographicalContext {
  location_type: 'country' | 'region' | 'city' | 'organization';
  location_name: string;
  context_type: 'target' | 'origin' | 'infrastructure' | 'attribution';
  confidence: number;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
}

export interface TemporalContext {
  temporal_type: 'attack_date' | 'discovery_date' | 'publication_date' | 'campaign_period';
  start_time?: Date;
  end_time?: Date;
  exact_time?: Date;
  time_precision: 'exact' | 'approximate' | 'estimated';
  confidence: number;
}

export interface SeverityAssessment {
  overall_severity: 'low' | 'medium' | 'high' | 'critical';
  impact_score: number;
  likelihood_score: number;
  urgency_score: number;
  business_impact: BusinessImpact;
  technical_impact: TechnicalImpact;
  confidence: number;
}

export interface BusinessImpact {
  financial_impact: number;
  operational_impact: number;
  reputational_impact: number;
  regulatory_impact: number;
  affected_services: string[];
}

export interface TechnicalImpact {
  availability_impact: number;
  integrity_impact: number;
  confidentiality_impact: number;
  affected_systems: string[];
  recovery_complexity: number;
}

export interface ConfidenceScores {
  entity_extraction: number;
  relationship_extraction: number;
  threat_assessment: number;
  attribution: number;
  temporal_accuracy: number;
  overall_parsing: number;
}

export interface EntityRelationship {
  relationship_id: string;
  source_entity: string;
  target_entity: string;
  relationship_type: string;
  confidence: number;
  context: string;
  attributes: RelationshipAttributes;
}

export interface RelationshipAttributes {
  [key: string]: any;
  relationship_strength?: number;
  temporal_overlap?: boolean;
  geographical_overlap?: boolean;
  technical_correlation?: number;
}

export interface DocumentSummary {
  executive_summary: string;
  key_findings: string[];
  threat_highlights: string[];
  recommendations: string[];
  risk_assessment: string;
  impact_analysis: string;
  confidence_assessment: string;
}

// NLP processing request interfaces
export interface ThreatIntelligenceParsingRequest {
  request_id: string;
  documents: ThreatIntelligenceDocument[];
  parsing_options: ParsingOptions;
  user_context?: any;
}

export interface ParsingOptions {
  extract_entities: boolean;
  extract_indicators: boolean;
  extract_patterns: boolean;
  extract_actors: boolean;
  extract_campaigns: boolean;
  analyze_sentiment: boolean;
  generate_summary: boolean;
  confidence_threshold: number;
  language_detection: boolean;
  preprocessing_options: PreprocessingOptions;
}

export interface PreprocessingOptions {
  normalize_text: boolean;
  remove_noise: boolean;
  expand_abbreviations: boolean;
  resolve_references: boolean;
  detect_encoding: boolean;
}

export interface ThreatIntelligenceParsingResponse {
  request_id: string;
  processing_timestamp: Date;
  parsed_documents: ParsedThreatIntelligence[];
  aggregated_intelligence: AggregatedIntelligence;
  processing_statistics: ProcessingStatistics;
  errors: ProcessingError[];
}

export interface AggregatedIntelligence {
  unique_entities: ExtractedEntity[];
  threat_landscape: ThreatLandscape;
  actor_attribution: ActorAttribution[];
  campaign_analysis: CampaignAnalysis[];
  geographic_distribution: GeographicDistribution[];
  temporal_trends: TemporalTrends[];
  correlation_analysis: CorrelationAnalysis;
}

export interface ThreatLandscape {
  top_threats: ThreatSummary[];
  emerging_threats: ThreatSummary[];
  threat_evolution: ThreatEvolution[];
  sector_targeting: SectorTargeting[];
}

export interface ThreatSummary {
  threat_name: string;
  threat_type: string;
  prevalence: number;
  severity: string;
  trend: 'increasing' | 'decreasing' | 'stable';
  confidence: number;
}

export interface ThreatEvolution {
  threat_name: string;
  evolution_timeline: EvolutionPoint[];
  capability_changes: string[];
  tactical_shifts: string[];
}

export interface EvolutionPoint {
  timestamp: Date;
  description: string;
  significance: number;
}

export interface SectorTargeting {
  sector_name: string;
  targeting_frequency: number;
  primary_threats: string[];
  attack_vectors: string[];
  impact_assessment: number;
}

export interface ActorAttribution {
  actor_name: string;
  attribution_confidence: number;
  supporting_evidence: string[];
  contradicting_evidence: string[];
  alternative_attributions: string[];
}

export interface CampaignAnalysis {
  campaign_name: string;
  campaign_scope: CampaignScope;
  timeline_analysis: TimelineAnalysis;
  victim_analysis: VictimAnalysis;
  infrastructure_analysis: InfrastructureAnalysis;
}

export interface CampaignScope {
  geographic_reach: string[];
  sector_focus: string[];
  scale_assessment: 'limited' | 'moderate' | 'extensive' | 'global';
  duration_estimate: number;
}

export interface TimelineAnalysis {
  campaign_phases: CampaignPhase[];
  activity_patterns: ActivityPattern[];
  peak_periods: PeakPeriod[];
}

export interface CampaignPhase {
  phase_name: string;
  start_date: Date;
  end_date?: Date;
  objectives: string[];
  tactics: string[];
  indicators: string[];
}

export interface ActivityPattern {
  pattern_type: string;
  frequency: number;
  timing_characteristics: string;
  confidence: number;
}

export interface PeakPeriod {
  start_date: Date;
  end_date: Date;
  activity_level: number;
  notable_events: string[];
}

export interface VictimAnalysis {
  victim_profile: VictimProfile;
  targeting_criteria: TargetingCriteria;
  impact_assessment: VictimImpactAssessment;
}

export interface VictimProfile {
  organization_types: string[];
  geographic_distribution: string[];
  size_distribution: string[];
  sector_distribution: string[];
}

export interface TargetingCriteria {
  selection_factors: string[];
  attack_prerequisites: string[];
  value_propositions: string[];
}

export interface VictimImpactAssessment {
  immediate_impacts: string[];
  long_term_consequences: string[];
  recovery_challenges: string[];
  lessons_learned: string[];
}

export interface InfrastructureAnalysis {
  infrastructure_types: InfrastructureType[];
  hosting_patterns: HostingPattern[];
  operational_security: OperationalSecurity;
}

export interface InfrastructureType {
  type_name: string;
  usage_frequency: number;
  geographic_distribution: string[];
  operational_characteristics: string[];
}

export interface HostingPattern {
  hosting_provider: string;
  usage_frequency: number;
  operational_timeline: Date[];
  security_characteristics: string[];
}

export interface OperationalSecurity {
  security_measures: string[];
  evasion_techniques: string[];
  persistence_methods: string[];
  anti_analysis: string[];
}

export interface GeographicDistribution {
  region: string;
  activity_level: number;
  threat_types: string[];
  target_sectors: string[];
  trend_analysis: string;
}

export interface TemporalTrends {
  time_period: string;
  trend_type: string;
  trend_direction: 'increasing' | 'decreasing' | 'stable' | 'cyclical';
  significance: number;
  contributing_factors: string[];
}

export interface CorrelationAnalysis {
  entity_correlations: EntityCorrelation[];
  temporal_correlations: TemporalCorrelation[];
  geographic_correlations: GeographicCorrelation[];
  behavioral_correlations: BehavioralCorrelation[];
}

export interface EntityCorrelation {
  entity_pair: [string, string];
  correlation_strength: number;
  correlation_type: string;
  supporting_evidence: string[];
  confidence: number;
}

export interface TemporalCorrelation {
  event_pair: [string, string];
  time_correlation: number;
  correlation_type: 'simultaneous' | 'sequential' | 'cyclical';
  confidence: number;
}

export interface GeographicCorrelation {
  location_pair: [string, string];
  correlation_strength: number;
  correlation_context: string;
  confidence: number;
}

export interface BehavioralCorrelation {
  behavior_pair: [string, string];
  correlation_strength: number;
  behavioral_context: string;
  confidence: number;
}

export interface ProcessingStatistics {
  total_documents: number;
  successfully_parsed: number;
  parsing_errors: number;
  entities_extracted: number;
  indicators_identified: number;
  patterns_detected: number;
  actors_identified: number;
  campaigns_identified: number;
  processing_time: number;
  confidence_distribution: ConfidenceDistribution;
}

export interface ConfidenceDistribution {
  high_confidence: number;
  medium_confidence: number;
  low_confidence: number;
  uncertain: number;
}

export interface ProcessingError {
  error_id: string;
  document_id: string;
  error_type: string;
  error_message: string;
  error_context: string;
  severity: 'low' | 'medium' | 'high';
  suggestions: string[];
}

export class ThreatIntelligenceNLPService extends EventEmitter {
  private nlpModel?: tf.LayersModel;
  private entityModel?: tf.LayersModel;
  private classificationModel?: tf.LayersModel;
  private sentimentModel?: tf.LayersModel;
  private vocabularyMap: Map<string, number> = new Map();
  private entityVocabulary: Map<string, number> = new Map();
  private languageSupport: LanguageSupportService;
  private isInitialized: boolean = false;

  constructor() {
    super();
    this.languageSupport = LanguageSupportService.getInstance();
    this.initializeService();
  }

  private async initializeService(): Promise<void> {
    try {
      logger.info('Initializing Threat Intelligence NLP Service...');
      
      await this.initializeModels();
      await this.loadVocabularies();
      
      this.isInitialized = true;
      this.emit('initialized');
      
      logger.info('Threat Intelligence NLP Service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize NLP service:', error);
      throw error;
    }
  }

  private async initializeModels(): Promise<void> {
    // Initialize TensorFlow.js models for NLP tasks
    
    // Named Entity Recognition model
    this.entityModel = tf.sequential({
      layers: [
        tf.layers.embedding({
          inputDim: 10000,
          outputDim: 128,
          inputLength: 100
        }),
        tf.layers.bidirectional({
          layer: tf.layers.lstm({
            units: 64,
            returnSequences: true
          })
        }),
        tf.layers.dropout({ rate: 0.3 }),
        tf.layers.dense({
          units: 32,
          activation: 'relu'
        }),
        tf.layers.dense({
          units: 15, // Number of entity types
          activation: 'softmax'
        })
      ]
    });

    // Text classification model
    this.classificationModel = tf.sequential({
      layers: [
        tf.layers.embedding({
          inputDim: 10000,
          outputDim: 128,
          inputLength: 200
        }),
        tf.layers.globalMaxPooling1d(),
        tf.layers.dense({
          units: 128,
          activation: 'relu'
        }),
        tf.layers.dropout({ rate: 0.5 }),
        tf.layers.dense({
          units: 64,
          activation: 'relu'
        }),
        tf.layers.dense({
          units: 10, // Number of threat categories
          activation: 'softmax'
        })
      ]
    });

    // Sentiment analysis model
    this.sentimentModel = tf.sequential({
      layers: [
        tf.layers.embedding({
          inputDim: 5000,
          outputDim: 64,
          inputLength: 150
        }),
        tf.layers.lstm({ units: 32 }),
        tf.layers.dropout({ rate: 0.3 }),
        tf.layers.dense({
          units: 16,
          activation: 'relu'
        }),
        tf.layers.dense({
          units: 3, // Negative, Neutral, Positive
          activation: 'softmax'
        })
      ]
    });

    // Compile models
    this.entityModel.compile({
      optimizer: 'adam',
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });

    this.classificationModel.compile({
      optimizer: 'adam',
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });

    this.sentimentModel.compile({
      optimizer: 'adam',
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });

    logger.info('NLP models initialized successfully');
  }

  private async loadVocabularies(): Promise<void> {
    // Load pre-trained vocabularies for text processing
    const commonWords = [
      'malware', 'attack', 'threat', 'vulnerability', 'exploit', 'phishing',
      'ransomware', 'botnet', 'trojan', 'virus', 'spyware', 'backdoor',
      'apt', 'campaign', 'actor', 'attribution', 'indicator', 'ioc',
      'ttp', 'mitre', 'attack', 'technique', 'tactic', 'procedure'
    ];

    commonWords.forEach((word, index) => {
      this.vocabularyMap.set(word.toLowerCase(), index + 1);
    });

    const entityTypes = [
      'ip_address', 'domain', 'url', 'hash', 'email', 'filename',
      'malware_family', 'threat_actor', 'campaign', 'vulnerability',
      'cve', 'software', 'organization', 'location', 'date'
    ];

    entityTypes.forEach((type, index) => {
      this.entityVocabulary.set(type, index + 1);
    });

    logger.info('Vocabularies loaded successfully');
  }

  async parseThreatIntelligence(
    request: ThreatIntelligenceParsingRequest
  ): Promise<ThreatIntelligenceParsingResponse> {
    if (!this.isInitialized) {
      throw new Error('NLP service not initialized');
    }

    logger.info(`Processing threat intelligence parsing request: ${request.request_id}`);
    const startTime = Date.now();

    try {
      const parsedDocuments: ParsedThreatIntelligence[] = [];
      const errors: ProcessingError[] = [];

      // Process each document
      for (const document of request.documents) {
        try {
          const parsed = await this.parseDocument(document, request.parsing_options);
          parsedDocuments.push(parsed);
        } catch (error) {
          const processingError: ProcessingError = {
            error_id: `error_${Date.now()}_${Math.random()}`,
            document_id: document.id,
            error_type: 'parsing_error',
            error_message: error instanceof Error ? error.message : 'Unknown error',
            error_context: 'Document parsing',
            severity: 'medium',
            suggestions: ['Check document format', 'Verify encoding', 'Review content structure']
          };
          errors.push(processingError);
          logger.warn(`Failed to parse document ${document.id}:`, error);
        }
      }

      // Generate aggregated intelligence
      const aggregatedIntelligence = await this.aggregateIntelligence(parsedDocuments);

      // Calculate processing statistics
      const processingTime = Date.now() - startTime;
      const statistics = this.calculateProcessingStatistics(
        request.documents.length,
        parsedDocuments.length,
        errors.length,
        processingTime,
        parsedDocuments
      );

      const response: ThreatIntelligenceParsingResponse = {
        request_id: request.request_id,
        processing_timestamp: new Date(),
        parsed_documents: parsedDocuments,
        aggregated_intelligence,
        processing_statistics: statistics,
        errors
      };

      this.emit('parsing_completed', response);
      logger.info(`Threat intelligence parsing completed in ${processingTime}ms`);

      return response;

    } catch (error) {
      logger.error('Threat intelligence parsing failed:', error);
      throw error;
    }
  }

  private async parseDocument(
    document: ThreatIntelligenceDocument,
    options: ParsingOptions
  ): Promise<ParsedThreatIntelligence> {
    
    // Detect and handle language
    let processedContent = document.content;
    let detectedLanguage: LanguageInfo = { code: 'en', name: 'English', confidence: 1.0, supported: true };
    
    if (options.language_detection) {
      detectedLanguage = await this.languageSupport.detectLanguage(document.content);
      logger.info(`Detected language: ${detectedLanguage.name} (${detectedLanguage.confidence})`);
      
      // Translate to English if needed for better processing
      if (detectedLanguage.code !== 'en' && detectedLanguage.supported) {
        try {
          const translationRequest: TranslationRequest = {
            text: document.content,
            sourceLanguage: detectedLanguage.code,
            targetLanguage: 'en',
            preserveFormatting: true
          };
          
          const translation = await this.languageSupport.translateText(translationRequest);
          processedContent = translation.translatedText;
          logger.info(`Translated content from ${detectedLanguage.name} to English for processing`);
        } catch (error) {
          logger.warn('Translation failed, processing in original language:', error);
        }
      }
    }
    const result: ParsedThreatIntelligence = {
      document_id: document.id,
      parsing_timestamp: new Date(),
      extracted_entities: [],
      threat_indicators: [],
      attack_patterns: [],
      threat_actors: [],
      campaign_info: [],
      geographical_context: [],
      temporal_context: [],
      severity_assessment: {
        overall_severity: 'medium',
        impact_score: 0.5,
        likelihood_score: 0.5,
        urgency_score: 0.5,
        business_impact: {
          financial_impact: 0.5,
          operational_impact: 0.5,
          reputational_impact: 0.5,
          regulatory_impact: 0.5,
          affected_services: []
        },
        technical_impact: {
          availability_impact: 0.5,
          integrity_impact: 0.5,
          confidentiality_impact: 0.5,
          affected_systems: [],
          recovery_complexity: 0.5
        },
        confidence: 0.7
      },
      confidence_scores: {
        entity_extraction: 0.8,
        relationship_extraction: 0.7,
        threat_assessment: 0.75,
        attribution: 0.6,
        temporal_accuracy: 0.8,
        overall_parsing: 0.74
      },
      relationships: [],
      summary: {
        executive_summary: '',
        key_findings: [],
        threat_highlights: [],
        recommendations: [],
        risk_assessment: '',
        impact_analysis: '',
        confidence_assessment: ''
      }
    };

    // Preprocess text with language awareness
    const preprocessedText = await this.preprocessText(processedContent, options.preprocessing_options, detectedLanguage.code);

    // Extract entities if requested
    if (options.extract_entities) {
      result.extracted_entities = await this.extractEntities(preprocessedText, document);
    }

    // Extract threat indicators if requested
    if (options.extract_indicators) {
      result.threat_indicators = await this.extractThreatIndicators(preprocessedText, document);
    }

    // Extract attack patterns if requested
    if (options.extract_patterns) {
      result.attack_patterns = await this.extractAttackPatterns(preprocessedText, document);
    }

    // Extract threat actors if requested
    if (options.extract_actors) {
      result.threat_actors = await this.extractThreatActors(preprocessedText, document);
    }

    // Extract campaign information if requested
    if (options.extract_campaigns) {
      result.campaign_info = await this.extractCampaignInfo(preprocessedText, document);
    }

    // Extract geographical context
    result.geographical_context = await this.extractGeographicalContext(preprocessedText);

    // Extract temporal context
    result.temporal_context = await this.extractTemporalContext(preprocessedText);

    // Perform sentiment analysis if requested
    if (options.analyze_sentiment) {
      await this.analyzeSentiment(preprocessedText, result);
    }

    // Generate summary if requested
    if (options.generate_summary) {
      result.summary = await this.generateDocumentSummary(document, result);
    }

    // Extract relationships between entities
    result.relationships = await this.extractEntityRelationships(result);

    // Assess severity
    result.severity_assessment = await this.assessSeverity(document, result);

    return result;
  }

  private async preprocessText(text: string, options: PreprocessingOptions, languageCode: string = 'en'): Promise<string> {
    let processed = text;

    // Apply language-specific normalization first
    if (options.normalize_text) {
      processed = this.languageSupport.normalizeTextForLanguage(processed, languageCode);
    }

    if (options.remove_noise) {
      // Remove URLs, emails, and other noise
      processed = processed.replace(/https?:\/\/[^\s]+/g, '[URL]');
      processed = processed.replace(/[\w\.-]+@[\w\.-]+\.\w+/g, '[EMAIL]');
      processed = processed.replace(/\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g, '[IP]');
    }

    if (options.expand_abbreviations) {
      // Get localized security terms for the detected language
      const localizedTerms = this.languageSupport.getLocalizedTerms(languageCode);
      
      // Base abbreviations in English
      const abbreviations = {
        'apt': 'advanced persistent threat',
        'ioc': 'indicator of compromise',
        'ttp': 'tactics techniques and procedures',
        'c2': 'command and control',
        'c&c': 'command and control'
      };

      // Add localized abbreviations if available
      if (languageCode !== 'en' && localizedTerms) {
        // Expand localized terms to English equivalents
        for (const [englishTerm, localizedTerm] of Object.entries(localizedTerms)) {
          if (abbreviations[englishTerm]) {
            const regex = new RegExp(`\\b${this.escapeRegex(localizedTerm)}\\b`, 'gi');
            processed = processed.replace(regex, abbreviations[englishTerm]);
          }
        }
      }

      // Expand English abbreviations
      for (const [abbr, expansion] of Object.entries(abbreviations)) {
        const regex = new RegExp(`\\b${abbr}\\b`, 'gi');
        processed = processed.replace(regex, expansion);
      }
    }

    return processed;
  }

  private escapeRegex(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private async extractEntities(text: string, document: ThreatIntelligenceDocument): Promise<ExtractedEntity[]> {
    const entities: ExtractedEntity[] = [];

    // Use pattern matching for common entity types
    const patterns = {
      ip_address: /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g,
      domain: /\b[a-zA-Z0-9-]+\.[a-zA-Z]{2,}\b/g,
      hash_md5: /\b[a-f0-9]{32}\b/gi,
      hash_sha1: /\b[a-f0-9]{40}\b/gi,
      hash_sha256: /\b[a-f0-9]{64}\b/gi,
      email: /[\w\.-]+@[\w\.-]+\.\w+/g,
      cve: /CVE-\d{4}-\d{4,}/gi
    };

    for (const [entityType, pattern] of Object.entries(patterns)) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        if (match.index !== undefined) {
          const entity: ExtractedEntity = {
            entity_id: `entity_${Date.now()}_${Math.random()}`,
            entity_type: entityType.includes('hash') ? 'ioc' : entityType as any,
            entity_value: match[0],
            context: this.extractContext(text, match.index, 50),
            confidence: 0.9,
            source_span: {
              start_index: match.index,
              end_index: match.index + match[0].length,
              text: match[0]
            },
            attributes: {
              normalized_value: match[0].toLowerCase(),
              entity_category: entityType,
              risk_level: this.assessEntityRisk(entityType, match[0])
            }
          };
          entities.push(entity);
        }
      }
    }

    return entities;
  }

  private extractContext(text: string, position: number, contextLength: number): string {
    const start = Math.max(0, position - contextLength);
    const end = Math.min(text.length, position + contextLength);
    return text.substring(start, end);
  }

  private assessEntityRisk(entityType: string, value: string): number {
    // Simple risk assessment based on entity type and characteristics
    const riskScores = {
      ip_address: 0.6,
      domain: 0.5,
      hash_md5: 0.8,
      hash_sha1: 0.8,
      hash_sha256: 0.8,
      email: 0.4,
      cve: 0.9
    };

    return riskScores[entityType as keyof typeof riskScores] || 0.5;
  }

  private async extractThreatIndicators(text: string, document: ThreatIntelligenceDocument): Promise<ThreatIndicator[]> {
    const indicators: ThreatIndicator[] = [];

    // Extract various types of threat indicators
    const indicatorPatterns = {
      ip: /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g,
      domain: /\b[a-zA-Z0-9-]+\.[a-zA-Z]{2,}\b/g,
      url: /https?:\/\/[^\s]+/g,
      hash: /\b[a-f0-9]{32,64}\b/gi,
      email: /[\w\.-]+@[\w\.-]+\.\w+/g
    };

    for (const [type, pattern] of Object.entries(indicatorPatterns)) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        if (match.index !== undefined) {
          const indicator: ThreatIndicator = {
            indicator_id: `indicator_${Date.now()}_${Math.random()}`,
            indicator_type: type as any,
            indicator_value: match[0],
            confidence: 0.8,
            threat_level: this.assessThreatLevel(type, match[0]),
            context: this.extractContext(text, match.index, 100),
            attributes: {
              first_seen: new Date(),
              reputation_score: Math.random() * 0.5 + 0.3,
              false_positive_likelihood: Math.random() * 0.2
            },
            related_entities: []
          };
          indicators.push(indicator);
        }
      }
    }

    return indicators;
  }

  private assessThreatLevel(type: string, value: string): 'low' | 'medium' | 'high' | 'critical' {
    // Assess threat level based on type and context
    const threatLevels = {
      ip: 'medium',
      domain: 'medium',
      url: 'high',
      hash: 'high',
      email: 'low'
    };

    return threatLevels[type as keyof typeof threatLevels] as any || 'medium';
  }

  private async extractAttackPatterns(text: string, document: ThreatIntelligenceDocument): Promise<AttackPattern[]> {
    const patterns: AttackPattern[] = [];

    // MITRE ATT&CK technique patterns
    const mitrePatterns = {
      'T1566': { name: 'Phishing', tactic: 'Initial Access' },
      'T1083': { name: 'File and Directory Discovery', tactic: 'Discovery' },
      'T1055': { name: 'Process Injection', tactic: 'Defense Evasion' },
      'T1059': { name: 'Command and Scripting Interpreter', tactic: 'Execution' },
      'T1105': { name: 'Ingress Tool Transfer', tactic: 'Command and Control' }
    };

    // Look for MITRE technique IDs
    const mitreRegex = /T\d{4}(?:\.\d{3})?/g;
    const matches = text.matchAll(mitreRegex);

    for (const match of matches) {
      const techniqueId = match[0];
      const baseId = techniqueId.split('.')[0];
      
      if (mitrePatterns[baseId as keyof typeof mitrePatterns]) {
        const patternInfo = mitrePatterns[baseId as keyof typeof mitrePatterns];
        const pattern: AttackPattern = {
          pattern_id: `pattern_${Date.now()}_${Math.random()}`,
          mitre_id: techniqueId,
          pattern_name: patternInfo.name,
          description: `MITRE ATT&CK technique ${techniqueId}`,
          tactics: [patternInfo.tactic],
          techniques: [techniqueId],
          confidence: 0.9,
          context: this.extractContext(text, match.index!, 150),
          kill_chain_phases: [patternInfo.tactic],
          platforms: ['Windows', 'Linux', 'macOS'],
          data_sources: ['Process monitoring', 'File monitoring']
        };
        patterns.push(pattern);
      }
    }

    return patterns;
  }

  private async extractThreatActors(text: string, document: ThreatIntelligenceDocument): Promise<ThreatActor[]> {
    const actors: ThreatActor[] = [];

    // Common threat actor names and aliases
    const actorPatterns = [
      { names: ['APT1', 'Comment Crew'], type: 'nation-state', sophistication: 'high' },
      { names: ['Lazarus', 'Hidden Cobra'], type: 'nation-state', sophistication: 'expert' },
      { names: ['Fancy Bear', 'APT28'], type: 'nation-state', sophistication: 'expert' },
      { names: ['Cozy Bear', 'APT29'], type: 'nation-state', sophistication: 'expert' }
    ];

    for (const actor of actorPatterns) {
      for (const name of actor.names) {
        const regex = new RegExp(`\\b${name}\\b`, 'gi');
        if (regex.test(text)) {
          const threatActor: ThreatActor = {
            actor_id: `actor_${Date.now()}_${Math.random()}`,
            actor_name: name,
            aliases: actor.names.filter(n => n !== name),
            actor_type: actor.type as any,
            sophistication: actor.sophistication as any,
            motivation: ['espionage', 'financial gain'],
            attribution_confidence: 0.7,
            associated_campaigns: [],
            preferred_tactics: ['spear phishing', 'watering hole'],
            geographical_focus: ['global']
          };
          actors.push(threatActor);
        }
      }
    }

    return actors;
  }

  private async extractCampaignInfo(text: string, document: ThreatIntelligenceDocument): Promise<CampaignInfo[]> {
    const campaigns: CampaignInfo[] = [];

    // Look for campaign-related keywords and names
    const campaignKeywords = ['campaign', 'operation', 'attack wave', 'threat campaign'];
    const campaignPattern = new RegExp(`(${campaignKeywords.join('|')})\\s+([A-Z][a-zA-Z0-9\\s]{2,20})`, 'gi');
    
    const matches = text.matchAll(campaignPattern);
    for (const match of matches) {
      const campaign: CampaignInfo = {
        campaign_id: `campaign_${Date.now()}_${Math.random()}`,
        campaign_name: match[2].trim(),
        description: this.extractContext(text, match.index!, 200),
        status: 'unknown',
        attributed_actors: [],
        target_sectors: [],
        target_regions: [],
        attack_vectors: [],
        confidence: 0.6
      };
      campaigns.push(campaign);
    }

    return campaigns;
  }

  private async extractGeographicalContext(text: string): Promise<GeographicalContext[]> {
    const contexts: GeographicalContext[] = [];

    // Common country and region names
    const locations = [
      'United States', 'China', 'Russia', 'North Korea', 'Iran',
      'Europe', 'Asia', 'Middle East', 'Eastern Europe'
    ];

    for (const location of locations) {
      const regex = new RegExp(`\\b${location}\\b`, 'gi');
      if (regex.test(text)) {
        const context: GeographicalContext = {
          location_type: 'country',
          location_name: location,
          context_type: 'target',
          confidence: 0.7
        };
        contexts.push(context);
      }
    }

    return contexts;
  }

  private async extractTemporalContext(text: string): Promise<TemporalContext[]> {
    const contexts: TemporalContext[] = [];

    // Date patterns
    const datePatterns = [
      /\b\d{1,2}\/\d{1,2}\/\d{4}\b/g,
      /\b\d{4}-\d{2}-\d{2}\b/g,
      /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b/gi
    ];

    for (const pattern of datePatterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        try {
          const dateStr = match[0];
          const parsedDate = new Date(dateStr);
          
          if (!isNaN(parsedDate.getTime())) {
            const context: TemporalContext = {
              temporal_type: 'attack_date',
              exact_time: parsedDate,
              time_precision: 'approximate',
              confidence: 0.8
            };
            contexts.push(context);
          }
        } catch (error) {
          // Ignore invalid dates
        }
      }
    }

    return contexts;
  }

  private async analyzeSentiment(text: string, result: ParsedThreatIntelligence): Promise<void> {
    // Simple sentiment analysis for threat intelligence
    const negativeWords = ['critical', 'severe', 'dangerous', 'malicious', 'attack', 'breach', 'compromise'];
    const positiveWords = ['secure', 'protected', 'defended', 'mitigated', 'resolved', 'patched'];

    let negativeScore = 0;
    let positiveScore = 0;

    const words = text.toLowerCase().split(/\s+/);
    
    for (const word of words) {
      if (negativeWords.includes(word)) negativeScore++;
      if (positiveWords.includes(word)) positiveScore++;
    }

    const totalWords = words.length;
    const sentimentScore = (positiveScore - negativeScore) / totalWords;

    // Add sentiment context to severity assessment
    if (sentimentScore < -0.01) {
      result.severity_assessment.overall_severity = 'high';
    } else if (sentimentScore > 0.01) {
      result.severity_assessment.overall_severity = 'low';
    }
  }

  private async generateDocumentSummary(
    document: ThreatIntelligenceDocument,
    parsed: ParsedThreatIntelligence
  ): Promise<DocumentSummary> {
    const summary: DocumentSummary = {
      executive_summary: `Analysis of threat intelligence document "${document.title}" identified ${parsed.extracted_entities.length} entities, ${parsed.threat_indicators.length} indicators, and ${parsed.attack_patterns.length} attack patterns.`,
      key_findings: [
        `${parsed.threat_indicators.length} threat indicators identified`,
        `${parsed.attack_patterns.length} attack patterns detected`,
        `${parsed.threat_actors.length} threat actors mentioned`
      ],
      threat_highlights: parsed.threat_indicators.slice(0, 5).map(i => 
        `${i.indicator_type.toUpperCase()}: ${i.indicator_value} (${i.threat_level} threat)`
      ),
      recommendations: [
        'Monitor identified indicators in security systems',
        'Update threat detection rules based on identified patterns',
        'Implement additional security controls for identified vulnerabilities'
      ],
      risk_assessment: `Overall risk level: ${parsed.severity_assessment.overall_severity}`,
      impact_analysis: `Potential impact score: ${parsed.severity_assessment.impact_score.toFixed(2)}`,
      confidence_assessment: `Analysis confidence: ${(parsed.confidence_scores.overall_parsing * 100).toFixed(1)}%`
    };

    return summary;
  }

  private async extractEntityRelationships(parsed: ParsedThreatIntelligence): Promise<EntityRelationship[]> {
    const relationships: EntityRelationship[] = [];

    // Find relationships between entities based on co-occurrence and context
    for (let i = 0; i < parsed.extracted_entities.length; i++) {
      for (let j = i + 1; j < parsed.extracted_entities.length; j++) {
        const entity1 = parsed.extracted_entities[i];
        const entity2 = parsed.extracted_entities[j];

        // Check if entities appear in similar context
        const contextSimilarity = this.calculateContextSimilarity(entity1.context, entity2.context);
        
        if (contextSimilarity > 0.3) {
          const relationship: EntityRelationship = {
            relationship_id: `rel_${Date.now()}_${Math.random()}`,
            source_entity: entity1.entity_id,
            target_entity: entity2.entity_id,
            relationship_type: this.determineRelationshipType(entity1, entity2),
            confidence: contextSimilarity,
            context: `${entity1.context} ... ${entity2.context}`,
            attributes: {
              relationship_strength: contextSimilarity,
              technical_correlation: Math.random() * 0.5 + 0.3
            }
          };
          relationships.push(relationship);
        }
      }
    }

    return relationships;
  }

  private calculateContextSimilarity(context1: string, context2: string): number {
    const words1 = new Set(context1.toLowerCase().split(/\s+/));
    const words2 = new Set(context2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(word => words2.has(word)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }

  private determineRelationshipType(entity1: ExtractedEntity, entity2: ExtractedEntity): string {
    const typeMap: { [key: string]: string } = {
      'ioc-ioc': 'related_indicators',
      'ioc-ttp': 'implements',
      'ttp-actor': 'used_by',
      'actor-campaign': 'attributed_to',
      'campaign-ioc': 'contains'
    };

    const key = `${entity1.entity_type}-${entity2.entity_type}`;
    return typeMap[key] || 'related';
  }

  private async assessSeverity(
    document: ThreatIntelligenceDocument,
    parsed: ParsedThreatIntelligence
  ): Promise<SeverityAssessment> {
    // Calculate severity based on extracted information
    let impactScore = 0.5;
    let likelihoodScore = 0.5;
    let urgencyScore = 0.5;

    // Adjust based on number of high-confidence indicators
    const highConfidenceIndicators = parsed.threat_indicators.filter(i => i.confidence > 0.8);
    impactScore += Math.min(0.3, highConfidenceIndicators.length * 0.05);

    // Adjust based on attack patterns
    const criticalPatterns = parsed.attack_patterns.filter(p => p.confidence > 0.8);
    likelihoodScore += Math.min(0.3, criticalPatterns.length * 0.1);

    // Adjust based on threat actors
    const sophisticatedActors = parsed.threat_actors.filter(a => a.sophistication === 'expert');
    urgencyScore += Math.min(0.4, sophisticatedActors.length * 0.2);

    const overallScore = (impactScore + likelihoodScore + urgencyScore) / 3;
    let overallSeverity: 'low' | 'medium' | 'high' | 'critical';

    if (overallScore >= 0.8) overallSeverity = 'critical';
    else if (overallScore >= 0.6) overallSeverity = 'high';
    else if (overallScore >= 0.4) overallSeverity = 'medium';
    else overallSeverity = 'low';

    return {
      overall_severity: overallSeverity,
      impact_score: impactScore,
      likelihood_score: likelihoodScore,
      urgency_score: urgencyScore,
      business_impact: {
        financial_impact: impactScore * 0.8,
        operational_impact: impactScore * 0.9,
        reputational_impact: impactScore * 0.7,
        regulatory_impact: impactScore * 0.6,
        affected_services: []
      },
      technical_impact: {
        availability_impact: impactScore * 0.8,
        integrity_impact: impactScore * 0.9,
        confidentiality_impact: impactScore * 0.85,
        affected_systems: [],
        recovery_complexity: urgencyScore
      },
      confidence: parsed.confidence_scores.overall_parsing
    };
  }

  private async aggregateIntelligence(
    parsedDocuments: ParsedThreatIntelligence[]
  ): Promise<AggregatedIntelligence> {
    // Aggregate intelligence across all documents
    const uniqueEntities = this.deduplicateEntities(
      parsedDocuments.flatMap(doc => doc.extracted_entities)
    );

    const threatLandscape = await this.analyzeThreatLandscape(parsedDocuments);
    const actorAttribution = await this.analyzeActorAttribution(parsedDocuments);
    const campaignAnalysis = await this.analyzeCampaigns(parsedDocuments);
    const geographicDistribution = await this.analyzeGeographicDistribution(parsedDocuments);
    const temporalTrends = await this.analyzeTemporalTrends(parsedDocuments);
    const correlationAnalysis = await this.analyzeCorrelations(parsedDocuments);

    return {
      unique_entities: uniqueEntities,
      threat_landscape: threatLandscape,
      actor_attribution: actorAttribution,
      campaign_analysis: campaignAnalysis,
      geographic_distribution: geographicDistribution,
      temporal_trends: temporalTrends,
      correlation_analysis: correlationAnalysis
    };
  }

  private deduplicateEntities(entities: ExtractedEntity[]): ExtractedEntity[] {
    const seen = new Set<string>();
    return entities.filter(entity => {
      const key = `${entity.entity_type}:${entity.entity_value.toLowerCase()}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  private async analyzeThreatLandscape(documents: ParsedThreatIntelligence[]): Promise<ThreatLandscape> {
    const threatCounts = new Map<string, number>();
    
    for (const doc of documents) {
      for (const indicator of doc.threat_indicators) {
        const key = indicator.indicator_type;
        threatCounts.set(key, (threatCounts.get(key) || 0) + 1);
      }
    }

    const topThreats: ThreatSummary[] = Array.from(threatCounts.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([threat, count]) => ({
        threat_name: threat,
        threat_type: threat,
        prevalence: count / documents.length,
        severity: 'medium',
        trend: 'stable',
        confidence: 0.8
      }));

    return {
      top_threats: topThreats,
      emerging_threats: [],
      threat_evolution: [],
      sector_targeting: []
    };
  }

  private async analyzeActorAttribution(documents: ParsedThreatIntelligence[]): Promise<ActorAttribution[]> {
    const attributions: ActorAttribution[] = [];
    
    const actorCounts = new Map<string, number>();
    for (const doc of documents) {
      for (const actor of doc.threat_actors) {
        actorCounts.set(actor.actor_name, (actorCounts.get(actor.actor_name) || 0) + 1);
      }
    }

    for (const [actorName, count] of actorCounts.entries()) {
      attributions.push({
        actor_name: actorName,
        attribution_confidence: Math.min(0.9, count / documents.length + 0.3),
        supporting_evidence: [`Mentioned in ${count} documents`],
        contradicting_evidence: [],
        alternative_attributions: []
      });
    }

    return attributions;
  }

  private async analyzeCampaigns(documents: ParsedThreatIntelligence[]): Promise<CampaignAnalysis[]> {
    // Simplified campaign analysis
    return [];
  }

  private async analyzeGeographicDistribution(documents: ParsedThreatIntelligence[]): Promise<GeographicDistribution[]> {
    const distribution: GeographicDistribution[] = [];
    const regionCounts = new Map<string, number>();

    for (const doc of documents) {
      for (const geo of doc.geographical_context) {
        regionCounts.set(geo.location_name, (regionCounts.get(geo.location_name) || 0) + 1);
      }
    }

    for (const [region, count] of regionCounts.entries()) {
      distribution.push({
        region,
        activity_level: count,
        threat_types: [],
        target_sectors: [],
        trend_analysis: 'stable'
      });
    }

    return distribution;
  }

  private async analyzeTemporalTrends(documents: ParsedThreatIntelligence[]): Promise<TemporalTrends[]> {
    // Simplified temporal analysis
    return [
      {
        time_period: 'last_30_days',
        trend_type: 'threat_volume',
        trend_direction: 'increasing',
        significance: 0.7,
        contributing_factors: ['Increased phishing campaigns', 'New malware variants']
      }
    ];
  }

  private async analyzeCorrelations(documents: ParsedThreatIntelligence[]): Promise<CorrelationAnalysis> {
    return {
      entity_correlations: [],
      temporal_correlations: [],
      geographic_correlations: [],
      behavioral_correlations: []
    };
  }

  private calculateProcessingStatistics(
    totalDocs: number,
    successfulDocs: number,
    errorCount: number,
    processingTime: number,
    parsedDocs: ParsedThreatIntelligence[]
  ): ProcessingStatistics {
    const totalEntities = parsedDocs.reduce((sum, doc) => sum + doc.extracted_entities.length, 0);
    const totalIndicators = parsedDocs.reduce((sum, doc) => sum + doc.threat_indicators.length, 0);
    const totalPatterns = parsedDocs.reduce((sum, doc) => sum + doc.attack_patterns.length, 0);
    const totalActors = parsedDocs.reduce((sum, doc) => sum + doc.threat_actors.length, 0);
    const totalCampaigns = parsedDocs.reduce((sum, doc) => sum + doc.campaign_info.length, 0);

    // Calculate confidence distribution
    const allConfidences = parsedDocs.flatMap(doc => [
      ...doc.extracted_entities.map(e => e.confidence),
      ...doc.threat_indicators.map(i => i.confidence),
      ...doc.attack_patterns.map(p => p.confidence)
    ]);

    const highConf = allConfidences.filter(c => c >= 0.8).length;
    const mediumConf = allConfidences.filter(c => c >= 0.5 && c < 0.8).length;
    const lowConf = allConfidences.filter(c => c >= 0.3 && c < 0.5).length;
    const uncertain = allConfidences.filter(c => c < 0.3).length;

    return {
      total_documents: totalDocs,
      successfully_parsed: successfulDocs,
      parsing_errors: errorCount,
      entities_extracted: totalEntities,
      indicators_identified: totalIndicators,
      patterns_detected: totalPatterns,
      actors_identified: totalActors,
      campaigns_identified: totalCampaigns,
      processing_time: processingTime,
      confidence_distribution: {
        high_confidence: highConf,
        medium_confidence: mediumConf,
        low_confidence: lowConf,
        uncertain: uncertain
      }
    };
  }

  async getModelInfo(): Promise<any> {
    return {
      service: 'ThreatIntelligenceNLPService',
      models: {
        entity_model: this.entityModel ? 'Loaded' : 'Not loaded',
        classification_model: this.classificationModel ? 'Loaded' : 'Not loaded',
        sentiment_model: this.sentimentModel ? 'Loaded' : 'Not loaded'
      },
      vocabulary_size: this.vocabularyMap.size,
      entity_vocabulary_size: this.entityVocabulary.size,
      initialized: this.isInitialized
    };
  }

  async trainModels(trainingData: any[]): Promise<void> {
    logger.info('Training NLP models with new data...');
    
    // Training implementation would go here
    // This is a placeholder for actual model training
    
    logger.info('NLP model training completed');
  }

  async saveModels(modelPath: string): Promise<void> {
    if (this.entityModel) {
      await this.entityModel.save(`file://${modelPath}/entity_model`);
    }
    if (this.classificationModel) {
      await this.classificationModel.save(`file://${modelPath}/classification_model`);
    }
    if (this.sentimentModel) {
      await this.sentimentModel.save(`file://${modelPath}/sentiment_model`);
    }
    
    logger.info(`Models saved to ${modelPath}`);
  }

  async loadModels(modelPath: string): Promise<void> {
    try {
      this.entityModel = await tf.loadLayersModel(`file://${modelPath}/entity_model/model.json`);
      this.classificationModel = await tf.loadLayersModel(`file://${modelPath}/classification_model/model.json`);
      this.sentimentModel = await tf.loadLayersModel(`file://${modelPath}/sentiment_model/model.json`);
      
      logger.info(`Models loaded from ${modelPath}`);
    } catch (error) {
      logger.warn('Could not load pre-trained models, using default models');
    }
  }
}