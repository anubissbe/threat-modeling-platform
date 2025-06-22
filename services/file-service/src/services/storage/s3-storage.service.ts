import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand, CopyObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config, getStorageConfig } from '../../config';
import { logger, fileLogger } from '../../utils/logger';
import { FileStorageProvider, FileMetadata } from '../../types';

export class S3StorageService implements FileStorageProvider {
  private client: S3Client;
  private bucket: string;

  constructor() {
    const storageConfig = getStorageConfig();
    
    if (storageConfig.provider !== 's3' && storageConfig.provider !== 'minio') {
      throw new Error('S3StorageService requires S3 or MinIO configuration');
    }

    const clientConfig: any = {
      region: storageConfig.region,
      credentials: {
        accessKeyId: storageConfig.accessKeyId,
        secretAccessKey: storageConfig.secretAccessKey,
      },
    };

    // MinIO-specific configuration
    if (storageConfig.endpoint) {
      clientConfig.endpoint = storageConfig.endpoint;
      clientConfig.forcePathStyle = storageConfig.forcePathStyle;
    }

    this.client = new S3Client(clientConfig);
    this.bucket = storageConfig.bucket;
  }

  async upload(file: Buffer, key: string, metadata: FileMetadata): Promise<string> {
    const startTime = Date.now();

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file,
        ContentType: metadata.mimeType,
        Metadata: {
          originalName: metadata.originalName,
          userId: metadata.userId,
          projectId: metadata.projectId || '',
          threatModelId: metadata.threatModelId || '',
          checksum: metadata.checksum,
          tags: metadata.tags.join(','),
          description: metadata.description || '',
        },
        TagSet: [
          { Key: 'userId', Value: metadata.userId },
          { Key: 'service', Value: 'file-service' },
          { Key: 'environment', Value: config.NODE_ENV },
          ...(metadata.projectId ? [{ Key: 'projectId', Value: metadata.projectId }] : []),
          ...(metadata.threatModelId ? [{ Key: 'threatModelId', Value: metadata.threatModelId }] : []),
        ],
      });

      await this.client.send(command);

      const duration = Date.now() - startTime;
      fileLogger.performanceMetric('s3-upload', duration, {
        bucket: this.bucket,
        key,
        size: file.length,
      });

      const url = `s3://${this.bucket}/${key}`;
      logger.info(`File uploaded to S3: ${key}`, { bucket: this.bucket, size: file.length });
      
      return url;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      fileLogger.storageError('upload', key, error);
      fileLogger.performanceMetric('s3-upload-failed', duration);
      throw new Error(`S3 upload failed: ${error.message}`);
    }
  }

  async download(key: string): Promise<Buffer> {
    const startTime = Date.now();

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const response = await this.client.send(command);
      
      if (!response.Body) {
        throw new Error('Empty response body');
      }

      const chunks: Uint8Array[] = [];
      const stream = response.Body as any;
      
      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      const buffer = Buffer.concat(chunks);

      const duration = Date.now() - startTime;
      fileLogger.performanceMetric('s3-download', duration, {
        bucket: this.bucket,
        key,
        size: buffer.length,
      });

      logger.debug(`File downloaded from S3: ${key}`, { size: buffer.length });
      return buffer;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      fileLogger.storageError('download', key, error);
      fileLogger.performanceMetric('s3-download-failed', duration);
      throw new Error(`S3 download failed: ${error.message}`);
    }
  }

  async delete(key: string): Promise<void> {
    const startTime = Date.now();

    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      await this.client.send(command);

      const duration = Date.now() - startTime;
      fileLogger.performanceMetric('s3-delete', duration, {
        bucket: this.bucket,
        key,
      });

      logger.info(`File deleted from S3: ${key}`);
    } catch (error: any) {
      const duration = Date.now() - startTime;
      fileLogger.storageError('delete', key, error);
      fileLogger.performanceMetric('s3-delete-failed', duration);
      throw new Error(`S3 delete failed: ${error.message}`);
    }
  }

  async getPresignedUrl(key: string, operation: 'get' | 'put', expiresIn: number = 3600): Promise<string> {
    try {
      let command;
      
      if (operation === 'get') {
        command = new GetObjectCommand({
          Bucket: this.bucket,
          Key: key,
        });
      } else {
        command = new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
        });
      }

      const url = await getSignedUrl(this.client, command, { expiresIn });
      
      logger.debug(`Generated presigned URL for ${operation}: ${key}`, { expiresIn });
      return url;
    } catch (error: any) {
      fileLogger.storageError('presigned-url', key, error);
      throw new Error(`Failed to generate presigned URL: ${error.message}`);
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      await this.client.send(command);
      return true;
    } catch (error: any) {
      if (error.name === 'NotFound') {
        return false;
      }
      fileLogger.storageError('exists', key, error);
      throw new Error(`Failed to check file existence: ${error.message}`);
    }
  }

  async copy(sourceKey: string, destKey: string): Promise<void> {
    const startTime = Date.now();

    try {
      const command = new CopyObjectCommand({
        Bucket: this.bucket,
        CopySource: `${this.bucket}/${sourceKey}`,
        Key: destKey,
      });

      await this.client.send(command);

      const duration = Date.now() - startTime;
      fileLogger.performanceMetric('s3-copy', duration, {
        bucket: this.bucket,
        sourceKey,
        destKey,
      });

      logger.info(`File copied in S3: ${sourceKey} -> ${destKey}`);
    } catch (error: any) {
      const duration = Date.now() - startTime;
      fileLogger.storageError('copy', `${sourceKey} -> ${destKey}`, error);
      fileLogger.performanceMetric('s3-copy-failed', duration);
      throw new Error(`S3 copy failed: ${error.message}`);
    }
  }

  // S3-specific methods
  async listObjects(prefix: string, maxKeys: number = 1000): Promise<string[]> {
    try {
      const { ListObjectsV2Command } = await import('@aws-sdk/client-s3');
      
      const command = new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: prefix,
        MaxKeys: maxKeys,
      });

      const response = await this.client.send(command);
      return response.Contents?.map(obj => obj.Key!) || [];
    } catch (error: any) {
      fileLogger.storageError('list', prefix, error);
      throw new Error(`S3 list failed: ${error.message}`);
    }
  }

  async getObjectMetadata(key: string): Promise<Record<string, any>> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const response = await this.client.send(command);
      
      return {
        contentType: response.ContentType,
        contentLength: response.ContentLength,
        lastModified: response.LastModified,
        etag: response.ETag,
        metadata: response.Metadata || {},
        tags: response.TagSet || [],
      };
    } catch (error: any) {
      fileLogger.storageError('metadata', key, error);
      throw new Error(`Failed to get object metadata: ${error.message}`);
    }
  }

  async setObjectTags(key: string, tags: Record<string, string>): Promise<void> {
    try {
      const { PutObjectTaggingCommand } = await import('@aws-sdk/client-s3');
      
      const command = new PutObjectTaggingCommand({
        Bucket: this.bucket,
        Key: key,
        Tagging: {
          TagSet: Object.entries(tags).map(([Key, Value]) => ({ Key, Value })),
        },
      });

      await this.client.send(command);
      logger.debug(`Tags set for S3 object: ${key}`, tags);
    } catch (error: any) {
      fileLogger.storageError('set-tags', key, error);
      throw new Error(`Failed to set object tags: ${error.message}`);
    }
  }

  // Multipart upload for large files
  async uploadLarge(file: Buffer, key: string, metadata: FileMetadata, partSize: number = 5 * 1024 * 1024): Promise<string> {
    if (file.length <= partSize) {
      return this.upload(file, key, metadata);
    }

    const startTime = Date.now();

    try {
      const { CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand } = await import('@aws-sdk/client-s3');

      // Initiate multipart upload
      const createCommand = new CreateMultipartUploadCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: metadata.mimeType,
        Metadata: {
          originalName: metadata.originalName,
          userId: metadata.userId,
          checksum: metadata.checksum,
        },
      });

      const createResponse = await this.client.send(createCommand);
      const uploadId = createResponse.UploadId!;

      // Upload parts
      const parts = [];
      const totalParts = Math.ceil(file.length / partSize);

      for (let i = 0; i < totalParts; i++) {
        const start = i * partSize;
        const end = Math.min(start + partSize, file.length);
        const partBuffer = file.slice(start, end);

        const uploadCommand = new UploadPartCommand({
          Bucket: this.bucket,
          Key: key,
          PartNumber: i + 1,
          UploadId: uploadId,
          Body: partBuffer,
        });

        const uploadResponse = await this.client.send(uploadCommand);
        parts.push({
          ETag: uploadResponse.ETag!,
          PartNumber: i + 1,
        });

        logger.debug(`Uploaded part ${i + 1}/${totalParts} for ${key}`);
      }

      // Complete multipart upload
      const completeCommand = new CompleteMultipartUploadCommand({
        Bucket: this.bucket,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: { Parts: parts },
      });

      await this.client.send(completeCommand);

      const duration = Date.now() - startTime;
      fileLogger.performanceMetric('s3-multipart-upload', duration, {
        bucket: this.bucket,
        key,
        size: file.length,
        parts: totalParts,
      });

      const url = `s3://${this.bucket}/${key}`;
      logger.info(`Large file uploaded to S3: ${key}`, { 
        size: file.length,
        parts: totalParts,
        duration,
      });
      
      return url;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      fileLogger.storageError('multipart-upload', key, error);
      fileLogger.performanceMetric('s3-multipart-upload-failed', duration);
      throw new Error(`S3 multipart upload failed: ${error.message}`);
    }
  }
}