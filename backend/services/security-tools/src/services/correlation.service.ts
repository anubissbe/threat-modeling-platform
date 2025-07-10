import { EventEmitter } from 'events';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import { Pool } from 'pg';

import {
  CorrelationEngine,
  CorrelationEngineRule,
  UnifiedThreat,
  SecurityToolEvent,
  SIEMEvent,
  Vulnerability,
  CloudSecurityFinding,
  ThreatSource,
  Evidence,
  RiskFactor,
  SeverityLevel,
  RuleCondition,
  RuleAggregation,
  CorrelationAction,
  EnrichmentSource,
  ThreatIndicator
} from '../types/security-tools';

interface CorrelationContext {
  events: SecurityToolEvent[];
  siemEvents: SIEMEvent[];
  vulnerabilities: Vulnerability[];
  findings: CloudSecurityFinding[];
  timeWindow: {
    start: Date;
    end: Date;
  };
}

export class CorrelationService extends EventEmitter {
  private redis: Redis;
  private db: Pool;
  private correlationEngines: Map<string, CorrelationEngine> = new Map();
  private correlationQueue: Map<string, CorrelationContext> = new Map();
  private enrichmentCache: Map<string, any> = new Map();
  private correlationInterval: NodeJS.Timeout | null = null;

  constructor(config: {
    redis: Redis;
    db: Pool;
    correlationIntervalMs?: number;
  }) {
    super();
    this.redis = config.redis;
    this.db = config.db;

    // Start correlation processing
    this.startCorrelationProcessing(config.correlationIntervalMs || 60000);
  }

  // Engine Management
  async createCorrelationEngine(engine: Omit<CorrelationEngine, 'id'>): Promise<CorrelationEngine> {
    const newEngine: CorrelationEngine = {
      ...engine,
      id: uuidv4()
    };

    await this.saveEngine(newEngine);
    this.correlationEngines.set(newEngine.id, newEngine);
    
    return newEngine;
  }

  async updateCorrelationEngine(engineId: string, updates: Partial<CorrelationEngine>): Promise<CorrelationEngine> {
    const engine = this.correlationEngines.get(engineId);
    if (!engine) {
      throw new Error(`Correlation engine ${engineId} not found`);
    }

    const updatedEngine = {
      ...engine,
      ...updates,
      id: engineId
    };

    await this.saveEngine(updatedEngine);
    this.correlationEngines.set(engineId, updatedEngine);
    
    return updatedEngine;
  }

  async deleteCorrelationEngine(engineId: string): Promise<void> {
    this.correlationEngines.delete(engineId);
    await this.db.query('DELETE FROM correlation_engines WHERE id = $1', [engineId]);
  }

  // Event Processing
  async processSecurityEvent(event: SecurityToolEvent): Promise<void> {
    // Add event to processing queue
    const queueKey = this.getQueueKey(event);
    
    if (!this.correlationQueue.has(queueKey)) {
      this.correlationQueue.set(queueKey, {
        events: [],
        siemEvents: [],
        vulnerabilities: [],
        findings: [],
        timeWindow: {
          start: new Date(Date.now() - 3600000), // 1 hour ago
          end: new Date()
        }
      });
    }

    const context = this.correlationQueue.get(queueKey)!;
    context.events.push(event);

    // Categorize event by type
    switch (event.type) {
      case 'threat.detected':
        if (event.data.event) {
          context.siemEvents.push(event.data.event);
        }
        break;
      case 'vulnerability.discovered':
        if (event.data.vulnerability) {
          context.vulnerabilities.push(event.data.vulnerability);
        }
        break;
      case 'finding.created':
        if (event.data.finding) {
          context.findings.push(event.data.finding);
        }
        break;
    }

    // Store in Redis for distributed processing
    await this.storeEventInRedis(event);
  }

  // Correlation Processing
  private startCorrelationProcessing(intervalMs: number): void {
    this.correlationInterval = setInterval(() => {
      this.performCorrelation();
    }, intervalMs);
  }

  private async performCorrelation(): Promise<void> {
    for (const [queueKey, context] of this.correlationQueue) {
      try {
        await this.correlateContext(context);
        
        // Clear processed events
        this.correlationQueue.delete(queueKey);
      } catch (error) {
        console.error(`Correlation failed for queue ${queueKey}:`, error);
      }
    }
  }

  private async correlateContext(context: CorrelationContext): Promise<void> {
    const threats: UnifiedThreat[] = [];

    // Process each correlation engine
    for (const engine of this.correlationEngines.values()) {
      const engineThreats = await this.applyCorrelationEngine(engine, context);
      threats.push(...engineThreats);
    }

    // Deduplicate and merge threats
    const mergedThreats = this.mergeThreats(threats);

    // Save and emit threats
    for (const threat of mergedThreats) {
      await this.saveThreat(threat);
      this.emit('threat.correlated', threat);
    }
  }

  private async applyCorrelationEngine(
    engine: CorrelationEngine,
    context: CorrelationContext
  ): Promise<UnifiedThreat[]> {
    const threats: UnifiedThreat[] = [];

    // Apply each rule
    for (const rule of engine.rules) {
      if (!rule.enabled) continue;

      const matchedEvents = this.matchRuleConditions(rule, context);
      
      if (matchedEvents.length > 0) {
        const threat = await this.createThreatFromRule(rule, matchedEvents, engine);
        threats.push(threat);

        // Execute rule actions
        await this.executeRuleActions(rule, threat);
      }
    }

    return threats;
  }

