import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { logger } from '../utils/logger';
import { ApiResponse, ValidationError } from '../types';

// Zod schemas for validation
const NotificationTypeSchema = z.enum(['email', 'slack', 'teams', 'sms', 'webhook', 'push']);
const NotificationPrioritySchema = z.enum(['low', 'medium', 'high', 'urgent']);

const SendNotificationSchema = z.object({
  userId: z.string().uuid().optional(),
  type: NotificationTypeSchema,
  channel: z.string().min(1, 'Channel is required'),
  subject: z.string().min(1, 'Subject is required').max(255, 'Subject too long'),
  message: z.string().min(1, 'Message is required'),
  htmlMessage: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  priority: NotificationPrioritySchema.optional(),
  templateId: z.string().uuid().optional(),
  templateVariables: z.record(z.any()).optional(),
});

const ScheduleNotificationSchema = SendNotificationSchema.extend({
  scheduledAt: z.string().datetime('Invalid datetime format'),
});

const ProcessEventSchema = z.object({
  type: z.string().min(1, 'Event type is required'),
  userId: z.string().uuid('Invalid user ID'),
  data: z.record(z.any()),
  timestamp: z.string().datetime().optional(),
});

const BulkNotificationSchema = z.object({
  notifications: z.array(SendNotificationSchema).min(1, 'At least one notification is required').max(100, 'Too many notifications'),
});

// Validation middleware functions
export const validateNotificationRequest = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const result = SendNotificationSchema.safeParse(req.body);
    
    if (!result.success) {
      const errors: ValidationError[] = result.error.errors.map(error => ({
        field: error.path.join('.'),
        message: error.message,
        value: error.path.reduce((obj, key) => obj?.[key], req.body),
      }));

      const response: ApiResponse = {
        success: false,
        message: 'Validation failed',
        errors,
      };

      logger.warn('Notification request validation failed:', errors);
      res.status(400).json(response);
      return;
    }

    // Validate channel format based on type
    const validationError = validateChannelFormat(result.data.type, result.data.channel);
    if (validationError) {
      const response: ApiResponse = {
        success: false,
        message: 'Validation failed',
        errors: [validationError],
      };

      res.status(400).json(response);
      return;
    }

    // Store validated data
    req.body = result.data;
    next();
  } catch (error) {
    logger.error('Validation middleware error:', error);
    
    const response: ApiResponse = {
      success: false,
      message: 'Validation error',
      errors: [{ field: 'general', message: 'Internal validation error' }],
    };

    res.status(500).json(response);
  }
};

export const validateScheduleRequest = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const result = ScheduleNotificationSchema.safeParse(req.body);
    
    if (!result.success) {
      const errors: ValidationError[] = result.error.errors.map(error => ({
        field: error.path.join('.'),
        message: error.message,
        value: error.path.reduce((obj, key) => obj?.[key], req.body),
      }));

      const response: ApiResponse = {
        success: false,
        message: 'Validation failed',
        errors,
      };

      logger.warn('Schedule notification request validation failed:', errors);
      res.status(400).json(response);
      return;
    }

    // Validate that scheduled time is in the future
    const scheduledAt = new Date(result.data.scheduledAt);
    if (scheduledAt <= new Date()) {
      const response: ApiResponse = {
        success: false,
        message: 'Validation failed',
        errors: [{ field: 'scheduledAt', message: 'Scheduled time must be in the future' }],
      };

      res.status(400).json(response);
      return;
    }

    // Validate channel format
    const validationError = validateChannelFormat(result.data.type, result.data.channel);
    if (validationError) {
      const response: ApiResponse = {
        success: false,
        message: 'Validation failed',
        errors: [validationError],
      };

      res.status(400).json(response);
      return;
    }

    req.body = result.data;
    next();
  } catch (error) {
    logger.error('Schedule validation middleware error:', error);
    
    const response: ApiResponse = {
      success: false,
      message: 'Validation error',
      errors: [{ field: 'general', message: 'Internal validation error' }],
    };

    res.status(500).json(response);
  }
};

export const validateEventRequest = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const result = ProcessEventSchema.safeParse(req.body);
    
    if (!result.success) {
      const errors: ValidationError[] = result.error.errors.map(error => ({
        field: error.path.join('.'),
        message: error.message,
        value: error.path.reduce((obj, key) => obj?.[key], req.body),
      }));

      const response: ApiResponse = {
        success: false,
        message: 'Validation failed',
        errors,
      };

      logger.warn('Event request validation failed:', errors);
      res.status(400).json(response);
      return;
    }

    req.body = result.data;
    next();
  } catch (error) {
    logger.error('Event validation middleware error:', error);
    
    const response: ApiResponse = {
      success: false,
      message: 'Validation error',
      errors: [{ field: 'general', message: 'Internal validation error' }],
    };

    res.status(500).json(response);
  }
};

