import { query, withTransaction } from '../database';
import { 
  Collaborator, 
  CollaboratorRole, 
  CollaboratorPermission
} from '../types';
import { logger, auditLogger } from '../utils/logger';
import { isValidUUID } from '../utils/helpers';

export interface AddCollaboratorDto {
  userId: string;
  role: CollaboratorRole;
  permissions?: CollaboratorPermission[];
}

export interface UpdateCollaboratorDto {
  role?: CollaboratorRole;
  permissions?: CollaboratorPermission[];
}

export class CollaborationService {
  async addCollaborator(
    projectId: string,
    data: AddCollaboratorDto,
    invitedById: string
  ): Promise<Collaborator> {
    if (!isValidUUID(data.userId)) {
      throw new Error('Invalid user ID');
    }

    // Check if user already exists as collaborator
    const existing = await this.getCollaborator(projectId, data.userId);
    if (existing) {
      throw new Error('User is already a collaborator on this project');
    }

    // Verify user exists
    const userResult = await query(
      'SELECT id FROM auth.users WHERE id = $1',
      [data.userId]
    );
    if (userResult.rows.length === 0) {
      throw new Error('User not found');
    }

    // Default permissions based on role
    const defaultPermissions = this.getDefaultPermissions(data.role);
    const permissions = data.permissions || defaultPermissions;

    const result = await query(
      `INSERT INTO projects.collaborators (
        user_id, project_id, role, permissions, invited_by_id
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *`,
      [
        data.userId,
        projectId,
        data.role,
        JSON.stringify(permissions),
        invitedById,
      ]
    );

    const collaborator = this.mapCollaboratorRow(result.rows[0]);

    // Log audit event
    auditLogger.collaboratorAdded(invitedById, projectId, data.userId, data.role);

    return collaborator;
  }

  async updateCollaborator(
    projectId: string,
    userId: string,
    data: UpdateCollaboratorDto,
    updatedById: string
  ): Promise<Collaborator> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCounter = 1;

    if (data.role !== undefined) {
      fields.push(`role = $${paramCounter++}`);
      values.push(data.role);

      // Update permissions to match new role if not explicitly provided
      if (data.permissions === undefined) {
        const defaultPermissions = this.getDefaultPermissions(data.role);
        fields.push(`permissions = $${paramCounter++}`);
        values.push(JSON.stringify(defaultPermissions));
      }
    }
    if (data.permissions !== undefined) {
      fields.push(`permissions = $${paramCounter++}`);
      values.push(JSON.stringify(data.permissions));
    }

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    values.push(projectId, userId);

