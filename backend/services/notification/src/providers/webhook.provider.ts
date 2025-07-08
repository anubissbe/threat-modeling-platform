import axios, { AxiosResponse } from 'axios';
import crypto from 'crypto';
import { NotificationProvider } from './base.provider';
import { BaseNotification, WebhookConfig } from '../types';
import { logger } from '../utils/logger';

export class WebhookProvider extends NotificationProvider {
  readonly type = 'webhook' as const;
  protected configuration: WebhookConfig;

  constructor() {
    super();
    this.configuration = this.loadConfiguration();
  }

  private loadConfiguration(): WebhookConfig {
    return {
      url: process.env['WEBHOOK_URL'] || '',
      method: (process.env['WEBHOOK_METHOD'] as 'POST' | 'PUT' | 'PATCH') || 'POST',
      headers: this.parseHeaders(process.env['WEBHOOK_HEADERS'] || ''),
      timeout: parseInt(process.env['WEBHOOK_TIMEOUT'] || '30000'),
    };
  }

  private parseHeaders(headersString: string): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'ThreatModelingPlatform-WebhookProvider/1.0',
    };

    if (headersString) {
      try {
        const parsed = JSON.parse(headersString);
        Object.assign(headers, parsed);
      } catch (error) {
        logger.warn('Failed to parse webhook headers, using defaults');
      }
    }

    return headers;
  }

  async send(notification: BaseNotification): Promise<void> {
    // For webhook notifications, the channel contains the webhook URL
    const webhookUrl = notification.channel || this.configuration.url;
    
    if (!webhookUrl) {
      throw new Error('Webhook URL not configured');
    }

    try {
      const payload = this.buildWebhookPayload(notification);
      const headers = this.buildHeaders(notification, payload);
      
      const response = await this.withTimeout(
        axios.request({
          method: this.configuration.method,
          url: webhookUrl,
          data: payload,
          headers,
          timeout: this.configuration.timeout,
          validateStatus: (status) => status >= 200 && status < 300,
        }),
        this.configuration.timeout
      );

      logger.info(`Webhook sent successfully: ${notification.id}`, {
        url: webhookUrl,
        method: this.configuration.method,
        status: response.status,
        responseTime: this.extractResponseTime(response),
      });
    } catch (error) {
      await this.handleProviderError(error, 'webhook sending');
    }
  }

  private buildWebhookPayload(notification: BaseNotification): any {
    // Standard webhook payload format
    const payload = {
      id: notification.id,
      event: {
        type: notification.metadata.eventType || 'notification',
        timestamp: notification.createdAt.toISOString(),
        data: notification.metadata.eventData || {},
      },
      notification: {
        subject: notification.subject,
        message: notification.message,
        priority: notification.priority,
        channel: notification.type,
        user_id: notification.userId,
      },
      metadata: {
        template_id: notification.templateId,
        retry_count: notification.retryCount,
        ...notification.metadata,
      },
    };

    // Add custom payload format if specified
    if (notification.metadata.webhookFormat === 'slack') {
      return this.buildSlackWebhookPayload(notification);
    } else if (notification.metadata.webhookFormat === 'discord') {
      return this.buildDiscordWebhookPayload(notification);
    } else if (notification.metadata.webhookFormat === 'custom') {
      return notification.metadata.customPayload || payload;
    }

    return payload;
  }

  private buildSlackWebhookPayload(notification: BaseNotification): any {
    return {
      text: notification.subject,
      attachments: [
        {
          color: this.getSlackColor(notification.priority),
          fields: [
            {
              title: 'Message',
              value: notification.message,
              short: false,
            },
            {
              title: 'Priority',
              value: notification.priority.toUpperCase(),
              short: true,
            },
            {
              title: 'Time',
              value: notification.createdAt.toISOString(),
              short: true,
            },
          ],
          footer: 'Threat Modeling Platform',
          ts: Math.floor(notification.createdAt.getTime() / 1000),
        },
      ],
    };
  }

  private buildDiscordWebhookPayload(notification: BaseNotification): any {
    return {
      content: notification.subject,
      embeds: [
        {
          title: notification.subject,
          description: notification.message,
          color: this.getDiscordColor(notification.priority),
          fields: [
            {
              name: 'Priority',
              value: notification.priority.toUpperCase(),
              inline: true,
            },
            {
              name: 'Event Type',
              value: notification.metadata.eventType || 'notification',
              inline: true,
            },
          ],
          timestamp: notification.createdAt.toISOString(),
          footer: {
            text: 'Threat Modeling Platform',
          },
        },
      ],
    };
  }

  private buildHeaders(notification: BaseNotification, payload: any): Record<string, string> {
    const headers = { ...this.configuration.headers };

    // Add signature header if secret is configured
    const secret = notification.metadata.webhookSecret || process.env['WEBHOOK_SECRET'];
    if (secret) {
      const signature = this.generateSignature(JSON.stringify(payload), secret);
      headers['X-Hub-Signature-256'] = `sha256=${signature}`;
    }

    // Add custom headers from notification metadata
    if (notification.metadata.headers) {
      Object.assign(headers, notification.metadata.headers);
    }

    // Add correlation ID
    headers['X-Correlation-ID'] = notification.id;

    // Add event type header
    if (notification.metadata.eventType) {
      headers['X-Event-Type'] = notification.metadata.eventType;
    }

    return headers;
  }

  private generateSignature(payload: string, secret: string): string {
    return crypto
      .createHmac('sha256', secret)
      .update(payload, 'utf8')
      .digest('hex');
  }

  private getSlackColor(priority: string): string {
    const colors = {
      urgent: 'danger',
      high: 'warning',
      medium: 'good',
      low: '#36a64f',
    };
    return colors[priority] || 'good';
  }

  private getDiscordColor(priority: string): number {
    const colors = {
      urgent: 0xFF0000,  // Red
      high: 0xFF8C00,    // Orange
      medium: 0x1E90FF,  // Blue
      low: 0x32CD32,     // Green
    };
    return colors[priority] || colors.medium;
  }

  private extractResponseTime(response: AxiosResponse): number | undefined {
    const requestStart = response.config.metadata?.startTime;
    if (requestStart) {
      return Date.now() - requestStart;
    }
    return undefined;
  }

  validateConfiguration(config: Record<string, any>): boolean {
    // URL is required for webhook notifications
    if (!config.url && !process.env['WEBHOOK_URL']) {
      logger.error('Webhook URL is required');
      return false;
    }

    // Validate URL format
    try {
      new URL(config.url || process.env['WEBHOOK_URL'] || '');
    } catch (error) {
      logger.error('Invalid webhook URL format');
      return false;
    }

    // Validate method
    const validMethods = ['POST', 'PUT', 'PATCH'];
    const method = config.method || 'POST';
    if (!validMethods.includes(method.toUpperCase())) {
      logger.error(`Invalid webhook method: ${method}`);
      return false;
    }

    // Validate timeout
    const timeout = parseInt(config.timeout || '30000');
    if (isNaN(timeout) || timeout < 1000 || timeout > 300000) {
      logger.error('Invalid webhook timeout (must be between 1000 and 300000 ms)');
      return false;
    }

    return true;
  }

  // Test the webhook configuration
  async testConnection(webhookUrl?: string): Promise<boolean> {
    const testUrl = webhookUrl || this.configuration.url;
    
    if (!testUrl) {
      logger.error('No webhook URL configured for testing');
      return false;
    }

    try {
      const testPayload = {
        test: true,
        message: 'Test webhook from Threat Modeling Platform',
        timestamp: new Date().toISOString(),
      };

      const response = await axios.request({
        method: this.configuration.method,
        url: testUrl,
        data: testPayload,
        headers: {
          ...this.configuration.headers,
          'X-Test-Webhook': 'true',
        },
        timeout: 10000,
        validateStatus: (status) => status >= 200 && status < 300,
      });

      logger.info('Webhook configuration test successful', {
        url: testUrl,
        status: response.status,
      });
      return true;
    } catch (error) {
      logger.error('Webhook configuration test failed:', error);
      return false;
    }
  }

  // Send test webhook
  async sendTestWebhook(webhookUrl: string): Promise<boolean> {
    try {
      const testNotification: BaseNotification = {
        id: 'test-webhook',
        userId: 'test-user',
        type: 'webhook',
        channel: webhookUrl,
        subject: 'Test Webhook from Threat Modeling Platform',
        message: 'This is a test webhook to verify webhook configuration. If you receive this, the integration is working correctly!',
        metadata: {
          eventType: 'system_test',
          webhookFormat: 'standard',
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
      logger.error('Test webhook failed:', error);
      return false;
    }
  }

  // Verify webhook signature (for incoming webhooks)
  verifySignature(payload: string, signature: string, secret: string): boolean {
    try {
      const expectedSignature = this.generateSignature(payload, secret);
      const providedSignature = signature.replace('sha256=', '');
      
      return crypto.timingSafeEqual(
        Buffer.from(expectedSignature, 'hex'),
        Buffer.from(providedSignature, 'hex')
      );
    } catch (error) {
      logger.error('Error verifying webhook signature:', error);
      return false;
    }
  }

  // Get webhook templates for different formats
  getWebhookTemplate(type: string, format: string = 'standard'): any {
    const templates = {
      standard: {
        'threat_model_created': {
          subject: 'New Threat Model Created: {{title}}',
          message: 'A new threat model "{{title}}" has been created by {{creator_name}} in project {{project_name}}.',
        },
        'threat_identified': {
          subject: 'New {{risk_level}} Risk Threat Identified',
          message: 'A new {{risk_level}} risk threat "{{threat_title}}" has been identified in threat model {{model_title}}.',
        },
      },
      slack: {
        'threat_model_created': {
          text: '🆕 New Threat Model Created',
          attachments: [
            {
              color: 'good',
              fields: [
                { title: 'Title', value: '{{title}}', short: true },
                { title: 'Project', value: '{{project_name}}', short: true },
                { title: 'Created by', value: '{{creator_name}}', short: true },
              ],
            },
          ],
        },
      },
      discord: {
        'threat_model_created': {
          embeds: [
            {
              title: '🆕 New Threat Model Created',
              description: 'A new threat model "{{title}}" has been created',
              color: 0x32CD32,
              fields: [
                { name: 'Project', value: '{{project_name}}', inline: true },
                { name: 'Created by', value: '{{creator_name}}', inline: true },
              ],
            },
          ],
        },
      },
    };

    return templates[format]?.[type] || templates.standard[type] || {
      subject: 'Notification from Threat Modeling Platform',
      message: 'You have a new notification.',
    };
  }

  // Handle webhook retries with exponential backoff
  async sendWithRetry(notification: BaseNotification, maxRetries: number = 3): Promise<void> {
    let lastError: Error;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        await this.send(notification);
        return; // Success
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === maxRetries) break;
        
        // Don't retry on permanent errors
        if (this.isPermanentError(error)) {
          throw error;
        }

        // Calculate exponential backoff delay
        const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
        await this.delay(delay);
      }
    }

    throw lastError!;
  }
}

export default WebhookProvider;