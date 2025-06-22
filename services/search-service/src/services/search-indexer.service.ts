import { elasticsearchService } from './elasticsearch.service';
import { indexManagerService } from './index-manager.service';
import { config, getIndexName } from '../config';
import { logger, searchLogger } from '../utils/logger';
import {
  ContentType,
  SearchIndexer,
  IndexingEvent,
  SearchableContent,
} from '../types';

export class SearchIndexerService implements SearchIndexer {
  private readonly maxRetries = config.INDEXING_RETRY_ATTEMPTS;
  private readonly retryDelay = config.INDEXING_RETRY_DELAY;

  constructor() {}

  async indexContent(id: string, content: SearchableContent, contentType: ContentType): Promise<void> {
    const startTime = Date.now();
    
    try {
      const client = elasticsearchService.getClient();
      const indexName = getIndexName(contentType);
      
      // Prepare document for indexing
      const document = this.prepareDocument(content, contentType);
      
      await this.retryOperation(async () => {
        await client.index({
          index: indexName,
          id,
          body: document,
          refresh: 'wait_for',
        });
      });

      const duration = Date.now() - startTime;
      searchLogger.documentIndexed(indexName, id, duration);
      
    } catch (error: any) {
      searchLogger.elasticsearchError('index_content', error);
      throw error;
    }
  }

  async updateContent(id: string, content: Partial<SearchableContent>, contentType: ContentType): Promise<void> {
    const startTime = Date.now();
    
    try {
      const client = elasticsearchService.getClient();
      const indexName = getIndexName(contentType);
      
      // Prepare partial document for update
      const document = this.prepareDocument(content, contentType);
      
      await this.retryOperation(async () => {
        await client.update({
          index: indexName,
          id,
          body: {
            doc: document,
            doc_as_upsert: true,
          },
          refresh: 'wait_for',
        });
      });

      const duration = Date.now() - startTime;
      searchLogger.documentUpdated(indexName, id, duration);
      
    } catch (error: any) {
      searchLogger.elasticsearchError('update_content', error);
      throw error;
    }
  }

  async deleteContent(id: string, contentType: ContentType): Promise<void> {
    try {
      const client = elasticsearchService.getClient();
      const indexName = getIndexName(contentType);
      
      await this.retryOperation(async () => {
        await client.delete({
          index: indexName,
          id,
          refresh: 'wait_for',
        });
      });

      searchLogger.documentDeleted(indexName, id);
      
    } catch (error: any) {
      if (error.statusCode === 404) {
        logger.warn(`Document ${id} not found in ${contentType} index`);
        return;
      }
      searchLogger.elasticsearchError('delete_content', error);
      throw error;
    }
  }

  async bulkIndex(documents: Array<{ id: string; content: SearchableContent; contentType: ContentType }>): Promise<void> {
    const startTime = Date.now();
    
    try {
      const client = elasticsearchService.getClient();
      
      // Split documents into batches
      const batchSize = config.BULK_INDEX_SIZE;
      const batches = this.chunkArray(documents, batchSize);
      
      let totalSuccessCount = 0;
      let totalFailureCount = 0;

      for (const batch of batches) {
        const body: any[] = [];
        
        // Build bulk request body
        batch.forEach(({ id, content, contentType }) => {
          const indexName = getIndexName(contentType);
          const document = this.prepareDocument(content, contentType);
          
          body.push({
            index: {
              _index: indexName,
              _id: id,
            },
          });
          body.push(document);
        });

        // Execute bulk request
        const response = await this.retryOperation(async () => {
          return await client.bulk({
            body,
            refresh: 'wait_for',
          });
        });

        // Process results
        const batchResults = this.processBulkResponse(response, batch);
        totalSuccessCount += batchResults.successCount;
        totalFailureCount += batchResults.failureCount;
      }

      const duration = Date.now() - startTime;
      const indexName = documents[0] ? getIndexName(documents[0].contentType) : 'mixed';
      searchLogger.bulkIndexed(indexName, totalSuccessCount, totalFailureCount, duration);
      
    } catch (error: any) {
      searchLogger.elasticsearchError('bulk_index', error);
      throw error;
    }
  }