    const result = await query(
      `UPDATE projects.collaborators 
       SET ${fields.join(', ')}
       WHERE project_id = $${paramCounter++} AND user_id = $${paramCounter}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      throw new Error('Collaborator not found');
    }

    const collaborator = this.mapCollaboratorRow(result.rows[0]);

    // Log audit event
    auditLogger.collaboratorAdded(updatedById, projectId, userId, data.role || collaborator.role);

    return collaborator;
  }

  async removeCollaborator(
    projectId: string,
    userId: string,
    removedById: string
  ): Promise<void> {
    const result = await query(
      'DELETE FROM projects.collaborators WHERE project_id = $1 AND user_id = $2',
      [projectId, userId]
    );

    if (result.rowCount === 0) {
      throw new Error('Collaborator not found');
    }

    // Log audit event
    auditLogger.collaboratorRemoved(removedById, projectId, userId);
  }

  async getCollaborator(projectId: string, userId: string): Promise<Collaborator | null> {
    const result = await query(
      `SELECT c.*, 
              u.email,
              u.first_name,
              u.last_name,
              ib.email as invited_by_email,
              ib.first_name as invited_by_first_name,
              ib.last_name as invited_by_last_name
       FROM projects.collaborators c
       LEFT JOIN auth.users u ON c.user_id = u.id
       LEFT JOIN auth.users ib ON c.invited_by_id = ib.id
       WHERE c.project_id = $1 AND c.user_id = $2`,
      [projectId, userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapCollaboratorRowWithJoins(result.rows[0]);
  }

  async listCollaborators(projectId: string): Promise<Collaborator[]> {
    const result = await query(
      `SELECT c.*, 
              u.email,
              u.first_name,
              u.last_name,
              ib.email as invited_by_email,
              ib.first_name as invited_by_first_name,
              ib.last_name as invited_by_last_name
       FROM projects.collaborators c
       LEFT JOIN auth.users u ON c.user_id = u.id
       LEFT JOIN auth.users ib ON c.invited_by_id = ib.id
       WHERE c.project_id = $1
       ORDER BY c.invited_at DESC`,
      [projectId]
    );

    return result.rows.map(row => this.mapCollaboratorRowWithJoins(row));
  }

  async hasPermission(
    projectId: string,
    userId: string,
    permission: CollaboratorPermission
  ): Promise<boolean> {
    // Check if user is project owner (has all permissions)
    const ownerResult = await query(
      'SELECT 1 FROM projects.projects WHERE id = $1 AND owner_id = $2',
      [projectId, userId]
    );
    if (ownerResult.rows.length > 0) {
      return true;
    }

    // Check collaborator permissions
    const result = await query(
      'SELECT permissions FROM projects.collaborators WHERE project_id = $1 AND user_id = $2',
      [projectId, userId]
    );

    if (result.rows.length === 0) {
      return false;
    }

    const permissions = JSON.parse(result.rows[0].permissions || '[]');
    return permissions.includes(permission);
  }

  async getUserRole(projectId: string, userId: string): Promise<CollaboratorRole | null> {
    // Check if user is project owner
    const ownerResult = await query(
      'SELECT 1 FROM projects.projects WHERE id = $1 AND owner_id = $2',
      [projectId, userId]
    );
    if (ownerResult.rows.length > 0) {
      return CollaboratorRole.OWNER;
    }

    // Check collaborator role
    const result = await query(
      'SELECT role FROM projects.collaborators WHERE project_id = $1 AND user_id = $2',
      [projectId, userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0].role as CollaboratorRole;
  }

  async updateLastActive(projectId: string, userId: string): Promise<void> {
    await query(
      `UPDATE projects.collaborators 
       SET last_active_at = CURRENT_TIMESTAMP
       WHERE project_id = $1 AND user_id = $2`,
      [projectId, userId]
    );
  }

  async acceptInvitation(projectId: string, userId: string): Promise<void> {
    const result = await query(
      `UPDATE projects.collaborators 
       SET joined_at = CURRENT_TIMESTAMP
       WHERE project_id = $1 AND user_id = $2 AND joined_at IS NULL
       RETURNING *`,
      [projectId, userId]
    );

    if (result.rowCount === 0) {
      throw new Error('Invitation not found or already accepted');
    }
  }

  private getDefaultPermissions(role: CollaboratorRole): CollaboratorPermission[] {
    switch (role) {
      case CollaboratorRole.OWNER:
        return [
          CollaboratorPermission.READ,
          CollaboratorPermission.WRITE,
          CollaboratorPermission.COMMENT,
          CollaboratorPermission.REVIEW,
          CollaboratorPermission.APPROVE,
          CollaboratorPermission.MANAGE_COLLABORATORS,
          CollaboratorPermission.DELETE,
        ];
      case CollaboratorRole.ADMIN:
        return [
          CollaboratorPermission.READ,
          CollaboratorPermission.WRITE,
          CollaboratorPermission.COMMENT,
          CollaboratorPermission.REVIEW,
          CollaboratorPermission.APPROVE,
          CollaboratorPermission.MANAGE_COLLABORATORS,
        ];
      case CollaboratorRole.EDITOR:
        return [
          CollaboratorPermission.READ,
          CollaboratorPermission.WRITE,
          CollaboratorPermission.COMMENT,
        ];
      case CollaboratorRole.REVIEWER:
        return [
          CollaboratorPermission.READ,
          CollaboratorPermission.COMMENT,
          CollaboratorPermission.REVIEW,
          CollaboratorPermission.APPROVE,
        ];
      case CollaboratorRole.VIEWER:
        return [
          CollaboratorPermission.READ,
          CollaboratorPermission.COMMENT,
        ];
      default:
        return [CollaboratorPermission.READ];
    }
  }

  private mapCollaboratorRow(row: any): Collaborator {
    return {
      userId: row.user_id,
      projectId: row.project_id,
      role: row.role as CollaboratorRole,
      permissions: JSON.parse(row.permissions || '[]'),
      invitedAt: row.invited_at,
      invitedById: row.invited_by_id,
      joinedAt: row.joined_at,
      lastActiveAt: row.last_active_at,
    };
  }

  private mapCollaboratorRowWithJoins(row: any): Collaborator & {
    userEmail?: string;
    userName?: string;
    invitedByEmail?: string;
    invitedByName?: string;
  } {
    const collaborator = this.mapCollaboratorRow(row);
    const userName = [row.first_name, row.last_name].filter(Boolean).join(' ');
    const invitedByName = [row.invited_by_first_name, row.invited_by_last_name].filter(Boolean).join(' ');
    return {
      ...collaborator,
      userEmail: row.email || undefined,
      userName: userName || undefined,
      invitedByEmail: row.invited_by_email || undefined,
      invitedByName: invitedByName || undefined,
    };
  }
}