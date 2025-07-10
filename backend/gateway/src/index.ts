import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { createProxyMiddleware } from 'http-proxy-middleware';
import dotenv from 'dotenv';
import { createLogger, format, transports } from 'winston';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Logger setup
const logger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.json()
  ),
  defaultMeta: { service: 'api-gateway' },
  transports: [
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.simple()
      )
    })
  ]
});

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// Secure CORS configuration for API Gateway
const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3006',
      'http://localhost:5173',
      'http://localhost:5174',
      'http://192.168.1.24:3000',
      'http://192.168.1.24:3006',
      'http://192.168.1.24:5174',
      ...(process.env['CORS_ORIGINS']?.split(',') || [])
    ];
    
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`CORS: Rejected origin: ${origin}`);
      callback(new Error('Not allowed by CORS'), false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-API-Key', 'X-Client-Version'],
  exposedHeaders: ['X-Total-Count', 'X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-Gateway-Version'],
  maxAge: 86400, // 24 hours
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(compression());
app.use(morgan('combined', {
  stream: {
    write: (message) => logger.info(message.trim())
  }
}));

// Health check
app.get('/health', (_req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'api-gateway',
    timestamp: new Date().toISOString()
  });
});

// Service routes configuration
const services = {
  '/api/auth': {
    target: process.env.AUTH_SERVICE_URL || 'http://auth-service:3001',
    changeOrigin: true,
    pathRewrite: { '^/api/auth': '/api/auth' }
  },
  '/api/projects': {
    target: process.env.CORE_SERVICE_URL || 'http://core-service:3002',
    changeOrigin: true,
    pathRewrite: { '^/api/projects': '/api/projects' }
  },
  '/api/threat-models': {
    target: process.env.CORE_SERVICE_URL || 'http://core-service:3002',
    changeOrigin: true,
    pathRewrite: { '^/api/threat-models': '/api/threat-models' }
  },
  '/api/threats': {
    target: process.env.CORE_SERVICE_URL || 'http://core-service:3002',
    changeOrigin: true,
    pathRewrite: { '^/api/threats': '/api/threats' }
  },
  '/api/ai': {
    target: process.env.AI_SERVICE_URL || 'http://ai-service:3003',
    changeOrigin: true,
    pathRewrite: { '^/api/ai': '/api/ai' }
  },
  '/api/diagrams': {
    target: process.env.DIAGRAM_SERVICE_URL || 'http://diagram-service:3004',
    changeOrigin: true,
    pathRewrite: { '^/api/diagrams': '/api/diagrams' }
  },
  '/api/reports': {
    target: process.env.REPORT_SERVICE_URL || 'http://report-service:3005',
    changeOrigin: true,
    pathRewrite: { '^/api/reports': '/api/reports' }
  },
  '/api/integrations': {
    target: process.env.INTEGRATION_SERVICE_URL || 'http://integration-service:3008',
    changeOrigin: true,
    pathRewrite: { '^/api/integrations': '/api/integrations' }
  },
  '/webhooks': {
    target: process.env.INTEGRATION_SERVICE_URL || 'http://integration-service:3008',
    changeOrigin: true,
    pathRewrite: { '^/webhooks': '/webhooks' }
  },
  '/api/tmac': {
    target: process.env.TMAC_SERVICE_URL || 'http://tmac-service:3010',
    changeOrigin: true,
    pathRewrite: { '^/api/tmac': '/api/tmac' }
  }
};

// Setup proxy routes
Object.entries(services).forEach(([path, config]) => {
  app.use(path, createProxyMiddleware({
    ...config,
    onProxyReq: (_proxyReq, req) => {
      logger.info(`Proxying ${req.method} ${req.originalUrl} to ${config.target}`);
    },
    onError: (err, _req, res) => {
      logger.error(`Proxy error: ${err.message}`);
      res.status(502).json({ 
        error: 'Bad Gateway', 
        message: 'Service temporarily unavailable' 
      });
    }
  }));
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// Start server
app.listen(PORT, () => {
  logger.info(`API Gateway running on port ${PORT}`);
  logger.info('Proxying to services:', Object.keys(services));
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});