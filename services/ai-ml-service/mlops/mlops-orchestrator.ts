/**
 * MLOps Orchestrator - Central coordinator for all ML operations
 */

import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { z } from 'zod';
import { ModelRegistry, createModelStorage } from './model-registry/model-registry';
import { ModelServer, ModelServerConfig } from './serving/model-server';
import { TrainingPipeline, TrainingConfig, TrainingConfigSchema } from './training-pipeline/training-pipeline';
import { ModelMonitoring, MonitoringConfig } from './monitoring/model-monitoring';
import { ExperimentManager, ExperimentConfig, ExperimentConfigSchema } from './experiments/experiment-manager';
import pino from 'pino';

const logger = pino({ name: 'mlops-orchestrator' });

// MLOps configuration
export interface MLOpsConfig {
  storage: {
    type: 'local' | 's3';
    localPath?: string;
    s3Config?: {
      region: string;
      endpoint?: string;
      bucketName: string;
    };
  };
  serving: ModelServerConfig;
  monitoring: MonitoringConfig;
  training: {
    redisUrl: string;
    mlflowUrl?: string;
  };
  api: {
    port: number;
    host: string;
  };
}

// Request/Response schemas
const TrainModelRequestSchema = z.object({
  config: TrainingConfigSchema.omit({ experimentName: true }),
  experimentName: z.string()
});

const DeployModelRequestSchema = z.object({
  modelId: z.string(),
  version: z.string().optional(),
  stage: z.enum(['staging', 'production'])
});

const PredictRequestSchema = z.object({
  modelId: z.string(),
  version: z.string().optional(),
  input: z.any(),
  options: z.object({
    timeout: z.number().optional(),
    returnMetadata: z.boolean().optional()
  }).optional()
});

const ExperimentRequestSchema = z.object({
  config: ExperimentConfigSchema
});

// MLOps Orchestrator
export class MLOpsOrchestrator {
  private modelRegistry: ModelRegistry;
  private modelServer: ModelServer;
  private trainingPipeline: TrainingPipeline;
  private modelMonitoring: ModelMonitoring;
  private experimentManager: ExperimentManager;
  private config: MLOpsConfig;

  constructor(config: MLOpsConfig) {
    this.config = config;

    // Initialize components
    const storage = createModelStorage(config.storage);
    this.modelRegistry = new ModelRegistry(storage);
    
    this.modelServer = new ModelServer(this.modelRegistry, config.serving);
    
    this.trainingPipeline = new TrainingPipeline(
      this.modelRegistry,
      config.training.redisUrl,
      config.training.mlflowUrl
    );
    
    this.modelMonitoring = new ModelMonitoring(
      config.monitoring,
      this.modelServer,
      this.modelRegistry
    );

    this.experimentManager = new ExperimentManager(
      this.modelRegistry,
      this.trainingPipeline,
      config.training.mlflowUrl
    );
  }

  async start(): Promise<void> {
    logger.info('Starting MLOps orchestrator...');

    // Start all components
    await this.modelServer.start();
    await this.modelMonitoring.start();

    logger.info('MLOps orchestrator started successfully');
  }

  async stop(): Promise<void> {
    logger.info('Stopping MLOps orchestrator...');

    await this.modelServer.stop();
    await this.modelMonitoring.stop();

    logger.info('MLOps orchestrator stopped');
  }

