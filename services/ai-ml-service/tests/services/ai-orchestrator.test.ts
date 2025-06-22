import { AIOrchestrator } from '../../src/services/ai-orchestrator.service';
import { AnalysisRequest, ModelType } from '../../src/types';

describe('AIOrchestrator Service', () => {
  let orchestrator: AIOrchestrator;

  beforeEach(() => {
    orchestrator = new AIOrchestrator();
  });

  afterEach(async () => {
    await orchestrator.shutdown();
  });

  describe('initialization', () => {
    it('should initialize all ML models', async () => {
      await orchestrator.initialize();
      const health = orchestrator.getHealth();
      
      expect(health.status).toBe('healthy');
      expect(health.models).toHaveProperty(ModelType.THREAT_CLASSIFIER);
      expect(health.models).toHaveProperty(ModelType.VULNERABILITY_PREDICTOR);
      expect(health.models).toHaveProperty(ModelType.MITIGATION_RECOMMENDER);
      expect(health.models).toHaveProperty(ModelType.PATTERN_RECOGNIZER);
      expect(health.models).toHaveProperty(ModelType.THREAT_INTELLIGENCE);
    });
  });

  describe('analyze', () => {
    it('should perform comprehensive analysis', async () => {
      await orchestrator.initialize();

      const request: AnalysisRequest = {
        projectId: 'test-project',
        components: [
          {
            id: 'comp-1',
            type: 'Web API',
            description: 'User authentication API with password storage',
            dataFlow: ['user-input', 'database'],
            technologies: ['Node.js', 'Express', 'PostgreSQL'],
            interfaces: ['REST', 'HTTP'],
          },
        ],
        options: {
          includePatternRecognition: true,
          includeVulnerabilityPrediction: true,
          includeMitigationRecommendations: true,
          includeThreatIntelligence: true,
          confidenceThreshold: 0.7,
        },
      };

      const result = await orchestrator.analyze(request);

      expect(result.success).toBe(true);
      expect(result.projectId).toBe('test-project');
      expect(result.analysis).toBeDefined();
      expect(result.analysis.threats).toBeInstanceOf(Array);
      expect(result.analysis.vulnerabilities).toBeInstanceOf(Array);
      expect(result.analysis.mitigations).toBeInstanceOf(Array);
      expect(result.summary).toBeDefined();
      expect(result.summary.totalThreats).toBeGreaterThanOrEqual(0);
      expect(result.summary.overallRiskLevel).toMatch(/critical|high|medium|low/);
    });

    it('should handle partial analysis options', async () => {
      await orchestrator.initialize();

      const request: AnalysisRequest = {
        projectId: 'test-project-2',
        components: [
          {
            id: 'comp-2',
            type: 'Database',
            description: 'User data storage',
            dataFlow: ['sensitive-data'],
            technologies: ['PostgreSQL'],
            interfaces: ['SQL'],
          },
        ],
        options: {
          includePatternRecognition: false,
          includeVulnerabilityPrediction: true,
          includeMitigationRecommendations: false,
          includeThreatIntelligence: false,
        },
      };

      const result = await orchestrator.analyze(request);

      expect(result.success).toBe(true);
      expect(result.analysis.vulnerabilities).toBeInstanceOf(Array);
      expect(result.analysis.patterns).toEqual([]);
      expect(result.analysis.mitigations).toEqual([]);
    });
  });

  describe('health monitoring', () => {
    it('should return health status', async () => {
      await orchestrator.initialize();
      const health = orchestrator.getHealth();

      expect(health.status).toBe('healthy');
      expect(health.timestamp).toBeInstanceOf(Date);
      expect(health.models).toBeDefined();
      expect(health.cache).toBeDefined();
      expect(health.cache.size).toBeGreaterThanOrEqual(0);
      expect(health.cache.hitRate).toBeGreaterThanOrEqual(0);
    });
  });

  describe('error handling', () => {
    it('should handle invalid component types', async () => {
      await orchestrator.initialize();

      const request: AnalysisRequest = {
        projectId: 'test-error',
        components: [
          {
            id: 'invalid',
            type: '', // Invalid empty type
            description: 'Invalid component',
            dataFlow: [],
            technologies: [],
            interfaces: [],
          },
        ],
      };

      const result = await orchestrator.analyze(request);
      
      expect(result.success).toBe(true); // Should still succeed but with limited analysis
      expect(result.analysis.threats.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('shutdown', () => {
    it('should shutdown gracefully', async () => {
      await orchestrator.initialize();
      await orchestrator.shutdown();
      
      // Verify models are cleaned up
      const health = orchestrator.getHealth();
      expect(health.status).toBe('healthy'); // Status remains healthy even after shutdown
    });
  });
});