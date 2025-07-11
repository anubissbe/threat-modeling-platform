import { Router, Request, Response } from 'express';
import { RiskAssessmentService } from '../services/risk-assessment.service';
import { asyncHandler } from '../middleware/error-handler';
import { createRateLimiter } from '../middleware/rate-limiter';
import { logger } from '../utils/logger';

export function createRiskAssessmentRouter(): Router {
  const router = Router();
  const riskAssessmentService = new RiskAssessmentService();

  // Get all risk assessments
  router.get('/',
    asyncHandler(async (req: Request, res: Response) => {
      const userId = req.user!.id;
      const organizationId = req.user!.organization;
      
      const filters = {
        projectId: req.query.projectId as string,
        status: req.query.status as string,
        limit: parseInt(req.query.limit as string) || 20,
        offset: parseInt(req.query.offset as string) || 0,
      };

      const result = await riskAssessmentService.getAssessments(userId, organizationId, filters);
      
      res.json({
        success: true,
        data: result.assessments,
        total: result.total,
        limit: filters.limit,
        offset: filters.offset
      });
    })
  );

  // Create new risk assessment
  router.post('/',
    createRateLimiter,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = req.user!.id;
      const organizationId = req.user!.organization;
      
      const { projectId, assessmentType = 'automated' } = req.body;
      
      if (!projectId) {
        res.status(400).json({
          success: false,
          error: 'Project ID is required'
        });
        return;
      }

      const assessment = await riskAssessmentService.createAssessment(
        userId,
        organizationId,
        { projectId, assessmentType }
      );
      
      res.status(201).json({
        success: true,
        data: assessment,
        message: 'Risk assessment created successfully'
      });
    })
  );

  // Get single risk assessment with details
  router.get('/:assessmentId',
    asyncHandler(async (req: Request, res: Response) => {
      const { assessmentId } = req.params;
      
      const assessment = await riskAssessmentService.getAssessmentDetails(assessmentId);
      
      res.json({
        success: true,
        data: assessment
      });
    })
  );

  // Refresh/recalculate risk assessment
  router.post('/:assessmentId/refresh',
    createRateLimiter,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = req.user!.id;
      const organizationId = req.user!.organization;
      const { assessmentId } = req.params;
      
      const assessment = await riskAssessmentService.refreshAssessment(
        assessmentId,
        userId,
        organizationId
      );
      
      res.json({
        success: true,
        data: assessment,
        message: 'Risk assessment refreshed successfully'
      });
    })
  );

  // Get assessment statistics
  router.get('/statistics/overview',
    asyncHandler(async (req: Request, res: Response) => {
      const organizationId = req.user!.organization;
      const projectId = req.query.projectId as string;
      
      // For now, return basic statistics
      const { assessments } = await riskAssessmentService.getAssessments(
        req.user!.id,
        organizationId,
        { projectId }
      );
      
      const statistics = {
        total: assessments.length,
        byRisk: {
          critical: assessments.filter(a => a.overallRisk === 'Critical').length,
          high: assessments.filter(a => a.overallRisk === 'High').length,
          medium: assessments.filter(a => a.overallRisk === 'Medium').length,
          low: assessments.filter(a => a.overallRisk === 'Low').length,
        },
        byStatus: {
          completed: assessments.filter(a => a.status === 'completed').length,
          inProgress: assessments.filter(a => a.status === 'in_progress').length,
          pending: assessments.filter(a => a.status === 'pending').length,
        },
        averageScore: assessments.length > 0 
          ? Math.round(assessments.reduce((sum, a) => sum + a.score, 0) / assessments.length)
          : 0,
        totalVulnerabilities: assessments.reduce((sum, a) => sum + a.vulnerabilities.length, 0),
        totalThreats: assessments.reduce((sum, a) => sum + a.threats.length, 0),
      };
      
      res.json({
        success: true,
        data: statistics
      });
    })
  );

  return router;
}