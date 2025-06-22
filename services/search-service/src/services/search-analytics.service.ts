import { elasticsearchService } from './elasticsearch.service';
import { config, getAnalyticsIndexName } from '../config';
import { logger, searchLogger } from '../utils/logger';
import {
  SearchAnalytics,
  PopularSearch,
  SearchMetrics,
  SearchQuery,
  SearchResult,
} from '../types';

export class SearchAnalyticsService {
  private readonly retentionDays = config.ANALYTICS_RETENTION_DAYS;
  private readonly isEnabled = config.ANALYTICS_ENABLED;

  constructor() {}

  async recordSearch(
    query: string,
    userId: string | undefined,
    filters: any,
    result: SearchResult,
    responseTime: number,
    sessionId?: string,
    ip?: string,
    userAgent?: string,
  ): Promise<void> {
    if (!this.isEnabled) return;

    try {
      const analytics: SearchAnalytics = {
        query,
        userId,
        filters,
        resultsCount: result.total.value,
        responseTime,
        timestamp: new Date().toISOString(),
        sessionId,
        ip,
        userAgent,
      };

      await this.indexAnalytics(analytics);
      
      if (userId) {
        searchLogger.analyticsRecorded(userId, query, result.total.value);
      }
    } catch (error: any) {
      logger.error('Failed to record search analytics:', error);
      // Don't throw error to avoid affecting search functionality
    }
  }

  async recordClickThrough(
    query: string,
    userId: string | undefined,
    clickedResultId: string,
    position: number,
    sessionId?: string,
  ): Promise<void> {
    if (!this.isEnabled) return;

    try {
      // Find the original search record and update it
      const searchRecord = await this.findRecentSearch(query, userId, sessionId);
      
      if (searchRecord) {
        const clickedResults = searchRecord.clickedResults || [];
        clickedResults.push(`${clickedResultId}:${position}`);
        
        await this.updateSearchRecord(searchRecord.id, {
          clickedResults,
        });
      }
    } catch (error: any) {
      logger.error('Failed to record click-through:', error);
    }
  }

  async getPopularSearches(limit: number = 20, timeRange?: { from: string; to: string }): Promise<PopularSearch[]> {
    try {
      const client = elasticsearchService.getClient();
      const indexName = getAnalyticsIndexName();
      
      const query: any = {
        size: 0,
        query: {
          bool: {
            must: [
              { exists: { field: 'query' } },
              { range: { 'query.keyword': { gte: 1 } } }, // Ensure query is not empty
            ],
          },
        },
        aggs: {
          popular_queries: {
            terms: {
              field: 'query.keyword',
              size: limit,
              order: { _count: 'desc' },
            },
            aggs: {
              last_searched: {
                max: { field: 'timestamp' },
              },
            },
          },
        },
      };

      // Add time range filter if provided
      if (timeRange) {
        query.query.bool.must.push({
          range: {
            timestamp: {
              gte: timeRange.from,
              lte: timeRange.to,
            },
          },
        });
      }

      const response = await client.search({
        index: indexName,
        body: query,
      });

      const buckets = response.aggregations?.popular_queries?.buckets || [];
      
      return buckets.map((bucket: any) => ({
        query: bucket.key,
        count: bucket.doc_count,
        lastSearched: bucket.last_searched.value_as_string,
      }));
    } catch (error: any) {
      searchLogger.elasticsearchError('get_popular_searches', error);
      throw error;
    }
  }

