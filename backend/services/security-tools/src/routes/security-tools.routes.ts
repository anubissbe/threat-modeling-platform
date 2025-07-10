import { Router } from 'express';
import { SecurityToolsController } from '../controllers/security-tools.controller';
import { authenticate, authorize, checkIntegrationAccess, rateLimitSecurityOps } from '../middleware/auth.middleware';
import { 
  validate, 
  validateQuery, 
  validateParams,
  validateIntegrationPlatform,
  validateCredentials,
  sanitizeOutput
} from '../middleware/validation.middleware';
import {
  CreateIntegrationRequestSchema,
  UpdateIntegrationRequestSchema,
  TestConnectionRequestSchema,
  SyncRequestSchema,
  CorrelateEventsRequestSchema,
  CreateTicketRequestSchema,
  DashboardQuerySchema,
  CreateCorrelationEngineSchema
} from '../validation/security-tools.validation';

const router = Router();
const controller = new SecurityToolsController();

// Apply common middleware
router.use(authenticate);
router.use(sanitizeOutput);

// Integration management routes
router.post(
  '/integrations',
  authorize(['admin', 'security_analyst']),
  validate(CreateIntegrationRequestSchema),
  validateIntegrationPlatform,
  validateCredentials,
  rateLimitSecurityOps(10, 60), // 10 per hour
  controller.createIntegration
);

router.get(
  '/integrations',
  authorize(['admin', 'security_analyst', 'architect', 'developer']),
  controller.listIntegrations
);

router.get(
  '/integrations/:integrationId',
  authorize(['admin', 'security_analyst', 'architect', 'developer']),
  checkIntegrationAccess,
  controller.getIntegration
);

router.put(
  '/integrations/:integrationId',
  authorize(['admin', 'security_analyst']),
  checkIntegrationAccess,
  validate(UpdateIntegrationRequestSchema),
  validateIntegrationPlatform,
  validateCredentials,
  controller.updateIntegration
);

router.delete(
  '/integrations/:integrationId',
  authorize(['admin']),
  checkIntegrationAccess,
  controller.deleteIntegration
);

router.post(
  '/integrations/:integrationId/test',
  authorize(['admin', 'security_analyst']),
  checkIntegrationAccess,
  controller.testIntegrationConnection
);

// Connection testing (without creating integration)
router.post(
  '/test-connection',
  authorize(['admin', 'security_analyst']),
  validate(TestConnectionRequestSchema),
  validateIntegrationPlatform,
  validateCredentials,
  rateLimitSecurityOps(20, 60), // 20 per hour
  controller.testConnection
);

// Sync operations
router.post(
  '/sync',
  authorize(['admin', 'security_analyst']),
  validate(SyncRequestSchema),
  checkIntegrationAccess,
  rateLimitSecurityOps(60, 60), // 60 per hour
  controller.syncIntegration
);

router.get(
  '/sync/status/:integrationId',
  authorize(['admin', 'security_analyst', 'architect']),
  checkIntegrationAccess,
  controller.getSyncStatus
);

// Correlation operations
router.post(
  '/correlate',
  authorize(['admin', 'security_analyst']),
  validate(CorrelateEventsRequestSchema),
  rateLimitSecurityOps(100, 60), // 100 per hour
  controller.correlateEvents
);

router.get(
  '/correlation-engines',
  authorize(['admin', 'security_analyst']),
  controller.listCorrelationEngines
);

router.post(
  '/correlation-engines',
  authorize(['admin']),
  validate(CreateCorrelationEngineSchema),
  controller.createCorrelationEngine
);

router.put(
  '/correlation-engines/:engineId',
  authorize(['admin']),
  validate(CreateCorrelationEngineSchema),
  controller.updateCorrelationEngine
);

router.delete(
  '/correlation-engines/:engineId',
  authorize(['admin']),
  controller.deleteCorrelationEngine
);

// Threat management
router.get(
  '/threats',
  authorize(['admin', 'security_analyst', 'architect', 'developer']),
  validateQuery(DashboardQuerySchema),
  controller.listThreats
);

router.get(
  '/threats/:threatId',
  authorize(['admin', 'security_analyst', 'architect', 'developer']),
  controller.getThreat
);

router.put(
  '/threats/:threatId',
  authorize(['admin', 'security_analyst']),
  controller.updateThreat
);

