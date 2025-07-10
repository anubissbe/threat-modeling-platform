import { Pool } from 'pg';
import { pool } from '../config/database';
import { logger } from '../utils/logger';
import { 
  ActivityLog, 
  CreateActivityRequest, 
  ActivityFilters,
  ActivityStatistics,
  ActivityType
} from '../types/activity';
import { v4 as uuidv4 } from 'uuid';

export class ActivityService {
  
  constructor(private db: Pool = pool) {}

  async createActivity(
    userId: string, 
    organizationId: string, 
    data: CreateActivityRequest
  ): Promise<ActivityLog> {
    const client = await this.db.connect();
    
    try {
      const activityId = uuidv4();
      const now = new Date();
      
      // Get user information for the activity
      const userQuery = `
        SELECT first_name, last_name, email FROM users WHERE id = $1
      `;
      const userResult = await client.query(userQuery, [userId]);
      const user = userResult.rows[0];
      
      const query = `
        INSERT INTO activity_logs (
          id, type, action, description, entity_type, entity_id, entity_name,
          metadata, user_id, user_name, user_email, organization_id,
          ip_address, user_agent, created_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
        ) RETURNING *
      `;
      
      const userName = user ? `${user.first_name} ${user.last_name}`.trim() : 'Unknown User';
      
      const values = [
        activityId,
        data.type,
        data.action,
        data.description,
        data.entityType,
        data.entityId,
        data.entityName || null,
        JSON.stringify(data.metadata || {}),
        userId,
        userName,
        user?.email || null,
        organizationId,
        data.ipAddress || null,
        data.userAgent || null,
        now
      ];
      
      const result = await client.query(query, values);
      
      logger.info(`Created activity log: ${activityId}`, { 
        type: data.type, 
        entityType: data.entityType, 
        entityId: data.entityId,
        userId, 
        organizationId 
      });
      
      return this.mapRowToActivity(result.rows[0]);
    } finally {
      client.release();
    }
  }

  async getActivities(
    userId: string, 
    organizationId: string, 
    filters: ActivityFilters = {}
  ): Promise<{ activities: ActivityLog[]; total: number }> {
    const client = await this.db.connect();
    
    try {
      let whereConditions = ['organization_id = $1'];
      let queryParams: any[] = [organizationId];
      let paramIndex = 2;
      
      // Add filters
      if (filters.type) {
        whereConditions.push(`type = $${paramIndex}`);
        queryParams.push(filters.type);
        paramIndex++;
      }
      
      if (filters.entityType) {
        whereConditions.push(`entity_type = $${paramIndex}`);
        queryParams.push(filters.entityType);
        paramIndex++;
      }
      
      if (filters.entityId) {
        whereConditions.push(`entity_id = $${paramIndex}`);
        queryParams.push(filters.entityId);
        paramIndex++;
      }
      
      if (filters.userId) {
        whereConditions.push(`user_id = $${paramIndex}`);
        queryParams.push(filters.userId);
        paramIndex++;
      }
      
      if (filters.startDate) {
        whereConditions.push(`created_at >= $${paramIndex}`);
        queryParams.push(filters.startDate);
        paramIndex++;
      }
      
      if (filters.endDate) {
        whereConditions.push(`created_at <= $${paramIndex}`);
        queryParams.push(filters.endDate);
        paramIndex++;
      }
      
      const whereClause = whereConditions.join(' AND ');
      
      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total 
        FROM activity_logs 
        WHERE ${whereClause}
      `;
      
      const countResult = await client.query(countQuery, queryParams);
      const total = parseInt(countResult.rows[0].total);
      
      // Get activities with pagination
      const limit = filters.limit || 50;
      const offset = filters.offset || 0;
      
      const query = `
        SELECT *
        FROM activity_logs
        WHERE ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
      
      queryParams.push(limit, offset);
      
      const result = await client.query(query, queryParams);
      
      const activities = result.rows.map(row => this.mapRowToActivity(row));
      
      return { activities, total };
    } finally {
      client.release();
    }
  }

  async getRecentActivity(
    userId: string, 
    organizationId: string, 
    limit: number = 20
  ): Promise<ActivityLog[]> {
    const result = await this.getActivities(userId, organizationId, { 
      limit,
      offset: 0 
    });
    return result.activities;
  }

