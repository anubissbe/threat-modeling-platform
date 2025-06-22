export interface FileMetadata {
  id: string;
  originalName: string;
  filename: string;
  mimeType: string;
  size: number;
  path: string;
  bucket?: string;
  key?: string;
  checksum: string;
  userId: string;
  projectId?: string;
  threatModelId?: string;
  isPublic: boolean;
  tags: string[];
  description?: string;
  version: number;
  parentId?: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export interface FileUploadRequest {
  projectId?: string;
  threatModelId?: string;
  isPublic?: boolean;
  tags?: string[];
  description?: string;
}

export interface FileUploadResponse {
  id: string;
  originalName: string;
  filename: string;
  mimeType: string;
  size: number;
  url: string;
  downloadUrl: string;
  thumbnailUrl?: string;
  checksum: string;
  metadata: Record<string, any>;
}

export interface FileStorageProvider {
  upload(file: Buffer, key: string, metadata: FileMetadata): Promise<string>;
  download(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  getPresignedUrl(key: string, operation: 'get' | 'put', expiresIn?: number): Promise<string>;
  exists(key: string): Promise<boolean>;
  copy(sourceKey: string, destKey: string): Promise<void>;
}

export interface FileProcessingOptions {
  resize?: {
    width?: number;
    height?: number;
    fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
    quality?: number;
  };
  compress?: {
    quality?: number;
    progressive?: boolean;
  };
  format?: 'jpeg' | 'png' | 'webp' | 'avif';
  watermark?: {
    text?: string;
    image?: Buffer;
    position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
    opacity?: number;
  };
}

export interface FileSearchQuery {
  query?: string;
  mimeType?: string;
  tags?: string[];
  projectId?: string;
  threatModelId?: string;
  userId?: string;
  isPublic?: boolean;
  size?: {
    min?: number;
    max?: number;
  };
  createdAt?: {
    from?: Date;
    to?: Date;
  };
  limit?: number;
  offset?: number;
  sortBy?: 'name' | 'size' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

export interface FileStats {
  totalFiles: number;
  totalSize: number;
  filesByType: Record<string, number>;
  sizeByType: Record<string, number>;
  avgFileSize: number;
  uploadTrend: Array<{
    date: string;
    count: number;
    size: number;
  }>;
}

export interface FileShare {
  id: string;
  fileId: string;
  shareToken: string;
  expiresAt?: Date;
  downloadCount: number;
  maxDownloads?: number;
  password?: string;
  allowedEmails?: string[];
  createdBy: string;
  createdAt: Date;
}

export interface FileVersion {
  id: string;
  fileId: string;
  version: number;
  filename: string;
  size: number;
  checksum: string;
  changes: string;
  createdBy: string;
  createdAt: Date;
}

export interface FileAccess {
  fileId: string;
  userId: string;
  permission: 'read' | 'write' | 'delete' | 'share';
  grantedBy: string;
  grantedAt: Date;
  expiresAt?: Date;
}

export interface StorageQuota {
  userId: string;
  totalQuota: number;
  usedSpace: number;
  fileCount: number;
  lastUpdated: Date;
}

export interface FileOperation {
  id: string;
  fileId: string;
  operation: 'upload' | 'download' | 'delete' | 'share' | 'process';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  error?: string;
  userId: string;
  metadata?: Record<string, any>;
  startedAt: Date;
  completedAt?: Date;
}

export interface FileValidationRule {
  name: string;
  enabled: boolean;
  mimeTypes?: string[];
  maxSize?: number;
  minSize?: number;
  allowedExtensions?: string[];
  deniedExtensions?: string[];
  scanForVirus?: boolean;
  checkContent?: boolean;
}

export interface FileCategory {
  id: string;
  name: string;
  description?: string;
  mimeTypes: string[];
  maxSize?: number;
  allowedExtensions: string[];
  storageClass?: 'standard' | 'infrequent' | 'archive';
  retentionDays?: number;
  thumbnail: boolean;
  processing: FileProcessingOptions[];
}

export type FileEvent = 
  | 'file.uploaded'
  | 'file.downloaded'
  | 'file.deleted'
  | 'file.shared'
  | 'file.processed'
  | 'file.scanned'
  | 'file.versioned'
  | 'quota.exceeded'
  | 'access.granted'
  | 'access.revoked';

export interface FileEventPayload {
  event: FileEvent;
  fileId: string;
  userId: string;
  metadata?: Record<string, any>;
  timestamp: Date;
}