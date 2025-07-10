// Note: Jira client would be installed via: npm install jira-client @types/jira-client
// For testing, we'll mock the import
const JiraClient = class {} as any;
import { BaseSecurityToolAdapter } from '../base.adapter';
import {
  TicketingIntegration,
  SecurityTicket,
  SyncFilter,
  TicketComment,
  TicketAttachment,
  TicketHistoryEntry,
  SeverityLevel
} from '../../types/security-tools';

export class JiraAdapter extends BaseSecurityToolAdapter {
  private client: any | null = null;
  private customFieldMap: Map<string, string> = new Map();

  constructor(integration: TicketingIntegration) {
    super(integration);
  }

  async connect(): Promise<void> {
    try {
      const { endpoint, credentials, authType } = this.connectionConfig;
      
      const [protocol, hostAndPath] = endpoint.split('://');
      const [host, ...pathParts] = (hostAndPath || '').split('/');
      
      const config: any = {
        protocol: protocol as 'http' | 'https',
        host,
        strictSSL: this.connectionConfig.sslVerify !== false
      };

      if (pathParts.length > 0) {
        config.base = pathParts.join('/');
      }

      // Configure authentication
      if (authType === 'basic') {
        config.username = credentials.username;
        config.password = credentials.password;
      } else if (authType === 'token' || authType === 'api-key') {
        config.username = credentials.email || credentials.username;
        config.password = credentials.apiToken || credentials.token;
      } else if (authType === 'oauth2') {
        config.oauth = {
          consumer_key: credentials.consumerKey,
          consumer_secret: credentials.consumerSecret,
          access_token: credentials.accessToken,
          access_token_secret: credentials.accessTokenSecret
        };
      }

      this.client = new JiraClient(config);
      
      // Test connection and load custom fields
      await this.loadCustomFields();
      
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
      this.customFieldMap.clear();
      this.isConnected = false;
      
      await this.emitEvent('integration.disconnected', { integrationId: this.integration.id });
    } catch (error) {
      console.error('Error during Jira disconnect:', error);
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      if (!this.client) {
        return false;
      }

      await this.client.getCurrentUser();
      return true;
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

      // Build JQL query
      const jql = this.buildJQLQuery(filter);
      
      // Search for issues
      const issues = await this.searchIssues(jql);
      
      // Process each issue
      for (const issue of issues) {
        await this.processIssue(issue);
      }

      // Update last sync time
      this.integration.lastSync = new Date();
      
      await this.emitEvent('sync.completed', {
        integrationId: this.integration.id,
        ticketsProcessed: issues.length
      });
    } catch (error) {
      const toolError = this.handleError(error);
      await this.emitEvent('sync.failed', toolError);
      throw toolError;
    }
  }

