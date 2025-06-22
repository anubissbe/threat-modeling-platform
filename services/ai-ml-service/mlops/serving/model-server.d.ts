import { ModelRegistry, ModelMetadata } from '../model-registry/model-registry';
import { EventEmitter } from 'events';
import { z } from 'zod';
export interface ModelServerConfig {
    maxModelsInMemory: number;
    preloadModels: string[];
    warmupOnLoad: boolean;
    enableGPU: boolean;
    cacheTTL: number;
    healthCheckInterval: number;
}
export declare const PredictionRequestSchema: z.ZodObject<{
    modelId: z.ZodString;
    version: z.ZodOptional<z.ZodString>;
    input: z.ZodAny;
    options: z.ZodOptional<z.ZodObject<{
        timeout: z.ZodOptional<z.ZodNumber>;
        batchSize: z.ZodOptional<z.ZodNumber>;
        returnMetadata: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        timeout?: number | undefined;
        batchSize?: number | undefined;
        returnMetadata?: boolean | undefined;
    }, {
        timeout?: number | undefined;
        batchSize?: number | undefined;
        returnMetadata?: boolean | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    modelId: string;
    options?: {
        timeout?: number | undefined;
        batchSize?: number | undefined;
        returnMetadata?: boolean | undefined;
    } | undefined;
    version?: string | undefined;
    input?: any;
}, {
    modelId: string;
    options?: {
        timeout?: number | undefined;
        batchSize?: number | undefined;
        returnMetadata?: boolean | undefined;
    } | undefined;
    version?: string | undefined;
    input?: any;
}>;
export type PredictionRequest = z.infer<typeof PredictionRequestSchema>;
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
export declare abstract class ModelWrapper {
    protected metadata: ModelMetadata;
    protected lastUsed: Date;
    protected useCount: number;
    constructor(metadata: ModelMetadata);
    abstract load(modelPath: string): Promise<void>;
    abstract predict(input: any): Promise<any>;
    abstract unload(): Promise<void>;
    abstract getMemoryUsage(): number;
    getMetadata(): ModelMetadata;
    recordUsage(): void;
    getLastUsed(): Date;
    getUseCount(): number;
}
export declare class TensorFlowModelWrapper extends ModelWrapper {
    private model;
    load(modelPath: string): Promise<void>;
    predict(input: any): Promise<any>;
    unload(): Promise<void>;
    getMemoryUsage(): number;
}
export declare class ONNXModelWrapper extends ModelWrapper {
    load(modelPath: string): Promise<void>;
    predict(input: any): Promise<any>;
    unload(): Promise<void>;
    getMemoryUsage(): number;
}
export declare class ModelServer extends EventEmitter {
    private registry;
    private config;
    private loadedModels;
    private modelUsageStats;
    private healthCheckTimer?;
    constructor(registry: ModelRegistry, config: ModelServerConfig);
    start(): Promise<void>;
    stop(): Promise<void>;
    predict(request: PredictionRequest): Promise<PredictionResponse>;
    batchPredict(requests: PredictionRequest[]): Promise<PredictionResponse[]>;
    private getOrLoadModel;
    private createModelWrapper;
    private warmupModel;
    private createDummyInput;
    private evictLeastUsedModel;
    private preloadModels;
    private startHealthCheck;
    getHealth(): Promise<{
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
    }>;
    private getModelKey;
    private updateStats;
    private calculateConfidence;
    getStats(): Map<string, {
        requests: number;
        totalTime: number;
        avgTime: number;
    }>;
}
export declare class ABTestingServer {
    private registry;
    private config;
    private servers;
    private trafficSplits;
    constructor(registry: ModelRegistry, config: ModelServerConfig);
    addVariant(modelId: string, version: string, trafficPercentage: number): Promise<void>;
    predict(request: PredictionRequest): Promise<PredictionResponse>;
    private selectServer;
}
//# sourceMappingURL=model-server.d.ts.map