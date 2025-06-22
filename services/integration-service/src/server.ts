#!/usr/bin/env node

import { createApp } from './app';
import { config } from './config';
import { logger, serviceLogger } from './utils/logger';

/**
 * Start the Integration Service server
 */
async function startServer(): Promise<void> {
  try {
    logger.info('🚀 Starting Integration Service...', {
      environment: config.NODE_ENV,
      port: config.PORT,
      host: config.HOST,
      nodeVersion: process.version,
      processId: process.pid,
    });

    // Create the Fastify application
    const app = await createApp();

    // Start listening
    await app.listen({
      port: config.PORT,
      host: config.HOST,
    });

    logger.info('✅ Integration Service started successfully', {
      port: config.PORT,
      host: config.HOST,
      environment: config.NODE_ENV,
      uptime: process.uptime(),
    });

    // Log service information
    serviceLogger.systemStartup(
      config.PORT,
      config.NODE_ENV,
      0 // Will be updated by service discovery
    );

    // Log available endpoints in development
    if (config.NODE_ENV === 'development') {
      const baseUrl = `http://${config.HOST}:${config.PORT}`;
      
      logger.info('📋 Available endpoints:', {
        health: `${baseUrl}/system/health`,
        services: `${baseUrl}/system/services`,
        metrics: `${baseUrl}/system/metrics`,
        circuitBreakers: `${baseUrl}/system/circuit-breakers`,
        loadBalancer: `${baseUrl}/system/load-balancer`,
        docs: `${baseUrl}/docs`,
      });

      logger.info('🔗 Gateway routes will be dynamically registered based on discovered services');
    }

  } catch (error) {
    logger.error('💥 Failed to start Integration Service', {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
    });

    process.exit(1);
  }
}

/**
 * Handle unhandled promise rejections
 */
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Promise Rejection', {
    reason,
    promise,
  });
  
  // Don't crash on unhandled rejections in production
  if (config.NODE_ENV === 'development') {
    process.exit(1);
  }
});

/**
 * Handle uncaught exceptions
 */
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', {
    error: error.message,
    stack: error.stack,
  });
  
  // Always exit on uncaught exceptions
  process.exit(1);
});

/**
 * Handle process warnings
 */
process.on('warning', (warning) => {
  logger.warn('Process Warning', {
    name: warning.name,
    message: warning.message,
    stack: warning.stack,
  });
});

// Start the server
if (require.main === module) {
  startServer();
}

export { startServer };