import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { logger } from '../utils/logger';
import { ApiResponse, ValidationError } from '../types';

// Zod schemas for preference validation
const NotificationTypeSchema = z.enum(['email', 'slack', 'teams', 'sms', 'webhook', 'push']);
const SubscriptionFrequencySchema = z.enum(['immediate', 'daily', 'weekly', 'monthly', 'never']);

const SetPreferencesSchema = z.object({
  userId: z.string().uuid().optional(),
  channel: NotificationTypeSchema,
  enabled: z.boolean(),
  frequency: SubscriptionFrequencySchema.optional(),
  quietHoursStart: z.string()
    .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)')
    .optional(),
  quietHoursEnd: z.string()
    .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)')
    .optional(),
  timezone: z.string()
    .min(1, 'Timezone is required')
    .max(50, 'Timezone too long')
    .optional(),
  settings: z.record(z.any()).optional(),
});

const UpdatePreferencesSchema = z.object({
  channel: NotificationTypeSchema.optional(),
  enabled: z.boolean().optional(),
  frequency: SubscriptionFrequencySchema.optional(),
  quietHoursStart: z.string()
    .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)')
    .optional(),
  quietHoursEnd: z.string()
    .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)')
    .optional(),
  timezone: z.string()
    .min(1, 'Timezone is required')
    .max(50, 'Timezone too long')
    .optional(),
  settings: z.record(z.any()).optional(),
});

const CreateSubscriptionSchema = z.object({
  userId: z.string().uuid().optional(),
  eventType: z.string()
    .min(1, 'Event type is required')
    .max(100, 'Event type too long'),
  channel: NotificationTypeSchema,
  enabled: z.boolean().optional(),
  filterCriteria: z.record(z.any()).optional(),
  settings: z.record(z.any()).optional(),
});

const UpdateSubscriptionSchema = z.object({
  enabled: z.boolean().optional(),
  filterCriteria: z.record(z.any()).optional(),
  settings: z.record(z.any()).optional(),
});

// Validation middleware functions
export const validatePreferencesRequest = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const result = SetPreferencesSchema.safeParse(req.body);
    
    if (!result.success) {
      const errors: ValidationError[] = result.error.errors.map(error => ({
        field: error.path.join('.'),
        message: error.message,
        value: error.path.reduce((obj, key) => obj?.[key], req.body),
      }));

      const response: ApiResponse = {
        success: false,
        message: 'Preferences validation failed',
        errors,
      };

      logger.warn('Preferences validation failed:', errors);
      res.status(400).json(response);
      return;
    }

    // Validate quiet hours logic
    if (result.data.quietHoursStart && result.data.quietHoursEnd) {
      const validationError = validateQuietHours(result.data.quietHoursStart, result.data.quietHoursEnd);
      if (validationError) {
        const response: ApiResponse = {
          success: false,
          message: 'Quiet hours validation failed',
          errors: [validationError],
        };

        res.status(400).json(response);
        return;
      }
    }

    // Validate timezone
    if (result.data.timezone) {
      const timezoneError = validateTimezone(result.data.timezone);
      if (timezoneError) {
        const response: ApiResponse = {
          success: false,
          message: 'Timezone validation failed',
          errors: [timezoneError],
        };

        res.status(400).json(response);
        return;
      }
    }

    // Validate channel-specific settings
    if (result.data.settings) {
      const settingsErrors = validateChannelSettings(result.data.channel, result.data.settings);
      if (settingsErrors.length > 0) {
        const response: ApiResponse = {
          success: false,
          message: 'Settings validation failed',
          errors: settingsErrors,
        };

        res.status(400).json(response);
        return;
      }
    }

    req.body = result.data;
    next();
  } catch (error) {
    logger.error('Preferences validation middleware error:', error);
    
    const response: ApiResponse = {
      success: false,
      message: 'Validation error',
      errors: [{ field: 'general', message: 'Internal validation error' }],
    };

    res.status(500).json(response);
  }
};

export const validateUpdatePreferencesRequest = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const result = UpdatePreferencesSchema.safeParse(req.body);
    
    if (!result.success) {
      const errors: ValidationError[] = result.error.errors.map(error => ({
        field: error.path.join('.'),
        message: error.message,
        value: error.path.reduce((obj, key) => obj?.[key], req.body),
      }));

      const response: ApiResponse = {
        success: false,
        message: 'Preferences update validation failed',
        errors,
      };

      logger.warn('Preferences update validation failed:', errors);
      res.status(400).json(response);
      return;
    }

    // Validate quiet hours logic if both are provided
    if (result.data.quietHoursStart && result.data.quietHoursEnd) {
      const validationError = validateQuietHours(result.data.quietHoursStart, result.data.quietHoursEnd);
      if (validationError) {
        const response: ApiResponse = {
          success: false,
          message: 'Quiet hours validation failed',
          errors: [validationError],
        };

        res.status(400).json(response);
        return;
      }
    }

    // Validate timezone if provided
    if (result.data.timezone) {
      const timezoneError = validateTimezone(result.data.timezone);
      if (timezoneError) {
        const response: ApiResponse = {
          success: false,
          message: 'Timezone validation failed',
          errors: [timezoneError],
        };

        res.status(400).json(response);
        return;
      }
    }

    // Validate channel-specific settings if provided
    if (result.data.settings && result.data.channel) {
      const settingsErrors = validateChannelSettings(result.data.channel, result.data.settings);
      if (settingsErrors.length > 0) {
        const response: ApiResponse = {
          success: false,
          message: 'Settings validation failed',
          errors: settingsErrors,
        };

        res.status(400).json(response);
        return;
      }
    }

    req.body = result.data;
    next();
  } catch (error) {
    logger.error('Preferences update validation middleware error:', error);
    
    const response: ApiResponse = {
      success: false,
      message: 'Validation error',
      errors: [{ field: 'general', message: 'Internal validation error' }],
    };

    res.status(500).json(response);
  }
};

