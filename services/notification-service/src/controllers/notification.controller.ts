import { FastifyRequest, FastifyReply } from 'fastify';
import { notificationService } from '../services/notification.service';
import { preferenceService } from '../services/preference.service';
import { logger } from '../utils/logger';
import {
  NotificationRequest,
  BulkNotificationRequest,
  UserPreferences,
  NotificationChannel,
  NotificationEvent,
} from '../types';

// Request schemas
interface SendNotificationRequest {
  Body: NotificationRequest;
}

interface BulkNotificationRequest {
  Body: BulkNotificationRequest;
}

interface UpdatePreferencesRequest {
  Params: {
    userId: string;
  };
  Body: Partial<UserPreferences>;
}

interface UpdateChannelPreferenceRequest {
  Params: {
    userId: string;
    channel: NotificationChannel;
  };
  Body: {
    enabled: boolean;
  };
}

interface UnsubscribeRequest {
  Querystring: {
    token: string;
  };
}

export class NotificationController {
  async sendNotification(
    request: FastifyRequest<SendNotificationRequest>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const notificationId = await notificationService.send(request.body);
      
      reply.status(202).send({
        success: true,
        notificationId,
        message: 'Notification queued successfully',
      });
    } catch (error: any) {
      logger.error('Failed to send notification:', error);
      reply.status(400).send({
        success: false,
        error: error.message,
      });
    }
  }

  async sendBulkNotification(
    request: FastifyRequest<BulkNotificationRequest>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const notificationIds = await notificationService.sendBulk(request.body);
      
      reply.status(202).send({
        success: true,
        notificationIds,
        count: notificationIds.length,
        message: 'Bulk notifications queued successfully',
      });
    } catch (error: any) {
      logger.error('Failed to send bulk notification:', error);
      reply.status(400).send({
        success: false,
        error: error.message,
      });
    }
  }

  async getQueueStatus(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const status = await notificationService.getQueueStatus();
      
      reply.send({
        success: true,
        queue: status,
      });
    } catch (error: any) {
      logger.error('Failed to get queue status:', error);
      reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  }

  async pauseNotifications(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    try {
      await notificationService.pauseNotifications();
      
      reply.send({
        success: true,
        message: 'Notifications paused',
      });
    } catch (error: any) {
      logger.error('Failed to pause notifications:', error);
      reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  }

  async resumeNotifications(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    try {
      await notificationService.resumeNotifications();
      
      reply.send({
        success: true,
        message: 'Notifications resumed',
      });
    } catch (error: any) {
      logger.error('Failed to resume notifications:', error);
      reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  }

  async getUserPreferences(
    request: FastifyRequest<{ Params: { userId: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { userId } = request.params;
      const preferences = await preferenceService.getUserPreferences(userId);
      
      reply.send({
        success: true,
        preferences,
      });
    } catch (error: any) {
      logger.error('Failed to get user preferences:', error);
      reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  }

  async updateUserPreferences(
    request: FastifyRequest<UpdatePreferencesRequest>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { userId } = request.params;
      const currentPreferences = await preferenceService.getUserPreferences(userId);
      
      const updatedPreferences: UserPreferences = {
        ...currentPreferences,
        ...request.body,
        userId,
        updatedAt: new Date(),
      };
      
      await preferenceService.setUserPreferences(userId, updatedPreferences);
      
      reply.send({
        success: true,
        preferences: updatedPreferences,
        message: 'Preferences updated successfully',
      });
    } catch (error: any) {
      logger.error('Failed to update user preferences:', error);
      reply.status(400).send({
        success: false,
        error: error.message,
      });
    }
  }

  async updateChannelPreference(
    request: FastifyRequest<UpdateChannelPreferenceRequest>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { userId, channel } = request.params;
      const { enabled } = request.body;
      
      await preferenceService.updateChannelPreference(userId, channel, enabled);
      
      reply.send({
        success: true,
        message: `Channel ${channel} ${enabled ? 'enabled' : 'disabled'} for user ${userId}`,
      });
    } catch (error: any) {
      logger.error('Failed to update channel preference:', error);
      reply.status(400).send({
        success: false,
        error: error.message,
      });
    }
  }

  async setDoNotDisturb(
    request: FastifyRequest<{
      Params: { userId: string };
      Body: { enabled: boolean; until?: string };
    }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { userId } = request.params;
      const { enabled, until } = request.body;
      
      await preferenceService.setDoNotDisturb(
        userId,
        enabled,
        until ? new Date(until) : undefined
      );
      
      reply.send({
        success: true,
        message: `Do Not Disturb ${enabled ? 'enabled' : 'disabled'} for user ${userId}`,
      });
    } catch (error: any) {
      logger.error('Failed to set Do Not Disturb:', error);
      reply.status(400).send({
        success: false,
        error: error.message,
      });
    }
  }

  async setQuietHours(
    request: FastifyRequest<{
      Params: { userId: string };
      Body: {
        startHour: number;
        endHour: number;
        timezone?: string;
      };
    }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { userId } = request.params;
      const { startHour, endHour, timezone = 'UTC' } = request.body;
      
      await preferenceService.setQuietHours(userId, startHour, endHour, timezone);
      
      reply.send({
        success: true,
        message: `Quiet hours set for user ${userId}: ${startHour}-${endHour} ${timezone}`,
      });
    } catch (error: any) {
      logger.error('Failed to set quiet hours:', error);
      reply.status(400).send({
        success: false,
        error: error.message,
      });
    }
  }

  async unsubscribe(
    request: FastifyRequest<UnsubscribeRequest>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { token } = request.query;
      
      const result = await preferenceService.verifyUnsubscribeToken(token);
      
      if (!result) {
        reply.status(400).send({
          success: false,
          error: 'Invalid or expired unsubscribe token',
        });
        return;
      }
      
      const { userId, channel } = result;
      await preferenceService.addToUnsubscribeList(userId, channel);
      
      reply.send({
        success: true,
        message: `Successfully unsubscribed from ${channel} notifications`,
      });
    } catch (error: any) {
      logger.error('Failed to unsubscribe:', error);
      reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  }

  async resubscribe(
    request: FastifyRequest<{
      Params: { userId: string; channel: NotificationChannel };
    }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { userId, channel } = request.params;
      
      await preferenceService.removeFromUnsubscribeList(userId, channel);
      
      reply.send({
        success: true,
        message: `Successfully resubscribed to ${channel} notifications`,
      });
    } catch (error: any) {
      logger.error('Failed to resubscribe:', error);
      reply.status(400).send({
        success: false,
        error: error.message,
      });
    }
  }

  // Convenience endpoints for common notification types
  async sendThreatAlert(
    request: FastifyRequest<{
      Body: {
        userId: string;
        threat: {
          id: string;
          title: string;
          severity: string;
          description: string;
        };
      };
    }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { userId, threat } = request.body;
      const notificationId = await notificationService.sendThreatAlert(userId, threat);
      
      reply.status(202).send({
        success: true,
        notificationId,
        message: 'Threat alert sent successfully',
      });
    } catch (error: any) {
      logger.error('Failed to send threat alert:', error);
      reply.status(400).send({
        success: false,
        error: error.message,
      });
    }
  }

  async sendProjectUpdate(
    request: FastifyRequest<{
      Body: {
        userId: string;
        project: {
          id: string;
          name: string;
          status: string;
        };
      };
    }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { userId, project } = request.body;
      const notificationId = await notificationService.sendProjectUpdate(userId, project);
      
      reply.status(202).send({
        success: true,
        notificationId,
        message: 'Project update sent successfully',
      });
    } catch (error: any) {
      logger.error('Failed to send project update:', error);
      reply.status(400).send({
        success: false,
        error: error.message,
      });
    }
  }

  async sendSecurityAlert(
    request: FastifyRequest<{
      Body: {
        userIds: string[];
        alert: {
          type: string;
          severity: string;
          message: string;
        };
      };
    }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { userIds, alert } = request.body;
      const notificationIds = await notificationService.sendSecurityAlert(userIds, alert);
      
      reply.status(202).send({
        success: true,
        notificationIds,
        count: notificationIds.length,
        message: 'Security alert sent successfully',
      });
    } catch (error: any) {
      logger.error('Failed to send security alert:', error);
      reply.status(400).send({
        success: false,
        error: error.message,
      });
    }
  }
}

export const notificationController = new NotificationController();