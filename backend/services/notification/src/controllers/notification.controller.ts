import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import notificationService from '../services/notification.service';
import {
  SendNotificationRequest,
  ScheduleNotificationRequest,
  AuthenticatedRequest,
  ApiResponse,
} from '../types';

export class NotificationController {
  async sendNotification(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const request: SendNotificationRequest = {
        userId: req.body.userId || req.user?.id,
        type: req.body.type,
        channel: req.body.channel,
        subject: req.body.subject,
        message: req.body.message,
        htmlMessage: req.body.htmlMessage,
        metadata: req.body.metadata || {},
        priority: req.body.priority || 'medium',
        templateId: req.body.templateId,
        templateVariables: req.body.templateVariables,
      };

      const notificationId = await notificationService.sendNotification(request);

      const response: ApiResponse = {
        success: true,
        data: { notificationId },
        message: 'Notification sent successfully',
      };

      res.status(201).json(response);
    } catch (error) {
      logger.error('Error sending notification:', error);
      
      const response: ApiResponse = {
        success: false,
        message: 'Failed to send notification',
        errors: [{ field: 'general', message: (error as Error).message }],
      };

      res.status(500).json(response);
    }
  }

  async scheduleNotification(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const request: ScheduleNotificationRequest = {
        userId: req.body.userId || req.user?.id,
        type: req.body.type,
        channel: req.body.channel,
        subject: req.body.subject,
        message: req.body.message,
        htmlMessage: req.body.htmlMessage,
        metadata: req.body.metadata || {},
        priority: req.body.priority || 'medium',
        templateId: req.body.templateId,
        templateVariables: req.body.templateVariables,
        scheduledAt: new Date(req.body.scheduledAt),
      };

      const notificationId = await notificationService.scheduleNotification(request);

      const response: ApiResponse = {
        success: true,
        data: { notificationId },
        message: 'Notification scheduled successfully',
      };

      res.status(201).json(response);
    } catch (error) {
      logger.error('Error scheduling notification:', error);
      
      const response: ApiResponse = {
        success: false,
        message: 'Failed to schedule notification',
        errors: [{ field: 'general', message: (error as Error).message }],
      };

      res.status(500).json(response);
    }
  }

  async getNotifications(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.params['userId'] || req.user?.id;
      const page = parseInt(req.query['page'] as string) || 1;
      const limit = parseInt(req.query['limit'] as string) || 20;
      const status = req.query['status'] as any;

      if (!userId) {
        const response: ApiResponse = {
          success: false,
          message: 'User ID is required',
          errors: [{ field: 'userId', message: 'User ID is required' }],
        };
        res.status(400).json(response);
        return;
      }

      const result = await notificationService.getNotifications(userId, page, limit, status);

      const response: ApiResponse = {
        success: true,
        data: result.notifications,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: result.totalPages,
        },
      };

      res.json(response);
    } catch (error) {
      logger.error('Error getting notifications:', error);
      
      const response: ApiResponse = {
        success: false,
        message: 'Failed to get notifications',
        errors: [{ field: 'general', message: (error as Error).message }],
      };

      res.status(500).json(response);
    }
  }

  async cancelNotification(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const notificationId = req.params['id'];

      if (!notificationId) {
        const response: ApiResponse = {
          success: false,
          message: 'Notification ID is required',
          errors: [{ field: 'id', message: 'Notification ID is required' }],
        };
        res.status(400).json(response);
        return;
      }

      await notificationService.cancelNotification(notificationId);

      const response: ApiResponse = {
        success: true,
        message: 'Notification cancelled successfully',
      };

      res.json(response);
    } catch (error) {
      logger.error('Error cancelling notification:', error);
      
      const response: ApiResponse = {
        success: false,
        message: 'Failed to cancel notification',
        errors: [{ field: 'general', message: (error as Error).message }],
      };

      res.status(500).json(response);
    }
  }

  async processEvent(req: Request, res: Response): Promise<void> {
    try {
      const event = {
        type: req.body.type,
        userId: req.body.userId,
        data: req.body.data,
        timestamp: new Date(req.body.timestamp || Date.now()),
      };

      await notificationService.handleEvent(event);

      const response: ApiResponse = {
        success: true,
        message: 'Event processed successfully',
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('Error processing event:', error);
      
      const response: ApiResponse = {
        success: false,
        message: 'Failed to process event',
        errors: [{ field: 'general', message: (error as Error).message }],
      };

      res.status(500).json(response);
    }
  }

  async getNotificationById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const notificationId = req.params['id'];

      if (!notificationId) {
        const response: ApiResponse = {
          success: false,
          message: 'Notification ID is required',
          errors: [{ field: 'id', message: 'Notification ID is required' }],
        };
        res.status(400).json(response);
        return;
      }

      // This would require adding a method to the notification service
      // For now, we'll return a simple response
      const response: ApiResponse = {
        success: true,
        message: 'Feature not implemented yet',
      };

      res.json(response);
    } catch (error) {
      logger.error('Error getting notification:', error);
      
      const response: ApiResponse = {
        success: false,
        message: 'Failed to get notification',
        errors: [{ field: 'general', message: (error as Error).message }],
      };

      res.status(500).json(response);
    }
  }

  async resendNotification(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const notificationId = req.params['id'];

      if (!notificationId) {
        const response: ApiResponse = {
          success: false,
          message: 'Notification ID is required',
          errors: [{ field: 'id', message: 'Notification ID is required' }],
        };
        res.status(400).json(response);
        return;
      }

      // Process the notification again
      await notificationService.processNotification(notificationId);

      const response: ApiResponse = {
        success: true,
        message: 'Notification resent successfully',
      };

      res.json(response);
    } catch (error) {
      logger.error('Error resending notification:', error);
      
      const response: ApiResponse = {
        success: false,
        message: 'Failed to resend notification',
        errors: [{ field: 'general', message: (error as Error).message }],
      };

      res.status(500).json(response);
    }
  }

  async getNotificationStats(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.params['userId'] || req.user?.id;
      
      if (!userId) {
        const response: ApiResponse = {
          success: false,
          message: 'User ID is required',
          errors: [{ field: 'userId', message: 'User ID is required' }],
        };
        res.status(400).json(response);
        return;
      }

      // This would require implementing stats in the notification service
      const stats = {
        total: 0,
        sent: 0,
        failed: 0,
        pending: 0,
        cancelled: 0,
        byType: {
          email: 0,
          slack: 0,
          teams: 0,
          sms: 0,
          webhook: 0,
        },
        lastWeek: 0,
        lastMonth: 0,
      };

      const response: ApiResponse = {
        success: true,
        data: stats,
      };

      res.json(response);
    } catch (error) {
      logger.error('Error getting notification stats:', error);
      
      const response: ApiResponse = {
        success: false,
        message: 'Failed to get notification stats',
        errors: [{ field: 'general', message: (error as Error).message }],
      };

      res.status(500).json(response);
    }
  }

  async bulkSendNotifications(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { notifications } = req.body;

      if (!Array.isArray(notifications) || notifications.length === 0) {
        const response: ApiResponse = {
          success: false,
          message: 'Notifications array is required',
          errors: [{ field: 'notifications', message: 'Notifications array is required' }],
        };
        res.status(400).json(response);
        return;
      }

      const results = [];
      
      for (const notificationData of notifications) {
        try {
          const request: SendNotificationRequest = {
            userId: notificationData.userId || req.user?.id,
            type: notificationData.type,
            channel: notificationData.channel,
            subject: notificationData.subject,
            message: notificationData.message,
            htmlMessage: notificationData.htmlMessage,
            metadata: notificationData.metadata || {},
            priority: notificationData.priority || 'medium',
            templateId: notificationData.templateId,
            templateVariables: notificationData.templateVariables,
          };

          const notificationId = await notificationService.sendNotification(request);
          results.push({ success: true, notificationId });
        } catch (error) {
          results.push({ success: false, error: (error as Error).message });
        }
      }

      const response: ApiResponse = {
        success: true,
        data: { results },
        message: `Processed ${results.length} notifications`,
      };

      res.status(201).json(response);
    } catch (error) {
      logger.error('Error bulk sending notifications:', error);
      
      const response: ApiResponse = {
        success: false,
        message: 'Failed to bulk send notifications',
        errors: [{ field: 'general', message: (error as Error).message }],
      };

      res.status(500).json(response);
    }
  }
}

export default new NotificationController();