import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { createApp } from '../../app';
import { notificationService } from '../../services/notification.service';
import { preferenceService } from '../../services/preference.service';

// Mock services
vi.mock('../../services/notification.service');
vi.mock('../../services/preference.service');
vi.mock('../../services/template.service');
vi.mock('../../services/queue.service');

describe('NotificationController', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await createApp();
  });

  afterEach(async () => {
    await app.close();
    vi.resetAllMocks();
  });

  describe('POST /api/v1/notifications/send', () => {
    const validRequest = {
      userId: 'user123',
      event: 'threat.detected',
      subject: 'Test Notification',
      data: {
        threat: {
          id: 'threat123',
          title: 'Test Threat',
        },
      },
    };

    it('should send notification successfully', async () => {
      vi.mocked(notificationService.send)
        .mockResolvedValue('notification123');

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/notifications/send',
        headers: {
          'authorization': 'Bearer valid-token',
        },
        payload: validRequest,
      });

      expect(response.statusCode).toBe(202);
      const body = response.json();
      expect(body.success).toBe(true);
      expect(body.notificationId).toBe('notification123');
    });

    it('should return 400 for invalid request', async () => {
      vi.mocked(notificationService.send)
        .mockRejectedValue(new Error('User ID is required'));

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/notifications/send',
        headers: {
          'authorization': 'Bearer valid-token',
        },
        payload: { ...validRequest, userId: '' },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.success).toBe(false);
    });

    it('should return 401 for missing authorization', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/notifications/send',
        payload: validRequest,
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('POST /api/v1/notifications/bulk', () => {
    const validBulkRequest = {
      userIds: ['user1', 'user2'],
      event: 'security.alert',
      data: {
        alert: {
          type: 'intrusion',
          severity: 'critical',
        },
      },
    };

    it('should send bulk notifications successfully', async () => {
      vi.mocked(notificationService.sendBulk)
        .mockResolvedValue(['notif1', 'notif2']);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/notifications/bulk',
        headers: {
          'authorization': 'Bearer valid-token',
        },
        payload: validBulkRequest,
      });

      expect(response.statusCode).toBe(202);
      const body = response.json();
      expect(body.success).toBe(true);
      expect(body.count).toBe(2);
    });
  });

  describe('GET /api/v1/users/:userId/preferences', () => {
    it('should get user preferences', async () => {
      const mockPreferences = {
        userId: 'user123',
        channels: { email: true, sms: false },
        events: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(preferenceService.getUserPreferences)
        .mockResolvedValue(mockPreferences);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/users/user123/preferences',
        headers: {
          'authorization': 'Bearer valid-token',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.success).toBe(true);
      expect(body.preferences.userId).toBe('user123');
    });
  });

  describe('PUT /api/v1/users/:userId/preferences/channels/:channel', () => {
    it('should update channel preference', async () => {
      vi.mocked(preferenceService.updateChannelPreference)
        .mockResolvedValue();

      const response = await app.inject({
        method: 'PUT',
        url: '/api/v1/users/user123/preferences/channels/email',
        headers: {
          'authorization': 'Bearer valid-token',
        },
        payload: { enabled: false },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.success).toBe(true);
      expect(preferenceService.updateChannelPreference).toHaveBeenCalledWith(
        'user123',
        'email',
        false
      );
    });
  });

  describe('GET /api/v1/unsubscribe', () => {
    it('should unsubscribe with valid token', async () => {
      vi.mocked(preferenceService.verifyUnsubscribeToken)
        .mockResolvedValue({ userId: 'user123', channel: 'email' });
      
      vi.mocked(preferenceService.addToUnsubscribeList)
        .mockResolvedValue();

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/unsubscribe?token=valid-token',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.success).toBe(true);
    });

    it('should return 400 for invalid token', async () => {
      vi.mocked(preferenceService.verifyUnsubscribeToken)
        .mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/unsubscribe?token=invalid-token',
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /api/v1/notifications/queue/status', () => {
    it('should get queue status', async () => {
      const mockStatus = {
        waiting: 10,
        active: 2,
        completed: 100,
        failed: 5,
        delayed: 3,
      };

      vi.mocked(notificationService.getQueueStatus)
        .mockResolvedValue(mockStatus);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/notifications/queue/status',
        headers: {
          'authorization': 'Bearer valid-token',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.success).toBe(true);
      expect(body.queue).toEqual(mockStatus);
    });
  });

  describe('Convenience endpoints', () => {
    it('should send threat alert', async () => {
      vi.mocked(notificationService.sendThreatAlert)
        .mockResolvedValue('notif123');

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/notifications/threat-alert',
        headers: {
          'authorization': 'Bearer valid-token',
        },
        payload: {
          userId: 'user123',
          threat: {
            id: 'threat123',
            title: 'SQL Injection',
            severity: 'high',
            description: 'Test threat',
          },
        },
      });

      expect(response.statusCode).toBe(202);
      const body = response.json();
      expect(body.success).toBe(true);
    });

    it('should send project update', async () => {
      vi.mocked(notificationService.sendProjectUpdate)
        .mockResolvedValue('notif123');

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/notifications/project-update',
        headers: {
          'authorization': 'Bearer valid-token',
        },
        payload: {
          userId: 'user123',
          project: {
            id: 'project123',
            name: 'Security Review',
            status: 'completed',
          },
        },
      });

      expect(response.statusCode).toBe(202);
    });

    it('should send security alert', async () => {
      vi.mocked(notificationService.sendSecurityAlert)
        .mockResolvedValue(['notif1', 'notif2']);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/notifications/security-alert',
        headers: {
          'authorization': 'Bearer valid-token',
        },
        payload: {
          userIds: ['user1', 'user2'],
          alert: {
            type: 'intrusion',
            severity: 'critical',
            message: 'Unauthorized access',
          },
        },
      });

      expect(response.statusCode).toBe(202);
      const body = response.json();
      expect(body.count).toBe(2);
    });
  });

  describe('Health check', () => {
    it('should return healthy status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/health',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.status).toBe('healthy');
      expect(body.service).toBe('notification-service');
    });
  });
});