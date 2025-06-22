import { z } from 'zod';
export declare const ModelMetadataSchema: z.ZodObject<{
    modelId: z.ZodString;
    modelName: z.ZodString;
    version: z.ZodString;
    modelType: z.ZodEnum<["threat-classifier", "vulnerability-predictor", "mitigation-recommender", "pattern-recognizer", "ensemble"]>;
    framework: z.ZodEnum<["tensorflow", "pytorch", "onnx", "custom"]>;
    metrics: z.ZodObject<{
        accuracy: z.ZodOptional<z.ZodNumber>;
        precision: z.ZodOptional<z.ZodNumber>;
        recall: z.ZodOptional<z.ZodNumber>;
        f1Score: z.ZodOptional<z.ZodNumber>;
        auc: z.ZodOptional<z.ZodNumber>;
        loss: z.ZodOptional<z.ZodNumber>;
        customMetrics: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>;
    }, "strip", z.ZodTypeAny, {
        accuracy?: number | undefined;
        loss?: number | undefined;
        precision?: number | undefined;
        recall?: number | undefined;
        f1Score?: number | undefined;
        auc?: number | undefined;
        customMetrics?: Record<string, number> | undefined;
    }, {
        accuracy?: number | undefined;
        loss?: number | undefined;
        precision?: number | undefined;
        recall?: number | undefined;
        f1Score?: number | undefined;
        auc?: number | undefined;
        customMetrics?: Record<string, number> | undefined;
    }>;
    trainingInfo: z.ZodObject<{
        datasetVersion: z.ZodString;
        datasetSize: z.ZodNumber;
        trainingDuration: z.ZodNumber;
        epochs: z.ZodOptional<z.ZodNumber>;
        batchSize: z.ZodOptional<z.ZodNumber>;
        learningRate: z.ZodOptional<z.ZodNumber>;
        hyperparameters: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    }, "strip", z.ZodTypeAny, {
        datasetSize: number;
        datasetVersion: string;
        trainingDuration: number;
        epochs?: number | undefined;
        batchSize?: number | undefined;
        learningRate?: number | undefined;
        hyperparameters?: Record<string, any> | undefined;
    }, {
        datasetSize: number;
        datasetVersion: string;
        trainingDuration: number;
        epochs?: number | undefined;
        batchSize?: number | undefined;
        learningRate?: number | undefined;
        hyperparameters?: Record<string, any> | undefined;
    }>;
    deploymentInfo: z.ZodObject<{
        status: z.ZodEnum<["draft", "staging", "production", "archived"]>;
        deployedAt: z.ZodOptional<z.ZodString>;
        deployedBy: z.ZodOptional<z.ZodString>;
        endpoints: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        resourceRequirements: z.ZodOptional<z.ZodObject<{
            cpu: z.ZodOptional<z.ZodString>;
            memory: z.ZodOptional<z.ZodString>;
            gpu: z.ZodOptional<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            cpu?: string | undefined;
            memory?: string | undefined;
            gpu?: boolean | undefined;
        }, {
            cpu?: string | undefined;
            memory?: string | undefined;
            gpu?: boolean | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        status: "production" | "draft" | "staging" | "archived";
        deployedAt?: string | undefined;
        deployedBy?: string | undefined;
        endpoints?: string[] | undefined;
        resourceRequirements?: {
            cpu?: string | undefined;
            memory?: string | undefined;
            gpu?: boolean | undefined;
        } | undefined;
    }, {
        status: "production" | "draft" | "staging" | "archived";
        deployedAt?: string | undefined;
        deployedBy?: string | undefined;
        endpoints?: string[] | undefined;
        resourceRequirements?: {
            cpu?: string | undefined;
            memory?: string | undefined;
            gpu?: boolean | undefined;
        } | undefined;
    }>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    description: z.ZodOptional<z.ZodString>;
    createdAt: z.ZodString;
    createdBy: z.ZodString;
    checksum: z.ZodString;
}, "strip", z.ZodTypeAny, {
    modelType: "threat-classifier" | "vulnerability-predictor" | "mitigation-recommender" | "pattern-recognizer" | "ensemble";
    version: string;
    modelId: string;
    modelName: string;
    framework: "custom" | "tensorflow" | "pytorch" | "onnx";
    metrics: {
        accuracy?: number | undefined;
        loss?: number | undefined;
        precision?: number | undefined;
        recall?: number | undefined;
        f1Score?: number | undefined;
        auc?: number | undefined;
        customMetrics?: Record<string, number> | undefined;
    };
    trainingInfo: {
        datasetSize: number;
        datasetVersion: string;
        trainingDuration: number;
        epochs?: number | undefined;
        batchSize?: number | undefined;
        learningRate?: number | undefined;
        hyperparameters?: Record<string, any> | undefined;
    };
    deploymentInfo: {
        status: "production" | "draft" | "staging" | "archived";
        deployedAt?: string | undefined;
        deployedBy?: string | undefined;
        endpoints?: string[] | undefined;
        resourceRequirements?: {
            cpu?: string | undefined;
            memory?: string | undefined;
            gpu?: boolean | undefined;
        } | undefined;
    };
    createdAt: string;
    createdBy: string;
    checksum: string;
    description?: string | undefined;
    tags?: string[] | undefined;
}, {
    modelType: "threat-classifier" | "vulnerability-predictor" | "mitigation-recommender" | "pattern-recognizer" | "ensemble";
    version: string;
    modelId: string;
    modelName: string;
    framework: "custom" | "tensorflow" | "pytorch" | "onnx";
    metrics: {
        accuracy?: number | undefined;
        loss?: number | undefined;
        precision?: number | undefined;
        recall?: number | undefined;
        f1Score?: number | undefined;
        auc?: number | undefined;
        customMetrics?: Record<string, number> | undefined;
    };
    trainingInfo: {
        datasetSize: number;
        datasetVersion: string;
        trainingDuration: number;
        epochs?: number | undefined;
        batchSize?: number | undefined;
        learningRate?: number | undefined;
        hyperparameters?: Record<string, any> | undefined;
    };
    deploymentInfo: {
        status: "production" | "draft" | "staging" | "archived";
        deployedAt?: string | undefined;
        deployedBy?: string | undefined;
        endpoints?: string[] | undefined;
        resourceRequirements?: {
            cpu?: string | undefined;
            memory?: string | undefined;
            gpu?: boolean | undefined;
        } | undefined;
    };
    createdAt: string;
    createdBy: string;
    checksum: string;
    description?: string | undefined;
    tags?: string[] | undefined;
}>;
export type ModelMetadata = z.infer<typeof ModelMetadataSchema>;
export interface ModelStorage {
    save(modelId: string, version: string, modelPath: string, metadata: ModelMetadata): Promise<void>;
    load(modelId: string, version: string): Promise<{
        modelPath: string;
        metadata: ModelMetadata;
    }>;
    list(modelId?: string): Promise<ModelMetadata[]>;
    promote(modelId: string, version: string, targetStage: 'staging' | 'production'): Promise<void>;
    getLatest(modelId: string, stage?: 'staging' | 'production'): Promise<ModelMetadata>;
    delete(modelId: string, version: string): Promise<void>;
}
export declare class S3ModelStorage implements ModelStorage {
    private s3Client;
    private bucketName;
    constructor(config: {
        region: string;
        endpoint?: string;
        bucketName: string;
    });
    save(modelId: string, version: string, modelPath: string, metadata: ModelMetadata): Promise<void>;
    load(modelId: string, version: string): Promise<{
        modelPath: string;
        metadata: ModelMetadata;
    }>;
    list(modelId?: string): Promise<ModelMetadata[]>;
    promote(modelId: string, version: string, targetStage: 'staging' | 'production'): Promise<void>;
    getLatest(modelId: string, stage?: 'staging' | 'production'): Promise<ModelMetadata>;
    delete(modelId: string, version: string): Promise<void>;
}
export declare class LocalModelStorage implements ModelStorage {
    private basePath;
    constructor(basePath: string);
    save(modelId: string, version: string, modelPath: string, metadata: ModelMetadata): Promise<void>;
    load(modelId: string, version: string): Promise<{
        modelPath: string;
        metadata: ModelMetadata;
    }>;
    list(modelId?: string): Promise<ModelMetadata[]>;
    promote(modelId: string, version: string, targetStage: 'staging' | 'production'): Promise<void>;
    getLatest(modelId: string, stage?: 'staging' | 'production'): Promise<ModelMetadata>;
    delete(modelId: string, version: string): Promise<void>;
}
export declare class ModelRegistry {
    private storage;
    constructor(storage: ModelStorage);
    registerModel(modelPath: string, metadata: Omit<ModelMetadata, 'checksum' | 'createdAt'>): Promise<ModelMetadata>;
    getModel(modelId: string, version?: string): Promise<{
        modelPath: string;
        metadata: ModelMetadata;
    }>;
    listModels(modelId?: string): Promise<ModelMetadata[]>;
    promoteModel(modelId: string, version: string, targetStage: 'staging' | 'production'): Promise<void>;
    compareModels(modelId: string, version1: string, version2: string): Promise<{
        version1: ModelMetadata;
        version2: ModelMetadata;
        metricsDiff: Record<string, number>;
    }>;
    private calculateChecksum;
}
export declare function createModelStorage(config: {
    type: 'local' | 's3';
    localPath?: string;
    s3Config?: {
        region: string;
        endpoint?: string;
        bucketName: string;
    };
}): ModelStorage;
//# sourceMappingURL=model-registry.d.ts.map