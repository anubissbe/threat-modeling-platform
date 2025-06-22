import { z } from 'zod';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Configuration schema
const configSchema = z.object({
  // Server Configuration
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3008),
  HOST: z.string().default('0.0.0.0'),
  
  // Security
  JWT_SECRET: z.string().min(32),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  
  // Redis Configuration
  REDIS_URL: z.string().default('redis://localhost:6379'),
  
  // Queue Configuration
  QUEUE_REDIS_URL: z.string().optional(),
  QUEUE_CONCURRENCY: z.coerce.number().default(10),
  QUEUE_MAX_ATTEMPTS: z.coerce.number().default(3),
  
  // Email Configuration
  EMAIL_PROVIDER: z.enum(['smtp', 'sendgrid', 'ses']).default('smtp'),
  EMAIL_FROM_NAME: z.string().default('Threat Modeling App'),
  EMAIL_FROM_ADDRESS: z.string().email().default('noreply@threatmodel.app'),
  EMAIL_REPLY_TO: z.string().email().optional(),
  
  // SMTP Configuration
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_SECURE: z.coerce.boolean().default(false),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  
  // SendGrid Configuration
  SENDGRID_API_KEY: z.string().optional(),
  
  // SMS Configuration
  SMS_PROVIDER: z.enum(['twilio', 'sns']).default('twilio'),
  SMS_FROM_NUMBER: z.string().optional(),
  
  // Twilio Configuration
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_FROM_NUMBER: z.string().optional(),
  
  // Slack Configuration
  SLACK_WEBHOOK_URL: z.string().optional(),
  SLACK_BOT_TOKEN: z.string().optional(),
  SLACK_APP_TOKEN: z.string().optional(),
  
  // Webhook Configuration
  WEBHOOK_TIMEOUT_MS: z.coerce.number().default(30000),
  WEBHOOK_MAX_RETRIES: z.coerce.number().default(3),
  
  // Template Configuration
  TEMPLATE_PATH: z.string().default('./templates'),
  TEMPLATE_CACHE_TTL: z.coerce.number().default(3600),
  
  // Rate Limiting
  RATE_LIMIT_MAX: z.coerce.number().default(100),
  RATE_LIMIT_WINDOW: z.coerce.number().default(60000),
  
  // Service URLs
  AUTH_SERVICE_URL: z.string().default('http://localhost:3001'),
  USER_SERVICE_URL: z.string().default('http://localhost:3002'),
  PROJECT_SERVICE_URL: z.string().default('http://localhost:3003'),
  
  // Notification Settings
  NOTIFICATION_TTL_DAYS: z.coerce.number().default(30),
  NOTIFICATION_BATCH_SIZE: z.coerce.number().default(100),
  NOTIFICATION_RETRY_DELAY_MS: z.coerce.number().default(5000),
  
  // Logging
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  LOG_PRETTY: z.coerce.boolean().default(true),
  
  // Monitoring
  ENABLE_METRICS: z.coerce.boolean().default(true),
  METRICS_PORT: z.coerce.number().default(9098),
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

// Get queue Redis URL
export const getQueueRedisUrl = () => {
  return config.QUEUE_REDIS_URL || config.REDIS_URL;
};

// Get email configuration
export const getEmailConfig = () => {
  switch (config.EMAIL_PROVIDER) {
    case 'smtp':
      return {
        provider: 'smtp',
        config: {
          host: config.SMTP_HOST!,
          port: config.SMTP_PORT,
          secure: config.SMTP_SECURE,
          auth: config.SMTP_USER && config.SMTP_PASS ? {
            user: config.SMTP_USER,
            pass: config.SMTP_PASS,
          } : undefined,
        },
      };
    case 'sendgrid':
      return {
        provider: 'sendgrid',
        config: {
          apiKey: config.SENDGRID_API_KEY!,
        },
      };
    default:
      throw new Error(`Unsupported email provider: ${config.EMAIL_PROVIDER}`);
  }
};

// Get SMS configuration
export const getSMSConfig = () => {
  switch (config.SMS_PROVIDER) {
    case 'twilio':
      return {
        provider: 'twilio',
        config: {
          accountSid: config.TWILIO_ACCOUNT_SID!,
          authToken: config.TWILIO_AUTH_TOKEN!,
          from: config.TWILIO_FROM_NUMBER || config.SMS_FROM_NUMBER!,
        },
      };
    default:
      throw new Error(`Unsupported SMS provider: ${config.SMS_PROVIDER}`);
  }
};