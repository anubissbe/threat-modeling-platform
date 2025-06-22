import { FastifyInstance } from 'fastify';
import { ReportController } from '../controllers/report.controller';
import { authMiddleware, requireRole } from '../middleware/auth.middleware';
import { ReportType, ReportFormat, ReportStatus } from '../types';

export async function reportRoutes(
  fastify: FastifyInstance,
  options: { controller: ReportController }
): Promise<void> {
  const { controller } = options;

  // Generate report
  fastify.post(
    '/generate',
    {
      preValidation: [authMiddleware],
      schema: {
        description: 'Generate a new report',
        tags: ['Reports'],
        body: {
          type: 'object',
          required: ['type', 'format', 'projectId'],
          properties: {
            type: {
              type: 'string',
              enum: Object.values(ReportType),
              description: 'Type of report to generate',
            },
            format: {
              type: 'string',
              enum: Object.values(ReportFormat),
              description: 'Output format for the report',
            },
            projectId: {
              type: 'string',
              description: 'Project ID for the report',
            },
            threatModelId: {
              type: 'string',
              description: 'Specific threat model ID (optional, defaults to latest)',
            },
            options: {
              type: 'object',
              properties: {
                includeExecutiveSummary: { type: 'boolean' },
                includeDetailedThreats: { type: 'boolean' },
                includeMitigations: { type: 'boolean' },
                includeRiskMatrix: { type: 'boolean' },
                includeCharts: { type: 'boolean' },
                includeAppendix: { type: 'boolean' },
                branding: {
                  type: 'object',
                  properties: {
                    logo: { type: 'string' },
                    primaryColor: { type: 'string' },
                    secondaryColor: { type: 'string' },
                    fontFamily: { type: 'string' },
                    headerText: { type: 'string' },
                    footerText: { type: 'string' },
                    watermark: { type: 'string' },
                  },
                },
                language: { type: 'string' },
                timezone: { type: 'string' },
              },
            },
            metadata: {
              type: 'object',
              properties: {
                confidentiality: {
                  type: 'string',
                  enum: ['public', 'internal', 'confidential', 'secret'],
                },
                tags: {
                  type: 'array',
                  items: { type: 'string' },
                },
              },
            },
          },
        },
        response: {
          200: {
            description: 'Report generation job created',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              jobId: { type: 'string' },
              message: { type: 'string' },
              status: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => controller.generateReport(request, reply)
  );

  // Get report status
  fastify.get(
    '/status/:jobId',
    {
      preValidation: [authMiddleware],
      schema: {
        description: 'Get report generation job status',
        tags: ['Reports'],
        params: {
          type: 'object',
          properties: {
            jobId: { type: 'string' },
          },
          required: ['jobId'],
        },
        response: {
          200: {
            description: 'Job status',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              job: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  status: { type: 'string' },
                  progress: { type: 'number' },
                  result: { type: 'object', nullable: true },
                  error: { type: 'string', nullable: true },
                  createdAt: { type: 'string' },
                  startedAt: { type: 'string', nullable: true },
                  completedAt: { type: 'string', nullable: true },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => controller.getReportStatus(request, reply)
  );

  // Download report
  fastify.get(
    '/download/:reportId',
    {
      preValidation: [authMiddleware],
      schema: {
        description: 'Download a generated report',
        tags: ['Reports'],
        params: {
          type: 'object',
          properties: {
            reportId: { type: 'string' },
          },
          required: ['reportId'],
        },
      },
    },
    async (request, reply) => controller.downloadReport(request, reply)
  );

  // Get report URL
  fastify.get(
    '/url/:reportId',
    {
      preValidation: [authMiddleware],
      schema: {
        description: 'Get a signed URL for report download',
        tags: ['Reports'],
        params: {
          type: 'object',
          properties: {
            reportId: { type: 'string' },
          },
          required: ['reportId'],
        },
        querystring: {
          type: 'object',
          properties: {
            expiresIn: {
              type: 'number',
              description: 'URL expiration time in seconds',
              default: 3600,
            },
          },
        },
        response: {
          200: {
            description: 'Signed URL for report',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              url: { type: 'string' },
              expiresIn: { type: 'number' },
              expiresAt: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => controller.getReportUrl(request, reply)
  );

  // List reports
  fastify.get(
    '/',
    {
      preValidation: [authMiddleware],
      schema: {
        description: 'List user reports',
        tags: ['Reports'],
        querystring: {
          type: 'object',
          properties: {
            projectId: { type: 'string' },
            type: {
              type: 'string',
              enum: Object.values(ReportType),
            },
            status: {
              type: 'string',
              enum: Object.values(ReportStatus),
            },
            limit: {
              type: 'number',
              default: 50,
              minimum: 1,
              maximum: 100,
            },
            offset: {
              type: 'number',
              default: 0,
              minimum: 0,
            },
          },
        },
        response: {
          200: {
            description: 'List of reports',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              reports: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    type: { type: 'string' },
                    format: { type: 'string' },
                    status: { type: 'string' },
                    projectId: { type: 'string' },
                    createdAt: { type: 'string' },
                    completedAt: { type: 'string', nullable: true },
                  },
                },
              },
              total: { type: 'number' },
              limit: { type: 'number' },
              offset: { type: 'number' },
            },
          },
        },
      },
    },
    async (request, reply) => controller.listReports(request, reply)
  );

  // Delete report
  fastify.delete(
    '/:reportId',
    {
      preValidation: [authMiddleware],
      schema: {
        description: 'Delete a report',
        tags: ['Reports'],
        params: {
          type: 'object',
          properties: {
            reportId: { type: 'string' },
          },
          required: ['reportId'],
        },
        response: {
          200: {
            description: 'Report deleted',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => controller.deleteReport(request, reply)
  );

  // Retry failed job
  fastify.post(
    '/retry/:jobId',
    {
      preValidation: [authMiddleware],
      schema: {
        description: 'Retry a failed report generation job',
        tags: ['Reports'],
        params: {
          type: 'object',
          properties: {
            jobId: { type: 'string' },
          },
          required: ['jobId'],
        },
        response: {
          200: {
            description: 'Job retry initiated',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => controller.retryJob(request, reply)
  );

  // Admin routes
  fastify.register(
    async function adminRoutes(fastify: FastifyInstance) {
      // Get queue statistics
      fastify.get(
        '/queue/stats',
        {
          preValidation: [authMiddleware, requireRole('admin')],
          schema: {
            description: 'Get queue statistics (admin only)',
            tags: ['Admin'],
            response: {
              200: {
                description: 'Queue statistics',
                type: 'object',
                properties: {
                  success: { type: 'boolean' },
                  stats: {
                    type: 'object',
                    properties: {
                      waiting: { type: 'number' },
                      active: { type: 'number' },
                      completed: { type: 'number' },
                      failed: { type: 'number' },
                      delayed: { type: 'number' },
                      paused: { type: 'boolean' },
                    },
                  },
                },
              },
            },
          },
        },
        async (request, reply) => controller.getQueueStats(request, reply)
      );
    },
    { prefix: '/admin' }
  );

  // Health check
  fastify.get(
    '/health',
    {
      schema: {
        description: 'Health check endpoint',
        tags: ['Health'],
        response: {
          200: {
            description: 'Service health status',
            type: 'object',
            properties: {
              status: { type: 'string' },
              timestamp: { type: 'string' },
              uptime: { type: 'number' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      reply.send({
        status: 'healthy',
        timestamp: new Date(),
        uptime: process.uptime(),
      });
    }
  );
}