export const validateSubscriptionRequest = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const result = CreateSubscriptionSchema.safeParse(req.body);
    
    if (!result.success) {
      const errors: ValidationError[] = result.error.errors.map(error => ({
        field: error.path.join('.'),
        message: error.message,
        value: error.path.reduce((obj, key) => obj?.[key], req.body),
      }));

      const response: ApiResponse = {
        success: false,
        message: 'Subscription validation failed',
        errors,
      };

      logger.warn('Subscription validation failed:', errors);
      res.status(400).json(response);
      return;
    }

    // Validate event type
    const eventTypeError = validateEventType(result.data.eventType);
    if (eventTypeError) {
      const response: ApiResponse = {
        success: false,
        message: 'Event type validation failed',
        errors: [eventTypeError],
      };

      res.status(400).json(response);
      return;
    }

    // Validate filter criteria
    if (result.data.filterCriteria) {
      const filterErrors = validateFilterCriteria(result.data.eventType, result.data.filterCriteria);
      if (filterErrors.length > 0) {
        const response: ApiResponse = {
          success: false,
          message: 'Filter criteria validation failed',
          errors: filterErrors,
        };

        res.status(400).json(response);
        return;
      }
    }

    req.body = result.data;
    next();
  } catch (error) {
    logger.error('Subscription validation middleware error:', error);
    
    const response: ApiResponse = {
      success: false,
      message: 'Validation error',
      errors: [{ field: 'general', message: 'Internal validation error' }],
    };

    res.status(500).json(response);
  }
};

export const validateUpdateSubscriptionRequest = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const result = UpdateSubscriptionSchema.safeParse(req.body);
    
    if (!result.success) {
      const errors: ValidationError[] = result.error.errors.map(error => ({
        field: error.path.join('.'),
        message: error.message,
        value: error.path.reduce((obj, key) => obj?.[key], req.body),
      }));

      const response: ApiResponse = {
        success: false,
        message: 'Subscription update validation failed',
        errors,
      };

      logger.warn('Subscription update validation failed:', errors);
      res.status(400).json(response);
      return;
    }

    req.body = result.data;
    next();
  } catch (error) {
    logger.error('Subscription update validation middleware error:', error);
    
    const response: ApiResponse = {
      success: false,
      message: 'Validation error',
      errors: [{ field: 'general', message: 'Internal validation error' }],
    };

    res.status(500).json(response);
  }
};

// Helper functions for validation
function validateQuietHours(start: string, end: string): ValidationError | null {
  try {
    const startTime = new Date(`1970-01-01T${start}:00`);
    const endTime = new Date(`1970-01-01T${end}:00`);

    if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
      return {
        field: 'quietHours',
        message: 'Invalid time format for quiet hours',
      };
    }

    // Note: We allow end time to be before start time for overnight quiet hours
    // e.g., 22:00 to 06:00

    return null;
  } catch (error) {
    return {
      field: 'quietHours',
      message: 'Invalid quiet hours format',
    };
  }
}

function validateTimezone(timezone: string): ValidationError | null {
  // Common timezone validation
  const validTimezones = [
    'UTC', 'GMT',
    'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
    'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Rome',
    'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Kolkata', 'Asia/Dubai',
    'Australia/Sydney', 'Australia/Melbourne',
    'Pacific/Auckland',
  ];

  if (!validTimezones.includes(timezone) && !timezone.match(/^[A-Za-z]+\/[A-Za-z_]+$/)) {
    return {
      field: 'timezone',
      message: 'Invalid timezone format',
      value: timezone,
    };
  }

  return null;
}

function validateEventType(eventType: string): ValidationError | null {
  const validEventTypes = [
    'threat_model_created',
    'threat_model_updated',
    'threat_model_deleted',
    'threat_identified',
    'threat_mitigated',
    'collaboration_invited',
    'collaboration_mentioned',
    'report_generated',
    'system_maintenance',
  ];

  if (!validEventTypes.includes(eventType)) {
    return {
      field: 'eventType',
      message: 'Invalid event type',
      value: eventType,
    };
  }

  return null;
}

