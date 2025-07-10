// Note: AWS SDK would be installed via: npm install @aws-sdk/client-securityhub
// For testing, we'll mock the imports
const {
  SecurityHubClient,
  GetFindingsCommand,
  BatchUpdateFindingsCommand,
  CreateInsightCommand,
  EnableSecurityHubCommand,
  DescribeStandardsCommand,
  BatchEnableStandardsCommand
} = {} as any;
import { BaseSecurityToolAdapter } from '../base.adapter';
import {
  AWSSecurityHubIntegration,
  CloudSecurityFinding,
  SyncFilter,
  SeverityLevel,
  CloudRemediation,
  ThreatIntelligence
} from '../../types/security-tools';

export class AWSSecurityHubAdapter extends BaseSecurityToolAdapter {
  private client: any | null = null;
  private regions: string[] = [];

  constructor(integration: AWSSecurityHubIntegration) {
    super(integration);
    this.regions = integration.cloudConfig.regions || ['us-east-1'];
  }

  async connect(): Promise<void> {
    try {
      const { credentials } = this.connectionConfig;
      
      // Create Security Hub client for primary region
      this.client = new SecurityHubClient({
        region: this.regions[0],
        credentials: {
          accessKeyId: credentials.accessKeyId,
          secretAccessKey: credentials.secretAccessKey,
          sessionToken: credentials.sessionToken
        }
      });

      // Enable Security Hub if not already enabled
      try {
        await this.client.send(new EnableSecurityHubCommand({}));
      } catch (error: any) {
        // Ignore if already enabled
        if (!error.message?.includes('already enabled')) {
          throw error;
        }
      }

      // Enable configured standards
      await this.enableStandards();
      
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
      console.error('Error during AWS Security Hub disconnect:', error);
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      if (!this.client) {
        return false;
      }

      await this.client.send(new DescribeStandardsCommand({}));
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

      // Process findings for each region
      for (const region of this.regions) {
        await this.syncRegion(region, filter);
      }

      // Update last sync time
      this.integration.lastSync = new Date();
      
      await this.emitEvent('sync.completed', {
        integrationId: this.integration.id,
        regionsProcessed: this.regions.length
      });
    } catch (error) {
      const toolError = this.handleError(error);
      await this.emitEvent('sync.failed', toolError);
      throw toolError;
    }
  }

  private async syncRegion(region: string, filter?: SyncFilter): Promise<void> {
    // Create regional client
    const regionalClient = new SecurityHubClient({
      region,
      credentials: (this.client as any).config.credentials
    });

    const findingFilters = this.buildFindingFilters(filter);
    let nextToken: string | undefined;
    let totalFindings = 0;

    do {
      const command = new GetFindingsCommand({
        Filters: findingFilters,
        NextToken: nextToken,
        MaxResults: 100
      });

      const response = await regionalClient.send(command);
      
      for (const finding of response.Findings || []) {
        await this.processFinding(finding, region);
        totalFindings++;
      }

      nextToken = response.NextToken;
    } while (nextToken);

    console.log(`Processed ${totalFindings} findings in region ${region}`);
  }

