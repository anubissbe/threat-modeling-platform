import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { logger, requestLogger, complianceLogger } from './utils/logger';
import complianceRoutes from './routes/compliance.routes';

// Load environment variables
dotenv.config();

// Create Express application
const app = express();
const PORT = process.env.PORT || 3003;

// Middleware
app.use(helmet()); // Security headers
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:5173'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  const startTime = Date.now();
  const originalSend = res.send;
  
  res.send = function(data) {
    const duration = Date.now() - startTime;
    const logData = {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      userId: (req as any).user?.id,
      timestamp: new Date().toISOString()
    };
    
    requestLogger.info('HTTP Request', logData);
    
    // Log slow requests
    if (duration > 2000) {
      logger.warn('Slow request detected', logData);
    }
    
    return originalSend.call(this, data);
  };
  
  next();
});

// Health check endpoint (public)
app.get('/health', (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'compliance-service',
    version: process.env.npm_package_version || '1.0.0',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: process.env.NODE_ENV || 'development'
  };
  
  res.json(health);
});

// Detailed health check endpoint
app.get('/health/detailed', (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'compliance-service',
    version: process.env.npm_package_version || '1.0.0',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: process.env.NODE_ENV || 'development',
    features: {
      complianceFrameworks: [
        'GDPR', 'HIPAA', 'SOC2', 'PCI-DSS', 'ISO27001', 
        'NIST', 'OWASP', 'CCPA', 'FedRAMP'
      ],
      assessmentTypes: ['automated', 'manual', 'hybrid', 'external-audit'],
      reportFormats: ['PDF', 'HTML', 'Excel', 'CSV', 'JSON', 'XML'],
      integrations: ['threat-modeling-platform', 'audit-systems'],
      security: ['JWT authentication', 'rate limiting', 'input validation']
    },
    configuration: {
      logLevel: process.env.LOG_LEVEL || 'info',
      enableAutomatedAssessments: process.env.ENABLE_AUTOMATED_ASSESSMENTS !== 'false',
      enableReportGeneration: process.env.ENABLE_REPORT_GENERATION !== 'false',
      enableRealTimeMonitoring: process.env.ENABLE_REAL_TIME_MONITORING !== 'false'
    }
  };
  
  res.json(health);
});

// Readiness check for Kubernetes
app.get('/health/ready', (req, res) => {
  // In production, this would check database connectivity, external services, etc.
  const isReady = true; // Placeholder for actual readiness checks
  
  if (isReady) {
    res.status(200).json({ status: 'ready' });
  } else {
    res.status(503).json({ status: 'not ready' });
  }
});

// Liveness check for Kubernetes
app.get('/health/live', (req, res) => {
  res.status(200).json({ status: 'alive' });
});

// API routes
app.use('/api/compliance', complianceRoutes);

// API documentation endpoint
app.get('/api/docs', (req, res) => {
  const documentation = {
    service: 'Compliance & Regulatory Integration Service',
    version: '1.0.0',
    description: 'Comprehensive compliance management system supporting multiple regulatory frameworks',
    endpoints: {
      compliance: {
        dashboard: 'GET /api/compliance/dashboard/:organizationId',
        controls: {
          list: 'GET /api/compliance/controls',
          get: 'GET /api/compliance/controls/:controlId',
          update: 'PUT /api/compliance/controls/:controlId',
          byFramework: 'GET /api/compliance/frameworks/:framework/controls'
        },
        assessments: {
          create: 'POST /api/compliance/assessments',
          list: 'GET /api/compliance/assessments',
          get: 'GET /api/compliance/assessments/:assessmentId',
          execute: 'POST /api/compliance/assessments/:assessmentId/execute'
        },
        remediation: {
          create: 'POST /api/compliance/remediation-plans',
          get: 'GET /api/compliance/remediation-plans/:planId'
        },
        reports: {
          generate: 'POST /api/compliance/reports',
          list: 'GET /api/compliance/reports',
          get: 'GET /api/compliance/reports/:reportId',
          download: 'GET /api/compliance/reports/:reportId/download',
          delete: 'DELETE /api/compliance/reports/:reportId'
        },
        metadata: {
          frameworks: 'GET /api/compliance/frameworks',
          statistics: 'GET /api/compliance/statistics',
          events: 'GET /api/compliance/events'
        }
      },
      health: {
        basic: 'GET /health',
        detailed: 'GET /health/detailed',
        ready: 'GET /health/ready',
        live: 'GET /health/live'
      }
    },
    authentication: {
      type: 'JWT Bearer Token',
      header: 'Authorization: Bearer <token>',
      scopes: ['compliance:read', 'compliance:write', 'compliance:admin']
    },
    supportedFrameworks: [
      'GDPR - General Data Protection Regulation',
      'HIPAA - Health Insurance Portability and Accountability Act',
      'SOC2 - Service Organization Control 2',
      'PCI-DSS - Payment Card Industry Data Security Standard',
      'ISO27001 - Information Security Management',
      'NIST - National Institute of Standards and Technology',
      'OWASP - Open Web Application Security Project',
      'CCPA - California Consumer Privacy Act',
      'FedRAMP - Federal Risk and Authorization Management Program'
    ]
  };
  
  res.json(documentation);
});

// Error handling middleware
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack
    },
    request: {
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: req.body
    }
  });
  
  res.status(error.status || 500).json({
    success: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred',
    requestId: req.headers['x-request-id'] || 'unknown'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not found',
    message: `Route ${req.method} ${req.originalUrl} not found`
  });
});

// Graceful shutdown handling
const gracefulShutdown = (signal: string) => {
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  
  server.close(() => {
    logger.info('HTTP server closed');
    
    // Close database connections, cleanup resources, etc.
    process.exit(0);
  });
  
  // Force shutdown after 10 seconds
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

// Start server
const server = app.listen(PORT, () => {
  logger.info(`Compliance service started successfully`, {
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0'
  });
  
  complianceLogger.configurationChanged('system', 'service_startup', null, {
    port: PORT,
    environment: process.env.NODE_ENV || 'development'
  });
});

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

export default app;