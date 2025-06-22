import { elasticsearchService } from './elasticsearch.service';
import { config, getIndexName, getIndexSettings, getContentTypeMappings } from '../config';
import { logger, searchLogger } from '../utils/logger';
import { ContentType, IndexConfig } from '../types';

export class IndexManagerService {
  private contentTypes: ContentType[] = [
    'threat',
    'project', 
    'threat_model',
    'user',
    'file',
    'report'
  ];

  constructor() {}

  async initialize(): Promise<void> {
    try {
      logger.info('Initializing index manager...');
      
      // Create indices for all content types
      for (const contentType of this.contentTypes) {
        await this.createIndexIfNotExists(contentType);
      }

      // Create analytics index
      await this.createAnalyticsIndex();

      logger.info('Index manager initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize index manager:', error);
      throw error;
    }
  }

  async createIndexIfNotExists(contentType: ContentType): Promise<void> {
    const indexName = getIndexName(contentType);
    
    try {
      const client = elasticsearchService.getClient();
      
      // Check if index exists
      const exists = await client.indices.exists({ index: indexName });
      
      if (exists) {
        logger.debug(`Index already exists: ${indexName}`);
        return;
      }

      // Create index
      await this.createIndex(contentType);
    } catch (error: any) {
      searchLogger.elasticsearchError('create_index_if_not_exists', error);
      throw error;
    }
  }

  async createIndex(contentType: ContentType): Promise<void> {
    const startTime = Date.now();
    const indexName = getIndexName(contentType);
    
    try {
      const client = elasticsearchService.getClient();
      const mappings = getContentTypeMappings();
      const settings = getIndexSettings();

      const indexConfig: IndexConfig = {
        name: indexName,
        mappings: mappings[contentType],
        settings,
      };

      await client.indices.create({
        index: indexName,
        body: {
          settings: indexConfig.settings,
          mappings: indexConfig.mappings,
        },
      });

      const duration = Date.now() - startTime;
      searchLogger.indexCreated(indexName, duration);

      // Create alias
      const aliasName = `${config.INDEX_PREFIX}_${contentType}`;
      await elasticsearchService.createAlias(aliasName, indexName);

    } catch (error: any) {
      searchLogger.elasticsearchError('create_index', error);
      throw error;
    }
  }

  async deleteIndex(contentType: ContentType): Promise<void> {
    const indexName = getIndexName(contentType);
    
    try {
      const client = elasticsearchService.getClient();
      
      const exists = await client.indices.exists({ index: indexName });
      if (!exists) {
        logger.warn(`Index does not exist: ${indexName}`);
        return;
      }

      await client.indices.delete({ index: indexName });
      searchLogger.indexDeleted(indexName);

    } catch (error: any) {
      searchLogger.elasticsearchError('delete_index', error);
      throw error;
    }
  }

  async recreateIndex(contentType: ContentType): Promise<void> {
    logger.info(`Recreating index for content type: ${contentType}`);
    
    try {
      // Create new index with timestamp
      const timestamp = Date.now();
      const newIndexName = `${getIndexName(contentType)}_${timestamp}`;
      
      // Create new index
      await this.createIndexWithName(contentType, newIndexName);
      
      // Reindex data from old index to new index
      const oldIndexName = getIndexName(contentType);
      const oldExists = await elasticsearchService.getClient().indices.exists({ index: oldIndexName });
      
      if (oldExists) {
        await elasticsearchService.reindex(oldIndexName, newIndexName);
        await elasticsearchService.deleteIndex(oldIndexName);
      }

      // Update alias to point to new index
      const aliasName = `${config.INDEX_PREFIX}_${contentType}`;
      await elasticsearchService.createAlias(aliasName, newIndexName);

      logger.info(`Index recreated successfully: ${contentType}`);
    } catch (error: any) {
      logger.error(`Failed to recreate index for ${contentType}:`, error);
      throw error;
    }
  }

  private async createIndexWithName(contentType: ContentType, indexName: string): Promise<void> {
    const startTime = Date.now();
    
    try {
      const client = elasticsearchService.getClient();
      const mappings = getContentTypeMappings();
      const settings = getIndexSettings();

      await client.indices.create({
        index: indexName,
        body: {
          settings,
          mappings: mappings[contentType],
        },
      });

      const duration = Date.now() - startTime;
      searchLogger.indexCreated(indexName, duration);

    } catch (error: any) {
      searchLogger.elasticsearchError('create_index_with_name', error);
      throw error;
    }
  }

  async createAnalyticsIndex(): Promise<void> {
    const indexName = `${config.ANALYTICS_INDEX_PREFIX}_${config.NODE_ENV}`;
    
    try {
      const client = elasticsearchService.getClient();
      
      const exists = await client.indices.exists({ index: indexName });
      if (exists) {
        logger.debug(`Analytics index already exists: ${indexName}`);
        return;
      }

      const analyticsMapping = {
        dynamic: false,
        properties: {
          query: {
            type: 'text',
            fields: {
              keyword: { type: 'keyword' },
            },
          },
          userId: { type: 'keyword' },
          filters: { type: 'object' },
          resultsCount: { type: 'integer' },
          responseTime: { type: 'integer' },
          clickedResults: { type: 'keyword' },
          timestamp: { type: 'date' },
          sessionId: { type: 'keyword' },
          ip: { type: 'ip' },
          userAgent: {
            type: 'text',
            fields: {
              keyword: { type: 'keyword' },
            },
          },
        },
      };

      await client.indices.create({
        index: indexName,
        body: {
          settings: {
            number_of_shards: 1,
            number_of_replicas: 0,
            refresh_interval: '30s',
          },
          mappings: analyticsMapping,
        },
      });

      searchLogger.indexCreated(indexName, 0);

    } catch (error: any) {
      searchLogger.elasticsearchError('create_analytics_index', error);
      throw error;
    }
  }

