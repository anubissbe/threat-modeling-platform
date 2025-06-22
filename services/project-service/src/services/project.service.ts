import { query, queryPaginated, withTransaction } from '../database';
import { 
  Project, 
  CreateProjectDto, 
  UpdateProjectDto, 
  ProjectFilters,
  PaginationParams,
  PaginatedResponse,
  ProjectStatus,
  ProjectVisibility,
  ProjectSettings,
  ProjectMetadata
} from '../types';
import { logger, auditLogger } from '../utils/logger';
import { generateSlug } from '../utils/helpers';

export class ProjectService {
  async createProject(data: CreateProjectDto, userId: string): Promise<Project> {
    try {
      // Default settings and metadata
      const defaultSettings: ProjectSettings = {
        allowComments: true,
        requireApproval: false,
        autoSave: true,
        versioningEnabled: true,
        collaborationMode: 'open',
        notificationsEnabled: true,
      };

      const defaultMetadata: ProjectMetadata = {
        criticality: 'medium',
        compliance: [],
        stakeholders: [],
      };

      const settings = { ...defaultSettings, ...data.settings };
      const metadata = { ...defaultMetadata, ...data.metadata };

      const result = await query(
        `INSERT INTO projects.projects (
          name, description, organization_id, owner_id, 
          status, visibility, tags, metadata, settings
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *`,
        [
          data.name,
          data.description || null,
          data.organizationId,
          userId,
          ProjectStatus.DRAFT,
          data.visibility || ProjectVisibility.ORGANIZATION,
          JSON.stringify(data.tags || []),
          JSON.stringify(metadata),
          JSON.stringify(settings),
        ]
      );

      const project = this.mapProjectRow(result.rows[0]);

      // Log audit event
      auditLogger.projectCreated(userId, project.id, project.name);

      return project;
    } catch (error: any) {
      if (error.code === '23505') { // Unique constraint violation
        throw new Error('Project name already exists in organization');
      }
      logger.error('Failed to create project:', error);
      throw error;
    }
  }

