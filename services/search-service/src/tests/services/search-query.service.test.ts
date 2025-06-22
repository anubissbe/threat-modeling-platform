import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { searchQueryService, searchIndexerService } from '../../services';
import { setupTests, teardownTests, testData } from '../setup';
import { ContentType } from '../../types';

describe('SearchQueryService', () => {
  beforeAll(async () => {
    await setupTests();
  });

  afterAll(async () => {
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

    // Wait for indexing to complete
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  describe('search', () => {
    it('should perform basic text search', async () => {
      const result = await searchQueryService.search(
        ['threat'],
        { query: 'SQL injection' },
        'user-1'
      );

      expect(result.hits).toHaveLength(1);
      expect(result.hits[0].source.title).toContain('SQL Injection');
      expect(result.total.value).toBe(1);
    });

    it('should search across multiple content types', async () => {
      const result = await searchQueryService.search(
        ['threat', 'project'],
        { query: 'platform' },
        'user-1'
      );

      expect(result.hits.length).toBeGreaterThan(0);
      expect(result.total.value).toBeGreaterThan(0);
    });

    it('should apply filters correctly', async () => {
      const result = await searchQueryService.search(
        ['threat'],
        {
          filters: {
            severity: ['high'],
            status: ['open'],
          },
        },
        'user-1'
      );

      expect(result.hits).toHaveLength(1);
      expect(result.hits[0].source.severity).toBe('high');
      expect(result.hits[0].source.status).toBe('open');
    });

    it('should handle pagination', async () => {
      const result = await searchQueryService.search(
        ['threat'],
        {
          pagination: {
            page: 1,
            size: 1,
          },
        },
        'user-1'
      );

      expect(result.hits).toHaveLength(1);
    });

    it('should include aggregations when requested', async () => {
      const result = await searchQueryService.search(
        ['threat'],
        {
          aggregations: ['severity', 'status'],
        },
        'user-1'
      );

      expect(result.aggregations).toBeDefined();
      expect(result.aggregations?.severity).toBeDefined();
      expect(result.aggregations?.status).toBeDefined();
    });

    it('should return highlights when enabled', async () => {
      const result = await searchQueryService.search(
        ['threat'],
        {
          query: 'SQL injection',
          highlight: true,
        },
        'user-1'
      );

      expect(result.hits[0].highlight).toBeDefined();
    });

    it('should apply sorting', async () => {
      const result = await searchQueryService.search(
        ['threat'],
        {
          sort: [{ field: 'createdAt', order: 'desc' }],
        },
        'user-1'
      );

      expect(result.hits).toHaveLength(2);
      // Second threat was created later
      expect(result.hits[0].source.id).toBe('threat-2');
    });
  });

  describe('getById', () => {
    it('should retrieve document by ID', async () => {
      const result = await searchQueryService.getById('threat', 'threat-1');

      expect(result).toBeDefined();
      expect(result?.id).toBe('threat-1');
      expect(result?.title).toContain('SQL Injection');
    });

    it('should return null for non-existent document', async () => {
      const result = await searchQueryService.getById('threat', 'non-existent');

      expect(result).toBeNull();
    });
  });

  describe('autoComplete', () => {
    it('should provide autocomplete suggestions', async () => {
      const result = await searchQueryService.autoComplete({
        prefix: 'SQL',
        context: {
          contentTypes: ['threat'],
        },
      });

      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(result.suggestions[0].text).toContain('SQL');
    });

    it('should limit suggestions by size', async () => {
      const result = await searchQueryService.autoComplete({
        prefix: 'e',
        size: 1,
      });

      expect(result.suggestions).toHaveLength(1);
    });
  });

  describe('moreLikeThis', () => {
    it('should find similar content', async () => {
      const result = await searchQueryService.moreLikeThis(
        'threat',
        'threat-1',
        { size: 5 }
      );

      expect(result).toBeDefined();
      expect(result.hits).toBeDefined();
    });
  });

  describe('count', () => {
    it('should count documents', async () => {
      const count = await searchQueryService.count(['threat']);

      expect(count).toBe(2);
    });

    it('should count with filters', async () => {
      const count = await searchQueryService.count(
        ['threat'],
        { severity: ['high'] }
      );

      expect(count).toBe(1);
    });
  });

  describe('suggest', () => {
    it('should provide query suggestions', async () => {
      const suggestions = await searchQueryService.suggest('SQL inject');

      expect(suggestions).toBeDefined();
      expect(Array.isArray(suggestions)).toBe(true);
    });
  });

  describe('aggregateData', () => {
    it('should perform aggregations', async () => {
      const aggregations = {
        severity_terms: {
          terms: { field: 'severity' },
        },
      };

      const result = await searchQueryService.aggregateData(
        ['threat'],
        aggregations
      );

      expect(result.severity_terms).toBeDefined();
      expect(result.severity_terms.buckets).toBeDefined();
    });
  });

  describe('explain', () => {
    it('should explain query scoring', async () => {
      const query = {
        match: { title: 'SQL injection' },
      };

      const explanation = await searchQueryService.explain(
        'threat',
        'threat-1',
        query
      );

      expect(explanation).toBeDefined();
      expect(explanation.matched).toBeDefined();
    });
  });

  describe('validateQuery', () => {
    it('should validate correct query', async () => {
      const query = {
        match: { title: 'test' },
      };

      const validation = await searchQueryService.validateQuery('threat', query);

      expect(validation.valid).toBe(true);
    });

    it('should detect invalid query', async () => {
      const query = {
        invalid_query_type: { title: 'test' },
      };

      const validation = await searchQueryService.validateQuery('threat', query);

      expect(validation.valid).toBe(false);
      expect(validation.error).toBeDefined();
    });
  });
});