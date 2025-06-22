import { FastifyInstance } from 'fastify';
import { fileController } from '../controllers/file.controller';
import { fileSizeLimit, fileOperationRateLimit, requireAdmin } from '../middleware/auth';
import { config, getAllowedMimeTypes } from '../config';

export async function routes(fastify: FastifyInstance) {
  // File upload endpoints
  fastify.post('/files/upload', {
    preHandler: [fileSizeLimit(), fileOperationRateLimit(50, 60000)],
    schema: {
      description: 'Upload a single file',
      tags: ['files'],
      consumes: ['multipart/form-data'],
      body: {
        type: 'object',
        properties: {
          file: {
            type: 'string',
            format: 'binary',
            description: 'File to upload',
          },
          projectId: {
            type: 'string',
            description: 'Project ID to associate with the file',
          },
          threatModelId: {
            type: 'string',
            description: 'Threat model ID to associate with the file',
          },
          isPublic: {
            type: 'boolean',
            description: 'Whether the file is publicly accessible',
            default: false,
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Tags to associate with the file',
          },
          description: {
            type: 'string',
            description: 'File description',
          },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            file: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                originalName: { type: 'string' },
                filename: { type: 'string' },
                mimeType: { type: 'string' },
                size: { type: 'number' },
                url: { type: 'string' },
                downloadUrl: { type: 'string' },
                thumbnailUrl: { type: 'string' },
                checksum: { type: 'string' },
                metadata: { type: 'object' },
              },
            },
          },
        },
      },
    },
    handler: fileController.uploadFile.bind(fileController),
  });

  fastify.post('/files/upload/multiple', {
    preHandler: [fileSizeLimit(), fileOperationRateLimit(20, 60000)],
    schema: {
      description: 'Upload multiple files',
      tags: ['files'],
      consumes: ['multipart/form-data'],
      response: {
        207: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            results: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  success: { type: 'boolean' },
                  file: { type: 'object' },
                  filename: { type: 'string' },
                  error: { type: 'string' },
                },
              },
            },
            summary: {
              type: 'object',
              properties: {
                total: { type: 'number' },
                successful: { type: 'number' },
                failed: { type: 'number' },
              },
            },
          },
        },
      },
    },
    handler: fileController.uploadMultipleFiles.bind(fileController),
  });

  // File download endpoints
  fastify.get('/files/:fileId/download', {
    schema: {
      description: 'Download a file',
      tags: ['files'],
      params: {
        type: 'object',
        properties: {
          fileId: { type: 'string' },
        },
        required: ['fileId'],
      },
      response: {
        200: {
          description: 'File content',
          type: 'string',
          format: 'binary',
        },
      },
    },
    handler: fileController.downloadFile.bind(fileController),
  });

  // File metadata endpoints
  fastify.get('/files/:fileId', {
    schema: {
      description: 'Get file metadata',
      tags: ['files'],
      params: {
        type: 'object',
        properties: {
          fileId: { type: 'string' },
        },
        required: ['fileId'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            file: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                originalName: { type: 'string' },
                filename: { type: 'string' },
                mimeType: { type: 'string' },
                size: { type: 'number' },
                checksum: { type: 'string' },
                userId: { type: 'string' },
                projectId: { type: 'string' },
                threatModelId: { type: 'string' },
                isPublic: { type: 'boolean' },
                tags: { type: 'array', items: { type: 'string' } },
                description: { type: 'string' },
                version: { type: 'number' },
                createdAt: { type: 'string', format: 'date-time' },
                updatedAt: { type: 'string', format: 'date-time' },
              },
            },
          },
        },
      },
    },
    handler: fileController.getFile.bind(fileController),
  });

  fastify.delete('/files/:fileId', {
    schema: {
      description: 'Delete a file',
      tags: ['files'],
      params: {
        type: 'object',
        properties: {
          fileId: { type: 'string' },
        },
        required: ['fileId'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
          },
        },
      },
    },
    handler: fileController.deleteFile.bind(fileController),
  });

  // File search endpoint
  fastify.get('/files', {
    schema: {
      description: 'Search files',
      tags: ['files'],
      querystring: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
          mimeType: { type: 'string', description: 'Filter by MIME type' },
          tags: { 
            type: 'array', 
            items: { type: 'string' },
            description: 'Filter by tags',
          },
          projectId: { type: 'string', description: 'Filter by project ID' },
          threatModelId: { type: 'string', description: 'Filter by threat model ID' },
          isPublic: { type: 'boolean', description: 'Filter by public status' },
          sortBy: { 
            type: 'string', 
            enum: ['name', 'size', 'createdAt', 'updatedAt'],
            description: 'Sort field',
          },
          sortOrder: { 
            type: 'string', 
            enum: ['asc', 'desc'],
            description: 'Sort order',
          },
          limit: { 
            type: 'number', 
            minimum: 1, 
            maximum: 100,
            description: 'Results per page',
          },
          offset: { 
            type: 'number', 
            minimum: 0,
            description: 'Results offset',
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            files: {
              type: 'array',
              items: { type: 'object' },
            },
            total: { type: 'number' },
            page: { type: 'number' },
            limit: { type: 'number' },
          },
        },
      },
    },
    handler: fileController.searchFiles.bind(fileController),
  });

  // File sharing endpoints
  fastify.post('/files/:fileId/share', {
    schema: {
      description: 'Create a file share',
      tags: ['files', 'sharing'],
      params: {
        type: 'object',
        properties: {
          fileId: { type: 'string' },
        },
        required: ['fileId'],
      },
      body: {
        type: 'object',
        properties: {
          expiresAt: { 
            type: 'string', 
            format: 'date-time',
            description: 'Share expiration date',
          },
          maxDownloads: { 
            type: 'number',
            minimum: 1,
            description: 'Maximum number of downloads',
          },
          password: { 
            type: 'string',
            minLength: 6,
            description: 'Password protection',
          },
          allowedEmails: {
            type: 'array',
            items: { type: 'string', format: 'email' },
            description: 'Allowed email addresses',
          },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            share: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                shareToken: { type: 'string' },
                shareUrl: { type: 'string' },
                expiresAt: { type: 'string', format: 'date-time' },
                maxDownloads: { type: 'number' },
              },
            },
          },
        },
      },
    },
    handler: fileController.createFileShare.bind(fileController),
  });

  // Image processing endpoints
  fastify.post('/files/:fileId/process', {
    schema: {
      description: 'Process an image file',
      tags: ['files', 'image-processing'],
      params: {
        type: 'object',
        properties: {
          fileId: { type: 'string' },
        },
        required: ['fileId'],
      },
      body: {
        type: 'object',
        properties: {
          resize: {
            type: 'object',
            properties: {
              width: { type: 'number', minimum: 1 },
              height: { type: 'number', minimum: 1 },
              fit: { 
                type: 'string',
                enum: ['cover', 'contain', 'fill', 'inside', 'outside'],
              },
              quality: { type: 'number', minimum: 1, maximum: 100 },
            },
          },
          compress: {
            type: 'object',
            properties: {
              quality: { type: 'number', minimum: 1, maximum: 100 },
              progressive: { type: 'boolean' },
            },
          },
          format: {
            type: 'string',
            enum: ['jpeg', 'png', 'webp', 'avif'],
          },
          watermark: {
            type: 'object',
            properties: {
              text: { type: 'string' },
              position: {
                type: 'string',
                enum: ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'center'],
              },
              opacity: { type: 'number', minimum: 0, maximum: 1 },
            },
          },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            processedFile: { type: 'object' },
          },
        },
      },
    },
    handler: fileController.processImage.bind(fileController),
  });

  // Bulk operations
  fastify.delete('/files/bulk', {
    preHandler: [fileOperationRateLimit(20, 60000)],
    schema: {
      description: 'Delete multiple files',
      tags: ['files', 'bulk'],
      body: {
        type: 'object',
        properties: {
          fileIds: {
            type: 'array',
            items: { type: 'string' },
            minItems: 1,
            maxItems: 100,
          },
        },
        required: ['fileIds'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            results: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  success: { type: 'boolean' },
                  fileId: { type: 'string' },
                  error: { type: 'string' },
                },
              },
            },
            summary: {
              type: 'object',
              properties: {
                total: { type: 'number' },
                successful: { type: 'number' },
                failed: { type: 'number' },
              },
            },
          },
        },
      },
    },
    handler: fileController.deleteMultipleFiles.bind(fileController),
  });

  // Statistics and quota endpoints
  fastify.get('/files/stats', {
    schema: {
      description: 'Get file statistics',
      tags: ['files', 'stats'],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            stats: {
              type: 'object',
              properties: {
                totalFiles: { type: 'number' },
                totalSize: { type: 'number' },
                filesByType: { type: 'object' },
                sizeByType: { type: 'object' },
                avgFileSize: { type: 'number' },
                uploadTrend: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      date: { type: 'string' },
                      count: { type: 'number' },
                      size: { type: 'number' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    handler: fileController.getFileStats.bind(fileController),
  });

  fastify.get('/files/quota', {
    schema: {
      description: 'Get user storage quota',
      tags: ['files', 'quota'],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            quota: {
              type: 'object',
              properties: {
                quota: { type: 'number' },
                used: { type: 'number' },
                remaining: { type: 'number' },
                fileCount: { type: 'number' },
              },
            },
          },
        },
      },
    },
    handler: fileController.getUserQuota.bind(fileController),
  });

  // Admin endpoints
  fastify.register(async function (fastify) {
    fastify.addHook('preHandler', requireAdmin());

    fastify.get('/admin/files/stats', {
      schema: {
        description: 'Get global file statistics (admin only)',
        tags: ['admin', 'files'],
      },
      handler: async (request, reply) => {
        try {
          const stats = await fileController.getFileStats.call({
            fileService: { getFileStats: () => fileController.getFileStats }
          } as any, request, reply);
          // Admin gets global stats (no user filter)
        } catch (error: any) {
          reply.status(500).send({
            success: false,
            error: error.message,
          });
        }
      },
    });
  });

  // Health check
  fastify.get('/health', {
    schema: {
      description: 'Health check endpoint',
      tags: ['health'],
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            service: { type: 'string' },
            timestamp: { type: 'string' },
            storage: { type: 'string' },
            allowedTypes: {
              type: 'array',
              items: { type: 'string' },
            },
            maxFileSize: { type: 'number' },
          },
        },
      },
    },
    handler: async (request, reply) => {
      reply.send({
        status: 'healthy',
        service: 'file-service',
        timestamp: new Date().toISOString(),
        storage: config.STORAGE_PROVIDER,
        allowedTypes: getAllowedMimeTypes(),
        maxFileSize: config.MAX_FILE_SIZE,
      });
    },
  });
}