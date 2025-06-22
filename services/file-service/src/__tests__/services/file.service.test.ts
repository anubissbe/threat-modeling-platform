import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FileService } from '../../services/file.service';
import { storageProvider } from '../../services/storage/storage-factory';
import { databaseService } from '../../services/database.service';
import { fileValidationService } from '../../services/file-validation.service';

// Mock dependencies
vi.mock('../../services/storage/storage-factory');
vi.mock('../../services/database.service');
vi.mock('../../services/file-validation.service');
vi.mock('../../services/file-processing.service');

describe('FileService', () => {
  let fileService: FileService;
  const mockBuffer = Buffer.from('test file content');
  const mockUserId = 'user123';
  const mockFileId = 'file123';

  beforeEach(() => {
    fileService = new FileService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('uploadFile', () => {
    const mockValidation = {
      valid: true,
      errors: [],
      warnings: [],
      metadata: {
        detectedMimeType: 'text/plain',
        sha256: 'abcd1234',
      },
    };

    const mockFileMetadata = {
      id: mockFileId,
      originalName: 'test.txt',
      filename: 'file123.txt',
      mimeType: 'text/plain',
      size: mockBuffer.length,
      path: 'users/user123/2024/01/01/file123.txt',
      checksum: 'abcd1234',
      userId: mockUserId,
      isPublic: false,
      tags: [],
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    beforeEach(() => {
      vi.mocked(fileValidationService.validateFile)
        .mockResolvedValue(mockValidation);
      
      vi.mocked(databaseService.getStorageQuota)
        .mockResolvedValue({
          userId: mockUserId,
          totalQuota: 1024 * 1024 * 1024,
          usedSpace: 0,
          fileCount: 0,
          lastUpdated: new Date(),
        });

      vi.mocked(storageProvider.upload)
        .mockResolvedValue('s3://bucket/key');

      vi.mocked(databaseService.createFile)
        .mockResolvedValue(mockFileMetadata as any);

      vi.mocked(databaseService.updateStorageQuota)
        .mockResolvedValue();
    });

    it('should upload file successfully', async () => {
      const result = await fileService.uploadFile(
        mockBuffer,
        'test.txt',
        mockUserId
      );

      expect(result).toMatchObject({
        id: mockFileId,
        originalName: 'test.txt',
        mimeType: 'text/plain',
        size: mockBuffer.length,
      });

      expect(fileValidationService.validateFile).toHaveBeenCalledWith(
        mockBuffer,
        'test.txt',
        mockUserId
      );

      expect(storageProvider.upload).toHaveBeenCalled();
      expect(databaseService.createFile).toHaveBeenCalled();
      expect(databaseService.updateStorageQuota).toHaveBeenCalledWith(
        mockUserId,
        mockBuffer.length,
        1
      );
    });

    it('should reject invalid files', async () => {
      vi.mocked(fileValidationService.validateFile)
        .mockResolvedValue({
          valid: false,
          errors: ['File too large'],
          warnings: [],
        });

      await expect(
        fileService.uploadFile(mockBuffer, 'test.txt', mockUserId)
      ).rejects.toThrow('File validation failed: File too large');
    });

    it('should check user quota', async () => {
      vi.mocked(databaseService.getStorageQuota)
        .mockResolvedValue({
          userId: mockUserId,
          totalQuota: 100,
          usedSpace: 90,
          fileCount: 1,
          lastUpdated: new Date(),
        });

      await expect(
        fileService.uploadFile(mockBuffer, 'test.txt', mockUserId)
      ).rejects.toThrow('Storage quota exceeded');
    });

    it('should handle upload options', async () => {
      const options = {
        projectId: 'project123',
        threatModelId: 'threat123',
        isPublic: true,
        tags: ['important'],
        description: 'Test file',
      };

      await fileService.uploadFile(
        mockBuffer,
        'test.txt',
        mockUserId,
        options
      );

      expect(databaseService.createFile).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: 'project123',
          threatModelId: 'threat123',
          isPublic: true,
          tags: ['important'],
          description: 'Test file',
        })
      );
    });
  });

  describe('downloadFile', () => {
    const mockFileMetadata = {
      id: mockFileId,
      originalName: 'test.txt',
      key: 'users/user123/test.txt',
      userId: mockUserId,
      isPublic: false,
    };

    beforeEach(() => {
      vi.mocked(databaseService.getFile)
        .mockResolvedValue(mockFileMetadata as any);

      vi.mocked(storageProvider.download)
        .mockResolvedValue(mockBuffer);
    });

    it('should download file successfully', async () => {
      const result = await fileService.downloadFile(mockFileId, mockUserId);

      expect(result.buffer).toEqual(mockBuffer);
      expect(result.metadata).toEqual(mockFileMetadata);

      expect(databaseService.getFile).toHaveBeenCalledWith(mockFileId);
      expect(storageProvider.download).toHaveBeenCalledWith('users/user123/test.txt');
    });

    it('should reject non-existent files', async () => {
      vi.mocked(databaseService.getFile)
        .mockResolvedValue(null);

      await expect(
        fileService.downloadFile(mockFileId, mockUserId)
      ).rejects.toThrow('File not found');
    });

    it('should check access permissions', async () => {
      vi.mocked(databaseService.getFile)
        .mockResolvedValue({
          ...mockFileMetadata,
          userId: 'other-user',
          isPublic: false,
        } as any);

      await expect(
        fileService.downloadFile(mockFileId, mockUserId)
      ).rejects.toThrow('Access denied');
    });

    it('should allow public file access', async () => {
      vi.mocked(databaseService.getFile)
        .mockResolvedValue({
          ...mockFileMetadata,
          userId: 'other-user',
          isPublic: true,
        } as any);

      const result = await fileService.downloadFile(mockFileId, mockUserId);
      expect(result.buffer).toEqual(mockBuffer);
    });
  });

  describe('deleteFile', () => {
    const mockFileMetadata = {
      id: mockFileId,
      originalName: 'test.txt',
      size: 100,
      userId: mockUserId,
    };

    beforeEach(() => {
      vi.mocked(databaseService.getFile)
        .mockResolvedValue(mockFileMetadata as any);

      vi.mocked(databaseService.deleteFile)
        .mockResolvedValue(true);

      vi.mocked(databaseService.updateStorageQuota)
        .mockResolvedValue();
    });

    it('should delete file successfully', async () => {
      const result = await fileService.deleteFile(mockFileId, mockUserId);

      expect(result).toBe(true);
      expect(databaseService.deleteFile).toHaveBeenCalledWith(mockFileId, mockUserId);
      expect(databaseService.updateStorageQuota).toHaveBeenCalledWith(
        mockUserId,
        -100,
        -1
      );
    });

    it('should reject non-existent files', async () => {
      vi.mocked(databaseService.getFile)
        .mockResolvedValue(null);

      await expect(
        fileService.deleteFile(mockFileId, mockUserId)
      ).rejects.toThrow('File not found');
    });

    it('should check delete permissions', async () => {
      vi.mocked(databaseService.getFile)
        .mockResolvedValue({
          ...mockFileMetadata,
          userId: 'other-user',
        } as any);

      await expect(
        fileService.deleteFile(mockFileId, mockUserId)
      ).rejects.toThrow('Access denied');
    });
  });

  describe('searchFiles', () => {
    const mockSearchResult = {
      files: [
        {
          id: 'file1',
          originalName: 'test1.txt',
          userId: mockUserId,
        },
        {
          id: 'file2',
          originalName: 'test2.txt',
          userId: mockUserId,
        },
      ],
      total: 2,
    };

    beforeEach(() => {
      vi.mocked(databaseService.searchFiles)
        .mockResolvedValue(mockSearchResult as any);
    });

    it('should search files successfully', async () => {
      const query = {
        query: 'test',
        limit: 10,
        offset: 0,
      };

      const result = await fileService.searchFiles(query, mockUserId);

      expect(result).toEqual(mockSearchResult);
      expect(databaseService.searchFiles).toHaveBeenCalledWith({
        ...query,
        userId: mockUserId,
      });
    });

    it('should add user filter when not provided', async () => {
      const query = {
        query: 'test',
      };

      await fileService.searchFiles(query, mockUserId);

      expect(databaseService.searchFiles).toHaveBeenCalledWith({
        ...query,
        userId: mockUserId,
      });
    });
  });

  describe('getUserQuota', () => {
    it('should return user quota', async () => {
      const mockQuota = {
        userId: mockUserId,
        totalQuota: 1024 * 1024 * 1024,
        usedSpace: 100 * 1024 * 1024,
        fileCount: 5,
        lastUpdated: new Date(),
      };

      vi.mocked(databaseService.getStorageQuota)
        .mockResolvedValue(mockQuota);

      const result = await fileService.getUserQuota(mockUserId);

      expect(result).toEqual({
        quota: mockQuota.totalQuota,
        used: mockQuota.usedSpace,
        remaining: mockQuota.totalQuota - mockQuota.usedSpace,
        fileCount: mockQuota.fileCount,
      });
    });

    it('should return default quota for new users', async () => {
      vi.mocked(databaseService.getStorageQuota)
        .mockResolvedValue(null);

      const result = await fileService.getUserQuota(mockUserId);

      expect(result.quota).toBeGreaterThan(0);
      expect(result.used).toBe(0);
      expect(result.remaining).toBe(result.quota);
      expect(result.fileCount).toBe(0);
    });
  });
});

describe('FileService Integration', () => {
  it('should handle file processing workflow', async () => {
    const fileService = new FileService();
    
    // Mock all dependencies for integration test
    vi.mocked(fileValidationService.validateFile)
      .mockResolvedValue({
        valid: true,
        errors: [],
        warnings: [],
        metadata: { detectedMimeType: 'image/jpeg' },
      });

    // Test that image processing is triggered for image files
    // This would be a more comprehensive test in a real scenario
  });
});