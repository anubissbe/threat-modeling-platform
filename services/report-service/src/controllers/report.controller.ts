import { FastifyRequest, FastifyReply } from 'fastify';
import { ReportQueueService } from '../services/report-queue.service';
import { ReportStorageService } from '../services/report-storage.service';
import { logger } from '../utils/logger';
import {
  ReportRequest,
  ReportType,
  ReportFormat,
  ReportStatus,
  ReportQueueOptions,
} from '../types';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import axios from 'axios';
import { config } from '../config';

export class ReportController {
  private queueService: ReportQueueService;
  private storageService: ReportStorageService;

  constructor(queueService: ReportQueueService, storageService: ReportStorageService) {
    this.queueService = queueService;
    this.storageService = storageService;
  }

  /**
   * Generate a new report
   */
  async generateReport(
    request: AuthenticatedRequest<{
      Body: ReportRequest;
    }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const reportRequest = request.body;
      reportRequest.userId = request.user!.id;

      // Validate report type and format
      if (!Object.values(ReportType).includes(reportRequest.type)) {
        reply.status(400).send({
          success: false,
          error: 'Invalid report type',
          message: `Report type must be one of: ${Object.values(ReportType).join(', ')}`,
        });
        return;
      }

      if (!Object.values(ReportFormat).includes(reportRequest.format)) {
        reply.status(400).send({
          success: false,
          error: 'Invalid report format',
          message: `Report format must be one of: ${Object.values(ReportFormat).join(', ')}`,
        });
        return;
      }

      // Fetch required data
      const [threatModelData, projectData] = await Promise.all([
        this.fetchThreatModelData(reportRequest.projectId, reportRequest.threatModelId),
        this.fetchProjectData(reportRequest.projectId),
      ]);

      // Prepare job data
      const jobData = {
        request: reportRequest,
        threatModelData,
        projectData,
        userData: {
          id: request.user!.id,
          email: request.user!.email,
          name: request.user!.email, // TODO: Get name from user service
          organizationId: request.user!.organizationId,
        },
        organizationData: request.user!.organizationId
          ? await this.fetchOrganizationData(request.user!.organizationId)
          : undefined,
      };

      // Add job to queue
      const jobId = await this.queueService.addReportJob(jobData);

      reply.send({
        success: true,
        jobId,
        message: 'Report generation job queued successfully',
        status: ReportStatus.PENDING,
      });

    } catch (error: any) {
      logger.error('Report generation failed:', error);
      reply.status(500).send({
        success: false,
        error: 'Report generation failed',
        message: error.message,
      });
    }
  }

  /**
   * Get report status
   */
  async getReportStatus(
    request: AuthenticatedRequest<{
      Params: { jobId: string };
    }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { jobId } = request.params;
      
      const job = await this.queueService.getJob(jobId);
      
      if (!job) {
        reply.status(404).send({
          success: false,
          error: 'Job not found',
          message: `No job found with ID: ${jobId}`,
        });
        return;
      }

      // Check if user has access to this report
      if (job.data.request.userId !== request.user!.id) {
        reply.status(403).send({
          success: false,
          error: 'Access denied',
          message: 'You do not have access to this report',
        });
        return;
      }

      reply.send({
        success: true,
        job: {
          id: job.id,
          status: job.status,
          progress: job.progress,
          result: job.result,
          error: job.error,
          createdAt: job.createdAt,
          startedAt: job.startedAt,
          completedAt: job.completedAt,
        },
      });

    } catch (error: any) {
      logger.error('Get report status failed:', error);
      reply.status(500).send({
        success: false,
        error: 'Failed to get report status',
        message: error.message,
      });
    }
  }

  /**
   * Download report
   */
  async downloadReport(
    request: AuthenticatedRequest<{
      Params: { reportId: string };
    }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { reportId } = request.params;
      
      // TODO: Check if user has access to this report
      
      // Get report from storage
      const reportBuffer = await this.storageService.get(reportId);
      
      // Set appropriate headers
      reply.header('Content-Type', 'application/pdf'); // TODO: Get actual mime type
      reply.header('Content-Disposition', `attachment; filename="report-${reportId}.pdf"`);
      reply.header('Content-Length', reportBuffer.length.toString());
      
      reply.send(reportBuffer);

    } catch (error: any) {
      logger.error('Download report failed:', error);
      
      if (error.message.includes('not found')) {
        reply.status(404).send({
          success: false,
          error: 'Report not found',
          message: `No report found with ID: ${request.params.reportId}`,
        });
      } else {
        reply.status(500).send({
          success: false,
          error: 'Failed to download report',
          message: error.message,
        });
      }
    }
  }

  /**
   * Get report download URL
   */
  async getReportUrl(
    request: AuthenticatedRequest<{
      Params: { reportId: string };
      Querystring: { expiresIn?: number };
    }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { reportId } = request.params;
      const { expiresIn = 3600 } = request.query;
      
      // TODO: Check if user has access to this report
      
      // Check if report exists
      const exists = await this.storageService.exists(reportId);
      if (!exists) {
        reply.status(404).send({
          success: false,
          error: 'Report not found',
          message: `No report found with ID: ${reportId}`,
        });
        return;
      }
      
      // Get signed URL
      const url = await this.storageService.getUrl(reportId, expiresIn);
      
      reply.send({
        success: true,
        url,
        expiresIn,
        expiresAt: new Date(Date.now() + expiresIn * 1000),
      });

    } catch (error: any) {
      logger.error('Get report URL failed:', error);
      reply.status(500).send({
        success: false,
        error: 'Failed to get report URL',
        message: error.message,
      });
    }
  }

  /**
   * List user's reports
   */
  async listReports(
    request: AuthenticatedRequest<{
      Querystring: {
        projectId?: string;
        type?: ReportType;
        status?: ReportStatus;
        limit?: number;
        offset?: number;
      };
    }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { projectId, type, status, limit = 50, offset = 0 } = request.query;
      
      // TODO: Implement report listing from database
      // For now, return jobs from queue
      
      const jobs = await this.queueService.getJobsByStatus(
        status || ReportStatus.COMPLETED,
        limit
      );
      
      // Filter by user
      const userJobs = jobs.filter(job => job.data.request.userId === request.user!.id);
      
      reply.send({
        success: true,
        reports: userJobs.slice(offset, offset + limit),
        total: userJobs.length,
        limit,
        offset,
      });

    } catch (error: any) {
      logger.error('List reports failed:', error);
      reply.status(500).send({
        success: false,
        error: 'Failed to list reports',
        message: error.message,
      });
    }
  }

  /**
   * Delete report
   */
  async deleteReport(
    request: AuthenticatedRequest<{
      Params: { reportId: string };
    }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { reportId } = request.params;
      
      // TODO: Check if user has access to this report
      
      // Delete from storage
      await this.storageService.delete(reportId);
      
      reply.send({
        success: true,
        message: 'Report deleted successfully',
      });

    } catch (error: any) {
      logger.error('Delete report failed:', error);
      reply.status(500).send({
        success: false,
        error: 'Failed to delete report',
        message: error.message,
      });
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const stats = await this.queueService.getQueueStats();
      
      reply.send({
        success: true,
        stats,
      });

    } catch (error: any) {
      logger.error('Get queue stats failed:', error);
      reply.status(500).send({
        success: false,
        error: 'Failed to get queue statistics',
        message: error.message,
      });
    }
  }

  /**
   * Retry failed job
   */
  async retryJob(
    request: AuthenticatedRequest<{
      Params: { jobId: string };
    }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { jobId } = request.params;
      
      // Check if user owns this job
      const job = await this.queueService.getJob(jobId);
      if (!job) {
        reply.status(404).send({
          success: false,
          error: 'Job not found',
        });
        return;
      }
      
      if (job.data.request.userId !== request.user!.id) {
        reply.status(403).send({
          success: false,
          error: 'Access denied',
        });
        return;
      }
      
      const success = await this.queueService.retryJob(jobId);
      
      if (success) {
        reply.send({
          success: true,
          message: 'Job retry initiated',
        });
      } else {
        reply.status(400).send({
          success: false,
          error: 'Failed to retry job',
        });
      }

    } catch (error: any) {
      logger.error('Retry job failed:', error);
      reply.status(500).send({
        success: false,
        error: 'Failed to retry job',
        message: error.message,
      });
    }
  }

  /**
   * Fetch threat model data from threat modeling engine
   */
  private async fetchThreatModelData(projectId: string, threatModelId?: string): Promise<any> {
    try {
      const url = `${config.THREAT_ENGINE_URL}/api/projects/${projectId}/threat-models/${threatModelId || 'latest'}`;
      const response = await axios.get(url, {
        timeout: 10000,
      });
      
      return response.data;
    } catch (error) {
      logger.error('Failed to fetch threat model data:', error);
      // Return mock data for development
      return {
        id: threatModelId || 'mock-threat-model',
        name: 'Mock Threat Model',
        description: 'This is a mock threat model for development',
        version: '1.0.0',
        createdAt: new Date(),
        updatedAt: new Date(),
        components: [],
        dataFlows: [],
        threats: [],
        mitigations: [],
        assumptions: [],
        dependencies: [],
      };
    }
  }

  /**
   * Fetch project data from project service
   */
  private async fetchProjectData(projectId: string): Promise<any> {
    try {
      const url = `${config.PROJECT_SERVICE_URL}/api/projects/${projectId}`;
      const response = await axios.get(url, {
        timeout: 10000,
      });
      
      return response.data;
    } catch (error) {
      logger.error('Failed to fetch project data:', error);
      // Return mock data for development
      return {
        id: projectId,
        name: 'Mock Project',
        description: 'This is a mock project for development',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
  }

  /**
   * Fetch organization data
   */
  private async fetchOrganizationData(organizationId: string): Promise<any> {
    try {
      const url = `${config.AUTH_SERVICE_URL}/api/organizations/${organizationId}`;
      const response = await axios.get(url, {
        timeout: 10000,
      });
      
      return response.data;
    } catch (error) {
      logger.error('Failed to fetch organization data:', error);
      return null;
    }
  }
}