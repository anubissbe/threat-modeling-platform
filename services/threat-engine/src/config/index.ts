import { z } from 'zod';

// Configuration schema validation
const configSchema = z.object({
  // Server Configuration
  NODE_ENV: z.enum(['development', 'testing', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().default(3004),
  HOST: z.string().default('0.0.0.0'),
  SERVICE_NAME: z.string().default('threat-engine'),
  SERVICE_VERSION: z.string().default('1.0.0'),

  // Database Configuration
  DATABASE_URL: z.string().default('postgresql://mcp_user:mcp_secure_password_2024@localhost:5432/mcp_learning'),
  DB_POOL_MIN: z.coerce.number().default(2),
  DB_POOL_MAX: z.coerce.number().default(20),
  DB_POOL_IDLE_TIMEOUT: z.coerce.number().default(30000),
  DB_POOL_CONNECTION_TIMEOUT: z.coerce.number().default(10000),

  // Redis Configuration
  REDIS_URL: z.string().default('redis://localhost:6379'),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.coerce.number().default(1),
  REDIS_KEY_PREFIX: z.string().default('threat-engine:'),

  // Security Configuration
  JWT_SECRET: z.string().default('threat-engine-jwt-secret-change-in-production'),
  JWT_ALGORITHM: z.string().default('HS256'),
  JWT_EXPIRES_IN: z.string().default('1h'),

  // Rate Limiting
  RATE_LIMIT_MAX: z.coerce.number().default(100),
  RATE_LIMIT_WINDOW: z.coerce.number().default(60000), // 1 minute

  // CORS Configuration
  CORS_ORIGINS: z.string().transform(s => s.split(',')).default('http://localhost:3000,http://localhost:8080'),

  // Logging Configuration
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // Threat Analysis Configuration
  THREAT_ANALYSIS_TIMEOUT: z.coerce.number().default(30000), // 30 seconds
  MAX_COMPONENTS_PER_MODEL: z.coerce.number().default(100),
  MAX_THREATS_PER_ANALYSIS: z.coerce.number().default(1000),
  
  // ML/AI Configuration
  AI_MODEL_ENDPOINT: z.string().optional(),
  AI_MODEL_API_KEY: z.string().optional(),
  ENABLE_ML_PREDICTIONS: z.coerce.boolean().default(false),
  
  // Cache Configuration
  CACHE_TTL_THREATS: z.coerce.number().default(3600), // 1 hour
  CACHE_TTL_PATTERNS: z.coerce.number().default(86400), // 24 hours
  CACHE_TTL_MITIGATIONS: z.coerce.number().default(7200), // 2 hours

  // External Service URLs
  PROJECT_SERVICE_URL: z.string().default('http://localhost:3003'),
  USER_SERVICE_URL: z.string().default('http://localhost:3002'),
  AUTH_SERVICE_URL: z.string().default('http://localhost:3001'),

  // Vault Configuration (optional)
  VAULT_ENABLED: z.coerce.boolean().default(false),
  VAULT_URL: z.string().optional(),
  VAULT_TOKEN: z.string().optional(),
});

// Parse and validate environment variables
const parseConfig = () => {
  try {
    return configSchema.parse(process.env);
  } catch (error) {
    console.error('Configuration validation failed:', error);
    process.exit(1);
  }
};

export const config = parseConfig();

// Database configuration for pg
export const getDatabaseConfig = () => {
  const url = new URL(config.DATABASE_URL);
  
  return {
    host: url.hostname,
    port: parseInt(url.port) || 5432,
    database: url.pathname.slice(1),
    user: url.username,
    password: url.password,
    min: config.DB_POOL_MIN,
    max: config.DB_POOL_MAX,
    idleTimeoutMillis: config.DB_POOL_IDLE_TIMEOUT,
    connectionTimeoutMillis: config.DB_POOL_CONNECTION_TIMEOUT,
    ssl: config.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  };
};

// Redis configuration
export const getRedisConfig = () => {
  return {
    url: config.REDIS_URL,
    password: config.REDIS_PASSWORD,
    database: config.REDIS_DB,
    keyPrefix: config.REDIS_KEY_PREFIX,
    retryDelayOnFailover: 100,
    enableReadyCheck: true,
    maxRetriesPerRequest: 3,
  };
};

export default config;