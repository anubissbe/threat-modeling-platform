import axios from 'axios';
import { NotificationProvider } from './base.provider';
import { BaseNotification, TeamsConfig } from '../types';
import { logger } from '../utils/logger';

export class TeamsProvider extends NotificationProvider {
  readonly type = 'teams' as const;
  protected configuration: TeamsConfig;

  constructor() {
    super();
    this.configuration = this.loadConfiguration();
  }

  private loadConfiguration(): TeamsConfig {
    return {
      webhookUrl: process.env['TEAMS_WEBHOOK_URL'] || '',
    };
  }

  async send(notification: BaseNotification): Promise<void> {
    if (!this.configuration.webhookUrl) {
      throw new Error('Teams webhook URL not configured');
    }

    try {
      const payload = this.buildTeamsPayload(notification);
      
      const response = await this.withTimeout(
        axios.post(this.configuration.webhookUrl, payload, {
          headers: {
            'Content-Type': 'application/json',
          },
        }),
        30000 // 30 second timeout
      );

      if (response.status !== 200) {
        throw new Error(`Teams API error: ${response.status} ${response.statusText}`);
      }

      logger.info(`Teams message sent successfully: ${notification.id}`, {
        channel: notification.channel,
        status: response.status,
      });
    } catch (error) {
      await this.handleProviderError(error, 'Teams message sending');
    }
  }

  private buildTeamsPayload(notification: BaseNotification): any {
    const payload = {
      '@type': 'MessageCard',
      '@context': 'https://schema.org/extensions',
      summary: notification.subject,
      themeColor: this.getThemeColor(notification.priority),
      sections: [
        {
          activityTitle: notification.subject,
          activitySubtitle: this.formatTeamsMessage(notification.message),
          activityImage: this.getActivityImage(notification.metadata.eventType),
          facts: this.buildFacts(notification),
          markdown: true,
        },
      ],
    };

    // Add potential actions
    const actions = this.buildActions(notification);
    if (actions.length > 0) {
      (payload as any).potentialAction = actions;
    }

    return payload;
  }

  private getThemeColor(priority: string): string {
    const colors = {
      urgent: '#FF0000',   // Red
      high: '#FF8C00',     // Orange
      medium: '#1E90FF',   // Blue
      low: '#32CD32',      // Green
    };
    return colors[priority] || colors.medium;
  }

  private getActivityImage(eventType?: string): string {
    const images = {
      'threat_model_created': 'https://img.icons8.com/color/48/000000/new-file.png',
      'threat_identified': 'https://img.icons8.com/color/48/000000/warning-shield.png',
      'threat_mitigated': 'https://img.icons8.com/color/48/000000/security-checked.png',
      'report_generated': 'https://img.icons8.com/color/48/000000/report-card.png',
      'collaboration_invited': 'https://img.icons8.com/color/48/000000/invite.png',
      'system_maintenance': 'https://img.icons8.com/color/48/000000/maintenance.png',
    };
    
    return images[eventType || 'default'] || 'https://img.icons8.com/color/48/000000/notification.png';
  }

  private formatTeamsMessage(message: string): string {
    // Convert basic HTML/markdown to Teams format
    return message
      .replace(/<b>(.*?)<\/b>/g, '**$1**')
      .replace(/<i>(.*?)<\/i>/g, '*$1*')
      .replace(/<code>(.*?)<\/code>/g, '`$1`')
      .replace(/<br\s*\/?>/g, '\n\n')
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&');
  }

  private buildFacts(notification: BaseNotification): any[] {
    const facts = [];

    // Add metadata as facts
    if (notification.metadata.projectName) {
      facts.push({
        name: 'Project',
        value: notification.metadata.projectName,
      });
    }

    if (notification.metadata.creatorName) {
      facts.push({
        name: 'Created by',
        value: notification.metadata.creatorName,
      });
    }

    if (notification.metadata.riskLevel) {
      facts.push({
        name: 'Risk Level',
        value: notification.metadata.riskLevel.toUpperCase(),
      });
    }

    if (notification.priority !== 'medium') {
      facts.push({
        name: 'Priority',
        value: notification.priority.toUpperCase(),
      });
    }

    facts.push({
      name: 'Time',
      value: new Date(notification.createdAt).toLocaleString(),
    });

    return facts;
  }

  private buildActions(notification: BaseNotification): any[] {
    const actions = [];

    // Add view action if URL is provided
    if (notification.metadata.url) {
      actions.push({
        '@type': 'OpenUri',
        name: 'View Details',
        targets: [
          {
            os: 'default',
            uri: notification.metadata.url,
          },
        ],
      });
    }

    // Add download action for reports
    if (notification.metadata.downloadUrl) {
      actions.push({
        '@type': 'OpenUri',
        name: 'Download Report',
        targets: [
          {
            os: 'default',
            uri: notification.metadata.downloadUrl,
          },
        ],
      });
    }

    return actions;
  }

