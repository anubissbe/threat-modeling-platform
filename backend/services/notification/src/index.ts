import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import hpp from 'hpp';
import mongoSanitize from 'express-mongo-sanitize';
import dotenv from 'dotenv';
import { logger, httpLogStream } from './utils/logger';
import { database } from './config/database';
import { redis } from './config/redis';
import { connectWithRetry } from './utils/database-retry';
import eventHandler from './services/event-handler.service';
import queueWorker from './services/queue-worker.service';

// Import routes
import healthRoutes from './routes/health.routes';
import notificationRoutes from './routes/notification.routes';
import templateRoutes from './routes/template.routes';
import preferenceRoutes from './routes/preference.routes';

// Import middleware
import { errorHandler, notFoundHandler, handleUncaughtException, handleUnhandledRejection, handleGracefulShutdown } from './middleware/error-handler';
import { rateLimitMiddleware } from './middleware/rate-limiter';

// Load environment variables
dotenv.config();

// Validate required environment variables with fallbacks
const validateEnvironment = () => {
  const warnings: string[] = [];
  
  // Required variables
  const required = ['JWT_SECRET', 'DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];
  required.forEach(key => {
    if (!process.env[key]) {
      logger.error(`Missing required environment variable: ${key}`);
      process.exit(1);
    }
  });
  
  // Optional notification provider variables with warnings
  const optional = {
    SMTP_FROM: 'Email notifications will not work without SMTP_FROM',
    SLACK_BOT_TOKEN: 'Slack notifications will not work without SLACK_BOT_TOKEN',
    SLACK_SIGNING_SECRET: 'Slack webhook verification will not work without SLACK_SIGNING_SECRET',
    TWILIO_AUTH_TOKEN: 'SMS notifications will not work without TWILIO_AUTH_TOKEN',
    TEAMS_WEBHOOK_URL: 'Microsoft Teams notifications will not work without TEAMS_WEBHOOK_URL',
    WEBHOOK_SECRET: 'Webhook HMAC verification will not work without WEBHOOK_SECRET'
  };
  
  Object.entries(optional).forEach(([key, message]) => {
    if (!process.env[key]) {
      warnings.push(`${key}: ${message}`);
    }
  });
  
  if (warnings.length > 0) {
    logger.warn('Missing optional environment variables:', warnings);
  }
  
  logger.info('Environment validation completed');
};

// Validate environment on startup
validateEnvironment();

// Create Express app
const app = express();
const PORT = process.env['PORT'] || 3009;

// Trust proxy for accurate IP addresses behind load balancers
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// CORS configuration
const corsOptions = {
  origin: (origin: string | undefined, callback: Function) => {
    const allowedOrigins = process.env['ALLOWED_ORIGINS']?.split(',') || [
      'http://localhost:3000',
      'http://localhost:3006',
      'http://localhost:5173',
    ];

    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error('Not allowed by CORS'), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'X-API-Key',
    'X-Service-Token',
    'X-Hub-Signature-256',
  ],
};

app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Data sanitization middleware
app.use(mongoSanitize());
app.use(hpp());

// Request logging middleware
if (process.env['NODE_ENV'] !== 'test') {
  app.use((req, res, next) => {
    const start = Date.now();
    
    res.on('finish', () => {
      const duration = Date.now() - start;
      httpLogStream.write(
        `${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms - ${req.ip}\n`
      );
    });
    
    next();
  });
}

// Global rate limiting
app.use(rateLimitMiddleware);

// Health check route (no auth required)
app.use('/health', healthRoutes);

// API routes
app.use('/api/notifications', notificationRoutes);
app.use('/api/notifications/templates', templateRoutes);
app.use('/api/notifications/preferences', preferenceRoutes);

// Root route
app.get('/', (_req, res) => {
  res.json({
    success: true,
    message: 'Threat Modeling Platform - Notification Service',
    version: process.env['npm_package_version'] || '1.0.0',
    timestamp: new Date().toISOString(),
    documentation: '/api/docs',
  });
});

// API documentation
app.get('/api/docs', (_req, res) => {
  res.json({
    success: true,
    message: 'Notification Service API Documentation',
    endpoints: {
      health: {
        'GET /health': 'Basic health check',
        'GET /health/detailed': 'Detailed health check with metrics',
        'GET /health/ready': 'Kubernetes readiness probe',
        'GET /health/live': 'Kubernetes liveness probe',
      },
      notifications: {
        'POST /api/notifications/send': 'Send immediate notification',
        'POST /api/notifications/schedule': 'Schedule future notification',
        'POST /api/notifications/bulk': 'Send multiple notifications',
        'GET /api/notifications': 'Get notifications for user',
        'GET /api/notifications/:userId': 'Get notifications for specific user',
        'DELETE /api/notifications/:id': 'Cancel scheduled notification',
        'POST /api/notifications/:id/resend': 'Resend failed notification',
        'GET /api/notifications/:userId/stats': 'Get notification statistics',
        'POST /api/notifications/events': 'Process notification event',
      },
      templates: {
        'POST /api/notifications/templates': 'Create notification template',
        'GET /api/notifications/templates': 'Get all templates',
        'GET /api/notifications/templates/:id': 'Get specific template',
        'PUT /api/notifications/templates/:id': 'Update template',
        'DELETE /api/notifications/templates/:id': 'Delete template',
        'POST /api/notifications/templates/:id/preview': 'Preview template',
        'POST /api/notifications/templates/:id/clone': 'Clone template',
      },
      preferences: {
        'POST /api/notifications/preferences': 'Set user preferences',
        'GET /api/notifications/preferences/:userId': 'Get user preferences',
        'PUT /api/notifications/preferences/:userId': 'Update preferences',
        'GET /api/notifications/preferences/defaults': 'Get default preferences',
        'POST /api/notifications/subscriptions': 'Create subscription',
        'GET /api/notifications/subscriptions/:userId': 'Get user subscriptions',
        'PUT /api/notifications/subscriptions/:id': 'Update subscription',
        'DELETE /api/notifications/subscriptions/:id': 'Delete subscription',
        'GET /api/notifications/event-types': 'Get available event types',
      },
    },
  });
});

// Metrics endpoint for Prometheus
app.get('/metrics', (_req, res) => {
  // Basic metrics in Prometheus format
  const metrics = [
    '# HELP notification_service_uptime_seconds Total uptime in seconds',
    '# TYPE notification_service_uptime_seconds counter',
    `notification_service_uptime_seconds ${process.uptime()}`,
    '',
    '# HELP notification_service_memory_usage_bytes Memory usage in bytes',
    '# TYPE notification_service_memory_usage_bytes gauge',
    `notification_service_memory_usage_bytes{type="rss"} ${process.memoryUsage().rss}`,
    `notification_service_memory_usage_bytes{type="heapTotal"} ${process.memoryUsage().heapTotal}`,
    `notification_service_memory_usage_bytes{type="heapUsed"} ${process.memoryUsage().heapUsed}`,
    `notification_service_memory_usage_bytes{type="external"} ${process.memoryUsage().external}`,
    '',
    '# HELP notification_service_info Service information',
    '# TYPE notification_service_info gauge',
    `notification_service_info{version="${process.env['npm_package_version'] || '1.0.0'}",node_version="${process.version}"} 1`,
  ].join('\n');

  res.set('Content-Type', 'text/plain');
  res.send(metrics);
});

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// Global exception handlers
handleUncaughtException();
handleUnhandledRejection();
handleGracefulShutdown();

// Start server
const startServer = async () => {
  try {
    // Wait for database and Redis connections
    logger.info('Waiting for database and Redis connections...');
    
    // Connect to database with retry logic
    await connectWithRetry();
    await redis.connect();
    
    // Test connections
    await database.query('SELECT 1');
    await redis.getClient().ping();
    
    logger.info('Database and Redis connections established');

    // Start background services
    logger.info('Starting background services...');
    await eventHandler.startListening();
    await queueWorker.startWorkers();
    logger.info('Background services started successfully');

    // Start HTTP server
    const server = app.listen(PORT, () => {
      logger.info(`Notification service started on port ${PORT}`, {
        port: PORT,
        environment: process.env['NODE_ENV'] || 'development',
        nodeVersion: process.version,
        platform: process.platform,
        architecture: process.arch,
        processId: process.pid,
      });
    });

    // Handle server shutdown
    const gracefulShutdown = () => {
      logger.info('Starting graceful shutdown...');
      
      server.close(async (err) => {
        if (err) {
          logger.error('Error during server shutdown:', err);
          process.exit(1);
        }

        try {
          // Stop background services
          await eventHandler.stopListening();
          await queueWorker.stopWorkers();
          
          // Close database connection
          await database.disconnect();
          
          // Close Redis connections
          await redis.disconnect();
          
          logger.info('Graceful shutdown completed');
          process.exit(0);
        } catch (shutdownError) {
          logger.error('Error during graceful shutdown:', shutdownError);
          process.exit(1);
        }
      });

      // Force close after 30 seconds
      setTimeout(() => {
        logger.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 30000);
    };

    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);

    return server;
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server if this file is run directly
if (require.main === module) {
  startServer();
}

export { app, startServer };
export default app;