import { pool } from '../config/database';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import {
  ThreatModel,
  CreateThreatModelRequest,
  UpdateThreatModelRequest,
  ThreatModelStatus,
  ThreatModelValidation,
  ValidationError,
  ValidationWarning
} from '../types';
import { NotFoundError, ConflictError } from '../middleware/error-handler';

export class ThreatModelService {
  async createThreatModel(
    userId: string,
    data: CreateThreatModelRequest
  ): Promise<ThreatModel> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Verify user has access to the project
      const projectAccess = await client.query(`
        SELECT 1 FROM project_members
        WHERE project_id = $1 AND user_id = $2
      `, [data.project_id, userId]);

      if (projectAccess.rows.length === 0) {
        throw new NotFoundError('Project not found or access denied');
      }

      // Create the threat model
      const threatModelId = uuidv4();
      const result = await client.query(`
        INSERT INTO threat_models (
          id, project_id, name, description, version,
          methodology, status, scope, assumptions,
          metadata, created_by, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10::jsonb, $11, NOW(), NOW())
        RETURNING *
      `, [
        threatModelId,
        data.project_id,
        data.name,
        data.description,
        '1.0.0', // Initial version
        data.methodology,
        ThreatModelStatus.DRAFT,
        JSON.stringify(data.scope),
        data.assumptions || [],
        JSON.stringify(data.metadata || {}),
        userId
      ]);

      // Add activity log
      await this.logActivity(client, threatModelId, userId, 'created', 'Threat model created');

      await client.query('COMMIT');

      const threatModel = this.mapRowToThreatModel(result.rows[0]);
      logger.info(`Threat model created: ${threatModel.name} by user ${userId}`);
      
      return threatModel;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error creating threat model:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async getThreatModel(threatModelId: string, userId: string): Promise<ThreatModel> {
    try {
      const result = await pool.query(`
        SELECT tm.*
        FROM threat_models tm
        INNER JOIN project_members pm ON tm.project_id = pm.project_id
        WHERE tm.id = $1 AND pm.user_id = $2
      `, [threatModelId, userId]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Threat model not found');
      }

      return this.mapRowToThreatModel(result.rows[0]);
    } catch (error) {
      logger.error('Error fetching threat model:', error);
      throw error;
    }
  }

  async getProjectThreatModels(
    projectId: string,
    userId: string,
    filters?: {
      status?: ThreatModelStatus;
      methodology?: string;
    }
  ): Promise<ThreatModel[]> {
    try {
      // Verify user has access to the project
      const accessCheck = await pool.query(`
        SELECT 1 FROM project_members
        WHERE project_id = $1 AND user_id = $2
      `, [projectId, userId]);

      if (accessCheck.rows.length === 0) {
        throw new NotFoundError('Project not found or access denied');
      }

      let query = `
        SELECT * FROM threat_models
        WHERE project_id = $1
      `;
      
      const params: any[] = [projectId];
      let paramIndex = 2;

      if (filters?.status) {
        query += ` AND status = $${paramIndex}`;
        params.push(filters.status);
        paramIndex++;
      }

      if (filters?.methodology) {
        query += ` AND methodology = $${paramIndex}`;
        params.push(filters.methodology);
        paramIndex++;
      }

      query += ' ORDER BY updated_at DESC';

      const result = await pool.query(query, params);
      return result.rows.map(row => this.mapRowToThreatModel(row));
    } catch (error) {
      logger.error('Error fetching project threat models:', error);
      throw error;
    }
  }

  async updateThreatModel(
    threatModelId: string,
    userId: string,
    data: UpdateThreatModelRequest
  ): Promise<ThreatModel> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Verify user has access
      const accessCheck = await client.query(`
        SELECT tm.*, pm.role
        FROM threat_models tm
        INNER JOIN project_members pm ON tm.project_id = pm.project_id
        WHERE tm.id = $1 AND pm.user_id = $2
      `, [threatModelId, userId]);

      if (accessCheck.rows.length === 0) {
        throw new NotFoundError('Threat model not found');
      }

      // Build dynamic update query
      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (data.name !== undefined) {
        updates.push(`name = $${paramIndex}`);
        values.push(data.name);
        paramIndex++;
      }

      if (data.description !== undefined) {
        updates.push(`description = $${paramIndex}`);
        values.push(data.description);
        paramIndex++;
      }

      if (data.version !== undefined) {
        updates.push(`version = $${paramIndex}`);
        values.push(data.version);
        paramIndex++;
      }

      if (data.status !== undefined) {
        // Log status change
        const oldStatus = accessCheck.rows[0].status;
        if (oldStatus !== data.status) {
          await this.logActivity(
            client, 
            threatModelId, 
            userId, 
            'status_changed',
            `Status changed from ${oldStatus} to ${data.status}`
          );
        }

        updates.push(`status = $${paramIndex}`);
        values.push(data.status);
        paramIndex++;

        // Set published_at if status is published
        if (data.status === ThreatModelStatus.PUBLISHED) {
          updates.push(`published_at = NOW()`);
        }
      }

      if (data.scope !== undefined) {
        updates.push(`scope = $${paramIndex}::jsonb`);
        values.push(JSON.stringify(data.scope));
        paramIndex++;
      }

      if (data.assumptions !== undefined) {
        updates.push(`assumptions = $${paramIndex}`);
        values.push(data.assumptions);
        paramIndex++;
      }

      if (data.architecture_diagram !== undefined) {
        updates.push(`architecture_diagram = $${paramIndex}`);
        values.push(data.architecture_diagram);
        paramIndex++;
      }

      if (data.data_flow_diagram !== undefined) {
        updates.push(`data_flow_diagram = $${paramIndex}`);
        values.push(data.data_flow_diagram);
        paramIndex++;
      }

