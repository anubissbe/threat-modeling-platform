import { pool } from '../config/database';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import {
  Project,
  CreateProjectRequest,
  UpdateProjectRequest,
  ProjectStatus,
  RiskLevel,
  ProjectMember,
  ProjectRole,
  ProjectStatistics
} from '../types';
import { NotFoundError, ConflictError } from '../middleware/error-handler';

export class ProjectService {
  async createProject(
    userId: string,
    organizationId: string,
    data: CreateProjectRequest
  ): Promise<Project> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Create the project
      const projectId = uuidv4();
      const projectResult = await client.query(`
        INSERT INTO projects (
          id, name, description, organization_id, owner_id,
          status, risk_level, metadata, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, NOW(), NOW())
        RETURNING *
      `, [
        projectId,
        data.name,
        data.description,
        organizationId,
        userId,
        ProjectStatus.ACTIVE,
        RiskLevel.LOW,
        JSON.stringify(data.metadata || {})
      ]);

      // Add the creator as project owner
      await client.query(`
        INSERT INTO project_members (
          id, project_id, user_id, role, permissions, joined_at
        )
        VALUES ($1, $2, $3, $4, $5, NOW())
      `, [
        uuidv4(),
        projectId,
        userId,
        ProjectRole.OWNER,
        JSON.stringify(['*']) // All permissions
      ]);

      await client.query('COMMIT');

      const project = this.mapRowToProject(projectResult.rows[0]);
      logger.info(`Project created: ${project.name} by user ${userId}`);
      
      return project;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error creating project:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async getProject(projectId: string, userId: string): Promise<Project> {
    try {
      // Check if user has access to the project
      const accessCheck = await pool.query(`
        SELECT p.*, pm.role, pm.permissions
        FROM projects p
        LEFT JOIN project_members pm ON p.id = pm.project_id AND pm.user_id = $2
        WHERE p.id = $1 AND p.archived_at IS NULL
      `, [projectId, userId]);

      if (accessCheck.rows.length === 0) {
        throw new NotFoundError('Project not found');
      }

      const projectRow = accessCheck.rows[0];
      if (!projectRow.role) {
        throw new NotFoundError('You do not have access to this project');
      }

      return this.mapRowToProject(projectRow);
    } catch (error) {
      logger.error('Error fetching project:', error);
      throw error;
    }
  }

