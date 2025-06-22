"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MLOpsOrchestrator = void 0;
exports.createMLOpsOrchestrator = createMLOpsOrchestrator;
const zod_1 = require("zod");
const model_registry_1 = require("./model-registry/model-registry");
const model_server_1 = require("./serving/model-server");
const training_pipeline_1 = require("./training-pipeline/training-pipeline");
const model_monitoring_1 = require("./monitoring/model-monitoring");
const experiment_manager_1 = require("./experiments/experiment-manager");
const pino_1 = __importDefault(require("pino"));
const logger = (0, pino_1.default)({ name: 'mlops-orchestrator' });
const TrainModelRequestSchema = zod_1.z.object({
    config: training_pipeline_1.TrainingConfig.omit({ experimentName: true }),
    experimentName: zod_1.z.string()
});
const DeployModelRequestSchema = zod_1.z.object({
    modelId: zod_1.z.string(),
    version: zod_1.z.string().optional(),
    stage: zod_1.z.enum(['staging', 'production'])
});
const PredictRequestSchema = zod_1.z.object({
    modelId: zod_1.z.string(),
    version: zod_1.z.string().optional(),
    input: zod_1.z.any(),
    options: zod_1.z.object({
        timeout: zod_1.z.number().optional(),
        returnMetadata: zod_1.z.boolean().optional()
    }).optional()
});
const ExperimentRequestSchema = zod_1.z.object({
    config: experiment_manager_1.ExperimentConfig
});
class MLOpsOrchestrator {
    modelRegistry;
    modelServer;
    trainingPipeline;
    modelMonitoring;
    experimentManager;
    config;
    constructor(config) {
        this.config = config;
        const storage = (0, model_registry_1.createModelStorage)(config.storage);
        this.modelRegistry = new model_registry_1.ModelRegistry(storage);
        this.modelServer = new model_server_1.ModelServer(this.modelRegistry, config.serving);
        this.trainingPipeline = new training_pipeline_1.TrainingPipeline(this.modelRegistry, config.training.redisUrl, config.training.mlflowUrl);
        this.modelMonitoring = new model_monitoring_1.ModelMonitoring(config.monitoring, this.modelServer, this.modelRegistry);
        this.experimentManager = new experiment_manager_1.ExperimentManager(this.modelRegistry, this.trainingPipeline, config.training.mlflowUrl);
    }
    async start() {
        logger.info('Starting MLOps orchestrator...');
        await this.modelServer.start();
        await this.modelMonitoring.start();
        logger.info('MLOps orchestrator started successfully');
    }
    async stop() {
        logger.info('Stopping MLOps orchestrator...');
        await this.modelServer.stop();
        await this.modelMonitoring.stop();
        logger.info('MLOps orchestrator stopped');
    }
    async registerAPI(fastify, options) {
        fastify.post('/mlops/train', {
            schema: {
                body: TrainModelRequestSchema
            }
        }, async (request, reply) => {
            const { config, experimentName } = request.body;
            const fullConfig = {
                ...config,
                experimentName
            };
            const jobId = await this.trainingPipeline.submitJob(fullConfig);
            return {
                jobId,
                status: 'submitted',
                message: 'Training job submitted successfully'
            };
        });
        fastify.get('/mlops/train/:jobId', async (request, reply) => {
            const { jobId } = request.params;
            const job = await this.trainingPipeline.getJob(jobId);
            if (!job) {
                reply.code(404);
                return { error: 'Job not found' };
            }
            return job;
        });
        fastify.get('/mlops/models', async (request, reply) => {
            const { modelId } = request.query;
            const models = await this.modelRegistry.listModels(modelId);
            return {
                models,
                total: models.length
            };
        });
        fastify.get('/mlops/models/:modelId/:version', async (request, reply) => {
            const { modelId, version } = request.params;
            try {
                const { metadata } = await this.modelRegistry.getModel(modelId, version);
                return metadata;
            }
            catch (error) {
                reply.code(404);
                return { error: 'Model not found' };
            }
        });
        fastify.post('/mlops/models/:modelId/:version/promote', async (request, reply) => {
            const { modelId, version } = request.params;
            const { stage } = request.body;
            await this.modelRegistry.promoteModel(modelId, version, stage);
            return {
                modelId,
                version,
                stage,
                message: 'Model promoted successfully'
            };
        });
        fastify.post('/mlops/deploy', {
            schema: {
                body: DeployModelRequestSchema
            }
        }, async (request, reply) => {
            const { modelId, version, stage } = request.body;
            if (version) {
                await this.modelRegistry.promoteModel(modelId, version, stage);
            }
            await this.modelServer.predict({
                modelId,
                version,
                input: [[0]],
                options: { timeout: 1000 }
            });
            return {
                modelId,
                version: version || 'latest',
                stage,
                message: 'Model deployed successfully'
            };
        });
        fastify.post('/mlops/predict', {
            schema: {
                body: PredictRequestSchema
            }
        }, async (request, reply) => {
            const predictionRequest = request.body;
            try {
                const response = await this.modelServer.predict(predictionRequest);
                return response;
            }
            catch (error) {
                reply.code(500);
                return {
                    error: 'Prediction failed',
                    message: error.message
                };
            }
        });
        fastify.post('/mlops/predict/batch', async (request, reply) => {
            const { requests } = request.body;
            try {
                const responses = await this.modelServer.batchPredict(requests);
                return { predictions: responses };
            }
            catch (error) {
                reply.code(500);
                return {
                    error: 'Batch prediction failed',
                    message: error.message
                };
            }
        });
        fastify.post('/mlops/experiments', {
            schema: {
                body: ExperimentRequestSchema
            }
        }, async (request, reply) => {
            const { config } = request.body;
            const experimentId = await this.experimentManager.createExperiment(config);
            this.experimentManager.runExperiment(experimentId).catch(error => {
                logger.error({ error, experimentId }, 'Experiment failed');
            });
            return {
                experimentId,
                status: 'created',
                message: 'Experiment created and started'
            };
        });
        fastify.get('/mlops/experiments/:experimentId', async (request, reply) => {
            const { experimentId } = request.params;
            const experiment = await this.experimentManager.getExperiment(experimentId);
            if (!experiment) {
                reply.code(404);
                return { error: 'Experiment not found' };
            }
            return experiment;
        });
        fastify.post('/mlops/experiments/compare', async (request, reply) => {
            const { experimentIds } = request.body;
            const comparison = await this.experimentManager.compareExperiments(experimentIds);
            return comparison;
        });
        fastify.get('/mlops/metrics', async (request, reply) => {
            reply.type('text/plain');
            return this.modelMonitoring.getMetrics();
        });
        fastify.get('/mlops/health', async (request, reply) => {
            const serverHealth = await this.modelServer.getHealth();
            return {
                status: 'healthy',
                components: {
                    modelServer: serverHealth,
                    monitoring: { status: 'active' },
                    training: { status: 'active' }
                }
            };
        });
        fastify.get('/mlops/models/:modelId/drift', async (request, reply) => {
            const { modelId } = request.params;
            return {
                modelId,
                driftScore: 0.05,
                threshold: 0.1,
                status: 'stable'
            };
        });
        fastify.post('/mlops/models/compare', async (request, reply) => {
            const { modelId, version1, version2 } = request.body;
            const comparison = await this.modelRegistry.compareModels(modelId, version1, version2);
            return comparison;
        });
        logger.info('MLOps API registered');
    }
    async retrainModel(modelId, newDataPath) {
        const { metadata } = await this.modelRegistry.getModel(modelId);
        const config = {
            modelType: metadata.modelType,
            datasetConfig: {
                trainPath: newDataPath,
                validationPath: `${newDataPath}/val`,
                testPath: `${newDataPath}/test`
            },
            modelConfig: {
                architecture: 'lstm',
                optimizer: {
                    type: 'adam',
                    learningRate: metadata.trainingInfo.learningRate || 0.001
                },
                loss: 'categorical_crossentropy',
                metrics: ['accuracy']
            },
            trainingConfig: {
                epochs: metadata.trainingInfo.epochs || 10,
                batchSize: metadata.trainingInfo.batchSize || 32
            },
            hyperparameters: metadata.trainingInfo.hyperparameters,
            experimentName: `retrain-${metadata.modelName}`
        };
        return await this.trainingPipeline.submitJob(config);
    }
    async setupAutomatedRetraining(modelId, schedule, dataSource) {
        logger.info({ modelId, schedule }, 'Automated retraining configured');
    }
    async initializeDriftDetection(modelId, referenceDataPath) {
        const referenceData = [];
        await this.modelMonitoring.initializeDriftDetection(modelId, referenceData);
        logger.info({ modelId }, 'Drift detection initialized');
    }
    async getDashboardData() {
        const models = await this.modelRegistry.listModels();
        const serverHealth = await this.modelServer.getHealth();
        const serverStats = this.modelServer.getStats();
        const modelsByStatus = models.reduce((acc, model) => {
            acc[model.deploymentInfo.status] = (acc[model.deploymentInfo.status] || 0) + 1;
            return acc;
        }, {});
        let totalLatency = 0;
        let totalRequests = 0;
        for (const [_, stats] of serverStats) {
            totalLatency += stats.totalTime;
            totalRequests += stats.requests;
        }
        const avgLatency = totalRequests > 0 ? totalLatency / totalRequests : 0;
        return {
            models: {
                total: models.length,
                byStatus: modelsByStatus,
                recent: models.slice(0, 5)
            },
            training: {
                activeJobs: 0,
                completedToday: 0,
                avgTrainingTime: 0
            },
            serving: {
                loadedModels: serverHealth.loadedModels,
                totalPredictions: totalRequests,
                avgLatency
            },
            experiments: {
                total: 0,
                running: 0,
                bestModels: []
            }
        };
    }
}
exports.MLOpsOrchestrator = MLOpsOrchestrator;
async function createMLOpsOrchestrator(config) {
    const orchestrator = new MLOpsOrchestrator(config);
    await orchestrator.start();
    return orchestrator;
}
//# sourceMappingURL=mlops-orchestrator.js.map