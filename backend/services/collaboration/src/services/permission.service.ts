import { Pool } from 'pg';
import { logger } from '../utils/logger';
import { UserPermissions } from '../types/collaboration';

export class PermissionService {
  constructor(private db: Pool) {}

  async canAccessThreatModel(userId: string, threatModelId: string): Promise<boolean> {
    try {
      const result = await this.db.query(`
        SELECT 1 FROM threat_models tm
        JOIN projects p ON tm.project_id = p.id
        LEFT JOIN user_projects up ON p.id = up.project_id
        WHERE tm.id = $1 AND (p.owner_id = $2 OR up.user_id = $2)
      `, [threatModelId, userId]);

      return result.rows.length > 0;
    } catch (error) {
      logger.error('Permission check error:', error);
      return false;
    }
  }

  async canPerformOperation(
    userId: string,
    threatModelId: string,
    operationType: string
  ): Promise<boolean> {
    try {
      const permissions = await this.getUserPermissions(userId, threatModelId);
      
      // Check specific operation permissions
      switch (operationType) {
        case 'create_component':
        case 'create_data_flow':
        case 'create_threat':
          return permissions.canCreate;
        
        case 'update_component':
        case 'update_data_flow':
        case 'update_threat':
          return permissions.canEdit;
        
        case 'delete_component':
        case 'delete_data_flow':
        case 'delete_threat':
          return permissions.canDelete;
        
        case 'add_comment':
          return permissions.canComment;
        
        case 'run_analysis':
          return permissions.canAnalyze;
        
        default:
          return false;
      }
    } catch (error) {
      logger.error('Operation permission check error:', error);
      return false;
    }
  }

  async getUserPermissions(userId: string, threatModelId: string): Promise<UserPermissions> {
    try {
      const result = await this.db.query(`
        SELECT 
          p.owner_id,
          up.role,
          up.permissions,
          u.role as user_role
        FROM threat_models tm
        JOIN projects p ON tm.project_id = p.id
        LEFT JOIN user_projects up ON p.id = up.project_id AND up.user_id = $2
        LEFT JOIN users u ON u.id = $2
        WHERE tm.id = $1
      `, [threatModelId, userId]);

      if (result.rows.length === 0) {
        return this.getDefaultPermissions();
      }

      const row = result.rows[0];
      const isOwner = row.owner_id === userId;
      const projectRole = row.role;
      const userRole = row.user_role;
      const customPermissions = row.permissions ? JSON.parse(row.permissions) : {};

      // Owner has all permissions
      if (isOwner) {
        return {
          canRead: true,
          canCreate: true,
          canEdit: true,
          canDelete: true,
          canComment: true,
          canAnalyze: true,
          canShare: true,
          canManageUsers: true,
          canExport: true,
          canImport: true,
          role: 'owner'
        };
      }

      // Admin users have elevated permissions
      if (userRole === 'admin') {
        return {
          canRead: true,
          canCreate: true,
          canEdit: true,
          canDelete: true,
          canComment: true,
          canAnalyze: true,
          canShare: true,
          canManageUsers: true,
          canExport: true,
          canImport: true,
          role: 'admin'
        };
      }

      // Role-based permissions
      let permissions = this.getRolePermissions(projectRole || 'viewer');

      // Apply custom permissions if any
      if (customPermissions) {
        permissions = { ...permissions, ...customPermissions };
      }

      return {
        ...permissions,
        role: projectRole || 'viewer'
      };

    } catch (error) {
      logger.error('Get user permissions error:', error);
      return this.getDefaultPermissions();
    }
  }

  private getRolePermissions(role: string): UserPermissions {
    switch (role) {
      case 'owner':
        return {
          canRead: true,
          canCreate: true,
          canEdit: true,
          canDelete: true,
          canComment: true,
          canAnalyze: true,
          canShare: true,
          canManageUsers: true,
          canExport: true,
          canImport: true,
          role: 'owner'
        };

      case 'editor':
        return {
          canRead: true,
          canCreate: true,
          canEdit: true,
          canDelete: false,
          canComment: true,
          canAnalyze: true,
          canShare: false,
          canManageUsers: false,
          canExport: true,
          canImport: false,
          role: 'editor'
        };

      case 'contributor':
        return {
          canRead: true,
          canCreate: true,
          canEdit: true,
          canDelete: false,
          canComment: true,
          canAnalyze: false,
          canShare: false,
          canManageUsers: false,
          canExport: false,
          canImport: false,
          role: 'contributor'
        };

      case 'reviewer':
        return {
          canRead: true,
          canCreate: false,
          canEdit: false,
          canDelete: false,
          canComment: true,
          canAnalyze: false,
          canShare: false,
          canManageUsers: false,
          canExport: false,
          canImport: false,
          role: 'reviewer'
        };

      case 'viewer':
      default:
        return {
          canRead: true,
          canCreate: false,
          canEdit: false,
          canDelete: false,
          canComment: false,
          canAnalyze: false,
          canShare: false,
          canManageUsers: false,
          canExport: false,
          canImport: false,
          role: 'viewer'
        };
    }
  }

  private getDefaultPermissions(): UserPermissions {
    return this.getRolePermissions('viewer');
  }

