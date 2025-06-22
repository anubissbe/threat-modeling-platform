import { NlpManager } from 'node-nlp';
import { logger, mlLogger } from '../utils/logger';
import {
  ModelType,
  MitigationRecommendation,
  Mitigation,
  ImplementationDetails,
  EffortEstimate,
  PredictionRequest,
  PredictionResponse,
  PredictedThreat,
  VulnerabilityPrediction,
} from '../types';
import { config } from '../config';

export class MitigationRecommenderService {
  private nlpManager: NlpManager;
  private mitigationDatabase: Map<string, MitigationTemplate[]> = new Map();
  private implementationPatterns: Map<string, ImplementationPattern> = new Map();
  private effortCalculator: EffortCalculator;

  constructor() {
    this.nlpManager = new NlpManager({ languages: ['en'] });
    this.effortCalculator = new EffortCalculator();
    this.initializeMitigationDatabase();
    this.initializeImplementationPatterns();
  }

  /**
   * Initialize the mitigation recommender
   */
  async initialize(): Promise<void> {
    try {
      const startTime = Date.now();
      
      // Train NLP model for mitigation matching
      await this.trainNlpModel();
      
      mlLogger.modelLoaded(ModelType.MITIGATION_RECOMMENDER, '1.0.0', Date.now() - startTime);
      logger.info('Mitigation recommender service initialized');
    } catch (error) {
      logger.error('Failed to initialize mitigation recommender:', error);
      throw error;
    }
  }

  /**
   * Train NLP model for understanding threats and matching mitigations
   */
  private async trainNlpModel(): Promise<void> {
    // Add training data for threat understanding
    const trainingData = [
      { intent: 'sql-injection', utterances: ['sql injection', 'database query injection', 'sql query manipulation'] },
      { intent: 'xss', utterances: ['cross site scripting', 'xss', 'script injection', 'javascript injection'] },
      { intent: 'auth-bypass', utterances: ['authentication bypass', 'broken authentication', 'weak auth'] },
      { intent: 'data-exposure', utterances: ['data exposure', 'information disclosure', 'data leak'] },
      { intent: 'access-control', utterances: ['broken access control', 'authorization flaw', 'privilege escalation'] },
      { intent: 'dos', utterances: ['denial of service', 'dos attack', 'resource exhaustion'] },
      { intent: 'xxe', utterances: ['xml external entity', 'xxe', 'xml injection'] },
      { intent: 'deserialization', utterances: ['insecure deserialization', 'object injection', 'serialization vulnerability'] },
      { intent: 'misconfiguration', utterances: ['security misconfiguration', 'insecure configuration', 'default settings'] },
      { intent: 'vulnerable-components', utterances: ['vulnerable dependencies', 'outdated libraries', 'component vulnerabilities'] },
    ];

    for (const data of trainingData) {
      data.utterances.forEach(utterance => {
        this.nlpManager.addDocument('en', utterance, data.intent);
      });
    }

    await this.nlpManager.train();
  }

