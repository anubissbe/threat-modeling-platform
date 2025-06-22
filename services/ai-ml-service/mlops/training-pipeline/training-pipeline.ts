/**
 * ML Training Pipeline with experiment tracking and distributed training support
 */

import { z } from 'zod';
// import * as tf from '@tensorflow/tfjs-node'; // Temporarily disabled
import { ModelRegistry, ModelMetadata } from '../model-registry/model-registry';
import { EventEmitter } from 'events';
import pino from 'pino';
import { createHash } from 'crypto';
import Bull from 'bull';
import { MLflow } from './mlflow-client';

const logger = pino({ name: 'training-pipeline' });

// Training configuration schema
export const TrainingConfigSchema = z.object({
  modelType: z.enum(['threat-classifier', 'vulnerability-predictor', 'mitigation-recommender', 'pattern-recognizer', 'ensemble']),
  datasetConfig: z.object({
    trainPath: z.string(),
    validationPath: z.string(),
    testPath: z.string().optional(),
    augmentation: z.object({
      enabled: z.boolean(),
      techniques: z.array(z.string()).optional()
    }).optional()
  }),
  modelConfig: z.object({
    architecture: z.string(),
    layers: z.array(z.any()).optional(),
    optimizer: z.object({
      type: z.string(),
      learningRate: z.number(),
      decay: z.number().optional()
    }),
    loss: z.string(),
    metrics: z.array(z.string())
  }),
  trainingConfig: z.object({
    epochs: z.number(),
    batchSize: z.number(),
    validationSplit: z.number().optional(),
    earlyStopping: z.object({
      enabled: z.boolean(),
      patience: z.number(),
      monitor: z.string(),
      mode: z.enum(['min', 'max'])
    }).optional(),
    checkpointing: z.object({
      enabled: z.boolean(),
      saveFrequency: z.number().optional(),
      saveBestOnly: z.boolean().optional()
    }).optional(),
    distributed: z.object({
      enabled: z.boolean(),
      strategy: z.enum(['data-parallel', 'model-parallel']).optional(),
      workers: z.number().optional()
    }).optional()
  }),
  hyperparameters: z.record(z.any()).optional(),
  experimentName: z.string(),
  tags: z.array(z.string()).optional()
});

export type TrainingConfig = z.infer<typeof TrainingConfigSchema>;

// Training job status
export interface TrainingJob {
  id: string;
  config: TrainingConfig;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  startTime?: Date;
  endTime?: Date;
  metrics?: TrainingMetrics;
  modelPath?: string;
  error?: string;
  experimentId?: string;
  runId?: string;
}

// Training metrics
export interface TrainingMetrics {
  trainLoss: number[];
  valLoss: number[];
  trainMetrics: Record<string, number[]>;
  valMetrics: Record<string, number[]>;
  testMetrics?: Record<string, number>;
  bestEpoch?: number;
  totalTrainingTime?: number;
}

// Dataset interface
export interface Dataset {
  load(): Promise<{ train: tf.data.Dataset<any>; validation: tf.data.Dataset<any>; test?: tf.data.Dataset<any> }>;
  getMetadata(): { size: number; features: string[]; classes?: string[] };
}

// Base trainer class
export abstract class BaseTrainer extends EventEmitter {
  protected config: TrainingConfig;
  protected model?: tf.LayersModel;
  protected metrics: TrainingMetrics = {
    trainLoss: [],
    valLoss: [],
    trainMetrics: {},
    valMetrics: {}
  };

  constructor(config: TrainingConfig) {
    super();
    this.config = config;
  }

  abstract buildModel(): tf.LayersModel;
  abstract preprocessData(data: any): any;
  abstract postprocessPredictions(predictions: any): any;

