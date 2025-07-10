import { CorsOptions } from 'cors';

/**
 * Centralized CORS configuration for all services
 * Provides secure defaults with environment-based overrides
 */

const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';

/**
 * Default allowed origins for different environments
 */
const getDefaultOrigins = (): string[] => {
  if (isDevelopment) {
    return [
      'http://localhost:3000',    // API Gateway
      'http://localhost:3006',    // Frontend dev
      'http://localhost:5173',    // Vite dev server
      'http://localhost:5174',    // ProjectHub frontend
      'http://192.168.1.24:3000', // Gateway on NAS
      'http://192.168.1.24:3006', // Frontend on NAS
      'http://192.168.1.24:5174', // ProjectHub on NAS
    ];
  }
  
  if (isProduction) {
    return [
      'https://threatmodel.company.com',
      'https://api.threatmodel.company.com',
      // Add production domains here
    ];
  }
  
  return ['http://localhost:3000'];
};

/**
 * Parse origins from environment variable
 */
const parseOrigins = (originsEnv?: string): string[] => {
  if (!originsEnv) return getDefaultOrigins();
  
  return originsEnv.split(',').map(origin => origin.trim()).filter(Boolean);
};

/**
 * Origin validation function
 */
const validateOrigin = (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
  const allowedOrigins = parseOrigins(process.env.CORS_ORIGINS || process.env.ALLOWED_ORIGINS);
  
  // Allow requests with no origin (mobile apps, Postman, etc.)
  if (!origin) {
    return callback(null, true);
  }
  
  // Check if origin is in allowed list
  if (allowedOrigins.includes(origin)) {
    return callback(null, true);
  }
  
  // In development, allow localhost with different ports
  if (isDevelopment && origin.startsWith('http://localhost:')) {
    return callback(null, true);
  }
  
  // In development, allow local network addresses
  if (isDevelopment && origin.match(/^https?:\/\/192\.168\.\d+\.\d+:/)) {
    return callback(null, true);
  }
  
  // Log rejected origins for debugging
  console.warn(`CORS: Rejected origin: ${origin}`);
  callback(new Error('Not allowed by CORS'), false);
};

/**
 * Base CORS configuration
 */
export const baseCorsConfig: CorsOptions = {
  origin: validateOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-Request-ID',
    'X-API-Key',
    'X-Client-Version',
    'Accept',
    'Origin',
  ],
  exposedHeaders: [
    'X-Total-Count',
    'X-Request-ID',
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset',
  ],
  optionsSuccessStatus: 200, // Some legacy browsers (IE11, various SmartTVs) choke on 204
  maxAge: isDevelopment ? 0 : 86400, // 24 hours in production, 0 in development
  preflightContinue: false,
};

/**
 * API Gateway specific CORS configuration
 */
export const gatewayCorsConfig: CorsOptions = {
  ...baseCorsConfig,
  exposedHeaders: [
    ...baseCorsConfig.exposedHeaders || [],
    'X-Gateway-Version',
    'X-Service-Response-Time',
  ],
};

/**
 * Webhook specific CORS configuration (more restrictive)
 */
export const webhookCorsConfig: CorsOptions = {
  ...baseCorsConfig,
  allowedHeaders: [
    ...baseCorsConfig.allowedHeaders || [],
    'X-Webhook-Signature',
    'X-GitHub-Delivery',
    'X-GitHub-Event',
    'X-Hub-Signature',
    'X-Hub-Signature-256',
  ],
  methods: ['POST', 'OPTIONS'], // Only allow POST for webhooks
};

/**
 * Public API CORS configuration (for public-facing endpoints)
 */
export const publicApiCorsConfig: CorsOptions = {
  ...baseCorsConfig,
  credentials: false, // Don't send cookies for public APIs
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'X-API-Key',
    'X-Client-Version',
    'Accept',
  ],
};

/**
 * Development-only CORS configuration (very permissive)
 */
export const devCorsConfig: CorsOptions = {
  origin: true, // Allow all origins in development
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
  allowedHeaders: '*',
  exposedHeaders: '*',
  maxAge: 0,
};

/**
 * Get CORS configuration based on environment and service type
 */
export const getCorsConfig = (serviceType: 'gateway' | 'webhook' | 'public' | 'default' = 'default'): CorsOptions => {
  // Force development config if explicitly set
  if (process.env.CORS_DEV_MODE === 'true') {
    return devCorsConfig;
  }
  
  switch (serviceType) {
    case 'gateway':
      return gatewayCorsConfig;
    case 'webhook':
      return webhookCorsConfig;
    case 'public':
      return publicApiCorsConfig;
    default:
      return baseCorsConfig;
  }
};

/**
 * Validate CORS environment variables
 */
export const validateCorsEnvironment = (): void => {
  if (isProduction) {
    const origins = process.env.CORS_ORIGINS || process.env.ALLOWED_ORIGINS;
    if (!origins || origins.includes('*') || origins.includes('localhost')) {
      throw new Error('Production CORS origins must be explicitly configured and cannot include wildcards or localhost');
    }
  }
  
  console.log('CORS Configuration:', {
    environment: process.env.NODE_ENV,
    allowedOrigins: parseOrigins(process.env.CORS_ORIGINS || process.env.ALLOWED_ORIGINS),
    devMode: process.env.CORS_DEV_MODE === 'true',
  });
};