      if (data.metadata !== undefined) {
        updates.push(`metadata = $${paramIndex}::jsonb`);
        values.push(JSON.stringify(data.metadata));
        paramIndex++;
      }

      updates.push(`updated_at = NOW()`);

      values.push(threatModelId);
      const updateQuery = `
        UPDATE threat_models
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      const result = await client.query(updateQuery, values);

      // Log activity
      await this.logActivity(client, threatModelId, userId, 'updated', 'Threat model updated');

      await client.query('COMMIT');

      const threatModel = this.mapRowToThreatModel(result.rows[0]);
      logger.info(`Threat model updated: ${threatModel.name} by user ${userId}`);
      
      return threatModel;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error updating threat model:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async validateThreatModel(threatModelId: string): Promise<ThreatModelValidation> {
    try {
      const result = await pool.query(`
        SELECT * FROM threat_models WHERE id = $1
      `, [threatModelId]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Threat model not found');
      }

      const threatModel = this.mapRowToThreatModel(result.rows[0]);
      const errors: ValidationError[] = [];
      const warnings: ValidationWarning[] = [];

      // Validate required fields
      if (!threatModel.name || threatModel.name.trim().length === 0) {
        errors.push({
          field: 'name',
          message: 'Threat model name is required',
          severity: 'error'
        });
      }

      if (!threatModel.description || threatModel.description.trim().length < 10) {
        errors.push({
          field: 'description',
          message: 'Threat model description must be at least 10 characters',
          severity: 'error'
        });
      }

      // Validate scope
      if (!threatModel.scope.systems || threatModel.scope.systems.length === 0) {
        errors.push({
          field: 'scope.systems',
          message: 'At least one system must be defined in scope',
          severity: 'error'
        });
      }

      if (!threatModel.scope.assets || threatModel.scope.assets.length === 0) {
        warnings.push({
          field: 'scope.assets',
          message: 'No assets defined in scope',
          severity: 'warning'
        });
      }

      if (!threatModel.scope.actors || threatModel.scope.actors.length === 0) {
        warnings.push({
          field: 'scope.actors',
          message: 'No actors defined in scope',
          severity: 'warning'
        });
      }

      // Check assumptions
      if (!threatModel.assumptions || threatModel.assumptions.length === 0) {
        warnings.push({
          field: 'assumptions',
          message: 'No assumptions documented',
          severity: 'warning'
        });
      }

      // Check diagrams
      if (!threatModel.architecture_diagram) {
        warnings.push({
          field: 'architecture_diagram',
          message: 'No architecture diagram provided',
          severity: 'warning'
        });
      }

      if (!threatModel.data_flow_diagram) {
        warnings.push({
          field: 'data_flow_diagram',
          message: 'No data flow diagram provided',
          severity: 'warning'
        });
      }

      // Calculate completeness score
      const totalChecks = 8;
      const passedChecks = totalChecks - errors.length - (warnings.length * 0.5);
      const completenessScore = Math.max(0, Math.round((passedChecks / totalChecks) * 100));

      return {
        is_valid: errors.length === 0,
        errors,
        warnings,
        completeness_score: completenessScore
      };
    } catch (error) {
      logger.error('Error validating threat model:', error);
      throw error;
    }
  }

  async cloneThreatModel(
    threatModelId: string,
    userId: string,
    newName: string
  ): Promise<ThreatModel> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Get original threat model
      const original = await this.getThreatModel(threatModelId, userId);

      // Create clone
      const cloneId = uuidv4();
      const result = await client.query(`
        INSERT INTO threat_models (
          id, project_id, name, description, version,
          methodology, status, scope, assumptions,
          architecture_diagram, data_flow_diagram,
          metadata, created_by, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, $12::jsonb, $13, NOW(), NOW())
        RETURNING *
      `, [
        cloneId,
        original.project_id,
        newName,
        `${original.description} (Cloned from ${original.name})`,
        '1.0.0', // Reset version
        original.methodology,
        ThreatModelStatus.DRAFT, // Always start as draft
        JSON.stringify(original.scope),
        original.assumptions,
        original.architecture_diagram,
        original.data_flow_diagram,
        JSON.stringify({
          ...original.metadata,
          cloned_from: original.id,
          cloned_at: new Date()
        }),
        userId
      ]);

      // Log activity
      await this.logActivity(
        client, 
        cloneId, 
        userId, 
        'cloned',
        `Cloned from threat model ${original.name}`
      );

      await client.query('COMMIT');

      const clone = this.mapRowToThreatModel(result.rows[0]);
      logger.info(`Threat model cloned: ${clone.name} from ${original.name} by user ${userId}`);
      
      return clone;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error cloning threat model:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  private async logActivity(
    client: any,
    threatModelId: string,
    userId: string,
    action: string,
    description: string
  ): Promise<void> {
    await client.query(`
      INSERT INTO activity_logs (
        id, entity_type, entity_id, user_id,
        action, description, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
    `, [
      uuidv4(),
      'threat_model',
      threatModelId,
      userId,
      action,
      description
    ]);
  }

  private mapRowToThreatModel(row: any): ThreatModel {
    return {
      id: row.id,
      project_id: row.project_id,
      name: row.name,
      description: row.description,
      version: row.version,
      methodology: row.methodology,
      status: row.status as ThreatModelStatus,
      scope: row.scope || {},
      assumptions: row.assumptions || [],
      architecture_diagram: row.architecture_diagram,
      data_flow_diagram: row.data_flow_diagram,
      metadata: row.metadata || {},
      created_by: row.created_by,
      created_at: row.created_at,
      updated_at: row.updated_at,
      published_at: row.published_at,
    };
  }
}