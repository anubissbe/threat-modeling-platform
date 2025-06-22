import { query, queryPaginated, withTransaction } from '../database';
import { CacheManager } from '../redis';
import { 
  Organization, 
  CreateOrganizationDto, 
  UpdateOrganizationDto,
  OrganizationFilters,
  PaginationParams,
  PaginatedResponse
} from '../types';
import { logger, auditLogger } from '../utils/logger';
import { generateSlug } from '../utils/helpers';

export class OrganizationService {
  private cache: CacheManager;

  constructor(cache: CacheManager) {
    this.cache = cache;
  }

  async createOrganization(
    data: CreateOrganizationDto, 
    adminId: string
  ): Promise<Organization> {
    try {
      // Generate unique slug
      const baseSlug = generateSlug(data.name);
      const slug = await this.generateUniqueSlug(baseSlug);

      // Default settings
      const defaultSettings = {
        maxUsers: 100,
        maxProjects: 50,
        features: ['basic'],
        ssoEnabled: false,
        mfaRequired: false,
      };

      const result = await query(
        `INSERT INTO management.organizations (
          name, slug, description, website, industry, size, settings
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *`,
        [
          data.name,
          slug,
          data.description || null,
          data.website || null,
          data.industry || null,
          data.size || null,
          JSON.stringify(defaultSettings),
        ]
      );

      const org = this.mapOrganizationRow(result.rows[0]);

      // Log audit event
      auditLogger.organizationCreated(adminId, org.id, org.name);

      // Cache organization
      await this.cache.set(`org:${org.id}`, org, 3600);
      await this.cache.set(`org:slug:${org.slug}`, org, 3600);

      return org;
    } catch (error) {
      if (error.code === '23505') {
        throw new Error('Organization name already exists');
      }
      logger.error('Failed to create organization:', error);
      throw error;
    }
  }

