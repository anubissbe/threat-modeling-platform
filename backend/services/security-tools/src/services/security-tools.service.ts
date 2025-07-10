import { EventEmitter } from 'events';
import Redis from 'ioredis';
import PQueue from 'p-queue';
import { v4 as uuidv4 } from 'uuid';
import { Pool } from 'pg';

import {
  SecurityToolIntegration,
  SecurityToolType,
  SyncFilter,
  UnifiedThreat,
  CorrelationEngine,
  CorrelationEngineRule,
  SecurityPostureDashboard,
  CreateIntegrationRequest,
  UpdateIntegrationRequest,
  TestConnectionRequest,
  SyncRequest,
  CorrelateEventsRequest,
  CreateTicketRequest,
  SecurityTicket,
  Vulnerability,
  CloudSecurityFinding,
  SeverityLevel
} from '../types/security-tools';

import { BaseSecurityToolAdapter } from '../adapters/base.adapter';
import { SplunkAdapter } from '../adapters/siem/splunk.adapter';
import { QRadarAdapter } from '../adapters/siem/qradar.adapter';
import { NessusAdapter } from '../adapters/vulnerability/nessus.adapter';
import { AWSSecurityHubAdapter } from '../adapters/cloud/aws-security-hub.adapter';
import { JiraAdapter } from '../adapters/ticketing/jira.adapter';

export class SecurityToolsService extends EventEmitter {
  private adapters: Map<string, BaseSecurityToolAdapter> = new Map();
  private redis: Redis;
  private db: Pool;
  private syncQueue: PQueue;
  private correlationEngine: CorrelationEngine | null = null;
  private correlationInterval: NodeJS.Timeout | null = null;

  constructor(config: {
    redis: Redis;
    db: Pool;
    maxConcurrentSyncs?: number;
    correlationWindowMinutes?: number;
  }) {
    super();
    this.redis = config.redis;
    this.db = config.db;
    this.syncQueue = new PQueue({ concurrency: config.maxConcurrentSyncs || 3 });
    
    // Initialize correlation engine
    this.initializeCorrelationEngine(config.correlationWindowMinutes || 15);
  }

  // Integration Management
  async createIntegration(request: CreateIntegrationRequest): Promise<SecurityToolIntegration> {
    const integration: SecurityToolIntegration = {
      id: uuidv4(),
      name: request.name,
      type: request.type,
      platform: request.platform,
      description: request.description || '',
      connectionConfig: {
        ...request.connectionConfig,
        credentials: await this.encryptCredentials(request.connectionConfig.credentials)
      },
      status: 'configuring',
      syncEnabled: request.syncConfig?.enabled || false,
      syncDirection: request.syncConfig?.direction || 'inbound',
      syncInterval: request.syncConfig?.interval || 60,
      syncFilter: request.syncConfig?.filter || {},
      fieldMappings: request.fieldMappings || [],
      severityMapping: request.severityMapping || this.getDefaultSeverityMapping(),
      features: this.getDefaultFeatures(request.type),
      createdBy: 'system', // Should come from auth context
      createdAt: new Date(),
      updatedAt: new Date(),
      version: '1.0.0'
    };

    // Save to database
    await this.saveIntegration(integration);

    // Create and initialize adapter
    const adapter = this.createAdapter(integration);
    this.adapters.set(integration.id, adapter);

    // Test connection
    try {
      await adapter.connect();
      integration.status = 'connected';
      integration.lastConnected = new Date();
      await this.updateIntegration(integration.id, { status: 'connected', lastConnected: new Date() });
    } catch (error) {
      integration.status = 'error';
      await this.updateIntegration(integration.id, { status: 'error' });
      throw error;
    }

    // Set up sync schedule if enabled
    if (integration.syncEnabled && integration.syncInterval) {
      await this.scheduleSyncs(integration);
    }

    return integration;
  }

  async updateIntegration(
    integrationId: string,
    updates: UpdateIntegrationRequest
  ): Promise<SecurityToolIntegration> {
    const integration = await this.getIntegration(integrationId);
    if (!integration) {
      throw new Error(`Integration ${integrationId} not found`);
    }

    // Update fields
    if (updates.name !== undefined) integration.name = updates.name;
    if (updates.description !== undefined) integration.description = updates.description;
    if (updates.syncEnabled !== undefined) integration.syncEnabled = updates.syncEnabled;
    if (updates.syncInterval !== undefined) integration.syncInterval = updates.syncInterval;
    if (updates.syncFilter !== undefined) integration.syncFilter = updates.syncFilter;
    if (updates.fieldMappings !== undefined) integration.fieldMappings = updates.fieldMappings;
    if (updates.severityMapping !== undefined) integration.severityMapping = updates.severityMapping;

    // Update connection config if provided
    if (updates.connectionConfig) {
      if (updates.connectionConfig.credentials) {
        updates.connectionConfig.credentials = await this.encryptCredentials(
          updates.connectionConfig.credentials
        );
      }
      integration.connectionConfig = {
        ...integration.connectionConfig,
        ...updates.connectionConfig
      };
    }

    integration.updatedAt = new Date();

    // Save to database
    await this.saveIntegration(integration);

    // Recreate adapter if connection config changed
    if (updates.connectionConfig) {
      const adapter = this.adapters.get(integrationId);
      if (adapter) {
        await adapter.disconnect();
      }
      const newAdapter = this.createAdapter(integration);
      this.adapters.set(integrationId, newAdapter);
      await newAdapter.connect();
    }

    // Update sync schedule
    if (updates.syncEnabled !== undefined || updates.syncInterval !== undefined) {
      await this.updateSyncSchedule(integration);
    }

    return integration;
  }

