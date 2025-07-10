import request from 'supertest';
import express from 'express';
import { TMACParser, TMACValidator, TMACAnalyzer } from '../../src/tmac-core-inline';
import path from 'path';
import fs from 'fs';

// Mock the tmac-core module
jest.mock('@threatmodeling/tmac-core');

describe('TMAC Service Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Create a fresh Express app for each test
    app = express();
    app.use(express.json());
    
    // Import and setup routes
    const routes = require('../../src/index');
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(app).get('/health');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('service', 'tmac-service');
      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('POST /api/tmac/parse', () => {
    it('should parse a valid YAML file', async () => {
      const mockModel = {
        version: '1.0.0',
        metadata: { name: 'Test Model' },
        system: { name: 'Test System' },
        dataFlows: [],
        threats: []
      };

      (TMACParser.parse as jest.Mock).mockReturnValue(mockModel);

      const response = await request(app)
        .post('/api/tmac/parse')
        .attach('file', Buffer.from('test content'), 'test.yaml')
        .field('format', 'yaml');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('model', mockModel);
      expect(response.body).toHaveProperty('format', 'yaml');
      expect(TMACParser.parse).toHaveBeenCalledWith('test content', 'yaml');
    });

    it('should parse a valid JSON file', async () => {
      const mockModel = {
        version: '1.0.0',
        metadata: { name: 'Test Model' },
        system: { name: 'Test System' },
        dataFlows: [],
        threats: []
      };

      (TMACParser.parse as jest.Mock).mockReturnValue(mockModel);

      const response = await request(app)
        .post('/api/tmac/parse')
        .attach('file', Buffer.from('{"test": "content"}'), 'test.json')
        .field('format', 'json');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('model', mockModel);
      expect(response.body).toHaveProperty('format', 'json');
      expect(TMACParser.parse).toHaveBeenCalledWith('{"test": "content"}', 'json');
    });

    it('should return 400 when no file is provided', async () => {
      const response = await request(app)
        .post('/api/tmac/parse')
        .field('format', 'yaml');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'No file uploaded');
    });

    it('should handle parsing errors', async () => {
      (TMACParser.parse as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid YAML syntax');
      });

      const response = await request(app)
        .post('/api/tmac/parse')
        .attach('file', Buffer.from('invalid: [yaml'), 'test.yaml');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Invalid YAML syntax');
    });
  });

  describe('POST /api/tmac/validate', () => {
    it('should validate a valid model', async () => {
      const mockModel = {
        version: '1.0.0',
        metadata: { name: 'Test Model' },
        system: { name: 'Test System' },
        dataFlows: [],
        threats: []
      };

      const mockValidationResult = {
        valid: true,
        errors: [],
        warnings: []
      };

      (TMACParser.parse as jest.Mock).mockReturnValue(mockModel);
      (TMACValidator.validate as jest.Mock).mockResolvedValue(mockValidationResult);

      const response = await request(app)
        .post('/api/tmac/validate')
        .attach('file', Buffer.from('test content'), 'test.yaml');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('validation', mockValidationResult);
      expect(response.body).toHaveProperty('model', mockModel);
    });

    it('should return validation errors', async () => {
      const mockModel = {
        version: '1.0.0',
        metadata: {},
        system: {},
        dataFlows: [],
        threats: []
      };

      const mockValidationResult = {
        valid: false,
        errors: ['metadata.name is required', 'system.name is required'],
        warnings: ['No threats defined']
      };

      (TMACParser.parse as jest.Mock).mockReturnValue(mockModel);
      (TMACValidator.validate as jest.Mock).mockResolvedValue(mockValidationResult);

      const response = await request(app)
        .post('/api/tmac/validate')
        .attach('file', Buffer.from('test content'), 'test.yaml');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('validation', mockValidationResult);
      expect(response.body.validation.valid).toBe(false);
      expect(response.body.validation.errors).toHaveLength(2);
    });
  });

  describe('POST /api/tmac/analyze', () => {
    it('should analyze a threat model', async () => {
      const mockModel = {
        version: '1.0.0',
        metadata: { name: 'Test Model' },
        system: { 
          name: 'Test System',
          components: [{ id: 'web', name: 'Web App', type: 'web_application' }]
        },
        dataFlows: [],
        threats: [
          { id: 'T1', component: 'web', category: 'spoofing', severity: 'high' }
        ]
      };

      const mockAnalysisResult = {
        summary: {
          totalComponents: 1,
          totalThreats: 1,
          criticalThreats: 0,
          highThreats: 1,
          unmitigatedThreats: 1,
          coveragePercentage: 16.67,
          riskScore: 65
        },
        findings: [
          {
            type: 'security',
            severity: 'high',
            title: 'Unmitigated High Severity Threat',
            description: 'Threat T1 has no mitigations'
          }
        ],
        recommendations: [
          {
            priority: 'high',
            title: 'Add Mitigations',
            description: 'Implement mitigations for high severity threats'
          }
        ]
      };

      (TMACParser.parse as jest.Mock).mockReturnValue(mockModel);
      (TMACAnalyzer.analyze as jest.Mock).mockReturnValue(mockAnalysisResult);

      const response = await request(app)
        .post('/api/tmac/analyze')
        .attach('file', Buffer.from('test content'), 'test.yaml');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('analysis', mockAnalysisResult);
      expect(response.body).toHaveProperty('model', mockModel);
    });
  });

  describe('POST /api/tmac/convert', () => {
    it('should convert YAML to JSON', async () => {
      const mockModel = {
        version: '1.0.0',
        metadata: { name: 'Test Model' },
        system: { name: 'Test System' },
        dataFlows: [],
        threats: []
      };

      (TMACParser.parse as jest.Mock).mockReturnValue(mockModel);
      (TMACParser.stringify as jest.Mock).mockReturnValue('{"converted": "json"}');

      const response = await request(app)
        .post('/api/tmac/convert')
        .attach('file', Buffer.from('yaml content'), 'test.yaml')
        .field('format', 'json');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('content', '{"converted": "json"}');
      expect(response.body).toHaveProperty('format', 'json');
      expect(TMACParser.stringify).toHaveBeenCalledWith(mockModel, 'json');
    });

    it('should convert JSON to YAML', async () => {
      const mockModel = {
        version: '1.0.0',
        metadata: { name: 'Test Model' },
        system: { name: 'Test System' },
        dataFlows: [],
        threats: []
      };

      (TMACParser.parse as jest.Mock).mockReturnValue(mockModel);
      (TMACParser.stringify as jest.Mock).mockReturnValue('converted: yaml');

      const response = await request(app)
        .post('/api/tmac/convert')
        .attach('file', Buffer.from('{"json": "content"}'), 'test.json')
        .field('format', 'yaml');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('content', 'converted: yaml');
      expect(response.body).toHaveProperty('format', 'yaml');
      expect(TMACParser.stringify).toHaveBeenCalledWith(mockModel, 'yaml');
    });
  });

  describe('POST /api/tmac/merge', () => {
    it('should merge multiple threat models', async () => {
      const mockModel1 = {
        version: '1.0.0',
        metadata: { name: 'Model 1' },
        system: { name: 'System 1' },
        dataFlows: [],
        threats: [{ id: 'T1', severity: 'high' }]
      };

      const mockModel2 = {
        version: '1.0.0',
        metadata: { name: 'Model 2' },
        system: { name: 'System 2' },
        dataFlows: [],
        threats: [{ id: 'T2', severity: 'medium' }]
      };

      const mockMergedModel = {
        version: '1.0.0',
        metadata: { name: 'Merged Model' },
        system: { name: 'Merged System' },
        dataFlows: [],
        threats: [
          { id: 'T1', severity: 'high' },
          { id: 'T2', severity: 'medium' }
        ]
      };

      (TMACParser.parse as jest.Mock)
        .mockReturnValueOnce(mockModel1)
        .mockReturnValueOnce(mockModel2);
      (TMACParser.merge as jest.Mock).mockReturnValue(mockMergedModel);

      const response = await request(app)
        .post('/api/tmac/merge')
        .attach('files', Buffer.from('model1'), 'model1.yaml')
        .attach('files', Buffer.from('model2'), 'model2.yaml');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('merged', mockMergedModel);
      expect(response.body).toHaveProperty('fileCount', 2);
      expect(TMACParser.merge).toHaveBeenCalledWith([mockModel1, mockModel2]);
    });

    it('should return error when less than 2 files provided', async () => {
      const response = await request(app)
        .post('/api/tmac/merge')
        .attach('files', Buffer.from('model1'), 'model1.yaml');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'At least 2 files required for merging');
    });
  });

  describe('Error handling', () => {
    it('should handle internal server errors gracefully', async () => {
      (TMACParser.parse as jest.Mock).mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      const response = await request(app)
        .post('/api/tmac/parse')
        .attach('file', Buffer.from('test'), 'test.yaml');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });
});