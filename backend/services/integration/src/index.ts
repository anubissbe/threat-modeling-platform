import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import { createHealthRouter } from './routes/health';
import { createIntegrationRouter } from './routes/integrations';
import { createWebhookRouter } from './routes/webhooks';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import { rateLimiter } from './middleware/rate-limiter';
import { logger } from './utils/logger';
import { initializeDatabase } from './config/database';
import { initializeRedis } from './config/redis';
import { SyncService } from './services/sync.service';
import { IntegrationEventBus } from './services/event-bus.service';

dotenv.config();

const app = express();
const PORT = process.env['PORT'] || 3008;

// Initialize services
let syncService: SyncService;
let eventBus: IntegrationEventBus;

async function startServer() {
  try {
    // Initialize database
    await initializeDatabase();
    logger.info('Database initialized');

    // Initialize Redis
    const redis = await initializeRedis();
    logger.info('Redis initialized');

    // Initialize event bus
    eventBus = new IntegrationEventBus(redis);
    await eventBus.initialize();
    logger.info('Event bus initialized');

    // Initialize sync service
    syncService = new SyncService(eventBus);
    await syncService.initialize();
    logger.info('Sync service initialized');

    // Security middleware
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

    // Secure CORS configuration
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
          ...(process.env['ALLOWED_ORIGINS']?.split(',') || [])
        ];
        
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'), false);
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Webhook-Signature', 'X-Requested-With'],
      exposedHeaders: ['X-Total-Count', 'X-RateLimit-Limit', 'X-RateLimit-Remaining'],
      maxAge: 86400
    };

    app.use(cors(corsOptions));

    // Body parsing
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    app.use(express.raw({ type: 'application/json', limit: '10mb' })); // For webhook raw body

    // Trust proxy
    app.set('trust proxy', 1);

    // Routes - Health check before rate limiting
    app.use('/health', createHealthRouter());

    // Global rate limiting (after health check)
    app.use(rateLimiter);
    app.use('/api/integrations', createIntegrationRouter(eventBus));
    
    // Webhook routes with specific CORS configuration
    const webhookCorsOptions = {
      ...corsOptions,
      methods: ['POST', 'OPTIONS'], // Only allow POST for webhooks
      allowedHeaders: [...corsOptions.allowedHeaders, 'X-GitHub-Delivery', 'X-GitHub-Event', 'X-Hub-Signature']
    };
    
    app.use('/webhooks', cors(webhookCorsOptions), createWebhookRouter(eventBus));

    // 404 handler
    app.use(notFoundHandler);

    // Error handling
    app.use(errorHandler);

    // Start server
    const server = app.listen(PORT, () => {
      logger.info(`Integration service listening on port ${PORT}`);
    });

    // Graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      logger.info(`${signal} received, shutting down gracefully`);
      
      // Stop accepting new connections
      server.close(() => {
        logger.info('HTTP server closed');
      });

      // Stop sync service
      if (syncService) {
        await syncService.shutdown();
        logger.info('Sync service stopped');
      }

      // Stop event bus
      if (eventBus) {
        await eventBus.shutdown();
        logger.info('Event bus stopped');
      }

      // Close database connections
      const { pool } = await import('./config/database');
      await pool.end();
      logger.info('Database connections closed');

      // Close Redis connections
      const { redisClient } = await import('./config/redis');
      await redisClient.quit();
      logger.info('Redis connections closed');

      process.exit(0);
    };

    // Register shutdown handlers
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2')); // For nodemon

    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
      process.exit(1);
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();