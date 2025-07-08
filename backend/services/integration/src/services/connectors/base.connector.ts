import { 
  Integration, 
  IntegrationCredentials, 
  ExternalItem,
  TestConnectionResponse,
  SyncResult,
  IntegrationProvider 
} from '../../types/integration';
import { logger } from '../../utils/logger';
import { IntegrationError } from '../../middleware/error-handler';

export abstract class BaseConnector {
  protected integration: Integration;
  protected credentials: IntegrationCredentials;

  constructor(integration: Integration, credentials: IntegrationCredentials) {
    this.integration = integration;
    this.credentials = credentials;
  }

  abstract get provider(): IntegrationProvider;

  abstract testConnection(): Promise<TestConnectionResponse>;

  abstract createItem(
    title: string,
    description: string,
    metadata?: Record<string, any>
  ): Promise<ExternalItem>;

  abstract updateItem(
    externalId: string,
    updates: Partial<ExternalItem>
  ): Promise<ExternalItem>;

  abstract getItem(externalId: string): Promise<ExternalItem>;

  abstract listItems(filter?: any): Promise<ExternalItem[]>;

  abstract deleteItem?(externalId: string): Promise<void>;

  abstract syncItem(
    threatModel: any,
    externalId?: string
  ): Promise<{ externalId: string; url: string }>;

  abstract setupWebhook?(): Promise<string>;
  abstract removeWebhook?(): Promise<void>;

  protected handleError(error: any, operation: string): never {
    logger.error(`${this.provider} connector error during ${operation}:`, {
      integration: this.integration.id,
      error: error.message || error,
      stack: error.stack,
    });

    if (error.response) {
      // HTTP error from external service
      const status = error.response.status;
      const message = error.response.data?.message || error.response.statusText;
      
      if (status === 401 || status === 403) {
        throw new IntegrationError(
          this.provider,
          'Authentication failed. Please check your credentials.',
          { status, message }
        );
      } else if (status === 404) {
        throw new IntegrationError(
          this.provider,
          'Resource not found',
          { status, message }
        );
      } else if (status === 429) {
        throw new IntegrationError(
          this.provider,
          'Rate limit exceeded. Please try again later.',
          { status, message }
        );
      } else if (status >= 500) {
        throw new IntegrationError(
          this.provider,
          'External service error. Please try again later.',
          { status, message }
        );
      }
    }

    throw new IntegrationError(
      this.provider,
      `Failed to ${operation}: ${error.message || 'Unknown error'}`,
      { originalError: error.toString() }
    );
  }

  protected async makeRequest<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      this.handleError(error, operationName);
    }
  }

  async performSync(threatModels: any[]): Promise<SyncResult> {
    const result: SyncResult = {
      success: true,
      itemsSynced: 0,
      itemsFailed: 0,
      errors: [],
      duration: 0,
    };

    const startTime = Date.now();

    for (const threatModel of threatModels) {
      try {
        await this.syncItem(threatModel);
        result.itemsSynced++;
      } catch (error: any) {
        result.itemsFailed++;
        result.errors.push({
          item: threatModel.id,
          error: error.message || 'Unknown error',
        });
        logger.error('Failed to sync threat model:', {
          threatModelId: threatModel.id,
          integration: this.integration.id,
          error,
        });
      }
    }

    result.duration = Date.now() - startTime;
    result.success = result.itemsFailed === 0;

    return result;
  }

  protected formatThreatModelForExternal(threatModel: any): {
    title: string;
    description: string;
    metadata: Record<string, any>;
  } {
    return {
      title: `Threat Model: ${threatModel.name}`,
      description: this.generateDescription(threatModel),
      metadata: {
        threatModelId: threatModel.id,
        version: threatModel.version,
        methodology: threatModel.methodology,
        createdAt: threatModel.createdAt,
        updatedAt: threatModel.updatedAt,
      },
    };
  }

  private generateDescription(threatModel: any): string {
    const sections = [
      `**Project:** ${threatModel.projectName || 'N/A'}`,
      `**Description:** ${threatModel.description || 'No description provided'}`,
      `**Methodology:** ${threatModel.methodology || 'STRIDE'}`,
      `**Version:** ${threatModel.version || '1.0'}`,
      '',
      '## Summary',
      `- Components: ${threatModel.components?.length || 0}`,
      `- Data Flows: ${threatModel.dataFlows?.length || 0}`,
      `- Threats Identified: ${threatModel.threats?.length || 0}`,
      `- Mitigations: ${threatModel.mitigations?.length || 0}`,
    ];

    if (threatModel.threats?.length > 0) {
      sections.push('', '## Top Threats');
      threatModel.threats.slice(0, 5).forEach((threat: any, index: number) => {
        sections.push(`${index + 1}. **${threat.title}** - ${threat.severity || 'Unknown'} severity`);
      });
    }

    return sections.join('\n');
  }
}