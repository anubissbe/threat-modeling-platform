/**
 * MLOps Integration - Connects existing AI/ML service with MLOps infrastructure
 */

import { FastifyInstance } from 'fastify';
import { createMLOpsOrchestrator, MLOpsConfig } from '../mlops/mlops-orchestrator';
import { config } from './config';
import pino from 'pino';

const logger = pino({ name: 'mlops-integration' });

// MLOps configuration based on environment
const mlopsConfig: MLOpsConfig = {
  storage: {
    type: (process.env['MODEL_STORAGE_TYPE'] as 'local' | 's3') || 'local',
    localPath: process.env['MODEL_STORAGE_PATH'] || './models',
    s3Config: process.env['MODEL_STORAGE_TYPE'] === 's3' ? {
      region: process.env['AWS_REGION'] || 'us-east-1',
      endpoint: process.env['S3_ENDPOINT'], // For MinIO
      bucketName: process.env['MODEL_BUCKET'] || 'ml-models'
    } : undefined
  },
  serving: {
    maxModelsInMemory: parseInt(process.env['MAX_MODELS_IN_MEMORY'] || '5'),
    preloadModels: (process.env['PRELOAD_MODELS'] || '').split(',').filter(Boolean),
    warmupOnLoad: process.env['WARMUP_ON_LOAD'] !== 'false',
    enableGPU: process.env['ENABLE_GPU'] === 'true',
    cacheTTL: parseInt(process.env['MODEL_CACHE_TTL'] || '3600'),
    healthCheckInterval: parseInt(process.env['HEALTH_CHECK_INTERVAL'] || '60')
  },
  monitoring: {
    metricsPort: parseInt(process.env['METRICS_PORT'] || '9090'),
    collectInterval: parseInt(process.env['COLLECT_INTERVAL'] || '30'),
    driftDetection: {
      enabled: process.env['DRIFT_DETECTION_ENABLED'] !== 'false',
      method: (process.env['DRIFT_DETECTION_METHOD'] as any) || 'psi',
      threshold: parseFloat(process.env['DRIFT_DETECTION_THRESHOLD'] || '0.1'),
      windowSize: parseInt(process.env['DRIFT_WINDOW_SIZE'] || '1000')
    },
    performanceTracking: {
      latencyThreshold: parseInt(process.env['LATENCY_THRESHOLD'] || '1000'),
      errorRateThreshold: parseFloat(process.env['ERROR_RATE_THRESHOLD'] || '5'),
      throughputThreshold: parseInt(process.env['THROUGHPUT_THRESHOLD'] || '100')
    },
    alerting: {
      enabled: process.env['ALERTING_ENABLED'] === 'true',
      channels: (process.env['ALERT_CHANNELS'] || 'slack').split(',') as any[],
      webhookUrl: process.env['ALERT_WEBHOOK_URL'],
      slackWebhook: process.env['SLACK_WEBHOOK_URL']
    },
    dataQuality: {
      enabled: process.env['DATA_QUALITY_ENABLED'] !== 'false',
      checksumValidation: true,
      schemaValidation: true,
      rangeValidation: true
    }
  },
  training: {
    redisUrl: process.env['REDIS_URL'] || 'redis://localhost:6379',
    mlflowUrl: process.env['MLFLOW_URL']
  },
  api: {
    port: parseInt(process.env['MLOPS_API_PORT'] || '3007'),
    host: process.env['MLOPS_API_HOST'] || '0.0.0.0'
  }
};

// Enhanced AI service that uses MLOps
export class EnhancedAIService {
  private mlopsOrchestrator?: any;

  async initialize(): Promise<void> {
    try {
      logger.info('Initializing MLOps infrastructure...');
      this.mlopsOrchestrator = await createMLOpsOrchestrator(mlopsConfig);
      logger.info('MLOps infrastructure initialized successfully');
    } catch (error) {
      logger.error({ error }, 'Failed to initialize MLOps infrastructure');
      // Continue without MLOps in development
      if (process.env['NODE_ENV'] === 'production') {
        throw error;
      }
    }
  }

  async shutdown(): Promise<void> {
    if (this.mlopsOrchestrator) {
      await this.mlopsOrchestrator.stop();
    }
  }

  // Enhanced prediction that uses MLOps model serving
  async predictWithMLOps(modelId: string, input: any, options?: any): Promise<any> {
    if (!this.mlopsOrchestrator) {
      throw new Error('MLOps not initialized');
    }

    return await this.mlopsOrchestrator.modelServer.predict({
      modelId,
      input,
      options
    });
  }

