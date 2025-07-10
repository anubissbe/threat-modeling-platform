import { Pool } from 'pg';
import { logger } from '../utils/logger';

// Check if we should use mock database
const useMockDatabase = process.env.USE_MOCK_DB === 'true' || process.env.NODE_ENV === 'test';

let pool: any;

if (useMockDatabase) {
  logger.info('Using mock database for testing');
  const { pool: mockPool } = require('./mock-database');
  pool = mockPool;
} else {
  // Use real PostgreSQL database
  pool = new Pool({
    connectionString: process.env['DATABASE_URL'] || 'postgresql://threatmodel:threatmodel123@postgres:5432/threatmodel_db',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  pool.on('connect', () => {
    logger.info('Database connection established');
  });

  pool.on('error', (err) => {
    logger.error('Database connection error:', err);
  });
}

export { pool };