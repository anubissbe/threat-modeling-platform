import twilio from 'twilio';
import { NotificationProvider } from './base.provider';
import { BaseNotification, TwilioConfig } from '../types';
import { logger } from '../utils/logger';

export class SMSProvider extends NotificationProvider {
  readonly type = 'sms' as const;
  private client: twilio.Twilio;
  protected configuration: TwilioConfig;

  constructor() {
    super();
    this.configuration = this.loadConfiguration();
    this.initializeClient();
  }

  private loadConfiguration(): TwilioConfig {
    return {
      accountSid: process.env['TWILIO_ACCOUNT_SID'] || '',
      authToken: process.env['TWILIO_AUTH_TOKEN'] || '',
      from: process.env['TWILIO_FROM_NUMBER'] || '',
    };
  }

  private initializeClient(): void {
    if (!this.configuration.accountSid || !this.configuration.authToken) {
      logger.warn('Twilio credentials not configured, SMS notifications will be disabled');
      return;
    }

    try {
      this.client = twilio(this.configuration.accountSid, this.configuration.authToken);
      logger.info('SMS provider initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Twilio client:', error);
      throw error;
    }
  }

  async send(notification: BaseNotification): Promise<void> {
    if (!this.client) {
      throw new Error('Twilio client not initialized');
    }

    try {
      const messageOptions = this.buildSMSMessage(notification);
      
      const result = await this.withTimeout(
        this.client.messages.create(messageOptions),
        30000 // 30 second timeout
      );

      logger.info(`SMS sent successfully: ${notification.id}`, {
        sid: result.sid,
        to: notification.channel,
        status: result.status,
      });
    } catch (error) {
      await this.handleProviderError(error, 'SMS sending');
    }
  }

  private buildSMSMessage(notification: BaseNotification): any {
    const message = this.formatSMSMessage(notification);
    
    const messageOptions: any = {
      body: message,
      from: this.configuration.from,
      to: notification.channel,
    };

    // Add media URLs if provided (for MMS)
    if (notification.metadata.mediaUrls && Array.isArray(notification.metadata.mediaUrls)) {
      messageOptions.mediaUrl = notification.metadata.mediaUrls;
    }

    // Set delivery status webhook if configured
    if (process.env['TWILIO_STATUS_CALLBACK_URL']) {
      messageOptions.statusCallback = process.env['TWILIO_STATUS_CALLBACK_URL'];
    }

    return messageOptions;
  }

  private formatSMSMessage(notification: BaseNotification): string {
    // SMS messages should be concise (160 characters for single SMS)
    let message = `${notification.subject}\n\n${notification.message}`;

    // Add URL if available
    if (notification.metadata.url) {
      message += `\n\nView: ${notification.metadata.url}`;
    }

    // Truncate if too long (keeping some buffer for encoding)
    const maxLength = 1500; // Allow for multi-part SMS
    if (message.length > maxLength) {
      message = this.truncateMessage(message, maxLength - 3) + '...';
    }

    // Remove HTML tags
    message = message.replace(/<[^>]*>/g, '');
    
    // Clean up multiple newlines
    message = message.replace(/\n{3,}/g, '\n\n');

    return message.trim();
  }

  validateConfiguration(config: Record<string, any>): boolean {
    const requiredFields = ['accountSid', 'authToken', 'from'];
    
    if (!this.validateRequiredConfig(config, requiredFields)) {
      return false;
    }

    // Validate phone number format
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    if (!phoneRegex.test(config.from)) {
      logger.error('Invalid Twilio from number format (must be E.164 format, e.g., +1234567890)');
      return false;
    }

    // Validate account SID format
    if (!config.accountSid.startsWith('AC')) {
      logger.error('Invalid Twilio Account SID format');
      return false;
    }

    return true;
  }

  // Test the Twilio configuration
  async testConnection(): Promise<boolean> {
    if (!this.client) {
      return false;
    }

    try {
      // Test by fetching account information
      const account = await this.client.api.accounts(this.configuration.accountSid).fetch();
      
      if (account.status === 'active') {
        logger.info('Twilio configuration test successful', {
          accountSid: account.sid,
          friendlyName: account.friendlyName,
        });
        return true;
      } else {
        logger.error('Twilio account is not active:', account.status);
        return false;
      }
    } catch (error) {
      logger.error('Twilio configuration test failed:', error);
      return false;
    }
  }

