import { HfInference } from '@huggingface/inference';
import * as tf from '@tensorflow/tfjs-node';
import * as natural from 'natural';
import nlp from 'compromise';
import Sentiment from 'sentiment';
import * as keywordExtractor from 'keyword-extractor';
import { removeStopwords } from 'stopword';
import { OpenAI } from 'openai';
import Redis from 'ioredis';
import NodeCache from 'node-cache';
import { v4 as uuidv4 } from 'uuid';
import PQueue from 'p-queue';
import * as brain from 'brain.js';
import Fuse from 'fuse.js';
import { Logger } from 'winston';

import {
  NLPAnalysisRequest,
  NLPAnalysisResponse,
  NLPAnalysisType,
  NLPResult,
  ExtractedThreat,
  SecurityRequirement,
  DetectedVulnerability,
  ComplianceMapping,
  RiskAssessment,
  TechnicalDecomposition,
  SecurityControlSuggestion,
  QueryIntent,
  ReportGenerationRequest,
  NLPModelConfig,
  ThreatCategory,
  STRIDECategory,
  ComplianceFramework,
  RiskLevel,
  ComponentType,
  ControlType,
  IntentType,
  EntityType,
  TextPosition,
  NLPSuggestion,
  ArchitectureComponent,
  DataFlow,
  TrustBoundary,
  SecurityControl,
  Entity,
  RiskFactor
} from '../types/nlp';

export class NLPEngineService {
  private hfInference: HfInference;
  private openai: OpenAI | null = null;
  private sentiment: Sentiment;
  private tokenizer: natural.WordTokenizer;
  private tfidf: natural.TfIdf;
  private classifier: natural.BayesClassifier;
  private cache: NodeCache;
  private redis: Redis;
  private logger: Logger;
  private concurrencyQueue: PQueue;
  
  // Pre-trained models
  private threatClassifier: brain.NeuralNetwork;
  private vulnerabilityDetector: brain.recurrent.LSTM;
  private riskPredictor: brain.NeuralNetwork;
  
  // Knowledge bases
  private threatPatterns: Map<string, ExtractedThreat>;
  private securityControls: Map<string, SecurityControl>;
  private complianceRules: Map<ComplianceFramework, any>;
  private architecturePatterns: Map<string, ArchitectureComponent>;
  
  // Fuzzy search engines
  private threatSearcher: Fuse<ExtractedThreat>;
  private controlSearcher: Fuse<SecurityControl>;
  
