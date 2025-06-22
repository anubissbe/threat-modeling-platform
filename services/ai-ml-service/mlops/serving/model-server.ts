/**
 * Model Serving Infrastructure for production ML model deployment
 */

import { FastifyInstance } from 'fastify';
// import * as tf from '@tensorflow/tfjs-node'; // Temporarily disabled
import { ModelRegistry, ModelMetadata } from '../model-registry/model-registry';
import { EventEmitter } from 'events';
import pino from 'pino';
import { z } from 'zod';

const logger = pino({ name: 'model-server' });

// Model server configuration
export interface ModelServerConfig {
  maxModelsInMemory: number;
  preloadModels: string[]; // Model IDs to preload
  warmupOnLoad: boolean;
  enableGPU: boolean;
  cacheTTL: number; // Cache time-to-live in seconds
  healthCheckInterval: number; // in seconds
}

// Prediction request schema
export const PredictionRequestSchema = z.object({
  modelId: z.string(),
  version: z.string().optional(),
  input: z.any(), // Model-specific input
  options: z.object({
    timeout: z.number().optional(),
    batchSize: z.number().optional(),
    returnMetadata: z.boolean().optional()
  }).optional()
});

export type PredictionRequest = z.infer<typeof PredictionRequestSchema>;

// Prediction response
export interface PredictionResponse {
  predictions: any;
  modelId: string;
  modelVersion: string;
  processingTime: number;
  metadata?: {
    confidence: number;
    explanation?: any;
  };
}

// Model wrapper for different frameworks
export abstract class ModelWrapper {
  protected metadata: ModelMetadata;
  protected lastUsed: Date;
  protected useCount: number = 0;

  constructor(metadata: ModelMetadata) {
    this.metadata = metadata;
    this.lastUsed = new Date();
  }

  abstract load(modelPath: string): Promise<void>;
  abstract predict(input: any): Promise<any>;
  abstract unload(): Promise<void>;
  abstract getMemoryUsage(): number;

  getMetadata(): ModelMetadata {
    return this.metadata;
  }

  recordUsage(): void {
    this.lastUsed = new Date();
    this.useCount++;
  }

  getLastUsed(): Date {
    return this.lastUsed;
  }

  getUseCount(): number {
    return this.useCount;
  }
}

// TensorFlow model wrapper (temporarily disabled)
export class TensorFlowModelWrapper extends ModelWrapper {
  private model: any = null;

  async load(modelPath: string): Promise<void> {
    throw new Error('TensorFlow support temporarily disabled - native dependencies required');
  }

  async predict(input: any): Promise<any> {
    throw new Error('TensorFlow support temporarily disabled - native dependencies required');
  }

  async unload(): Promise<void> {
    if (this.model) {
      this.model = null;
      logger.info({ modelId: this.metadata.modelId }, 'TensorFlow model unloaded');
    }
  }

  getMemoryUsage(): number {
    return 0;
  }
}

// ONNX model wrapper (placeholder for future implementation)
export class ONNXModelWrapper extends ModelWrapper {
  async load(modelPath: string): Promise<void> {
    // TODO: Implement ONNX Runtime integration
    throw new Error('ONNX support not yet implemented');
  }

  async predict(input: any): Promise<any> {
    throw new Error('ONNX support not yet implemented');
  }

  async unload(): Promise<void> {
    // TODO: Implement
  }

  getMemoryUsage(): number {
    return 0;
  }
}

// Model server with caching and lifecycle management
export class ModelServer extends EventEmitter {
  private registry: ModelRegistry;
  private config: ModelServerConfig;
  private loadedModels: Map<string, ModelWrapper> = new Map();
  private modelUsageStats: Map<string, { requests: number; totalTime: number }> = new Map();
  private healthCheckTimer?: NodeJS.Timeout;

  constructor(registry: ModelRegistry, config: ModelServerConfig) {
    super();
    this.registry = registry;
    this.config = config;
  }

  async start(): Promise<void> {
    logger.info('Starting model server...');

    // Preload models
    if (this.config.preloadModels.length > 0) {
      await this.preloadModels();
    }

    // Start health check
    if (this.config.healthCheckInterval > 0) {
      this.startHealthCheck();
    }

    this.emit('started');
  }

  async stop(): Promise<void> {
    logger.info('Stopping model server...');

    // Stop health check
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    // Unload all models
    for (const [modelKey, wrapper] of this.loadedModels) {
      await wrapper.unload();
    }
    this.loadedModels.clear();

    this.emit('stopped');
  }

