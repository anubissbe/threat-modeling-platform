import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  elasticsearchService,
  indexManagerService,
  searchIndexerService,
} from '../services';
import { logger } from '../utils/logger';
import { requireRole } from '../middleware/auth.middleware';
import { ContentType } from '../types';

// Request schemas
const reindexRequestSchema = z.object({
  contentType: z.enum(['threat', 'project', 'threat_model', 'user', 'file', 'report']).optional(),
  force: z.boolean().default(false),
});

const createIndexRequestSchema = z.object({
  contentType: z.enum(['threat', 'project', 'threat_model', 'user', 'file', 'report']),
});

const updateMappingRequestSchema = z.object({
  contentType: z.enum(['threat', 'project', 'threat_model', 'user', 'file', 'report']),
  mapping: z.record(z.any()),
});

const snapshotRequestSchema = z.object({
  repositoryName: z.string(),
  snapshotName: z.string(),
});

const bulkIndexRequestSchema = z.object({
  contentType: z.enum(['threat', 'project', 'threat_model', 'user', 'file', 'report']),
  documents: z.array(z.object({
    id: z.string(),
    content: z.record(z.any()),
  })).max(1000),
});

export class AdminController {
  async getSystemHealth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      // Only admins can view system health
      await requireRole(['admin'])(request, reply);
      if (reply.sent) return;

      const [
        elasticsearchHealth,
        indexHealth,
        indexStats,
      ] = await Promise.all([
        elasticsearchService.getClusterHealth(),
        indexManagerService.getIndexHealth(),
        searchIndexerService.getIndexingStats(),
      ]);

