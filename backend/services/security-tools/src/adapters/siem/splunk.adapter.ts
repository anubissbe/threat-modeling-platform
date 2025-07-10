import axios, { AxiosInstance } from 'axios';
import { BaseSecurityToolAdapter } from '../base.adapter';
import {
  SplunkIntegration,
  SIEMEvent,
  SyncFilter,
  SplunkSavedSearch,
  CorrelationRule
} from '../../types/security-tools';

export class SplunkAdapter extends BaseSecurityToolAdapter {
  private client: AxiosInstance | null = null;
  private sessionKey: string | null = null;

  constructor(integration: SplunkIntegration) {
    super(integration);
  }

  async connect(): Promise<void> {
    try {
      const { endpoint, credentials, sslVerify = true } = this.connectionConfig;
      
      // Create axios instance
      this.client = axios.create({
        baseURL: endpoint,
        httpsAgent: sslVerify ? undefined : new (require('https').Agent)({ rejectUnauthorized: false }),
        timeout: (this.connectionConfig.timeout || 30) * 1000
      });

      // Authenticate and get session key
      const authResponse = await this.client.post('/services/auth/login', null, {
        params: {
          username: credentials.username,
          password: credentials.password
        }
      });

      // Extract session key from response
      const sessionKeyMatch = authResponse.data.match(/<sessionKey>([^<]+)<\/sessionKey>/);
      if (!sessionKeyMatch) {
        throw new Error('Failed to extract session key from Splunk response');
      }

      this.sessionKey = sessionKeyMatch[1];
      this.client.defaults.headers.common['Authorization'] = `Splunk ${this.sessionKey}`;
      
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
      if (this.client && this.sessionKey) {
        await this.client.delete('/services/authentication/httpauth-tokens/' + this.sessionKey);
      }
      
      this.client = null;
      this.sessionKey = null;
      this.isConnected = false;
      
      await this.emitEvent('integration.disconnected', { integrationId: this.integration.id });
    } catch (error) {
      // Log error but don't throw - disconnection should always succeed
      console.error('Error during Splunk disconnect:', error);
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      if (!this.client || !this.sessionKey) {
        return false;
      }

      const response = await this.client.get('/services/server/info');
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

      // Build search query based on filter
      const searchQuery = this.buildSearchQuery(filter);
      
      // Execute search
      const events = await this.executeSearch(searchQuery);
      
      // Process events
      for (const event of events) {
        const siemEvent = this.transformToSIEMEvent(event);
        await this.processSIEMEvent(siemEvent);
      }

      // Update last sync time
      this.integration.lastSync = new Date();
      
      await this.emitEvent('sync.completed', {
        integrationId: this.integration.id,
        eventsProcessed: events.length
      });
    } catch (error) {
      const toolError = this.handleError(error);
      await this.emitEvent('sync.failed', toolError);
      throw toolError;
    }
  }