export const validateBulkRequest = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const result = BulkNotificationSchema.safeParse(req.body);
    
    if (!result.success) {
      const errors: ValidationError[] = result.error.errors.map(error => ({
        field: error.path.join('.'),
        message: error.message,
        value: error.path.reduce((obj, key) => obj?.[key], req.body),
      }));

      const response: ApiResponse = {
        success: false,
        message: 'Validation failed',
        errors,
      };

      logger.warn('Bulk notification request validation failed:', errors);
      res.status(400).json(response);
      return;
    }

    // Validate each notification's channel format
    const validationErrors: ValidationError[] = [];
    result.data.notifications.forEach((notification, index) => {
      const error = validateChannelFormat(notification.type, notification.channel);
      if (error) {
        validationErrors.push({
          field: `notifications[${index}].${error.field}`,
          message: error.message,
          value: error.value,
        });
      }
    });

    if (validationErrors.length > 0) {
      const response: ApiResponse = {
        success: false,
        message: 'Validation failed',
        errors: validationErrors,
      };

      res.status(400).json(response);
      return;
    }

    req.body = result.data;
    next();
  } catch (error) {
    logger.error('Bulk validation middleware error:', error);
    
    const response: ApiResponse = {
      success: false,
      message: 'Validation error',
      errors: [{ field: 'general', message: 'Internal validation error' }],
    };

    res.status(500).json(response);
  }
};

// Helper function to validate channel format based on type
function validateChannelFormat(type: string, channel: string): ValidationError | null {
  switch (type) {
    case 'email':
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(channel)) {
        return {
          field: 'channel',
          message: 'Invalid email address format',
          value: channel,
        };
      }
      break;

    case 'sms':
      // E.164 format validation
      const phoneRegex = /^\+[1-9]\d{1,14}$/;
      if (!phoneRegex.test(channel)) {
        return {
          field: 'channel',
          message: 'Invalid phone number format (must be E.164 format, e.g., +1234567890)',
          value: channel,
        };
      }
      break;

    case 'slack':
      // Slack channel format (#channel or @username or channel ID)
      const slackRegex = /^[#@]?[a-zA-Z0-9_-]+$|^[A-Z0-9]{9,11}$/;
      if (!slackRegex.test(channel)) {
        return {
          field: 'channel',
          message: 'Invalid Slack channel format',
          value: channel,
        };
      }
      break;

    case 'webhook':
      // URL validation
      try {
        new URL(channel);
      } catch {
        return {
          field: 'channel',
          message: 'Invalid webhook URL format',
          value: channel,
        };
      }
      break;

    case 'teams':
      // Teams webhook URL or channel validation
      if (channel.startsWith('http')) {
        try {
          const url = new URL(channel);
          if (!url.hostname.includes('outlook.office.com')) {
            return {
              field: 'channel',
              message: 'Invalid Teams webhook URL',
              value: channel,
            };
          }
        } catch {
          return {
            field: 'channel',
            message: 'Invalid Teams webhook URL format',
            value: channel,
          };
        }
      }
      break;

    case 'push':
      // Push notification token validation (basic check)
      if (channel.length < 10) {
        return {
          field: 'channel',
          message: 'Invalid push notification token',
          value: channel,
        };
      }
      break;
  }

  return null;
}

// Additional validation helpers
export const validateUUID = (value: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
};

export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validatePhoneNumber = (phone: string): boolean => {
  const phoneRegex = /^\+[1-9]\d{1,14}$/;
  return phoneRegex.test(phone);
};

export const validateURL = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

// Query parameter validation
export const validatePaginationParams = (req: Request, res: Response, next: NextFunction): void => {
  const page = req.query.page ? parseInt(req.query.page as string) : 1;
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;

  if (isNaN(page) || page < 1) {
    const response: ApiResponse = {
      success: false,
      message: 'Invalid page parameter',
      errors: [{ field: 'page', message: 'Page must be a positive integer' }],
    };
    res.status(400).json(response);
    return;
  }

  if (isNaN(limit) || limit < 1 || limit > 100) {
    const response: ApiResponse = {
      success: false,
      message: 'Invalid limit parameter',
      errors: [{ field: 'limit', message: 'Limit must be between 1 and 100' }],
    };
    res.status(400).json(response);
    return;
  }

  req.query.page = page.toString();
  req.query.limit = limit.toString();
  next();
};

export { SendNotificationSchema, ScheduleNotificationSchema, ProcessEventSchema, BulkNotificationSchema };