  async getSearchMetrics(timeRange?: { from: string; to: string }): Promise<SearchMetrics> {
    try {
      const client = elasticsearchService.getClient();
      const indexName = getAnalyticsIndexName();
      
      const query: any = {
        size: 0,
        query: timeRange
          ? {
              range: {
                timestamp: {
                  gte: timeRange.from,
                  lte: timeRange.to,
                },
              },
            }
          : { match_all: {} },
        aggs: {
          total_searches: {
            value_count: { field: 'query.keyword' },
          },
          unique_users: {
            cardinality: { field: 'userId' },
          },
          avg_response_time: {
            avg: { field: 'responseTime' },
          },
          searches_per_day: {
            date_histogram: {
              field: 'timestamp',
              calendar_interval: 'day',
            },
          },
          no_results_queries: {
            filter: { term: { resultsCount: 0 } },
            aggs: {
              queries: {
                terms: {
                  field: 'query.keyword',
                  size: 50,
                },
              },
            },
          },
          click_through_rate: {
            filter: { exists: { field: 'clickedResults' } },
          },
        },
      };

      const response = await client.search({
        index: indexName,
        body: query,
      });

      const aggs = response.aggregations;
      const totalSearches = aggs.total_searches.value;
      const clickThroughCount = aggs.click_through_rate.doc_count;

      // Get popular searches
      const popularQueries = await this.getPopularSearches(10, timeRange);

      return {
        totalSearches,
        uniqueUsers: aggs.unique_users.value,
        avgResponseTime: Math.round(aggs.avg_response_time.value || 0),
        popularQueries,
        searchesPerDay: aggs.searches_per_day.buckets.map((bucket: any) => ({
          date: bucket.key_as_string.split('T')[0],
          count: bucket.doc_count,
        })),
        noResultsQueries: aggs.no_results_queries.queries.buckets.map((bucket: any) => bucket.key),
        clickThroughRate: totalSearches > 0 ? (clickThroughCount / totalSearches) * 100 : 0,
      };
    } catch (error: any) {
      searchLogger.elasticsearchError('get_search_metrics', error);
      throw error;
    }
  }

  async getUserSearchHistory(
    userId: string,
    limit: number = 50,
    timeRange?: { from: string; to: string },
  ): Promise<SearchAnalytics[]> {
    try {
      const client = elasticsearchService.getClient();
      const indexName = getAnalyticsIndexName();
      
      const query: any = {
        size: limit,
        query: {
          bool: {
            must: [{ term: { userId } }],
          },
        },
        sort: [{ timestamp: { order: 'desc' } }],
      };

      // Add time range filter if provided
      if (timeRange) {
        query.query.bool.must.push({
          range: {
            timestamp: {
              gte: timeRange.from,
              lte: timeRange.to,
            },
          },
        });
      }

      const response = await client.search({
        index: indexName,
        body: query,
      });

      return response.hits.hits.map((hit: any) => hit._source);
    } catch (error: any) {
      searchLogger.elasticsearchError('get_user_search_history', error);
      throw error;
    }
  }

  async getQuerySuggestions(partialQuery: string, limit: number = 10): Promise<string[]> {
    try {
      const client = elasticsearchService.getClient();
      const indexName = getAnalyticsIndexName();
      
      const response = await client.search({
        index: indexName,
        body: {
          size: 0,
          query: {
            bool: {
              must: [
                {
                  wildcard: {
                    'query.keyword': `${partialQuery.toLowerCase()}*`,
                  },
                },
                {
                  range: {
                    resultsCount: { gt: 0 },
                  },
                },
              ],
            },
          },
          aggs: {
            query_suggestions: {
              terms: {
                field: 'query.keyword',
                size: limit,
                order: { _count: 'desc' },
              },
            },
          },
        },
      });

      const buckets = response.aggregations?.query_suggestions?.buckets || [];
      return buckets.map((bucket: any) => bucket.key);
    } catch (error: any) {
      searchLogger.elasticsearchError('get_query_suggestions', error);
      throw error;
    }
  }

  async getSlowQueries(threshold: number = 5000, limit: number = 20): Promise<SearchAnalytics[]> {
    try {
      const client = elasticsearchService.getClient();
      const indexName = getAnalyticsIndexName();
      
      const response = await client.search({
        index: indexName,
        body: {
          size: limit,
          query: {
            range: {
              responseTime: { gte: threshold },
            },
          },
          sort: [{ responseTime: { order: 'desc' } }],
        },
      });

      return response.hits.hits.map((hit: any) => hit._source);
    } catch (error: any) {
      searchLogger.elasticsearchError('get_slow_queries', error);
      throw error;
    }
  }

  async getNoResultsQueries(limit: number = 20, timeRange?: { from: string; to: string }): Promise<PopularSearch[]> {
    try {
      const client = elasticsearchService.getClient();
      const indexName = getAnalyticsIndexName();
      
      const query: any = {
        size: 0,
        query: {
          bool: {
            must: [{ term: { resultsCount: 0 } }],
          },
        },
        aggs: {
          no_results_queries: {
            terms: {
              field: 'query.keyword',
              size: limit,
              order: { _count: 'desc' },
            },
            aggs: {
              last_searched: {
                max: { field: 'timestamp' },
              },
            },
          },
        },
      };

      // Add time range filter if provided
      if (timeRange) {
        query.query.bool.must.push({
          range: {
            timestamp: {
              gte: timeRange.from,
              lte: timeRange.to,
            },
          },
        });
      }

      const response = await client.search({
        index: indexName,
        body: query,
      });

      const buckets = response.aggregations?.no_results_queries?.buckets || [];
      
      return buckets.map((bucket: any) => ({
        query: bucket.key,
        count: bucket.doc_count,
        lastSearched: bucket.last_searched.value_as_string,
      }));
    } catch (error: any) {
      searchLogger.elasticsearchError('get_no_results_queries', error);
      throw error;
    }
  }

