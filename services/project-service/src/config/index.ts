import { z } from 'zod';

// Configuration schema
const configSchema = z.object({
  // Server configuration
  NODE_ENV: z.enum(['development', 'testing', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().default(8082),
  HOST: z.string().default('0.0.0.0'),
  SERVICE_NAME: z.string().default('project-service'),
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
  REDIS_DB: z.coerce.number().default(2),
  REDIS_KEY_PREFIX: z.string().default('project:'),

  // JWT configuration
  JWT_SECRET: z.string().min(32),
  JWT_ISSUER: z.string().default('threatmodel.io'),
  JWT_AUDIENCE: z.string().default('threatmodel.io'),

  // Service communication
  AUTH_SERVICE_URL: z.string().url(),
  USER_SERVICE_URL: z.string().url(),
  API_KEY: z.string().min(16),

  // File storage
  STORAGE_TYPE: z.enum(['local', 's3']).default('local'),
  LOCAL_STORAGE_PATH: z.string().default('./uploads'),
  AWS_S3_BUCKET: z.string().optional(),
  AWS_REGION: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),

  // Rate limiting
  RATE_LIMIT_MAX: z.coerce.number().default(100),
  RATE_LIMIT_WINDOW: z.coerce.number().default(60000),

  // Pagination
  DEFAULT_PAGE_SIZE: z.coerce.number().default(20),
  MAX_PAGE_SIZE: z.coerce.number().default(100),

  // Versioning
  MAX_VERSIONS_PER_MODEL: z.coerce.number().default(50),
  VERSION_RETENTION_DAYS: z.coerce.number().default(365),

  // Collaboration
  MAX_COLLABORATORS: z.coerce.number().default(20),
  REAL_TIME_SYNC_ENABLED: z.coerce.boolean().default(true),

  // Monitoring
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  ENABLE_METRICS: z.coerce.boolean().default(true),
  METRICS_PORT: z.coerce.number().default(9092),

  // CORS configuration
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  CORS_CREDENTIALS: z.coerce.boolean().default(true),

  // Webhook configuration
  WEBHOOK_SECRET: z.string().min(16),
  WEBHOOK_MAX_RETRIES: z.coerce.number().default(3),

  // External integrations
  JIRA_ENABLED: z.coerce.boolean().default(false),
  JIRA_BASE_URL: z.string().optional(),
  JIRA_USERNAME: z.string().optional(),
  JIRA_API_TOKEN: z.string().optional(),

  GITHUB_ENABLED: z.coerce.boolean().default(false),
  GITHUB_TOKEN: z.string().optional(),

  // Vault configuration
  VAULT_ADDR: z.string().optional(),
  VAULT_TOKEN: z.string().optional(),
  VAULT_PATH: z.string().default('secret/project-service'),
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

// Storage configuration
export const getStorageConfig = () => ({
  type: config.STORAGE_TYPE,
  localPath: config.LOCAL_STORAGE_PATH,
  s3: {
    bucket: config.AWS_S3_BUCKET,
    region: config.AWS_REGION,
    accessKeyId: config.AWS_ACCESS_KEY_ID,
    secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
  },
});

// Pagination helpers
export const getPaginationDefaults = () => ({
  defaultPageSize: config.DEFAULT_PAGE_SIZE,
  maxPageSize: config.MAX_PAGE_SIZE,
});

// Versioning configuration
export const getVersioningConfig = () => ({
  maxVersionsPerModel: config.MAX_VERSIONS_PER_MODEL,
  retentionDays: config.VERSION_RETENTION_DAYS,
});

// Collaboration configuration
export const getCollaborationConfig = () => ({
  maxCollaborators: config.MAX_COLLABORATORS,
  realTimeSyncEnabled: config.REAL_TIME_SYNC_ENABLED,
});

// External integrations
export const getJiraConfig = () => ({
  enabled: config.JIRA_ENABLED,
  baseUrl: config.JIRA_BASE_URL,
  username: config.JIRA_USERNAME,
  apiToken: config.JIRA_API_TOKEN,
});

export const getGitHubConfig = () => ({
  enabled: config.GITHUB_ENABLED,
  token: config.GITHUB_TOKEN,
});

// Export configuration object
export default config;