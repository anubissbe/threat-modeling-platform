import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { buildApp } from '../../app';
import { setupTests, teardownTests, testData, mockUser } from '../setup';
import { searchIndexerService } from '../../services';
import jwt from 'jsonwebtoken';
import { config } from '../../config';

describe('SearchController', () => {
  let app: any;
  let authToken: string;

  beforeAll(async () => {
    await setupTests();
    app = await buildApp();
    
    // Create auth token
    authToken = jwt.sign(mockUser, config.JWT_SECRET, { expiresIn: '1h' });
  });

  afterAll(async () => {
    await app.close();
    await teardownTests();
  });

  beforeEach(async () => {
    // Index test data
    for (const threat of testData.threats) {
      await searchIndexerService.indexContent(threat.id, threat, 'threat');
    }
    
    for (const project of testData.projects) {
      await searchIndexerService.indexContent(project.id, project, 'project');
    }
    
    for (const user of testData.users) {
      await searchIndexerService.indexContent(user.id, user, 'user');
    }

    // Wait for indexing
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  describe('POST /api/v1/search', () => {
    it('should perform basic search', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/search',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          query: 'SQL injection',
          contentTypes: ['threat'],
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data.hits).toHaveLength(1);
      expect(data.data.hits[0].source.title).toContain('SQL Injection');
    });

    it('should search without authentication for public content', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/search',
        payload: {
          query: 'John',
          contentTypes: ['user'], // Users are public searchable
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
    });

    it('should require authentication for restricted content', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/search',
        payload: {
          query: 'SQL injection',
          contentTypes: ['threat'], // Threats require auth
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should apply filters', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/search',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          contentTypes: ['threat'],
          filters: {
            severity: ['high'],
          },
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.data.hits).toHaveLength(1);
      expect(data.data.hits[0].source.severity).toBe('high');
    });

    it('should handle pagination', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/search',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          contentTypes: ['threat'],
          pagination: {
            page: 1,
            size: 1,
          },
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.data.hits).toHaveLength(1);
    });

    it('should return aggregations when requested', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/search',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          contentTypes: ['threat'],
          aggregations: ['severity', 'status'],
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.data.aggregations).toBeDefined();
    });

    it('should validate request body', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/search',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          contentTypes: ['invalid-type'],
        },
      });

      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Validation Error');
    });
  });

  describe('POST /api/v1/search/bulk', () => {
    it('should execute multiple searches', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/search/bulk',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          queries: [
            {
              query: 'SQL injection',
              contentTypes: ['threat'],
            },
            {
              query: 'platform',
              contentTypes: ['project'],
            },
          ],
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data.results).toHaveLength(2);
      expect(data.meta.successfulQueries).toBe(2);
    });

    it('should limit bulk queries', async () => {
      const queries = Array(11).fill({
        query: 'test',
        contentTypes: ['threat'],
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/search/bulk',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: { queries },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /api/v1/search/autocomplete', () => {
    it('should provide autocomplete suggestions', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/search/autocomplete?prefix=SQL',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data.suggestions.length).toBeGreaterThan(0);
    });

    it('should require prefix parameter', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/search/autocomplete',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /api/v1/:contentType/:id', () => {
    it('should get document by ID', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/threat/threat-1',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data.id).toBe('threat-1');
    });

    it('should return 404 for non-existent document', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/threat/non-existent',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/threat/threat-1',
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('POST /api/v1/more-like-this', () => {
    it('should find similar content', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/more-like-this',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          contentType: 'threat',
          id: 'threat-1',
          size: 5,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data.hits).toBeDefined();
    });

    it('should validate request body', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/more-like-this',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          contentType: 'invalid',
          id: 'test',
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('POST /api/v1/click-through', () => {
    it('should record click-through', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/click-through',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          query: 'SQL injection',
          resultId: 'threat-1',
          position: 0,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.message).toBe('Click-through recorded');
    });

    it('should validate required fields', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/click-through',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          query: 'SQL injection',
          // Missing resultId and position
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /api/v1/search/count', () => {
    it('should count documents', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/search/count?contentTypes=threat',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data.count).toBe(2);
    });
  });

  describe('GET /api/v1/search/suggest', () => {
    it('should provide query suggestions', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/search/suggest?query=SQL inject',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data.suggestions).toBeDefined();
    });

    it('should require query parameter', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/search/suggest',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });
});