import { z } from 'zod';

// Configuration schema for validation
const configSchema = z.object({
  // Server configuration
  NODE_ENV: z.enum(['development', 'testing', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().default(8080),
  HOST: z.string().default('0.0.0.0'),
  SERVICE_NAME: z.string().default('auth-service'),
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
  REDIS_DB: z.coerce.number().default(0),
  REDIS_KEY_PREFIX: z.string().default('auth:'),

  // JWT configuration
  JWT_SECRET: z.string().min(32),
  JWT_ACCESS_TOKEN_TTL: z.string().default('15m'),
  JWT_REFRESH_TOKEN_TTL: z.string().default('7d'),
  JWT_ISSUER: z.string().default('threatmodel.io'),
  JWT_AUDIENCE: z.string().default('threatmodel.io'),

  // Password configuration
  PASSWORD_PEPPER: z.string().min(16),
  ARGON2_MEMORY_COST: z.coerce.number().default(65536),
  ARGON2_TIME_COST: z.coerce.number().default(3),
  ARGON2_PARALLELISM: z.coerce.number().default(4),

  // MFA configuration
  MFA_ISSUER: z.string().default('ThreatModel.io'),
  MFA_BACKUP_CODES_COUNT: z.coerce.number().default(10),
  TOTP_WINDOW: z.coerce.number().default(1),
  TOTP_STEP: z.coerce.number().default(30),

  // Rate limiting
  RATE_LIMIT_MAX: z.coerce.number().default(100),
  RATE_LIMIT_WINDOW: z.coerce.number().default(60000),
  RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS: z.coerce.boolean().default(false),

  // Security configuration
  BCRYPT_ROUNDS: z.coerce.number().default(12),
  SESSION_TIMEOUT: z.string().default('24h'),
  MAX_LOGIN_ATTEMPTS: z.coerce.number().default(5),
  LOCKOUT_DURATION: z.string().default('15m'),
  PASSWORD_RESET_TTL: z.string().default('1h'),

  // External services
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().email().default('noreply@threatmodel.io'),

  SMS_PROVIDER: z.enum(['twilio']).default('twilio'),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_PHONE_NUMBER: z.string().optional(),

  // Monitoring
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  ENABLE_METRICS: z.coerce.boolean().default(true),
  METRICS_PORT: z.coerce.number().default(9090),

  // CORS configuration
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  CORS_CREDENTIALS: z.coerce.boolean().default(true),

  // Vault configuration
  VAULT_ADDR: z.string().optional(),
  VAULT_TOKEN: z.string().optional(),
  VAULT_PATH: z.string().default('secret/auth-service'),
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

// Helper function to check if running in production
export const isProduction = () => config.NODE_ENV === 'production';

// Helper function to check if running in development
export const isDevelopment = () => config.NODE_ENV === 'development';

// Helper function to check if running in test
export const isTesting = () => config.NODE_ENV === 'testing';

// Convert time strings to milliseconds
export const parseTimeToMs = (timeStr: string): number => {
  const units: Record<string, number> = {
    ms: 1,
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  const match = timeStr.match(/^(\d+)([mshd]?)$/);
  if (!match) {
    throw new Error(`Invalid time format: ${timeStr}`);
  }

  const [, value, unit] = match;
  const multiplier = units[unit || 'ms'] || 1;
  
  return parseInt(value, 10) * multiplier;
};

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

// JWT configuration
export const getJwtConfig = () => ({
  secret: config.JWT_SECRET,
  sign: {
    issuer: config.JWT_ISSUER,
    audience: config.JWT_AUDIENCE,
    expiresIn: config.JWT_ACCESS_TOKEN_TTL,
  },
  verify: {
    issuer: config.JWT_ISSUER,
    audience: config.JWT_AUDIENCE,
  },
});

// Argon2 configuration
export const getArgon2Config = () => ({
  memoryCost: config.ARGON2_MEMORY_COST,
  timeCost: config.ARGON2_TIME_COST,
  parallelism: config.ARGON2_PARALLELISM,
});

// Export configuration object
export default config;