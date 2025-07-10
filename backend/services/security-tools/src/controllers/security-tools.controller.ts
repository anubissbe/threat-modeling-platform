import { Request, Response } from 'express';
import { SecurityToolsService } from '../services/security-tools.service';
import { CorrelationService } from '../services/correlation.service';
import { asyncHandler } from '../middleware/error-handler';
import { 
  logApiRequest, 
  logApiResponse, 
  logSecurityEvent,
  auditLog 
} from '../utils/logger';

interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: string;
    organization: string;
  };
}

export class SecurityToolsController {
  private securityToolsService: SecurityToolsService;
  private correlationService: CorrelationService;

  constructor() {
    // These would be injected in production
    this.securityToolsService = new SecurityToolsService({
      redis: null as any, // Injected
      db: null as any, // Injected
      maxConcurrentSyncs: 3,
      correlationWindowMinutes: 15
    });

    this.correlationService = new CorrelationService({
      redis: null as any, // Injected
      db: null as any, // Injected
      correlationIntervalMs: 60000
    });

    // Set up event listeners
    this.setupEventListeners();
  }

  // Integration Management
  createIntegration = asyncHandler(async (req: AuthRequest, res: Response) => {
    const startTime = Date.now();
    logApiRequest('POST', '/integrations', req.user?.userId, { body: req.body });

    const integration = await this.securityToolsService.createIntegration(req.body);

    auditLog(
      'CREATE_INTEGRATION',
      req.user!.userId,
      'integration',
      integration.id,
      { type: integration.type, platform: integration.platform }
    );

    logApiResponse('POST', '/integrations', 201, Date.now() - startTime);
    res.status(201).json({
      success: true,
      data: integration
    });
  });

  listIntegrations = asyncHandler(async (req: AuthRequest, res: Response) => {
    const startTime = Date.now();
    logApiRequest('GET', '/integrations', req.user?.userId);

    const integrations = await this.securityToolsService.getAllIntegrations();

    logApiResponse('GET', '/integrations', 200, Date.now() - startTime);
    res.json({
      success: true,
      data: integrations,
      count: integrations.length
    });
  });

  getIntegration = asyncHandler(async (req: AuthRequest, res: Response) => {
    const startTime = Date.now();
    const { integrationId } = req.params;
    logApiRequest('GET', `/integrations/${integrationId}`, req.user?.userId);

    const integration = await this.securityToolsService.getIntegration(integrationId);
    
    if (!integration) {
      res.status(404).json({
        success: false,
        error: 'Integration not found'
      });
      return;
    }

    logApiResponse('GET', `/integrations/${integrationId}`, 200, Date.now() - startTime);
    res.json({
      success: true,
      data: integration
    });
  });

  updateIntegration = asyncHandler(async (req: AuthRequest, res: Response) => {
    const startTime = Date.now();
    const { integrationId } = req.params;
    logApiRequest('PUT', `/integrations/${integrationId}`, req.user?.userId, { body: req.body });

    const integration = await this.securityToolsService.updateIntegration(integrationId, req.body);

    auditLog(
      'UPDATE_INTEGRATION',
      req.user!.userId,
      'integration',
      integrationId,
      req.body
    );

    logApiResponse('PUT', `/integrations/${integrationId}`, 200, Date.now() - startTime);
    res.json({
      success: true,
      data: integration
    });
  });

  deleteIntegration = asyncHandler(async (req: AuthRequest, res: Response) => {
    const startTime = Date.now();
    const { integrationId } = req.params;
    logApiRequest('DELETE', `/integrations/${integrationId}`, req.user?.userId);

    await this.securityToolsService.deleteIntegration(integrationId);

    auditLog(
      'DELETE_INTEGRATION',
      req.user!.userId,
      'integration',
      integrationId
    );

    logApiResponse('DELETE', `/integrations/${integrationId}`, 204, Date.now() - startTime);
    res.status(204).send();
  });