function validateChannelSettings(channel: string, settings: Record<string, any>): ValidationError[] {
  const errors: ValidationError[] = [];

  switch (channel) {
    case 'email':
      // Validate email-specific settings
      if (settings['fromName'] && typeof settings['fromName'] !== 'string') {
        errors.push({
          field: 'settings.fromName',
          message: 'From name must be a string',
          value: settings['fromName'],
        });
      }
      if (settings['replyTo'] && !isValidEmail(settings['replyTo'])) {
        errors.push({
          field: 'settings.replyTo',
          message: 'Invalid reply-to email address',
          value: settings['replyTo'],
        });
      }
      break;

    case 'slack':
      // Validate Slack-specific settings
      if (settings['mentionUsers'] && !Array.isArray(settings['mentionUsers'])) {
        errors.push({
          field: 'settings.mentionUsers',
          message: 'Mention users must be an array',
          value: settings['mentionUsers'],
        });
      }
      if (settings['channelType'] && !['public', 'private', 'dm'].includes(settings['channelType'])) {
        errors.push({
          field: 'settings.channelType',
          message: 'Invalid channel type',
          value: settings['channelType'],
        });
      }
      break;

    case 'sms':
      // Validate SMS-specific settings
      if (settings['maxLength'] && (typeof settings['maxLength'] !== 'number' || settings['maxLength'] > 1600)) {
        errors.push({
          field: 'settings.maxLength',
          message: 'Max length must be a number not exceeding 1600',
          value: settings['maxLength'],
        });
      }
      break;

    case 'webhook':
      // Validate webhook-specific settings
      if (settings['timeout'] && (typeof settings['timeout'] !== 'number' || settings['timeout'] < 1000 || settings['timeout'] > 300000)) {
        errors.push({
          field: 'settings.timeout',
          message: 'Timeout must be between 1000 and 300000 milliseconds',
          value: settings['timeout'],
        });
      }
      if (settings['retries'] && (typeof settings['retries'] !== 'number' || settings['retries'] < 0 || settings['retries'] > 10)) {
        errors.push({
          field: 'settings.retries',
          message: 'Retries must be between 0 and 10',
          value: settings['retries'],
        });
      }
      break;
  }

  return errors;
}

function validateFilterCriteria(eventType: string, criteria: Record<string, any>): ValidationError[] {
  const errors: ValidationError[] = [];

  // Event-specific filter validation
  switch (eventType) {
    case 'threat_identified':
      if (criteria['riskLevel'] && !['low', 'medium', 'high', 'critical'].includes(criteria['riskLevel'])) {
        errors.push({
          field: 'filterCriteria.riskLevel',
          message: 'Invalid risk level',
          value: criteria['riskLevel'],
        });
      }
      break;

    case 'threat_model_created':
    case 'threat_model_updated':
      if (criteria['projectId'] && typeof criteria['projectId'] !== 'string') {
        errors.push({
          field: 'filterCriteria.projectId',
          message: 'Project ID must be a string',
          value: criteria['projectId'],
        });
      }
      break;

    case 'system_maintenance':
      if (criteria['severity'] && !['low', 'medium', 'high', 'critical'].includes(criteria['severity'])) {
        errors.push({
          field: 'filterCriteria.severity',
          message: 'Invalid severity level',
          value: criteria['severity'],
        });
      }
      break;
  }

  return errors;
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Helper function to validate user ID in params
export const validateUserIdParam = (req: Request, res: Response, next: NextFunction): void => {
  const userId = req.params['userId'];

  if (userId && !isValidUUID(userId)) {
    const response: ApiResponse = {
      success: false,
      message: 'Invalid user ID format',
      errors: [{ field: 'userId', message: 'User ID must be a valid UUID' }],
    };
    res.status(400).json(response);
    return;
  }

  next();
};

function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

// Helper function to get default preferences for a channel
export const getDefaultPreferencesForChannel = (channel: string) => {
  const defaults: Record<string, any> = {
    email: {
      enabled: true,
      frequency: 'immediate',
      settings: {
        htmlEnabled: true,
        attachments: true,
      },
    },
    slack: {
      enabled: false,
      frequency: 'immediate',
      settings: {
        mentionUsers: false,
        useThreads: true,
      },
    },
    teams: {
      enabled: false,
      frequency: 'immediate',
      settings: {
        useAdaptiveCards: true,
      },
    },
    sms: {
      enabled: false,
      frequency: 'immediate',
      settings: {
        maxLength: 160,
      },
    },
    webhook: {
      enabled: false,
      frequency: 'immediate',
      settings: {
        timeout: 30000,
        retries: 3,
      },
    },
  };

  return defaults[channel] || { enabled: false, frequency: 'immediate', settings: {} };
};

export { 
  SetPreferencesSchema, 
  UpdatePreferencesSchema, 
  CreateSubscriptionSchema, 
  UpdateSubscriptionSchema 
};