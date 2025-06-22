import { StrideEngine } from '../../src/engines/stride.engine';
import {
  ThreatAnalysisRequest,
  ThreatModelingMethodology,
  ComponentType,
  Component,
  ThreatSeverity,
  ThreatCategory,
} from '../../src/types';

describe('StrideEngine', () => {
  let strideEngine: StrideEngine;

  beforeEach(() => {
    strideEngine = new StrideEngine();
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

  const createTestRequest = (components: Component[]): ThreatAnalysisRequest => ({
    threatModelId: 'test-threat-model',
    methodology: ThreatModelingMethodology.STRIDE,
    components,
    dataFlows: [],
    securityRequirements: [],
    options: {
      enablePatternMatching: true,
      enableDreadScoring: false,
    },
  });

  describe('analyze', () => {
    it('should successfully analyze a simple component', async () => {
      const component = createTestComponent();
      const request = createTestRequest([component]);

      const result = await strideEngine.analyze(request);

      expect(result).toBeDefined();
      expect(result.threatModelId).toBe('test-threat-model');
      expect(result.methodology).toBe(ThreatModelingMethodology.STRIDE);
      expect(result.threats).toBeInstanceOf(Array);
      expect(result.riskAssessment).toBeDefined();
      expect(result.mitigationRecommendations).toBeInstanceOf(Array);
      expect(result.analysisMetadata).toBeDefined();
    });

    it('should identify spoofing threats for components without authentication', async () => {
      const component = createTestComponent({
        properties: {
          internetFacing: true,
          privileged: false,
          sensitive: false,
          protocols: ['http'],
          authentication: [], // No authentication
          authorization: [],
          encryption: [],
          logging: [],
          technology: 'nodejs',
        },
      });
      const request = createTestRequest([component]);

      const result = await strideEngine.analyze(request);

      const spoofingThreats = result.threats.filter(
        t => t.category === ThreatCategory.SPOOFING
      );
      expect(spoofingThreats.length).toBeGreaterThan(0);
      expect(spoofingThreats[0].affectedComponents).toContain(component.id);
    });

    it('should identify tampering threats for unprotected data stores', async () => {
      const component = createTestComponent({
        type: ComponentType.DATA_STORE,
        properties: {
          internetFacing: false,
          privileged: false,
          sensitive: true,
          protocols: ['sql'],
          authentication: [],
          authorization: [],
          encryption: [], // No encryption
          logging: [],
          technology: 'postgresql',
        },
      });
      const request = createTestRequest([component]);

      const result = await strideEngine.analyze(request);

      const tamperingThreats = result.threats.filter(
        t => t.category === ThreatCategory.TAMPERING
      );
      expect(tamperingThreats.length).toBeGreaterThan(0);
    });

    it('should identify information disclosure threats for sensitive components', async () => {
      const component = createTestComponent({
        properties: {
          internetFacing: true,
          privileged: false,
          sensitive: true, // Sensitive data
          protocols: ['http'],
          authentication: ['basic'],
          authorization: [],
          encryption: [], // No encryption
          logging: [],
          technology: 'nodejs',
        },
      });
      const request = createTestRequest([component]);

      const result = await strideEngine.analyze(request);

      const disclosureThreats = result.threats.filter(
        t => t.category === ThreatCategory.INFORMATION_DISCLOSURE
      );
      expect(disclosureThreats.length).toBeGreaterThan(0);
    });

    it('should identify denial of service threats for internet-facing components', async () => {
      const component = createTestComponent({
        properties: {
          internetFacing: true, // Public facing
          privileged: false,
          sensitive: false,
          protocols: ['http'],
          authentication: ['basic'],
          authorization: [],
          encryption: [],
          logging: [],
          technology: 'nodejs',
        },
      });
      const request = createTestRequest([component]);

      const result = await strideEngine.analyze(request);

      const dosThreats = result.threats.filter(
        t => t.category === ThreatCategory.DENIAL_OF_SERVICE
      );
      expect(dosThreats.length).toBeGreaterThan(0);
    });

    it('should identify elevation of privilege threats for privileged components', async () => {
      const component = createTestComponent({
        properties: {
          internetFacing: false,
          privileged: true, // Privileged access
          sensitive: true,
          protocols: ['http'],
          authentication: ['basic'], // Weak authentication
          authorization: [],
          encryption: [],
          logging: [],
          technology: 'nodejs',
        },
      });
      const request = createTestRequest([component]);

      const result = await strideEngine.analyze(request);

      const elevationThreats = result.threats.filter(
        t => t.category === ThreatCategory.ELEVATION_OF_PRIVILEGE
      );
      expect(elevationThreats.length).toBeGreaterThan(0);
    });

    it('should identify repudiation threats for components without logging', async () => {
      const component = createTestComponent({
        properties: {
          internetFacing: true,
          privileged: false,
          sensitive: true,
          protocols: ['http'],
          authentication: ['basic'],
          authorization: ['rbac'],
          encryption: ['tls'],
          logging: [], // No logging
          technology: 'nodejs',
        },
      });
      const request = createTestRequest([component]);

      const result = await strideEngine.analyze(request);

      const repudiationThreats = result.threats.filter(
        t => t.category === ThreatCategory.REPUDIATION
      );
      expect(repudiationThreats.length).toBeGreaterThan(0);
    });

    it('should calculate risk assessment correctly', async () => {
      const components = [
        createTestComponent({
          id: 'comp1',
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
        }),
        createTestComponent({
          id: 'comp2',
          type: ComponentType.DATA_STORE,
          properties: {
            internetFacing: false,
            privileged: false,
            sensitive: true,
            protocols: ['sql'],
            authentication: [],
            authorization: [],
            encryption: [],
            logging: [],
            technology: 'postgresql',
          },
        }),
      ];
      const request = createTestRequest(components);

      const result = await strideEngine.analyze(request);

      expect(result.riskAssessment.overallRiskScore).toBeGreaterThan(0);
      expect(result.riskAssessment.riskLevel).toBeDefined();
      expect(result.riskAssessment.riskDistribution).toBeDefined();
      expect(result.riskAssessment.riskDistribution.critical).toBeGreaterThanOrEqual(0);
      expect(result.riskAssessment.riskDistribution.high).toBeGreaterThanOrEqual(0);
      expect(result.riskAssessment.riskDistribution.medium).toBeGreaterThanOrEqual(0);
      expect(result.riskAssessment.riskDistribution.low).toBeGreaterThanOrEqual(0);
    });

    it('should generate mitigation recommendations', async () => {
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

      const result = await strideEngine.analyze(request);

      expect(result.mitigationRecommendations).toBeInstanceOf(Array);
      expect(result.mitigationRecommendations.length).toBeGreaterThan(0);
      
      const recommendation = result.mitigationRecommendations[0];
      expect(recommendation.id).toBeDefined();
      expect(recommendation.title).toBeDefined();
      expect(recommendation.description).toBeDefined();
      expect(recommendation.category).toBeDefined();
      expect(recommendation.implementation).toBeDefined();
    });

    it('should include analysis metadata', async () => {
      const component = createTestComponent();
      const request = createTestRequest([component]);

      const result = await strideEngine.analyze(request);

      expect(result.analysisMetadata).toBeDefined();
      expect(result.analysisMetadata.timestamp).toBeInstanceOf(Date);
      expect(result.analysisMetadata.version).toBe('1.0.0');
      expect(result.analysisMetadata.methodology).toBe(ThreatModelingMethodology.STRIDE);
      expect(result.analysisMetadata.totalThreats).toBe(result.threats.length);
      expect(result.analysisMetadata.componentsAnalyzed).toBe(1);
      expect(result.analysisMetadata.processingSteps).toBeInstanceOf(Array);
    });

    it('should handle multiple components correctly', async () => {
      const components = [
        createTestComponent({ id: 'comp1', name: 'Component 1' }),
        createTestComponent({ 
          id: 'comp2', 
          name: 'Component 2',
          type: ComponentType.DATA_STORE,
        }),
        createTestComponent({ 
          id: 'comp3', 
          name: 'Component 3',
          type: ComponentType.EXTERNAL_ENTITY,
        }),
      ];
      const request = createTestRequest(components);

      const result = await strideEngine.analyze(request);

      expect(result.threats.length).toBeGreaterThan(0);
      expect(result.analysisMetadata.componentsAnalyzed).toBe(3);
      
      // Check that threats affect the correct components
      const affectedComponentIds = new Set(
        result.threats.flatMap(t => t.affectedComponents)
      );
      components.forEach(comp => {
        expect(affectedComponentIds.has(comp.id)).toBe(true);
      });
    });

    it('should calculate confidence scores appropriately', async () => {
      const component = createTestComponent();
      const request = createTestRequest([component]);

      const result = await strideEngine.analyze(request);

      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
      
      result.threats.forEach(threat => {
        expect(threat.confidence).toBeGreaterThan(0);
        expect(threat.confidence).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('error handling', () => {
    it('should throw error for invalid request', async () => {
      const invalidRequest = {
        threatModelId: '', // Invalid: empty threat model ID
        methodology: ThreatModelingMethodology.STRIDE,
        components: [], // Invalid: no components
        dataFlows: [],
      } as ThreatAnalysisRequest;

      // First, let's test that an empty threat model ID causes validation to fail
      await expect(strideEngine.analyze(invalidRequest)).rejects.toThrow('Threat model ID is required');
    });

    it('should handle components with missing properties gracefully', async () => {
      const component = {
        id: 'test',
        name: 'Test',
        type: ComponentType.PROCESS,
        properties: {}, // Missing required properties
        connections: [],
      } as Component;
      
      const request = createTestRequest([component]);

      // Should not throw, but handle gracefully
      const result = await strideEngine.analyze(request);
      expect(result).toBeDefined();
    });
  });
});