/**
 * Experiment Manager for tracking ML experiments, hyperparameter tuning, and model comparison
 */

import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { ModelRegistry } from '../model-registry/model-registry';
import { TrainingPipeline, TrainingConfig } from '../training-pipeline/training-pipeline';
import { MLflow } from '../training-pipeline/mlflow-client';
import pino from 'pino';

const logger = pino({ name: 'experiment-manager' });

// Experiment configuration schema
export const ExperimentConfigSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  objective: z.enum(['maximize', 'minimize']),
  metric: z.string(),
  searchSpace: z.record(z.object({
    type: z.enum(['float', 'int', 'categorical', 'log_uniform']),
    low: z.number().optional(),
    high: z.number().optional(),
    choices: z.array(z.any()).optional(),
    step: z.number().optional()
  })),
  searchStrategy: z.enum(['grid', 'random', 'bayesian', 'hyperband']),
  maxTrials: z.number(),
  parallelTrials: z.number().default(1),
  timeout: z.number().optional(), // in seconds
  earlyStoppingRounds: z.number().optional(),
  tags: z.array(z.string()).optional()
});

export type ExperimentConfig = z.infer<typeof ExperimentConfigSchema>;

// Trial status
export interface Trial {
  id: string;
  experimentId: string;
  parameters: Record<string, any>;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'pruned';
  metrics: Record<string, number>;
  startTime?: Date;
  endTime?: Date;
  modelId?: string;
  error?: string;
  userAttrs?: Record<string, any>;
}

// Experiment status
export interface Experiment {
  id: string;
  config: ExperimentConfig;
  status: 'created' | 'running' | 'completed' | 'failed';
  trials: Trial[];
  bestTrial?: Trial;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

// Hyperparameter tuning strategies
export abstract class SearchStrategy {
  constructor(protected config: ExperimentConfig) {}

  abstract suggestNext(history: Trial[]): Record<string, any> | null;
  abstract shouldStop(history: Trial[]): boolean;
}

// Grid search strategy
export class GridSearchStrategy extends SearchStrategy {
  private grid: Record<string, any>[] = [];
  private currentIndex = 0;

  constructor(config: ExperimentConfig) {
    super(config);
    this.generateGrid();
  }

  private generateGrid(): void {
    const keys = Object.keys(this.config.searchSpace);
    const values: any[][] = [];

    for (const key of keys) {
      const space = this.config.searchSpace[key];
      if (!space) continue;
      
      if (space.type === 'categorical' && space.choices) {
        values.push(space.choices);
      } else if (space.type === 'int' && space.low !== undefined && space.high !== undefined) {
        const step = space.step || 1;
        const range = [];
        for (let i = space.low; i <= space.high; i += step) {
          range.push(i);
        }
        values.push(range);
      } else if (space.type === 'float' && space.low !== undefined && space.high !== undefined) {
        // For float, we need to discretize
        const steps = 10; // Default number of steps
        const stepSize = (space.high - space.low) / steps;
        const range = [];
        for (let i = 0; i <= steps; i++) {
          range.push(space.low + i * stepSize);
        }
        values.push(range);
      }
    }

    // Generate cartesian product
    this.grid = this.cartesianProduct(keys, values);
  }

  private cartesianProduct(keys: string[], values: any[][]): Record<string, any>[] {
    if (values.length === 0) return [{}];
    
    const result: Record<string, any>[] = [];
    const helper = (index: number, current: Record<string, any>) => {
      if (index === keys.length) {
        result.push({ ...current });
        return;
      }
      
      for (const value of values[index]) {
        current[keys[index]] = value;
        helper(index + 1, current);
      }
    };
    
    helper(0, {});
    return result;
  }

  suggestNext(history: Trial[]): Record<string, any> | null {
    if (this.currentIndex >= this.grid.length) {
      return null;
    }
    
    const params = this.grid[this.currentIndex];
    this.currentIndex++;
    return params;
  }

  shouldStop(history: Trial[]): boolean {
    return this.currentIndex >= this.grid.length;
  }
}

// Random search strategy
export class RandomSearchStrategy extends SearchStrategy {
  private trialsGenerated = 0;