  /**
   * Initialize mitigation database
   */
  private initializeMitigationDatabase(): void {
    // SQL Injection mitigations
    this.mitigationDatabase.set('sql-injection', [
      {
        id: 'sqli-1',
        title: 'Use Parameterized Queries',
        description: 'Replace dynamic SQL queries with parameterized statements to prevent injection',
        category: 'Code Security',
        effectiveness: 0.95,
        complexity: 'low',
        requiredSkills: ['SQL', 'Backend Development'],
        references: ['OWASP SQL Injection Prevention Cheat Sheet'],
      },
      {
        id: 'sqli-2',
        title: 'Input Validation and Sanitization',
        description: 'Implement strict input validation using whitelisting approach',
        category: 'Input Handling',
        effectiveness: 0.85,
        complexity: 'medium',
        requiredSkills: ['Input Validation', 'Regular Expressions'],
        references: ['OWASP Input Validation Cheat Sheet'],
      },
      {
        id: 'sqli-3',
        title: 'Stored Procedures',
        description: 'Use stored procedures to encapsulate database logic',
        category: 'Database Security',
        effectiveness: 0.9,
        complexity: 'medium',
        requiredSkills: ['Database Administration', 'Stored Procedures'],
        references: ['Database Security Best Practices'],
      },
    ]);

    // XSS mitigations
    this.mitigationDatabase.set('xss', [
      {
        id: 'xss-1',
        title: 'Output Encoding',
        description: 'Encode all user-supplied data before rendering in HTML',
        category: 'Output Security',
        effectiveness: 0.9,
        complexity: 'low',
        requiredSkills: ['Frontend Development', 'HTML/JavaScript'],
        references: ['OWASP XSS Prevention Cheat Sheet'],
      },
      {
        id: 'xss-2',
        title: 'Content Security Policy',
        description: 'Implement CSP headers to restrict resource loading',
        category: 'Browser Security',
        effectiveness: 0.85,
        complexity: 'medium',
        requiredSkills: ['Web Security', 'HTTP Headers'],
        references: ['MDN Content-Security-Policy'],
      },
      {
        id: 'xss-3',
        title: 'Use Security Libraries',
        description: 'Utilize proven security libraries for output encoding',
        category: 'Library Usage',
        effectiveness: 0.88,
        complexity: 'low',
        requiredSkills: ['Framework Knowledge'],
        references: ['DOMPurify', 'OWASP Java Encoder'],
      },
    ]);

    // Authentication mitigations
    this.mitigationDatabase.set('auth-bypass', [
      {
        id: 'auth-1',
        title: 'Multi-Factor Authentication',
        description: 'Implement MFA to add additional authentication layers',
        category: 'Authentication',
        effectiveness: 0.95,
        complexity: 'medium',
        requiredSkills: ['Authentication Systems', 'MFA Implementation'],
        references: ['NIST Digital Identity Guidelines'],
      },
      {
        id: 'auth-2',
        title: 'Secure Session Management',
        description: 'Implement secure session handling with proper timeout and rotation',
        category: 'Session Security',
        effectiveness: 0.85,
        complexity: 'medium',
        requiredSkills: ['Session Management', 'Backend Development'],
        references: ['OWASP Session Management Cheat Sheet'],
      },
      {
        id: 'auth-3',
        title: 'Strong Password Policy',
        description: 'Enforce strong password requirements and secure storage',
        category: 'Password Security',
        effectiveness: 0.8,
        complexity: 'low',
        requiredSkills: ['Password Hashing', 'User Management'],
        references: ['OWASP Password Storage Cheat Sheet'],
      },
    ]);

    // Access Control mitigations
    this.mitigationDatabase.set('access-control', [
      {
        id: 'ac-1',
        title: 'Role-Based Access Control',
        description: 'Implement RBAC with principle of least privilege',
        category: 'Authorization',
        effectiveness: 0.9,
        complexity: 'high',
        requiredSkills: ['Authorization Systems', 'RBAC Design'],
        references: ['NIST RBAC Model'],
      },
      {
        id: 'ac-2',
        title: 'Authorization Checks',
        description: 'Implement authorization checks at every access point',
        category: 'Access Validation',
        effectiveness: 0.85,
        complexity: 'medium',
        requiredSkills: ['Backend Development', 'Security Patterns'],
        references: ['OWASP Authorization Testing Guide'],
      },
    ]);

    // Data Protection mitigations
    this.mitigationDatabase.set('data-exposure', [
      {
        id: 'data-1',
        title: 'Encryption at Rest',
        description: 'Encrypt sensitive data stored in databases and file systems',
        category: 'Data Protection',
        effectiveness: 0.95,
        complexity: 'medium',
        requiredSkills: ['Cryptography', 'Database Security'],
        references: ['OWASP Cryptographic Storage Cheat Sheet'],
      },
      {
        id: 'data-2',
        title: 'Encryption in Transit',
        description: 'Use TLS for all data transmission',
        category: 'Transport Security',
        effectiveness: 0.9,
        complexity: 'low',
        requiredSkills: ['TLS/SSL', 'Network Security'],
        references: ['Mozilla SSL Configuration Generator'],
      },
      {
        id: 'data-3',
        title: 'Data Classification',
        description: 'Implement data classification and handling policies',
        category: 'Data Governance',
        effectiveness: 0.8,
        complexity: 'high',
        requiredSkills: ['Data Governance', 'Policy Development'],
        references: ['ISO 27001 Data Classification'],
      },
    ]);

    // Add more mitigation categories...
  }