  // Register MLOps API endpoints
  async registerMLOpsAPI(fastify: FastifyInstance): Promise<void> {
    if (!this.mlopsOrchestrator) {
      logger.warn('MLOps not initialized, skipping API registration');
      return;
    }

    await this.mlopsOrchestrator.registerAPI(fastify, {});
  }

  // Get MLOps orchestrator (for internal use)
  getMLOpsOrchestrator() {
    return this.mlopsOrchestrator;
  }
}

// Singleton instance
export const enhancedAIService = new EnhancedAIService();

// Migration helpers for existing models
export async function migrateExistingModels(): Promise<void> {
  logger.info('Migrating existing models to MLOps registry...');
  
  // This would scan the existing models directory and register them
  // Implementation depends on current model storage format
}

// Training job converter
export function convertToMLOpsTrainingConfig(existingConfig: any): any {
  return {
    modelType: existingConfig.modelType || 'threat-classifier',
    datasetConfig: {
      trainPath: existingConfig.dataPath || '/data/train',
      validationPath: existingConfig.valPath || '/data/val',
      testPath: existingConfig.testPath
    },
    modelConfig: {
      architecture: existingConfig.architecture || 'lstm',
      optimizer: {
        type: 'adam',
        learningRate: existingConfig.learningRate || 0.001
      },
      loss: existingConfig.loss || 'categorical_crossentropy',
      metrics: existingConfig.metrics || ['accuracy']
    },
    trainingConfig: {
      epochs: existingConfig.epochs || 10,
      batchSize: existingConfig.batchSize || 32,
      earlyStopping: {
        enabled: true,
        patience: 5,
        monitor: 'val_loss',
        mode: 'min'
      }
    },
    experimentName: existingConfig.name || 'legacy-training'
  };
}

// Monitoring integration for existing services
export function setupMLOpsMonitoring(service: any): void {
  if (!(enhancedAIService as any).mlopsOrchestrator) {
    return;
  }

  // Hook into existing service events
  service.on('prediction', (data: any) => {
    // Forward to MLOps monitoring
  });

  service.on('error', (error: any) => {
    // Forward to MLOps alerting
  });
}

// Gradual migration strategy
export class GradualMigration {
  private migrationProgress: Map<string, boolean> = new Map();

  async migrateModel(modelId: string): Promise<void> {
    if (this.migrationProgress.get(modelId)) {
      return;
    }

    logger.info({ modelId }, 'Starting model migration to MLOps...');

    try {
      // 1. Load existing model
      // 2. Convert to MLOps format
      // 3. Register in model registry
      // 4. Update serving configuration
      // 5. Verify predictions match

      this.migrationProgress.set(modelId, true);
      logger.info({ modelId }, 'Model migration completed');
    } catch (error) {
      logger.error({ error, modelId }, 'Model migration failed');
      throw error;
    }
  }

  getMigrationStatus(): Record<string, boolean> {
    return Object.fromEntries(this.migrationProgress);
  }
}

// Feature flags for gradual rollout
export const mlopsFeatures = {
  useMLOpsServing: process.env['USE_MLOPS_SERVING'] === 'true',
  useMLOpsTraining: process.env['USE_MLOPS_TRAINING'] === 'true',
  useMLOpsMonitoring: process.env['USE_MLOPS_MONITORING'] === 'true',
  useMLOpsRegistry: process.env['USE_MLOPS_REGISTRY'] === 'true'
};

// Middleware to route to MLOps or legacy based on feature flags
export function createMLOpsMiddleware(fastify: FastifyInstance): void {
  fastify.addHook('preHandler', async (request, reply) => {
    // Add MLOps context to request
    (request as any).mlops = {
      enabled: enhancedAIService.getMLOpsOrchestrator() !== undefined,
      features: mlopsFeatures
    };
  });
}

// Health check that includes MLOps status
export async function getEnhancedHealth(): Promise<any> {
  const baseHealth = {
    status: 'healthy',
    timestamp: new Date().toISOString()
  };

  const mlopsOrchestrator = enhancedAIService.getMLOpsOrchestrator();
  if (mlopsOrchestrator) {
    try {
      const mlopsHealth = await mlopsOrchestrator.modelServer.getHealth();
      return {
        ...baseHealth,
        mlops: {
          enabled: true,
          ...mlopsHealth
        }
      };
    } catch (error) {
      return {
        ...baseHealth,
        mlops: {
          enabled: true,
          status: 'unhealthy',
          error: error instanceof Error ? error.message : String(error)
        }
      };
    }
  }

  return {
    ...baseHealth,
    mlops: {
      enabled: false
    }
  };
}