import { z } from 'zod';
import * as tf from '@tensorflow/tfjs-node';
import { ModelRegistry } from '../model-registry/model-registry';
import { EventEmitter } from 'events';
export declare const TrainingConfigSchema: z.ZodObject<{
    modelType: z.ZodEnum<["threat-classifier", "vulnerability-predictor", "mitigation-recommender", "pattern-recognizer"]>;
    datasetConfig: z.ZodObject<{
        trainPath: z.ZodString;
        validationPath: z.ZodString;
        testPath: z.ZodOptional<z.ZodString>;
        augmentation: z.ZodOptional<z.ZodObject<{
            enabled: z.ZodBoolean;
            techniques: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        }, "strip", z.ZodTypeAny, {
            enabled: boolean;
            techniques?: string[] | undefined;
        }, {
            enabled: boolean;
            techniques?: string[] | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        trainPath: string;
        validationPath: string;
        testPath?: string | undefined;
        augmentation?: {
            enabled: boolean;
            techniques?: string[] | undefined;
        } | undefined;
    }, {
        trainPath: string;
        validationPath: string;
        testPath?: string | undefined;
        augmentation?: {
            enabled: boolean;
            techniques?: string[] | undefined;
        } | undefined;
    }>;
    modelConfig: z.ZodObject<{
        architecture: z.ZodString;
        layers: z.ZodOptional<z.ZodArray<z.ZodAny, "many">>;
        optimizer: z.ZodObject<{
            type: z.ZodString;
            learningRate: z.ZodNumber;
            decay: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            type: string;
            learningRate: number;
            decay?: number | undefined;
        }, {
            type: string;
            learningRate: number;
            decay?: number | undefined;
        }>;
        loss: z.ZodString;
        metrics: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        loss: string;
        metrics: string[];
        architecture: string;
        optimizer: {
            type: string;
            learningRate: number;
            decay?: number | undefined;
        };
        layers?: any[] | undefined;
    }, {
        loss: string;
        metrics: string[];
        architecture: string;
        optimizer: {
            type: string;
            learningRate: number;
            decay?: number | undefined;
        };
        layers?: any[] | undefined;
    }>;
    trainingConfig: z.ZodObject<{
        epochs: z.ZodNumber;
        batchSize: z.ZodNumber;
        validationSplit: z.ZodOptional<z.ZodNumber>;
        earlyStopping: z.ZodOptional<z.ZodObject<{
            enabled: z.ZodBoolean;
            patience: z.ZodNumber;
            monitor: z.ZodString;
            mode: z.ZodEnum<["min", "max"]>;
        }, "strip", z.ZodTypeAny, {
            monitor: string;
            enabled: boolean;
            patience: number;
            mode: "max" | "min";
        }, {
            monitor: string;
            enabled: boolean;
            patience: number;
            mode: "max" | "min";
        }>>;
        checkpointing: z.ZodOptional<z.ZodObject<{
            enabled: z.ZodBoolean;
            saveFrequency: z.ZodOptional<z.ZodNumber>;
            saveBestOnly: z.ZodOptional<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            enabled: boolean;
            saveFrequency?: number | undefined;
            saveBestOnly?: boolean | undefined;
        }, {
            enabled: boolean;
            saveFrequency?: number | undefined;
            saveBestOnly?: boolean | undefined;
        }>>;
        distributed: z.ZodOptional<z.ZodObject<{
            enabled: z.ZodBoolean;
            strategy: z.ZodOptional<z.ZodEnum<["data-parallel", "model-parallel"]>>;
            workers: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            enabled: boolean;
            strategy?: "data-parallel" | "model-parallel" | undefined;
            workers?: number | undefined;
        }, {
            enabled: boolean;
            strategy?: "data-parallel" | "model-parallel" | undefined;
            workers?: number | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        epochs: number;
        batchSize: number;
        validationSplit?: number | undefined;
        earlyStopping?: {
            monitor: string;
            enabled: boolean;
            patience: number;
            mode: "max" | "min";
        } | undefined;
        checkpointing?: {
            enabled: boolean;
            saveFrequency?: number | undefined;
            saveBestOnly?: boolean | undefined;
        } | undefined;
        distributed?: {
            enabled: boolean;
            strategy?: "data-parallel" | "model-parallel" | undefined;
            workers?: number | undefined;
        } | undefined;
    }, {
        epochs: number;
        batchSize: number;
        validationSplit?: number | undefined;
        earlyStopping?: {
            monitor: string;
            enabled: boolean;
            patience: number;
            mode: "max" | "min";
        } | undefined;
        checkpointing?: {
            enabled: boolean;
            saveFrequency?: number | undefined;
            saveBestOnly?: boolean | undefined;
        } | undefined;
        distributed?: {
            enabled: boolean;
            strategy?: "data-parallel" | "model-parallel" | undefined;
            workers?: number | undefined;
        } | undefined;
    }>;
    hyperparameters: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    experimentName: z.ZodString;
    tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    modelType: "threat-classifier" | "vulnerability-predictor" | "mitigation-recommender" | "pattern-recognizer";
    datasetConfig: {
        trainPath: string;
        validationPath: string;
        testPath?: string | undefined;
        augmentation?: {
            enabled: boolean;
            techniques?: string[] | undefined;
        } | undefined;
    };
    modelConfig: {
        loss: string;
        metrics: string[];
        architecture: string;
        optimizer: {
            type: string;
            learningRate: number;
            decay?: number | undefined;
        };
        layers?: any[] | undefined;
    };
    trainingConfig: {
        epochs: number;
        batchSize: number;
        validationSplit?: number | undefined;
        earlyStopping?: {
            monitor: string;
            enabled: boolean;
            patience: number;
            mode: "max" | "min";
        } | undefined;
        checkpointing?: {
            enabled: boolean;
            saveFrequency?: number | undefined;
            saveBestOnly?: boolean | undefined;
        } | undefined;
        distributed?: {
            enabled: boolean;
            strategy?: "data-parallel" | "model-parallel" | undefined;
            workers?: number | undefined;
        } | undefined;
    };
    experimentName: string;
    tags?: string[] | undefined;
    hyperparameters?: Record<string, any> | undefined;
}, {
    modelType: "threat-classifier" | "vulnerability-predictor" | "mitigation-recommender" | "pattern-recognizer";
    datasetConfig: {
        trainPath: string;
        validationPath: string;
        testPath?: string | undefined;
        augmentation?: {
            enabled: boolean;
            techniques?: string[] | undefined;
        } | undefined;
    };
    modelConfig: {
        loss: string;
        metrics: string[];
        architecture: string;
        optimizer: {
            type: string;
            learningRate: number;
            decay?: number | undefined;
        };
        layers?: any[] | undefined;
    };
    trainingConfig: {
        epochs: number;
        batchSize: number;
        validationSplit?: number | undefined;
        earlyStopping?: {
            monitor: string;
            enabled: boolean;
            patience: number;
            mode: "max" | "min";
        } | undefined;
        checkpointing?: {
            enabled: boolean;
            saveFrequency?: number | undefined;
            saveBestOnly?: boolean | undefined;
        } | undefined;
        distributed?: {
            enabled: boolean;
            strategy?: "data-parallel" | "model-parallel" | undefined;
            workers?: number | undefined;
        } | undefined;
    };
    experimentName: string;
    tags?: string[] | undefined;
    hyperparameters?: Record<string, any> | undefined;
}>;
export type TrainingConfig = z.infer<typeof TrainingConfigSchema>;
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
export interface TrainingMetrics {
    trainLoss: number[];
    valLoss: number[];
    trainMetrics: Record<string, number[]>;
    valMetrics: Record<string, number[]>;
    testMetrics?: Record<string, number>;
    bestEpoch?: number;
    totalTrainingTime?: number;
}
export interface Dataset {
    load(): Promise<{
        train: tf.data.Dataset<any>;
        validation: tf.data.Dataset<any>;
        test?: tf.data.Dataset<any>;
    }>;
    getMetadata(): {
        size: number;
        features: string[];
        classes?: string[];
    };
}
export declare abstract class BaseTrainer extends EventEmitter {
    protected config: TrainingConfig;
    protected model?: tf.LayersModel;
    protected metrics: TrainingMetrics;
    constructor(config: TrainingConfig);
    abstract buildModel(): tf.LayersModel;
    abstract preprocessData(data: any): any;
    abstract postprocessPredictions(predictions: any): any;
    train(dataset: Dataset): Promise<{
        modelPath: string;
        metrics: TrainingMetrics;
    }>;
    protected compileModel(): void;
    protected createOptimizer(): tf.Optimizer;
    protected setupCallbacks(): tf.CustomCallbackArgs;
    protected evaluateTestSet(testData: tf.data.Dataset<any>): Promise<void>;
    protected saveModel(): Promise<string>;
}
export declare class ThreatClassifierTrainer extends BaseTrainer {
    buildModel(): tf.LayersModel;
    preprocessData(data: any): any;
    postprocessPredictions(predictions: any): any;
}
export declare class TrainingPipeline {
    private queue;
    private registry;
    private mlflow?;
    private jobs;
    constructor(registry: ModelRegistry, redisUrl: string, mlflowUrl?: string);
    submitJob(config: TrainingConfig): Promise<string>;
    getJob(jobId: string): Promise<TrainingJob | undefined>;
    cancelJob(jobId: string): Promise<void>;
    private setupQueueProcessing;
    private createTrainer;
    private loadDataset;
    private registerModel;
    private generateJobId;
    private generateVersion;
}
export declare class DistributedTrainingCoordinator {
}
//# sourceMappingURL=training-pipeline.d.ts.map