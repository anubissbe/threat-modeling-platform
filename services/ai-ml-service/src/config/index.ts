import { z } from 'zod';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('3006'),
  HOST: z.string().default('0.0.0.0'),
  
  // JWT Configuration
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  
  // Service URLs
  AUTH_SERVICE_URL: z.string().url().default('http://localhost:3001'),
  THREAT_ENGINE_URL: z.string().url().default('http://localhost:3004'),
  INTEGRATION_SERVICE_URL: z.string().url().default('http://localhost:3005'),
  
  // Redis Configuration
  REDIS_URL: z.string().default('redis://localhost:6379'),
  
  // ML Model Configuration
  MODEL_PATH: z.string().default('./ml-models'),
  TRAINING_DATA_PATH: z.string().default('./ml-training/data'),
  MODEL_UPDATE_INTERVAL: z.string().transform(Number).default('86400000'), // 24 hours
  BATCH_SIZE: z.string().transform(Number).default('32'),
  CONFIDENCE_THRESHOLD: z.string().transform(Number).default('0.7'),
  
  // API Keys for Threat Intelligence (optional in dev)
  MITRE_API_KEY: z.string().optional(),
  NVD_API_KEY: z.string().optional(),
  VIRUSTOTAL_API_KEY: z.string().optional(),
  
  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  
  // Cache Configuration
  CACHE_TTL: z.string().transform(Number).default('3600'),
  CACHE_MAX_SIZE: z.string().transform(Number).default('1000'),
  
  // Rate Limiting
  RATE_LIMIT_MAX: z.string().transform(Number).default('100'),
  RATE_LIMIT_WINDOW: z.string().transform(Number).default('60000'),
  
  // CORS Configuration
  CORS_ORIGINS: z.string().default('*'),
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