  testIntegrationConnection = asyncHandler(async (req: AuthRequest, res: Response) => {
    const startTime = Date.now();
    const { integrationId } = req.params;
    logApiRequest('POST', `/integrations/${integrationId}/test`, req.user?.userId);

    const integration = await this.securityToolsService.getIntegration(integrationId);
    if (!integration) {
      res.status(404).json({
        success: false,
        error: 'Integration not found'
      });
      return;
    }

    const result = await this.securityToolsService.testConnection({
      type: integration.type,
      platform: integration.platform,
      connectionConfig: integration.connectionConfig
    });

    logApiResponse('POST', `/integrations/${integrationId}/test`, 200, Date.now() - startTime);
    res.json({
      success: true,
      data: {
        connected: result,
        timestamp: new Date()
      }
    });
  });

  testConnection = asyncHandler(async (req: AuthRequest, res: Response) => {
    const startTime = Date.now();
    logApiRequest('POST', '/test-connection', req.user?.userId);

    const result = await this.securityToolsService.testConnection(req.body);

    logApiResponse('POST', '/test-connection', 200, Date.now() - startTime);
    res.json({
      success: true,
      data: {
        connected: result,
        timestamp: new Date()
      }
    });
  });

  // Sync Operations
  syncIntegration = asyncHandler(async (req: AuthRequest, res: Response) => {
    const startTime = Date.now();
    logApiRequest('POST', '/sync', req.user?.userId, { body: req.body });

    await this.securityToolsService.syncIntegration(req.body);

    logSecurityEvent('SYNC_INITIATED', {
      integrationId: req.body.integrationId,
      userId: req.user?.userId
    });

    logApiResponse('POST', '/sync', 202, Date.now() - startTime);
    res.status(202).json({
      success: true,
      message: 'Sync initiated',
      data: {
        integrationId: req.body.integrationId,
        status: 'in_progress'
      }
    });
  });

  getSyncStatus = asyncHandler(async (req: AuthRequest, res: Response) => {
    const startTime = Date.now();
    const { integrationId } = req.params;
    logApiRequest('GET', `/sync/status/${integrationId}`, req.user?.userId);

    const integration = await this.securityToolsService.getIntegration(integrationId);
    if (!integration) {
      res.status(404).json({
        success: false,
        error: 'Integration not found'
      });
      return;
    }

    const status = {
      integrationId,
      lastSync: integration.lastSync,
      status: integration.status,
      syncEnabled: integration.syncEnabled,
      nextSync: integration.syncInterval 
        ? new Date(Date.now() + integration.syncInterval * 60000)
        : null
    };

    logApiResponse('GET', `/sync/status/${integrationId}`, 200, Date.now() - startTime);
    res.json({
      success: true,
      data: status
    });
  });

  // Correlation Operations
  correlateEvents = asyncHandler(async (req: AuthRequest, res: Response) => {
    const startTime = Date.now();
    logApiRequest('POST', '/correlate', req.user?.userId, { body: req.body });

    const threats = await this.securityToolsService.correlateEvents(req.body);

    logSecurityEvent('CORRELATION_COMPLETED', {
      userId: req.user?.userId,
      threatsFound: threats.length,
      timeRange: req.body.timeRange
    });

    logApiResponse('POST', '/correlate', 200, Date.now() - startTime);
    res.json({
      success: true,
      data: threats,
      count: threats.length
    });
  });

  listCorrelationEngines = asyncHandler(async (req: AuthRequest, res: Response) => {
    const startTime = Date.now();
    logApiRequest('GET', '/correlation-engines', req.user?.userId);

    const engines = await this.correlationService.listEngines();

    logApiResponse('GET', '/correlation-engines', 200, Date.now() - startTime);
    res.json({
      success: true,
      data: engines,
      count: engines.length
    });
  });

  createCorrelationEngine = asyncHandler(async (req: AuthRequest, res: Response) => {
    const startTime = Date.now();
    logApiRequest('POST', '/correlation-engines', req.user?.userId, { body: req.body });

    const engine = await this.correlationService.createCorrelationEngine(req.body);

    auditLog(
      'CREATE_CORRELATION_ENGINE',
      req.user!.userId,
      'correlation-engine',
      engine.id,
      { name: engine.name }
    );

    logApiResponse('POST', '/correlation-engines', 201, Date.now() - startTime);
    res.status(201).json({
      success: true,
      data: engine
    });
  });

