import { createApp } from './app';
import { config } from './config';
import { logger, mlLogger } from './utils/logger';

/**
 * Start the AI/ML service server
 */
async function startServer() {
  try {
    // Log startup information
    mlLogger.systemStartup('ai-ml-service', {
      nodeVersion: process.version,
      environment: config.NODE_ENV,
      port: config.PORT,
      features: {
        threatClassification: true,
        vulnerabilityPrediction: true,
        mitigationRecommendation: true,
        patternRecognition: true,
        threatIntelligence: true,
      },
    });

    // Create and start the Fastify app
    const app = await createApp();
    
    await app.listen({
      port: config.PORT,
      host: config.HOST,
    });

    logger.info(`🚀 AI/ML Service is running`, {
      url: `http://${config.HOST}:${config.PORT}`,
      environment: config.NODE_ENV,
      processId: process.pid,
      uptime: process.uptime(),
    });

    // Log available models
    logger.info('🤖 Available ML Models:', {
      models: [
        'Threat Classifier (LSTM)',
        'Vulnerability Predictor (Neural Network + Random Forest)',
        'Mitigation Recommender (NLP)',
        'Pattern Recognizer (LSTM + KNN)',
        'Threat Intelligence (Rule-based + External APIs)',
      ],
    });

    // Development mode information
    if (config.NODE_ENV === 'development') {
      logger.info('📚 API Documentation:', {
        swagger: `http://${config.HOST}:${config.PORT}/docs`,
        endpoints: [
          `POST http://${config.HOST}:${config.PORT}/api/ai/analyze`,
          `POST http://${config.HOST}:${config.PORT}/api/ai/predict/threats`,
          `POST http://${config.HOST}:${config.PORT}/api/ai/predict/vulnerabilities`,
          `POST http://${config.HOST}:${config.PORT}/api/ai/mitigations`,
          `POST http://${config.HOST}:${config.PORT}/api/ai/patterns`,
          `POST http://${config.HOST}:${config.PORT}/api/ai/intelligence`,
          `GET  http://${config.HOST}:${config.PORT}/api/ai/health`,
        ],
      });
    }

  } catch (error) {
    logger.error('💥 Failed to start AI/ML service', { 
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