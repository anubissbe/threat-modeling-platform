import { Client } from '@elastic/elasticsearch';
import { config, getElasticsearchConfig } from '../config';
import { logger, searchLogger } from '../utils/logger';

export class ElasticsearchService {
  private client: Client;
  private isConnected: boolean = false;

  constructor() {
    const esConfig = getElasticsearchConfig();
    this.client = new Client(esConfig);
    
    // Add event listeners
    this.client.on('response', (err, result) => {
      if (err) {
        searchLogger.elasticsearchError('response', err);
      }
    });

    this.client.on('request', (err, result) => {
      if (err) {
        searchLogger.elasticsearchError('request', err);
      }
    });
  }

  async initialize(): Promise<void> {
    try {
      // Test connection
      const response = await this.client.info();
      this.isConnected = true;
      
      searchLogger.elasticsearchConnected(
        config.ELASTICSEARCH_NODE,
        response.version.number
      );

      // Check cluster health
      const health = await this.client.cluster.health();
      searchLogger.clusterHealth(
        health.status,
        health.number_of_nodes,
        health.active_shards
      );

      logger.info('Elasticsearch service initialized successfully');
    } catch (error: any) {
      searchLogger.elasticsearchError('initialize', error);
      throw new Error(`Failed to connect to Elasticsearch: ${error.message}`);
    }
  }

  getClient(): Client {
    if (!this.isConnected) {
      throw new Error('Elasticsearch client not initialized');
    }
    return this.client;
  }

  async ping(): Promise<boolean> {
    try {
      await this.client.ping();
      return true;
    } catch (error) {
      return false;
    }
  }

  async getClusterHealth(): Promise<any> {
    try {
      const health = await this.client.cluster.health();
      return {
        status: health.status,
        numberOfNodes: health.number_of_nodes,
        numberOfDataNodes: health.number_of_data_nodes,
        activeShards: health.active_shards,
        relocatingShards: health.relocating_shards,
        initializingShards: health.initializing_shards,
        unassignedShards: health.unassigned_shards,
        pendingTasks: health.number_of_pending_tasks,
        maxTaskWaitTime: health.task_max_waiting_in_queue_millis,
        activeShardsPercentAsNumber: health.active_shards_percent_as_number,
      };
    } catch (error: any) {
      searchLogger.elasticsearchError('cluster_health', error);
      throw error;
    }
  }

  async getIndexStats(indexName: string): Promise<any> {
    try {
      const stats = await this.client.indices.stats({ index: indexName });
      const indexStats = stats.indices[indexName];
      
      if (!indexStats) {
        throw new Error(`Index ${indexName} not found`);
      }

      return {
        health: indexStats.health,
        status: indexStats.status,
        primaries: {
          docsCount: indexStats.primaries.docs?.count || 0,
          docsDeleted: indexStats.primaries.docs?.deleted || 0,
          storeSize: indexStats.primaries.store?.size_in_bytes || 0,
          indexingCurrent: indexStats.primaries.indexing?.index_current || 0,
          indexingTotal: indexStats.primaries.indexing?.index_total || 0,
          searchCurrent: indexStats.primaries.search?.query_current || 0,
          searchTotal: indexStats.primaries.search?.query_total || 0,
          searchTime: indexStats.primaries.search?.query_time_in_millis || 0,
        },
        total: {
          docsCount: indexStats.total.docs?.count || 0,
          docsDeleted: indexStats.total.docs?.deleted || 0,
          storeSize: indexStats.total.store?.size_in_bytes || 0,
        },
      };
    } catch (error: any) {
      searchLogger.elasticsearchError('index_stats', error);
      throw error;
    }
  }

  async getAllIndices(): Promise<string[]> {
    try {
      const response = await this.client.cat.indices({
        format: 'json',
        h: 'index',
      });

      return response.map((index: any) => index.index)
        .filter((indexName: string) => indexName.startsWith(config.INDEX_PREFIX));
    } catch (error: any) {
      searchLogger.elasticsearchError('get_indices', error);
      throw error;
    }
  }

  async refreshIndex(indexName: string): Promise<void> {
    try {
      await this.client.indices.refresh({ index: indexName });
      logger.debug(`Index refreshed: ${indexName}`);
    } catch (error: any) {
      searchLogger.elasticsearchError('refresh_index', error);
      throw error;
    }
  }

  async flushIndex(indexName: string): Promise<void> {
    try {
      await this.client.indices.flush({ index: indexName });
      logger.debug(`Index flushed: ${indexName}`);
    } catch (error: any) {
      searchLogger.elasticsearchError('flush_index', error);
      throw error;
    }
  }

  async optimizeIndex(indexName: string): Promise<void> {
    try {
      await this.client.indices.forcemerge({
        index: indexName,
        max_num_segments: 1,
      });
      logger.info(`Index optimized: ${indexName}`);
    } catch (error: any) {
      searchLogger.elasticsearchError('optimize_index', error);
      throw error;
    }
  }

  async getIndexMapping(indexName: string): Promise<any> {
    try {
      const response = await this.client.indices.getMapping({ index: indexName });
      return response[indexName]?.mappings || {};
    } catch (error: any) {
      searchLogger.elasticsearchError('get_mapping', error);
      throw error;
    }
  }

  async updateIndexMapping(indexName: string, mapping: any): Promise<void> {
    try {
      await this.client.indices.putMapping({
        index: indexName,
        body: mapping,
      });
      logger.info(`Index mapping updated: ${indexName}`);
    } catch (error: any) {
      searchLogger.elasticsearchError('update_mapping', error);
      throw error;
    }
  }