  updateCorrelationEngine = asyncHandler(async (req: AuthRequest, res: Response) => {
    const startTime = Date.now();
    const { engineId } = req.params;
    logApiRequest('PUT', `/correlation-engines/${engineId}`, req.user?.userId, { body: req.body });

    const engine = await this.correlationService.updateCorrelationEngine(engineId, req.body);

    auditLog(
      'UPDATE_CORRELATION_ENGINE',
      req.user!.userId,
      'correlation-engine',
      engineId,
      req.body
    );

    logApiResponse('PUT', `/correlation-engines/${engineId}`, 200, Date.now() - startTime);
    res.json({
      success: true,
      data: engine
    });
  });

  deleteCorrelationEngine = asyncHandler(async (req: AuthRequest, res: Response) => {
    const startTime = Date.now();
    const { engineId } = req.params;
    logApiRequest('DELETE', `/correlation-engines/${engineId}`, req.user?.userId);

    await this.correlationService.deleteCorrelationEngine(engineId);

    auditLog(
      'DELETE_CORRELATION_ENGINE',
      req.user!.userId,
      'correlation-engine',
      engineId
    );

    logApiResponse('DELETE', `/correlation-engines/${engineId}`, 204, Date.now() - startTime);
    res.status(204).send();
  });

  // Threat Management
  listThreats = asyncHandler(async (req: AuthRequest, res: Response) => {
    const startTime = Date.now();
    logApiRequest('GET', '/threats', req.user?.userId, { query: req.query });

    const threats = await this.securityToolsService.getTopThreats(
      req.query.limit ? parseInt(req.query.limit as string) : 100
    );

    logApiResponse('GET', '/threats', 200, Date.now() - startTime);
    res.json({
      success: true,
      data: threats,
      count: threats.length
    });
  });

  getThreat = asyncHandler(async (req: AuthRequest, res: Response) => {
    const startTime = Date.now();
    const { threatId } = req.params;
    logApiRequest('GET', `/threats/${threatId}`, req.user?.userId);

    const threat = await this.securityToolsService.getThreat(threatId);
    
    if (!threat) {
      res.status(404).json({
        success: false,
        error: 'Threat not found'
      });
      return;
    }

    logApiResponse('GET', `/threats/${threatId}`, 200, Date.now() - startTime);
    res.json({
      success: true,
      data: threat
    });
  });

  updateThreat = asyncHandler(async (req: AuthRequest, res: Response) => {
    const startTime = Date.now();
    const { threatId } = req.params;
    logApiRequest('PUT', `/threats/${threatId}`, req.user?.userId, { body: req.body });

    const threat = await this.securityToolsService.updateThreat(threatId, req.body);

    auditLog(
      'UPDATE_THREAT',
      req.user!.userId,
      'threat',
      threatId,
      req.body
    );

    logApiResponse('PUT', `/threats/${threatId}`, 200, Date.now() - startTime);
    res.json({
      success: true,
      data: threat
    });
  });

  executeThreatAction = asyncHandler(async (req: AuthRequest, res: Response) => {
    const startTime = Date.now();
    const { threatId } = req.params;
    const { action, parameters } = req.body;
    logApiRequest('POST', `/threats/${threatId}/actions`, req.user?.userId, { body: req.body });

    await this.securityToolsService.executeThreatAction(threatId, action, parameters);

    auditLog(
      'EXECUTE_THREAT_ACTION',
      req.user!.userId,
      'threat',
      threatId,
      { action, parameters }
    );

    logApiResponse('POST', `/threats/${threatId}/actions`, 200, Date.now() - startTime);
    res.json({
      success: true,
      message: `Action ${action} executed successfully`
    });
  });

