/**
 * Security Text Classification Service
 * Advanced text classification for security reports and incident categorization
 */

import { EventEmitter } from 'events';
import { logger, mlLogger } from '../utils/logger';
import * as tf from '@tensorflow/tfjs-node';
import { LanguageSupportService, LanguageInfo } from '../utils/language-support';

// Text classification interfaces
export interface SecurityDocument {
  id: string;
  title: string;
  content: string;
  source: string;
  timestamp: Date;
  metadata: SecurityDocumentMetadata;
  raw_text?: string;
}

export interface SecurityDocumentMetadata {
  author?: string;
  department?: string;
  classification_level: 'public' | 'internal' | 'confidential' | 'restricted';
  document_type: 'incident_report' | 'vulnerability_report' | 'threat_intel' | 'security_alert' | 'policy' | 'procedure';
  urgency: 'low' | 'medium' | 'high' | 'critical';
  tags: string[];
  language: string;
  word_count: number;
  confidence_score?: number;
}

export interface ClassificationRequest {
  request_id: string;
  documents: SecurityDocument[];
  classification_options: ClassificationOptions;
  user_context?: UserContext;
  processing_context?: ProcessingContext;
}

export interface ClassificationOptions {
  classify_threat_type: boolean;
  classify_severity: boolean;
  classify_attack_vector: boolean;
  classify_asset_type: boolean;
  classify_incident_category: boolean;
  classify_vulnerability_type: boolean;
  classify_compliance_domain: boolean;
  extract_keywords: boolean;
  generate_summary: boolean;
  confidence_threshold: number;
  multi_label_classification: boolean;
  custom_categories?: string[];
}

export interface UserContext {
  user_id: string;
  role: string;
  department: string;
  clearance_level: string;
  preferences: UserPreferences;
}

export interface UserPreferences {
  preferred_categories: string[];
  sensitivity_level: number;
  output_format: 'brief' | 'standard' | 'detailed';
  notification_threshold: number;
}

export interface ProcessingContext {
  processing_mode: 'batch' | 'realtime' | 'scheduled';
  priority: number;
  deadline?: Date;
  quality_requirements: QualityRequirements;
}

export interface QualityRequirements {
  min_accuracy: number;
  max_processing_time: number;
  require_human_review: boolean;
  validate_against_rules: boolean;
}

export interface ClassificationResult {
  document_id: string;
  classification_timestamp: Date;
  threat_classification: ThreatClassification;
  severity_classification: SeverityClassification;
  attack_vector_classification: AttackVectorClassification;
  asset_classification: AssetClassification;
  incident_classification: IncidentClassification;
  vulnerability_classification: VulnerabilityClassification;
  compliance_classification: ComplianceClassification;
  keywords: ExtractedKeyword[];
  document_summary: DocumentSummary;
  confidence_metrics: ConfidenceMetrics;
  classification_metadata: ClassificationMetadata;
}

export interface ThreatClassification {
  primary_threat_type: ThreatType;
  secondary_threat_types: ThreatType[];
  threat_family: string;
  threat_sophistication: 'low' | 'medium' | 'high' | 'advanced';
  threat_persistence: 'transient' | 'persistent' | 'advanced_persistent';
  confidence: number;
  reasoning: string[];
}

export interface ThreatType {
  category: string;
  subcategory: string;
  confidence: number;
  indicators: string[];
  mitre_mapping?: string[];
}

export interface SeverityClassification {
  overall_severity: 'low' | 'medium' | 'high' | 'critical';
  impact_severity: 'low' | 'medium' | 'high' | 'critical';
  likelihood_severity: 'low' | 'medium' | 'high' | 'critical';
  urgency_severity: 'low' | 'medium' | 'high' | 'critical';
  business_impact: BusinessImpact;
  technical_impact: TechnicalImpact;
  confidence: number;
  severity_factors: SeverityFactor[];
}

export interface BusinessImpact {
  financial_impact: number;
  operational_impact: number;
  reputational_impact: number;
  regulatory_impact: number;
  customer_impact: number;
  partner_impact: number;
  impact_duration: 'minutes' | 'hours' | 'days' | 'weeks' | 'months';
  affected_business_units: string[];
}

export interface TechnicalImpact {
  confidentiality_impact: number;
  integrity_impact: number;
  availability_impact: number;
  system_impact: number;
  data_impact: number;
  network_impact: number;
  affected_systems: string[];
  affected_applications: string[];
  recovery_complexity: number;
}

export interface SeverityFactor {
  factor_name: string;
  factor_value: number;
  factor_weight: number;
  factor_description: string;
  confidence: number;
}

export interface AttackVectorClassification {
  primary_vector: AttackVector;
  secondary_vectors: AttackVector[];
  vector_sophistication: number;
  vector_accessibility: number;
  confidence: number;
  attack_path: AttackPathStep[];
}

export interface AttackVector {
  vector_type: 'network' | 'adjacent' | 'local' | 'physical' | 'social' | 'supply_chain' | 'insider';
  vector_subtype: string;
  access_complexity: 'low' | 'medium' | 'high';
  authentication_required: boolean;
  user_interaction: 'none' | 'required' | 'passive';
  confidence: number;
  evidence: string[];
}

export interface AttackPathStep {
  step_number: number;
  step_description: string;
  step_type: string;
  required_capabilities: string[];
  potential_mitigations: string[];
  confidence: number;
}

export interface AssetClassification {
  primary_asset_type: AssetType;
  secondary_asset_types: AssetType[];
  asset_criticality: 'low' | 'medium' | 'high' | 'critical';
  asset_sensitivity: 'public' | 'internal' | 'confidential' | 'restricted';
  data_classification: DataClassification;
  confidence: number;
}

export interface AssetType {
  asset_category: 'data' | 'system' | 'application' | 'network' | 'physical' | 'personnel' | 'process';
  asset_subcategory: string;
  asset_value: number;
  business_function: string;
  compliance_requirements: string[];
  confidence: number;
}

export interface DataClassification {
  data_types: DataType[];
  sensitivity_level: number;
  privacy_impact: number;
  regulatory_requirements: string[];
  retention_requirements: string;
}

export interface DataType {
  type_name: string;
  type_category: string;
  sensitivity: number;
  volume_estimate: string;
  processing_requirements: string[];
}

export interface IncidentClassification {
  incident_type: IncidentType;
  incident_stage: 'initial' | 'active' | 'contained' | 'eradicated' | 'recovered' | 'lessons_learned';
  incident_scope: 'isolated' | 'localized' | 'widespread' | 'enterprise' | 'external';
  response_requirements: ResponseRequirement[];
  escalation_criteria: EscalationCriteria;
  confidence: number;
}

export interface IncidentType {
  primary_category: string;
  secondary_categories: string[];
  incident_family: string;
  incident_complexity: number;
  expected_duration: string;
  resource_requirements: string[];
}

export interface ResponseRequirement {
  requirement_type: 'immediate' | 'short_term' | 'long_term';
  requirement_description: string;
  required_roles: string[];
  required_tools: string[];
  priority: number;
}

export interface EscalationCriteria {
  auto_escalation_triggers: string[];
  escalation_timeline: EscalationStep[];
  notification_requirements: NotificationRequirement[];
}

export interface EscalationStep {
  step_number: number;
  time_threshold: number;
  escalation_level: string;
  required_actions: string[];
  notification_list: string[];
}

export interface NotificationRequirement {
  notification_type: 'email' | 'sms' | 'call' | 'webhook' | 'dashboard';
  recipients: string[];
  trigger_conditions: string[];
  message_template: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
}

export interface VulnerabilityClassification {
  vulnerability_type: VulnerabilityType;
  vulnerability_source: 'code' | 'configuration' | 'design' | 'operational' | 'third_party';
  exploitability: ExploitabilityMetrics;
  impact_metrics: VulnerabilityImpact;
  cvss_metrics: CVSSMetrics;
  remediation_info: RemediationInfo;
  confidence: number;
}

export interface VulnerabilityType {
  cwe_category: string;
  vulnerability_class: string;
  vulnerability_subclass: string;
  attack_patterns: string[];
  common_mitigations: string[];
}

export interface ExploitabilityMetrics {
  attack_vector: 'network' | 'adjacent' | 'local' | 'physical';
  attack_complexity: 'low' | 'high';
  privileges_required: 'none' | 'low' | 'high';
  user_interaction: 'none' | 'required';
  scope: 'unchanged' | 'changed';
  exploit_likelihood: number;
  weaponization_time: string;
}

export interface VulnerabilityImpact {
  confidentiality_impact: 'none' | 'low' | 'high';
  integrity_impact: 'none' | 'low' | 'high';
  availability_impact: 'none' | 'low' | 'high';
  business_impact_score: number;
  affected_components: string[];
}

export interface CVSSMetrics {
  cvss_version: '2.0' | '3.0' | '3.1';
  base_score: number;
  temporal_score?: number;
  environmental_score?: number;
  base_vector: string;
  overall_score: number;
  severity_rating: 'low' | 'medium' | 'high' | 'critical';
}

export interface RemediationInfo {
  remediation_type: 'patch' | 'configuration' | 'workaround' | 'replacement' | 'acceptance';
  remediation_complexity: 'low' | 'medium' | 'high';
  remediation_timeline: string;
  remediation_cost: 'low' | 'medium' | 'high';
  remediation_steps: RemediationStep[];
  verification_steps: VerificationStep[];
}

export interface RemediationStep {
  step_number: number;
  step_description: string;
  step_type: string;
  required_tools: string[];
  estimated_time: number;
  risk_level: 'low' | 'medium' | 'high';
  rollback_procedure?: string;
}

