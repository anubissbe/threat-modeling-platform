import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { config } from './config';
import { logger, mlLogger } from './utils/logger';
import { AIOrchestrator } from './services/ai-orchestrator.service';
import { ThreatIntelligenceNLPService } from './services/threat-intelligence-nlp.service';
import { EntityExtractionService } from './services/entity-extraction.service';
import { SentimentAnalysisService } from './services/sentiment-analysis.service';
import { SecurityTextClassifierService } from './services/security-text-classifier.service';
import { AnalysisController } from './controllers/analysis.controller';
import { analysisRoutes } from './routes/analysis.routes';
import { nlpRoutes } from './routes/nlp.routes';
import { optionalAuthMiddleware } from './middleware/auth.middleware';
import { enhancedAIService, createMLOpsMiddleware, getEnhancedHealth } from './mlops-integration';

export async function createApp(): Promise<FastifyInstance> {
  const fastify = Fastify({
    logger: false, // Use our custom logger
    trustProxy: true,
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'requestId',
  });

  try {
    // Initialize AI orchestrator
    const aiOrchestrator = new AIOrchestrator();
    await aiOrchestrator.initialize();

    // Initialize NLP services
    const threatIntelligenceService = new ThreatIntelligenceNLPService();
    const entityExtractionService = new EntityExtractionService();
    const sentimentAnalysisService = new SentimentAnalysisService();
    const textClassifierService = new SecurityTextClassifierService();

    // Initialize MLOps infrastructure
    await enhancedAIService.initialize();

    // Store services in Fastify instance
    fastify.decorate('aiOrchestrator', aiOrchestrator);
    fastify.decorate('mlops', enhancedAIService);
    fastify.decorate('nlpServices', {
      threatIntelligenceService,
      entityExtractionService,
      sentimentAnalysisService,
      textClassifierService
    });

    // Register security plugins
    await fastify.register(helmet, {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
        },
      },
    });

    await fastify.register(cors, {
      origin: (origin, callback) => {
        const allowedOrigins = config.CORS_ORIGINS?.split(',') || ['http://localhost:3000'];
        
        // Allow requests with no origin (mobile apps, postman, etc.)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        
        callback(new Error('Not allowed by CORS'), false);
      },
      credentials: true,
    });

    // Rate limiting
    await fastify.register(rateLimit, {
      max: config.RATE_LIMIT_MAX,
      timeWindow: config.RATE_LIMIT_WINDOW,
      errorResponseBuilder: (request, context) => {
        return {
          success: false,
          error: 'Rate limit exceeded',
          message: 'Too many requests from this IP, please try again later',
          retryAfter: Math.round(context.ttl / 1000),
          statusCode: 429,
          timestamp: new Date(),
        };
      },
    });

    // Request logging
    fastify.addHook('onRequest', async (request, reply) => {
      logger.info('Incoming request', {
        method: request.method,
        url: request.url,
        userAgent: request.headers['user-agent'],
        ip: request.ip,
        requestId: request.id,
      });
    });

    // Optional authentication for all routes
    fastify.addHook('preHandler', optionalAuthMiddleware);

    // Add MLOps middleware
    createMLOpsMiddleware(fastify);

    // Response logging
    fastify.addHook('onResponse', async (request, reply) => {
      const responseTime = reply.getResponseTime();
      
      logger.info('Request completed', {
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        responseTime: `${responseTime}ms`,
        requestId: request.id,
        userId: (request as any).user?.id,
      });

      // Log performance metrics
      if (responseTime > 5000) {
        mlLogger.performanceMetric('slow-request', responseTime, {
          url: request.url,
          method: request.method,
        });
      }
    });

    // Error handling
    fastify.setErrorHandler(async (error, request, reply) => {
      logger.error('Request error', {
        error: error.message,
        stack: config.NODE_ENV === 'development' ? error.stack : undefined,
        method: request.method,
        url: request.url,
        requestId: request.id,
      });

      // Don't expose internal errors in production
      if (config.NODE_ENV === 'production') {
        reply.status(500).send({
          success: false,
          error: 'Internal server error',
          message: 'An unexpected error occurred',
          statusCode: 500,
          requestId: request.id,
          timestamp: new Date(),
        });
      } else {
        reply.status(500).send({
          success: false,
          error: error.message,
          stack: error.stack,
          statusCode: 500,
          requestId: request.id,
          timestamp: new Date(),
        });
      }
    });

    // Not found handler
    fastify.setNotFoundHandler(async (request, reply) => {
      logger.warn('Route not found', {
        method: request.method,
        url: request.url,
        requestId: request.id,
      });

      reply.status(404).send({
        success: false,
        error: 'Route not found',
        message: `The requested endpoint ${request.method} ${request.url} does not exist`,
        statusCode: 404,
        requestId: request.id,
        timestamp: new Date(),
      });
    });

    // Create controller
    const analysisController = new AnalysisController(aiOrchestrator);

    // Register routes
    await fastify.register(async (fastify) => {
      await analysisRoutes(fastify, analysisController);
    }, {
      prefix: '/api/ai',
    });

    // Register NLP routes
    await fastify.register(nlpRoutes, {
      prefix: '/api/ai',
      threatIntelligenceService,
      entityExtractionService,
      sentimentAnalysisService,
      textClassifierService,
    });

    // Register MLOps API endpoints
    await enhancedAIService.registerMLOpsAPI(fastify);

    // Root endpoint
    fastify.get('/', async (request, reply) => {
      reply.send({
        service: 'AI/ML Service',
        version: '1.0.0',
        status: 'running',
        endpoints: {
          analysis: '/api/ai/analyze',
          threats: '/api/ai/predict/threats',
          vulnerabilities: '/api/ai/predict/vulnerabilities',
          mitigations: '/api/ai/mitigations',
          patterns: '/api/ai/patterns',
          intelligence: '/api/ai/intelligence',
          health: '/api/ai/health',
          nlp: {
            threat_intelligence: '/api/ai/nlp/threat-intelligence',
            entity_extraction: '/api/ai/nlp/entity-extraction',
            sentiment_analysis: '/api/ai/nlp/sentiment-analysis',
            text_classification: '/api/ai/nlp/text-classification',
            batch_process: '/api/ai/nlp/batch-process',
            health: '/api/ai/nlp/health'
          }
        },
      });
    });

    // Swagger documentation (development only)
    if (config.NODE_ENV === 'development') {
      await fastify.register(require('@fastify/swagger'), {
        swagger: {
          info: {
            title: 'AI/ML Service API',
            description: 'AI-powered threat analysis and recommendations',
            version: '1.0.0',
          },
          host: `localhost:${config.PORT}`,
          schemes: ['http'],
          consumes: ['application/json'],
          produces: ['application/json'],
          tags: [
            { name: 'Analysis', description: 'Comprehensive AI analysis endpoints' },
            { name: 'Prediction', description: 'Individual model prediction endpoints' },
            { name: 'Mitigation', description: 'Mitigation recommendation endpoints' },
            { name: 'Pattern Recognition', description: 'Pattern detection endpoints' },
            { name: 'Intelligence', description: 'Threat intelligence endpoints' },
            { name: 'NLP', description: 'Natural Language Processing endpoints' },
            { name: 'Threat Intelligence', description: 'NLP-based threat intelligence parsing' },
            { name: 'Entity Extraction', description: 'Security entity extraction from text' },
            { name: 'Sentiment Analysis', description: 'Security-focused sentiment analysis' },
            { name: 'Text Classification', description: 'Security text categorization' },
            { name: 'Batch Processing', description: 'Batch NLP operations' },
            { name: 'Health', description: 'Service health endpoints' },
          ],
          securityDefinitions: {
            Bearer: {
              type: 'apiKey',
              name: 'Authorization',
              in: 'header',
              description: 'Enter: Bearer <token>',
            },
          },
          security: [{ Bearer: [] }],
        },
        exposeRoute: true,
      });

      await fastify.register(require('@fastify/swagger-ui'), {
        routePrefix: '/docs',
        uiConfig: {
          docExpansion: 'list',
          deepLinking: false,
        },
      });

      logger.info('Swagger documentation available at /docs');
    }

    // Graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully`);
      
      try {
        // Shutdown AI orchestrator
        await aiOrchestrator.shutdown();
        
        // Shutdown MLOps
        await enhancedAIService.shutdown();
        
        // Close server
        await fastify.close();
        
        mlLogger.systemShutdown(signal, process.uptime());
        logger.info('Server closed successfully');
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown', { error });
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    logger.info('AI/ML service application initialized successfully');
    
    return fastify;
  } catch (error) {
    logger.error('Failed to initialize application', { error });
    throw error;
  }
}

// Start server if this file is run directly
if (require.main === module) {
  const start = async () => {
    try {
      const app = await createApp();
      
      await app.listen({
        port: config.PORT,
        host: config.HOST,
      });

      logger.info(`🤖 AI/ML Service started`, {
        port: config.PORT,
        host: config.HOST,
        environment: config.NODE_ENV,
        nodeVersion: process.version,
        processId: process.pid,
      });

      // Log available endpoints in development
      if (config.NODE_ENV === 'development') {
        logger.info('🔗 Available endpoints:', {
          analysis: `http://${config.HOST}:${config.PORT}/api/ai/analyze`,
          health: `http://${config.HOST}:${config.PORT}/api/ai/health`,
          docs: `http://${config.HOST}:${config.PORT}/docs`,
        });
      }

    } catch (error) {
      logger.error('💥 Failed to start server', { 
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
      });
      process.exit(1);
    }
  };

  start();
}