  // Vulnerability Management
  listVulnerabilities = asyncHandler(async (req: AuthRequest, res: Response) => {
    const startTime = Date.now();
    logApiRequest('GET', '/vulnerabilities', req.user?.userId, { query: req.query });

    const vulnerabilities = await this.securityToolsService.getTopVulnerabilities(
      req.query.limit ? parseInt(req.query.limit as string) : 100
    );

    logApiResponse('GET', '/vulnerabilities', 200, Date.now() - startTime);
    res.json({
      success: true,
      data: vulnerabilities,
      count: vulnerabilities.length
    });
  });

  getVulnerability = asyncHandler(async (req: AuthRequest, res: Response) => {
    const startTime = Date.now();
    const { vulnerabilityId } = req.params;
    logApiRequest('GET', `/vulnerabilities/${vulnerabilityId}`, req.user?.userId);

    const vulnerability = await this.securityToolsService.getVulnerability(vulnerabilityId);
    
    if (!vulnerability) {
      res.status(404).json({
        success: false,
        error: 'Vulnerability not found'
      });
      return;
    }

    logApiResponse('GET', `/vulnerabilities/${vulnerabilityId}`, 200, Date.now() - startTime);
    res.json({
      success: true,
      data: vulnerability
    });
  });

  updateVulnerability = asyncHandler(async (req: AuthRequest, res: Response) => {
    const startTime = Date.now();
    const { vulnerabilityId } = req.params;
    logApiRequest('PUT', `/vulnerabilities/${vulnerabilityId}`, req.user?.userId, { body: req.body });

    const vulnerability = await this.securityToolsService.updateVulnerability(vulnerabilityId, req.body);

    auditLog(
      'UPDATE_VULNERABILITY',
      req.user!.userId,
      'vulnerability',
      vulnerabilityId,
      req.body
    );

    logApiResponse('PUT', `/vulnerabilities/${vulnerabilityId}`, 200, Date.now() - startTime);
    res.json({
      success: true,
      data: vulnerability
    });
  });

  // Cloud Security Findings
  listFindings = asyncHandler(async (req: AuthRequest, res: Response) => {
    const startTime = Date.now();
    logApiRequest('GET', '/findings', req.user?.userId, { query: req.query });

    const findings = await this.securityToolsService.getCriticalFindings(
      req.query.limit ? parseInt(req.query.limit as string) : 100
    );

    logApiResponse('GET', '/findings', 200, Date.now() - startTime);
    res.json({
      success: true,
      data: findings,
      count: findings.length
    });
  });

  getFinding = asyncHandler(async (req: AuthRequest, res: Response) => {
    const startTime = Date.now();
    const { findingId } = req.params;
    logApiRequest('GET', `/findings/${findingId}`, req.user?.userId);

    const finding = await this.securityToolsService.getFinding(findingId);
    
    if (!finding) {
      res.status(404).json({
        success: false,
        error: 'Finding not found'
      });
      return;
    }

    logApiResponse('GET', `/findings/${findingId}`, 200, Date.now() - startTime);
    res.json({
      success: true,
      data: finding
    });
  });

  updateFinding = asyncHandler(async (req: AuthRequest, res: Response) => {
    const startTime = Date.now();
    const { findingId } = req.params;
    logApiRequest('PUT', `/findings/${findingId}`, req.user?.userId, { body: req.body });

    const finding = await this.securityToolsService.updateFinding(findingId, req.body);

    auditLog(
      'UPDATE_FINDING',
      req.user!.userId,
      'finding',
      findingId,
      req.body
    );

    logApiResponse('PUT', `/findings/${findingId}`, 200, Date.now() - startTime);
    res.json({
      success: true,
      data: finding
    });
  });