  suggestNext(history: Trial[]): Record<string, any> | null {
    if (this.trialsGenerated >= this.config.maxTrials) {
      return null;
    }

    const params: Record<string, any> = {};
    
    for (const [key, space] of Object.entries(this.config.searchSpace)) {
      if (space.type === 'categorical' && space.choices) {
        params[key] = space.choices[Math.floor(Math.random() * space.choices.length)];
      } else if (space.type === 'int' && space.low !== undefined && space.high !== undefined) {
        params[key] = Math.floor(Math.random() * (space.high - space.low + 1)) + space.low;
      } else if (space.type === 'float' && space.low !== undefined && space.high !== undefined) {
        params[key] = Math.random() * (space.high - space.low) + space.low;
      } else if (space.type === 'log_uniform' && space.low !== undefined && space.high !== undefined) {
        const logLow = Math.log(space.low);
        const logHigh = Math.log(space.high);
        params[key] = Math.exp(Math.random() * (logHigh - logLow) + logLow);
      }
    }

    this.trialsGenerated++;
    return params;
  }

  shouldStop(history: Trial[]): boolean {
    return this.trialsGenerated >= this.config.maxTrials;
  }
}

// Bayesian optimization strategy (simplified)
export class BayesianSearchStrategy extends SearchStrategy {
  private acquisitionFunction = 'ei'; // Expected Improvement

  suggestNext(history: Trial[]): Record<string, any> | null {
    if (history.length === 0) {
      // Start with random point
      return new RandomSearchStrategy(this.config).suggestNext(history);
    }

    // Simplified Bayesian optimization
    // In practice, this would use a Gaussian Process or similar
    // For now, we'll use a simple heuristic
    
    const bestTrial = this.findBestTrial(history);
    if (!bestTrial) {
      return new RandomSearchStrategy(this.config).suggestNext(history);
    }

    // Exploit around best point with some exploration
    const params: Record<string, any> = {};
    const explorationRate = 0.2;

    for (const [key, space] of Object.entries(this.config.searchSpace)) {
      if (Math.random() < explorationRate) {
        // Explore
        params[key] = this.sampleFromSpace(key, space);
      } else {
        // Exploit around best
        params[key] = this.perturbParameter(bestTrial.parameters[key], space);
      }
    }

    return params;
  }

  private findBestTrial(history: Trial[]): Trial | null {
    const completed = history.filter(t => t.status === 'completed' && t.metrics[this.config.metric] !== undefined);
    if (completed.length === 0) return null;

    return completed.reduce((best, trial) => {
      const currentValue = trial.metrics[this.config.metric];
      const bestValue = best.metrics[this.config.metric];
      
      if (this.config.objective === 'maximize') {
        return currentValue > bestValue ? trial : best;
      } else {
        return currentValue < bestValue ? trial : best;
      }
    });
  }

  private sampleFromSpace(key: string, space: any): any {
    if (space.type === 'categorical' && space.choices) {
      return space.choices[Math.floor(Math.random() * space.choices.length)];
    } else if (space.type === 'int' && space.low !== undefined && space.high !== undefined) {
      return Math.floor(Math.random() * (space.high - space.low + 1)) + space.low;
    } else if (space.type === 'float' && space.low !== undefined && space.high !== undefined) {
      return Math.random() * (space.high - space.low) + space.low;
    }
    return 0;
  }

  private perturbParameter(value: any, space: any): any {
    if (space.type === 'categorical') {
      // Small chance to change category
      if (Math.random() < 0.1) {
        return this.sampleFromSpace('', space);
      }
      return value;
    } else if (space.type === 'int' || space.type === 'float') {
      // Add Gaussian noise
      const range = space.high - space.low;
      const noise = (Math.random() - 0.5) * range * 0.1; // 10% of range
      let newValue = value + noise;
      
      // Clip to bounds
      newValue = Math.max(space.low, Math.min(space.high, newValue));
      
      if (space.type === 'int') {
        newValue = Math.round(newValue);
      }
      
      return newValue;
    }
    
    return value;
  }

  shouldStop(history: Trial[]): boolean {
    if (history.length >= this.config.maxTrials) {
      return true;
    }

    // Early stopping based on convergence
    if (this.config.earlyStoppingRounds && history.length > this.config.earlyStoppingRounds) {
      const recentTrials = history.slice(-this.config.earlyStoppingRounds);
      const values = recentTrials
        .filter(t => t.status === 'completed')
        .map(t => t.metrics[this.config.metric]);
      
      if (values.length === this.config.earlyStoppingRounds) {
        const variance = this.calculateVariance(values);
        if (variance < 0.001) { // Convergence threshold
          logger.info('Early stopping due to convergence');
          return true;
        }
      }
    }

    return false;
  }

