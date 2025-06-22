import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { searchAnalyticsService } from '../services';
import { logger } from '../utils/logger';
import { requireRole } from '../middleware/auth.middleware';

// Request schemas
const timeRangeSchema = z.object({
  from: z.string(),
  to: z.string(),
});

const popularSearchesRequestSchema = z.object({
  limit: z.number().min(1).max(100).default(20),
  timeRange: timeRangeSchema.optional(),
});

const userHistoryRequestSchema = z.object({
  userId: z.string(),
  limit: z.number().min(1).max(100).default(50),
  timeRange: timeRangeSchema.optional(),
});

const querySuggestionsRequestSchema = z.object({
  partialQuery: z.string().min(1),
  limit: z.number().min(1).max(50).default(10),
});

const slowQueriesRequestSchema = z.object({
  threshold: z.number().min(100).default(5000),
  limit: z.number().min(1).max(100).default(20),
});

const exportAnalyticsRequestSchema = z.object({
  timeRange: timeRangeSchema,
  format: z.enum(['json', 'csv']).default('json'),
});

export class AnalyticsController {
  async getMetrics(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      // Only admins and analysts can view metrics
      await requireRole(['admin', 'analyst'])(request, reply);
      if (reply.sent) return;

      const query = request.query as any;
      const timeRange = query.from && query.to ? {
        from: query.from,
        to: query.to,
      } : undefined;

      const metrics = await searchAnalyticsService.getSearchMetrics(timeRange);

      reply.send({
        success: true,
        data: metrics,
      });

    } catch (error: any) {
      logger.error('Get metrics error:', error);
      
      reply.status(500).send({
        success: false,
        error: 'Metrics Error',
        message: 'An error occurred while retrieving metrics',
      });
    }
  }

  async getPopularSearches(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      // Only admins and analysts can view popular searches
      await requireRole(['admin', 'analyst'])(request, reply);
      if (reply.sent) return;

      const query = popularSearchesRequestSchema.parse(request.query);
      
      const popularSearches = await searchAnalyticsService.getPopularSearches(
        query.limit,
        query.timeRange,
      );

      reply.send({
        success: true,
        data: { popularSearches },
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

      logger.error('Get popular searches error:', error);
      
      reply.status(500).send({
        success: false,
        error: 'Popular Searches Error',
        message: 'An error occurred while retrieving popular searches',
      });
    }
  }

  async getUserHistory(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const query = userHistoryRequestSchema.parse(request.query);
      
      // Users can only view their own history, unless they're admin
      if (request.user?.role !== 'admin' && request.user?.id !== query.userId) {
        return reply.status(403).send({
          success: false,
          error: 'Forbidden',
          message: 'You can only view your own search history',
        });
      }

      const history = await searchAnalyticsService.getUserSearchHistory(
        query.userId,
        query.limit,
        query.timeRange,
      );

      reply.send({
        success: true,
        data: { history },
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

      logger.error('Get user history error:', error);
      
      reply.status(500).send({
        success: false,
        error: 'User History Error',
        message: 'An error occurred while retrieving user search history',
      });
    }
  }

  async getQuerySuggestions(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const query = querySuggestionsRequestSchema.parse(request.query);
      
      const suggestions = await searchAnalyticsService.getQuerySuggestions(
        query.partialQuery,
        query.limit,
      );

      reply.send({
        success: true,
        data: { suggestions },
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

      logger.error('Get query suggestions error:', error);
      
      reply.status(500).send({
        success: false,
        error: 'Query Suggestions Error',
        message: 'An error occurred while retrieving query suggestions',
      });
    }
  }

  async getSlowQueries(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      // Only admins and analysts can view slow queries
      await requireRole(['admin', 'analyst'])(request, reply);
      if (reply.sent) return;

      const query = slowQueriesRequestSchema.parse(request.query);
      
      const slowQueries = await searchAnalyticsService.getSlowQueries(
        query.threshold,
        query.limit,
      );

      reply.send({
        success: true,
        data: { slowQueries },
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

      logger.error('Get slow queries error:', error);
      
      reply.status(500).send({
        success: false,
        error: 'Slow Queries Error',
        message: 'An error occurred while retrieving slow queries',
      });
    }
  }

  async getNoResultsQueries(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      // Only admins and analysts can view no-results queries
      await requireRole(['admin', 'analyst'])(request, reply);
      if (reply.sent) return;

      const query = request.query as any;
      const limit = query.limit ? parseInt(query.limit) : 20;
      const timeRange = query.from && query.to ? {
        from: query.from,
        to: query.to,
      } : undefined;

      const noResultsQueries = await searchAnalyticsService.getNoResultsQueries(
        limit,
        timeRange,
      );

      reply.send({
        success: true,
        data: { noResultsQueries },
      });

    } catch (error: any) {
      logger.error('Get no-results queries error:', error);
      
      reply.status(500).send({
        success: false,
        error: 'No Results Queries Error',
        message: 'An error occurred while retrieving no-results queries',
      });
    }
  }

  async exportAnalytics(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      // Only admins can export analytics
      await requireRole(['admin'])(request, reply);
      if (reply.sent) return;

      const body = exportAnalyticsRequestSchema.parse(request.body);
      
      const analytics = await searchAnalyticsService.exportAnalytics(
        body.timeRange,
        body.format,
      );

      if (body.format === 'csv') {
        // Convert to CSV format
        const csv = this.convertToCSV(analytics);
        
        reply
          .header('Content-Type', 'text/csv')
          .header('Content-Disposition', `attachment; filename="search-analytics-${Date.now()}.csv"`)
          .send(csv);
      } else {
        reply
          .header('Content-Type', 'application/json')
          .header('Content-Disposition', `attachment; filename="search-analytics-${Date.now()}.json"`)
          .send({
            success: true,
            data: analytics,
            meta: {
              exportedAt: new Date().toISOString(),
              timeRange: body.timeRange,
              totalRecords: analytics.length,
            },
          });
      }

    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          success: false,
          error: 'Validation Error',
          message: 'Invalid request format',
          details: error.errors,
        });
      }

      logger.error('Export analytics error:', error);
      
      reply.status(500).send({
        success: false,
        error: 'Export Error',
        message: 'An error occurred while exporting analytics',
      });
    }
  }

  async cleanupOldAnalytics(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      // Only admins can cleanup analytics
      await requireRole(['admin'])(request, reply);
      if (reply.sent) return;

      await searchAnalyticsService.cleanupOldAnalytics();

      reply.send({
        success: true,
        message: 'Old analytics data cleaned up successfully',
      });

    } catch (error: any) {
      logger.error('Cleanup analytics error:', error);
      
      reply.status(500).send({
        success: false,
        error: 'Cleanup Error',
        message: 'An error occurred while cleaning up analytics',
      });
    }
  }

  async getMySearchHistory(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      if (!request.user) {
        return reply.status(401).send({
          success: false,
          error: 'Unauthorized',
          message: 'Authentication required',
        });
      }

      const query = request.query as any;
      const limit = query.limit ? parseInt(query.limit) : 50;
      const timeRange = query.from && query.to ? {
        from: query.from,
        to: query.to,
      } : undefined;

      const history = await searchAnalyticsService.getUserSearchHistory(
        request.user.id,
        limit,
        timeRange,
      );

      reply.send({
        success: true,
        data: { history },
      });

    } catch (error: any) {
      logger.error('Get my search history error:', error);
      
      reply.status(500).send({
        success: false,
        error: 'Search History Error',
        message: 'An error occurred while retrieving your search history',
      });
    }
  }

  async deleteMySearchHistory(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      if (!request.user) {
        return reply.status(401).send({
          success: false,
          error: 'Unauthorized',
          message: 'Authentication required',
        });
      }

      // This would require implementing a delete method in the analytics service
      // For now, we'll return a placeholder response
      reply.send({
        success: true,
        message: 'Search history deletion is not yet implemented',
      });

    } catch (error: any) {
      logger.error('Delete my search history error:', error);
      
      reply.status(500).send({
        success: false,
        error: 'Delete History Error',
        message: 'An error occurred while deleting your search history',
      });
    }
  }

  private convertToCSV(data: any[]): string {
    if (data.length === 0) return '';

    // Get headers from first object
    const headers = Object.keys(data[0]);
    
    // Create CSV header row
    const csvHeaders = headers.join(',');
    
    // Create CSV data rows
    const csvRows = data.map(row => {
      return headers.map(header => {
        const value = row[header];
        // Handle values that might contain commas or quotes
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value || '';
      }).join(',');
    });
    
    return [csvHeaders, ...csvRows].join('\n');
  }
}

export const analyticsController = new AnalyticsController();