  async deleteIntegration(integrationId: string): Promise<void> {
    const adapter = this.adapters.get(integrationId);
    if (adapter) {
      await adapter.disconnect();
      this.adapters.delete(integrationId);
    }

    // Cancel sync schedule
    await this.cancelSyncSchedule(integrationId);

    // Delete from database
    await this.db.query('DELETE FROM security_tool_integrations WHERE id = $1', [integrationId]);
  }

  async testConnection(request: TestConnectionRequest): Promise<boolean> {
    // Create temporary integration for testing
    const tempIntegration: SecurityToolIntegration = {
      id: 'test-' + uuidv4(),
      name: 'Test Connection',
      type: request.type,
      platform: request.platform,
      connectionConfig: {
        ...request.connectionConfig,
        credentials: request.connectionConfig.credentials // Don't encrypt for test
      },
      status: 'configuring',
      syncEnabled: false,
      syncDirection: 'inbound',
      fieldMappings: [],
      severityMapping: this.getDefaultSeverityMapping(),
      features: this.getDefaultFeatures(request.type),
      createdBy: 'system',
      createdAt: new Date(),
      updatedAt: new Date(),
      version: '1.0.0'
    };

    const adapter = this.createAdapter(tempIntegration);
    
    try {
      await adapter.connect();
      const result = await adapter.testConnection();
      await adapter.disconnect();
      return result;
    } catch (error) {
      return false;
    }
  }

  // Sync Operations
  async syncIntegration(request: SyncRequest): Promise<void> {
    const integration = await this.getIntegration(request.integrationId);
    if (!integration) {
      throw new Error(`Integration ${request.integrationId} not found`);
    }

    const adapter = this.adapters.get(request.integrationId);
    if (!adapter) {
      throw new Error(`Adapter for integration ${request.integrationId} not found`);
    }

    // Create sync filter
    const filter: SyncFilter = {
      ...integration.syncFilter
    };

    if (request.startDate && request.endDate) {
      filter.timeRange = {
        start: new Date(request.startDate),
        end: new Date(request.endDate)
      };
    }

    // Queue sync operation
    await this.syncQueue.add(async () => {
      try {
        await adapter.sync(filter);
        integration.lastSync = new Date();
        integration.status = 'connected';
        await this.updateIntegration(integration.id, { lastSync: new Date(), status: 'connected' });
      } catch (error) {
        integration.status = 'error';
        await this.updateIntegration(integration.id, { status: 'error' });
        throw error;
      }
    });
  }

  // Event Correlation
  async correlateEvents(request: CorrelateEventsRequest): Promise<UnifiedThreat[]> {
    const threats: UnifiedThreat[] = [];
    
    // Get events from cache/buffer
    const events = await this.getEventsForCorrelation(request);
    
    // Apply correlation rules
    const rules = this.correlationEngine?.rules || [];
    const activeRules = rules.filter(rule => 
      rule.enabled && 
      (!request.correlationRules || request.correlationRules.includes(rule.id))
    );

    for (const rule of activeRules) {
      const correlatedEvents = this.applyCorrelationRule(rule, events);
      
      if (correlatedEvents.length > 0) {
        const threat = this.createUnifiedThreat(correlatedEvents, rule);
        threats.push(threat);
        
        // Execute rule actions
        await this.executeRuleActions(rule, threat);
      }
    }

    // Deduplicate threats
    return this.deduplicateThreats(threats);
  }

  // Ticket Management
  async createTicket(request: CreateTicketRequest): Promise<SecurityTicket> {
    const integration = await this.getIntegration(request.integrationId);
    if (!integration || integration.type !== 'ticketing') {
      throw new Error(`Ticketing integration ${request.integrationId} not found`);
    }

    const adapter = this.adapters.get(request.integrationId);
    if (!adapter) {
      throw new Error(`Adapter for integration ${request.integrationId} not found`);
    }

    // Prepare ticket data
    const ticketData = {
      ...request.ticketData,
      linkedThreats: request.threatId ? [request.threatId] : [],
      linkedVulnerabilities: request.vulnerabilityId ? [request.vulnerabilityId] : [],
      linkedFindings: request.findingId ? [request.findingId] : []
    };

    // Create ticket
    const ticketId = await (adapter as any).createTicket(ticketData);
    
    // Get created ticket details
    const ticket = await (adapter as any).getTicket(ticketId);
    
    // Save ticket mapping
    await this.saveTicketMapping({
      ticketId: ticket.id,
      externalId: ticket.externalId,
      integrationId: request.integrationId,
      threatId: request.threatId,
      vulnerabilityId: request.vulnerabilityId,
      findingId: request.findingId
    });

    return ticket;
  }