  async createAlert(rule: CorrelationRule): Promise<string> {
    if (!this.client) {
      throw new Error('Not connected to Splunk');
    }

    try {
      const savedSearch: SplunkSavedSearch = {
        name: rule.name,
        search: rule.query,
        cronSchedule: `*/${rule.timeWindow} * * * *`,
        alertActions: rule.actions.map(a => this.mapActionToSplunk(a.type)),
        alertThreshold: rule.threshold,
        alertComparator: 'greater than'
      };

      const response = await this.client.post('/services/saved/searches', null, {
        params: {
          name: savedSearch.name,
          search: savedSearch.search,
          cron_schedule: savedSearch.cronSchedule,
          is_scheduled: 1,
          alert_threshold: savedSearch.alertThreshold,
          alert_comparator: savedSearch.alertComparator,
          'action.email': rule.actions.some(a => a.type === 'email') ? 1 : 0,
          'action.webhook': rule.actions.some(a => a.type === 'webhook') ? 1 : 0
        }
      });

      return response.data.name;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async searchEvents(query: string, timeRange?: { start: Date; end: Date }): Promise<SIEMEvent[]> {
    if (!this.client) {
      throw new Error('Not connected to Splunk');
    }

    try {
      const searchQuery = timeRange
        ? `${query} earliest="${this.formatSplunkTime(timeRange.start)}" latest="${this.formatSplunkTime(timeRange.end)}"`
        : query;

      const events = await this.executeSearch(searchQuery);
      return events.map(event => this.transformToSIEMEvent(event));
    } catch (error) {
      throw this.handleError(error);
    }
  }

  private async executeSearch(query: string): Promise<any[]> {
    if (!this.client) {
      throw new Error('Not connected to Splunk');
    }

    // Rate limit searches
    await this.rateLimit('search', 1000);

    // Create search job
    const jobResponse = await this.client.post('/services/search/jobs', null, {
      params: {
        search: `search ${query}`,
        output_mode: 'json'
      }
    });

    const jobId = jobResponse.data.sid;

    // Poll for job completion
    let jobComplete = false;
    while (!jobComplete) {
      const statusResponse = await this.client.get(`/services/search/jobs/${jobId}`, {
        params: { output_mode: 'json' }
      });

      const jobStatus = statusResponse.data.entry[0].content;
      jobComplete = jobStatus.isDone;

      if (!jobComplete) {
        await this.sleep(1000);
      }
    }

    // Get results
    const resultsResponse = await this.client.get(`/services/search/jobs/${jobId}/results`, {
      params: {
        output_mode: 'json',
        count: 10000 // Maximum results
      }
    });

    return resultsResponse.data.results || [];
  }

  private buildSearchQuery(filter?: SyncFilter): string {
    let query = 'index=* OR index=_*';

    if (filter) {
      if (filter.timeRange) {
        query += ` earliest="${this.formatSplunkTime(filter.timeRange.start)}"`;
        query += ` latest="${this.formatSplunkTime(filter.timeRange.end)}"`;
      }

      if (filter.severities && filter.severities.length > 0) {
        const severityConditions = filter.severities
          .map(sev => `severity="${sev}"`)
          .join(' OR ');
        query += ` AND (${severityConditions})`;
      }

      if (filter.categories && filter.categories.length > 0) {
        const categoryConditions = filter.categories
          .map(cat => `category="${cat}"`)
          .join(' OR ');
        query += ` AND (${categoryConditions})`;
      }

      if (filter.tags && filter.tags.length > 0) {
        const tagConditions = filter.tags
          .map(tag => `tag="${tag}"`)
          .join(' OR ');
        query += ` AND (${tagConditions})`;
      }
    }

    return query;
  }

  private transformToSIEMEvent(splunkEvent: any): SIEMEvent {
    const severity = this.mapSeverity(
      splunkEvent.severity || splunkEvent.level || 'info'
    );

    return {
      id: splunkEvent._cd || this.generateEventId(),
      timestamp: new Date(splunkEvent._time),
      source: 'splunk',
      eventType: splunkEvent.eventtype || 'unknown',
      severity,
      title: splunkEvent.summary || splunkEvent.message || 'Splunk Event',
      description: splunkEvent._raw || '',
      category: splunkEvent.category || 'security',
      subcategory: splunkEvent.subcategory,
      sourceIP: splunkEvent.src_ip || splunkEvent.src,
      destinationIP: splunkEvent.dest_ip || splunkEvent.dest,
      sourcePort: parseInt(splunkEvent.src_port) || 0,
      destinationPort: parseInt(splunkEvent.dest_port) || 0,
      protocol: splunkEvent.protocol,
      user: splunkEvent.user || splunkEvent.username,
      host: splunkEvent.host,
      threatIndicators: this.extractThreatIndicators(splunkEvent),
      mitreAttackTechniques: this.extractMitreTechniques(splunkEvent),
      rawEvent: splunkEvent,
      status: 'new'
    };
  }

  private extractThreatIndicators(event: any): any[] {
    const indicators: any[] = [];

    // Extract IPs
    const ipPattern = /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g;
    const ips = (event._raw || '').match(ipPattern) || [];
    ips.forEach((ip: string) => {
      indicators.push({
        type: 'ip',
        value: ip,
        confidence: 80,
        source: 'splunk',
        lastSeen: new Date()
      });
    });

    // Extract domains
    const domainPattern = /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]\b/gi;
    const domains = (event._raw || '').match(domainPattern) || [];
    domains.forEach((domain: string) => {
      indicators.push({
        type: 'domain',
        value: domain,
        confidence: 70,
        source: 'splunk',
        lastSeen: new Date()
      });
    });

    return indicators;
  }

  private extractMitreTechniques(event: any): string[] {
    // Look for MITRE ATT&CK technique IDs (T####)
    const techniquePattern = /T\d{4}(\.\d{3})?/g;
    const matches = (event._raw || '').match(techniquePattern) || [];
    
    return [...new Set(matches as string[])]; // Remove duplicates
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

  private formatSplunkTime(date: Date): string {
    return Math.floor(date.getTime() / 1000).toString();
  }

  private mapActionToSplunk(actionType: string): string {
    const actionMap: Record<string, string> = {
      'email': 'email',
      'webhook': 'webhook',
      'script': 'script',
      'alert': 'alert'
    };
    
    return actionMap[actionType] || 'alert';
  }


  // Additional Splunk-specific methods
  async createDashboard(name: string, definition: any): Promise<string> {
    if (!this.client) {
      throw new Error('Not connected to Splunk');
    }

    try {
      const response = await this.client.post('/servicesNS/nobody/search/data/ui/views', null, {
        params: {
          name,
          'eai:data': JSON.stringify(definition)
        }
      });

      return response.data.name;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getIndexes(): Promise<string[]> {
    if (!this.client) {
      throw new Error('Not connected to Splunk');
    }

    try {
      const response = await this.client.get('/services/data/indexes', {
        params: { output_mode: 'json' }
      });

      return response.data.entry.map((entry: any) => entry.name);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async createIndex(name: string, config?: any): Promise<void> {
    if (!this.client) {
      throw new Error('Not connected to Splunk');
    }

    try {
      await this.client.post('/services/data/indexes', null, {
        params: {
          name,
          ...config
        }
      });
    } catch (error) {
      throw this.handleError(error);
    }
  }
}