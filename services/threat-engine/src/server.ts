import { createApp } from './app';
import { config } from './config';
import { logger } from './utils/logger';

async function startServer() {
  try {
    const app = await createApp();
    
    await app.listen({
      port: config.PORT,
      host: config.HOST,
    });

    logger.info(`🚀 Threat Engine server started successfully`, {
      port: config.PORT,
      host: config.HOST,
      environment: config.NODE_ENV,
      nodeVersion: process.version,
      processId: process.pid,
    });

    // Log important endpoints
    logger.info('🔗 Available endpoints:', {
      health: `http://${config.HOST}:${config.PORT}/health`,
      api: `http://${config.HOST}:${config.PORT}/api`,
      docs: config.NODE_ENV === 'development' ? `http://${config.HOST}:${config.PORT}/docs` : 'disabled',
    });

    // Performance monitoring
    const memoryUsage = process.memoryUsage();
    logger.info('📊 Initial memory usage:', {
      rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
      heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
      heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
      external: `${Math.round(memoryUsage.external / 1024 / 1024)} MB`,
    });

  } catch (error) {
    logger.error('💥 Failed to start server', { 
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
    });
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('🚨 Unhandled Rejection at:', {
    promise,
    reason: reason instanceof Error ? reason.message : reason,
    stack: reason instanceof Error ? reason.stack : undefined,
  });
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('🚨 Uncaught Exception:', {
    error: error.message,
    stack: error.stack,
  });
  process.exit(1);
});

// Start the server
startServer();