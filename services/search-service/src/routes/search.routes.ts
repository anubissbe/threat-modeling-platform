import { FastifyInstance } from 'fastify';
import { searchController } from '../controllers';
import { authMiddleware, optionalAuthMiddleware, validateSearchAccess } from '../middleware/auth.middleware';

export async function searchRoutes(fastify: FastifyInstance) {
  // Search routes
  fastify.register(async function(fastify) {
    // Public search endpoints (with optional auth)
    fastify.addHook('preHandler', optionalAuthMiddleware);
    fastify.addHook('preHandler', validateSearchAccess());

    fastify.post('/search', {
      schema: {
        description: 'Search across content types',
        tags: ['Search'],
        body: {
          type: 'object',
          properties: {
            query: { type: 'string' },
            contentTypes: {
              type: 'array',
              items: {
                type: 'string',
                enum: ['threat', 'project', 'threat_model', 'user', 'file', 'report']
              }
            },
            filters: { type: 'object' },
            sort: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: { type: 'string' },
                  order: { type: 'string', enum: ['asc', 'desc'] }
                }
              }
            },
            pagination: {
              type: 'object',
              properties: {
                page: { type: 'integer', minimum: 1 },
                size: { type: 'integer', minimum: 1, maximum: 1000 }
              }
            },
            aggregations: {
              type: 'array',
              items: { type: 'string' }
            },
            highlight: { type: 'boolean' },
            suggest: { type: 'boolean' }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: { type: 'object' },
              meta: { type: 'object' }
            }
          }
        }
      }
    }, searchController.search.bind(searchController));

    fastify.post('/search/bulk', {
      schema: {
        description: 'Execute multiple searches in a single request',
        tags: ['Search'],
        body: {
          type: 'object',
          properties: {
            queries: {
              type: 'array',
              maxItems: 10,
              items: { type: 'object' }
            }
          },
          required: ['queries']
        }
      }
    }, searchController.bulkSearch.bind(searchController));

    fastify.get('/search/autocomplete', {
      schema: {
        description: 'Get autocomplete suggestions',
        tags: ['Search'],
        querystring: {
          type: 'object',
          properties: {
            prefix: { type: 'string', minLength: 1 },
            contentTypes: { type: 'string' },
            userId: { type: 'string' },
            projectId: { type: 'string' },
            size: { type: 'integer', minimum: 1, maximum: 50 }
          },
          required: ['prefix']
        }
      }
    }, searchController.autoComplete.bind(searchController));

    fastify.get('/search/suggest', {
      schema: {
        description: 'Get query suggestions',
        tags: ['Search'],
        querystring: {
          type: 'object',
          properties: {
            query: { type: 'string', minLength: 1 },
            size: { type: 'integer', minimum: 1, maximum: 20 }
          },
          required: ['query']
        }
      }
    }, searchController.suggest.bind(searchController));

    fastify.get('/search/count', {
      schema: {
        description: 'Count documents matching filters',
        tags: ['Search'],
        querystring: {
          type: 'object',
          properties: {
            contentTypes: { type: 'string' },
            userId: { type: 'string' },
            projectId: { type: 'string' },
            status: { type: 'string' },
            tags: { type: 'string' }
          }
        }
      }
    }, searchController.count.bind(searchController));
  });

  // Authenticated routes
  fastify.register(async function(fastify) {
    fastify.addHook('preHandler', authMiddleware);

    fastify.get('/:contentType/:id', {
      schema: {
        description: 'Get document by ID',
        tags: ['Search'],
        params: {
          type: 'object',
          properties: {
            contentType: {
              type: 'string',
              enum: ['threat', 'project', 'threat_model', 'user', 'file', 'report']
            },
            id: { type: 'string' }
          },
          required: ['contentType', 'id']
        }
      }
    }, searchController.getById.bind(searchController));

    fastify.post('/more-like-this', {
      schema: {
        description: 'Find similar content',
        tags: ['Search'],
        body: {
          type: 'object',
          properties: {
            contentType: {
              type: 'string',
              enum: ['threat', 'project', 'threat_model', 'user', 'file', 'report']
            },
            id: { type: 'string' },
            size: { type: 'integer', minimum: 1, maximum: 100 },
            minTermFreq: { type: 'integer', minimum: 1 },
            maxQueryTerms: { type: 'integer', minimum: 1 }
          },
          required: ['contentType', 'id']
        }
      }
    }, searchController.moreLikeThis.bind(searchController));

    fastify.post('/click-through', {
      schema: {
        description: 'Record click-through analytics',
        tags: ['Search'],
        body: {
          type: 'object',
          properties: {
            query: { type: 'string' },
            resultId: { type: 'string' },
            position: { type: 'integer', minimum: 0 },
            sessionId: { type: 'string' }
          },
          required: ['query', 'resultId', 'position']
        }
      }
    }, searchController.recordClickThrough.bind(searchController));

    fastify.post('/:contentType/:id/explain', {
      schema: {
        description: 'Explain query scoring',
        tags: ['Search'],
        params: {
          type: 'object',
          properties: {
            contentType: {
              type: 'string',
              enum: ['threat', 'project', 'threat_model', 'user', 'file', 'report']
            },
            id: { type: 'string' }
          },
          required: ['contentType', 'id']
        },
        body: {
          type: 'object',
          properties: {
            query: { type: 'object' }
          },
          required: ['query']
        }
      }
    }, searchController.explain.bind(searchController));

    fastify.post('/:contentType/validate-query', {
      schema: {
        description: 'Validate Elasticsearch query',
        tags: ['Search'],
        params: {
          type: 'object',
          properties: {
            contentType: {
              type: 'string',
              enum: ['threat', 'project', 'threat_model', 'user', 'file', 'report']
            }
          },
          required: ['contentType']
        },
        body: {
          type: 'object',
          properties: {
            query: { type: 'object' }
          },
          required: ['query']
        }
      }
    }, searchController.validateQuery.bind(searchController));
  });
}