  async predict(request: PredictionRequest): Promise<PredictionResponse> {
    const startTime = Date.now();
    const modelKey = this.getModelKey(request.modelId, request.version);

    try {
      // Get or load model
      const model = await this.getOrLoadModel(request.modelId, request.version);

      // Perform prediction
      const predictions = await model.predict(request.input);

      // Update stats
      this.updateStats(modelKey, Date.now() - startTime);

      // Build response
      const response: PredictionResponse = {
        predictions,
        modelId: request.modelId,
        modelVersion: model.getMetadata().version,
        processingTime: Date.now() - startTime
      };

      if (request.options?.returnMetadata) {
        response.metadata = {
          confidence: this.calculateConfidence(predictions)
        };
      }

      this.emit('prediction', { request, response });
      return response;

    } catch (error) {
      this.emit('predictionError', { request, error });
      throw error;
    }
  }

  async batchPredict(requests: PredictionRequest[]): Promise<PredictionResponse[]> {
    // Group requests by model
    const groupedRequests = new Map<string, PredictionRequest[]>();
    
    for (const request of requests) {
      const modelKey = this.getModelKey(request.modelId, request.version);
      if (!groupedRequests.has(modelKey)) {
        groupedRequests.set(modelKey, []);
      }
      groupedRequests.get(modelKey)!.push(request);
    }

    // Process each group
    const responses: PredictionResponse[] = [];
    
    for (const [modelKey, modelRequests] of groupedRequests) {
      const [modelId, version] = modelKey.split(':');
      const model = await this.getOrLoadModel(modelId, version);
      
      // Batch process if model supports it
      for (const request of modelRequests) {
        const response = await this.predict(request);
        responses.push(response);
      }
    }

    return responses;
  }

  private async getOrLoadModel(modelId: string, version?: string): Promise<ModelWrapper> {
    const modelKey = this.getModelKey(modelId, version);

    // Check if already loaded
    if (this.loadedModels.has(modelKey)) {
      const model = this.loadedModels.get(modelKey)!;
      model.recordUsage();
      return model;
    }

    // Check memory constraints
    if (this.loadedModels.size >= this.config.maxModelsInMemory) {
      await this.evictLeastUsedModel();
    }

    // Load model from registry
    const { modelPath, metadata } = await this.registry.getModel(modelId, version);
    
    // Create appropriate wrapper
    const wrapper = this.createModelWrapper(metadata);
    await wrapper.load(modelPath);

    // Warmup if configured
    if (this.config.warmupOnLoad) {
      await this.warmupModel(wrapper);
    }

    // Cache model
    this.loadedModels.set(modelKey, wrapper);
    this.emit('modelLoaded', { modelId, version: metadata.version });

    return wrapper;
  }

  private createModelWrapper(metadata: ModelMetadata): ModelWrapper {
    switch (metadata.framework) {
      case 'tensorflow':
        return new TensorFlowModelWrapper(metadata);
      case 'onnx':
        return new ONNXModelWrapper(metadata);
      default:
        throw new Error(`Unsupported framework: ${metadata.framework}`);
    }
  }

  private async warmupModel(model: ModelWrapper): Promise<void> {
    logger.info({ modelId: model.getMetadata().modelId }, 'Warming up model...');
    
    // Create dummy input based on model type
    const dummyInput = this.createDummyInput(model.getMetadata());
    
    try {
      await model.predict(dummyInput);
      logger.info({ modelId: model.getMetadata().modelId }, 'Model warmup complete');
    } catch (error) {
      logger.warn({ error, modelId: model.getMetadata().modelId }, 'Model warmup failed');
    }
  }

  private createDummyInput(metadata: ModelMetadata): any {
    // Create appropriate dummy input based on model type
    switch (metadata.modelType) {
      case 'threat-classifier':
        return [[0.1, 0.2, 0.3, 0.4, 0.5]]; // Example embedding
      case 'vulnerability-predictor':
        return [[1, 0, 1, 0, 1]]; // Example features
      default:
        return [[0]];
    }
  }

