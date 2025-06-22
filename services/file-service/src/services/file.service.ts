import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import { config } from '../config';
import { logger, fileLogger } from '../utils/logger';
import { storageProvider } from './storage/storage-factory';
import { databaseService } from './database.service';
import { fileProcessingService } from './file-processing.service';
import { fileValidationService } from './file-validation.service';
import {
  FileMetadata,
  FileUploadRequest,
  FileUploadResponse,
  FileSearchQuery,
  FileStats,
  FileShare,
  FileProcessingOptions,
} from '../types';

export class FileService {
  constructor() {}

  async initialize(): Promise<void> {
    try {
      await databaseService.initialize();
      logger.info('File service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize file service:', error);
      throw error;
    }
  }

  async uploadFile(
    buffer: Buffer,
    originalName: string,
    userId: string,
    options: FileUploadRequest = {}
  ): Promise<FileUploadResponse> {
    const startTime = Date.now();
    const fileId = uuidv4();

    try {
      // Validate file
      const validation = await fileValidationService.validateFile(buffer, originalName, userId);
      
      if (!validation.valid) {
        throw new Error(`File validation failed: ${validation.errors.join(', ')}`);
      }

      // Check user quota
      await this.checkUserQuota(userId, buffer.length);

      // Detect file type
      const mimeType = validation.metadata?.detectedMimeType || 'application/octet-stream';
      
      // Generate unique filename
      const extension = this.getFileExtension(originalName);
      const filename = `${fileId}${extension ? `.${extension}` : ''}`;
      
      // Generate storage key
      const storageKey = this.generateStorageKey(userId, filename, options);

      // Process file if needed
      let processedBuffer = buffer;
      let thumbnails: any[] = [];
      
      if (fileProcessingService.isImageFormat(mimeType) && config.ENABLE_IMAGE_PROCESSING) {
        // Compress image
        processedBuffer = await fileProcessingService.compressFile(buffer, mimeType);
        
        // Generate thumbnails
        if (config.ENABLE_THUMBNAILS) {
          thumbnails = await fileProcessingService.generateThumbnails(processedBuffer, fileId);
        }
      }

      // Calculate checksums
      const checksum = fileProcessingService.calculateChecksum(processedBuffer);

      // Upload to storage
      const fileMetadata: Omit<FileMetadata, 'createdAt' | 'updatedAt'> = {
        id: fileId,
        originalName,
        filename,
        mimeType,
        size: processedBuffer.length,
        path: storageKey,
        bucket: config.STORAGE_PROVIDER === 'local' ? undefined : config.S3_BUCKET,
        key: storageKey,
        checksum,
        userId,
        projectId: options.projectId,
        threatModelId: options.threatModelId,
        isPublic: options.isPublic || false,
        tags: options.tags || [],
        description: options.description,
        version: 1,
        parentId: undefined,
      };

      const storageUrl = await storageProvider.upload(processedBuffer, storageKey, fileMetadata as FileMetadata);

      // Save metadata to database
      const savedMetadata = await databaseService.createFile(fileMetadata);

      // Upload thumbnails
      const thumbnailUrls: Record<string, string> = {};
      for (const thumbnail of thumbnails) {
        const thumbnailKey = `${storageKey}_thumb_${thumbnail.size}`;
        await storageProvider.upload(thumbnail.buffer, thumbnailKey, fileMetadata as FileMetadata);
        thumbnailUrls[thumbnail.size] = await this.getFileUrl(thumbnailKey);
      }

      // Update user quota
      await databaseService.updateStorageQuota(userId, processedBuffer.length, 1);

      // Log upload
      fileLogger.uploaded(fileId, originalName, processedBuffer.length, userId);

      const duration = Date.now() - startTime;
      fileLogger.performanceMetric('file-upload', duration, {
        fileId,
        originalSize: buffer.length,
        processedSize: processedBuffer.length,
        thumbnails: thumbnails.length,
      });

      // Generate response
      const response: FileUploadResponse = {
        id: fileId,
        originalName,
        filename,
        mimeType,
        size: processedBuffer.length,
        url: storageUrl,
        downloadUrl: await this.getDownloadUrl(fileId),
        thumbnailUrl: thumbnailUrls[Object.keys(thumbnailUrls)[0]],
        checksum,
        metadata: {
          validation: validation.metadata,
          thumbnails: thumbnailUrls,
          compressionRatio: buffer.length / processedBuffer.length,
          warnings: validation.warnings,
        },
      };

      logger.info(`File uploaded successfully: ${fileId}`, {
        originalName,
        size: processedBuffer.length,
        mimeType,
      });

      return response;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      fileLogger.performanceMetric('file-upload-failed', duration);
      logger.error(`File upload failed for ${originalName}:`, error);
      throw error;
    }
  }

