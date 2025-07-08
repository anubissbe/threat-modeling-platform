import { Router, Request, Response } from 'express';
import { verifyWebhookSignature } from '../middleware/auth';
import { asyncHandler } from '../middleware/error-handler';
import { webhookRateLimiter } from '../middleware/rate-limiter';
import { pool } from '../config/database';
import { redisClient, CacheKeys } from '../config/redis';
import { IntegrationEventBus } from '../services/event-bus.service';
import { logger, logWebhookEvent } from '../utils/logger';
import { IntegrationProvider } from '../types/integration';

export function createWebhookRouter(eventBus: IntegrationEventBus): Router {
  const router = Router();

  // Webhook receiver endpoint
  router.post(
    '/:provider/:id',
    webhookRateLimiter,
    verifyWebhookSignature(async (req) => {
      // Get webhook secret from cache or database
      const cacheKey = CacheKeys.WEBHOOK_SECRET(req.params['provider'], req.params['id']);
      let secret = await redisClient.get(cacheKey);
      
      if (!secret) {
        // Query from database (stored encrypted in integration config)
        const result = await pool.query(
          'SELECT config FROM service_integrations WHERE id = $1',
          [req.params['id']]
        );
        
        if (result.rows.length > 0) {
          const config = result.rows[0].config;
          secret = config.webhookSecret;
          
          // Cache for future use
          if (secret) {
            await redisClient.setex(cacheKey, 3600, secret); // 1 hour cache
          }
        }
      }
      
      return secret;
    }),
    asyncHandler(async (req: Request, res: Response) => {
      const { provider, id: integrationId } = req.params;
      const payload = req.body;
      
      logWebhookEvent(provider, 'Webhook received', {
        integrationId,
        eventType: getEventType(provider, payload),
      });

      // Store webhook event
      const client = await pool.connect();
      try {
        const result = await client.query(
          `INSERT INTO webhook_events 
           (integration_id, provider, event_type, payload, signature)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id`,
          [
            integrationId,
            provider,
            getEventType(provider, payload),
            JSON.stringify(payload),
            req.headers['x-webhook-signature'] as string,
          ]
        );
        
        const webhookId = result.rows[0].id;
        
        // Publish event for async processing
        await eventBus.publishWebhookReceived({
          id: webhookId,
          integrationId,
          provider: provider as IntegrationProvider,
          eventType: getEventType(provider, payload),
          payload,
          processed: false,
          createdAt: new Date(),
        });
        
        // Process webhook asynchronously
        processWebhookAsync(webhookId, provider, integrationId, payload, eventBus);
        
        // Return immediate response
        res.json({
          success: true,
          message: 'Webhook received and queued for processing',
          webhookId,
        });
      } finally {
        client.release();
      }
    })
  );

  return router;
}

function getEventType(provider: string, payload: any): string {
  switch (provider) {
    case 'github':
      return payload.action ? `${payload.action}_${Object.keys(payload)[1]}` : 'unknown';
    
    case 'gitlab':
      return payload.object_kind || 'unknown';
    
    case 'jira':
      return payload.webhookEvent || 'unknown';
    
    case 'azure_devops':
      return payload.eventType || 'unknown';
    
    default:
      return 'unknown';
  }
}

async function processWebhookAsync(
  webhookId: string,
  provider: string,
  integrationId: string,
  payload: any,
  eventBus: IntegrationEventBus
): Promise<void> {
  try {
    logWebhookEvent(provider, 'Processing webhook', { webhookId, integrationId });
    
    // Process based on provider and event type
    switch (provider) {
      case 'github':
        await processGitHubWebhook(integrationId, payload);
        break;
      
      case 'gitlab':
        await processGitLabWebhook(integrationId, payload);
        break;
      
      case 'jira':
        await processJiraWebhook(integrationId, payload);
        break;
      
      case 'azure_devops':
        await processAzureDevOpsWebhook(integrationId, payload);
        break;
      
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
    
    // Mark webhook as processed
    await pool.query(
      'UPDATE webhook_events SET processed = true, processed_at = CURRENT_TIMESTAMP WHERE id = $1',
      [webhookId]
    );
    
    await eventBus.publishWebhookProcessed(webhookId, true);
    
    logWebhookEvent(provider, 'Webhook processed successfully', { webhookId });
  } catch (error: any) {
    logger.error('Failed to process webhook:', {
      webhookId,
      provider,
      integrationId,
      error: error.message,
    });
    
    // Update webhook with error
    await pool.query(
      `UPDATE webhook_events 
       SET processed = true, 
           processed_at = CURRENT_TIMESTAMP,
           error_message = $2
       WHERE id = $1`,
      [webhookId, error.message]
    );
    
    await eventBus.publishWebhookProcessed(webhookId, false, error.message);
  }
}

async function processGitHubWebhook(integrationId: string, payload: any): Promise<void> {
  const { action, issue, comment } = payload;
  
  if (issue) {
    // Handle issue events
    if (action === 'opened' || action === 'closed' || action === 'reopened') {
      // Update corresponding threat model status
      logger.info('GitHub issue event:', { action, issueNumber: issue.number });
      
      // Find mapping and update threat model
      const mapping = await pool.query(
        `SELECT threat_model_id FROM integration_mappings 
         WHERE integration_id = $1 AND external_id = $2`,
        [integrationId, issue.number.toString()]
      );
      
      if (mapping.rows.length > 0) {
        // TODO: Call threat model service to update status
        logger.info('Would update threat model:', {
          threatModelId: mapping.rows[0].threat_model_id,
          status: action === 'closed' ? 'resolved' : 'open',
        });
      }
    }
  }
  
  if (comment) {
    // Handle comment events
    logger.info('GitHub comment event:', { action, issueNumber: issue.number });
    // TODO: Add comment to threat model discussion
  }
}

async function processGitLabWebhook(_integrationId: string, payload: any): Promise<void> {
  const { object_kind, object_attributes } = payload;
  
  if (object_kind === 'issue') {
    logger.info('GitLab issue event:', object_attributes);
    // TODO: Process GitLab issue events
  } else if (object_kind === 'note') {
    logger.info('GitLab note event:', object_attributes);
    // TODO: Process GitLab note events
  }
}

async function processJiraWebhook(_integrationId: string, payload: any): Promise<void> {
  const { webhookEvent, issue } = payload;
  
  logger.info('Jira webhook event:', { webhookEvent, issueKey: issue?.key });
  // TODO: Process Jira events
}

async function processAzureDevOpsWebhook(_integrationId: string, payload: any): Promise<void> {
  const { eventType } = payload;
  
  logger.info('Azure DevOps webhook event:', { eventType });
  // TODO: Process Azure DevOps events
}