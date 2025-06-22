/**
 * Model Registry for versioning, storage, and deployment of ML models
 */

import { FastifyInstance } from 'fastify';
import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { createHash } from 'crypto';
import path from 'path';
import { z } from 'zod';

// Model metadata schema
export const ModelMetadataSchema = z.object({
  modelId: z.string(),
  modelName: z.string(),
  version: z.string().regex(/^\d+\.\d+\.\d+$/), // Semantic versioning
  modelType: z.enum(['threat-classifier', 'vulnerability-predictor', 'mitigation-recommender', 'pattern-recognizer', 'ensemble']),
  framework: z.enum(['tensorflow', 'pytorch', 'onnx', 'custom']),
  metrics: z.object({
    accuracy: z.number().optional(),
    precision: z.number().optional(),
    recall: z.number().optional(),
    f1Score: z.number().optional(),
    auc: z.number().optional(),
    loss: z.number().optional(),
    customMetrics: z.record(z.number()).optional()
  }),
  trainingInfo: z.object({
    datasetVersion: z.string(),
    datasetSize: z.number(),
    trainingDuration: z.number(), // in seconds
    epochs: z.number().optional(),
    batchSize: z.number().optional(),
    learningRate: z.number().optional(),
    hyperparameters: z.record(z.any()).optional()
  }),
  deploymentInfo: z.object({
    status: z.enum(['draft', 'staging', 'production', 'archived']),
    deployedAt: z.string().datetime().optional(),
    deployedBy: z.string().optional(),
    endpoints: z.array(z.string()).optional(),
    resourceRequirements: z.object({
      cpu: z.string().optional(),
      memory: z.string().optional(),
      gpu: z.boolean().optional()
    }).optional()
  }),
  tags: z.array(z.string()).optional(),
  description: z.string().optional(),
  createdAt: z.string().datetime(),
  createdBy: z.string(),
  checksum: z.string() // SHA-256 hash of model files
});

export type ModelMetadata = z.infer<typeof ModelMetadataSchema>;

// Model storage interface
export interface ModelStorage {
  save(modelId: string, version: string, modelPath: string, metadata: ModelMetadata): Promise<void>;
  load(modelId: string, version: string): Promise<{ modelPath: string; metadata: ModelMetadata }>;
  list(modelId?: string): Promise<ModelMetadata[]>;
  promote(modelId: string, version: string, targetStage: 'staging' | 'production'): Promise<void>;
  getLatest(modelId: string, stage?: 'staging' | 'production'): Promise<ModelMetadata>;
  delete(modelId: string, version: string): Promise<void>;
}

// S3-based model storage implementation
export class S3ModelStorage implements ModelStorage {
  private s3Client: S3Client;
  private bucketName: string;

  constructor(config: { region: string; endpoint?: string; bucketName: string }) {
    this.s3Client = new S3Client({
      region: config.region,
      endpoint: config.endpoint // For MinIO compatibility
    });
    this.bucketName = config.bucketName;
  }

  async save(modelId: string, version: string, modelPath: string, metadata: ModelMetadata): Promise<void> {
    const key = `models/${modelId}/${version}/`;
    
    // Save model files
    const modelFile = createReadStream(modelPath);
    await this.s3Client.send(new PutObjectCommand({
      Bucket: this.bucketName,
      Key: `${key}model.bin`,
      Body: modelFile,
      ContentType: 'application/octet-stream'
    }));

    // Save metadata
    await this.s3Client.send(new PutObjectCommand({
      Bucket: this.bucketName,
      Key: `${key}metadata.json`,
      Body: JSON.stringify(metadata, null, 2),
      ContentType: 'application/json'
    }));
  }

  async load(modelId: string, version: string): Promise<{ modelPath: string; metadata: ModelMetadata }> {
    const key = `models/${modelId}/${version}/`;
    
    // Load metadata
    const metadataResponse = await this.s3Client.send(new GetObjectCommand({
      Bucket: this.bucketName,
      Key: `${key}metadata.json`
    }));
    
    const metadataStr = await metadataResponse.Body!.transformToString();
    const metadata = ModelMetadataSchema.parse(JSON.parse(metadataStr));

    // Download model to temp location
    const tempPath = path.join('/tmp', `${modelId}-${version}.bin`);
    const modelResponse = await this.s3Client.send(new GetObjectCommand({
      Bucket: this.bucketName,
      Key: `${key}model.bin`
    }));

    const writeStream = createWriteStream(tempPath);
    await pipeline(modelResponse.Body as any, writeStream);

    return { modelPath: tempPath, metadata };
  }

