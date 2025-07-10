import { NLPEngineService } from '../services/nlp-engine.service';
import { Logger } from 'winston';
import {
  NLPAnalysisRequest,
  ExtractedThreat,
  DetectedVulnerability,
  SecurityRequirement,
  ComplianceMapping,
  RiskAssessment,
  TechnicalDecomposition,
  SecurityControlSuggestion,
  QueryIntent
} from '../types/nlp';

// Mock logger
const mockLogger: Logger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
} as any;

describe('NLPEngineService', () => {
  let nlpService: NLPEngineService;

  beforeEach(() => {
    nlpService = new NLPEngineService({
      logger: mockLogger,
      redisUrl: 'redis://localhost:6379'
    });
  });

  describe('Threat Extraction', () => {
    it('should extract threats from security description', async () => {
      const request: NLPAnalysisRequest = {
        text: 'The system is vulnerable to SQL injection attacks when user input is not properly sanitized. An attacker could exploit this to gain unauthorized access to the database.',
        analysisType: 'threat-extraction',
        options: {
          includeConfidenceScores: true,
          includeSuggestions: true
        }
      };

      const response = await nlpService.analyze(request);

      expect(response.analysisType).toBe('threat-extraction');
      expect(response.results.length).toBeGreaterThan(0);
      
      const threat = response.results[0].value as ExtractedThreat;
      expect(threat).toHaveProperty('name');
      expect(threat).toHaveProperty('category');
      expect(threat).toHaveProperty('attackVector');
      expect(threat.category).toBe('tampering');
      expect(response.confidence).toBeGreaterThan(0.5);
    });

    it('should identify STRIDE threats correctly', async () => {
      const request: NLPAnalysisRequest = {
        text: 'An attacker could spoof the authentication system and impersonate legitimate users. They might also tamper with data in transit.',
        analysisType: 'threat-extraction'
      };

      const response = await nlpService.analyze(request);
      const threats = response.results.map(r => r.value as ExtractedThreat);
      
      const spoofingThreat = threats.find(t => t.category === 'spoofing');
      const tamperingThreat = threats.find(t => t.category === 'tampering');
      
      expect(spoofingThreat).toBeDefined();
      expect(tamperingThreat).toBeDefined();
      expect(spoofingThreat?.stride).toContain('S');
      expect(tamperingThreat?.stride).toContain('T');
    });

    it('should provide mitigation suggestions', async () => {
      const request: NLPAnalysisRequest = {
        text: 'Cross-site scripting vulnerabilities allow attackers to inject malicious scripts',
        analysisType: 'threat-extraction',
        options: {
          includeSuggestions: true
        }
      };

      const response = await nlpService.analyze(request);
      
      expect(response.suggestions).toBeDefined();
      expect(response.suggestions?.length).toBeGreaterThan(0);
      
      const threat = response.results[0].value as ExtractedThreat;
      expect(threat.mitigations.length).toBeGreaterThan(0);
    });
  });

  describe('Vulnerability Detection', () => {
    it('should detect common vulnerabilities', async () => {
      const request: NLPAnalysisRequest = {
        text: 'The application uses MD5 hashing for passwords and has hardcoded credentials in the configuration file.',
        analysisType: 'vulnerability-detection'
      };

      const response = await nlpService.analyze(request);
      const vulnerabilities = response.results.map(r => r.value as DetectedVulnerability);
      
      expect(vulnerabilities.length).toBeGreaterThanOrEqual(2);
      
      const weakEncryption = vulnerabilities.find(v => v.name === 'Weak Encryption');
      const hardcodedCreds = vulnerabilities.find(v => v.name === 'Hardcoded Credentials');
      
      expect(weakEncryption).toBeDefined();
      expect(hardcodedCreds).toBeDefined();
      expect(weakEncryption?.severity).toBe('high');
    });

    it('should provide CWE and OWASP mappings', async () => {
      const request: NLPAnalysisRequest = {
        text: 'SQL injection vulnerability in the login form',
        analysisType: 'vulnerability-detection'
      };

      const response = await nlpService.analyze(request);
      const vuln = response.results[0].value as DetectedVulnerability;
      
      expect(vuln.cwe).toBe('CWE-89');
      expect(vuln.owasp).toBe('A03:2021');
      expect(vuln.references.length).toBeGreaterThan(0);
    });

    it('should calculate exploitability scores', async () => {
      const request: NLPAnalysisRequest = {
        text: 'Buffer overflow in the image processing module',
        analysisType: 'vulnerability-detection'
      };

      const response = await nlpService.analyze(request);
      const vuln = response.results[0].value as DetectedVulnerability;
      
      expect(vuln.exploitability).toBeGreaterThan(0);
      expect(vuln.exploitability).toBeLessThanOrEqual(1);
    });
  });

  describe('Requirement Analysis', () => {
    it('should extract security requirements', async () => {
      const request: NLPAnalysisRequest = {
        text: 'The system must encrypt all data at rest. Users shall be authenticated using multi-factor authentication. The application should log all security events.',
        analysisType: 'requirement-analysis'
      };

      const response = await nlpService.analyze(request);
      const requirements = response.results.map(r => r.value as SecurityRequirement);
      
      expect(requirements.length).toBeGreaterThanOrEqual(3);
      
      const encryptionReq = requirements.find(r => r.text.includes('encrypt'));
      const authReq = requirements.find(r => r.text.includes('authenticated'));
      const loggingReq = requirements.find(r => r.text.includes('log'));
      
      expect(encryptionReq?.priority).toBe('must-have');
      expect(authReq?.priority).toBe('must-have');
      expect(loggingReq?.priority).toBe('should-have');
    });

    it('should determine testability and measurability', async () => {
      const request: NLPAnalysisRequest = {
        text: 'Response time must be less than 200ms for 95% of requests',
        analysisType: 'requirement-analysis'
      };

      const response = await nlpService.analyze(request);
      const req = response.results[0].value as SecurityRequirement;
      
      expect(req.testable).toBe(true);
      expect(req.measurable).toBe(true);
      expect(req.verificationCriteria.length).toBeGreaterThan(0);
    });
  });

  describe('Compliance Mapping', () => {
    it('should map requirements to compliance frameworks', async () => {
      const request: NLPAnalysisRequest = {
        text: 'Personal data must be encrypted and users must have the right to access and delete their data. Regular security audits are required.',
        analysisType: 'compliance-mapping',
        options: {
          targetFramework: 'GDPR'
        }
      };

      const response = await nlpService.analyze(request);
      const mapping = response.results[0].value as ComplianceMapping;
      
      expect(mapping.framework).toBe('GDPR');
      expect(mapping.coverage).toBeGreaterThan(0);
      expect(mapping.requirements.length).toBeGreaterThan(0);
    });

    it('should identify compliance gaps', async () => {
      const request: NLPAnalysisRequest = {
        text: 'We store user data but do not have a data retention policy',
        analysisType: 'compliance-mapping',
        options: {
          targetFramework: 'GDPR'
        }
      };

      const response = await nlpService.analyze(request);
      const mapping = response.results[0].value as ComplianceMapping;
      
      expect(mapping.gaps.length).toBeGreaterThan(0);
      expect(mapping.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('Risk Assessment', () => {
    it('should perform comprehensive risk assessment', async () => {
      const request: NLPAnalysisRequest = {
        text: 'Critical SQL injection vulnerability with high likelihood of exploitation. Weak authentication mechanisms. No encryption for sensitive data.',
        analysisType: 'risk-assessment'
      };

      const response = await nlpService.analyze(request);
      const assessment = response.results[0].value as RiskAssessment;
      
      expect(assessment.overallRisk).toBeDefined();
      expect(assessment.riskScore).toBeGreaterThan(50);
      expect(assessment.riskFactors.length).toBeGreaterThan(0);
      expect(assessment.riskMatrix.length).toBeGreaterThan(0);
      expect(assessment.recommendations.length).toBeGreaterThan(0);
    });

    it('should calculate risk scores accurately', async () => {
      const request: NLPAnalysisRequest = {
        text: 'Low impact vulnerability with minimal likelihood of exploitation',
        analysisType: 'risk-assessment'
      };

      const response = await nlpService.analyze(request);
      const assessment = response.results[0].value as RiskAssessment;
      
      expect(assessment.overallRisk).toMatch(/low|minimal/);
      expect(assessment.riskScore).toBeLessThan(40);
    });
  });

  describe('Technical Decomposition', () => {
    it('should decompose technical architecture', async () => {
      const request: NLPAnalysisRequest = {
        text: 'The system consists of a React frontend, Node.js API, PostgreSQL database, and Redis cache. The frontend communicates with the API over HTTPS.',
        analysisType: 'technical-decomposition'
      };

      const response = await nlpService.analyze(request);
      const decomposition = response.results[0].value as TechnicalDecomposition;
      
      expect(decomposition.architecture.length).toBeGreaterThanOrEqual(4);
      expect(decomposition.dataFlows.length).toBeGreaterThan(0);
      expect(decomposition.trustBoundaries.length).toBeGreaterThan(0);
      
      const frontend = decomposition.architecture.find(c => c.type === 'web-application');
      const api = decomposition.architecture.find(c => c.type === 'api');
      const database = decomposition.architecture.find(c => c.type === 'database');
      
      expect(frontend).toBeDefined();
      expect(api).toBeDefined();
      expect(database).toBeDefined();
    });

    it('should identify data flows and trust boundaries', async () => {
      const request: NLPAnalysisRequest = {
        text: 'User data flows from the mobile app to the API gateway, then to the backend service',
        analysisType: 'technical-decomposition'
      };

      const response = await nlpService.analyze(request);
      const decomposition = response.results[0].value as TechnicalDecomposition;
      
      expect(decomposition.dataFlows.length).toBeGreaterThan(0);
      const flow = decomposition.dataFlows[0];
      expect(flow.encryption).toBe(true);
      expect(flow.authentication).toBe(true);
    });
  });

  describe('Security Control Suggestions', () => {
    it('should suggest appropriate security controls', async () => {
      const request: NLPAnalysisRequest = {
        text: 'System vulnerable to unauthorized access and data breaches',
        analysisType: 'security-control-suggestion'
      };

      const response = await nlpService.analyze(request);
      const suggestions = response.results.map(r => r.value as SecurityControlSuggestion);
      
      expect(suggestions.length).toBeGreaterThan(0);
      
      const accessControl = suggestions.find(s => s.control.category === 'access-control');
      expect(accessControl).toBeDefined();
      expect(accessControl?.effectiveness).toBeGreaterThan(70);
    });

    it('should estimate implementation effort and cost', async () => {
      const request: NLPAnalysisRequest = {
        text: 'Need to implement encryption for data at rest',
        analysisType: 'security-control-suggestion'
      };

      const response = await nlpService.analyze(request);
      const suggestion = response.results[0].value as SecurityControlSuggestion;
      
      expect(suggestion.implementationEffort).toBeDefined();
      expect(suggestion.costEstimate).toBeDefined();
      expect(suggestion.complianceAlignment.length).toBeGreaterThan(0);
    });
  });

  describe('Threat Narrative Generation', () => {
    it('should generate comprehensive threat narratives', async () => {
      const request: NLPAnalysisRequest = {
        text: 'E-commerce platform with payment processing',
        analysisType: 'threat-narrative-generation'
      };

      const response = await nlpService.analyze(request);
      const narrative = response.results[0].value as string;
      
      expect(narrative).toBeDefined();
      expect(narrative.length).toBeGreaterThan(100);
      expect(narrative).toContain('Threat Analysis Narrative');
    });
  });

  describe('Report Generation', () => {
    it('should generate security reports', async () => {
      const request: NLPAnalysisRequest = {
        text: 'Web application with authentication issues and SQL injection vulnerabilities',
        analysisType: 'report-generation',
        options: {
          reportType: 'threat-assessment',
          format: 'markdown',
          audience: 'technical'
        }
      };

      const response = await nlpService.analyze(request);
      const report = response.results[0].value as string;
      
      expect(report).toBeDefined();
      expect(report).toContain('Executive Summary');
      expect(report).toContain('Threat Analysis');
      expect(report).toContain('Vulnerability Assessment');
      expect(report).toContain('Recommendations');
    });
  });

  describe('Query Understanding', () => {
    it('should understand user queries and intents', async () => {
      const request: NLPAnalysisRequest = {
        text: 'Find all SQL injection threats in my API',
        analysisType: 'query-understanding'
      };

      const response = await nlpService.analyze(request);
      const intent = response.results[0].value as QueryIntent;
      
      expect(intent.intent).toBe('find-threats');
      expect(intent.entities.length).toBeGreaterThan(0);
      
      const threatEntity = intent.entities.find(e => e.type === 'threat');
      const componentEntity = intent.entities.find(e => e.type === 'component');
      
      expect(threatEntity?.value).toContain('sql injection');
      expect(componentEntity?.value).toBe('api');
      expect(intent.suggestedActions.length).toBeGreaterThan(0);
    });

    it('should identify when clarification is needed', async () => {
      const request: NLPAnalysisRequest = {
        text: 'Check compliance',
        analysisType: 'query-understanding'
      };

      const response = await nlpService.analyze(request);
      const intent = response.results[0].value as QueryIntent;
      
      expect(intent.clarificationNeeded).toBeDefined();
      expect(intent.clarificationNeeded?.length).toBeGreaterThan(0);
      expect(intent.clarificationNeeded?.[0]).toContain('framework');
    });
  });

  describe('Performance and Caching', () => {
    it('should cache analysis results', async () => {
      const request: NLPAnalysisRequest = {
        text: 'Test caching functionality',
        analysisType: 'threat-extraction'
      };

      // First call
      const start1 = Date.now();
      const response1 = await nlpService.analyze(request);
      const time1 = Date.now() - start1;

      // Second call (should be cached)
      const start2 = Date.now();
      const response2 = await nlpService.analyze(request);
      const time2 = Date.now() - start2;

      expect(response1.requestId).not.toBe(response2.requestId);
      expect(time2).toBeLessThan(time1 * 0.5); // Cached call should be much faster
    });
  });

  describe('Multi-language Support', () => {
    it('should handle different confidence levels', async () => {
      const request: NLPAnalysisRequest = {
        text: 'Maybe there could be some security issues',
        analysisType: 'threat-extraction'
      };

      const response = await nlpService.analyze(request);
      
      expect(response.confidence).toBeLessThan(0.7);
      expect(response.suggestions?.some(s => s.type === 'clarification')).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty text gracefully', async () => {
      const request: NLPAnalysisRequest = {
        text: '',
        analysisType: 'threat-extraction'
      };

      const response = await nlpService.analyze(request);
      
      expect(response.results.length).toBe(0);
      expect(response.confidence).toBe(0);
    });

    it('should handle very long text', async () => {
      const longText = 'Security vulnerability '.repeat(1000);
      const request: NLPAnalysisRequest = {
        text: longText,
        analysisType: 'threat-extraction'
      };

      const response = await nlpService.analyze(request);
      
      expect(response).toBeDefined();
      expect(response.metadata.tokensProcessed).toBeGreaterThan(1000);
    });

    it('should handle invalid analysis types', async () => {
      const request: NLPAnalysisRequest = {
        text: 'Test text',
        analysisType: 'invalid-type' as any
      };

      await expect(nlpService.analyze(request)).rejects.toThrow('Unknown analysis type');
    });
  });

  describe('Integration Scenarios', () => {
    it('should analyze complete threat model descriptions', async () => {
      const threatModelText = `
        Our e-commerce platform handles payment card data and personal information.
        Users authenticate with username and password. The system stores credit card
        information in a database. There is no encryption at rest. The admin panel
        has weak authentication. SQL queries are built using string concatenation.
      `;

      const request: NLPAnalysisRequest = {
        text: threatModelText,
        analysisType: 'threat-extraction',
        options: {
          includeConfidenceScores: true,
          includeSuggestions: true,
          includeExplanations: true
        }
      };

      const response = await nlpService.analyze(request);
      
      expect(response.results.length).toBeGreaterThan(3);
      expect(response.suggestions?.length).toBeGreaterThan(0);
      
      // Should identify multiple threat categories
      const threats = response.results.map(r => (r.value as ExtractedThreat).category);
      expect(threats).toContain('information-disclosure');
      expect(threats).toContain('tampering');
      expect(threats).toContain('elevation-of-privilege');
    });

    it('should provide actionable security recommendations', async () => {
      const systemDescription = `
        Mobile banking application with biometric authentication.
        Uses REST API over HTTPS. Stores session tokens locally.
        Implements certificate pinning. No jailbreak detection.
      `;

      // First analyze threats
      const threatRequest: NLPAnalysisRequest = {
        text: systemDescription,
        analysisType: 'threat-extraction'
      };
      const threatResponse = await nlpService.analyze(threatRequest);

      // Then get control suggestions
      const controlRequest: NLPAnalysisRequest = {
        text: systemDescription,
        analysisType: 'security-control-suggestion'
      };
      const controlResponse = await nlpService.analyze(controlRequest);

      // Finally assess risk
      const riskRequest: NLPAnalysisRequest = {
        text: systemDescription,
        analysisType: 'risk-assessment'
      };
      const riskResponse = await nlpService.analyze(riskRequest);

      expect(threatResponse.results.length).toBeGreaterThan(0);
      expect(controlResponse.results.length).toBeGreaterThan(0);
      expect(riskResponse.results.length).toBeGreaterThan(0);

      const riskAssessment = riskResponse.results[0].value as RiskAssessment;
      expect(riskAssessment.recommendations.length).toBeGreaterThan(0);
    });
  });
});