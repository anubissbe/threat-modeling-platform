import { WebClient } from '@slack/web-api';
import { NotificationProvider } from './base.provider';
import { BaseNotification, SlackConfig } from '../types';
import { logger } from '../utils/logger';

export class SlackProvider extends NotificationProvider {
  readonly type = 'slack' as const;
  private client: WebClient;
  protected configuration: SlackConfig;

  constructor() {
    super();
    this.configuration = this.loadConfiguration();
    this.initializeClient();
  }

  private loadConfiguration(): SlackConfig {
    return {
      botToken: process.env['SLACK_BOT_TOKEN'] || '',
      signingSecret: process.env['SLACK_SIGNING_SECRET'] || '',
    };
  }

  private initializeClient(): void {
    if (!this.configuration.botToken) {
      logger.warn('Slack bot token not configured, Slack notifications will be disabled');
      return;
    }

    try {
      this.client = new WebClient(this.configuration.botToken);
      logger.info('Slack provider initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Slack client:', error);
      throw error;
    }
  }

  async send(notification: BaseNotification): Promise<void> {
    if (!this.client) {
      throw new Error('Slack client not initialized');
    }

    try {
      const message = this.buildSlackMessage(notification);
      
      const result = await this.withTimeout(
        this.client.chat.postMessage(message),
        30000 // 30 second timeout
      );

      if (!result.ok) {
        throw new Error(`Slack API error: ${result.error}`);
      }

      logger.info(`Slack message sent successfully: ${notification.id}`, {
        channel: notification.channel,
        timestamp: result.ts,
        messageId: result.message?.ts,
      });
    } catch (error) {
      await this.handleProviderError(error, 'Slack message sending');
    }
  }

