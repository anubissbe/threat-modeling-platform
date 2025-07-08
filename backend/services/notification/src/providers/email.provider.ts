import nodemailer from 'nodemailer';
import { NotificationProvider } from './base.provider';
import { BaseNotification, EmailConfig } from '../types';
import { logger } from '../utils/logger';

export class EmailProvider extends NotificationProvider {
  readonly type = 'email' as const;
  private transporter: nodemailer.Transporter;
  protected configuration: EmailConfig;

  constructor() {
    super();
    this.configuration = this.loadConfiguration();
    this.initializeTransporter();
  }

  private loadConfiguration(): EmailConfig {
    return {
      host: process.env['SMTP_HOST'] || 'smtp.gmail.com',
      port: parseInt(process.env['SMTP_PORT'] || '587'),
      secure: process.env['SMTP_SECURE'] === 'true',
      auth: {
        user: process.env['SMTP_USER'] || '',
        pass: process.env['SMTP_PASSWORD'] || '',
      },
      from: process.env['SMTP_FROM'] || process.env['SMTP_USER'] || '',
    };
  }

  private initializeTransporter(): void {
    try {
      this.transporter = nodemailer.createTransporter({
        host: this.configuration.host,
        port: this.configuration.port,
        secure: this.configuration.secure,
        auth: this.configuration.auth,
        pool: true,
        maxConnections: 5,
        maxMessages: 100,
        rateLimit: 10, // 10 messages per second
      });

      // Verify connection
      this.transporter.verify((error) => {
        if (error) {
          logger.error('Email provider initialization failed:', error);
        } else {
          logger.info('Email provider initialized successfully');
        }
      });
    } catch (error) {
      logger.error('Failed to initialize email transporter:', error);
      throw error;
    }
  }

  async send(notification: BaseNotification): Promise<void> {
    try {
      const mailOptions = this.buildMailOptions(notification);
      
      // Send email with timeout
      const result = await this.withTimeout(
        this.transporter.sendMail(mailOptions),
        30000 // 30 second timeout
      );

      logger.info(`Email sent successfully: ${notification.id}`, {
        messageId: result.messageId,
        recipient: notification.channel,
        subject: notification.subject,
      });
    } catch (error) {
      await this.handleProviderError(error, 'email sending');
    }
  }

  private buildMailOptions(notification: BaseNotification): nodemailer.SendMailOptions {
    const options: nodemailer.SendMailOptions = {
      from: this.configuration.from,
      to: notification.channel,
      subject: notification.subject,
      text: notification.message,
    };

    // Add HTML content if available
    if (notification.htmlMessage) {
      options.html = notification.htmlMessage;
    }

    // Add attachments if specified in metadata
    if (notification.metadata.attachments) {
      options.attachments = notification.metadata.attachments;
    }

    // Add custom headers if specified
    if (notification.metadata.headers) {
      options.headers = notification.metadata.headers;
    }

    // Add reply-to if specified
    if (notification.metadata.replyTo) {
      options.replyTo = notification.metadata.replyTo;
    }

    // Add CC and BCC if specified
    if (notification.metadata.cc) {
      options.cc = notification.metadata.cc;
    }
    if (notification.metadata.bcc) {
      options.bcc = notification.metadata.bcc;
    }

    return options;
  }

  validateConfiguration(config: Record<string, any>): boolean {
    const requiredFields = ['host', 'port', 'auth.user', 'auth.pass', 'from'];
    
    // Check required fields
    if (!this.validateRequiredConfig(config, ['host', 'port', 'from'])) {
      return false;
    }

    // Check auth fields
    if (!config.auth || !config.auth.user || !config.auth.pass) {
      logger.error('Missing email authentication credentials');
      return false;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(config.from)) {
      logger.error('Invalid from email address format');
      return false;
    }

    // Validate port
    const port = parseInt(config.port);
    if (isNaN(port) || port < 1 || port > 65535) {
      logger.error('Invalid SMTP port');
      return false;
    }

    return true;
  }

  // Test the email configuration
  async testConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      logger.info('Email configuration test successful');
      return true;
    } catch (error) {
      logger.error('Email configuration test failed:', error);
      return false;
    }
  }

  // Send test email
  async sendTestEmail(recipient: string): Promise<boolean> {
    try {
      const testNotification: BaseNotification = {
        id: 'test-email',
        userId: 'test-user',
        type: 'email',
        channel: recipient,
        subject: 'Test Email from Threat Modeling Platform',
        message: 'This is a test email to verify email configuration.',
        htmlMessage: '<h1>Test Email</h1><p>This is a test email to verify email configuration.</p>',
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
      logger.error('Test email failed:', error);
      return false;
    }
  }

  // Get email templates for different notification types
  getEmailTemplate(type: string): { subject: string; body: string; html?: string } {
    const templates = {
      'threat_model_created': {
        subject: 'New Threat Model Created: {{title}}',
        body: `A new threat model "{{title}}" has been created by {{creator_name}} in project {{project_name}}.

View the threat model: {{url}}

This is an automated notification from the Threat Modeling Platform.`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>New Threat Model Created</h2>
            <p>A new threat model <strong>"{{title}}"</strong> has been created by <strong>{{creator_name}}</strong> in project <strong>{{project_name}}</strong>.</p>
            <p><a href="{{url}}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Threat Model</a></p>
            <hr>
            <p style="color: #666; font-size: 12px;">This is an automated notification from the Threat Modeling Platform.</p>
          </div>
        `,
      },
      'threat_identified': {
        subject: 'New {{risk_level}} Risk Threat Identified: {{threat_title}}',
        body: `A new {{risk_level}} risk threat "{{threat_title}}" has been identified in threat model {{model_title}}.

View the threat: {{url}}

This is an automated notification from the Threat Modeling Platform.`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>New Threat Identified</h2>
            <p>A new <strong style="color: #dc3545;">{{risk_level}} risk</strong> threat <strong>"{{threat_title}}"</strong> has been identified in threat model <strong>{{model_title}}</strong>.</p>
            <p><a href="{{url}}" style="background-color: #dc3545; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Threat</a></p>
            <hr>
            <p style="color: #666; font-size: 12px;">This is an automated notification from the Threat Modeling Platform.</p>
          </div>
        `,
      },
      'report_generated': {
        subject: 'Report Generated: {{report_title}}',
        body: `The report "{{report_title}}" has been generated and is ready for download.

Download the report: {{download_url}}

This is an automated notification from the Threat Modeling Platform.`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Report Generated</h2>
            <p>The report <strong>"{{report_title}}"</strong> has been generated and is ready for download.</p>
            <p><a href="{{download_url}}" style="background-color: #28a745; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Download Report</a></p>
            <hr>
            <p style="color: #666; font-size: 12px;">This is an automated notification from the Threat Modeling Platform.</p>
          </div>
        `,
      },
    };

    return templates[type] || {
      subject: 'Notification from Threat Modeling Platform',
      body: 'You have a new notification from the Threat Modeling Platform.',
    };
  }

  // Close the transporter
  async close(): Promise<void> {
    try {
      this.transporter.close();
      logger.info('Email provider closed');
    } catch (error) {
      logger.error('Error closing email provider:', error);
    }
  }
}

export default EmailProvider;