import { Router, Request, Response } from 'express';
import { VulnerabilityService } from '../services/vulnerability.service';
import { validateRequest } from '../validation/vulnerability.validation';
import { createVulnerabilitySchema, updateVulnerabilitySchema } from '../validation/vulnerability.validation';
import { asyncHandler } from '../middleware/error-handler';
import { createRateLimiter } from '../middleware/rate-limiter';
import { logger } from '../utils/logger';

export function createVulnerabilityRouter(): Router {
  const router = Router();
  const vulnerabilityService = new VulnerabilityService();

  // Get all vulnerabilities
  router.get('/',
    asyncHandler(async (req: Request, res: Response) => {
      const userId = req.user!.id;
      const organizationId = req.user!.organization;
      
      const filters = {
        severity: req.query.severity as string,
        status: req.query.status as string,
        projectId: req.query.projectId as string,
        assignedTo: req.query.assignedTo as string,
        search: req.query.search as string,
        limit: parseInt(req.query.limit as string) || 20,
        offset: parseInt(req.query.offset as string) || 0,
      };

      const result = await vulnerabilityService.getVulnerabilities(userId, organizationId, filters);
      
      res.json({
        success: true,
        data: result.vulnerabilities,
        total: result.total,
        limit: filters.limit,
        offset: filters.offset
      });
    })
  );

  // Create new vulnerability
  router.post('/',
    createRateLimiter,
    validateRequest(createVulnerabilitySchema),
    asyncHandler(async (req: Request, res: Response) => {
      const userId = req.user!.id;
      const organizationId = req.user!.organization;
      
      const vulnerability = await vulnerabilityService.createVulnerability(userId, organizationId, req.body);
      
      res.status(201).json({
        success: true,
        data: vulnerability,
        message: 'Vulnerability created successfully'
      });
    })
  );

  // Get single vulnerability
  router.get('/:vulnerabilityId',
    asyncHandler(async (req: Request, res: Response) => {
      const userId = req.user!.id;
      const organizationId = req.user!.organization;
      const { vulnerabilityId } = req.params;
      
      const vulnerability = await vulnerabilityService.getVulnerabilityById(vulnerabilityId, userId, organizationId);
      
      res.json({
        success: true,
        data: vulnerability
      });
    })
  );

  // Update vulnerability
  router.put('/:vulnerabilityId',
    validateRequest(updateVulnerabilitySchema),
    asyncHandler(async (req: Request, res: Response) => {
      const userId = req.user!.id;
      const organizationId = req.user!.organization;
      const { vulnerabilityId } = req.params;
      
      const vulnerability = await vulnerabilityService.updateVulnerability(vulnerabilityId, userId, organizationId, req.body);
      
      res.json({
        success: true,
        data: vulnerability,
        message: 'Vulnerability updated successfully'
      });
    })
  );

  // Delete vulnerability
  router.delete('/:vulnerabilityId',
    asyncHandler(async (req: Request, res: Response) => {
      const userId = req.user!.id;
      const organizationId = req.user!.organization;
      const { vulnerabilityId } = req.params;
      
      await vulnerabilityService.deleteVulnerability(vulnerabilityId, userId, organizationId);
      
      res.json({
        success: true,
        message: 'Vulnerability deleted successfully'
      });
    })
  );

  // Get vulnerability statistics
  router.get('/statistics/overview',
    asyncHandler(async (req: Request, res: Response) => {
      const organizationId = req.user!.organization;
      const projectId = req.query.projectId as string;
      
      const statistics = await vulnerabilityService.getVulnerabilityStatistics(organizationId, projectId);
      
      res.json({
        success: true,
        data: statistics
      });
    })
  );

  // Bulk update vulnerabilities
  router.patch('/bulk',
    asyncHandler(async (req: Request, res: Response) => {
      const userId = req.user!.id;
      const organizationId = req.user!.organization;
      const { vulnerabilityIds, updates } = req.body;
      
      if (!Array.isArray(vulnerabilityIds) || vulnerabilityIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'vulnerabilityIds must be a non-empty array'
        });
      }
      
      const results = [];
      
      for (const vulnerabilityId of vulnerabilityIds) {
        try {
          const vulnerability = await vulnerabilityService.updateVulnerability(vulnerabilityId, userId, organizationId, updates);
          results.push({ id: vulnerabilityId, success: true, data: vulnerability });
        } catch (error) {
          results.push({ id: vulnerabilityId, success: false, error: (error as Error).message });
        }
      }
      
      return res.json({
        success: true,
        data: results,
        message: 'Bulk update completed'
      });
    })
  );

  // Search vulnerabilities with advanced filters
  router.post('/search',
    asyncHandler(async (req: Request, res: Response) => {
      const userId = req.user!.id;
      const organizationId = req.user!.organization;
      
      const {
        query = '',
        severities = [],
        statuses = [],
        assignees = [],
        projectIds = [],
        dateRange = {},
        limit = 20,
        offset = 0,
        sortBy = 'created_at',
        sortOrder = 'desc'
      } = req.body;
      
      // Convert advanced search to filters
      const filters: any = {
        search: query,
        limit,
        offset
      };
      
      // For simplicity, use the first filter values (can be enhanced for multi-select)
      if (severities.length > 0) filters.severity = severities[0];
      if (statuses.length > 0) filters.status = statuses[0];
      if (assignees.length > 0) filters.assignedTo = assignees[0];
      if (projectIds.length > 0) filters.projectId = projectIds[0];
      
      const result = await vulnerabilityService.getVulnerabilities(userId, organizationId, filters);
      
      res.json({
        success: true,
        data: result.vulnerabilities,
        total: result.total,
        limit,
        offset
      });
    })
  );

  return router;
}