  /**
   * Initialize implementation patterns
   */
  private initializeImplementationPatterns(): void {
    this.implementationPatterns.set('parameterized-queries', {
      steps: [
        'Identify all dynamic SQL queries in the codebase',
        'Replace string concatenation with parameterized query syntax',
        'Update database connection libraries if needed',
        'Test queries with various input scenarios',
        'Implement query logging for monitoring',
      ],
      requiredTools: ['Database client library', 'Query analyzer'],
      prerequisites: ['Database access', 'Understanding of SQL'],
      estimatedTime: '2-4 hours per query endpoint',
    });

    this.implementationPatterns.set('csp-implementation', {
      steps: [
        'Analyze current resource loading patterns',
        'Define Content Security Policy directives',
        'Implement CSP headers in report-only mode',
        'Monitor CSP violation reports',
        'Adjust policy based on violations',
        'Enable enforcing mode',
      ],
      requiredTools: ['CSP report collector', 'Header configuration access'],
      prerequisites: ['Web server configuration access'],
      estimatedTime: '8-16 hours',
    });

    this.implementationPatterns.set('mfa-implementation', {
      steps: [
        'Select MFA provider or library',
        'Design user enrollment flow',
        'Implement MFA backend integration',
        'Create user interface for MFA setup',
        'Add MFA challenge to login flow',
        'Implement backup codes or recovery',
        'Test with various MFA methods',
      ],
      requiredTools: ['MFA service/library', 'SMS/Email service'],
      prerequisites: ['User authentication system', 'User database schema updates'],
      estimatedTime: '40-60 hours',
    });

    // Add more implementation patterns...
  }

  /**
   * Recommend mitigations for threats
   */
  async recommendMitigations(request: PredictionRequest): Promise<PredictionResponse> {
    const startTime = Date.now();

    try {
      const threats = this.extractThreats(request.input);
      const recommendations: MitigationRecommendation[] = [];

      for (const threat of threats) {
        // Use NLP to understand threat type
        const nlpResult = await this.nlpManager.process('en', threat.description || threat.type);
        const threatIntent = nlpResult.intent || this.mapThreatTypeToIntent(threat.type);
        
        // Get relevant mitigations
        const mitigations = this.selectMitigations(threatIntent, threat);
        
        // Calculate priority
        const priority = this.calculatePriority(threat);
        
        // Estimate effort
        const estimatedEffort = this.effortCalculator.calculate(mitigations);

        recommendations.push({
          threatId: threat.id,
          mitigations,
          priority,
          estimatedEffort,
        });

        mlLogger.mitigationRecommended(threat.id, mitigations.length, priority);
      }

      const processingTime = Date.now() - startTime;
      const avgConfidence = this.calculateAverageEffectiveness(recommendations);
      
      mlLogger.predictionMade(ModelType.MITIGATION_RECOMMENDER, avgConfidence, processingTime);

      return {
        success: true,
        modelType: ModelType.MITIGATION_RECOMMENDER,
        predictions: recommendations.map(rec => ({
          label: `Threat ${rec.threatId}`,
          confidence: this.calculateRecommendationConfidence(rec),
          explanation: this.generateRecommendationExplanation(rec),
          suggestedMitigations: rec.mitigations,
        })),
        metadata: {
          modelVersion: '1.0.0',
          processingTime,
          dataQuality: this.assessDataQuality(threats),
          confidenceRange: [0.7, 0.95],
        },
        timestamp: new Date(),
      };

    } catch (error: any) {
      mlLogger.predictionError(ModelType.MITIGATION_RECOMMENDER, error.message, request.input);
      throw error;
    }
  }

