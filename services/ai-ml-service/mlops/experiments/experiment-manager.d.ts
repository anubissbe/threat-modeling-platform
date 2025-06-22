import { z } from 'zod';
import { ModelRegistry } from '../model-registry/model-registry';
import { TrainingPipeline } from '../training-pipeline/training-pipeline';
export declare const ExperimentConfigSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    objective: z.ZodEnum<["maximize", "minimize"]>;
    metric: z.ZodString;
    searchSpace: z.ZodRecord<z.ZodString, z.ZodObject<{
        type: z.ZodEnum<["float", "int", "categorical", "log_uniform"]>;
        low: z.ZodOptional<z.ZodNumber>;
        high: z.ZodOptional<z.ZodNumber>;
        choices: z.ZodOptional<z.ZodArray<z.ZodAny, "many">>;
        step: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        type: "float" | "int" | "categorical" | "log_uniform";
        high?: number | undefined;
        low?: number | undefined;
        step?: number | undefined;
        choices?: any[] | undefined;
    }, {
        type: "float" | "int" | "categorical" | "log_uniform";
        high?: number | undefined;
        low?: number | undefined;
        step?: number | undefined;
        choices?: any[] | undefined;
    }>>;
    searchStrategy: z.ZodEnum<["grid", "random", "bayesian", "hyperband"]>;
    maxTrials: z.ZodNumber;
    parallelTrials: z.ZodDefault<z.ZodNumber>;
    timeout: z.ZodOptional<z.ZodNumber>;
    earlyStoppingRounds: z.ZodOptional<z.ZodNumber>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    metric: string;
    name: string;
    objective: "maximize" | "minimize";
    searchSpace: Record<string, {
        type: "float" | "int" | "categorical" | "log_uniform";
        high?: number | undefined;
        low?: number | undefined;
        step?: number | undefined;
        choices?: any[] | undefined;
    }>;
    searchStrategy: "grid" | "random" | "bayesian" | "hyperband";
    maxTrials: number;
    parallelTrials: number;
    description?: string | undefined;
    timeout?: number | undefined;
    tags?: string[] | undefined;
    earlyStoppingRounds?: number | undefined;
}, {
    metric: string;
    name: string;
    objective: "maximize" | "minimize";
    searchSpace: Record<string, {
        type: "float" | "int" | "categorical" | "log_uniform";
        high?: number | undefined;
        low?: number | undefined;
        step?: number | undefined;
        choices?: any[] | undefined;
    }>;
    searchStrategy: "grid" | "random" | "bayesian" | "hyperband";
    maxTrials: number;
    description?: string | undefined;
    timeout?: number | undefined;
    tags?: string[] | undefined;
    parallelTrials?: number | undefined;
    earlyStoppingRounds?: number | undefined;
}>;
export type ExperimentConfig = z.infer<typeof ExperimentConfigSchema>;
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
export declare abstract class SearchStrategy {
    protected config: ExperimentConfig;
    constructor(config: ExperimentConfig);
    abstract suggestNext(history: Trial[]): Record<string, any> | null;
    abstract shouldStop(history: Trial[]): boolean;
}
export declare class GridSearchStrategy extends SearchStrategy {
    private grid;
    private currentIndex;
    constructor(config: ExperimentConfig);
    private generateGrid;
    private cartesianProduct;
    suggestNext(history: Trial[]): Record<string, any> | null;
    shouldStop(history: Trial[]): boolean;
}
export declare class RandomSearchStrategy extends SearchStrategy {
    private trialsGenerated;
    suggestNext(history: Trial[]): Record<string, any> | null;
    shouldStop(history: Trial[]): boolean;
}
export declare class BayesianSearchStrategy extends SearchStrategy {
    private acquisitionFunction;
    suggestNext(history: Trial[]): Record<string, any> | null;
    private findBestTrial;
    private sampleFromSpace;
    private perturbParameter;
    shouldStop(history: Trial[]): boolean;
    private calculateVariance;
}
export declare class ExperimentManager {
    private modelRegistry;
    private experiments;
    private trainingPipeline;
    private mlflow?;
    constructor(modelRegistry: ModelRegistry, trainingPipeline: TrainingPipeline, mlflowUrl?: string);
    createExperiment(config: ExperimentConfig): Promise<string>;
    runExperiment(experimentId: string): Promise<void>;
    private runTrial;
    private createSearchStrategy;
    private createTrainingConfig;
    private waitForJob;
    private extractMetrics;
    private findBestTrial;
    getExperiment(experimentId: string): Promise<Experiment | undefined>;
    compareExperiments(experimentIds: string[]): Promise<{
        experiments: Experiment[];
        comparison: {
            bestTrial: {
                experimentId: string;
                trial: Trial;
            };
            metricComparison: Record<string, Record<string, number>>;
        };
    }>;
}
//# sourceMappingURL=experiment-manager.d.ts.map