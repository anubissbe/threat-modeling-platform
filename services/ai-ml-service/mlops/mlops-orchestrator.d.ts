import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { ModelServerConfig } from './serving/model-server';
import { MonitoringConfig } from './monitoring/model-monitoring';
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
export declare class MLOpsOrchestrator {
    private modelRegistry;
    private modelServer;
    private trainingPipeline;
    private modelMonitoring;
    private experimentManager;
    private config;
    constructor(config: MLOpsConfig);
    start(): Promise<void>;
    stop(): Promise<void>;
    registerAPI(fastify: FastifyInstance, options: FastifyPluginOptions): Promise<void>;
    retrainModel(modelId: string, newDataPath: string): Promise<string>;
    setupAutomatedRetraining(modelId: string, schedule: string, dataSource: string): Promise<void>;
    initializeDriftDetection(modelId: string, referenceDataPath: string): Promise<void>;
    getDashboardData(): Promise<{
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
    }>;
}
export declare function createMLOpsOrchestrator(config: MLOpsConfig): Promise<MLOpsOrchestrator>;
//# sourceMappingURL=mlops-orchestrator.d.ts.map