import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { database } from '../config/database';
import { logger } from '../utils/logger';
import {
  SetPreferencesRequest,
  CreateSubscriptionRequest,
  AuthenticatedRequest,
  ApiResponse,
  NotificationPreference,
  NotificationSubscription,
} from '../types';

export class PreferenceController {
  async setPreferences(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const request: SetPreferencesRequest = {
        userId: req.body.userId || req.user?.id,
        channel: req.body.channel,
        enabled: req.body.enabled,
        frequency: req.body.frequency || 'immediate',
        quietHoursStart: req.body.quietHoursStart,
        quietHoursEnd: req.body.quietHoursEnd,
        timezone: req.body.timezone || 'UTC',
        settings: req.body.settings || {},
      };

      if (!request.userId) {
        const response: ApiResponse = {
          success: false,
          message: 'User ID is required',
          errors: [{ field: 'userId', message: 'User ID is required' }],
        };
        res.status(400).json(response);
        return;
      }

      // Upsert preference
      const query = `
        INSERT INTO notification_preferences (
          id, user_id, channel, enabled, frequency, quiet_hours_start, 
          quiet_hours_end, timezone, settings, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (user_id, channel) 
        DO UPDATE SET
          enabled = EXCLUDED.enabled,
          frequency = EXCLUDED.frequency,
          quiet_hours_start = EXCLUDED.quiet_hours_start,
          quiet_hours_end = EXCLUDED.quiet_hours_end,
          timezone = EXCLUDED.timezone,
          settings = EXCLUDED.settings,
          updated_at = EXCLUDED.updated_at
        RETURNING *
      `;

      const params = [
        uuidv4(),
        request.userId,
        request.channel,
        request.enabled,
        request.frequency,
        request.quietHoursStart,
        request.quietHoursEnd,
        request.timezone,
        JSON.stringify(request.settings),
        new Date(),
        new Date(),
      ];

      const result = await database.query(query, params);
      const preference = this.mapRowToPreference(result.rows[0]);

      const response: ApiResponse<NotificationPreference> = {
        success: true,
        data: preference,
        message: 'Preferences updated successfully',
      };

      res.json(response);
    } catch (error) {
      logger.error('Error setting preferences:', error);
      
      const response: ApiResponse = {
        success: false,
        message: 'Failed to set preferences',
        errors: [{ field: 'general', message: (error as Error).message }],
      };

      res.status(500).json(response);
    }
  }

  async getPreferences(req: AuthenticatedRequest, res: Response): Promise<void> {
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

      const query = 'SELECT * FROM notification_preferences WHERE user_id = $1 ORDER BY channel';
      const result = await database.query(query, [userId]);

      const preferences = result.rows.map(this.mapRowToPreference);

      const response: ApiResponse<NotificationPreference[]> = {
        success: true,
        data: preferences,
      };

      res.json(response);
    } catch (error) {
      logger.error('Error getting preferences:', error);
      
      const response: ApiResponse = {
        success: false,
        message: 'Failed to get preferences',
        errors: [{ field: 'general', message: (error as Error).message }],
      };

      res.status(500).json(response);
    }
  }

  async updatePreferences(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.params['userId'] || req.user?.id;
      const updates = req.body;

      if (!userId) {
        const response: ApiResponse = {
          success: false,
          message: 'User ID is required',
          errors: [{ field: 'userId', message: 'User ID is required' }],
        };
        res.status(400).json(response);
        return;
      }

      // Build dynamic update query
      const updateFields = [];
      const params = [userId];
      let paramIndex = 2;

      if (updates.enabled !== undefined) {
        updateFields.push(`enabled = $${paramIndex}`);
        params.push(updates.enabled);
        paramIndex++;
      }

      if (updates.frequency !== undefined) {
        updateFields.push(`frequency = $${paramIndex}`);
        params.push(updates.frequency);
        paramIndex++;
      }

      if (updates.quietHoursStart !== undefined) {
        updateFields.push(`quiet_hours_start = $${paramIndex}`);
        params.push(updates.quietHoursStart);
        paramIndex++;
      }

      if (updates.quietHoursEnd !== undefined) {
        updateFields.push(`quiet_hours_end = $${paramIndex}`);
        params.push(updates.quietHoursEnd);
        paramIndex++;
      }

      if (updates.timezone !== undefined) {
        updateFields.push(`timezone = $${paramIndex}`);
        params.push(updates.timezone);
        paramIndex++;
      }

      if (updates.settings !== undefined) {
        updateFields.push(`settings = $${paramIndex}`);
        params.push(JSON.stringify(updates.settings));
        paramIndex++;
      }

      if (updates.channel) {
        updateFields.push(`channel = $${paramIndex}`);
        params.push(updates.channel);
        paramIndex++;
      }

      updateFields.push(`updated_at = $${paramIndex}`);
      params.push(new Date().toISOString());

      if (updateFields.length === 1) { // Only updated_at
        const response: ApiResponse = {
          success: false,
          message: 'No fields to update',
          errors: [{ field: 'general', message: 'No fields to update' }],
        };
        res.status(400).json(response);
        return;
      }

      let query = `
        UPDATE notification_preferences 
        SET ${updateFields.join(', ')}
        WHERE user_id = $1
      `;

      if (updates.channel) {
        query += ` AND channel = $${paramIndex}`;
        params.push(updates.channel);
      }

      query += ' RETURNING *';

      const result = await database.query(query, params);

      if (result.rows.length === 0) {
        const response: ApiResponse = {
          success: false,
          message: 'Preferences not found',
          errors: [{ field: 'userId', message: 'Preferences not found' }],
        };
        res.status(404).json(response);
        return;
      }

      const preferences = result.rows.map(this.mapRowToPreference);

      const response: ApiResponse<NotificationPreference[]> = {
        success: true,
        data: preferences,
        message: 'Preferences updated successfully',
      };

      res.json(response);
    } catch (error) {
      logger.error('Error updating preferences:', error);
      
      const response: ApiResponse = {
        success: false,
        message: 'Failed to update preferences',
        errors: [{ field: 'general', message: (error as Error).message }],
      };

      res.status(500).json(response);
    }
  }

  async createSubscription(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const request: CreateSubscriptionRequest = {
        userId: req.body.userId || req.user?.id,
        eventType: req.body.eventType,
        channel: req.body.channel,
        enabled: req.body.enabled !== false, // Default to true
        filterCriteria: req.body.filterCriteria || {},
        settings: req.body.settings || {},
      };

      if (!request.userId) {
        const response: ApiResponse = {
          success: false,
          message: 'User ID is required',
          errors: [{ field: 'userId', message: 'User ID is required' }],
        };
        res.status(400).json(response);
        return;
      }

      // Upsert subscription
      const query = `
        INSERT INTO notification_subscriptions (
          id, user_id, event_type, channel, enabled, filter_criteria, 
          settings, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (user_id, event_type, channel) 
        DO UPDATE SET
          enabled = EXCLUDED.enabled,
          filter_criteria = EXCLUDED.filter_criteria,
          settings = EXCLUDED.settings,
          updated_at = EXCLUDED.updated_at
        RETURNING *
      `;

      const params = [
        uuidv4(),
        request.userId,
        request.eventType,
        request.channel,
        request.enabled,
        JSON.stringify(request.filterCriteria),
        JSON.stringify(request.settings),
        new Date(),
        new Date(),
      ];

      const result = await database.query(query, params);
      const subscription = this.mapRowToSubscription(result.rows[0]);

      const response: ApiResponse<NotificationSubscription> = {
        success: true,
        data: subscription,
        message: 'Subscription created successfully',
      };

      res.status(201).json(response);
    } catch (error) {
      logger.error('Error creating subscription:', error);
      
      const response: ApiResponse = {
        success: false,
        message: 'Failed to create subscription',
        errors: [{ field: 'general', message: (error as Error).message }],
      };

      res.status(500).json(response);
    }
  }

  async getSubscriptions(req: AuthenticatedRequest, res: Response): Promise<void> {
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

      const query = `
        SELECT * FROM notification_subscriptions 
        WHERE user_id = $1 
        ORDER BY event_type, channel
      `;
      const result = await database.query(query, [userId]);

      const subscriptions = result.rows.map(this.mapRowToSubscription);

      const response: ApiResponse<NotificationSubscription[]> = {
        success: true,
        data: subscriptions,
      };

      res.json(response);
    } catch (error) {
      logger.error('Error getting subscriptions:', error);
      
      const response: ApiResponse = {
        success: false,
        message: 'Failed to get subscriptions',
        errors: [{ field: 'general', message: (error as Error).message }],
      };

      res.status(500).json(response);
    }
  }

  async updateSubscription(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const subscriptionId = req.params['id'];
      const updates = req.body;

      if (!subscriptionId) {
        const response: ApiResponse = {
          success: false,
          message: 'Subscription ID is required',
          errors: [{ field: 'id', message: 'Subscription ID is required' }],
        };
        res.status(400).json(response);
        return;
      }

      // Build dynamic update query
      const updateFields = [];
      const params = [subscriptionId];
      let paramIndex = 2;

      if (updates.enabled !== undefined) {
        updateFields.push(`enabled = $${paramIndex}`);
        params.push(updates.enabled);
        paramIndex++;
      }

      if (updates.filterCriteria !== undefined) {
        updateFields.push(`filter_criteria = $${paramIndex}`);
        params.push(JSON.stringify(updates.filterCriteria));
        paramIndex++;
      }

      if (updates.settings !== undefined) {
        updateFields.push(`settings = $${paramIndex}`);
        params.push(JSON.stringify(updates.settings));
        paramIndex++;
      }

      updateFields.push(`updated_at = $${paramIndex}`);
      params.push(new Date().toISOString());

      if (updateFields.length === 1) { // Only updated_at
        const response: ApiResponse = {
          success: false,
          message: 'No fields to update',
          errors: [{ field: 'general', message: 'No fields to update' }],
        };
        res.status(400).json(response);
        return;
      }

      const query = `
        UPDATE notification_subscriptions 
        SET ${updateFields.join(', ')}
        WHERE id = $1
        RETURNING *
      `;

      const result = await database.query(query, params);

      if (result.rows.length === 0) {
        const response: ApiResponse = {
          success: false,
          message: 'Subscription not found',
          errors: [{ field: 'id', message: 'Subscription not found' }],
        };
        res.status(404).json(response);
        return;
      }

      const subscription = this.mapRowToSubscription(result.rows[0]);

      const response: ApiResponse<NotificationSubscription> = {
        success: true,
        data: subscription,
        message: 'Subscription updated successfully',
      };

      res.json(response);
    } catch (error) {
      logger.error('Error updating subscription:', error);
      
      const response: ApiResponse = {
        success: false,
        message: 'Failed to update subscription',
        errors: [{ field: 'general', message: (error as Error).message }],
      };

      res.status(500).json(response);
    }
  }

  async deleteSubscription(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const subscriptionId = req.params['id'];

      if (!subscriptionId) {
        const response: ApiResponse = {
          success: false,
          message: 'Subscription ID is required',
          errors: [{ field: 'id', message: 'Subscription ID is required' }],
        };
        res.status(400).json(response);
        return;
      }

      const query = 'DELETE FROM notification_subscriptions WHERE id = $1 RETURNING *';
      const result = await database.query(query, [subscriptionId]);

      if (result.rows.length === 0) {
        const response: ApiResponse = {
          success: false,
          message: 'Subscription not found',
          errors: [{ field: 'id', message: 'Subscription not found' }],
        };
        res.status(404).json(response);
        return;
      }

      const response: ApiResponse = {
        success: true,
        message: 'Subscription deleted successfully',
      };

      res.json(response);
    } catch (error) {
      logger.error('Error deleting subscription:', error);
      
      const response: ApiResponse = {
        success: false,
        message: 'Failed to delete subscription',
        errors: [{ field: 'general', message: (error as Error).message }],
      };

      res.status(500).json(response);
    }
  }

  async getDefaultPreferences(_req: Request, res: Response): Promise<void> {
    try {
      const defaultPreferences = [
        {
          channel: 'email',
          enabled: true,
          frequency: 'immediate',
          timezone: 'UTC',
          settings: {},
        },
        {
          channel: 'slack',
          enabled: false,
          frequency: 'immediate',
          timezone: 'UTC',
          settings: {},
        },
        {
          channel: 'teams',
          enabled: false,
          frequency: 'immediate',
          timezone: 'UTC',
          settings: {},
        },
        {
          channel: 'sms',
          enabled: false,
          frequency: 'immediate',
          timezone: 'UTC',
          settings: {},
        },
        {
          channel: 'webhook',
          enabled: false,
          frequency: 'immediate',
          timezone: 'UTC',
          settings: {},
        },
      ];

      const response: ApiResponse = {
        success: true,
        data: defaultPreferences,
      };

      res.json(response);
    } catch (error) {
      logger.error('Error getting default preferences:', error);
      
      const response: ApiResponse = {
        success: false,
        message: 'Failed to get default preferences',
        errors: [{ field: 'general', message: (error as Error).message }],
      };

      res.status(500).json(response);
    }
  }

  async getAvailableEventTypes(_req: Request, res: Response): Promise<void> {
    try {
      const eventTypes = [
        {
          type: 'threat_model_created',
          name: 'Threat Model Created',
          description: 'Notification when a new threat model is created',
          defaultPriority: 'low',
        },
        {
          type: 'threat_model_updated',
          name: 'Threat Model Updated',
          description: 'Notification when a threat model is modified',
          defaultPriority: 'low',
        },
        {
          type: 'threat_model_deleted',
          name: 'Threat Model Deleted',
          description: 'Notification when a threat model is deleted',
          defaultPriority: 'medium',
        },
        {
          type: 'threat_identified',
          name: 'Threat Identified',
          description: 'Notification when a new threat is identified',
          defaultPriority: 'high',
        },
        {
          type: 'threat_mitigated',
          name: 'Threat Mitigated',
          description: 'Notification when a threat is mitigated',
          defaultPriority: 'medium',
        },
        {
          type: 'collaboration_invited',
          name: 'Collaboration Invited',
          description: 'Notification when invited to collaborate',
          defaultPriority: 'low',
        },
        {
          type: 'collaboration_mentioned',
          name: 'Mentioned in Comments',
          description: 'Notification when mentioned in comments',
          defaultPriority: 'medium',
        },
        {
          type: 'report_generated',
          name: 'Report Generated',
          description: 'Notification when a report is generated',
          defaultPriority: 'medium',
        },
        {
          type: 'system_maintenance',
          name: 'System Maintenance',
          description: 'Notification about system maintenance',
          defaultPriority: 'high',
        },
      ];

      const response: ApiResponse = {
        success: true,
        data: eventTypes,
      };

      res.json(response);
    } catch (error) {
      logger.error('Error getting available event types:', error);
      
      const response: ApiResponse = {
        success: false,
        message: 'Failed to get available event types',
        errors: [{ field: 'general', message: (error as Error).message }],
      };

      res.status(500).json(response);
    }
  }

  private mapRowToPreference(row: any): NotificationPreference {
    return {
      id: row.id,
      userId: row.user_id,
      channel: row.channel,
      enabled: row.enabled,
      frequency: row.frequency,
      quietHoursStart: row.quiet_hours_start,
      quietHoursEnd: row.quiet_hours_end,
      timezone: row.timezone,
      settings: row.settings || {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapRowToSubscription(row: any): NotificationSubscription {
    return {
      id: row.id,
      userId: row.user_id,
      eventType: row.event_type,
      channel: row.channel,
      enabled: row.enabled,
      filterCriteria: row.filter_criteria || {},
      settings: row.settings || {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export default new PreferenceController();