  async updateUserPermissions(
    userId: string,
    threatModelId: string,
    permissions: Partial<UserPermissions>
  ): Promise<boolean> {
    try {
      const result = await this.db.query(`
        UPDATE user_projects 
        SET permissions = $3
        WHERE user_id = $1 AND project_id = (
          SELECT project_id FROM threat_models WHERE id = $2
        )
      `, [userId, threatModelId, JSON.stringify(permissions)]);

      return result.rowCount > 0;
    } catch (error) {
      logger.error('Update user permissions error:', error);
      return false;
    }
  }

  async addUserToProject(
    userId: string,
    projectId: string,
    role: string,
    permissions?: Partial<UserPermissions>
  ): Promise<boolean> {
    try {
      const result = await this.db.query(`
        INSERT INTO user_projects (user_id, project_id, role, permissions, created_at)
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (user_id, project_id) DO UPDATE 
        SET role = $3, permissions = $4, updated_at = NOW()
      `, [userId, projectId, role, JSON.stringify(permissions)]);

      return result.rowCount > 0;
    } catch (error) {
      logger.error('Add user to project error:', error);
      return false;
    }
  }

  async removeUserFromProject(userId: string, projectId: string): Promise<boolean> {
    try {
      const result = await this.db.query(`
        DELETE FROM user_projects 
        WHERE user_id = $1 AND project_id = $2
      `, [userId, projectId]);

      return result.rowCount > 0;
    } catch (error) {
      logger.error('Remove user from project error:', error);
      return false;
    }
  }

  async getProjectUsers(projectId: string): Promise<Array<{
    userId: string;
    username: string;
    email: string;
    role: string;
    permissions: UserPermissions;
    joinedAt: Date;
  }>> {
    try {
      const result = await this.db.query(`
        SELECT 
          u.id as user_id,
          u.username,
          u.email,
          up.role,
          up.permissions,
          up.created_at as joined_at
        FROM user_projects up
        JOIN users u ON up.user_id = u.id
        WHERE up.project_id = $1
        ORDER BY up.created_at ASC
      `, [projectId]);

      return result.rows.map(row => ({
        userId: row.user_id,
        username: row.username,
        email: row.email,
        role: row.role,
        permissions: row.permissions ? JSON.parse(row.permissions) : this.getRolePermissions(row.role),
        joinedAt: row.joined_at
      }));
    } catch (error) {
      logger.error('Get project users error:', error);
      return [];
    }
  }

  async getUserProjects(userId: string): Promise<Array<{
    projectId: string;
    projectName: string;
    role: string;
    permissions: UserPermissions;
    joinedAt: Date;
  }>> {
    try {
      const result = await this.db.query(`
        SELECT 
          p.id as project_id,
          p.name as project_name,
          up.role,
          up.permissions,
          up.created_at as joined_at
        FROM user_projects up
        JOIN projects p ON up.project_id = p.id
        WHERE up.user_id = $1
        ORDER BY up.created_at DESC
      `, [userId]);

      return result.rows.map(row => ({
        projectId: row.project_id,
        projectName: row.project_name,
        role: row.role,
        permissions: row.permissions ? JSON.parse(row.permissions) : this.getRolePermissions(row.role),
        joinedAt: row.joined_at
      }));
    } catch (error) {
      logger.error('Get user projects error:', error);
      return [];
    }
  }

  async isProjectOwner(userId: string, projectId: string): Promise<boolean> {
    try {
      const result = await this.db.query(`
        SELECT 1 FROM projects WHERE id = $1 AND owner_id = $2
      `, [projectId, userId]);

      return result.rows.length > 0;
    } catch (error) {
      logger.error('Check project owner error:', error);
      return false;
    }
  }

  async canManagePermissions(userId: string, projectId: string): Promise<boolean> {
    try {
      const isOwner = await this.isProjectOwner(userId, projectId);
      if (isOwner) return true;

      const result = await this.db.query(`
        SELECT u.role FROM users u WHERE u.id = $1
      `, [userId]);

      return result.rows.length > 0 && result.rows[0].role === 'admin';
    } catch (error) {
      logger.error('Check manage permissions error:', error);
      return false;
    }
  }

  async logPermissionCheck(
    userId: string,
    threatModelId: string,
    action: string,
    granted: boolean
  ): Promise<void> {
    try {
      await this.db.query(`
        INSERT INTO permission_audit_log (
          user_id, threat_model_id, action, granted, timestamp
        ) VALUES ($1, $2, $3, $4, NOW())
      `, [userId, threatModelId, action, granted]);
    } catch (error) {
      logger.error('Log permission check error:', error);
    }
  }

  async getPermissionAuditLog(
    threatModelId: string,
    limit: number = 100
  ): Promise<Array<{
    userId: string;
    username: string;
    action: string;
    granted: boolean;
    timestamp: Date;
  }>> {
    try {
      const result = await this.db.query(`
        SELECT 
          pal.user_id,
          u.username,
          pal.action,
          pal.granted,
          pal.timestamp
        FROM permission_audit_log pal
        JOIN users u ON pal.user_id = u.id
        WHERE pal.threat_model_id = $1
        ORDER BY pal.timestamp DESC
        LIMIT $2
      `, [threatModelId, limit]);

      return result.rows.map(row => ({
        userId: row.user_id,
        username: row.username,
        action: row.action,
        granted: row.granted,
        timestamp: row.timestamp
      }));
    } catch (error) {
      logger.error('Get permission audit log error:', error);
      return [];
    }
  }
}