  /**
   * Extract threats from input
   */
  private extractThreats(input: any): PredictedThreat[] {
    if (Array.isArray(input)) {
      return input;
    }
    
    if (input.threats) {
      return input.threats;
    }
    
    if (input.analysis?.threats) {
      return input.analysis.threats;
    }
    
    // Convert single threat
    return [{
      id: input.id || 'threat-1',
      type: input.type || 'unknown',
      category: input.category || 'general',
      probability: input.probability || 0.5,
      impact: input.impact || 'medium',
      affectedComponents: input.affectedComponents || [],
      description: input.description || '',
      evidence: input.evidence || [],
    }];
  }

  /**
   * Map threat type to NLP intent
   */
  private mapThreatTypeToIntent(threatType: string): string {
    const mappings: Record<string, string> = {
      'Spoofing': 'auth-bypass',
      'Tampering': 'data-integrity',
      'Repudiation': 'audit-logging',
      'Information Disclosure': 'data-exposure',
      'Denial of Service': 'dos',
      'Elevation of Privilege': 'access-control',
      'SQL Injection': 'sql-injection',
      'XSS': 'xss',
      'XXE': 'xxe',
      'Broken Authentication': 'auth-bypass',
      'Broken Access Control': 'access-control',
    };
    
    return mappings[threatType] || 'general';
  }

  /**
   * Select appropriate mitigations
   */
  private selectMitigations(threatIntent: string, threat: PredictedThreat): Mitigation[] {
    const templates = this.mitigationDatabase.get(threatIntent) || [];
    const mitigations: Mitigation[] = [];

    // Score and rank mitigations
    const scoredMitigations = templates.map(template => {
      const score = this.scoreMitigation(template, threat);
      return { template, score };
    }).sort((a, b) => b.score - a.score);

    // Select top mitigations
    const selectedTemplates = scoredMitigations.slice(0, 3).map(sm => sm.template);

    // Convert templates to full mitigations
    selectedTemplates.forEach(template => {
      const implementation = this.getImplementationDetails(template);
      
      mitigations.push({
        id: template.id,
        title: template.title,
        description: template.description,
        category: template.category,
        effectiveness: template.effectiveness,
        implementation,
        references: template.references,
      });
    });

    // Add contextual mitigations based on affected components
    if (threat.affectedComponents.length > 0) {
      const contextualMitigations = this.getContextualMitigations(threat);
      mitigations.push(...contextualMitigations);
    }

    return mitigations;
  }

  /**
   * Score mitigation relevance
   */
  private scoreMitigation(template: MitigationTemplate, threat: PredictedThreat): number {
    let score = template.effectiveness;

    // Adjust based on threat probability and impact
    const threatSeverity = threat.probability * this.impactToNumber(threat.impact);
    score *= (1 + threatSeverity * 0.2);

    // Adjust based on complexity vs urgency
    if (threat.probability > 0.8 && template.complexity === 'low') {
      score *= 1.2; // Prefer quick fixes for high probability threats
    }

    // Consider affected components
    if (threat.affectedComponents.length > 3) {
      score *= 1.1; // Prefer comprehensive solutions for widespread threats
    }

    return score;
  }

  /**
   * Get implementation details
   */
  private getImplementationDetails(template: MitigationTemplate): ImplementationDetails {
    const patternKey = this.templateToPatternKey(template.title);
    const pattern = this.implementationPatterns.get(patternKey);

    if (pattern) {
      return {
        steps: pattern.steps,
        requiredTools: pattern.requiredTools,
        estimatedTime: pattern.estimatedTime,
        complexity: template.complexity,
        prerequisites: pattern.prerequisites,
      };
    }

    // Generate generic implementation details
    return {
      steps: this.generateGenericSteps(template),
      requiredTools: this.suggestTools(template),
      estimatedTime: this.estimateTime(template.complexity),
      complexity: template.complexity,
      prerequisites: template.requiredSkills,
    };
  }

  /**
   * Convert template title to pattern key
   */
  private templateToPatternKey(title: string): string {
    return title.toLowerCase().replace(/\s+/g, '-');
  }

