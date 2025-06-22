import { elasticsearchService } from './elasticsearch.service';
import { config, getIndexName } from '../config';
import { logger, searchLogger } from '../utils/logger';
import {
  SearchQuery,
  SearchResult,
  SearchFilters,
  SearchSort,
  SearchPagination,
  SearchAggregations,
  SearchSuggestion,
  ContentType,
  AutoCompleteRequest,
  AutoCompleteResponse,
} from '../types';

export class SearchQueryService {
  constructor() {}

  async search<T = any>(
    contentTypes: ContentType[],
    searchQuery: SearchQuery,
    userId?: string,
  ): Promise<SearchResult<T>> {
    const startTime = Date.now();
    
    try {
      const client = elasticsearchService.getClient();
      const indices = contentTypes.map(type => getIndexName(type));
      
      // Build Elasticsearch query
      const esQuery = this.buildElasticsearchQuery(searchQuery);
      
      // Execute search
      const response = await client.search({
        index: indices.join(','),
        body: esQuery,
        timeout: `${config.SEARCH_TIMEOUT}ms`,
      });

      // Transform response
      const result = this.transformSearchResponse<T>(response);
      
      const responseTime = Date.now() - startTime;
      
      // Log search execution
      if (userId && searchQuery.query) {
        searchLogger.queryExecuted(
          searchQuery.query,
          userId,
          result.total.value,
          responseTime
        );
      }

      return result;
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      
      if (userId && searchQuery.query) {
        searchLogger.queryFailed(searchQuery.query, userId, error, responseTime);
      }
      
      throw error;
    }
  }

  async searchSingle<T = any>(
    contentType: ContentType,
    searchQuery: SearchQuery,
    userId?: string,
  ): Promise<SearchResult<T>> {
    return this.search<T>([contentType], searchQuery, userId);
  }

