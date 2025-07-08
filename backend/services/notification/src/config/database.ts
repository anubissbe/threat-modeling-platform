import { Pool, PoolClient } from 'pg';
import { logger } from '../utils/logger';

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean;
  max?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
}

class Database {
  private pool: Pool;
  private isConnected = false;

  constructor(config: DatabaseConfig) {
    this.pool = new Pool({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      password: config.password,
      ssl: config.ssl ? { rejectUnauthorized: false } : false,
      max: config.max || 20,
      idleTimeoutMillis: config.idleTimeoutMillis || 30000,
      connectionTimeoutMillis: config.connectionTimeoutMillis || 2000,
    });

    this.pool.on('error', (err) => {
      logger.error('Database pool error:', err);
      this.isConnected = false;
    });
  }

  async connect(): Promise<void> {
    try {
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();
      this.isConnected = true;
      logger.info('Database connected successfully');
    } catch (error) {
      logger.error('Database connection failed:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.pool.end();
      this.isConnected = false;
      logger.info('Database disconnected successfully');
    } catch (error) {
      logger.error('Database disconnection failed:', error);
      throw error;
    }
  }

  async query(text: string, params?: any[]): Promise<any> {
    if (!this.isConnected) {
      throw new Error('Database not connected');
    }

    const start = Date.now();
    try {
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;
      logger.debug(`Query executed in ${duration}ms: ${text}`);
      return result;
    } catch (error) {
      logger.error(`Query failed: ${text}`, error);
      throw error;
    }
  }

  async getClient(): Promise<PoolClient> {
    return this.pool.connect();
  }

  getPool(): Pool {
    return this.pool;
  }

  isHealthy(): boolean {
    return this.isConnected;
  }
}

// Create database instance
const config: DatabaseConfig = {
  host: process.env['DB_HOST'] || 'localhost',
  port: parseInt(process.env['DB_PORT'] || '5432'),
  database: process.env['DB_NAME'] || 'threatmodel_db',
  user: process.env['DB_USER'] || 'threatmodel',
  password: process.env['DB_PASSWORD'] || 'threatmodel123',
  ssl: process.env['NODE_ENV'] === 'production',
  max: parseInt(process.env['DB_MAX_CONNECTIONS'] || '20'),
  idleTimeoutMillis: parseInt(process.env['DB_IDLE_TIMEOUT'] || '30000'),
  connectionTimeoutMillis: parseInt(process.env['DB_CONNECTION_TIMEOUT'] || '2000'),
};

export const database = new Database(config);

// Auto-connect on import
database.connect().catch((error) => {
  logger.error('Failed to connect to database on startup:', error);
  process.exit(1);
});

export default database;