  async bulkUpdate(updates: Array<{ id: string; content: Partial<SearchableContent>; contentType: ContentType }>): Promise<void> {
    const startTime = Date.now();
    
    try {
      const client = elasticsearchService.getClient();
      
      // Split updates into batches
      const batchSize = config.BULK_INDEX_SIZE;
      const batches = this.chunkArray(updates, batchSize);
      
      let totalSuccessCount = 0;
      let totalFailureCount = 0;

      for (const batch of batches) {
        const body: any[] = [];
        
        // Build bulk request body
        batch.forEach(({ id, content, contentType }) => {
          const indexName = getIndexName(contentType);
          const document = this.prepareDocument(content, contentType);
          
          body.push({
            update: {
              _index: indexName,
              _id: id,
            },
          });
          body.push({
            doc: document,
            doc_as_upsert: true,
          });
        });

        // Execute bulk request
        const response = await this.retryOperation(async () => {
          return await client.bulk({
            body,
            refresh: 'wait_for',
          });
        });

        // Process results
        const batchResults = this.processBulkResponse(response, batch);
        totalSuccessCount += batchResults.successCount;
        totalFailureCount += batchResults.failureCount;
      }

      const duration = Date.now() - startTime;
      const indexName = updates[0] ? getIndexName(updates[0].contentType) : 'mixed';
      searchLogger.bulkIndexed(indexName, totalSuccessCount, totalFailureCount, duration);
      
    } catch (error: any) {
      searchLogger.elasticsearchError('bulk_update', error);
      throw error;
    }
  }

  async bulkDelete(deletions: Array<{ id: string; contentType: ContentType }>): Promise<void> {
    try {
      const client = elasticsearchService.getClient();
      
      // Split deletions into batches
      const batchSize = config.BULK_INDEX_SIZE;
      const batches = this.chunkArray(deletions, batchSize);

      for (const batch of batches) {
        const body: any[] = [];
        
        // Build bulk request body
        batch.forEach(({ id, contentType }) => {
          const indexName = getIndexName(contentType);
          
          body.push({
            delete: {
              _index: indexName,
              _id: id,
            },
          });
        });

        // Execute bulk request
        await this.retryOperation(async () => {
          return await client.bulk({
            body,
            refresh: 'wait_for',
          });
        });
      }
      
    } catch (error: any) {
      searchLogger.elasticsearchError('bulk_delete', error);
      throw error;
    }
  }

  async reindex(contentType?: ContentType): Promise<void> {
    try {
      if (contentType) {
        await this.reindexSingle(contentType);
      } else {
        await this.reindexAll();
      }
    } catch (error: any) {
      logger.error(`Failed to reindex ${contentType || 'all content'}:`, error);
      throw error;
    }
  }

  async refreshIndex(contentType: ContentType): Promise<void> {
    try {
      const indexName = getIndexName(contentType);
      await elasticsearchService.refreshIndex(indexName);
    } catch (error: any) {
      searchLogger.elasticsearchError('refresh_index', error);
      throw error;
    }
  }

  async flushIndex(contentType: ContentType): Promise<void> {
    try {
      const indexName = getIndexName(contentType);
      await elasticsearchService.flushIndex(indexName);
    } catch (error: any) {
      searchLogger.elasticsearchError('flush_index', error);
      throw error;
    }
  }

  async processIndexingEvent(event: IndexingEvent): Promise<void> {
    const startTime = Date.now();
    
    try {
      switch (event.type) {
        case 'create':
          if (event.content) {
            await this.indexContent(event.contentId, event.content, event.contentType as ContentType);
          }
          break;
        case 'update':
          if (event.content) {
            await this.updateContent(event.contentId, event.content, event.contentType as ContentType);
          }
          break;
        case 'delete':
          await this.deleteContent(event.contentId, event.contentType as ContentType);
          break;
        default:
          logger.warn(`Unknown indexing event type: ${event.type}`);
      }

      const duration = Date.now() - startTime;
      searchLogger.contentSynchronized(
        event.contentType,
        event.contentId,
        event.type,
        duration
      );
      
    } catch (error: any) {
      logger.error(`Failed to process indexing event:`, { event, error: error.message });
      throw error;
    }
  }

  async clearIndex(contentType: ContentType): Promise<void> {
    try {
      const client = elasticsearchService.getClient();
      const indexName = getIndexName(contentType);
      
      await client.deleteByQuery({
        index: indexName,
        body: {
          query: { match_all: {} },
        },
        refresh: true,
      });

      logger.info(`Cleared all documents from ${contentType} index`);
    } catch (error: any) {
      searchLogger.elasticsearchError('clear_index', error);
      throw error;
    }
  }

