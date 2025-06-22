import twilio from 'twilio';
import { config, getSMSConfig } from '../../config';
import { logger, notificationLogger } from '../../utils/logger';
import {
  SMSProvider,
  SMSNotification,
  SMSResult,
} from '../../types';

export class TwilioProvider implements SMSProvider {
  private client: twilio.Twilio;
  private fromNumber: string;

  constructor() {
    const smsConfig = getSMSConfig();
    
    if (smsConfig.provider !== 'twilio') {
      throw new Error('TwilioProvider requires Twilio configuration');
    }

    this.client = twilio(smsConfig.config.accountSid, smsConfig.config.authToken);
    this.fromNumber = smsConfig.config.from;
  }

  async verifyConnection(): Promise<boolean> {
    try {
      // Verify by fetching account details
      const account = await this.client.api.accounts(
        this.client.accountSid
      ).fetch();
      
      logger.info('Twilio connection verified', {
        accountSid: account.sid,
        status: account.status,
      });
      
      return account.status === 'active';
    } catch (error) {
      logger.error('Twilio connection verification failed:', error);
      return false;
    }
  }

  async send(notification: SMSNotification): Promise<SMSResult> {
    const startTime = Date.now();

    try {
      // Validate phone number format
      const to = this.normalizePhoneNumber(notification.to);
      
      const message = await this.client.messages.create({
        to,
        from: notification.from || this.fromNumber,
        body: notification.body,
        mediaUrl: notification.mediaUrl,
      });

      const duration = Date.now() - startTime;
      notificationLogger.performanceMetric('sms-send', duration, {
        provider: 'twilio',
        messageId: message.sid,
        status: message.status,
      });

      return {
        messageId: message.sid,
        status: message.status,
        errorCode: message.errorCode?.toString(),
        errorMessage: message.errorMessage,
      };

    } catch (error: any) {
      const duration = Date.now() - startTime;
      notificationLogger.providerError('twilio', error);
      notificationLogger.performanceMetric('sms-send-failed', duration);

      // Handle Twilio specific errors
      if (error.code) {
        throw new Error(`Twilio error ${error.code}: ${error.message}`);
      }
      
      throw error;
    }
  }

  private normalizePhoneNumber(phone: string): string {
    // Remove all non-numeric characters
    let normalized = phone.replace(/\D/g, '');
    
    // Add country code if missing (assuming US)
    if (normalized.length === 10) {
      normalized = '1' + normalized;
    }
    
    // Add + prefix if missing
    if (!normalized.startsWith('+')) {
      normalized = '+' + normalized;
    }
    
    return normalized;
  }
}

export class SMSProviderFactory {
  static create(): SMSProvider {
    const smsConfig = getSMSConfig();

    switch (smsConfig.provider) {
      case 'twilio':
        return new TwilioProvider();
      default:
        throw new Error(`Unsupported SMS provider: ${smsConfig.provider}`);
    }
  }
}

// SMS utility functions
export const validatePhoneNumber = (phone: string): boolean => {
  // Basic phone number validation
  // In production, use a library like libphonenumber-js
  const phoneRegex = /^\+?[1-9]\d{1,14}$/;
  const normalized = phone.replace(/\D/g, '');
  return phoneRegex.test(normalized);
};

export const truncateSMS = (message: string, maxLength: number = 160): string => {
  if (message.length <= maxLength) {
    return message;
  }
  
  // Truncate and add ellipsis
  return message.substring(0, maxLength - 3) + '...';
};

export const calculateSMSSegments = (message: string): number => {
  const length = message.length;
  
  // GSM 7-bit encoding
  if (length <= 160) return 1;
  if (length <= 306) return 2;
  if (length <= 459) return 3;
  
  // For longer messages
  return Math.ceil(length / 153);
};