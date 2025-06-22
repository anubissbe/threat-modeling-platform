import { FastifyInstance } from 'fastify';
import { notificationController } from '../controllers/notification.controller';

export async function routes(fastify: FastifyInstance) {
  // Notification sending endpoints
  fastify.post('/notifications/send', {
    schema: {
      description: 'Send a notification to a user',
      tags: ['notifications'],
      body: {
        type: 'object',
        required: ['userId', 'event', 'data'],
        properties: {
          userId: { type: 'string' },
          event: { 
            type: 'string',
            enum: [
              'threat.detected',
              'threat.resolved',
              'project.completed',
              'project.updated',
              'report.generated',
              'security.alert',
              'user.mentioned',
              'system.maintenance'
            ]
          },
          subject: { type: 'string' },
          recipient: { type: 'string' },
          template: { type: 'string' },
          priority: { 
            type: 'string',
            enum: ['low', 'normal', 'high', 'critical']
          },
          delay: { type: 'number' },
          data: { type: 'object' },
        },
      },
      response: {
        202: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            notificationId: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
    handler: notificationController.sendNotification.bind(notificationController),
  });

  fastify.post('/notifications/bulk', {
    schema: {
      description: 'Send notifications to multiple users',
      tags: ['notifications'],
      body: {
        type: 'object',
        required: ['userIds', 'event', 'data'],
        properties: {
          userIds: {
            type: 'array',
            items: { type: 'string' },
          },
          event: { 
            type: 'string',
            enum: [
              'threat.detected',
              'threat.resolved',
              'project.completed',
              'project.updated',
              'report.generated',
              'security.alert',
              'user.mentioned',
              'system.maintenance'
            ]
          },
          subject: { type: 'string' },
          template: { type: 'string' },
          priority: { 
            type: 'string',
            enum: ['low', 'normal', 'high', 'critical']
          },
          delay: { type: 'number' },
          data: { type: 'object' },
        },
      },
      response: {
        202: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            notificationIds: {
              type: 'array',
              items: { type: 'string' },
            },
            count: { type: 'number' },
            message: { type: 'string' },
          },
        },
      },
    },
    handler: notificationController.sendBulkNotification.bind(notificationController),
  });

  // Queue management endpoints
  fastify.get('/notifications/queue/status', {
    schema: {
      description: 'Get notification queue status',
      tags: ['admin'],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            queue: {
              type: 'object',
              properties: {
                waiting: { type: 'number' },
                active: { type: 'number' },
                completed: { type: 'number' },
                failed: { type: 'number' },
                delayed: { type: 'number' },
              },
            },
          },
        },
      },
    },
    handler: notificationController.getQueueStatus.bind(notificationController),
  });

  fastify.post('/notifications/queue/pause', {
    schema: {
      description: 'Pause notification processing',
      tags: ['admin'],
    },
    handler: notificationController.pauseNotifications.bind(notificationController),
  });

  fastify.post('/notifications/queue/resume', {
    schema: {
      description: 'Resume notification processing',
      tags: ['admin'],
    },
    handler: notificationController.resumeNotifications.bind(notificationController),
  });

  // User preference endpoints
  fastify.get('/users/:userId/preferences', {
    schema: {
      description: 'Get user notification preferences',
      tags: ['preferences'],
      params: {
        type: 'object',
        properties: {
          userId: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            preferences: {
              type: 'object',
              properties: {
                userId: { type: 'string' },
                channels: { type: 'object' },
                events: { type: 'object' },
                doNotDisturb: { type: 'object' },
                quietHours: { type: 'object' },
                createdAt: { type: 'string' },
                updatedAt: { type: 'string' },
              },
            },
          },
        },
      },
    },
    handler: notificationController.getUserPreferences.bind(notificationController),
  });

  fastify.put('/users/:userId/preferences', {
    schema: {
      description: 'Update user notification preferences',
      tags: ['preferences'],
      params: {
        type: 'object',
        properties: {
          userId: { type: 'string' },
        },
      },
      body: {
        type: 'object',
        properties: {
          channels: { type: 'object' },
          events: { type: 'object' },
          doNotDisturb: { type: 'object' },
          quietHours: { type: 'object' },
        },
      },
    },
    handler: notificationController.updateUserPreferences.bind(notificationController),
  });

  fastify.put('/users/:userId/preferences/channels/:channel', {
    schema: {
      description: 'Update channel preference for user',
      tags: ['preferences'],
      params: {
        type: 'object',
        properties: {
          userId: { type: 'string' },
          channel: { 
            type: 'string',
            enum: ['email', 'sms', 'slack', 'webhook']
          },
        },
      },
      body: {
        type: 'object',
        required: ['enabled'],
        properties: {
          enabled: { type: 'boolean' },
        },
      },
    },
    handler: notificationController.updateChannelPreference.bind(notificationController),
  });

  fastify.post('/users/:userId/preferences/dnd', {
    schema: {
      description: 'Set Do Not Disturb for user',
      tags: ['preferences'],
      params: {
        type: 'object',
        properties: {
          userId: { type: 'string' },
        },
      },
      body: {
        type: 'object',
        required: ['enabled'],
        properties: {
          enabled: { type: 'boolean' },
          until: { type: 'string', format: 'date-time' },
        },
      },
    },
    handler: notificationController.setDoNotDisturb.bind(notificationController),
  });

  fastify.post('/users/:userId/preferences/quiet-hours', {
    schema: {
      description: 'Set quiet hours for user',
      tags: ['preferences'],
      params: {
        type: 'object',
        properties: {
          userId: { type: 'string' },
        },
      },
      body: {
        type: 'object',
        required: ['startHour', 'endHour'],
        properties: {
          startHour: { type: 'number', minimum: 0, maximum: 23 },
          endHour: { type: 'number', minimum: 0, maximum: 23 },
          timezone: { type: 'string' },
        },
      },
    },
    handler: notificationController.setQuietHours.bind(notificationController),
  });

  // Unsubscribe endpoints
  fastify.get('/unsubscribe', {
    schema: {
      description: 'Unsubscribe from notifications using token',
      tags: ['unsubscribe'],
      querystring: {
        type: 'object',
        required: ['token'],
        properties: {
          token: { type: 'string' },
        },
      },
    },
    handler: notificationController.unsubscribe.bind(notificationController),
  });

  fastify.post('/users/:userId/resubscribe/:channel', {
    schema: {
      description: 'Resubscribe to channel notifications',
      tags: ['preferences'],
      params: {
        type: 'object',
        properties: {
          userId: { type: 'string' },
          channel: { 
            type: 'string',
            enum: ['email', 'sms', 'slack', 'webhook']
          },
        },
      },
    },
    handler: notificationController.resubscribe.bind(notificationController),
  });

  // Convenience endpoints for common notification types
  fastify.post('/notifications/threat-alert', {
    schema: {
      description: 'Send a threat alert notification',
      tags: ['notifications', 'threats'],
      body: {
        type: 'object',
        required: ['userId', 'threat'],
        properties: {
          userId: { type: 'string' },
          threat: {
            type: 'object',
            required: ['id', 'title', 'severity', 'description'],
            properties: {
              id: { type: 'string' },
              title: { type: 'string' },
              severity: { 
                type: 'string',
                enum: ['low', 'medium', 'high', 'critical']
              },
              description: { type: 'string' },
            },
          },
        },
      },
    },
    handler: notificationController.sendThreatAlert.bind(notificationController),
  });

  fastify.post('/notifications/project-update', {
    schema: {
      description: 'Send a project update notification',
      tags: ['notifications', 'projects'],
      body: {
        type: 'object',
        required: ['userId', 'project'],
        properties: {
          userId: { type: 'string' },
          project: {
            type: 'object',
            required: ['id', 'name', 'status'],
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              status: { type: 'string' },
            },
          },
        },
      },
    },
    handler: notificationController.sendProjectUpdate.bind(notificationController),
  });

  fastify.post('/notifications/security-alert', {
    schema: {
      description: 'Send a security alert to multiple users',
      tags: ['notifications', 'security'],
      body: {
        type: 'object',
        required: ['userIds', 'alert'],
        properties: {
          userIds: {
            type: 'array',
            items: { type: 'string' },
          },
          alert: {
            type: 'object',
            required: ['type', 'severity', 'message'],
            properties: {
              type: { type: 'string' },
              severity: { 
                type: 'string',
                enum: ['low', 'medium', 'high', 'critical']
              },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    handler: notificationController.sendSecurityAlert.bind(notificationController),
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
          },
        },
      },
    },
    handler: async (request, reply) => {
      reply.send({
        status: 'healthy',
        service: 'notification-service',
        timestamp: new Date().toISOString(),
      });
    },
  });
}