  private async processFinding(awsFinding: any, region: string): Promise<void> {
    const finding: any = {
      id: `aws-${awsFinding.Id}`,
      findingId: awsFinding.Id,
      platform: 'aws',
      title: awsFinding.Title,
      description: awsFinding.Description,
      severity: this.mapAWSSeverity(awsFinding.Severity?.Label),
      confidence: awsFinding.Confidence || 100,
      resourceType: awsFinding.Resources?.[0]?.Type || 'Unknown',
      resourceId: awsFinding.Resources?.[0]?.Id || 'Unknown',
      resourceName: awsFinding.Resources?.[0]?.Details?.AwsEc2Instance?.InstanceId || 
                    awsFinding.Resources?.[0]?.Details?.AwsS3Bucket?.Name ||
                    awsFinding.Resources?.[0]?.Id,
      region,
      accountId: awsFinding.AwsAccountId,
      complianceStatus: this.mapComplianceStatus(awsFinding.Compliance?.Status) || 'not-applicable',
      complianceStandards: awsFinding.Compliance?.RelatedRequirements || [],
      controlId: awsFinding.Compliance?.SecurityControlId,
      category: awsFinding.Types?.[0] || 'Unknown',
      threatIntelligence: this.extractThreatIntelligence(awsFinding) || {
        indicatorType: 'unknown',
        indicatorValue: '',
        source: 'aws-security-hub',
        confidence: 0,
        lastObserved: new Date()
      },
      remediation: this.extractRemediation(awsFinding) || {
        description: 'No remediation available',
        recommendation: '',
        automationAvailable: false,
        estimatedCost: 0,
        impact: '',
        steps: []
      },
      createdAt: new Date(awsFinding.CreatedAt),
      updatedAt: new Date(awsFinding.UpdatedAt),
      resolvedAt: awsFinding.RecordState === 'ARCHIVED' ? new Date(awsFinding.UpdatedAt) : undefined,
      status: awsFinding.RecordState === 'ACTIVE' ? 'active' : 'resolved',
      workflowStatus: awsFinding.WorkflowState
    };

    // Apply field mappings
    const mappedFinding = this.applyFieldMappings(finding);
    
    // Emit event for processing
    await this.emitEvent('finding.created', {
      integrationId: this.integration.id,
      finding: mappedFinding,
      region
    });
  }

  private buildFindingFilters(filter?: SyncFilter): any {
    const filters: any = {
      RecordState: [{ Value: 'ACTIVE', Comparison: 'EQUALS' }]
    };

    if (filter) {
      if (filter.timeRange) {
        filters.CreatedAt = [{
          Start: filter.timeRange.start.toISOString(),
          End: filter.timeRange.end.toISOString()
        }];
      }

      if (filter.severities && filter.severities.length > 0) {
        filters.SeverityLabel = filter.severities.map(sev => ({
          Value: this.mapSeverityToAWS(sev),
          Comparison: 'EQUALS'
        }));
      }

      if (filter.categories && filter.categories.length > 0) {
        filters.Type = filter.categories.map(cat => ({
          Value: cat,
          Comparison: 'PREFIX'
        }));
      }
    }

    // Add account filter if specified
    const awsConfig = (this.integration as AWSSecurityHubIntegration).awsConfig;
    if (awsConfig.accounts && awsConfig.accounts.length > 0) {
      filters.AwsAccountId = awsConfig.accounts.map(acc => ({
        Value: acc.accountId,
        Comparison: 'EQUALS'
      }));
    }

    return filters;
  }

  private mapAWSSeverity(awsSeverity?: string): SeverityLevel {
    switch (awsSeverity?.toUpperCase()) {
      case 'CRITICAL': return 'critical';
      case 'HIGH': return 'high';
      case 'MEDIUM': return 'medium';
      case 'LOW': return 'low';
      case 'INFORMATIONAL': return 'info';
      default: return 'medium';
    }
  }

  private mapSeverityToAWS(severity: SeverityLevel): string {
    switch (severity) {
      case 'critical': return 'CRITICAL';
      case 'high': return 'HIGH';
      case 'medium': return 'MEDIUM';
      case 'low': return 'LOW';
      case 'info': return 'INFORMATIONAL';
      default: return 'MEDIUM';
    }
  }

  private mapComplianceStatus(status?: string): 'compliant' | 'non-compliant' | 'not-applicable' | undefined {
    switch (status?.toUpperCase()) {
      case 'PASSED': return 'compliant';
      case 'FAILED': return 'non-compliant';
      case 'NOT_AVAILABLE': return 'not-applicable';
      default: return undefined;
    }
  }

