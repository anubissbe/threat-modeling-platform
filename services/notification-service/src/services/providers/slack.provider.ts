import { IncomingWebhook } from '@slack/webhook';
import axios from 'axios';
import { config } from '../../config';
import { logger, notificationLogger } from '../../utils/logger';
import {
  SlackProvider,
  SlackNotification,
  SlackResult,
} from '../../types';

export class SlackWebhookProvider implements SlackProvider {
  private webhook: IncomingWebhook;

  constructor(webhookUrl?: string) {
    const url = webhookUrl || config.SLACK_WEBHOOK_URL;
    
    if (!url) {
      throw new Error('Slack webhook URL is required');
    }

    this.webhook = new IncomingWebhook(url);
  }

  async verifyConnection(): Promise<boolean> {
    try {
      // Send a test message to verify the webhook
      await this.webhook.send({
        text: 'Slack webhook connection test',
        channel: '#test',
      });
      
      logger.info('Slack webhook verified successfully');
      return true;
    } catch (error) {
      logger.error('Slack webhook verification failed:', error);
      return false;
    }
  }

  async send(notification: SlackNotification): Promise<SlackResult> {
    const startTime = Date.now();

    try {
      const result = await this.webhook.send({
        text: notification.text,
        channel: notification.channel,
        username: notification.username,
        icon_emoji: notification.iconEmoji,
        icon_url: notification.iconUrl,
        blocks: notification.blocks,
        attachments: notification.attachments,
      });

      const duration = Date.now() - startTime;
      notificationLogger.performanceMetric('slack-send', duration, {
        provider: 'slack-webhook',
      });

      return {
        ok: true,
        ts: Date.now().toString(),
      };

    } catch (error: any) {
      const duration = Date.now() - startTime;
      notificationLogger.providerError('slack-webhook', error);
      notificationLogger.performanceMetric('slack-send-failed', duration);

      return {
        ok: false,
        error: error.message,
      };
    }
  }
}

export class SlackAPIProvider implements SlackProvider {
  private botToken: string;
  private apiUrl = 'https://slack.com/api';

  constructor() {
    if (!config.SLACK_BOT_TOKEN) {
      throw new Error('Slack bot token is required');
    }

    this.botToken = config.SLACK_BOT_TOKEN;
  }

  async verifyConnection(): Promise<boolean> {
    try {
      const response = await axios.post(
        `${this.apiUrl}/auth.test`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${this.botToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data.ok) {
        logger.info('Slack API connection verified', {
          team: response.data.team,
          user: response.data.user,
        });
        return true;
      }

      logger.error('Slack API verification failed:', response.data.error);
      return false;
    } catch (error) {
      logger.error('Slack API connection error:', error);
      return false;
    }
  }

  async send(notification: SlackNotification): Promise<SlackResult> {
    const startTime = Date.now();

    try {
      const response = await axios.post(
        `${this.apiUrl}/chat.postMessage`,
        {
          channel: notification.channel!,
          text: notification.text,
          username: notification.username,
          icon_emoji: notification.iconEmoji,
          icon_url: notification.iconUrl,
          blocks: notification.blocks,
          attachments: notification.attachments,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.botToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const duration = Date.now() - startTime;
      notificationLogger.performanceMetric('slack-send', duration, {
        provider: 'slack-api',
        channel: response.data.channel,
        ts: response.data.ts,
      });

      return {
        ok: response.data.ok,
        ts: response.data.ts,
        channel: response.data.channel,
        error: response.data.error,
      };

    } catch (error: any) {
      const duration = Date.now() - startTime;
      notificationLogger.providerError('slack-api', error);
      notificationLogger.performanceMetric('slack-send-failed', duration);

      return {
        ok: false,
        error: error.response?.data?.error || error.message,
      };
    }
  }
}

export class SlackProviderFactory {
  static create(useAPI: boolean = false): SlackProvider {
    if (useAPI && config.SLACK_BOT_TOKEN) {
      return new SlackAPIProvider();
    }
    
    return new SlackWebhookProvider();
  }
}

// Slack message builders
export const buildSlackMessage = (
  title: string,
  text: string,
  color: 'good' | 'warning' | 'danger' | string = 'good',
  fields?: Array<{ title: string; value: string; short?: boolean }>
): any => {
  return {
    attachments: [{
      color,
      title,
      text,
      fields,
      footer: 'Threat Modeling App',
      ts: Math.floor(Date.now() / 1000),
    }],
  };
};

export const buildSlackBlocks = (
  headerText: string,
  sections: Array<{ text: string; fields?: string[] }>,
  actions?: Array<{ text: string; url: string }>
): any[] => {
  const blocks: any[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: headerText,
      },
    },
  ];

  sections.forEach(section => {
    const block: any = {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: section.text,
      },
    };

    if (section.fields) {
      block.fields = section.fields.map(field => ({
        type: 'mrkdwn',
        text: field,
      }));
    }

    blocks.push(block);
  });

  if (actions && actions.length > 0) {
    blocks.push({
      type: 'actions',
      elements: actions.map(action => ({
        type: 'button',
        text: {
          type: 'plain_text',
          text: action.text,
        },
        url: action.url,
      })),
    });
  }

  return blocks;
};