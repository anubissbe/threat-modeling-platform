import { build } from './app';
import { config } from './config';
import { logger } from './utils/logger';

const start = async (): Promise<void> => {
  try {
    const app = await build({
      logger: {
        level: config.LOG_LEVEL,
        serializers: {
          req: (req) => ({
            method: req.method,
            url: req.url,
            headers: {
              host: req.headers.host,
              'user-agent': req.headers['user-agent'],
              'content-type': req.headers['content-type'],
            },
          }),
          res: (res) => ({
            statusCode: res.statusCode,
          }),
        },
      },
      disableRequestLogging: false,
      requestIdHeader: 'x-request-id',
      requestIdLogLabel: 'reqId',
    });

    // Graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully`);
      
      try {
        await app.close();
        logger.info('Server closed successfully');
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.fatal('Uncaught exception:', error);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.fatal('Unhandled rejection at:', promise, 'reason:', reason);
      process.exit(1);
    });

    // Start server
    await app.listen({
      port: config.PORT,
      host: config.HOST,
    });

    logger.info(
      `🚀 User Service v${config.SERVICE_VERSION} started on ${config.HOST}:${config.PORT}`
    );
    logger.info(`Environment: ${config.NODE_ENV}`);
    logger.info(`OpenAPI docs available at: http://${config.HOST}:${config.PORT}/docs`);
    
  } catch (error) {
    logger.fatal('Failed to start server:', error);
    process.exit(1);
  }
};

start();