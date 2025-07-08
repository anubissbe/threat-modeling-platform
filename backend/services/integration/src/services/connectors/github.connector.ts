import { Octokit } from '@octokit/rest';
import { BaseConnector } from './base.connector';
import { 
  Integration, 
  IntegrationCredentials, 
  TokenCredentials,
  ExternalItem,
  TestConnectionResponse,
  IntegrationProvider,
  GitHubConfig 
} from '../../types/integration';
import { generateWebhookSecret } from '../../utils/encryption';
import { logger } from '../../utils/logger';

export class GitHubConnector extends BaseConnector {
  private octokit: Octokit;
  private config: GitHubConfig;

  constructor(integration: Integration, credentials: IntegrationCredentials) {
    super(integration, credentials);
    this.config = integration.config as GitHubConfig;
    
    const tokenCreds = credentials as TokenCredentials;
    this.octokit = new Octokit({
      auth: tokenCreds.token,
      baseUrl: this.config.baseUrl || 'https://api.github.com',
    });
  }

  get provider(): IntegrationProvider {
    return IntegrationProvider.GITHUB;
  }

  async testConnection(): Promise<TestConnectionResponse> {
    return this.makeRequest(async () => {
      const { data: user } = await this.octokit.users.getAuthenticated();
      const { data: repo } = await this.octokit.repos.get({
        owner: this.config.owner,
        repo: this.config.repo,
      });

      return {
        success: true,
        message: 'Successfully connected to GitHub',
        details: {
          user: user.login,
          repository: repo.full_name,
          permissions: repo.permissions,
        },
      };
    }, 'test connection');
  }

  async createItem(
    title: string,
    description: string,
    metadata?: Record<string, any>
  ): Promise<ExternalItem> {
    return this.makeRequest(async () => {
      const labels = metadata?.['labels'] || this.config['labels'] || ['threat-model'];
      
      const { data: issue } = await this.octokit.issues.create({
        owner: this.config.owner,
        repo: this.config.repo,
        title,
        body: description,
        labels,
      });

      return this.mapIssueToExternalItem(issue);
    }, 'create issue');
  }

  async updateItem(
    externalId: string,
    updates: Partial<ExternalItem>
  ): Promise<ExternalItem> {
    return this.makeRequest(async () => {
      const issueNumber = parseInt(externalId);
      
      const updateData: any = {
        owner: this.config.owner,
        repo: this.config.repo,
        issue_number: issueNumber,
      };
      
      if (updates.title !== undefined) {
        updateData.title = updates.title;
      }
      if (updates.description !== undefined) {
        updateData.body = updates.description;
      }
      if (updates.status !== undefined) {
        updateData.state = this.mapStatusToGitHub(updates.status);
      }
      
      const { data: issue } = await this.octokit.issues.update(updateData);

      return this.mapIssueToExternalItem(issue);
    }, 'update issue');
  }

  async getItem(externalId: string): Promise<ExternalItem> {
    return this.makeRequest(async () => {
      const issueNumber = parseInt(externalId);
      
      const { data: issue } = await this.octokit.issues.get({
        owner: this.config.owner,
        repo: this.config.repo,
        issue_number: issueNumber,
      });

      return this.mapIssueToExternalItem(issue);
    }, 'get issue');
  }

  async deleteItem(externalId: string): Promise<void> {
    return this.makeRequest(async () => {
      const issueNumber = parseInt(externalId);
      
      // GitHub doesn't allow deleting issues, so we'll close it instead
      await this.octokit.issues.update({
        owner: this.config.owner,
        repo: this.config.repo,
        issue_number: issueNumber,
        state: 'closed',
        state_reason: 'not_planned',
      });
    }, 'delete (close) issue');
  }

