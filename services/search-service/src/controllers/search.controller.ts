import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  searchQueryService,
  searchIndexerService,
  searchAnalyticsService,
} from '../services';
import { config } from '../config';
import { logger, searchLogger } from '../utils/logger';
import {
  SearchQuery,
  SearchFilters,
  SearchSort,
  SearchPagination,
  ContentType,
  AutoCompleteRequest,
} from '../types';

// Request schemas
const searchRequestSchema = z.object({
  query: z.string().optional(),
  contentTypes: z.array(z.enum(['threat', 'project', 'threat_model', 'user', 'file', 'report'])).optional(),
  filters: z.object({
    userId: z.string().optional(),
    projectId: z.string().optional(),
    threatModelId: z.string().optional(),
    severity: z.array(z.string()).optional(),
    status: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
    dateRange: z.object({
      field: z.string(),
      from: z.string().optional(),
      to: z.string().optional(),
    }).optional(),
    numericRange: z.object({
      field: z.string(),
      min: z.number().optional(),
      max: z.number().optional(),
    }).optional(),
  }).optional(),
  sort: z.array(z.object({
    field: z.string(),
    order: z.enum(['asc', 'desc']),
  })).optional(),
  pagination: z.object({
    page: z.number().min(1).default(1),
    size: z.number().min(1).max(1000).default(20),
  }).optional(),
  aggregations: z.array(z.string()).optional(),
  highlight: z.boolean().default(true),
  suggest: z.boolean().default(false),
});

const autoCompleteRequestSchema = z.object({
  prefix: z.string().min(1),
  contentTypes: z.array(z.enum(['threat', 'project', 'threat_model', 'user', 'file', 'report'])).optional(),
  userId: z.string().optional(),
  projectId: z.string().optional(),
  size: z.number().min(1).max(50).default(10),
});

const getByIdRequestSchema = z.object({
  contentType: z.enum(['threat', 'project', 'threat_model', 'user', 'file', 'report']),
  id: z.string(),
});

const moreLikeThisRequestSchema = z.object({
  contentType: z.enum(['threat', 'project', 'threat_model', 'user', 'file', 'report']),
  id: z.string(),
  size: z.number().min(1).max(100).default(10),
  minTermFreq: z.number().min(1).default(1),
  maxQueryTerms: z.number().min(1).default(25),
});

const bulkSearchRequestSchema = z.object({
  queries: z.array(searchRequestSchema).max(10), // Limit bulk queries
});

const clickThroughRequestSchema = z.object({
  query: z.string(),
  resultId: z.string(),
  position: z.number().min(0),
  sessionId: z.string().optional(),
});

