import * as fs from 'fs/promises';
import * as path from 'path';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { logger, reportLogger } from '../utils/logger';
import { config, getStorageConfig } from '../config';
import { ReportStorageProvider } from '../types';

export class ReportStorageService implements ReportStorageProvider {
  private s3Client?: S3Client;
  private storageType: string;
  private storagePath: string;
  private bucket?: string;

  constructor() {
    const storageConfig = getStorageConfig();
    this.storageType = storageConfig.type;

    if (this.storageType === 's3') {
      this.s3Client = new S3Client({
        region: storageConfig.region,
        credentials: storageConfig.credentials,
      });
      this.bucket = storageConfig.bucket;
    } else {
      this.storagePath = storageConfig.path || './reports';
    }
  }

  /**
   * Initialize storage service
   */
  async initialize(): Promise<void> {
    if (this.storageType === 'local') {
      // Ensure local storage directory exists
      await fs.mkdir(this.storagePath, { recursive: true });
      logger.info(`Local storage initialized at ${this.storagePath}`);
    } else if (this.storageType === 's3') {
      // Test S3 connection
      try {
        const command = new PutObjectCommand({
          Bucket: this.bucket!,
          Key: '.test',
          Body: 'test',
        });
        await this.s3Client!.send(command);
        
        // Clean up test file
        const deleteCommand = new DeleteObjectCommand({
          Bucket: this.bucket!,
          Key: '.test',
        });
        await this.s3Client!.send(deleteCommand);
        
        logger.info(`S3 storage initialized with bucket ${this.bucket}`);
      } catch (error) {
        logger.error('Failed to initialize S3 storage:', error);
        throw error;
      }
    }
  }

  /**
   * Save report to storage
   */
  async save(
    reportId: string,
    buffer: Buffer,
    options?: {
      filename?: string;
      mimeType?: string;
      metadata?: Record<string, string>;
    }
  ): Promise<string> {
    const startTime = Date.now();
    
    try {
      const filename = options?.filename || `${reportId}.pdf`;
      let url: string;

      if (this.storageType === 's3') {
        url = await this.saveToS3(reportId, buffer, filename, options);
      } else {
        url = await this.saveToLocal(reportId, buffer, filename);
      }

      const duration = Date.now() - startTime;
      reportLogger.storageSaved(reportId, this.storageType, buffer.length);
      reportLogger.performanceMetric('storage-save', duration);

      return url;

    } catch (error: any) {
      reportLogger.storageError(reportId, error);
      throw error;
    }
  }

  /**
   * Get report from storage
   */
  async get(reportId: string): Promise<Buffer> {
    try {
      if (this.storageType === 's3') {
        return await this.getFromS3(reportId);
      } else {
        return await this.getFromLocal(reportId);
      }
    } catch (error: any) {
      reportLogger.storageError(reportId, error);
      throw error;
    }
  }

  /**
   * Delete report from storage
   */
  async delete(reportId: string): Promise<void> {
    try {
      if (this.storageType === 's3') {
        await this.deleteFromS3(reportId);
      } else {
        await this.deleteFromLocal(reportId);
      }
      
      logger.info(`Report ${reportId} deleted from ${this.storageType} storage`);
    } catch (error: any) {
      reportLogger.storageError(reportId, error);
      throw error;
    }
  }

  /**
   * Get signed URL for report access
   */
  async getUrl(reportId: string, expiresIn: number = 3600): Promise<string> {
    if (this.storageType === 's3') {
      const command = new GetObjectCommand({
        Bucket: this.bucket!,
        Key: this.getS3Key(reportId),
      });
      
      return await getSignedUrl(this.s3Client!, command, { expiresIn });
    } else {
      // For local storage, return a relative URL
      // In production, this would be served by a file server
      return `/reports/${reportId}`;
    }
  }

  /**
   * Check if report exists
   */
  async exists(reportId: string): Promise<boolean> {
    try {
      if (this.storageType === 's3') {
        const command = new GetObjectCommand({
          Bucket: this.bucket!,
          Key: this.getS3Key(reportId),
        });
        
        try {
          await this.s3Client!.send(command);
          return true;
        } catch (error: any) {
          if (error.name === 'NoSuchKey') {
            return false;
          }
          throw error;
        }
      } else {
        const filePath = path.join(this.storagePath, reportId);
        try {
          await fs.access(filePath);
          return true;
        } catch {
          return false;
        }
      }
    } catch (error) {
      logger.error(`Error checking if report ${reportId} exists:`, error);
      return false;
    }
  }

