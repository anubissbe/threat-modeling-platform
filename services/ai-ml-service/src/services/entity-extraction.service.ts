/**
 * Security Entity Extraction Service
 * Advanced entity extraction for IOCs, TTPs, and security artifacts
 */

import { EventEmitter } from 'events';
import { logger, mlLogger } from '../utils/logger';
import * as tf from '@tensorflow/tfjs-node';
import { LanguageSupportService, LanguageInfo } from '../utils/language-support';

// Entity extraction interfaces
export interface EntityExtractionRequest {
  request_id: string;
  text_content: string;
  extraction_options: ExtractionOptions;
  context?: ExtractionContext;
}

export interface ExtractionOptions {
  extract_iocs: boolean;
  extract_ttps: boolean;
  extract_actors: boolean;
  extract_campaigns: boolean;
  extract_vulnerabilities: boolean;
  extract_locations: boolean;
  extract_timestamps: boolean;
  confidence_threshold: number;
  include_context: boolean;
}

export interface ExtractionContext {
  document_type: 'threat_report' | 'incident_report' | 'vulnerability_report' | 'news_article';
  source_reliability: number;
  timestamp: Date;
  language: string;
}

export interface EntityExtractionResponse {
  request_id: string;
  extraction_timestamp: Date;
  extracted_entities: ExtractedEntity[];
  entity_relationships: EntityRelationship[];
  extraction_statistics: ExtractionStatistics;
  confidence_metrics: ConfidenceMetrics;
}

export interface ExtractedEntity {
  entity_id: string;
  entity_type: EntityType;
  entity_value: string;
  normalized_value: string;
  confidence: number;
  source_span: TextSpan;
  context: EntityContext;
  attributes: EntityAttributes;
  validation_status: ValidationStatus;
}

export type EntityType = 
  | 'ip_address' | 'domain' | 'url' | 'email' | 'file_hash' | 'filename'
  | 'registry_key' | 'mutex' | 'process' | 'service'
  | 'mitre_technique' | 'mitre_tactic' | 'attack_pattern'
  | 'threat_actor' | 'malware_family' | 'campaign'
  | 'cve' | 'vulnerability' | 'software' | 'vendor'
  | 'country' | 'region' | 'city' | 'organization'
  | 'timestamp' | 'duration' | 'date_range';

export interface TextSpan {
  start_index: number;
  end_index: number;
  text: string;
  surrounding_context: string;
}

export interface EntityContext {
  sentence: string;
  paragraph: string;
  section_title?: string;
  semantic_role: string;
  confidence: number;
}

export interface EntityAttributes {
  [key: string]: any;
  reputation_score?: number;
  threat_level?: 'low' | 'medium' | 'high' | 'critical';
  first_seen?: Date;
  last_seen?: Date;
  related_malware?: string[];
  geolocation?: GeolocationInfo;
  whois_info?: WhoisInfo;
}

export interface GeolocationInfo {
  country: string;
  region?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  asn?: number;
  organization?: string;
}

export interface WhoisInfo {
  registrar?: string;
  creation_date?: Date;
  expiration_date?: Date;
  updated_date?: Date;
  registrant?: string;
  admin_contact?: string;
}

export interface ValidationStatus {
  is_valid: boolean;
  validation_method: string;
  validation_confidence: number;
  validation_timestamp: Date;
  validation_notes?: string;
}

export interface EntityRelationship {
  relationship_id: string;
  source_entity_id: string;
  target_entity_id: string;
  relationship_type: RelationshipType;
  confidence: number;
  evidence: string[];
  temporal_overlap: boolean;
  contextual_proximity: number;
}

export type RelationshipType = 
  | 'communicates_with' | 'downloads_from' | 'resolves_to' | 'hosted_on'
  | 'uses_technique' | 'targets' | 'attributed_to' | 'part_of'
  | 'exploits' | 'affects' | 'mitigates' | 'related_to'
  | 'precedes' | 'follows' | 'co_occurs' | 'contradicts';

export interface ExtractionStatistics {
  total_entities_found: number;
  entities_by_type: { [key in EntityType]?: number };
  average_confidence: number;
  high_confidence_entities: number;
  validation_rate: number;
  processing_time_ms: number;
  text_coverage: number;
}

