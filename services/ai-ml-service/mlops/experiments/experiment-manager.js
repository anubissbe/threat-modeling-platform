"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExperimentManager = exports.BayesianSearchStrategy = exports.RandomSearchStrategy = exports.GridSearchStrategy = exports.SearchStrategy = exports.ExperimentConfigSchema = void 0;
const zod_1 = require("zod");
const uuid_1 = require("uuid");
const mlflow_client_1 = require("../training-pipeline/mlflow-client");
const pino_1 = __importDefault(require("pino"));
const logger = (0, pino_1.default)({ name: 'experiment-manager' });
exports.ExperimentConfigSchema = zod_1.z.object({
    name: zod_1.z.string(),
    description: zod_1.z.string().optional(),
    objective: zod_1.z.enum(['maximize', 'minimize']),
    metric: zod_1.z.string(),
    searchSpace: zod_1.z.record(zod_1.z.object({
        type: zod_1.z.enum(['float', 'int', 'categorical', 'log_uniform']),
        low: zod_1.z.number().optional(),
        high: zod_1.z.number().optional(),
        choices: zod_1.z.array(zod_1.z.any()).optional(),
        step: zod_1.z.number().optional()
    })),
    searchStrategy: zod_1.z.enum(['grid', 'random', 'bayesian', 'hyperband']),
    maxTrials: zod_1.z.number(),
    parallelTrials: zod_1.z.number().default(1),
    timeout: zod_1.z.number().optional(),
    earlyStoppingRounds: zod_1.z.number().optional(),
    tags: zod_1.z.array(zod_1.z.string()).optional()
});
class SearchStrategy {
    config;
    constructor(config) {
        this.config = config;
    }
}
exports.SearchStrategy = SearchStrategy;
class GridSearchStrategy extends SearchStrategy {
    grid = [];
    currentIndex = 0;
    constructor(config) {
        super(config);
        this.generateGrid();
    }
    generateGrid() {
        const keys = Object.keys(this.config.searchSpace);
        const values = [];
        for (const key of keys) {
            const space = this.config.searchSpace[key];
            if (space.type === 'categorical' && space.choices) {
                values.push(space.choices);
            }
            else if (space.type === 'int' && space.low !== undefined && space.high !== undefined) {
                const step = space.step || 1;
                const range = [];
                for (let i = space.low; i <= space.high; i += step) {
                    range.push(i);
                }
                values.push(range);
            }
            else if (space.type === 'float' && space.low !== undefined && space.high !== undefined) {
                const steps = 10;
                const stepSize = (space.high - space.low) / steps;
                const range = [];
                for (let i = 0; i <= steps; i++) {
                    range.push(space.low + i * stepSize);
                }
                values.push(range);
            }
        }
        this.grid = this.cartesianProduct(keys, values);
    }
    cartesianProduct(keys, values) {
        if (values.length === 0)
            return [{}];
        const result = [];
        const helper = (index, current) => {
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
    suggestNext(history) {
        if (this.currentIndex >= this.grid.length) {
            return null;
        }
        const params = this.grid[this.currentIndex];
        this.currentIndex++;
        return params;
    }
    shouldStop(history) {
        return this.currentIndex >= this.grid.length;
    }
}
exports.GridSearchStrategy = GridSearchStrategy;
class RandomSearchStrategy extends SearchStrategy {
    trialsGenerated = 0;
    suggestNext(history) {
        if (this.trialsGenerated >= this.config.maxTrials) {
            return null;
        }
        const params = {};
        for (const [key, space] of Object.entries(this.config.searchSpace)) {
            if (space.type === 'categorical' && space.choices) {
                params[key] = space.choices[Math.floor(Math.random() * space.choices.length)];
            }
            else if (space.type === 'int' && space.low !== undefined && space.high !== undefined) {
                params[key] = Math.floor(Math.random() * (space.high - space.low + 1)) + space.low;
            }
            else if (space.type === 'float' && space.low !== undefined && space.high !== undefined) {
                params[key] = Math.random() * (space.high - space.low) + space.low;
            }
            else if (space.type === 'log_uniform' && space.low !== undefined && space.high !== undefined) {
                const logLow = Math.log(space.low);
                const logHigh = Math.log(space.high);
                params[key] = Math.exp(Math.random() * (logHigh - logLow) + logLow);
            }
        }
        this.trialsGenerated++;
        return params;
    }
    shouldStop(history) {
        return this.trialsGenerated >= this.config.maxTrials;
    }
}
exports.RandomSearchStrategy = RandomSearchStrategy;
class BayesianSearchStrategy extends SearchStrategy {
    acquisitionFunction = 'ei';
    suggestNext(history) {
        if (history.length === 0) {
            return new RandomSearchStrategy(this.config).suggestNext(history);
        }
        const bestTrial = this.findBestTrial(history);
        if (!bestTrial) {
            return new RandomSearchStrategy(this.config).suggestNext(history);
        }
        const params = {};
        const explorationRate = 0.2;
        for (const [key, space] of Object.entries(this.config.searchSpace)) {
            if (Math.random() < explorationRate) {
                params[key] = this.sampleFromSpace(key, space);
            }
            else {
                params[key] = this.perturbParameter(bestTrial.parameters[key], space);
            }
        }
        return params;
    }
    findBestTrial(history) {
        const completed = history.filter(t => t.status === 'completed' && t.metrics[this.config.metric] !== undefined);
        if (completed.length === 0)
            return null;
        return completed.reduce((best, trial) => {
            const currentValue = trial.metrics[this.config.metric];
            const bestValue = best.metrics[this.config.metric];
            if (this.config.objective === 'maximize') {
                return currentValue > bestValue ? trial : best;
            }
            else {
                return currentValue < bestValue ? trial : best;
            }
        });
    }
    sampleFromSpace(key, space) {
        if (space.type === 'categorical' && space.choices) {
            return space.choices[Math.floor(Math.random() * space.choices.length)];
        }
        else if (space.type === 'int' && space.low !== undefined && space.high !== undefined) {
            return Math.floor(Math.random() * (space.high - space.low + 1)) + space.low;
        }
        else if (space.type === 'float' && space.low !== undefined && space.high !== undefined) {
            return Math.random() * (space.high - space.low) + space.low;
        }
        return 0;
    }
    perturbParameter(value, space) {
        if (space.type === 'categorical') {
            if (Math.random() < 0.1) {
                return this.sampleFromSpace('', space);
            }
            return value;
        }
        else if (space.type === 'int' || space.type === 'float') {
            const range = space.high - space.low;
            const noise = (Math.random() - 0.5) * range * 0.1;
            let newValue = value + noise;
            newValue = Math.max(space.low, Math.min(space.high, newValue));
            if (space.type === 'int') {
                newValue = Math.round(newValue);
            }
            return newValue;
        }
        return value;
    }
    shouldStop(history) {
        if (history.length >= this.config.maxTrials) {
            return true;
        }
        if (this.config.earlyStoppingRounds && history.length > this.config.earlyStoppingRounds) {
            const recentTrials = history.slice(-this.config.earlyStoppingRounds);
            const values = recentTrials
                .filter(t => t.status === 'completed')
                .map(t => t.metrics[this.config.metric]);
            if (values.length === this.config.earlyStoppingRounds) {
                const variance = this.calculateVariance(values);
                if (variance < 0.001) {
                    logger.info('Early stopping due to convergence');
                    return true;
                }
            }
        }
        return false;
    }
    calculateVariance(values) {
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        return values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
    }
}
exports.BayesianSearchStrategy = BayesianSearchStrategy;
class ExperimentManager {
    modelRegistry;
    experiments = new Map();
    trainingPipeline;
    mlflow;
    constructor(modelRegistry, trainingPipeline, mlflowUrl) {
        this.modelRegistry = modelRegistry;
        this.trainingPipeline = trainingPipeline;
        if (mlflowUrl) {
            this.mlflow = new mlflow_client_1.MLflow(mlflowUrl);
        }
    }
    async createExperiment(config) {
        const experiment = {
            id: (0, uuid_1.v4)(),
            config,
            status: 'created',
            trials: [],
            createdAt: new Date()
        };
        this.experiments.set(experiment.id, experiment);
        if (this.mlflow) {
            await this.mlflow.createExperiment(config.name);
        }
        logger.info({ experimentId: experiment.id, name: config.name }, 'Experiment created');
        return experiment.id;
    }
    async runExperiment(experimentId) {
        const experiment = this.experiments.get(experimentId);
        if (!experiment) {
            throw new Error(`Experiment ${experimentId} not found`);
        }
        experiment.status = 'running';
        experiment.startedAt = new Date();
        const strategy = this.createSearchStrategy(experiment.config);
        try {
            while (!strategy.shouldStop(experiment.trials)) {
                const parameters = strategy.suggestNext(experiment.trials);
                if (!parameters)
                    break;
                const trial = {
                    id: (0, uuid_1.v4)(),
                    experimentId,
                    parameters,
                    status: 'pending',
                    metrics: {}
                };
                experiment.trials.push(trial);
                await this.runTrial(experiment, trial);
                if (experiment.config.timeout) {
                    const elapsed = Date.now() - experiment.startedAt.getTime();
                    if (elapsed > experiment.config.timeout * 1000) {
                        logger.info({ experimentId }, 'Experiment timeout reached');
                        break;
                    }
                }
            }
            experiment.bestTrial = this.findBestTrial(experiment);
            experiment.status = 'completed';
            experiment.completedAt = new Date();
            logger.info({
                experimentId,
                bestTrial: experiment.bestTrial?.id,
                bestMetric: experiment.bestTrial?.metrics[experiment.config.metric]
            }, 'Experiment completed');
        }
        catch (error) {
            experiment.status = 'failed';
            logger.error({ error, experimentId }, 'Experiment failed');
            throw error;
        }
    }
    async runTrial(experiment, trial) {
        logger.info({ trialId: trial.id, parameters: trial.parameters }, 'Running trial');
        trial.status = 'running';
        trial.startTime = new Date();
        try {
            const trainingConfig = this.createTrainingConfig(experiment.config, trial.parameters);
            const jobId = await this.trainingPipeline.submitJob(trainingConfig);
            const job = await this.waitForJob(jobId);
            if (job.status === 'completed' && job.metrics) {
                trial.metrics = this.extractMetrics(job.metrics, experiment.config.metric);
                trial.status = 'completed';
                trial.modelId = job.modelPath;
            }
            else {
                trial.status = 'failed';
                trial.error = job.error || 'Training failed';
            }
        }
        catch (error) {
            trial.status = 'failed';
            trial.error = error.message;
            logger.error({ error, trialId: trial.id }, 'Trial failed');
        }
        finally {
            trial.endTime = new Date();
        }
        if (this.mlflow && experiment.config.name) {
            const runId = await this.mlflow.startRun(experiment.config.name);
            await this.mlflow.logParams(runId, trial.parameters);
            await this.mlflow.logMetrics(runId, trial.metrics);
            await this.mlflow.endRun(runId, trial.status === 'completed' ? 'FINISHED' : 'FAILED');
        }
    }
    createSearchStrategy(config) {
        switch (config.searchStrategy) {
            case 'grid':
                return new GridSearchStrategy(config);
            case 'random':
                return new RandomSearchStrategy(config);
            case 'bayesian':
                return new BayesianSearchStrategy(config);
            case 'hyperband':
                return new RandomSearchStrategy(config);
            default:
                throw new Error(`Unknown search strategy: ${config.searchStrategy}`);
        }
    }
    createTrainingConfig(experimentConfig, parameters) {
        return {
            modelType: 'threat-classifier',
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
    async waitForJob(jobId) {
        while (true) {
            const job = await this.trainingPipeline.getJob(jobId);
            if (!job) {
                throw new Error(`Job ${jobId} not found`);
            }
            if (job.status === 'completed' || job.status === 'failed') {
                return job;
            }
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
    extractMetrics(trainingMetrics, targetMetric) {
        const metrics = {};
        if (trainingMetrics.valMetrics && trainingMetrics.valMetrics[targetMetric]) {
            const values = trainingMetrics.valMetrics[targetMetric];
            metrics[targetMetric] = values[values.length - 1];
        }
        if (trainingMetrics.valLoss) {
            metrics.val_loss = trainingMetrics.valLoss[trainingMetrics.valLoss.length - 1];
        }
        return metrics;
    }
    findBestTrial(experiment) {
        const completedTrials = experiment.trials.filter(t => t.status === 'completed');
        if (completedTrials.length === 0)
            return null;
        return completedTrials.reduce((best, trial) => {
            const currentValue = trial.metrics[experiment.config.metric];
            const bestValue = best.metrics[experiment.config.metric];
            if (currentValue === undefined)
                return best;
            if (bestValue === undefined)
                return trial;
            if (experiment.config.objective === 'maximize') {
                return currentValue > bestValue ? trial : best;
            }
            else {
                return currentValue < bestValue ? trial : best;
            }
        });
    }
    async getExperiment(experimentId) {
        return this.experiments.get(experimentId);
    }
    async compareExperiments(experimentIds) {
        const experiments = experimentIds
            .map(id => this.experiments.get(id))
            .filter(e => e !== undefined);
        let bestTrial = null;
        for (const experiment of experiments) {
            if (experiment.bestTrial) {
                if (!bestTrial) {
                    bestTrial = { experimentId: experiment.id, trial: experiment.bestTrial };
                }
                else {
                    const currentValue = experiment.bestTrial.metrics[experiment.config.metric];
                    const bestValue = bestTrial.trial.metrics[experiment.config.metric];
                    if (experiment.config.objective === 'maximize' && currentValue > bestValue) {
                        bestTrial = { experimentId: experiment.id, trial: experiment.bestTrial };
                    }
                    else if (experiment.config.objective === 'minimize' && currentValue < bestValue) {
                        bestTrial = { experimentId: experiment.id, trial: experiment.bestTrial };
                    }
                }
            }
        }
        const metricComparison = {};
        for (const experiment of experiments) {
            if (experiment.bestTrial) {
                metricComparison[experiment.id] = experiment.bestTrial.metrics;
            }
        }
        return {
            experiments,
            comparison: {
                bestTrial: bestTrial,
                metricComparison
            }
        };
    }
}
exports.ExperimentManager = ExperimentManager;
//# sourceMappingURL=experiment-manager.js.map