  validateConfiguration(config: Record<string, any>): boolean {
    const requiredFields = ['webhookUrl'];
    
    if (!this.validateRequiredConfig(config, requiredFields)) {
      return false;
    }

    // Validate webhook URL format
    try {
      new URL(config.webhookUrl);
      if (!config.webhookUrl.includes('outlook.office.com')) {
        logger.error('Invalid Teams webhook URL - must be an Office 365 webhook');
        return false;
      }
    } catch (error) {
      logger.error('Invalid Teams webhook URL format');
      return false;
    }

    return true;
  }

  // Test the Teams configuration
  async testConnection(): Promise<boolean> {
    if (!this.configuration.webhookUrl) {
      return false;
    }

    try {
      const testPayload = {
        '@type': 'MessageCard',
        '@context': 'https://schema.org/extensions',
        summary: 'Test Message',
        themeColor: '#1E90FF',
        sections: [
          {
            activityTitle: 'Test Message from Threat Modeling Platform',
            activitySubtitle: 'This is a test message to verify Teams configuration.',
            facts: [
              {
                name: 'Status',
                value: 'Configuration Test',
              },
              {
                name: 'Time',
                value: new Date().toLocaleString(),
              },
            ],
          },
        ],
      };

      const response = await axios.post(this.configuration.webhookUrl, testPayload, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      });

      if (response.status === 200) {
        logger.info('Teams configuration test successful');
        return true;
      } else {
        logger.error('Teams configuration test failed:', response.status);
        return false;
      }
    } catch (error) {
      logger.error('Teams configuration test failed:', error);
      return false;
    }
  }

  // Send test message
  async sendTestMessage(): Promise<boolean> {
    try {
      const testNotification: BaseNotification = {
        id: 'test-teams',
        userId: 'test-user',
        type: 'teams',
        channel: 'test-channel',
        subject: 'Test Message from Threat Modeling Platform',
        message: 'This is a test message to verify Microsoft Teams configuration. If you receive this, the integration is working correctly!',
        metadata: {
          eventType: 'system_test',
        },
        status: 'pending',
        priority: 'medium',
        retryCount: 0,
        maxRetries: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await this.send(testNotification);
      return true;
    } catch (error) {
      logger.error('Test Teams message failed:', error);
      return false;
    }
  }

  // Get Teams templates for different notification types
  getTeamsTemplate(type: string): { subject: string; message: string } {
    const templates = {
      'threat_model_created': {
        subject: '🆕 New Threat Model Created',
        message: 'A new threat model "**{{title}}**" has been created by {{creator_name}} in project **{{project_name}}**.',
      },
      'threat_identified': {
        subject: '⚠️ New {{risk_level}} Risk Threat Identified',
        message: 'A new **{{risk_level}} risk** threat "**{{threat_title}}**" has been identified in threat model **{{model_title}}**.',
      },
      'threat_mitigated': {
        subject: '✅ Threat Mitigated',
        message: 'The threat "**{{threat_title}}**" has been successfully mitigated by {{mitigator_name}}.',
      },
      'report_generated': {
        subject: '📊 Report Generated',
        message: 'The report "**{{report_title}}**" has been generated and is ready for download.',
      },
      'collaboration_invited': {
        subject: '🤝 Collaboration Invitation',
        message: 'You have been invited to collaborate on the threat model "**{{model_title}}**" in project **{{project_name}}** by {{inviter_name}}.',
      },
      'system_maintenance': {
        subject: '🔧 System Maintenance',
        message: 'System maintenance is scheduled: **{{description}}**. Expected downtime: {{duration}}.',
      },
    };

    return templates[type] || {
      subject: '📢 Notification from Threat Modeling Platform',
      message: 'You have a new notification from the Threat Modeling Platform.',
    };
  }

  // Create adaptive card payload (alternative to MessageCard)
  private buildAdaptiveCard(notification: BaseNotification): any {
    return {
      type: 'message',
      attachments: [
        {
          contentType: 'application/vnd.microsoft.card.adaptive',
          content: {
            $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
            type: 'AdaptiveCard',
            version: '1.2',
            body: [
              {
                type: 'TextBlock',
                text: notification.subject,
                weight: 'Bolder',
                size: 'Medium',
                color: this.getAdaptiveCardColor(notification.priority),
              },
              {
                type: 'TextBlock',
                text: notification.message,
                wrap: true,
              },
              {
                type: 'FactSet',
                facts: this.buildFacts(notification),
              },
            ],
            actions: this.buildAdaptiveActions(notification),
          },
        },
      ],
    };
  }

  private getAdaptiveCardColor(priority: string): string {
    const colors = {
      urgent: 'Attention',
      high: 'Warning',
      medium: 'Default',
      low: 'Good',
    };
    return colors[priority] || 'Default';
  }

  private buildAdaptiveActions(notification: BaseNotification): any[] {
    const actions = [];

    if (notification.metadata.url) {
      actions.push({
        type: 'Action.OpenUrl',
        title: 'View Details',
        url: notification.metadata.url,
      });
    }

    if (notification.metadata.downloadUrl) {
      actions.push({
        type: 'Action.OpenUrl',
        title: 'Download Report',
        url: notification.metadata.downloadUrl,
      });
    }

    return actions;
  }
}

export default TeamsProvider;