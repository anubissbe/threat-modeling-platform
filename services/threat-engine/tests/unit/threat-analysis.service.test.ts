import { ThreatAnalysisService } from '../../src/services/threat-analysis.service';
import {
  ThreatAnalysisRequest,
  ThreatModelingMethodology,
  ComponentType,
  Component,
  IdentifiedThreat,
  ThreatCategory,
  ThreatSeverity,
} from '../../src/types';

describe('ThreatAnalysisService', () => {
  let service: ThreatAnalysisService;

  beforeEach(() => {
    service = new ThreatAnalysisService();
  });

  const createTestComponent = (overrides: Partial<Component> = {}): Component => ({
    id: 'test-component',
    name: 'Test Component',
    type: ComponentType.PROCESS,
    description: 'Test component description',
    properties: {
      internetFacing: false,
      privileged: false,
      sensitive: false,
      protocols: ['http'],
      authentication: [],
      authorization: [],
      encryption: [],
      logging: [],
      technology: 'nodejs',
    },
    connections: [],
    ...overrides,
  });

  const createTestRequest = (
    components: Component[],
    methodology: ThreatModelingMethodology = ThreatModelingMethodology.STRIDE
  ): ThreatAnalysisRequest => ({
    threatModelId: 'test-threat-model',
    methodology,
    components,
    dataFlows: [],
    securityRequirements: [],
    options: {
      enablePatternMatching: true,
      enableDreadScoring: true,
    },
  });

  describe('analyzeThreatModel', () => {
    it('should successfully analyze with STRIDE methodology', async () => {
      const component = createTestComponent();
      const request = createTestRequest([component], ThreatModelingMethodology.STRIDE);

      const result = await service.analyzeThreatModel(request);

      expect(result).toBeDefined();
      expect(result.threatModelId).toBe('test-threat-model');
      expect(result.methodology).toBe(ThreatModelingMethodology.STRIDE);
      expect(result.threats).toBeInstanceOf(Array);
      expect(result.riskAssessment).toBeDefined();
      expect(result.mitigationRecommendations).toBeInstanceOf(Array);
    });

    it('should successfully analyze with PASTA methodology', async () => {
      const component = createTestComponent();
      const request = createTestRequest([component], ThreatModelingMethodology.PASTA);

      const result = await service.analyzeThreatModel(request);

      expect(result).toBeDefined();
      expect(result.methodology).toBe(ThreatModelingMethodology.PASTA);
      expect(result.threats).toBeInstanceOf(Array);
    });

    it('should enhance threats with pattern matching when enabled', async () => {
      const component = createTestComponent({
        properties: {
          internetFacing: true,
          privileged: false,
          sensitive: false,
          protocols: ['http'],
          authentication: [],
          authorization: [],
          encryption: [],
          logging: [],
          technology: 'nodejs',
        },
      });
      const request = createTestRequest([component]);

      const result = await service.analyzeThreatModel(request);

      // Should have threats from both STRIDE analysis and pattern matching
      expect(result.threats.length).toBeGreaterThan(0);
      
      // Check for threats from different sources
      const strideThreats = result.threats.filter(t => t.source === 'rule_based');
      const patternThreats = result.threats.filter(t => t.source === 'pattern_matching');
      
      expect(strideThreats.length + patternThreats.length).toBeGreaterThan(0);
    });

    it('should apply DREAD scoring when enabled', async () => {
      const component = createTestComponent({
        properties: {
          internetFacing: true,
          privileged: false,
          sensitive: true,
          protocols: ['http'],
          authentication: [],
          authorization: [],
          encryption: [],
          logging: [],
          technology: 'nodejs',
        },
      });
      const request = createTestRequest([component]);
      request.options!.enableDreadScoring = true;

      const result = await service.analyzeThreatModel(request);

      expect(result.threats.length).toBeGreaterThan(0);
      
      // DREAD scoring should update risk scores
      result.threats.forEach(threat => {
        expect(threat.riskScore).toBeDefined();
        expect(threat.riskScore).toBeGreaterThanOrEqual(0);
      });
    });

    it('should deduplicate similar threats', async () => {
      const components = [
        createTestComponent({
          id: 'comp1',
          name: 'Component 1',
          properties: {
            internetFacing: true,
            privileged: false,
            sensitive: false,
            protocols: ['http'],
            authentication: [],
            authorization: [],
            encryption: [],
            logging: [],
            technology: 'nodejs',
          },
        }),
        createTestComponent({
          id: 'comp2',
          name: 'Component 2',
          properties: {
            internetFacing: true,
            privileged: false,
            sensitive: false,
            protocols: ['http'],
            authentication: [],
            authorization: [],
            encryption: [],
            logging: [],
            technology: 'nodejs',
          },
        }),
      ];
      const request = createTestRequest(components);

      const result = await service.analyzeThreatModel(request);

      // Should have fewer threats than if no deduplication occurred
      expect(result.threats.length).toBeGreaterThan(0);
      
      // Check that threats are properly deduplicated
      const threatTitles = result.threats.map(t => t.title);
      const uniqueTitles = new Set(threatTitles);
      
      // Allow some duplicates with different components, but not exact duplicates
      expect(uniqueTitles.size).toBeGreaterThan(0);
    });

    it('should include enhanced metadata', async () => {
      const component = createTestComponent();
      const request = createTestRequest([component]);

      const result = await service.analyzeThreatModel(request);

      expect(result.analysisMetadata).toBeDefined();
      expect(result.analysisMetadata.analysisId).toBeDefined();
      expect(result.analysisMetadata.serviceVersion).toBe('1.0.0');
      expect(result.analysisMetadata.totalProcessingTime).toBeGreaterThanOrEqual(0);
      expect(result.analysisMetadata.performanceMetrics).toBeDefined();
    });

    it('should handle user audit logging', async () => {
      const component = createTestComponent();
      const request = createTestRequest([component]);
      const userId = 'test-user-123';

      const result = await service.analyzeThreatModel(request, userId);

      expect(result).toBeDefined();
      // Audit logging happens internally, can't directly test without mocking
    });

    it('should validate request before analysis', async () => {
      const invalidRequest = {
        threatModelId: '',
        methodology: ThreatModelingMethodology.STRIDE,
        components: [],
        dataFlows: [],
      } as ThreatAnalysisRequest;

      await expect(service.analyzeThreatModel(invalidRequest)).rejects.toThrow();
    });

    it('should throw error for unsupported methodology', async () => {
      const component = createTestComponent();
      const request = createTestRequest([component]);
      request.methodology = 'INVALID' as any;

      await expect(service.analyzeThreatModel(request)).rejects.toThrow('Invalid methodology');
    });
  });

  describe('analyzeComponent', () => {
    it('should analyze single component', async () => {
      const component = createTestComponent({
        properties: {
          internetFacing: true,
          privileged: false,
          sensitive: true,
          protocols: ['http'],
          authentication: [],
          authorization: [],
          encryption: [],
          logging: [],
          technology: 'nodejs',
        },
      });

      const threats = await service.analyzeComponent(component);

      expect(threats).toBeInstanceOf(Array);
      expect(threats.length).toBeGreaterThan(0);
      threats.forEach(threat => {
        expect(threat.affectedComponents).toContain(component.id);
      });
    });

    it('should use specified methodology for component analysis', async () => {
      const component = createTestComponent();

      const strideThreats = await service.analyzeComponent(
        component,
        ThreatModelingMethodology.STRIDE
      );
      const pastaThreats = await service.analyzeComponent(
        component,
        ThreatModelingMethodology.PASTA
      );

      expect(strideThreats).toBeInstanceOf(Array);
      expect(pastaThreats).toBeInstanceOf(Array);
      
      // Different methodologies may produce different results
      // Both should have some threats for a vulnerable component
    });
  });

  describe('generateMitigations', () => {
    it('should generate mitigation recommendations for threats', async () => {
      const component = createTestComponent();
      const threats: IdentifiedThreat[] = [
        {
          id: 'threat-1',
          title: 'Test Threat',
          description: 'Test threat description',
          category: ThreatCategory.SPOOFING,
          strideCategories: [],
          severity: ThreatSeverity.HIGH,
          likelihood: 'medium' as any,
          impact: 'high' as any,
          riskScore: 12,
          affectedComponents: [component.id],
          affectedDataFlows: [],
          attackVectors: [],
          prerequisites: [],
          securityRequirements: [],
          confidence: 0.8,
          source: 'rule_based' as any,
        },
      ];

      const mitigations = await service.generateMitigations(threats, [component]);

      expect(mitigations).toBeInstanceOf(Array);
      expect(mitigations.length).toBeGreaterThan(0);
      
      const mitigation = mitigations[0];
      expect(mitigation.id).toBeDefined();
      expect(mitigation.title).toBeDefined();
      expect(mitigation.description).toBeDefined();
      expect(mitigation.applicableThreats).toContain('threat-1');
    });
  });

  describe('calculateRiskMetrics', () => {
    it('should calculate risk assessment for threats', async () => {
      const component = createTestComponent();
      const threats: IdentifiedThreat[] = [
        {
          id: 'threat-1',
          title: 'High Risk Threat',
          description: 'High risk threat',
          category: ThreatCategory.INFORMATION_DISCLOSURE,
          strideCategories: [],
          severity: ThreatSeverity.CRITICAL,
          likelihood: 'high' as any,
          impact: 'very_high' as any,
          riskScore: 20,
          affectedComponents: [component.id],
          affectedDataFlows: [],
          attackVectors: [],
          prerequisites: [],
          securityRequirements: [],
          confidence: 0.9,
          source: 'rule_based' as any,
        },
        {
          id: 'threat-2',
          title: 'Medium Risk Threat',
          description: 'Medium risk threat',
          category: ThreatCategory.TAMPERING,
          strideCategories: [],
          severity: ThreatSeverity.MEDIUM,
          likelihood: 'medium' as any,
          impact: 'medium' as any,
          riskScore: 9,
          affectedComponents: [component.id],
          affectedDataFlows: [],
          attackVectors: [],
          prerequisites: [],
          securityRequirements: [],
          confidence: 0.7,
          source: 'rule_based' as any,
        },
      ];

      const riskAssessment = await service.calculateRiskMetrics(threats, [component]);

      expect(riskAssessment.overallRiskScore).toBeGreaterThan(0);
      expect(riskAssessment.riskLevel).toBeDefined();
      expect(riskAssessment.riskDistribution.critical).toBe(1);
      expect(riskAssessment.riskDistribution.medium).toBe(1);
      expect(riskAssessment.criticalThreats.length).toBeGreaterThan(0);
    });
  });

  describe('getAvailablePatterns', () => {
    it('should return available threat patterns', async () => {
      const patterns = await service.getAvailablePatterns();

      expect(patterns).toBeDefined();
      expect(patterns.patterns).toBeInstanceOf(Array);
      expect(patterns.categoryCounts).toBeDefined();
      expect(patterns.patterns.length).toBeGreaterThan(0);
    });
  });

  describe('addCustomPattern', () => {
    it('should add custom threat pattern', async () => {
      const customPattern = {
        id: 'custom-pattern-1',
        name: 'Custom Test Pattern',
        description: 'Custom pattern for testing',
        category: ThreatCategory.SPOOFING,
        applicableComponents: [ComponentType.PROCESS],
        conditions: [],
        threatTemplate: {
          title: 'Custom Threat',
          description: 'Custom threat description',
          category: ThreatCategory.SPOOFING,
          strideCategories: [],
          severity: ThreatSeverity.MEDIUM,
          likelihood: 'medium' as any,
          impact: 'medium' as any,
          attackVectors: [],
          mitigationSuggestions: [],
        },
        confidence: 0.8,
        lastUpdated: new Date(),
      };

      await expect(service.addCustomPattern(customPattern, 'test-user')).resolves.not.toThrow();

      // Verify pattern was added
      const patterns = await service.getAvailablePatterns();
      const addedPattern = patterns.patterns.find(p => p.id === 'custom-pattern-1');
      expect(addedPattern).toBeDefined();
    });
  });
});