import { query, queryPaginated, withTransaction } from '../database';
import { CacheManager } from '../redis';
import { 
  User, 
  CreateUserDto, 
  UpdateUserDto, 
  UserFilters,
  PaginationParams,
  PaginatedResponse
} from '../types';
import { logger, auditLogger } from '../utils/logger';
import { hashPassword } from '../utils/crypto';
import { generateSlug } from '../utils/helpers';

export class UserService {
  private cache: CacheManager;

  constructor(cache: CacheManager) {
    this.cache = cache;
  }

  async createUser(data: CreateUserDto, adminId?: string): Promise<User> {
    try {
      // Hash password
      const passwordHash = await hashPassword(data.password);

      // Create user
      const result = await query(
        `INSERT INTO auth.users (
          email, password_hash, first_name, last_name, 
          organization_id, roles, email_verified
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *`,
        [
          data.email.toLowerCase(),
          passwordHash,
          data.firstName || null,
          data.lastName || null,
          data.organizationId || null,
          data.roles || ['user'],
          false, // email not verified by default
        ]
      );

      const user = this.mapUserRow(result.rows[0]);

      // Log audit event
      if (adminId) {
        auditLogger.userCreated(adminId, user.id, user.email);
      }

      // Cache user
      await this.cache.set(`user:${user.id}`, user, 3600);

      return user;
    } catch (error: any) {
      if (error.code === '23505') { // Unique constraint violation
        throw new Error('Email already exists');
      }
      logger.error('Failed to create user:', error);
      throw error;
    }
  }