  async downloadFile(fileId: string, userId: string, ip?: string): Promise<{ buffer: Buffer; metadata: FileMetadata }> {
    const startTime = Date.now();

    try {
      // Get file metadata
      const metadata = await databaseService.getFile(fileId);
      
      if (!metadata) {
        throw new Error('File not found');
      }

      // Check access permissions
      if (!await this.hasFileAccess(fileId, userId, 'read')) {
        throw new Error('Access denied');
      }

      // Download from storage
      const buffer = await storageProvider.download(metadata.key || metadata.path);

      // Log download
      fileLogger.downloaded(fileId, metadata.originalName, userId, ip);

      const duration = Date.now() - startTime;
      fileLogger.performanceMetric('file-download', duration, {
        fileId,
        size: buffer.length,
      });

      return { buffer, metadata };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      fileLogger.performanceMetric('file-download-failed', duration);
      logger.error(`File download failed for ${fileId}:`, error);
      throw error;
    }
  }

  async getFile(fileId: string, userId: string): Promise<FileMetadata | null> {
    try {
      const metadata = await databaseService.getFile(fileId);
      
      if (!metadata) {
        return null;
      }

      // Check access permissions
      if (!await this.hasFileAccess(fileId, userId, 'read')) {
        throw new Error('Access denied');
      }

      return metadata;
    } catch (error: any) {
      logger.error(`Failed to get file ${fileId}:`, error);
      throw error;
    }
  }

  async searchFiles(query: FileSearchQuery, userId: string): Promise<{ files: FileMetadata[]; total: number }> {
    try {
      // Add user filter if not admin
      if (!query.userId) {
        query.userId = userId;
      }

      return await databaseService.searchFiles(query);
    } catch (error: any) {
      logger.error('File search failed:', error);
      throw error;
    }
  }

  async deleteFile(fileId: string, userId: string): Promise<boolean> {
    const startTime = Date.now();

    try {
      // Get file metadata
      const metadata = await databaseService.getFile(fileId);
      
      if (!metadata) {
        throw new Error('File not found');
      }

      // Check delete permissions
      if (!await this.hasFileAccess(fileId, userId, 'delete')) {
        throw new Error('Access denied');
      }

      // Soft delete in database
      const deleted = await databaseService.deleteFile(fileId, userId);
      
      if (!deleted) {
        throw new Error('Failed to delete file');
      }

      // Update user quota
      await databaseService.updateStorageQuota(userId, -metadata.size, -1);

      // Log deletion
      fileLogger.deleted(fileId, metadata.originalName, userId);

      const duration = Date.now() - startTime;
      fileLogger.performanceMetric('file-delete', duration, {
        fileId,
        size: metadata.size,
      });

      logger.info(`File deleted: ${fileId}`, { originalName: metadata.originalName });
      return true;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      fileLogger.performanceMetric('file-delete-failed', duration);
      logger.error(`File deletion failed for ${fileId}:`, error);
      throw error;
    }
  }

  async createFileShare(fileId: string, userId: string, options: {
    expiresAt?: Date;
    maxDownloads?: number;
    password?: string;
    allowedEmails?: string[];
  } = {}): Promise<FileShare> {
    try {
      // Check if user can share this file
      if (!await this.hasFileAccess(fileId, userId, 'share')) {
        throw new Error('Access denied');
      }

      const shareId = uuidv4();
      const shareToken = this.generateShareToken();

      const share: Omit<FileShare, 'createdAt'> = {
        id: shareId,
        fileId,
        shareToken,
        expiresAt: options.expiresAt,
        downloadCount: 0,
        maxDownloads: options.maxDownloads,
        password: options.password ? await this.hashPassword(options.password) : undefined,
        allowedEmails: options.allowedEmails,
        createdBy: userId,
      };

      const createdShare = await databaseService.createShare(share);

      // Log sharing
      fileLogger.shared(fileId, 'file', shareToken, userId);

      logger.info(`File share created: ${shareId}`, { fileId, expiresAt: options.expiresAt });
      return createdShare;
    } catch (error: any) {
      logger.error(`Failed to create file share for ${fileId}:`, error);
      throw error;
    }
  }

