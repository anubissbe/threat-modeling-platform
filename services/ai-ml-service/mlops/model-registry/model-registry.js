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
exports.ModelRegistry = exports.LocalModelStorage = exports.S3ModelStorage = exports.ModelMetadataSchema = void 0;
exports.createModelStorage = createModelStorage;
const client_s3_1 = require("@aws-sdk/client-s3");
const fs_1 = require("fs");
const promises_1 = require("stream/promises");
const crypto_1 = require("crypto");
const path_1 = __importDefault(require("path"));
const zod_1 = require("zod");
exports.ModelMetadataSchema = zod_1.z.object({
    modelId: zod_1.z.string(),
    modelName: zod_1.z.string(),
    version: zod_1.z.string().regex(/^\d+\.\d+\.\d+$/),
    modelType: zod_1.z.enum(['threat-classifier', 'vulnerability-predictor', 'mitigation-recommender', 'pattern-recognizer', 'ensemble']),
    framework: zod_1.z.enum(['tensorflow', 'pytorch', 'onnx', 'custom']),
    metrics: zod_1.z.object({
        accuracy: zod_1.z.number().optional(),
        precision: zod_1.z.number().optional(),
        recall: zod_1.z.number().optional(),
        f1Score: zod_1.z.number().optional(),
        auc: zod_1.z.number().optional(),
        loss: zod_1.z.number().optional(),
        customMetrics: zod_1.z.record(zod_1.z.number()).optional()
    }),
    trainingInfo: zod_1.z.object({
        datasetVersion: zod_1.z.string(),
        datasetSize: zod_1.z.number(),
        trainingDuration: zod_1.z.number(),
        epochs: zod_1.z.number().optional(),
        batchSize: zod_1.z.number().optional(),
        learningRate: zod_1.z.number().optional(),
        hyperparameters: zod_1.z.record(zod_1.z.any()).optional()
    }),
    deploymentInfo: zod_1.z.object({
        status: zod_1.z.enum(['draft', 'staging', 'production', 'archived']),
        deployedAt: zod_1.z.string().datetime().optional(),
        deployedBy: zod_1.z.string().optional(),
        endpoints: zod_1.z.array(zod_1.z.string()).optional(),
        resourceRequirements: zod_1.z.object({
            cpu: zod_1.z.string().optional(),
            memory: zod_1.z.string().optional(),
            gpu: zod_1.z.boolean().optional()
        }).optional()
    }),
    tags: zod_1.z.array(zod_1.z.string()).optional(),
    description: zod_1.z.string().optional(),
    createdAt: zod_1.z.string().datetime(),
    createdBy: zod_1.z.string(),
    checksum: zod_1.z.string()
});
class S3ModelStorage {
    s3Client;
    bucketName;
    constructor(config) {
        this.s3Client = new client_s3_1.S3Client({
            region: config.region,
            endpoint: config.endpoint
        });
        this.bucketName = config.bucketName;
    }
    async save(modelId, version, modelPath, metadata) {
        const key = `models/${modelId}/${version}/`;
        const modelFile = (0, fs_1.createReadStream)(modelPath);
        await this.s3Client.send(new client_s3_1.PutObjectCommand({
            Bucket: this.bucketName,
            Key: `${key}model.bin`,
            Body: modelFile,
            ContentType: 'application/octet-stream'
        }));
        await this.s3Client.send(new client_s3_1.PutObjectCommand({
            Bucket: this.bucketName,
            Key: `${key}metadata.json`,
            Body: JSON.stringify(metadata, null, 2),
            ContentType: 'application/json'
        }));
    }
    async load(modelId, version) {
        const key = `models/${modelId}/${version}/`;
        const metadataResponse = await this.s3Client.send(new client_s3_1.GetObjectCommand({
            Bucket: this.bucketName,
            Key: `${key}metadata.json`
        }));
        const metadataStr = await metadataResponse.Body.transformToString();
        const metadata = exports.ModelMetadataSchema.parse(JSON.parse(metadataStr));
        const tempPath = path_1.default.join('/tmp', `${modelId}-${version}.bin`);
        const modelResponse = await this.s3Client.send(new client_s3_1.GetObjectCommand({
            Bucket: this.bucketName,
            Key: `${key}model.bin`
        }));
        const writeStream = (0, fs_1.createWriteStream)(tempPath);
        await (0, promises_1.pipeline)(modelResponse.Body, writeStream);
        return { modelPath: tempPath, metadata };
    }
    async list(modelId) {
        const prefix = modelId ? `models/${modelId}/` : 'models/';
        const response = await this.s3Client.send(new client_s3_1.ListObjectsV2Command({
            Bucket: this.bucketName,
            Prefix: prefix,
            Delimiter: '/'
        }));
        const metadataList = [];
        for (const key of response.Contents || []) {
            if (key.Key?.endsWith('metadata.json')) {
                const metadataResponse = await this.s3Client.send(new client_s3_1.GetObjectCommand({
                    Bucket: this.bucketName,
                    Key: key.Key
                }));
                const metadataStr = await metadataResponse.Body.transformToString();
                metadataList.push(exports.ModelMetadataSchema.parse(JSON.parse(metadataStr)));
            }
        }
        return metadataList;
    }
    async promote(modelId, version, targetStage) {
        const { metadata } = await this.load(modelId, version);
        metadata.deploymentInfo.status = targetStage;
        metadata.deploymentInfo.deployedAt = new Date().toISOString();
        const key = `models/${modelId}/${version}/metadata.json`;
        await this.s3Client.send(new client_s3_1.PutObjectCommand({
            Bucket: this.bucketName,
            Key: key,
            Body: JSON.stringify(metadata, null, 2),
            ContentType: 'application/json'
        }));
        await this.s3Client.send(new client_s3_1.PutObjectCommand({
            Bucket: this.bucketName,
            Key: `models/${modelId}/latest-${targetStage}.json`,
            Body: JSON.stringify({ version, metadata }, null, 2),
            ContentType: 'application/json'
        }));
    }
    async getLatest(modelId, stage = 'production') {
        const response = await this.s3Client.send(new client_s3_1.GetObjectCommand({
            Bucket: this.bucketName,
            Key: `models/${modelId}/latest-${stage}.json`
        }));
        const dataStr = await response.Body.transformToString();
        const { metadata } = JSON.parse(dataStr);
        return exports.ModelMetadataSchema.parse(metadata);
    }
    async delete(modelId, version) {
        const { metadata } = await this.load(modelId, version);
        metadata.deploymentInfo.status = 'archived';
        const key = `models/${modelId}/${version}/metadata.json`;
        await this.s3Client.send(new client_s3_1.PutObjectCommand({
            Bucket: this.bucketName,
            Key: key,
            Body: JSON.stringify(metadata, null, 2),
            ContentType: 'application/json'
        }));
    }
}
exports.S3ModelStorage = S3ModelStorage;
class LocalModelStorage {
    basePath;
    constructor(basePath) {
        this.basePath = basePath;
    }
    async save(modelId, version, modelPath, metadata) {
        const fs = await Promise.resolve().then(() => __importStar(require('fs/promises')));
        const modelDir = path_1.default.join(this.basePath, modelId, version);
        await fs.mkdir(modelDir, { recursive: true });
        await fs.copyFile(modelPath, path_1.default.join(modelDir, 'model.bin'));
        await fs.writeFile(path_1.default.join(modelDir, 'metadata.json'), JSON.stringify(metadata, null, 2));
    }
    async load(modelId, version) {
        const fs = await Promise.resolve().then(() => __importStar(require('fs/promises')));
        const modelDir = path_1.default.join(this.basePath, modelId, version);
        const metadataStr = await fs.readFile(path_1.default.join(modelDir, 'metadata.json'), 'utf-8');
        const metadata = exports.ModelMetadataSchema.parse(JSON.parse(metadataStr));
        return {
            modelPath: path_1.default.join(modelDir, 'model.bin'),
            metadata
        };
    }
    async list(modelId) {
        const fs = await Promise.resolve().then(() => __importStar(require('fs/promises')));
        const metadataList = [];
        const modelsDir = modelId ? path_1.default.join(this.basePath, modelId) : this.basePath;
        try {
            const entries = await fs.readdir(modelsDir, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.isDirectory()) {
                    const metadataPath = path_1.default.join(modelsDir, entry.name, 'metadata.json');
                    try {
                        const metadataStr = await fs.readFile(metadataPath, 'utf-8');
                        metadataList.push(exports.ModelMetadataSchema.parse(JSON.parse(metadataStr)));
                    }
                    catch (e) {
                    }
                }
            }
        }
        catch (e) {
        }
        return metadataList;
    }
    async promote(modelId, version, targetStage) {
        const fs = await Promise.resolve().then(() => __importStar(require('fs/promises')));
        const { metadata } = await this.load(modelId, version);
        metadata.deploymentInfo.status = targetStage;
        metadata.deploymentInfo.deployedAt = new Date().toISOString();
        const modelDir = path_1.default.join(this.basePath, modelId, version);
        await fs.writeFile(path_1.default.join(modelDir, 'metadata.json'), JSON.stringify(metadata, null, 2));
        const latestLink = path_1.default.join(this.basePath, modelId, `latest-${targetStage}`);
        try {
            await fs.unlink(latestLink);
        }
        catch (e) {
        }
        await fs.symlink(version, latestLink);
    }
    async getLatest(modelId, stage = 'production') {
        const fs = await Promise.resolve().then(() => __importStar(require('fs/promises')));
        const latestLink = path_1.default.join(this.basePath, modelId, `latest-${stage}`);
        const version = await fs.readlink(latestLink);
        const { metadata } = await this.load(modelId, version);
        return metadata;
    }
    async delete(modelId, version) {
        const { metadata } = await this.load(modelId, version);
        metadata.deploymentInfo.status = 'archived';
        const fs = await Promise.resolve().then(() => __importStar(require('fs/promises')));
        const modelDir = path_1.default.join(this.basePath, modelId, version);
        await fs.writeFile(path_1.default.join(modelDir, 'metadata.json'), JSON.stringify(metadata, null, 2));
    }
}
exports.LocalModelStorage = LocalModelStorage;
class ModelRegistry {
    storage;
    constructor(storage) {
        this.storage = storage;
    }
    async registerModel(modelPath, metadata) {
        const checksum = await this.calculateChecksum(modelPath);
        const fullMetadata = {
            ...metadata,
            checksum,
            createdAt: new Date().toISOString()
        };
        exports.ModelMetadataSchema.parse(fullMetadata);
        await this.storage.save(fullMetadata.modelId, fullMetadata.version, modelPath, fullMetadata);
        return fullMetadata;
    }
    async getModel(modelId, version) {
        if (version) {
            return this.storage.load(modelId, version);
        }
        else {
            const metadata = await this.storage.getLatest(modelId);
            return this.storage.load(modelId, metadata.version);
        }
    }
    async listModels(modelId) {
        return this.storage.list(modelId);
    }
    async promoteModel(modelId, version, targetStage) {
        return this.storage.promote(modelId, version, targetStage);
    }
    async compareModels(modelId, version1, version2) {
        const { metadata: v1 } = await this.storage.load(modelId, version1);
        const { metadata: v2 } = await this.storage.load(modelId, version2);
        const metricsDiff = {};
        for (const [key, value] of Object.entries(v2.metrics)) {
            if (typeof value === 'number' && key in v1.metrics) {
                metricsDiff[key] = value - v1.metrics[key];
            }
        }
        return {
            version1: v1,
            version2: v2,
            metricsDiff
        };
    }
    async calculateChecksum(filePath) {
        const fs = await Promise.resolve().then(() => __importStar(require('fs')));
        const hash = (0, crypto_1.createHash)('sha256');
        const stream = fs.createReadStream(filePath);
        return new Promise((resolve, reject) => {
            stream.on('data', data => hash.update(data));
            stream.on('end', () => resolve(hash.digest('hex')));
            stream.on('error', reject);
        });
    }
}
exports.ModelRegistry = ModelRegistry;
function createModelStorage(config) {
    if (config.type === 'local') {
        if (!config.localPath) {
            throw new Error('localPath is required for local storage');
        }
        return new LocalModelStorage(config.localPath);
    }
    else {
        if (!config.s3Config) {
            throw new Error('s3Config is required for S3 storage');
        }
        return new S3ModelStorage(config.s3Config);
    }
}
//# sourceMappingURL=model-registry.js.map