import { Pool, PoolClient } from 'pg';
import { config } from '../config';
import { logger } from '../utils/logger';
import { 
  FileMetadata, 
  FileSearchQuery, 
  FileStats, 
  FileShare, 
  FileVersion, 
  FileAccess, 
  StorageQuota,
  FileOperation 
} from '../types';

export class DatabaseService {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: config.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.pool.on('error', (err) => {
      logger.error('Database pool error:', err);
    });
  }

  async initialize(): Promise<void> {
    try {
      await this.createTables();
      logger.info('Database initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize database:', error);
      throw error;
    }
  }

  private async createTables(): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // Files table
      await client.query(`
        CREATE TABLE IF NOT EXISTS files (
          id VARCHAR(36) PRIMARY KEY,
          original_name VARCHAR(255) NOT NULL,
          filename VARCHAR(255) NOT NULL,
          mime_type VARCHAR(100) NOT NULL,
          size BIGINT NOT NULL,
          path TEXT NOT NULL,
          bucket VARCHAR(100),
          key TEXT,
          checksum VARCHAR(64) NOT NULL,
          user_id VARCHAR(36) NOT NULL,
          project_id VARCHAR(36),
          threat_model_id VARCHAR(36),
          is_public BOOLEAN DEFAULT FALSE,
          tags TEXT[] DEFAULT '{}',
          description TEXT,
          version INTEGER DEFAULT 1,
          parent_id VARCHAR(36),
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          deleted_at TIMESTAMP WITH TIME ZONE
        )
      `);

      // File shares table
      await client.query(`
        CREATE TABLE IF NOT EXISTS file_shares (
          id VARCHAR(36) PRIMARY KEY,
          file_id VARCHAR(36) NOT NULL REFERENCES files(id) ON DELETE CASCADE,
          share_token VARCHAR(255) UNIQUE NOT NULL,
          expires_at TIMESTAMP WITH TIME ZONE,
          download_count INTEGER DEFAULT 0,
          max_downloads INTEGER,
          password_hash VARCHAR(255),
          allowed_emails TEXT[],
          created_by VARCHAR(36) NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);

      // File versions table
      await client.query(`
        CREATE TABLE IF NOT EXISTS file_versions (
          id VARCHAR(36) PRIMARY KEY,
          file_id VARCHAR(36) NOT NULL REFERENCES files(id) ON DELETE CASCADE,
          version INTEGER NOT NULL,
          filename VARCHAR(255) NOT NULL,
          size BIGINT NOT NULL,
          checksum VARCHAR(64) NOT NULL,
          changes TEXT,
          storage_key TEXT NOT NULL,
          created_by VARCHAR(36) NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);

      // File access table
      await client.query(`
        CREATE TABLE IF NOT EXISTS file_access (
          file_id VARCHAR(36) NOT NULL REFERENCES files(id) ON DELETE CASCADE,
          user_id VARCHAR(36) NOT NULL,
          permission VARCHAR(20) NOT NULL CHECK (permission IN ('read', 'write', 'delete', 'share')),
          granted_by VARCHAR(36) NOT NULL,
          granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          expires_at TIMESTAMP WITH TIME ZONE,
          PRIMARY KEY (file_id, user_id, permission)
        )
      `);

      // Storage quotas table
      await client.query(`
        CREATE TABLE IF NOT EXISTS storage_quotas (
          user_id VARCHAR(36) PRIMARY KEY,
          total_quota BIGINT NOT NULL,
          used_space BIGINT DEFAULT 0,
          file_count INTEGER DEFAULT 0,
          last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);

      // File operations table
      await client.query(`
        CREATE TABLE IF NOT EXISTS file_operations (
          id VARCHAR(36) PRIMARY KEY,
          file_id VARCHAR(36) REFERENCES files(id) ON DELETE SET NULL,
          operation VARCHAR(20) NOT NULL CHECK (operation IN ('upload', 'download', 'delete', 'share', 'process')),
          status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
          progress INTEGER DEFAULT 0,
          error TEXT,
          user_id VARCHAR(36) NOT NULL,
          metadata JSONB DEFAULT '{}',
          started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          completed_at TIMESTAMP WITH TIME ZONE
        )
      `);

      // Create indexes
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_files_user_id ON files(user_id);
        CREATE INDEX IF NOT EXISTS idx_files_project_id ON files(project_id);
        CREATE INDEX IF NOT EXISTS idx_files_threat_model_id ON files(threat_model_id);
        CREATE INDEX IF NOT EXISTS idx_files_mime_type ON files(mime_type);
        CREATE INDEX IF NOT EXISTS idx_files_created_at ON files(created_at);
        CREATE INDEX IF NOT EXISTS idx_files_deleted_at ON files(deleted_at);
        CREATE INDEX IF NOT EXISTS idx_files_tags ON files USING GIN(tags);
        CREATE INDEX IF NOT EXISTS idx_files_metadata ON files USING GIN(metadata);
        CREATE INDEX IF NOT EXISTS idx_file_shares_token ON file_shares(share_token);
        CREATE INDEX IF NOT EXISTS idx_file_shares_expires_at ON file_shares(expires_at);
        CREATE INDEX IF NOT EXISTS idx_file_versions_file_id ON file_versions(file_id);
        CREATE INDEX IF NOT EXISTS idx_file_access_user_id ON file_access(user_id);
        CREATE INDEX IF NOT EXISTS idx_storage_quotas_last_updated ON storage_quotas(last_updated);
        CREATE INDEX IF NOT EXISTS idx_file_operations_user_id ON file_operations(user_id);
        CREATE INDEX IF NOT EXISTS idx_file_operations_status ON file_operations(status);
      `);

      await client.query('COMMIT');
      logger.info('Database tables created successfully');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // File metadata operations
  async createFile(metadata: Omit<FileMetadata, 'createdAt' | 'updatedAt'>): Promise<FileMetadata> {
    const client = await this.pool.connect();
    
    try {
      const result = await client.query(
        `INSERT INTO files (
          id, original_name, filename, mime_type, size, path, bucket, key,
          checksum, user_id, project_id, threat_model_id, is_public,
          tags, description, version, parent_id, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        RETURNING *, created_at, updated_at`,
        [
          metadata.id, metadata.originalName, metadata.filename, metadata.mimeType,
          metadata.size, metadata.path, metadata.bucket, metadata.key,
          metadata.checksum, metadata.userId, metadata.projectId, metadata.threatModelId,
          metadata.isPublic, metadata.tags, metadata.description, metadata.version,
          metadata.parentId, JSON.stringify({})
        ]
      );

      return this.mapRowToFileMetadata(result.rows[0]);
    } finally {
      client.release();
    }
  }

  async getFile(id: string): Promise<FileMetadata | null> {
    const client = await this.pool.connect();
    
    try {
      const result = await client.query(
        'SELECT * FROM files WHERE id = $1 AND deleted_at IS NULL',
        [id]
      );

      return result.rows[0] ? this.mapRowToFileMetadata(result.rows[0]) : null;
    } finally {
      client.release();
    }
  }

  async searchFiles(query: FileSearchQuery): Promise<{ files: FileMetadata[]; total: number }> {
    const client = await this.pool.connect();
    
    try {
      let whereConditions = ['deleted_at IS NULL'];
      let params: any[] = [];
      let paramIndex = 1;

      // Build where conditions
      if (query.query) {
        whereConditions.push(`(original_name ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`);
        params.push(`%${query.query}%`);
        paramIndex++;
      }

      if (query.mimeType) {
        whereConditions.push(`mime_type = $${paramIndex}`);
        params.push(query.mimeType);
        paramIndex++;
      }

      if (query.tags && query.tags.length > 0) {
        whereConditions.push(`tags && $${paramIndex}`);
        params.push(query.tags);
        paramIndex++;
      }

      if (query.projectId) {
        whereConditions.push(`project_id = $${paramIndex}`);
        params.push(query.projectId);
        paramIndex++;
      }

      if (query.threatModelId) {
        whereConditions.push(`threat_model_id = $${paramIndex}`);
        params.push(query.threatModelId);
        paramIndex++;
      }

      if (query.userId) {
        whereConditions.push(`user_id = $${paramIndex}`);
        params.push(query.userId);
        paramIndex++;
      }

      if (query.isPublic !== undefined) {
        whereConditions.push(`is_public = $${paramIndex}`);
        params.push(query.isPublic);
        paramIndex++;
      }

      if (query.size) {
        if (query.size.min) {
          whereConditions.push(`size >= $${paramIndex}`);
          params.push(query.size.min);
          paramIndex++;
        }
        if (query.size.max) {
          whereConditions.push(`size <= $${paramIndex}`);
          params.push(query.size.max);
          paramIndex++;
        }
      }

      if (query.createdAt) {
        if (query.createdAt.from) {
          whereConditions.push(`created_at >= $${paramIndex}`);
          params.push(query.createdAt.from);
          paramIndex++;
        }
        if (query.createdAt.to) {
          whereConditions.push(`created_at <= $${paramIndex}`);
          params.push(query.createdAt.to);
          paramIndex++;
        }
      }

      const whereClause = whereConditions.join(' AND ');
      const sortBy = query.sortBy || 'created_at';
      const sortOrder = query.sortOrder || 'desc';
      const limit = query.limit || 50;
      const offset = query.offset || 0;

      // Get total count
      const countResult = await client.query(
        `SELECT COUNT(*) FROM files WHERE ${whereClause}`,
        params
      );

      // Get files
      const filesResult = await client.query(
        `SELECT * FROM files WHERE ${whereClause} 
         ORDER BY ${sortBy} ${sortOrder.toUpperCase()}
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...params, limit, offset]
      );

      return {
        files: filesResult.rows.map(row => this.mapRowToFileMetadata(row)),
        total: parseInt(countResult.rows[0].count),
      };
    } finally {
      client.release();
    }
  }

  async updateFile(id: string, updates: Partial<FileMetadata>): Promise<FileMetadata | null> {
    const client = await this.pool.connect();
    
    try {
      const setFields: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      Object.entries(updates).forEach(([key, value]) => {
        if (value !== undefined && key !== 'id' && key !== 'createdAt') {
          const dbField = this.camelToSnake(key);
          setFields.push(`${dbField} = $${paramIndex}`);
          params.push(value);
          paramIndex++;
        }
      });

      if (setFields.length === 0) {
        return await this.getFile(id);
      }

      setFields.push(`updated_at = NOW()`);
      params.push(id);

      const result = await client.query(
        `UPDATE files SET ${setFields.join(', ')} WHERE id = $${paramIndex} AND deleted_at IS NULL
         RETURNING *`,
        params
      );

      return result.rows[0] ? this.mapRowToFileMetadata(result.rows[0]) : null;
    } finally {
      client.release();
    }
  }

  async deleteFile(id: string, userId: string): Promise<boolean> {
    const client = await this.pool.connect();
    
    try {
      const result = await client.query(
        'UPDATE files SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
        [id, userId]
      );

      return result.rowCount > 0;
    } finally {
      client.release();
    }
  }

  // File share operations
  async createShare(share: Omit<FileShare, 'createdAt'>): Promise<FileShare> {
    const client = await this.pool.connect();
    
    try {
      const result = await client.query(
        `INSERT INTO file_shares (
          id, file_id, share_token, expires_at, max_downloads, password_hash, allowed_emails, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *, created_at`,
        [
          share.id, share.fileId, share.shareToken, share.expiresAt,
          share.maxDownloads, share.password, share.allowedEmails, share.createdBy
        ]
      );

      return this.mapRowToFileShare(result.rows[0]);
    } finally {
      client.release();
    }
  }

  async getShareByToken(token: string): Promise<FileShare | null> {
    const client = await this.pool.connect();
    
    try {
      const result = await client.query(
        'SELECT * FROM file_shares WHERE share_token = $1 AND (expires_at IS NULL OR expires_at > NOW())',
        [token]
      );

      return result.rows[0] ? this.mapRowToFileShare(result.rows[0]) : null;
    } finally {
      client.release();
    }
  }

  // Storage quota operations
  async getStorageQuota(userId: string): Promise<StorageQuota | null> {
    const client = await this.pool.connect();
    
    try {
      const result = await client.query(
        'SELECT * FROM storage_quotas WHERE user_id = $1',
        [userId]
      );

      return result.rows[0] ? this.mapRowToStorageQuota(result.rows[0]) : null;
    } finally {
      client.release();
    }
  }

  async updateStorageQuota(userId: string, sizeChange: number, fileCountChange: number = 0): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query(
        `INSERT INTO storage_quotas (user_id, total_quota, used_space, file_count, last_updated)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (user_id) 
         DO UPDATE SET 
           used_space = storage_quotas.used_space + $3,
           file_count = storage_quotas.file_count + $4,
           last_updated = NOW()`,
        [userId, config.DEFAULT_USER_QUOTA, sizeChange, fileCountChange]
      );
    } finally {
      client.release();
    }
  }

  // File statistics
  async getFileStats(userId?: string): Promise<FileStats> {
    const client = await this.pool.connect();
    
    try {
      let whereClause = 'WHERE deleted_at IS NULL';
      let params: any[] = [];
      
      if (userId) {
        whereClause += ' AND user_id = $1';
        params = [userId];
      }

      // Total files and size
      const totalResult = await client.query(
        `SELECT COUNT(*) as total_files, COALESCE(SUM(size), 0) as total_size
         FROM files ${whereClause}`,
        params
      );

      // Files by type
      const typeResult = await client.query(
        `SELECT mime_type, COUNT(*) as count, COALESCE(SUM(size), 0) as size
         FROM files ${whereClause}
         GROUP BY mime_type
         ORDER BY count DESC`,
        params
      );

      // Upload trend (last 30 days)
      const trendResult = await client.query(
        `SELECT DATE(created_at) as date, COUNT(*) as count, COALESCE(SUM(size), 0) as size
         FROM files ${whereClause} AND created_at >= NOW() - INTERVAL '30 days'
         GROUP BY DATE(created_at)
         ORDER BY date`,
        params
      );

      const totalFiles = parseInt(totalResult.rows[0].total_files);
      const totalSize = parseInt(totalResult.rows[0].total_size);

      return {
        totalFiles,
        totalSize,
        filesByType: Object.fromEntries(
          typeResult.rows.map(row => [row.mime_type, parseInt(row.count)])
        ),
        sizeByType: Object.fromEntries(
          typeResult.rows.map(row => [row.mime_type, parseInt(row.size)])
        ),
        avgFileSize: totalFiles > 0 ? totalSize / totalFiles : 0,
        uploadTrend: trendResult.rows.map(row => ({
          date: row.date,
          count: parseInt(row.count),
          size: parseInt(row.size),
        })),
      };
    } finally {
      client.release();
    }
  }

  private mapRowToFileMetadata(row: any): FileMetadata {
    return {
      id: row.id,
      originalName: row.original_name,
      filename: row.filename,
      mimeType: row.mime_type,
      size: parseInt(row.size),
      path: row.path,
      bucket: row.bucket,
      key: row.key,
      checksum: row.checksum,
      userId: row.user_id,
      projectId: row.project_id,
      threatModelId: row.threat_model_id,
      isPublic: row.is_public,
      tags: row.tags || [],
      description: row.description,
      version: row.version,
      parentId: row.parent_id,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      deletedAt: row.deleted_at ? new Date(row.deleted_at) : undefined,
    };
  }

  private mapRowToFileShare(row: any): FileShare {
    return {
      id: row.id,
      fileId: row.file_id,
      shareToken: row.share_token,
      expiresAt: row.expires_at ? new Date(row.expires_at) : undefined,
      downloadCount: row.download_count,
      maxDownloads: row.max_downloads,
      password: row.password_hash,
      allowedEmails: row.allowed_emails,
      createdBy: row.created_by,
      createdAt: new Date(row.created_at),
    };
  }

  private mapRowToStorageQuota(row: any): StorageQuota {
    return {
      userId: row.user_id,
      totalQuota: parseInt(row.total_quota),
      usedSpace: parseInt(row.used_space),
      fileCount: row.file_count,
      lastUpdated: new Date(row.last_updated),
    };
  }

  private camelToSnake(str: string): string {
    return str.replace(/([A-Z])/g, '_$1').toLowerCase();
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

// Export singleton instance
export const databaseService = new DatabaseService();