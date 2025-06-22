import { FastifyInstance } from 'fastify';
import { createApp } from '../../src/app';

describe('Health API', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/ai/health', () => {
    it('should return health status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/ai/health',
      });

      expect(response.statusCode).toBe(200);
      
      const body = JSON.parse(response.body);
      expect(body.status).toBe('healthy');
      expect(body.models).toBeDefined();
      expect(body.cache).toBeDefined();
      expect(body.timestamp).toBeDefined();
    });
  });

  describe('GET /', () => {
    it('should return service information', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/',
      });

      expect(response.statusCode).toBe(200);
      
      const body = JSON.parse(response.body);
      expect(body.service).toBe('AI/ML Service');
      expect(body.version).toBe('1.0.0');
      expect(body.status).toBe('running');
      expect(body.endpoints).toBeDefined();
      expect(body.endpoints.analysis).toBe('/api/ai/analyze');
      expect(body.endpoints.health).toBe('/api/ai/health');
    });
  });
});