  // Ticketing Operations
  createTicket = asyncHandler(async (req: AuthRequest, res: Response) => {
    const startTime = Date.now();
    logApiRequest('POST', '/tickets', req.user?.userId, { body: req.body });

    const ticket = await this.securityToolsService.createTicket(req.body);

    logSecurityEvent('TICKET_CREATED', {
      ticketId: ticket.id,
      userId: req.user?.userId,
      linkedItems: {
        threats: req.body.threatId ? [req.body.threatId] : [],
        vulnerabilities: req.body.vulnerabilityId ? [req.body.vulnerabilityId] : [],
        findings: req.body.findingId ? [req.body.findingId] : []
      }
    });

    logApiResponse('POST', '/tickets', 201, Date.now() - startTime);
    res.status(201).json({
      success: true,
      data: ticket
    });
  });

  listTickets = asyncHandler(async (req: AuthRequest, res: Response) => {
    const startTime = Date.now();
    logApiRequest('GET', '/tickets', req.user?.userId, { query: req.query });

    const tickets = await this.securityToolsService.listTickets(req.query);

    logApiResponse('GET', '/tickets', 200, Date.now() - startTime);
    res.json({
      success: true,
      data: tickets,
      count: tickets.length
    });
  });

  getTicket = asyncHandler(async (req: AuthRequest, res: Response) => {
    const startTime = Date.now();
    const { ticketId } = req.params;
    logApiRequest('GET', `/tickets/${ticketId}`, req.user?.userId);

    const ticket = await this.securityToolsService.getTicket(ticketId);
    
    if (!ticket) {
      res.status(404).json({
        success: false,
        error: 'Ticket not found'
      });
      return;
    }

    logApiResponse('GET', `/tickets/${ticketId}`, 200, Date.now() - startTime);
    res.json({
      success: true,
      data: ticket
    });
  });

  updateTicket = asyncHandler(async (req: AuthRequest, res: Response) => {
    const startTime = Date.now();
    const { ticketId } = req.params;
    logApiRequest('PUT', `/tickets/${ticketId}`, req.user?.userId, { body: req.body });

    const ticket = await this.securityToolsService.updateTicket(ticketId, req.body);

    auditLog(
      'UPDATE_TICKET',
      req.user!.userId,
      'ticket',
      ticketId,
      req.body
    );

    logApiResponse('PUT', `/tickets/${ticketId}`, 200, Date.now() - startTime);
    res.json({
      success: true,
      data: ticket
    });
  });

  addTicketComment = asyncHandler(async (req: AuthRequest, res: Response) => {
    const startTime = Date.now();
    const { ticketId } = req.params;
    const { comment, internal } = req.body;
    logApiRequest('POST', `/tickets/${ticketId}/comments`, req.user?.userId, { body: req.body });

    await this.securityToolsService.addTicketComment(ticketId, {
      author: req.user!.email,
      body: comment,
      internal: internal || false
    });

    logApiResponse('POST', `/tickets/${ticketId}/comments`, 201, Date.now() - startTime);
    res.status(201).json({
      success: true,
      message: 'Comment added successfully'
    });
  });

  // Dashboard and Reporting
  getSecurityDashboard = asyncHandler(async (req: AuthRequest, res: Response) => {
    const startTime = Date.now();
    logApiRequest('GET', '/dashboard', req.user?.userId, { query: req.query });

    const dashboard = await this.securityToolsService.getSecurityPostureDashboard();

    logApiResponse('GET', '/dashboard', 200, Date.now() - startTime);
    res.json({
      success: true,
      data: dashboard
    });
  });

  getMetrics = asyncHandler(async (req: AuthRequest, res: Response) => {
    const startTime = Date.now();
    logApiRequest('GET', '/metrics', req.user?.userId, { query: req.query });

    const metrics = await this.securityToolsService.getMetrics(req.query);

    logApiResponse('GET', '/metrics', 200, Date.now() - startTime);
    res.json({
      success: true,
      data: metrics
    });
  });

  generateReport = asyncHandler(async (req: AuthRequest, res: Response) => {
    const startTime = Date.now();
    logApiRequest('POST', '/reports/generate', req.user?.userId, { body: req.body });

    const report = await this.securityToolsService.generateReport(req.body);

    auditLog(
      'GENERATE_REPORT',
      req.user!.userId,
      'report',
      report.id,
      { type: req.body.type, format: req.body.format }
    );

    logApiResponse('POST', '/reports/generate', 202, Date.now() - startTime);
    res.status(202).json({
      success: true,
      data: {
        reportId: report.id,
        status: 'generating'
      }
    });
  });

