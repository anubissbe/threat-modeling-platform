import axios, { AxiosInstance } from 'axios';
import { BaseSecurityToolAdapter } from '../base.adapter';
import {
  QRadarIntegration,
  SIEMEvent,
  SyncFilter,
  CorrelationRule,
  QRadarOffenseRule
} from '../../types/security-tools';

export class QRadarAdapter extends BaseSecurityToolAdapter {
  private client: AxiosInstance | null = null;

  constructor(integration: QRadarIntegration) {
    super(integration);
  }

  async connect(): Promise<void> {
    try {
      const { endpoint, credentials, sslVerify = true, customHeaders = {} } = this.connectionConfig;
      
      // Create axios instance
      this.client = axios.create({
        baseURL: `${endpoint}/api`,
        headers: {
          'SEC': credentials.apiToken,
          'Version': '14.0',
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          ...customHeaders
        },
        httpsAgent: sslVerify ? undefined : new (require('https').Agent)({ rejectUnauthorized: false }),
        timeout: (this.connectionConfig.timeout || 30) * 1000
      });

      // Test connection by getting system info
      await this.client.get('/system/about');
      
      this.isConnected = true;
      await this.emitEvent('integration.connected', { integrationId: this.integration.id });
    } catch (error) {
      this.isConnected = false;
      const toolError = this.handleError(error);
      await this.emitEvent('integration.error', toolError);
      throw toolError;
    }
  }

