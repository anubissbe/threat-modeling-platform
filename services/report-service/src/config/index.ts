import { z } from 'zod';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Configuration schema
const configSchema = z.object({
  // Server Configuration
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3007),
  HOST: z.string().default('0.0.0.0'),
  
  // Security
  JWT_SECRET: z.string().min(32),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  
  // Redis Configuration
  REDIS_URL: z.string().default('redis://localhost:6379'),
  
  // Queue Configuration
  QUEUE_REDIS_URL: z.string().optional(),
  QUEUE_CONCURRENCY: z.coerce.number().default(5),
  QUEUE_MAX_ATTEMPTS: z.coerce.number().default(3),
  
  // Storage Configuration
  STORAGE_TYPE: z.enum(['local', 's3', 'gcs']).default('local'),
  STORAGE_PATH: z.string().default('./reports'),
  
  // S3 Configuration (optional)
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_REGION: z.string().default('us-east-1'),
  S3_BUCKET: z.string().optional(),
  
  // Report Configuration
  REPORT_EXPIRY_DAYS: z.coerce.number().default(30),
  MAX_REPORT_SIZE_MB: z.coerce.number().default(50),
  REPORT_TIMEOUT_MS: z.coerce.number().default(300000), // 5 minutes
  
  // PDF Generation
  PUPPETEER_EXECUTABLE_PATH: z.string().optional(),
  PUPPETEER_HEADLESS: z.coerce.boolean().default(true),
  PDF_PAGE_SIZE: z.string().default('A4'),
  PDF_MARGIN: z.string().default('1cm'),
  
  // Template Configuration
  TEMPLATE_PATH: z.string().default('./templates'),
  TEMPLATE_CACHE_TTL: z.coerce.number().default(3600),
  
  // Rate Limiting
  RATE_LIMIT_MAX: z.coerce.number().default(50),
  RATE_LIMIT_WINDOW: z.coerce.number().default(60000),
  
  // Service URLs
  AUTH_SERVICE_URL: z.string().default('http://localhost:3001'),
  PROJECT_SERVICE_URL: z.string().default('http://localhost:3003'),
  THREAT_ENGINE_URL: z.string().default('http://localhost:3004'),
  
  // Logging
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  LOG_PRETTY: z.coerce.boolean().default(true),
  
  // Monitoring
  ENABLE_METRICS: z.coerce.boolean().default(true),
  METRICS_PORT: z.coerce.number().default(9097),
});

// Parse and validate configuration
const parseConfig = () => {
  try {
    return configSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Invalid configuration:');
      error.errors.forEach((err) => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
      process.exit(1);
    }
    throw error;
  }
};

// Export validated configuration
export const config = parseConfig();

// Export configuration type
export type Config = z.infer<typeof configSchema>;

// Helper functions
export const isDevelopment = () => config.NODE_ENV === 'development';
export const isProduction = () => config.NODE_ENV === 'production';
export const isTest = () => config.NODE_ENV === 'test';

// Storage configuration helpers
export const getStorageConfig = () => {
  switch (config.STORAGE_TYPE) {
    case 's3':
      return {
        type: 's3',
        bucket: config.S3_BUCKET!,
        region: config.AWS_REGION,
        credentials: {
          accessKeyId: config.AWS_ACCESS_KEY_ID!,
          secretAccessKey: config.AWS_SECRET_ACCESS_KEY!,
        },
      };
    case 'gcs':
      // Google Cloud Storage config would go here
      return { type: 'gcs' };
    default:
      return {
        type: 'local',
        path: config.STORAGE_PATH,
      };
  }
};

// Queue configuration helper
export const getQueueRedisUrl = () => {
  return config.QUEUE_REDIS_URL || config.REDIS_URL;
};