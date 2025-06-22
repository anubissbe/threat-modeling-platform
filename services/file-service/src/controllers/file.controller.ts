import { FastifyRequest, FastifyReply } from 'fastify';
import { fileService } from '../services/file.service';
import { logger } from '../utils/logger';
import { FileUploadRequest, FileSearchQuery, FileProcessingOptions } from '../types';

// Request interfaces
interface FileUploadMultipart {
  Body: FileUploadRequest;
  file?: {
    buffer: Buffer;
    filename: string;
    mimetype: string;
  };
}

interface FileDownloadRequest {
  Params: {
    fileId: string;
  };
}

interface FileGetRequest {
  Params: {
    fileId: string;
  };
}

interface FileDeleteRequest {
  Params: {
    fileId: string;
  };
}

interface FileSearchRequest {
  Querystring: FileSearchQuery;
}

interface FileShareRequest {
  Params: {
    fileId: string;
  };
  Body: {
    expiresAt?: string;
    maxDownloads?: number;
    password?: string;
    allowedEmails?: string[];
  };
}

interface FileProcessRequest {
  Params: {
    fileId: string;
  };
  Body: FileProcessingOptions;
}

interface FileServeRequest {
  Params: {
    key: string;
  };
}

export class FileController {
  async uploadFile(
    request: FastifyRequest<FileUploadMultipart>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const file = await request.file();
      
      if (!file) {
        reply.status(400).send({
          success: false,
          error: 'No file provided',
        });
        return;
      }

      const buffer = await file.toBuffer();
      const userId = request.user!.id;

      const result = await fileService.uploadFile(
        buffer,
        file.filename,
        userId,
        {
          projectId: request.body?.projectId,
          threatModelId: request.body?.threatModelId,
          isPublic: request.body?.isPublic,
          tags: request.body?.tags,
          description: request.body?.description,
        }
      );

      reply.status(201).send({
        success: true,
        file: result,
      });
    } catch (error: any) {
      logger.error('File upload failed:', error);
      reply.status(400).send({
        success: false,
        error: error.message,
      });
    }
  }

  async downloadFile(
    request: FastifyRequest<FileDownloadRequest>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { fileId } = request.params;
      const userId = request.user!.id;
      const ip = request.ip;

      const { buffer, metadata } = await fileService.downloadFile(fileId, userId, ip);

      reply
        .header('Content-Type', metadata.mimeType)
        .header('Content-Length', buffer.length)
        .header('Content-Disposition', `attachment; filename="${metadata.originalName}"`)
        .header('Cache-Control', 'private, max-age=3600')
        .send(buffer);
    } catch (error: any) {
      logger.error('File download failed:', error);
      reply.status(error.message === 'File not found' ? 404 : 
                  error.message === 'Access denied' ? 403 : 400).send({
        success: false,
        error: error.message,
      });
    }
  }

  async getFile(
    request: FastifyRequest<FileGetRequest>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { fileId } = request.params;
      const userId = request.user!.id;

      const file = await fileService.getFile(fileId, userId);

      if (!file) {
        reply.status(404).send({
          success: false,
          error: 'File not found',
        });
        return;
      }

      reply.send({
        success: true,
        file,
      });
    } catch (error: any) {
      logger.error('Get file failed:', error);
      reply.status(error.message === 'Access denied' ? 403 : 400).send({
        success: false,
        error: error.message,
      });
    }
  }

  async searchFiles(
    request: FastifyRequest<FileSearchRequest>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const userId = request.user!.id;
      const query = request.query;

      const result = await fileService.searchFiles(query, userId);

      reply.send({
        success: true,
        files: result.files,
        total: result.total,
        page: Math.floor((query.offset || 0) / (query.limit || 50)) + 1,
        limit: query.limit || 50,
      });
    } catch (error: any) {
      logger.error('File search failed:', error);
      reply.status(400).send({
        success: false,
        error: error.message,
      });
    }
  }

  async deleteFile(
    request: FastifyRequest<FileDeleteRequest>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { fileId } = request.params;
      const userId = request.user!.id;

      const deleted = await fileService.deleteFile(fileId, userId);

      if (!deleted) {
        reply.status(404).send({
          success: false,
          error: 'File not found or already deleted',
        });
        return;
      }

      reply.send({
        success: true,
        message: 'File deleted successfully',
      });
    } catch (error: any) {
      logger.error('File deletion failed:', error);
      reply.status(error.message === 'Access denied' ? 403 : 400).send({
        success: false,
        error: error.message,
      });
    }
  }

  async createFileShare(
    request: FastifyRequest<FileShareRequest>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { fileId } = request.params;
      const userId = request.user!.id;
      const { expiresAt, maxDownloads, password, allowedEmails } = request.body;

      const share = await fileService.createFileShare(fileId, userId, {
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
        maxDownloads,
        password,
        allowedEmails,
      });

      reply.status(201).send({
        success: true,
        share: {
          id: share.id,
          shareToken: share.shareToken,
          expiresAt: share.expiresAt,
          maxDownloads: share.maxDownloads,
          shareUrl: `${request.protocol}://${request.hostname}/api/v1/files/shared/${share.shareToken}`,
        },
      });
    } catch (error: any) {
      logger.error('File share creation failed:', error);
      reply.status(error.message === 'Access denied' ? 403 : 400).send({
        success: false,
        error: error.message,
      });
    }
  }

  async processImage(
    request: FastifyRequest<FileProcessRequest>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { fileId } = request.params;
      const userId = request.user!.id;
      const options = request.body;

      const result = await fileService.processImage(fileId, userId, options);

      reply.status(201).send({
        success: true,
        processedFile: result,
      });
    } catch (error: any) {
      logger.error('Image processing failed:', error);
      reply.status(400).send({
        success: false,
        error: error.message,
      });
    }
  }

  async getFileStats(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const userId = request.user!.id;
      const stats = await fileService.getFileStats(userId);

      reply.send({
        success: true,
        stats,
      });
    } catch (error: any) {
      logger.error('Get file stats failed:', error);
      reply.status(400).send({
        success: false,
        error: error.message,
      });
    }
  }

  async getUserQuota(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const userId = request.user!.id;
      const quota = await fileService.getUserQuota(userId);

      reply.send({
        success: true,
        quota,
      });
    } catch (error: any) {
      logger.error('Get user quota failed:', error);
      reply.status(400).send({
        success: false,
        error: error.message,
      });
    }
  }

  async serveFile(
    request: FastifyRequest<FileServeRequest>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { key } = request.params;
      
      // This endpoint is for serving files directly (local storage)
      // In production, you might want to add authentication and access control
      
      reply.status(501).send({
        success: false,
        error: 'Direct file serving not implemented - use signed URLs',
      });
    } catch (error: any) {
      logger.error('File serving failed:', error);
      reply.status(400).send({
        success: false,
        error: error.message,
      });
    }
  }

  // Bulk operations
  async uploadMultipleFiles(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const files = request.files();
      const userId = request.user!.id;
      const results = [];

      for await (const file of files) {
        try {
          const buffer = await file.toBuffer();
          const result = await fileService.uploadFile(buffer, file.filename, userId);
          results.push({ success: true, file: result });
        } catch (error: any) {
          results.push({ 
            success: false, 
            filename: file.filename, 
            error: error.message 
          });
        }
      }

      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;

      reply.status(207).send({
        success: failed === 0,
        results,
        summary: {
          total: results.length,
          successful,
          failed,
        },
      });
    } catch (error: any) {
      logger.error('Bulk file upload failed:', error);
      reply.status(400).send({
        success: false,
        error: error.message,
      });
    }
  }

  async deleteMultipleFiles(
    request: FastifyRequest<{ Body: { fileIds: string[] } }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { fileIds } = request.body;
      const userId = request.user!.id;
      const results = [];

      for (const fileId of fileIds) {
        try {
          const deleted = await fileService.deleteFile(fileId, userId);
          results.push({ 
            success: deleted, 
            fileId, 
            error: deleted ? undefined : 'File not found or access denied' 
          });
        } catch (error: any) {
          results.push({ 
            success: false, 
            fileId, 
            error: error.message 
          });
        }
      }

      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;

      reply.send({
        success: failed === 0,
        results,
        summary: {
          total: results.length,
          successful,
          failed,
        },
      });
    } catch (error: any) {
      logger.error('Bulk file deletion failed:', error);
      reply.status(400).send({
        success: false,
        error: error.message,
      });
    }
  }
}

export const fileController = new FileController();