  async train(dataset: Dataset): Promise<{ modelPath: string; metrics: TrainingMetrics }> {
    logger.info({ config: this.config }, 'Starting training...');
    this.emit('training:start', { config: this.config });

    try {
      // Build model
      this.model = this.buildModel();
      this.compileModel();

      // Load data
      const { train, validation, test } = await dataset.load();

      // Setup callbacks
      const callbacks = this.setupCallbacks();

      // Train model
      const history = await this.model.fitDataset(train, {
        epochs: this.config.trainingConfig.epochs,
        validationData: validation,
        callbacks,
        verbose: 1
      });

      // Evaluate on test set if available
      if (test) {
        await this.evaluateTestSet(test);
      }

      // Save model
      const modelPath = await this.saveModel();

      this.emit('training:complete', { modelPath, metrics: this.metrics });
      return { modelPath, metrics: this.metrics };

    } catch (error) {
      logger.error({ error }, 'Training failed');
      this.emit('training:error', { error });
      throw error;
    }
  }

  protected compileModel(): void {
    if (!this.model) throw new Error('Model not built');

    const optimizer = this.createOptimizer();
    
    this.model.compile({
      optimizer,
      loss: this.config.modelConfig.loss,
      metrics: this.config.modelConfig.metrics
    });
  }

  protected createOptimizer(): tf.Optimizer {
    const { type, learningRate, decay } = this.config.modelConfig.optimizer;
    
    switch (type) {
      case 'adam':
        return tf.train.adam(learningRate, undefined, undefined, decay);
      case 'sgd':
        return tf.train.sgd(learningRate);
      case 'rmsprop':
        return tf.train.rmsprop(learningRate, decay);
      default:
        throw new Error(`Unknown optimizer: ${type}`);
    }
  }

  protected setupCallbacks(): tf.CustomCallbackArgs {
    const callbacks: tf.CustomCallbackArgs = {
      onEpochEnd: async (epoch, logs) => {
        if (logs) {
          this.metrics.trainLoss.push(logs.loss);
          this.metrics.valLoss.push(logs.val_loss);

          // Record other metrics
          for (const [key, value] of Object.entries(logs)) {
            if (key.startsWith('val_')) {
              const metricName = key.substring(4);
              if (!this.metrics.valMetrics[metricName]) {
                this.metrics.valMetrics[metricName] = [];
              }
              this.metrics.valMetrics[metricName].push(value as number);
            } else if (key !== 'loss') {
              if (!this.metrics.trainMetrics[key]) {
                this.metrics.trainMetrics[key] = [];
              }
              this.metrics.trainMetrics[key].push(value as number);
            }
          }

          this.emit('training:epoch', { epoch, logs });
        }
      },
      onBatchEnd: async (batch, logs) => {
        this.emit('training:batch', { batch, logs });
      }
    };

    // Add early stopping if configured
    if (this.config.trainingConfig.earlyStopping?.enabled) {
      // Implement early stopping logic
      let bestValue = this.config.trainingConfig.earlyStopping.mode === 'min' ? Infinity : -Infinity;
      let patience = 0;

      const originalOnEpochEnd = callbacks.onEpochEnd;
      callbacks.onEpochEnd = async (epoch, logs) => {
        if (originalOnEpochEnd) {
          await originalOnEpochEnd(epoch, logs);
        }

        if (logs) {
          const monitor = this.config.trainingConfig.earlyStopping!.monitor;
          const currentValue = logs[monitor];
          
          const improved = this.config.trainingConfig.earlyStopping!.mode === 'min' 
            ? currentValue < bestValue 
            : currentValue > bestValue;

          if (improved) {
            bestValue = currentValue;
            patience = 0;
            this.metrics.bestEpoch = epoch;
          } else {
            patience++;
            if (patience >= this.config.trainingConfig.earlyStopping!.patience) {
              this.emit('training:earlyStopping', { epoch, bestValue });
              // Note: TensorFlow.js doesn't support stopping training mid-process
              // Would need to implement custom training loop for true early stopping
            }
          }
        }
      };
    }

    return callbacks;
  }

