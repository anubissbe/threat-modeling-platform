import { FastifyInstance } from 'fastify';
import { adminController } from '../controllers';
import { authMiddleware } from '../middleware/auth.middleware';

export async function adminRoutes(fastify: FastifyInstance) {
  // All admin routes require authentication
  // Role-based access control is handled within each controller method
  fastify.addHook('preHandler', authMiddleware);

  // System health and monitoring
  fastify.get('/health', {
    schema: {
      description: 'Get system health status (admin only)',
      tags: ['Admin'],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                elasticsearch: { type: 'object' },
                indices: { type: 'array' },
                indexing: { type: 'object' },
                timestamp: { type: 'string' }
              }
            }
          }
        }
      }
    }
  }, adminController.getSystemHealth.bind(adminController));

  // Index management
  fastify.get('/indices', {
    schema: {
      description: 'Get all indices information (admin only)',
      tags: ['Admin'],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                indices: { type: 'array' },
                health: { type: 'array' }
              }
            }
          }
        }
      }
    }
  }, adminController.getIndices.bind(adminController));

  fastify.post('/indices', {
    schema: {
      description: 'Create index for content type (admin only)',
      tags: ['Admin'],
      body: {
        type: 'object',
        properties: {
          contentType: {
            type: 'string',
            enum: ['threat', 'project', 'threat_model', 'user', 'file', 'report']
          }
        },
        required: ['contentType']
      }
    }
  }, adminController.createIndex.bind(adminController));

  fastify.delete('/indices/:contentType', {
    schema: {
      description: 'Delete index for content type (admin only)',
      tags: ['Admin'],
      params: {
        type: 'object',
        properties: {
          contentType: {
            type: 'string',
            enum: ['threat', 'project', 'threat_model', 'user', 'file', 'report']
          }
        },
        required: ['contentType']
      }
    }
  }, adminController.deleteIndex.bind(adminController));

  fastify.post('/indices/reindex', {
    schema: {
      description: 'Reindex content (admin only)',
      tags: ['Admin'],
      body: {
        type: 'object',
        properties: {
          contentType: {
            type: 'string',
            enum: ['threat', 'project', 'threat_model', 'user', 'file', 'report']
          },
          force: { type: 'boolean' }
        }
      }
    }
  }, adminController.reindex.bind(adminController));

  fastify.post('/indices/optimize', {
    schema: {
      description: 'Optimize all indices (admin only)',
      tags: ['Admin']
    }
  }, adminController.optimizeIndices.bind(adminController));

  fastify.post('/indices/mapping', {
    schema: {
      description: 'Update index mapping (admin only)',
      tags: ['Admin'],
      body: {
        type: 'object',
        properties: {
          contentType: {
            type: 'string',
            enum: ['threat', 'project', 'threat_model', 'user', 'file', 'report']
          },
          mapping: { type: 'object' }
        },
        required: ['contentType', 'mapping']
      }
    }
  }, adminController.updateMapping.bind(adminController));

  fastify.post('/indices/:contentType/refresh', {
    schema: {
      description: 'Refresh index (admin only)',
      tags: ['Admin'],
      params: {
        type: 'object',
        properties: {
          contentType: {
            type: 'string',
            enum: ['threat', 'project', 'threat_model', 'user', 'file', 'report']
          }
        },
        required: ['contentType']
      }
    }
  }, adminController.refreshIndex.bind(adminController));

  fastify.post('/indices/:contentType/flush', {
    schema: {
      description: 'Flush index (admin only)',
      tags: ['Admin'],
      params: {
        type: 'object',
        properties: {
          contentType: {
            type: 'string',
            enum: ['threat', 'project', 'threat_model', 'user', 'file', 'report']
          }
        },
        required: ['contentType']
      }
    }
  }, adminController.flushIndex.bind(adminController));

  fastify.delete('/indices/:contentType/clear', {
    schema: {
      description: 'Clear all documents from index (admin only)',
      tags: ['Admin'],
      params: {
        type: 'object',
        properties: {
          contentType: {
            type: 'string',
            enum: ['threat', 'project', 'threat_model', 'user', 'file', 'report']
          }
        },
        required: ['contentType']
      }
    }
  }, adminController.clearIndex.bind(adminController));

  // Bulk operations
  fastify.post('/bulk-index', {
    schema: {
      description: 'Bulk index documents (admin only)',
      tags: ['Admin'],
      body: {
        type: 'object',
        properties: {
          contentType: {
            type: 'string',
            enum: ['threat', 'project', 'threat_model', 'user', 'file', 'report']
          },
          documents: {
            type: 'array',
            maxItems: 1000,
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                content: { type: 'object' }
              },
              required: ['id', 'content']
            }
          }
        },
        required: ['contentType', 'documents']
      }
    }
  }, adminController.bulkIndex.bind(adminController));

  // Snapshot management
  fastify.post('/snapshots', {
    schema: {
      description: 'Create snapshot (admin only)',
      tags: ['Admin'],
      body: {
        type: 'object',
        properties: {
          repositoryName: { type: 'string' },
          snapshotName: { type: 'string' }
        },
        required: ['repositoryName', 'snapshotName']
      }
    }
  }, adminController.createSnapshot.bind(adminController));

  fastify.post('/snapshots/restore', {
    schema: {
      description: 'Restore snapshot (admin only)',
      tags: ['Admin'],
      body: {
        type: 'object',
        properties: {
          repositoryName: { type: 'string' },
          snapshotName: { type: 'string' }
        },
        required: ['repositoryName', 'snapshotName']
      }
    }
  }, adminController.restoreSnapshot.bind(adminController));

  fastify.get('/snapshots/:repositoryName', {
    schema: {
      description: 'List snapshots in repository (admin only)',
      tags: ['Admin'],
      params: {
        type: 'object',
        properties: {
          repositoryName: { type: 'string' }
        },
        required: ['repositoryName']
      }
    }
  }, adminController.listSnapshots.bind(adminController));

  fastify.delete('/snapshots/:repositoryName/:snapshotName', {
    schema: {
      description: 'Delete snapshot (admin only)',
      tags: ['Admin'],
      params: {
        type: 'object',
        properties: {
          repositoryName: { type: 'string' },
          snapshotName: { type: 'string' }
        },
        required: ['repositoryName', 'snapshotName']
      }
    }
  }, adminController.deleteSnapshot.bind(adminController));

  // Statistics and monitoring
  fastify.get('/stats/indexing', {
    schema: {
      description: 'Get indexing statistics (admin only)',
      tags: ['Admin'],
      querystring: {
        type: 'object',
        properties: {
          contentType: {
            type: 'string',
            enum: ['threat', 'project', 'threat_model', 'user', 'file', 'report']
          }
        }
      }
    }
  }, adminController.getIndexingStats.bind(adminController));
}