  async cleanupOldAnalytics(): Promise<void> {
    try {
      const client = elasticsearchService.getClient();
      const indexName = getAnalyticsIndexName();
      
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);
      
      const deleted = await elasticsearchService.deleteByQuery(indexName, {
        range: {
          timestamp: {
            lt: cutoffDate.toISOString(),
          },
        },
      });

      logger.info(`Cleaned up ${deleted} old analytics records older than ${this.retentionDays} days`);
    } catch (error: any) {
      logger.error('Failed to cleanup old analytics:', error);
      throw error;
    }
  }

  async exportAnalytics(
    timeRange: { from: string; to: string },
    format: 'json' | 'csv' = 'json',
  ): Promise<SearchAnalytics[]> {
    try {
      const client = elasticsearchService.getClient();
      const indexName = getAnalyticsIndexName();
      
      // Use scroll API for large datasets
      const response = await client.search({
        index: indexName,
        scroll: '1m',
        size: 1000,
        body: {
          query: {
            range: {
              timestamp: {
                gte: timeRange.from,
                lte: timeRange.to,
              },
            },
          },
          sort: [{ timestamp: { order: 'desc' } }],
        },
      });

      let allHits: any[] = [...response.hits.hits];
      let scrollId = response._scroll_id;

      // Continue scrolling until all results are fetched
      while (response.hits.hits.length > 0) {
        const scrollResponse = await client.scroll({
          scroll_id: scrollId,
          scroll: '1m',
        });

        if (scrollResponse.hits.hits.length === 0) break;
        
        allHits = [...allHits, ...scrollResponse.hits.hits];
        scrollId = scrollResponse._scroll_id;
      }

      // Clear scroll
      if (scrollId) {
        await client.clearScroll({ scroll_id: scrollId });
      }

      return allHits.map(hit => hit._source);
    } catch (error: any) {
      searchLogger.elasticsearchError('export_analytics', error);
      throw error;
    }
  }

  private async indexAnalytics(analytics: SearchAnalytics): Promise<void> {
    try {
      const client = elasticsearchService.getClient();
      const indexName = getAnalyticsIndexName();
      
      await client.index({
        index: indexName,
        body: analytics,
        refresh: false, // Don't wait for refresh for analytics
      });
    } catch (error: any) {
      searchLogger.elasticsearchError('index_analytics', error);
      throw error;
    }
  }

  private async findRecentSearch(
    query: string,
    userId: string | undefined,
    sessionId?: string,
  ): Promise<{ id: string; clickedResults?: string[] } | null> {
    try {
      const client = elasticsearchService.getClient();
      const indexName = getAnalyticsIndexName();
      
      const mustClauses: any[] = [
        { term: { 'query.keyword': query } },
        {
          range: {
            timestamp: {
              gte: 'now-1h', // Look for searches in the last hour
            },
          },
        },
      ];

      if (userId) {
        mustClauses.push({ term: { userId } });
      }

      if (sessionId) {
        mustClauses.push({ term: { sessionId } });
      }

      const response = await client.search({
        index: indexName,
        body: {
          size: 1,
          query: {
            bool: {
              must: mustClauses,
            },
          },
          sort: [{ timestamp: { order: 'desc' } }],
        },
      });

      const hits = response.hits.hits;
      if (hits.length > 0) {
        return {
          id: hits[0]._id,
          clickedResults: hits[0]._source.clickedResults,
        };
      }

      return null;
    } catch (error: any) {
      searchLogger.elasticsearchError('find_recent_search', error);
      return null;
    }
  }

  private async updateSearchRecord(id: string, updates: Partial<SearchAnalytics>): Promise<void> {
    try {
      const client = elasticsearchService.getClient();
      const indexName = getAnalyticsIndexName();
      
      await client.update({
        index: indexName,
        id,
        body: {
          doc: updates,
        },
      });
    } catch (error: any) {
      searchLogger.elasticsearchError('update_search_record', error);
      throw error;
    }
  }
}

// Export singleton instance
export const searchAnalyticsService = new SearchAnalyticsService();