  async getUser(userId: string): Promise<User | null> {
    // Check cache first
    const cached = await this.cache.get<User>(`user:${userId}`);
    if (cached) {
      return cached;
    }

    const result = await query(
      `SELECT u.*, 
              array_agg(DISTINCT r.name) FILTER (WHERE r.name IS NOT NULL) as role_names,
              array_agg(DISTINCT p.name) FILTER (WHERE p.name IS NOT NULL) as permission_names
       FROM auth.users u
       LEFT JOIN auth.user_roles ur ON u.id = ur.user_id
       LEFT JOIN auth.roles r ON ur.role_id = r.id
       LEFT JOIN auth.role_permissions rp ON r.id = rp.role_id
       LEFT JOIN auth.permissions p ON rp.permission_id = p.id
       WHERE u.id = $1 AND u.deleted_at IS NULL
       GROUP BY u.id`,
      [userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const user = this.mapUserRowWithRoles(result.rows[0]);

    // Cache user
    await this.cache.set(`user:${userId}`, user, 3600);

    return user;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const result = await query(
      `SELECT u.*, 
              array_agg(DISTINCT r.name) FILTER (WHERE r.name IS NOT NULL) as role_names,
              array_agg(DISTINCT p.name) FILTER (WHERE p.name IS NOT NULL) as permission_names
       FROM auth.users u
       LEFT JOIN auth.user_roles ur ON u.id = ur.user_id
       LEFT JOIN auth.roles r ON ur.role_id = r.id
       LEFT JOIN auth.role_permissions rp ON r.id = rp.role_id
       LEFT JOIN auth.permissions p ON rp.permission_id = p.id
       WHERE u.email = $1 AND u.deleted_at IS NULL
       GROUP BY u.id`,
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapUserRowWithRoles(result.rows[0]);
  }

  async updateUser(
    userId: string, 
    data: UpdateUserDto, 
    adminId: string
  ): Promise<User> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCounter = 1;

    // Build dynamic update query
    if (data.firstName !== undefined) {
      fields.push(`first_name = $${paramCounter++}`);
      values.push(data.firstName);
    }
    if (data.lastName !== undefined) {
      fields.push(`last_name = $${paramCounter++}`);
      values.push(data.lastName);
    }
    if (data.avatar !== undefined) {
      fields.push(`avatar = $${paramCounter++}`);
      values.push(data.avatar);
    }
    if (data.isActive !== undefined) {
      fields.push(`is_active = $${paramCounter++}`);
      values.push(data.isActive);
    }

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(userId);

    const result = await query(
      `UPDATE auth.users 
       SET ${fields.join(', ')}
       WHERE id = $${paramCounter} AND deleted_at IS NULL
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    const user = this.mapUserRow(result.rows[0]);

    // Log audit event
    auditLogger.userUpdated(adminId, userId, data);

    // Invalidate cache
    await this.cache.invalidateUser(userId);

    return user;
  }

  async deleteUser(userId: string, adminId: string): Promise<void> {
    const result = await query(
      `UPDATE auth.users 
       SET deleted_at = CURRENT_TIMESTAMP, 
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND deleted_at IS NULL`,
      [userId]
    );

    if (result.rowCount === 0) {
      throw new Error('User not found');
    }

    // Log audit event
    auditLogger.userDeleted(adminId, userId);

    // Invalidate cache
    await this.cache.invalidateUser(userId);
  }

  async listUsers(
    filters: UserFilters,
    pagination: PaginationParams
  ): Promise<PaginatedResponse<User>> {
    const conditions: string[] = ['u.deleted_at IS NULL'];
    const params: any[] = [];
    let paramCounter = 1;

    // Apply filters
    if (filters.organizationId) {
      conditions.push(`u.organization_id = $${paramCounter++}`);
      params.push(filters.organizationId);
    }
    if (filters.isActive !== undefined) {
      conditions.push(`u.is_active = $${paramCounter++}`);
      params.push(filters.isActive);
    }
    if (filters.emailVerified !== undefined) {
      conditions.push(`u.email_verified = $${paramCounter++}`);
      params.push(filters.emailVerified);
    }
    if (filters.search) {
      conditions.push(`(
        u.email ILIKE $${paramCounter} OR 
        u.first_name ILIKE $${paramCounter} OR 
        u.last_name ILIKE $${paramCounter}
      )`);
      params.push(`%${filters.search}%`);
      paramCounter++;
    }
    if (filters.roleId) {
      conditions.push(`EXISTS (
        SELECT 1 FROM auth.user_roles ur 
        WHERE ur.user_id = u.id AND ur.role_id = $${paramCounter++}
      )`);
      params.push(filters.roleId);
    }
    if (filters.teamId) {
      conditions.push(`EXISTS (
        SELECT 1 FROM auth.team_members tm 
        WHERE tm.user_id = u.id AND tm.team_id = $${paramCounter++}
      )`);
      params.push(filters.teamId);
    }

    const whereClause = conditions.join(' AND ');

    const baseQuery = `
      SELECT u.*, 
             array_agg(DISTINCT r.name) FILTER (WHERE r.name IS NOT NULL) as role_names
      FROM auth.users u
      LEFT JOIN auth.user_roles ur ON u.id = ur.user_id
      LEFT JOIN auth.roles r ON ur.role_id = r.id
      WHERE ${whereClause}
      GROUP BY u.id
    `;

    const countQuery = `
      SELECT COUNT(DISTINCT u.id) as count
      FROM auth.users u
      WHERE ${whereClause}
    `;

    const result = await queryPaginated<any>(
      baseQuery,
      countQuery,
      params,
      {
        page: pagination.page || 1,
        pageSize: pagination.pageSize || 20,
        orderBy: pagination.orderBy || 'u.created_at',
        orderDirection: pagination.orderDirection || 'DESC',
      }
    );

    return {
      data: result.data.map(row => this.mapUserRowWithRoles(row)),
      pagination: result.pagination,
    };
  }

  async assignRole(userId: string, roleId: string, adminId: string): Promise<void> {
    try {
      await query(
        `INSERT INTO auth.user_roles (user_id, role_id) 
         VALUES ($1, $2) 
         ON CONFLICT (user_id, role_id) DO NOTHING`,
        [userId, roleId]
      );

      // Log audit event
      auditLogger.roleAssigned(adminId, userId, roleId);

      // Invalidate cache
      await this.cache.invalidateUser(userId);
    } catch (error) {
      logger.error('Failed to assign role:', error);
      throw error;
    }
  }

  async revokeRole(userId: string, roleId: string, adminId: string): Promise<void> {
    const result = await query(
      `DELETE FROM auth.user_roles 
       WHERE user_id = $1 AND role_id = $2`,
      [userId, roleId]
    );

    if (result.rowCount === 0) {
      throw new Error('User role assignment not found');
    }

    // Log audit event
    auditLogger.roleRevoked(adminId, userId, roleId);

    // Invalidate cache
    await this.cache.invalidateUser(userId);
  }

  async getUserPermissions(userId: string): Promise<string[]> {
    const result = await query(
      `SELECT DISTINCT p.name
       FROM auth.permissions p
       JOIN auth.role_permissions rp ON p.id = rp.permission_id
       JOIN auth.roles r ON rp.role_id = r.id
       JOIN auth.user_roles ur ON r.id = ur.role_id
       WHERE ur.user_id = $1
       UNION
       SELECT DISTINCT p.name
       FROM auth.permissions p
       JOIN auth.user_permissions up ON p.id = up.permission_id
       WHERE up.user_id = $1`,
      [userId]
    );

    return result.rows.map((row: any) => row.name);
  }

  async hasPermission(
    userId: string, 
    permission: string, 
    resourceId?: string
  ): Promise<boolean> {
    let queryText = `
      SELECT EXISTS (
        SELECT 1
        FROM auth.permissions p
        JOIN auth.role_permissions rp ON p.id = rp.permission_id
        JOIN auth.roles r ON rp.role_id = r.id
        JOIN auth.user_roles ur ON r.id = ur.role_id
        WHERE ur.user_id = $1 AND p.name = $2
        UNION
        SELECT 1
        FROM auth.permissions p
        JOIN auth.user_permissions up ON p.id = up.permission_id
        WHERE up.user_id = $1 AND p.name = $2
    `;

    const params = [userId, permission];

    if (resourceId) {
      queryText += ` AND (up.resource_id = $3 OR up.resource_id IS NULL)`;
      params.push(resourceId);
    }

    queryText += ') as has_permission';

    const result = await query(queryText, params);
    return result.rows[0]?.has_permission || false;
  }

  private mapUserRow(row: any): User {
    return {
      id: row.id,
      email: row.email,
      firstName: row.first_name,
      lastName: row.last_name,
      avatar: row.avatar,
      organizationId: row.organization_id,
      roles: row.roles || [],
      permissions: row.permissions || [],
      isActive: row.is_active,
      emailVerified: row.email_verified,
      lastLoginAt: row.last_login_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at,
    };
  }

  private mapUserRowWithRoles(row: any): User {
    const user = this.mapUserRow(row);
    user.roles = row.role_names || [];
    user.permissions = row.permission_names || [];
    return user;
  }
}