  async disconnect(): Promise<void> {
    try {
      this.client = null;
      this.isConnected = false;
      
      await this.emitEvent('integration.disconnected', { integrationId: this.integration.id });
    } catch (error) {
      console.error('Error during QRadar disconnect:', error);
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      if (!this.client) {
        return false;
      }

      const response = await this.client.get('/system/about');
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  async sync(filter?: SyncFilter): Promise<void> {
    try {
      await this.emitEvent('sync.started', { integrationId: this.integration.id, filter });

      if (!this.isConnected) {
        await this.connect();
      }

      // Sync offenses
      const offenses = await this.getOffenses(filter);
      for (const offense of offenses) {
        await this.processOffense(offense);
      }

      // Sync events
      const events = await this.getEvents(filter);
      for (const event of events) {
        const siemEvent = this.transformToSIEMEvent(event);
        await this.processSIEMEvent(siemEvent);
      }

      // Update last sync time
      this.integration.lastSync = new Date();
      
      await this.emitEvent('sync.completed', {
        integrationId: this.integration.id,
        offensesProcessed: offenses.length,
        eventsProcessed: events.length
      });
    } catch (error) {
      const toolError = this.handleError(error);
      await this.emitEvent('sync.failed', toolError);
      throw toolError;
    }
  }

  async getOffenses(filter?: SyncFilter): Promise<any[]> {
    if (!this.client) {
      throw new Error('Not connected to QRadar');
    }

    try {
      let query = '';
      
      if (filter) {
        const conditions = [];
        
        if (filter.timeRange) {
          const startTime = filter.timeRange.start.getTime();
          const endTime = filter.timeRange.end.getTime();
          conditions.push(`start_time >= ${startTime} AND start_time <= ${endTime}`);
        }
        
        if (filter.severities && filter.severities.length > 0) {
          const severityValues = filter.severities.map(sev => this.mapSeverityToQRadar(sev));
          conditions.push(`severity IN (${severityValues.join(',')})`);
        }
        
        if (conditions.length > 0) {
          query = `?filter=${encodeURIComponent(conditions.join(' AND '))}`;
        }
      }

      const response = await this.client.get(`/siem/offenses${query}`);
      return response.data || [];
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getEvents(filter?: SyncFilter): Promise<any[]> {
    if (!this.client) {
      throw new Error('Not connected to QRadar');
    }

    try {
      const aql = this.buildAQLQuery(filter);
      
      // Create search
      const searchResponse = await this.client.post('/ariel/searches', null, {
        params: {
          query_expression: aql
        }
      });

      const searchId = searchResponse.data.search_id;

      // Poll for completion
      let searchComplete = false;
      while (!searchComplete) {
        const statusResponse = await this.client.get(`/ariel/searches/${searchId}`);
        
        if (statusResponse.data.status === 'COMPLETED') {
          searchComplete = true;
        } else if (statusResponse.data.status === 'ERROR' || statusResponse.data.status === 'CANCELED') {
          throw new Error(`Search failed with status: ${statusResponse.data.status}`);
        } else {
          await this.sleep(1000);
        }
      }

      // Get results
      const resultsResponse = await this.client.get(`/ariel/searches/${searchId}/results`);
      return resultsResponse.data.events || [];
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async createOffenseRule(rule: CorrelationRule): Promise<number> {
    if (!this.client) {
      throw new Error('Not connected to QRadar');
    }

    try {
      const qradarRule: Partial<QRadarOffenseRule> = {
        name: rule.name,
        enabled: rule.enabled,
        testMode: false,
        ruleType: 'EVENT',
        conditions: this.buildRuleConditions(rule)
      };

      const response = await this.client.post('/analytics/rules', qradarRule);
      return response.data.id;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async addToReferenceSet(setName: string, value: string): Promise<void> {
    if (!this.client) {
      throw new Error('Not connected to QRadar');
    }

    try {
      await this.client.post(`/reference_data/sets/${setName}`, null, {
        params: { value }
      });
    } catch (error) {
      throw this.handleError(error);
    }
  }

  private async processOffense(offense: any): Promise<void> {
    const siemEvent: SIEMEvent = {
      id: `qradar-offense-${offense.id}`,
      timestamp: new Date(offense.start_time),
      source: 'qradar',
      eventType: 'offense',
      severity: this.mapQRadarSeverity(offense.severity),
      title: offense.description || `QRadar Offense ${offense.id}`,
      description: offense.offense_type_str || '',
      category: 'offense',
      subcategory: offense.categories?.join(', '),
      sourceIP: offense.source_address_ids?.[0],
      destinationIP: offense.destination_address_ids?.[0],
      user: offense.username,
      host: offense.source_network,
      status: offense.status === 'OPEN' ? 'new' : 'resolved',
      rawEvent: offense,
      correlationId: `offense-${offense.id}`,
      relatedEvents: offense.log_sources?.map((ls: any) => ls.id.toString())
    };

    await this.emitEvent('threat.detected', {
      integrationId: this.integration.id,
      event: siemEvent,
      isOffense: true
    });
  }

  private transformToSIEMEvent(qradarEvent: any): SIEMEvent {
    return {
      id: qradarEvent.EventID || this.generateEventId(),
      timestamp: new Date(qradarEvent.StartTime || qradarEvent.EventTime),
      source: 'qradar',
      eventType: qradarEvent.EventName || 'event',
      severity: this.mapQRadarSeverity(qradarEvent.Severity || qradarEvent.EventSeverity),
      title: qradarEvent.EventName || 'QRadar Event',
      description: qradarEvent.Message || '',
      category: qradarEvent.Category || 'security',
      subcategory: qradarEvent.LowLevelCategory,
      sourceIP: qradarEvent.SourceIP,
      destinationIP: qradarEvent.DestinationIP,
      sourcePort: qradarEvent.SourcePort,
      destinationPort: qradarEvent.DestinationPort,
      protocol: qradarEvent.Protocol,
      user: qradarEvent.UserName,
      host: qradarEvent.SourceHostname || qradarEvent.DestinationHostname,
      rawEvent: qradarEvent,
      status: 'new'
    };
  }

  private async processSIEMEvent(event: SIEMEvent): Promise<void> {
    // Apply field mappings
    const mappedEvent = this.applyFieldMappings(event);
    
    // Emit event for correlation engine
    await this.emitEvent('threat.detected', {
      integrationId: this.integration.id,
      event: mappedEvent
    });
  }

  private buildAQLQuery(filter?: SyncFilter): string {
    let query = 'SELECT * FROM events';
    const conditions = [];

    if (filter) {
      if (filter.timeRange) {
        const startTime = filter.timeRange.start.toISOString();
        const endTime = filter.timeRange.end.toISOString();
        conditions.push(`StartTime >= '${startTime}' AND StartTime <= '${endTime}'`);
      }

      if (filter.severities && filter.severities.length > 0) {
        const severityValues = filter.severities.map(sev => this.mapSeverityToQRadar(sev));
        conditions.push(`Severity IN (${severityValues.join(',')})`);
      }

      if (filter.categories && filter.categories.length > 0) {
        const categoryConditions = filter.categories.map(cat => `Category = '${cat}'`);
        conditions.push(`(${categoryConditions.join(' OR ')})`);
      }
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ' LIMIT 10000'; // QRadar limit

    return query;
  }

  private buildRuleConditions(rule: CorrelationRule): any[] {
    // Convert generic correlation rule to QRadar format
    // This is a simplified implementation
    return [{
      type: 'EVENT',
      test: rule.query,
      timeWindow: rule.timeWindow * 60, // Convert to seconds
      threshold: rule.threshold
    }];
  }

  private mapSeverityToQRadar(severity: string): number {
    const severityMap: Record<string, number> = {
      'critical': 10,
      'high': 8,
      'medium': 5,
      'low': 3,
      'info': 1
    };
    
    return severityMap[severity.toLowerCase()] || 5;
  }

  private mapQRadarSeverity(qradarSeverity: number): 'critical' | 'high' | 'medium' | 'low' | 'info' {
    if (qradarSeverity >= 9) return 'critical';
    if (qradarSeverity >= 7) return 'high';
    if (qradarSeverity >= 4) return 'medium';
    if (qradarSeverity >= 2) return 'low';
    return 'info';
  }


  // Additional QRadar-specific methods
  async getAssets(): Promise<any[]> {
    if (!this.client) {
      throw new Error('Not connected to QRadar');
    }

    try {
      const response = await this.client.get('/asset_model/assets');
      return response.data || [];
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async createCustomProperty(property: any): Promise<void> {
    if (!this.client) {
      throw new Error('Not connected to QRadar');
    }

    try {
      await this.client.post('/config/event_sources/custom_properties/property_expressions', property);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getDomains(): Promise<any[]> {
    if (!this.client) {
      throw new Error('Not connected to QRadar');
    }

    try {
      const response = await this.client.get('/config/domain_management/domains');
      return response.data || [];
    } catch (error) {
      throw this.handleError(error);
    }
  }
}