import pino from 'pino';
import { config } from '../config';

// Create base logger
export const logger = pino({
  level: config.LOG_LEVEL,
  transport: config.LOG_PRETTY && config.NODE_ENV !== 'production'
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
  base: {
    service: 'search-service',
    env: config.NODE_ENV,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  serializers: {
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
    err: pino.stdSerializers.err,
  },
});

// Search-specific logger functions
export const searchLogger = {
  queryExecuted: (query: string, userId: string, resultsCount: number, responseTime: number) => {
    logger.info({
      event: 'search.query.executed',
      query,
      userId,
      resultsCount,
      responseTime,
      timestamp: new Date().toISOString(),
    }, `Search executed: "${query}" returned ${resultsCount} results in ${responseTime}ms`);
  },

  queryFailed: (query: string, userId: string, error: Error, responseTime: number) => {
    logger.error({
      event: 'search.query.failed',
      query,
      userId,
      error: error.message,
      stack: error.stack,
      responseTime,
      timestamp: new Date().toISOString(),
    }, `Search failed: "${query}" - ${error.message}`);
  },

  indexCreated: (indexName: string, duration: number) => {
    logger.info({
      event: 'search.index.created',
      indexName,
      duration,
      timestamp: new Date().toISOString(),
    }, `Index created: ${indexName} in ${duration}ms`);
  },

  indexDeleted: (indexName: string) => {
    logger.info({
      event: 'search.index.deleted',
      indexName,
      timestamp: new Date().toISOString(),
    }, `Index deleted: ${indexName}`);
  },

  documentIndexed: (indexName: string, documentId: string, duration: number) => {
    logger.debug({
      event: 'search.document.indexed',
      indexName,
      documentId,
      duration,
      timestamp: new Date().toISOString(),
    }, `Document indexed: ${documentId} in ${indexName} (${duration}ms)`);
  },

  documentUpdated: (indexName: string, documentId: string, duration: number) => {
    logger.debug({
      event: 'search.document.updated',
      indexName,
      documentId,
      duration,
      timestamp: new Date().toISOString(),
    }, `Document updated: ${documentId} in ${indexName} (${duration}ms)`);
  },

  documentDeleted: (indexName: string, documentId: string) => {
    logger.debug({
      event: 'search.document.deleted',
      indexName,
      documentId,
      timestamp: new Date().toISOString(),
    }, `Document deleted: ${documentId} from ${indexName}`);
  },

  bulkIndexed: (indexName: string, successCount: number, failureCount: number, duration: number) => {
    logger.info({
      event: 'search.bulk.indexed',
      indexName,
      successCount,
      failureCount,
      totalCount: successCount + failureCount,
      duration,
      timestamp: new Date().toISOString(),
    }, `Bulk index: ${successCount} succeeded, ${failureCount} failed in ${indexName} (${duration}ms)`);
  },

  reindexStarted: (sourceIndex: string, targetIndex: string) => {
    logger.info({
      event: 'search.reindex.started',
      sourceIndex,
      targetIndex,
      timestamp: new Date().toISOString(),
    }, `Reindex started: ${sourceIndex} -> ${targetIndex}`);
  },

  reindexCompleted: (sourceIndex: string, targetIndex: string, totalDocs: number, duration: number) => {
    logger.info({
      event: 'search.reindex.completed',
      sourceIndex,
      targetIndex,
      totalDocs,
      duration,
      timestamp: new Date().toISOString(),
    }, `Reindex completed: ${sourceIndex} -> ${targetIndex} (${totalDocs} docs in ${duration}ms)`);
  },

  autoCompleteExecuted: (prefix: string, userId: string, suggestionsCount: number, responseTime: number) => {
    logger.debug({
      event: 'search.autocomplete.executed',
      prefix,
      userId,
      suggestionsCount,
      responseTime,
      timestamp: new Date().toISOString(),
    }, `Autocomplete: "${prefix}" returned ${suggestionsCount} suggestions in ${responseTime}ms`);
  },

  suggestionGenerated: (query: string, suggestion: string, score: number) => {
    logger.debug({
      event: 'search.suggestion.generated',
      query,
      suggestion,
      score,
      timestamp: new Date().toISOString(),
    }, `Suggestion generated: "${query}" -> "${suggestion}" (score: ${score})`);
  },

  elasticsearchConnected: (node: string, version: string) => {
    logger.info({
      event: 'elasticsearch.connected',
      node,
      version,
      timestamp: new Date().toISOString(),
    }, `Connected to Elasticsearch: ${node} (version: ${version})`);
  },

  elasticsearchError: (operation: string, error: Error) => {
    logger.error({
      event: 'elasticsearch.error',
      operation,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    }, `Elasticsearch error during ${operation}: ${error.message}`);
  },

  aggregationExecuted: (aggregationType: string, fieldName: string, bucketsCount: number, duration: number) => {
    logger.debug({
      event: 'search.aggregation.executed',
      aggregationType,
      fieldName,
      bucketsCount,
      duration,
      timestamp: new Date().toISOString(),
    }, `Aggregation executed: ${aggregationType} on ${fieldName} (${bucketsCount} buckets in ${duration}ms)`);
  },

  filterApplied: (filterType: string, filterValue: any, resultsCount: number) => {
    logger.debug({
      event: 'search.filter.applied',
      filterType,
      filterValue,
      resultsCount,
      timestamp: new Date().toISOString(),
    }, `Filter applied: ${filterType}=${filterValue} (${resultsCount} results)`);
  },

  performanceMetric: (operation: string, duration: number, metadata?: any) => {
    logger.debug({
      event: 'search.performance',
      operation,
      duration,
      metadata,
      timestamp: new Date().toISOString(),
    }, `Performance: ${operation} took ${duration}ms`);
  },

  analyticsRecorded: (userId: string, query: string, resultCount: number) => {
    logger.debug({
      event: 'search.analytics.recorded',
      userId,
      query,
      resultCount,
      timestamp: new Date().toISOString(),
    }, `Analytics recorded: user ${userId} searched "${query}" (${resultCount} results)`);
  },

  popularQueryUpdated: (query: string, newCount: number) => {
    logger.debug({
      event: 'search.popular_query.updated',
      query,
      newCount,
      timestamp: new Date().toISOString(),
    }, `Popular query updated: "${query}" now has ${newCount} searches`);
  },

  indexHealthCheck: (indexName: string, status: string, docCount: number, storeSize: string) => {
    logger.debug({
      event: 'search.index.health_check',
      indexName,
      status,
      docCount,
      storeSize,
      timestamp: new Date().toISOString(),
    }, `Index health: ${indexName} is ${status} (${docCount} docs, ${storeSize})`);
  },

  mappingUpdated: (indexName: string, fieldName: string, mappingType: string) => {
    logger.info({
      event: 'search.mapping.updated',
      indexName,
      fieldName,
      mappingType,
      timestamp: new Date().toISOString(),
    }, `Mapping updated: ${fieldName} in ${indexName} (type: ${mappingType})`);
  },

  aliasCreated: (aliasName: string, indexName: string) => {
    logger.info({
      event: 'search.alias.created',
      aliasName,
      indexName,
      timestamp: new Date().toISOString(),
    }, `Alias created: ${aliasName} -> ${indexName}`);
  },

  searchTemplateExecuted: (templateName: string, parameters: any, duration: number) => {
    logger.debug({
      event: 'search.template.executed',
      templateName,
      parameters,
      duration,
      timestamp: new Date().toISOString(),
    }, `Search template executed: ${templateName} in ${duration}ms`);
  },

  highlightGenerated: (field: string, fragmentsCount: number, maxScore: number) => {
    logger.debug({
      event: 'search.highlight.generated',
      field,
      fragmentsCount,
      maxScore,
      timestamp: new Date().toISOString(),
    }, `Highlight generated: ${field} (${fragmentsCount} fragments, max score: ${maxScore})`);
  },

  clusterHealth: (status: string, nodeCount: number, activeShards: number) => {
    logger.info({
      event: 'elasticsearch.cluster.health',
      status,
      nodeCount,
      activeShards,
      timestamp: new Date().toISOString(),
    }, `Cluster health: ${status} (${nodeCount} nodes, ${activeShards} active shards)`);
  },

  searchTimeoutWarning: (query: string, timeout: number, partialResults: boolean) => {
    logger.warn({
      event: 'search.timeout.warning',
      query,
      timeout,
      partialResults,
      timestamp: new Date().toISOString(),
    }, `Search timeout: "${query}" exceeded ${timeout}ms (partial results: ${partialResults})`);
  },

  contentSynchronized: (contentType: string, contentId: string, operation: string, duration: number) => {
    logger.info({
      event: 'search.content.synchronized',
      contentType,
      contentId,
      operation,
      duration,
      timestamp: new Date().toISOString(),
    }, `Content synchronized: ${operation} ${contentType}/${contentId} in ${duration}ms`);
  },

  searchFacetExecuted: (facetField: string, bucketCount: number, selectedValues: any[]) => {
    logger.debug({
      event: 'search.facet.executed',
      facetField,
      bucketCount,
      selectedValues,
      timestamp: new Date().toISOString(),
    }, `Search facet: ${facetField} (${bucketCount} buckets, ${selectedValues.length} selected)`);
  },
};

// Export child logger factory
export const createChildLogger = (context: Record<string, any>) => {
  return logger.child(context);
};