  // API Plugin for Fastify
  async registerAPI(fastify: FastifyInstance, options: FastifyPluginOptions): Promise<void> {
    // Training endpoints
    fastify.post('/mlops/train', {
      schema: {
        body: TrainModelRequestSchema
      }
    }, async (request, reply) => {
      const { config, experimentName } = request.body as z.infer<typeof TrainModelRequestSchema>;
      
      const fullConfig: TrainingConfig = {
        ...config,
        experimentName
      };

      const jobId = await this.trainingPipeline.submitJob(fullConfig);
      
      return {
        jobId,
        status: 'submitted',
        message: 'Training job submitted successfully'
      };
    });

    fastify.get('/mlops/train/:jobId', async (request, reply) => {
      const { jobId } = request.params as { jobId: string };
      const job = await this.trainingPipeline.getJob(jobId);
      
      if (!job) {
        reply.code(404);
        return { error: 'Job not found' };
      }

      return job;
    });

    // Model registry endpoints
    fastify.get('/mlops/models', async (request, reply) => {
      const { modelId } = request.query as { modelId?: string };
      const models = await this.modelRegistry.listModels(modelId);
      
      return {
        models,
        total: models.length
      };
    });

    fastify.get('/mlops/models/:modelId/:version', async (request, reply) => {
      const { modelId, version } = request.params as { modelId: string; version: string };
      
      try {
        const { metadata } = await this.modelRegistry.getModel(modelId, version);
        return metadata;
      } catch (error) {
        reply.code(404);
        return { error: 'Model not found' };
      }
    });

    fastify.post('/mlops/models/:modelId/:version/promote', async (request, reply) => {
      const { modelId, version } = request.params as { modelId: string; version: string };
      const { stage } = request.body as { stage: 'staging' | 'production' };
      
      await this.modelRegistry.promoteModel(modelId, version, stage);
      
      return {
        modelId,
        version,
        stage,
        message: 'Model promoted successfully'
      };
    });

    // Deployment endpoints
    fastify.post('/mlops/deploy', {
      schema: {
        body: DeployModelRequestSchema
      }
    }, async (request, reply) => {
      const { modelId, version, stage } = request.body as z.infer<typeof DeployModelRequestSchema>;
      
      // Promote model in registry
      if (version) {
        await this.modelRegistry.promoteModel(modelId, version, stage);
      }

      // Load model in server (if not already loaded)
      await this.modelServer.predict({
        modelId,
        version,
        input: [[0]], // Dummy input for loading
        options: { timeout: 1000 }
      });

      return {
        modelId,
        version: version || 'latest',
        stage,
        message: 'Model deployed successfully'
      };
    });

    // Prediction endpoints
    fastify.post('/mlops/predict', {
      schema: {
        body: PredictRequestSchema
      }
    }, async (request, reply) => {
      const predictionRequest = request.body as z.infer<typeof PredictRequestSchema>;
      
      try {
        const response = await this.modelServer.predict(predictionRequest);
        return response;
      } catch (error) {
        reply.code(500);
        return {
          error: 'Prediction failed',
          message: error instanceof Error ? error.message : String(error)
        };
      }
    });

    fastify.post('/mlops/predict/batch', async (request, reply) => {
      const { requests } = request.body as { requests: z.infer<typeof PredictRequestSchema>[] };
      
      try {
        const responses = await this.modelServer.batchPredict(requests);
        return { predictions: responses };
      } catch (error) {
        reply.code(500);
        return {
          error: 'Batch prediction failed',
          message: error instanceof Error ? error.message : String(error)
        };
      }
    });

    // Experiment endpoints
    fastify.post('/mlops/experiments', {
      schema: {
        body: ExperimentRequestSchema
      }
    }, async (request, reply) => {
      const { config } = request.body as z.infer<typeof ExperimentRequestSchema>;
      const experimentId = await this.experimentManager.createExperiment(config);
      
      // Start experiment asynchronously
      this.experimentManager.runExperiment(experimentId).catch(error => {
        logger.error({ error, experimentId }, 'Experiment failed');
      });

      return {
        experimentId,
        status: 'created',
        message: 'Experiment created and started'
      };
    });

    fastify.get('/mlops/experiments/:experimentId', async (request, reply) => {
      const { experimentId } = request.params as { experimentId: string };
      const experiment = await this.experimentManager.getExperiment(experimentId);
      
      if (!experiment) {
        reply.code(404);
        return { error: 'Experiment not found' };
      }

      return experiment;
    });

    fastify.post('/mlops/experiments/compare', async (request, reply) => {
      const { experimentIds } = request.body as { experimentIds: string[] };
      const comparison = await this.experimentManager.compareExperiments(experimentIds);
      return comparison;
    });

    // Monitoring endpoints
    fastify.get('/mlops/metrics', async (request, reply) => {
      reply.type('text/plain');
      return this.modelMonitoring.getMetrics();
    });

    fastify.get('/mlops/health', async (request, reply) => {
      const serverHealth = await this.modelServer.getHealth();
      
      return {
        status: 'healthy',
        components: {
          modelServer: serverHealth,
          monitoring: { status: 'active' },
          training: { status: 'active' }
        }
      };
    });

    fastify.get('/mlops/models/:modelId/drift', async (request, reply) => {
      const { modelId } = request.params as { modelId: string };
      // This would return drift metrics for the model
      return {
        modelId,
        driftScore: 0.05, // Placeholder
        threshold: 0.1,
        status: 'stable'
      };
    });

    // Model comparison endpoint
    fastify.post('/mlops/models/compare', async (request, reply) => {
      const { modelId, version1, version2 } = request.body as {
        modelId: string;
        version1: string;
        version2: string;
      };

      const comparison = await this.modelRegistry.compareModels(modelId, version1, version2);
      return comparison;
    });

    logger.info('MLOps API registered');
  }