  async createTicket(ticketData: any): Promise<string> {
    if (!this.client) {
      throw new Error('Not connected to Jira');
    }

    try {
      // Map to Jira issue format
      const issueData = await this.mapToJiraIssue(ticketData);
      
      // Create issue
      const response = await this.client.addNewIssue(issueData);
      
      // Create linked ticket record
      const ticket: SecurityTicket = {
        id: `jira-${response.id}`,
        externalId: response.key,
        platform: 'jira',
        title: ticketData.title,
        description: ticketData.description,
        type: issueData.fields.issuetype.name,
        priority: issueData.fields.priority?.name || 'Medium',
        severity: this.mapPriorityToSeverity(issueData.fields.priority?.name),
        assignee: issueData.fields.assignee?.name,
        reporter: issueData.fields.reporter.name,
        status: response.fields.status.name,
        linkedThreats: ticketData.linkedThreats || [],
        linkedVulnerabilities: ticketData.linkedVulnerabilities || [],
        linkedFindings: ticketData.linkedFindings || [],
        linkedTickets: [],
        createdAt: new Date(response.fields.created),
        updatedAt: new Date(response.fields.updated),
        dueDate: response.fields.duedate ? new Date(response.fields.duedate) : undefined,
        customFields: this.extractCustomFields(response.fields),
        comments: [],
        attachments: [],
        history: []
      };

      await this.emitEvent('ticket.created', {
        integrationId: this.integration.id,
        ticket
      });

      return response.key;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async updateTicket(ticketId: string, updates: any): Promise<void> {
    if (!this.client) {
      throw new Error('Not connected to Jira');
    }

    try {
      const updateData: any = { fields: {} };

      // Map updates to Jira fields
      if (updates.title) {
        updateData.fields.summary = updates.title;
      }
      if (updates.description) {
        updateData.fields.description = updates.description;
      }
      if (updates.priority) {
        updateData.fields.priority = { name: updates.priority };
      }
      if (updates.assignee) {
        updateData.fields.assignee = { name: updates.assignee };
      }
      if (updates.dueDate) {
        updateData.fields.duedate = updates.dueDate;
      }

      // Handle custom fields
      if (updates.customFields) {
        for (const [key, value] of Object.entries(updates.customFields)) {
          const customFieldId = this.customFieldMap.get(key);
          if (customFieldId) {
            updateData.fields[customFieldId] = value;
          }
        }
      }

      await this.client.updateIssue(ticketId, updateData);

      await this.emitEvent('ticket.updated', {
        integrationId: this.integration.id,
        ticketId,
        updates
      });
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async addComment(ticketId: string, comment: string, internal: boolean = false): Promise<void> {
    if (!this.client) {
      throw new Error('Not connected to Jira');
    }

    try {
      const commentData: any = {
        body: comment
      };

      if (internal) {
        // In Jira, internal comments are typically handled via visibility restrictions
        commentData.visibility = {
          type: 'group',
          value: 'jira-servicedesk-users'
        };
      }

      await this.client.addComment(ticketId, commentData);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async linkTickets(ticketId: string, linkedTicketId: string, linkType: string = 'Relates'): Promise<void> {
    if (!this.client) {
      throw new Error('Not connected to Jira');
    }

    try {
      await this.client.issueLink({
        type: { name: linkType },
        inwardIssue: { key: ticketId },
        outwardIssue: { key: linkedTicketId }
      });
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async transitionTicket(ticketId: string, transitionName: string): Promise<void> {
    if (!this.client) {
      throw new Error('Not connected to Jira');
    }

    try {
      // Get available transitions
      const transitions = await this.client.listTransitions(ticketId);
      
      // Find the transition by name
      const transition = transitions.transitions.find(
        (t: any) => t.name.toLowerCase() === transitionName.toLowerCase()
      );

      if (!transition) {
        throw new Error(`Transition "${transitionName}" not found for ticket ${ticketId}`);
      }

      // Execute transition
      await this.client.transitionIssue(ticketId, {
        transition: { id: transition.id }
      });
    } catch (error) {
      throw this.handleError(error);
    }
  }

  private async loadCustomFields(): Promise<void> {
    if (!this.client) {
      return;
    }

    try {
      const fields = await this.client.listFields();
      
      for (const field of fields) {
        if (field.custom) {
          this.customFieldMap.set(field.name, field.id);
        }
      }

      // Also map configured custom fields
      const ticketingConfig = (this.integration as TicketingIntegration).ticketingConfig;
      for (const mapping of ticketingConfig.customFields || []) {
        this.customFieldMap.set(mapping.fieldName, mapping.fieldId);
      }
    } catch (error) {
      console.error('Error loading custom fields:', error);
    }
  }

  private async searchIssues(jql: string): Promise<any[]> {
    if (!this.client) {
      throw new Error('Not connected to Jira');
    }

    const issues: any[] = [];
    let startAt = 0;
    const maxResults = 100;
    let total = 0;

    do {
      const response = await this.client.searchJira(jql, {
        startAt,
        maxResults,
        fields: ['*all'],
        expand: ['changelog', 'renderedFields', 'names', 'schema', 'transitions', 'operations', 'editmeta']
      });

      issues.push(...response.issues);
      total = response.total;
      startAt += maxResults;
    } while (startAt < total);

    return issues;
  }

  private buildJQLQuery(filter?: SyncFilter): string {
    const conditions: string[] = [];
    const ticketingConfig = (this.integration as TicketingIntegration).ticketingConfig;

    // Add project filter
    if (ticketingConfig.projects && ticketingConfig.projects.length > 0) {
      const projectKeys = ticketingConfig.projects.map(p => `"${p.projectKey}"`).join(', ');
      conditions.push(`project in (${projectKeys})`);
    }

    if (filter) {
      // Time range filter
      if (filter.timeRange) {
        const startDate = filter.timeRange.start.toISOString().split('T')[0];
        const endDate = filter.timeRange.end.toISOString().split('T')[0];
        conditions.push(`updated >= "${startDate}" AND updated <= "${endDate}"`);
      }

      // Severity/Priority filter
      if (filter.severities && filter.severities.length > 0) {
        const priorities = filter.severities.map(sev => `"${this.mapSeverityToPriority(sev)}"`).join(', ');
        conditions.push(`priority in (${priorities})`);
      }

      // Category filter (using labels or components)
      if (filter.categories && filter.categories.length > 0) {
        const labelConditions = filter.categories.map(cat => `labels = "${cat}"`).join(' OR ');
        conditions.push(`(${labelConditions})`);
      }
    }

    // Default to issues updated in last 30 days if no filter
    if (conditions.length === 0) {
      conditions.push('updated >= -30d');
    }

    return conditions.join(' AND ');
  }

  private async processIssue(jiraIssue: any): Promise<void> {
    const ticket: SecurityTicket = {
      id: `jira-${jiraIssue.id}`,
      externalId: jiraIssue.key,
      platform: 'jira',
      title: jiraIssue.fields.summary,
      description: jiraIssue.fields.description || '',
      type: jiraIssue.fields.issuetype.name,
      priority: jiraIssue.fields.priority?.name || 'Medium',
      severity: this.mapPriorityToSeverity(jiraIssue.fields.priority?.name),
      assignee: jiraIssue.fields.assignee?.displayName,
      reporter: jiraIssue.fields.reporter?.displayName || 'Unknown',
      watchers: jiraIssue.fields.watches?.watchers?.map((w: any) => w.displayName) || [],
      status: jiraIssue.fields.status.name,
      resolution: jiraIssue.fields.resolution?.name,
      linkedThreats: this.extractLinkedItems(jiraIssue, 'threat'),
      linkedVulnerabilities: this.extractLinkedItems(jiraIssue, 'vulnerability'),
      linkedFindings: this.extractLinkedItems(jiraIssue, 'finding'),
      linkedTickets: this.extractLinkedTickets(jiraIssue),
      createdAt: new Date(jiraIssue.fields.created),
      updatedAt: new Date(jiraIssue.fields.updated),
      dueDate: jiraIssue.fields.duedate ? new Date(jiraIssue.fields.duedate) : undefined,
      resolvedAt: jiraIssue.fields.resolutiondate ? new Date(jiraIssue.fields.resolutiondate) : undefined,
      slaStatus: this.extractSLAStatus(jiraIssue),
      timeToResolution: this.calculateTimeToResolution(jiraIssue),
      customFields: this.extractCustomFields(jiraIssue.fields),
      comments: await this.extractComments(jiraIssue),
      attachments: this.extractAttachments(jiraIssue),
      history: this.extractHistory(jiraIssue)
    };

    // Apply field mappings
    const mappedTicket = this.applyFieldMappings(ticket);
    
    // Emit event for processing
    await this.emitEvent('ticket.synced', {
      integrationId: this.integration.id,
      ticket: mappedTicket
    });
  }

  private async mapToJiraIssue(ticketData: any): Promise<any> {
    const ticketingConfig = (this.integration as TicketingIntegration).ticketingConfig;
    
    // Find appropriate project
    const project = ticketingConfig.projects[0]; // Default to first project
    
    // Map issue type
    const issueTypeMapping = ticketingConfig.issueTypes.find(
      mapping => mapping.threatModelType === ticketData.type
    ) || ticketingConfig.issueTypes[0];

    const issueData: any = {
      fields: {
        project: { key: project?.projectKey || 'DEFAULT' },
        summary: ticketData.title,
        description: ticketData.description,
        issuetype: { name: issueTypeMapping?.ticketType || 'Task' }
      }
    };

    // Set priority based on severity
    if (ticketData.severity) {
      issueData.fields.priority = { name: this.mapSeverityToPriority(ticketData.severity) };
    }

    // Set assignee
    if (ticketData.assignee) {
      issueData.fields.assignee = { name: ticketData.assignee };
    }

    // Set due date
    if (ticketData.dueDate) {
      issueData.fields.duedate = ticketData.dueDate;
    }

    // Set custom fields
    if (ticketData.customFields) {
      for (const mapping of ticketingConfig.customFields || []) {
        const value = ticketData.customFields[mapping.threatModelField];
        if (value !== undefined || mapping.required) {
          issueData.fields[mapping.fieldId] = value || mapping.defaultValue;
        }
      }
    }

    // Add labels for linked items
    issueData.fields.labels = [];
    if (ticketData.linkedThreats?.length > 0) {
      issueData.fields.labels.push('threat-model');
    }
    if (ticketData.linkedVulnerabilities?.length > 0) {
      issueData.fields.labels.push('vulnerability');
    }
    if (ticketData.linkedFindings?.length > 0) {
      issueData.fields.labels.push('security-finding');
    }

    return issueData;
  }

  private mapPriorityToSeverity(priority?: string): SeverityLevel {
    const priorityMap: Record<string, SeverityLevel> = {
      'highest': 'critical',
      'high': 'high',
      'medium': 'medium',
      'low': 'low',
      'lowest': 'info'
    };
    
    return priorityMap[priority?.toLowerCase() || ''] || 'medium';
  }

  private mapSeverityToPriority(severity: SeverityLevel): string {
    const severityMap: Record<SeverityLevel, string> = {
      'critical': 'Highest',
      'high': 'High',
      'medium': 'Medium',
      'low': 'Low',
      'info': 'Lowest'
    };
    
    return severityMap[severity] || 'Medium';
  }

  private extractLinkedItems(issue: any, type: string): string[] {
    // Extract from custom fields or labels
    const items: string[] = [];
    
    // Check labels
    if (issue.fields.labels) {
      const prefix = `${type}-`;
      items.push(...issue.fields.labels
        .filter((label: string) => label.startsWith(prefix))
        .map((label: string) => label.substring(prefix.length))
      );
    }
    
    return items;
  }

  private extractLinkedTickets(issue: any): string[] {
    const linkedTickets: string[] = [];
    
    if (issue.fields.issuelinks) {
      for (const link of issue.fields.issuelinks) {
        if (link.outwardIssue) {
          linkedTickets.push(link.outwardIssue.key);
        }
        if (link.inwardIssue) {
          linkedTickets.push(link.inwardIssue.key);
        }
      }
    }
    
    return linkedTickets;
  }

  private extractSLAStatus(issue: any): 'on-track' | 'at-risk' | 'breached' | undefined {
    // This would depend on Jira Service Management fields
    // Simplified implementation
    const dueDate = issue.fields.duedate;
    if (!dueDate) return undefined;
    
    const now = new Date();
    const due = new Date(dueDate);
    const hoursUntilDue = (due.getTime() - now.getTime()) / (1000 * 60 * 60);
    
    if (hoursUntilDue < 0) return 'breached';
    if (hoursUntilDue < 24) return 'at-risk';
    return 'on-track';
  }

  private calculateTimeToResolution(issue: any): number | undefined {
    if (!issue.fields.resolutiondate || !issue.fields.created) {
      return undefined;
    }
    
    const created = new Date(issue.fields.created);
    const resolved = new Date(issue.fields.resolutiondate);
    
    return Math.floor((resolved.getTime() - created.getTime()) / (1000 * 60)); // minutes
  }

  private extractCustomFields(fields: any): Record<string, any> {
    const customFields: Record<string, any> = {};
    
    for (const [fieldId, value] of Object.entries(fields)) {
      if (fieldId.startsWith('customfield_')) {
        // Find the field name from our map
        let fieldName = fieldId;
        for (const [name, id] of this.customFieldMap.entries()) {
          if (id === fieldId) {
            fieldName = name;
            break;
          }
        }
        customFields[fieldName] = value;
      }
    }
    
    return customFields;
  }

  private async extractComments(issue: any): Promise<TicketComment[]> {
    const comments: TicketComment[] = [];
    
    if (issue.fields.comment && issue.fields.comment.comments) {
      for (const comment of issue.fields.comment.comments) {
        comments.push({
          id: comment.id,
          author: comment.author.displayName,
          body: comment.body,
          createdAt: new Date(comment.created),
          updatedAt: comment.updated ? new Date(comment.updated) : undefined,
          internal: comment.visibility ? true : false
        });
      }
    }
    
    return comments;
  }

  private extractAttachments(issue: any): TicketAttachment[] {
    const attachments: TicketAttachment[] = [];
    
    if (issue.fields.attachment) {
      for (const attachment of issue.fields.attachment) {
        attachments.push({
          id: attachment.id,
          filename: attachment.filename,
          size: attachment.size,
          mimeType: attachment.mimeType,
          uploadedBy: attachment.author.displayName,
          uploadedAt: new Date(attachment.created)
        });
      }
    }
    
    return attachments;
  }

  private extractHistory(issue: any): TicketHistoryEntry[] {
    const history: TicketHistoryEntry[] = [];
    
    if (issue.changelog && issue.changelog.histories) {
      for (const historyItem of issue.changelog.histories) {
        for (const item of historyItem.items) {
          history.push({
            id: historyItem.id,
            field: item.field,
            oldValue: item.fromString || item.from,
            newValue: item.toString || item.to,
            changedBy: historyItem.author.displayName,
            changedAt: new Date(historyItem.created)
          });
        }
      }
    }
    
    return history;
  }

  // Additional Jira-specific methods
  async getProjects(): Promise<any[]> {
    if (!this.client) {
      throw new Error('Not connected to Jira');
    }

    try {
      return await this.client.listProjects();
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getIssueTypes(projectKey: string): Promise<any[]> {
    if (!this.client) {
      throw new Error('Not connected to Jira');
    }

    try {
      const project = await this.client.getProject(projectKey);
      return project.issueTypes || [];
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async createWebhook(webhookUrl: string, events: string[]): Promise<string> {
    if (!this.client) {
      throw new Error('Not connected to Jira');
    }

    try {
      // Note: Jira webhooks are typically configured via REST API v2
      const response = await this.client.genericGet('/rest/webhooks/1.0/webhook', {
        name: `threat-modeling-${Date.now()}`,
        url: webhookUrl,
        events,
        filters: {
          'issue-related-events-section': ''
        },
        excludeBody: false
      });

      return response.self;
    } catch (error) {
      throw this.handleError(error);
    }
  }
}