  getReport = asyncHandler(async (req: AuthRequest, res: Response) => {
    const startTime = Date.now();
    const { reportId } = req.params;
    logApiRequest('GET', `/reports/${reportId}`, req.user?.userId);

    const report = await this.securityToolsService.getReport(reportId);
    
    if (!report) {
      res.status(404).json({
        success: false,
        error: 'Report not found'
      });
      return;
    }

    logApiResponse('GET', `/reports/${reportId}`, 200, Date.now() - startTime);
    res.json({
      success: true,
      data: report
    });
  });

  downloadReport = asyncHandler(async (req: AuthRequest, res: Response) => {
    const startTime = Date.now();
    const { reportId } = req.params;
    logApiRequest('GET', `/reports/${reportId}/download`, req.user?.userId);

    const report = await this.securityToolsService.getReport(reportId);
    
    if (!report || !report.filePath) {
      res.status(404).json({
        success: false,
        error: 'Report file not found'
      });
      return;
    }

    // In production, this would stream the file from storage
    logApiResponse('GET', `/reports/${reportId}/download`, 200, Date.now() - startTime);
    res.download(report.filePath);
  });

  // Webhook Management
  listWebhooks = asyncHandler(async (req: AuthRequest, res: Response) => {
    const startTime = Date.now();
    logApiRequest('GET', '/webhooks', req.user?.userId);

    const webhooks = await this.securityToolsService.listWebhooks();

    logApiResponse('GET', '/webhooks', 200, Date.now() - startTime);
    res.json({
      success: true,
      data: webhooks,
      count: webhooks.length
    });
  });

  createWebhook = asyncHandler(async (req: AuthRequest, res: Response) => {
    const startTime = Date.now();
    logApiRequest('POST', '/webhooks', req.user?.userId, { body: req.body });

    const webhook = await this.securityToolsService.createWebhook(req.body);

    auditLog(
      'CREATE_WEBHOOK',
      req.user!.userId,
      'webhook',
      webhook.id,
      { url: req.body.url, events: req.body.events }
    );

    logApiResponse('POST', '/webhooks', 201, Date.now() - startTime);
    res.status(201).json({
      success: true,
      data: webhook
    });
  });

  updateWebhook = asyncHandler(async (req: AuthRequest, res: Response) => {
    const startTime = Date.now();
    const { webhookId } = req.params;
    logApiRequest('PUT', `/webhooks/${webhookId}`, req.user?.userId, { body: req.body });

    const webhook = await this.securityToolsService.updateWebhook(webhookId, req.body);

    auditLog(
      'UPDATE_WEBHOOK',
      req.user!.userId,
      'webhook',
      webhookId,
      req.body
    );

    logApiResponse('PUT', `/webhooks/${webhookId}`, 200, Date.now() - startTime);
    res.json({
      success: true,
      data: webhook
    });
  });

  deleteWebhook = asyncHandler(async (req: AuthRequest, res: Response) => {
    const startTime = Date.now();
    const { webhookId } = req.params;
    logApiRequest('DELETE', `/webhooks/${webhookId}`, req.user?.userId);

    await this.securityToolsService.deleteWebhook(webhookId);

    auditLog(
      'DELETE_WEBHOOK',
      req.user!.userId,
      'webhook',
      webhookId
    );

    logApiResponse('DELETE', `/webhooks/${webhookId}`, 204, Date.now() - startTime);
    res.status(204).send();
  });

  testWebhook = asyncHandler(async (req: AuthRequest, res: Response) => {
    const startTime = Date.now();
    const { webhookId } = req.params;
    logApiRequest('POST', `/webhooks/${webhookId}/test`, req.user?.userId);

    await this.securityToolsService.testWebhook(webhookId);

    logApiResponse('POST', `/webhooks/${webhookId}/test`, 200, Date.now() - startTime);
    res.json({
      success: true,
      message: 'Test event sent successfully'
    });
  });

