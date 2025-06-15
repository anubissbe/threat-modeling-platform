import { pool } from '../config/database';
import { User, UserRole, RegisterRequest } from '../types/auth';
import { hashPassword } from '../utils/password';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export class UserService {
  async createUser(userData: RegisterRequest): Promise<User> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Check if user already exists
      const existingUser = await client.query(
        'SELECT id FROM users WHERE email = $1',
        [userData.email]
      );

      if (existingUser.rows.length > 0) {
        throw new Error('User with this email already exists');
      }

      const hashedPassword = await hashPassword(userData.password);
      const userId = uuidv4();

      const result = await client.query(`
        INSERT INTO users (
          id, email, password_hash, first_name, last_name, 
          role, organization, is_active, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
        RETURNING id, email, first_name, last_name, role, organization, 
                  is_active, created_at, updated_at
      `, [
        userId,
        userData.email,
        hashedPassword,
        userData.firstName,
        userData.lastName,
        UserRole.VIEWER, // Default role
        userData.organization,
        true
      ]);

      await client.query('COMMIT');

      const user = this.mapRowToUser(result.rows[0]);
      logger.info(`User created successfully: ${user.email}`);
      
      return user;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error creating user:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async getUserByEmail(email: string): Promise<User | null> {
    try {
      const result = await pool.query(`
        SELECT id, email, first_name, last_name, role, organization, 
               is_active, last_login, created_at, updated_at
        FROM users 
        WHERE email = $1 AND is_active = true
      `, [email]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToUser(result.rows[0]);
    } catch (error) {
      logger.error('Error fetching user by email:', error);
      throw error;
    }
  }

  async getUserById(id: string): Promise<User | null> {
    try {
      const result = await pool.query(`
        SELECT id, email, first_name, last_name, role, organization, 
               is_active, last_login, created_at, updated_at
        FROM users 
        WHERE id = $1 AND is_active = true
      `, [id]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToUser(result.rows[0]);
    } catch (error) {
      logger.error('Error fetching user by ID:', error);
      throw error;
    }
  }

  async getUserPasswordHash(email: string): Promise<string | null> {
    try {
      const result = await pool.query(
        'SELECT password_hash FROM users WHERE email = $1 AND is_active = true',
        [email]
      );

      return result.rows.length > 0 ? result.rows[0].password_hash : null;
    } catch (error) {
      logger.error('Error fetching user password hash:', error);
      throw error;
    }
  }

  async updateLastLogin(userId: string): Promise<void> {
    try {
      await pool.query(
        'UPDATE users SET last_login = NOW() WHERE id = $1',
        [userId]
      );
    } catch (error) {
      logger.error('Error updating last login:', error);
      throw error;
    }
  }

  async updateUserRole(userId: string, role: UserRole): Promise<void> {
    try {
      await pool.query(
        'UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2',
        [role, userId]
      );
      logger.info(`User role updated: ${userId} -> ${role}`);
    } catch (error) {
      logger.error('Error updating user role:', error);
      throw error;
    }
  }

  private mapRowToUser(row: any): User {
    return {
      id: row.id,
      email: row.email,
      firstName: row.first_name,
      lastName: row.last_name,
      role: row.role as UserRole,
      organization: row.organization,
      isActive: row.is_active,
      lastLogin: row.last_login,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}