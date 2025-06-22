import { config } from '../../config';
import { FileStorageProvider } from '../../types';
import { S3StorageService } from './s3-storage.service';
import { LocalStorageService } from './local-storage.service';
import { logger } from '../../utils/logger';

export class StorageFactory {
  private static instance: FileStorageProvider | null = null;

  static getInstance(): FileStorageProvider {
    if (!this.instance) {
      this.instance = this.createStorageProvider();
    }
    return this.instance;
  }

  private static createStorageProvider(): FileStorageProvider {
    switch (config.STORAGE_PROVIDER) {
      case 's3':
      case 'minio':
        logger.info(`Initializing ${config.STORAGE_PROVIDER.toUpperCase()} storage provider`);
        return new S3StorageService();
      
      case 'local':
      default:
        logger.info('Initializing local storage provider');
        return new LocalStorageService();
    }
  }

  // For testing purposes
  static setInstance(provider: FileStorageProvider): void {
    this.instance = provider;
  }

  static reset(): void {
    this.instance = null;
  }
}

// Export singleton instance
export const storageProvider = StorageFactory.getInstance();