export interface ConfidenceMetrics {
  overall_confidence: number;
  extraction_confidence: number;
  validation_confidence: number;
  relationship_confidence: number;
  model_uncertainty: number;
}

export class EntityExtractionService extends EventEmitter {
  private nerModel?: tf.LayersModel;
  private relationshipModel?: tf.LayersModel;
  private vocabularyMap: Map<string, number> = new Map();
  private entityPatterns: Map<EntityType, RegExp[]> = new Map();
  private multiLanguagePatterns: Map<string, Map<EntityType, RegExp[]>> = new Map();
  private languageSupport: LanguageSupportService;
  private isInitialized: boolean = false;

  constructor() {
    super();
    this.languageSupport = LanguageSupportService.getInstance();
    this.initializeService();
  }

  private async initializeService(): Promise<void> {
    try {
      logger.info('Initializing Entity Extraction Service...');
      
      await this.initializeModels();
      await this.loadVocabularies();
      await this.loadEntityPatterns();
      
      this.isInitialized = true;
      this.emit('initialized');
      
      logger.info('Entity Extraction Service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize entity extraction service:', error);
      throw error;
    }
  }

  private async initializeModels(): Promise<void> {
    // Named Entity Recognition model
    this.nerModel = tf.sequential({
      layers: [
        tf.layers.embedding({ inputDim: 10000, outputDim: 128, inputLength: 100 }),
        tf.layers.bidirectional({
          layer: tf.layers.lstm({ units: 64, returnSequences: true })
        }),
        tf.layers.dropout({ rate: 0.3 }),
        tf.layers.dense({ units: 32, activation: 'relu' }),
        tf.layers.dense({ units: 23, activation: 'softmax' }) // Number of entity types
      ]
    });

    this.nerModel.compile({
      optimizer: 'adam',
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });

    logger.info('NER models initialized successfully');
  }

  private async loadVocabularies(): Promise<void> {
    // Security vocabulary for entity extraction
    const securityTerms = [
      'malware', 'trojan', 'ransomware', 'phishing', 'exploit',
      'vulnerability', 'backdoor', 'c2', 'payload', 'dropper'
    ];

    securityTerms.forEach((term, index) => {
      this.vocabularyMap.set(term.toLowerCase(), index + 1);
    });

    logger.info('Vocabularies loaded successfully');
  }

