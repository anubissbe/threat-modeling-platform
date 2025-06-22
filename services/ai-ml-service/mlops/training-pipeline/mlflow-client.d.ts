export interface MLflowExperiment {
    experiment_id: string;
    name: string;
    artifact_location: string;
    lifecycle_stage: string;
    tags: Record<string, string>;
}
export interface MLflowRun {
    run_id: string;
    experiment_id: string;
    status: string;
    start_time: number;
    end_time?: number;
    lifecycle_stage: string;
}
export interface MLflowMetric {
    key: string;
    value: number;
    timestamp: number;
    step: number;
}
export interface MLflowParam {
    key: string;
    value: string;
}
export interface MLflowModel {
    name: string;
    version: string;
    creation_timestamp: number;
    last_updated_timestamp: number;
    description?: string;
    stage: string;
    tags: Record<string, string>;
}
export declare class MLflow {
    private client;
    constructor(baseURL: string);
    createExperiment(name: string, artifactLocation?: string): Promise<string>;
    getExperiment(experimentId: string): Promise<MLflowExperiment>;
    listExperiments(): Promise<MLflowExperiment[]>;
    deleteExperiment(experimentId: string): Promise<void>;
    startRun(experimentId: string, tags?: string[], runName?: string): Promise<string>;
    endRun(runId: string, status: 'FINISHED' | 'FAILED' | 'KILLED'): Promise<void>;
    getRun(runId: string): Promise<MLflowRun>;
    searchRuns(experimentIds: string[], filter?: string, maxResults?: number): Promise<MLflowRun[]>;
    logMetric(runId: string, key: string, value: number, step?: number): Promise<void>;
    logMetrics(runId: string, metrics: Record<string, number>, step?: number): Promise<void>;
    getMetricHistory(runId: string, metricKey: string): Promise<MLflowMetric[]>;
    logParam(runId: string, key: string, value: string): Promise<void>;
    logParams(runId: string, params: Record<string, any>): Promise<void>;
    logArtifact(runId: string, localPath: string, artifactPath?: string): Promise<void>;
    listArtifacts(runId: string, path?: string): Promise<any[]>;
    createRegisteredModel(name: string, description?: string): Promise<void>;
    createModelVersion(name: string, source: string, runId: string, description?: string): Promise<string>;
    transitionModelVersionStage(name: string, version: string, stage: 'None' | 'Staging' | 'Production' | 'Archived'): Promise<void>;
    getModelVersion(name: string, version: string): Promise<MLflowModel>;
    searchModelVersions(filter?: string): Promise<MLflowModel[]>;
    setTag(runId: string, key: string, value: string): Promise<void>;
    setTags(runId: string, tags: Record<string, string>): Promise<void>;
    compareRuns(runIds: string[]): Promise<{
        metrics: Record<string, MLflowMetric[]>;
        params: Record<string, MLflowParam[]>;
    }>;
    deployModel(modelName: string, modelVersion: string, endpoint: string): Promise<void>;
    logModelMetrics(runId: string, trainMetrics: Record<string, number>, valMetrics: Record<string, number>, testMetrics?: Record<string, number>): Promise<void>;
    logConfusionMatrix(runId: string, confusionMatrix: number[][], labels: string[]): Promise<void>;
    logModelExplanation(runId: string, explanations: any, explanationType: 'shap' | 'lime' | 'gradcam'): Promise<void>;
}
//# sourceMappingURL=mlflow-client.d.ts.map