      reply.send({
        success: true,
        data: {
          elasticsearch: elasticsearchHealth,
          indices: indexHealth,
          indexing: indexStats,
          timestamp: new Date().toISOString(),
        },
      });

    } catch (error: any) {
      logger.error('Get system health error:', error);
      
      reply.status(500).send({
        success: false,
        error: 'System Health Error',
        message: 'An error occurred while retrieving system health',
      });
    }
  }

  async getIndices(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      // Only admins can view indices
      await requireRole(['admin'])(request, reply);
      if (reply.sent) return;

      const indices = await elasticsearchService.getAllIndices();
      const indexHealth = await indexManagerService.getIndexHealth();

      reply.send({
        success: true,
        data: {
          indices,
          health: indexHealth,
        },
      });

    } catch (error: any) {
      logger.error('Get indices error:', error);
      
      reply.status(500).send({
        success: false,
        error: 'Indices Error',
        message: 'An error occurred while retrieving indices',
      });
    }
  }

  async createIndex(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      // Only admins can create indices
      await requireRole(['admin'])(request, reply);
      if (reply.sent) return;

      const body = createIndexRequestSchema.parse(request.body);

      await indexManagerService.createIndex(body.contentType);

      reply.send({
        success: true,
        message: `Index created for content type: ${body.contentType}`,
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

      logger.error('Create index error:', error);
      
      reply.status(500).send({
        success: false,
        error: 'Create Index Error',
        message: 'An error occurred while creating the index',
      });
    }
  }

  async deleteIndex(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      // Only admins can delete indices
      await requireRole(['admin'])(request, reply);
      if (reply.sent) return;

      const { contentType } = request.params as { contentType: ContentType };

      await indexManagerService.deleteIndex(contentType);

      reply.send({
        success: true,
        message: `Index deleted for content type: ${contentType}`,
      });

    } catch (error: any) {
      logger.error('Delete index error:', error);
      
      reply.status(500).send({
        success: false,
        error: 'Delete Index Error',
        message: 'An error occurred while deleting the index',
      });
    }
  }

  async reindex(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      // Only admins can trigger reindexing
      await requireRole(['admin'])(request, reply);
      if (reply.sent) return;

      const body = reindexRequestSchema.parse(request.body);

      if (body.contentType) {
        await searchIndexerService.reindex(body.contentType);
        reply.send({
          success: true,
          message: `Reindexing started for content type: ${body.contentType}`,
        });
      } else {
        await searchIndexerService.reindex();
        reply.send({
          success: true,
          message: 'Reindexing started for all content types',
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

      logger.error('Reindex error:', error);
      
      reply.status(500).send({
        success: false,
        error: 'Reindex Error',
        message: 'An error occurred while starting reindex',
      });
    }
  }

  async updateMapping(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      // Only admins can update mappings
      await requireRole(['admin'])(request, reply);
      if (reply.sent) return;

      const body = updateMappingRequestSchema.parse(request.body);

      await indexManagerService.updateIndexMapping(body.contentType, body.mapping);

      reply.send({
        success: true,
        message: `Mapping updated for content type: ${body.contentType}`,
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

      logger.error('Update mapping error:', error);
      
      reply.status(500).send({
        success: false,
        error: 'Update Mapping Error',
        message: 'An error occurred while updating the mapping',
      });
    }
  }

  async optimizeIndices(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      // Only admins can optimize indices
      await requireRole(['admin'])(request, reply);
      if (reply.sent) return;

      await indexManagerService.optimizeAllIndices();

      reply.send({
        success: true,
        message: 'Index optimization started for all indices',
      });

    } catch (error: any) {
      logger.error('Optimize indices error:', error);
      
      reply.status(500).send({
        success: false,
        error: 'Optimize Error',
        message: 'An error occurred while optimizing indices',
      });
    }
  }

  async createSnapshot(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      // Only admins can create snapshots
      await requireRole(['admin'])(request, reply);
      if (reply.sent) return;

      const body = snapshotRequestSchema.parse(request.body);

      await indexManagerService.createSnapshot(body.repositoryName, body.snapshotName);

      reply.send({
        success: true,
        message: `Snapshot '${body.snapshotName}' created in repository '${body.repositoryName}'`,
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

      logger.error('Create snapshot error:', error);
      
      reply.status(500).send({
        success: false,
        error: 'Snapshot Error',
        message: 'An error occurred while creating the snapshot',
      });
    }
  }

  async restoreSnapshot(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      // Only admins can restore snapshots
      await requireRole(['admin'])(request, reply);
      if (reply.sent) return;

      const body = snapshotRequestSchema.parse(request.body);

      await indexManagerService.restoreSnapshot(body.repositoryName, body.snapshotName);

      reply.send({
        success: true,
        message: `Snapshot '${body.snapshotName}' restored from repository '${body.repositoryName}'`,
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

      logger.error('Restore snapshot error:', error);
      
      reply.status(500).send({
        success: false,
        error: 'Restore Error',
        message: 'An error occurred while restoring the snapshot',
      });
    }
  }

  async listSnapshots(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      // Only admins can list snapshots
      await requireRole(['admin'])(request, reply);
      if (reply.sent) return;

      const { repositoryName } = request.params as { repositoryName: string };

      const snapshots = await indexManagerService.listSnapshots(repositoryName);

      reply.send({
        success: true,
        data: { snapshots },
      });

    } catch (error: any) {
      logger.error('List snapshots error:', error);
      
      reply.status(500).send({
        success: false,
        error: 'List Snapshots Error',
        message: 'An error occurred while listing snapshots',
      });
    }
  }

  async deleteSnapshot(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      // Only admins can delete snapshots
      await requireRole(['admin'])(request, reply);
      if (reply.sent) return;

      const { repositoryName, snapshotName } = request.params as { 
        repositoryName: string; 
        snapshotName: string; 
      };

      await indexManagerService.deleteSnapshot(repositoryName, snapshotName);

      reply.send({
        success: true,
        message: `Snapshot '${snapshotName}' deleted from repository '${repositoryName}'`,
      });

    } catch (error: any) {
      logger.error('Delete snapshot error:', error);
      
      reply.status(500).send({
        success: false,
        error: 'Delete Snapshot Error',
        message: 'An error occurred while deleting the snapshot',
      });
    }
  }

  async bulkIndex(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      // Only admins can perform bulk indexing
      await requireRole(['admin'])(request, reply);
      if (reply.sent) return;

      const body = bulkIndexRequestSchema.parse(request.body);

      const documentsWithType = body.documents.map(doc => ({
        ...doc,
        contentType: body.contentType,
      }));

      await searchIndexerService.bulkIndex(documentsWithType);

      reply.send({
        success: true,
        message: `Bulk indexed ${body.documents.length} documents for content type: ${body.contentType}`,
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

      logger.error('Bulk index error:', error);
      
      reply.status(500).send({
        success: false,
        error: 'Bulk Index Error',
        message: 'An error occurred while bulk indexing documents',
      });
    }
  }

  async clearIndex(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      // Only admins can clear indices
      await requireRole(['admin'])(request, reply);
      if (reply.sent) return;

      const { contentType } = request.params as { contentType: ContentType };

      await searchIndexerService.clearIndex(contentType);

      reply.send({
        success: true,
        message: `Index cleared for content type: ${contentType}`,
      });

    } catch (error: any) {
      logger.error('Clear index error:', error);
      
      reply.status(500).send({
        success: false,
        error: 'Clear Index Error',
        message: 'An error occurred while clearing the index',
      });
    }
  }

  async getIndexingStats(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      // Only admins can view indexing stats
      await requireRole(['admin'])(request, reply);
      if (reply.sent) return;

      const { contentType } = request.query as { contentType?: ContentType };

      const stats = await searchIndexerService.getIndexingStats(contentType);

      reply.send({
        success: true,
        data: stats,
      });

    } catch (error: any) {
      logger.error('Get indexing stats error:', error);
      
      reply.status(500).send({
        success: false,
        error: 'Indexing Stats Error',
        message: 'An error occurred while retrieving indexing stats',
      });
    }
  }

  async refreshIndex(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      // Only admins can refresh indices
      await requireRole(['admin'])(request, reply);
      if (reply.sent) return;

      const { contentType } = request.params as { contentType: ContentType };

      await searchIndexerService.refreshIndex(contentType);

      reply.send({
        success: true,
        message: `Index refreshed for content type: ${contentType}`,
      });

    } catch (error: any) {
      logger.error('Refresh index error:', error);
      
      reply.status(500).send({
        success: false,
        error: 'Refresh Index Error',
        message: 'An error occurred while refreshing the index',
      });
    }
  }

  async flushIndex(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      // Only admins can flush indices
      await requireRole(['admin'])(request, reply);
      if (reply.sent) return;

      const { contentType } = request.params as { contentType: ContentType };

      await searchIndexerService.flushIndex(contentType);

      reply.send({
        success: true,
        message: `Index flushed for content type: ${contentType}`,
      });

    } catch (error: any) {
      logger.error('Flush index error:', error);
      
      reply.status(500).send({
        success: false,
        error: 'Flush Index Error',
        message: 'An error occurred while flushing the index',
      });
    }
  }
}

export const adminController = new AdminController();