  async list(modelId?: string): Promise<ModelMetadata[]> {
    const prefix = modelId ? `models/${modelId}/` : 'models/';
    const response = await this.s3Client.send(new ListObjectsV2Command({
      Bucket: this.bucketName,
      Prefix: prefix,
      Delimiter: '/'
    }));

    const metadataList: ModelMetadata[] = [];
    
    for (const key of response.Contents || []) {
      if (key.Key?.endsWith('metadata.json')) {
        const metadataResponse = await this.s3Client.send(new GetObjectCommand({
          Bucket: this.bucketName,
          Key: key.Key
        }));
        
        const metadataStr = await metadataResponse.Body!.transformToString();
        metadataList.push(ModelMetadataSchema.parse(JSON.parse(metadataStr)));
      }
    }

    return metadataList;
  }

  async promote(modelId: string, version: string, targetStage: 'staging' | 'production'): Promise<void> {
    const { metadata } = await this.load(modelId, version);
    
    // Update deployment status
    metadata.deploymentInfo.status = targetStage;
    metadata.deploymentInfo.deployedAt = new Date().toISOString();
    
    // Save updated metadata
    const key = `models/${modelId}/${version}/metadata.json`;
    await this.s3Client.send(new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: JSON.stringify(metadata, null, 2),
      ContentType: 'application/json'
    }));

    // Also save as latest for the stage
    await this.s3Client.send(new PutObjectCommand({
      Bucket: this.bucketName,
      Key: `models/${modelId}/latest-${targetStage}.json`,
      Body: JSON.stringify({ version, metadata }, null, 2),
      ContentType: 'application/json'
    }));
  }

  async getLatest(modelId: string, stage: 'staging' | 'production' = 'production'): Promise<ModelMetadata> {
    const response = await this.s3Client.send(new GetObjectCommand({
      Bucket: this.bucketName,
      Key: `models/${modelId}/latest-${stage}.json`
    }));

    const dataStr = await response.Body!.transformToString();
    const { metadata } = JSON.parse(dataStr);
    return ModelMetadataSchema.parse(metadata);
  }

  async delete(modelId: string, version: string): Promise<void> {
    // Archive instead of delete
    const { metadata } = await this.load(modelId, version);
    metadata.deploymentInfo.status = 'archived';
    
    const key = `models/${modelId}/${version}/metadata.json`;
    await this.s3Client.send(new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: JSON.stringify(metadata, null, 2),
      ContentType: 'application/json'
    }));
  }
}

// Local file system storage (for development)
export class LocalModelStorage implements ModelStorage {
  private basePath: string;

  constructor(basePath: string) {
    this.basePath = basePath;
  }

  async save(modelId: string, version: string, modelPath: string, metadata: ModelMetadata): Promise<void> {
    const fs = await import('fs/promises');
    const modelDir = path.join(this.basePath, modelId, version);
    
    await fs.mkdir(modelDir, { recursive: true });
    
    // Copy model file
    await fs.copyFile(modelPath, path.join(modelDir, 'model.bin'));
    
    // Save metadata
    await fs.writeFile(
      path.join(modelDir, 'metadata.json'),
      JSON.stringify(metadata, null, 2)
    );
  }

  async load(modelId: string, version: string): Promise<{ modelPath: string; metadata: ModelMetadata }> {
    const fs = await import('fs/promises');
    const modelDir = path.join(this.basePath, modelId, version);
    
    const metadataStr = await fs.readFile(path.join(modelDir, 'metadata.json'), 'utf-8');
    const metadata = ModelMetadataSchema.parse(JSON.parse(metadataStr));
    
    return {
      modelPath: path.join(modelDir, 'model.bin'),
      metadata
    };
  }

  async list(modelId?: string): Promise<ModelMetadata[]> {
    const fs = await import('fs/promises');
    const metadataList: ModelMetadata[] = [];
    
    const modelsDir = modelId ? path.join(this.basePath, modelId) : this.basePath;
    
    try {
      const entries = await fs.readdir(modelsDir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const metadataPath = path.join(modelsDir, entry.name, 'metadata.json');
          try {
            const metadataStr = await fs.readFile(metadataPath, 'utf-8');
            metadataList.push(ModelMetadataSchema.parse(JSON.parse(metadataStr)));
          } catch (e) {
            // Skip if metadata not found
          }
        }
      }
    } catch (e) {
      // Directory doesn't exist
    }
    
