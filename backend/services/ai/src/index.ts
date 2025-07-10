import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { Pool } from 'pg';
import { createClient, RedisClientType } from 'redis';
import dotenv from 'dotenv';
import { logger, healthLogger, requestLogger, errorLogger } from './utils/logger';
import { createAIRoutes } from './routes/ai.routes';
import { globalRateLimit } from './middleware/rate-limit.middleware';
import { validateRequestMiddleware } from './middleware/validation.middleware';

// Load environment variables
dotenv.config();

// Application configuration
const config = {
  port: parseInt(process.env.PORT || '3003'),
  host: process.env.HOST || '0.0.0.0',
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:5173'],
  
  // Database configuration
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'threatmodel_db',
    user: process.env.DB_USER || 'threatmodel',
    password: process.env.DB_PASSWORD || 'threatmodel123',
    ssl: process.env.DB_SSL === 'true',
    max: parseInt(process.env.DB_POOL_SIZE || '20'),
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '2000')
  },
  
  // Redis configuration
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0')
  }
};

class AIService {
  private app: express.Application;
  private server: any;
  private db!: Pool;
  private redis!: RedisClientType;

  constructor() {
    this.app = express();
    this.initializeMiddleware();
  }

  /**
   * Initialize Express middleware
   */
  private initializeMiddleware(): void {
    // Security middleware
    this.app.use(helmet({
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
          frameSrc: ["'none'"]
        }
      },
      crossOriginEmbedderPolicy: false
    }));

    // CORS configuration
    this.app.use(cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        
        if (config.corsOrigins.indexOf(origin) !== -1 || config.nodeEnv === 'development') {
          return callback(null, true);
        }
        
        const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
        return callback(new Error(msg), false);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
    }));

    // Request parsing middleware
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request logging
    this.app.use(requestLogger);

    // Global rate limiting (exclude health checks)
    this.app.use((req, res, next) => {
      if (req.path === '/health' || req.path === '/metrics') {
        return next();
      }
      return globalRateLimit(req, res, next);
    });

    // Request validation
    this.app.use(validateRequestMiddleware);

    // Trust proxy for accurate IP addresses
    this.app.set('trust proxy', 1);
  }

  /**
   * Initialize database connection
   */
  private async initializeDatabase(): Promise<void> {
    try {
      this.db = new Pool(config.database);
      
      // Test connection
      await this.db.query('SELECT NOW()');
      
      // Create necessary tables if they don't exist
      await this.createTables();
      
      healthLogger.databaseConnection('connected');
      logger.info('Database connection established');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      healthLogger.databaseConnection('error', errorMessage);
      logger.error('Failed to connect to database:', error);
      throw error;
    }
  }

  /**
   * Initialize Redis connection
   */
  private async initializeRedis(): Promise<void> {
    try {
      const redisConfig: any = {
        socket: {
          host: config.redis.host,
          port: config.redis.port
        },
        database: config.redis.db
      };
      
      if (config.redis.password) {
        redisConfig.password = config.redis.password;
      }
      
      this.redis = createClient(redisConfig);

      this.redis.on('error', (err: Error) => {
        healthLogger.redisConnection('error', err.message);
        logger.error('Redis client error:', err);
      });

      this.redis.on('connect', () => {
        healthLogger.redisConnection('connected');
        logger.info('Redis connection established');
      });

      this.redis.on('disconnect', () => {
        healthLogger.redisConnection('disconnected');
        logger.warn('Redis connection lost');
      });

      await this.redis.connect();
      
      // Store Redis client globally for middleware access
      this.app.locals['redis'] = this.redis;
      global.redisClient = this.redis;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      healthLogger.redisConnection('error', errorMessage);
      logger.error('Failed to connect to Redis:', error);
      throw error;
    }
  }

  /**
   * Create necessary database tables
   */
  private async createTables(): Promise<void> {
    const createTablesSQL = `
      -- Threat intelligence table
      CREATE TABLE IF NOT EXISTS threat_intelligence (
        id VARCHAR(255) PRIMARY KEY,
        source VARCHAR(255) NOT NULL,
        threat_type VARCHAR(100) NOT NULL,
        indicators JSONB NOT NULL,
        severity VARCHAR(20) NOT NULL,
        confidence DECIMAL(3,2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
        first_seen TIMESTAMP NOT NULL,
        last_seen TIMESTAMP NOT NULL,
        geographic_regions TEXT[],
        industry_sectors TEXT[],
        description TEXT,
        reference_urls TEXT[],
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      -- AI analysis results table
      CREATE TABLE IF NOT EXISTS ai_analysis_results (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        analysis_id VARCHAR(255) UNIQUE NOT NULL,
        threat_model_id UUID NOT NULL,
        user_id UUID NOT NULL,
        methodology VARCHAR(50) NOT NULL,
        analysis_depth VARCHAR(20) NOT NULL,
        analysis_results JSONB NOT NULL,
        confidence_score DECIMAL(3,2),
        processing_time_ms INTEGER,
        created_at TIMESTAMP DEFAULT NOW()
      );

      -- Create indexes for better performance
      CREATE INDEX IF NOT EXISTS idx_threat_intelligence_type ON threat_intelligence(threat_type);
      CREATE INDEX IF NOT EXISTS idx_threat_intelligence_severity ON threat_intelligence(severity);
      CREATE INDEX IF NOT EXISTS idx_threat_intelligence_last_seen ON threat_intelligence(last_seen);
      CREATE INDEX IF NOT EXISTS idx_ai_analysis_threat_model ON ai_analysis_results(threat_model_id);
      CREATE INDEX IF NOT EXISTS idx_ai_analysis_user ON ai_analysis_results(user_id);
      CREATE INDEX IF NOT EXISTS idx_ai_analysis_created ON ai_analysis_results(created_at);

      -- Update triggers for updated_at
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ language 'plpgsql';

      DROP TRIGGER IF EXISTS update_threat_intelligence_updated_at ON threat_intelligence;
      CREATE TRIGGER update_threat_intelligence_updated_at 
        BEFORE UPDATE ON threat_intelligence 
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `;

    await this.db.query(createTablesSQL);
    logger.info('Database tables created/verified');
  }

  /**
   * Initialize routes
   */
  private initializeRoutes(): void {
    // Health check endpoint
    this.app.get('/health', async (req, res) => {
      try {
        // Check database
        await this.db.query('SELECT 1');
        
        // Check Redis
        await this.redis.ping();

        res.json({
          status: 'healthy',
          service: 'ai-service',
          version: process.env.SERVICE_VERSION || '1.0.0',
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          environment: config.nodeEnv
        });
      } catch (error) {
        logger.error('Health check failed:', error);
        res.status(503).json({
          status: 'unhealthy',
          service: 'ai-service',
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    });

    // Metrics endpoint for Prometheus
    this.app.get('/metrics', (req, res) => {
      // Basic Prometheus-style metrics
      const metrics = [
        '# HELP ai_service_uptime_seconds Total uptime of the AI service',
        '# TYPE ai_service_uptime_seconds counter',
        `ai_service_uptime_seconds ${process.uptime()}`,
        '',
        '# HELP ai_service_memory_usage_bytes Memory usage in bytes',
        '# TYPE ai_service_memory_usage_bytes gauge',
        `ai_service_memory_usage_bytes{type="rss"} ${process.memoryUsage().rss}`,
        `ai_service_memory_usage_bytes{type="heapTotal"} ${process.memoryUsage().heapTotal}`,
        `ai_service_memory_usage_bytes{type="heapUsed"} ${process.memoryUsage().heapUsed}`,
        '',
        '# HELP ai_service_nodejs_version Node.js version info',
        '# TYPE ai_service_nodejs_version gauge',
        `ai_service_nodejs_version{version="${process.version}"} 1`
      ].join('\n');

      res.set('Content-Type', 'text/plain');
      res.send(metrics);
    });

    // API routes
    this.app.use('/api/ai', createAIRoutes(this.db, this.redis));

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Endpoint not found'
        }
      });
    });

    // Error handler
    this.app.use(errorLogger);
    this.app.use((err: any, req: any, res: any, next: any) => {
      res.status(err.status || 500).json({
        success: false,
        error: {
          code: err.code || 'INTERNAL_ERROR',
          message: config.nodeEnv === 'production' ? 
            'An internal error occurred' : 
            err.message
        }
      });
    });
  }

  /**
   * Start the service
   */
  async start(): Promise<void> {
    try {
      // Initialize connections
      await this.initializeDatabase();
      await this.initializeRedis();

      // Initialize routes
      this.initializeRoutes();

      // Start server
      this.server = this.app.listen(config.port, config.host, () => {
        healthLogger.serviceStartup(config.port);
        logger.info(`AI service started on ${config.host}:${config.port}`);
        logger.info(`Environment: ${config.nodeEnv}`);
        logger.info(`CORS origins: ${config.corsOrigins.join(', ')}`);
      });

      // Graceful shutdown handling
      this.setupGracefulShutdown();

    } catch (error) {
      logger.error('Failed to start AI service:', error);
      process.exit(1);
    }
  }

  /**
   * Setup graceful shutdown
   */
  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}. Starting graceful shutdown...`);
      healthLogger.serviceShutdown();

      try {
        // Close server
        if (this.server) {
          await new Promise<void>((resolve) => {
            this.server.close(() => {
              logger.info('HTTP server closed');
              resolve();
            });
          });
        }

        // Close database connections
        if (this.db) {
          await this.db.end();
          logger.info('Database connections closed');
        }

        // Close Redis connection
        if (this.redis) {
          await this.redis.quit();
          logger.info('Redis connection closed');
        }

        logger.info('Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception:', error);
      shutdown('uncaughtException');
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled rejection at:', promise, 'reason:', reason);
      shutdown('unhandledRejection');
    });
  }
}

// Start the service
const aiService = new AIService();
aiService.start().catch((error) => {
  logger.error('Failed to start AI service:', error);
  process.exit(1);
});