  private calculateVariance(values: number[]): number {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    return values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
  }
}

// Experiment manager
export class ExperimentManager {
  private experiments: Map<string, Experiment> = new Map();
  private trainingPipeline: TrainingPipeline;
  private mlflow?: MLflow;

  constructor(
    private modelRegistry: ModelRegistry,
    trainingPipeline: TrainingPipeline,
    mlflowUrl?: string
  ) {
    this.trainingPipeline = trainingPipeline;
    if (mlflowUrl) {
      this.mlflow = new MLflow(mlflowUrl);
    }
  }

  async createExperiment(config: ExperimentConfig): Promise<string> {
    const experiment: Experiment = {
      id: uuidv4(),
      config,
      status: 'created',
      trials: [],
      createdAt: new Date()
    };

    this.experiments.set(experiment.id, experiment);

    // Create MLflow experiment if configured
    if (this.mlflow) {
      await this.mlflow.createExperiment(config.name);
    }

    logger.info({ experimentId: experiment.id, name: config.name }, 'Experiment created');
    return experiment.id;
  }

  async runExperiment(experimentId: string): Promise<void> {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) {
      throw new Error(`Experiment ${experimentId} not found`);
    }

    experiment.status = 'running';
    experiment.startedAt = new Date();

    const strategy = this.createSearchStrategy(experiment.config);
    
    try {
      while (!strategy.shouldStop(experiment.trials)) {
        // Get next parameters to try
        const parameters = strategy.suggestNext(experiment.trials);
        if (!parameters) break;

        // Create trial
        const trial: Trial = {
          id: uuidv4(),
          experimentId,
          parameters,
          status: 'pending',
          metrics: {}
        };

        experiment.trials.push(trial);

        // Run trial
        await this.runTrial(experiment, trial);

        // Check for timeout
        if (experiment.config.timeout) {
          const elapsed = Date.now() - experiment.startedAt.getTime();
          if (elapsed > experiment.config.timeout * 1000) {
            logger.info({ experimentId }, 'Experiment timeout reached');
            break;
          }
        }
      }

      // Find best trial
      experiment.bestTrial = this.findBestTrial(experiment);
      experiment.status = 'completed';
      experiment.completedAt = new Date();

      logger.info({ 
        experimentId, 
        bestTrial: experiment.bestTrial?.id,
        bestMetric: experiment.bestTrial?.metrics[experiment.config.metric]
      }, 'Experiment completed');

    } catch (error) {
      experiment.status = 'failed';
      logger.error({ error, experimentId }, 'Experiment failed');
      throw error;
    }
  }

  private async runTrial(experiment: Experiment, trial: Trial): Promise<void> {
    logger.info({ trialId: trial.id, parameters: trial.parameters }, 'Running trial');

    trial.status = 'running';
    trial.startTime = new Date();

    try {
      // Create training config from trial parameters
      const trainingConfig = this.createTrainingConfig(experiment.config, trial.parameters);

      // Submit training job
      const jobId = await this.trainingPipeline.submitJob(trainingConfig);

      // Wait for completion
      const job = await this.waitForJob(jobId);

      if (job.status === 'completed' && job.metrics) {
        // Extract metrics
        trial.metrics = this.extractMetrics(job.metrics, experiment.config.metric);
        trial.status = 'completed';
        trial.modelId = job.modelPath; // Or model ID from registry
      } else {
        trial.status = 'failed';
        trial.error = job.error || 'Training failed';
      }

    } catch (error) {
      trial.status = 'failed';
      trial.error = error instanceof Error ? error.message : String(error);
      logger.error({ error, trialId: trial.id }, 'Trial failed');
    } finally {
      trial.endTime = new Date();
    }

    // Log to MLflow if configured
    if (this.mlflow && experiment.config.name) {
      const runId = await this.mlflow.startRun(experiment.config.name);
      await this.mlflow.logParams(runId, trial.parameters);
      await this.mlflow.logMetrics(runId, trial.metrics);
      await this.mlflow.endRun(runId, trial.status === 'completed' ? 'FINISHED' : 'FAILED');
    }
  }

