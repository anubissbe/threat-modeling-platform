import { Pool, PoolClient } from 'pg';
import { getDatabaseConfig } from '../config';
import { logger } from '../utils/logger';

let pool: Pool;

export async function connectDatabase(): Promise<Pool> {
  if (pool) {
    return pool;
  }

  const dbConfig = getDatabaseConfig();
  
  pool = new Pool(dbConfig);

  // Test connection
  try {
    const client = await pool.connect();
    logger.info('Database connected successfully');
    client.release();
    
    // Set up connection event handlers
    pool.on('connect', () => {
      logger.debug('New database connection established');
    });

    pool.on('error', (err) => {
      logger.error('Database connection error:', err);
    });

    return pool;
  } catch (error) {
    logger.error('Failed to connect to database:', error);
    throw error;
  }
}

export async function getDatabase(): Promise<Pool> {
  if (!pool) {
    throw new Error('Database not initialized. Call connectDatabase() first.');
  }
  return pool;
}

export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.end();
    logger.info('Database connection closed');
  }
}

// Transaction helper
export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Query helper with automatic connection management
export async function query(text: string, params?: any[]): Promise<any> {
  const client = await pool.connect();
  
  try {
    const start = Date.now();
    const result = await client.query(text, params);
    const duration = Date.now() - start;
    
    logger.debug('Database query executed', {
      query: text,
      duration: `${duration}ms`,
      rows: result.rowCount,
    });
    
    return result;
  } catch (error: any) {
    logger.error('Database query error:', {
      query: text,
      params,
      error: error.message,
    });
    throw error;
  } finally {
    client.release();
  }
}

// Pagination helper
export interface PaginationOptions {
  page: number;
  pageSize: number;
  orderBy?: string;
  orderDirection?: 'ASC' | 'DESC';
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

export async function queryPaginated<T>(
  baseQuery: string,
  countQuery: string,
  params: any[],
  options: PaginationOptions
): Promise<PaginatedResult<T>> {
  const { page, pageSize, orderBy, orderDirection = 'ASC' } = options;
  const offset = (page - 1) * pageSize;

  // Build paginated query
  let paginatedQuery = baseQuery;
  if (orderBy) {
    paginatedQuery += ` ORDER BY ${orderBy} ${orderDirection}`;
  }
  paginatedQuery += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;

  // Execute queries in parallel
  const [dataResult, countResult] = await Promise.all([
    query(paginatedQuery, [...params, pageSize, offset]),
    query(countQuery, params),
  ]);

  const totalItems = parseInt(countResult.rows[0]?.count || 0);
  const totalPages = Math.ceil(totalItems / pageSize);

  return {
    data: dataResult.rows,
    pagination: {
      page,
      pageSize,
      totalItems,
      totalPages,
      hasNext: page < totalPages,
      hasPrevious: page > 1,
    },
  };
}

export { pool };