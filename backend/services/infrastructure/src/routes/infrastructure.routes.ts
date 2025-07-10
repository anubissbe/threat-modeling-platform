import { Router } from 'express';
import { InfrastructureController } from '../controllers/infrastructure.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { rateLimitMiddleware } from '../middleware/rate-limit.middleware';
import { requestMiddleware } from '../middleware/request.middleware';
import {
  scaleRequestSchema,
  addServerSchema,
  setCacheValueSchema,
  maintenanceSchema
} from '../validation/infrastructure.validation';

const router = Router();

export function createInfrastructureRoutes(controller: InfrastructureController): Router {
  // Apply middleware to all routes
  router.use(requestMiddleware);
  router.use(authMiddleware);
  router.use(rateLimitMiddleware);

  // Health and monitoring routes
  router.get('/health', controller.getHealth.bind(controller));
  router.get('/dashboard', controller.getDashboard.bind(controller));

  // Cluster management routes
  router.get('/cluster/stats', controller.getClusterStats.bind(controller));
  
  // Load balancer routes
  router.get('/loadbalancer/stats', controller.getLoadBalancerStats.bind(controller));
  router.post('/loadbalancer/servers', 
    validateRequest(addServerSchema), 
    controller.addServer.bind(controller)
  );
  router.delete('/loadbalancer/servers/:serverId', controller.removeServer.bind(controller));
  router.put('/loadbalancer/servers/:serverId/maintenance', 
    validateRequest(maintenanceSchema), 
    controller.setServerMaintenance.bind(controller)
  );

  // Cache management routes
  router.get('/cache/stats', controller.getCacheStats.bind(controller));
  router.get('/cache/keys/:key', controller.getCacheValue.bind(controller));
  router.post('/cache/keys/:key', 
    validateRequest(setCacheValueSchema), 
    controller.setCacheValue.bind(controller)
  );
  router.delete('/cache/keys/:key', controller.deleteCacheValue.bind(controller));
  router.delete('/cache/clear', controller.clearCache.bind(controller));

  // Scaling routes
  router.get('/scaling/events', controller.getScalingEvents.bind(controller));
  router.post('/scaling/scale', 
    validateRequest(scaleRequestSchema), 
    controller.scaleInfrastructure.bind(controller)
  );

  // Alert and event routes
  router.get('/alerts', controller.getActiveAlerts.bind(controller));
  router.get('/events', controller.getEvents.bind(controller));

  return router;
}