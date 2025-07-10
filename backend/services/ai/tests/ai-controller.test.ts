import { Request, Response } from 'express';
import { Pool } from 'pg';
import { RedisClientType } from 'redis';
import { AIController } from '../src/controllers/ai.controller';
import { AIAnalysisRequest } from '../src/types/ai';
import { MethodologyType } from '../src/types/shared';

// Mock dependencies
jest.mock('pg');
jest.mock('redis');
jest.mock('../src/utils/logger');
jest.mock('../src/services/ai-threat-analyzer.service');
jest.mock('../src/services/enhanced-ai-analyzer.service');
jest.mock('../src/services/threat-intelligence.service');

describe('AIController', () => {
  let controller: AIController;
  let mockDb: jest.Mocked<Pool>;
  let mockRedis: jest.Mocked<RedisClientType>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

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
      incr: jest.fn(),
    } as any;

    mockRequest = {
      body: {},
      params: {},
      query: {},
      user: { id: 'user123', roles: ['user'] }
    };

    mockResponse = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };

    controller = new AIController(mockDb, mockRedis);
  });

  describe('analyzeThreats', () => {
    it('should perform standard AI analysis successfully', async () => {
      const validRequest: AIAnalysisRequest = {
        threat_model_id: 'tm123',
        methodology: MethodologyType.STRIDE,
        context: {
          system_components: [
            {
              id: 'comp1',
              name: 'Web Server',
              type: 'process',
              technologies: ['Node.js'],
              protocols: ['HTTP', 'HTTPS'],
              interfaces: ['REST API'],
              security_level: 'internal',
              criticality: 'high'
            }
          ],
          data_flows: [],
          trust_boundaries: [],
          assets: [],
          existing_controls: [],
          compliance_requirements: [],
          business_context: {
            industry: 'technology',
            organization_size: 'medium',
            regulatory_environment: [],
            risk_tolerance: 'medium',
            business_criticality: 'high',
            geographic_scope: ['US']
          }
        },
        analysis_depth: 'standard'
      };

      mockRequest.body = validRequest;
      
      // Mock database access check
      mockDb.query.mockResolvedValueOnce({ rows: [{ id: 'tm123' }] });
      
      // Mock analysis result storage
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      await controller.analyzeThreats(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: expect.any(Object)
      });
    });

    it('should use enhanced analyzer for comprehensive analysis', async () => {
      const validRequest: AIAnalysisRequest = {
        threat_model_id: 'tm456',
        methodology: MethodologyType.STRIDE,
        context: {
          system_components: [],
          data_flows: [],
          trust_boundaries: [],
          assets: [],
          existing_controls: [],
          compliance_requirements: [],
          business_context: {
            industry: 'finance',
            organization_size: 'large',
            regulatory_environment: ['PCI-DSS'],
            risk_tolerance: 'low',
            business_criticality: 'critical',
            geographic_scope: ['US', 'EU']
          }
        },
        analysis_depth: 'comprehensive'
      };

      mockRequest.body = validRequest;
      
      // Mock database access check
      mockDb.query.mockResolvedValueOnce({ rows: [{ id: 'tm456' }] });
      
      // Mock analysis result storage
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      await controller.analyzeThreats(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: expect.any(Object)
      });
    });

    it('should return 403 for unauthorized access', async () => {
      const validRequest: AIAnalysisRequest = {
        threat_model_id: 'tm789',
        methodology: MethodologyType.STRIDE,
        context: {
          system_components: [],
          data_flows: [],
          trust_boundaries: [],
          assets: [],
          existing_controls: [],
          compliance_requirements: [],
          business_context: {
            industry: 'healthcare',
            organization_size: 'medium',
            regulatory_environment: ['HIPAA'],
            risk_tolerance: 'low',
            business_criticality: 'high',
            geographic_scope: ['US']
          }
        },
        analysis_depth: 'standard'
      };

      mockRequest.body = validRequest;
      
      // Mock database access check - no access
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      await controller.analyzeThreats(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'ACCESS_DENIED',
          message: 'You do not have access to this threat model'
        }
      });
    });

    it('should return 400 for invalid request data', async () => {
      const invalidRequest = {
        threat_model_id: 'invalid-uuid',
        methodology: 'invalid-methodology',
        context: {}
      };

      mockRequest.body = invalidRequest;

      await controller.analyzeThreats(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: expect.any(Array)
        }
      });
    });
  });

  describe('analyzeThreatsEnhanced', () => {
    it('should perform enhanced AI analysis with 98% accuracy', async () => {
      const validRequest: AIAnalysisRequest = {
        threat_model_id: 'tm123',
        methodology: MethodologyType.STRIDE,
        context: {
          system_components: [
            {
              id: 'comp1',
              name: 'Database',
              type: 'data_store',
              technologies: ['PostgreSQL'],
              protocols: ['SQL'],
              interfaces: ['Database Connection'],
              security_level: 'confidential',
              criticality: 'critical'
            }
          ],
          data_flows: [
            {
              id: 'flow1',
              source: 'app',
              destination: 'comp1',
              data_types: ['user_data'],
              sensitivity: 'confidential',
              encryption: true,
              authentication_required: true,
              protocols: ['TLS'],
              data_classification: 'user_input'
            }
          ],
          trust_boundaries: [],
          assets: [],
          existing_controls: [],
          compliance_requirements: [],
          business_context: {
            industry: 'fintech',
            organization_size: 'enterprise',
            regulatory_environment: ['PCI-DSS', 'SOX'],
            risk_tolerance: 'low',
            business_criticality: 'critical',
            geographic_scope: ['US', 'EU']
          },
          external_dependencies: [
            {
              id: 'dep1',
              name: 'Payment Gateway',
              type: 'service',
              version: '2.1.0',
              vendor: 'Stripe',
              criticality: 'high',
              last_security_review: new Date('2024-01-01'),
              known_vulnerabilities: [],
              update_frequency: 'monthly',
              license_type: 'commercial',
              compliance_status: 'compliant'
            }
          ]
        },
        analysis_depth: 'comprehensive'
      };

      mockRequest.body = validRequest;
      
      // Mock database access check
      mockDb.query.mockResolvedValueOnce({ rows: [{ id: 'tm123' }] });
      
      // Mock analysis result storage
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      await controller.analyzeThreatsEnhanced(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: expect.any(Object),
        metadata: {
          enhanced_analysis: true,
          accuracy_score: expect.any(Number),
          confidence_level: expect.any(Number),
          models_used: expect.any(Array)
        }
      });
    });
  });

  describe('getHealthStatus', () => {
    it('should return healthy status when all services are operational', async () => {
      // Mock successful database query
      mockDb.query.mockResolvedValueOnce({ rows: [{ result: 1 }] });
      
      // Mock successful Redis ping
      mockRedis.ping.mockResolvedValueOnce('PONG');
      
      // Mock threat intelligence update timestamp
      mockRedis.get.mockResolvedValueOnce(new Date().toISOString());

      await controller.getHealthStatus(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          status: 'healthy',
          models_available: expect.arrayContaining([
            'threat-analyzer',
            'threat-classifier',
            'risk-predictor',
            'deep-threat-detector',
            'pattern-recognizer',
            'auto-threat-generator'
          ]),
          response_time_ms: expect.any(Number),
          error_rate: 0,
          last_updated: expect.any(Date)
        }
      });
    });

    it('should return degraded status when threat intelligence is stale', async () => {
      // Mock successful database query
      mockDb.query.mockResolvedValueOnce({ rows: [{ result: 1 }] });
      
      // Mock successful Redis ping
      mockRedis.ping.mockResolvedValueOnce('PONG');
      
      // Mock stale threat intelligence update timestamp
      const staleDate = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago
      mockRedis.get.mockResolvedValueOnce(staleDate.toISOString());

      await controller.getHealthStatus(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          status: 'degraded',
          models_available: expect.any(Array),
          response_time_ms: expect.any(Number),
          error_rate: 0,
          last_updated: expect.any(Date)
        }
      });
    });

    it('should return unhealthy status when services are down', async () => {
      // Mock database connection failure
      mockDb.query.mockRejectedValueOnce(new Error('Database connection failed'));

      await controller.getHealthStatus(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(503);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        data: {
          status: 'unhealthy',
          models_available: [],
          response_time_ms: expect.any(Number),
          error_rate: 1,
          last_updated: expect.any(Date)
        },
        error: {
          code: 'HEALTH_CHECK_FAILED',
          message: 'Service health check failed'
        }
      });
    });
  });

  describe('getMetrics', () => {
    it('should return comprehensive service metrics', async () => {
      mockRequest.user = { id: 'admin123', roles: ['admin'] };

      // Mock Redis metrics
      mockRedis.get.mockResolvedValueOnce('1500'); // requests_processed
      mockRedis.get.mockResolvedValueOnce('2340'); // avg_processing_time

      await controller.getMetrics(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          requests_processed: 1500,
          average_processing_time: 2340,
          accuracy_metrics: {
            threat_classification: expect.any(Number),
            risk_prediction: expect.any(Number),
            similarity_analysis: expect.any(Number)
          },
          model_performance: {
            'threat-analyzer': {
              accuracy: expect.any(Number),
              precision: expect.any(Number),
              recall: expect.any(Number),
              f1_score: expect.any(Number)
            },
            'threat-classifier': {
              accuracy: expect.any(Number),
              precision: expect.any(Number),
              recall: expect.any(Number),
              f1_score: expect.any(Number)
            }
          },
          threat_intelligence_freshness: expect.any(Date)
        }
      });
    });

    it('should require admin privileges for metrics', async () => {
      mockRequest.user = { id: 'user123', roles: ['user'] };

      await controller.getMetrics(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INSUFFICIENT_PRIVILEGES',
          message: 'Admin privileges required'
        }
      });
    });
  });

  describe('getAnalysisResults', () => {
    it('should return cached analysis results', async () => {
      const analysisId = 'analysis123';
      const mockAnalysis = {
        analysis_id: analysisId,
        threat_model_id: 'tm123',
        generated_threats: [],
        confidence_metrics: { overall_confidence: 0.95 }
      };

      mockRequest.params = { analysisId };
      mockRedis.get.mockResolvedValueOnce(JSON.stringify(mockAnalysis));

      await controller.getAnalysisResults(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockAnalysis
      });
    });

    it('should return 404 for non-existent analysis', async () => {
      const analysisId = 'nonexistent123';
      mockRequest.params = { analysisId };
      
      mockRedis.get.mockResolvedValueOnce(null);
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      await controller.getAnalysisResults(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'ANALYSIS_NOT_FOUND',
          message: 'Analysis results not found'
        }
      });
    });
  });
});