  // Tool-specific operations
  siemSearch = asyncHandler(async (req: AuthRequest, res: Response) => {
    const startTime = Date.now();
    const { integrationId } = req.params;
    logApiRequest('POST', `/siem/${integrationId}/search`, req.user?.userId, { body: req.body });

    const results = await this.securityToolsService.siemSearch(integrationId, req.body);

    logApiResponse('POST', `/siem/${integrationId}/search`, 200, Date.now() - startTime);
    res.json({
      success: true,
      data: results
    });
  });

  createSiemAlert = asyncHandler(async (req: AuthRequest, res: Response) => {
    const startTime = Date.now();
    const { integrationId } = req.params;
    logApiRequest('POST', `/siem/${integrationId}/alerts`, req.user?.userId, { body: req.body });

    const alert = await this.securityToolsService.createSiemAlert(integrationId, req.body);

    logSecurityEvent('SIEM_ALERT_CREATED', {
      integrationId,
      alertName: req.body.name,
      userId: req.user?.userId
    });

    logApiResponse('POST', `/siem/${integrationId}/alerts`, 201, Date.now() - startTime);
    res.status(201).json({
      success: true,
      data: alert
    });
  });

  startVulnerabilityScan = asyncHandler(async (req: AuthRequest, res: Response) => {
    const startTime = Date.now();
    const { integrationId } = req.params;
    logApiRequest('POST', `/scanners/${integrationId}/scan`, req.user?.userId, { body: req.body });

    const scan = await this.securityToolsService.startVulnerabilityScan(integrationId, req.body);

    logSecurityEvent('VULNERABILITY_SCAN_STARTED', {
      integrationId,
      scanId: scan.id,
      userId: req.user?.userId
    });

    logApiResponse('POST', `/scanners/${integrationId}/scan`, 202, Date.now() - startTime);
    res.status(202).json({
      success: true,
      data: scan
    });
  });

  getScanStatus = asyncHandler(async (req: AuthRequest, res: Response) => {
    const startTime = Date.now();
    const { integrationId, scanId } = req.params;
    logApiRequest('GET', `/scanners/${integrationId}/scans/${scanId}`, req.user?.userId);

    const status = await this.securityToolsService.getScanStatus(integrationId, scanId);

    logApiResponse('GET', `/scanners/${integrationId}/scans/${scanId}`, 200, Date.now() - startTime);
    res.json({
      success: true,
      data: status
    });
  });

  executeCloudRemediation = asyncHandler(async (req: AuthRequest, res: Response) => {
    const startTime = Date.now();
    const { integrationId } = req.params;
    logApiRequest('POST', `/cloud/${integrationId}/remediate`, req.user?.userId, { body: req.body });

    const result = await this.securityToolsService.executeCloudRemediation(integrationId, req.body);

    logSecurityEvent('CLOUD_REMEDIATION_EXECUTED', {
      integrationId,
      findingId: req.body.findingId,
      action: req.body.action,
      userId: req.user?.userId
    });

    auditLog(
      'EXECUTE_CLOUD_REMEDIATION',
      req.user!.userId,
      'cloud-remediation',
      req.body.findingId,
      { action: req.body.action, integrationId }
    );

    logApiResponse('POST', `/cloud/${integrationId}/remediate`, 200, Date.now() - startTime);
    res.json({
      success: true,
      data: result
    });
  });

  // Private methods
  private setupEventListeners(): void {
    // Listen to security events from services
    this.securityToolsService.on('threat.correlated', (threat) => {
      logSecurityEvent('THREAT_CORRELATED', threat);
    });

    this.correlationService.on('threat.created', (threat) => {
      logSecurityEvent('THREAT_CREATED', threat);
    });

    // Add more event listeners as needed
  }

  // Placeholder methods for service calls that would be implemented
  // These are referenced in the controller but implementation details would be in the service
}