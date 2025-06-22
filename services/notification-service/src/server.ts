import { config } from './config';
import { logger } from './utils/logger';
import { createApp, setupProcessHandlers } from './app';

async function startServer(): Promise<void> {
  try {
    logger.info('Starting notification service...', {
      env: config.NODE_ENV,
      port: config.PORT,
      host: config.HOST,
    });

    // Create and configure the application
    const app = await createApp();

    // Setup process signal handlers
    setupProcessHandlers(app);

    // Start the server
    await app.listen({
      port: config.PORT,
      host: config.HOST,
    });

    logger.info(`🚀 Notification service started successfully!`, {
      port: config.PORT,
      host: config.HOST,
      env: config.NODE_ENV,
      docs: `http://${config.HOST}:${config.PORT}/documentation`,
    });

  } catch (error) {
    logger.fatal('Failed to start notification service:', error);
    process.exit(1);
  }
}

// Start the server
startServer();