  async getOrganization(orgId: string): Promise<Organization | null> {
    // Check cache first
    const cached = await this.cache.get<Organization>(`org:${orgId}`);
    if (cached) {
      return cached;
    }

    const result = await query(
      `SELECT * FROM management.organizations 
       WHERE id = $1 AND deleted_at IS NULL`,
      [orgId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const org = this.mapOrganizationRow(result.rows[0]);

    // Cache organization
    await this.cache.set(`org:${org.id}`, org, 3600);
    await this.cache.set(`org:slug:${org.slug}`, org, 3600);

    return org;
  }

  async getOrganizationBySlug(slug: string): Promise<Organization | null> {
    // Check cache first
    const cached = await this.cache.get<Organization>(`org:slug:${slug}`);
    if (cached) {
      return cached;
    }

    const result = await query(
      `SELECT * FROM management.organizations 
       WHERE slug = $1 AND deleted_at IS NULL`,
      [slug]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const org = this.mapOrganizationRow(result.rows[0]);

    // Cache organization
    await this.cache.set(`org:${org.id}`, org, 3600);
    await this.cache.set(`org:slug:${org.slug}`, org, 3600);

    return org;
  }

  async updateOrganization(
    orgId: string, 
    data: UpdateOrganizationDto, 
    adminId: string
  ): Promise<Organization> {
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
    if (data.logo !== undefined) {
      fields.push(`logo = $${paramCounter++}`);
      values.push(data.logo);
    }
    if (data.website !== undefined) {
      fields.push(`website = $${paramCounter++}`);
      values.push(data.website);
    }
    if (data.industry !== undefined) {
      fields.push(`industry = $${paramCounter++}`);
      values.push(data.industry);
    }
    if (data.size !== undefined) {
      fields.push(`size = $${paramCounter++}`);
      values.push(data.size);
    }
    if (data.settings !== undefined) {
      // Merge with existing settings
      const existingOrg = await this.getOrganization(orgId);
      if (!existingOrg) {
        throw new Error('Organization not found');
      }
      const mergedSettings = { ...existingOrg.settings, ...data.settings };
      fields.push(`settings = $${paramCounter++}`);
      values.push(JSON.stringify(mergedSettings));
    }

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(orgId);

    const result = await query(
      `UPDATE management.organizations 
       SET ${fields.join(', ')}
       WHERE id = $${paramCounter} AND deleted_at IS NULL
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      throw new Error('Organization not found');
    }

    const org = this.mapOrganizationRow(result.rows[0]);

    // Log audit event
    auditLogger.organizationUpdated(adminId, orgId, data);

    // Invalidate cache
    await this.cache.invalidateOrganization(orgId);
    await this.cache.delete(`org:slug:${org.slug}`);

    return org;
  }

  async deleteOrganization(orgId: string, adminId: string): Promise<void> {
    await withTransaction(async (client) => {
      // Soft delete organization
      const result = await client.query(
        `UPDATE management.organizations 
         SET deleted_at = CURRENT_TIMESTAMP, 
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND deleted_at IS NULL
         RETURNING slug`,
        [orgId]
      );

      if (result.rowCount === 0) {
        throw new Error('Organization not found');
      }

      const slug = result.rows[0].slug;

      // Also soft delete all users in the organization
      await client.query(
        `UPDATE auth.users 
         SET deleted_at = CURRENT_TIMESTAMP, 
             updated_at = CURRENT_TIMESTAMP
         WHERE organization_id = $1 AND deleted_at IS NULL`,
        [orgId]
      );

      // Delete all teams
      await client.query(
        `UPDATE management.teams 
         SET deleted_at = CURRENT_TIMESTAMP, 
             updated_at = CURRENT_TIMESTAMP
         WHERE organization_id = $1 AND deleted_at IS NULL`,
        [orgId]
      );

      // Log audit event
      auditLogger.organizationUpdated(adminId, orgId, { deleted: true });

      // Invalidate cache
      await this.cache.invalidateOrganization(orgId);
      await this.cache.delete(`org:slug:${slug}`);
    });
  }

  async listOrganizations(
    filters: OrganizationFilters,
    pagination: PaginationParams
  ): Promise<PaginatedResponse<Organization>> {
    const conditions: string[] = ['deleted_at IS NULL'];
    const params: any[] = [];
    let paramCounter = 1;

    // Apply filters
    if (filters.industry) {
      conditions.push(`industry = $${paramCounter++}`);
      params.push(filters.industry);
    }
    if (filters.size) {
      conditions.push(`size = $${paramCounter++}`);
      params.push(filters.size);
    }
    if (filters.search) {
      conditions.push(`(
        name ILIKE $${paramCounter} OR 
        description ILIKE $${paramCounter}
      )`);
      params.push(`%${filters.search}%`);
      paramCounter++;
    }

    const whereClause = conditions.join(' AND ');

    const baseQuery = `
      SELECT * FROM management.organizations
      WHERE ${whereClause}
    `;

    const countQuery = `
      SELECT COUNT(*) as count
      FROM management.organizations
      WHERE ${whereClause}
    `;

    const result = await queryPaginated<any>(
      baseQuery,
      countQuery,
      params,
      {
        page: pagination.page || 1,
        pageSize: pagination.pageSize || 20,
        orderBy: pagination.orderBy || 'created_at',
        orderDirection: pagination.orderDirection || 'DESC',
      }
    );

    return {
      data: result.data.map(row => this.mapOrganizationRow(row)),
      pagination: result.pagination,
    };
  }

  async getOrganizationStats(orgId: string): Promise<any> {
    const [users, teams, projects] = await Promise.all([
      query(
        'SELECT COUNT(*) as count FROM auth.users WHERE organization_id = $1 AND deleted_at IS NULL',
        [orgId]
      ),
      query(
        'SELECT COUNT(*) as count FROM management.teams WHERE organization_id = $1 AND deleted_at IS NULL',
        [orgId]
      ),
      query(
        'SELECT COUNT(*) as count FROM projects.projects WHERE organization_id = $1 AND deleted_at IS NULL',
        [orgId]
      ),
    ]);

    return {
      userCount: parseInt(users.rows[0].count),
      teamCount: parseInt(teams.rows[0].count),
      projectCount: parseInt(projects.rows[0].count),
    };
  }

  private async generateUniqueSlug(baseSlug: string): Promise<string> {
    let slug = baseSlug;
    let counter = 1;

    while (true) {
      const result = await query(
        'SELECT id FROM management.organizations WHERE slug = $1',
        [slug]
      );

      if (result.rows.length === 0) {
        return slug;
      }

      slug = `${baseSlug}-${counter}`;
      counter++;
    }
  }

  private mapOrganizationRow(row: any): Organization {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      logo: row.logo,
      website: row.website,
      industry: row.industry,
      size: row.size,
      settings: row.settings || {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at,
    };
  }
}