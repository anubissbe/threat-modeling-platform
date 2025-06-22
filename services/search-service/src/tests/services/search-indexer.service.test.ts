import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { searchIndexerService, searchQueryService } from '../../services';
import { setupTests, teardownTests, testData } from '../setup';
import { IndexingEvent } from '../../types';

describe('SearchIndexerService', () => {
  beforeAll(async () => {
    await setupTests();
  });

  afterAll(async () => {
    await teardownTests();
  });

  beforeEach(async () => {
    // Clear indices before each test
    await searchIndexerService.clearIndex('threat');
    await searchIndexerService.clearIndex('project');
    await searchIndexerService.clearIndex('user');
  });

  describe('indexContent', () => {
    it('should index a document successfully', async () => {
      const threat = testData.threats[0];
      
      await searchIndexerService.indexContent(threat.id, threat, 'threat');
      
      // Wait for indexing
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const retrieved = await searchQueryService.getById('threat', threat.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(threat.id);
    });

    it('should handle indexing errors gracefully', async () => {
      // Try to index with invalid content type
      await expect(
        searchIndexerService.indexContent('test-id', {}, 'invalid' as any)
      ).rejects.toThrow();
    });
  });

  describe('updateContent', () => {
    it('should update existing document', async () => {
      const threat = testData.threats[0];
      
      // Index initial document
      await searchIndexerService.indexContent(threat.id, threat, 'threat');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Update document
      const updatedThreat = {
        ...threat,
        title: 'Updated SQL Injection Vulnerability',
        status: 'resolved',
      };
      
      await searchIndexerService.updateContent(threat.id, updatedThreat, 'threat');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const retrieved = await searchQueryService.getById('threat', threat.id);
      expect(retrieved?.title).toBe('Updated SQL Injection Vulnerability');
      expect(retrieved?.status).toBe('resolved');
    });

    it('should create document if it does not exist (upsert)', async () => {
      const threat = testData.threats[0];
      
      await searchIndexerService.updateContent(threat.id, threat, 'threat');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const retrieved = await searchQueryService.getById('threat', threat.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(threat.id);
    });
  });

  describe('deleteContent', () => {
    it('should delete existing document', async () => {
      const threat = testData.threats[0];
      
      // Index document
      await searchIndexerService.indexContent(threat.id, threat, 'threat');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Verify it exists
      let retrieved = await searchQueryService.getById('threat', threat.id);
      expect(retrieved).toBeDefined();
      
      // Delete document
      await searchIndexerService.deleteContent(threat.id, 'threat');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Verify it's deleted
      retrieved = await searchQueryService.getById('threat', threat.id);
      expect(retrieved).toBeNull();
    });

    it('should handle deletion of non-existent document', async () => {
      // Should not throw error
      await expect(
        searchIndexerService.deleteContent('non-existent', 'threat')
      ).resolves.not.toThrow();
    });
  });

  describe('bulkIndex', () => {
    it('should index multiple documents', async () => {
      const documents = testData.threats.map(threat => ({
        id: threat.id,
        content: threat,
        contentType: 'threat' as const,
      }));
      
      await searchIndexerService.bulkIndex(documents);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const count = await searchQueryService.count(['threat']);
      expect(count).toBe(2);
    });

    it('should handle empty bulk request', async () => {
      await expect(searchIndexerService.bulkIndex([])).resolves.not.toThrow();
    });
  });

  describe('bulkUpdate', () => {
    it('should update multiple documents', async () => {
      // First index the documents
      const documents = testData.threats.map(threat => ({
        id: threat.id,
        content: threat,
        contentType: 'threat' as const,
      }));
      
      await searchIndexerService.bulkIndex(documents);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Then update them
      const updates = testData.threats.map(threat => ({
        id: threat.id,
        content: { status: 'updated' },
        contentType: 'threat' as const,
      }));
      
      await searchIndexerService.bulkUpdate(updates);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Verify updates
      for (const threat of testData.threats) {
        const retrieved = await searchQueryService.getById('threat', threat.id);
        expect(retrieved?.status).toBe('updated');
      }
    });
  });

  describe('bulkDelete', () => {
    it('should delete multiple documents', async () => {
      // First index the documents
      const documents = testData.threats.map(threat => ({
        id: threat.id,
        content: threat,
        contentType: 'threat' as const,
      }));
      
      await searchIndexerService.bulkIndex(documents);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Verify they exist
      let count = await searchQueryService.count(['threat']);
      expect(count).toBe(2);
      
      // Delete them
      const deletions = testData.threats.map(threat => ({
        id: threat.id,
        contentType: 'threat' as const,
      }));
      
      await searchIndexerService.bulkDelete(deletions);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Verify they're deleted
      count = await searchQueryService.count(['threat']);
      expect(count).toBe(0);
    });
  });

  describe('processIndexingEvent', () => {
    it('should process create event', async () => {
      const event: IndexingEvent = {
        type: 'create',
        contentType: 'threat',
        contentId: 'threat-1',
        content: testData.threats[0],
        timestamp: new Date().toISOString(),
      };
      
      await searchIndexerService.processIndexingEvent(event);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const retrieved = await searchQueryService.getById('threat', 'threat-1');
      expect(retrieved).toBeDefined();
    });

    it('should process update event', async () => {
      const threat = testData.threats[0];
      
      // First create
      await searchIndexerService.indexContent(threat.id, threat, 'threat');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Then update via event
      const event: IndexingEvent = {
        type: 'update',
        contentType: 'threat',
        contentId: threat.id,
        content: { ...threat, title: 'Updated via event' },
        timestamp: new Date().toISOString(),
      };
      
      await searchIndexerService.processIndexingEvent(event);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const retrieved = await searchQueryService.getById('threat', threat.id);
      expect(retrieved?.title).toBe('Updated via event');
    });

    it('should process delete event', async () => {
      const threat = testData.threats[0];
      
      // First create
      await searchIndexerService.indexContent(threat.id, threat, 'threat');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Then delete via event
      const event: IndexingEvent = {
        type: 'delete',
        contentType: 'threat',
        contentId: threat.id,
        timestamp: new Date().toISOString(),
      };
      
      await searchIndexerService.processIndexingEvent(event);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const retrieved = await searchQueryService.getById('threat', threat.id);
      expect(retrieved).toBeNull();
    });
  });

  describe('getIndexingStats', () => {
    it('should return indexing statistics', async () => {
      const stats = await searchIndexerService.getIndexingStats();
      
      expect(stats).toBeDefined();
      expect(typeof stats).toBe('object');
    });

    it('should return stats for specific content type', async () => {
      const stats = await searchIndexerService.getIndexingStats('threat');
      
      expect(stats).toBeDefined();
      expect(stats.threat).toBeDefined();
    });
  });

  describe('refreshIndex', () => {
    it('should refresh index successfully', async () => {
      await expect(
        searchIndexerService.refreshIndex('threat')
      ).resolves.not.toThrow();
    });
  });

  describe('flushIndex', () => {
    it('should flush index successfully', async () => {
      await expect(
        searchIndexerService.flushIndex('threat')
      ).resolves.not.toThrow();
    });
  });

  describe('clearIndex', () => {
    it('should clear all documents from index', async () => {
      // Index some documents
      const documents = testData.threats.map(threat => ({
        id: threat.id,
        content: threat,
        contentType: 'threat' as const,
      }));
      
      await searchIndexerService.bulkIndex(documents);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Verify they exist
      let count = await searchQueryService.count(['threat']);
      expect(count).toBe(2);
      
      // Clear index
      await searchIndexerService.clearIndex('threat');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Verify they're gone
      count = await searchQueryService.count(['threat']);
      expect(count).toBe(0);
    });
  });
});