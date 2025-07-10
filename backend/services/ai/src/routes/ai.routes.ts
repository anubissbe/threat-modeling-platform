import { Router } from 'express';
import { Pool } from 'pg';
import { RedisClientType } from 'redis';
import { AIController } from '../controllers/ai.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { rateLimitMiddleware } from '../middleware/rate-limit.middleware';
import { validateRequestMiddleware } from '../middleware/validation.middleware';

export function createAIRoutes(db: Pool, redis: RedisClientType): Router {
  const router = Router();
  const aiController = new AIController(db, redis);

  // Apply authentication to all routes
  router.use(authMiddleware);

  /**
   * @route POST /api/ai/analyze
   * @desc Analyze threats using AI
   * @access Private
   * @rateLimit 10 requests per minute per user
   */
  router.post('/analyze', 
    rateLimitMiddleware(10, 60), // 10 requests per minute
    validateRequestMiddleware,
    aiController.analyzeThreats.bind(aiController)
  );

  /**
   * @route POST /api/ai/analyze/enhanced
   * @desc Enhanced AI threat analysis with 98% accuracy
   * @access Private
   * @rateLimit 5 requests per minute per user (more resource intensive)
   */
  router.post('/analyze/enhanced', 
    rateLimitMiddleware(5, 60), // 5 requests per minute (more resource intensive)
    validateRequestMiddleware,
    aiController.analyzeThreatsEnhanced.bind(aiController)
  );

  /**
   * @route GET /api/ai/analysis/:analysisId
   * @desc Get analysis results by ID
   * @access Private
   */
  router.get('/analysis/:analysisId',
    rateLimitMiddleware(100, 60), // 100 requests per minute
    aiController.getAnalysisResults.bind(aiController)
  );

  /**
   * @route GET /api/ai/analysis/history/:threatModelId
   * @desc Get analysis history for a threat model
   * @access Private
   */
  router.get('/analysis/history/:threatModelId',
    rateLimitMiddleware(50, 60), // 50 requests per minute
    aiController.getAnalysisHistory.bind(aiController)
  );

  /**
   * @route GET /api/ai/health
   * @desc Get AI service health status
   * @access Private
   */
  router.get('/health',
    rateLimitMiddleware(100, 60),
    aiController.getHealthStatus.bind(aiController)
  );

  /**
   * @route GET /api/ai/metrics
   * @desc Get AI service metrics
   * @access Private (Admin only)
   */
  router.get('/metrics',
    rateLimitMiddleware(30, 60), // 30 requests per minute
    (req, res, next) => {
      if (!req.user?.roles?.includes('admin')) {
        res.status(403).json({
          success: false,
          error: {
            code: 'INSUFFICIENT_PRIVILEGES',
            message: 'Admin privileges required'
          }
        });
        return;
      }
      next();
    },
    aiController.getMetrics.bind(aiController)
  );

  /**
   * @route POST /api/ai/threat-intelligence/update
   * @desc Trigger manual threat intelligence update
   * @access Private (Admin only)
   */
  router.post('/threat-intelligence/update',
    rateLimitMiddleware(5, 300), // 5 requests per 5 minutes
    (req, res, next) => {
      if (!req.user?.roles?.includes('admin')) {
        res.status(403).json({
          success: false,
          error: {
            code: 'INSUFFICIENT_PRIVILEGES',
            message: 'Admin privileges required'
          }
        });
        return;
      }
      next();
    },
    aiController.updateThreatIntelligence.bind(aiController)
  );

  /**
   * @route GET /api/ai/threat-intelligence/stats
   * @desc Get threat intelligence statistics
   * @access Private
   */
  router.get('/threat-intelligence/stats',
    rateLimitMiddleware(50, 60),
    aiController.getThreatIntelligenceStats.bind(aiController)
  );

  return router;
}