    return metadataList;
  }

  async promote(modelId: string, version: string, targetStage: 'staging' | 'production'): Promise<void> {
    const fs = await import('fs/promises');
    const { metadata } = await this.load(modelId, version);
    
    metadata.deploymentInfo.status = targetStage;
    metadata.deploymentInfo.deployedAt = new Date().toISOString();
    
    const modelDir = path.join(this.basePath, modelId, version);
    await fs.writeFile(
      path.join(modelDir, 'metadata.json'),
      JSON.stringify(metadata, null, 2)
    );
    
    // Create symlink for latest
    const latestLink = path.join(this.basePath, modelId, `latest-${targetStage}`);
    try {
      await fs.unlink(latestLink);
    } catch (e) {
      // Link doesn't exist
    }
    await fs.symlink(version, latestLink);
  }

  async getLatest(modelId: string, stage: 'staging' | 'production' = 'production'): Promise<ModelMetadata> {
    const fs = await import('fs/promises');
    const latestLink = path.join(this.basePath, modelId, `latest-${stage}`);
    const version = await fs.readlink(latestLink);
    const { metadata } = await this.load(modelId, version);
    return metadata;
  }

  async delete(modelId: string, version: string): Promise<void> {
    const { metadata } = await this.load(modelId, version);
    metadata.deploymentInfo.status = 'archived';
    
    const fs = await import('fs/promises');
    const modelDir = path.join(this.basePath, modelId, version);
    await fs.writeFile(
      path.join(modelDir, 'metadata.json'),
      JSON.stringify(metadata, null, 2)
    );
  }
}

// Model registry class
export class ModelRegistry {
  private storage: ModelStorage;

  constructor(storage: ModelStorage) {
    this.storage = storage;
  }

  async registerModel(
    modelPath: string,
    metadata: Omit<ModelMetadata, 'checksum' | 'createdAt'>
  ): Promise<ModelMetadata> {
    // Calculate checksum
    const checksum = await this.calculateChecksum(modelPath);
    
    const fullMetadata: ModelMetadata = {
      ...metadata,
      checksum,
      createdAt: new Date().toISOString()
    };

    // Validate metadata
    ModelMetadataSchema.parse(fullMetadata);

    // Save model
    await this.storage.save(
      fullMetadata.modelId,
      fullMetadata.version,
      modelPath,
      fullMetadata
    );

    return fullMetadata;
  }

  async getModel(modelId: string, version?: string): Promise<{ modelPath: string; metadata: ModelMetadata }> {
    if (version) {
      return this.storage.load(modelId, version);
    } else {
      const metadata = await this.storage.getLatest(modelId);
      return this.storage.load(modelId, metadata.version);
    }
  }

  async listModels(modelId?: string): Promise<ModelMetadata[]> {
    return this.storage.list(modelId);
  }

  async promoteModel(modelId: string, version: string, targetStage: 'staging' | 'production'): Promise<void> {
    return this.storage.promote(modelId, version, targetStage);
  }

  async compareModels(modelId: string, version1: string, version2: string): Promise<{
    version1: ModelMetadata;
    version2: ModelMetadata;
    metricsDiff: Record<string, number>;
  }> {
    const { metadata: v1 } = await this.storage.load(modelId, version1);
    const { metadata: v2 } = await this.storage.load(modelId, version2);

    const metricsDiff: Record<string, number> = {};
    
    for (const [key, value] of Object.entries(v2.metrics)) {
      if (typeof value === 'number' && key in v1.metrics) {
        metricsDiff[key] = value - (v1.metrics as any)[key];
      }
    }

    return {
      version1: v1,
      version2: v2,
      metricsDiff
    };
  }

  private async calculateChecksum(filePath: string): Promise<string> {
    const fs = await import('fs');
    const hash = createHash('sha256');
    const stream = fs.createReadStream(filePath);
    
    return new Promise((resolve, reject) => {
      stream.on('data', data => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }
}

// Factory function for creating storage
export function createModelStorage(config: {
  type: 'local' | 's3';
  localPath?: string;
  s3Config?: {
    region: string;
    endpoint?: string;
    bucketName: string;
  };
}): ModelStorage {
  if (config.type === 'local') {
    if (!config.localPath) {
      throw new Error('localPath is required for local storage');
    }
    return new LocalModelStorage(config.localPath);
  } else {
    if (!config.s3Config) {
      throw new Error('s3Config is required for S3 storage');
    }
    return new S3ModelStorage(config.s3Config);
  }
}