  async getProject(projectId: string, userId?: string): Promise<Project | null> {
    const result = await query(
      `SELECT p.*, 
              u.email as owner_email,
              u.first_name as owner_first_name,
              u.last_name as owner_last_name,
              o.name as organization_name
       FROM projects.projects p
       LEFT JOIN auth.users u ON p.owner_id = u.id
       LEFT JOIN management.organizations o ON p.organization_id = o.id
       WHERE p.id = $1 AND p.deleted_at IS NULL`,
      [projectId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const project = this.mapProjectRowWithJoins(result.rows[0]);

    // Check access permissions if userId provided
    if (userId && !await this.hasProjectAccess(projectId, userId)) {
      return null;
    }

    return project;
  }

  async updateProject(
    projectId: string, 
    data: UpdateProjectDto, 
    userId: string
  ): Promise<Project> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCounter = 1;

    // Build dynamic update query
    if (data.name !== undefined) {
      fields.push(`name = $${paramCounter++}`);
      values.push(data.name);
    }
    if (data.description !== undefined) {
      fields.push(`description = $${paramCounter++}`);
      values.push(data.description);
    }
    if (data.status !== undefined) {
      fields.push(`status = $${paramCounter++}`);
      values.push(data.status);
    }
    if (data.visibility !== undefined) {
      fields.push(`visibility = $${paramCounter++}`);
      values.push(data.visibility);
    }
    if (data.tags !== undefined) {
      fields.push(`tags = $${paramCounter++}`);
      values.push(JSON.stringify(data.tags));
    }
    if (data.metadata !== undefined) {
      // Merge with existing metadata
      const existingProject = await this.getProject(projectId);
      if (!existingProject) {
        throw new Error('Project not found');
      }
      const mergedMetadata = { ...existingProject.metadata, ...data.metadata };
      fields.push(`metadata = $${paramCounter++}`);
      values.push(JSON.stringify(mergedMetadata));
    }
    if (data.settings !== undefined) {
      // Merge with existing settings
      const existingProject = await this.getProject(projectId);
      if (!existingProject) {
        throw new Error('Project not found');
      }
      const mergedSettings = { ...existingProject.settings, ...data.settings };
      fields.push(`settings = $${paramCounter++}`);
      values.push(JSON.stringify(mergedSettings));
    }

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(projectId);

    const result = await query(
      `UPDATE projects.projects 
       SET ${fields.join(', ')}
       WHERE id = $${paramCounter} AND deleted_at IS NULL
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      throw new Error('Project not found');
    }

    const project = this.mapProjectRow(result.rows[0]);

    // Log audit event
    auditLogger.projectUpdated(userId, projectId, data);

    return project;
  }

  async deleteProject(projectId: string, userId: string): Promise<void> {
    await withTransaction(async (client) => {
      // Soft delete project
      const result = await client.query(
        `UPDATE projects.projects 
         SET deleted_at = CURRENT_TIMESTAMP, 
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND deleted_at IS NULL`,
        [projectId]
      );

      if (result.rowCount === 0) {
        throw new Error('Project not found');
      }

      // Also soft delete all threat models in the project
      await client.query(
        `UPDATE projects.threat_models 
         SET deleted_at = CURRENT_TIMESTAMP, 
             updated_at = CURRENT_TIMESTAMP
         WHERE project_id = $1 AND deleted_at IS NULL`,
        [projectId]
      );

      // Remove all collaborators
      await client.query(
        `DELETE FROM projects.collaborators WHERE project_id = $1`,
        [projectId]
      );

      // Log audit event
      auditLogger.projectDeleted(userId, projectId);
    });
  }

  async listProjects(
    filters: ProjectFilters,
    pagination: PaginationParams,
    userId?: string
  ): Promise<PaginatedResponse<Project>> {
    const conditions: string[] = ['p.deleted_at IS NULL'];
    const params: any[] = [];
    let paramCounter = 1;

    // Apply filters
    if (filters.organizationId) {
      conditions.push(`p.organization_id = $${paramCounter++}`);
      params.push(filters.organizationId);
    }
    if (filters.ownerId) {
      conditions.push(`p.owner_id = $${paramCounter++}`);
      params.push(filters.ownerId);
    }
    if (filters.status) {
      conditions.push(`p.status = $${paramCounter++}`);
      params.push(filters.status);
    }
    if (filters.visibility) {
      conditions.push(`p.visibility = $${paramCounter++}`);
      params.push(filters.visibility);
    }
    if (filters.tags && filters.tags.length > 0) {
      conditions.push(`p.tags ?| $${paramCounter++}`);
      params.push(filters.tags);
    }
    if (filters.industry) {
      conditions.push(`p.metadata->>'industry' = $${paramCounter++}`);
      params.push(filters.industry);
    }
    if (filters.criticality) {
      conditions.push(`p.metadata->>'criticality' = $${paramCounter++}`);
      params.push(filters.criticality);
    }
    if (filters.search) {
      conditions.push(`(
        p.name ILIKE $${paramCounter} OR 
        p.description ILIKE $${paramCounter}
      )`);
      params.push(`%${filters.search}%`);
      paramCounter++;
    }
    if (filters.dateRange) {
      conditions.push(`p.created_at BETWEEN $${paramCounter++} AND $${paramCounter++}`);
      params.push(filters.dateRange.start, filters.dateRange.end);
    }

    // Add user access filter if userId provided
    if (userId) {
      conditions.push(`(
        p.owner_id = $${paramCounter++} OR
        p.visibility = 'public' OR
        (p.visibility = 'organization' AND EXISTS (
          SELECT 1 FROM auth.users u 
          WHERE u.id = $${paramCounter++} AND u.organization_id = p.organization_id
        )) OR
        EXISTS (
          SELECT 1 FROM projects.collaborators c 
          WHERE c.project_id = p.id AND c.user_id = $${paramCounter++}
        )
      )`);
      params.push(userId, userId, userId);
    }

    const whereClause = conditions.join(' AND ');

    const baseQuery = `
      SELECT p.*, 
             u.email as owner_email,
             u.first_name as owner_first_name,
             u.last_name as owner_last_name,
             o.name as organization_name,
             COUNT(tm.id) as threat_model_count,
             COUNT(c.user_id) as collaborator_count
      FROM projects.projects p
      LEFT JOIN auth.users u ON p.owner_id = u.id
      LEFT JOIN management.organizations o ON p.organization_id = o.id
      LEFT JOIN projects.threat_models tm ON p.id = tm.project_id AND tm.deleted_at IS NULL
      LEFT JOIN projects.collaborators c ON p.id = c.project_id
      WHERE ${whereClause}
      GROUP BY p.id, u.email, u.first_name, u.last_name, o.name
    `;

    const countQuery = `
      SELECT COUNT(DISTINCT p.id) as count
      FROM projects.projects p
      LEFT JOIN auth.users u ON p.owner_id = u.id
      LEFT JOIN management.organizations o ON p.organization_id = o.id
      LEFT JOIN projects.collaborators c ON p.id = c.project_id
      WHERE ${whereClause}
    `;

    const result = await queryPaginated<any>(
      baseQuery,
      countQuery,
      params,
      {
        page: pagination.page || 1,
        pageSize: pagination.pageSize || 20,
        orderBy: pagination.orderBy || 'p.updated_at',
        orderDirection: pagination.orderDirection || 'DESC',
      }
    );

    return {
      data: result.data.map(row => this.mapProjectRowWithJoins(row)),
      pagination: result.pagination,
    };
  }

  async hasProjectAccess(projectId: string, userId: string): Promise<boolean> {
    const result = await query(
      `SELECT 1 FROM projects.projects p
       LEFT JOIN projects.collaborators c ON p.id = c.project_id
       LEFT JOIN auth.users u ON u.id = $2
       WHERE p.id = $1 AND p.deleted_at IS NULL AND (
         p.owner_id = $2 OR
         p.visibility = 'public' OR
         (p.visibility = 'organization' AND u.organization_id = p.organization_id) OR
         c.user_id = $2
       )`,
      [projectId, userId]
    );

    return result.rows.length > 0;
  }

  async getProjectStats(projectId: string): Promise<any> {
    const [threatModels, threats, mitigations, collaborators] = await Promise.all([
      query(
        'SELECT COUNT(*) as count FROM projects.threat_models WHERE project_id = $1 AND deleted_at IS NULL',
        [projectId]
      ),
      query(
        `SELECT COUNT(*) as count 
         FROM projects.threats t
         JOIN projects.threat_models tm ON t.threat_model_id = tm.id
         WHERE tm.project_id = $1 AND tm.deleted_at IS NULL`,
        [projectId]
      ),
      query(
        `SELECT COUNT(*) as count 
         FROM projects.mitigations m
         JOIN projects.threat_models tm ON m.threat_model_id = tm.id
         WHERE tm.project_id = $1 AND tm.deleted_at IS NULL`,
        [projectId]
      ),
      query(
        'SELECT COUNT(*) as count FROM projects.collaborators WHERE project_id = $1',
        [projectId]
      ),
    ]);

    return {
      threatModelCount: parseInt(threatModels.rows[0].count),
      threatCount: parseInt(threats.rows[0].count),
      mitigationCount: parseInt(mitigations.rows[0].count),
      collaboratorCount: parseInt(collaborators.rows[0].count),
    };
  }

  private mapProjectRow(row: any): Project {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      organizationId: row.organization_id,
      ownerId: row.owner_id,
      status: row.status as ProjectStatus,
      visibility: row.visibility as ProjectVisibility,
      tags: Array.isArray(row.tags) ? row.tags : JSON.parse(row.tags || '[]'),
      metadata: typeof row.metadata === 'object' ? row.metadata : JSON.parse(row.metadata || '{}'),
      settings: typeof row.settings === 'object' ? row.settings : JSON.parse(row.settings || '{}'),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at,
    };
  }

  private mapProjectRowWithJoins(row: any): Project & { 
    ownerEmail?: string; 
    ownerName?: string; 
    organizationName?: string;
    threatModelCount?: number;
    collaboratorCount?: number;
  } {
    const project = this.mapProjectRow(row);
    const ownerName = [row.owner_first_name, row.owner_last_name].filter(Boolean).join(' ');
    return {
      ...project,
      ownerEmail: row.owner_email || undefined,
      ownerName: ownerName || undefined,
      organizationName: row.organization_name || undefined,
      threatModelCount: parseInt(row.threat_model_count || 0),
      collaboratorCount: parseInt(row.collaborator_count || 0),
    };
  }
}