"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DistributedTrainingCoordinator = exports.TrainingPipeline = exports.ThreatClassifierTrainer = exports.BaseTrainer = exports.TrainingConfigSchema = void 0;
const zod_1 = require("zod");
const tf = __importStar(require("@tensorflow/tfjs-node"));
const events_1 = require("events");
const pino_1 = __importDefault(require("pino"));
const bull_1 = __importDefault(require("bull"));
const mlflow_client_1 = require("./mlflow-client");
const logger = (0, pino_1.default)({ name: 'training-pipeline' });
exports.TrainingConfigSchema = zod_1.z.object({
    modelType: zod_1.z.enum(['threat-classifier', 'vulnerability-predictor', 'mitigation-recommender', 'pattern-recognizer']),
    datasetConfig: zod_1.z.object({
        trainPath: zod_1.z.string(),
        validationPath: zod_1.z.string(),
        testPath: zod_1.z.string().optional(),
        augmentation: zod_1.z.object({
            enabled: zod_1.z.boolean(),
            techniques: zod_1.z.array(zod_1.z.string()).optional()
        }).optional()
    }),
    modelConfig: zod_1.z.object({
        architecture: zod_1.z.string(),
        layers: zod_1.z.array(zod_1.z.any()).optional(),
        optimizer: zod_1.z.object({
            type: zod_1.z.string(),
            learningRate: zod_1.z.number(),
            decay: zod_1.z.number().optional()
        }),
        loss: zod_1.z.string(),
        metrics: zod_1.z.array(zod_1.z.string())
    }),
    trainingConfig: zod_1.z.object({
        epochs: zod_1.z.number(),
        batchSize: zod_1.z.number(),
        validationSplit: zod_1.z.number().optional(),
        earlyStopping: zod_1.z.object({
            enabled: zod_1.z.boolean(),
            patience: zod_1.z.number(),
            monitor: zod_1.z.string(),
            mode: zod_1.z.enum(['min', 'max'])
        }).optional(),
        checkpointing: zod_1.z.object({
            enabled: zod_1.z.boolean(),
            saveFrequency: zod_1.z.number().optional(),
            saveBestOnly: zod_1.z.boolean().optional()
        }).optional(),
        distributed: zod_1.z.object({
            enabled: zod_1.z.boolean(),
            strategy: zod_1.z.enum(['data-parallel', 'model-parallel']).optional(),
            workers: zod_1.z.number().optional()
        }).optional()
    }),
    hyperparameters: zod_1.z.record(zod_1.z.any()).optional(),
    experimentName: zod_1.z.string(),
    tags: zod_1.z.array(zod_1.z.string()).optional()
});
class BaseTrainer extends events_1.EventEmitter {
    config;
    model;
    metrics = {
        trainLoss: [],
        valLoss: [],
        trainMetrics: {},
        valMetrics: {}
    };
    constructor(config) {
        super();
        this.config = config;
    }
    async train(dataset) {
        logger.info({ config: this.config }, 'Starting training...');
        this.emit('training:start', { config: this.config });
        try {
            this.model = this.buildModel();
            this.compileModel();
            const { train, validation, test } = await dataset.load();
            const callbacks = this.setupCallbacks();
            const history = await this.model.fitDataset(train, {
                epochs: this.config.trainingConfig.epochs,
                validationData: validation,
                callbacks,
                verbose: 1
            });
            if (test) {
                await this.evaluateTestSet(test);
            }
            const modelPath = await this.saveModel();
            this.emit('training:complete', { modelPath, metrics: this.metrics });
            return { modelPath, metrics: this.metrics };
        }
        catch (error) {
            logger.error({ error }, 'Training failed');
            this.emit('training:error', { error });
            throw error;
        }
    }
    compileModel() {
        if (!this.model)
            throw new Error('Model not built');
        const optimizer = this.createOptimizer();
        this.model.compile({
            optimizer,
            loss: this.config.modelConfig.loss,
            metrics: this.config.modelConfig.metrics
        });
    }
    createOptimizer() {
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
    setupCallbacks() {
        const callbacks = {
            onEpochEnd: async (epoch, logs) => {
                if (logs) {
                    this.metrics.trainLoss.push(logs.loss);
                    this.metrics.valLoss.push(logs.val_loss);
                    for (const [key, value] of Object.entries(logs)) {
                        if (key.startsWith('val_')) {
                            const metricName = key.substring(4);
                            if (!this.metrics.valMetrics[metricName]) {
                                this.metrics.valMetrics[metricName] = [];
                            }
                            this.metrics.valMetrics[metricName].push(value);
                        }
                        else if (key !== 'loss') {
                            if (!this.metrics.trainMetrics[key]) {
                                this.metrics.trainMetrics[key] = [];
                            }
                            this.metrics.trainMetrics[key].push(value);
                        }
                    }
                    this.emit('training:epoch', { epoch, logs });
                }
            },
            onBatchEnd: async (batch, logs) => {
                this.emit('training:batch', { batch, logs });
            }
        };
        if (this.config.trainingConfig.earlyStopping?.enabled) {
            let bestValue = this.config.trainingConfig.earlyStopping.mode === 'min' ? Infinity : -Infinity;
            let patience = 0;
            const originalOnEpochEnd = callbacks.onEpochEnd;
            callbacks.onEpochEnd = async (epoch, logs) => {
                if (originalOnEpochEnd) {
                    await originalOnEpochEnd(epoch, logs);
                }
                if (logs) {
                    const monitor = this.config.trainingConfig.earlyStopping.monitor;
                    const currentValue = logs[monitor];
                    const improved = this.config.trainingConfig.earlyStopping.mode === 'min'
                        ? currentValue < bestValue
                        : currentValue > bestValue;
                    if (improved) {
                        bestValue = currentValue;
                        patience = 0;
                        this.metrics.bestEpoch = epoch;
                    }
                    else {
                        patience++;
                        if (patience >= this.config.trainingConfig.earlyStopping.patience) {
                            this.emit('training:earlyStopping', { epoch, bestValue });
                        }
                    }
                }
            };
        }
        return callbacks;
    }
    async evaluateTestSet(testData) {
        if (!this.model)
            throw new Error('Model not trained');
        const evaluation = await this.model.evaluateDataset(testData);
        const metricNames = this.model.metricsNames;
        this.metrics.testMetrics = {};
        for (let i = 0; i < metricNames.length; i++) {
            const value = await evaluation[i].data();
            this.metrics.testMetrics[metricNames[i]] = value[0];
            evaluation[i].dispose();
        }
    }
    async saveModel() {
        if (!this.model)
            throw new Error('Model not trained');
        const modelPath = `/tmp/model-${Date.now()}`;
        await this.model.save(`file://${modelPath}`);
        return modelPath;
    }
}
exports.BaseTrainer = BaseTrainer;
class ThreatClassifierTrainer extends BaseTrainer {
    buildModel() {
        const model = tf.sequential();
        model.add(tf.layers.embedding({
            inputDim: 10000,
            outputDim: 128,
            inputLength: 100
        }));
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
        model.add(tf.layers.dense({
            units: 64,
            activation: 'relu'
        }));
        model.add(tf.layers.dropout({ rate: 0.5 }));
        model.add(tf.layers.dense({
            units: 16,
            activation: 'sigmoid'
        }));
        return model;
    }
    preprocessData(data) {
        return data;
    }
    postprocessPredictions(predictions) {
        return predictions;
    }
}
exports.ThreatClassifierTrainer = ThreatClassifierTrainer;
class TrainingPipeline {
    queue;
    registry;
    mlflow;
    jobs = new Map();
    constructor(registry, redisUrl, mlflowUrl) {
        this.registry = registry;
        this.queue = new bull_1.default('training-jobs', redisUrl);
        if (mlflowUrl) {
            this.mlflow = new mlflow_client_1.MLflow(mlflowUrl);
        }
        this.setupQueueProcessing();
    }
    async submitJob(config) {
        const jobId = this.generateJobId();
        const job = {
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
    async getJob(jobId) {
        return this.jobs.get(jobId);
    }
    async cancelJob(jobId) {
        const job = this.jobs.get(jobId);
        if (job && job.status === 'queued') {
            job.status = 'cancelled';
            const bullJob = await this.queue.getJob(jobId);
            if (bullJob) {
                await bullJob.remove();
            }
        }
    }
    setupQueueProcessing() {
        this.queue.process('train', async (job) => {
            const { jobId, config } = job.data;
            const trainingJob = this.jobs.get(jobId);
            if (!trainingJob) {
                throw new Error(`Job ${jobId} not found`);
            }
            try {
                trainingJob.status = 'running';
                trainingJob.startTime = new Date();
                if (this.mlflow) {
                    const experimentId = await this.mlflow.createExperiment(config.experimentName);
                    const runId = await this.mlflow.startRun(experimentId, config.tags);
                    trainingJob.experimentId = experimentId;
                    trainingJob.runId = runId;
                    await this.mlflow.logParams(runId, {
                        modelType: config.modelType,
                        epochs: config.trainingConfig.epochs,
                        batchSize: config.trainingConfig.batchSize,
                        learningRate: config.modelConfig.optimizer.learningRate,
                        ...config.hyperparameters
                    });
                }
                const trainer = this.createTrainer(config);
                trainer.on('training:epoch', async ({ epoch, logs }) => {
                    if (this.mlflow && trainingJob.runId) {
                        await this.mlflow.logMetrics(trainingJob.runId, logs, epoch);
                    }
                    job.progress(Math.round((epoch / config.trainingConfig.epochs) * 100));
                });
                const dataset = await this.loadDataset(config.datasetConfig);
                const { modelPath, metrics } = await trainer.train(dataset);
                trainingJob.metrics = metrics;
                trainingJob.modelPath = modelPath;
                const modelMetadata = await this.registerModel(trainingJob, config);
                if (this.mlflow && trainingJob.runId) {
                    await this.mlflow.endRun(trainingJob.runId, 'FINISHED');
                }
                trainingJob.status = 'completed';
                trainingJob.endTime = new Date();
                logger.info({ jobId, modelId: modelMetadata.modelId }, 'Training completed');
            }
            catch (error) {
                logger.error({ error, jobId }, 'Training failed');
                trainingJob.status = 'failed';
                trainingJob.error = error.message;
                trainingJob.endTime = new Date();
                if (this.mlflow && trainingJob.runId) {
                    await this.mlflow.endRun(trainingJob.runId, 'FAILED');
                }
                throw error;
            }
        });
    }
    createTrainer(config) {
        switch (config.modelType) {
            case 'threat-classifier':
                return new ThreatClassifierTrainer(config);
            default:
                throw new Error(`Unknown model type: ${config.modelType}`);
        }
    }
    async loadDataset(config) {
        throw new Error('Dataset loading not implemented');
    }
    async registerModel(job, config) {
        if (!job.modelPath || !job.metrics) {
            throw new Error('Model training incomplete');
        }
        const version = this.generateVersion();
        const metadata = {
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
                datasetVersion: 'v1',
                datasetSize: 0,
                trainingDuration: job.endTime ? (job.endTime.getTime() - job.startTime.getTime()) / 1000 : 0,
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
    generateJobId() {
        return `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    generateVersion() {
        const date = new Date();
        return `1.0.${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}`;
    }
}
exports.TrainingPipeline = TrainingPipeline;
class DistributedTrainingCoordinator {
}
exports.DistributedTrainingCoordinator = DistributedTrainingCoordinator;
//# sourceMappingURL=training-pipeline.js.map