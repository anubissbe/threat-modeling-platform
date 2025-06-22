import { config } from './config';
import { logger } from './utils/logger';
import { createApp, setupProcessHandlers } from './app';

async function startServer(): Promise<void> {
  try {
    logger.info('Starting file service...', {
      env: config.NODE_ENV,
      port: config.PORT,
      host: config.HOST,
      storage: config.STORAGE_PROVIDER,
      maxFileSize: config.MAX_FILE_SIZE,
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

    logger.info(`🚀 File service started successfully!`, {
      port: config.PORT,
      host: config.HOST,
      env: config.NODE_ENV,
      docs: `http://${config.HOST}:${config.PORT}/documentation`,
      storage: config.STORAGE_PROVIDER,
      maxFileSize: `${Math.round(config.MAX_FILE_SIZE / 1024 / 1024)}MB`,
    });

  } catch (error) {
    logger.fatal('Failed to start file service:', error);
    process.exit(1);
  }
}

// Start the server
startServer();