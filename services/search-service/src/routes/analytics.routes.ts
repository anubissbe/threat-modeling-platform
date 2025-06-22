import { FastifyInstance } from 'fastify';
import { analyticsController } from '../controllers';
import { authMiddleware } from '../middleware/auth.middleware';

export async function analyticsRoutes(fastify: FastifyInstance) {
  // All analytics routes require authentication
  fastify.addHook('preHandler', authMiddleware);

  // User-specific analytics (all authenticated users)
  fastify.get('/my-history', {
    schema: {
      description: 'Get my search history',
      tags: ['Analytics'],
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: 100 },
          from: { type: 'string', format: 'date-time' },
          to: { type: 'string', format: 'date-time' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                history: {
                  type: 'array',
                  items: { type: 'object' }
                }
              }
            }
          }
        }
      }
    }
  }, analyticsController.getMySearchHistory.bind(analyticsController));

  fastify.delete('/my-history', {
    schema: {
      description: 'Delete my search history',
      tags: ['Analytics'],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, analyticsController.deleteMySearchHistory.bind(analyticsController));

  // Admin/Analyst analytics (role-based access)
  fastify.get('/metrics', {
    schema: {
      description: 'Get search metrics (admin/analyst only)',
      tags: ['Analytics'],
      querystring: {
        type: 'object',
        properties: {
          from: { type: 'string', format: 'date-time' },
          to: { type: 'string', format: 'date-time' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object' }
          }
        }
      }
    }
  }, analyticsController.getMetrics.bind(analyticsController));

  fastify.get('/popular-searches', {
    schema: {
      description: 'Get popular searches (admin/analyst only)',
      tags: ['Analytics'],
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: 100 },
          from: { type: 'string', format: 'date-time' },
          to: { type: 'string', format: 'date-time' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                popularSearches: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      query: { type: 'string' },
                      count: { type: 'integer' },
                      lastSearched: { type: 'string' }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }, analyticsController.getPopularSearches.bind(analyticsController));

  fastify.get('/user-history', {
    schema: {
      description: 'Get user search history (admin only or own history)',
      tags: ['Analytics'],
      querystring: {
        type: 'object',
        properties: {
          userId: { type: 'string' },
          limit: { type: 'integer', minimum: 1, maximum: 100 },
          from: { type: 'string', format: 'date-time' },
          to: { type: 'string', format: 'date-time' }
        },
        required: ['userId']
      }
    }
  }, analyticsController.getUserHistory.bind(analyticsController));

  fastify.get('/query-suggestions', {
    schema: {
      description: 'Get query suggestions based on analytics',
      tags: ['Analytics'],
      querystring: {
        type: 'object',
        properties: {
          partialQuery: { type: 'string', minLength: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 50 }
        },
        required: ['partialQuery']
      }
    }
  }, analyticsController.getQuerySuggestions.bind(analyticsController));

  fastify.get('/slow-queries', {
    schema: {
      description: 'Get slow queries (admin/analyst only)',
      tags: ['Analytics'],
      querystring: {
        type: 'object',
        properties: {
          threshold: { type: 'integer', minimum: 100 },
          limit: { type: 'integer', minimum: 1, maximum: 100 }
        }
      }
    }
  }, analyticsController.getSlowQueries.bind(analyticsController));

  fastify.get('/no-results-queries', {
    schema: {
      description: 'Get queries that returned no results (admin/analyst only)',
      tags: ['Analytics'],
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: 100 },
          from: { type: 'string', format: 'date-time' },
          to: { type: 'string', format: 'date-time' }
        }
      }
    }
  }, analyticsController.getNoResultsQueries.bind(analyticsController));

  fastify.post('/export', {
    schema: {
      description: 'Export analytics data (admin only)',
      tags: ['Analytics'],
      body: {
        type: 'object',
        properties: {
          timeRange: {
            type: 'object',
            properties: {
              from: { type: 'string', format: 'date-time' },
              to: { type: 'string', format: 'date-time' }
            },
            required: ['from', 'to']
          },
          format: { type: 'string', enum: ['json', 'csv'] }
        },
        required: ['timeRange']
      }
    }
  }, analyticsController.exportAnalytics.bind(analyticsController));

  fastify.delete('/cleanup', {
    schema: {
      description: 'Cleanup old analytics data (admin only)',
      tags: ['Analytics'],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, analyticsController.cleanupOldAnalytics.bind(analyticsController));
}