import { createApp } from './app';
import { config } from './config';
import { logger } from './utils/logger';

/**
 * Start the report service server
 */
async function startServer() {
  try {
    // Log startup information
    logger.info('Starting Report Generation Service', {
      nodeVersion: process.version,
      environment: config.NODE_ENV,
      port: config.PORT,
      storageType: config.STORAGE_TYPE,
    });

    // Create and start the Fastify app
    const app = await createApp();
    
    await app.listen({
      port: config.PORT,
      host: config.HOST,
    });

    logger.info(`🚀 Report Service is running`, {
      url: `http://${config.HOST}:${config.PORT}`,
      environment: config.NODE_ENV,
      processId: process.pid,
      uptime: process.uptime(),
    });

    // Log service features
    logger.info('📊 Service Features:', {
      features: [
        'PDF Report Generation',
        'HTML Report Generation',
        'Markdown Report Export',
        'Chart Generation',
        'Queue-based Processing',
        'S3/Local Storage',
        'JWT Authentication',
      ],
    });

    // Development mode information
    if (config.NODE_ENV === 'development') {
      logger.info('📚 API Documentation:', {
        swagger: `http://${config.HOST}:${config.PORT}/docs`,
        endpoints: [
          `POST http://${config.HOST}:${config.PORT}/api/reports/generate`,
          `GET  http://${config.HOST}:${config.PORT}/api/reports/status/:jobId`,
          `GET  http://${config.HOST}:${config.PORT}/api/reports/download/:reportId`,
          `GET  http://${config.HOST}:${config.PORT}/api/reports`,
          `GET  http://${config.HOST}:${config.PORT}/api/reports/health`,
        ],
      });
    }

  } catch (error) {
    logger.error('💥 Failed to start Report Service', { 
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
    });
    
    // Exit with error code
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', {
    error: error.message,
    stack: error.stack,
  });
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', {
    reason,
    promise,
  });
  process.exit(1);
});

// Start the server
startServer();