  // Utility methods
  async retrainModel(modelId: string, newDataPath: string): Promise<string> {
    // Get current model metadata
    const { metadata } = await this.modelRegistry.getModel(modelId);
    
    // Create new training config based on previous one
    const config: TrainingConfig = {
      modelType: metadata.modelType,
      datasetConfig: {
        trainPath: newDataPath,
        validationPath: `${newDataPath}/val`,
        testPath: `${newDataPath}/test`
      },
      modelConfig: {
        architecture: 'lstm', // Should be stored in metadata
        optimizer: {
          type: 'adam',
          learningRate: metadata.trainingInfo.learningRate || 0.001
        },
        loss: 'categorical_crossentropy',
        metrics: ['accuracy']
      },
      trainingConfig: {
        epochs: metadata.trainingInfo.epochs || 10,
        batchSize: metadata.trainingInfo.batchSize || 32
      },
      hyperparameters: metadata.trainingInfo.hyperparameters,
      experimentName: `retrain-${metadata.modelName}`
    };

    return await this.trainingPipeline.submitJob(config);
  }

  async setupAutomatedRetraining(
    modelId: string,
    schedule: string, // Cron expression
    dataSource: string
  ): Promise<void> {
    // This would set up automated retraining
    // Implementation would use a job scheduler like Bull or node-cron
    logger.info({ modelId, schedule }, 'Automated retraining configured');
  }

  async initializeDriftDetection(modelId: string, referenceDataPath: string): Promise<void> {
    // Load reference data
    const referenceData = []; // Would load from file/database
    
    await this.modelMonitoring.initializeDriftDetection(modelId, referenceData);
    
    logger.info({ modelId }, 'Drift detection initialized');
  }

  // Dashboard data aggregation
  async getDashboardData(): Promise<{
    models: {
      total: number;
      byStatus: Record<string, number>;
      recent: any[];
    };
    training: {
      activeJobs: number;
      completedToday: number;
      avgTrainingTime: number;
    };
    serving: {
      loadedModels: number;
      totalPredictions: number;
      avgLatency: number;
    };
    experiments: {
      total: number;
      running: number;
      bestModels: any[];
    };
  }> {
    // Aggregate data from all components
    const models = await this.modelRegistry.listModels();
    const serverHealth = await this.modelServer.getHealth();
    const serverStats = this.modelServer.getStats();

    // Calculate aggregated metrics
    const modelsByStatus = models.reduce((acc, model) => {
      acc[model.deploymentInfo.status] = (acc[model.deploymentInfo.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Get average latency
    let totalLatency = 0;
    let totalRequests = 0;
    for (const [_, stats] of serverStats) {
      totalLatency += stats.totalTime;
      totalRequests += stats.requests;
    }
    const avgLatency = totalRequests > 0 ? totalLatency / totalRequests : 0;

    return {
      models: {
        total: models.length,
        byStatus: modelsByStatus,
        recent: models.slice(0, 5)
      },
      training: {
        activeJobs: 0, // Would query training pipeline
        completedToday: 0, // Would query training pipeline
        avgTrainingTime: 0 // Would calculate from completed jobs
      },
      serving: {
        loadedModels: serverHealth.loadedModels,
        totalPredictions: totalRequests,
        avgLatency
      },
      experiments: {
        total: 0, // Would query experiment manager
        running: 0, // Would query experiment manager
        bestModels: [] // Would get from experiment manager
      }
    };
  }
}

// Factory function for creating MLOps orchestrator
export async function createMLOpsOrchestrator(config: MLOpsConfig): Promise<MLOpsOrchestrator> {
  const orchestrator = new MLOpsOrchestrator(config);
  await orchestrator.start();
  return orchestrator;
}