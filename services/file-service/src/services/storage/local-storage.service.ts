import * as fs from 'fs/promises';
import * as path from 'path';
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { config, getStorageConfig } from '../../config';
import { logger, fileLogger } from '../../utils/logger';
import { FileStorageProvider, FileMetadata } from '../../types';

export class LocalStorageService implements FileStorageProvider {
  private basePath: string;

  constructor() {
    const storageConfig = getStorageConfig();
    
    if (storageConfig.provider !== 'local') {
      throw new Error('LocalStorageService requires local storage configuration');
    }

    this.basePath = path.resolve(storageConfig.path);
    this.ensureDirectoryExists(this.basePath);
  }

  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
      logger.info(`Created storage directory: ${dirPath}`);
    }
  }

  private getFilePath(key: string): string {
    return path.join(this.basePath, key);
  }

  private getMetadataPath(key: string): string {
    return path.join(this.basePath, `${key}.metadata.json`);
  }

  async upload(file: Buffer, key: string, metadata: FileMetadata): Promise<string> {
    const startTime = Date.now();
    const filePath = this.getFilePath(key);
    const metadataPath = this.getMetadataPath(key);

    try {
      // Ensure directory exists
      const dir = path.dirname(filePath);
      await this.ensureDirectoryExists(dir);

      // Write file
      await fs.writeFile(filePath, file);

      // Write metadata
      const metadataJson = {
        originalName: metadata.originalName,
        mimeType: metadata.mimeType,
        size: metadata.size,
        checksum: metadata.checksum,
        userId: metadata.userId,
        projectId: metadata.projectId,
        threatModelId: metadata.threatModelId,
        tags: metadata.tags,
        description: metadata.description,
        uploadedAt: new Date().toISOString(),
      };

      await fs.writeFile(metadataPath, JSON.stringify(metadataJson, null, 2));

      const duration = Date.now() - startTime;
      fileLogger.performanceMetric('local-upload', duration, {
        path: filePath,
        size: file.length,
      });

      logger.info(`File uploaded locally: ${key}`, { size: file.length });
      return `file://${filePath}`;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      fileLogger.storageError('upload', key, error);
      fileLogger.performanceMetric('local-upload-failed', duration);
      throw new Error(`Local upload failed: ${error.message}`);
    }
  }

  async download(key: string): Promise<Buffer> {
    const startTime = Date.now();
    const filePath = this.getFilePath(key);

    try {
      const buffer = await fs.readFile(filePath);

      const duration = Date.now() - startTime;
      fileLogger.performanceMetric('local-download', duration, {
        path: filePath,
        size: buffer.length,
      });

      logger.debug(`File downloaded locally: ${key}`, { size: buffer.length });
      return buffer;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      fileLogger.storageError('download', key, error);
      fileLogger.performanceMetric('local-download-failed', duration);
      
      if (error.code === 'ENOENT') {
        throw new Error(`File not found: ${key}`);
      }
      throw new Error(`Local download failed: ${error.message}`);
    }
  }

  async delete(key: string): Promise<void> {
    const startTime = Date.now();
    const filePath = this.getFilePath(key);
    const metadataPath = this.getMetadataPath(key);

    try {
      // Delete file and metadata
      await Promise.all([
        fs.unlink(filePath).catch(() => {}), // Ignore if file doesn't exist
        fs.unlink(metadataPath).catch(() => {}), // Ignore if metadata doesn't exist
      ]);

      const duration = Date.now() - startTime;
      fileLogger.performanceMetric('local-delete', duration, {
        path: filePath,
      });

      logger.info(`File deleted locally: ${key}`);
    } catch (error: any) {
      const duration = Date.now() - startTime;
      fileLogger.storageError('delete', key, error);
      fileLogger.performanceMetric('local-delete-failed', duration);
      throw new Error(`Local delete failed: ${error.message}`);
    }
  }

  async getPresignedUrl(key: string, operation: 'get' | 'put', expiresIn: number = 3600): Promise<string> {
    // For local storage, we'll generate a temporary access token
    // In a real implementation, this would be a signed JWT or similar
    const filePath = this.getFilePath(key);
    
    if (operation === 'get') {
      // Check if file exists
      try {
        await fs.access(filePath);
        // Return a URL that can be used with the download endpoint
        const token = Buffer.from(`${key}:${Date.now() + expiresIn * 1000}`).toString('base64');
        return `${config.HOST}:${config.PORT}/api/v1/files/download/${encodeURIComponent(key)}?token=${token}`;
      } catch {
        throw new Error(`File not found: ${key}`);
      }
    } else {
      // For upload, return a URL that can be used with the upload endpoint
      const token = Buffer.from(`${key}:${Date.now() + expiresIn * 1000}`).toString('base64');
      return `${config.HOST}:${config.PORT}/api/v1/files/upload?token=${token}`;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const filePath = this.getFilePath(key);
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async copy(sourceKey: string, destKey: string): Promise<void> {
    const startTime = Date.now();
    const sourcePath = this.getFilePath(sourceKey);
    const destPath = this.getFilePath(destKey);
    const sourceMetadataPath = this.getMetadataPath(sourceKey);
    const destMetadataPath = this.getMetadataPath(destKey);

    try {
      // Ensure destination directory exists
      const destDir = path.dirname(destPath);
      await this.ensureDirectoryExists(destDir);

      // Copy file and metadata
      await Promise.all([
        fs.copyFile(sourcePath, destPath),
        fs.copyFile(sourceMetadataPath, destMetadataPath).catch(() => {}), // Ignore if metadata doesn't exist
      ]);

      const duration = Date.now() - startTime;
      fileLogger.performanceMetric('local-copy', duration, {
        sourcePath,
        destPath,
      });

      logger.info(`File copied locally: ${sourceKey} -> ${destKey}`);
    } catch (error: any) {
      const duration = Date.now() - startTime;
      fileLogger.storageError('copy', `${sourceKey} -> ${destKey}`, error);
      fileLogger.performanceMetric('local-copy-failed', duration);
      throw new Error(`Local copy failed: ${error.message}`);
    }
  }

  // Local storage specific methods
  async getMetadata(key: string): Promise<Record<string, any> | null> {
    try {
      const metadataPath = this.getMetadataPath(key);
      const metadataContent = await fs.readFile(metadataPath, 'utf-8');
      return JSON.parse(metadataContent);
    } catch {
      return null;
    }
  }

  async setMetadata(key: string, metadata: Record<string, any>): Promise<void> {
    try {
      const metadataPath = this.getMetadataPath(key);
      await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
      logger.debug(`Metadata updated for: ${key}`);
    } catch (error: any) {
      fileLogger.storageError('set-metadata', key, error);
      throw new Error(`Failed to set metadata: ${error.message}`);
    }
  }

  async listFiles(prefix: string = '', limit: number = 1000): Promise<string[]> {
    try {
      const searchPath = prefix ? path.join(this.basePath, prefix) : this.basePath;
      const files: string[] = [];

      const scan = async (dir: string, currentPrefix: string = ''): Promise<void> => {
        try {
          const items = await fs.readdir(dir, { withFileTypes: true });
          
          for (const item of items) {
            if (files.length >= limit) break;
            
            const itemPath = path.join(dir, item.name);
            const relativePath = currentPrefix ? path.join(currentPrefix, item.name) : item.name;
            
            if (item.isDirectory()) {
              await scan(itemPath, relativePath);
            } else if (!item.name.endsWith('.metadata.json')) {
              files.push(relativePath);
            }
          }
        } catch (error) {
          // Ignore directories that can't be read
        }
      };

      await scan(searchPath);
      return files;
    } catch (error: any) {
      fileLogger.storageError('list', prefix, error);
      throw new Error(`Failed to list files: ${error.message}`);
    }
  }

  async getFileStats(key: string): Promise<{ size: number; modified: Date; created: Date }> {
    try {
      const filePath = this.getFilePath(key);
      const stats = await fs.stat(filePath);
      
      return {
        size: stats.size,
        modified: stats.mtime,
        created: stats.birthtime,
      };
    } catch (error: any) {
      fileLogger.storageError('stats', key, error);
      throw new Error(`Failed to get file stats: ${error.message}`);
    }
  }

  async createReadStream(key: string): Promise<NodeJS.ReadableStream> {
    const filePath = this.getFilePath(key);
    
    try {
      await fs.access(filePath);
      return createReadStream(filePath);
    } catch (error: any) {
      fileLogger.storageError('read-stream', key, error);
      throw new Error(`Failed to create read stream: ${error.message}`);
    }
  }

  async createWriteStream(key: string): Promise<NodeJS.WritableStream> {
    const filePath = this.getFilePath(key);
    
    try {
      // Ensure directory exists
      const dir = path.dirname(filePath);
      await this.ensureDirectoryExists(dir);
      
      return createWriteStream(filePath);
    } catch (error: any) {
      fileLogger.storageError('write-stream', key, error);
      throw new Error(`Failed to create write stream: ${error.message}`);
    }
  }

  async moveFile(sourceKey: string, destKey: string): Promise<void> {
    const startTime = Date.now();
    const sourcePath = this.getFilePath(sourceKey);
    const destPath = this.getFilePath(destKey);
    const sourceMetadataPath = this.getMetadataPath(sourceKey);
    const destMetadataPath = this.getMetadataPath(destKey);

    try {
      // Ensure destination directory exists
      const destDir = path.dirname(destPath);
      await this.ensureDirectoryExists(destDir);

      // Move file and metadata
      await Promise.all([
        fs.rename(sourcePath, destPath),
        fs.rename(sourceMetadataPath, destMetadataPath).catch(() => {}), // Ignore if metadata doesn't exist
      ]);

      const duration = Date.now() - startTime;
      fileLogger.performanceMetric('local-move', duration, {
        sourcePath,
        destPath,
      });

      logger.info(`File moved locally: ${sourceKey} -> ${destKey}`);
    } catch (error: any) {
      const duration = Date.now() - startTime;
      fileLogger.storageError('move', `${sourceKey} -> ${destKey}`, error);
      fileLogger.performanceMetric('local-move-failed', duration);
      throw new Error(`Local move failed: ${error.message}`);
    }
  }

  // Cleanup methods
  async cleanupTempFiles(olderThan: Date): Promise<number> {
    let deletedCount = 0;
    
    try {
      const tempDir = path.join(this.basePath, 'temp');
      const files = await this.listFiles('temp');
      
      for (const file of files) {
        try {
          const filePath = path.join(tempDir, file);
          const stats = await fs.stat(filePath);
          
          if (stats.mtime < olderThan) {
            await fs.unlink(filePath);
            deletedCount++;
          }
        } catch (error) {
          // Ignore errors for individual files
        }
      }
      
      logger.info(`Cleaned up ${deletedCount} temporary files`);
      return deletedCount;
    } catch (error: any) {
      logger.error('Failed to cleanup temp files:', error);
      return deletedCount;
    }
  }
}