import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../middleware/error-handler';
import { integrationApiRateLimiter, strictRateLimiter } from '../middleware/rate-limiter';
import { validateRequest } from '../middleware/validation';
import { 
  createIntegrationSchema, 
  updateIntegrationSchema,
  syncRequestSchema 
} from '../validation/integration.validation';
import { IntegrationService } from '../services/integration.service';
import { SyncService } from '../services/sync.service';
import { ConnectorFactory } from '../services/connector-factory';
import { IntegrationEventBus } from '../services/event-bus.service';
import { logger } from '../utils/logger';

export function createIntegrationRouter(eventBus: IntegrationEventBus): Router {
  const router = Router();
  const integrationService = new IntegrationService(eventBus);
  const syncService = new SyncService(eventBus);

  // List all integrations for the authenticated user
  router.get(
    '/',
    authenticate,
    asyncHandler(async (req: Request, res: Response) => {
      const integrations = await integrationService.listIntegrations(req.user!['id']);
      
      res.json({
        success: true,
        data: integrations,
      });
    })
  );

  // Get a specific integration
  router.get(
    '/:id',
    authenticate,
    asyncHandler(async (req: Request, res: Response) => {
      const integration = await integrationService.getIntegration(
        req.params['id'],
        req.user!['id']
      );
      
      res.json({
        success: true,
        data: integration,
      });
    })
  );

  // Get integration status
  router.get(
    '/:id/status',
    authenticate,
    asyncHandler(async (req: Request, res: Response) => {
      // Verify user has access
      await integrationService.getIntegration(req.params['id'], req.user!['id']);
      
      const status = await integrationService.getIntegrationStatus(req.params['id']);
      
      res.json({
        success: true,
        data: status,
      });
    })
  );

  // Test connection
  router.post(
    '/connect',
    authenticate,
    strictRateLimiter,
    validateRequest(createIntegrationSchema),
    asyncHandler(async (req: Request, res: Response) => {
      const { provider, config, credentials } = req.body;
      
      // Create temporary integration object for testing
      const tempIntegration = {
        id: 'test',
        provider,
        config,
        credentials: '', // Will use provided credentials directly
      } as any;

      const connector = ConnectorFactory.createConnector(tempIntegration, credentials);
      const result = await connector.testConnection();
      
      res.json({
        success: true,
        data: result,
      });
    })
  );

  // Create a new integration
  router.post(
    '/',
    authenticate,
    strictRateLimiter,
    validateRequest(createIntegrationSchema),
    asyncHandler(async (req: Request, res: Response) => {
      const integration = await integrationService.createIntegration(
        req.user!['id'],
        req.body
      );
      
      // Set up webhook if supported
      try {
        const credentials = await integrationService.decryptCredentials(integration);
        const connector = ConnectorFactory.createConnector(integration, credentials);
        
        if (connector.setupWebhook) {
          await connector.setupWebhook();
          // Store webhook secret in Redis or database
          logger.info('Webhook configured for integration', { integrationId: integration['id'] });
        }
      } catch (error) {
        logger.error('Failed to setup webhook:', error);
        // Don't fail the integration creation
      }
      
      res.status(201).json({
        success: true,
        data: integration,
      });
    })
  );

  // Update an integration
  router.put(
    '/:id',
    authenticate,
    integrationApiRateLimiter,
    validateRequest(updateIntegrationSchema),
    asyncHandler(async (req: Request, res: Response) => {
      const integration = await integrationService.updateIntegration(
        req.params['id'],
        req.user!['id'],
        req.body
      );
      
      res.json({
        success: true,
        data: integration,
      });
    })
  );

  // Delete an integration
  router.delete(
    '/:id',
    authenticate,
    strictRateLimiter,
    asyncHandler(async (req: Request, res: Response) => {
      // Remove webhook if exists
      try {
        const integration = await integrationService.getIntegration(
          req.params['id'],
          req.user!['id']
        );
        const credentials = await integrationService.decryptCredentials(integration);
        const connector = ConnectorFactory.createConnector(integration, credentials);
        
        if (connector.removeWebhook) {
          await connector.removeWebhook();
          logger.info('Webhook removed for integration', { integrationId: integration['id'] });
        }
      } catch (error) {
        logger.error('Failed to remove webhook:', error);
        // Don't fail the deletion
      }
      
      await integrationService.deleteIntegration(req.params['id'], req.user!['id']);
      
      res.json({
        success: true,
        message: 'Integration deleted successfully',
      });
    })
  );

  // Trigger manual sync
  router.post(
    '/:id/sync',
    authenticate,
    integrationApiRateLimiter,
    validateRequest(syncRequestSchema),
    asyncHandler(async (req: Request, res: Response) => {
      // Verify user has access
      await integrationService.getIntegration(req.params['id'], req.user!['id']);
      
      const result = await syncService.syncIntegration(req.params['id'], req.body);
      
      res.json({
        success: true,
        data: result,
      });
    })
  );

  return router;
}