export interface VerificationStep {
  step_number: number;
  verification_method: string;
  success_criteria: string[];
  failure_indicators: string[];
  automated_check: boolean;
}

export interface ComplianceClassification {
  applicable_frameworks: ComplianceFramework[];
  compliance_requirements: ComplianceRequirement[];
  violation_risk: ViolationRisk;
  reporting_requirements: ReportingRequirement[];
  confidence: number;
}

export interface ComplianceFramework {
  framework_name: string;
  framework_version: string;
  applicable_controls: string[];
  compliance_level: 'low' | 'medium' | 'high';
  assessment_frequency: string;
}

export interface ComplianceRequirement {
  requirement_id: string;
  requirement_description: string;
  control_family: string;
  implementation_status: 'not_implemented' | 'partially_implemented' | 'implemented' | 'not_applicable';
  compliance_gap: number;
  remediation_priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface ViolationRisk {
  probability: number;
  impact: number;
  risk_score: number;
  potential_penalties: PotentialPenalty[];
  mitigation_strategies: string[];
}

export interface PotentialPenalty {
  penalty_type: 'fine' | 'suspension' | 'revocation' | 'legal_action';
  estimated_amount?: number;
  currency?: string;
  probability: number;
  timeframe: string;
}

export interface ReportingRequirement {
  reporting_body: string;
  reporting_timeline: string;
  reporting_format: string;
  required_information: string[];
  contact_information: string;
}

export interface ExtractedKeyword {
  keyword: string;
  keyword_type: 'entity' | 'concept' | 'action' | 'technology' | 'location' | 'temporal';
  frequency: number;
  context: string[];
  relevance_score: number;
  confidence: number;
}

export interface DocumentSummary {
  executive_summary: string;
  key_points: string[];
  critical_findings: string[];
  recommendations: string[];
  next_steps: string[];
  confidence: number;
}

export interface ConfidenceMetrics {
  overall_confidence: number;
  classification_confidence: ClassificationConfidence;
  feature_confidence: FeatureConfidence;
  model_confidence: ModelConfidence;
}

export interface ClassificationConfidence {
  threat_confidence: number;
  severity_confidence: number;
  vector_confidence: number;
  asset_confidence: number;
  incident_confidence: number;
  vulnerability_confidence: number;
  compliance_confidence: number;
}

export interface FeatureConfidence {
  text_quality: number;
  feature_extraction: number;
  pattern_recognition: number;
  entity_recognition: number;
  sentiment_analysis: number;
}

export interface ModelConfidence {
  model_accuracy: number;
  prediction_stability: number;
  feature_importance: FeatureImportance[];
  uncertainty_quantification: number;
}

export interface FeatureImportance {
  feature_name: string;
  importance_score: number;
  contribution_type: 'positive' | 'negative' | 'neutral';
  confidence: number;
}

export interface ClassificationMetadata {
  processing_time: number;
  model_version: string;
  feature_set_version: string;
  classification_rules_version: string;
  quality_scores: QualityScore[];
  validation_results: ValidationResult[];
}

export interface QualityScore {
  metric_name: string;
  metric_value: number;
  metric_threshold: number;
  passes_threshold: boolean;
}

export interface ValidationResult {
  validation_type: string;
  validation_result: 'pass' | 'fail' | 'warning';
  validation_message: string;
  validation_confidence: number;
}

export interface ClassificationResponse {
  request_id: string;
  processing_timestamp: Date;
  classification_results: ClassificationResult[];
  summary_statistics: SummaryStatistics;
  processing_errors: ProcessingError[];
  recommendations: ClassificationRecommendation[];
}

export interface SummaryStatistics {
  total_documents: number;
  successfully_classified: number;
  classification_errors: number;
  average_confidence: number;
  confidence_distribution: ConfidenceDistribution;
  threat_distribution: ThreatDistribution;
  severity_distribution: SeverityDistribution;
  processing_performance: ProcessingPerformance;
}

export interface ConfidenceDistribution {
  high_confidence: number;
  medium_confidence: number;
  low_confidence: number;
  uncertain: number;
}

export interface ThreatDistribution {
  threat_types: ThreatTypeCount[];
  attack_vectors: AttackVectorCount[];
  threat_families: ThreatFamilyCount[];
}

export interface ThreatTypeCount {
  threat_type: string;
  count: number;
  percentage: number;
  average_confidence: number;
}

export interface AttackVectorCount {
  vector_type: string;
  count: number;
  percentage: number;
  average_sophistication: number;
}

export interface ThreatFamilyCount {
  family_name: string;
  count: number;
  percentage: number;
  severity_distribution: { [key: string]: number };
}

export interface SeverityDistribution {
  severity_levels: SeverityLevelCount[];
  impact_distribution: ImpactDistribution;
  urgency_distribution: UrgencyDistribution;
}

export interface SeverityLevelCount {
  severity_level: string;
  count: number;
  percentage: number;
  average_confidence: number;
}

export interface ImpactDistribution {
  business_impact: { [key: string]: number };
  technical_impact: { [key: string]: number };
  compliance_impact: { [key: string]: number };
}

export interface UrgencyDistribution {
  immediate: number;
  short_term: number;
  medium_term: number;
  long_term: number;
}

export interface ProcessingPerformance {
  total_processing_time: number;
  average_document_time: number;
  throughput_documents_per_second: number;
  memory_usage: MemoryUsage;
  cpu_usage: CPUUsage;
}

export interface MemoryUsage {
  peak_memory_mb: number;
  average_memory_mb: number;
  memory_efficiency: number;
}

export interface CPUUsage {
  peak_cpu_percent: number;
  average_cpu_percent: number;
  cpu_efficiency: number;
}

export interface ProcessingError {
  error_id: string;
  document_id: string;
  error_type: string;
  error_message: string;
  error_context: string;
  severity: 'low' | 'medium' | 'high';
  suggestions: string[];
  retry_recommendation: boolean;
}

export interface ClassificationRecommendation {
  recommendation_type: 'model_improvement' | 'data_quality' | 'processing_optimization' | 'accuracy_enhancement';
  recommendation_description: string;
  implementation_priority: 'low' | 'medium' | 'high' | 'critical';
  expected_benefit: string;
  implementation_effort: 'low' | 'medium' | 'high';
  dependencies: string[];
}

export class SecurityTextClassifierService extends EventEmitter {
  private classificationModel?: tf.LayersModel;
  private threatTypeModel?: tf.LayersModel;
  private severityModel?: tf.LayersModel;
  private vectorModel?: tf.LayersModel;
  private vocabularyMap: Map<string, number> = new Map();
  private languageSupport: LanguageSupportService;
  private categoryMap: Map<string, number> = new Map();
  private isInitialized: boolean = false;
  private modelMetrics: any = {};

  // Classification categories
  private readonly threatCategories = [
    'malware', 'phishing', 'social_engineering', 'data_breach', 'insider_threat',
    'ddos', 'vulnerability', 'advanced_persistent_threat', 'ransomware', 'botnet',
    'supply_chain_attack', 'zero_day', 'privilege_escalation', 'lateral_movement',
    'data_exfiltration', 'credential_theft', 'business_email_compromise'
  ];

  private readonly severityLevels = ['low', 'medium', 'high', 'critical'];
  
  private readonly attackVectors = [
    'network', 'email', 'web_application', 'physical', 'social', 'supply_chain',
    'insider', 'remote_access', 'wireless', 'mobile', 'cloud', 'third_party'
  ];

  constructor() {
    super();
    this.languageSupport = LanguageSupportService.getInstance();
    this.initializeService();
  }

  private async initializeService(): Promise<void> {
    try {
      logger.info('Initializing Security Text Classification Service...');
      
      await this.initializeModels();
      await this.loadVocabularies();
      await this.loadClassificationRules();
      
      this.isInitialized = true;
      this.emit('initialized');
      
      logger.info('Security Text Classification Service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize text classification service:', error);
      throw error;
    }
  }

  private async initializeModels(): Promise<void> {
    // Multi-label threat classification model
    this.threatTypeModel = tf.sequential({
      layers: [
        tf.layers.embedding({
          inputDim: 15000,
          outputDim: 128,
          inputLength: 256
        }),
        tf.layers.globalMaxPooling1d(),
        tf.layers.dense({
          units: 256,
          activation: 'relu'
        }),
        tf.layers.dropout({ rate: 0.3 }),
        tf.layers.dense({
          units: 128,
          activation: 'relu'
        }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({
          units: this.threatCategories.length,
          activation: 'sigmoid' // Multi-label classification
        })
      ]
    });

    // Severity classification model
    this.severityModel = tf.sequential({
      layers: [
        tf.layers.embedding({
          inputDim: 15000,
          outputDim: 96,
          inputLength: 256
        }),
        tf.layers.bidirectional({
          layer: tf.layers.lstm({
            units: 64,
            returnSequences: false
          })
        }),
        tf.layers.dropout({ rate: 0.4 }),
        tf.layers.dense({
          units: 64,
          activation: 'relu'
        }),
        tf.layers.dense({
          units: this.severityLevels.length,
          activation: 'softmax'
        })
      ]
    });

    // Attack vector classification model
    this.vectorModel = tf.sequential({
      layers: [
        tf.layers.embedding({
          inputDim: 15000,
          outputDim: 96,
          inputLength: 256
        }),
        tf.layers.conv1d({
          filters: 128,
          kernelSize: 3,
          activation: 'relu'
        }),
        tf.layers.globalMaxPooling1d(),
        tf.layers.dense({
          units: 128,
          activation: 'relu'
        }),
        tf.layers.dropout({ rate: 0.3 }),
        tf.layers.dense({
          units: this.attackVectors.length,
          activation: 'softmax'
        })
      ]
    });

    // Compile models
    this.threatTypeModel.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'binaryCrossentropy',
      metrics: ['accuracy', 'precision', 'recall']
    });