  async listItems(filter?: any): Promise<ExternalItem[]> {
    return this.makeRequest(async () => {
      const labels = filter?.labels || this.config['labels']?.join(',') || 'threat-model';
      
      const { data: issues } = await this.octokit.issues.listForRepo({
        owner: this.config.owner,
        repo: this.config.repo,
        labels,
        state: 'all',
        per_page: 100,
      });

      return issues.map(issue => this.mapIssueToExternalItem(issue));
    }, 'list issues');
  }

  async syncItem(
    threatModel: any,
    externalId?: string
  ): Promise<{ externalId: string; url: string }> {
    const { title, description, metadata } = this.formatThreatModelForExternal(threatModel);

    let item: ExternalItem;
    if (externalId) {
      // Update existing issue
      item = await this.updateItem(externalId, { title, description });
    } else {
      // Create new issue
      item = await this.createItem(title, description, {
        ...metadata,
        labels: this.config['labels'] || ['threat-model'],
      });
    }

    // Add comment with sync information
    await this.makeRequest(async () => {
      await this.octokit.issues.createComment({
        owner: this.config.owner,
        repo: this.config.repo,
        issue_number: parseInt(item.id),
        body: `🔄 Synchronized from Threat Modeling Platform at ${new Date().toISOString()}`,
      });
    }, 'add sync comment');

    return {
      externalId: item.id,
      url: item.url,
    };
  }

  async setupWebhook(): Promise<string> {
    return this.makeRequest(async () => {
      const secret = generateWebhookSecret();
      const webhookUrl = `${this.config.webhookUrl}/webhooks/github/${this.integration.id}`;

      // Check if webhook already exists
      const { data: hooks } = await this.octokit.repos.listWebhooks({
        owner: this.config.owner,
        repo: this.config.repo,
      });

      const existingHook = hooks.find(hook => 
        hook.config?.url === webhookUrl
      );

      if (existingHook) {
        // Update existing webhook
        await this.octokit.repos.updateWebhook({
          owner: this.config.owner,
          repo: this.config.repo,
          hook_id: existingHook.id,
          config: {
            url: webhookUrl,
            content_type: 'json',
            secret,
          } as any,
          events: ['issues', 'issue_comment'],
          active: true,
        });
      } else {
        // Create new webhook
        await this.octokit.repos.createWebhook({
          owner: this.config.owner,
          repo: this.config.repo,
          config: {
            url: webhookUrl,
            content_type: 'json',
            secret,
          } as any,
          events: ['issues', 'issue_comment'],
          active: true,
        });
      }

      logger.info('GitHub webhook configured', {
        integration: this.integration.id,
        repo: `${this.config.owner}/${this.config.repo}`,
      });

      return secret;
    }, 'setup webhook');
  }

  async removeWebhook(): Promise<void> {
    return this.makeRequest(async () => {
      const webhookUrl = `${this.config.webhookUrl}/webhooks/github/${this.integration.id}`;

      const { data: hooks } = await this.octokit.repos.listWebhooks({
        owner: this.config.owner,
        repo: this.config.repo,
      });

      const hook = hooks.find(h => h.config?.url === webhookUrl);
      if (hook) {
        await this.octokit.repos.deleteWebhook({
          owner: this.config.owner,
          repo: this.config.repo,
          hook_id: hook.id,
        });

        logger.info('GitHub webhook removed', {
          integration: this.integration.id,
          repo: `${this.config.owner}/${this.config.repo}`,
        });
      }
    }, 'remove webhook');
  }

  private mapIssueToExternalItem(issue: any): ExternalItem {
    return {
      id: issue.number.toString(),
      title: issue.title,
      description: issue.body || '',
      status: issue.state,
      url: issue.html_url,
      metadata: {
        labels: issue.labels.map((l: any) => l.name),
        assignees: issue.assignees.map((a: any) => a.login),
        milestone: issue.milestone?.title,
      },
      createdAt: new Date(issue.created_at),
      updatedAt: new Date(issue.updated_at),
    };
  }

  private mapStatusToGitHub(status?: string): 'open' | 'closed' | undefined {
    if (!status) return undefined;
    return status === 'closed' ? 'closed' : 'open';
  }
}