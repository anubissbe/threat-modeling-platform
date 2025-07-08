import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { database } from '../config/database';
import { logger } from '../utils/logger';
import {
  CreateTemplateRequest,
  UpdateTemplateRequest,
  AuthenticatedRequest,
  ApiResponse,
  NotificationTemplate,
  TemplateListResponse,
} from '../types';

export class TemplateController {
  async createTemplate(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const request: CreateTemplateRequest = {
        name: req.body.name,
        type: req.body.type,
        subject: req.body.subject,
        body: req.body.body,
        htmlBody: req.body.htmlBody,
        variables: req.body.variables || {},
      };

      const templateId = uuidv4();
      const query = `
        INSERT INTO notification_templates (
          id, name, type, subject, body, html_body, variables, 
          is_active, created_by, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `;

      const params = [
        templateId,
        request.name,
        request.type,
        request.subject,
        request.body,
        request.htmlBody,
        JSON.stringify(request.variables),
        true,
        req.user?.id,
        new Date(),
        new Date(),
      ];

      const result = await database.query(query, params);
      const template = this.mapRowToTemplate(result.rows[0]);

      const response: ApiResponse<NotificationTemplate> = {
        success: true,
        data: template,
        message: 'Template created successfully',
      };

      res.status(201).json(response);
    } catch (error) {
      logger.error('Error creating template:', error);
      
      const response: ApiResponse = {
        success: false,
        message: 'Failed to create template',
        errors: [{ field: 'general', message: (error as Error).message }],
      };

      res.status(500).json(response);
    }
  }

  async updateTemplate(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const templateId = req.params['id'];
      const updates: UpdateTemplateRequest = req.body;

      if (!templateId) {
        const response: ApiResponse = {
          success: false,
          message: 'Template ID is required',
          errors: [{ field: 'id', message: 'Template ID is required' }],
        };
        res.status(400).json(response);
        return;
      }

      // Build dynamic update query
      const updateFields = [];
      const params = [templateId];
      let paramIndex = 2;

      if (updates.name !== undefined) {
        updateFields.push(`name = $${paramIndex}`);
        params.push(updates.name);
        paramIndex++;
      }

      if (updates.type !== undefined) {
        updateFields.push(`type = $${paramIndex}`);
        params.push(updates.type);
        paramIndex++;
      }

      if (updates.subject !== undefined) {
        updateFields.push(`subject = $${paramIndex}`);
        params.push(updates.subject);
        paramIndex++;
      }

      if (updates.body !== undefined) {
        updateFields.push(`body = $${paramIndex}`);
        params.push(updates.body);
        paramIndex++;
      }

      if (updates.htmlBody !== undefined) {
        updateFields.push(`html_body = $${paramIndex}`);
        params.push(updates.htmlBody);
        paramIndex++;
      }

      if (updates.variables !== undefined) {
        updateFields.push(`variables = $${paramIndex}`);
        params.push(JSON.stringify(updates.variables));
        paramIndex++;
      }

      if (updates.isActive !== undefined) {
        updateFields.push(`is_active = $${paramIndex}`);
        params.push(updates.isActive.toString());
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
        UPDATE notification_templates 
        SET ${updateFields.join(', ')}
        WHERE id = $1
        RETURNING *
      `;

      const result = await database.query(query, params);

      if (result.rows.length === 0) {
        const response: ApiResponse = {
          success: false,
          message: 'Template not found',
          errors: [{ field: 'id', message: 'Template not found' }],
        };
        res.status(404).json(response);
        return;
      }

      const template = this.mapRowToTemplate(result.rows[0]);

      const response: ApiResponse<NotificationTemplate> = {
        success: true,
        data: template,
        message: 'Template updated successfully',
      };

      res.json(response);
    } catch (error) {
      logger.error('Error updating template:', error);
      
      const response: ApiResponse = {
        success: false,
        message: 'Failed to update template',
        errors: [{ field: 'general', message: (error as Error).message }],
      };

      res.status(500).json(response);
    }
  }

  async getTemplates(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query['page'] as string) || 1;
      const limit = parseInt(req.query['limit'] as string) || 20;
      const type = req.query['type'] as string;
      const active = req.query['active'] as string;

      const offset = (page - 1) * limit;
      let query = 'SELECT * FROM notification_templates WHERE 1=1';
      const params: any[] = [];
      let paramIndex = 1;

      if (type) {
        query += ` AND type = $${paramIndex}`;
        params.push(type);
        paramIndex++;
      }

      if (active !== undefined) {
        query += ` AND is_active = $${paramIndex}`;
        params.push(active === 'true');
        paramIndex++;
      }

      query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const result = await database.query(query, params);
      
      // Get total count
      let countQuery = 'SELECT COUNT(*) FROM notification_templates WHERE 1=1';
      const countParams: any[] = [];
      let countParamIndex = 1;

      if (type) {
        countQuery += ` AND type = $${countParamIndex}`;
        countParams.push(type);
        countParamIndex++;
      }

      if (active !== undefined) {
        countQuery += ` AND is_active = $${countParamIndex}`;
        countParams.push(active === 'true');
      }

      const countResult = await database.query(countQuery, countParams);
      const total = parseInt(countResult.rows[0].count);

      const templates = result.rows.map(this.mapRowToTemplate);

      const response: ApiResponse<TemplateListResponse> = {
        success: true,
        data: {
          templates,
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };

      res.json(response);
    } catch (error) {
      logger.error('Error getting templates:', error);
      
      const response: ApiResponse = {
        success: false,
        message: 'Failed to get templates',
        errors: [{ field: 'general', message: (error as Error).message }],
      };

      res.status(500).json(response);
    }
  }

  async getTemplate(req: Request, res: Response): Promise<void> {
    try {
      const templateId = req.params['id'];

      if (!templateId) {
        const response: ApiResponse = {
          success: false,
          message: 'Template ID is required',
          errors: [{ field: 'id', message: 'Template ID is required' }],
        };
        res.status(400).json(response);
        return;
      }

      const query = 'SELECT * FROM notification_templates WHERE id = $1';
      const result = await database.query(query, [templateId]);

      if (result.rows.length === 0) {
        const response: ApiResponse = {
          success: false,
          message: 'Template not found',
          errors: [{ field: 'id', message: 'Template not found' }],
        };
        res.status(404).json(response);
        return;
      }

      const template = this.mapRowToTemplate(result.rows[0]);

      const response: ApiResponse<NotificationTemplate> = {
        success: true,
        data: template,
      };

      res.json(response);
    } catch (error) {
      logger.error('Error getting template:', error);
      
      const response: ApiResponse = {
        success: false,
        message: 'Failed to get template',
        errors: [{ field: 'general', message: (error as Error).message }],
      };

      res.status(500).json(response);
    }
  }

  async deleteTemplate(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const templateId = req.params['id'];

      if (!templateId) {
        const response: ApiResponse = {
          success: false,
          message: 'Template ID is required',
          errors: [{ field: 'id', message: 'Template ID is required' }],
        };
        res.status(400).json(response);
        return;
      }

      // Soft delete by marking as inactive
      const query = `
        UPDATE notification_templates 
        SET is_active = false, updated_at = $2
        WHERE id = $1
        RETURNING *
      `;

      const result = await database.query(query, [templateId, new Date()]);

      if (result.rows.length === 0) {
        const response: ApiResponse = {
          success: false,
          message: 'Template not found',
          errors: [{ field: 'id', message: 'Template not found' }],
        };
        res.status(404).json(response);
        return;
      }

      const response: ApiResponse = {
        success: true,
        message: 'Template deleted successfully',
      };

      res.json(response);
    } catch (error) {
      logger.error('Error deleting template:', error);
      
      const response: ApiResponse = {
        success: false,
        message: 'Failed to delete template',
        errors: [{ field: 'general', message: (error as Error).message }],
      };

      res.status(500).json(response);
    }
  }

  async previewTemplate(req: Request, res: Response): Promise<void> {
    try {
      const templateId = req.params['id'];
      const variables = req.body.variables || {};

      if (!templateId) {
        const response: ApiResponse = {
          success: false,
          message: 'Template ID is required',
          errors: [{ field: 'id', message: 'Template ID is required' }],
        };
        res.status(400).json(response);
        return;
      }

      const query = 'SELECT * FROM notification_templates WHERE id = $1';
      const result = await database.query(query, [templateId]);

      if (result.rows.length === 0) {
        const response: ApiResponse = {
          success: false,
          message: 'Template not found',
          errors: [{ field: 'id', message: 'Template not found' }],
        };
        res.status(404).json(response);
        return;
      }

      const template = this.mapRowToTemplate(result.rows[0]);
      const preview = this.renderTemplate(template, variables);

      const response: ApiResponse = {
        success: true,
        data: preview,
      };

      res.json(response);
    } catch (error) {
      logger.error('Error previewing template:', error);
      
      const response: ApiResponse = {
        success: false,
        message: 'Failed to preview template',
        errors: [{ field: 'general', message: (error as Error).message }],
      };

      res.status(500).json(response);
    }
  }

  async cloneTemplate(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const templateId = req.params['id'];
      const newName = req.body.name;

      if (!templateId) {
        const response: ApiResponse = {
          success: false,
          message: 'Template ID is required',
          errors: [{ field: 'id', message: 'Template ID is required' }],
        };
        res.status(400).json(response);
        return;
      }

      if (!newName) {
        const response: ApiResponse = {
          success: false,
          message: 'New template name is required',
          errors: [{ field: 'name', message: 'New template name is required' }],
        };
        res.status(400).json(response);
        return;
      }

      // Get original template
      const selectQuery = 'SELECT * FROM notification_templates WHERE id = $1';
      const selectResult = await database.query(selectQuery, [templateId]);

      if (selectResult.rows.length === 0) {
        const response: ApiResponse = {
          success: false,
          message: 'Template not found',
          errors: [{ field: 'id', message: 'Template not found' }],
        };
        res.status(404).json(response);
        return;
      }

      const originalTemplate = selectResult.rows[0];
      const newTemplateId = uuidv4();

      // Create cloned template
      const insertQuery = `
        INSERT INTO notification_templates (
          id, name, type, subject, body, html_body, variables, 
          is_active, created_by, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `;

      const params = [
        newTemplateId,
        newName,
        originalTemplate.type,
        originalTemplate.subject,
        originalTemplate.body,
        originalTemplate.html_body,
        originalTemplate.variables,
        true,
        req.user?.id,
        new Date(),
        new Date(),
      ];

      const result = await database.query(insertQuery, params);
      const template = this.mapRowToTemplate(result.rows[0]);

      const response: ApiResponse<NotificationTemplate> = {
        success: true,
        data: template,
        message: 'Template cloned successfully',
      };

      res.status(201).json(response);
    } catch (error) {
      logger.error('Error cloning template:', error);
      
      const response: ApiResponse = {
        success: false,
        message: 'Failed to clone template',
        errors: [{ field: 'general', message: (error as Error).message }],
      };

      res.status(500).json(response);
    }
  }

  private mapRowToTemplate(row: any): NotificationTemplate {
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      subject: row.subject,
      body: row.body,
      htmlBody: row.html_body,
      variables: row.variables || {},
      isActive: row.is_active,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private renderTemplate(template: NotificationTemplate, variables: Record<string, any>): any {
    let renderedSubject = template.subject;
    let renderedBody = template.body;
    let renderedHtmlBody = template.htmlBody;

    // Simple template rendering (replace {{variable}} with values)
    Object.entries(variables).forEach(([key, value]) => {
      const placeholder = `{{${key}}}`;
      const stringValue = String(value);
      
      renderedSubject = renderedSubject.replace(new RegExp(placeholder, 'g'), stringValue);
      renderedBody = renderedBody.replace(new RegExp(placeholder, 'g'), stringValue);
      if (renderedHtmlBody) {
        renderedHtmlBody = renderedHtmlBody.replace(new RegExp(placeholder, 'g'), stringValue);
      }
    });

    return {
      subject: renderedSubject,
      body: renderedBody,
      htmlBody: renderedHtmlBody,
      variables: variables,
    };
  }
}

export default new TemplateController();