  /**
   * Generate generic implementation steps
   */
  private generateGenericSteps(template: MitigationTemplate): string[] {
    const baseSteps = [
      `Assess current implementation of ${template.category}`,
      `Identify affected components and code sections`,
      `Design ${template.title.toLowerCase()} implementation`,
      `Implement changes following security best practices`,
      `Test implementation thoroughly`,
      `Document changes and update security policies`,
    ];

    // Add specific steps based on category
    switch (template.category) {
      case 'Code Security':
        baseSteps.splice(3, 0, 'Review and update coding standards');
        break;
      case 'Authentication':
        baseSteps.splice(3, 0, 'Update authentication flow diagrams');
        break;
      case 'Data Protection':
        baseSteps.splice(3, 0, 'Classify data sensitivity levels');
        break;
    }

    return baseSteps;
  }

  /**
   * Suggest tools for implementation
   */
  private suggestTools(template: MitigationTemplate): string[] {
    const toolMap: Record<string, string[]> = {
      'Code Security': ['Static code analyzer', 'IDE security plugins'],
      'Authentication': ['Auth library/service', 'Token generator'],
      'Data Protection': ['Encryption library', 'Key management service'],
      'Input Handling': ['Validation library', 'Sanitization tools'],
      'Browser Security': ['Security headers analyzer', 'CSP validator'],
      'Database Security': ['Query analyzer', 'Database security scanner'],
    };

    return toolMap[template.category] || ['Security scanner', 'Code review tools'];
  }

  /**
   * Estimate implementation time
   */
  private estimateTime(complexity: string): string {
    const timeEstimates: Record<string, string> = {
      'low': '2-8 hours',
      'medium': '16-40 hours',
      'high': '40-80 hours',
    };

    return timeEstimates[complexity] || '8-40 hours';
  }

  /**
   * Get contextual mitigations based on affected components
   */
  private getContextualMitigations(threat: PredictedThreat): Mitigation[] {
    const contextualMitigations: Mitigation[] = [];

    // Add network segmentation if multiple components affected
    if (threat.affectedComponents.length > 2) {
      contextualMitigations.push({
        id: 'context-1',
        title: 'Network Segmentation',
        description: 'Implement network segmentation to limit threat propagation',
        category: 'Network Security',
        effectiveness: 0.8,
        implementation: {
          steps: [
            'Map component network dependencies',
            'Design network segmentation strategy',
            'Implement network policies',
            'Test inter-component communication',
          ],
          complexity: 'medium',
        },
        references: ['Zero Trust Architecture'],
      });
    }

    // Add monitoring if high impact
    if (threat.impact === 'critical' || threat.impact === 'high') {
      contextualMitigations.push({
        id: 'context-2',
        title: 'Enhanced Monitoring',
        description: 'Implement comprehensive monitoring and alerting',
        category: 'Detection',
        effectiveness: 0.75,
        implementation: {
          steps: [
            'Define monitoring requirements',
            'Deploy monitoring agents',
            'Configure alert thresholds',
            'Set up incident response procedures',
          ],
          complexity: 'medium',
        },
        references: ['SIEM Best Practices'],
      });
    }

    return contextualMitigations;
  }

  /**
   * Calculate priority based on threat characteristics
   */
  private calculatePriority(threat: PredictedThreat): 'immediate' | 'high' | 'medium' | 'low' {
    const impactScore = this.impactToNumber(threat.impact);
    const riskScore = threat.probability * impactScore;

    if (riskScore > 0.8 || threat.impact === 'critical') return 'immediate';
    if (riskScore > 0.6 || threat.impact === 'high') return 'high';
    if (riskScore > 0.3) return 'medium';
    return 'low';
  }

  /**
   * Convert impact to numerical value
   */
  private impactToNumber(impact: string): number {
    const impactValues: Record<string, number> = {
      'critical': 1.0,
      'high': 0.8,
      'medium': 0.5,
      'low': 0.3,
      'minimal': 0.1,
    };

    return impactValues[impact] || 0.5;
  }