  private createSearchStrategy(config: ExperimentConfig): SearchStrategy {
    switch (config.searchStrategy) {
      case 'grid':
        return new GridSearchStrategy(config);
      case 'random':
        return new RandomSearchStrategy(config);
      case 'bayesian':
        return new BayesianSearchStrategy(config);
      case 'hyperband':
        // Not implemented yet, fallback to random
        return new RandomSearchStrategy(config);
      default:
        throw new Error(`Unknown search strategy: ${config.searchStrategy}`);
    }
  }

  private createTrainingConfig(
    experimentConfig: ExperimentConfig,
    parameters: Record<string, any>
  ): TrainingConfig {
    // This is a simplified version - actual implementation would be more sophisticated
    return {
      modelType: 'threat-classifier', // Should be configurable
      datasetConfig: {
        trainPath: '/data/train',
        validationPath: '/data/val'
      },
      modelConfig: {
        architecture: 'lstm',
        optimizer: {
          type: 'adam',
          learningRate: parameters.learning_rate || 0.001
        },
        loss: 'categorical_crossentropy',
        metrics: ['accuracy']
      },
      trainingConfig: {
        epochs: parameters.epochs || 10,
        batchSize: parameters.batch_size || 32
      },
      hyperparameters: parameters,
      experimentName: experimentConfig.name
    };
  }

  private async waitForJob(jobId: string): Promise<any> {
    // Poll for job completion
    while (true) {
      const job = await this.trainingPipeline.getJob(jobId);
      if (!job) {
        throw new Error(`Job ${jobId} not found`);
      }

      if (job.status === 'completed' || job.status === 'failed') {
        return job;
      }

      // Wait before polling again
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  private extractMetrics(trainingMetrics: any, targetMetric: string): Record<string, number> {
    const metrics: Record<string, number> = {};

    // Extract final epoch metrics
    if (trainingMetrics.valMetrics && trainingMetrics.valMetrics[targetMetric]) {
      const values = trainingMetrics.valMetrics[targetMetric];
      metrics[targetMetric] = values[values.length - 1];
    }

    // Add other relevant metrics
    if (trainingMetrics.valLoss) {
      metrics.val_loss = trainingMetrics.valLoss[trainingMetrics.valLoss.length - 1];
    }

    return metrics;
  }

  private findBestTrial(experiment: Experiment): Trial | null {
    const completedTrials = experiment.trials.filter(t => t.status === 'completed');
    if (completedTrials.length === 0) return null;

    return completedTrials.reduce((best, trial) => {
      const currentValue = trial.metrics[experiment.config.metric];
      const bestValue = best.metrics[experiment.config.metric];

      if (currentValue === undefined) return best;
      if (bestValue === undefined) return trial;

      if (experiment.config.objective === 'maximize') {
        return currentValue > bestValue ? trial : best;
      } else {
        return currentValue < bestValue ? trial : best;
      }
    });
  }

  async getExperiment(experimentId: string): Promise<Experiment | undefined> {
    return this.experiments.get(experimentId);
  }

  async compareExperiments(experimentIds: string[]): Promise<{
    experiments: Experiment[];
    comparison: {
      bestTrial: { experimentId: string; trial: Trial };
      metricComparison: Record<string, Record<string, number>>;
    };
  }> {
    const experiments = experimentIds
      .map(id => this.experiments.get(id))
      .filter(e => e !== undefined) as Experiment[];

    // Find overall best trial
    let bestTrial: { experimentId: string; trial: Trial } | null = null;
    
    for (const experiment of experiments) {
      if (experiment.bestTrial) {
        if (!bestTrial) {
          bestTrial = { experimentId: experiment.id, trial: experiment.bestTrial };
        } else {
          const currentValue = experiment.bestTrial.metrics[experiment.config.metric];
          const bestValue = bestTrial.trial.metrics[experiment.config.metric];
          
          if (experiment.config.objective === 'maximize' && currentValue > bestValue) {
            bestTrial = { experimentId: experiment.id, trial: experiment.bestTrial };
          } else if (experiment.config.objective === 'minimize' && currentValue < bestValue) {
            bestTrial = { experimentId: experiment.id, trial: experiment.bestTrial };
          }
        }
      }
    }

    // Build metric comparison
    const metricComparison: Record<string, Record<string, number>> = {};
    
    for (const experiment of experiments) {
      if (experiment.bestTrial) {
        metricComparison[experiment.id] = experiment.bestTrial.metrics;
      }
    }

    return {
      experiments,
      comparison: {
        bestTrial: bestTrial!,
        metricComparison
      }
    };
  }
}