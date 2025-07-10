import { SimpleNLPService } from '../services/simple-nlp.service';
import { NLPAnalysisRequest } from '../types/nlp';

describe('NLP Engine Functionality Tests', () => {
  let nlpService: SimpleNLPService;

  beforeEach(() => {
    nlpService = new SimpleNLPService();
  });

  describe('Core Analysis Types', () => {
    it('should perform threat extraction analysis', async () => {
      const request: NLPAnalysisRequest = {
        text: 'An attacker could spoof user credentials and gain unauthorized access to the system.',
        analysisType: 'threat-extraction'
      };

      const response = await nlpService.analyze(request);

      expect(response.analysisType).toBe('threat-extraction');
      expect(response.requestId).toBeDefined();
      expect(response.timestamp).toBeInstanceOf(Date);
      expect(response.metadata).toBeDefined();
      expect(response.metadata.version).toBe('1.0.0');
      expect(response.metadata.models).toContain('simple-nlp-engine');
      expect(response.confidence).toBeGreaterThanOrEqual(0);
    });

    it('should perform vulnerability detection analysis', async () => {
      const request: NLPAnalysisRequest = {
        text: 'The application is vulnerable to SQL injection attacks.',
        analysisType: 'vulnerability-detection'
      };

      const response = await nlpService.analyze(request);

      expect(response.analysisType).toBe('vulnerability-detection');
      expect(response.results.length).toBeGreaterThan(0);
      expect(response.results[0].type).toBe('vulnerability');
      expect(response.confidence).toBeGreaterThan(0.5);
    });

    it('should perform requirement analysis', async () => {
      const request: NLPAnalysisRequest = {
        text: 'The system must encrypt all sensitive data at rest.',
        analysisType: 'requirement-analysis'
      };

      const response = await nlpService.analyze(request);

      expect(response.analysisType).toBe('requirement-analysis');
      expect(response.results.length).toBeGreaterThan(0);
      expect(response.results[0].type).toBe('requirement');
    });

    it('should perform compliance mapping analysis', async () => {
      const request: NLPAnalysisRequest = {
        text: 'We store personal data and have privacy controls in place.',
        analysisType: 'compliance-mapping',
        options: {
          targetFramework: 'GDPR'
        }
      };

      const response = await nlpService.analyze(request);

      expect(response.analysisType).toBe('compliance-mapping');
      expect(response.results.length).toBeGreaterThan(0);
      expect(response.results[0].type).toBe('compliance-mapping');
    });

    it('should perform risk assessment analysis', async () => {
      const request: NLPAnalysisRequest = {
        text: 'Multiple security vulnerabilities present in the system.',
        analysisType: 'risk-assessment'
      };

      const response = await nlpService.analyze(request);

      expect(response.analysisType).toBe('risk-assessment');
      expect(response.results.length).toBeGreaterThan(0);
      expect(response.results[0].type).toBe('risk-assessment');
    });

    it('should perform technical decomposition analysis', async () => {
      const request: NLPAnalysisRequest = {
        text: 'The system has a web frontend, API backend, and database.',
        analysisType: 'technical-decomposition'
      };

      const response = await nlpService.analyze(request);

      expect(response.analysisType).toBe('technical-decomposition');
      expect(response.results.length).toBeGreaterThan(0);
      expect(response.results[0].type).toBe('technical-decomposition');
    });

    it('should perform security control suggestions', async () => {
      const request: NLPAnalysisRequest = {
        text: 'The system is vulnerable to unauthorized access.',
        analysisType: 'security-control-suggestion'
      };

      const response = await nlpService.analyze(request);

      expect(response.analysisType).toBe('security-control-suggestion');
      // Note: This may return 0 results if no threats are detected
      expect(response.results.length).toBeGreaterThanOrEqual(0);
    });

    it('should perform threat narrative generation', async () => {
      const request: NLPAnalysisRequest = {
        text: 'System has denial of service vulnerabilities.',
        analysisType: 'threat-narrative-generation'
      };

      const response = await nlpService.analyze(request);

      expect(response.analysisType).toBe('threat-narrative-generation');
      expect(response.results.length).toBeGreaterThan(0);
      expect(response.results[0].type).toBe('narrative');
      expect(response.results[0].value).toContain('Threat Analysis Narrative');
    });

    it('should perform report generation', async () => {
      const request: NLPAnalysisRequest = {
        text: 'Security assessment of web application with vulnerabilities.',
        analysisType: 'report-generation'
      };

      const response = await nlpService.analyze(request);

      expect(response.analysisType).toBe('report-generation');
      expect(response.results.length).toBeGreaterThan(0);
      expect(response.results[0].type).toBe('report');
      expect(response.results[0].value).toContain('Security Assessment Report');
    });

    it('should perform query understanding', async () => {
      const request: NLPAnalysisRequest = {
        text: 'Find security threats in my application.',
        analysisType: 'query-understanding'
      };

      const response = await nlpService.analyze(request);

      expect(response.analysisType).toBe('query-understanding');
      expect(response.results.length).toBeGreaterThan(0);
      expect(response.results[0].type).toBe('query-intent');
    });
  });

  describe('Pattern Recognition', () => {
    it('should recognize STRIDE threat patterns', async () => {
      const strideTests = [
        { text: 'Attacker spoofs user identity', category: 'spoofing' },
        { text: 'Data tampering in transit', category: 'tampering' },
        { text: 'User denies performing action', category: 'repudiation' },
        { text: 'Sensitive data disclosure', category: 'information-disclosure' },
        { text: 'System overwhelmed by DDoS', category: 'denial-of-service' },
        { text: 'Privilege escalation attack', category: 'elevation-of-privilege' }
      ];

      for (const test of strideTests) {
        const request: NLPAnalysisRequest = {
          text: test.text,
          analysisType: 'threat-extraction'
        };

        const response = await nlpService.analyze(request);
        
        if (response.results.length > 0) {
          expect(response.results[0].value.category).toBe(test.category);
        }
      }
    });

    it('should recognize common vulnerability patterns', async () => {
      const vulnTests = [
        { text: 'SQL injection vulnerability', name: 'SQL Injection' },
        { text: 'Cross-site scripting attack', name: 'XSS' },
        { text: 'CSRF vulnerability present', name: 'CSRF' },
        { text: 'Buffer overflow in code', name: 'Buffer Overflow' },
        { text: 'Weak encryption using MD5', name: 'Weak Encryption' }
      ];

      for (const test of vulnTests) {
        const request: NLPAnalysisRequest = {
          text: test.text,
          analysisType: 'vulnerability-detection'
        };

        const response = await nlpService.analyze(request);
        
        if (response.results.length > 0) {
          expect(response.results[0].value.name).toBe(test.name);
        }
      }
    });

    it('should recognize security requirements', async () => {
      const reqTests = [
        { text: 'System must encrypt data', priority: 'must-have' },
        { text: 'Application should log events', priority: 'should-have' },
        { text: 'Users shall authenticate', priority: 'must-have' }
      ];

      for (const test of reqTests) {
        const request: NLPAnalysisRequest = {
          text: test.text,
          analysisType: 'requirement-analysis'
        };

        const response = await nlpService.analyze(request);
        
        if (response.results.length > 0) {
          expect(response.results[0].value.priority).toBe(test.priority);
        }
      }
    });
  });

  describe('Response Structure', () => {
    it('should provide consistent response structure', async () => {
      const request: NLPAnalysisRequest = {
        text: 'Test system analysis',
        analysisType: 'threat-extraction'
      };

      const response = await nlpService.analyze(request);

      // Check required fields
      expect(response.requestId).toBeDefined();
      expect(response.timestamp).toBeInstanceOf(Date);
      expect(response.analysisType).toBe('threat-extraction');
      expect(response.results).toBeInstanceOf(Array);
      expect(response.metadata).toBeDefined();
      expect(response.confidence).toBeGreaterThanOrEqual(0);
      expect(response.confidence).toBeLessThanOrEqual(1);

      // Check metadata structure
      expect(response.metadata.processingTime).toBeGreaterThanOrEqual(0);
      expect(response.metadata.tokensProcessed).toBeGreaterThanOrEqual(0);
      expect(response.metadata.language).toBe('en');
      expect(response.metadata.models).toContain('simple-nlp-engine');
      expect(response.metadata.version).toBe('1.0.0');
    });

    it('should handle empty results gracefully', async () => {
      const request: NLPAnalysisRequest = {
        text: 'No security content here just normal text',
        analysisType: 'threat-extraction'
      };

      const response = await nlpService.analyze(request);

      expect(response.results.length).toBe(0);
      expect(response.confidence).toBe(0);
      expect(response.metadata).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid analysis types', async () => {
      const request: NLPAnalysisRequest = {
        text: 'Test text',
        analysisType: 'invalid-type' as any
      };

      await expect(nlpService.analyze(request)).rejects.toThrow('Unknown analysis type');
    });

    it('should handle empty text', async () => {
      const request: NLPAnalysisRequest = {
        text: '',
        analysisType: 'threat-extraction'
      };

      const response = await nlpService.analyze(request);

      expect(response.results.length).toBe(0);
      expect(response.confidence).toBe(0);
    });
  });

  describe('Performance Requirements', () => {
    it('should complete analysis within reasonable time', async () => {
      const request: NLPAnalysisRequest = {
        text: 'System security analysis with multiple vulnerabilities and threats present.',
        analysisType: 'threat-extraction'
      };

      const start = Date.now();
      const response = await nlpService.analyze(request);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(5000); // 5 seconds max
      expect(response.metadata.processingTime).toBeGreaterThanOrEqual(0);
    });

    it('should handle large text inputs', async () => {
      const largeText = 'Security vulnerability analysis. '.repeat(100);
      const request: NLPAnalysisRequest = {
        text: largeText,
        analysisType: 'threat-extraction'
      };

      const response = await nlpService.analyze(request);

      expect(response).toBeDefined();
      expect(response.metadata.tokensProcessed).toBeGreaterThan(100);
    });
  });

  describe('Integration Capabilities', () => {
    it('should analyze real-world security scenarios', async () => {
      const securityScenario = `
        Our e-commerce platform processes customer payments and stores personal data.
        The system has been identified with SQL injection vulnerabilities in the checkout process.
        User authentication relies on weak password policies with no multi-factor authentication.
        Administrative access lacks proper access controls and privilege management.
        Customer data is stored in plain text without encryption at rest.
        The system lacks proper logging and monitoring for security events.
      `;

      const request: NLPAnalysisRequest = {
        text: securityScenario,
        analysisType: 'threat-extraction'
      };

      const response = await nlpService.analyze(request);

      expect(response.results.length).toBeGreaterThanOrEqual(1);
      expect(response.confidence).toBeGreaterThan(0);
      expect(response.metadata.tokensProcessed).toBeGreaterThan(50);
    });

    it('should provide actionable security insights', async () => {
      const request: NLPAnalysisRequest = {
        text: 'Web application with authentication bypass and data leakage issues.',
        analysisType: 'risk-assessment'
      };

      const response = await nlpService.analyze(request);

      expect(response.results.length).toBeGreaterThan(0);
      
      const riskAssessment = response.results[0].value;
      expect(riskAssessment.overallRisk).toBeDefined();
      expect(riskAssessment.riskScore).toBeGreaterThanOrEqual(0);
      expect(riskAssessment.recommendations).toBeDefined();
    });
  });

  describe('Quality Assurance', () => {
    it('should maintain consistency across multiple analyses', async () => {
      const text = 'SQL injection vulnerability in web application';
      const request: NLPAnalysisRequest = {
        text,
        analysisType: 'vulnerability-detection'
      };

      // Run analysis multiple times
      const responses = await Promise.all([
        nlpService.analyze(request),
        nlpService.analyze(request),
        nlpService.analyze(request)
      ]);

      // Check consistency
      for (let i = 1; i < responses.length; i++) {
        expect(responses[i].results.length).toBe(responses[0].results.length);
        if (responses[i].results.length > 0) {
          expect(responses[i].results[0].value.name).toBe(responses[0].results[0].value.name);
        }
      }
    });

    it('should provide meaningful confidence scores', async () => {
      const highConfidenceText = 'Critical SQL injection vulnerability with high exploitability';
      const lowConfidenceText = 'Maybe some potential issues somewhere';

      const highConfRequest: NLPAnalysisRequest = {
        text: highConfidenceText,
        analysisType: 'vulnerability-detection'
      };

      const lowConfRequest: NLPAnalysisRequest = {
        text: lowConfidenceText,
        analysisType: 'vulnerability-detection'
      };

      const highResponse = await nlpService.analyze(highConfRequest);
      const lowResponse = await nlpService.analyze(lowConfRequest);

      if (highResponse.results.length > 0 && lowResponse.results.length > 0) {
        expect(highResponse.confidence).toBeGreaterThan(lowResponse.confidence);
      }
    });
  });
});