  private matchRuleConditions(
    rule: CorrelationEngineRule,
    context: CorrelationContext
  ): any[] {
    let allEvents: any[] = [];

    // Gather events based on source types
    if (rule.sourceTypes.includes('siem')) {
      allEvents.push(...context.siemEvents);
    }
    if (rule.sourceTypes.includes('vulnerability-scanner')) {
      allEvents.push(...context.vulnerabilities);
    }
    if (rule.sourceTypes.includes('cloud-security')) {
      allEvents.push(...context.findings);
    }

    // Apply conditions
    let matchedEvents = allEvents;
    for (const condition of rule.conditions) {
      matchedEvents = matchedEvents.filter(event => 
        this.evaluateCondition(event, condition)
      );
    }

    // Apply aggregations
    if (rule.aggregations && rule.aggregations.length > 0) {
      matchedEvents = this.applyAggregations(matchedEvents, rule.aggregations);
    }

    return matchedEvents;
  }

  private evaluateCondition(event: any, condition: RuleCondition): boolean {
    const value = this.getNestedValue(event, condition.field);
    
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
        if (condition.caseInsensitive) {
          return String(value).toLowerCase().includes(String(condition.value).toLowerCase());
        }
        return String(value).includes(condition.value);
      default:
        return false;
    }
  }

  private applyAggregations(events: any[], aggregations: RuleAggregation[]): any[] {
    let result = events;

    for (const aggregation of aggregations) {
      result = this.applyAggregation(result, aggregation);
    }

    return result;
  }

  private applyAggregation(events: any[], aggregation: RuleAggregation): any[] {
    const groups = new Map<string, any[]>();

    // Group events
    for (const event of events) {
      let key: string;
      
      if (aggregation.groupBy && aggregation.groupBy.length > 0) {
        key = aggregation.groupBy
          .map(field => this.getNestedValue(event, field))
          .join(':');
      } else {
        key = String(this.getNestedValue(event, aggregation.field));
      }

      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(event);
    }

    // Apply aggregation function and having clause
    const result: any[] = [];

    for (const [key, groupEvents] of groups) {
      const aggregatedValue = this.calculateAggregation(
        groupEvents,
        aggregation.field,
        aggregation.function
      );

      // Check having clause
      if (!aggregation.having || this.evaluateCondition(
        { [aggregation.field]: aggregatedValue },
        aggregation.having
      )) {
        result.push(...groupEvents);
      }
    }

    return result;
  }

  private calculateAggregation(
    events: any[],
    field: string,
    func: 'count' | 'sum' | 'avg' | 'min' | 'max' | 'unique'
  ): number {
    switch (func) {
      case 'count':
        return events.length;
      
      case 'sum':
        return events.reduce((sum, e) => sum + (this.getNestedValue(e, field) || 0), 0);
      
      case 'avg':
        const total = events.reduce((sum, e) => sum + (this.getNestedValue(e, field) || 0), 0);
        return events.length > 0 ? total / events.length : 0;
      
      case 'min':
        return Math.min(...events.map(e => this.getNestedValue(e, field) || 0));
      
      case 'max':
        return Math.max(...events.map(e => this.getNestedValue(e, field) || 0));
      
      case 'unique':
        return new Set(events.map(e => this.getNestedValue(e, field))).size;
      
      default:
        return 0;
    }
  }

  private async createThreatFromRule(
    rule: CorrelationEngineRule,
    events: any[],
    engine: CorrelationEngine
  ): Promise<UnifiedThreat> {
    // Enrich events if configured
    const enrichedEvents = await this.enrichEvents(events, engine.enrichmentSources);

    // Extract threat indicators
    const indicators = this.extractThreatIndicators(enrichedEvents);

    // Build threat sources
    const sources: ThreatSource[] = enrichedEvents.map(event => ({
      toolType: this.detectToolType(event),
      toolId: event.integrationId || 'unknown',
      sourceId: event.id || uuidv4(),
      timestamp: new Date(event.timestamp || event.createdAt || Date.now()),
      rawData: event
    }));

    // Calculate metrics
    const riskScore = this.calculateRiskScore(enrichedEvents, rule, indicators);
    const confidence = this.calculateConfidence(enrichedEvents, rule, indicators);
    const riskFactors = this.identifyRiskFactors(enrichedEvents, rule, indicators);

    const threat: UnifiedThreat = {
      id: uuidv4(),
      correlationId: `${engine.id}-${rule.id}-${Date.now()}`,
      title: this.generateThreatTitle(rule, enrichedEvents),
      description: this.generateThreatDescription(rule, enrichedEvents, indicators),
      severity: rule.severity,
      confidence,
      sources,
      firstSeen: this.getEarliestTimestamp(enrichedEvents),
      lastSeen: this.getLatestTimestamp(enrichedEvents),
      eventCount: enrichedEvents.length,
      actors: this.extractActors(enrichedEvents),
      campaigns: this.extractCampaigns(enrichedEvents),
      techniques: this.extractMitreTechniques(enrichedEvents),
      affectedAssets: this.extractAffectedAssets(enrichedEvents),
      affectedUsers: this.extractAffectedUsers(enrichedEvents),
      businessImpact: this.assessBusinessImpact(enrichedEvents, rule),
      status: 'active',
      responseActions: [],
      relatedThreats: await this.findRelatedThreats(enrichedEvents),
      evidence: this.buildEvidence(enrichedEvents, indicators),
      riskScore,
      riskFactors
    };

    return threat;
  }

  private async enrichEvents(
    events: any[],
    enrichmentSources: EnrichmentSource[]
  ): Promise<any[]> {
    if (!enrichmentSources || enrichmentSources.length === 0) {
      return events;
    }

    const enrichedEvents = [];

    for (const event of events) {
      let enrichedEvent = { ...event };

      for (const source of enrichmentSources) {
        enrichedEvent = await this.enrichFromSource(enrichedEvent, source);
      }

      enrichedEvents.push(enrichedEvent);
    }

    return enrichedEvents;
  }

  private async enrichFromSource(
    event: any,
    source: EnrichmentSource
  ): Promise<any> {
    const cacheKey = `enrichment:${source.type}:${source.name}:${this.getEnrichmentKey(event)}`;
    
    // Check cache
    const cached = this.enrichmentCache.get(cacheKey);
    if (cached) {
      return { ...event, enrichment: { ...event.enrichment, [source.name]: cached } };
    }

    let enrichmentData: any = null;

    switch (source.type) {
      case 'threat-intel':
        enrichmentData = await this.enrichFromThreatIntel(event, source.config);
        break;
      
      case 'asset-db':
        enrichmentData = await this.enrichFromAssetDB(event, source.config);
        break;
      
      case 'user-db':
        enrichmentData = await this.enrichFromUserDB(event, source.config);
        break;
      
      case 'geo-ip':
        enrichmentData = await this.enrichFromGeoIP(event, source.config);
        break;
      
      case 'custom':
        enrichmentData = await this.enrichFromCustomSource(event, source.config);
        break;
    }

    // Cache enrichment
    if (enrichmentData) {
      this.enrichmentCache.set(cacheKey, enrichmentData);
      
      // Set TTL in Redis
      await this.redis.setex(cacheKey, 3600, JSON.stringify(enrichmentData));
    }

    return {
      ...event,
      enrichment: {
        ...event.enrichment,
        [source.name]: enrichmentData
      }
    };
  }

  private extractThreatIndicators(events: any[]): ThreatIndicator[] {
    const indicators: ThreatIndicator[] = [];
    const seen = new Set<string>();

    for (const event of events) {
      // Extract from event data
      if (event.threatIndicators) {
        for (const indicator of event.threatIndicators) {
          const key = `${indicator.type}:${indicator.value}`;
          if (!seen.has(key)) {
            seen.add(key);
            indicators.push(indicator);
          }
        }
      }

      // Extract IPs
      const ipFields = ['sourceIP', 'destinationIP', 'src_ip', 'dest_ip', 'ipAddress'];
      for (const field of ipFields) {
        const value = this.getNestedValue(event, field);
        if (value && this.isValidIP(value)) {
          const key = `ip:${value}`;
          if (!seen.has(key)) {
            seen.add(key);
            indicators.push({
              type: 'ip',
              value,
              confidence: 80,
              source: 'correlation',
              lastSeen: new Date()
            });
          }
        }
      }

      // Extract domains
      const domainFields = ['domain', 'hostname', 'host', 'server'];
      for (const field of domainFields) {
        const value = this.getNestedValue(event, field);
        if (value && this.isValidDomain(value)) {
          const key = `domain:${value}`;
          if (!seen.has(key)) {
            seen.add(key);
            indicators.push({
              type: 'domain',
              value,
              confidence: 70,
              source: 'correlation',
              lastSeen: new Date()
            });
          }
        }
      }

      // Extract hashes
      const hashFields = ['hash', 'md5', 'sha1', 'sha256', 'fileHash'];
      for (const field of hashFields) {
        const value = this.getNestedValue(event, field);
        if (value && this.isValidHash(value)) {
          const key = `hash:${value}`;
          if (!seen.has(key)) {
            seen.add(key);
            indicators.push({
              type: 'hash',
              value,
              confidence: 90,
              source: 'correlation',
              lastSeen: new Date()
            });
          }
        }
      }

      // Extract CVEs
      if (event.cve) {
        const key = `cve:${event.cve}`;
        if (!seen.has(key)) {
          seen.add(key);
          indicators.push({
            type: 'cve',
            value: event.cve,
            confidence: 95,
            source: 'correlation',
            lastSeen: new Date()
          });
        }
      }
    }

    return indicators;
  }

  private generateThreatTitle(rule: CorrelationEngineRule, events: any[]): string {
    const uniqueTypes = new Set(events.map(e => e.type || e.eventType || 'unknown'));
    const typeCount = uniqueTypes.size;
    const eventCount = events.length;

    return `${rule.name} - ${eventCount} events from ${typeCount} source type${typeCount > 1 ? 's' : ''}`;
  }

  private generateThreatDescription(
    rule: CorrelationEngineRule,
    events: any[],
    indicators: ThreatIndicator[]
  ): string {
    const parts = [
      `Correlated threat detected by rule: ${rule.name}.`,
      `Total events: ${events.length}.`
    ];

    // Add source breakdown
    const sourceCounts = new Map<string, number>();
    for (const event of events) {
      const source = event.source || event.platform || 'unknown';
      sourceCounts.set(source, (sourceCounts.get(source) || 0) + 1);
    }
    
    const sourceBreakdown = Array.from(sourceCounts.entries())
      .map(([source, count]) => `${source} (${count})`)
      .join(', ');
    parts.push(`Sources: ${sourceBreakdown}.`);

    // Add indicator summary
    if (indicators.length > 0) {
      const indicatorTypes = new Map<string, number>();
      for (const indicator of indicators) {
        indicatorTypes.set(indicator.type, (indicatorTypes.get(indicator.type) || 0) + 1);
      }
      
      const indicatorSummary = Array.from(indicatorTypes.entries())
        .map(([type, count]) => `${count} ${type}${count > 1 ? 's' : ''}`)
        .join(', ');
      parts.push(`Indicators: ${indicatorSummary}.`);
    }

    // Add affected assets summary
    const affectedAssets = this.extractAffectedAssets(events);
    if (affectedAssets.length > 0) {
      parts.push(`Affected assets: ${affectedAssets.length}.`);
    }

    return parts.join(' ');
  }

  private calculateRiskScore(
    events: any[],
    rule: CorrelationEngineRule,
    indicators: ThreatIndicator[]
  ): number {
    let score = 0;

    // Base score from rule severity
    const severityScores: Record<SeverityLevel, number> = {
      critical: 40,
      high: 30,
      medium: 20,
      low: 10,
      info: 5
    };
    score += severityScores[rule.severity];

    // Event volume factor (capped at 20 points)
    score += Math.min(events.length * 2, 20);

    // Indicator factor
    score += Math.min(indicators.length * 3, 15);

    // High-confidence indicators boost
    const highConfidenceIndicators = indicators.filter(i => i.confidence >= 90);
    score += highConfidenceIndicators.length * 2;

    // Critical asset factor
    const criticalAssets = events.filter(e => 
      e.assetCriticality === 'critical' || 
      e.asset?.criticality === 'critical'
    ).length;
    score += criticalAssets * 5;

    // Exploit availability factor
    const exploitableEvents = events.filter(e => 
      e.exploitAvailable === true ||
      e.exploit_available === true
    ).length;
    score += exploitableEvents * 5;

    // Active exploitation factor
    const activeExploits = events.filter(e => 
      e.inTheWild === true ||
      e.in_the_wild === true
    ).length;
    score += activeExploits * 10;

    return Math.min(score, 100);
  }

  private calculateConfidence(
    events: any[],
    rule: CorrelationEngineRule,
    indicators: ThreatIndicator[]
  ): number {
    let confidence = 50; // Base confidence

    // Multiple events increase confidence
    confidence += Math.min(events.length * 3, 20);

    // Multiple source types increase confidence
    const sourceTypes = new Set(events.map(e => this.detectToolType(e)));
    confidence += sourceTypes.size * 10;

    // High-quality indicators increase confidence
    const avgIndicatorConfidence = indicators.length > 0
      ? indicators.reduce((sum, i) => sum + i.confidence, 0) / indicators.length
      : 0;
    confidence += avgIndicatorConfidence * 0.2;

    // Recent events increase confidence
    const recentEvents = events.filter(e => {
      const timestamp = new Date(e.timestamp || e.createdAt || Date.now());
      return timestamp > new Date(Date.now() - 3600000); // Last hour
    });
    confidence += (recentEvents.length / events.length) * 10;

    // Correlated attributes increase confidence
    const correlatedIPs = this.findCorrelatedAttributes(events, 'ip');
    const correlatedDomains = this.findCorrelatedAttributes(events, 'domain');
    confidence += (correlatedIPs.size + correlatedDomains.size) * 2;

    return Math.min(Math.round(confidence), 100);
  }

  private identifyRiskFactors(
    events: any[],
    rule: CorrelationEngineRule,
    indicators: ThreatIndicator[]
  ): RiskFactor[] {
    const factors: RiskFactor[] = [];

    // Critical assets affected
    const criticalAssets = events.filter(e => 
      e.assetCriticality === 'critical' || 
      e.asset?.criticality === 'critical'
    );
    if (criticalAssets.length > 0) {
      factors.push({
        factor: 'Critical Assets Affected',
        weight: 30,
        description: `${criticalAssets.length} critical asset${criticalAssets.length > 1 ? 's' : ''} affected by this threat`
      });
    }

    // Exploits available
    const exploitableEvents = events.filter(e => 
      e.exploitAvailable === true ||
      e.exploit_available === true
    );
    if (exploitableEvents.length > 0) {
      factors.push({
        factor: 'Exploits Available',
        weight: 25,
        description: `${exploitableEvents.length} vulnerability${exploitableEvents.length > 1 ? 'ies have' : ' has'} known exploits`
      });
    }

    // Active exploitation
    const activeExploits = events.filter(e => 
      e.inTheWild === true ||
      e.in_the_wild === true
    );
    if (activeExploits.length > 0) {
      factors.push({
        factor: 'Active Exploitation',
        weight: 35,
        description: `${activeExploits.length} vulnerability${activeExploits.length > 1 ? 'ies are' : ' is'} being actively exploited`
      });
    }

    // Persistence
    const timeSpan = this.getLatestTimestamp(events).getTime() - 
                    this.getEarliestTimestamp(events).getTime();
    if (timeSpan > 86400000) { // More than 24 hours
      const days = Math.floor(timeSpan / 86400000);
      factors.push({
        factor: 'Persistent Threat',
        weight: 20,
        description: `Threat activity has persisted for ${days} day${days > 1 ? 's' : ''}`
      });
    }

    // Lateral movement
    const uniqueAssets = new Set(this.extractAffectedAssets(events));
    if (uniqueAssets.size > 5) {
      factors.push({
        factor: 'Lateral Movement',
        weight: 25,
        description: `Activity detected across ${uniqueAssets.size} different assets`
      });
    }

    // Known threat actors
    const actors = this.extractActors(events);
    if (actors.length > 0) {
      factors.push({
        factor: 'Known Threat Actors',
        weight: 30,
        description: `Associated with known threat actor${actors.length > 1 ? 's' : ''}: ${actors.join(', ')}`
      });
    }

    // Advanced techniques
    const techniques = this.extractMitreTechniques(events);
    const advancedTechniques = techniques.filter(t => 
      t.includes('T1055') || // Process Injection
      t.includes('T1003') || // Credential Dumping
      t.includes('T1486') || // Data Encrypted for Impact
      t.includes('T1490')    // Inhibit System Recovery
    );
    if (advancedTechniques.length > 0) {
      factors.push({
        factor: 'Advanced Techniques',
        weight: 25,
        description: `Uses ${advancedTechniques.length} advanced MITRE ATT&CK technique${advancedTechniques.length > 1 ? 's' : ''}`
      });
    }

    // Data exfiltration risk
    const exfilIndicators = events.filter(e => 
      e.category?.toLowerCase().includes('exfil') ||
      e.title?.toLowerCase().includes('exfil') ||
      e.description?.toLowerCase().includes('exfil')
    );
    if (exfilIndicators.length > 0) {
      factors.push({
        factor: 'Data Exfiltration Risk',
        weight: 30,
        description: `${exfilIndicators.length} indicator${exfilIndicators.length > 1 ? 's' : ''} of potential data exfiltration`
      });
    }

    return factors.sort((a, b) => b.weight - a.weight);
  }

  private buildEvidence(events: any[], indicators: ThreatIndicator[]): Evidence[] {
    const evidence: Evidence[] = [];

    // Add events as evidence
    for (const event of events) {
      evidence.push({
        type: 'event',
        value: event,
        source: event.source || event.platform || 'unknown',
        timestamp: new Date(event.timestamp || event.createdAt || Date.now()),
        confidence: 80
      });
    }

    // Add indicators as evidence
    for (const indicator of indicators) {
      evidence.push({
        type: 'indicator',
        value: indicator,
        source: indicator.source,
        timestamp: indicator.lastSeen,
        confidence: indicator.confidence
      });
    }

    return evidence;
  }

  private async executeRuleActions(
    rule: CorrelationEngineRule,
    threat: UnifiedThreat
  ): Promise<void> {
    for (const action of rule.actions) {
      try {
        switch (action.type) {
          case 'create-threat':
            // Already created, just emit event
            this.emit('threat.created', threat);
            break;

          case 'update-threat':
            await this.updateThreat(threat.id, action.parameters);
            break;

          case 'create-ticket':
            await this.createTicket(threat, action.parameters);
            break;

          case 'send-alert':
            await this.sendAlert(threat, action.parameters);
            break;

          case 'execute-playbook':
            await this.executePlaybook(threat, action.parameters);
            break;
        }
      } catch (error) {
        console.error(`Failed to execute action ${action.type} for rule ${rule.id}:`, error);
      }
    }
  }

  // Threat merging and deduplication
  private mergeThreats(threats: UnifiedThreat[]): UnifiedThreat[] {
    const mergedMap = new Map<string, UnifiedThreat>();

    for (const threat of threats) {
      const key = this.generateThreatKey(threat);
      
      if (mergedMap.has(key)) {
        const existing = mergedMap.get(key)!;
        mergedMap.set(key, this.mergeTwoThreats(existing, threat));
      } else {
        mergedMap.set(key, threat);
      }
    }

    return Array.from(mergedMap.values());
  }

  private generateThreatKey(threat: UnifiedThreat): string {
    // Create a key based on significant attributes
    const components = [
      threat.severity,
      ...threat.affectedAssets.slice(0, 3).sort(),
      ...threat.techniques?.slice(0, 3).sort() || []
    ];
    
    return components.join(':');
  }

  private mergeTwoThreats(threat1: UnifiedThreat, threat2: UnifiedThreat): UnifiedThreat {
    return {
      ...threat1,
      sources: [...threat1.sources, ...threat2.sources],
      eventCount: threat1.eventCount + threat2.eventCount,
      confidence: Math.max(threat1.confidence, threat2.confidence),
      riskScore: Math.max(threat1.riskScore, threat2.riskScore),
      firstSeen: new Date(Math.min(threat1.firstSeen.getTime(), threat2.firstSeen.getTime())),
      lastSeen: new Date(Math.max(threat1.lastSeen.getTime(), threat2.lastSeen.getTime())),
      affectedAssets: Array.from(new Set([...threat1.affectedAssets, ...threat2.affectedAssets])),
      affectedUsers: Array.from(new Set([...(threat1.affectedUsers || []), ...(threat2.affectedUsers || [])])),
      actors: Array.from(new Set([...(threat1.actors || []), ...(threat2.actors || [])])),
      campaigns: Array.from(new Set([...(threat1.campaigns || []), ...(threat2.campaigns || [])])),
      techniques: Array.from(new Set([...(threat1.techniques || []), ...(threat2.techniques || [])])),
      evidence: [...threat1.evidence, ...threat2.evidence],
      riskFactors: this.mergeRiskFactors(threat1.riskFactors, threat2.riskFactors)
    };
  }

  private mergeRiskFactors(factors1: RiskFactor[], factors2: RiskFactor[]): RiskFactor[] {
    const factorMap = new Map<string, RiskFactor>();

    for (const factor of [...factors1, ...factors2]) {
      if (factorMap.has(factor.factor)) {
        const existing = factorMap.get(factor.factor)!;
        factorMap.set(factor.factor, {
          ...existing,
          weight: Math.max(existing.weight, factor.weight)
        });
      } else {
        factorMap.set(factor.factor, factor);
      }
    }

    return Array.from(factorMap.values()).sort((a, b) => b.weight - a.weight);
  }

  // Helper methods
  private getNestedValue(obj: any, path: string): any {
    const keys = path.split('.');
    let current = obj;

    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        return undefined;
      }
    }

    return current;
  }

  private detectToolType(event: any): 'siem' | 'vulnerability-scanner' | 'cloud-security' | 'ticketing' | 'soar' | 'threat-intelligence' | 'endpoint-protection' | 'network-security' {
    // Detect based on event structure
    if (event.severity && event.eventType) return 'siem';
    if (event.cve || event.cvssScore) return 'vulnerability-scanner';
    if (event.platform && event.findingId) return 'cloud-security';
    if (event.ticketId || event.externalId) return 'ticketing';
    
    // Default
    return 'siem';
  }

  private getEarliestTimestamp(events: any[]): Date {
    const timestamps = events.map(e => 
      new Date(e.timestamp || e.firstSeen || e.createdAt || Date.now()).getTime()
    );
    return new Date(Math.min(...timestamps));
  }

  private getLatestTimestamp(events: any[]): Date {
    const timestamps = events.map(e => 
      new Date(e.timestamp || e.lastSeen || e.updatedAt || e.createdAt || Date.now()).getTime()
    );
    return new Date(Math.max(...timestamps));
  }

  private extractActors(events: any[]): string[] {
    const actors = new Set<string>();

    for (const event of events) {
      if (event.actors) {
        event.actors.forEach((actor: string) => actors.add(actor));
      }
      if (event.actor) {
        actors.add(event.actor);
      }
      if (event.threat_actor) {
        actors.add(event.threat_actor);
      }
    }

    return Array.from(actors);
  }

  private extractCampaigns(events: any[]): string[] {
    const campaigns = new Set<string>();

    for (const event of events) {
      if (event.campaigns) {
        event.campaigns.forEach((campaign: string) => campaigns.add(campaign));
      }
      if (event.campaign) {
        campaigns.add(event.campaign);
      }
      if (event.threat_campaign) {
        campaigns.add(event.threat_campaign);
      }
    }

    return Array.from(campaigns);
  }

  private extractMitreTechniques(events: any[]): string[] {
    const techniques = new Set<string>();
    const techniquePattern = /T\d{4}(\.\d{3})?/g;

    for (const event of events) {
      // Direct technique fields
      if (event.techniques) {
        event.techniques.forEach((technique: string) => techniques.add(technique));
      }
      if (event.mitreTechniques) {
        event.mitreTechniques.forEach((technique: string) => techniques.add(technique));
      }
      if (event.mitre_techniques) {
        event.mitre_techniques.forEach((technique: string) => techniques.add(technique));
      }

      // Extract from text fields
      const textFields = ['description', 'title', 'message', 'details'];
      for (const field of textFields) {
        const value = this.getNestedValue(event, field);
        if (value && typeof value === 'string') {
          const matches = value.match(techniquePattern) || [];
          matches.forEach(match => techniques.add(match));
        }
      }
    }

    return Array.from(techniques);
  }

  private extractAffectedAssets(events: any[]): string[] {
    const assets = new Set<string>();

    for (const event of events) {
      // Direct asset fields
      if (event.affectedAssets) {
        event.affectedAssets.forEach((asset: string) => assets.add(asset));
      }
      if (event.assetId) assets.add(event.assetId);
      if (event.asset_id) assets.add(event.asset_id);
      if (event.hostname) assets.add(event.hostname);
      if (event.host) assets.add(event.host);
      if (event.ipAddress) assets.add(event.ipAddress);
      if (event.ip_address) assets.add(event.ip_address);
      if (event.resourceId) assets.add(event.resourceId);
      if (event.resource_id) assets.add(event.resource_id);
    }

    return Array.from(assets);
  }

  private extractAffectedUsers(events: any[]): string[] {
    const users = new Set<string>();

    for (const event of events) {
      if (event.affectedUsers) {
        event.affectedUsers.forEach((user: string) => users.add(user));
      }
      if (event.user) users.add(event.user);
      if (event.username) users.add(event.username);
      if (event.userId) users.add(event.userId);
      if (event.user_id) users.add(event.user_id);
      if (event.userPrincipalName) users.add(event.userPrincipalName);
    }

    return Array.from(users);
  }

  private assessBusinessImpact(events: any[], rule: CorrelationEngineRule): string {
    const impacts = [];

    // Critical assets
    const criticalAssets = events.filter(e => 
      e.assetCriticality === 'critical' || 
      e.asset?.criticality === 'critical'
    ).length;
    if (criticalAssets > 0) {
      impacts.push(`${criticalAssets} critical business asset${criticalAssets > 1 ? 's' : ''} at risk`);
    }

    // Data breach risk
    const dataBreachIndicators = events.filter(e => 
      e.category?.toLowerCase().includes('data') ||
      e.title?.toLowerCase().includes('breach') ||
      e.description?.toLowerCase().includes('exfil')
    ).length;
    if (dataBreachIndicators > 0) {
      impacts.push('Potential data breach risk');
    }

    // Service availability
    const availabilityThreats = events.filter(e => 
      e.category?.toLowerCase().includes('dos') ||
      e.category?.toLowerCase().includes('availability') ||
      e.title?.toLowerCase().includes('outage')
    ).length;
    if (availabilityThreats > 0) {
      impacts.push('Service availability at risk');
    }

    // Compliance impact
    const complianceIssues = events.filter(e => 
      e.complianceStatus === 'non-compliant' ||
      e.compliance_status === 'non-compliant'
    ).length;
    if (complianceIssues > 0) {
      impacts.push('Compliance violations detected');
    }

    // Financial impact based on severity and scale
    if (rule.severity === 'critical' && events.length > 10) {
      impacts.push('Significant financial impact possible');
    }

    return impacts.length > 0 
      ? impacts.join('. ') + '.'
      : 'Business impact assessment pending further analysis.';
  }

  private async findRelatedThreats(events: any[]): Promise<string[]> {
    const relatedThreats = new Set<string>();
    
    // Find threats with overlapping indicators
    const indicators = this.extractThreatIndicators(events);
    
    for (const indicator of indicators) {
      const query = `
        SELECT DISTINCT threat_id 
        FROM threat_indicators 
        WHERE indicator_type = $1 AND indicator_value = $2
        AND created_at >= NOW() - INTERVAL '7 days'
        LIMIT 10
      `;
      
      try {
        const result = await this.db.query(query, [indicator.type, indicator.value]);
        result.rows.forEach(row => relatedThreats.add(row.threat_id));
      } catch (error) {
        console.error('Error finding related threats:', error);
      }
    }

    return Array.from(relatedThreats);
  }

  private findCorrelatedAttributes(events: any[], attributeType: string): Set<string> {
    const attributeMap = new Map<string, number>();
    
    for (const event of events) {
      let values: string[] = [];
      
      switch (attributeType) {
        case 'ip':
          values = [
            event.sourceIP, event.destinationIP, event.src_ip, event.dest_ip,
            event.ipAddress, event.ip_address
          ].filter(Boolean);
          break;
        
        case 'domain':
          values = [
            event.domain, event.hostname, event.host, event.server
          ].filter(Boolean);
          break;
      }
      
      for (const value of values) {
        attributeMap.set(value, (attributeMap.get(value) || 0) + 1);
      }
    }
    
    // Return attributes that appear in multiple events
    const correlated = new Set<string>();
    for (const [value, count] of attributeMap) {
      if (count > 1) {
        correlated.add(value);
      }
    }
    
    return correlated;
  }

  private getQueueKey(event: SecurityToolEvent): string {
    return `${event.integrationId}:${Math.floor(Date.now() / 60000)}`;
  }

  private async storeEventInRedis(event: SecurityToolEvent): Promise<void> {
    const key = `security-event:${event.id}`;
    const ttl = 7200; // 2 hours
    
    await this.redis.setex(key, ttl, JSON.stringify(event));
    
    // Add to time-based index
    const indexKey = `event-index:${Math.floor(Date.now() / 60000)}`;
    await this.redis.sadd(indexKey, event.id);
    await this.redis.expire(indexKey, ttl);
  }

  private getEnrichmentKey(event: any): string {
    // Generate a key based on significant event attributes
    const components = [
      event.id,
      event.sourceIP,
      event.destinationIP,
      event.hostname,
      event.user,
      event.hash
    ].filter(Boolean);
    
    return components.join(':');
  }

  // Enrichment methods
  private async enrichFromThreatIntel(event: any, config: any): Promise<any> {
    // Placeholder for threat intelligence enrichment
    // In production, this would query threat intel feeds
    return {
      reputation: 'unknown',
      threatScore: 0,
      knownMalicious: false
    };
  }

  private async enrichFromAssetDB(event: any, config: any): Promise<any> {
    // Query asset database for additional context
    if (event.assetId || event.hostname || event.ipAddress) {
      try {
        const query = `
          SELECT * FROM assets 
          WHERE asset_id = $1 OR hostname = $2 OR ip_address = $3
          LIMIT 1
        `;
        
        const result = await this.db.query(query, [
          event.assetId,
          event.hostname,
          event.ipAddress
        ]);
        
        if (result.rows.length > 0) {
          return result.rows[0];
        }
      } catch (error) {
        console.error('Asset enrichment failed:', error);
      }
    }
    
    return null;
  }

  private async enrichFromUserDB(event: any, config: any): Promise<any> {
    // Query user database for additional context
    if (event.user || event.username || event.userId) {
      try {
        const query = `
          SELECT * FROM users 
          WHERE username = $1 OR user_id = $2 OR email = $3
          LIMIT 1
        `;
        
        const result = await this.db.query(query, [
          event.user || event.username,
          event.userId,
          event.user || event.username
        ]);
        
        if (result.rows.length > 0) {
          return result.rows[0];
        }
      } catch (error) {
        console.error('User enrichment failed:', error);
      }
    }
    
    return null;
  }

  private async enrichFromGeoIP(event: any, config: any): Promise<any> {
    // Placeholder for GeoIP enrichment
    // In production, this would use a GeoIP service
    const ips = [
      event.sourceIP, event.destinationIP, 
      event.src_ip, event.dest_ip,
      event.ipAddress
    ].filter(Boolean);
    
    if (ips.length > 0) {
      return {
        country: 'Unknown',
        city: 'Unknown',
        latitude: 0,
        longitude: 0
      };
    }
    
    return null;
  }

  private async enrichFromCustomSource(event: any, config: any): Promise<any> {
    // Placeholder for custom enrichment sources
    return null;
  }

  // Validation methods
  private isValidIP(value: string): boolean {
    const ipv4Pattern = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;
    const ipv6Pattern = /^(?:[A-F0-9]{1,4}:){7}[A-F0-9]{1,4}$/i;
    
    return ipv4Pattern.test(value) || ipv6Pattern.test(value);
  }

  private isValidDomain(value: string): boolean {
    const domainPattern = /^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}$/i;
    return domainPattern.test(value);
  }

  private isValidHash(value: string): boolean {
    const md5Pattern = /^[a-f0-9]{32}$/i;
    const sha1Pattern = /^[a-f0-9]{40}$/i;
    const sha256Pattern = /^[a-f0-9]{64}$/i;
    
    return md5Pattern.test(value) || sha1Pattern.test(value) || sha256Pattern.test(value);
  }

  // Database operations
  private async saveEngine(engine: CorrelationEngine): Promise<void> {
    const query = `
      INSERT INTO correlation_engines (
        id, name, description, rules, correlation_window, lookback_period,
        deduplication_enabled, deduplication_fields, enrichment_sources,
        output_format, output_destinations
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (id) DO UPDATE SET
        name = $2, description = $3, rules = $4, correlation_window = $5,
        lookback_period = $6, deduplication_enabled = $7, deduplication_fields = $8,
        enrichment_sources = $9, output_format = $10, output_destinations = $11
    `;
    
    await this.db.query(query, [
      engine.id,
      engine.name,
      engine.description,
      JSON.stringify(engine.rules),
      engine.correlationWindow,
      engine.lookbackPeriod,
      engine.deduplicationEnabled,
      JSON.stringify(engine.deduplicationFields),
      JSON.stringify(engine.enrichmentSources),
      engine.outputFormat,
      JSON.stringify(engine.outputDestinations)
    ]);
  }

  private async saveThreat(threat: UnifiedThreat): Promise<void> {
    const query = `
      INSERT INTO unified_threats (
        id, correlation_id, title, description, severity, confidence,
        sources, first_seen, last_seen, event_count, actors, campaigns,
        techniques, affected_assets, affected_users, business_impact,
        status, response_actions, related_threats, evidence, risk_score,
        risk_factors, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
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
      JSON.stringify(threat.actors),
      JSON.stringify(threat.campaigns),
      JSON.stringify(threat.techniques),
      JSON.stringify(threat.affectedAssets),
      JSON.stringify(threat.affectedUsers),
      threat.businessImpact,
      threat.status,
      JSON.stringify(threat.responseActions),
      JSON.stringify(threat.relatedThreats),
      JSON.stringify(threat.evidence),
      threat.riskScore,
      JSON.stringify(threat.riskFactors),
      new Date()
    ]);

    // Save threat indicators
    for (const source of threat.sources) {
      if (source.rawData?.threatIndicators) {
        for (const indicator of source.rawData.threatIndicators) {
          await this.saveThreatIndicator(threat.id, indicator);
        }
      }
    }
  }

  private async saveThreatIndicator(threatId: string, indicator: ThreatIndicator): Promise<void> {
    const query = `
      INSERT INTO threat_indicators (
        threat_id, indicator_type, indicator_value, confidence,
        source, last_seen, tags, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (threat_id, indicator_type, indicator_value) DO UPDATE SET
        confidence = GREATEST(threat_indicators.confidence, $4),
        last_seen = $6
    `;
    
    await this.db.query(query, [
      threatId,
      indicator.type,
      indicator.value,
      indicator.confidence,
      indicator.source,
      indicator.lastSeen,
      JSON.stringify(indicator.tags || []),
      new Date()
    ]);
  }

  private async updateThreat(threatId: string, updates: any): Promise<void> {
    // Build dynamic update query based on provided fields
    const updateFields = [];
    const values = [threatId];
    let paramIndex = 2;

    for (const [key, value] of Object.entries(updates)) {
      updateFields.push(`${key} = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    }

    if (updateFields.length > 0) {
      const query = `
        UPDATE unified_threats 
        SET ${updateFields.join(', ')}, updated_at = NOW()
        WHERE id = $1
      `;
      
      await this.db.query(query, values);
    }
  }

  // Action execution methods
  private async createTicket(threat: UnifiedThreat, parameters: any): Promise<void> {
    // Emit event for ticket creation
    this.emit('correlation.ticket.create', {
      threat,
      parameters
    });
  }

  private async sendAlert(threat: UnifiedThreat, parameters: any): Promise<void> {
    // Emit event for alert sending
    this.emit('correlation.alert.send', {
      threat,
      channel: parameters.channel,
      priority: parameters.priority || threat.severity
    });
  }

  private async executePlaybook(threat: UnifiedThreat, parameters: any): Promise<void> {
    // Emit event for playbook execution
    this.emit('correlation.playbook.execute', {
      threat,
      playbookId: parameters.playbookId,
      parameters: parameters.playbookParams
    });
  }

  // Cleanup
  async shutdown(): Promise<void> {
    if (this.correlationInterval) {
      clearInterval(this.correlationInterval);
    }
    
    this.correlationQueue.clear();
    this.enrichmentCache.clear();
  }
}