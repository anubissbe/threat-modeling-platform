import { BaseConnector } from './connectors/base.connector';
import { GitHubConnector } from './connectors/github.connector';
import { 
  Integration, 
  IntegrationProvider, 
  IntegrationCredentials 
} from '../types/integration';
import { logger } from '../utils/logger';

export class ConnectorFactory {
  static createConnector(
    integration: Integration,
    credentials: IntegrationCredentials
  ): BaseConnector {
    logger.debug('Creating connector', {
      provider: integration.provider,
      integrationId: integration.id,
    });

    switch (integration.provider) {
      case IntegrationProvider.GITHUB:
        return new GitHubConnector(integration, credentials);
      
      case IntegrationProvider.JIRA:
        // TODO: Implement JiraConnector
        throw new Error('Jira connector not yet implemented');
      
      case IntegrationProvider.GITLAB:
        // TODO: Implement GitLabConnector
        throw new Error('GitLab connector not yet implemented');
      
      case IntegrationProvider.AZURE_DEVOPS:
        // TODO: Implement AzureDevOpsConnector
        throw new Error('Azure DevOps connector not yet implemented');
      
      default:
        throw new Error(`Unknown integration provider: ${integration.provider}`);
    }
  }
}