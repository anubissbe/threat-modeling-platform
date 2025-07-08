import request from 'supertest';
import express from 'express';
import { createHealthRouter } from '../../src/routes/health';

describe('Health Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use('/health', createHealthRouter());
  });

  describe('GET /health', () => {
    it('should return healthy status when all services are up', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'healthy',
        service: 'integration-service',
        checks: {
          database: expect.any(String),
          redis: expect.any(String),
        },
      });
      expect(response.body.timestamp).toBeDefined();
      expect(response.body.uptime).toBeDefined();
    });
  });

  describe('GET /health/ready', () => {
    it('should return ready when service is ready', async () => {
      const response = await request(app)
        .get('/health/ready')
        .expect(200);

      expect(response.body).toEqual({ ready: true });
    });
  });

  describe('GET /health/live', () => {
    it('should return alive', async () => {
      const response = await request(app)
        .get('/health/live')
        .expect(200);

      expect(response.body).toEqual({ alive: true });
    });
  });
});