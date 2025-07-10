import { v4 as uuidv4 } from 'uuid';
import {
  NLPAnalysisRequest,
  NLPAnalysisResponse,
  NLPResult,
  ExtractedThreat,
  DetectedVulnerability,
  SecurityRequirement,
  ComplianceMapping,
  RiskAssessment,
  TechnicalDecomposition,
  SecurityControlSuggestion,
  QueryIntent,
  ThreatCategory,
  STRIDECategory,
  ComplianceFramework,
  RiskLevel,
  SecurityControl,
  Entity,
  IntentType,
} from '../types/nlp';

export class SimpleNLPService {
  private threatPatterns: Map<string, RegExp> = new Map();
  private vulnPatterns: Map<string, RegExp> = new Map();
  private complianceKeywords: Map<ComplianceFramework, string[]> = new Map();

  constructor() {
    this.initializePatterns();
  }

  private initializePatterns(): void {
    // Initialize threat patterns
    this.threatPatterns.set('spoofing', /\b(spoof|impersonat|fake|phish|masquerad|pretend)\b/i);
    this.threatPatterns.set('tampering', /\b(tamper|modif|alter|corrupt|manipulat|chang)\b/i);
    this.threatPatterns.set('repudiation', /\b(repudiat|deny|disavow|reject|non-repudiat)\b/i);
    this.threatPatterns.set('information-disclosure', /\b(disclos|leak|expos|reveal|breach|unauthoriz.*access)\b/i);
    this.threatPatterns.set('denial-of-service', /\b(dos|ddos|denial.*service|overwhelm|flood|exhaust)\b/i);
    this.threatPatterns.set('elevation-of-privilege', /\b(escalat|elevat.*privileg|root|admin|bypass.*auth)\b/i);

    // Initialize vulnerability patterns
    this.vulnPatterns.set('SQL Injection', /\b(sql\s*injection|sqli|union\s+select|or\s+1=1)\b/i);
    this.vulnPatterns.set('XSS', /\b(cross[- ]?site[- ]?scripting|xss|script\s+injection)\b/i);
    this.vulnPatterns.set('CSRF', /\b(csrf|cross[- ]?site[- ]?request[- ]?forgery)\b/i);
    this.vulnPatterns.set('Buffer Overflow', /\b(buffer\s+overflow|stack\s+overflow|heap\s+overflow)\b/i);
    this.vulnPatterns.set('Weak Encryption', /\b(weak\s+encryp|md5|sha1|des\b|ecb\s+mode)\b/i);
    this.vulnPatterns.set('Hardcoded Credentials', /\b(hardcoded?\s+(password|credential|secret|key))\b/i);

    // Initialize compliance keywords
    this.complianceKeywords.set('GDPR', ['personal data', 'data protection', 'privacy', 'consent', 'data subject']);
    this.complianceKeywords.set('HIPAA', ['health information', 'medical records', 'patient data', 'healthcare']);
    this.complianceKeywords.set('PCI-DSS', ['payment card', 'credit card', 'cardholder data', 'payment processing']);
    this.complianceKeywords.set('SOC2', ['security controls', 'availability', 'confidentiality', 'processing integrity']);
    this.complianceKeywords.set('ISO27001', ['information security', 'risk management', 'security controls']);
  }