  // Dashboard and Metrics
  async getSecurityPostureDashboard(): Promise<SecurityPostureDashboard> {
    const dashboard: SecurityPostureDashboard = {
      generatedAt: new Date(),
      overallRiskScore: 0,
      totalThreats: 0,
      activeThreats: 0,
      toolMetrics: new Map(),
      threatTrends: [],
      vulnerabilityTrends: [],
      topThreats: [],
      topVulnerabilities: [],
      criticalFindings: [],
      assetCoverage: 0,
      toolCoverage: new Map(),
      correlationMetrics: {
        totalCorrelations: 0,
        successfulCorrelations: 0,
        failedCorrelations: 0,
        averageCorrelationTime: 0,
        deduplicationRate: 0
      },
      integrationHealth: new Map()
    };

    // Get all integrations
    const integrations = await this.getAllIntegrations();
    
    // Calculate metrics for each integration
    for (const integration of integrations) {
      const health = await this.getIntegrationHealth(integration);
      dashboard.integrationHealth.set(integration.id, health);
      
      // Get tool-specific metrics
      const metrics = await this.getToolMetrics(integration);
      dashboard.toolMetrics.set(integration.type, metrics);
    }

    // Get threats, vulnerabilities, and findings
    dashboard.topThreats = await this.getTopThreats(10);
    dashboard.topVulnerabilities = await this.getTopVulnerabilities(10);
    dashboard.criticalFindings = await this.getCriticalFindings(10);
    
    // Calculate trends
    dashboard.threatTrends = await this.calculateThreatTrends();
    dashboard.vulnerabilityTrends = await this.calculateVulnerabilityTrends();
    
    // Calculate overall risk score
    dashboard.overallRiskScore = this.calculateOverallRiskScore(dashboard);
    
    // Calculate coverage
    dashboard.assetCoverage = await this.calculateAssetCoverage();
    dashboard.toolCoverage = await this.calculateToolCoverage();

    return dashboard;
  }

  // Private helper methods
  private createAdapter(integration: SecurityToolIntegration): BaseSecurityToolAdapter {
    switch (integration.type) {
      case 'siem':
        switch (integration.platform) {
          case 'splunk':
            return new SplunkAdapter(integration as any) as unknown as BaseSecurityToolAdapter;
          case 'qradar':
            return new QRadarAdapter(integration as any) as unknown as BaseSecurityToolAdapter;
          default:
            throw new Error(`Unsupported SIEM platform: ${integration.platform}`);
        }
      
      case 'vulnerability-scanner':
        switch (integration.platform) {
          case 'nessus':
            return new NessusAdapter(integration as any);
          default:
            throw new Error(`Unsupported vulnerability scanner: ${integration.platform}`);
        }
      
      case 'cloud-security':
        switch (integration.platform) {
          case 'aws':
            return new AWSSecurityHubAdapter(integration as any);
          default:
            throw new Error(`Unsupported cloud platform: ${integration.platform}`);
        }
      
      case 'ticketing':
        switch (integration.platform) {
          case 'jira':
            return new JiraAdapter(integration as any);
          default:
            throw new Error(`Unsupported ticketing platform: ${integration.platform}`);
        }
      
      default:
        throw new Error(`Unsupported tool type: ${integration.type}`);
    }
  }

  private async encryptCredentials(credentials: Record<string, string>): Promise<Record<string, any>> {
    // In production, use proper encryption (e.g., AWS KMS, HashiCorp Vault)
    // This is a placeholder implementation
    const encrypted: Record<string, any> = {};
    for (const [key, value] of Object.entries(credentials)) {
      encrypted[key] = Buffer.from(value).toString('base64');
    }
    return encrypted;
  }


  private getDefaultSeverityMapping(): any {
    return {
      critical: ['critical', 'p1', 'sev1', '10', '9', 'highest'],
      high: ['high', 'p2', 'sev2', '8', '7'],
      medium: ['medium', 'p3', 'sev3', '6', '5', '4'],
      low: ['low', 'p4', 'sev4', '3', '2'],
      info: ['info', 'informational', 'p5', 'sev5', '1', '0', 'lowest']
    };
  }

  private getDefaultFeatures(type: SecurityToolType): any {
    const baseFeatures = {
      alertIngestion: true,
      eventCorrelation: true,
      ticketCreation: true,
      bidirectionalSync: false,
      automatedResponse: false,
      customWebhooks: true,
      bulkOperations: true,
      realTimeStreaming: false
    };

    switch (type) {
      case 'siem':
        return {
          ...baseFeatures,
          eventCorrelation: true,
          realTimeStreaming: true
        };
      case 'vulnerability-scanner':
        return {
          ...baseFeatures,
          alertIngestion: false,
          eventCorrelation: false
        };
      case 'cloud-security':
        return {
          ...baseFeatures,
          automatedResponse: true
        };
      case 'ticketing':
        return {
          ...baseFeatures,
          bidirectionalSync: true,
          alertIngestion: false
        };
      default:
        return baseFeatures;
    }
  }