  // Send test SMS
  async sendTestSMS(phoneNumber: string): Promise<boolean> {
    try {
      const testNotification: BaseNotification = {
        id: 'test-sms',
        userId: 'test-user',
        type: 'sms',
        channel: phoneNumber,
        subject: 'Test SMS',
        message: 'This is a test SMS from the Threat Modeling Platform. If you receive this, SMS notifications are working correctly.',
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
      logger.error('Test SMS failed:', error);
      return false;
    }
  }

  // Get SMS templates for different notification types
  getSMSTemplate(type: string): { subject: string; message: string } {
    const templates = {
      'threat_model_created': {
        subject: 'New Threat Model',
        message: 'New threat model "{{title}}" created by {{creator_name}} in {{project_name}}.',
      },
      'threat_identified': {
        subject: '⚠️ {{risk_level}} Risk Threat',
        message: '{{risk_level}} risk threat "{{threat_title}}" identified in {{model_title}}.',
      },
      'threat_mitigated': {
        subject: '✅ Threat Mitigated',
        message: 'Threat "{{threat_title}}" has been mitigated by {{mitigator_name}}.',
      },
      'report_generated': {
        subject: '📊 Report Ready',
        message: 'Report "{{report_title}}" is ready for download.',
      },
      'collaboration_invited': {
        subject: '🤝 Collaboration Invite',
        message: 'You\'ve been invited to collaborate on "{{model_title}}" by {{inviter_name}}.',
      },
      'system_maintenance': {
        subject: '🔧 Maintenance Alert',
        message: 'System maintenance: {{description}}. Duration: {{duration}}.',
      },
    };

    return templates[type] || {
      subject: 'Notification',
      message: 'You have a new notification from the Threat Modeling Platform.',
    };
  }

  // Handle Twilio webhooks (delivery status, etc.)
  async handleWebhook(payload: any): Promise<void> {
    try {
      logger.debug('Received Twilio webhook:', this.sanitizeLogData(payload));

      const { MessageSid, MessageStatus, ErrorCode, ErrorMessage } = payload;

      if (MessageSid) {
        await this.updateMessageStatus(MessageSid, MessageStatus, ErrorCode, ErrorMessage);
      }
    } catch (error) {
      logger.error('Error handling Twilio webhook:', error);
    }
  }

  private async updateMessageStatus(
    messageSid: string,
    status: string,
    errorCode?: string,
    errorMessage?: string
  ): Promise<void> {
    // Update notification status based on Twilio delivery status
    const statusMapping: Record<string, string> = {
      'delivered': 'sent',
      'undelivered': 'failed',
      'failed': 'failed',
      'sent': 'sent',
      'queued': 'pending',
      'accepted': 'pending',
    };

    const notificationStatus = statusMapping[status] || 'pending';

    logger.info(`SMS status update: ${messageSid} -> ${status}`, {
      messageSid,
      status,
      errorCode,
      errorMessage,
    });

    // Here you would update the notification status in the database
    // This requires knowing which notification corresponds to which message SID
    // You might want to store the message SID in the notification metadata
  }

  // Get available Twilio phone numbers
  async getAvailableNumbers(): Promise<any[]> {
    if (!this.client) {
      return [];
    }

    try {
      const incomingPhoneNumbers = await this.client.incomingPhoneNumbers.list();
      
      return incomingPhoneNumbers.map(number => ({
        sid: number.sid,
        phoneNumber: number.phoneNumber,
        friendlyName: number.friendlyName,
        capabilities: number.capabilities,
      }));
    } catch (error) {
      logger.error('Failed to get Twilio phone numbers:', error);
      return [];
    }
  }

  // Validate phone number format
  validatePhoneNumber(phoneNumber: string): boolean {
    // E.164 format validation
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    return phoneRegex.test(phoneNumber);
  }

  // Format phone number to E.164
  formatPhoneNumber(phoneNumber: string, defaultCountryCode: string = '+1'): string {
    // Remove all non-digit characters
    const digits = phoneNumber.replace(/\D/g, '');
    
    // If already includes country code
    if (phoneNumber.startsWith('+')) {
      return phoneNumber;
    }
    
    // Add default country code
    if (digits.length === 10) {
      return `${defaultCountryCode}${digits}`;
    }
    
    // If 11 digits and starts with 1 (US/Canada)
    if (digits.length === 11 && digits.startsWith('1')) {
      return `+${digits}`;
    }
    
    return phoneNumber; // Return as-is if can't format
  }

  // Check if SMS is supported for a country
  async isSMSSupportedForCountry(countryCode: string): Promise<boolean> {
    // List of countries where Twilio SMS is generally supported
    const supportedCountries = [
      'US', 'CA', 'GB', 'AU', 'DE', 'FR', 'ES', 'IT', 'NL', 'SE', 'NO', 'FI', 'DK',
      'BR', 'MX', 'AR', 'CL', 'CO', 'PE', 'IN', 'SG', 'HK', 'JP', 'KR', 'TW', 'PH',
      'TH', 'MY', 'ID', 'VN', 'AE', 'SA', 'IL', 'ZA', 'NG', 'KE', 'EG', 'MA',
    ];

    return supportedCountries.includes(countryCode.toUpperCase());
  }

  // Get SMS pricing for a country
  async getSMSPricing(countryCode: string): Promise<any> {
    if (!this.client) {
      return null;
    }

    try {
      const pricing = await this.client.pricing.v1.messaging
        .countries(countryCode.toLowerCase())
        .fetch();
      
      return pricing;
    } catch (error) {
      logger.error(`Failed to get SMS pricing for ${countryCode}:`, error);
      return null;
    }
  }
}

export default SMSProvider;