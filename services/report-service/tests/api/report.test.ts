import { FastifyInstance } from 'fastify';
import { createApp } from '../../src/app';

describe('Report API', () => {
  let app: FastifyInstance;
  let authToken: string;

  beforeAll(async () => {
    app = await createApp();
    await app.ready();
    
    // Mock auth token
    authToken = 'Bearer mock-jwt-token';
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/reports/generate', () => {
    it('should queue report generation job', async () => {
      const reportRequest = global.testUtils.generateMockReportRequest();

      const response = await app.inject({
        method: 'POST',
        url: '/api/reports/generate',
        headers: {
          authorization: authToken,
        },
        payload: reportRequest,
      });

      expect(response.statusCode).toBe(200);
      
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.jobId).toBeDefined();
      expect(body.status).toBe('pending');
    });

    it('should validate report type', async () => {
      const invalidRequest = {
        type: 'invalid-type',
        format: 'pdf',
        projectId: 'test-project',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/reports/generate',
        headers: {
          authorization: authToken,
        },
        payload: invalidRequest,
      });

      expect(response.statusCode).toBe(400);
      
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error).toContain('Invalid report type');
    });

    it('should validate report format', async () => {
      const invalidRequest = {
        type: 'threat-model',
        format: 'invalid-format',
        projectId: 'test-project',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/reports/generate',
        headers: {
          authorization: authToken,
        },
        payload: invalidRequest,
      });

      expect(response.statusCode).toBe(400);
      
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error).toContain('Invalid report format');
    });
  });

  describe('GET /api/reports/health', () => {
    it('should return health status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/reports/health',
      });

      expect(response.statusCode).toBe(200);
      
      const body = JSON.parse(response.body);
      expect(body.status).toBe('healthy');
      expect(body.timestamp).toBeDefined();
      expect(body.uptime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('GET /api/reports/status/:jobId', () => {
    it('should return job status', async () => {
      const jobId = 'test-job-id';

      const response = await app.inject({
        method: 'GET',
        url: `/api/reports/status/${jobId}`,
        headers: {
          authorization: authToken,
        },
      });

      // In mock, job doesn't exist
      expect(response.statusCode).toBe(404);
    });
  });

  describe('Authentication', () => {
    it('should require authentication for report generation', async () => {
      const reportRequest = global.testUtils.generateMockReportRequest();

      const response = await app.inject({
        method: 'POST',
        url: '/api/reports/generate',
        payload: reportRequest,
      });

      expect(response.statusCode).toBe(401);
      
      const body = JSON.parse(response.body);
      expect(body.error).toContain('Authorization header missing');
    });
  });
});