  private initializeCorrelationEngine(windowMinutes: number): void {
    this.correlationEngine = {
      id: 'default',
      name: 'Default Correlation Engine',
      description: 'Default threat correlation engine',
      rules: this.getDefaultCorrelationRules(),
      correlationWindow: windowMinutes,
      lookbackPeriod: windowMinutes * 2,
      deduplicationEnabled: true,
      deduplicationFields: ['source', 'title', 'severity'],
      enrichmentSources: [],
      outputFormat: 'unified-threat',
      outputDestinations: []
    };

    // Set up correlation interval
    this.correlationInterval = setInterval(() => {
      this.performPeriodicCorrelation();
    }, 60000); // Run every minute
  }

  private getDefaultCorrelationRules(): CorrelationEngineRule[] {
    return [
      {
        id: 'multi-source-critical',
        name: 'Multi-Source Critical Threat',
        enabled: true,
        sourceTypes: ['siem', 'vulnerability-scanner', 'cloud-security'],
        conditions: [
          { field: 'severity', operator: 'eq', value: 'critical' }
        ],
        aggregations: [
          {
            field: 'source',
            function: 'count',
            having: { field: 'count', operator: 'gte', value: 2 }
          }
        ],
        severity: 'critical',
        tags: ['multi-source', 'critical'],
        actions: [
          { type: 'create-threat', parameters: {} },
          { type: 'create-ticket', parameters: { priority: 'highest' } }
        ]
      },
      {
        id: 'repeated-attacks',
        name: 'Repeated Attack Pattern',
        enabled: true,
        sourceTypes: ['siem'],
        conditions: [
          { field: 'category', operator: 'in', value: ['intrusion', 'malware', 'exploit'] }
        ],
        aggregations: [
          {
            field: 'sourceIP',
            function: 'count',
            having: { field: 'count', operator: 'gte', value: 5 }
          }
        ],
        severity: 'high',
        tags: ['repeated-attack', 'pattern'],
        actions: [
          { type: 'create-threat', parameters: {} },
          { type: 'send-alert', parameters: { channel: 'security-ops' } }
        ]
      }
    ];
  }

