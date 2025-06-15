import { pool } from '../config/database';
import { logger } from '../utils/logger';

export class RefreshTokenService {
  async storeRefreshToken(userId: string, token: string): Promise<void> {
    try {
      await pool.query(`
        INSERT INTO refresh_tokens (user_id, token, created_at)
        VALUES ($1, $2, NOW())
      `, [userId, token]);
    } catch (error) {
      logger.error('Error storing refresh token:', error);
      throw error;
    }
  }

  async validateRefreshToken(userId: string, token: string): Promise<boolean> {
    try {
      const result = await pool.query(`
        SELECT id FROM refresh_tokens 
        WHERE user_id = $1 AND token = $2 AND revoked_at IS NULL
      `, [userId, token]);

      return result.rows.length > 0;
    } catch (error) {
      logger.error('Error validating refresh token:', error);
      throw error;
    }
  }

  async replaceRefreshToken(userId: string, oldToken: string, newToken: string): Promise<void> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Revoke old token
      await client.query(`
        UPDATE refresh_tokens 
        SET revoked_at = NOW() 
        WHERE user_id = $1 AND token = $2
      `, [userId, oldToken]);

      // Store new token
      await client.query(`
        INSERT INTO refresh_tokens (user_id, token, created_at)
        VALUES ($1, $2, NOW())
      `, [userId, newToken]);

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error replacing refresh token:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async revokeRefreshToken(userId: string, token: string): Promise<void> {
    try {
      await pool.query(`
        UPDATE refresh_tokens 
        SET revoked_at = NOW() 
        WHERE user_id = $1 AND token = $2
      `, [userId, token]);
    } catch (error) {
      logger.error('Error revoking refresh token:', error);
      throw error;
    }
  }

  async revokeAllRefreshTokens(userId: string): Promise<void> {
    try {
      await pool.query(`
        UPDATE refresh_tokens 
        SET revoked_at = NOW() 
        WHERE user_id = $1 AND revoked_at IS NULL
      `, [userId]);
    } catch (error) {
      logger.error('Error revoking all refresh tokens:', error);
      throw error;
    }
  }

  async cleanupExpiredTokens(): Promise<void> {
    try {
      // Remove tokens older than 30 days
      await pool.query(`
        DELETE FROM refresh_tokens 
        WHERE created_at < NOW() - INTERVAL '30 days'
      `);
      
      logger.info('Expired refresh tokens cleaned up');
    } catch (error) {
      logger.error('Error cleaning up expired tokens:', error);
      throw error;
    }
  }
}