  public async analyze(request: NLPAnalysisRequest): Promise<NLPAnalysisResponse> {
    const requestId = uuidv4();
    const startTime = Date.now();

    let results: NLPResult[] = [];

    switch (request.analysisType) {
      case 'threat-extraction':
        results = await this.extractThreats(request.text);
        break;
      case 'vulnerability-detection':
        results = await this.detectVulnerabilities(request.text);
        break;
      case 'requirement-analysis':
        results = await this.analyzeRequirements(request.text);
        break;
      case 'compliance-mapping':
        results = await this.mapCompliance(request.text, request.options?.targetFramework);
        break;
      case 'risk-assessment':
        results = await this.assessRisk(request.text);
        break;
      case 'technical-decomposition':
        results = await this.decomposeTechnical(request.text);
        break;
      case 'security-control-suggestion':
        results = await this.suggestControls(request.text);
        break;
      case 'threat-narrative-generation':
        results = await this.generateNarrative(request.text);
        break;
      case 'report-generation':
        results = await this.generateReport(request.text, request.options);
        break;
      case 'query-understanding':
        results = await this.understandQuery(request.text);
        break;
      default:
        throw new Error(`Unknown analysis type: ${request.analysisType}`);
    }

    const confidence = this.calculateConfidence(results);

    return {
      requestId,
      timestamp: new Date(),
      analysisType: request.analysisType,
      results,
      metadata: {
        processingTime: Date.now() - startTime,
        tokensProcessed: request.text.split(/\s+/).length,
        language: request.language || 'en',
        models: ['simple-nlp-engine'],
        version: '1.0.0'
      },
      confidence
    };
  }

  private async extractThreats(text: string): Promise<NLPResult[]> {
    const results: NLPResult[] = [];

    for (const [category, pattern] of this.threatPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        const threat: ExtractedThreat = {
          id: uuidv4(),
          name: `${category} threat`,
          description: this.extractContext(text, matches[0]),
          category: category as ThreatCategory,
          attackVector: this.inferAttackVector(text),
          impactedAssets: this.extractAssets(text),
          likelihood: Math.random() * 0.5 + 0.3, // 0.3-0.8
          impact: Math.random() * 0.5 + 0.4, // 0.4-0.9
          mitigations: this.getMitigations(category),
          stride: [category.charAt(0).toUpperCase() as STRIDECategory],
          confidence: 0.85
        };

        results.push({
          type: 'threat',
          value: threat,
          confidence: threat.confidence,
          explanation: `Detected ${category} threat based on pattern matching`
        });
      }
    }

