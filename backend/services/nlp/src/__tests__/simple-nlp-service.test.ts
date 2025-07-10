import { SimpleNLPService } from '../services/simple-nlp.service';
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

describe('SimpleNLPService', () => {
  let nlpService: SimpleNLPService;

  beforeEach(() => {
    nlpService = new SimpleNLPService();
  });

  describe('Threat Extraction', () => {
    it('should extract SQL injection threats', async () => {
      const request: NLPAnalysisRequest = {
        text: 'The system is vulnerable to SQL injection attacks when user input is not properly sanitized.',
        analysisType: 'threat-extraction'
      };

      const response = await nlpService.analyze(request);

      expect(response.analysisType).toBe('threat-extraction');
      expect(response.results.length).toBeGreaterThan(0);
      expect(response.confidence).toBeGreaterThan(0.5);
      
      const threat = response.results[0].value as ExtractedThreat;
      expect(threat.category).toBe('tampering');
      expect(threat.stride).toContain('T');
      expect(threat.mitigations.length).toBeGreaterThan(0);
    });

    it('should extract spoofing threats', async () => {
      const request: NLPAnalysisRequest = {
        text: 'An attacker could spoof the authentication system and impersonate legitimate users.',
        analysisType: 'threat-extraction'
      };

      const response = await nlpService.analyze(request);
      const threat = response.results[0].value as ExtractedThreat;
      
      expect(threat.category).toBe('spoofing');
      expect(threat.stride).toContain('S');
      expect(threat.attackVector).toBeDefined();
    });

    it('should extract denial of service threats', async () => {
      const request: NLPAnalysisRequest = {
        text: 'The system could be overwhelmed by a DDoS attack causing service outages.',
        analysisType: 'threat-extraction'
      };

      const response = await nlpService.analyze(request);
      const threat = response.results[0].value as ExtractedThreat;
      
      expect(threat.category).toBe('denial-of-service');
      expect(threat.stride).toContain('D');
    });

    it('should extract multiple threats from complex text', async () => {
      const request: NLPAnalysisRequest = {
        text: 'The application has SQL injection vulnerabilities and attackers can spoof user identities. Data tampering is also possible.',
        analysisType: 'threat-extraction'
      };

      const response = await nlpService.analyze(request);
      
      expect(response.results.length).toBeGreaterThanOrEqual(2);
      const categories = response.results.map(r => (r.value as ExtractedThreat).category);
      expect(categories).toContain('spoofing');
      expect(categories).toContain('tampering');
    });
  });

  describe('Vulnerability Detection', () => {
    it('should detect SQL injection vulnerabilities', async () => {
      const request: NLPAnalysisRequest = {
        text: 'The application is vulnerable to SQL injection in the login form.',
        analysisType: 'vulnerability-detection'
      };

      const response = await nlpService.analyze(request);
      const vuln = response.results[0].value as DetectedVulnerability;
      
      expect(vuln.name).toBe('SQL Injection');
      expect(vuln.severity).toBe('critical');
      expect(vuln.cwe).toBe('CWE-89');
      expect(vuln.owasp).toBe('A03:2021');
    });

    it('should detect XSS vulnerabilities', async () => {
      const request: NLPAnalysisRequest = {
        text: 'Cross-site scripting vulnerabilities allow attackers to inject malicious scripts.',
        analysisType: 'vulnerability-detection'
      };

      const response = await nlpService.analyze(request);
      const vuln = response.results[0].value as DetectedVulnerability;
      
      expect(vuln.name).toBe('XSS');
      expect(vuln.severity).toBe('high');
      expect(vuln.cwe).toBe('CWE-79');
    });

    it('should detect weak encryption', async () => {
      const request: NLPAnalysisRequest = {
        text: 'The system uses MD5 for password hashing which is weak encryption.',
        analysisType: 'vulnerability-detection'
      };

      const response = await nlpService.analyze(request);
      const vuln = response.results[0].value as DetectedVulnerability;
      
      expect(vuln.name).toBe('Weak Encryption');
      expect(vuln.severity).toBe('high');
      expect(vuln.remediation).toContain('strong encryption');
    });

    it('should detect hardcoded credentials', async () => {
      const request: NLPAnalysisRequest = {
        text: 'The application has hardcoded passwords in the configuration file.',
        analysisType: 'vulnerability-detection'
      };

      const response = await nlpService.analyze(request);
      const vuln = response.results[0].value as DetectedVulnerability;
      
      expect(vuln.name).toBe('Hardcoded Credentials');
      expect(vuln.severity).toBe('critical');
    });
  });

  describe('Requirement Analysis', () => {
    it('should extract must-have requirements', async () => {
      const request: NLPAnalysisRequest = {
        text: 'The system must encrypt all data at rest using AES-256.',
        analysisType: 'requirement-analysis'
      };

      const response = await nlpService.analyze(request);
      const req = response.results[0].value as SecurityRequirement;
      
      expect(req.priority).toBe('must-have');
      expect(req.text).toContain('must encrypt');
      expect(req.measurable).toBe(true); // Contains "256"
    });

    it('should extract should-have requirements', async () => {
      const request: NLPAnalysisRequest = {
        text: 'The application should log all authentication attempts.',
        analysisType: 'requirement-analysis'
      };

      const response = await nlpService.analyze(request);
      const req = response.results[0].value as SecurityRequirement;
      
      expect(req.priority).toBe('should-have');
      expect(req.testable).toBe(false);
    });

    it('should detect testable requirements', async () => {
      const request: NLPAnalysisRequest = {
        text: 'The system shall verify user identity before granting access.',
        analysisType: 'requirement-analysis'
      };

      const response = await nlpService.analyze(request);
      const req = response.results[0].value as SecurityRequirement;
      
      expect(req.priority).toBe('must-have');
      expect(req.testable).toBe(true); // Contains "verify"
    });
  });

  describe('Compliance Mapping', () => {
    it('should map GDPR compliance', async () => {
      const request: NLPAnalysisRequest = {
        text: 'We process personal data of users and have data protection measures in place.',
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

    it('should map HIPAA compliance', async () => {
      const request: NLPAnalysisRequest = {
        text: 'The system stores medical records and patient health information.',
        analysisType: 'compliance-mapping',
        options: {
          targetFramework: 'HIPAA'
        }
      };

      const response = await nlpService.analyze(request);
      const mapping = response.results[0].value as ComplianceMapping;
      
      expect(mapping.framework).toBe('HIPAA');
      expect(mapping.coverage).toBeGreaterThan(0);
    });

    it('should identify compliance gaps', async () => {
      const request: NLPAnalysisRequest = {
        text: 'We store data but have no specific protection measures.',
        analysisType: 'compliance-mapping',
        options: {
          targetFramework: 'GDPR'
        }
      };

      const response = await nlpService.analyze(request);
      const mapping = response.results[0].value as ComplianceMapping;
      
      expect(mapping.coverage).toBeLessThan(80);
      expect(mapping.gaps.length).toBeGreaterThan(0);
      expect(mapping.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('Risk Assessment', () => {
    it('should assess risk with multiple threats', async () => {
      const request: NLPAnalysisRequest = {
        text: 'Critical SQL injection vulnerability and weak authentication. No encryption for sensitive data.',
        analysisType: 'risk-assessment'
      };

      const response = await nlpService.analyze(request);
      const assessment = response.results[0].value as RiskAssessment;
      
      expect(assessment.overallRisk).toBeDefined();
      expect(assessment.riskScore).toBeGreaterThan(0);
      expect(assessment.riskFactors.length).toBeGreaterThan(0);
      expect(assessment.recommendations.length).toBeGreaterThan(0);
    });

    it('should calculate appropriate risk levels', async () => {
      const request: NLPAnalysisRequest = {
        text: 'Minor security issue with low impact.',
        analysisType: 'risk-assessment'
      };

      const response = await nlpService.analyze(request);
      const assessment = response.results[0].value as RiskAssessment;
      
      expect(['low', 'minimal']).toContain(assessment.overallRisk);
      expect(assessment.riskScore).toBeLessThan(60);
    });

    it('should provide risk recommendations', async () => {
      const request: NLPAnalysisRequest = {
        text: 'Multiple security vulnerabilities including SQL injection and XSS.',
        analysisType: 'risk-assessment'
      };

      const response = await nlpService.analyze(request);
      const assessment = response.results[0].value as RiskAssessment;
      
      expect(assessment.recommendations.length).toBeGreaterThan(0);
      expect(assessment.recommendations[0].action).toBeDefined();
      expect(assessment.recommendations[0].riskReduction).toBeGreaterThan(0);
    });
  });

  describe('Technical Decomposition', () => {
    it('should decompose web application architecture', async () => {
      const request: NLPAnalysisRequest = {
        text: 'The system consists of a web application frontend, REST API, and database backend.',
        analysisType: 'technical-decomposition'
      };

      const response = await nlpService.analyze(request);
      const decomposition = response.results[0].value as TechnicalDecomposition;
      
      expect(decomposition.architecture.length).toBeGreaterThan(0);
      expect(decomposition.trustBoundaries.length).toBeGreaterThan(0);
      expect(decomposition.attackSurface.length).toBeGreaterThan(0);
    });

    it('should identify data flows', async () => {
      const request: NLPAnalysisRequest = {
        text: 'User data flows from frontend to API then to database.',
        analysisType: 'technical-decomposition'
      };

      const response = await nlpService.analyze(request);
      const decomposition = response.results[0].value as TechnicalDecomposition;
      
      expect(decomposition.dataFlows.length).toBeGreaterThan(0);
      expect(decomposition.dataFlows[0].encryption).toBe(true);
    });
  });

  describe('Security Control Suggestions', () => {
    it('should suggest controls for identified threats', async () => {
      const request: NLPAnalysisRequest = {
        text: 'System vulnerable to spoofing attacks and data tampering.',
        analysisType: 'security-control-suggestion'
      };

      const response = await nlpService.analyze(request);
      
      expect(response.results.length).toBeGreaterThan(0);
      const suggestion = response.results[0].value as SecurityControlSuggestion;
      
      expect(suggestion.control).toBeDefined();
      expect(suggestion.effectiveness).toBeGreaterThan(0);
      expect(suggestion.implementationEffort).toBeDefined();
      expect(suggestion.costEstimate).toBeDefined();
    });

    it('should provide implementation guidance', async () => {
      const request: NLPAnalysisRequest = {
        text: 'Need to implement access controls for elevation of privilege threats.',
        analysisType: 'security-control-suggestion'
      };

      const response = await nlpService.analyze(request);
      const suggestion = response.results[0].value as SecurityControlSuggestion;
      
      expect(suggestion.control.implementation).toBeDefined();
      expect(suggestion.control.verification).toBeDefined();
      expect(suggestion.complianceAlignment.length).toBeGreaterThan(0);
    });
  });

  describe('Threat Narrative Generation', () => {
    it('should generate comprehensive threat narratives', async () => {
      const request: NLPAnalysisRequest = {
        text: 'E-commerce platform with SQL injection and weak authentication.',
        analysisType: 'threat-narrative-generation'
      };

      const response = await nlpService.analyze(request);
      const narrative = response.results[0].value as string;
      
      expect(narrative).toContain('Threat Analysis Narrative');
      expect(narrative.length).toBeGreaterThan(100);
      expect(narrative).toContain('Recommendations');
    });

    it('should include threat details in narrative', async () => {
      const request: NLPAnalysisRequest = {
        text: 'System vulnerable to denial of service attacks.',
        analysisType: 'threat-narrative-generation'
      };

      const response = await nlpService.analyze(request);
      const narrative = response.results[0].value as string;
      
      expect(narrative).toContain('denial-of-service');
      expect(narrative).toContain('Likelihood');
      expect(narrative).toContain('Impact');
    });
  });

  describe('Report Generation', () => {
    it('should generate security assessment reports', async () => {
      const request: NLPAnalysisRequest = {
        text: 'Web application with SQL injection vulnerabilities and weak encryption.',
        analysisType: 'report-generation'
      };

      const response = await nlpService.analyze(request);
      const report = response.results[0].value as string;
      
      expect(report).toContain('Security Assessment Report');
      expect(report).toContain('Executive Summary');
      expect(report).toContain('Threat Analysis');
      expect(report).toContain('Vulnerability Assessment');
      expect(report).toContain('Recommendations');
    });

    it('should include findings count in report', async () => {
      const request: NLPAnalysisRequest = {
        text: 'Multiple security issues including XSS and CSRF vulnerabilities.',
        analysisType: 'report-generation'
      };

      const response = await nlpService.analyze(request);
      const report = response.results[0].value as string;
      
      expect(report).toMatch(/Threats Identified:\s*\d+/);
      expect(report).toMatch(/Vulnerabilities Found:\s*\d+/);
    });
  });

  describe('Query Understanding', () => {
    it('should understand threat finding queries', async () => {
      const request: NLPAnalysisRequest = {
        text: 'Find all SQL injection threats in my API',
        analysisType: 'query-understanding'
      };

      const response = await nlpService.analyze(request);
      const intent = response.results[0].value as QueryIntent;
      
      expect(intent.intent).toBe('find-threats');
      expect(intent.entities.length).toBeGreaterThan(0);
      expect(intent.suggestedActions.length).toBeGreaterThan(0);
    });

    it('should understand risk assessment queries', async () => {
      const request: NLPAnalysisRequest = {
        text: 'Assess the security risk of my application',
        analysisType: 'query-understanding'
      };

      const response = await nlpService.analyze(request);
      const intent = response.results[0].value as QueryIntent;
      
      expect(intent.intent).toBe('assess-risk');
      expect(intent.context.domain).toBe('security');
    });

    it('should identify when clarification is needed', async () => {
      const request: NLPAnalysisRequest = {
        text: 'Check my system',
        analysisType: 'query-understanding'
      };

      const response = await nlpService.analyze(request);
      const intent = response.results[0].value as QueryIntent;
      
      expect(intent.clarificationNeeded).toBeDefined();
      expect(intent.clarificationNeeded?.length).toBeGreaterThan(0);
    });

    it('should extract relevant entities', async () => {
      const request: NLPAnalysisRequest = {
        text: 'Check for XSS vulnerabilities in the frontend API',
        analysisType: 'query-understanding'
      };

      const response = await nlpService.analyze(request);
      const intent = response.results[0].value as QueryIntent;
      
      const threatEntity = intent.entities.find(e => e.type === 'threat');
      const componentEntity = intent.entities.find(e => e.type === 'component');
      
      expect(threatEntity?.value).toBe('xss');
      expect(componentEntity?.value).toBe('api');
    });
  });

  describe('Performance and Metadata', () => {
    it('should provide processing metadata', async () => {
      const request: NLPAnalysisRequest = {
        text: 'Test metadata collection functionality',
        analysisType: 'threat-extraction'
      };

      const response = await nlpService.analyze(request);
      
      expect(response.metadata.processingTime).toBeGreaterThan(0);
      expect(response.metadata.tokensProcessed).toBeGreaterThan(0);
      expect(response.metadata.language).toBe('en');
      expect(response.metadata.models).toContain('simple-nlp-engine');
      expect(response.metadata.version).toBe('1.0.0');
    });

    it('should calculate confidence scores', async () => {
      const request: NLPAnalysisRequest = {
        text: 'Clear SQL injection vulnerability present',
        analysisType: 'threat-extraction'
      };

      const response = await nlpService.analyze(request);
      
      expect(response.confidence).toBeGreaterThan(0.7);
      expect(response.results[0].confidence).toBeGreaterThan(0.8);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty text gracefully', async () => {
      const request: NLPAnalysisRequest = {
        text: '',
        analysisType: 'threat-extraction'
      };

      const response = await nlpService.analyze(request);
      
      expect(response.results.length).toBe(0);
      expect(response.confidence).toBe(0);
    });

    it('should handle unknown analysis types', async () => {
      const request: NLPAnalysisRequest = {
        text: 'Test text',
        analysisType: 'invalid-type' as any
      };

      await expect(nlpService.analyze(request)).rejects.toThrow('Unknown analysis type');
    });

    it('should handle text with no security content', async () => {
      const request: NLPAnalysisRequest = {
        text: 'This is just normal text about weather and cooking.',
        analysisType: 'threat-extraction'
      };

      const response = await nlpService.analyze(request);
      
      expect(response.results.length).toBe(0);
    });
  });

  describe('Integration Scenarios', () => {
    it('should analyze complete threat model descriptions', async () => {
      const threatModelText = `
        Our e-commerce platform handles payment processing and stores customer data.
        The system has SQL injection vulnerabilities in the checkout process.
        Users authenticate with weak passwords and there's no multi-factor authentication.
        The admin panel is vulnerable to privilege escalation attacks.
        Personal data is stored without encryption.
      `;

      const request: NLPAnalysisRequest = {
        text: threatModelText,
        analysisType: 'threat-extraction'
      };

      const response = await nlpService.analyze(request);
      
      expect(response.results.length).toBeGreaterThanOrEqual(2);
      
      const categories = response.results.map(r => (r.value as ExtractedThreat).category);
      expect(categories).toContain('tampering'); // SQL injection
      expect(categories).toContain('elevation-of-privilege'); // Privilege escalation
    });

    it('should provide comprehensive security analysis', async () => {
      const systemDescription = `
        Web application with user authentication, data storage, and API endpoints.
        Known vulnerabilities include XSS in user comments and weak session management.
        The system processes personal data but lacks proper encryption.
        Administrative access is not properly controlled.
      `;

      // Test multiple analysis types
      const analysisTypes = ['threat-extraction', 'vulnerability-detection', 'risk-assessment'];
      
      for (const analysisType of analysisTypes) {
        const request: NLPAnalysisRequest = {
          text: systemDescription,
          analysisType: analysisType as any
        };

        const response = await nlpService.analyze(request);
        expect(response.results.length).toBeGreaterThan(0);
        expect(response.confidence).toBeGreaterThan(0.5);
      }
    });
  });
});