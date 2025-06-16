import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/error-handler';
import { ThreatService } from '../services/threat.service';
import { pool } from '../config/database';
import { authenticateToken } from '../middleware/auth';
import { 
  createThreatSchema, 
  updateThreatSchema, 
  createMitigationSchema,
  suggestThreatsSchema,
  validateRequest 
} from '../validation/threat.validation';
import { createRateLimiter } from '../middleware/rate-limiter';

export function createThreatRouter(): Router {
  const router = Router();
  const threatService = new ThreatService(pool);

  // Apply authentication to all routes
  router.use(authenticateToken);

  // Get threats for a threat model
  router.get('/',
    asyncHandler(async (req: Request, res: Response) => {
      const threatModelId = req.query.threatModelId as string;
      const status = req.query.status as string;
      const severity = req.query.severity as string;
      const category = req.query.category as string;
      
      if (!threatModelId) {
        res.status(400).json({
          success: false,
          error: 'Threat model ID is required'
        });
        return;
      }

      const threats = await threatService.getThreatsByThreatModel(
        req.user!.id,
        threatModelId,
        { status: status as any, severity: severity as any, category }
      );

      res.json({
        success: true,
        data: threats
      });
    })
  );

  // Get a specific threat
  router.get('/:threatId',
    asyncHandler(async (req: Request, res: Response) => {
      const { threatId } = req.params;

      const threat = await threatService.getThreat(req.user!.id, threatId);
      
      if (!threat) {
        res.status(404).json({
          success: false,
          error: 'Threat not found'
        });
        return;
      }

      res.json({
        success: true,
        data: threat
      });
    })
  );

  // Create new threat
  router.post('/',
    createRateLimiter,
    validateRequest(createThreatSchema),
    asyncHandler(async (req: Request, res: Response) => {
      const threat = await threatService.createThreat(
        req.user!.id,
        req.validatedData
      );

      res.status(201).json({
        success: true,
        data: threat
      });
    })
  );

  // Update threat
  router.put('/:threatId',
    validateRequest(updateThreatSchema),
    asyncHandler(async (req: Request, res: Response) => {
      const { threatId } = req.params;

      const threat = await threatService.updateThreat(
        req.user!.id,
        threatId,
        req.validatedData
      );

      if (!threat) {
        res.status(404).json({
          success: false,
          error: 'Threat not found'
        });
        return;
      }

      res.json({
        success: true,
        data: threat
      });
    })
  );

  // Delete threat
  router.delete('/:threatId',
    asyncHandler(async (req: Request, res: Response) => {
      const { threatId } = req.params;

      const deleted = await threatService.deleteThreat(req.user!.id, threatId);

      if (!deleted) {
        res.status(404).json({
          success: false,
          error: 'Threat not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Threat deleted successfully'
      });
    })
  );

  // Get mitigations for a threat
  router.get('/:threatId/mitigations',
    asyncHandler(async (req: Request, res: Response) => {
      const { threatId } = req.params;

      const mitigations = await threatService.getMitigations(req.user!.id, threatId);

      res.json({
        success: true,
        data: mitigations
      });
    })
  );

  // Add mitigation to threat
  router.post('/:threatId/mitigations',
    createRateLimiter,
    validateRequest(createMitigationSchema),
    asyncHandler(async (req: Request, res: Response) => {
      const { threatId } = req.params;

      const mitigation = await threatService.addMitigation(
        req.user!.id,
        threatId,
        req.validatedData
      );

      res.status(201).json({
        success: true,
        data: mitigation
      });
    })
  );

  // Get threat suggestions based on methodology
  router.post('/suggest',
    createRateLimiter,
    validateRequest(suggestThreatsSchema),
    asyncHandler(async (req: Request, res: Response) => {
      const { threat_model_id, methodology } = req.validatedData;

      const suggestions = await threatService.generateThreatSuggestions(
        req.user!.id,
        threat_model_id,
        methodology
      );

      res.json({
        success: true,
        data: {
          suggestions,
          methodology,
          generated_at: new Date().toISOString()
        }
      });
    })
  );

  return router;
}