  protected async evaluateTestSet(testData: tf.data.Dataset<any>): Promise<void> {
    if (!this.model) throw new Error('Model not trained');

    const evaluation = await this.model.evaluateDataset(testData);
    const metricNames = this.model.metricsNames;
    
    this.metrics.testMetrics = {};
    for (let i = 0; i < metricNames.length; i++) {
      const value = await evaluation[i].data();
      this.metrics.testMetrics[metricNames[i]] = value[0];
      evaluation[i].dispose();
    }
  }

  protected async saveModel(): Promise<string> {
    if (!this.model) throw new Error('Model not trained');

    const modelPath = `/tmp/model-${Date.now()}`;
    await this.model.save(`file://${modelPath}`);
    
    return modelPath;
  }
}

// Threat classifier trainer
export class ThreatClassifierTrainer extends BaseTrainer {
  buildModel(): tf.LayersModel {
    const model = tf.sequential();

    // Embedding layer
    model.add(tf.layers.embedding({
      inputDim: 10000, // Vocabulary size
      outputDim: 128,
      inputLength: 100 // Max sequence length
    }));

    // LSTM layers
    model.add(tf.layers.lstm({
      units: 128,
      returnSequences: true,
      dropout: 0.2,
      recurrentDropout: 0.2
    }));

    model.add(tf.layers.lstm({
      units: 64,
      dropout: 0.2,
      recurrentDropout: 0.2
    }));

    // Dense layers
    model.add(tf.layers.dense({
      units: 64,
      activation: 'relu'
    }));

    model.add(tf.layers.dropout({ rate: 0.5 }));

    // Output layer (16 threat categories)
    model.add(tf.layers.dense({
      units: 16,
      activation: 'sigmoid' // Multi-label classification
    }));

    return model;
  }

  preprocessData(data: any): any {
    // Implement text preprocessing
    return data;
  }

  postprocessPredictions(predictions: any): any {
    // Convert sigmoid outputs to labels
    return predictions;
  }
}

// Training pipeline orchestrator
export class TrainingPipeline {
  private queue: Bull.Queue;
  private registry: ModelRegistry;
  private mlflow?: MLflow;
  private jobs: Map<string, TrainingJob> = new Map();

  constructor(
    registry: ModelRegistry,
    redisUrl: string,
    mlflowUrl?: string
  ) {
    this.registry = registry;
    this.queue = new Bull('training-jobs', redisUrl);
    
    if (mlflowUrl) {
      this.mlflow = new MLflow(mlflowUrl);
    }

    this.setupQueueProcessing();
  }