  private async performPeriodicCorrelation(): Promise<void> {
    try {
      await this.correlateEvents({
        timeRange: {
          start: new Date(Date.now() - this.correlationEngine!.correlationWindow * 60000).toISOString(),
          end: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Periodic correlation failed:', error);
    }
  }

  private async getEventsForCorrelation(request: CorrelateEventsRequest): Promise<any[]> {
    const events: any[] = [];
    
    // Get events from Redis cache
    const cacheKey = `security-events:${request.timeRange.start}:${request.timeRange.end}`;
    const cachedEvents = await this.redis.get(cacheKey);
    
    if (cachedEvents) {
      return JSON.parse(cachedEvents);
    }
    
    // Query events from database
    const query = `
      SELECT * FROM security_events
      WHERE timestamp >= $1 AND timestamp <= $2
      ${request.sources ? 'AND source_type = ANY($3)' : ''}
      ${request.severities ? 'AND severity = ANY($4)' : ''}
      ORDER BY timestamp DESC
    `;
    
    const params: any[] = [request.timeRange.start, request.timeRange.end];
    if (request.sources) params.push(request.sources);
    if (request.severities) params.push(request.severities);
    
    const result = await this.db.query(query, params);
    events.push(...result.rows);
    
    // Cache results
    await this.redis.setex(cacheKey, 300, JSON.stringify(events));
    
    return events;
  }

  private applyCorrelationRule(rule: CorrelationEngineRule, events: any[]): any[] {
    let filteredEvents = events;
    
    // Apply source type filter
    if (rule.sourceTypes.length > 0) {
      filteredEvents = filteredEvents.filter(e => rule.sourceTypes.includes(e.sourceType));
    }
    
    // Apply conditions
    for (const condition of rule.conditions) {
      filteredEvents = filteredEvents.filter(e => this.evaluateCondition(e, condition));
    }
    
    // Apply aggregations
    if (rule.aggregations && rule.aggregations.length > 0) {
      for (const aggregation of rule.aggregations) {
        filteredEvents = this.applyAggregation(filteredEvents, aggregation);
      }
    }
    
    return filteredEvents;
  }

  private evaluateCondition(event: any, condition: any): boolean {
    const value = event[condition.field];
    
    switch (condition.operator) {
      case 'eq':
        return value === condition.value;
      case 'ne':
        return value !== condition.value;
      case 'gt':
        return value > condition.value;
      case 'gte':
        return value >= condition.value;
      case 'lt':
        return value < condition.value;
      case 'lte':
        return value <= condition.value;
      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(value);
      case 'contains':
        return String(value).includes(condition.value);
      default:
        return false;
    }
  }

  private applyAggregation(events: any[], aggregation: any): any[] {
    const groups = new Map<string, any[]>();
    
    // Group events
    for (const event of events) {
      const key = aggregation.groupBy 
        ? aggregation.groupBy.map((field: string) => event[field]).join(':')
        : event[aggregation.field];
      
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(event);
    }
    
    // Apply aggregation function and having clause
    const result: any[] = [];
    
    for (const [, groupEvents] of groups) {
      let aggregatedValue: any;
      
      switch (aggregation.function) {
        case 'count':
          aggregatedValue = groupEvents.length;
          break;
        case 'sum':
          aggregatedValue = groupEvents.reduce((sum, e) => sum + (e[aggregation.field] || 0), 0);
          break;
        case 'avg':
          aggregatedValue = groupEvents.reduce((sum, e) => sum + (e[aggregation.field] || 0), 0) / groupEvents.length;
          break;
        case 'min':
          aggregatedValue = Math.min(...groupEvents.map(e => e[aggregation.field] || 0));
          break;
        case 'max':
          aggregatedValue = Math.max(...groupEvents.map(e => e[aggregation.field] || 0));
          break;
        case 'unique':
          aggregatedValue = new Set(groupEvents.map(e => e[aggregation.field])).size;
          break;
      }
      
      // Check having clause
      if (!aggregation.having || this.evaluateCondition({ count: aggregatedValue }, aggregation.having)) {
        result.push(...groupEvents);
      }
    }
    
    return result;
  }

  private createUnifiedThreat(events: any[], rule: CorrelationEngineRule): UnifiedThreat {
    const firstEvent = events[0];
    const lastEvent = events[events.length - 1];
    
    const threat: UnifiedThreat = {
      id: uuidv4(),
      correlationId: `${rule.id}-${Date.now()}`,
      title: `${rule.name} - ${events.length} events correlated`,
      description: `Correlated threat detected by rule: ${rule.name}`,
      severity: rule.severity,
      confidence: this.calculateConfidence(events, rule),
      sources: events.map(e => ({
        toolType: e.sourceType,
        toolId: e.integrationId,
        sourceId: e.id,
        timestamp: new Date(e.timestamp),
        rawData: e
      })),
      firstSeen: new Date(firstEvent.timestamp),
      lastSeen: new Date(lastEvent.timestamp),
      eventCount: events.length,
      affectedAssets: this.extractAffectedAssets(events),
      affectedUsers: this.extractAffectedUsers(events),
      status: 'active',
      responseActions: [],
      evidence: events.map(e => ({
        type: e.type || 'event',
        value: e,
        source: e.source,
        timestamp: new Date(e.timestamp),
        confidence: 80
      })),
      riskScore: this.calculateThreatRiskScore(events, rule),
      riskFactors: this.identifyRiskFactors(events, rule)
    };
    
    return threat;
  }

  private calculateConfidence(events: any[], _rule: CorrelationEngineRule): number {
    let confidence = 50; // Base confidence
    
    // More events increase confidence
    confidence += Math.min(events.length * 5, 30);
    
    // Multiple source types increase confidence
    const sourceTypes = new Set(events.map(e => e.sourceType));
    confidence += sourceTypes.size * 10;
    
    // Recent events increase confidence
    const recentEvents = events.filter(e => 
      new Date(e.timestamp) > new Date(Date.now() - 3600000)
    );
    confidence += (recentEvents.length / events.length) * 20;
    
    return Math.min(confidence, 100);
  }

  private extractAffectedAssets(events: any[]): string[] {
    const assets = new Set<string>();
    
    for (const event of events) {
      if (event.assetId) assets.add(event.assetId);
      if (event.hostname) assets.add(event.hostname);
      if (event.ipAddress) assets.add(event.ipAddress);
      if (event.resourceId) assets.add(event.resourceId);
    }
    
    return Array.from(assets);
  }

  private extractAffectedUsers(events: any[]): string[] {
    const users = new Set<string>();
    
    for (const event of events) {
      if (event.user) users.add(event.user);
      if (event.username) users.add(event.username);
      if (event.userId) users.add(event.userId);
    }
    
    return Array.from(users);
  }

  private calculateThreatRiskScore(events: any[], rule: CorrelationEngineRule): number {
    let score = 0;
    
    // Base score from severity
    const severityScores: Record<string, number> = {
      critical: 40,
      high: 30,
      medium: 20,
      low: 10,
      info: 5
    };
    score += severityScores[rule.severity] || 20;
    
    // Event count factor
    score += Math.min(events.length * 2, 30);
    
    // Asset criticality factor
    const criticalAssets = events.filter(e => e.assetCriticality === 'critical').length;
    score += criticalAssets * 5;
    
    // Exploit availability factor
    const exploitableEvents = events.filter(e => e.exploitAvailable).length;
    score += exploitableEvents * 10;
    
    return Math.min(score, 100);
  }

  private identifyRiskFactors(events: any[], _rule: CorrelationEngineRule): any[] {
    const factors = [];
    
    // Check for critical assets
    const criticalAssets = events.filter(e => e.assetCriticality === 'critical');
    if (criticalAssets.length > 0) {
      factors.push({
        factor: 'Critical Assets Affected',
        weight: 30,
        description: `${criticalAssets.length} critical assets are affected`
      });
    }
    
    // Check for exploit availability
    const exploitableEvents = events.filter(e => e.exploitAvailable);
    if (exploitableEvents.length > 0) {
      factors.push({
        factor: 'Exploits Available',
        weight: 25,
        description: `${exploitableEvents.length} vulnerabilities have known exploits`
      });
    }
    
    // Check for persistence
    const timeDiff = new Date(events[events.length - 1].timestamp).getTime() - 
                    new Date(events[0].timestamp).getTime();
    if (timeDiff > 86400000) { // More than 24 hours
      factors.push({
        factor: 'Persistent Threat',
        weight: 20,
        description: 'Threat has persisted for more than 24 hours'
      });
    }
    
    // Check for lateral movement
    const uniqueAssets = new Set(events.map(e => e.assetId || e.hostname));
    if (uniqueAssets.size > 5) {
      factors.push({
        factor: 'Lateral Movement',
        weight: 25,
        description: `Activity detected across ${uniqueAssets.size} different assets`
      });
    }
    
    return factors;
  }

  private async executeRuleActions(rule: CorrelationEngineRule, threat: UnifiedThreat): Promise<void> {
    for (const action of rule.actions) {
      try {
        switch (action.type) {
          case 'create-threat':
            await this.saveThreat(threat);
            break;
          
          case 'create-ticket':
            await this.createTicketFromThreat(threat, action.parameters);
            break;
          
          case 'send-alert':
            await this.sendAlert(threat, action.parameters);
            break;
          
          case 'execute-playbook':
            await this.executePlaybook(threat, action.parameters);
            break;
        }
      } catch (error) {
        console.error(`Failed to execute action ${action.type}:`, error);
      }
    }
  }

  private deduplicateThreats(threats: UnifiedThreat[]): UnifiedThreat[] {
    if (!this.correlationEngine?.deduplicationEnabled) {
      return threats;
    }
    
    const seen = new Map<string, UnifiedThreat>();
    
    for (const threat of threats) {
      const key = this.correlationEngine.deduplicationFields
        .map(field => threat[field as keyof UnifiedThreat])
        .join(':');
      
      if (!seen.has(key)) {
        seen.set(key, threat);
      } else {
        // Merge threats
        const existing = seen.get(key)!;
        existing.eventCount += threat.eventCount;
        existing.sources.push(...threat.sources);
        existing.lastSeen = threat.lastSeen;
        existing.confidence = Math.max(existing.confidence, threat.confidence);
      }
    }
    
    return Array.from(seen.values());
  }

  // Database operations
  private async saveIntegration(integration: SecurityToolIntegration): Promise<void> {
    const query = `
      INSERT INTO security_tool_integrations (
        id, name, type, platform, description, connection_config, status,
        sync_enabled, sync_direction, sync_interval, sync_filter,
        field_mappings, severity_mapping, features, last_connected, last_sync,
        created_by, created_at, updated_at, version
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
      ON CONFLICT (id) DO UPDATE SET
        name = $2, description = $5, connection_config = $6, status = $7,
        sync_enabled = $8, sync_direction = $9, sync_interval = $10, sync_filter = $11,
        field_mappings = $12, severity_mapping = $13, features = $14,
        last_connected = $15, last_sync = $16, updated_at = $19
    `;
    
    await this.db.query(query, [
      integration.id,
      integration.name,
      integration.type,
      integration.platform,
      integration.description,
      JSON.stringify(integration.connectionConfig),
      integration.status,
      integration.syncEnabled,
      integration.syncDirection,
      integration.syncInterval,
      JSON.stringify(integration.syncFilter),
      JSON.stringify(integration.fieldMappings),
      JSON.stringify(integration.severityMapping),
      JSON.stringify(integration.features),
      integration.lastConnected,
      integration.lastSync,
      integration.createdBy,
      integration.createdAt,
      integration.updatedAt,
      integration.version
    ]);
  }

  private async getIntegration(id: string): Promise<SecurityToolIntegration | null> {
    const query = 'SELECT * FROM security_tool_integrations WHERE id = $1';
    const result = await this.db.query(query, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const row = result.rows[0];
    return {
      ...row,
      connectionConfig: JSON.parse(row.connection_config),
      syncFilter: row.sync_filter ? JSON.parse(row.sync_filter) : undefined,
      fieldMappings: JSON.parse(row.field_mappings),
      severityMapping: JSON.parse(row.severity_mapping),
      features: JSON.parse(row.features)
    };
  }

  private async getAllIntegrations(): Promise<SecurityToolIntegration[]> {
    const query = 'SELECT * FROM security_tool_integrations ORDER BY created_at DESC';
    const result = await this.db.query(query);
    
    return result.rows.map(row => ({
      ...row,
      connectionConfig: JSON.parse(row.connection_config),
      syncFilter: row.sync_filter ? JSON.parse(row.sync_filter) : undefined,
      fieldMappings: JSON.parse(row.field_mappings),
      severityMapping: JSON.parse(row.severity_mapping),
      features: JSON.parse(row.features)
    }));
  }

  private async saveThreat(threat: UnifiedThreat): Promise<void> {
    const query = `
      INSERT INTO unified_threats (
        id, correlation_id, title, description, severity, confidence,
        sources, first_seen, last_seen, event_count, affected_assets,
        affected_users, status, risk_score, risk_factors, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
    `;
    
    await this.db.query(query, [
      threat.id,
      threat.correlationId,
      threat.title,
      threat.description,
      threat.severity,
      threat.confidence,
      JSON.stringify(threat.sources),
      threat.firstSeen,
      threat.lastSeen,
      threat.eventCount,
      JSON.stringify(threat.affectedAssets),
      JSON.stringify(threat.affectedUsers),
      threat.status,
      threat.riskScore,
      JSON.stringify(threat.riskFactors),
      new Date()
    ]);
  }

  private async saveTicketMapping(mapping: any): Promise<void> {
    const query = `
      INSERT INTO ticket_mappings (
        ticket_id, external_id, integration_id, threat_id,
        vulnerability_id, finding_id, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    `;
    
    await this.db.query(query, [
      mapping.ticketId,
      mapping.externalId,
      mapping.integrationId,
      mapping.threatId,
      mapping.vulnerabilityId,
      mapping.findingId,
      new Date()
    ]);
  }

  // Sync scheduling
  private async scheduleSyncs(integration: SecurityToolIntegration): Promise<void> {
    if (!integration.syncEnabled || !integration.syncInterval) {
      return;
    }
    
    // Use Redis for distributed scheduling
    const scheduleKey = `sync-schedule:${integration.id}`;
    await this.redis.setex(
      scheduleKey,
      integration.syncInterval * 60,
      JSON.stringify({
        integrationId: integration.id,
        nextSync: new Date(Date.now() + integration.syncInterval * 60000)
      })
    );
  }

  private async updateSyncSchedule(integration: SecurityToolIntegration): Promise<void> {
    const scheduleKey = `sync-schedule:${integration.id}`;
    
    if (!integration.syncEnabled || !integration.syncInterval) {
      await this.redis.del(scheduleKey);
    } else {
      await this.scheduleSyncs(integration);
    }
  }

  private async cancelSyncSchedule(integrationId: string): Promise<void> {
    const scheduleKey = `sync-schedule:${integrationId}`;
    await this.redis.del(scheduleKey);
  }

  // Helper methods for dashboard
  private async getIntegrationHealth(integration: SecurityToolIntegration): Promise<any> {
    const adapter = this.adapters.get(integration.id);
    const status = adapter ? await adapter.getStatus() : 'disconnected';
    
    // Get sync metrics from Redis
    const metricsKey = `integration-metrics:${integration.id}`;
    const metrics = await this.redis.get(metricsKey);
    const parsedMetrics = metrics ? JSON.parse(metrics) : {};
    
    return {
      integrationId: integration.id,
      status,
      lastSync: integration.lastSync,
      syncErrors: parsedMetrics.syncErrors || 0,
      dataLag: this.calculateDataLag(integration.lastSync),
      availability: parsedMetrics.availability || 100
    };
  }

  private calculateDataLag(lastSync?: Date): number {
    if (!lastSync) return 0;
    return Math.floor((Date.now() - lastSync.getTime()) / 60000); // minutes
  }

  private async getToolMetrics(integration: SecurityToolIntegration): Promise<any> {
    const metricsKey = `tool-metrics:${integration.type}`;
    const metrics = await this.redis.get(metricsKey);
    
    return metrics ? JSON.parse(metrics) : {
      toolType: integration.type,
      totalEvents: 0,
      processedEvents: 0,
      correlatedEvents: 0,
      alertsGenerated: 0,
      ticketsCreated: 0,
      averageProcessingTime: 0
    };
  }

  private async getTopThreats(limit: number): Promise<UnifiedThreat[]> {
    const query = `
      SELECT * FROM unified_threats
      WHERE status = 'active'
      ORDER BY risk_score DESC, created_at DESC
      LIMIT $1
    `;
    
    const result = await this.db.query(query, [limit]);
    
    return result.rows.map(row => ({
      ...row,
      sources: JSON.parse(row.sources),
      affectedAssets: JSON.parse(row.affected_assets),
      affectedUsers: JSON.parse(row.affected_users),
      riskFactors: JSON.parse(row.risk_factors)
    }));
  }

  private async getTopVulnerabilities(limit: number): Promise<Vulnerability[]> {
    const query = `
      SELECT * FROM vulnerabilities
      WHERE status = 'open'
      ORDER BY risk_score DESC, cvss_score DESC
      LIMIT $1
    `;
    
    const result = await this.db.query(query, [limit]);
    
    return result.rows.map(row => ({
      ...row,
      affectedAssets: JSON.parse(row.affected_assets),
      patches: JSON.parse(row.patches)
    }));
  }

  private async getCriticalFindings(limit: number): Promise<CloudSecurityFinding[]> {
    const query = `
      SELECT * FROM cloud_security_findings
      WHERE severity = 'critical' AND status = 'active'
      ORDER BY created_at DESC
      LIMIT $1
    `;
    
    const result = await this.db.query(query, [limit]);
    
    return result.rows.map(row => ({
      ...row,
      threatIntelligence: row.threat_intelligence ? JSON.parse(row.threat_intelligence) : undefined,
      remediation: row.remediation ? JSON.parse(row.remediation) : undefined
    }));
  }

  private async calculateThreatTrends(): Promise<any[]> {
    const query = `
      SELECT 
        DATE_TRUNC('day', created_at) as date,
        COUNT(*) as count,
        AVG(risk_score) as avg_risk_score
      FROM unified_threats
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE_TRUNC('day', created_at)
      ORDER BY date
    `;
    
    const result = await this.db.query(query);
    
    return result.rows.map((row, index) => ({
      timestamp: row.date,
      value: parseInt(row.count),
      change: index > 0 ? 
        ((parseInt(row.count) - parseInt(result.rows[index - 1].count)) / parseInt(result.rows[index - 1].count)) * 100 : 0
    }));
  }

  private async calculateVulnerabilityTrends(): Promise<any[]> {
    const query = `
      SELECT 
        DATE_TRUNC('day', first_seen) as date,
        COUNT(*) as count,
        AVG(cvss_score) as avg_cvss
      FROM vulnerabilities
      WHERE first_seen >= NOW() - INTERVAL '30 days'
      GROUP BY DATE_TRUNC('day', first_seen)
      ORDER BY date
    `;
    
    const result = await this.db.query(query);
    
    return result.rows.map((row, index) => ({
      timestamp: row.date,
      value: parseInt(row.count),
      change: index > 0 ? 
        ((parseInt(row.count) - parseInt(result.rows[index - 1].count)) / parseInt(result.rows[index - 1].count)) * 100 : 0
    }));
  }

  private calculateOverallRiskScore(dashboard: SecurityPostureDashboard): number {
    let score = 0;
    let factors = 0;
    
    // Factor in active threats
    if (dashboard.totalThreats > 0) {
      score += (dashboard.activeThreats / dashboard.totalThreats) * 30;
      factors++;
    }
    
    // Factor in critical findings
    score += Math.min(dashboard.criticalFindings.length * 5, 20);
    factors++;
    
    // Factor in top vulnerabilities
    const criticalVulns = dashboard.topVulnerabilities.filter(v => v.severity === 'critical').length;
    score += criticalVulns * 10;
    factors++;
    
    // Factor in integration health
    let unhealthyIntegrations = 0;
    dashboard.integrationHealth.forEach(health => {
      if (health.status !== 'connected') unhealthyIntegrations++;
    });
    score += (unhealthyIntegrations / dashboard.integrationHealth.size) * 20;
    factors++;
    
    return Math.min(Math.floor(score), 100);
  }

  private async calculateAssetCoverage(): Promise<number> {
    // This would calculate what percentage of known assets are being monitored
    // Simplified implementation
    const totalAssets = await this.db.query('SELECT COUNT(DISTINCT asset_id) FROM assets');
    const monitoredAssets = await this.db.query('SELECT COUNT(DISTINCT asset_id) FROM security_events WHERE created_at >= NOW() - INTERVAL \'7 days\'');
    
    if (totalAssets.rows[0].count === 0) return 0;
    
    return Math.floor((monitoredAssets.rows[0].count / totalAssets.rows[0].count) * 100);
  }

  private async calculateToolCoverage(): Promise<Map<SecurityToolType, number>> {
    const coverage = new Map<SecurityToolType, number>();
    const toolTypes: SecurityToolType[] = ['siem', 'vulnerability-scanner', 'cloud-security', 'ticketing'];
    
    for (const toolType of toolTypes) {
      const integrations = await this.db.query(
        'SELECT COUNT(*) FROM security_tool_integrations WHERE type = $1 AND status = $2',
        [toolType, 'connected']
      );
      
      // Assume we want at least one integration per type
      coverage.set(toolType, integrations.rows[0].count > 0 ? 100 : 0);
    }
    
    return coverage;
  }

  // Additional helper methods
  private async createTicketFromThreat(threat: UnifiedThreat, parameters: any): Promise<void> {
    // Find first available ticketing integration
    const integrations = await this.getAllIntegrations();
    const ticketingIntegration = integrations.find(i => i.type === 'ticketing' && i.status === 'connected');
    
    if (!ticketingIntegration) {
      console.error('No ticketing integration available');
      return;
    }
    
    await this.createTicket({
      threatId: threat.id,
      integrationId: ticketingIntegration.id,
      ticketData: {
        title: threat.title,
        description: threat.description,
        priority: parameters.priority || this.mapSeverityToPriority(threat.severity),
        customFields: {
          riskScore: threat.riskScore,
          confidence: threat.confidence,
          eventCount: threat.eventCount
        }
      }
    });
  }

  private mapSeverityToPriority(severity: SeverityLevel): string {
    const mapping: Record<SeverityLevel, string> = {
      critical: 'Highest',
      high: 'High',
      medium: 'Medium',
      low: 'Low',
      info: 'Lowest'
    };
    return mapping[severity] || 'Medium';
  }

  private async sendAlert(threat: UnifiedThreat, parameters: any): Promise<void> {
    // This would integrate with notification service
    console.log(`Sending alert for threat ${threat.id} to channel ${parameters.channel}`);
  }

  private async executePlaybook(threat: UnifiedThreat, parameters: any): Promise<void> {
    // This would integrate with automation/orchestration service
    console.log(`Executing playbook ${parameters.playbookId} for threat ${threat.id}`);
  }

  // Cleanup
  async shutdown(): Promise<void> {
    // Stop correlation interval
    if (this.correlationInterval) {
      clearInterval(this.correlationInterval);
    }
    
    // Disconnect all adapters
    for (const [id, adapter] of this.adapters) {
      try {
        await adapter.disconnect();
      } catch (error) {
        console.error(`Error disconnecting adapter ${id}:`, error);
      }
    }
    
    // Clear queues
    this.syncQueue.clear();
  }
}