  /**
   * Save to local filesystem
   */
  private async saveToLocal(
    reportId: string,
    buffer: Buffer,
    filename: string
  ): Promise<string> {
    const reportDir = path.join(this.storagePath, reportId);
    await fs.mkdir(reportDir, { recursive: true });
    
    const filePath = path.join(reportDir, filename);
    await fs.writeFile(filePath, buffer);
    
    // Also save metadata
    const metadataPath = path.join(reportDir, 'metadata.json');
    await fs.writeFile(
      metadataPath,
      JSON.stringify({
        reportId,
        filename,
        size: buffer.length,
        createdAt: new Date().toISOString(),
      }, null, 2)
    );

    return `/reports/${reportId}/${filename}`;
  }

  /**
   * Get from local filesystem
   */
  private async getFromLocal(reportId: string): Promise<Buffer> {
    const reportDir = path.join(this.storagePath, reportId);
    
    // Read metadata to get filename
    const metadataPath = path.join(reportDir, 'metadata.json');
    const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));
    
    const filePath = path.join(reportDir, metadata.filename);
    return await fs.readFile(filePath);
  }

  /**
   * Delete from local filesystem
   */
  private async deleteFromLocal(reportId: string): Promise<void> {
    const reportDir = path.join(this.storagePath, reportId);
    await fs.rm(reportDir, { recursive: true, force: true });
  }

  /**
   * Save to S3
   */
  private async saveToS3(
    reportId: string,
    buffer: Buffer,
    filename: string,
    options?: {
      mimeType?: string;
      metadata?: Record<string, string>;
    }
  ): Promise<string> {
    const key = this.getS3Key(reportId, filename);
    
    const command = new PutObjectCommand({
      Bucket: this.bucket!,
      Key: key,
      Body: buffer,
      ContentType: options?.mimeType || 'application/pdf',
      Metadata: {
        reportId,
        ...options?.metadata,
      },
    });

    await this.s3Client!.send(command);
    
    return `s3://${this.bucket}/${key}`;
  }

  /**
   * Get from S3
   */
  private async getFromS3(reportId: string): Promise<Buffer> {
    // First, try to find the report file
    const possibleKeys = [
      this.getS3Key(reportId, `${reportId}.pdf`),
      this.getS3Key(reportId, `${reportId}.html`),
      this.getS3Key(reportId),
    ];

    for (const key of possibleKeys) {
      try {
        const command = new GetObjectCommand({
          Bucket: this.bucket!,
          Key: key,
        });

        const response = await this.s3Client!.send(command);
        const stream = response.Body as any;
        
        // Convert stream to buffer
        const chunks: Uint8Array[] = [];
        for await (const chunk of stream) {
          chunks.push(chunk);
        }
        
        return Buffer.concat(chunks);
      } catch (error: any) {
        if (error.name !== 'NoSuchKey') {
          throw error;
        }
      }
    }

    throw new Error(`Report ${reportId} not found in S3`);
  }

  /**
   * Delete from S3
   */
  private async deleteFromS3(reportId: string): Promise<void> {
    // Delete all files for this report ID
    const prefix = `reports/${reportId}/`;
    
    // In production, you'd list all objects with this prefix and delete them
    // For now, we'll try to delete the most common file patterns
    const keysToDelete = [
      this.getS3Key(reportId, `${reportId}.pdf`),
      this.getS3Key(reportId, `${reportId}.html`),
      this.getS3Key(reportId, 'metadata.json'),
    ];

    for (const key of keysToDelete) {
      try {
        const command = new DeleteObjectCommand({
          Bucket: this.bucket!,
          Key: key,
        });
        await this.s3Client!.send(command);
      } catch (error: any) {
        if (error.name !== 'NoSuchKey') {
          logger.error(`Error deleting ${key}:`, error);
        }
      }
    }
  }

  /**
   * Get S3 key for report
   */
  private getS3Key(reportId: string, filename?: string): string {
    if (filename) {
      return `reports/${reportId}/${filename}`;
    }
    return `reports/${reportId}`;
  }

  /**
   * Clean up old reports
   */
  async cleanupOldReports(daysOld: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    let deletedCount = 0;

    if (this.storageType === 'local') {
      const reportDirs = await fs.readdir(this.storagePath);
      
      for (const dir of reportDirs) {
        const metadataPath = path.join(this.storagePath, dir, 'metadata.json');
        
        try {
          const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));
          const createdAt = new Date(metadata.createdAt);
          
          if (createdAt < cutoffDate) {
            await this.deleteFromLocal(dir);
            deletedCount++;
          }
        } catch (error) {
          logger.warn(`Failed to process report ${dir}:`, error);
        }
      }
    } else if (this.storageType === 's3') {
      // S3 cleanup would use lifecycle policies in production
      logger.warn('S3 cleanup should be handled by lifecycle policies');
    }

    logger.info(`Cleaned up ${deletedCount} old reports`);
    return deletedCount;
  }
}