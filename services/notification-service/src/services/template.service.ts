import * as fs from 'fs/promises';
import * as path from 'path';
import Handlebars from 'handlebars';
import { config } from '../config';
import { logger } from '../utils/logger';
import { NotificationTemplate, TemplateData } from '../types';

export class TemplateService {
  private templates: Map<string, HandlebarsTemplateDelegate> = new Map();
  private templatePath: string;
  private handlebars: typeof Handlebars;

  constructor() {
    this.templatePath = path.resolve(config.TEMPLATE_PATH);
    this.handlebars = Handlebars.create();
    this.registerHelpers();
  }

  async initialize(): Promise<void> {
    logger.info('Initializing template service', { path: this.templatePath });
    
    try {
      await this.loadTemplates();
      logger.info(`Loaded ${this.templates.size} templates`);
    } catch (error) {
      logger.error('Failed to initialize template service:', error);
      throw error;
    }
  }

  private registerHelpers(): void {
    // Date formatting helper
    this.handlebars.registerHelper('formatDate', (date: Date | string, format?: string) => {
      const d = new Date(date);
      if (format === 'short') {
        return d.toLocaleDateString();
      } else if (format === 'long') {
        return d.toLocaleString();
      }
      return d.toISOString();
    });

    // Pluralize helper
    this.handlebars.registerHelper('pluralize', (count: number, singular: string, plural?: string) => {
      return count === 1 ? singular : (plural || `${singular}s`);
    });

    // Severity color helper
    this.handlebars.registerHelper('severityColor', (severity: string) => {
      const colors: Record<string, string> = {
        critical: '#d32f2f',
        high: '#f57c00',
        medium: '#fbc02d',
        low: '#388e3c',
        info: '#1976d2',
      };
      return colors[severity.toLowerCase()] || '#757575';
    });

    // Truncate helper
    this.handlebars.registerHelper('truncate', (text: string, length: number) => {
      if (text.length <= length) return text;
      return text.substring(0, length - 3) + '...';
    });

    // JSON stringify helper
    this.handlebars.registerHelper('json', (context: any) => {
      return JSON.stringify(context, null, 2);
    });

    // Conditional helpers
    this.handlebars.registerHelper('eq', (a: any, b: any) => a === b);
    this.handlebars.registerHelper('ne', (a: any, b: any) => a !== b);
    this.handlebars.registerHelper('lt', (a: any, b: any) => a < b);
    this.handlebars.registerHelper('gt', (a: any, b: any) => a > b);
    this.handlebars.registerHelper('lte', (a: any, b: any) => a <= b);
    this.handlebars.registerHelper('gte', (a: any, b: any) => a >= b);

    // URL encode helper
    this.handlebars.registerHelper('urlencode', (text: string) => {
      return encodeURIComponent(text);
    });

    // Risk level helper
    this.handlebars.registerHelper('riskLevel', (score: number) => {
      if (score >= 80) return 'Critical';
      if (score >= 60) return 'High';
      if (score >= 40) return 'Medium';
      if (score >= 20) return 'Low';
      return 'Info';
    });
  }

  private async loadTemplates(): Promise<void> {
    const templateDirs = ['email', 'sms', 'slack'];
    
    for (const dir of templateDirs) {
      const dirPath = path.join(this.templatePath, dir);
      
      try {
        const files = await fs.readdir(dirPath);
        
        for (const file of files) {
          if (file.endsWith('.hbs') || file.endsWith('.handlebars')) {
            const templateName = `${dir}/${path.basename(file, path.extname(file))}`;
            const filePath = path.join(dirPath, file);
            
            const content = await fs.readFile(filePath, 'utf-8');
            const compiled = this.handlebars.compile(content);
            
            this.templates.set(templateName, compiled);
            logger.debug(`Loaded template: ${templateName}`);
          }
        }
      } catch (error: any) {
        if (error.code === 'ENOENT') {
          logger.warn(`Template directory not found: ${dirPath}`);
        } else {
          throw error;
        }
      }
    }
  }

  async render(templateName: string, data: TemplateData): Promise<string> {
    const startTime = Date.now();
    
    try {
      const template = this.templates.get(templateName);
      
      if (!template) {
        // Try to load template dynamically
        const loaded = await this.loadTemplate(templateName);
        if (!loaded) {
          throw new Error(`Template not found: ${templateName}`);
        }
      }

      const rendered = this.templates.get(templateName)!(data);
      
      const duration = Date.now() - startTime;
      logger.debug(`Rendered template ${templateName} in ${duration}ms`);
      
      return rendered;
    } catch (error) {
      logger.error(`Failed to render template ${templateName}:`, error);
      throw error;
    }
  }

  private async loadTemplate(templateName: string): Promise<boolean> {
    try {
      const filePath = path.join(this.templatePath, `${templateName}.hbs`);
      const content = await fs.readFile(filePath, 'utf-8');
      const compiled = this.handlebars.compile(content);
      
      this.templates.set(templateName, compiled);
      return true;
    } catch (error) {
      return false;
    }
  }

  // Predefined template data builders
  static buildThreatAlertData(threat: {
    id: string;
    title: string;
    description: string;
    severity: string;
    category: string;
    affectedAssets: string[];
    recommendations: string[];
    detectedAt: Date;
  }): TemplateData {
    return {
      type: 'threat_alert',
      threat,
      timestamp: new Date(),
      actionUrl: `${process.env.APP_URL}/threats/${threat.id}`,
    };
  }

  static buildProjectUpdateData(project: {
    id: string;
    name: string;
    status: string;
    completionPercentage: number;
    threats: number;
    vulnerabilities: number;
    lastUpdated: Date;
  }): TemplateData {
    return {
      type: 'project_update',
      project,
      timestamp: new Date(),
      dashboardUrl: `${process.env.APP_URL}/projects/${project.id}`,
    };
  }

  static buildSecurityReportData(report: {
    id: string;
    title: string;
    summary: string;
    metrics: {
      totalThreats: number;
      criticalThreats: number;
      resolvedThreats: number;
      openVulnerabilities: number;
      riskScore: number;
    };
    recommendations: string[];
    generatedAt: Date;
  }): TemplateData {
    return {
      type: 'security_report',
      report,
      timestamp: new Date(),
      reportUrl: `${process.env.APP_URL}/reports/${report.id}`,
    };
  }

  static buildUserActionData(action: {
    type: string;
    description: string;
    user: {
      id: string;
      name: string;
      email: string;
    };
    metadata?: any;
  }): TemplateData {
    return {
      type: 'user_action',
      action,
      timestamp: new Date(),
      profileUrl: `${process.env.APP_URL}/profile`,
    };
  }

  static buildSystemAlertData(alert: {
    level: string;
    title: string;
    message: string;
    details?: string;
    actionRequired: boolean;
  }): TemplateData {
    return {
      type: 'system_alert',
      alert,
      timestamp: new Date(),
      systemStatusUrl: `${process.env.APP_URL}/system/status`,
    };
  }

  // Cache management
  async reloadTemplates(): Promise<void> {
    this.templates.clear();
    await this.loadTemplates();
    logger.info('Templates reloaded');
  }

  getLoadedTemplates(): string[] {
    return Array.from(this.templates.keys());
  }

  hasTemplate(templateName: string): boolean {
    return this.templates.has(templateName);
  }
}

// Export singleton instance
export const templateService = new TemplateService();