  private buildSlackMessage(notification: BaseNotification): any {
    const message: any = {
      channel: notification.channel,
      text: notification.subject,
    };

    // Create rich message blocks
    const blocks = [];

    // Header block
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${notification.subject}*`,
      },
    });

    // Message content
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: this.formatSlackMessage(notification.message),
      },
    });

    // Add action buttons if URLs are provided in metadata
    if (notification.metadata.url) {
      blocks.push({
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'View Details',
            },
            url: notification.metadata.url,
            style: 'primary',
          },
        ],
      });
    }

    // Add context information
    const contextElements = [];
    if (notification.metadata.projectName) {
      contextElements.push({
        type: 'mrkdwn',
        text: `Project: ${notification.metadata.projectName}`,
      });
    }
    if (notification.metadata.creatorName) {
      contextElements.push({
        type: 'mrkdwn',
        text: `Created by: ${notification.metadata.creatorName}`,
      });
    }
    if (notification.priority !== 'medium') {
      contextElements.push({
        type: 'mrkdwn',
        text: `Priority: ${notification.priority.toUpperCase()}`,
      });
    }

    if (contextElements.length > 0) {
      blocks.push({
        type: 'context',
        elements: contextElements,
      });
    }

    message.blocks = blocks;

    // Add color based on priority
    const colors = {
      urgent: 'danger',
      high: 'warning',
      medium: 'good',
      low: '#36a64f',
    };
    message.attachments = [
      {
        color: colors[notification.priority] || 'good',
        fallback: notification.message,
      },
    ];

    // Add thread timestamp if this is a reply
    if (notification.metadata.threadTs) {
      message.thread_ts = notification.metadata.threadTs;
    }

    return message;
  }

  private formatSlackMessage(message: string): string {
    // Convert basic HTML to Slack markdown
    return message
      .replace(/<b>(.*?)<\/b>/g, '*$1*')
      .replace(/<i>(.*?)<\/i>/g, '_$1_')
      .replace(/<code>(.*?)<\/code>/g, '`$1`')
      .replace(/<a href="(.*?)">(.*?)<\/a>/g, '<$1|$2>')
      .replace(/<br\s*\/?>/g, '\n')
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&');
  }

  validateConfiguration(config: Record<string, any>): boolean {
    const requiredFields = ['botToken'];
    
    if (!this.validateRequiredConfig(config, requiredFields)) {
      return false;
    }

    // Validate bot token format (should start with xoxb-)
    if (!config.botToken.startsWith('xoxb-')) {
      logger.error('Invalid Slack bot token format');
      return false;
    }

    return true;
  }

  // Test the Slack configuration
  async testConnection(): Promise<boolean> {
    if (!this.client) {
      return false;
    }

    try {
      const result = await this.client.auth.test();
      if (result.ok) {
        logger.info('Slack configuration test successful', {
          teamId: result.team_id,
          userId: result.user_id,
        });
        return true;
      } else {
        logger.error('Slack configuration test failed:', result.error);
        return false;
      }
    } catch (error) {
      logger.error('Slack configuration test failed:', error);
      return false;
    }
  }

  // Send test message
  async sendTestMessage(channel: string): Promise<boolean> {
    try {
      const testNotification: BaseNotification = {
        id: 'test-slack',
        userId: 'test-user',
        type: 'slack',
        channel: channel,
        subject: 'Test Message from Threat Modeling Platform',
        message: 'This is a test message to verify Slack configuration. If you receive this, the integration is working correctly!',
        metadata: {},
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
      logger.error('Test Slack message failed:', error);
      return false;
    }
  }

  // Get list of channels
  async getChannels(): Promise<any[]> {
    if (!this.client) {
      return [];
    }

    try {
      const result = await this.client.conversations.list({
        types: 'public_channel,private_channel',
        limit: 100,
      });

      if (result.ok && result.channels) {
        return result.channels.map(channel => ({
          id: channel.id,
          name: channel.name,
          is_private: channel.is_private,
          is_member: channel.is_member,
        }));
      }

      return [];
    } catch (error) {
      logger.error('Failed to get Slack channels:', error);
      return [];
    }
  }

  // Get list of users
  async getUsers(): Promise<any[]> {
    if (!this.client) {
      return [];
    }

    try {
      const result = await this.client.users.list({
        limit: 100,
      });

      if (result.ok && result.members) {
        return result.members
          .filter(user => !user.deleted && !user.is_bot)
          .map(user => ({
            id: user.id,
            name: user.name,
            real_name: user.real_name,
            display_name: user.profile?.display_name,
            email: user.profile?.email,
          }));
      }

      return [];
    } catch (error) {
      logger.error('Failed to get Slack users:', error);
      return [];
    }
  }

  // Handle Slack events (webhooks)
  async handleSlackEvent(event: any): Promise<void> {
    try {
      logger.debug('Received Slack event:', event);

      // Handle different event types
      switch (event.type) {
        case 'message':
          await this.handleMessageEvent(event);
          break;
        case 'channel_created':
          await this.handleChannelCreated(event);
          break;
        case 'member_joined_channel':
          await this.handleMemberJoined(event);
          break;
        default:
          logger.debug(`Unhandled Slack event type: ${event.type}`);
      }
    } catch (error) {
      logger.error('Error handling Slack event:', error);
    }
  }

  private async handleMessageEvent(event: any): Promise<void> {
    // Handle message events (e.g., mentions, keywords)
    if (event.text?.includes('@threat-model')) {
      // Bot was mentioned, could trigger some action
      logger.info('Bot mentioned in Slack message');
    }
  }

  private async handleChannelCreated(event: any): Promise<void> {
    // Handle new channel creation
    logger.info('New Slack channel created:', event.channel);
  }

  private async handleMemberJoined(event: any): Promise<void> {
    // Handle member joining channel
    logger.info('Member joined Slack channel:', event);
  }

  // Format different types of notifications for Slack
  getSlackTemplate(type: string): { subject: string; message: string } {
    const templates = {
      'threat_model_created': {
        subject: '🆕 New Threat Model Created',
        message: `A new threat model "*{{title}}*" has been created by {{creator_name}} in project *{{project_name}}*.\n\n:point_right: <{{url}}|View Threat Model>`,
      },
      'threat_identified': {
        subject: '⚠️ New {{risk_level}} Risk Threat Identified',
        message: `A new *{{risk_level}} risk* threat "*{{threat_title}}*" has been identified in threat model *{{model_title}}*.\n\n:point_right: <{{url}}|View Threat>`,
      },
      'threat_mitigated': {
        subject: '✅ Threat Mitigated',
        message: `The threat "*{{threat_title}}*" has been successfully mitigated by {{mitigator_name}}.\n\n:point_right: <{{url}}|View Details>`,
      },
      'report_generated': {
        subject: '📊 Report Generated',
        message: `The report "*{{report_title}}*" has been generated and is ready for download.\n\n:point_right: <{{download_url}}|Download Report>`,
      },
    };

    return templates[type] || {
      subject: '📢 Notification from Threat Modeling Platform',
      message: 'You have a new notification from the Threat Modeling Platform.',
    };
  }
}

export default SlackProvider;