  async submitJob(config: TrainingConfig): Promise<string> {
    const jobId = this.generateJobId();
    
    const job: TrainingJob = {
      id: jobId,
      config,
      status: 'queued'
    };

    this.jobs.set(jobId, job);

    await this.queue.add('train', {
      jobId,
      config
    }, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000
      }
    });

    logger.info({ jobId }, 'Training job submitted');
    return jobId;
  }

  async getJob(jobId: string): Promise<TrainingJob | undefined> {
    return this.jobs.get(jobId);
  }

  async cancelJob(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (job && job.status === 'queued') {
      job.status = 'cancelled';
      // Remove from queue
      const bullJob = await this.queue.getJob(jobId);
      if (bullJob) {
        await bullJob.remove();
      }
    }
  }

  private setupQueueProcessing(): void {
    this.queue.process('train', async (job) => {
      const { jobId, config } = job.data;
      const trainingJob = this.jobs.get(jobId);
      
      if (!trainingJob) {
        throw new Error(`Job ${jobId} not found`);
      }

      try {
        // Update status
        trainingJob.status = 'running';
        trainingJob.startTime = new Date();

        // Start MLflow run if configured
        if (this.mlflow) {
          const experimentId = await this.mlflow.createExperiment(config.experimentName);
          const runId = await this.mlflow.startRun(experimentId, config.tags);
          
          trainingJob.experimentId = experimentId;
          trainingJob.runId = runId;

          // Log parameters
          await this.mlflow.logParams(runId, {
            modelType: config.modelType,
            epochs: config.trainingConfig.epochs,
            batchSize: config.trainingConfig.batchSize,
            learningRate: config.modelConfig.optimizer.learningRate,
            ...config.hyperparameters
          });
        }

        // Create trainer
        const trainer = this.createTrainer(config);

        // Setup event listeners
        trainer.on('training:epoch', async ({ epoch, logs }) => {
          if (this.mlflow && trainingJob.runId) {
            await this.mlflow.logMetrics(trainingJob.runId, logs, epoch);
          }
          job.progress(Math.round((epoch / config.trainingConfig.epochs) * 100));
        });

        // Load dataset
        const dataset = await this.loadDataset(config.datasetConfig);

        // Train model
        const { modelPath, metrics } = await trainer.train(dataset);
        
        trainingJob.metrics = metrics;
        trainingJob.modelPath = modelPath;

        // Register model
        const modelMetadata = await this.registerModel(trainingJob, config);

        // End MLflow run
        if (this.mlflow && trainingJob.runId) {
          await this.mlflow.endRun(trainingJob.runId, 'FINISHED');
        }

        // Update status
        trainingJob.status = 'completed';
        trainingJob.endTime = new Date();

        logger.info({ jobId, modelId: modelMetadata.modelId }, 'Training completed');

      } catch (error) {
        logger.error({ error, jobId }, 'Training failed');
        
        trainingJob.status = 'failed';
        trainingJob.error = (error as Error).message;
        trainingJob.endTime = new Date();

        if (this.mlflow && trainingJob.runId) {
          await this.mlflow.endRun(trainingJob.runId, 'FAILED');
        }

        throw error;
      }
    });
  }

  private createTrainer(config: TrainingConfig): BaseTrainer {
    switch (config.modelType) {
      case 'threat-classifier':
        return new ThreatClassifierTrainer(config);
      // Add other trainer types
      default:
        throw new Error(`Unknown model type: ${config.modelType}`);
    }
  }

  private async loadDataset(config: any): Promise<Dataset> {
    // Implement dataset loading logic
    // This would load data from files, databases, or data lakes
    throw new Error('Dataset loading not implemented');
  }

  private async registerModel(job: TrainingJob, config: TrainingConfig): Promise<ModelMetadata> {
    if (!job.modelPath || !job.metrics) {
      throw new Error('Model training incomplete');
    }

    const version = this.generateVersion();
    
    const metadata: Omit<ModelMetadata, 'checksum' | 'createdAt'> = {
      modelId: `${config.modelType}-${Date.now()}`,
      modelName: config.experimentName,
      version,
      modelType: config.modelType,
      framework: 'tensorflow',
      metrics: {
        loss: job.metrics.trainLoss[job.metrics.trainLoss.length - 1],
        valLoss: job.metrics.valLoss[job.metrics.valLoss.length - 1],
        ...job.metrics.testMetrics
      },
      trainingInfo: {
        datasetVersion: 'v1', // Should come from dataset metadata
        datasetSize: 0, // Should come from dataset metadata
        trainingDuration: job.endTime ? (job.endTime.getTime() - job.startTime!.getTime()) / 1000 : 0,
        epochs: config.trainingConfig.epochs,
        batchSize: config.trainingConfig.batchSize,
        learningRate: config.modelConfig.optimizer.learningRate,
        hyperparameters: config.hyperparameters
      },
      deploymentInfo: {
        status: 'draft'
      },
      tags: config.tags,
      description: `Trained with ${config.experimentName}`,
      createdBy: 'training-pipeline'
    };

    return await this.registry.registerModel(job.modelPath, metadata);
  }

  private generateJobId(): string {
    return `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateVersion(): string {
    const date = new Date();
    return `1.0.${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}`;
  }
}

// Distributed training coordinator (placeholder)
export class DistributedTrainingCoordinator {
  // TODO: Implement distributed training using TensorFlow.js workers or external frameworks
}