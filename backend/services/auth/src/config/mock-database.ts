/**
 * Mock Database Implementation for Testing
 * Provides in-memory storage to test SSO functionality without PostgreSQL
 */

import { logger } from '../utils/logger';
import { User, UserRole } from '../types/auth';
import { v4 as uuidv4 } from 'uuid';

interface MockUser extends User {
  password_hash?: string;
}

class MockDatabase {
  private users: Map<string, MockUser> = new Map();
  private usersByEmail: Map<string, MockUser> = new Map();
  private connected: boolean = false;

  constructor() {
    this.initializeTestData();
  }

  // Initialize with test data
  private initializeTestData() {
    const adminUser: MockUser = {
      id: uuidv4(),
      email: 'admin@threat-modeling.com',
      firstName: 'Admin',
      lastName: 'User',
      role: UserRole.ADMIN,
      organization: 'test-org',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      password_hash: '$2b$10$rX8bZGqQJZ8KvC4vP.N3DOK7N6uH6P9R8L3P2Y5yF1H4Z6Q8N5Y3e' // TestPassword123@
    };

    this.users.set(adminUser.id, adminUser);
    this.usersByEmail.set(adminUser.email, adminUser);
    this.connected = true;
    
    logger.info('Mock database initialized with test data');
  }

  // Method to upgrade user role
  upgradeUserToAdmin(email: string): boolean {
    const user = this.usersByEmail.get(email);
    if (user) {
      user.role = UserRole.ADMIN;
      user.updatedAt = new Date();
      return true;
    }
    return false;
  }

  // Mock Pool interface
  async connect() {
    return {
      query: (sql: string, params?: any[]) => this.query(sql, params),
      release: () => {}
    };
  }

  async query(sql: string, params: any[] = []): Promise<{ rows: any[] }> {
    if (!this.connected) {
      throw new Error('Database not connected');
    }

    logger.debug('Mock DB Query:', { sql, params });

    // Mock user creation
    if (sql.includes('INSERT INTO users')) {
      const [id, email, password_hash, first_name, last_name, role, organization, is_active] = params;
      
      if (this.usersByEmail.has(email)) {
        throw new Error('User with this email already exists');
      }

      const user: MockUser = {
        id,
        email,
        firstName: first_name,
        lastName: last_name,
        role: role || UserRole.VIEWER,
        organization,
        isActive: is_active,
        createdAt: new Date(),
        updatedAt: new Date(),
        password_hash
      };

      this.users.set(id, user);
      this.usersByEmail.set(email, user);

      return {
        rows: [{
          id: user.id,
          email: user.email,
          first_name: user.firstName,
          last_name: user.lastName,
          role: user.role,
          organization: user.organization,
          is_active: user.isActive,
          created_at: user.createdAt,
          updated_at: user.updatedAt
        }]
      };
    }

    // Mock user lookup by email
    if (sql.includes('SELECT') && sql.includes('WHERE email = $1')) {
      const email = params[0];
      const user = this.usersByEmail.get(email);
      
      if (!user) {
        return { rows: [] };
      }

      return {
        rows: [{
          id: user.id,
          email: user.email,
          first_name: user.firstName,
          last_name: user.lastName,
          role: user.role,
          organization: user.organization,
          is_active: user.isActive,
          last_login: user.lastLogin,
          created_at: user.createdAt,
          updated_at: user.updatedAt
        }]
      };
    }

    // Mock user lookup by ID
    if (sql.includes('SELECT') && sql.includes('WHERE id = $1')) {
      const id = params[0];
      const user = this.users.get(id);
      
      if (!user) {
        return { rows: [] };
      }

      return {
        rows: [{
          id: user.id,
          email: user.email,
          first_name: user.firstName,
          last_name: user.lastName,
          role: user.role,
          organization: user.organization,
          is_active: user.isActive,
          last_login: user.lastLogin,
          created_at: user.createdAt,
          updated_at: user.updatedAt
        }]
      };
    }

    // Mock password hash lookup
    if (sql.includes('SELECT password_hash')) {
      const email = params[0];
      const user = this.usersByEmail.get(email);
      
      if (!user || !user.password_hash) {
        return { rows: [] };
      }

      return {
        rows: [{ password_hash: user.password_hash }]
      };
    }

    // Mock user updates
    if (sql.includes('UPDATE users')) {
      if (sql.includes('last_login')) {
        const userId = params[0];
        const user = this.users.get(userId);
        if (user) {
          user.lastLogin = new Date();
          user.updatedAt = new Date();
        }
        return { rows: [] };
      }
      if (sql.includes('role = $1')) {
        const [role, userId] = params;
        const user = this.users.get(userId);
        if (user) {
          user.role = role;
          user.updatedAt = new Date();
        }
        return { rows: [] };
      }
    }

    // Default empty response
    return { rows: [] };
  }

  on(event: string, callback: Function) {
    if (event === 'connect') {
      setTimeout(() => callback(), 100);
    }
  }

  async end() {
    this.connected = false;
  }
}

// Create mock pool instance
const mockPool = new MockDatabase();

export { mockPool as pool };