  async updateIndexMapping(contentType: ContentType, newMapping: any): Promise<void> {
    const indexName = getIndexName(contentType);
    
    try {
      await elasticsearchService.updateIndexMapping(indexName, newMapping);
      searchLogger.mappingUpdated(indexName, 'dynamic', 'updated');
    } catch (error: any) {
      logger.error(`Failed to update mapping for ${contentType}:`, error);
      throw error;
    }
  }

  async optimizeAllIndices(): Promise<void> {
    logger.info('Starting index optimization...');
    
    try {
      for (const contentType of this.contentTypes) {
        const indexName = getIndexName(contentType);
        await elasticsearchService.optimizeIndex(indexName);
      }
      
      logger.info('All indices optimized successfully');
    } catch (error: any) {
      logger.error('Failed to optimize indices:', error);
      throw error;
    }
  }

  async getIndexHealth(contentType?: ContentType): Promise<any[]> {
    try {
      const indices = contentType 
        ? [getIndexName(contentType)]
        : this.contentTypes.map(type => getIndexName(type));

      const healthData = [];

      for (const indexName of indices) {
        try {
          const stats = await elasticsearchService.getIndexStats(indexName);
          searchLogger.indexHealthCheck(
            indexName,
            stats.health || 'unknown',
            stats.primaries.docsCount,
            `${Math.round(stats.primaries.storeSize / 1024 / 1024)}MB`
          );

          healthData.push({
            indexName,
            status: stats.health || 'unknown',
            docsCount: stats.primaries.docsCount,
            storeSize: stats.primaries.storeSize,
            searchTotal: stats.primaries.searchTotal,
            indexingTotal: stats.primaries.indexingTotal,
          });
        } catch (error) {
          healthData.push({
            indexName,
            status: 'error',
            error: error.message,
          });
        }
      }

      return healthData;
    } catch (error: any) {
      logger.error('Failed to get index health:', error);
      throw error;
    }
  }

  async reindexAllContent(): Promise<void> {
    logger.info('Starting reindex of all content...');
    
    try {
      for (const contentType of this.contentTypes) {
        await this.recreateIndex(contentType);
      }
      
      logger.info('All content reindexed successfully');
    } catch (error: any) {
      logger.error('Failed to reindex all content:', error);
      throw error;
    }
  }

  async createSnapshot(repositoryName: string, snapshotName: string): Promise<void> {
    try {
      const client = elasticsearchService.getClient();
      
      const indices = this.contentTypes.map(type => getIndexName(type));
      
      await client.snapshot.create({
        repository: repositoryName,
        snapshot: snapshotName,
        body: {
          indices: indices.join(','),
          ignore_unavailable: true,
          include_global_state: false,
          metadata: {
            taken_by: 'search-service',
            taken_because: 'scheduled_backup',
            timestamp: new Date().toISOString(),
          },
        },
      });

      logger.info(`Snapshot created: ${snapshotName} in repository ${repositoryName}`);
    } catch (error: any) {
      searchLogger.elasticsearchError('create_snapshot', error);
      throw error;
    }
  }

  async restoreSnapshot(repositoryName: string, snapshotName: string): Promise<void> {
    try {
      const client = elasticsearchService.getClient();
      
      await client.snapshot.restore({
        repository: repositoryName,
        snapshot: snapshotName,
        body: {
          ignore_unavailable: true,
          include_global_state: false,
        },
      });

      logger.info(`Snapshot restored: ${snapshotName} from repository ${repositoryName}`);
    } catch (error: any) {
      searchLogger.elasticsearchError('restore_snapshot', error);
      throw error;
    }
  }

  async listSnapshots(repositoryName: string): Promise<any[]> {
    try {
      const client = elasticsearchService.getClient();
      
      const response = await client.snapshot.get({
        repository: repositoryName,
        snapshot: '_all',
      });

      return response.snapshots || [];
    } catch (error: any) {
      searchLogger.elasticsearchError('list_snapshots', error);
      throw error;
    }
  }

  async deleteSnapshot(repositoryName: string, snapshotName: string): Promise<void> {
    try {
      const client = elasticsearchService.getClient();
      
      await client.snapshot.delete({
        repository: repositoryName,
        snapshot: snapshotName,
      });

      logger.info(`Snapshot deleted: ${snapshotName} from repository ${repositoryName}`);
    } catch (error: any) {
      searchLogger.elasticsearchError('delete_snapshot', error);
      throw error;
    }
  }

  async getAllContentTypes(): Promise<ContentType[]> {
    return [...this.contentTypes];
  }

  async getIndexStatistics(): Promise<any> {
    try {
      const stats = {
        totalIndices: 0,
        totalDocuments: 0,
        totalSizeBytes: 0,
        indices: {},
      };

      for (const contentType of this.contentTypes) {
        const indexName = getIndexName(contentType);
        try {
          const indexStats = await elasticsearchService.getIndexStats(indexName);
          stats.totalIndices++;
          stats.totalDocuments += indexStats.primaries.docsCount;
          stats.totalSizeBytes += indexStats.primaries.storeSize;
          
          stats.indices[contentType] = {
            docsCount: indexStats.primaries.docsCount,
            storeSize: indexStats.primaries.storeSize,
            searchTotal: indexStats.primaries.searchTotal,
            indexingTotal: indexStats.primaries.indexingTotal,
          };
        } catch (error) {
          stats.indices[contentType] = { error: error.message };
        }
      }

      return stats;
    } catch (error: any) {
      logger.error('Failed to get index statistics:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const indexManagerService = new IndexManagerService();