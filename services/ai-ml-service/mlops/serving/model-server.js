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
exports.ABTestingServer = exports.ModelServer = exports.ONNXModelWrapper = exports.TensorFlowModelWrapper = exports.ModelWrapper = exports.PredictionRequestSchema = void 0;
const tf = __importStar(require("@tensorflow/tfjs-node"));
const events_1 = require("events");
const pino_1 = __importDefault(require("pino"));
const zod_1 = require("zod");
const logger = (0, pino_1.default)({ name: 'model-server' });
exports.PredictionRequestSchema = zod_1.z.object({
    modelId: zod_1.z.string(),
    version: zod_1.z.string().optional(),
    input: zod_1.z.any(),
    options: zod_1.z.object({
        timeout: zod_1.z.number().optional(),
        batchSize: zod_1.z.number().optional(),
        returnMetadata: zod_1.z.boolean().optional()
    }).optional()
});
class ModelWrapper {
    metadata;
    lastUsed;
    useCount = 0;
    constructor(metadata) {
        this.metadata = metadata;
        this.lastUsed = new Date();
    }
    getMetadata() {
        return this.metadata;
    }
    recordUsage() {
        this.lastUsed = new Date();
        this.useCount++;
    }
    getLastUsed() {
        return this.lastUsed;
    }
    getUseCount() {
        return this.useCount;
    }
}
exports.ModelWrapper = ModelWrapper;
class TensorFlowModelWrapper extends ModelWrapper {
    model = null;
    async load(modelPath) {
        try {
            this.model = await tf.loadLayersModel(`file://${modelPath}/model.json`);
            logger.info({ modelId: this.metadata.modelId, version: this.metadata.version }, 'TensorFlow model loaded');
        }
        catch (error) {
            logger.error({ error, modelId: this.metadata.modelId }, 'Failed to load TensorFlow model');
            throw error;
        }
    }
    async predict(input) {
        if (!this.model) {
            throw new Error('Model not loaded');
        }
        this.recordUsage();
        try {
            const inputTensor = tf.tensor(input);
            const prediction = this.model.predict(inputTensor);
            const result = await prediction.array();
            inputTensor.dispose();
            prediction.dispose();
            return result;
        }
        catch (error) {
            logger.error({ error, modelId: this.metadata.modelId }, 'Prediction failed');
            throw error;
        }
    }
    async unload() {
        if (this.model) {
            this.model.dispose();
            this.model = null;
            logger.info({ modelId: this.metadata.modelId }, 'TensorFlow model unloaded');
        }
    }
    getMemoryUsage() {
        if (!this.model)
            return 0;
        let totalBytes = 0;
        for (const weight of this.model.getWeights()) {
            totalBytes += weight.size * 4;
            weight.dispose();
        }
        return totalBytes;
    }
}
exports.TensorFlowModelWrapper = TensorFlowModelWrapper;
class ONNXModelWrapper extends ModelWrapper {
    async load(modelPath) {
        throw new Error('ONNX support not yet implemented');
    }
    async predict(input) {
        throw new Error('ONNX support not yet implemented');
    }
    async unload() {
    }
    getMemoryUsage() {
        return 0;
    }
}
exports.ONNXModelWrapper = ONNXModelWrapper;
class ModelServer extends events_1.EventEmitter {
    registry;
    config;
    loadedModels = new Map();
    modelUsageStats = new Map();
    healthCheckTimer;
    constructor(registry, config) {
        super();
        this.registry = registry;
        this.config = config;
    }
    async start() {
        logger.info('Starting model server...');
        if (this.config.preloadModels.length > 0) {
            await this.preloadModels();
        }
        if (this.config.healthCheckInterval > 0) {
            this.startHealthCheck();
        }
        this.emit('started');
    }
    async stop() {
        logger.info('Stopping model server...');
        if (this.healthCheckTimer) {
            clearInterval(this.healthCheckTimer);
        }
        for (const [modelKey, wrapper] of this.loadedModels) {
            await wrapper.unload();
        }
        this.loadedModels.clear();
        this.emit('stopped');
    }
    async predict(request) {
        const startTime = Date.now();
        const modelKey = this.getModelKey(request.modelId, request.version);
        try {
            const model = await this.getOrLoadModel(request.modelId, request.version);
            const predictions = await model.predict(request.input);
            this.updateStats(modelKey, Date.now() - startTime);
            const response = {
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
        }
        catch (error) {
            this.emit('predictionError', { request, error });
            throw error;
        }
    }
    async batchPredict(requests) {
        const groupedRequests = new Map();
        for (const request of requests) {
            const modelKey = this.getModelKey(request.modelId, request.version);
            if (!groupedRequests.has(modelKey)) {
                groupedRequests.set(modelKey, []);
            }
            groupedRequests.get(modelKey).push(request);
        }
        const responses = [];
        for (const [modelKey, modelRequests] of groupedRequests) {
            const [modelId, version] = modelKey.split(':');
            const model = await this.getOrLoadModel(modelId, version);
            for (const request of modelRequests) {
                const response = await this.predict(request);
                responses.push(response);
            }
        }
        return responses;
    }
    async getOrLoadModel(modelId, version) {
        const modelKey = this.getModelKey(modelId, version);
        if (this.loadedModels.has(modelKey)) {
            const model = this.loadedModels.get(modelKey);
            model.recordUsage();
            return model;
        }
        if (this.loadedModels.size >= this.config.maxModelsInMemory) {
            await this.evictLeastUsedModel();
        }
        const { modelPath, metadata } = await this.registry.getModel(modelId, version);
        const wrapper = this.createModelWrapper(metadata);
        await wrapper.load(modelPath);
        if (this.config.warmupOnLoad) {
            await this.warmupModel(wrapper);
        }
        this.loadedModels.set(modelKey, wrapper);
        this.emit('modelLoaded', { modelId, version: metadata.version });
        return wrapper;
    }
    createModelWrapper(metadata) {
        switch (metadata.framework) {
            case 'tensorflow':
                return new TensorFlowModelWrapper(metadata);
            case 'onnx':
                return new ONNXModelWrapper(metadata);
            default:
                throw new Error(`Unsupported framework: ${metadata.framework}`);
        }
    }
    async warmupModel(model) {
        logger.info({ modelId: model.getMetadata().modelId }, 'Warming up model...');
        const dummyInput = this.createDummyInput(model.getMetadata());
        try {
            await model.predict(dummyInput);
            logger.info({ modelId: model.getMetadata().modelId }, 'Model warmup complete');
        }
        catch (error) {
            logger.warn({ error, modelId: model.getMetadata().modelId }, 'Model warmup failed');
        }
    }
    createDummyInput(metadata) {
        switch (metadata.modelType) {
            case 'threat-classifier':
                return [[0.1, 0.2, 0.3, 0.4, 0.5]];
            case 'vulnerability-predictor':
                return [[1, 0, 1, 0, 1]];
            default:
                return [[0]];
        }
    }
    async evictLeastUsedModel() {
        let leastUsedModel = null;
        for (const [key, model] of this.loadedModels) {
            if (!leastUsedModel || model.getLastUsed() < leastUsedModel.lastUsed) {
                leastUsedModel = { key, lastUsed: model.getLastUsed() };
            }
        }
        if (leastUsedModel) {
            const model = this.loadedModels.get(leastUsedModel.key);
            await model.unload();
            this.loadedModels.delete(leastUsedModel.key);
            this.emit('modelEvicted', {
                modelId: model.getMetadata().modelId,
                version: model.getMetadata().version
            });
        }
    }
    async preloadModels() {
        logger.info({ models: this.config.preloadModels }, 'Preloading models...');
        for (const modelId of this.config.preloadModels) {
            try {
                await this.getOrLoadModel(modelId);
            }
            catch (error) {
                logger.error({ error, modelId }, 'Failed to preload model');
            }
        }
    }
    startHealthCheck() {
        this.healthCheckTimer = setInterval(async () => {
            const health = await this.getHealth();
            this.emit('healthCheck', health);
            if (!health.healthy) {
                logger.warn({ health }, 'Model server unhealthy');
            }
        }, this.config.healthCheckInterval * 1000);
    }
    async getHealth() {
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
    getModelKey(modelId, version) {
        return version ? `${modelId}:${version}` : `${modelId}:latest`;
    }
    updateStats(modelKey, processingTime) {
        if (!this.modelUsageStats.has(modelKey)) {
            this.modelUsageStats.set(modelKey, { requests: 0, totalTime: 0 });
        }
        const stats = this.modelUsageStats.get(modelKey);
        stats.requests++;
        stats.totalTime += processingTime;
    }
    calculateConfidence(predictions) {
        if (Array.isArray(predictions) && predictions.length > 0) {
            if (Array.isArray(predictions[0])) {
                return Math.max(...predictions[0]);
            }
        }
        return 1.0;
    }
    getStats() {
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
exports.ModelServer = ModelServer;
class ABTestingServer {
    registry;
    config;
    servers = new Map();
    trafficSplits = new Map();
    constructor(registry, config) {
        this.registry = registry;
        this.config = config;
    }
    async addVariant(modelId, version, trafficPercentage) {
        const server = new ModelServer(this.registry, this.config);
        await server.start();
        this.servers.set(`${modelId}:${version}`, server);
        this.trafficSplits.set(modelId, trafficPercentage);
    }
    async predict(request) {
        const random = Math.random() * 100;
        const trafficSplit = this.trafficSplits.get(request.modelId) || 50;
        const useVersionA = random < trafficSplit;
        const server = this.selectServer(request.modelId, useVersionA);
        const response = await server.predict(request);
        response.abTestVariant = useVersionA ? 'A' : 'B';
        return response;
    }
    selectServer(modelId, useVersionA) {
        const servers = Array.from(this.servers.values());
        return servers[useVersionA ? 0 : 1] || servers[0];
    }
}
exports.ABTestingServer = ABTestingServer;
//# sourceMappingURL=model-server.js.map