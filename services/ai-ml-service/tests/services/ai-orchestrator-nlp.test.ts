import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals';
import { AIOrchestrator } from '../../src/services/ai-orchestrator.service';
import { AnalysisRequest, AnalysisResponse, AnalysisOptions } from '../../src/types';

describe('AI Orchestrator NLP Integration Tests', () => {
  let orchestrator: AIOrchestrator;

  beforeEach(async () => {
    orchestrator = new AIOrchestrator();
    await orchestrator.initialize();
  });

  afterEach(async () => {
    await orchestrator.shutdown();
  });

  it('should include NLP analysis when option is enabled', async () => {
    const request: AnalysisRequest = {
      projectId: 'test-project-123',
      components: [
        {
          id: 'comp-1',
          type: 'Web Server',
          description: 'Public-facing web server handling user authentication. Potential SQL injection vulnerability in login form.',
        },
        {
          id: 'comp-2',
          type: 'Database',
          description: 'MySQL database storing user credentials and sensitive financial data.',
        },
      ],
      threatModel: {
        description: 'E-commerce platform with payment processing. Critical security concerns around data protection and PCI compliance.',
      },
      options: {
        includeNLPAnalysis: true,
        includePatternRecognition: true,
        includeVulnerabilityPrediction: true,
      },
    };

    const response: AnalysisResponse = await orchestrator.analyze(request);

    expect(response).toBeDefined();
    expect(response.success).toBe(true);
    expect(response.analysis).toBeDefined();
    expect(response.analysis.nlpAnalysis).toBeDefined();

    // Check NLP enhancements
    const nlpAnalysis = response.analysis.nlpAnalysis;
    expect(nlpAnalysis.entities).toBeDefined();
    expect(nlpAnalysis.entities.length).toBeGreaterThan(0);
    expect(nlpAnalysis.sentimentScore).toBeDefined();
    expect(nlpAnalysis.threatClassifications).toBeDefined();
    expect(nlpAnalysis.extractedIndicators).toBeDefined();
  });

  it('should enhance threats with NLP insights', async () => {
    const request: AnalysisRequest = {
      projectId: 'test-project-456',
      components: [
        {
          id: 'api-gateway',
          type: 'API Gateway',
          description: 'REST API exposed to internet. Authentication using JWT tokens. Observed suspicious traffic from IP 192.168.1.100',
        },
      ],
      options: {
        includeNLPAnalysis: true,
        includeThreatIntelligence: true,
      },
    };

    const response = await orchestrator.analyze(request);

    // Check that threats are enhanced with NLP data
    const threats = response.analysis.threats;
    expect(threats).toBeDefined();
    expect(threats.length).toBeGreaterThan(0);

    // Look for threats with NLP enhancements
    const enhancedThreat = threats.find((t: any) => t.nlpClassifications);
    if (enhancedThreat) {
      expect(enhancedThreat.nlpClassifications).toBeDefined();
      expect(enhancedThreat.evidence).toContainEqual(
        expect.objectContaining({
          source: 'NLP Entity Extraction',
        })
      );
    }
  });

  it('should extract IOCs and include them in analysis', async () => {
    const request: AnalysisRequest = {
      projectId: 'test-project-789',
      components: [
        {
          id: 'firewall',
          type: 'Network Security',
          description: 'Detected malicious traffic from 10.0.0.50 connecting to command.control.evil.com on port 8443. File hash abc123def456 identified as malware.',
        },
      ],
      options: {
        includeNLPAnalysis: true,
      },
    };

    const response = await orchestrator.analyze(request);

    const nlpAnalysis = response.analysis.nlpAnalysis;
    expect(nlpAnalysis.extractedIndicators).toBeDefined();
    expect(nlpAnalysis.extractedIndicators.length).toBeGreaterThan(0);

    // Check for specific IOCs
    const indicators = nlpAnalysis.extractedIndicators;
    expect(indicators).toContainEqual(
      expect.objectContaining({
        type: 'IP',
        value: expect.stringContaining('10.0.0.50'),
      })
    );
    expect(indicators).toContainEqual(
      expect.objectContaining({
        type: 'DOMAIN',
        value: expect.stringContaining('evil.com'),
      })
    );
  });

  it('should adjust threat severity based on sentiment analysis', async () => {
    const criticalRequest: AnalysisRequest = {
      projectId: 'critical-project',
      components: [
        {
          id: 'vulnerable-service',
          type: 'Service',
          description: 'CRITICAL: Immediate action required! Unauthenticated RCE vulnerability actively exploited in the wild!',
        },
      ],
      options: {
        includeNLPAnalysis: true,
      },
    };

    const normalRequest: AnalysisRequest = {
      projectId: 'normal-project',
      components: [
        {
          id: 'standard-service',
          type: 'Service',
          description: 'Standard web service with basic authentication. Monthly security updates applied.',
        },
      ],
      options: {
        includeNLPAnalysis: true,
      },
    };

    const [criticalResponse, normalResponse] = await Promise.all([
      orchestrator.analyze(criticalRequest),
      orchestrator.analyze(normalRequest),
    ]);

    // Critical sentiment should increase threat probability
    const criticalThreats = criticalResponse.analysis.threats;
    const normalThreats = normalResponse.analysis.threats;

    if (criticalThreats.length > 0 && normalThreats.length > 0) {
      const avgCriticalProb = criticalThreats.reduce((sum: number, t: any) => sum + t.probability, 0) / criticalThreats.length;
      const avgNormalProb = normalThreats.reduce((sum: number, t: any) => sum + t.probability, 0) / normalThreats.length;

      expect(avgCriticalProb).toBeGreaterThan(avgNormalProb);
    }

    // Check urgency in NLP analysis
    expect(criticalResponse.analysis.nlpAnalysis.urgency).toBe('critical');
    expect(normalResponse.analysis.nlpAnalysis.urgency).toBe('normal');
  });

  it('should classify security text and include in analysis', async () => {
    const request: AnalysisRequest = {
      projectId: 'classification-test',
      components: [
        {
          id: 'web-app',
          type: 'Web Application',
          description: 'Cross-site scripting vulnerability in user input fields. Buffer overflow in file upload handler. Weak encryption algorithm used for password storage.',
        },
      ],
      options: {
        includeNLPAnalysis: true,
      },
    };

    const response = await orchestrator.analyze(request);

    const classifications = response.analysis.nlpAnalysis.threatClassifications;
    expect(classifications).toBeDefined();
    expect(classifications.length).toBeGreaterThan(0);

    // Should identify multiple security issues
    const categories = classifications.map((c: any) => c.category);
    expect(categories).toContain('vulnerability');
    
    const labels = classifications.map((c: any) => c.label.toLowerCase());
    expect(labels.some((l: string) => l.includes('xss') || l.includes('scripting'))).toBe(true);
    expect(labels.some((l: string) => l.includes('overflow'))).toBe(true);
    expect(labels.some((l: string) => l.includes('encryption') || l.includes('crypto'))).toBe(true);
  });

  it('should handle NLP analysis errors gracefully', async () => {
    const request: AnalysisRequest = {
      projectId: 'error-test',
      components: [
        {
          id: 'test-comp',
          type: 'Component',
          description: '', // Empty description to potentially cause issues
        },
      ],
      options: {
        includeNLPAnalysis: true,
      },
    };

    // Should not throw, but handle gracefully
    const response = await orchestrator.analyze(request);
    
    expect(response).toBeDefined();
    expect(response.success).toBe(true);
    // Even with empty input, should have some default NLP analysis
    expect(response.analysis.nlpAnalysis).toBeDefined();
  });

  it('should respect NLP analysis option flag', async () => {
    const request: AnalysisRequest = {
      projectId: 'flag-test',
      components: [
        {
          id: 'comp-1',
          type: 'Service',
          description: 'Basic service with standard security measures.',
        },
      ],
      options: {
        includeNLPAnalysis: false,
      },
    };

    const response = await orchestrator.analyze(request);

    // NLP analysis should not be included when flag is false
    expect(response.analysis.nlpAnalysis).toBeUndefined();
  });

  it('should process complex threat intelligence with all NLP features', async () => {
    const complexRequest: AnalysisRequest = {
      projectId: 'complex-nlp-test',
      components: [
        {
          id: 'complex-system',
          type: 'Distributed System',
          description: `
            APT29 has been targeting our infrastructure using sophisticated phishing campaigns.
            Indicators of compromise include:
            - C2 servers: badactor.evil.com, 192.168.100.50
            - Malware hashes: d41d8cd98f00b204e9800998ecf8427e
            - Exploitation of CVE-2024-1234 and CVE-2024-5678
            - Lateral movement using stolen credentials
            - Data exfiltration to cloud storage services
            
            The attacks show high sophistication with custom malware variants.
            Immediate response required to prevent further compromise.
          `,
        },
      ],
      threatModel: {
        description: 'Critical infrastructure under active APT campaign',
      },
      options: {
        includeNLPAnalysis: true,
        includeThreatIntelligence: true,
        includePatternRecognition: true,
      },
    };

    const response = await orchestrator.analyze(request);

    const nlpAnalysis = response.analysis.nlpAnalysis;

    // Should extract multiple entity types
    expect(nlpAnalysis.entities).toContainEqual(
      expect.objectContaining({ type: 'THREAT_ACTOR', text: 'APT29' })
    );

    // Should extract multiple IOCs
    const iocTypes = nlpAnalysis.extractedIndicators.map((ioc: any) => ioc.type);
    expect(iocTypes).toContain('IP');
    expect(iocTypes).toContain('DOMAIN');
    expect(iocTypes).toContain('HASH');

    // Should identify as critical urgency
    expect(nlpAnalysis.urgency).toBe('critical');
    expect(nlpAnalysis.threatPerception).toBe('severe');

    // Should have comprehensive threat classifications
    expect(nlpAnalysis.threatClassifications.length).toBeGreaterThan(3);
  });
});

describe('AI Orchestrator Health Check with NLP', () => {
  let orchestrator: AIOrchestrator;

  beforeEach(async () => {
    orchestrator = new AIOrchestrator();
    await orchestrator.initialize();
  });

  afterEach(async () => {
    await orchestrator.shutdown();
  });

  it('should include NLP services in health status', () => {
    const health = orchestrator.getHealth();

    expect(health).toBeDefined();
    expect(health.status).toBe('healthy');
    expect(health.nlpServices).toBeDefined();
    expect(health.nlpServices.threatIntelligenceNLP).toBe('initialized');
    expect(health.nlpServices.entityExtraction).toBe('initialized');
    expect(health.nlpServices.sentimentAnalysis).toBe('initialized');
    expect(health.nlpServices.securityTextClassifier).toBe('initialized');
  });
});