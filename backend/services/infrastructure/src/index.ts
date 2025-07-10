import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { logger } from './utils/logger';
import { InfrastructureService } from './services/infrastructure.service';
import { LoadBalancerService } from './services/load-balancer.service';
import { CacheService } from './services/cache.service';
import { InfrastructureController } from './controllers/infrastructure.controller';
import { createInfrastructureRoutes } from './routes/infrastructure.routes';
import { InfrastructureConfig } from './types/infrastructure';

// Load environment variables
const PORT = process.env.PORT || 3006;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Default configuration
const defaultConfig: InfrastructureConfig = {
  cluster: {
    enabled: true,
    workerCount: 4,
    maxRestarts: 3,
    restartDelay: 1000,
    gracefulShutdownTimeout: 30000,
    healthCheckInterval: 30000,
    autoRestart: true,
    logLevel: 'info'
  },
  loadBalancer: {
    algorithm: 'round-robin',
    healthCheck: {
      enabled: true,
      interval: 10000,
      timeout: 5000,
      path: '/health',
      unhealthyThreshold: 3,
      healthyThreshold: 2
    },
    sticky: false,
    compression: true,
    ssl: {
      enabled: false,
      protocols: ['TLSv1.2', 'TLSv1.3']
    },
    rateLimiting: {
      enabled: true,
      windowMs: 15 * 60 * 1000,
      maxRequests: 100,
      skipSuccessfulRequests: false
    }
  },
  cache: {
    redis: {
      enabled: true,
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      database: 0,
      keyPrefix: 'threat-modeling:',
      ttl: 3600,
      maxRetries: 3,
      retryDelayOnFailover: 100
    },
    memory: {
      enabled: true,
      maxSize: 10000,
      ttl: 3600,
      checkPeriod: 60000
    },
    distributed: {
      enabled: false,
      consistentHashing: true,
      replicationFactor: 2
    }
  },
  queue: {
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      database: 1
    },
    concurrency: 10,
    retryAttempts: 3,
    retryDelay: 1000,
    removeOnComplete: 100,
    removeOnFail: 50,
    defaultJobOptions: {
      removeOnComplete: 100,
      removeOnFail: 50,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000
      }
    }
  },
  monitoring: {
    prometheus: {
      enabled: true,
      port: 9090,
      path: '/metrics',
      collectDefaultMetrics: true
    },
    healthChecks: {
      enabled: true,
      interval: 30000,
      timeout: 5000,
      services: ['auth', 'core', 'ai', 'compliance', 'nlp', 'reporting']
    },
    alerts: {
      enabled: true,
      thresholds: {
        cpuUsage: 80,
        memoryUsage: 85,
        diskUsage: 90,
        responseTime: 1000,
        errorRate: 5
      }
    },
    logging: {
      level: 'info',
      format: 'json',
      maxSize: '20m',
      maxFiles: 14,
      datePattern: 'YYYY-MM-DD'
    }
  },
  storage: {
    type: 'local',
    local: {
      path: './storage',
      maxSize: 1073741824 // 1GB
    }
  },
  security: {
    authentication: {
      enabled: true,
      algorithm: 'RS256',
      expiresIn: '24h'
    },
    authorization: {
      enabled: true,
      roles: ['admin', 'user', 'readonly'],
      permissions: {
        admin: ['*'],
        user: ['read', 'write'],
        readonly: ['read']
      }
    },
    encryption: {
      enabled: true,
      algorithm: 'aes-256-gcm',
      keyRotationInterval: 86400000 // 24 hours
    },
    rateLimit: {
      windowMs: 15 * 60 * 1000,
      maxRequests: 100,
      skipSuccessfulRequests: false,
      keyGenerator: (req) => req.ip || 'unknown'
    }
  },
  scaling: {
    autoScaling: {
      enabled: true,
      minInstances: 2,
      maxInstances: 10,
      targetCpuPercent: 70,
      targetMemoryPercent: 80,
      scaleUpCooldown: 300000, // 5 minutes
      scaleDownCooldown: 600000 // 10 minutes
    },
    horizontal: {
      enabled: true,
      strategy: 'cpu',
      thresholds: {
        scaleUp: 80,
        scaleDown: 30
      }
    },
    vertical: {
      enabled: false,
      maxCpu: '2000m',
      maxMemory: '4Gi',
      minCpu: '100m',
      minMemory: '256Mi'
    }
  }
};

async function startServer() {
  try {
    // Initialize services
    const infrastructureService = new InfrastructureService(defaultConfig);
    const loadBalancerService = new LoadBalancerService(defaultConfig.loadBalancer);
    const cacheService = new CacheService(defaultConfig.cache);

    // Add default servers to load balancer
    loadBalancerService.addServer('localhost', 3000, 1); // Core service
    loadBalancerService.addServer('localhost', 3001, 1); // Auth service
    loadBalancerService.addServer('localhost', 3002, 1); // AI service
    loadBalancerService.addServer('localhost', 3003, 1); // Compliance service
    loadBalancerService.addServer('localhost', 3004, 1); // NLP service
    loadBalancerService.addServer('localhost', 3005, 1); // Reporting service

    // Create controller
    const controller = new InfrastructureController(
      infrastructureService,
      loadBalancerService,
      cacheService
    );

    // Create Express app
    const app = express();

    // Security middleware
    app.use(helmet());
    app.use(cors({
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
      credentials: true
    }));

    // Compression middleware
    app.use(compression());

    // Body parsing middleware
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Routes
    app.use('/api/infrastructure', createInfrastructureRoutes(controller));

    // Health check endpoint
    app.get('/health', async (req, res) => {
      try {
        const health = await infrastructureService.getHealthStatus();
        res.json({
          status: 'healthy',
          timestamp: new Date(),
          version: process.env.npm_package_version || '1.0.0',
          environment: NODE_ENV,
          uptime: process.uptime(),
          infrastructure: health
        });
      } catch (error) {
        logger.error('Health check failed', error);
        res.status(500).json({
          status: 'unhealthy',
          timestamp: new Date(),
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Error handling middleware
    app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
      logger.error('Unhandled error', error);
      
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        timestamp: new Date(),
        requestId: (req as any).requestId
      });
    });

    // 404 handler
    app.use((req, res) => {
      res.status(404).json({
        success: false,
        error: 'Not found',
        timestamp: new Date(),
        requestId: (req as any).requestId
      });
    });

    // Start server
    const server = app.listen(PORT, () => {
      logger.info(`Infrastructure service started`, {
        port: PORT,
        environment: NODE_ENV,
        pid: process.pid,
        cluster: defaultConfig.cluster.enabled,
        loadBalancer: defaultConfig.loadBalancer.algorithm,
        cache: defaultConfig.cache.redis.enabled ? 'redis' : 'memory'
      });
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received, shutting down gracefully');
      server.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      logger.info('SIGINT received, shutting down gracefully');
      server.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled promise rejection', { reason, promise });
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception', error);
      process.exit(1);
    });

  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
}

// Start the server
startServer();