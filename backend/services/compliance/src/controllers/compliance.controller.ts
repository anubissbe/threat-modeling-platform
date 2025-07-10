import { Request, Response } from 'express';
import { ComplianceService } from '../services/compliance.service';
import { ComplianceReportingService } from '../services/reporting.service';
import { logger } from '../utils/logger';
import {
  CreateAssessmentRequest,
  UpdateControlRequest,
  CreateRemediationPlanRequest,
  GenerateReportRequest,
  ComplianceSearchQuery,
  ComplianceFramework
} from '../types/compliance';

export class ComplianceController {
  private complianceService: ComplianceService;
  private reportingService: ComplianceReportingService;

  constructor() {
    this.complianceService = new ComplianceService();
    this.reportingService = new ComplianceReportingService();
  }

  /**
   * Get compliance dashboard
   */
  async getDashboard(req: Request, res: Response): Promise<void> {
    try {
      const { organizationId } = req.params;
      
      if (!organizationId) {
        res.status(400).json({ error: 'Organization ID is required' });
        return;
      }

      const dashboard = await this.complianceService.getComplianceDashboard(organizationId);
      
      res.json({
        success: true,
        data: dashboard
      });
    } catch (error) {
      logger.error('Error getting compliance dashboard:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get compliance dashboard',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get all compliance controls
   */
  async getControls(req: Request, res: Response): Promise<void> {
    try {
      const query: ComplianceSearchQuery = {
        frameworks: req.query.frameworks ? (req.query.frameworks as string).split(',') as ComplianceFramework[] : undefined,
        status: req.query.status ? (req.query.status as string).split(',') as any[] : undefined,
        priority: req.query.priority ? (req.query.priority as string).split(',') as any[] : undefined,
        categories: req.query.categories ? (req.query.categories as string).split(',') : undefined,
        owner: req.query.owner as string,
        searchTerm: req.query.searchTerm as string,
        sortBy: req.query.sortBy as any,
        sortOrder: req.query.sortOrder as 'asc' | 'desc',
        limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
        offset: req.query.offset ? parseInt(req.query.offset as string) : undefined
      };

      const result = await this.complianceService.searchControls(query);
      
      res.json({
        success: true,
        data: result.controls,
        pagination: {
          total: result.total,
          limit: query.limit,
          offset: query.offset
        }
      });
    } catch (error) {
      logger.error('Error getting controls:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get controls',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get a specific control
   */
  async getControl(req: Request, res: Response): Promise<void> {
    try {
      const { controlId } = req.params;
      
      const control = await this.complianceService.getControl(controlId);
      
      if (!control) {
        res.status(404).json({
          success: false,
          error: 'Control not found'
        });
        return;
      }
      
      res.json({
        success: true,
        data: control
      });
    } catch (error) {
      logger.error('Error getting control:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get control',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Update a compliance control
   */
  async updateControl(req: Request, res: Response): Promise<void> {
    try {
      const { controlId } = req.params;
      const updates: UpdateControlRequest = req.body;
      const userId = (req as any).user?.id || 'system';
      
      const control = await this.complianceService.updateControl(controlId, updates, userId);
      
      res.json({
        success: true,
        data: control
      });
    } catch (error) {
      logger.error('Error updating control:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update control',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get controls by framework
   */
  async getControlsByFramework(req: Request, res: Response): Promise<void> {
    try {
      const { framework } = req.params;
      
      if (!framework) {
        res.status(400).json({ error: 'Framework is required' });
        return;
      }

      const controls = await this.complianceService.getControlsByFramework(framework as ComplianceFramework);
      
      res.json({
        success: true,
        data: controls
      });
    } catch (error) {
      logger.error('Error getting controls by framework:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get controls by framework',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Create a new compliance assessment
   */
  async createAssessment(req: Request, res: Response): Promise<void> {
    try {
      const assessmentRequest: CreateAssessmentRequest = req.body;
      const userId = (req as any).user?.id || 'system';
      
      // Validate required fields
      if (!assessmentRequest.name || !assessmentRequest.framework) {
        res.status(400).json({
          success: false,
          error: 'Name and framework are required'
        });
        return;
      }

      const assessment = await this.complianceService.createAssessment(assessmentRequest, userId);
      
      res.status(201).json({
        success: true,
        data: assessment
      });
    } catch (error) {
      logger.error('Error creating assessment:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create assessment',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Execute a compliance assessment
   */
  async executeAssessment(req: Request, res: Response): Promise<void> {
    try {
      const { assessmentId } = req.params;
      const userId = (req as any).user?.id || 'system';
      
      const assessment = await this.complianceService.executeAssessment(assessmentId, userId);
      
      res.json({
        success: true,
        data: assessment
      });
    } catch (error) {
      logger.error('Error executing assessment:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to execute assessment',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get all assessments
   */
  async getAssessments(req: Request, res: Response): Promise<void> {
    try {
      const assessments = await this.complianceService.getAllAssessments();
      
      res.json({
        success: true,
        data: assessments
      });
    } catch (error) {
      logger.error('Error getting assessments:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get assessments',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get a specific assessment
   */
  async getAssessment(req: Request, res: Response): Promise<void> {
    try {
      const { assessmentId } = req.params;
      
      const assessment = await this.complianceService.getAssessment(assessmentId);
      
      if (!assessment) {
        res.status(404).json({
          success: false,
          error: 'Assessment not found'
        });
        return;
      }
      
      res.json({
        success: true,
        data: assessment
      });
    } catch (error) {
      logger.error('Error getting assessment:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get assessment',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Create a remediation plan
   */
  async createRemediationPlan(req: Request, res: Response): Promise<void> {
    try {
      const planRequest: CreateRemediationPlanRequest = req.body;
      const userId = (req as any).user?.id || 'system';
      
      // Validate required fields
      if (!planRequest.controlId || !planRequest.title) {
        res.status(400).json({
          success: false,
          error: 'Control ID and title are required'
        });
        return;
      }

      const plan = await this.complianceService.createRemediationPlan(planRequest, userId);
      
      res.status(201).json({
        success: true,
        data: plan
      });
    } catch (error) {
      logger.error('Error creating remediation plan:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create remediation plan',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get a remediation plan
   */
  async getRemediationPlan(req: Request, res: Response): Promise<void> {
    try {
      const { planId } = req.params;
      
      const plan = await this.complianceService.getRemediationPlan(planId);
      
      if (!plan) {
        res.status(404).json({
          success: false,
          error: 'Remediation plan not found'
        });
        return;
      }
      
      res.json({
        success: true,
        data: plan
      });
    } catch (error) {
      logger.error('Error getting remediation plan:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get remediation plan',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Generate a compliance report
   */
  async generateReport(req: Request, res: Response): Promise<void> {
    try {
      const reportRequest: GenerateReportRequest = req.body;
      const userId = (req as any).user?.id || 'system';
      
      // Validate required fields
      if (!reportRequest.name || !reportRequest.type || !reportRequest.format || !reportRequest.frameworks) {
        res.status(400).json({
          success: false,
          error: 'Name, type, format, and frameworks are required'
        });
        return;
      }

      // Get data for the report
      const allAssessments = await this.complianceService.getAllAssessments();
      const allControls = await this.complianceService.getAllControls();
      
      // Filter assessments and controls based on request
      const filteredAssessments = allAssessments.filter(a => 
        reportRequest.frameworks.includes(a.framework) &&
        (!reportRequest.assessmentIds || reportRequest.assessmentIds.includes(a.id))
      );
      
      const filteredControls = allControls.filter(c => 
        reportRequest.frameworks.includes(c.framework)
      );
      
      // Mock findings and recommendations for demonstration
      const findings: any[] = [];
      const recommendations: any[] = [];
      const evidence: any[] = [];

      const report = await this.reportingService.generateReport(
        reportRequest,
        filteredAssessments,
        filteredControls,
        findings,
        recommendations,
        evidence,
        userId
      );
      
      res.status(201).json({
        success: true,
        data: report
      });
    } catch (error) {
      logger.error('Error generating report:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate report',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get all reports
   */
  async getReports(req: Request, res: Response): Promise<void> {
    try {
      const reports = await this.reportingService.getAllReports();
      
      res.json({
        success: true,
        data: reports
      });
    } catch (error) {
      logger.error('Error getting reports:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get reports',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get a specific report
   */
  async getReport(req: Request, res: Response): Promise<void> {
    try {
      const { reportId } = req.params;
      
      const report = await this.reportingService.getReport(reportId);
      
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
      logger.error('Error getting report:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get report',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Download a report file
   */
  async downloadReport(req: Request, res: Response): Promise<void> {
    try {
      const { reportId } = req.params;
      
      const report = await this.reportingService.getReport(reportId);
      
      if (!report) {
        res.status(404).json({
          success: false,
          error: 'Report not found'
        });
        return;
      }

      const fileBuffer = await this.reportingService.getReportFile(reportId);
      
      if (!fileBuffer) {
        res.status(404).json({
          success: false,
          error: 'Report file not found'
        });
        return;
      }

      // Set appropriate headers for file download
      const fileName = `${report.name}.${report.format}`;
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Content-Type', this.getContentType(report.format));
      res.setHeader('Content-Length', fileBuffer.length);
      
      res.send(fileBuffer);
    } catch (error) {
      logger.error('Error downloading report:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to download report',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Delete a report
   */
  async deleteReport(req: Request, res: Response): Promise<void> {
    try {
      const { reportId } = req.params;
      
      const deleted = await this.reportingService.deleteReport(reportId);
      
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
        error: 'Failed to delete report',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get compliance events (audit trail)
   */
  async getEvents(req: Request, res: Response): Promise<void> {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      
      const events = await this.complianceService.getEvents(limit);
      
      res.json({
        success: true,
        data: events
      });
    } catch (error) {
      logger.error('Error getting compliance events:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get compliance events',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get system health status
   */
  async getHealth(req: Request, res: Response): Promise<void> {
    try {
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        services: {
          compliance: 'healthy',
          reporting: 'healthy',
          database: 'healthy'
        },
        metrics: {
          totalControls: (await this.complianceService.getAllControls()).length,
          totalAssessments: (await this.complianceService.getAllAssessments()).length,
          totalReports: (await this.reportingService.getAllReports()).length
        }
      };
      
      res.json(health);
    } catch (error) {
      logger.error('Error getting health status:', error);
      res.status(500).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get available compliance frameworks
   */
  async getFrameworks(req: Request, res: Response): Promise<void> {
    try {
      const frameworks = [
        {
          id: 'gdpr',
          name: 'General Data Protection Regulation',
          description: 'EU regulation on data protection and privacy',
          region: 'EU',
          industry: 'General',
          type: 'Privacy'
        },
        {
          id: 'hipaa',
          name: 'Health Insurance Portability and Accountability Act',
          description: 'US healthcare data protection regulation',
          region: 'US',
          industry: 'Healthcare',
          type: 'Privacy'
        },
        {
          id: 'soc2',
          name: 'SOC 2 Type II',
          description: 'Service organization control 2 audit',
          region: 'US',
          industry: 'Technology',
          type: 'Security'
        },
        {
          id: 'pci-dss',
          name: 'Payment Card Industry Data Security Standard',
          description: 'Security standard for organizations handling payment cards',
          region: 'Global',
          industry: 'Financial',
          type: 'Security'
        },
        {
          id: 'iso27001',
          name: 'ISO/IEC 27001',
          description: 'International standard for information security management',
          region: 'Global',
          industry: 'General',
          type: 'Security'
        },
        {
          id: 'nist',
          name: 'NIST Cybersecurity Framework',
          description: 'US framework for improving cybersecurity',
          region: 'US',
          industry: 'General',
          type: 'Security'
        },
        {
          id: 'owasp',
          name: 'OWASP Top 10',
          description: 'Top 10 web application security risks',
          region: 'Global',
          industry: 'Technology',
          type: 'Application Security'
        }
      ];
      
      res.json({
        success: true,
        data: frameworks
      });
    } catch (error) {
      logger.error('Error getting frameworks:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get frameworks',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get compliance statistics
   */
  async getStatistics(req: Request, res: Response): Promise<void> {
    try {
      const allControls = await this.complianceService.getAllControls();
      const allAssessments = await this.complianceService.getAllAssessments();
      
      const statistics = {
        controls: {
          total: allControls.length,
          compliant: allControls.filter(c => c.status === 'compliant').length,
          nonCompliant: allControls.filter(c => c.status === 'non-compliant').length,
          partiallyCompliant: allControls.filter(c => c.status === 'partially-compliant').length,
          notAssessed: allControls.filter(c => c.status === 'not-assessed').length
        },
        assessments: {
          total: allAssessments.length,
          completed: allAssessments.filter(a => a.status === 'completed').length,
          inProgress: allAssessments.filter(a => a.status === 'in-progress').length,
          planned: allAssessments.filter(a => a.status === 'planned').length,
          failed: allAssessments.filter(a => a.status === 'failed').length
        },
        frameworks: this.getFrameworkStatistics(allControls, allAssessments),
        trends: this.getTrendStatistics(allAssessments)
      };
      
      res.json({
        success: true,
        data: statistics
      });
    } catch (error) {
      logger.error('Error getting statistics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get statistics',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Helper methods

  private getContentType(format: string): string {
    switch (format) {
      case 'pdf': return 'application/pdf';
      case 'html': return 'text/html';
      case 'excel': 
      case 'xlsx': return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      case 'csv': return 'text/csv';
      case 'json': return 'application/json';
      case 'xml': return 'application/xml';
      default: return 'application/octet-stream';
    }
  }

  private getFrameworkStatistics(controls: any[], assessments: any[]): any {
    const frameworks = ['gdpr', 'hipaa', 'soc2', 'pci-dss', 'iso27001', 'nist', 'owasp'];
    
    return frameworks.reduce((stats, framework) => {
      const frameworkControls = controls.filter(c => c.framework === framework);
      const frameworkAssessments = assessments.filter(a => a.framework === framework);
      
      stats[framework] = {
        controls: {
          total: frameworkControls.length,
          compliant: frameworkControls.filter(c => c.status === 'compliant').length
        },
        assessments: {
          total: frameworkAssessments.length,
          completed: frameworkAssessments.filter(a => a.status === 'completed').length
        },
        complianceRate: frameworkControls.length > 0 
          ? Math.round((frameworkControls.filter(c => c.status === 'compliant').length / frameworkControls.length) * 100)
          : 0
      };
      
      return stats;
    }, {} as any);
  }

  private getTrendStatistics(assessments: any[]): any {
    // Mock trend data - in production would calculate from historical data
    const lastSixMonths = [];
    const now = new Date();
    
    for (let i = 5; i >= 0; i--) {
      const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthAssessments = assessments.filter(a => {
        const assessmentDate = new Date(a.createdAt);
        return assessmentDate.getMonth() === month.getMonth() && 
               assessmentDate.getFullYear() === month.getFullYear();
      });
      
      lastSixMonths.push({
        month: month.toLocaleString('default', { month: 'short', year: 'numeric' }),
        assessments: monthAssessments.length,
        averageScore: monthAssessments.length > 0 
          ? Math.round(monthAssessments.reduce((sum, a) => sum + a.complianceScore, 0) / monthAssessments.length)
          : 0
      });
    }
    
    return {
      assessmentTrend: lastSixMonths,
      complianceScoreTrend: lastSixMonths.map(m => ({ month: m.month, score: m.averageScore }))
    };
  }
}