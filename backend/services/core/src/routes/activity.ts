import { Router, Request, Response, NextFunction } from 'express';
import { ActivityService } from '../services/activity.service';
import { ActivityType } from '../types/activity';
import { logger } from '../utils/logger';

const router = Router();
const activityService = new ActivityService();

// Helper function for async route handlers
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => 
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

// Get recent activities (for dashboard)
router.get('/recent',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const organizationId = req.user!.organization;
    const limit = parseInt(req.query.limit as string) || 20;
    
    const activities = await activityService.getRecentActivity(userId, organizationId, limit);
    
    return res.json({
      success: true,
      data: activities,
      total: activities.length
    });
  })
);

// Get all activities with filtering
router.get('/',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const organizationId = req.user!.organization;
    
    const filters = {
      type: req.query.type as ActivityType | undefined,
      entityType: req.query.entityType as string,
      entityId: req.query.entityId as string,
      userId: req.query.userId as string,
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
      limit: parseInt(req.query.limit as string) || 50,
      offset: parseInt(req.query.offset as string) || 0
    };
    
    const result = await activityService.getActivities(userId, organizationId, filters);
    
    return res.json({
      success: true,
      data: result.activities,
      total: result.total,
      limit: filters.limit,
      offset: filters.offset
    });
  })
);

// Get activity statistics
router.get('/statistics',
  asyncHandler(async (req: Request, res: Response) => {
    const organizationId = req.user!.organization;
    const days = parseInt(req.query.days as string) || 30;
    
    const statistics = await activityService.getActivityStatistics(organizationId, days);
    
    return res.json({
      success: true,
      data: statistics
    });
  })
);

// Create new activity (internal use)
router.post('/',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const organizationId = req.user!.organization;
    
    const {
      type,
      action,
      description,
      entityType,
      entityId,
      entityName,
      metadata
    } = req.body;
    
    if (!type || !action || !description || !entityType || !entityId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: type, action, description, entityType, entityId'
      });
    }
    
    const activity = await activityService.createActivity(userId, organizationId, {
      type,
      action,
      description,
      entityType,
      entityId,
      entityName,
      metadata,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    return res.status(201).json({
      success: true,
      data: activity,
      message: 'Activity logged successfully'
    });
  })
);

// Get activities by entity
router.get('/entity/:entityType/:entityId',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const organizationId = req.user!.organization;
    const { entityType, entityId } = req.params;
    const limit = parseInt(req.query.limit as string) || 20;
    
    const result = await activityService.getActivities(userId, organizationId, {
      entityType,
      entityId,
      limit
    });
    
    return res.json({
      success: true,
      data: result.activities,
      total: result.total
    });
  })
);

// Get activities by user
router.get('/user/:userId',
  asyncHandler(async (req: Request, res: Response) => {
    const currentUserId = req.user!.id;
    const organizationId = req.user!.organization;
    const { userId } = req.params;
    const limit = parseInt(req.query.limit as string) || 20;
    
    const result = await activityService.getActivities(currentUserId, organizationId, {
      userId,
      limit
    });
    
    return res.json({
      success: true,
      data: result.activities,
      total: result.total
    });
  })
);

// Cleanup old activities (admin only)
router.delete('/cleanup',
  asyncHandler(async (req: Request, res: Response) => {
    // Check if user has admin role
    if (req.user!.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }
    
    const daysToKeep = parseInt(req.query.daysToKeep as string) || 90;
    
    const deletedCount = await activityService.deleteOldActivities(daysToKeep);
    
    return res.json({
      success: true,
      data: {
        deletedCount,
        daysToKeep
      },
      message: `Deleted ${deletedCount} old activity logs`
    });
  })
);

export function createActivityRouter(): Router {
  return router;
}