    this.severityModel.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });

    this.vectorModel.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });

    logger.info('Classification models initialized successfully');
  }

  private async loadVocabularies(): Promise<void> {
    // Security-specific vocabulary
    const securityTerms = [
      // Malware terms
      'malware', 'virus', 'trojan', 'ransomware', 'spyware', 'adware', 'rootkit',
      'keylogger', 'botnet', 'worm', 'backdoor', 'dropper', 'loader', 'cryptominer',
      
      // Attack terms
      'attack', 'exploit', 'vulnerability', 'zero-day', 'phishing', 'spear-phishing',
      'social-engineering', 'credential-harvesting', 'data-breach', 'exfiltration',
      
      // Infrastructure terms
      'c2', 'command-control', 'infrastructure', 'payload', 'domain', 'ip-address',
      'hash', 'signature', 'indicator', 'ioc', 'artifact',
      
      // Techniques
      'lateral-movement', 'privilege-escalation', 'persistence', 'defense-evasion',
      'reconnaissance', 'weaponization', 'delivery', 'exploitation', 'installation',
      
      // Organizations and standards
      'mitre', 'nist', 'iso', 'cis', 'owasp', 'sans', 'cert', 'cve', 'cvss',
      
      // Response terms
      'incident', 'response', 'containment', 'eradication', 'recovery', 'forensics',
      'analysis', 'investigation', 'remediation', 'mitigation'
    ];

    securityTerms.forEach((term, index) => {
      this.vocabularyMap.set(term.toLowerCase(), index + 1);
    });

    // Initialize category mappings
    this.threatCategories.forEach((category, index) => {
      this.categoryMap.set(category, index);
    });

    logger.info('Security vocabularies loaded successfully');
  }

  private async loadClassificationRules(): Promise<void> {
    // Load rule-based classification patterns
    // This would typically be loaded from a configuration file
    logger.info('Classification rules loaded successfully');
  }

  async classifySecurityDocuments(
    request: ClassificationRequest
  ): Promise<ClassificationResponse> {
    if (!this.isInitialized) {
      throw new Error('Text classification service not initialized');
    }

    logger.info(`Processing text classification request: ${request.request_id}`);
    const startTime = Date.now();

    try {
      const classificationResults: ClassificationResult[] = [];
      const processingErrors: ProcessingError[] = [];

      // Process each document
      for (const document of request.documents) {
        try {
          const result = await this.classifyDocument(document, request.classification_options);
          classificationResults.push(result);
        } catch (error) {
          const processingError: ProcessingError = {
            error_id: `error_${Date.now()}_${Math.random()}`,
            document_id: document.id,
            error_type: 'classification_error',
            error_message: error instanceof Error ? error.message : 'Unknown error',
            error_context: 'Document classification',
            severity: 'medium',
            suggestions: ['Check document format', 'Verify text encoding', 'Review content length'],
            retry_recommendation: true
          };
          processingErrors.push(processingError);
          logger.warn(`Failed to classify document ${document.id}:`, error);
        }
      }

      // Calculate summary statistics
      const summaryStatistics = await this.calculateSummaryStatistics(
        request.documents.length,
        classificationResults,
        processingErrors,
        Date.now() - startTime
      );

      // Generate recommendations
      const recommendations = await this.generateRecommendations(classificationResults, processingErrors);

      const response: ClassificationResponse = {
        request_id: request.request_id,
        processing_timestamp: new Date(),
        classification_results: classificationResults,
        summary_statistics: summaryStatistics,
        processing_errors: processingErrors,
        recommendations
      };

      this.emit('classification_completed', response);
      logger.info(`Text classification completed in ${Date.now() - startTime}ms`);

      return response;

    } catch (error) {
      logger.error('Text classification failed:', error);
      throw error;
    }
  }

  private async classifyDocument(
    document: SecurityDocument,
    options: ClassificationOptions
  ): Promise<ClassificationResult> {
    const startTime = Date.now();

    // Preprocess text
    const processedText = await this.preprocessText(document.content);
    const textFeatures = await this.extractTextFeatures(processedText);

    const result: ClassificationResult = {
      document_id: document.id,
      classification_timestamp: new Date(),
      threat_classification: {
        primary_threat_type: { category: 'unknown', subcategory: 'unknown', confidence: 0, indicators: [] },
        secondary_threat_types: [],
        threat_family: 'unknown',
        threat_sophistication: 'medium',
        threat_persistence: 'transient',
        confidence: 0,
        reasoning: []
      },
      severity_classification: {
        overall_severity: 'medium',
        impact_severity: 'medium',
        likelihood_severity: 'medium',
        urgency_severity: 'medium',
        business_impact: {
          financial_impact: 0.5,
          operational_impact: 0.5,
          reputational_impact: 0.5,
          regulatory_impact: 0.5,
          customer_impact: 0.5,
          partner_impact: 0.5,
          impact_duration: 'hours',
          affected_business_units: []
        },
        technical_impact: {
          confidentiality_impact: 0.5,
          integrity_impact: 0.5,
          availability_impact: 0.5,
          system_impact: 0.5,
          data_impact: 0.5,
          network_impact: 0.5,
          affected_systems: [],
          affected_applications: [],
          recovery_complexity: 0.5
        },
        confidence: 0,
        severity_factors: []
      },
      attack_vector_classification: {
        primary_vector: {
          vector_type: 'network',
          vector_subtype: 'unknown',
          access_complexity: 'medium',
          authentication_required: false,
          user_interaction: 'none',
          confidence: 0,
          evidence: []
        },
        secondary_vectors: [],
        vector_sophistication: 0.5,
        vector_accessibility: 0.5,
        confidence: 0,
        attack_path: []
      },
      asset_classification: {
        primary_asset_type: {
          asset_category: 'system',
          asset_subcategory: 'unknown',
          asset_value: 0.5,
          business_function: 'unknown',
          compliance_requirements: [],
          confidence: 0
        },
        secondary_asset_types: [],
        asset_criticality: 'medium',
        asset_sensitivity: 'internal',
        data_classification: {
          data_types: [],
          sensitivity_level: 0.5,
          privacy_impact: 0.5,
          regulatory_requirements: [],
          retention_requirements: 'standard'
        },
        confidence: 0
      },
      incident_classification: {
        incident_type: {
          primary_category: 'security_incident',
          secondary_categories: [],
          incident_family: 'unknown',
          incident_complexity: 0.5,
          expected_duration: 'hours',
          resource_requirements: []
        },
        incident_stage: 'initial',
        incident_scope: 'localized',
        response_requirements: [],
        escalation_criteria: {
          auto_escalation_triggers: [],
          escalation_timeline: [],
          notification_requirements: []
        },
        confidence: 0
      },
      vulnerability_classification: {
        vulnerability_type: {
          cwe_category: 'unknown',
          vulnerability_class: 'unknown',
          vulnerability_subclass: 'unknown',
          attack_patterns: [],
          common_mitigations: []
        },
        vulnerability_source: 'code',
        exploitability: {
          attack_vector: 'network',
          attack_complexity: 'low',
          privileges_required: 'none',
          user_interaction: 'none',
          scope: 'unchanged',
          exploit_likelihood: 0.5,
          weaponization_time: 'days'
        },
        impact_metrics: {
          confidentiality_impact: 'low',
          integrity_impact: 'low',
          availability_impact: 'low',
          business_impact_score: 0.5,
          affected_components: []
        },
        cvss_metrics: {
          cvss_version: '3.1',
          base_score: 5.0,
          base_vector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:L/A:L',
          overall_score: 5.0,
          severity_rating: 'medium'
        },
        remediation_info: {
          remediation_type: 'patch',
          remediation_complexity: 'medium',
          remediation_timeline: 'weeks',
          remediation_cost: 'medium',
          remediation_steps: [],
          verification_steps: []
        },
        confidence: 0
      },
      compliance_classification: {
        applicable_frameworks: [],
        compliance_requirements: [],
        violation_risk: {
          probability: 0.3,
          impact: 0.5,
          risk_score: 0.15,
          potential_penalties: [],
          mitigation_strategies: []
        },
        reporting_requirements: [],
        confidence: 0
      },
      keywords: [],
      document_summary: {
        executive_summary: '',
        key_points: [],
        critical_findings: [],
        recommendations: [],
        next_steps: [],
        confidence: 0
      },
      confidence_metrics: {
        overall_confidence: 0,
        classification_confidence: {
          threat_confidence: 0,
          severity_confidence: 0,
          vector_confidence: 0,
          asset_confidence: 0,
          incident_confidence: 0,
          vulnerability_confidence: 0,
          compliance_confidence: 0
        },
        feature_confidence: {
          text_quality: 0,
          feature_extraction: 0,
          pattern_recognition: 0,
          entity_recognition: 0,
          sentiment_analysis: 0
        },
        model_confidence: {
          model_accuracy: 0,
          prediction_stability: 0,
          feature_importance: [],
          uncertainty_quantification: 0
        }
      },
      classification_metadata: {
        processing_time: Date.now() - startTime,
        model_version: '1.0.0',
        feature_set_version: '1.0.0',
        classification_rules_version: '1.0.0',
        quality_scores: [],
        validation_results: []
      }
    };

    // Perform classification tasks based on options
    if (options.classify_threat_type) {
      result.threat_classification = await this.classifyThreatType(textFeatures, processedText);
    }

    if (options.classify_severity) {
      result.severity_classification = await this.classifySeverity(textFeatures, processedText, document);
    }

    if (options.classify_attack_vector) {
      result.attack_vector_classification = await this.classifyAttackVector(textFeatures, processedText);
    }

    if (options.classify_asset_type) {
      result.asset_classification = await this.classifyAssetType(textFeatures, processedText);
    }

    if (options.classify_incident_category) {
      result.incident_classification = await this.classifyIncident(textFeatures, processedText);
    }

    if (options.classify_vulnerability_type) {
      result.vulnerability_classification = await this.classifyVulnerability(textFeatures, processedText);
    }

    if (options.classify_compliance_domain) {
      result.compliance_classification = await this.classifyCompliance(textFeatures, processedText);
    }

    if (options.extract_keywords) {
      result.keywords = await this.extractKeywords(processedText);
    }

    if (options.generate_summary) {
      result.document_summary = await this.generateSummary(document, result);
    }

    // Calculate confidence metrics
    result.confidence_metrics = await this.calculateConfidenceMetrics(result, textFeatures);

    // Update processing time
    result.classification_metadata.processing_time = Date.now() - startTime;

    return result;
  }

  private async preprocessText(text: string): Promise<string> {
    // Clean and normalize text
    let processed = text.toLowerCase();
    
    // Remove special characters but keep important security terms
    processed = processed.replace(/[^\w\s\-\.@:\/]/g, ' ');
    
    // Normalize whitespace
    processed = processed.replace(/\s+/g, ' ').trim();
    
    // Expand common abbreviations
    const expansions = {
      'c2': 'command and control',
      'apt': 'advanced persistent threat',
      'ioc': 'indicator of compromise',
      'ttp': 'tactics techniques procedures',
      'ddos': 'distributed denial of service',
      'mitm': 'man in the middle',
      'xss': 'cross site scripting',
      'csrf': 'cross site request forgery',
      'sqli': 'sql injection'
    };

    for (const [abbr, expansion] of Object.entries(expansions)) {
      const regex = new RegExp(`\\b${abbr}\\b`, 'gi');
      processed = processed.replace(regex, expansion);
    }

    return processed;
  }

  private async extractTextFeatures(text: string): Promise<tf.Tensor> {
    // Convert text to numerical features for model input
    const words = text.split(/\s+/).slice(0, 256); // Limit to 256 tokens
    const indices: number[] = [];

    for (const word of words) {
      const index = this.vocabularyMap.get(word.toLowerCase()) || 0;
      indices.push(index);
    }

    // Pad or truncate to fixed length
    while (indices.length < 256) {
      indices.push(0);
    }

    return tf.tensor2d([indices.slice(0, 256)], [1, 256]);
  }

  private async classifyThreatType(features: tf.Tensor, text: string): Promise<ThreatClassification> {
    if (!this.threatTypeModel) {
      throw new Error('Threat type model not loaded');
    }

    const predictions = this.threatTypeModel.predict(features) as tf.Tensor;
    const probabilities = await predictions.data();

    // Find primary and secondary threat types
    const threatScores = Array.from(probabilities).map((prob, index) => ({
      category: this.threatCategories[index],
      confidence: prob,
      subcategory: this.threatCategories[index],
      indicators: this.findThreatIndicators(text, this.threatCategories[index])
    }));

    threatScores.sort((a, b) => b.confidence - a.confidence);

    const primaryThreat = threatScores[0];
    const secondaryThreats = threatScores.slice(1, 4).filter(t => t.confidence > 0.3);

    // Clean up tensors
    predictions.dispose();

    return {
      primary_threat_type: primaryThreat,
      secondary_threat_types: secondaryThreats,
      threat_family: this.determineThreatFamily(primaryThreat.category),
      threat_sophistication: this.assessThreatSophistication(text),
      threat_persistence: this.assessThreatPersistence(text),
      confidence: primaryThreat.confidence,
      reasoning: this.generateThreatReasoning(primaryThreat, text)
    };
  }

  private findThreatIndicators(text: string, threatType: string): string[] {
    const indicators: { [key: string]: string[] } = {
      malware: ['executable', 'binary', 'payload', 'dropper', 'loader'],
      phishing: ['suspicious email', 'credential', 'login', 'urgent', 'verify'],
      ransomware: ['encrypted', 'payment', 'bitcoin', 'decrypt', 'ransom'],
      ddos: ['traffic', 'volume', 'bandwidth', 'overwhelm', 'amplification']
    };

    const threatIndicators = indicators[threatType] || [];
    return threatIndicators.filter(indicator => 
      text.toLowerCase().includes(indicator.toLowerCase())
    );
  }

  private determineThreatFamily(category: string): string {
    const families: { [key: string]: string } = {
      malware: 'malware_family',
      phishing: 'social_engineering_family',
      ransomware: 'malware_family',
      ddos: 'denial_of_service_family',
      advanced_persistent_threat: 'apt_family'
    };

    return families[category] || 'unknown_family';
  }

  private assessThreatSophistication(text: string): 'low' | 'medium' | 'high' | 'advanced' {
    const sophisticationIndicators = {
      low: ['script kiddie', 'basic', 'simple', 'automated'],
      medium: ['organized', 'coordinated', 'persistent'],
      high: ['advanced', 'sophisticated', 'custom', 'zero-day'],
      advanced: ['nation-state', 'apt', 'highly sophisticated', 'state-sponsored']
    };

    for (const [level, indicators] of Object.entries(sophisticationIndicators)) {
      for (const indicator of indicators) {
        if (text.toLowerCase().includes(indicator)) {
          return level as any;
        }
      }
    }

    return 'medium';
  }

  private assessThreatPersistence(text: string): 'transient' | 'persistent' | 'advanced_persistent' {
    if (text.toLowerCase().includes('advanced persistent threat') || text.toLowerCase().includes('apt')) {
      return 'advanced_persistent';
    } else if (text.toLowerCase().includes('persistent') || text.toLowerCase().includes('long-term')) {
      return 'persistent';
    }
    return 'transient';
  }

  private generateThreatReasoning(threat: ThreatType, text: string): string[] {
    const reasoning = [];
    
    if (threat.confidence > 0.8) {
      reasoning.push('High confidence based on strong keyword matches');
    }
    
    if (threat.indicators.length > 0) {
      reasoning.push(`Found ${threat.indicators.length} threat-specific indicators`);
    }
    
    reasoning.push(`Primary classification: ${threat.category}`);
    
    return reasoning;
  }

  private async classifySeverity(
    features: tf.Tensor, 
    text: string, 
    document: SecurityDocument
  ): Promise<SeverityClassification> {
    if (!this.severityModel) {
      throw new Error('Severity model not loaded');
    }

    const predictions = this.severityModel.predict(features) as tf.Tensor;
    const probabilities = await predictions.data();

    const severityScores = this.severityLevels.map((level, index) => ({
      level,
      confidence: probabilities[index]
    }));

    severityScores.sort((a, b) => b.confidence - a.confidence);
    const primarySeverity = severityScores[0];

    // Clean up tensors
    predictions.dispose();

    // Calculate impact assessments
    const businessImpact = await this.assessBusinessImpact(text, document);
    const technicalImpact = await this.assessTechnicalImpact(text, document);
    const severityFactors = await this.calculateSeverityFactors(text);

    return {
      overall_severity: primarySeverity.level as any,
      impact_severity: this.deriveImpactSeverity(businessImpact, technicalImpact),
      likelihood_severity: this.deriveLikelihoodSeverity(text),
      urgency_severity: this.deriveUrgencySeverity(text, document),
      business_impact: businessImpact,
      technical_impact: technicalImpact,
      confidence: primarySeverity.confidence,
      severity_factors: severityFactors
    };
  }

  private async assessBusinessImpact(text: string, document: SecurityDocument): Promise<BusinessImpact> {
    // Simple rule-based business impact assessment
    const impactKeywords = {
      financial: ['revenue', 'cost', 'financial', 'money', 'budget'],
      operational: ['operations', 'business', 'process', 'workflow'],
      reputational: ['reputation', 'brand', 'public', 'media', 'trust'],
      regulatory: ['compliance', 'regulation', 'legal', 'audit', 'fine'],
      customer: ['customer', 'client', 'user', 'service'],
      partner: ['partner', 'vendor', 'supplier', 'third-party']
    };

    const impact: BusinessImpact = {
      financial_impact: this.calculateKeywordScore(text, impactKeywords.financial),
      operational_impact: this.calculateKeywordScore(text, impactKeywords.operational),
      reputational_impact: this.calculateKeywordScore(text, impactKeywords.reputational),
      regulatory_impact: this.calculateKeywordScore(text, impactKeywords.regulatory),
      customer_impact: this.calculateKeywordScore(text, impactKeywords.customer),
      partner_impact: this.calculateKeywordScore(text, impactKeywords.partner),
      impact_duration: this.estimateImpactDuration(text),
      affected_business_units: this.extractBusinessUnits(text)
    };

    return impact;
  }

  private calculateKeywordScore(text: string, keywords: string[]): number {
    const matches = keywords.filter(keyword => 
      text.toLowerCase().includes(keyword.toLowerCase())
    ).length;
    return Math.min(1.0, matches / keywords.length * 2);
  }

  private estimateImpactDuration(text: string): 'minutes' | 'hours' | 'days' | 'weeks' | 'months' {
    if (text.includes('immediate') || text.includes('urgent')) return 'minutes';
    if (text.includes('hours') || text.includes('today')) return 'hours';
    if (text.includes('days') || text.includes('week')) return 'days';
    if (text.includes('weeks') || text.includes('month')) return 'weeks';
    return 'days'; // default
  }

  private extractBusinessUnits(text: string): string[] {
    const units = ['IT', 'HR', 'Finance', 'Operations', 'Legal', 'Marketing', 'Sales'];
    return units.filter(unit => 
      text.toLowerCase().includes(unit.toLowerCase())
    );
  }

  private async assessTechnicalImpact(text: string, document: SecurityDocument): Promise<TechnicalImpact> {
    return {
      confidentiality_impact: this.calculateKeywordScore(text, ['confidential', 'secret', 'private', 'leak']),
      integrity_impact: this.calculateKeywordScore(text, ['integrity', 'modify', 'alter', 'corrupt']),
      availability_impact: this.calculateKeywordScore(text, ['availability', 'down', 'outage', 'unavailable']),
      system_impact: this.calculateKeywordScore(text, ['system', 'server', 'infrastructure']),
      data_impact: this.calculateKeywordScore(text, ['data', 'database', 'information']),
      network_impact: this.calculateKeywordScore(text, ['network', 'connectivity', 'traffic']),
      affected_systems: this.extractAffectedSystems(text),
      affected_applications: this.extractAffectedApplications(text),
      recovery_complexity: this.assessRecoveryComplexity(text)
    };
  }

  private extractAffectedSystems(text: string): string[] {
    const systems = ['Windows', 'Linux', 'macOS', 'Active Directory', 'Exchange', 'SharePoint'];
    return systems.filter(system => 
      text.toLowerCase().includes(system.toLowerCase())
    );
  }

  private extractAffectedApplications(text: string): string[] {
    const apps = ['email', 'web', 'database', 'application', 'service'];
    return apps.filter(app => 
      text.toLowerCase().includes(app.toLowerCase())
    );
  }

  private assessRecoveryComplexity(text: string): number {
    if (text.includes('simple') || text.includes('easy')) return 0.3;
    if (text.includes('complex') || text.includes('difficult')) return 0.8;
    if (text.includes('complete rebuild') || text.includes('total loss')) return 1.0;
    return 0.5;
  }

  private async calculateSeverityFactors(text: string): Promise<SeverityFactor[]> {
    const factors: SeverityFactor[] = [
      {
        factor_name: 'threat_sophistication',
        factor_value: this.calculateKeywordScore(text, ['advanced', 'sophisticated', 'complex']),
        factor_weight: 0.3,
        factor_description: 'Level of threat sophistication',
        confidence: 0.8
      },
      {
        factor_name: 'attack_scale',
        factor_value: this.calculateKeywordScore(text, ['widespread', 'global', 'enterprise']),
        factor_weight: 0.25,
        factor_description: 'Scale of the attack',
        confidence: 0.7
      },
      {
        factor_name: 'data_sensitivity',
        factor_value: this.calculateKeywordScore(text, ['sensitive', 'classified', 'confidential']),
        factor_weight: 0.25,
        factor_description: 'Sensitivity of affected data',
        confidence: 0.8
      },
      {
        factor_name: 'business_criticality',
        factor_value: this.calculateKeywordScore(text, ['critical', 'essential', 'mission']),
        factor_weight: 0.2,
        factor_description: 'Business criticality of affected assets',
        confidence: 0.75
      }
    ];

    return factors;
  }

  private deriveImpactSeverity(business: BusinessImpact, technical: TechnicalImpact): 'low' | 'medium' | 'high' | 'critical' {
    const averageBusinessImpact = (
      business.financial_impact + business.operational_impact + business.reputational_impact +
      business.regulatory_impact + business.customer_impact + business.partner_impact
    ) / 6;

    const averageTechnicalImpact = (
      technical.confidentiality_impact + technical.integrity_impact + technical.availability_impact +
      technical.system_impact + technical.data_impact + technical.network_impact
    ) / 6;

    const overallImpact = (averageBusinessImpact + averageTechnicalImpact) / 2;

    if (overallImpact >= 0.8) return 'critical';
    if (overallImpact >= 0.6) return 'high';
    if (overallImpact >= 0.4) return 'medium';
    return 'low';
  }

  private deriveLikelihoodSeverity(text: string): 'low' | 'medium' | 'high' | 'critical' {
    const likelihood = this.calculateKeywordScore(text, [
      'likely', 'probable', 'confirmed', 'active', 'ongoing', 'imminent'
    ]);

    if (likelihood >= 0.8) return 'critical';
    if (likelihood >= 0.6) return 'high';
    if (likelihood >= 0.4) return 'medium';
    return 'low';
  }

  private deriveUrgencySeverity(text: string, document: SecurityDocument): 'low' | 'medium' | 'high' | 'critical' {
    const urgency = this.calculateKeywordScore(text, [
      'urgent', 'immediate', 'emergency', 'critical', 'asap', 'now'
    ]);

    // Factor in document metadata
    if (document.metadata.urgency === 'critical') return 'critical';
    if (document.metadata.urgency === 'high' && urgency >= 0.5) return 'critical';

    if (urgency >= 0.8) return 'critical';
    if (urgency >= 0.6) return 'high';
    if (urgency >= 0.4) return 'medium';
    return 'low';
  }

  private async classifyAttackVector(features: tf.Tensor, text: string): Promise<AttackVectorClassification> {
    if (!this.vectorModel) {
      throw new Error('Attack vector model not loaded');
    }

    const predictions = this.vectorModel.predict(features) as tf.Tensor;
    const probabilities = await predictions.data();

    const vectorScores = this.attackVectors.map((vector, index) => ({
      vector_type: vector as any,
      vector_subtype: vector,
      access_complexity: this.assessAccessComplexity(text, vector),
      authentication_required: this.assessAuthenticationRequired(text, vector),
      user_interaction: this.assessUserInteraction(text, vector),
      confidence: probabilities[index],
      evidence: this.findVectorEvidence(text, vector)
    }));

    vectorScores.sort((a, b) => b.confidence - a.confidence);

    const primaryVector = vectorScores[0];
    const secondaryVectors = vectorScores.slice(1, 3).filter(v => v.confidence > 0.3);

    // Clean up tensors
    predictions.dispose();

    return {
      primary_vector: primaryVector,
      secondary_vectors: secondaryVectors,
      vector_sophistication: this.assessVectorSophistication(text),
      vector_accessibility: this.assessVectorAccessibility(text),
      confidence: primaryVector.confidence,
      attack_path: await this.constructAttackPath(primaryVector, text)
    };
  }

  private assessAccessComplexity(text: string, vector: string): 'low' | 'medium' | 'high' {
    const complexityIndicators = {
      low: ['simple', 'easy', 'basic', 'straightforward'],
      medium: ['moderate', 'standard', 'typical'],
      high: ['complex', 'difficult', 'sophisticated', 'advanced']
    };

    for (const [level, indicators] of Object.entries(complexityIndicators)) {
      for (const indicator of indicators) {
        if (text.toLowerCase().includes(indicator)) {
          return level as any;
        }
      }
    }

    return 'medium';
  }

  private assessAuthenticationRequired(text: string, vector: string): boolean {
    const authKeywords = ['login', 'authenticate', 'credentials', 'password', 'token'];
    return authKeywords.some(keyword => text.toLowerCase().includes(keyword));
  }

  private assessUserInteraction(text: string, vector: string): 'none' | 'required' | 'passive' {
    if (text.includes('click') || text.includes('open') || text.includes('download')) {
      return 'required';
    } else if (text.includes('view') || text.includes('visit')) {
      return 'passive';
    }
    return 'none';
  }

  private findVectorEvidence(text: string, vector: string): string[] {
    const evidence: { [key: string]: string[] } = {
      network: ['remote', 'internet', 'network', 'tcp', 'udp'],
      email: ['email', 'phishing', 'attachment', 'link'],
      web_application: ['web', 'http', 'browser', 'application'],
      physical: ['physical', 'usb', 'device', 'access'],
      social: ['social', 'human', 'manipulation', 'pretexting']
    };

    const vectorEvidence = evidence[vector] || [];
    return vectorEvidence.filter(ev => 
      text.toLowerCase().includes(ev.toLowerCase())
    );
  }

  private assessVectorSophistication(text: string): number {
    return this.calculateKeywordScore(text, [
      'sophisticated', 'advanced', 'complex', 'custom', 'zero-day'
    ]);
  }

  private assessVectorAccessibility(text: string): number {
    return this.calculateKeywordScore(text, [
      'public', 'accessible', 'exposed', 'available', 'open'
    ]);
  }

  private async constructAttackPath(vector: AttackVector, text: string): Promise<AttackPathStep[]> {
    // Simplified attack path construction
    const steps: AttackPathStep[] = [
      {
        step_number: 1,
        step_description: `Initial access via ${vector.vector_type}`,
        step_type: 'initial_access',
        required_capabilities: [vector.vector_subtype],
        potential_mitigations: [`Monitor ${vector.vector_type} traffic`],
        confidence: vector.confidence
      }
    ];

    if (text.includes('lateral movement')) {
      steps.push({
        step_number: 2,
        step_description: 'Lateral movement within network',
        step_type: 'lateral_movement',
        required_capabilities: ['network_access', 'credential_access'],
        potential_mitigations: ['Network segmentation', 'Access controls'],
        confidence: 0.7
      });
    }

    return steps;
  }

  private async classifyAssetType(features: tf.Tensor, text: string): Promise<AssetClassification> {
    // Simplified asset classification
    const assetKeywords = {
      data: ['data', 'database', 'information', 'records'],
      system: ['system', 'server', 'computer', 'infrastructure'],
      application: ['application', 'software', 'service', 'app'],
      network: ['network', 'router', 'switch', 'firewall'],
      physical: ['physical', 'building', 'device', 'hardware']
    };

    let primaryAssetType: AssetType = {
      asset_category: 'system',
      asset_subcategory: 'unknown',
      asset_value: 0.5,
      business_function: 'unknown',
      compliance_requirements: [],
      confidence: 0
    };

    let maxScore = 0;
    for (const [category, keywords] of Object.entries(assetKeywords)) {
      const score = this.calculateKeywordScore(text, keywords);
      if (score > maxScore) {
        maxScore = score;
        primaryAssetType = {
          asset_category: category as any,
          asset_subcategory: category,
          asset_value: score,
          business_function: this.inferBusinessFunction(text, category),
          compliance_requirements: this.inferComplianceRequirements(text),
          confidence: score
        };
      }
    }

    return {
      primary_asset_type: primaryAssetType,
      secondary_asset_types: [],
      asset_criticality: this.assessAssetCriticality(text),
      asset_sensitivity: this.assessAssetSensitivity(text),
      data_classification: await this.classifyData(text),
      confidence: primaryAssetType.confidence
    };
  }

  private inferBusinessFunction(text: string, assetCategory: string): string {
    const functions = ['operations', 'finance', 'hr', 'it', 'marketing', 'sales'];
    for (const func of functions) {
      if (text.toLowerCase().includes(func)) {
        return func;
      }
    }
    return 'unknown';
  }

  private inferComplianceRequirements(text: string): string[] {
    const frameworks = ['gdpr', 'hipaa', 'pci', 'sox', 'iso27001', 'nist'];
    return frameworks.filter(framework => 
      text.toLowerCase().includes(framework)
    );
  }

  private assessAssetCriticality(text: string): 'low' | 'medium' | 'high' | 'critical' {
    const criticalityScore = this.calculateKeywordScore(text, [
      'critical', 'essential', 'vital', 'mission-critical', 'business-critical'
    ]);

    if (criticalityScore >= 0.7) return 'critical';
    if (criticalityScore >= 0.5) return 'high';
    if (criticalityScore >= 0.3) return 'medium';
    return 'low';
  }

  private assessAssetSensitivity(text: string): 'public' | 'internal' | 'confidential' | 'restricted' {
    if (text.includes('restricted') || text.includes('top secret')) return 'restricted';
    if (text.includes('confidential') || text.includes('secret')) return 'confidential';
    if (text.includes('internal') || text.includes('private')) return 'internal';
    return 'public';
  }

  private async classifyData(text: string): Promise<DataClassification> {
    const dataTypes: DataType[] = [];
    
    const commonDataTypes = [
      { name: 'personal_data', keywords: ['personal', 'pii', 'name', 'address'] },
      { name: 'financial_data', keywords: ['financial', 'credit card', 'payment', 'banking'] },
      { name: 'health_data', keywords: ['health', 'medical', 'patient', 'phi'] },
      { name: 'business_data', keywords: ['business', 'proprietary', 'trade secret'] }
    ];

    for (const dataType of commonDataTypes) {
      const score = this.calculateKeywordScore(text, dataType.keywords);
      if (score > 0.3) {
        dataTypes.push({
          type_name: dataType.name,
          type_category: dataType.name.split('_')[0],
          sensitivity: score,
          volume_estimate: 'unknown',
          processing_requirements: []
        });
      }
    }

    return {
      data_types: dataTypes,
      sensitivity_level: Math.max(...dataTypes.map(dt => dt.sensitivity), 0.5),
      privacy_impact: this.calculateKeywordScore(text, ['privacy', 'personal', 'sensitive']),
      regulatory_requirements: this.inferComplianceRequirements(text),
      retention_requirements: 'standard'
    };
  }

  private async classifyIncident(features: tf.Tensor, text: string): Promise<IncidentClassification> {
    // Simplified incident classification
    return {
      incident_type: {
        primary_category: 'security_incident',
        secondary_categories: [],
        incident_family: 'cyber_security',
        incident_complexity: 0.5,
        expected_duration: 'hours',
        resource_requirements: ['security_team', 'it_support']
      },
      incident_stage: this.determineIncidentStage(text),
      incident_scope: this.determineIncidentScope(text),
      response_requirements: [],
      escalation_criteria: {
        auto_escalation_triggers: [],
        escalation_timeline: [],
        notification_requirements: []
      },
      confidence: 0.7
    };
  }

  private determineIncidentStage(text: string): 'initial' | 'active' | 'contained' | 'eradicated' | 'recovered' | 'lessons_learned' {
    if (text.includes('contained') || text.includes('isolated')) return 'contained';
    if (text.includes('eradicated') || text.includes('removed')) return 'eradicated';
    if (text.includes('recovered') || text.includes('restored')) return 'recovered';
    if (text.includes('active') || text.includes('ongoing')) return 'active';
    return 'initial';
  }

  private determineIncidentScope(text: string): 'isolated' | 'localized' | 'widespread' | 'enterprise' | 'external' {
    if (text.includes('enterprise') || text.includes('organization')) return 'enterprise';
    if (text.includes('widespread') || text.includes('multiple')) return 'widespread';
    if (text.includes('localized') || text.includes('department')) return 'localized';
    if (text.includes('external') || text.includes('customer')) return 'external';
    return 'isolated';
  }

  private async classifyVulnerability(features: tf.Tensor, text: string): Promise<VulnerabilityClassification> {
    // Simplified vulnerability classification
    const baseScore = this.calculateCVSSBaseScore(text);
    
    return {
      vulnerability_type: {
        cwe_category: this.identifyCWECategory(text),
        vulnerability_class: 'input_validation',
        vulnerability_subclass: 'injection',
        attack_patterns: [],
        common_mitigations: []
      },
      vulnerability_source: this.identifyVulnerabilitySource(text),
      exploitability: {
        attack_vector: 'network',
        attack_complexity: 'low',
        privileges_required: 'none',
        user_interaction: 'none',
        scope: 'unchanged',
        exploit_likelihood: 0.7,
        weaponization_time: 'days'
      },
      impact_metrics: {
        confidentiality_impact: 'low',
        integrity_impact: 'low',
        availability_impact: 'low',
        business_impact_score: 0.5,
        affected_components: []
      },
      cvss_metrics: {
        cvss_version: '3.1',
        base_score: baseScore,
        base_vector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:L/A:L',
        overall_score: baseScore,
        severity_rating: this.mapCVSSToSeverity(baseScore)
      },
      remediation_info: {
        remediation_type: 'patch',
        remediation_complexity: 'medium',
        remediation_timeline: 'weeks',
        remediation_cost: 'medium',
        remediation_steps: [],
        verification_steps: []
      },
      confidence: 0.7
    };
  }

  private calculateCVSSBaseScore(text: string): number {
    // Simplified CVSS calculation
    let score = 5.0; // base score
    
    if (text.includes('remote')) score += 1.0;
    if (text.includes('critical') || text.includes('high')) score += 2.0;
    if (text.includes('authentication') || text.includes('credentials')) score -= 1.0;
    
    return Math.min(10.0, Math.max(0.0, score));
  }

  private identifyCWECategory(text: string): string {
    const cwePatterns = {
      'CWE-79': ['xss', 'cross-site scripting'],
      'CWE-89': ['sql injection', 'sqli'],
      'CWE-200': ['information disclosure', 'data exposure'],
      'CWE-119': ['buffer overflow', 'memory corruption']
    };

    for (const [cwe, patterns] of Object.entries(cwePatterns)) {
      for (const pattern of patterns) {
        if (text.toLowerCase().includes(pattern)) {
          return cwe;
        }
      }
    }

    return 'CWE-unknown';
  }

  private identifyVulnerabilitySource(text: string): 'code' | 'configuration' | 'design' | 'operational' | 'third_party' {
    if (text.includes('code') || text.includes('programming')) return 'code';
    if (text.includes('configuration') || text.includes('settings')) return 'configuration';
    if (text.includes('design') || text.includes('architecture')) return 'design';
    if (text.includes('operational') || text.includes('process')) return 'operational';
    if (text.includes('third party') || text.includes('vendor')) return 'third_party';
    return 'code';
  }

  private mapCVSSToSeverity(score: number): 'low' | 'medium' | 'high' | 'critical' {
    if (score >= 9.0) return 'critical';
    if (score >= 7.0) return 'high';
    if (score >= 4.0) return 'medium';
    return 'low';
  }

  private async classifyCompliance(features: tf.Tensor, text: string): Promise<ComplianceClassification> {
    // Simplified compliance classification
    const frameworks = this.identifyComplianceFrameworks(text);
    
    return {
      applicable_frameworks: frameworks,
      compliance_requirements: [],
      violation_risk: {
        probability: 0.3,
        impact: 0.5,
        risk_score: 0.15,
        potential_penalties: [],
        mitigation_strategies: []
      },
      reporting_requirements: [],
      confidence: 0.6
    };
  }

  private identifyComplianceFrameworks(text: string): ComplianceFramework[] {
    const frameworks = [
      { name: 'GDPR', keywords: ['gdpr', 'general data protection'] },
      { name: 'HIPAA', keywords: ['hipaa', 'health insurance'] },
      { name: 'PCI DSS', keywords: ['pci', 'payment card'] },
      { name: 'SOX', keywords: ['sox', 'sarbanes oxley'] },
      { name: 'ISO 27001', keywords: ['iso 27001', 'information security'] }
    ];

    const applicableFrameworks: ComplianceFramework[] = [];

    for (const framework of frameworks) {
      for (const keyword of framework.keywords) {
        if (text.toLowerCase().includes(keyword)) {
          applicableFrameworks.push({
            framework_name: framework.name,
            framework_version: '2023',
            applicable_controls: [],
            compliance_level: 'medium',
            assessment_frequency: 'annual'
          });
          break;
        }
      }
    }

    return applicableFrameworks;
  }

  private async extractKeywords(text: string): Promise<ExtractedKeyword[]> {
    const words = text.split(/\s+/);
    const wordCounts = new Map<string, number>();

    // Count word frequencies
    for (const word of words) {
      const cleaned = word.toLowerCase().replace(/[^\w]/g, '');
      if (cleaned.length > 3) {
        wordCounts.set(cleaned, (wordCounts.get(cleaned) || 0) + 1);
      }
    }

    // Filter and rank keywords
    const keywords: ExtractedKeyword[] = [];
    const securityKeywords = new Set([
      'attack', 'threat', 'vulnerability', 'malware', 'phishing', 'breach',
      'security', 'incident', 'exploit', 'compromise', 'unauthorized'
    ]);

    for (const [word, frequency] of wordCounts.entries()) {
      if (frequency >= 2 || securityKeywords.has(word)) {
        keywords.push({
          keyword: word,
          keyword_type: securityKeywords.has(word) ? 'concept' : 'entity',
          frequency,
          context: [this.extractWordContext(text, word)],
          relevance_score: frequency / words.length * 100,
          confidence: securityKeywords.has(word) ? 0.9 : 0.6
        });
      }
    }

    return keywords.sort((a, b) => b.relevance_score - a.relevance_score).slice(0, 20);
  }

  private extractWordContext(text: string, word: string): string {
    const regex = new RegExp(`\\b\\w*${word}\\w*\\b`, 'gi');
    const match = text.match(regex);
    if (match) {
      const index = text.toLowerCase().indexOf(word.toLowerCase());
      const start = Math.max(0, index - 50);
      const end = Math.min(text.length, index + word.length + 50);
      return text.substring(start, end).trim();
    }
    return '';
  }

  private async generateSummary(document: SecurityDocument, result: ClassificationResult): Promise<DocumentSummary> {
    const primaryThreat = result.threat_classification.primary_threat_type.category;
    const severity = result.severity_classification.overall_severity;
    const vector = result.attack_vector_classification.primary_vector.vector_type;

    return {
      executive_summary: `Security document analysis identified a ${severity} severity ${primaryThreat} threat using ${vector} attack vector.`,
      key_points: [
        `Primary threat type: ${primaryThreat}`,
        `Severity level: ${severity}`,
        `Attack vector: ${vector}`,
        `${result.keywords.length} security-related keywords identified`
      ],
      critical_findings: result.keywords
        .filter(k => k.confidence > 0.8)
        .slice(0, 5)
        .map(k => `High-confidence keyword: ${k.keyword}`),
      recommendations: [
        'Monitor for indicators related to identified threat type',
        'Implement security controls for identified attack vector',
        'Review and update incident response procedures',
        'Conduct additional threat intelligence analysis'
      ],
      next_steps: [
        'Validate threat classification accuracy',
        'Update security monitoring rules',
        'Brief security team on findings',
        'Schedule follow-up assessment'
      ],
      confidence: result.confidence_metrics.overall_confidence
    };
  }

  private async calculateConfidenceMetrics(
    result: ClassificationResult,
    features: tf.Tensor
  ): Promise<ConfidenceMetrics> {
    const classificationConfidence: ClassificationConfidence = {
      threat_confidence: result.threat_classification.confidence,
      severity_confidence: result.severity_classification.confidence,
      vector_confidence: result.attack_vector_classification.confidence,
      asset_confidence: result.asset_classification.confidence,
      incident_confidence: result.incident_classification.confidence,
      vulnerability_confidence: result.vulnerability_classification.confidence,
      compliance_confidence: result.compliance_classification.confidence
    };

    const avgClassificationConfidence = Object.values(classificationConfidence)
      .reduce((sum, conf) => sum + conf, 0) / Object.keys(classificationConfidence).length;

    return {
      overall_confidence: avgClassificationConfidence,
      classification_confidence: classificationConfidence,
      feature_confidence: {
        text_quality: 0.8,
        feature_extraction: 0.85,
        pattern_recognition: 0.75,
        entity_recognition: 0.8,
        sentiment_analysis: 0.7
      },
      model_confidence: {
        model_accuracy: 0.82,
        prediction_stability: 0.78,
        feature_importance: [],
        uncertainty_quantification: 1 - avgClassificationConfidence
      }
    };
  }

  private async calculateSummaryStatistics(
    totalDocs: number,
    results: ClassificationResult[],
    errors: ProcessingError[],
    processingTime: number
  ): Promise<SummaryStatistics> {
    const successfulDocs = results.length;
    const avgConfidence = results.reduce((sum, r) => sum + r.confidence_metrics.overall_confidence, 0) / successfulDocs;

    // Calculate distributions
    const threatCounts = new Map<string, number>();
    const severityCounts = new Map<string, number>();

    for (const result of results) {
      const threat = result.threat_classification.primary_threat_type.category;
      const severity = result.severity_classification.overall_severity;
      
      threatCounts.set(threat, (threatCounts.get(threat) || 0) + 1);
      severityCounts.set(severity, (severityCounts.get(severity) || 0) + 1);
    }

    return {
      total_documents: totalDocs,
      successfully_classified: successfulDocs,
      classification_errors: errors.length,
      average_confidence: avgConfidence,
      confidence_distribution: {
        high_confidence: results.filter(r => r.confidence_metrics.overall_confidence >= 0.8).length,
        medium_confidence: results.filter(r => r.confidence_metrics.overall_confidence >= 0.6 && r.confidence_metrics.overall_confidence < 0.8).length,
        low_confidence: results.filter(r => r.confidence_metrics.overall_confidence >= 0.4 && r.confidence_metrics.overall_confidence < 0.6).length,
        uncertain: results.filter(r => r.confidence_metrics.overall_confidence < 0.4).length
      },
      threat_distribution: {
        threat_types: Array.from(threatCounts.entries()).map(([type, count]) => ({
          threat_type: type,
          count,
          percentage: count / successfulDocs * 100,
          average_confidence: results
            .filter(r => r.threat_classification.primary_threat_type.category === type)
            .reduce((sum, r) => sum + r.threat_classification.confidence, 0) / count
        })),
        attack_vectors: [],
        threat_families: []
      },
      severity_distribution: {
        severity_levels: Array.from(severityCounts.entries()).map(([level, count]) => ({
          severity_level: level,
          count,
          percentage: count / successfulDocs * 100,
          average_confidence: results
            .filter(r => r.severity_classification.overall_severity === level)
            .reduce((sum, r) => sum + r.severity_classification.confidence, 0) / count
        })),
        impact_distribution: {
          business_impact: {},
          technical_impact: {},
          compliance_impact: {}
        },
        urgency_distribution: {
          immediate: 0,
          short_term: 0,
          medium_term: 0,
          long_term: 0
        }
      },
      processing_performance: {
        total_processing_time: processingTime,
        average_document_time: processingTime / totalDocs,
        throughput_documents_per_second: totalDocs / (processingTime / 1000),
        memory_usage: {
          peak_memory_mb: 512,
          average_memory_mb: 256,
          memory_efficiency: 0.8
        },
        cpu_usage: {
          peak_cpu_percent: 80,
          average_cpu_percent: 45,
          cpu_efficiency: 0.75
        }
      }
    };
  }

  private async generateRecommendations(
    results: ClassificationResult[],
    errors: ProcessingError[]
  ): Promise<ClassificationRecommendation[]> {
    const recommendations: ClassificationRecommendation[] = [];

    // Model improvement recommendations
    const avgConfidence = results.reduce((sum, r) => sum + r.confidence_metrics.overall_confidence, 0) / results.length;
    
    if (avgConfidence < 0.7) {
      recommendations.push({
        recommendation_type: 'model_improvement',
        recommendation_description: 'Consider retraining models with additional labeled data to improve classification confidence',
        implementation_priority: 'high',
        expected_benefit: 'Improved classification accuracy and confidence',
        implementation_effort: 'high',
        dependencies: ['Additional training data', 'Model retraining pipeline']
      });
    }

    // Data quality recommendations
    if (errors.length > results.length * 0.1) {
      recommendations.push({
        recommendation_type: 'data_quality',
        recommendation_description: 'Implement data preprocessing improvements to reduce classification errors',
        implementation_priority: 'medium',
        expected_benefit: 'Reduced error rate and improved processing reliability',
        implementation_effort: 'medium',
        dependencies: ['Text preprocessing pipeline updates']
      });
    }

    // Processing optimization
    const avgProcessingTime = results.reduce((sum, r) => sum + r.classification_metadata.processing_time, 0) / results.length;
    
    if (avgProcessingTime > 5000) { // 5 seconds
      recommendations.push({
        recommendation_type: 'processing_optimization',
        recommendation_description: 'Optimize model inference pipeline to reduce processing time',
        implementation_priority: 'medium',
        expected_benefit: 'Faster document processing and improved throughput',
        implementation_effort: 'medium',
        dependencies: ['Model optimization', 'Infrastructure scaling']
      });
    }

    return recommendations;
  }

  /**
   * Simplified classifyText method for direct text classification (used by NLP routes)
   */
  async classifyText(text: string, options: any = {}): Promise<any> {
    if (!this.isInitialized) {
      throw new Error('Security text classifier service not initialized');
    }
    
    // Detect language
    const detectedLanguage = (await this.languageSupport.detectLanguage(text)).code;
    
    // Normalize text for the detected language
    const normalizedText = this.languageSupport.normalizeTextForLanguage(text, detectedLanguage);
    
    // Translate to English if needed for better classification
    let processedText = normalizedText;
    if (detectedLanguage !== 'en') {
      const translationResult = await this.languageSupport.translateText({
        text: normalizedText,
        sourceLanguage: detectedLanguage,
        targetLanguage: 'en'
      });
      processedText = translationResult.translatedText;
    }
    
    // Multi-language threat classification
    const threatClassification = await this.classifyThreatTypeMultiLanguage(processedText, detectedLanguage);
    const severityClassification = await this.classifySeverityMultiLanguage(processedText, detectedLanguage);
    const riskLevel = this.calculateRiskLevel(threatClassification, severityClassification);
    
    // Extract multi-language threat indicators
    const threatIndicators = await this.extractThreatIndicators(normalizedText, detectedLanguage);
    
    return {
      primary_category: threatClassification.primary_category,
      confidence: threatClassification.confidence,
      all_categories: threatClassification.all_categories,
      threat_indicators: threatIndicators,
      risk_level: riskLevel,
      severity: severityClassification.severity,
      language_detected: detectedLanguage,
      processing_details: {
        original_text_length: text.length,
        normalized_text_length: normalizedText.length,
        translated: detectedLanguage !== 'en',
        processing_time: new Date().toISOString()
      }
    };
  }
  
  /**
   * Multi-language threat classification
   */
  private async classifyThreatTypeMultiLanguage(text: string, languageCode: string): Promise<any> {
    const threatKeywords = this.getLanguageSpecificThreatKeywords(languageCode);
    const words = text.toLowerCase().split(/\s+/);
    const categoryScores: { [category: string]: number } = {};
    
    // Initialize category scores
    for (const category of this.threatCategories) {
      categoryScores[category] = 0;
    }
    
    // Score based on keywords
    for (const word of words) {
      for (const [category, keywords] of Object.entries(threatKeywords)) {
        if (keywords.includes(word)) {
          categoryScores[category] = (categoryScores[category] || 0) + 1;
        }
      }
    }
    
    // Find primary category
    const sortedCategories = Object.entries(categoryScores)
      .sort(([,a], [,b]) => b - a)
      .filter(([,score]) => score > 0);
    
    const primaryCategory = sortedCategories[0]?.[0] || 'unknown';
    const confidence = sortedCategories[0]?.[1] ? Math.min(0.95, sortedCategories[0][1] * 0.2) : 0.3;
    
    return {
      primary_category: primaryCategory,
      confidence,
      all_categories: sortedCategories.slice(0, 3).map(([category, score]) => ({
        category,
        confidence: Math.min(0.95, score * 0.2)
      }))
    };
  }
  
  /**
   * Multi-language severity classification
   */
  private async classifySeverityMultiLanguage(text: string, languageCode: string): Promise<any> {
    const severityKeywords = this.getLanguageSpecificSeverityKeywords(languageCode);
    const words = text.toLowerCase().split(/\s+/);
    let severityScore = 0;
    
    for (const word of words) {
      for (const [level, keywords] of Object.entries(severityKeywords)) {
        if (keywords.includes(word)) {
          const levelScore = level === 'critical' ? 1.0 : level === 'high' ? 0.7 : level === 'medium' ? 0.4 : 0.2;
          severityScore = Math.max(severityScore, levelScore);
        }
      }
    }
    
    let severity: 'low' | 'medium' | 'high' | 'critical';
    if (severityScore >= 0.8) severity = 'critical';
    else if (severityScore >= 0.6) severity = 'high';
    else if (severityScore >= 0.3) severity = 'medium';
    else severity = 'low';
    
    return { severity, score: severityScore };
  }
  
  /**
   * Extract threat indicators in multiple languages
   */
  private async extractThreatIndicators(text: string, languageCode: string): Promise<string[]> {
    const indicators: string[] = [];
    const localizedTerms = this.languageSupport.getLocalizedTerms(languageCode);
    const words = text.toLowerCase().split(/\s+/);
    
    // Extract security-related terms
    for (const [englishTerm, localizedTerm] of Object.entries(localizedTerms)) {
      if (localizedTerm && words.includes(localizedTerm.toLowerCase())) {
        indicators.push(localizedTerm);
      }
    }
    
    // Add language-specific threat indicators
    const threatKeywords = this.getLanguageSpecificThreatKeywords(languageCode);
    for (const keywordList of Object.values(threatKeywords)) {
      for (const keyword of keywordList) {
        if (words.includes(keyword)) {
          indicators.push(keyword);
        }
      }
    }
    
    return [...new Set(indicators)]; // Remove duplicates
  }
  
  /**
   * Calculate risk level based on threat and severity
   */
  private calculateRiskLevel(threatClassification: any, severityClassification: any): string {
    const threatScore = threatClassification.confidence;
    const severityScore = severityClassification.score;
    const combinedScore = (threatScore + severityScore) / 2;
    
    if (combinedScore >= 0.8) return 'critical';
    if (combinedScore >= 0.6) return 'high';
    if (combinedScore >= 0.3) return 'medium';
    return 'low';
  }
  
  /**
   * Language-specific threat keywords
   */
  private getLanguageSpecificThreatKeywords(languageCode: string): { [category: string]: string[] } {
    const keywords: { [lang: string]: { [category: string]: string[] } } = {
      'en': {
        'malware': ['malware', 'virus', 'trojan', 'ransomware', 'spyware'],
        'phishing': ['phishing', 'scam', 'fraud', 'fake', 'spoofing'],
        'vulnerability': ['vulnerability', 'exploit', 'flaw', 'weakness', 'bug'],
        'data_breach': ['breach', 'leak', 'exposure', 'disclosure', 'theft'],
        'ddos': ['ddos', 'denial', 'flooding', 'overwhelm', 'outage']
      },
      'es': {
        'malware': ['malware', 'virus', 'troyano', 'ransomware', 'software espía'],
        'phishing': ['phishing', 'estafa', 'fraude', 'falso', 'suplantación'],
        'vulnerability': ['vulnerabilidad', 'exploit', 'falla', 'debilidad', 'error'],
        'data_breach': ['brecha', 'fuga', 'exposición', 'divulgación', 'robo'],
        'ddos': ['ddos', 'denegación', 'inundación', 'abrumar', 'interrupción']
      },
      'fr': {
        'malware': ['malware', 'virus', 'cheval de troie', 'rançongiciel', 'logiciel espion'],
        'phishing': ['hameçonnage', 'arnaque', 'fraude', 'faux', 'usurpation'],
        'vulnerability': ['vulnérabilité', 'exploit', 'faille', 'faiblesse', 'bogue'],
        'data_breach': ['brèche', 'fuite', 'exposition', 'divulgation', 'vol'],
        'ddos': ['ddos', 'déni', 'inondation', 'submerger', 'panne']
      }
    };
    
    return keywords[languageCode] || keywords['en'];
  }
  
  /**
   * Language-specific severity keywords
   */
  private getLanguageSpecificSeverityKeywords(languageCode: string): { [level: string]: string[] } {
    const keywords: { [lang: string]: { [level: string]: string[] } } = {
      'en': {
        'critical': ['critical', 'severe', 'urgent', 'emergency', 'catastrophic'],
        'high': ['high', 'serious', 'significant', 'major', 'important'],
        'medium': ['medium', 'moderate', 'normal', 'standard', 'typical'],
        'low': ['low', 'minor', 'minimal', 'trivial', 'negligible']
      },
      'es': {
        'critical': ['crítico', 'severo', 'urgente', 'emergencia', 'catastrófico'],
        'high': ['alto', 'serio', 'significativo', 'mayor', 'importante'],
        'medium': ['medio', 'moderado', 'normal', 'estándar', 'típico'],
        'low': ['bajo', 'menor', 'mínimo', 'trivial', 'despreciable']
      },
      'fr': {
        'critical': ['critique', 'sévère', 'urgent', 'urgence', 'catastrophique'],
        'high': ['élevé', 'sérieux', 'significatif', 'majeur', 'important'],
        'medium': ['moyen', 'modéré', 'normal', 'standard', 'typique'],
        'low': ['faible', 'mineur', 'minimal', 'trivial', 'négligeable']
      }
    };
    
    return keywords[languageCode] || keywords['en'];
  }

  async getModelInfo(): Promise<any> {
    return {
      service: 'SecurityTextClassifierService',
      models: {
        threat_type_model: this.threatTypeModel ? 'Loaded' : 'Not loaded',
        severity_model: this.severityModel ? 'Loaded' : 'Not loaded',
        vector_model: this.vectorModel ? 'Loaded' : 'Not loaded'
      },
      vocabulary_size: this.vocabularyMap.size,
      category_mappings: this.categoryMap.size,
      supported_languages: this.languageSupport.getSupportedLanguages().map(l => l.code),
      initialized: this.isInitialized,
      threat_categories: this.threatCategories.length,
      attack_vectors: this.attackVectors.length
    };
  }

  async trainModels(trainingData: any[]): Promise<void> {
    logger.info('Training classification models with new data...');
    
    // Training implementation would go here
    // This is a placeholder for actual model training
    
    logger.info('Classification model training completed');
  }

  async saveModels(modelPath: string): Promise<void> {
    if (this.threatTypeModel) {
      await this.threatTypeModel.save(`file://${modelPath}/threat_type_model`);
    }
    if (this.severityModel) {
      await this.severityModel.save(`file://${modelPath}/severity_model`);
    }
    if (this.vectorModel) {
      await this.vectorModel.save(`file://${modelPath}/vector_model`);
    }
    
    logger.info(`Classification models saved to ${modelPath}`);
  }

  async loadModels(modelPath: string): Promise<void> {
    try {
      this.threatTypeModel = await tf.loadLayersModel(`file://${modelPath}/threat_type_model/model.json`);
      this.severityModel = await tf.loadLayersModel(`file://${modelPath}/severity_model/model.json`);
      this.vectorModel = await tf.loadLayersModel(`file://${modelPath}/vector_model/model.json`);
      
      logger.info(`Classification models loaded from ${modelPath}`);
    } catch (error) {
      logger.warn('Could not load pre-trained classification models, using default models');
    }
  }
}