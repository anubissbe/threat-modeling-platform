import request from 'supertest';
import express from 'express';
import { ThreatModelController } from '../../src/controllers/threat-model.controller';
import { ThreatModelService } from '../../src/services/threat-model.service';
import { ValidationError, NotFoundError } from '../../src/utils/errors';

// Mock the ThreatModelService
jest.mock('../../src/services/threat-model.service');
const MockedThreatModelService = ThreatModelService as jest.MockedClass<typeof ThreatModelService>;

describe('ThreatModelController', () => {
  let app: express.Application;
  let threatModelController: ThreatModelController;
  let mockThreatModelService: jest.Mocked<ThreatModelService>;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    
    // Mock authentication middleware
    app.use((req, res, next) => {
      req.user = { id: 'user-1', email: 'test@example.com', role: 'user' };
      next();
    });
    
    mockThreatModelService = new MockedThreatModelService() as jest.Mocked<ThreatModelService>;
    threatModelController = new ThreatModelController();
    
    // Replace the service instance
    (threatModelController as any).threatModelService = mockThreatModelService;
    
    app.get('/threat-models', threatModelController.getThreatModels.bind(threatModelController));
    app.post('/threat-models', threatModelController.createThreatModel.bind(threatModelController));
    app.get('/threat-models/:id', threatModelController.getThreatModel.bind(threatModelController));
    app.put('/threat-models/:id', threatModelController.updateThreatModel.bind(threatModelController));
    app.delete('/threat-models/:id', threatModelController.deleteThreatModel.bind(threatModelController));
  });

  describe('POST /threat-models', () => {
    const validThreatModelData = {
      name: 'E-commerce Security Model',
      description: 'Comprehensive threat model for e-commerce platform',
      methodology: 'STRIDE',
      version: '1.0.0'
    };

    it('should create a new threat model successfully', async () => {
      const mockThreatModel = {
        id: 'tm-1',
        ...validThreatModelData,
        user_id: 'user-1',
        status: 'draft',
        created_at: new Date(),
        updated_at: new Date()
      };
      
      mockThreatModelService.createThreatModel.mockResolvedValue(mockThreatModel);

      const response = await request(app)
        .post('/threat-models')
        .send(validThreatModelData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.threatModel).toEqual(mockThreatModel);
      expect(mockThreatModelService.createThreatModel).toHaveBeenCalledWith(
        'user-1',
        validThreatModelData
      );
    });

    it('should return 400 for invalid data', async () => {
      const response = await request(app)
        .post('/threat-models')
        .send({ name: '' }); // Invalid: empty name

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('required');
    });

    it('should return 400 for duplicate name', async () => {
      mockThreatModelService.createThreatModel.mockRejectedValue(
        new ValidationError('Threat model with this name already exists')
      );

      const response = await request(app)
        .post('/threat-models')
        .send(validThreatModelData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('already exists');
    });

    it('should handle service errors', async () => {
      mockThreatModelService.createThreatModel.mockRejectedValue(
        new Error('Database connection failed')
      );

      const response = await request(app)
        .post('/threat-models')
        .send(validThreatModelData);

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /threat-models', () => {
    it('should return user threat models successfully', async () => {
      const mockThreatModels = [
        {
          id: 'tm-1',
          name: 'Model 1',
          description: 'First model',
          user_id: 'user-1',
          status: 'draft',
          methodology: 'STRIDE',
          version: '1.0.0',
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          id: 'tm-2',
          name: 'Model 2',
          description: 'Second model',
          user_id: 'user-1',
          status: 'published',
          methodology: 'PASTA',
          version: '2.0.0',
          created_at: new Date(),
          updated_at: new Date()
        }
      ];
      
      mockThreatModelService.getThreatModelsByUser.mockResolvedValue(mockThreatModels);

      const response = await request(app)
        .get('/threat-models');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.threatModels).toEqual(mockThreatModels);
      expect(response.body.threatModels).toHaveLength(2);
      expect(mockThreatModelService.getThreatModelsByUser).toHaveBeenCalledWith('user-1');
    });

    it('should return empty array when no threat models exist', async () => {
      mockThreatModelService.getThreatModelsByUser.mockResolvedValue([]);

      const response = await request(app)
        .get('/threat-models');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.threatModels).toEqual([]);
    });

    it('should handle service errors', async () => {
      mockThreatModelService.getThreatModelsByUser.mockRejectedValue(
        new Error('Database error')
      );

      const response = await request(app)
        .get('/threat-models');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /threat-models/:id', () => {
    const threatModelId = 'tm-1';

    it('should return threat model with details successfully', async () => {
      const mockThreatModel = {
        id: threatModelId,
        name: 'Test Model',
        description: 'Test description',
        user_id: 'user-1',
        status: 'draft',
        methodology: 'STRIDE',
        version: '1.0.0',
        created_at: new Date(),
        updated_at: new Date(),
        components: [global.mockComponent],
        threats: [global.mockThreat],
        dataFlows: [global.mockDataFlow]
      };
      
      mockThreatModelService.getThreatModelWithDetails.mockResolvedValue(mockThreatModel);

      const response = await request(app)
        .get(`/threat-models/${threatModelId}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.threatModel).toEqual(mockThreatModel);
      expect(mockThreatModelService.getThreatModelWithDetails).toHaveBeenCalledWith(
        threatModelId,
        'user-1'
      );
    });

    it('should return 404 for non-existent threat model', async () => {
      mockThreatModelService.getThreatModelWithDetails.mockRejectedValue(
        new NotFoundError('Threat model not found')
      );

      const response = await request(app)
        .get(`/threat-models/${threatModelId}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('not found');
    });

    it('should return 403 for unauthorized access', async () => {
      mockThreatModelService.getThreatModelWithDetails.mockRejectedValue(
        new Error('Access denied')
      );

      const response = await request(app)
        .get(`/threat-models/${threatModelId}`);

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /threat-models/:id', () => {
    const threatModelId = 'tm-1';
    const updateData = {
      name: 'Updated Model Name',
      description: 'Updated description',
      status: 'published'
    };

    it('should update threat model successfully', async () => {
      const mockUpdatedThreatModel = {
        id: threatModelId,
        ...updateData,
        user_id: 'user-1',
        methodology: 'STRIDE',
        version: '1.1.0',
        created_at: new Date(),
        updated_at: new Date()
      };
      
      mockThreatModelService.updateThreatModel.mockResolvedValue(mockUpdatedThreatModel);

      const response = await request(app)
        .put(`/threat-models/${threatModelId}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.threatModel).toEqual(mockUpdatedThreatModel);
      expect(mockThreatModelService.updateThreatModel).toHaveBeenCalledWith(
        threatModelId,
        'user-1',
        updateData
      );
    });

    it('should return 404 for non-existent threat model', async () => {
      mockThreatModelService.updateThreatModel.mockRejectedValue(
        new NotFoundError('Threat model not found')
      );

      const response = await request(app)
        .put(`/threat-models/${threatModelId}`)
        .send(updateData);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it('should return 400 for invalid update data', async () => {
      mockThreatModelService.updateThreatModel.mockRejectedValue(
        new ValidationError('Invalid status value')
      );

      const response = await request(app)
        .put(`/threat-models/${threatModelId}`)
        .send({ status: 'invalid-status' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /threat-models/:id', () => {
    const threatModelId = 'tm-1';

    it('should delete threat model successfully', async () => {
      mockThreatModelService.deleteThreatModel.mockResolvedValue(undefined);

      const response = await request(app)
        .delete(`/threat-models/${threatModelId}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Threat model deleted successfully');
      expect(mockThreatModelService.deleteThreatModel).toHaveBeenCalledWith(
        threatModelId,
        'user-1'
      );
    });

    it('should return 404 for non-existent threat model', async () => {
      mockThreatModelService.deleteThreatModel.mockRejectedValue(
        new NotFoundError('Threat model not found')
      );

      const response = await request(app)
        .delete(`/threat-models/${threatModelId}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it('should handle cascading delete errors', async () => {
      mockThreatModelService.deleteThreatModel.mockRejectedValue(
        new Error('Failed to delete related components')
      );

      const response = await request(app)
        .delete(`/threat-models/${threatModelId}`);

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });
});