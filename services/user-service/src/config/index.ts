import { z } from 'zod';

// Configuration schema
const configSchema = z.object({
  // Server configuration
  NODE_ENV: z.enum(['development', 'testing', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().default(8081),
  HOST: z.string().default('0.0.0.0'),
  SERVICE_NAME: z.string().default('user-service'),
  SERVICE_VERSION: z.string().default('1.0.0'),

  // Database configuration
  DATABASE_URL: z.string().url(),
  DB_POOL_MIN: z.coerce.number().default(2),
  DB_POOL_MAX: z.coerce.number().default(20),
  DB_IDLE_TIMEOUT: z.coerce.number().default(10000),
  DB_CONNECTION_TIMEOUT: z.coerce.number().default(5000),

  // Redis configuration
  REDIS_URL: z.string().url(),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.coerce.number().default(1),
  REDIS_KEY_PREFIX: z.string().default('user:'),

  // JWT configuration
  JWT_SECRET: z.string().min(32),
  JWT_ISSUER: z.string().default('threatmodel.io'),
  JWT_AUDIENCE: z.string().default('threatmodel.io'),

  // Service communication
  AUTH_SERVICE_URL: z.string().url(),
  API_KEY: z.string().min(16),

  // Rate limiting
  RATE_LIMIT_MAX: z.coerce.number().default(100),
  RATE_LIMIT_WINDOW: z.coerce.number().default(60000),

  // Pagination
  DEFAULT_PAGE_SIZE: z.coerce.number().default(20),
  MAX_PAGE_SIZE: z.coerce.number().default(100),

  // Monitoring
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  ENABLE_METRICS: z.coerce.boolean().default(true),
  METRICS_PORT: z.coerce.number().default(9091),

  // CORS configuration
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  CORS_CREDENTIALS: z.coerce.boolean().default(true),

  // Vault configuration
  VAULT_ADDR: z.string().optional(),
  VAULT_TOKEN: z.string().optional(),
  VAULT_PATH: z.string().default('secret/user-service'),
});

// Parse and validate environment variables
const parseConfig = () => {
  try {
    return configSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors
        .map((err) => `${err.path.join('.')}: ${err.message}`)
        .join('\n');
      
      throw new Error(`Configuration validation failed:\n${missingVars}`);
    }
    throw error;
  }
};

export const config = parseConfig();

// Type definition for configuration
export type Config = z.infer<typeof configSchema>;

// Helper functions
export const isProduction = () => config.NODE_ENV === 'production';
export const isDevelopment = () => config.NODE_ENV === 'development';
export const isTesting = () => config.NODE_ENV === 'testing';

// Get CORS origins as array
export const getCorsOrigins = (): string[] => {
  return config.CORS_ORIGINS.split(',').map(origin => origin.trim());
};

// Database connection configuration
export const getDatabaseConfig = () => ({
  connectionString: config.DATABASE_URL,
  min: config.DB_POOL_MIN,
  max: config.DB_POOL_MAX,
  idleTimeoutMillis: config.DB_IDLE_TIMEOUT,
  connectionTimeoutMillis: config.DB_CONNECTION_TIMEOUT,
  ssl: isProduction() ? { rejectUnauthorized: false } : false,
});

// Redis connection configuration
export const getRedisConfig = () => ({
  url: config.REDIS_URL,
  password: config.REDIS_PASSWORD,
  db: config.REDIS_DB,
  keyPrefix: config.REDIS_KEY_PREFIX,
  retryDelayOnFailover: 100,
  enableReadyCheck: false,
  maxRetriesPerRequest: 3,
});

// Pagination helpers
export const getPaginationDefaults = () => ({
  defaultPageSize: config.DEFAULT_PAGE_SIZE,
  maxPageSize: config.MAX_PAGE_SIZE,
});

// Export configuration object
export default config;