  async getUserProjects(
    userId: string,
    organizationId: string,
    filters?: {
      status?: ProjectStatus;
      search?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ projects: Project[]; total: number }> {
    try {
      let query = `
        SELECT DISTINCT p.*, COUNT(*) OVER() as total_count
        FROM projects p
        INNER JOIN project_members pm ON p.id = pm.project_id
        WHERE pm.user_id = $1 
          AND p.organization_id = $2
          AND p.archived_at IS NULL
      `;
      
      const params: any[] = [userId, organizationId];
      let paramIndex = 3;

      if (filters?.status) {
        query += ` AND p.status = $${paramIndex}`;
        params.push(filters.status);
        paramIndex++;
      }

      if (filters?.search) {
        query += ` AND (p.name ILIKE $${paramIndex} OR p.description ILIKE $${paramIndex})`;
        params.push(`%${filters.search}%`);
        paramIndex++;
      }

      query += ' ORDER BY p.updated_at DESC';

      if (filters?.limit) {
        query += ` LIMIT $${paramIndex}`;
        params.push(filters.limit);
        paramIndex++;
      }

      if (filters?.offset) {
        query += ` OFFSET $${paramIndex}`;
        params.push(filters.offset);
      }

      const result = await pool.query(query, params);

      const projects = result.rows.map(row => this.mapRowToProject(row));
      const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0;

      return { projects, total };
    } catch (error) {
      logger.error('Error fetching user projects:', error);
      throw error;
    }
  }

  async updateProject(
    projectId: string,
    userId: string,
    data: UpdateProjectRequest
  ): Promise<Project> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Check permissions
      const permissionCheck = await client.query(`
        SELECT role FROM project_members
        WHERE project_id = $1 AND user_id = $2
      `, [projectId, userId]);

      if (permissionCheck.rows.length === 0) {
        throw new NotFoundError('Project not found');
      }

      const userRole = permissionCheck.rows[0].role;
      if (![ProjectRole.OWNER, ProjectRole.ADMIN].includes(userRole)) {
        throw new Error('Insufficient permissions to update project');
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

      if (data.status !== undefined) {
        updates.push(`status = $${paramIndex}`);
        values.push(data.status);
        paramIndex++;
      }

      if (data.risk_level !== undefined) {
        updates.push(`risk_level = $${paramIndex}`);
        values.push(data.risk_level);
        paramIndex++;
      }

      if (data.metadata !== undefined) {
        updates.push(`metadata = $${paramIndex}::jsonb`);
        values.push(JSON.stringify(data.metadata));
        paramIndex++;
      }

      updates.push(`updated_at = NOW()`);

      values.push(projectId);
      const updateQuery = `
        UPDATE projects
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      const result = await client.query(updateQuery, values);
      await client.query('COMMIT');

      const project = this.mapRowToProject(result.rows[0]);
      logger.info(`Project updated: ${project.name} by user ${userId}`);
      
      return project;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error updating project:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async getProjectStatistics(projectId: string): Promise<ProjectStatistics> {
    try {
      // Get threat model count
      const modelCountResult = await pool.query(`
        SELECT COUNT(*) as count
        FROM threat_models
        WHERE project_id = $1
      `, [projectId]);

      // Get threat statistics
      const threatStatsResult = await pool.query(`
        SELECT 
          COUNT(t.id) as total_threats,
          COUNT(CASE WHEN t.risk_level = 'critical' THEN 1 END) as critical,
          COUNT(CASE WHEN t.risk_level = 'high' THEN 1 END) as high,
          COUNT(CASE WHEN t.risk_level = 'medium' THEN 1 END) as medium,
          COUNT(CASE WHEN t.risk_level = 'low' THEN 1 END) as low,
          COUNT(CASE WHEN t.status = 'identified' THEN 1 END) as identified,
          COUNT(CASE WHEN t.status = 'analyzing' THEN 1 END) as analyzing,
          COUNT(CASE WHEN t.status = 'mitigated' THEN 1 END) as mitigated,
          COUNT(CASE WHEN t.status = 'accepted' THEN 1 END) as accepted
        FROM threats t
        INNER JOIN threat_models tm ON t.threat_model_id = tm.id
        WHERE tm.project_id = $1
      `, [projectId]);

      // Get mitigation coverage
      const mitigationResult = await pool.query(`
        SELECT 
          COUNT(DISTINCT t.id) as total_threats_with_mitigations,
          COUNT(DISTINCT m.id) as total_mitigations
        FROM threats t
        INNER JOIN threat_models tm ON t.threat_model_id = tm.id
        LEFT JOIN mitigations m ON t.id = m.threat_id
        WHERE tm.project_id = $1 AND m.implementation_status = 'implemented'
      `, [projectId]);

      // Get last activity
      const activityResult = await pool.query(`
        SELECT MAX(updated_at) as last_activity
        FROM (
          SELECT updated_at FROM projects WHERE id = $1
          UNION ALL
          SELECT updated_at FROM threat_models WHERE project_id = $1
          UNION ALL
          SELECT t.updated_at 
          FROM threats t
          INNER JOIN threat_models tm ON t.threat_model_id = tm.id
          WHERE tm.project_id = $1
        ) as activities
      `, [projectId]);

      const stats = threatStatsResult.rows[0];
      const mitigation = mitigationResult.rows[0];
      const totalThreats = parseInt(stats.total_threats) || 0;
      const threatsWithMitigations = parseInt(mitigation.total_threats_with_mitigations) || 0;

      return {
        total_threat_models: parseInt(modelCountResult.rows[0].count) || 0,
        total_threats: totalThreats,
        threats_by_severity: {
          critical: parseInt(stats.critical) || 0,
          high: parseInt(stats.high) || 0,
          medium: parseInt(stats.medium) || 0,
          low: parseInt(stats.low) || 0,
        },
        threats_by_status: {
          identified: parseInt(stats.identified) || 0,
          analyzing: parseInt(stats.analyzing) || 0,
          mitigated: parseInt(stats.mitigated) || 0,
          accepted: parseInt(stats.accepted) || 0,
        },
        mitigation_coverage: totalThreats > 0 ? (threatsWithMitigations / totalThreats) * 100 : 0,
        last_activity: activityResult.rows[0].last_activity || new Date(),
      };
    } catch (error) {
      logger.error('Error fetching project statistics:', error);
      throw error;
    }
  }

  private mapRowToProject(row: any): Project {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      organization_id: row.organization_id,
      owner_id: row.owner_id,
      status: row.status as ProjectStatus,
      risk_level: row.risk_level as RiskLevel,
      metadata: row.metadata || {},
      created_at: row.created_at,
      updated_at: row.updated_at,
      archived_at: row.archived_at,
    };
  }
}