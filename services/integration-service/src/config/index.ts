import { z } from 'zod';

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('3000'),
  HOST: z.string().default('0.0.0.0'),
  
  // JWT Configuration
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_ACCESS_TOKEN_TTL: z.string().transform(Number).default('3600'),
  
  // Service URLs
  AUTH_SERVICE_URL: z.string().url().default('http://localhost:3001'),
  USER_SERVICE_URL: z.string().url().default('http://localhost:3002'),
  PROJECT_SERVICE_URL: z.string().url().default('http://localhost:3003'),
  THREAT_ENGINE_URL: z.string().url().default('http://localhost:3004'),
  
  // Redis Configuration
  REDIS_URL: z.string().default('redis://localhost:6379'),
  
  // CORS Configuration
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  
  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  
  // Service Discovery
  SERVICE_DISCOVERY_ENABLED: z.string().transform(val => val === 'true').default('true'),
  HEALTH_CHECK_INTERVAL: z.string().transform(Number).default('30000'),
  
  // Rate Limiting
  RATE_LIMIT_MAX: z.string().transform(Number).default('1000'),
  RATE_LIMIT_WINDOW: z.string().transform(Number).default('60000'),
  
  // Proxy Configuration
  PROXY_TIMEOUT: z.string().transform(Number).default('30000'),
  PROXY_RETRIES: z.string().transform(Number).default('3'),
});

const parseConfig = (): z.infer<typeof configSchema> => {
  try {
    return configSchema.parse(process.env);
  } catch (error) {
    console.error('Configuration validation failed:', error);
    process.exit(1);
  }
};

export const config = parseConfig();
export type Config = typeof config;