  async getById<T = any>(
    contentType: ContentType,
    id: string,
  ): Promise<T | null> {
    try {
      const client = elasticsearchService.getClient();
      const indexName = getIndexName(contentType);
      
      const response = await client.get({
        index: indexName,
        id,
      });

      return response._source as T;
    } catch (error: any) {
      if (error.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  async getMultipleById<T = any>(
    contentType: ContentType,
    ids: string[],
  ): Promise<Array<{ id: string; source: T | null }>> {
    try {
      const client = elasticsearchService.getClient();
      const indexName = getIndexName(contentType);
      
      const response = await client.mget({
        index: indexName,
        body: {
          ids,
        },
      });

      return response.docs.map((doc: any) => ({
        id: doc._id,
        source: doc.found ? doc._source : null,
      }));
    } catch (error: any) {
      searchLogger.elasticsearchError('get_multiple_by_id', error);
      throw error;
    }
  }

  async autoComplete(request: AutoCompleteRequest): Promise<AutoCompleteResponse> {
    const startTime = Date.now();
    
    try {
      const client = elasticsearchService.getClient();
      const { prefix, context, size = config.SEARCH_SUGGESTION_SIZE } = request;
      
      // Determine indices to search
      const contentTypes = context?.contentTypes || ['threat', 'project', 'threat_model', 'user', 'file', 'report'];
      const indices = contentTypes.map(type => getIndexName(type));
      
      // Build autocomplete query
      const query = {
        size,
        query: {
          bool: {
            must: [
              {
                multi_match: {
                  query: prefix,
                  type: 'bool_prefix',
                  fields: [
                    'title.autocomplete',
                    'name.autocomplete',
                    'firstName.autocomplete',
                    'lastName.autocomplete',
                    'originalName.autocomplete',
                  ],
                },
              },
            ],
            filter: this.buildContextFilters(context),
          },
        },
        _source: ['title', 'name', 'firstName', 'lastName', 'originalName', 'id'],
        highlight: {
          fields: {
            'title.autocomplete': {},
            'name.autocomplete': {},
            'firstName.autocomplete': {},
            'lastName.autocomplete': {},
            'originalName.autocomplete': {},
          },
          pre_tags: ['<mark>'],
          post_tags: ['</mark>'],
        },
      };

      const response = await client.search({
        index: indices.join(','),
        body: query,
      });

      const suggestions = this.transformAutoCompleteResponse(response);
      const responseTime = Date.now() - startTime;
      
      if (request.context?.userId) {
        searchLogger.autoCompleteExecuted(
          prefix,
          request.context.userId,
          suggestions.length,
          responseTime
        );
      }

      return { suggestions };
    } catch (error: any) {
      searchLogger.elasticsearchError('autocomplete', error);
      throw error;
    }
  }

  async suggest(query: string, size: number = 5): Promise<SearchSuggestion[]> {
    try {
      const client = elasticsearchService.getClient();
      const indices = ['threat', 'project', 'threat_model'].map(type => getIndexName(type));
      
      const response = await client.search({
        index: indices.join(','),
        body: {
          size: 0,
          suggest: {
            query_suggestions: {
              text: query,
              term: {
                field: 'title',
                size,
                suggest_mode: 'popular',
                min_word_length: 3,
              },
            },
            phrase_suggestions: {
              text: query,
              phrase: {
                field: 'title',
                size,
                max_errors: 2,
                confidence: 0.5,
                gram_size: 2,
                direct_generator: [
                  {
                    field: 'title',
                    suggest_mode: 'always',
                    min_word_length: 1,
                  },
                ],
              },
            },
          },
        },
      });

      return this.transformSuggestionsResponse(response);
    } catch (error: any) {
      searchLogger.elasticsearchError('suggest', error);
      throw error;
    }
  }

  async moreLikeThis<T = any>(
    contentType: ContentType,
    id: string,
    options: {
      size?: number;
      minTermFreq?: number;
      maxQueryTerms?: number;
    } = {},
  ): Promise<SearchResult<T>> {
    try {
      const client = elasticsearchService.getClient();
      const indexName = getIndexName(contentType);
      
      const {
        size = 10,
        minTermFreq = 1,
        maxQueryTerms = 25,
      } = options;

      const response = await client.search({
        index: indexName,
        body: {
          size,
          query: {
            more_like_this: {
              fields: ['title', 'description', 'name'],
              like: [
                {
                  _index: indexName,
                  _id: id,
                },
              ],
              min_term_freq: minTermFreq,
              max_query_terms: maxQueryTerms,
              min_doc_freq: 1,
              analyzer: 'threat_analyzer',
            },
          },
        },
      });

      return this.transformSearchResponse<T>(response);
    } catch (error: any) {
      searchLogger.elasticsearchError('more_like_this', error);
      throw error;
    }
  }

  async aggregateData(
    contentTypes: ContentType[],
    aggregations: Record<string, any>,
    filters?: SearchFilters,
  ): Promise<SearchAggregations> {
    try {
      const client = elasticsearchService.getClient();
      const indices = contentTypes.map(type => getIndexName(type));
      
      const query = {
        size: 0,
        query: this.buildFilterQuery(filters),
        aggs: aggregations,
      };

      const response = await client.search({
        index: indices.join(','),
        body: query,
      });

      return this.transformAggregationsResponse(response.aggregations || {});
    } catch (error: any) {
      searchLogger.elasticsearchError('aggregate_data', error);
      throw error;
    }
  }

  async count(
    contentTypes: ContentType[],
    filters?: SearchFilters,
  ): Promise<number> {
    try {
      const client = elasticsearchService.getClient();
      const indices = contentTypes.map(type => getIndexName(type));
      
      const response = await client.count({
        index: indices.join(','),
        body: {
          query: this.buildFilterQuery(filters),
        },
      });

      return response.count;
    } catch (error: any) {
      searchLogger.elasticsearchError('count', error);
      throw error;
    }
  }

  async explain(
    contentType: ContentType,
    id: string,
    query: any,
  ): Promise<any> {
    try {
      const indexName = getIndexName(contentType);
      return await elasticsearchService.explain(indexName, id, query);
    } catch (error: any) {
      searchLogger.elasticsearchError('explain', error);
      throw error;
    }
  }

  async validateQuery(
    contentType: ContentType,
    query: any,
  ): Promise<{ valid: boolean; error?: string }> {
    try {
      const indexName = getIndexName(contentType);
      return await elasticsearchService.validateQuery(indexName, query);
    } catch (error: any) {
      searchLogger.elasticsearchError('validate_query', error);
      throw error;
    }
  }

  private buildElasticsearchQuery(searchQuery: SearchQuery): any {
    const query: any = {
      size: this.getSearchSize(searchQuery.pagination),
      from: this.getSearchFrom(searchQuery.pagination),
    };

    // Build main query
    if (searchQuery.query) {
      query.query = this.buildTextQuery(searchQuery.query, searchQuery.filters);
    } else {
      query.query = this.buildFilterQuery(searchQuery.filters);
    }

    // Add sorting
    if (searchQuery.sort && searchQuery.sort.length > 0) {
      query.sort = this.buildSortQuery(searchQuery.sort);
    }

    // Add aggregations
    if (searchQuery.aggregations && searchQuery.aggregations.length > 0) {
      query.aggs = this.buildAggregationsQuery(searchQuery.aggregations);
    }

    // Add highlighting
    if (searchQuery.highlight) {
      query.highlight = this.buildHighlightQuery();
    }

    // Add suggestions
    if (searchQuery.suggest && searchQuery.query) {
      query.suggest = this.buildSuggestQuery(searchQuery.query);
    }

    return query;
  }

  private buildTextQuery(queryText: string, filters?: SearchFilters): any {
    const mustQueries = [
      {
        multi_match: {
          query: queryText,
          type: 'best_fields',
          fields: [
            'title^3',
            'name^3',
            'description^2',
            'mitigation',
            'summary',
            'extractedText',
            'firstName',
            'lastName',
            'originalName',
          ],
          analyzer: 'threat_analyzer',
          fuzziness: 'AUTO',
          prefix_length: 2,
          max_expansions: 50,
        },
      },
    ];

    const filterQueries = this.buildFilterQueries(filters);

    return {
      bool: {
        must: mustQueries,
        filter: filterQueries,
      },
    };
  }

  private buildFilterQuery(filters?: SearchFilters): any {
    const filterQueries = this.buildFilterQueries(filters);
    
    if (filterQueries.length === 0) {
      return { match_all: {} };
    }

    return {
      bool: {
        filter: filterQueries,
      },
    };
  }

  private buildFilterQueries(filters?: SearchFilters): any[] {
    if (!filters) return [];

    const queries: any[] = [];

    // Content type filter (handled at index level)
    // User ID filter
    if (filters.userId) {
      queries.push({ term: { userId: filters.userId } });
    }

    // Project ID filter
    if (filters.projectId) {
      queries.push({ term: { projectId: filters.projectId } });
    }

    // Threat model ID filter
    if (filters.threatModelId) {
      queries.push({ term: { threatModelId: filters.threatModelId } });
    }

    // Severity filter
    if (filters.severity && filters.severity.length > 0) {
      queries.push({ terms: { severity: filters.severity } });
    }

    // Status filter
    if (filters.status && filters.status.length > 0) {
      queries.push({ terms: { status: filters.status } });
    }

    // Tags filter
    if (filters.tags && filters.tags.length > 0) {
      queries.push({ terms: { tags: filters.tags } });
    }

    // Date range filter
    if (filters.dateRange) {
      const dateFilter: any = {
        range: {
          [filters.dateRange.field]: {},
        },
      };

      if (filters.dateRange.from) {
        dateFilter.range[filters.dateRange.field].gte = filters.dateRange.from;
      }

      if (filters.dateRange.to) {
        dateFilter.range[filters.dateRange.field].lte = filters.dateRange.to;
      }

      queries.push(dateFilter);
    }

    // Numeric range filter
    if (filters.numericRange) {
      const numericFilter: any = {
        range: {
          [filters.numericRange.field]: {},
        },
      };

      if (filters.numericRange.min !== undefined) {
        numericFilter.range[filters.numericRange.field].gte = filters.numericRange.min;
      }

      if (filters.numericRange.max !== undefined) {
        numericFilter.range[filters.numericRange.field].lte = filters.numericRange.max;
      }

      queries.push(numericFilter);
    }

    return queries;
  }

  private buildContextFilters(context?: AutoCompleteRequest['context']): any[] {
    if (!context) return [];

    const filters: any[] = [];

    if (context.userId) {
      filters.push({ term: { userId: context.userId } });
    }

    if (context.projectId) {
      filters.push({ term: { projectId: context.projectId } });
    }

    return filters;
  }

  private buildSortQuery(sorts: SearchSort[]): any[] {
    return sorts.map(sort => ({
      [sort.field]: {
        order: sort.order,
        missing: '_last',
      },
    }));
  }

  private buildAggregationsQuery(aggregations: string[]): any {
    const aggs: any = {};

    aggregations.forEach(aggName => {
      switch (aggName) {
        case 'severity':
          aggs.severity = {
            terms: { field: 'severity', size: 10 },
          };
          break;
        case 'status':
          aggs.status = {
            terms: { field: 'status', size: 10 },
          };
          break;
        case 'tags':
          aggs.tags = {
            terms: { field: 'tags', size: 20 },
          };
          break;
        case 'users':
          aggs.users = {
            terms: { field: 'userId', size: 50 },
          };
          break;
        case 'projects':
          aggs.projects = {
            terms: { field: 'projectId', size: 50 },
          };
          break;
        case 'date_histogram':
          aggs.date_histogram = {
            date_histogram: {
              field: 'createdAt',
              calendar_interval: 'day',
            },
          };
          break;
        case 'risk_score_stats':
          aggs.risk_score_stats = {
            stats: { field: 'riskScore' },
          };
          break;
      }
    });

    return aggs;
  }

  private buildHighlightQuery(): any {
    return {
      fields: {
        title: {
          fragment_size: config.SEARCH_HIGHLIGHT_FRAGMENT_SIZE,
          number_of_fragments: 3,
        },
        name: {
          fragment_size: config.SEARCH_HIGHLIGHT_FRAGMENT_SIZE,
          number_of_fragments: 3,
        },
        description: {
          fragment_size: config.SEARCH_HIGHLIGHT_FRAGMENT_SIZE,
          number_of_fragments: 3,
        },
        mitigation: {
          fragment_size: config.SEARCH_HIGHLIGHT_FRAGMENT_SIZE,
          number_of_fragments: 2,
        },
        extractedText: {
          fragment_size: config.SEARCH_HIGHLIGHT_FRAGMENT_SIZE,
          number_of_fragments: 2,
        },
      },
      pre_tags: ['<mark>'],
      post_tags: ['</mark>'],
      encoder: 'html',
    };
  }

  private buildSuggestQuery(queryText: string): any {
    return {
      text: queryText,
      title_suggest: {
        term: {
          field: 'title',
          size: 3,
          suggest_mode: 'popular',
        },
      },
      phrase_suggest: {
        phrase: {
          field: 'title',
          size: 3,
          max_errors: 2,
        },
      },
    };
  }

  private getSearchSize(pagination?: SearchPagination): number {
    if (!pagination) return config.SEARCH_DEFAULT_SIZE;
    return Math.min(pagination.size, config.SEARCH_MAX_SIZE);
  }

  private getSearchFrom(pagination?: SearchPagination): number {
    if (!pagination) return 0;
    if (pagination.from !== undefined) return pagination.from;
    return (pagination.page - 1) * pagination.size;
  }

  private transformSearchResponse<T>(response: any): SearchResult<T> {
    const hits = response.hits.hits.map((hit: any) => ({
      id: hit._id,
      index: hit._index,
      score: hit._score,
      source: hit._source,
      highlight: hit.highlight,
    }));

    return {
      hits,
      total: {
        value: response.hits.total.value,
        relation: response.hits.total.relation,
      },
      maxScore: response.hits.max_score || 0,
      aggregations: this.transformAggregationsResponse(response.aggregations || {}),
      suggestions: this.transformSuggestionsResponse(response),
      took: response.took,
    };
  }

  private transformAggregationsResponse(aggregations: any): SearchAggregations {
    const result: SearchAggregations = {};

    Object.keys(aggregations).forEach(key => {
      const agg = aggregations[key];
      
      if (agg.buckets) {
        result[key] = {
          buckets: agg.buckets.map((bucket: any) => ({
            key: bucket.key,
            docCount: bucket.doc_count,
          })),
        };
      } else if (agg.value !== undefined) {
        result[key] = { value: agg.value };
      } else if (agg.values) {
        result[key] = { values: agg.values };
      }
    });

    return result;
  }

  private transformSuggestionsResponse(response: any): SearchSuggestion[] {
    if (!response.suggest) return [];

    const suggestions: SearchSuggestion[] = [];

    Object.keys(response.suggest).forEach(suggestionKey => {
      const suggestionGroup = response.suggest[suggestionKey];
      
      suggestionGroup.forEach((suggestion: any) => {
        suggestions.push({
          text: suggestion.text,
          offset: suggestion.offset,
          length: suggestion.length,
          options: suggestion.options.map((option: any) => ({
            text: option.text,
            score: option.score,
            freq: option.freq,
          })),
        });
      });
    });

    return suggestions;
  }

  private transformAutoCompleteResponse(response: any): AutoCompleteResponse['suggestions'] {
    if (!response.hits?.hits) return [];

    return response.hits.hits.map((hit: any) => {
      const source = hit._source;
      const highlight = hit.highlight;
      
      // Determine the main text based on content type
      let text = source.title || source.name || source.firstName;
      if (source.firstName && source.lastName) {
        text = `${source.firstName} ${source.lastName}`;
      }
      
      // Use highlighted text if available
      if (highlight) {
        const highlightedField = Object.keys(highlight)[0];
        if (highlightedField && highlight[highlightedField][0]) {
          text = highlight[highlightedField][0].replace(/<\/?mark>/g, '');
        }
      }

      // Determine suggestion type based on index
      let type: 'query' | 'title' | 'tag' | 'user' = 'title';
      if (hit._index.includes('user')) {
        type = 'user';
      } else if (source.tags) {
        type = 'tag';
      }

      return {
        text,
        score: hit._score,
        type,
        metadata: {
          id: source.id,
          contentType: this.extractContentTypeFromIndex(hit._index),
        },
      };
    });
  }

  private extractContentTypeFromIndex(indexName: string): string {
    const parts = indexName.split('_');
    return parts[parts.length - 1];
  }
}

// Export singleton instance
export const searchQueryService = new SearchQueryService();