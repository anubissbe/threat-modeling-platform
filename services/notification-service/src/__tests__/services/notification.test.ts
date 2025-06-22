import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NotificationService } from '../../services/notification.service';
import { notificationQueue } from '../../services/queue.service';
import { preferenceService } from '../../services/preference.service';
import { templateService } from '../../services/template.service';

// Mock dependencies
vi.mock('../../services/queue.service');
vi.mock('../../services/preference.service');
vi.mock('../../services/template.service');

describe('NotificationService', () => {
  let notificationService: NotificationService;

  beforeEach(() => {
    notificationService = new NotificationService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('send', () => {
    const mockRequest = {
      userId: 'user123',
      event: 'threat.detected' as const,
      subject: 'Test Notification',
      data: {
        threat: {
          id: 'threat123',
          title: 'Test Threat',
          severity: 'high',
          description: 'Test description',
        },
      },
    };

    it('should send notification to enabled channels', async () => {
      // Mock preferences service to return enabled channels
      vi.mocked(preferenceService.getEnabledChannelsForEvent)
        .mockResolvedValue(['email', 'slack']);
      
      vi.mocked(preferenceService.shouldSendNotification)
        .mockResolvedValue(true);

      vi.mocked(notificationQueue.enqueue)
        .mockResolvedValue({} as any);

      const result = await notificationService.send(mockRequest);

      expect(result).toBeDefined();
      expect(preferenceService.getEnabledChannelsForEvent).toHaveBeenCalledWith(
        'user123',
        'threat.detected'
      );
      expect(notificationQueue.enqueue).toHaveBeenCalledTimes(2);
    });

    it('should skip disabled channels', async () => {
      vi.mocked(preferenceService.getEnabledChannelsForEvent)
        .mockResolvedValue(['email', 'slack']);
      
      vi.mocked(preferenceService.shouldSendNotification)
        .mockImplementation(async (userId, channel) => {
          return channel === 'email'; // Only email enabled
        });

      vi.mocked(notificationQueue.enqueue)
        .mockResolvedValue({} as any);

      await notificationService.send(mockRequest);

      expect(notificationQueue.enqueue).toHaveBeenCalledTimes(1);
    });

    it('should handle no enabled channels', async () => {
      vi.mocked(preferenceService.getEnabledChannelsForEvent)
        .mockResolvedValue([]);

      const result = await notificationService.send(mockRequest);

      expect(result).toBeDefined();
      expect(notificationQueue.enqueue).not.toHaveBeenCalled();
    });

    it('should validate request parameters', async () => {
      const invalidRequest = {
        userId: '',
        event: 'threat.detected' as const,
        data: {},
      };

      await expect(notificationService.send(invalidRequest))
        .rejects.toThrow('User ID is required');
    });
  });

  describe('sendBulk', () => {
    const mockBulkRequest = {
      userIds: ['user1', 'user2', 'user3'],
      event: 'security.alert' as const,
      subject: 'Security Alert',
      data: {
        alert: {
          type: 'intrusion',
          severity: 'critical',
          message: 'Unauthorized access detected',
        },
      },
    };

    it('should send notifications to all users', async () => {
      vi.mocked(preferenceService.getEnabledChannelsForEvent)
        .mockResolvedValue(['email']);
      
      vi.mocked(preferenceService.shouldSendNotification)
        .mockResolvedValue(true);

      vi.mocked(notificationQueue.enqueue)
        .mockResolvedValue({} as any);

      const results = await notificationService.sendBulk(mockBulkRequest);

      expect(results).toHaveLength(3);
      expect(preferenceService.getEnabledChannelsForEvent).toHaveBeenCalledTimes(3);
    });
  });

  describe('convenience methods', () => {
    beforeEach(() => {
      vi.mocked(preferenceService.getEnabledChannelsForEvent)
        .mockResolvedValue(['email']);
      
      vi.mocked(preferenceService.shouldSendNotification)
        .mockResolvedValue(true);

      vi.mocked(notificationQueue.enqueue)
        .mockResolvedValue({} as any);
    });

    it('should send threat alert', async () => {
      const threat = {
        id: 'threat123',
        title: 'SQL Injection',
        severity: 'high',
        description: 'Potential SQL injection vulnerability',
      };

      const result = await notificationService.sendThreatAlert('user123', threat);

      expect(result).toBeDefined();
      expect(notificationQueue.enqueue).toHaveBeenCalled();
    });

    it('should send project update', async () => {
      const project = {
        id: 'project123',
        name: 'E-commerce Security',
        status: 'completed',
      };

      const result = await notificationService.sendProjectUpdate('user123', project);

      expect(result).toBeDefined();
      expect(notificationQueue.enqueue).toHaveBeenCalled();
    });

    it('should send security alert to multiple users', async () => {
      const alert = {
        type: 'data_breach',
        severity: 'critical',
        message: 'Potential data breach detected',
      };

      const results = await notificationService.sendSecurityAlert(
        ['user1', 'user2'],
        alert
      );

      expect(results).toHaveLength(2);
    });
  });
});

describe('NotificationService Integration', () => {
  it('should handle template rendering in email notifications', async () => {
    const service = new NotificationService();
    
    // Mock template service
    vi.mocked(templateService.render)
      .mockResolvedValue('<html>Rendered email content</html>');

    const request = {
      userId: 'user123',
      event: 'threat.detected' as const,
      template: 'threat_detected',
      data: { threat: { id: 'threat123' } },
    };

    vi.mocked(preferenceService.getEnabledChannelsForEvent)
      .mockResolvedValue(['email']);
    
    vi.mocked(preferenceService.shouldSendNotification)
      .mockResolvedValue(true);

    vi.mocked(notificationQueue.enqueue)
      .mockResolvedValue({} as any);

    await service.send(request);

    expect(notificationQueue.enqueue).toHaveBeenCalledWith(
      'email',
      expect.objectContaining({
        template: 'threat_detected',
      }),
      expect.any(Object)
    );
  });
});