  private async loadEntityPatterns(): Promise<void> {
    // IP addresses
    this.entityPatterns.set('ip_address', [
      /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g,
      /\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b/g
    ]);

    // Domains
    this.entityPatterns.set('domain', [
      /\b[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}\b/g
    ]);

    // URLs
    this.entityPatterns.set('url', [
      /https?:\/\/[^\s<>"{}|\\^`\[\]]+/g,
      /ftp:\/\/[^\s<>"{}|\\^`\[\]]+/g
    ]);

    // Email addresses
    this.entityPatterns.set('email', [
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g
    ]);

    // File hashes
    this.entityPatterns.set('file_hash', [
      /\b[a-fA-F0-9]{32}\b/g, // MD5
      /\b[a-fA-F0-9]{40}\b/g, // SHA1
      /\b[a-fA-F0-9]{64}\b/g, // SHA256
      /\b[a-fA-F0-9]{128}\b/g // SHA512
    ]);

    // CVE IDs
    this.entityPatterns.set('cve', [
      /CVE-\d{4}-\d{4,}/gi
    ]);

    // MITRE ATT&CK techniques
    this.entityPatterns.set('mitre_technique', [
      /T\d{4}(?:\.\d{3})?/g
    ]);

    logger.info('Entity patterns loaded successfully');
  }

  async extractEntities(request: EntityExtractionRequest): Promise<EntityExtractionResponse> {
    if (!this.isInitialized) {
      throw new Error('Entity extraction service not initialized');
    }

    logger.info(`Processing entity extraction request: ${request.request_id}`);
    const startTime = Date.now();

    try {
      // Detect language if not provided
      const detectedLanguage = request.context?.language || 
        (await this.languageSupport.detectLanguage(request.text_content)).code;
      
      logger.info(`Processing text in language: ${detectedLanguage}`);
      
      // Normalize text for the detected language
      const normalizedText = this.languageSupport.normalizeTextForLanguage(
        request.text_content, 
        detectedLanguage
      );
      
      // Translate to English if needed for better pattern matching
      let processedText = normalizedText;
      if (detectedLanguage !== 'en') {
        const translationResult = await this.languageSupport.translateText({
          text: normalizedText,
          sourceLanguage: detectedLanguage,
          targetLanguage: 'en'
        });
        processedText = translationResult.translatedText;
        logger.info(`Translated text for processing (confidence: ${translationResult.confidence})`);
      }
      
      const extractedEntities: ExtractedEntity[] = [];

      // Pattern-based extraction using processed text
      if (request.extraction_options.extract_iocs) {
        const iocs = await this.extractIOCs(processedText, detectedLanguage);
        extractedEntities.push(...iocs);
      }

      if (request.extraction_options.extract_ttps) {
        const ttps = await this.extractTTPs(processedText, detectedLanguage);
        extractedEntities.push(...ttps);
      }

      if (request.extraction_options.extract_actors) {
        const actors = await this.extractThreatActors(processedText, detectedLanguage);
        extractedEntities.push(...actors);
      }

      if (request.extraction_options.extract_vulnerabilities) {
        const vulns = await this.extractVulnerabilities(processedText, detectedLanguage);
        extractedEntities.push(...vulns);
      }

      if (request.extraction_options.extract_locations) {
        const locations = await this.extractLocations(processedText, detectedLanguage);
        extractedEntities.push(...locations);
      }

      if (request.extraction_options.extract_timestamps) {
        const timestamps = await this.extractTimestamps(processedText, detectedLanguage);
        extractedEntities.push(...timestamps);
      }
      
      // Add language-specific patterns
      const languageSpecificEntities = await this.extractLanguageSpecificEntities(
        normalizedText, 
        detectedLanguage
      );
      extractedEntities.push(...languageSpecificEntities);
      
      // Set language metadata on all entities
      extractedEntities.forEach(entity => {
        entity.attributes.detected_language = detectedLanguage;
        entity.attributes.original_text = request.text_content;
        if (detectedLanguage !== 'en') {
          entity.attributes.translated_text = processedText;
        }
      });

      // Filter by confidence threshold
      const filteredEntities = extractedEntities.filter(
        entity => entity.confidence >= request.extraction_options.confidence_threshold
      );

      // Extract relationships using both original and processed text
      const relationships = await this.extractRelationships(
        filteredEntities, 
        processedText,
        detectedLanguage
      );

      // Calculate statistics
      const statistics = this.calculateStatistics(filteredEntities, Date.now() - startTime, request.text_content);
      const confidenceMetrics = this.calculateConfidenceMetrics(filteredEntities, relationships);

      const response: EntityExtractionResponse = {
        request_id: request.request_id,
        extraction_timestamp: new Date(),
        extracted_entities: filteredEntities,
        entity_relationships: relationships,
        extraction_statistics: statistics,
        confidence_metrics: confidenceMetrics
      };

      this.emit('extraction_completed', response);
      logger.info(`Entity extraction completed in ${Date.now() - startTime}ms`);

      return response;

    } catch (error) {
      logger.error('Entity extraction failed:', error);
      throw error;
    }
  }

  private async extractIOCs(text: string): Promise<ExtractedEntity[]> {
    const entities: ExtractedEntity[] = [];
    const iocTypes: EntityType[] = ['ip_address', 'domain', 'url', 'email', 'file_hash'];

    for (const entityType of iocTypes) {
      const patterns = this.entityPatterns.get(entityType) || [];
      
      for (const pattern of patterns) {
        const matches = text.matchAll(pattern);
        
        for (const match of matches) {
          if (match.index !== undefined) {
            const entity = await this.createEntity(
              entityType,
              match[0],
              match.index,
              text
            );
            
            if (entity) {
              entities.push(entity);
            }
          }
        }
      }
    }

    return entities;
  }

  private async extractTTPs(text: string): Promise<ExtractedEntity[]> {
    const entities: ExtractedEntity[] = [];
    
    // MITRE ATT&CK techniques
    const mitrePattern = this.entityPatterns.get('mitre_technique')?.[0];
    if (mitrePattern) {
      const matches = text.matchAll(mitrePattern);
      
      for (const match of matches) {
        if (match.index !== undefined) {
          const entity = await this.createEntity(
            'mitre_technique',
            match[0],
            match.index,
            text
          );
          
          if (entity) {
            entity.attributes.mitre_id = match[0];
            entity.attributes.technique_name = this.getMitreTechniqueName(match[0]);
            entities.push(entity);
          }
        }
      }
    }

    // Attack patterns from text
    const attackPatterns = [
      'spear phishing', 'watering hole', 'privilege escalation',
      'lateral movement', 'data exfiltration', 'persistence',
      'command and control', 'defense evasion'
    ];

    for (const pattern of attackPatterns) {
      const regex = new RegExp(`\\b${pattern}\\b`, 'gi');
      const matches = text.matchAll(regex);
      
      for (const match of matches) {
        if (match.index !== undefined) {
          const entity = await this.createEntity(
            'attack_pattern',
            match[0],
            match.index,
            text
          );
          
          if (entity) {
            entities.push(entity);
          }
        }
      }
    }

    return entities;
  }

  private async extractThreatActors(text: string): Promise<ExtractedEntity[]> {
    const entities: ExtractedEntity[] = [];
    
    const actorPatterns = [
      'APT1', 'APT28', 'APT29', 'Lazarus', 'Fancy Bear', 'Cozy Bear',
      'Carbanak', 'FIN7', 'Equation Group', 'Shadow Brokers'
    ];

    for (const actor of actorPatterns) {
      const regex = new RegExp(`\\b${actor}\\b`, 'gi');
      const matches = text.matchAll(regex);
      
      for (const match of matches) {
        if (match.index !== undefined) {
          const entity = await this.createEntity(
            'threat_actor',
            match[0],
            match.index,
            text
          );
          
          if (entity) {
            entity.attributes.actor_type = this.classifyActorType(match[0]);
            entities.push(entity);
          }
        }
      }
    }

    return entities;
  }

  private async extractVulnerabilities(text: string): Promise<ExtractedEntity[]> {
    const entities: ExtractedEntity[] = [];
    
    // CVE patterns
    const cvePattern = this.entityPatterns.get('cve')?.[0];
    if (cvePattern) {
      const matches = text.matchAll(cvePattern);
      
      for (const match of matches) {
        if (match.index !== undefined) {
          const entity = await this.createEntity(
            'cve',
            match[0],
            match.index,
            text
          );
          
          if (entity) {
            entity.attributes.cve_id = match[0];
            entity.attributes.severity = await this.getCVESeverity(match[0]);
            entities.push(entity);
          }
        }
      }
    }

    return entities;
  }

  private async extractLocations(text: string): Promise<ExtractedEntity[]> {
    const entities: ExtractedEntity[] = [];
    
    const countries = [
      'United States', 'China', 'Russia', 'North Korea', 'Iran',
      'Israel', 'United Kingdom', 'Germany', 'France', 'Japan'
    ];

    for (const country of countries) {
      const regex = new RegExp(`\\b${country}\\b`, 'gi');
      const matches = text.matchAll(regex);
      
      for (const match of matches) {
        if (match.index !== undefined) {
          const entity = await this.createEntity(
            'country',
            match[0],
            match.index,
            text
          );
          
          if (entity) {
            entities.push(entity);
          }
        }
      }
    }

    return entities;
  }

  private async extractTimestamps(text: string): Promise<ExtractedEntity[]> {
    const entities: ExtractedEntity[] = [];
    
    const datePatterns = [
      /\d{4}-\d{2}-\d{2}/g,
      /\d{1,2}\/\d{1,2}\/\d{4}/g,
      /(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}/gi
    ];

    for (const pattern of datePatterns) {
      const matches = text.matchAll(pattern);
      
      for (const match of matches) {
        if (match.index !== undefined) {
          const entity = await this.createEntity(
            'timestamp',
            match[0],
            match.index,
            text
          );
          
          if (entity) {
            entity.attributes.parsed_date = new Date(match[0]);
            entities.push(entity);
          }
        }
      }
    }

    return entities;
  }

  private async createEntity(
    entityType: EntityType,
    value: string,
    startIndex: number,
    fullText: string
  ): Promise<ExtractedEntity | null> {
    try {
      const normalizedValue = this.normalizeEntityValue(entityType, value);
      const confidence = await this.calculateEntityConfidence(entityType, value, fullText);
      
      if (confidence < 0.5) {
        return null; // Skip low-confidence entities
      }

      const entity: ExtractedEntity = {
        entity_id: `entity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        entity_type: entityType,
        entity_value: value,
        normalized_value: normalizedValue,
        confidence,
        source_span: {
          start_index: startIndex,
          end_index: startIndex + value.length,
          text: value,
          surrounding_context: this.extractContext(fullText, startIndex, 100)
        },
        context: {
          sentence: this.extractSentence(fullText, startIndex),
          paragraph: this.extractParagraph(fullText, startIndex),
          semantic_role: this.inferSemanticRole(entityType, fullText, startIndex),
          confidence: confidence * 0.9
        },
        attributes: await this.enrichEntityAttributes(entityType, normalizedValue),
        validation_status: await this.validateEntity(entityType, normalizedValue)
      };

      return entity;

    } catch (error) {
      logger.warn(`Failed to create entity for ${entityType}:${value}:`, error);
      return null;
    }
  }

  private normalizeEntityValue(entityType: EntityType, value: string): string {
    switch (entityType) {
      case 'ip_address':
        return value.trim().toLowerCase();
      case 'domain':
        return value.trim().toLowerCase();
      case 'email':
        return value.trim().toLowerCase();
      case 'file_hash':
        return value.trim().toLowerCase();
      case 'url':
        return value.trim();
      default:
        return value.trim();
    }
  }

  private async calculateEntityConfidence(entityType: EntityType, value: string, context: string): Promise<number> {
    let confidence = 0.7; // Base confidence

    // Pattern match confidence
    const patterns = this.entityPatterns.get(entityType);
    if (patterns) {
      for (const pattern of patterns) {
        if (pattern.test(value)) {
          confidence += 0.2;
          break;
        }
      }
    }

    // Context relevance
    const securityKeywords = ['attack', 'threat', 'malware', 'exploit', 'vulnerability'];
    const contextWords = context.toLowerCase().split(/\s+/);
    const securityMatches = contextWords.filter(word => 
      securityKeywords.some(keyword => word.includes(keyword))
    ).length;
    
    confidence += Math.min(0.1, securityMatches * 0.02);

    return Math.min(1.0, confidence);
  }

  private extractContext(text: string, position: number, contextLength: number): string {
    const start = Math.max(0, position - contextLength);
    const end = Math.min(text.length, position + contextLength);
    return text.substring(start, end);
  }

  private extractSentence(text: string, position: number): string {
    const sentences = text.split(/[.!?]+/);
    let currentPos = 0;
    
    for (const sentence of sentences) {
      if (currentPos + sentence.length >= position) {
        return sentence.trim();
      }
      currentPos += sentence.length + 1;
    }
    
    return '';
  }

  private extractParagraph(text: string, position: number): string {
    const paragraphs = text.split(/\n\s*\n/);
    let currentPos = 0;
    
    for (const paragraph of paragraphs) {
      if (currentPos + paragraph.length >= position) {
        return paragraph.trim();
      }
      currentPos += paragraph.length + 2;
    }
    
    return '';
  }

  private inferSemanticRole(entityType: EntityType, text: string, position: number): string {
    const context = this.extractContext(text, position, 50).toLowerCase();
    
    if (context.includes('attack') || context.includes('exploit')) {
      return 'threat_indicator';
    } else if (context.includes('protect') || context.includes('defend')) {
      return 'defense_asset';
    } else if (context.includes('victim') || context.includes('target')) {
      return 'target';
    }
    
    return 'unknown';
  }

  private async enrichEntityAttributes(entityType: EntityType, value: string): Promise<EntityAttributes> {
    const attributes: EntityAttributes = {};

    switch (entityType) {
      case 'ip_address':
        attributes.threat_level = 'medium';
        attributes.geolocation = await this.getGeolocation(value);
        break;
      case 'domain':
        attributes.threat_level = 'medium';
        attributes.whois_info = await this.getWhoisInfo(value);
        break;
      case 'file_hash':
        attributes.threat_level = 'high';
        attributes.hash_type = this.getHashType(value);
        break;
      case 'cve':
        attributes.severity = await this.getCVESeverity(value);
        break;
    }

    return attributes;
  }

  private async getGeolocation(ip: string): Promise<GeolocationInfo | undefined> {
    // Placeholder for geolocation lookup
    return {
      country: 'Unknown',
      asn: 0,
      organization: 'Unknown'
    };
  }

  private async getWhoisInfo(domain: string): Promise<WhoisInfo | undefined> {
    // Placeholder for WHOIS lookup
    return {
      registrar: 'Unknown'
    };
  }

  private getHashType(hash: string): string {
    switch (hash.length) {
      case 32: return 'MD5';
      case 40: return 'SHA1';
      case 64: return 'SHA256';
      case 128: return 'SHA512';
      default: return 'Unknown';
    }
  }

  private async getCVESeverity(cveId: string): Promise<string> {
    // Placeholder for CVE severity lookup
    return 'medium';
  }

  private getMitreTechniqueName(techniqueId: string): string {
    const techniques: { [key: string]: string } = {
      'T1566': 'Phishing',
      'T1083': 'File and Directory Discovery',
      'T1055': 'Process Injection',
      'T1059': 'Command and Scripting Interpreter'
    };
    
    const baseId = techniqueId.split('.')[0];
    return techniques[baseId] || 'Unknown Technique';
  }

  private classifyActorType(actorName: string): string {
    const nationStateActors = ['APT1', 'APT28', 'APT29', 'Lazarus'];
    const criminalActors = ['Carbanak', 'FIN7'];
    
    if (nationStateActors.includes(actorName)) return 'nation-state';
    if (criminalActors.includes(actorName)) return 'cybercriminal';
    return 'unknown';
  }

  private async validateEntity(entityType: EntityType, value: string): Promise<ValidationStatus> {
    // Simple validation logic
    let isValid = true;
    let validationMethod = 'pattern_match';
    let confidence = 0.8;

    switch (entityType) {
      case 'ip_address':
        isValid = this.isValidIP(value);
        break;
      case 'domain':
        isValid = this.isValidDomain(value);
        break;
      case 'email':
        isValid = this.isValidEmail(value);
        break;
    }

    return {
      is_valid: isValid,
      validation_method: validationMethod,
      validation_confidence: confidence,
      validation_timestamp: new Date()
    };
  }

  private isValidIP(ip: string): boolean {
    const ipv4Regex = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;
    return ipv4Regex.test(ip);
  }

  private isValidDomain(domain: string): boolean {
    const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    return domainRegex.test(domain);
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private async extractRelationships(entities: ExtractedEntity[], text: string): Promise<EntityRelationship[]> {
    const relationships: EntityRelationship[] = [];

    // Find relationships based on proximity and context
    for (let i = 0; i < entities.length; i++) {
      for (let j = i + 1; j < entities.length; j++) {
        const entity1 = entities[i];
        const entity2 = entities[j];

        const relationship = await this.identifyRelationship(entity1, entity2, text);
        if (relationship) {
          relationships.push(relationship);
        }
      }
    }

    return relationships;
  }

  private async identifyRelationship(
    entity1: ExtractedEntity,
    entity2: ExtractedEntity,
    text: string
  ): Promise<EntityRelationship | null> {
    const proximityThreshold = 200; // characters
    const proximity = Math.abs(entity1.source_span.start_index - entity2.source_span.start_index);
    
    if (proximity > proximityThreshold) {
      return null;
    }

    const relationshipType = this.determineRelationshipType(entity1, entity2);
    if (!relationshipType) {
      return null;
    }

    const confidence = this.calculateRelationshipConfidence(entity1, entity2, proximity);

    return {
      relationship_id: `rel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      source_entity_id: entity1.entity_id,
      target_entity_id: entity2.entity_id,
      relationship_type: relationshipType,
      confidence,
      evidence: [this.extractRelationshipEvidence(entity1, entity2, text)],
      temporal_overlap: this.checkTemporalOverlap(entity1, entity2),
      contextual_proximity: 1 - (proximity / proximityThreshold)
    };
  }

  private determineRelationshipType(entity1: ExtractedEntity, entity2: ExtractedEntity): RelationshipType | null {
    const type1 = entity1.entity_type;
    const type2 = entity2.entity_type;

    const relationshipMap: { [key: string]: RelationshipType } = {
      'ip_address-domain': 'resolves_to',
      'domain-ip_address': 'resolves_to',
      'url-domain': 'hosted_on',
      'domain-url': 'hosted_on',
      'threat_actor-mitre_technique': 'uses_technique',
      'mitre_technique-threat_actor': 'uses_technique',
      'malware_family-file_hash': 'related_to',
      'file_hash-malware_family': 'related_to'
    };

    const key1 = `${type1}-${type2}`;
    const key2 = `${type2}-${type1}`;

    return relationshipMap[key1] || relationshipMap[key2] || null;
  }

  private calculateRelationshipConfidence(
    entity1: ExtractedEntity,
    entity2: ExtractedEntity,
    proximity: number
  ): number {
    const baseConfidence = 0.6;
    const entityConfidence = (entity1.confidence + entity2.confidence) / 2;
    const proximityScore = 1 - (proximity / 200);
    
    return Math.min(1.0, baseConfidence + (entityConfidence * 0.2) + (proximityScore * 0.2));
  }

  private extractRelationshipEvidence(
    entity1: ExtractedEntity,
    entity2: ExtractedEntity,
    text: string
  ): string {
    const start = Math.min(entity1.source_span.start_index, entity2.source_span.start_index);
    const end = Math.max(entity1.source_span.end_index, entity2.source_span.end_index);
    
    return text.substring(Math.max(0, start - 50), Math.min(text.length, end + 50));
  }

  private checkTemporalOverlap(entity1: ExtractedEntity, entity2: ExtractedEntity): boolean {
    // Simple heuristic - entities in the same sentence likely have temporal overlap
    return entity1.context.sentence === entity2.context.sentence;
  }

  private calculateStatistics(
    entities: ExtractedEntity[],
    processingTime: number,
    text: string
  ): ExtractionStatistics {
    const entitiesByType: { [key in EntityType]?: number } = {};
    
    for (const entity of entities) {
      entitiesByType[entity.entity_type] = (entitiesByType[entity.entity_type] || 0) + 1;
    }

    const totalCharsCovered = entities.reduce((sum, entity) => 
      sum + (entity.source_span.end_index - entity.source_span.start_index), 0
    );

    return {
      total_entities_found: entities.length,
      entities_by_type: entitiesByType,
      average_confidence: entities.reduce((sum, e) => sum + e.confidence, 0) / entities.length,
      high_confidence_entities: entities.filter(e => e.confidence >= 0.8).length,
      validation_rate: entities.filter(e => e.validation_status.is_valid).length / entities.length,
      processing_time_ms: processingTime,
      text_coverage: totalCharsCovered / text.length
    };
  }

  private calculateConfidenceMetrics(
    entities: ExtractedEntity[],
    relationships: EntityRelationship[]
  ): ConfidenceMetrics {
    const extractionConfidence = entities.reduce((sum, e) => sum + e.confidence, 0) / entities.length;
    const validationConfidence = entities.reduce((sum, e) => sum + e.validation_status.validation_confidence, 0) / entities.length;
    const relationshipConfidence = relationships.reduce((sum, r) => sum + r.confidence, 0) / Math.max(1, relationships.length);

    const overallConfidence = (extractionConfidence + validationConfidence + relationshipConfidence) / 3;

    return {
      overall_confidence: overallConfidence,
      extraction_confidence: extractionConfidence,
      validation_confidence: validationConfidence,
      relationship_confidence: relationshipConfidence,
      model_uncertainty: 1 - overallConfidence
    };
  }

  /**
   * Extract language-specific entities using localized patterns
   */
  private async extractLanguageSpecificEntities(
    text: string, 
    languageCode: string
  ): Promise<ExtractedEntity[]> {
    const entities: ExtractedEntity[] = [];
    
    // Extract language-specific security terms
    const localizedTerms = this.languageSupport.getLocalizedTerms(languageCode);
    for (const [englishTerm, localizedTerm] of Object.entries(localizedTerms)) {
      if (localizedTerm && localizedTerm !== englishTerm) {
        const regex = new RegExp(`\\b${this.escapeRegex(localizedTerm)}\\b`, 'gi');
        const matches = text.matchAll(regex);
        
        for (const match of matches) {
          if (match.index !== undefined) {
            const entity = await this.createEntity(
              this.mapTermToEntityType(englishTerm),
              match[0],
              match.index,
              text
            );
            
            if (entity) {
              entity.attributes.localized_term = true;
              entity.attributes.english_equivalent = englishTerm;
              entity.normalized_value = englishTerm;
              entities.push(entity);
            }
          }
        }
      }
    }
    
    return entities;
  }
  
  /**
   * Helper methods for multi-language support
   */
  private mapTermToEntityType(term: string): EntityType {
    const termToTypeMap: { [key: string]: EntityType } = {
      'malware': 'malware_family',
      'threat': 'threat_actor',
      'attack': 'attack_pattern',
      'vulnerability': 'vulnerability',
      'apt': 'threat_actor',
      'campaign': 'campaign',
      'actor': 'threat_actor'
    };
    
    return termToTypeMap[term] || 'organization';
  }
  
  private getLanguageSpecificActorPatterns(languageCode: string): RegExp[] {
    const patterns: { [key: string]: RegExp[] } = {
      'en': [
        /\b(APT\d+|Lazarus|Cozy Bear|Fancy Bear|Carbanak|FIN\d+|Equation Group)\b/gi,
        /\b[A-Z][a-z]+ (Group|Team|Actor|Gang)\b/g
      ],
      'zh': [
        /\b(高级持续威胁|APT|网络间谍|黑客组织)\b/g
      ],
      'ru': [
        /\b(группировка|актор|хакер|APT)\b/g
      ]
    };
    
    return patterns[languageCode] || patterns['en'];
  }
  
  private getLanguageSpecificCountries(languageCode: string): string[] {
    const countries: { [key: string]: string[] } = {
      'en': ['United States', 'China', 'Russia', 'North Korea', 'Iran', 'Israel'],
      'zh': ['美国', '中国', '俄罗斯', '朝鲜', '伊朗', '以色列'],
      'ru': ['США', 'Китай', 'Россия', 'Северная Корея', 'Иран', 'Израиль'],
      'fr': ['États-Unis', 'Chine', 'Russie', 'Corée du Nord', 'Iran', 'Israël'],
      'de': ['Vereinigte Staaten', 'China', 'Russland', 'Nordkorea', 'Iran', 'Israel']
    };
    
    return countries[languageCode] || countries['en'];
  }
  
  private getLanguageSpecificDatePatterns(languageCode: string): RegExp[] {
    const patterns: { [key: string]: RegExp[] } = {
      'en': [
        /\d{4}-\d{2}-\d{2}/g,
        /\d{1,2}\/\d{1,2}\/\d{4}/g,
        /(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}/gi
      ],
      'fr': [
        /\d{1,2}\s+(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s+\d{4}/gi,
        /\d{2}\/\d{2}\/\d{4}/g
      ],
      'de': [
        /\d{1,2}\.\s*(Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\s+\d{4}/gi,
        /\d{2}\.\d{2}\.\d{4}/g
      ],
      'zh': [
        /\d{4}年\d{1,2}月\d{1,2}日/g
      ]
    };
    
    return patterns[languageCode] || patterns['en'];
  }
  
  private identifyDateFormat(dateString: string, languageCode: string): string {
    if (/\d{4}-\d{2}-\d{2}/.test(dateString)) return 'ISO';
    if (/\d{1,2}\/\d{1,2}\/\d{4}/.test(dateString)) return 'US';
    if (/\d{2}\.\d{2}\.\d{4}/.test(dateString)) return 'DE';
    if (/\d{4}年\d{1,2}月\d{1,2}日/.test(dateString)) return 'ZH';
    return 'unknown';
  }
  
  private escapeRegex(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  async getModelInfo(): Promise<any> {
    return {
      service: 'EntityExtractionService',
      models: {
        ner_model: this.nerModel ? 'Loaded' : 'Not loaded',
        relationship_model: this.relationshipModel ? 'Loaded' : 'Not loaded'
      },
      vocabulary_size: this.vocabularyMap.size,
      entity_patterns: this.entityPatterns.size,
      supported_languages: this.languageSupport.getSupportedLanguages().map(l => l.code),
      initialized: this.isInitialized
    };
  }
}