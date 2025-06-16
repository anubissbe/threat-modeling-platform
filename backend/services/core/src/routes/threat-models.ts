import { Router, Request, Response } from 'express';
import { ThreatModelService } from '../services/threat-model.service';
import { validateRequest } from '../validation/threat-model.validation';
import { createThreatModelSchema, updateThreatModelSchema } from '../validation/threat-model.validation';
import { asyncHandler } from '../middleware/error-handler';
import { createRateLimiter } from '../middleware/rate-limiter';
import { logger } from '../utils/logger';

export function createThreatModelRouter(): Router {
  const router = Router();
  const threatModelService = new ThreatModelService();

  // Get all threat models (with optional project filter)
  router.get('/',
    asyncHandler(async (req: Request, res: Response) => {
      const userId = req.user!.id;
      const projectId = req.query.projectId as string;
      
      if (!projectId) {
        res.status(400).json({
          success: false,
          error: 'Project ID is required'
        });
        return;
      }

      const filters = {
        status: req.query.status as any,
        methodology: req.query.methodology as string,
      };

      const threatModels = await threatModelService.getProjectThreatModels(
        projectId,
        userId,
        filters
      );
      
      res.json({
        success: true,
        data: threatModels
      });
    })
  );

  // Create new threat model
  router.post('/',
    createRateLimiter,
    validateRequest(createThreatModelSchema),
    asyncHandler(async (req: Request, res: Response) => {
      const userId = req.user!.id;
      
      const threatModel = await threatModelService.createThreatModel(userId, req.body);
      
      res.status(201).json({
        success: true,
        data: threatModel,
        message: 'Threat model created successfully'
      });
    })
  );

  // Get single threat model
  router.get('/:threatModelId',
    asyncHandler(async (req: Request, res: Response) => {
      const userId = req.user!.id;
      const { threatModelId } = req.params;
      
      const threatModel = await threatModelService.getThreatModel(threatModelId, userId);
      
      res.json({
        success: true,
        data: threatModel
      });
    })
  );

  // Update threat model
  router.patch('/:threatModelId',
    validateRequest(updateThreatModelSchema),
    asyncHandler(async (req: Request, res: Response) => {
      const userId = req.user!.id;
      const { threatModelId } = req.params;
      
      const threatModel = await threatModelService.updateThreatModel(
        threatModelId,
        userId,
        req.body
      );
      
      res.json({
        success: true,
        data: threatModel,
        message: 'Threat model updated successfully'
      });
    })
  );

  // Validate threat model
  router.post('/:threatModelId/validate',
    asyncHandler(async (req: Request, res: Response) => {
      const userId = req.user!.id;
      const { threatModelId } = req.params;
      
      // Verify access first
      await threatModelService.getThreatModel(threatModelId, userId);
      
      const validation = await threatModelService.validateThreatModel(threatModelId);
      
      res.json({
        success: true,
        data: validation
      });
    })
  );

  // Clone threat model
  router.post('/:threatModelId/clone',
    createRateLimiter,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = req.user!.id;
      const { threatModelId } = req.params;
      const { name } = req.body;
      
      if (!name || name.trim().length === 0) {
        res.status(400).json({
          success: false,
          error: 'Name is required for cloning'
        });
        return;
      }
      
      const clonedModel = await threatModelService.cloneThreatModel(
        threatModelId,
        userId,
        name
      );
      
      res.status(201).json({
        success: true,
        data: clonedModel,
        message: 'Threat model cloned successfully'
      });
    })
  );

  // Publish threat model
  router.post('/:threatModelId/publish',
    asyncHandler(async (req: Request, res: Response) => {
      const userId = req.user!.id;
      const { threatModelId } = req.params;
      
      // Validate before publishing
      const validation = await threatModelService.validateThreatModel(threatModelId);
      
      if (!validation.is_valid) {
        res.status(400).json({
          success: false,
          error: 'Threat model validation failed',
          validation
        });
        return;
      }
      
      const threatModel = await threatModelService.updateThreatModel(
        threatModelId,
        userId,
        { status: 'published' as any }
      );
      
      res.json({
        success: true,
        data: threatModel,
        message: 'Threat model published successfully'
      });
    })
  );

  // Export threat model
  router.get('/:threatModelId/export',
    asyncHandler(async (req: Request, res: Response) => {
      const userId = req.user!.id;
      const { threatModelId } = req.params;
      const format = req.query.format || 'json';
      
      const threatModel = await threatModelService.getThreatModel(threatModelId, userId);
      
      switch (format) {
        case 'json':
          res.json({
            success: true,
            data: threatModel
          });
          break;
          
        case 'pdf':
          // TODO: Implement PDF export
          res.status(501).json({
            success: false,
            error: 'PDF export not yet implemented'
          });
          break;
          
        default:
          res.status(400).json({
            success: false,
            error: `Unsupported export format: ${format}`
          });
      }
    })
  );

  return router;
}