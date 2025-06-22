import nodemailer, { Transporter } from 'nodemailer';
import sgMail from '@sendgrid/mail';
import { config, getEmailConfig } from '../../config';
import { logger, notificationLogger } from '../../utils/logger';
import {
  EmailProvider,
  EmailNotification,
  EmailResult,
} from '../../types';

export class NodemailerProvider implements EmailProvider {
  private transporter: Transporter;

  constructor() {
    const emailConfig = getEmailConfig();
    
    if (emailConfig.provider !== 'smtp') {
      throw new Error('NodemailerProvider requires SMTP configuration');
    }

    this.transporter = nodemailer.createTransport(emailConfig.config);
  }

  async verifyConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      logger.info('SMTP connection verified successfully');
      return true;
    } catch (error) {
      logger.error('SMTP connection verification failed:', error);
      return false;
    }
  }

  async send(notification: EmailNotification): Promise<EmailResult> {
    const startTime = Date.now();

    try {
      const mailOptions = {
        from: notification.from || `${config.EMAIL_FROM_NAME} <${config.EMAIL_FROM_ADDRESS}>`,
        to: Array.isArray(notification.to) ? notification.to.join(', ') : notification.to,
        subject: notification.subject,
        text: notification.text,
        html: notification.html,
        cc: notification.cc?.join(', '),
        bcc: notification.bcc?.join(', '),
        replyTo: notification.replyTo || config.EMAIL_REPLY_TO,
        attachments: notification.attachments?.map(att => ({
          filename: att.filename,
          content: att.content,
          path: att.path,
          contentType: att.contentType,
          encoding: att.encoding,
        })),
        headers: notification.headers,
      };

      const result = await this.transporter.sendMail(mailOptions);

      const duration = Date.now() - startTime;
      notificationLogger.performanceMetric('email-send', duration, {
        provider: 'smtp',
        messageId: result.messageId,
      });

      return {
        messageId: result.messageId,
        accepted: result.accepted as string[],
        rejected: result.rejected as string[],
        response: result.response,
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      notificationLogger.providerError('smtp', error as Error);
      notificationLogger.performanceMetric('email-send-failed', duration);
      throw error;
    }
  }
}

export class SendGridProvider implements EmailProvider {
  constructor() {
    const emailConfig = getEmailConfig();
    
    if (emailConfig.provider !== 'sendgrid') {
      throw new Error('SendGridProvider requires SendGrid configuration');
    }

    sgMail.setApiKey(emailConfig.config.apiKey);
  }

  async verifyConnection(): Promise<boolean> {
    try {
      // SendGrid doesn't provide a direct verification method
      // We can try to get account details as a verification
      logger.info('SendGrid API key configured');
      return true;
    } catch (error) {
      logger.error('SendGrid configuration error:', error);
      return false;
    }
  }

  async send(notification: EmailNotification): Promise<EmailResult> {
    const startTime = Date.now();

    try {
      const msg = {
        to: notification.to,
        from: notification.from || {
          email: config.EMAIL_FROM_ADDRESS,
          name: config.EMAIL_FROM_NAME,
        },
        subject: notification.subject,
        text: notification.text,
        html: notification.html,
        cc: notification.cc,
        bcc: notification.bcc,
        replyTo: notification.replyTo || config.EMAIL_REPLY_TO,
        attachments: notification.attachments?.map(att => ({
          filename: att.filename,
          content: att.content?.toString('base64'),
          type: att.contentType,
          disposition: 'attachment',
        })),
        headers: notification.headers,
      };

      const [response] = await sgMail.send(msg);

      const duration = Date.now() - startTime;
      const messageId = response.headers['x-message-id'] || `sg-${Date.now()}`;
      
      notificationLogger.performanceMetric('email-send', duration, {
        provider: 'sendgrid',
        messageId,
        statusCode: response.statusCode,
      });

      return {
        messageId,
        accepted: Array.isArray(notification.to) ? notification.to : [notification.to],
        rejected: [],
        response: `SendGrid: ${response.statusCode}`,
      };

    } catch (error: any) {
      const duration = Date.now() - startTime;
      notificationLogger.providerError('sendgrid', error);
      notificationLogger.performanceMetric('email-send-failed', duration);

      // Handle SendGrid specific errors
      if (error.response) {
        const { body } = error.response;
        throw new Error(`SendGrid error: ${body.errors?.[0]?.message || 'Unknown error'}`);
      }
      
      throw error;
    }
  }
}

export class EmailProviderFactory {
  static create(): EmailProvider {
    const emailConfig = getEmailConfig();

    switch (emailConfig.provider) {
      case 'smtp':
        return new NodemailerProvider();
      case 'sendgrid':
        return new SendGridProvider();
      default:
        throw new Error(`Unsupported email provider: ${emailConfig.provider}`);
    }
  }
}

// Email utility functions
export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const sanitizeHtml = (html: string): string => {
  // Basic HTML sanitization - in production, use a library like DOMPurify
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '');
};

export const inlineCSS = async (html: string): Promise<string> => {
  // In production, use a library like juice to inline CSS
  // For now, return as-is
  return html;
};