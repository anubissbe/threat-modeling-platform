import { query, queryPaginated, withTransaction } from '../database';
import { 
  ThreatModel, 
  ThreatModelFilters,
  PaginationParams,
  PaginatedResponse,
  ThreatModelStatus,
  ThreatModelingMethodology,
  ThreatModelContent,
  ThreatModelMetadata,
  Version,
  VersionMetadata,
  ChangeType
} from '../types';
import { logger, auditLogger } from '../utils/logger';
import { 
  generateVersion, 
  parseVersion, 
  incrementVersion, 
  compareVersions,
  isValidThreatModelName 
} from '../utils/helpers';

export interface CreateThreatModelDto {
  name: string;
  description?: string;
  methodology: ThreatModelingMethodology;
  content?: Partial<ThreatModelContent>;
  metadata?: Partial<ThreatModelMetadata>;
}

export interface UpdateThreatModelDto {
  name?: string;
  description?: string;
  methodology?: ThreatModelingMethodology;
  status?: ThreatModelStatus;
  content?: Partial<ThreatModelContent>;
  metadata?: Partial<ThreatModelMetadata>;
}

export class ThreatModelService {
  async createThreatModel(
    projectId: string,
    data: CreateThreatModelDto, 
    userId: string
  ): Promise<ThreatModel> {
    try {
      if (!isValidThreatModelName(data.name)) {
        throw new Error('Invalid threat model name');
      }

      // Default content and metadata
      const defaultContent: ThreatModelContent = {
        systemDescription: '',
        assumptions: [],
        dependencies: [],
        components: [],
        dataFlows: [],
        threats: [],
        mitigations: [],
        residualRisks: [],
      };

      const defaultMetadata: ThreatModelMetadata = {
        reviewers: [],
        confidentialityLevel: 'internal',
      };

      const content = { ...defaultContent, ...data.content };
      const metadata = { ...defaultMetadata, ...data.metadata };
      const version = generateVersion(1, 0, 0);

      const result = await query(
        `INSERT INTO projects.threat_models (
          project_id, name, description, version, methodology, 
          status, content, metadata, created_by_id, last_modified_by_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *`,
        [
          projectId,
          data.name,
          data.description || null,
          version,
          data.methodology,
          ThreatModelStatus.DRAFT,
          JSON.stringify(content),
          JSON.stringify(metadata),
          userId,
          userId,
        ]
      );

      const threatModel = this.mapThreatModelRow(result.rows[0]);

      // Create initial version
      await this.createVersion(threatModel.id, {
        message: 'Initial version',
        content,
        metadata: {
          changeType: ChangeType.MAJOR,
          changedComponents: [],
          addedThreats: 0,
          removedThreats: 0,
          modifiedThreats: 0,
          addedMitigations: 0,
          removedMitigations: 0,
          reviewRequired: false,
        },
      }, userId);

      // Log audit event
      auditLogger.threatModelCreated(userId, threatModel.id, projectId, threatModel.name);

      return threatModel;
    } catch (error: any) {
      if (error.code === '23505') { // Unique constraint violation
        throw new Error('Threat model name already exists in project');
      }
      logger.error('Failed to create threat model:', error);
      throw error;
    }
  }