router.post(
  '/threats/:threatId/actions',
  authorize(['admin', 'security_analyst']),
  controller.executeThreatAction
);

// Vulnerability management
router.get(
  '/vulnerabilities',
  authorize(['admin', 'security_analyst', 'architect', 'developer']),
  validateQuery(DashboardQuerySchema),
  controller.listVulnerabilities
);

router.get(
  '/vulnerabilities/:vulnerabilityId',
  authorize(['admin', 'security_analyst', 'architect', 'developer']),
  controller.getVulnerability
);

router.put(
  '/vulnerabilities/:vulnerabilityId',
  authorize(['admin', 'security_analyst']),
  controller.updateVulnerability
);

// Cloud security findings
router.get(
  '/findings',
  authorize(['admin', 'security_analyst', 'architect', 'developer']),
  validateQuery(DashboardQuerySchema),
  controller.listFindings
);

router.get(
  '/findings/:findingId',
  authorize(['admin', 'security_analyst', 'architect', 'developer']),
  controller.getFinding
);

router.put(
  '/findings/:findingId',
  authorize(['admin', 'security_analyst']),
  controller.updateFinding
);

// Ticketing operations
router.post(
  '/tickets',
  authorize(['admin', 'security_analyst']),
  validate(CreateTicketRequestSchema),
  checkIntegrationAccess,
  rateLimitSecurityOps(50, 60), // 50 per hour
  controller.createTicket
);

router.get(
  '/tickets',
  authorize(['admin', 'security_analyst', 'architect', 'developer']),
  controller.listTickets
);

router.get(
  '/tickets/:ticketId',
  authorize(['admin', 'security_analyst', 'architect', 'developer']),
  controller.getTicket
);

router.put(
  '/tickets/:ticketId',
  authorize(['admin', 'security_analyst']),
  controller.updateTicket
);

router.post(
  '/tickets/:ticketId/comments',
  authorize(['admin', 'security_analyst', 'architect', 'developer']),
  controller.addTicketComment
);

// Dashboard and reporting
router.get(
  '/dashboard',
  authorize(['admin', 'security_analyst', 'architect']),
  validateQuery(DashboardQuerySchema),
  controller.getSecurityDashboard
);

router.get(
  '/metrics',
  authorize(['admin', 'security_analyst', 'architect']),
  validateQuery(DashboardQuerySchema),
  controller.getMetrics
);

router.post(
  '/reports/generate',
  authorize(['admin', 'security_analyst']),
  controller.generateReport
);

router.get(
  '/reports/:reportId',
  authorize(['admin', 'security_analyst', 'architect']),
  controller.getReport
);

router.get(
  '/reports/:reportId/download',
  authorize(['admin', 'security_analyst', 'architect']),
  controller.downloadReport
);

// Webhook management
router.get(
  '/webhooks',
  authorize(['admin']),
  controller.listWebhooks
);

router.post(
  '/webhooks',
  authorize(['admin']),
  controller.createWebhook
);

router.put(
  '/webhooks/:webhookId',
  authorize(['admin']),
  controller.updateWebhook
);

router.delete(
  '/webhooks/:webhookId',
  authorize(['admin']),
  controller.deleteWebhook
);

router.post(
  '/webhooks/:webhookId/test',
  authorize(['admin']),
  controller.testWebhook
);

// Tool-specific routes
router.post(
  '/siem/:integrationId/search',
  authorize(['admin', 'security_analyst']),
  checkIntegrationAccess,
  controller.siemSearch
);

router.post(
  '/siem/:integrationId/alerts',
  authorize(['admin', 'security_analyst']),
  checkIntegrationAccess,
  controller.createSiemAlert
);

router.post(
  '/scanners/:integrationId/scan',
  authorize(['admin', 'security_analyst']),
  checkIntegrationAccess,
  controller.startVulnerabilityScan
);

router.get(
  '/scanners/:integrationId/scans/:scanId',
  authorize(['admin', 'security_analyst']),
  checkIntegrationAccess,
  controller.getScanStatus
);

router.post(
  '/cloud/:integrationId/remediate',
  authorize(['admin']),
  checkIntegrationAccess,
  controller.executeCloudRemediation
);

// Health check
router.get(
  '/health',
  (req, res) => {
    res.json({
      status: 'healthy',
      service: 'security-tools',
      timestamp: new Date().toISOString()
    });
  }
);

export default router;