export class SearchController {
  async search(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const startTime = Date.now();
    
    try {
      const body = searchRequestSchema.parse(request.body);
      const userId = request.user?.id;
      const sessionId = request.headers['x-session-id'] as string;
      
      // Default content types if not specified
      const contentTypes = body.contentTypes || ['threat', 'project', 'threat_model', 'user', 'file', 'report'];
      
      // Build search query
      const searchQuery: SearchQuery = {
        query: body.query,
        filters: body.filters as SearchFilters,
        sort: body.sort as SearchSort[],
        pagination: body.pagination as SearchPagination,
        aggregations: body.aggregations,
        highlight: body.highlight,
        suggest: body.suggest,
      };

      // Apply user-based filters
      if (request.user && body.filters) {
        searchQuery.filters = this.applyUserFilters(body.filters, request.user);
      }

      // Execute search
      const result = await searchQueryService.search(
        contentTypes as ContentType[],
        searchQuery,
        userId,
      );

      const responseTime = Date.now() - startTime;

      // Record analytics
      if (config.ANALYTICS_ENABLED && body.query) {
        searchAnalyticsService.recordSearch(
          body.query,
          userId,
          body.filters,
          result,
          responseTime,
          sessionId,
          request.ip,
          request.headers['user-agent'],
        ).catch(error => {
          logger.error('Failed to record search analytics:', error);
        });
      }

      reply.send({
        success: true,
        data: result,
        meta: {
          responseTime,
          query: searchQuery,
        },
      });

    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          success: false,
          error: 'Validation Error',
          message: 'Invalid request format',
          details: error.errors,
        });
      }

      logger.error('Search error:', error);
      
      reply.status(500).send({
        success: false,
        error: 'Search Error',
        message: 'An error occurred while searching',
        meta: { responseTime },
      });
    }
  }

  async bulkSearch(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const startTime = Date.now();
    
    try {
      const body = bulkSearchRequestSchema.parse(request.body);
      const userId = request.user?.id;
      
      const results = await Promise.allSettled(
        body.queries.map(async (queryBody, index) => {
          const contentTypes = queryBody.contentTypes || ['threat', 'project', 'threat_model', 'user', 'file', 'report'];
          
          const searchQuery: SearchQuery = {
            query: queryBody.query,
            filters: queryBody.filters as SearchFilters,
            sort: queryBody.sort as SearchSort[],
            pagination: queryBody.pagination as SearchPagination,
            aggregations: queryBody.aggregations,
            highlight: queryBody.highlight,
            suggest: queryBody.suggest,
          };

          // Apply user-based filters
          if (request.user && queryBody.filters) {
            searchQuery.filters = this.applyUserFilters(queryBody.filters, request.user);
          }

          return {
            index,
            result: await searchQueryService.search(
              contentTypes as ContentType[],
              searchQuery,
              userId,
            ),
          };
        })
      );

      const responseTime = Date.now() - startTime;
      
      const successfulResults = results
        .filter(result => result.status === 'fulfilled')
        .map(result => (result as PromiseFulfilledResult<any>).value);
        
      const failedResults = results
        .filter(result => result.status === 'rejected')
        .map((result, index) => ({
          index,
          error: (result as PromiseRejectedResult).reason.message,
        }));

      reply.send({
        success: true,
        data: {
          results: successfulResults,
          errors: failedResults,
        },
        meta: {
          responseTime,
          totalQueries: body.queries.length,
          successfulQueries: successfulResults.length,
          failedQueries: failedResults.length,
        },
      });

    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          success: false,
          error: 'Validation Error',
          message: 'Invalid request format',
          details: error.errors,
        });
      }

      logger.error('Bulk search error:', error);
      
      reply.status(500).send({
        success: false,
        error: 'Bulk Search Error',
        message: 'An error occurred while executing bulk search',
        meta: { responseTime },
      });
    }
  }

  async getById(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = getByIdRequestSchema.parse(request.params);
      
      const result = await searchQueryService.getById(
        params.contentType,
        params.id,
      );

      if (!result) {
        return reply.status(404).send({
          success: false,
          error: 'Not Found',
          message: `${params.contentType} with id ${params.id} not found`,
        });
      }

      // Check if user has access to this content
      if (request.user && !this.hasAccessToContent(result, request.user)) {
        return reply.status(403).send({
          success: false,
          error: 'Forbidden',
          message: 'You do not have access to this content',
        });
      }

      reply.send({
        success: true,
        data: result,
      });

    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          success: false,
          error: 'Validation Error',
          message: 'Invalid request format',
          details: error.errors,
        });
      }

      logger.error('Get by ID error:', error);
      
      reply.status(500).send({
        success: false,
        error: 'Retrieval Error',
        message: 'An error occurred while retrieving content',
      });
    }
  }

  async autoComplete(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const startTime = Date.now();
    
    try {
      const query = autoCompleteRequestSchema.parse(request.query);
      
      const autoCompleteRequest: AutoCompleteRequest = {
        prefix: query.prefix,
        context: {
          contentTypes: query.contentTypes,
          userId: query.userId || request.user?.id,
          projectId: query.projectId,
        },
        size: query.size,
      };

      const result = await searchQueryService.autoComplete(autoCompleteRequest);
      const responseTime = Date.now() - startTime;

      // Log autocomplete execution
      if (request.user) {
        searchLogger.autoCompleteExecuted(
          query.prefix,
          request.user.id,
          result.suggestions.length,
          responseTime,
        );
      }

      reply.send({
        success: true,
        data: result,
        meta: { responseTime },
      });

    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          success: false,
          error: 'Validation Error',
          message: 'Invalid request format',
          details: error.errors,
        });
      }

      logger.error('Auto-complete error:', error);
      
      reply.status(500).send({
        success: false,
        error: 'Auto-complete Error',
        message: 'An error occurred while generating suggestions',
        meta: { responseTime },
      });
    }
  }

  async suggest(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const { query, size = 5 } = request.query as { query: string; size?: number };
      
      if (!query) {
        return reply.status(400).send({
          success: false,
          error: 'Validation Error',
          message: 'Query parameter is required',
        });
      }

      const suggestions = await searchQueryService.suggest(query, size);

      reply.send({
        success: true,
        data: { suggestions },
      });

    } catch (error: any) {
      logger.error('Suggest error:', error);
      
      reply.status(500).send({
        success: false,
        error: 'Suggestion Error',
        message: 'An error occurred while generating suggestions',
      });
    }
  }

  async moreLikeThis(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = moreLikeThisRequestSchema.parse(request.body);
      
      const result = await searchQueryService.moreLikeThis(
        body.contentType,
        body.id,
        {
          size: body.size,
          minTermFreq: body.minTermFreq,
          maxQueryTerms: body.maxQueryTerms,
        },
      );

      reply.send({
        success: true,
        data: result,
      });

    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          success: false,
          error: 'Validation Error',
          message: 'Invalid request format',
          details: error.errors,
        });
      }

      logger.error('More like this error:', error);
      
      reply.status(500).send({
        success: false,
        error: 'More Like This Error',
        message: 'An error occurred while finding similar content',
      });
    }
  }

  async recordClickThrough(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = clickThroughRequestSchema.parse(request.body);
      const userId = request.user?.id;
      const sessionId = body.sessionId || (request.headers['x-session-id'] as string);

      await searchAnalyticsService.recordClickThrough(
        body.query,
        userId,
        body.resultId,
        body.position,
        sessionId,
      );

      reply.send({
        success: true,
        message: 'Click-through recorded',
      });

    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          success: false,
          error: 'Validation Error',
          message: 'Invalid request format',
          details: error.errors,
        });
      }

      logger.error('Click-through recording error:', error);
      
      reply.status(500).send({
        success: false,
        error: 'Recording Error',
        message: 'An error occurred while recording click-through',
      });
    }
  }

  async count(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const { contentTypes, ...filters } = request.query as any;
      const searchContentTypes = contentTypes 
        ? contentTypes.split(',') 
        : ['threat', 'project', 'threat_model', 'user', 'file', 'report'];

      const count = await searchQueryService.count(
        searchContentTypes as ContentType[],
        filters as SearchFilters,
      );

      reply.send({
        success: true,
        data: { count },
      });

    } catch (error: any) {
      logger.error('Count error:', error);
      
      reply.status(500).send({
        success: false,
        error: 'Count Error',
        message: 'An error occurred while counting documents',
      });
    }
  }

  async explain(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const { contentType, id } = request.params as { contentType: ContentType; id: string };
      const { query } = request.body as { query: any };

      const explanation = await searchQueryService.explain(contentType, id, query);

      reply.send({
        success: true,
        data: explanation,
      });

    } catch (error: any) {
      logger.error('Explain error:', error);
      
      reply.status(500).send({
        success: false,
        error: 'Explain Error',
        message: 'An error occurred while explaining the query',
      });
    }
  }

  async validateQuery(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const { contentType } = request.params as { contentType: ContentType };
      const { query } = request.body as { query: any };

      const validation = await searchQueryService.validateQuery(contentType, query);

      reply.send({
        success: true,
        data: validation,
      });

    } catch (error: any) {
      logger.error('Query validation error:', error);
      
      reply.status(500).send({
        success: false,
        error: 'Validation Error',
        message: 'An error occurred while validating the query',
      });
    }
  }

  private applyUserFilters(filters: any, user: any): SearchFilters {
    const userFilters = { ...filters };
    
    // Non-admin users can only see their own content or public content
    if (user.role !== 'admin') {
      userFilters.userId = user.id;
    }

    // Organization-based filtering
    if (user.organizationId && user.role !== 'admin') {
      userFilters.organizationId = user.organizationId;
    }

    return userFilters;
  }

  private hasAccessToContent(content: any, user: any): boolean {
    // Admin users have access to everything
    if (user.role === 'admin') {
      return true;
    }

    // Users can access their own content
    if (content.userId === user.id) {
      return true;
    }

    // Users can access public content
    if (content.isPublic === true) {
      return true;
    }

    // Organization members can access organization content
    if (content.organizationId === user.organizationId) {
      return true;
    }

    return false;
  }
}

export const searchController = new SearchController();