  async getThreatModel(threatModelId: string, userId?: string): Promise<ThreatModel | null> {
    const result = await query(
      `SELECT tm.*, 
              p.name as project_name,
              p.organization_id,
              cb.email as created_by_email,
              cb.first_name as created_by_first_name,
              cb.last_name as created_by_last_name,
              mb.email as modified_by_email,
              mb.first_name as modified_by_first_name,
              mb.last_name as modified_by_last_name
       FROM projects.threat_models tm
       LEFT JOIN projects.projects p ON tm.project_id = p.id
       LEFT JOIN auth.users cb ON tm.created_by_id = cb.id
       LEFT JOIN auth.users mb ON tm.last_modified_by_id = mb.id
       WHERE tm.id = $1 AND tm.deleted_at IS NULL`,
      [threatModelId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const threatModel = this.mapThreatModelRowWithJoins(result.rows[0]);

    // Check access permissions if userId provided
    if (userId && !await this.hasThreatModelAccess(threatModelId, userId)) {
      return null;
    }

    return threatModel;
  }

  async updateThreatModel(
    threatModelId: string,
    data: UpdateThreatModelDto,
    userId: string,
    createVersion: boolean = false
  ): Promise<ThreatModel> {
    const existingThreatModel = await this.getThreatModel(threatModelId);
    if (!existingThreatModel) {
      throw new Error('Threat model not found');
    }

    const fields: string[] = [];
    const values: any[] = [];
    let paramCounter = 1;

    // Build dynamic update query
    if (data.name !== undefined) {
      if (!isValidThreatModelName(data.name)) {
        throw new Error('Invalid threat model name');
      }
      fields.push(`name = $${paramCounter++}`);
      values.push(data.name);
    }
    if (data.description !== undefined) {
      fields.push(`description = $${paramCounter++}`);
      values.push(data.description);
    }
    if (data.methodology !== undefined) {
      fields.push(`methodology = $${paramCounter++}`);
      values.push(data.methodology);
    }
    if (data.status !== undefined) {
      fields.push(`status = $${paramCounter++}`);
      values.push(data.status);
    }
    if (data.content !== undefined) {
      const mergedContent = { ...existingThreatModel.content, ...data.content };
      fields.push(`content = $${paramCounter++}`);
      values.push(JSON.stringify(mergedContent));
    }
    if (data.metadata !== undefined) {
      const mergedMetadata = { ...existingThreatModel.metadata, ...data.metadata };
      fields.push(`metadata = $${paramCounter++}`);
      values.push(JSON.stringify(mergedMetadata));
    }

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    // Always update version and last modified info
    let newVersion = existingThreatModel.version;
    if (createVersion || data.content !== undefined) {
      newVersion = incrementVersion(existingThreatModel.version, 'patch');
    }

    fields.push(`version = $${paramCounter++}`);
    fields.push(`last_modified_by_id = $${paramCounter++}`);
    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(newVersion, userId);

    values.push(threatModelId);

    const result = await query(
      `UPDATE projects.threat_models 
       SET ${fields.join(', ')}
       WHERE id = $${paramCounter} AND deleted_at IS NULL
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      throw new Error('Threat model not found');
    }

    const threatModel = this.mapThreatModelRow(result.rows[0]);

    // Create version if content changed or explicitly requested
    if (createVersion || data.content !== undefined) {
      await this.createVersion(threatModelId, {
        message: `Updated to version ${newVersion}`,
        content: threatModel.content,
        metadata: this.calculateVersionMetadata(existingThreatModel.content, threatModel.content),
      }, userId);
    }

    // Log audit event
    auditLogger.threatModelUpdated(userId, threatModelId, data);

    return threatModel;
  }

  async deleteThreatModel(threatModelId: string, userId: string): Promise<void> {
    await withTransaction(async (client) => {
      // Soft delete threat model
      const result = await client.query(
        `UPDATE projects.threat_models 
         SET deleted_at = CURRENT_TIMESTAMP, 
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND deleted_at IS NULL`,
        [threatModelId]
      );

      if (result.rowCount === 0) {
        throw new Error('Threat model not found');
      }

      // Log audit event
      auditLogger.threatModelUpdated(userId, threatModelId, { deleted: true });
    });
  }

  async listThreatModels(
    filters: ThreatModelFilters,
    pagination: PaginationParams,
    userId?: string
  ): Promise<PaginatedResponse<ThreatModel>> {
    const conditions: string[] = ['tm.deleted_at IS NULL'];
    const params: any[] = [];
    let paramCounter = 1;

    // Apply filters
    if (filters.projectId) {
      conditions.push(`tm.project_id = $${paramCounter++}`);
      params.push(filters.projectId);
    }
    if (filters.methodology) {
      conditions.push(`tm.methodology = $${paramCounter++}`);
      params.push(filters.methodology);
    }
    if (filters.status) {
      conditions.push(`tm.status = $${paramCounter++}`);
      params.push(filters.status);
    }
    if (filters.createdById) {
      conditions.push(`tm.created_by_id = $${paramCounter++}`);
      params.push(filters.createdById);
    }
    if (filters.search) {
      conditions.push(`(
        tm.name ILIKE $${paramCounter} OR 
        tm.description ILIKE $${paramCounter}
      )`);
      params.push(`%${filters.search}%`);
      paramCounter++;
    }
    if (filters.dateRange) {
      conditions.push(`tm.created_at BETWEEN $${paramCounter++} AND $${paramCounter++}`);
      params.push(filters.dateRange.start, filters.dateRange.end);
    }

    // Add user access filter if userId provided
    if (userId) {
      conditions.push(`(
        tm.created_by_id = $${paramCounter++} OR
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
      params.push(userId, userId, userId, userId);
    }

    const whereClause = conditions.join(' AND ');

    const baseQuery = `
      SELECT tm.*, 
             p.name as project_name,
             p.organization_id,
             cb.email as created_by_email,
             cb.first_name as created_by_first_name,
             cb.last_name as created_by_last_name,
             mb.email as modified_by_email,
             mb.first_name as modified_by_first_name,
             mb.last_name as modified_by_last_name
      FROM projects.threat_models tm
      LEFT JOIN projects.projects p ON tm.project_id = p.id
      LEFT JOIN auth.users cb ON tm.created_by_id = cb.id
      LEFT JOIN auth.users mb ON tm.last_modified_by_id = mb.id
      WHERE ${whereClause}
    `;

    const countQuery = `
      SELECT COUNT(*) as count
      FROM projects.threat_models tm
      LEFT JOIN projects.projects p ON tm.project_id = p.id
      WHERE ${whereClause}
    `;

    const result = await queryPaginated<any>(
      baseQuery,
      countQuery,
      params,
      {
        page: pagination.page || 1,
        pageSize: pagination.pageSize || 20,
        orderBy: pagination.orderBy || 'tm.updated_at',
        orderDirection: pagination.orderDirection || 'DESC',
      }
    );

    return {
      data: result.data.map(row => this.mapThreatModelRowWithJoins(row)),
      pagination: result.pagination,
    };
  }

  async hasThreatModelAccess(threatModelId: string, userId: string): Promise<boolean> {
    const result = await query(
      `SELECT 1 FROM projects.threat_models tm
       JOIN projects.projects p ON tm.project_id = p.id
       LEFT JOIN projects.collaborators c ON p.id = c.project_id
       LEFT JOIN auth.users u ON u.id = $2
       WHERE tm.id = $1 AND tm.deleted_at IS NULL AND (
         tm.created_by_id = $2 OR
         p.owner_id = $2 OR
         p.visibility = 'public' OR
         (p.visibility = 'organization' AND u.organization_id = p.organization_id) OR
         c.user_id = $2
       )`,
      [threatModelId, userId]
    );

    return result.rows.length > 0;
  }

  async createVersion(
    threatModelId: string,
    versionData: {
      message: string;
      content: ThreatModelContent;
      metadata: VersionMetadata;
      parentVersionId?: string;
    },
    userId: string
  ): Promise<Version> {
    // Get current threat model to determine version
    const threatModel = await this.getThreatModel(threatModelId);
    if (!threatModel) {
      throw new Error('Threat model not found');
    }

    const versionInfo = parseVersion(threatModel.version);
    
    const result = await query(
      `INSERT INTO projects.versions (
        threat_model_id, version, major, minor, patch, tag,
        message, content, metadata, created_by_id, parent_version_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        threatModelId,
        threatModel.version,
        versionInfo.major,
        versionInfo.minor,
        versionInfo.patch,
        versionInfo.tag || null,
        versionData.message,
        JSON.stringify(versionData.content),
        JSON.stringify(versionData.metadata),
        userId,
        versionData.parentVersionId || null,
      ]
    );

    const version = this.mapVersionRow(result.rows[0]);

    // Log audit event
    auditLogger.versionCreated(userId, threatModelId, version.id, version.version);

    return version;
  }

  async getVersions(threatModelId: string): Promise<Version[]> {
    const result = await query(
      `SELECT v.*, 
              u.email as created_by_email,
              u.first_name as created_by_first_name,
              u.last_name as created_by_last_name
       FROM projects.versions v
       LEFT JOIN auth.users u ON v.created_by_id = u.id
       WHERE v.threat_model_id = $1
       ORDER BY v.created_at DESC`,
      [threatModelId]
    );

    return result.rows.map(row => this.mapVersionRow(row));
  }

  async getVersion(versionId: string): Promise<Version | null> {
    const result = await query(
      `SELECT v.*, 
              u.email as created_by_email,
              u.first_name as created_by_first_name,
              u.last_name as created_by_last_name
       FROM projects.versions v
       LEFT JOIN auth.users u ON v.created_by_id = u.id
       WHERE v.id = $1`,
      [versionId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapVersionRow(result.rows[0]);
  }

  private calculateVersionMetadata(
    oldContent: ThreatModelContent,
    newContent: ThreatModelContent
  ): VersionMetadata {
    const addedThreats = newContent.threats.length - oldContent.threats.length;
    const addedMitigations = newContent.mitigations.length - oldContent.mitigations.length;
    
    // Simple change detection - in practice, you'd want more sophisticated diff logic
    const changedComponents = newContent.components
      .filter(comp => !oldContent.components.some(old => old.id === comp.id))
      .map(comp => comp.id);

    let changeType = ChangeType.PATCH;
    if (changedComponents.length > 0 || addedThreats > 0 || addedMitigations > 0) {
      changeType = ChangeType.MINOR;
    }
    if (newContent.systemDescription !== oldContent.systemDescription) {
      changeType = ChangeType.MAJOR;
    }

    return {
      changeType,
      changedComponents,
      addedThreats: Math.max(0, addedThreats),
      removedThreats: Math.max(0, -addedThreats),
      modifiedThreats: 0, // Would need more sophisticated diff
      addedMitigations: Math.max(0, addedMitigations),
      removedMitigations: Math.max(0, -addedMitigations),
      reviewRequired: changeType === ChangeType.MAJOR || addedThreats > 0,
    };
  }

  private mapThreatModelRow(row: any): ThreatModel {
    return {
      id: row.id,
      projectId: row.project_id,
      name: row.name,
      description: row.description,
      version: row.version,
      methodology: row.methodology as ThreatModelingMethodology,
      status: row.status as ThreatModelStatus,
      content: typeof row.content === 'object' ? row.content : JSON.parse(row.content || '{}'),
      metadata: typeof row.metadata === 'object' ? row.metadata : JSON.parse(row.metadata || '{}'),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      createdById: row.created_by_id,
      lastModifiedById: row.last_modified_by_id,
    };
  }

  private mapThreatModelRowWithJoins(row: any): ThreatModel & {
    projectName?: string;
    organizationId?: string;
    createdByEmail?: string;
    createdByName?: string;
    modifiedByEmail?: string;
    modifiedByName?: string;
  } {
    const threatModel = this.mapThreatModelRow(row);
    const createdByName = [row.created_by_first_name, row.created_by_last_name].filter(Boolean).join(' ');
    const modifiedByName = [row.modified_by_first_name, row.modified_by_last_name].filter(Boolean).join(' ');
    return {
      ...threatModel,
      projectName: row.project_name || undefined,
      organizationId: row.organization_id || undefined,
      createdByEmail: row.created_by_email || undefined,
      createdByName: createdByName || undefined,
      modifiedByEmail: row.modified_by_email || undefined,
      modifiedByName: modifiedByName || undefined,
    };
  }

  private mapVersionRow(row: any): Version {
    return {
      id: row.id,
      threatModelId: row.threat_model_id,
      version: row.version,
      major: row.major,
      minor: row.minor,
      patch: row.patch,
      tag: row.tag,
      message: row.message,
      content: typeof row.content === 'object' ? row.content : JSON.parse(row.content || '{}'),
      metadata: typeof row.metadata === 'object' ? row.metadata : JSON.parse(row.metadata || '{}'),
      createdAt: row.created_at,
      createdById: row.created_by_id,
      parentVersionId: row.parent_version_id,
    };
  }
}