  async getActivityStatistics(
    organizationId: string,
    days: number = 30
  ): Promise<ActivityStatistics> {
    const client = await this.db.connect();
    
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      
      // Get overall statistics
      const statsQuery = `
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN created_at >= NOW() - INTERVAL '1 day' THEN 1 END) as today,
          COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as week,
          COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as month
        FROM activity_logs 
        WHERE organization_id = $1 AND created_at >= $2
      `;
      
      const statsResult = await client.query(statsQuery, [organizationId, startDate]);
      const stats = statsResult.rows[0];
      
      // Get activity by type
      const typeQuery = `
        SELECT type, COUNT(*) as count
        FROM activity_logs
        WHERE organization_id = $1 AND created_at >= $2
        GROUP BY type
        ORDER BY count DESC
      `;
      
      const typeResult = await client.query(typeQuery, [organizationId, startDate]);
      const byType: { [key in ActivityType]?: number } = {};
      typeResult.rows.forEach(row => {
        byType[row.type as ActivityType] = parseInt(row.count);
      });
      
      // Get activity by entity type
      const entityQuery = `
        SELECT entity_type, COUNT(*) as count
        FROM activity_logs
        WHERE organization_id = $1 AND created_at >= $2
        GROUP BY entity_type
      `;
      
      const entityResult = await client.query(entityQuery, [organizationId, startDate]);
      const byEntityType = {
        project: 0,
        threat_model: 0,
        vulnerability: 0,
        user: 0,
        organization: 0,
        system: 0
      };
      
      entityResult.rows.forEach(row => {
        if (byEntityType.hasOwnProperty(row.entity_type)) {
          byEntityType[row.entity_type as keyof typeof byEntityType] = parseInt(row.count);
        }
      });
      
      // Get most active users
      const userQuery = `
        SELECT user_id, user_name, COUNT(*) as activity_count
        FROM activity_logs
        WHERE organization_id = $1 AND created_at >= $2
        GROUP BY user_id, user_name
        ORDER BY activity_count DESC
        LIMIT 10
      `;
      
      const userResult = await client.query(userQuery, [organizationId, startDate]);
      const mostActiveUsers = userResult.rows.map(row => ({
        userId: row.user_id,
        userName: row.user_name || 'Unknown User',
        activityCount: parseInt(row.activity_count)
      }));
      
      // Get recent trends (daily activity for the last 7 days)
      const trendsQuery = `
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as count
        FROM activity_logs
        WHERE organization_id = $1 AND created_at >= NOW() - INTERVAL '7 days'
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `;
      
      const trendsResult = await client.query(trendsQuery, [organizationId]);
      const recentTrends = trendsResult.rows.map(row => ({
        date: row.date,
        count: parseInt(row.count)
      }));
      
      return {
        totalActivities: parseInt(stats.total),
        todayActivities: parseInt(stats.today),
        weekActivities: parseInt(stats.week),
        monthActivities: parseInt(stats.month),
        byType,
        byEntityType,
        mostActiveUsers,
        recentTrends
      };
    } finally {
      client.release();
    }
  }

  async deleteOldActivities(daysToKeep: number = 90): Promise<number> {
    const client = await this.db.connect();
    
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
      
      const query = `
        DELETE FROM activity_logs 
        WHERE created_at < $1
      `;
      
      const result = await client.query(query, [cutoffDate]);
      
      logger.info(`Deleted ${result.rowCount} old activity logs`, { 
        cutoffDate, 
        daysToKeep 
      });
      
      return result.rowCount || 0;
    } finally {
      client.release();
    }
  }

  private mapRowToActivity(row: any): ActivityLog {
    const safeJsonParse = (value: any, defaultValue: any = {}) => {
      if (!value || value === null || value === undefined) return defaultValue;
      try {
        return JSON.parse(value);
      } catch (error) {
        return defaultValue;
      }
    };

    return {
      id: row.id,
      type: row.type,
      action: row.action,
      description: row.description,
      entityType: row.entity_type,
      entityId: row.entity_id,
      entityName: row.entity_name,
      metadata: safeJsonParse(row.metadata, {}),
      userId: row.user_id,
      userName: row.user_name,
      userEmail: row.user_email,
      organizationId: row.organization_id,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      createdAt: row.created_at
    };
  }
}