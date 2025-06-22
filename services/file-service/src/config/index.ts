import { z } from 'zod';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Configuration schema
const configSchema = z.object({
  // Server Configuration
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3009),
  HOST: z.string().default('0.0.0.0'),
  
  // Security
  JWT_SECRET: z.string().min(32),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  
  // Database Configuration
  DATABASE_URL: z.string().default('postgresql://postgres:password@localhost:5432/threatmodel_files'),
  
  // Storage Configuration
  STORAGE_PROVIDER: z.enum(['local', 's3', 'minio']).default('local'),
  STORAGE_PATH: z.string().default('./uploads'),
  
  // S3/MinIO Configuration
  S3_REGION: z.string().default('us-east-1'),
  S3_BUCKET: z.string().default('threatmodel-files'),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_ENDPOINT: z.string().optional(), // For MinIO
  S3_FORCE_PATH_STYLE: z.coerce.boolean().default(false), // For MinIO
  
  // File Upload Limits
  MAX_FILE_SIZE: z.coerce.number().default(100 * 1024 * 1024), // 100MB
  MAX_FILES_PER_REQUEST: z.coerce.number().default(10),
  ALLOWED_MIME_TYPES: z.string().default('image/*,application/pdf,text/*,application/json,application/xml'),
  
  // File Processing
  ENABLE_IMAGE_PROCESSING: z.coerce.boolean().default(true),
  ENABLE_THUMBNAILS: z.coerce.boolean().default(true),
  THUMBNAIL_SIZES: z.string().default('150x150,300x300,600x600'),
  IMAGE_QUALITY: z.coerce.number().default(85),
  
  // Virus Scanning
  ENABLE_VIRUS_SCAN: z.coerce.boolean().default(false),
  CLAMAV_HOST: z.string().default('localhost'),
  CLAMAV_PORT: z.coerce.number().default(3310),
  
  // Cleanup
  TEMP_FILE_TTL: z.coerce.number().default(24 * 60 * 60 * 1000), // 24 hours
  DELETED_FILE_RETENTION: z.coerce.number().default(30 * 24 * 60 * 60 * 1000), // 30 days
  
  // Rate Limiting
  RATE_LIMIT_MAX: z.coerce.number().default(100),
  RATE_LIMIT_WINDOW: z.coerce.number().default(60000),
  
  // Service URLs
  AUTH_SERVICE_URL: z.string().default('http://localhost:3001'),
  USER_SERVICE_URL: z.string().default('http://localhost:3002'),
  PROJECT_SERVICE_URL: z.string().default('http://localhost:3003'),
  
  // User Quotas
  DEFAULT_USER_QUOTA: z.coerce.number().default(1024 * 1024 * 1024), // 1GB
  PREMIUM_USER_QUOTA: z.coerce.number().default(10 * 1024 * 1024 * 1024), // 10GB
  
  // Logging
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  LOG_PRETTY: z.coerce.boolean().default(true),
  
  // Monitoring
  ENABLE_METRICS: z.coerce.boolean().default(true),
  METRICS_PORT: z.coerce.number().default(9099),
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

// Get allowed MIME types as array
export const getAllowedMimeTypes = (): string[] => {
  return config.ALLOWED_MIME_TYPES.split(',').map(type => type.trim());
};

// Get thumbnail sizes as array
export const getThumbnailSizes = (): Array<{ width: number; height: number }> => {
  return config.THUMBNAIL_SIZES.split(',').map(size => {
    const [width, height] = size.trim().split('x').map(Number);
    return { width, height };
  });
};

// Storage configuration helpers
export const getStorageConfig = () => {
  switch (config.STORAGE_PROVIDER) {
    case 's3':
    case 'minio':
      return {
        provider: config.STORAGE_PROVIDER,
        region: config.S3_REGION,
        bucket: config.S3_BUCKET,
        accessKeyId: config.S3_ACCESS_KEY_ID!,
        secretAccessKey: config.S3_SECRET_ACCESS_KEY!,
        endpoint: config.S3_ENDPOINT,
        forcePathStyle: config.S3_FORCE_PATH_STYLE,
      };
    case 'local':
    default:
      return {
        provider: 'local',
        path: config.STORAGE_PATH,
      };
  }
};

// File categories configuration
export const getFileCategories = () => {
  return [
    {
      id: 'images',
      name: 'Images',
      description: 'Image files for threat models and documentation',
      mimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
      maxSize: 10 * 1024 * 1024, // 10MB
      allowedExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'],
      thumbnail: true,
      processing: [
        {
          resize: { width: 1920, height: 1080, fit: 'inside' as const, quality: 85 },
          format: 'jpeg' as const,
        },
      ],
    },
    {
      id: 'documents',
      name: 'Documents',
      description: 'PDF and document files',
      mimeTypes: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
      maxSize: 50 * 1024 * 1024, // 50MB
      allowedExtensions: ['.pdf', '.doc', '.docx'],
      thumbnail: false,
      processing: [],
    },
    {
      id: 'data',
      name: 'Data Files',
      description: 'JSON, XML, CSV and other data files',
      mimeTypes: ['application/json', 'application/xml', 'text/csv', 'text/plain'],
      maxSize: 5 * 1024 * 1024, // 5MB
      allowedExtensions: ['.json', '.xml', '.csv', '.txt'],
      thumbnail: false,
      processing: [],
    },
    {
      id: 'archives',
      name: 'Archives',
      description: 'Compressed archive files',
      mimeTypes: ['application/zip', 'application/x-tar', 'application/gzip'],
      maxSize: 100 * 1024 * 1024, // 100MB
      allowedExtensions: ['.zip', '.tar', '.gz', '.tar.gz'],
      thumbnail: false,
      processing: [],
    },
  ];
};

// Validation rules
export const getValidationRules = () => {
  return [
    {
      name: 'file_size',
      enabled: true,
      maxSize: config.MAX_FILE_SIZE,
    },
    {
      name: 'mime_type',
      enabled: true,
      mimeTypes: getAllowedMimeTypes(),
    },
    {
      name: 'virus_scan',
      enabled: config.ENABLE_VIRUS_SCAN,
      scanForVirus: true,
    },
    {
      name: 'content_validation',
      enabled: true,
      checkContent: true,
    },
  ];
};