  private async evictLeastUsedModel(): Promise<void> {
    let leastUsedModel: { key: string; lastUsed: Date } | null = null;

    for (const [key, model] of this.loadedModels) {
      if (!leastUsedModel || model.getLastUsed() < leastUsedModel.lastUsed) {
        leastUsedModel = { key, lastUsed: model.getLastUsed() };
      }
    }

    if (leastUsedModel) {
      const model = this.loadedModels.get(leastUsedModel.key)!;
      await model.unload();
      this.loadedModels.delete(leastUsedModel.key);
      
      this.emit('modelEvicted', { 
        modelId: model.getMetadata().modelId, 
        version: model.getMetadata().version 
      });
    }
  }

  private async preloadModels(): Promise<void> {
    logger.info({ models: this.config.preloadModels }, 'Preloading models...');
    
    for (const modelId of this.config.preloadModels) {
      try {
        await this.getOrLoadModel(modelId);
      } catch (error) {
        logger.error({ error, modelId }, 'Failed to preload model');
      }
    }
  }

  private startHealthCheck(): void {
    this.healthCheckTimer = setInterval(async () => {
      const health = await this.getHealth();
      this.emit('healthCheck', health);
      
      if (!health.healthy) {
        logger.warn({ health }, 'Model server unhealthy');
      }
    }, this.config.healthCheckInterval * 1000);
  }

  async getHealth(): Promise<{
    healthy: boolean;
    loadedModels: number;
    totalMemoryUsage: number;
    modelStats: Array<{
      modelId: string;
      version: string;
      memoryUsage: number;
      useCount: number;
      lastUsed: Date;
    }>;
  }> {
    const modelStats = [];
    let totalMemoryUsage = 0;

    for (const [key, model] of this.loadedModels) {
      const memoryUsage = model.getMemoryUsage();
      totalMemoryUsage += memoryUsage;
      
      modelStats.push({
        modelId: model.getMetadata().modelId,
        version: model.getMetadata().version,
        memoryUsage,
        useCount: model.getUseCount(),
        lastUsed: model.getLastUsed()
      });
    }

    return {
      healthy: true,
      loadedModels: this.loadedModels.size,
      totalMemoryUsage,
      modelStats
    };
  }

  private getModelKey(modelId: string, version?: string): string {
    return version ? `${modelId}:${version}` : `${modelId}:latest`;
  }

  private updateStats(modelKey: string, processingTime: number): void {
    if (!this.modelUsageStats.has(modelKey)) {
      this.modelUsageStats.set(modelKey, { requests: 0, totalTime: 0 });
    }
    
    const stats = this.modelUsageStats.get(modelKey)!;
    stats.requests++;
    stats.totalTime += processingTime;
  }

  private calculateConfidence(predictions: any): number {
    // Simple confidence calculation - can be customized per model type
    if (Array.isArray(predictions) && predictions.length > 0) {
      if (Array.isArray(predictions[0])) {
        // Softmax output - return max probability
        return Math.max(...predictions[0]);
      }
    }
    return 1.0;
  }

  getStats(): Map<string, { requests: number; totalTime: number; avgTime: number }> {
    const stats = new Map();
    
    for (const [key, value] of this.modelUsageStats) {
      stats.set(key, {
        ...value,
        avgTime: value.requests > 0 ? value.totalTime / value.requests : 0
      });
    }
    
    return stats;
  }
}

// A/B testing support
export class ABTestingServer {
  private servers: Map<string, ModelServer> = new Map();
  private trafficSplits: Map<string, number> = new Map(); // modelId -> percentage for version A

  constructor(private registry: ModelRegistry, private config: ModelServerConfig) {}

  async addVariant(modelId: string, version: string, trafficPercentage: number): Promise<void> {
    const server = new ModelServer(this.registry, this.config);
    await server.start();
    
    this.servers.set(`${modelId}:${version}`, server);
    this.trafficSplits.set(modelId, trafficPercentage);
  }

  async predict(request: PredictionRequest): Promise<PredictionResponse> {
    const random = Math.random() * 100;
    const trafficSplit = this.trafficSplits.get(request.modelId) || 50;
    
    // Route to appropriate version based on traffic split
    const useVersionA = random < trafficSplit;
    const server = this.selectServer(request.modelId, useVersionA);
    
    const response = await server.predict(request);
    
    // Add A/B test metadata
    (response as any).abTestVariant = useVersionA ? 'A' : 'B';
    
    return response;
  }

  private selectServer(modelId: string, useVersionA: boolean): ModelServer {
    // Implementation depends on how versions are managed
    // This is a simplified version
    const servers = Array.from(this.servers.values());
    return servers[useVersionA ? 0 : 1] || servers[0];
  }
}