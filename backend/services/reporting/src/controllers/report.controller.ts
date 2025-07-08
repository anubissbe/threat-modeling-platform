import { Request, Response } from 'express';
import { ReportService } from '../services/report.service';
import { CreateReportRequest, UpdateReportRequest } from '../types/report.types';
import { logger } from '../utils/logger';

export class ReportController {
  private reportService: ReportService;

  constructor() {
    this.reportService = new ReportService();
  }

  async getAllReports(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const threatModelId = req.query.threatModelId as string;
      const status = req.query.status as any;

      const result = await this.reportService.getAllReports({
        page,
        limit,
        threatModelId,
        status
      });

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Error fetching reports:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch reports'
      });
    }
  }

  async getReportById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const report = await this.reportService.getReportById(id);

      if (!report) {
        res.status(404).json({
          success: false,
          error: 'Report not found'
        });
        return;
      }

      res.json({
        success: true,
        data: report
      });
    } catch (error) {
      logger.error('Error fetching report:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch report'
      });
    }
  }

  async createReport(req: Request, res: Response): Promise<void> {
    try {
      const reportRequest: CreateReportRequest = req.body;

      // Validate required fields
      if (!reportRequest.threatModelId || !reportRequest.name || !reportRequest.config) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields: threatModelId, name, config'
        });
        return;
      }

      const report = await this.reportService.createReport(reportRequest);

      res.status(201).json({
        success: true,
        data: report
      });
    } catch (error) {
      logger.error('Error creating report:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create report'
      });
    }
  }

  async updateReport(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updateData: UpdateReportRequest = req.body;

      const report = await this.reportService.updateReport(id, updateData);

      if (!report) {
        res.status(404).json({
          success: false,
          error: 'Report not found'
        });
        return;
      }

      res.json({
        success: true,
        data: report
      });
    } catch (error) {
      logger.error('Error updating report:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update report'
      });
    }
  }

  async deleteReport(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const deleted = await this.reportService.deleteReport(id);

      if (!deleted) {
        res.status(404).json({
          success: false,
          error: 'Report not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Report deleted successfully'
      });
    } catch (error) {
      logger.error('Error deleting report:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete report'
      });
    }
  }

  async generateReport(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      const filePath = await this.reportService.generateReport(id);

      res.json({
        success: true,
        message: 'Report generated successfully',
        data: { filePath }
      });
    } catch (error) {
      logger.error('Error generating report:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate report'
      });
    }
  }

  async downloadReport(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const result = await this.reportService.downloadReport(id);

      if (!result) {
        res.status(404).json({
          success: false,
          error: 'Report file not found'
        });
        return;
      }

      // Set appropriate headers for file download
      res.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`);
      res.setHeader('Content-Type', 'application/octet-stream');
      
      // In production, you would stream the actual file
      // For now, return the file path
      res.json({
        success: true,
        message: 'Report ready for download',
        data: result
      });
    } catch (error) {
      logger.error('Error downloading report:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to download report'
      });
    }
  }

  async getReportsByThreatModel(req: Request, res: Response): Promise<void> {
    try {
      const { threatModelId } = req.params;
      const reports = await this.reportService.getReportsByThreatModel(threatModelId);

      res.json({
        success: true,
        data: reports
      });
    } catch (error) {
      logger.error('Error fetching reports by threat model:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch reports'
      });
    }
  }
}