    return results;
  }

  private async detectVulnerabilities(text: string): Promise<NLPResult[]> {
    const results: NLPResult[] = [];

    for (const [vulnName, pattern] of this.vulnPatterns) {
      if (pattern.test(text)) {
        const vulnerability: DetectedVulnerability = {
          id: uuidv4(),
          name: vulnName,
          description: this.getVulnDescription(vulnName),
          severity: this.getVulnSeverity(vulnName),
          cwe: this.getCWE(vulnName),
          owasp: this.getOWASP(vulnName),
          affectedComponent: 'application',
          exploitability: Math.random() * 0.4 + 0.5, // 0.5-0.9
          remediation: this.getRemediation(vulnName),
          references: [`https://owasp.org/www-project-top-ten/`],
          confidence: 0.9
        };

        results.push({
          type: 'vulnerability',
          value: vulnerability,
          confidence: vulnerability.confidence,
          explanation: `Detected ${vulnName} vulnerability`
        });
      }
    }

    return results;
  }

  private async analyzeRequirements(text: string): Promise<NLPResult[]> {
    const results: NLPResult[] = [];
    const sentences = text.split(/[.!?]+/);

    const requirementPatterns = [
      /must\s+(?:be\s+)?(.+)/i,
      /shall\s+(?:be\s+)?(.+)/i,
      /should\s+(?:be\s+)?(.+)/i,
      /require[sd]?\s+(?:that\s+)?(.+)/i
    ];

    for (const sentence of sentences) {
      for (const pattern of requirementPatterns) {
        const match = sentence.match(pattern);
        if (match) {
          const requirement: SecurityRequirement = {
            id: uuidv4(),
            text: sentence.trim(),
            type: 'functional',
            priority: this.extractPriority(sentence),
            category: 'security',
            testable: /test|verify|check|validate/.test(sentence),
            measurable: /\d+|percent|rate|time/.test(sentence),
            relatedThreats: [],
            implementationNotes: '',
            verificationCriteria: ['Manual verification required']
          };

          results.push({
            type: 'requirement',
            value: requirement,
            confidence: 0.8,
            explanation: `Extracted security requirement`
          });
          break;
        }
      }
    }

    return results;
  }

  private async mapCompliance(text: string, framework?: ComplianceFramework): Promise<NLPResult[]> {
    const targetFramework = framework || 'GDPR';
    const keywords = this.complianceKeywords.get(targetFramework) || [];
    
    let matchCount = 0;
    const totalKeywords = keywords.length;

    for (const keyword of keywords) {
      if (text.toLowerCase().includes(keyword.toLowerCase())) {
        matchCount++;
      }
    }

    const coverage = totalKeywords > 0 ? (matchCount / totalKeywords) * 100 : 0;

    const mapping: ComplianceMapping = {
      framework: targetFramework,
      requirements: [
        {
          id: 'req-001',
          text: `${targetFramework} compliance requirement`,
          section: 'General',
          status: coverage > 60 ? 'compliant' : 'non-compliant',
          evidence: [`Found ${matchCount} relevant keywords`],
          controls: ['Access controls', 'Data protection']
        }
      ],
      coverage,
      gaps: coverage < 80 ? [
        {
          requirement: 'Data protection measures',
          currentState: 'Partially implemented',
          desiredState: 'Fully compliant',
          remediation: 'Implement additional controls',
          effort: 'medium',
          priority: 1
        }
      ] : [],
      recommendations: coverage < 80 ? ['Implement additional security controls'] : []
    };

    return [{
      type: 'compliance-mapping',
      value: mapping,
      confidence: 0.85,
      explanation: `Compliance mapping for ${targetFramework}`
    }];
  }

  private async assessRisk(text: string): Promise<NLPResult[]> {
    const threatResults = await this.extractThreats(text);
    const vulnResults = await this.detectVulnerabilities(text);
    
    const totalFindings = threatResults.length + vulnResults.length;
    const riskScore = Math.min(100, totalFindings * 15); // Scale based on findings
    
    const assessment: RiskAssessment = {
      overallRisk: this.mapScoreToRisk(riskScore),
      riskScore,
      riskFactors: [
        {
          name: 'Threat exposure',
          description: `${threatResults.length} threats identified`,
          impact: 0.7,
          likelihood: 0.6,
          category: 'threat',
          mitigations: ['Implement security controls']
        },
        {
          name: 'Vulnerability presence',
          description: `${vulnResults.length} vulnerabilities found`,
          impact: 0.8,
          likelihood: 0.7,
          category: 'vulnerability',
          mitigations: ['Apply security patches']
        }
      ],
      riskMatrix: [
        {
          threat: 'General threats',
          vulnerability: 'System vulnerabilities',
          impact: 0.7,
          likelihood: 0.6,
          riskScore: 0.42,
          treatmentStrategy: 'mitigate'
        }
      ],
      recommendations: [
        {
          priority: 1,
          action: 'Implement security controls',
          rationale: 'Reduce overall risk exposure',
          effort: 'medium',
          riskReduction: 0.3
        }
      ],
      trends: [
        {
          period: 'current',
          riskLevel: this.mapScoreToRisk(riskScore),
          change: 'stable',
          factors: ['threat-landscape', 'vulnerability-disclosure']
        }
      ]
    };

    return [{
      type: 'risk-assessment',
      value: assessment,
      confidence: 0.8,
      explanation: `Risk assessment based on ${totalFindings} findings`
    }];
  }

  private async decomposeTechnical(text: string): Promise<NLPResult[]> {
    const components = this.extractComponents(text);
    const dataFlows = this.extractDataFlows(text);
    
    const decomposition: TechnicalDecomposition = {
      architecture: components,
      dataFlows,
      trustBoundaries: [
        {
          id: uuidv4(),
          name: 'Internet boundary',
          components: components.filter(c => c.type === 'web-application').map(c => c.id),
          crossingFlows: dataFlows.map(f => f.id),
          securityRequirements: ['Authentication', 'Encryption']
        }
      ],
      attackSurface: [
        {
          component: 'web-application',
          exposureType: 'public',
          protocols: ['HTTPS'],
          ports: [443],
          authentication: ['OAuth2'],
          vulnerabilities: []
        }
      ],
      dependencies: [
        {
          name: 'example-library',
          version: '1.0.0',
          type: 'library',
          vulnerabilities: [],
          updates: [],
          criticality: 'medium'
        }
      ]
    };

    return [{
      type: 'technical-decomposition',
      value: decomposition,
      confidence: 0.75,
      explanation: `Technical decomposition with ${components.length} components`
    }];
  }

  private async suggestControls(text: string): Promise<NLPResult[]> {
    const threats = await this.extractThreats(text);
    const results: NLPResult[] = [];

    for (const threat of threats) {
      const threatData = threat.value as ExtractedThreat;
      const control: SecurityControl = {
        id: uuidv4(),
        name: `Control for ${threatData.category}`,
        type: 'preventive',
        category: 'access-control',
        description: `Security control to mitigate ${threatData.category} threats`,
        implementation: 'Implement appropriate security measures',
        verification: 'Test and validate implementation',
        maintenance: 'Regular review and updates'
      };

      const suggestion: SecurityControlSuggestion = {
        control,
        rationale: `Mitigate ${threatData.name}`,
        effectiveness: 85,
        implementationEffort: 'medium',
        costEstimate: '$10,000 - $30,000',
        mitigatedThreats: [threatData.id],
        complianceAlignment: ['ISO27001', 'NIST']
      };

      results.push({
        type: 'security-control',
        value: suggestion,
        confidence: 0.8,
        explanation: `Suggested control for ${threatData.category}`
      });
    }

    return results;
  }

  private async generateNarrative(text: string): Promise<NLPResult[]> {
    const threats = await this.extractThreats(text);
    const narrative = `
# Threat Analysis Narrative

Based on the analysis of the provided text, ${threats.length} potential security threats were identified.

${threats.map((threat, index) => {
  const t = threat.value as ExtractedThreat;
  return `## ${index + 1}. ${t.name}
- **Category**: ${t.category}
- **Likelihood**: ${t.likelihood > 0.7 ? 'High' : t.likelihood > 0.4 ? 'Medium' : 'Low'}
- **Impact**: ${t.impact > 0.7 ? 'High' : t.impact > 0.4 ? 'Medium' : 'Low'}
- **Mitigations**: ${t.mitigations.join(', ')}`;
}).join('\n\n')}

## Recommendations
1. Implement appropriate security controls
2. Conduct regular security assessments
3. Monitor for emerging threats
4. Maintain incident response procedures
    `;

    return [{
      type: 'narrative',
      value: narrative.trim(),
      confidence: 0.9,
      explanation: 'Generated threat narrative'
    }];
  }

  private async generateReport(text: string, _options?: any): Promise<NLPResult[]> {
    const threats = await this.extractThreats(text);
    const vulnerabilities = await this.detectVulnerabilities(text);
    const risk = await this.assessRisk(text);
    
    const report = `
# Security Assessment Report

## Executive Summary
- **Threats Identified**: ${threats.length}
- **Vulnerabilities Found**: ${vulnerabilities.length}
- **Overall Risk Level**: ${risk.length > 0 ? (risk[0].value as RiskAssessment).overallRisk : 'Medium'}

## Threat Analysis
${threats.map(t => `- ${(t.value as ExtractedThreat).name}: ${(t.value as ExtractedThreat).description}`).join('\n')}

## Vulnerability Assessment
${vulnerabilities.map(v => `- ${(v.value as DetectedVulnerability).name} (${(v.value as DetectedVulnerability).severity})`).join('\n')}

## Recommendations
1. Address critical vulnerabilities immediately
2. Implement recommended security controls
3. Conduct regular security reviews
4. Maintain security awareness training

---
*Report generated by NLP Engine*
    `;

    return [{
      type: 'report',
      value: report.trim(),
      confidence: 0.95,
      explanation: 'Generated security assessment report'
    }];
  }

  private async understandQuery(text: string): Promise<NLPResult[]> {
    const entities = this.extractEntities(text);
    const intent = this.classifyIntent(text);
    
    const queryIntent: QueryIntent = {
      intent,
      entities,
      context: {
        domain: 'security',
        previousQueries: [],
        currentFocus: entities[0]?.value || 'general',
        userExpertise: 'intermediate'
      },
      suggestedActions: this.getSuggestedActions(intent),
      clarificationNeeded: entities.length === 0 ? ['What specific component should I analyze?'] : undefined
    };

    return [{
      type: 'query-intent',
      value: queryIntent,
      confidence: 0.9,
      explanation: `Understood query intent: ${intent}`
    }];
  }

  // Helper methods
  private extractContext(text: string, match: string): string {
    const index = text.indexOf(match);
    const start = Math.max(0, index - 50);
    const end = Math.min(text.length, index + match.length + 50);
    return text.substring(start, end).trim();
  }

  private inferAttackVector(text: string): string {
    if (/network|remote|internet/.test(text)) return 'network';
    if (/web|browser|http/.test(text)) return 'web';
    if (/email|phish/.test(text)) return 'email';
    return 'unknown';
  }

  private extractAssets(text: string): string[] {
    const assets: string[] = [];
    const assetPatterns = [
      /\b(database|db)\b/gi,
      /\b(server|api)\b/gi,
      /\b(user.*data|personal.*data)\b/gi,
      /\b(credential|password)\b/gi
    ];

    for (const pattern of assetPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        assets.push(...matches.map(m => m.toLowerCase()));
      }
    }

    return [...new Set(assets)];
  }

  private getMitigations(category: string): string[] {
    const mitigations: Record<string, string[]> = {
      'spoofing': ['Strong authentication', 'Multi-factor authentication'],
      'tampering': ['Data integrity checks', 'Digital signatures'],
      'repudiation': ['Audit logging', 'Non-repudiation controls'],
      'information-disclosure': ['Encryption', 'Access controls'],
      'denial-of-service': ['Rate limiting', 'Resource monitoring'],
      'elevation-of-privilege': ['Least privilege', 'Access controls']
    };

    return mitigations[category] || ['General security controls'];
  }

  private getVulnDescription(vulnName: string): string {
    const descriptions: Record<string, string> = {
      'SQL Injection': 'Allows attackers to interfere with database queries',
      'XSS': 'Enables injection of malicious scripts into web pages',
      'CSRF': 'Forces authenticated users to execute unwanted actions',
      'Buffer Overflow': 'Can crash programs or execute arbitrary code',
      'Weak Encryption': 'Uses outdated or broken cryptographic algorithms',
      'Hardcoded Credentials': 'Contains embedded authentication credentials'
    };

    return descriptions[vulnName] || 'Security vulnerability';
  }

  private getVulnSeverity(vulnName: string): 'critical' | 'high' | 'medium' | 'low' {
    const severities: Record<string, 'critical' | 'high' | 'medium' | 'low'> = {
      'SQL Injection': 'critical',
      'XSS': 'high',
      'CSRF': 'medium',
      'Buffer Overflow': 'critical',
      'Weak Encryption': 'high',
      'Hardcoded Credentials': 'critical'
    };

    return severities[vulnName] || 'medium';
  }

  private getCWE(vulnName: string): string {
    const cwes: Record<string, string> = {
      'SQL Injection': 'CWE-89',
      'XSS': 'CWE-79',
      'CSRF': 'CWE-352',
      'Buffer Overflow': 'CWE-120',
      'Weak Encryption': 'CWE-326',
      'Hardcoded Credentials': 'CWE-798'
    };

    return cwes[vulnName] || '';
  }

  private getOWASP(vulnName: string): string {
    const owasps: Record<string, string> = {
      'SQL Injection': 'A03:2021',
      'XSS': 'A03:2021',
      'CSRF': 'A01:2021',
      'Weak Encryption': 'A02:2021',
      'Hardcoded Credentials': 'A07:2021'
    };

    return owasps[vulnName] || '';
  }

  private getRemediation(vulnName: string): string {
    const remediations: Record<string, string> = {
      'SQL Injection': 'Use parameterized queries and prepared statements',
      'XSS': 'Sanitize and encode all user input',
      'CSRF': 'Implement CSRF tokens for state-changing operations',
      'Buffer Overflow': 'Use safe string functions and bounds checking',
      'Weak Encryption': 'Upgrade to strong encryption algorithms',
      'Hardcoded Credentials': 'Use secure credential storage'
    };

    return remediations[vulnName] || 'Apply appropriate security measures';
  }

  private extractPriority(text: string): 'must-have' | 'should-have' | 'nice-to-have' {
    if (/must|shall|critical|essential/.test(text)) return 'must-have';
    if (/should|important|recommended/.test(text)) return 'should-have';
    return 'nice-to-have';
  }

  private mapScoreToRisk(score: number): RiskLevel {
    if (score >= 80) return 'critical';
    if (score >= 60) return 'high';
    if (score >= 40) return 'medium';
    if (score >= 20) return 'low';
    return 'minimal';
  }

  private extractComponents(text: string): any[] {
    const components: any[] = [];
    const componentPatterns = {
      'web-application': /\b(web.*app|frontend|ui|user.*interface)\b/i,
      'api': /\b(api|rest|endpoint|service)\b/i,
      'database': /\b(database|db|mysql|postgres)\b/i,
      'cache': /\b(cache|redis|memcached)\b/i
    };

    for (const [type, pattern] of Object.entries(componentPatterns)) {
      if (pattern.test(text)) {
        components.push({
          id: uuidv4(),
          name: type,
          type: type as any,
          description: `${type} component`,
          technologies: [],
          interfaces: [],
          securityControls: [],
          threats: []
        });
      }
    }

    return components;
  }

  private extractDataFlows(text: string): any[] {
    const flows: any[] = [];
    const flowPattern = /(\w+)\s*(?:sends?|transmits?|to)\s*(\w+)/gi;
    let match;

    while ((match = flowPattern.exec(text)) !== null) {
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

    return flows;
  }

  private extractEntities(text: string): Entity[] {
    const entities: Entity[] = [];
    
    // Extract component entities
    const componentPattern = /\b(api|database|server|frontend|backend)\b/gi;
    let match;
    while ((match = componentPattern.exec(text)) !== null) {
      entities.push({
        type: 'component',
        value: match[1],
        normalized: match[1].toLowerCase(),
        confidence: 0.9
      });
    }

    // Extract threat entities
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

  private classifyIntent(text: string): IntentType {
    const intents: Record<string, RegExp> = {
      'find-threats': /find|identify|detect|discover.*threat/i,
      'assess-risk': /assess|evaluate|analyze.*risk/i,
      'check-compliance': /check|verify|audit.*compliance/i,
      'suggest-controls': /suggest|recommend.*control/i,
      'explain-vulnerability': /explain|describe.*vulnerability/i,
      'generate-report': /generate|create.*report/i
    };

    for (const [intent, pattern] of Object.entries(intents)) {
      if (pattern.test(text)) {
        return intent as IntentType;
      }
    }

    return 'find-threats';
  }

  private getSuggestedActions(intent: IntentType): string[] {
    const actions: Record<IntentType, string[]> = {
      'find-threats': ['Run threat analysis', 'Generate STRIDE analysis'],
      'assess-risk': ['Calculate risk scores', 'Generate risk matrix'],
      'check-compliance': ['Map to framework', 'Identify gaps'],
      'suggest-controls': ['Match controls to threats', 'Prioritize by effectiveness'],
      'explain-vulnerability': ['Provide technical details', 'Show remediation'],
      'generate-report': ['Create executive summary', 'Include recommendations'],
      'analyze-architecture': ['Decompose components', 'Identify data flows'],
      'compare-options': ['Evaluate alternatives', 'Provide recommendations'],
      'get-recommendations': ['Prioritize actions', 'Estimate effort'],
      'troubleshoot-issue': ['Diagnose problem', 'Provide solutions']
    };

    return actions[intent] || ['Analyze security posture'];
  }

  private calculateConfidence(results: NLPResult[]): number {
    if (results.length === 0) return 0;
    
    const totalConfidence = results.reduce((sum, result) => sum + result.confidence, 0);
    return totalConfidence / results.length;
  }
}