  async getIndexSettings(indexName: string): Promise<any> {
    try {
      const response = await this.client.indices.getSettings({ index: indexName });
      return response[indexName]?.settings || {};
    } catch (error: any) {
      searchLogger.elasticsearchError('get_settings', error);
      throw error;
    }
  }

  async updateIndexSettings(indexName: string, settings: any): Promise<void> {
    try {
      // Close index before updating settings
      await this.client.indices.close({ index: indexName });
      
      await this.client.indices.putSettings({
        index: indexName,
        body: settings,
      });
      
      // Reopen index
      await this.client.indices.open({ index: indexName });
      
      logger.info(`Index settings updated: ${indexName}`);
    } catch (error: any) {
      searchLogger.elasticsearchError('update_settings', error);
      throw error;
    }
  }

  async createAlias(aliasName: string, indexName: string): Promise<void> {
    try {
      await this.client.indices.putAlias({
        index: indexName,
        name: aliasName,
      });
      searchLogger.aliasCreated(aliasName, indexName);
    } catch (error: any) {
      searchLogger.elasticsearchError('create_alias', error);
      throw error;
    }
  }

  async removeAlias(aliasName: string, indexName: string): Promise<void> {
    try {
      await this.client.indices.deleteAlias({
        index: indexName,
        name: aliasName,
      });
      logger.info(`Alias removed: ${aliasName} from ${indexName}`);
    } catch (error: any) {
      searchLogger.elasticsearchError('remove_alias', error);
      throw error;
    }
  }

  async getAliases(aliasName?: string): Promise<Record<string, any>> {
    try {
      const response = await this.client.indices.getAlias({
        name: aliasName,
      });
      return response;
    } catch (error: any) {
      searchLogger.elasticsearchError('get_aliases', error);
      throw error;
    }
  }

  async reindex(sourceIndex: string, destIndex: string, query?: any): Promise<void> {
    try {
      searchLogger.reindexStarted(sourceIndex, destIndex);
      const startTime = Date.now();

      const reindexBody: any = {
        source: { index: sourceIndex },
        dest: { index: destIndex },
      };

      if (query) {
        reindexBody.source.query = query;
      }

      const response = await this.client.reindex({
        body: reindexBody,
        wait_for_completion: false,
      });

      // Wait for completion
      const taskId = response.task;
      if (taskId) {
        await this.waitForTask(taskId);
      }

      const duration = Date.now() - startTime;
      const stats = await this.getIndexStats(destIndex);
      
      searchLogger.reindexCompleted(
        sourceIndex,
        destIndex,
        stats.primaries.docsCount,
        duration
      );
    } catch (error: any) {
      searchLogger.elasticsearchError('reindex', error);
      throw error;
    }
  }

  private async waitForTask(taskId: string): Promise<void> {
    const maxWaitTime = 300000; // 5 minutes
    const pollInterval = 1000; // 1 second
    let waitTime = 0;

    while (waitTime < maxWaitTime) {
      try {
        const taskResponse = await this.client.tasks.get({ task_id: taskId });
        
        if (taskResponse.completed) {
          if (taskResponse.response?.failures?.length > 0) {
            throw new Error(`Reindex task failed: ${JSON.stringify(taskResponse.response.failures)}`);
          }
          return;
        }

        await new Promise(resolve => setTimeout(resolve, pollInterval));
        waitTime += pollInterval;
      } catch (error: any) {
        if (error.statusCode === 404) {
          // Task completed and was cleaned up
          return;
        }
        throw error;
      }
    }

    throw new Error(`Reindex task ${taskId} did not complete within ${maxWaitTime}ms`);
  }

  async deleteByQuery(indexName: string, query: any): Promise<number> {
    try {
      const response = await this.client.deleteByQuery({
        index: indexName,
        body: { query },
        conflicts: 'proceed',
      });

      const deleted = response.deleted || 0;
      logger.info(`Deleted ${deleted} documents from ${indexName}`);
      return deleted;
    } catch (error: any) {
      searchLogger.elasticsearchError('delete_by_query', error);
      throw error;
    }
  }

  async updateByQuery(indexName: string, query: any, script: any): Promise<number> {
    try {
      const response = await this.client.updateByQuery({
        index: indexName,
        body: {
          query,
          script,
        },
        conflicts: 'proceed',
      });

      const updated = response.updated || 0;
      logger.info(`Updated ${updated} documents in ${indexName}`);
      return updated;
    } catch (error: any) {
      searchLogger.elasticsearchError('update_by_query', error);
      throw error;
    }
  }

  async explain(indexName: string, documentId: string, query: any): Promise<any> {
    try {
      const response = await this.client.explain({
        index: indexName,
        id: documentId,
        body: { query },
      });

      return {
        matched: response.matched,
        explanation: response.explanation,
      };
    } catch (error: any) {
      searchLogger.elasticsearchError('explain', error);
      throw error;
    }
  }

  async validateQuery(indexName: string, query: any): Promise<{ valid: boolean; error?: string }> {
    try {
      await this.client.indices.validateQuery({
        index: indexName,
        body: { query },
        explain: true,
      });

      return { valid: true };
    } catch (error: any) {
      return {
        valid: false,
        error: error.message,
      };
    }
  }

  async close(): Promise<void> {
    try {
      await this.client.close();
      this.isConnected = false;
      logger.info('Elasticsearch service closed');
    } catch (error: any) {
      logger.error('Error closing Elasticsearch service:', error);
    }
  }
}

// Export singleton instance
export const elasticsearchService = new ElasticsearchService();