  async processImage(fileId: string, userId: string, options: FileProcessingOptions): Promise<FileUploadResponse> {
    try {
      // Get original file
      const { buffer, metadata } = await this.downloadFile(fileId, userId);

      if (!fileProcessingService.isImageFormat(metadata.mimeType)) {
        throw new Error('File is not an image');
      }

      // Process image
      const result = await fileProcessingService.processImage(buffer, options);

      // Upload processed version
      const processedName = `${path.parse(metadata.originalName).name}_processed${path.parse(metadata.originalName).ext}`;
      
      return await this.uploadFile(result.processed, processedName, userId, {
        parentId: fileId,
        description: `Processed version of ${metadata.originalName}`,
        tags: [...metadata.tags, 'processed'],
      });
    } catch (error: any) {
      logger.error(`Image processing failed for ${fileId}:`, error);
      throw error;
    }
  }

  async getFileStats(userId?: string): Promise<FileStats> {
    try {
      return await databaseService.getFileStats(userId);
    } catch (error: any) {
      logger.error('Failed to get file stats:', error);
      throw error;
    }
  }

  async getUserQuota(userId: string): Promise<{ quota: number; used: number; remaining: number; fileCount: number }> {
    try {
      const quotaData = await databaseService.getStorageQuota(userId);
      
      if (!quotaData) {
        return {
          quota: config.DEFAULT_USER_QUOTA,
          used: 0,
          remaining: config.DEFAULT_USER_QUOTA,
          fileCount: 0,
        };
      }

      return {
        quota: quotaData.totalQuota,
        used: quotaData.usedSpace,
        remaining: quotaData.totalQuota - quotaData.usedSpace,
        fileCount: quotaData.fileCount,
      };
    } catch (error: any) {
      logger.error(`Failed to get user quota for ${userId}:`, error);
      throw error;
    }
  }

  // Private helper methods
  private async checkUserQuota(userId: string, fileSize: number): Promise<void> {
    const quota = await this.getUserQuota(userId);
    
    if (quota.remaining < fileSize) {
      fileLogger.quotaExceeded(userId, quota.quota, quota.used, fileSize);
      throw new Error(`Storage quota exceeded. Available: ${quota.remaining} bytes, Required: ${fileSize} bytes`);
    }
  }

  private async hasFileAccess(fileId: string, userId: string, permission: 'read' | 'write' | 'delete' | 'share'): Promise<boolean> {
    try {
      const metadata = await databaseService.getFile(fileId);
      
      if (!metadata) {
        return false;
      }

      // Owner has all permissions
      if (metadata.userId === userId) {
        return true;
      }

      // Public files can be read by anyone
      if (metadata.isPublic && permission === 'read') {
        return true;
      }

      // TODO: Check project/team permissions
      // For now, only owner has access
      return false;
    } catch (error) {
      logger.error(`Access check failed for file ${fileId}:`, error);
      return false;
    }
  }

  private getFileExtension(filename: string): string {
    const lastDot = filename.lastIndexOf('.');
    return lastDot === -1 ? '' : filename.slice(lastDot + 1).toLowerCase();
  }

  private generateStorageKey(userId: string, filename: string, options: FileUploadRequest): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    if (options.projectId) {
      return `projects/${options.projectId}/${year}/${month}/${day}/${filename}`;
    } else if (options.threatModelId) {
      return `threat-models/${options.threatModelId}/${year}/${month}/${day}/${filename}`;
    } else {
      return `users/${userId}/${year}/${month}/${day}/${filename}`;
    }
  }

  private generateShareToken(): string {
    return Buffer.from(`${uuidv4()}-${Date.now()}`).toString('base64url');
  }

  private async hashPassword(password: string): Promise<string> {
    const bcrypt = await import('bcrypt');
    return bcrypt.hash(password, 10);
  }

  private async getFileUrl(key: string): Promise<string> {
    if (config.STORAGE_PROVIDER === 'local') {
      return `${config.HOST}:${config.PORT}/api/v1/files/serve/${encodeURIComponent(key)}`;
    } else {
      return await storageProvider.getPresignedUrl(key, 'get', 3600);
    }
  }

  private async getDownloadUrl(fileId: string): Promise<string> {
    return `${config.HOST}:${config.PORT}/api/v1/files/${fileId}/download`;
  }

  async cleanup(): Promise<void> {
    try {
      await databaseService.close();
      logger.info('File service cleaned up');
    } catch (error) {
      logger.error('File service cleanup failed:', error);
    }
  }
}

// Export singleton instance
export const fileService = new FileService();