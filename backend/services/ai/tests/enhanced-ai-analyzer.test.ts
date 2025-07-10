import { Pool } from 'pg';
import { RedisClientType } from 'redis';
import { EnhancedAIAnalyzerService } from '../src/services/enhanced-ai-analyzer.service';
import { ThreatIntelligenceService } from '../src/services/threat-intelligence.service';
import { AIAnalysisRequest, ContextualThreatData } from '../src/types/ai';
import { MethodologyType } from '../src/types/shared';

// Mock dependencies
jest.mock('pg');
jest.mock('redis');
jest.mock('../src/utils/logger');

describe('EnhancedAIAnalyzerService', () => {
  let service: EnhancedAIAnalyzerService;
  let mockDb: jest.Mocked<Pool>;
  let mockRedis: jest.Mocked<RedisClientType>;
  let mockThreatIntelService: jest.Mocked<ThreatIntelligenceService>;

  beforeEach(() => {
    mockDb = {
      query: jest.fn(),
      connect: jest.fn(),
    } as any;

    mockRedis = {
      get: jest.fn(),
      set: jest.fn(),
      setEx: jest.fn(),
      ping: jest.fn(),
    } as any;

    mockThreatIntelService = {
      getContextualThreatIntelligence: jest.fn(),
    } as any;

    service = new EnhancedAIAnalyzerService(mockDb, mockRedis, mockThreatIntelService);
  });

  describe('analyzeThreatsEnhanced', () => {
    it('should perform enhanced threat analysis with 98% accuracy', async () => {
      // Mock context data
      const contextData: ContextualThreatData = {
        system_components: [
          {
            id: 'comp1',
            name: 'Web API',
            type: 'process',
            technologies: ['Node.js', 'Express'],
            protocols: ['HTTP', 'HTTPS'],
            interfaces: ['REST API'],
            security_level: 'internal',
            criticality: 'high'
          }
        ],
        data_flows: [
          {
            id: 'flow1',
            source: 'comp1',
            destination: 'comp2',
            data_types: ['user_data'],
            sensitivity: 'confidential',
            encryption: true,
            authentication_required: true,
            protocols: ['HTTPS'],
            data_classification: 'user_input'
          }
        ],
        trust_boundaries: [
          {
            id: 'boundary1',
            name: 'Internet Boundary',
            description: 'Separates internal network from internet',
            security_level: 3,
            components_inside: ['comp1'],
            components_outside: ['internet']
          }
        ],
        assets: [
          {
            id: 'asset1',
            name: 'User Database',
            type: 'data',
            sensitivity: 'confidential',
            criticality: 'high',
            value: 100,
            dependencies: ['comp1']
          }
        ],
        existing_controls: [
          {
            id: 'control1',
            name: 'WAF',
            type: 'preventive',
            category: 'network_security',
            effectiveness: 0.8,
            coverage: ['comp1'],
            maturity: 'defined'
          }
        ],
        compliance_requirements: ['GDPR', 'SOC2'],
        business_context: {
          industry: 'fintech',
          organization_size: 'medium',
          regulatory_environment: ['PCI-DSS'],
          risk_tolerance: 'low',
          business_criticality: 'high',
          geographic_scope: ['US', 'EU']
        },
        external_dependencies: [
          {
            id: 'dep1',
            name: 'OAuth Provider',
            type: 'service',
            version: '2.0',
            vendor: 'Google',
            criticality: 'high',
            last_security_review: new Date('2024-01-01'),
            known_vulnerabilities: [],
            update_frequency: 'monthly',
            license_type: 'commercial',
            compliance_status: 'compliant'
          }
        ]
      };

      const request: AIAnalysisRequest = {
        threat_model_id: 'tm123',
        methodology: MethodologyType.STRIDE,
        context: contextData,
        analysis_depth: 'comprehensive'
      };

      // Mock threat intelligence
      mockThreatIntelService.getContextualThreatIntelligence.mockResolvedValue([
        {
          id: 'intel1',
          source: 'MITRE ATT&CK',
          threat_type: 'injection',
          indicators: {
            iocs: ['T1190'],
            ttps: ['initial_access'],
            attack_vectors: ['web_application']
          },
          severity: 'high',
          confidence: 0.9,
          first_seen: new Date('2024-01-01'),
          last_seen: new Date('2024-01-15'),
          geographic_regions: ['US'],
          industry_sectors: ['fintech'],
          description: 'SQL Injection attack pattern',
          references: ['https://attack.mitre.org/techniques/T1190/']
        }
      ]);

      // Mock database queries
      mockDb.query.mockResolvedValue({
        rows: [
          { threat_type: 'injection', frequency: 10, avg_severity: 4.5, most_recent: new Date() }
        ]
      });

      // Execute the analysis
      const result = await service.analyzeThreatsEnhanced(request);

      // Assertions
      expect(result).toBeDefined();
      expect(result.analysis_id).toBeDefined();
      expect(result.threat_model_id).toBe('tm123');
      expect(result.generated_threats).toBeInstanceOf(Array);
      expect(result.generated_threats.length).toBeGreaterThan(0);
      expect(result.risk_assessment).toBeDefined();
      expect(result.confidence_metrics).toBeDefined();
      expect(result.processing_metadata).toBeDefined();
      
      // Check enhanced analysis specific features
      expect(result.processing_metadata.accuracy_score).toBeGreaterThanOrEqual(0.98);
      expect(result.processing_metadata.models_used).toContain('deep-threat-detector');
      expect(result.processing_metadata.models_used).toContain('pattern-recognizer');
      expect(result.processing_metadata.models_used).toContain('auto-threat-generator');
      
      // Check threat quality
      const threat = result.generated_threats[0];
      expect(threat.confidence).toBeGreaterThan(0.8);
      expect(threat.likelihood).toBeGreaterThan(0);
      expect(threat.severity).toBeDefined();
      expect(threat.mitigation_suggestions).toBeInstanceOf(Array);
      expect(threat.intelligence_context).toBeDefined();
    });

    it('should handle pattern recognition correctly', async () => {
      const contextData: ContextualThreatData = {
        system_components: [
          {
            id: 'db1',
            name: 'Database',
            type: 'data_store',
            technologies: ['PostgreSQL'],
            protocols: ['SQL'],
            interfaces: ['Database API'],
            security_level: 'confidential',
            criticality: 'critical'
          }
        ],
        data_flows: [
          {
            id: 'flow1',
            source: 'app',
            destination: 'db1',
            data_types: ['user_input'],
            sensitivity: 'confidential',
            encryption: false,
            authentication_required: true,
            protocols: ['SQL'],
            data_classification: 'user_input'
          }
        ],
        trust_boundaries: [],
        assets: [],
        existing_controls: [],
        compliance_requirements: [],
        business_context: {
          industry: 'healthcare',
          organization_size: 'large',
          regulatory_environment: ['HIPAA'],
          risk_tolerance: 'low',
          business_criticality: 'critical',
          geographic_scope: ['US']
        }
      };

      const request: AIAnalysisRequest = {
        threat_model_id: 'tm456',
        methodology: MethodologyType.STRIDE,
        context: contextData,
        analysis_depth: 'comprehensive'
      };

      mockThreatIntelService.getContextualThreatIntelligence.mockResolvedValue([]);
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await service.analyzeThreatsEnhanced(request);

      // Should identify SQL injection pattern due to unencrypted data flow to database
      const sqlInjectionThreat = result.generated_threats.find(t => 
        t.name.toLowerCase().includes('sql') || 
        t.category.toLowerCase().includes('injection')
      );
      
      expect(sqlInjectionThreat).toBeDefined();
      if (sqlInjectionThreat) {
        expect(sqlInjectionThreat.severity).toBe('high');
        expect(sqlInjectionThreat.confidence).toBeGreaterThan(0.7);
      }
    });

    it('should generate predictive threat analysis', async () => {
      const contextData: ContextualThreatData = {
        system_components: [],
        data_flows: [],
        trust_boundaries: [],
        assets: [],
        existing_controls: [],
        compliance_requirements: [],
        business_context: {
          industry: 'technology',
          organization_size: 'enterprise',
          regulatory_environment: [],
          risk_tolerance: 'medium',
          business_criticality: 'high',
          geographic_scope: ['Global']
        }
      };

      const request: AIAnalysisRequest = {
        threat_model_id: 'tm789',
        methodology: MethodologyType.PASTA,
        context: contextData,
        analysis_depth: 'comprehensive'
      };

      mockThreatIntelService.getContextualThreatIntelligence.mockResolvedValue([]);
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await service.analyzeThreatsEnhanced(request);

      // Should include predictive analysis
      expect(result.predictions).toBeDefined();
      expect(result.predictions.length).toBeGreaterThan(0);
      
      const prediction = result.predictions[0];
      expect(prediction.threat_type).toBeDefined();
      expect(prediction.probability).toBeGreaterThan(0);
      expect(prediction.time_horizon).toBeDefined();
    });
  });

  describe('Performance and Accuracy', () => {
    it('should complete analysis within acceptable time limits', async () => {
      const contextData: ContextualThreatData = {
        system_components: Array(10).fill(null).map((_, i) => ({
          id: `comp${i}`,
          name: `Component ${i}`,
          type: 'process',
          technologies: ['Node.js'],
          protocols: ['HTTP'],
          interfaces: ['REST'],
          security_level: 'internal',
          criticality: 'medium'
        })),
        data_flows: [],
        trust_boundaries: [],
        assets: [],
        existing_controls: [],
        compliance_requirements: [],
        business_context: {
          industry: 'retail',
          organization_size: 'medium',
          regulatory_environment: [],
          risk_tolerance: 'medium',
          business_criticality: 'medium',
          geographic_scope: ['US']
        }
      };

      const request: AIAnalysisRequest = {
        threat_model_id: 'tm_perf',
        methodology: MethodologyType.STRIDE,
        context: contextData,
        analysis_depth: 'comprehensive'
      };

      mockThreatIntelService.getContextualThreatIntelligence.mockResolvedValue([]);
      mockDb.query.mockResolvedValue({ rows: [] });

      const startTime = Date.now();
      const result = await service.analyzeThreatsEnhanced(request);
      const endTime = Date.now();

      const processingTime = endTime - startTime;
      
      // Should complete within 30 seconds for this test case
      expect(processingTime).toBeLessThan(30000);
      expect(result.processing_metadata.processing_time_ms).toBeLessThan(30000);
      expect(result.processing_metadata.accuracy_score).toBeGreaterThanOrEqual(0.98);
    });

    it('should maintain high confidence scores', async () => {
      const contextData: ContextualThreatData = {
        system_components: [
          {
            id: 'web_app',
            name: 'Web Application',
            type: 'process',
            technologies: ['React', 'Node.js'],
            protocols: ['HTTP', 'HTTPS'],
            interfaces: ['Web UI', 'API'],
            security_level: 'public',
            criticality: 'high'
          }
        ],
        data_flows: [
          {
            id: 'user_input',
            source: 'user',
            destination: 'web_app',
            data_types: ['form_data', 'credentials'],
            sensitivity: 'confidential',
            encryption: true,
            authentication_required: false,
            protocols: ['HTTPS'],
            data_classification: 'user_input'
          }
        ],
        trust_boundaries: [],
        assets: [],
        existing_controls: [],
        compliance_requirements: [],
        business_context: {
          industry: 'ecommerce',
          organization_size: 'large',
          regulatory_environment: ['PCI-DSS'],
          risk_tolerance: 'low',
          business_criticality: 'high',
          geographic_scope: ['US', 'EU']
        }
      };

      const request: AIAnalysisRequest = {
        threat_model_id: 'tm_confidence',
        methodology: MethodologyType.STRIDE,
        context: contextData,
        analysis_depth: 'comprehensive'
      };

      mockThreatIntelService.getContextualThreatIntelligence.mockResolvedValue([]);
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await service.analyzeThreatsEnhanced(request);

      // Overall confidence should be high
      expect(result.confidence_metrics.overall_confidence).toBeGreaterThan(0.9);
      
      // Individual threat confidence should be reasonable
      result.generated_threats.forEach(threat => {
        expect(threat.confidence).toBeGreaterThan(0.7);
        expect(threat.likelihood).toBeGreaterThan(0);
        expect(threat.likelihood).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors gracefully', async () => {
      const contextData: ContextualThreatData = {
        system_components: [],
        data_flows: [],
        trust_boundaries: [],
        assets: [],
        existing_controls: [],
        compliance_requirements: [],
        business_context: {
          industry: 'healthcare',
          organization_size: 'small',
          regulatory_environment: [],
          risk_tolerance: 'low',
          business_criticality: 'high',
          geographic_scope: ['US']
        }
      };

      const request: AIAnalysisRequest = {
        threat_model_id: 'tm_error',
        methodology: MethodologyType.STRIDE,
        context: contextData,
        analysis_depth: 'comprehensive'
      };

      mockThreatIntelService.getContextualThreatIntelligence.mockResolvedValue([]);
      mockDb.query.mockRejectedValue(new Error('Database connection failed'));

      await expect(service.analyzeThreatsEnhanced(request)).rejects.toThrow('Database connection failed');
    });

    it('should handle missing threat intelligence gracefully', async () => {
      const contextData: ContextualThreatData = {
        system_components: [],
        data_flows: [],
        trust_boundaries: [],
        assets: [],
        existing_controls: [],
        compliance_requirements: [],
        business_context: {
          industry: 'manufacturing',
          organization_size: 'medium',
          regulatory_environment: [],
          risk_tolerance: 'medium',
          business_criticality: 'medium',
          geographic_scope: ['US']
        }
      };

      const request: AIAnalysisRequest = {
        threat_model_id: 'tm_no_intel',
        methodology: MethodologyType.STRIDE,
        context: contextData,
        analysis_depth: 'comprehensive'
      };

      mockThreatIntelService.getContextualThreatIntelligence.mockResolvedValue([]);
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await service.analyzeThreatsEnhanced(request);

      // Should still provide analysis even without threat intelligence
      expect(result).toBeDefined();
      expect(result.generated_threats).toBeInstanceOf(Array);
      expect(result.confidence_metrics.data_quality_score).toBeLessThan(0.7); // Lower due to missing intelligence
    });
  });
});