  async getIndexingStats(contentType?: ContentType): Promise<any> {
    try {
      const contentTypes = contentType 
        ? [contentType] 
        : await indexManagerService.getAllContentTypes();

      const stats: any = {};

      for (const type of contentTypes) {
        const indexName = getIndexName(type);
        try {
          const indexStats = await elasticsearchService.getIndexStats(indexName);
          stats[type] = {
            docsCount: indexStats.primaries.docsCount,
            storeSize: indexStats.primaries.storeSize,
            indexingTotal: indexStats.primaries.indexingTotal,
            indexingCurrent: indexStats.primaries.indexingCurrent,
            searchTotal: indexStats.primaries.searchTotal,
            searchCurrent: indexStats.primaries.searchCurrent,
          };
        } catch (error) {
          stats[type] = { error: error.message };
        }
      }

      return stats;
    } catch (error: any) {
      logger.error('Failed to get indexing stats:', error);
      throw error;
    }
  }

  private async reindexSingle(contentType: ContentType): Promise<void> {
    logger.info(`Starting reindex for content type: ${contentType}`);
    
    try {
      // Recreate the index with latest mapping
      await indexManagerService.recreateIndex(contentType);
      
      // Here you would typically fetch data from the source database
      // and reindex it. This is a placeholder for that logic.
      logger.info(`Reindex completed for content type: ${contentType}`);
    } catch (error: any) {
      logger.error(`Failed to reindex ${contentType}:`, error);
      throw error;
    }
  }

  private async reindexAll(): Promise<void> {
    logger.info('Starting reindex for all content types');
    
    try {
      const contentTypes = await indexManagerService.getAllContentTypes();
      
      for (const contentType of contentTypes) {
        await this.reindexSingle(contentType);
      }
      
      logger.info('Reindex completed for all content types');
    } catch (error: any) {
      logger.error('Failed to reindex all content:', error);
      throw error;
    }
  }

  private prepareDocument(content: any, contentType: ContentType): any {
    const document = { ...content };
    
    // Add common fields
    document.contentType = contentType;
    document.indexedAt = new Date().toISOString();
    
    // Content-specific preparation
    switch (contentType) {
      case 'threat':
        document.riskScore = this.calculateRiskScore(document.likelihood, document.impact);
        break;
      case 'user':
        // Remove sensitive fields
        delete document.password;
        delete document.resetToken;
        break;
      case 'file':
        // Ensure extractedText is searchable
        if (document.extractedText) {
          document.extractedText = this.cleanExtractedText(document.extractedText);
        }
        break;
    }
    
    // Clean up null/undefined values
    Object.keys(document).forEach(key => {
      if (document[key] === null || document[key] === undefined) {
        delete document[key];
      }
    });
    
    return document;
  }

  private calculateRiskScore(likelihood?: number, impact?: number): number {
    if (likelihood === undefined || impact === undefined) return 0;
    return (likelihood * impact) / 25; // Normalize to 0-1 scale
  }

  private cleanExtractedText(text: string): string {
    // Remove excessive whitespace and control characters
    return text
      .replace(/\s+/g, ' ')
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      .trim();
  }

  private async retryOperation<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;
        
        if (attempt === this.maxRetries) {
          throw error;
        }
        
        // Check if error is retryable
        if (!this.isRetryableError(error)) {
          throw error;
        }
        
        // Wait before retry
        await this.delay(this.retryDelay * attempt);
        logger.debug(`Retrying operation, attempt ${attempt + 1}/${this.maxRetries}`);
      }
    }
    
    throw lastError!;
  }

  private isRetryableError(error: any): boolean {
    // Retry on connection errors, timeouts, and 5xx status codes
    return (
      error.code === 'ECONNREFUSED' ||
      error.code === 'ENOTFOUND' ||
      error.code === 'ETIMEDOUT' ||
      error.name === 'ConnectionError' ||
      error.name === 'TimeoutError' ||
      (error.statusCode && error.statusCode >= 500)
    );
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  private processBulkResponse(response: any, batch: any[]): { successCount: number; failureCount: number } {
    let successCount = 0;
    let failureCount = 0;
    
    if (response.errors) {
      response.items.forEach((item: any, index: number) => {
        const operation = Object.keys(item)[0];
        const result = item[operation];
        
        if (result.error) {
          failureCount++;
          logger.error(`Bulk operation failed for document ${batch[index]?.id}:`, result.error);
        } else {
          successCount++;
        }
      });
    } else {
      successCount = batch.length;
    }
    
    return { successCount, failureCount };
  }
}

// Export singleton instance
export const searchIndexerService = new SearchIndexerService();