  constructor(
    config: {
      hfApiKey?: string;
      openaiApiKey?: string;
      redisUrl?: string;
      logger: Logger;
    }
  ) {
    this.logger = config.logger;
    this.cache = new NodeCache({ stdTTL: 3600 });
    this.concurrencyQueue = new PQueue({ concurrency: 5 });
    
    // Initialize Hugging Face
    this.hfInference = new HfInference(config.hfApiKey || process.env.HF_API_KEY);
    
    // Initialize OpenAI if available
    if (config.openaiApiKey || process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: config.openaiApiKey || process.env.OPENAI_API_KEY
      });
    }
    
    // Initialize Redis
    this.redis = new Redis(config.redisUrl || process.env.REDIS_URL || 'redis://localhost:6379');
    
    // Initialize NLP tools
    this.sentiment = new Sentiment();
    this.tokenizer = new natural.WordTokenizer();
    this.tfidf = new natural.TfIdf();
    this.classifier = new natural.BayesClassifier();
    
    // Initialize neural networks
    this.threatClassifier = new brain.NeuralNetwork();
    this.vulnerabilityDetector = new brain.recurrent.LSTM();
    this.riskPredictor = new brain.NeuralNetwork();
    
    // Initialize knowledge bases
    this.threatPatterns = new Map();
    this.securityControls = new Map();
    this.complianceRules = new Map();
    this.architecturePatterns = new Map();
    
    // Initialize fuzzy search
    this.threatSearcher = new Fuse([], {
      keys: ['name', 'description', 'category'],
      threshold: 0.4
    });
    
    this.controlSearcher = new Fuse([], {
      keys: ['name', 'description', 'type'],
      threshold: 0.4
    });
    
    // Load pre-trained models and knowledge bases
    this.loadModels();
    this.loadKnowledgeBases();
  }
  
  private async loadModels(): Promise<void> {
    try {
      // Load threat classifier
      const threatModel = await this.redis.get('nlp:models:threat-classifier');
      if (threatModel) {
        this.threatClassifier.fromJSON(JSON.parse(threatModel));
      } else {
        await this.trainThreatClassifier();
      }
      
      // Load vulnerability detector
      const vulnModel = await this.redis.get('nlp:models:vulnerability-detector');
      if (vulnModel) {
        this.vulnerabilityDetector.fromJSON(JSON.parse(vulnModel));
      } else {
        await this.trainVulnerabilityDetector();
      }
      
      // Load risk predictor
      const riskModel = await this.redis.get('nlp:models:risk-predictor');
      if (riskModel) {
        this.riskPredictor.fromJSON(JSON.parse(riskModel));
      } else {
        await this.trainRiskPredictor();
      }
      
      this.logger.info('NLP models loaded successfully');
    } catch (error) {
      this.logger.error('Failed to load NLP models:', error);
    }
  }
  
  private async loadKnowledgeBases(): Promise<void> {
    // Load STRIDE threat patterns
    this.loadSTRIDEPatterns();
    
    // Load OWASP Top 10 patterns
    this.loadOWASPPatterns();
    
    // Load security controls from NIST 800-53
    this.loadNISTControls();
    
    // Load compliance frameworks
    this.loadComplianceFrameworks();
    
    // Load common architecture patterns
    this.loadArchitecturePatterns();
    
    // Update fuzzy search indices
    this.updateSearchIndices();
  }
  
  public async analyze(request: NLPAnalysisRequest): Promise<NLPAnalysisResponse> {
    const requestId = uuidv4();
    const startTime = Date.now();
    
    try {
      // Check cache
      const cacheKey = this.getCacheKey(request);
      const cached = this.cache.get<NLPAnalysisResponse>(cacheKey);
      if (cached) {
        return cached;
      }
      
      // Preprocess text
      const processedText = await this.preprocessText(request.text, request.language);
      
      // Perform analysis based on type
      let results: NLPResult[];
      switch (request.analysisType) {
        case 'threat-extraction':
          results = await this.extractThreats(processedText, request.options);
          break;
        case 'requirement-analysis':
          results = await this.analyzeRequirements(processedText, request.options);
          break;
        case 'vulnerability-detection':
          results = await this.detectVulnerabilities(processedText, request.options);
          break;
        case 'compliance-mapping':
          results = await this.mapCompliance(processedText, request.options);
          break;
        case 'risk-assessment':
          results = await this.assessRisk(processedText, request.options);
          break;
        case 'technical-decomposition':
          results = await this.decomposeTechnicalArchitecture(processedText, request.options);
          break;
        case 'security-control-suggestion':
          results = await this.suggestSecurityControls(processedText, request.options);
          break;
        case 'threat-narrative-generation':
          results = await this.generateThreatNarrative(processedText, request.options);
          break;
        case 'report-generation':
          results = await this.generateReport(processedText, request.options);
          break;
        case 'query-understanding':
          results = await this.understandQuery(processedText, request.options);
          break;
        default:
          throw new Error(`Unknown analysis type: ${request.analysisType}`);
      }
      
      // Generate suggestions if requested
      let suggestions: NLPSuggestion[] = [];
      if (request.options?.includeSuggestions) {
        suggestions = await this.generateSuggestions(results, request.analysisType);
      }
      
      // Calculate overall confidence
      const confidence = this.calculateOverallConfidence(results);
      
      // Build response
      const response: NLPAnalysisResponse = {
        requestId,
        timestamp: new Date(),
        analysisType: request.analysisType,
        results,
        metadata: {
          processingTime: Date.now() - startTime,
          tokensProcessed: this.tokenizer.tokenize(processedText).length,
          language: request.language || 'en',
          models: this.getUsedModels(request.analysisType),
          version: '1.0.0'
        },
        suggestions,
        confidence
      };
      
      // Cache response
      this.cache.set(cacheKey, response);
      
      // Log analytics
      await this.logAnalytics(request, response);
      
      return response;
    } catch (error) {
      this.logger.error('NLP analysis failed:', error);
      throw error;
    }
  }
  
  private async extractThreats(text: string, options?: any): Promise<NLPResult[]> {
    const results: NLPResult[] = [];
    
    // Use multiple extraction methods
    const methods = [
      this.extractThreatsUsingPatterns.bind(this),
      this.extractThreatsUsingNER.bind(this),
      this.extractThreatsUsingClassification.bind(this),
      this.extractThreatsUsingLLM.bind(this)
    ];
    
    // Run extraction methods in parallel
    const extractionResults = await Promise.all(
      methods.map(method => this.concurrencyQueue.add(() => method(text, options)))
    );
    
    // Merge and deduplicate results
    const threats = new Map<string, ExtractedThreat>();
    for (const methodResults of extractionResults) {
      for (const threat of methodResults) {
        const existing = threats.get(threat.id);
        if (!existing || threat.confidence > existing.confidence) {
          threats.set(threat.id, threat);
        }
      }
    }
    
    // Convert to NLPResult format
    for (const threat of threats.values()) {
      results.push({
        type: 'threat',
        value: threat,
        confidence: threat.confidence,
        explanation: this.generateThreatExplanation(threat),
        references: this.getThreatReferences(threat)
      });
    }
    
    return results.sort((a, b) => b.confidence - a.confidence);
  }
  
  private async extractThreatsUsingPatterns(text: string, options?: any): Promise<ExtractedThreat[]> {
    const threats: ExtractedThreat[] = [];
    const sentences = this.tokenizer.tokenize(text.toLowerCase());
    
    // STRIDE pattern matching
    const stridePatterns = {
      spoofing: /\b(spoof|impersonat|fake|phish|masquerad|pretend)\b/i,
      tampering: /\b(tamper|modif|alter|corrupt|manipulat|chang)\b/i,
      repudiation: /\b(repudiat|deny|disavow|reject|non-repudiat)\b/i,
      informationDisclosure: /\b(disclos|leak|expos|reveal|breach|unauthoriz.*access)\b/i,
      denialOfService: /\b(dos|ddos|denial.*service|overwhelm|flood|exhaust)\b/i,
      elevationOfPrivilege: /\b(escalat|elevat.*privileg|root|admin|bypass.*auth)\b/i
    };
    
    for (const [category, pattern] of Object.entries(stridePatterns)) {
      const matches = text.match(new RegExp(pattern.source, 'gi'));
      if (matches) {
        for (const match of matches) {
          const position = text.indexOf(match);
          const context = this.extractContext(text, position, 50);
          
          threats.push({
            id: uuidv4(),
            name: `${category} threat`,
            description: context,
            category: this.mapToThreatCategory(category),
            attackVector: this.inferAttackVector(context),
            impactedAssets: this.extractAssets(context),
            likelihood: this.calculateLikelihood(context),
            impact: this.calculateImpact(context),
            mitigations: this.suggestMitigations(category),
            stride: [category.charAt(0).toUpperCase() as STRIDECategory],
            confidence: 0.7
          });
        }
      }
    }
    
    return threats;
  }
  
  private async extractThreatsUsingNER(text: string, options?: any): Promise<ExtractedThreat[]> {
    if (!this.openai) return [];
    
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{
          role: 'system',
          content: 'You are a security expert. Extract security threats from the text and format them as JSON.'
        }, {
          role: 'user',
          content: `Extract security threats from this text: "${text}"`
        }],
        functions: [{
          name: 'extract_threats',
          parameters: {
            type: 'object',
            properties: {
              threats: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    description: { type: 'string' },
                    category: { type: 'string' },
                    severity: { type: 'string' }
                  }
                }
              }
            }
          }
        }],
        function_call: { name: 'extract_threats' }
      });
      
      const threats = JSON.parse(response.choices[0]?.message?.function_call?.arguments || '{}').threats || [];
      
      return threats.map((threat: any) => ({
        id: uuidv4(),
        name: threat.name,
        description: threat.description,
        category: this.mapToThreatCategory(threat.category),
        attackVector: 'unknown',
        impactedAssets: [],
        likelihood: 0.5,
        impact: 0.5,
        mitigations: [],
        confidence: 0.9
      }));
    } catch (error) {
      this.logger.error('OpenAI threat extraction failed:', error);
      return [];
    }
  }
  
  private async extractThreatsUsingClassification(text: string, options?: any): Promise<ExtractedThreat[]> {
    const threats: ExtractedThreat[] = [];
    const sentences = text.split(/[.!?]+/);
    
    for (const sentence of sentences) {
      if (sentence.trim().length < 10) continue;
      
      // Use neural network to classify threat
      const classification = this.threatClassifier.run(this.textToVector(sentence));
      const threatType = this.vectorToThreatType(classification);
      
      if (threatType && classification[0] > 0.6) {
        threats.push({
          id: uuidv4(),
          name: `${threatType} threat`,
          description: sentence.trim(),
          category: threatType as ThreatCategory,
          attackVector: 'unknown',
          impactedAssets: this.extractAssets(sentence),
          likelihood: classification[0],
          impact: 0.5,
          mitigations: [],
          confidence: classification[0]
        });
      }
    }
    
    return threats;
  }
  
  private async extractThreatsUsingLLM(text: string, options?: any): Promise<ExtractedThreat[]> {
    try {
      const result = await this.hfInference.textGeneration({
        model: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
        inputs: `Extract security threats from the following text. Format as JSON array with fields: name, description, category, severity.\n\nText: ${text}\n\nThreats:`,
        parameters: {
          max_new_tokens: 500,
          temperature: 0.7
        }
      });
      
      const threats = this.parseJSONSafely(result.generated_text) || [];
      
      return threats.map((threat: any) => ({
        id: uuidv4(),
        name: threat.name || 'Unknown threat',
        description: threat.description || '',
        category: this.mapToThreatCategory(threat.category),
        attackVector: 'unknown',
        impactedAssets: [],
        likelihood: 0.5,
        impact: this.mapSeverityToImpact(threat.severity),
        mitigations: [],
        confidence: 0.8
      }));
    } catch (error) {
      this.logger.error('HuggingFace threat extraction failed:', error);
      return [];
    }
  }
  
  private async analyzeRequirements(text: string, options?: any): Promise<NLPResult[]> {
    const results: NLPResult[] = [];
    const requirements = await this.extractSecurityRequirements(text);
    
    for (const req of requirements) {
      results.push({
        type: 'requirement',
        value: req,
        confidence: req.testable && req.measurable ? 0.9 : 0.7,
        explanation: `Security requirement: ${req.type} - ${req.priority}`,
        references: []
      });
    }
    
    return results;
  }
  
  private async extractSecurityRequirements(text: string): Promise<SecurityRequirement[]> {
    const requirements: SecurityRequirement[] = [];
    const sentences = text.split(/[.!?]+/);
    
    const requirementPatterns = [
      /must\s+(?:be\s+)?(\w+)/i,
      /shall\s+(?:be\s+)?(\w+)/i,
      /should\s+(?:be\s+)?(\w+)/i,
      /require[sd]?\s+(?:that\s+)?(.+)/i,
      /need[s]?\s+(?:to\s+)?(.+)/i
    ];
    
    for (const sentence of sentences) {
      for (const pattern of requirementPatterns) {
        const match = sentence.match(pattern);
        if (match) {
          const requirement: SecurityRequirement = {
            id: uuidv4(),
            text: sentence.trim(),
            type: this.classifyRequirementType(sentence),
            priority: this.extractPriority(sentence),
            category: this.extractCategory(sentence),
            testable: this.isTestable(sentence),
            measurable: this.isMeasurable(sentence),
            relatedThreats: [],
            implementationNotes: '',
            verificationCriteria: this.generateVerificationCriteria(sentence)
          };
          
          requirements.push(requirement);
          break;
        }
      }
    }
    
    return requirements;
  }
  
  private async detectVulnerabilities(text: string, options?: any): Promise<NLPResult[]> {
    const results: NLPResult[] = [];
    const vulnerabilities = await this.findVulnerabilities(text);
    
    for (const vuln of vulnerabilities) {
      results.push({
        type: 'vulnerability',
        value: vuln,
        confidence: vuln.confidence,
        explanation: `${vuln.severity} severity vulnerability: ${vuln.name}`,
        references: vuln.references
      });
    }
    
    return results;
  }
  
  private async findVulnerabilities(text: string): Promise<DetectedVulnerability[]> {
    const vulnerabilities: DetectedVulnerability[] = [];
    
    // Common vulnerability patterns
    const vulnPatterns = {
      'SQL Injection': /\b(sql\s*injection|sqli|union\s+select|or\s+1=1)\b/i,
      'XSS': /\b(cross[- ]?site[- ]?scripting|xss|script\s+injection)\b/i,
      'CSRF': /\b(csrf|cross[- ]?site[- ]?request[- ]?forgery)\b/i,
      'Buffer Overflow': /\b(buffer\s+overflow|stack\s+overflow|heap\s+overflow)\b/i,
      'Insecure Deserialization': /\b(deserializ|unpickl|unserializ)\b/i,
      'XXE': /\b(xxe|xml\s+external\s+entity)\b/i,
      'SSRF': /\b(ssrf|server[- ]?side[- ]?request[- ]?forgery)\b/i,
      'Path Traversal': /\b(path\s+traversal|directory\s+traversal|\.\.\/)\b/i,
      'Weak Encryption': /\b(weak\s+encryp|md5|sha1|des\b|ecb\s+mode)\b/i,
      'Hardcoded Credentials': /\b(hardcoded?\s+(password|credential|secret|key))\b/i
    };
    
    for (const [vulnName, pattern] of Object.entries(vulnPatterns)) {
      if (pattern.test(text)) {
        const vulnerability: DetectedVulnerability = {
          id: uuidv4(),
          name: vulnName,
          description: this.getVulnerabilityDescription(vulnName),
          severity: this.getVulnerabilitySeverity(vulnName),
          cwe: this.getCWEMapping(vulnName),
          owasp: this.getOWASPMapping(vulnName),
          affectedComponent: this.extractAffectedComponent(text, pattern),
          exploitability: this.calculateExploitability(vulnName),
          remediation: this.getRemediation(vulnName),
          references: this.getVulnerabilityReferences(vulnName),
          confidence: 0.85
        };
        
        vulnerabilities.push(vulnerability);
      }
    }
    
    // Use LSTM for advanced detection
    if (this.vulnerabilityDetector) {
      const lstmResult = this.vulnerabilityDetector.run(text);
      if (lstmResult && typeof lstmResult === 'string') {
        const detectedVuln = this.parseVulnerabilityFromLSTM(lstmResult);
        if (detectedVuln) {
          vulnerabilities.push(detectedVuln);
        }
      }
    }
    
    return vulnerabilities;
  }
  
  private async mapCompliance(text: string, options?: any): Promise<NLPResult[]> {
    const results: NLPResult[] = [];
    const framework = options?.targetFramework || 'OWASP';
    
    const mapping = await this.performComplianceMapping(text, framework);
    
    results.push({
      type: 'compliance-mapping',
      value: mapping,
      confidence: mapping.coverage / 100,
      explanation: `Compliance coverage: ${mapping.coverage}%`,
      references: []
    });
    
    return results;
  }
  
  private async performComplianceMapping(text: string, framework: ComplianceFramework): Promise<ComplianceMapping> {
    const rules = this.complianceRules.get(framework) || {};
    const requirements: any[] = [];
    const gaps: any[] = [];
    
    let compliantCount = 0;
    let totalCount = 0;
    
    for (const [ruleId, rule] of Object.entries(rules)) {
      totalCount++;
      const compliance = this.checkCompliance(text, rule as any);
      
      requirements.push({
        id: ruleId,
        text: (rule as any).text,
        section: (rule as any).section,
        status: compliance.status,
        evidence: compliance.evidence,
        controls: compliance.controls
      });
      
      if (compliance.status === 'compliant') {
        compliantCount++;
      } else if (compliance.status !== 'not-applicable') {
        gaps.push({
          requirement: ruleId,
          currentState: compliance.currentState,
          desiredState: (rule as any).desiredState,
          remediation: compliance.remediation,
          effort: compliance.effort,
          priority: compliance.priority
        });
      }
    }
    
    return {
      framework,
      requirements,
      coverage: totalCount > 0 ? (compliantCount / totalCount) * 100 : 0,
      gaps,
      recommendations: this.generateComplianceRecommendations(gaps)
    };
  }
  
  private async assessRisk(text: string, options?: any): Promise<NLPResult[]> {
    const results: NLPResult[] = [];
    const assessment = await this.performRiskAssessment(text);
    
    results.push({
      type: 'risk-assessment',
      value: assessment,
      confidence: 0.85,
      explanation: `Overall risk level: ${assessment.overallRisk} (score: ${assessment.riskScore})`,
      references: []
    });
    
    return results;
  }
  
  private async performRiskAssessment(text: string): Promise<RiskAssessment> {
    // Extract risk factors
    const riskFactors = await this.extractRiskFactors(text);
    
    // Build risk matrix
    const riskMatrix = this.buildRiskMatrix(riskFactors);
    
    // Calculate overall risk
    const riskScore = this.calculateRiskScore(riskMatrix);
    const overallRisk = this.mapScoreToRiskLevel(riskScore);
    
    // Generate recommendations
    const recommendations = this.generateRiskRecommendations(riskFactors, riskMatrix);
    
    // Analyze trends
    const trends = await this.analyzeRiskTrends(riskFactors);
    
    return {
      overallRisk,
      riskScore,
      riskFactors,
      riskMatrix,
      recommendations,
      trends
    };
  }
  
  private async decomposeTechnicalArchitecture(text: string, options?: any): Promise<NLPResult[]> {
    const results: NLPResult[] = [];
    const decomposition = await this.performTechnicalDecomposition(text);
    
    results.push({
      type: 'technical-decomposition',
      value: decomposition,
      confidence: 0.8,
      explanation: `Identified ${decomposition.architecture.length} components and ${decomposition.dataFlows.length} data flows`,
      references: []
    });
    
    return results;
  }
  
  private async performTechnicalDecomposition(text: string): Promise<TechnicalDecomposition> {
    // Extract architecture components
    const components = await this.extractArchitectureComponents(text);
    
    // Identify data flows
    const dataFlows = this.identifyDataFlows(text, components);
    
    // Define trust boundaries
    const trustBoundaries = this.defineTrustBoundaries(components, dataFlows);
    
    // Analyze attack surface
    const attackSurface = this.analyzeAttackSurface(components);
    
    // Extract dependencies
    const dependencies = await this.extractDependencies(text);
    
    return {
      architecture: components,
      dataFlows,
      trustBoundaries,
      attackSurface,
      dependencies
    };
  }
  
  private async suggestSecurityControls(text: string, options?: any): Promise<NLPResult[]> {
    const results: NLPResult[] = [];
    const suggestions = await this.generateSecurityControlSuggestions(text);
    
    for (const suggestion of suggestions) {
      results.push({
        type: 'security-control',
        value: suggestion,
        confidence: suggestion.effectiveness / 100,
        explanation: suggestion.rationale,
        references: []
      });
    }
    
    return results;
  }
  
  private async generateSecurityControlSuggestions(text: string): Promise<SecurityControlSuggestion[]> {
    const suggestions: SecurityControlSuggestion[] = [];
    
    // Analyze threats in the text
    const threats = await this.extractThreats(text);
    
    // Match controls to threats
    for (const threat of threats) {
      const controls = this.findControlsForThreat(threat.value as ExtractedThreat);
      
      for (const control of controls) {
        suggestions.push({
          control,
          rationale: `Mitigates ${threat.value.name}`,
          effectiveness: this.calculateControlEffectiveness(control, threat.value as ExtractedThreat),
          implementationEffort: this.estimateImplementationEffort(control),
          costEstimate: this.estimateCost(control),
          mitigatedThreats: [threat.value.id],
          complianceAlignment: this.getComplianceAlignment(control)
        });
      }
    }
    
    return suggestions.sort((a, b) => b.effectiveness - a.effectiveness);
  }
  
  private async generateThreatNarrative(text: string, options?: any): Promise<NLPResult[]> {
    const results: NLPResult[] = [];
    const narrative = await this.createThreatNarrative(text, options);
    
    results.push({
      type: 'narrative',
      value: narrative,
      confidence: 0.9,
      explanation: 'Generated threat narrative',
      references: []
    });
    
    return results;
  }
  
  private async createThreatNarrative(text: string, options?: any): Promise<string> {
    if (this.openai) {
      try {
        const response = await this.openai.chat.completions.create({
          model: 'gpt-4',
          messages: [{
            role: 'system',
            content: 'You are a cybersecurity expert. Generate a comprehensive threat narrative.'
          }, {
            role: 'user',
            content: `Create a threat narrative based on: ${text}`
          }],
          temperature: 0.7,
          max_tokens: 1000
        });
        
        return response.choices[0]?.message?.content || '';
      } catch (error) {
        this.logger.error('OpenAI narrative generation failed:', error);
      }
    }
    
    // Fallback to template-based generation
    return this.generateNarrativeFromTemplate(text);
  }
  
  private async generateReport(text: string, options?: any): Promise<NLPResult[]> {
    const results: NLPResult[] = [];
    const report = await this.createReport(text, options);
    
    results.push({
      type: 'report',
      value: report,
      confidence: 0.95,
      explanation: 'Generated security report',
      references: []
    });
    
    return results;
  }
  
  private async createReport(text: string, options?: any): Promise<string> {
    const reportType = options?.reportType || 'threat-assessment';
    const format = options?.format || 'markdown';
    
    // Analyze all aspects
    const threats = await this.extractThreats(text);
    const vulnerabilities = await this.detectVulnerabilities(text);
    const risks = await this.assessRisk(text);
    const controls = await this.suggestSecurityControls(text);
    
    // Generate report sections
    const sections = [
      this.generateExecutiveSummary(threats, vulnerabilities, risks),
      this.generateThreatSection(threats),
      this.generateVulnerabilitySection(vulnerabilities),
      this.generateRiskSection(risks),
      this.generateControlSection(controls),
      this.generateRecommendations(threats, vulnerabilities, risks, controls)
    ];
    
    // Format report
    return this.formatReport(sections, format);
  }
  
  private async understandQuery(text: string, options?: any): Promise<NLPResult[]> {
    const results: NLPResult[] = [];
    const intent = await this.analyzeQueryIntent(text);
    
    results.push({
      type: 'query-intent',
      value: intent,
      confidence: 0.9,
      explanation: `Intent: ${intent.intent}`,
      references: []
    });
    
    return results;
  }
  
  private async analyzeQueryIntent(text: string): Promise<QueryIntent> {
    // Extract entities
    const entities = this.extractEntities(text);
    
    // Classify intent
    const intent = this.classifyIntent(text, entities);
    
    // Build context
    const context = {
      domain: this.identifyDomain(text),
      previousQueries: [],
      currentFocus: entities[0]?.value || '',
      userExpertise: 'intermediate'
    };
    
    // Generate suggested actions
    const suggestedActions = this.generateSuggestedActions(intent, entities);
    
    // Check if clarification needed
    const clarificationNeeded = this.checkClarificationNeeded(text, intent, entities);
    
    return {
      intent,
      entities,
      context,
      suggestedActions,
      clarificationNeeded
    };
  }
  
  // Helper methods
  private async preprocessText(text: string, language?: string): Promise<string> {
    // Normalize text
    let processed = text.toLowerCase().trim();
    
    // Remove extra whitespace
    processed = processed.replace(/\s+/g, ' ');
    
    // Expand contractions
    processed = this.expandContractions(processed);
    
    // Remove stopwords if needed
    if (language === 'en') {
      const tokens = this.tokenizer.tokenize(processed);
      const filtered = removeStopwords(tokens);
      processed = filtered.join(' ');
    }
    
    return processed;
  }
  
  private getCacheKey(request: NLPAnalysisRequest): string {
    return `nlp:${request.analysisType}:${this.hashText(request.text)}`;
  }
  
  private hashText(text: string): string {
    // Simple hash function for caching
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }
  
  private calculateOverallConfidence(results: NLPResult[]): number {
    if (results.length === 0) return 0;
    
    const totalConfidence = results.reduce((sum, result) => sum + result.confidence, 0);
    return totalConfidence / results.length;
  }
  
  private getUsedModels(analysisType: NLPAnalysisType): string[] {
    const models: string[] = ['natural', 'compromise', 'sentiment'];
    
    if (this.openai) {
      models.push('gpt-4');
    }
    
    if (this.hfInference) {
      models.push('mixtral-8x7b');
    }
    
    switch (analysisType) {
      case 'threat-extraction':
        models.push('threat-classifier-nn');
        break;
      case 'vulnerability-detection':
        models.push('vulnerability-lstm');
        break;
      case 'risk-assessment':
        models.push('risk-predictor-nn');
        break;
    }
    
    return models;
  }
  
  private async generateSuggestions(results: NLPResult[], analysisType: NLPAnalysisType): Promise<NLPSuggestion[]> {
    const suggestions: NLPSuggestion[] = [];
    
    // Generate type-specific suggestions
    switch (analysisType) {
      case 'threat-extraction':
        suggestions.push(...this.generateThreatSuggestions(results));
        break;
      case 'vulnerability-detection':
        suggestions.push(...this.generateVulnerabilitySuggestions(results));
        break;
      case 'compliance-mapping':
        suggestions.push(...this.generateComplianceSuggestions(results));
        break;
    }
    
    return suggestions;
  }
  
  private generateThreatSuggestions(results: NLPResult[]): NLPSuggestion[] {
    const suggestions: NLPSuggestion[] = [];
    
    for (const result of results) {
      if (result.type === 'threat') {
        const threat = result.value as ExtractedThreat;
        
        if (threat.mitigations.length === 0) {
          suggestions.push({
            type: 'security',
            text: `Add mitigations for ${threat.name}`,
            rationale: 'Threats without mitigations pose higher risk',
            priority: 'high',
            actionable: true
          });
        }
        
        if (threat.confidence < 0.7) {
          suggestions.push({
            type: 'clarification',
            text: `Provide more details about ${threat.name}`,
            rationale: 'Low confidence score indicates insufficient information',
            priority: 'medium',
            actionable: true
          });
        }
      }
    }
    
    return suggestions;
  }
  
  private generateVulnerabilitySuggestions(results: NLPResult[]): NLPSuggestion[] {
    const suggestions: NLPSuggestion[] = [];
    
    const criticalVulns = results.filter(r => 
      r.type === 'vulnerability' && 
      (r.value as DetectedVulnerability).severity === 'critical'
    );
    
    if (criticalVulns.length > 0) {
      suggestions.push({
        type: 'security',
        text: `Address ${criticalVulns.length} critical vulnerabilities immediately`,
        rationale: 'Critical vulnerabilities pose immediate risk',
        priority: 'high',
        actionable: true
      });
    }
    
    return suggestions;
  }
  
  private generateComplianceSuggestions(results: NLPResult[]): NLPSuggestion[] {
    const suggestions: NLPSuggestion[] = [];
    
    for (const result of results) {
      if (result.type === 'compliance-mapping') {
        const mapping = result.value as ComplianceMapping;
        
        if (mapping.coverage < 80) {
          suggestions.push({
            type: 'compliance',
            text: `Improve compliance coverage (currently ${mapping.coverage}%)`,
            rationale: 'Low compliance coverage may result in audit failures',
            priority: 'high',
            actionable: true
          });
        }
        
        for (const gap of mapping.gaps.slice(0, 3)) {
          suggestions.push({
            type: 'compliance',
            text: gap.remediation,
            rationale: `Close compliance gap: ${gap.requirement}`,
            priority: gap.effort === 'low' ? 'high' : 'medium',
            actionable: true
          });
        }
      }
    }
    
    return suggestions;
  }
  
  private async logAnalytics(request: NLPAnalysisRequest, response: NLPAnalysisResponse): Promise<void> {
    const analytics = {
      timestamp: new Date(),
      analysisType: request.analysisType,
      processingTime: response.metadata.processingTime,
      tokensProcessed: response.metadata.tokensProcessed,
      resultCount: response.results.length,
      confidence: response.confidence,
      language: response.metadata.language
    };
    
    await this.redis.lpush('nlp:analytics', JSON.stringify(analytics));
    await this.redis.ltrim('nlp:analytics', 0, 9999);
  }
  
  // Training methods
  private async trainThreatClassifier(): Promise<void> {
    const trainingData = [
      { input: 'sql injection attack on database', output: [1, 0, 0, 0, 0, 0] },
      { input: 'unauthorized access to admin panel', output: [0, 0, 0, 0, 0, 1] },
      { input: 'ddos attack overwhelming servers', output: [0, 0, 0, 0, 1, 0] },
      { input: 'phishing email spoofing identity', output: [1, 0, 0, 0, 0, 0] },
      { input: 'data tampering in transit', output: [0, 1, 0, 0, 0, 0] },
      { input: 'user denying transaction', output: [0, 0, 1, 0, 0, 0] },
      { input: 'sensitive data exposure', output: [0, 0, 0, 1, 0, 0] }
    ];
    
    const processedData = trainingData.map(item => ({
      input: this.textToVector(item.input),
      output: item.output
    }));
    
    this.threatClassifier.train(processedData);
    
    // Save model
    await this.redis.set('nlp:models:threat-classifier', JSON.stringify(this.threatClassifier.toJSON()));
  }
  
  private async trainVulnerabilityDetector(): Promise<void> {
    const trainingData = [
      'SQL injection vulnerability in login form',
      'Cross-site scripting in comment section',
      'Buffer overflow in image processing',
      'Weak encryption using MD5',
      'Hardcoded password in configuration'
    ];
    
    this.vulnerabilityDetector.train(trainingData);
    
    // Save model
    await this.redis.set('nlp:models:vulnerability-detector', JSON.stringify(this.vulnerabilityDetector.toJSON()));
  }
  
  private async trainRiskPredictor(): Promise<void> {
    const trainingData = [
      { input: [0.8, 0.9, 5, 3], output: [0.9] }, // high likelihood, high impact, many threats
      { input: [0.2, 0.3, 1, 0], output: [0.2] }, // low likelihood, low impact, few threats
      { input: [0.5, 0.8, 3, 2], output: [0.6] }, // medium likelihood, high impact
      { input: [0.9, 0.2, 2, 1], output: [0.4] }  // high likelihood, low impact
    ];
    
    this.riskPredictor.train(trainingData);
    
    // Save model
    await this.redis.set('nlp:models:risk-predictor', JSON.stringify(this.riskPredictor.toJSON()));
  }
  
  // Knowledge base loaders
  private loadSTRIDEPatterns(): void {
    const patterns = [
      {
        id: 'stride-s-001',
        name: 'Authentication Spoofing',
        description: 'Attacker pretends to be another user',
        category: 'spoofing' as ThreatCategory,
        attackVector: 'credential theft',
        stride: ['S'] as STRIDECategory[]
      },
      {
        id: 'stride-t-001',
        name: 'Data Tampering',
        description: 'Unauthorized modification of data',
        category: 'tampering' as ThreatCategory,
        attackVector: 'man-in-the-middle',
        stride: ['T'] as STRIDECategory[]
      }
    ];
    
    for (const pattern of patterns) {
      this.threatPatterns.set(pattern.id, {
        ...pattern,
        impactedAssets: [],
        likelihood: 0.5,
        impact: 0.7,
        mitigations: [],
        confidence: 0.9
      } as ExtractedThreat);
    }
  }
  
  private loadOWASPPatterns(): void {
    const owaspThreats = [
      {
        id: 'owasp-2021-a01',
        name: 'Broken Access Control',
        description: 'Restrictions on authenticated users are not properly enforced',
        category: 'elevation-of-privilege' as ThreatCategory
      },
      {
        id: 'owasp-2021-a03',
        name: 'Injection',
        description: 'Untrusted data sent to interpreter',
        category: 'tampering' as ThreatCategory
      }
    ];
    
    for (const threat of owaspThreats) {
      this.threatPatterns.set(threat.id, {
        ...threat,
        attackVector: 'application',
        impactedAssets: [],
        likelihood: 0.7,
        impact: 0.9,
        mitigations: [],
        confidence: 0.95
      } as ExtractedThreat);
    }
  }
  
  private loadNISTControls(): void {
    const controls = [
      {
        id: 'AC-2',
        name: 'Account Management',
        type: 'preventive' as ControlType,
        category: 'access-control',
        description: 'Manage system accounts',
        implementation: 'Implement account lifecycle management',
        verification: 'Review account audit logs',
        maintenance: 'Regular account reviews'
      },
      {
        id: 'SC-8',
        name: 'Transmission Confidentiality',
        type: 'preventive' as ControlType,
        category: 'encryption',
        description: 'Protect transmitted information',
        implementation: 'Use TLS 1.3 or higher',
        verification: 'SSL/TLS testing',
        maintenance: 'Certificate renewal'
      }
    ];
    
    for (const control of controls) {
      this.securityControls.set(control.id, control);
    }
  }
  
  private loadComplianceFrameworks(): void {
    // Load OWASP requirements
    this.complianceRules.set('OWASP', {
      'A01': {
        text: 'Implement proper access control',
        section: 'A01:2021',
        desiredState: 'All access controls enforced'
      },
      'A02': {
        text: 'Use secure cryptographic practices',
        section: 'A02:2021',
        desiredState: 'Strong encryption everywhere'
      }
    });
    
    // Load other frameworks...
  }
  
  private loadArchitecturePatterns(): void {
    const patterns = [
      {
        id: 'web-api-pattern',
        name: 'REST API',
        type: 'api' as ComponentType,
        description: 'RESTful web service',
        technologies: ['HTTP', 'JSON', 'OAuth2'],
        interfaces: [],
        securityControls: ['authentication', 'rate-limiting'],
        threats: []
      }
    ];
    
    for (const pattern of patterns) {
      this.architecturePatterns.set(pattern.id, pattern);
    }
  }
  
  private updateSearchIndices(): void {
    this.threatSearcher.setCollection(Array.from(this.threatPatterns.values()));
    this.controlSearcher.setCollection(Array.from(this.securityControls.values()));
  }
  
  // Utility methods
  private textToVector(text: string): number[] {
    const tokens = this.tokenizer.tokenize(text.toLowerCase());
    const vector = new Array(100).fill(0);
    
    for (let i = 0; i < Math.min(tokens.length, vector.length); i++) {
      vector[i] = tokens[i].charCodeAt(0) / 255;
    }
    
    return vector;
  }
  
  private vectorToThreatType(vector: any): string | null {
    const categories = ['spoofing', 'tampering', 'repudiation', 'information-disclosure', 'denial-of-service', 'elevation-of-privilege'];
    const maxIndex = vector.indexOf(Math.max(...vector));
    
    return vector[maxIndex] > 0.5 ? categories[maxIndex] : null;
  }
  
  private extractContext(text: string, position: number, windowSize: number): string {
    const start = Math.max(0, position - windowSize);
    const end = Math.min(text.length, position + windowSize);
    return text.substring(start, end).trim();
  }
  
  private mapToThreatCategory(category: string): ThreatCategory {
    const mapping: Record<string, ThreatCategory> = {
      spoofing: 'spoofing',
      tampering: 'tampering',
      repudiation: 'repudiation',
      informationdisclosure: 'information-disclosure',
      denialofservice: 'denial-of-service',
      elevationofprivilege: 'elevation-of-privilege'
    };
    
    return mapping[category.toLowerCase().replace(/[^a-z]/g, '')] || 'tampering';
  }
  
  private inferAttackVector(context: string): string {
    if (/network|remote|internet/.test(context)) return 'network';
    if (/physical|usb|hardware/.test(context)) return 'physical';
    if (/email|phish|social/.test(context)) return 'social-engineering';
    if (/web|browser|javascript/.test(context)) return 'web';
    return 'unknown';
  }
  
  private extractAssets(text: string): string[] {
    const assets: string[] = [];
    
    const patterns = [
      /\b(database|db)\b/gi,
      /\b(server|api|endpoint)\b/gi,
      /\b(user|customer|client)\s+data\b/gi,
      /\b(password|credential|secret)\b/gi,
      /\b(file|document|report)\b/gi
    ];
    
    for (const pattern of patterns) {
      const matches = text.match(pattern);
      if (matches) {
        assets.push(...matches.map(m => m.toLowerCase()));
      }
    }
    
    return [...new Set(assets)];
  }
  
  private calculateLikelihood(context: string): number {
    let score = 0.5;
    
    if (/easy|simple|trivial/.test(context)) score += 0.2;
    if (/difficult|hard|complex/.test(context)) score -= 0.2;
    if (/common|frequent|often/.test(context)) score += 0.1;
    if (/rare|unlikely|seldom/.test(context)) score -= 0.1;
    
    return Math.max(0, Math.min(1, score));
  }
  
  private calculateImpact(context: string): number {
    let score = 0.5;
    
    if (/critical|severe|catastrophic/.test(context)) score = 0.9;
    if (/high|major|significant/.test(context)) score = 0.7;
    if (/medium|moderate|some/.test(context)) score = 0.5;
    if (/low|minor|minimal/.test(context)) score = 0.3;
    
    return score;
  }
  
  private suggestMitigations(threatCategory: string): string[] {
    const mitigations: Record<string, string[]> = {
      spoofing: ['Implement strong authentication', 'Use multi-factor authentication', 'Validate user identity'],
      tampering: ['Use cryptographic signatures', 'Implement integrity checks', 'Enable audit logging'],
      repudiation: ['Implement comprehensive logging', 'Use digital signatures', 'Maintain audit trails'],
      informationDisclosure: ['Encrypt sensitive data', 'Implement access controls', 'Use data classification'],
      denialOfService: ['Implement rate limiting', 'Use DDoS protection', 'Scale resources dynamically'],
      elevationOfPrivilege: ['Follow least privilege principle', 'Implement role-based access', 'Regular permission audits']
    };
    
    return mitigations[threatCategory] || ['Implement appropriate security controls'];
  }
  
  private generateThreatExplanation(threat: ExtractedThreat): string {
    return `${threat.name} is a ${threat.category} threat with ${threat.likelihood > 0.7 ? 'high' : threat.likelihood > 0.4 ? 'medium' : 'low'} likelihood and ${threat.impact > 0.7 ? 'high' : threat.impact > 0.4 ? 'medium' : 'low'} impact. Attack vector: ${threat.attackVector}.`;
  }
  
  private getThreatReferences(threat: ExtractedThreat): string[] {
    const references: string[] = [];
    
    if (threat.cwe) {
      references.push(...threat.cwe.map(id => `https://cwe.mitre.org/data/definitions/${id.replace('CWE-', '')}.html`));
    }
    
    if (threat.capec) {
      references.push(...threat.capec.map(id => `https://capec.mitre.org/data/definitions/${id.replace('CAPEC-', '')}.html`));
    }
    
    return references;
  }
  
  private parseJSONSafely(text: string): any {
    try {
      // Extract JSON from text
      const jsonMatch = text.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      this.logger.warn('Failed to parse JSON:', error);
    }
    return null;
  }
  
  private mapSeverityToImpact(severity: string): number {
    const mapping: Record<string, number> = {
      critical: 0.9,
      high: 0.7,
      medium: 0.5,
      low: 0.3,
      minimal: 0.1
    };
    
    return mapping[severity?.toLowerCase()] || 0.5;
  }
  
  private classifyRequirementType(sentence: string): 'functional' | 'non-functional' | 'constraint' {
    if (/performance|scalability|reliability|usability/.test(sentence)) {
      return 'non-functional';
    }
    if (/must not|shall not|constraint|limit/.test(sentence)) {
      return 'constraint';
    }
    return 'functional';
  }
  
  private extractPriority(sentence: string): 'must-have' | 'should-have' | 'nice-to-have' {
    if (/must|shall|critical|essential/.test(sentence)) return 'must-have';
    if (/should|important|recommended/.test(sentence)) return 'should-have';
    return 'nice-to-have';
  }
  
  private extractCategory(sentence: string): string {
    if (/auth|access|permission/.test(sentence)) return 'authentication';
    if (/encrypt|crypto|secure/.test(sentence)) return 'encryption';
    if (/log|audit|monitor/.test(sentence)) return 'monitoring';
    if (/backup|recover|restor/.test(sentence)) return 'backup';
    return 'general';
  }
  
  private isTestable(sentence: string): boolean {
    return /test|verify|check|validate|ensure/.test(sentence);
  }
  
  private isMeasurable(sentence: string): boolean {
    return /\d+|percent|rate|time|count|number/.test(sentence);
  }
  
  private generateVerificationCriteria(sentence: string): string[] {
    const criteria: string[] = [];
    
    if (/encrypt/.test(sentence)) {
      criteria.push('Verify encryption algorithm meets standards');
      criteria.push('Test encryption key management');
    }
    
    if (/auth/.test(sentence)) {
      criteria.push('Test authentication mechanisms');
      criteria.push('Verify session management');
    }
    
    if (/perform/.test(sentence)) {
      criteria.push('Measure response times');
      criteria.push('Test under load conditions');
    }
    
    return criteria;
  }
  
  private getVulnerabilityDescription(vulnName: string): string {
    const descriptions: Record<string, string> = {
      'SQL Injection': 'Allows attackers to interfere with database queries',
      'XSS': 'Enables injection of malicious scripts into web pages',
      'CSRF': 'Forces authenticated users to execute unwanted actions',
      'Buffer Overflow': 'Can crash programs or execute arbitrary code',
      'Weak Encryption': 'Uses outdated or broken cryptographic algorithms'
    };
    
    return descriptions[vulnName] || 'Security vulnerability';
  }
  
  private getVulnerabilitySeverity(vulnName: string): 'critical' | 'high' | 'medium' | 'low' {
    const severities: Record<string, 'critical' | 'high' | 'medium' | 'low'> = {
      'SQL Injection': 'critical',
      'XSS': 'high',
      'CSRF': 'medium',
      'Buffer Overflow': 'critical',
      'Weak Encryption': 'high',
      'Path Traversal': 'high',
      'XXE': 'high',
      'SSRF': 'high'
    };
    
    return severities[vulnName] || 'medium';
  }
  
  private getCWEMapping(vulnName: string): string {
    const mappings: Record<string, string> = {
      'SQL Injection': 'CWE-89',
      'XSS': 'CWE-79',
      'CSRF': 'CWE-352',
      'Buffer Overflow': 'CWE-120',
      'Weak Encryption': 'CWE-326'
    };
    
    return mappings[vulnName] || '';
  }
  
  private getOWASPMapping(vulnName: string): string {
    const mappings: Record<string, string> = {
      'SQL Injection': 'A03:2021',
      'XSS': 'A03:2021',
      'CSRF': 'A01:2021',
      'Weak Encryption': 'A02:2021'
    };
    
    return mappings[vulnName] || '';
  }
  
  private extractAffectedComponent(text: string, pattern: RegExp): string {
    const match = text.match(pattern);
    if (match) {
      const index = match.index || 0;
      const words = text.substring(Math.max(0, index - 50), index).split(/\s+/);
      
      for (const word of words.reverse()) {
        if (/component|module|service|function|api|endpoint/.test(word)) {
          return word;
        }
      }
    }
    
    return 'unknown component';
  }
  
  private calculateExploitability(vulnName: string): number {
    const exploitability: Record<string, number> = {
      'SQL Injection': 0.9,
      'XSS': 0.8,
      'CSRF': 0.6,
      'Buffer Overflow': 0.7,
      'Weak Encryption': 0.5
    };
    
    return exploitability[vulnName] || 0.5;
  }
  
  private getRemediation(vulnName: string): string {
    const remediations: Record<string, string> = {
      'SQL Injection': 'Use parameterized queries and prepared statements',
      'XSS': 'Sanitize and encode all user input',
      'CSRF': 'Implement CSRF tokens for state-changing operations',
      'Buffer Overflow': 'Use safe string functions and bounds checking',
      'Weak Encryption': 'Upgrade to strong encryption algorithms (AES-256, RSA-2048)'
    };
    
    return remediations[vulnName] || 'Apply appropriate security patches';
  }
  
  private getVulnerabilityReferences(vulnName: string): string[] {
    const cwe = this.getCWEMapping(vulnName);
    const owasp = this.getOWASPMapping(vulnName);
    const references: string[] = [];
    
    if (cwe) {
      references.push(`https://cwe.mitre.org/data/definitions/${cwe.replace('CWE-', '')}.html`);
    }
    
    if (owasp) {
      references.push(`https://owasp.org/Top10/A03_2021-Injection/`);
    }
    
    return references;
  }
  
  private parseVulnerabilityFromLSTM(output: string): DetectedVulnerability | null {
    // Parse LSTM output to vulnerability object
    try {
      const parts = output.split('|');
      if (parts.length >= 3) {
        return {
          id: uuidv4(),
          name: parts[0],
          description: parts[1],
          severity: parts[2] as any,
          affectedComponent: 'detected by AI',
          exploitability: 0.5,
          remediation: 'Review and apply security best practices',
          references: [],
          confidence: 0.7
        };
      }
    } catch (error) {
      this.logger.warn('Failed to parse LSTM output:', error);
    }
    
    return null;
  }
  
  private checkCompliance(text: string, rule: any): any {
    const status = text.includes(rule.keyword) ? 'compliant' : 'non-compliant';
    
    return {
      status,
      evidence: status === 'compliant' ? [`Found: ${rule.keyword}`] : [],
      controls: rule.controls || [],
      currentState: status === 'compliant' ? rule.desiredState : 'Not implemented',
      remediation: rule.remediation || 'Implement required controls',
      effort: 'medium',
      priority: rule.priority || 5
    };
  }
  
  private generateComplianceRecommendations(gaps: any[]): string[] {
    return gaps
      .sort((a, b) => a.priority - b.priority)
      .slice(0, 5)
      .map(gap => gap.remediation);
  }
  
  private async extractRiskFactors(text: string): Promise<RiskFactor[]> {
    const factors: RiskFactor[] = [];
    
    // Extract threats as risk factors
    const threats = await this.extractThreats(text);
    for (const threat of threats) {
      const t = threat.value as ExtractedThreat;
      factors.push({
        name: t.name,
        description: t.description,
        impact: t.impact,
        likelihood: t.likelihood,
        category: 'threat',
        mitigations: t.mitigations
      });
    }
    
    // Extract vulnerabilities as risk factors
    const vulnerabilities = await this.detectVulnerabilities(text);
    for (const vuln of vulnerabilities) {
      const v = vuln.value as DetectedVulnerability;
      factors.push({
        name: v.name,
        description: v.description,
        impact: this.mapSeverityToImpact(v.severity),
        likelihood: v.exploitability,
        category: 'vulnerability',
        mitigations: [v.remediation]
      });
    }
    
    return factors;
  }
  
  private buildRiskMatrix(factors: RiskFactor[]): any[] {
    const matrix: any[] = [];
    
    for (const factor of factors) {
      matrix.push({
        threat: factor.name,
        vulnerability: factor.category === 'vulnerability' ? factor.name : 'N/A',
        impact: factor.impact,
        likelihood: factor.likelihood,
        riskScore: factor.impact * factor.likelihood,
        treatmentStrategy: this.determineRiskTreatment(factor.impact * factor.likelihood)
      });
    }
    
    return matrix;
  }
  
  private calculateRiskScore(matrix: any[]): number {
    if (matrix.length === 0) return 0;
    
    const totalScore = matrix.reduce((sum, entry) => sum + entry.riskScore, 0);
    return Math.min(100, (totalScore / matrix.length) * 100);
  }
  
  private mapScoreToRiskLevel(score: number): RiskLevel {
    if (score >= 80) return 'critical';
    if (score >= 60) return 'high';
    if (score >= 40) return 'medium';
    if (score >= 20) return 'low';
    return 'minimal';
  }
  
  private determineRiskTreatment(riskScore: number): 'accept' | 'mitigate' | 'transfer' | 'avoid' {
    if (riskScore < 0.2) return 'accept';
    if (riskScore < 0.5) return 'mitigate';
    if (riskScore < 0.8) return 'transfer';
    return 'avoid';
  }
  
  private generateRiskRecommendations(factors: RiskFactor[], matrix: any[]): any[] {
    const recommendations: any[] = [];
    
    // Sort by risk score
    const sortedMatrix = [...matrix].sort((a, b) => b.riskScore - a.riskScore);
    
    for (const entry of sortedMatrix.slice(0, 5)) {
      const factor = factors.find(f => f.name === entry.threat);
      if (factor && factor.mitigations.length > 0) {
        recommendations.push({
          priority: recommendations.length + 1,
          action: factor.mitigations[0],
          rationale: `Mitigate ${entry.threat} (risk score: ${entry.riskScore.toFixed(2)})`,
          effort: entry.riskScore > 0.7 ? 'high' : 'medium',
          riskReduction: entry.riskScore * 0.6
        });
      }
    }
    
    return recommendations;
  }
  
  private async analyzeRiskTrends(factors: RiskFactor[]): Promise<any[]> {
    // Simplified trend analysis
    const currentRiskLevel = factors.length > 10 ? 'high' : factors.length > 5 ? 'medium' : 'low';
    
    return [{
      period: 'current',
      riskLevel: currentRiskLevel as RiskLevel,
      change: 'stable',
      factors: factors.map(f => f.name).slice(0, 3)
    }];
  }
  
  private async extractArchitectureComponents(text: string): Promise<ArchitectureComponent[]> {
    const components: ArchitectureComponent[] = [];
    
    // Pattern matching for common components
    const componentPatterns = {
      'web-application': /web\s*app|frontend|ui|user\s*interface/i,
      'api': /api|rest|graphql|endpoint|service/i,
      'database': /database|db|mysql|postgres|mongodb/i,
      'cache': /cache|redis|memcached/i,
      'message-queue': /queue|rabbitmq|kafka|sqs/i,
      'load-balancer': /load\s*balanc|nginx|haproxy/i
    };
    
    for (const [type, pattern] of Object.entries(componentPatterns)) {
      const matches = text.match(pattern);
      if (matches) {
        components.push({
          id: uuidv4(),
          name: matches[0],
          type: type as ComponentType,
          description: `${type} component`,
          technologies: this.extractTechnologies(text, type),
          interfaces: [],
          securityControls: [],
          threats: []
        });
      }
    }
    
    return components;
  }
  
  private extractTechnologies(text: string, componentType: string): string[] {
    const techPatterns: Record<string, RegExp[]> = {
      'web-application': [/react|angular|vue|javascript|typescript/i],
      'api': [/node|express|fastapi|django|spring/i],
      'database': [/sql|nosql|acid|transactions/i]
    };
    
    const technologies: string[] = [];
    const patterns = techPatterns[componentType] || [];
    
    for (const pattern of patterns) {
      const matches = text.match(pattern);
      if (matches) {
        technologies.push(...matches);
      }
    }
    
    return technologies;
  }
  
  private identifyDataFlows(text: string, components: ArchitectureComponent[]): DataFlow[] {
    const flows: DataFlow[] = [];
    
    // Look for flow indicators
    const flowPatterns = [
      /(\w+)\s*(?:sends?|transmits?|posts?)\s*(?:data|request)?\s*to\s*(\w+)/gi,
      /(\w+)\s*<-+>\s*(\w+)/gi,
      /(\w+)\s*-+>\s*(\w+)/gi
    ];
    
    for (const pattern of flowPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        flows.push({
          id: uuidv4(),
          source: match[1],
          destination: match[2],
          protocol: 'HTTPS',
          dataType: 'JSON',
          encryption: true,
          authentication: true,
          threats: []
        });
      }
    }
    
    return flows;
  }
  
  private defineTrustBoundaries(components: ArchitectureComponent[], flows: DataFlow[]): TrustBoundary[] {
    const boundaries: TrustBoundary[] = [];
    
    // Group components by exposure
    const publicComponents = components.filter(c => 
      c.type === 'web-application' || c.type === 'api'
    );
    
    const internalComponents = components.filter(c => 
      c.type === 'database' || c.type === 'cache'
    );
    
    if (publicComponents.length > 0) {
      boundaries.push({
        id: uuidv4(),
        name: 'Internet Boundary',
        components: publicComponents.map(c => c.id),
        crossingFlows: flows.filter(f => 
          publicComponents.some(c => c.name === f.source || c.name === f.destination)
        ).map(f => f.id),
        securityRequirements: ['Authentication', 'Encryption', 'Rate limiting']
      });
    }
    
    if (internalComponents.length > 0) {
      boundaries.push({
        id: uuidv4(),
        name: 'Internal Network Boundary',
        components: internalComponents.map(c => c.id),
        crossingFlows: [],
        securityRequirements: ['Network segmentation', 'Access control']
      });
    }
    
    return boundaries;
  }
  
  private analyzeAttackSurface(components: ArchitectureComponent[]): any[] {
    const surface: any[] = [];
    
    for (const component of components) {
      const exposure = this.determineExposure(component.type);
      
      surface.push({
        component: component.name,
        exposureType: exposure,
        protocols: this.getProtocols(component.type),
        ports: this.getPorts(component.type),
        authentication: this.getAuthMethods(component.type),
        vulnerabilities: []
      });
    }
    
    return surface;
  }
  
  private determineExposure(type: ComponentType): 'public' | 'internal' | 'partner' {
    if (type === 'web-application' || type === 'api' || type === 'cdn') {
      return 'public';
    }
    if (type === 'third-party-service') {
      return 'partner';
    }
    return 'internal';
  }
  
  private getProtocols(type: ComponentType): string[] {
    const protocols: Record<ComponentType, string[]> = {
      'web-application': ['HTTPS', 'WSS'],
      'api': ['HTTPS', 'gRPC'],
      'database': ['TCP', 'TLS'],
      'message-queue': ['AMQP', 'MQTT'],
      'cache': ['TCP'],
      'load-balancer': ['HTTP', 'HTTPS', 'TCP'],
      'cdn': ['HTTPS'],
      'third-party-service': ['HTTPS'],
      'mobile-app': ['HTTPS'],
      'iot-device': ['MQTT', 'CoAP']
    };
    
    return protocols[type] || ['TCP'];
  }
  
  private getPorts(type: ComponentType): number[] {
    const ports: Record<ComponentType, number[]> = {
      'web-application': [443, 80],
      'api': [443, 8080],
      'database': [5432, 3306, 27017],
      'message-queue': [5672, 9092],
      'cache': [6379],
      'load-balancer': [80, 443],
      'cdn': [443],
      'third-party-service': [443],
      'mobile-app': [],
      'iot-device': [8883, 5683]
    };
    
    return ports[type] || [];
  }
  
  private getAuthMethods(type: ComponentType): string[] {
    if (type === 'api') {
      return ['OAuth2', 'JWT', 'API Key'];
    }
    if (type === 'web-application') {
      return ['Session', 'JWT', 'SAML'];
    }
    return ['TLS Client Cert'];
  }
  
  private async extractDependencies(text: string): Promise<any[]> {
    const dependencies: any[] = [];
    
    // Look for version patterns
    const versionPattern = /(\w+(?:-\w+)*)\s*(?:version|v)?\s*(\d+(?:\.\d+)*)/gi;
    let match;
    
    while ((match = versionPattern.exec(text)) !== null) {
      dependencies.push({
        name: match[1],
        version: match[2],
        type: 'library',
        vulnerabilities: [],
        updates: [],
        criticality: 'medium'
      });
    }
    
    return dependencies;
  }
  
  private findControlsForThreat(threat: ExtractedThreat): SecurityControl[] {
    const results = this.controlSearcher.search(threat.category);
    return results.map(r => r.item).slice(0, 3);
  }
  
  private calculateControlEffectiveness(control: SecurityControl, threat: ExtractedThreat): number {
    // Simplified effectiveness calculation
    if (control.category === 'access-control' && threat.category === 'elevation-of-privilege') {
      return 90;
    }
    if (control.category === 'encryption' && threat.category === 'information-disclosure') {
      return 85;
    }
    return 70;
  }
  
  private estimateImplementationEffort(control: SecurityControl): 'low' | 'medium' | 'high' {
    if (control.type === 'detective') return 'low';
    if (control.type === 'preventive') return 'medium';
    return 'high';
  }
  
  private estimateCost(control: SecurityControl): string {
    const costs: Record<string, string> = {
      'access-control': '$5,000 - $20,000',
      'encryption': '$10,000 - $50,000',
      'monitoring': '$15,000 - $100,000'
    };
    
    return costs[control.category] || '$10,000 - $30,000';
  }
  
  private getComplianceAlignment(control: SecurityControl): string[] {
    const alignments: Record<string, string[]> = {
      'AC-2': ['SOC2', 'ISO27001', 'NIST'],
      'SC-8': ['PCI-DSS', 'HIPAA', 'GDPR']
    };
    
    return alignments[control.id] || [];
  }
  
  private generateNarrativeFromTemplate(text: string): string {
    const threats = this.extractThreatsUsingPatterns(text);
    
    let narrative = '## Threat Analysis Narrative\n\n';
    narrative += `Based on the analysis, ${threats.length} potential threats were identified.\n\n`;
    
    for (const threat of threats) {
      narrative += `### ${threat.name}\n`;
      narrative += `- **Category**: ${threat.category}\n`;
      narrative += `- **Likelihood**: ${threat.likelihood > 0.7 ? 'High' : threat.likelihood > 0.4 ? 'Medium' : 'Low'}\n`;
      narrative += `- **Impact**: ${threat.impact > 0.7 ? 'High' : threat.impact > 0.4 ? 'Medium' : 'Low'}\n`;
      narrative += `- **Mitigations**: ${threat.mitigations.join(', ')}\n\n`;
    }
    
    return narrative;
  }
  
  private generateExecutiveSummary(threats: any[], vulnerabilities: any[], risks: any[]): string {
    return `# Executive Summary\n\nIdentified ${threats.length} threats, ${vulnerabilities.length} vulnerabilities. Overall risk level: ${risks[0]?.value?.overallRisk || 'Medium'}.\n\n`;
  }
  
  private generateThreatSection(threats: any[]): string {
    let section = '# Threat Analysis\n\n';
    
    for (const threat of threats) {
      section += `## ${threat.value.name}\n`;
      section += `${threat.value.description}\n\n`;
    }
    
    return section;
  }
  
  private generateVulnerabilitySection(vulnerabilities: any[]): string {
    let section = '# Vulnerability Assessment\n\n';
    
    for (const vuln of vulnerabilities) {
      section += `## ${vuln.value.name} (${vuln.value.severity})\n`;
      section += `${vuln.value.description}\n`;
      section += `**Remediation**: ${vuln.value.remediation}\n\n`;
    }
    
    return section;
  }
  
  private generateRiskSection(risks: any[]): string {
    if (risks.length === 0) return '';
    
    const risk = risks[0].value;
    return `# Risk Assessment\n\n**Overall Risk**: ${risk.overallRisk} (${risk.riskScore}/100)\n\n`;
  }
  
  private generateControlSection(controls: any[]): string {
    let section = '# Recommended Controls\n\n';
    
    for (const control of controls) {
      section += `## ${control.value.control.name}\n`;
      section += `- **Effectiveness**: ${control.value.effectiveness}%\n`;
      section += `- **Effort**: ${control.value.implementationEffort}\n`;
      section += `- **Cost**: ${control.value.costEstimate}\n\n`;
    }
    
    return section;
  }
  
  private generateRecommendations(threats: any[], vulnerabilities: any[], risks: any[], controls: any[]): string {
    let section = '# Recommendations\n\n';
    
    section += '1. Address critical vulnerabilities immediately\n';
    section += '2. Implement recommended security controls\n';
    section += '3. Conduct regular security assessments\n';
    section += '4. Maintain security awareness training\n';
    
    return section;
  }
  
  private formatReport(sections: string[], format: string): string {
    const report = sections.join('\n');
    
    if (format === 'markdown') {
      return report;
    }
    
    // Other formats would require additional conversion
    return report;
  }
  
  private extractEntities(text: string): Entity[] {
    const entities: Entity[] = [];
    
    // Component entities
    const componentPattern = /\b(api|database|server|frontend|backend|service)\b/gi;
    let match;
    while ((match = componentPattern.exec(text)) !== null) {
      entities.push({
        type: 'component',
        value: match[1],
        normalized: match[1].toLowerCase(),
        confidence: 0.9
      });
    }
    
    // Threat entities
    const threatPattern = /\b(sql injection|xss|csrf|ddos)\b/gi;
    while ((match = threatPattern.exec(text)) !== null) {
      entities.push({
        type: 'threat',
        value: match[1],
        normalized: match[1].toLowerCase().replace(/\s+/g, '-'),
        confidence: 0.95
      });
    }
    
    return entities;
  }
  
  private classifyIntent(text: string, entities: Entity[]): IntentType {
    const intents: Record<string, RegExp> = {
      'find-threats': /find|identify|detect|discover.*threat/i,
      'assess-risk': /assess|evaluate|analyze.*risk/i,
      'check-compliance': /check|verify|audit.*compliance/i,
      'suggest-controls': /suggest|recommend.*control|mitigation/i,
      'explain-vulnerability': /explain|describe|what is.*vulnerability/i,
      'generate-report': /generate|create|build.*report/i
    };
    
    for (const [intent, pattern] of Object.entries(intents)) {
      if (pattern.test(text)) {
        return intent as IntentType;
      }
    }
    
    return 'find-threats';
  }
  
  private identifyDomain(text: string): string {
    if (/web|api|rest|http/.test(text)) return 'web-security';
    if (/cloud|aws|azure|gcp/.test(text)) return 'cloud-security';
    if (/mobile|android|ios/.test(text)) return 'mobile-security';
    if (/network|firewall|ids/.test(text)) return 'network-security';
    return 'application-security';
  }
  
  private generateSuggestedActions(intent: IntentType, entities: Entity[]): string[] {
    const actions: string[] = [];
    
    switch (intent) {
      case 'find-threats':
        actions.push('Run threat modeling analysis');
        actions.push('Generate STRIDE analysis');
        actions.push('Check for OWASP Top 10');
        break;
      case 'assess-risk':
        actions.push('Calculate risk scores');
        actions.push('Build risk matrix');
        actions.push('Generate risk report');
        break;
      case 'suggest-controls':
        actions.push('Match controls to threats');
        actions.push('Prioritize by effectiveness');
        actions.push('Estimate implementation effort');
        break;
    }
    
    return actions;
  }
  
  private checkClarificationNeeded(text: string, intent: IntentType, entities: Entity[]): string[] {
    const clarifications: string[] = [];
    
    if (entities.length === 0) {
      clarifications.push('Which component or system should I analyze?');
    }
    
    if (intent === 'check-compliance' && !text.match(/gdpr|hipaa|pci|sox|iso/i)) {
      clarifications.push('Which compliance framework should I check against?');
    }
    
    if (intent === 'generate-report' && !text.match(/executive|technical|audit/i)) {
      clarifications.push('What type of report do you need?');
    }
    
    return clarifications;
  }
  
  private expandContractions(text: string): string {
    const contractions: Record<string, string> = {
      "can't": 'cannot',
      "won't": 'will not',
      "n't": ' not',
      "'re": ' are',
      "'ve": ' have',
      "'ll": ' will',
      "'d": ' would',
      "'m": ' am'
    };
    
    let expanded = text;
    for (const [contraction, expansion] of Object.entries(contractions)) {
      expanded = expanded.replace(new RegExp(contraction, 'gi'), expansion);
    }
    
    return expanded;
  }
}