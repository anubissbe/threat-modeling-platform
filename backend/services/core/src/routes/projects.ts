import { Router, Request, Response } from 'express';
import { ProjectService } from '../services/project.service';
import { ReportsService } from '../services/reports.service';
import { validateRequest } from '../validation/project.validation';
import { createProjectSchema, updateProjectSchema } from '../validation/project.validation';
import { asyncHandler } from '../middleware/error-handler';
import { createRateLimiter } from '../middleware/rate-limiter';
import { logger } from '../utils/logger';

export function createProjectRouter(): Router {
  const router = Router();
  const projectService = new ProjectService();
  const reportsService = new ReportsService();

  // Get all user projects
  router.get('/',
    asyncHandler(async (req: Request, res: Response) => {
      const userId = req.user!.id;
      const organizationId = req.user!.organization;
      
      const filters = {
        status: req.query.status as any,
        search: req.query.search as string,
        limit: parseInt(req.query.limit as string) || 20,
        offset: parseInt(req.query.offset as string) || 0,
      };

      const result = await projectService.getUserProjects(userId, organizationId, filters);
      
      res.json({
        success: true,
        data: result.projects,
        total: result.total,
        limit: filters.limit,
        offset: filters.offset
      });
    })
  );

  // Create new project
  router.post('/',
    createRateLimiter,
    validateRequest(createProjectSchema),
    asyncHandler(async (req: Request, res: Response) => {
      const userId = req.user!.id;
      const organizationId = req.user!.organization;
      
      const project = await projectService.createProject(userId, organizationId, req.body);
      
      res.status(201).json({
        success: true,
        data: project,
        message: 'Project created successfully'
      });
    })
  );

  // Get single project
  router.get('/:projectId',
    asyncHandler(async (req: Request, res: Response) => {
      const userId = req.user!.id;
      const { projectId } = req.params;
      
      const project = await projectService.getProject(projectId, userId);
      
      res.json({
        success: true,
        data: project
      });
    })
  );

  // Update project
  router.patch('/:projectId',
    validateRequest(updateProjectSchema),
    asyncHandler(async (req: Request, res: Response) => {
      const userId = req.user!.id;
      const { projectId } = req.params;
      
      const project = await projectService.updateProject(projectId, userId, req.body);
      
      res.json({
        success: true,
        data: project,
        message: 'Project updated successfully'
      });
    })
  );

  // Get project statistics
  router.get('/:projectId/statistics',
    asyncHandler(async (req: Request, res: Response) => {
      const userId = req.user!.id;
      const { projectId } = req.params;
      
      // Verify access first
      await projectService.getProject(projectId, userId);
      
      const statistics = await projectService.getProjectStatistics(projectId);
      
      res.json({
        success: true,
        data: statistics
      });
    })
  );

  // Archive project
  router.post('/:projectId/archive',
    asyncHandler(async (req: Request, res: Response) => {
      const userId = req.user!.id;
      const { projectId } = req.params;
      
      const project = await projectService.updateProject(projectId, userId, {
        status: 'archived' as any
      });
      
      res.json({
        success: true,
        data: project,
        message: 'Project archived successfully'
      });
    })
  );

  // Restore archived project
  router.post('/:projectId/restore',
    asyncHandler(async (req: Request, res: Response) => {
      const userId = req.user!.id;
      const { projectId } = req.params;
      
      const project = await projectService.updateProject(projectId, userId, {
        status: 'active' as any
      });
      
      res.json({
        success: true,
        data: project,
        message: 'Project restored successfully'
      });
    })
  );

  // Get project reports
  router.get('/:projectId/reports',
    asyncHandler(async (req: Request, res: Response) => {
      const userId = req.user!.id;
      const organizationId = req.user!.organization;
      const { projectId } = req.params;
      
      const filters = {
        reportType: req.query.reportType as any,
        status: req.query.status as any,
        generatedBy: req.query.generatedBy as string,
        startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
        limit: parseInt(req.query.limit as string) || 20,
        offset: parseInt(req.query.offset as string) || 0
      };
      
      const result = await reportsService.getProjectReports(userId, organizationId, projectId, filters);
      
      return res.json({
        success: true,
        data: result.reports,
        total: result.total,
        limit: filters.limit,
        offset: filters.offset
      });
    })
  );

  // Generate new project report
  router.post('/:projectId/reports',
    asyncHandler(async (req: Request, res: Response) => {
      const userId = req.user!.id;
      const organizationId = req.user!.organization;
      const { projectId } = req.params;
      
      const { reportType, title, description, metadata } = req.body;
      
      if (!reportType || !title || !metadata) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: reportType, title, metadata'
        });
      }
      
      const report = await reportsService.generateProjectReport(userId, organizationId, projectId, {
        reportType,
        title,
        description,
        metadata
      });
      
      return res.status(201).json({
        success: true,
        data: report,
        message: 'Report generated successfully'
      });
    })
  );

  // Get specific report
  router.get('/:projectId/reports/:reportId',
    asyncHandler(async (req: Request, res: Response) => {
      const userId = req.user!.id;
      const organizationId = req.user!.organization;
      const { reportId } = req.params;
      
      const report = await reportsService.getReport(userId, organizationId, reportId);
      
      return res.json({
        success: true,
        data: report
      });
    })
  );

  // Delete report
  router.delete('/:projectId/reports/:reportId',
    asyncHandler(async (req: Request, res: Response) => {
      const userId = req.user!.id;
      const organizationId = req.user!.organization;
      const { reportId } = req.params;
      
      await reportsService.deleteReport(userId, organizationId, reportId);
      
      return res.json({
        success: true,
        message: 'Report deleted successfully'
      });
    })
  );

  // Get report statistics for project
  router.get('/:projectId/reports/statistics',
    asyncHandler(async (req: Request, res: Response) => {
      const organizationId = req.user!.organization;
      const { projectId } = req.params;
      
      const statistics = await reportsService.getReportStatistics(organizationId, projectId);
      
      return res.json({
        success: true,
        data: statistics
      });
    })
  );

  return router;
}