  private extractThreatIntelligence(finding: any): ThreatIntelligence | undefined {
    if (!finding.ThreatIntelIndicators || finding.ThreatIntelIndicators.length === 0) {
      return undefined;
    }

    const indicator = finding.ThreatIntelIndicators[0];
    return {
      indicatorType: indicator.Type,
      indicatorValue: indicator.Value,
      source: indicator.Source,
      confidence: indicator.Confidence || 100,
      lastObserved: new Date(indicator.LastObservedAt || finding.UpdatedAt),
      relatedFindings: finding.RelatedFindings?.map((f: any) => f.Id) || []
    };
  }

  private extractRemediation(finding: any): CloudRemediation | undefined {
    const remediation = finding.Remediation?.Recommendation;
    if (!remediation) {
      return undefined;
    }

    return {
      description: remediation.Text || 'No description available',
      recommendation: remediation.Url || remediation.Text || '',
      automationAvailable: false, // AWS doesn't provide this directly
      estimatedCost: 0,
      impact: finding.Severity?.Product?.toString(),
      steps: remediation.Text ? [remediation.Text] : []
    };
  }

  private async enableStandards(): Promise<void> {
    if (!this.client) {
      return;
    }

    const awsConfig = (this.integration as AWSSecurityHubIntegration).awsConfig;
    const enabledStandards = awsConfig.standards.filter(s => s.enabled);

    if (enabledStandards.length === 0) {
      return;
    }

    try {
      await this.client.send(new BatchEnableStandardsCommand({
        StandardsSubscriptionRequests: enabledStandards.map(s => ({
          StandardsArn: s.standardArn
        }))
      }));
    } catch (error) {
      console.error('Error enabling standards:', error);
    }
  }

  // AWS-specific methods
  async updateFindingStatus(
    findingId: string,
    status: 'NEW' | 'NOTIFIED' | 'RESOLVED' | 'SUPPRESSED',
    note?: string
  ): Promise<void> {
    if (!this.client) {
      throw new Error('Not connected to AWS Security Hub');
    }

    try {
      const updates: any = {
        RecordState: status === 'RESOLVED' ? 'ARCHIVED' : 'ACTIVE',
        WorkflowState: status
      };

      if (note) {
        updates.Note = {
          Text: note,
          UpdatedBy: 'threat-modeling-platform'
        };
      }

      await this.client.send(new BatchUpdateFindingsCommand({
        FindingIdentifiers: [{ Id: findingId, ProductArn: (this.integration as AWSSecurityHubIntegration).awsConfig.productArn }],
        ...updates
      }));
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async createCustomInsight(name: string, filters: any, groupBy: string): Promise<string> {
    if (!this.client) {
      throw new Error('Not connected to AWS Security Hub');
    }

    try {
      const response = await this.client.send(new CreateInsightCommand({
        Name: name,
        Filters: filters,
        GroupByAttribute: groupBy
      }));

      return response.InsightArn || '';
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getAccountFindings(accountId: string): Promise<CloudSecurityFinding[]> {
    const findings: CloudSecurityFinding[] = [];

    for (const region of this.regions) {
      const regionalClient = new SecurityHubClient({
        region,
        credentials: (this.client as any).config.credentials
      });

      const response = await regionalClient.send(new GetFindingsCommand({
        Filters: {
          AwsAccountId: [{ Value: accountId, Comparison: 'EQUALS' }],
          RecordState: [{ Value: 'ACTIVE', Comparison: 'EQUALS' }]
        }
      }));

      for (const finding of response.Findings || []) {
        findings.push(await this.transformFinding(finding, region));
      }
    }

    return findings;
  }

  private async transformFinding(awsFinding: any, region: string): Promise<CloudSecurityFinding> {
    // Reuse the processing logic
    const finding = {} as CloudSecurityFinding;
    await this.processFinding(awsFinding, region);
    return finding;
  }

  async enableAutomatedResponse(findingType: string, action: string): Promise<void> {
    // This would integrate with AWS Systems Manager or Lambda for automated responses
    // Implementation depends on specific automation requirements
    console.log(`Enabling automated response for ${findingType} with action ${action}`);
  }
}