  /**
   * Calculate average effectiveness
   */
  private calculateAverageEffectiveness(recommendations: MitigationRecommendation[]): number {
    const allEffectiveness = recommendations.flatMap(rec => 
      rec.mitigations.map(m => m.effectiveness)
    );
    
    if (allEffectiveness.length === 0) return 0;
    
    return allEffectiveness.reduce((sum, e) => sum + e, 0) / allEffectiveness.length;
  }

  /**
   * Calculate recommendation confidence
   */
  private calculateRecommendationConfidence(recommendation: MitigationRecommendation): number {
    const avgEffectiveness = recommendation.mitigations.reduce(
      (sum, m) => sum + m.effectiveness, 0
    ) / recommendation.mitigations.length;
    
    return Math.min(avgEffectiveness + 0.1, 0.95);
  }

  /**
   * Generate recommendation explanation
   */
  private generateRecommendationExplanation(recommendation: MitigationRecommendation): string {
    const mitigationCount = recommendation.mitigations.length;
    const priority = recommendation.priority;
    const effort = recommendation.estimatedEffort.hours;
    
    return `Recommended ${mitigationCount} mitigations with ${priority} priority. ` +
           `Estimated implementation effort: ${effort} hours with ${recommendation.estimatedEffort.complexity} complexity.`;
  }

  /**
   * Assess data quality
   */
  private assessDataQuality(threats: PredictedThreat[]): number {
    let totalQuality = 0;

    threats.forEach(threat => {
      const factors = {
        hasType: threat.type !== 'unknown' ? 1 : 0,
        hasDescription: threat.description.length > 20 ? 1 : 0.5,
        hasProbability: threat.probability > 0 ? 1 : 0,
        hasImpact: threat.impact !== 'medium' ? 1 : 0.5,
        hasEvidence: threat.evidence.length > 0 ? 1 : 0,
      };

      const quality = Object.values(factors).reduce((sum, val) => sum + val, 0) / 5;
      totalQuality += quality;
    });

    return totalQuality / threats.length;
  }

  /**
   * Get model statistics
   */
  getModelStats(): any {
    return {
      type: ModelType.MITIGATION_RECOMMENDER,
      mitigationTemplates: Array.from(this.mitigationDatabase.values()).flat().length,
      implementationPatterns: this.implementationPatterns.size,
      nlpTrained: true,
      version: '1.0.0',
    };
  }
}

// Helper interfaces
interface MitigationTemplate {
  id: string;
  title: string;
  description: string;
  category: string;
  effectiveness: number;
  complexity: 'low' | 'medium' | 'high';
  requiredSkills: string[];
  references: string[];
}

interface ImplementationPattern {
  steps: string[];
  requiredTools?: string[];
  prerequisites?: string[];
  estimatedTime?: string;
}

// Effort calculator helper class
class EffortCalculator {
  calculate(mitigations: Mitigation[]): EffortEstimate {
    let totalHours = 0;
    let maxComplexity: 'low' | 'medium' | 'high' = 'low';
    const allSkills = new Set<string>();

    mitigations.forEach(mitigation => {
      // Parse hours from estimated time
      const timeStr = mitigation.implementation.estimatedTime || '8 hours';
      const hours = this.parseHours(timeStr);
      totalHours += hours;

      // Track complexity
      const complexity = mitigation.implementation.complexity || 'medium';
      if (this.complexityValue(complexity) > this.complexityValue(maxComplexity)) {
        maxComplexity = complexity;
      }

      // Collect required skills
      mitigation.implementation.prerequisites?.forEach(skill => allSkills.add(skill));
    });

    return {
      hours: Math.ceil(totalHours),
      complexity: maxComplexity,
      requiredSkills: Array.from(allSkills),
    };
  }

  private parseHours(timeStr: string): number {
    const match = timeStr.match(/(\d+)(?:-(\d+))?\s*hours?/);
    if (match) {
      const min = parseInt(match[1]!);
      const max = match[2] ? parseInt(match[2]) : min;
      return (min + max) / 2;
    }
    return 8; // Default
  }

  private complexityValue(complexity: string): number {
    const values: Record<string, number> = {
      'low': 1,
      'medium': 2,
      'high': 3,
    };
    return values[complexity] || 2;
  }
}