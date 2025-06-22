import * as fs from 'fs/promises';
import * as path from 'path';
import Handlebars from 'handlebars';
import marked from 'marked';
import hljs from 'highlight.js';
import { logger, reportLogger } from '../utils/logger';
import { 
  ReportType, 
  ThreatModelData, 
  BrandingOptions,
  ReportMetadata,
  Threat,
  Mitigation,
  Component
} from '../types';
import { config } from '../config';

export class HTMLGeneratorService {
  private templates: Map<string, HandlebarsTemplateDelegate> = new Map();
  private partials: Map<string, string> = new Map();
  private helpers: Map<string, Handlebars.HelperDelegate> = new Map();

  constructor() {
    this.registerHelpers();
    this.configureMarked();
  }

  /**
   * Initialize templates
   */
  async initialize(): Promise<void> {
    try {
      // Load templates
      await this.loadTemplates();
      
      // Load partials
      await this.loadPartials();
      
      // Register partials with Handlebars
      for (const [name, content] of this.partials) {
        Handlebars.registerPartial(name, content);
      }

      logger.info('HTML generator initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize HTML generator:', error);
      throw error;
    }
  }

  /**
   * Generate HTML report
   */
  async generateHTML(
    type: ReportType,
    data: {
      threatModel: ThreatModelData;
      metadata: ReportMetadata;
      options?: any;
      branding?: BrandingOptions;
    }
  ): Promise<string> {
    const startTime = Date.now();

    try {
      // Get template for report type
      const template = await this.getTemplate(type);
      
      // Prepare data with computed values
      const preparedData = this.prepareData(data);
      
      // Render template
      const html = template(preparedData);
      
      // Apply branding if provided
      const brandedHtml = data.branding 
        ? this.applyBranding(html, data.branding)
        : html;

      const duration = Date.now() - startTime;
      reportLogger.templateRendered(type, duration);

      return brandedHtml;

    } catch (error) {
      logger.error('HTML generation failed:', error);
      throw error;
    }
  }

  /**
   * Generate executive summary HTML
   */
  async generateExecutiveSummary(data: ThreatModelData): Promise<string> {
    const template = await this.getTemplate(ReportType.EXECUTIVE_SUMMARY);
    
    const summaryData = {
      projectName: data.name,
      totalThreats: data.threats.length,
      criticalThreats: data.threats.filter(t => t.severity === 'critical').length,
      highThreats: data.threats.filter(t => t.severity === 'high').length,
      mitigatedThreats: data.threats.filter(t => t.status === 'mitigated').length,
      totalComponents: data.components.length,
      riskScore: this.calculateOverallRiskScore(data.threats),
      topRisks: this.getTopRisks(data.threats, 5),
      mitigationProgress: this.calculateMitigationProgress(data.threats),
      recommendations: this.generateRecommendations(data),
    };

    return template(summaryData);
  }

  /**
   * Load templates from filesystem
   */
  private async loadTemplates(): Promise<void> {
    const templateDir = path.join(config.TEMPLATE_PATH, 'html');
    
    const templateFiles = [
      { name: ReportType.THREAT_MODEL, file: 'threat-model.hbs' },
      { name: ReportType.EXECUTIVE_SUMMARY, file: 'executive-summary.hbs' },
      { name: ReportType.TECHNICAL_DETAILED, file: 'technical-detailed.hbs' },
      { name: ReportType.COMPLIANCE, file: 'compliance.hbs' },
      { name: ReportType.RISK_ASSESSMENT, file: 'risk-assessment.hbs' },
      { name: ReportType.MITIGATION_PLAN, file: 'mitigation-plan.hbs' },
    ];

    for (const { name, file } of templateFiles) {
      try {
        const templatePath = path.join(templateDir, file);
        const content = await fs.readFile(templatePath, 'utf-8');
        const compiled = Handlebars.compile(content);
        this.templates.set(name, compiled);
      } catch (error) {
        logger.warn(`Template not found: ${file}, using default`);
        this.templates.set(name, this.getDefaultTemplate(name));
      }
    }
  }

  /**
   * Load partial templates
   */
  private async loadPartials(): Promise<void> {
    const partialsDir = path.join(config.TEMPLATE_PATH, 'html', 'partials');
    
    const partialFiles = [
      'header.hbs',
      'footer.hbs',
      'threat-card.hbs',
      'component-card.hbs',
      'mitigation-card.hbs',
      'risk-matrix.hbs',
      'chart-container.hbs',
      'metadata-table.hbs',
    ];

    for (const file of partialFiles) {
      try {
        const partialPath = path.join(partialsDir, file);
        const content = await fs.readFile(partialPath, 'utf-8');
        const name = path.basename(file, '.hbs');
        this.partials.set(name, content);
      } catch (error) {
        logger.warn(`Partial not found: ${file}`);
      }
    }
  }

  /**
   * Register Handlebars helpers
   */
  private registerHelpers(): void {
    // Date formatting
    Handlebars.registerHelper('formatDate', (date: Date | string) => {
      return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    });

    // Severity badge
    Handlebars.registerHelper('severityBadge', (severity: string) => {
      const colors = {
        critical: '#dc3545',
        high: '#fd7e14',
        medium: '#ffc107',
        low: '#28a745',
      };
      const color = colors[severity as keyof typeof colors] || '#6c757d';
      return new Handlebars.SafeString(
        `<span class="badge" style="background-color: ${color};">${severity.toUpperCase()}</span>`
      );
    });

    // Status badge
    Handlebars.registerHelper('statusBadge', (status: string) => {
      const colors = {
        identified: '#6c757d',
        analyzed: '#17a2b8',
        mitigated: '#28a745',
        accepted: '#ffc107',
        transferred: '#007bff',
      };
      const color = colors[status as keyof typeof colors] || '#6c757d';
      return new Handlebars.SafeString(
        `<span class="badge" style="background-color: ${color};">${status.toUpperCase()}</span>`
      );
    });

    // Markdown rendering
    Handlebars.registerHelper('markdown', (text: string) => {
      return new Handlebars.SafeString(marked.parse(text || ''));
    });

    // Percentage
    Handlebars.registerHelper('percentage', (value: number, total: number) => {
      if (total === 0) return '0%';
      return `${Math.round((value / total) * 100)}%`;
    });

    // Risk score color
    Handlebars.registerHelper('riskColor', (score: number) => {
      if (score >= 8) return '#dc3545';
      if (score >= 6) return '#fd7e14';
      if (score >= 4) return '#ffc107';
      return '#28a745';
    });

    // Array join
    Handlebars.registerHelper('join', (array: any[], separator: string) => {
      return Array.isArray(array) ? array.join(separator) : '';
    });

    // Conditional helpers
    Handlebars.registerHelper('eq', (a: any, b: any) => a === b);
    Handlebars.registerHelper('ne', (a: any, b: any) => a !== b);
    Handlebars.registerHelper('lt', (a: number, b: number) => a < b);
    Handlebars.registerHelper('gt', (a: number, b: number) => a > b);
    Handlebars.registerHelper('lte', (a: number, b: number) => a <= b);
    Handlebars.registerHelper('gte', (a: number, b: number) => a >= b);

    // Array length
    Handlebars.registerHelper('length', (array: any[]) => {
      return Array.isArray(array) ? array.length : 0;
    });

    // Chart helper
    Handlebars.registerHelper('chartData', (type: string, data: any) => {
      return new Handlebars.SafeString(
        `<div class="chart-container" data-chart-type="${type}" data-chart-data='${JSON.stringify(data)}'></div>`
      );
    });
  }

  /**
   * Configure marked for markdown rendering
   */
  private configureMarked(): void {
    marked.setOptions({
      highlight: (code, lang) => {
        const language = hljs.getLanguage(lang) ? lang : 'plaintext';
        return hljs.highlight(code, { language }).value;
      },
      breaks: true,
      gfm: true,
    });
  }

  /**
   * Get template by type
   */
  private async getTemplate(type: ReportType): Promise<HandlebarsTemplateDelegate> {
    const template = this.templates.get(type);
    if (!template) {
      throw new Error(`Template not found for report type: ${type}`);
    }
    return template;
  }

  /**
   * Get default template
   */
  private getDefaultTemplate(type: ReportType): HandlebarsTemplateDelegate {
    const defaultTemplate = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>{{metadata.title}}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; }
          h1 { color: #333; }
          .section { margin-bottom: 30px; }
          .threat { border: 1px solid #ddd; padding: 15px; margin-bottom: 10px; }
          .badge { padding: 3px 8px; border-radius: 3px; color: white; font-size: 12px; }
        </style>
      </head>
      <body>
        <h1>{{metadata.title}}</h1>
        <p>Report Type: ${type}</p>
        <div class="content">
          {{#each threats}}
            <div class="threat">
              <h3>{{title}}</h3>
              <p>{{description}}</p>
              <p>Severity: {{severityBadge severity}}</p>
            </div>
          {{/each}}
        </div>
      </body>
      </html>
    `;
    return Handlebars.compile(defaultTemplate);
  }

  /**
   * Prepare data for template
   */
  private prepareData(data: any): any {
    return {
      ...data,
      generatedAt: new Date().toISOString(),
      statistics: this.calculateStatistics(data.threatModel),
      charts: this.prepareChartData(data.threatModel),
      summaries: this.generateSummaries(data.threatModel),
    };
  }

  /**
   * Calculate statistics
   */
  private calculateStatistics(threatModel: ThreatModelData): any {
    const threats = threatModel.threats || [];
    const mitigations = threatModel.mitigations || [];

    return {
      totalThreats: threats.length,
      threatsBySeverity: {
        critical: threats.filter(t => t.severity === 'critical').length,
        high: threats.filter(t => t.severity === 'high').length,
        medium: threats.filter(t => t.severity === 'medium').length,
        low: threats.filter(t => t.severity === 'low').length,
      },
      threatsByStatus: {
        identified: threats.filter(t => t.status === 'identified').length,
        analyzed: threats.filter(t => t.status === 'analyzed').length,
        mitigated: threats.filter(t => t.status === 'mitigated').length,
        accepted: threats.filter(t => t.status === 'accepted').length,
      },
      totalMitigations: mitigations.length,
      mitigationsByStatus: {
        proposed: mitigations.filter(m => m.status === 'proposed').length,
        approved: mitigations.filter(m => m.status === 'approved').length,
        implemented: mitigations.filter(m => m.status === 'implemented').length,
        verified: mitigations.filter(m => m.status === 'verified').length,
      },
      overallRiskScore: this.calculateOverallRiskScore(threats),
      mitigationCoverage: this.calculateMitigationCoverage(threats),
    };
  }

  /**
   * Prepare chart data
   */
  private prepareChartData(threatModel: ThreatModelData): any {
    return {
      severityDistribution: this.prepareSeverityChart(threatModel.threats),
      riskMatrix: this.prepareRiskMatrix(threatModel.threats),
      componentRisks: this.prepareComponentRiskChart(threatModel),
      mitigationProgress: this.prepareMitigationProgressChart(threatModel),
      threatTimeline: this.prepareThreatTimeline(threatModel.threats),
    };
  }

  /**
   * Generate summaries
   */
  private generateSummaries(threatModel: ThreatModelData): any {
    return {
      executive: this.generateExecutiveSummaryText(threatModel),
      technical: this.generateTechnicalSummary(threatModel),
      recommendations: this.generateRecommendations(threatModel),
    };
  }

  /**
   * Apply branding to HTML
   */
  private applyBranding(html: string, branding: BrandingOptions): string {
    const brandingStyles = `
      <style>
        :root {
          --primary-color: ${branding.primaryColor || '#1a73e8'};
          --secondary-color: ${branding.secondaryColor || '#5f6368'};
          --font-family: ${branding.fontFamily || 'Arial, sans-serif'};
        }
        body { font-family: var(--font-family); }
        h1, h2, h3 { color: var(--primary-color); }
        .header-logo { max-height: 60px; }
        .watermark {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%) rotate(-45deg);
          font-size: 120px;
          color: rgba(0, 0, 0, 0.05);
          z-index: -1;
        }
      </style>
    `;

    // Inject branding styles
    html = html.replace('</head>', `${brandingStyles}</head>`);

    // Add watermark if specified
    if (branding.watermark) {
      const watermark = `<div class="watermark">${branding.watermark}</div>`;
      html = html.replace('<body>', `<body>${watermark}`);
    }

    return html;
  }

  // Helper calculation methods
  private calculateOverallRiskScore(threats: Threat[]): number {
    if (threats.length === 0) return 0;
    const totalScore = threats.reduce((sum, threat) => sum + threat.riskScore, 0);
    return Math.round((totalScore / threats.length) * 10) / 10;
  }

  private calculateMitigationProgress(threats: Threat[]): number {
    if (threats.length === 0) return 100;
    const mitigated = threats.filter(t => t.status === 'mitigated').length;
    return Math.round((mitigated / threats.length) * 100);
  }

  private calculateMitigationCoverage(threats: Threat[]): number {
    const threatsWithMitigations = threats.filter(t => t.mitigations && t.mitigations.length > 0).length;
    return threats.length > 0 ? Math.round((threatsWithMitigations / threats.length) * 100) : 0;
  }

  private getTopRisks(threats: Threat[], count: number): Threat[] {
    return threats
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, count);
  }

  private generateRecommendations(threatModel: ThreatModelData): string[] {
    const recommendations: string[] = [];
    
    const criticalThreats = threatModel.threats.filter(t => t.severity === 'critical');
    if (criticalThreats.length > 0) {
      recommendations.push(`Address ${criticalThreats.length} critical threats immediately`);
    }

    const unmitigatedHighRisk = threatModel.threats.filter(
      t => t.riskScore >= 7 && t.status !== 'mitigated'
    );
    if (unmitigatedHighRisk.length > 0) {
      recommendations.push(`Implement mitigations for ${unmitigatedHighRisk.length} high-risk threats`);
    }

    return recommendations;
  }

  private prepareSeverityChart(threats: Threat[]): any {
    const severityCounts = {
      critical: threats.filter(t => t.severity === 'critical').length,
      high: threats.filter(t => t.severity === 'high').length,
      medium: threats.filter(t => t.severity === 'medium').length,
      low: threats.filter(t => t.severity === 'low').length,
    };

    return {
      labels: Object.keys(severityCounts),
      datasets: [{
        data: Object.values(severityCounts),
        backgroundColor: ['#dc3545', '#fd7e14', '#ffc107', '#28a745'],
      }],
    };
  }

  private prepareRiskMatrix(threats: Threat[]): any {
    // Risk matrix data preparation
    const matrix: number[][] = Array(5).fill(null).map(() => Array(5).fill(0));
    
    threats.forEach(threat => {
      const likelihoodIndex = this.getLikelihoodIndex(threat.likelihood);
      const impactIndex = this.getImpactIndex(threat.impact);
      matrix[likelihoodIndex][impactIndex]++;
    });

    return matrix;
  }

  private prepareComponentRiskChart(threatModel: ThreatModelData): any {
    const componentRisks = threatModel.components.map(component => {
      const componentThreats = threatModel.threats.filter(
        t => t.affectedComponents.includes(component.id)
      );
      const avgRisk = componentThreats.length > 0
        ? componentThreats.reduce((sum, t) => sum + t.riskScore, 0) / componentThreats.length
        : 0;

      return {
        name: component.name,
        risk: avgRisk,
        threatCount: componentThreats.length,
      };
    });

    return {
      labels: componentRisks.map(c => c.name),
      datasets: [{
        label: 'Average Risk Score',
        data: componentRisks.map(c => c.risk),
        backgroundColor: '#1a73e8',
      }],
    };
  }

  private prepareMitigationProgressChart(threatModel: ThreatModelData): any {
    const statusCounts = {
      proposed: 0,
      approved: 0,
      implemented: 0,
      verified: 0,
    };

    threatModel.mitigations.forEach(mitigation => {
      statusCounts[mitigation.status]++;
    });

    return {
      labels: Object.keys(statusCounts),
      datasets: [{
        data: Object.values(statusCounts),
        backgroundColor: ['#6c757d', '#17a2b8', '#ffc107', '#28a745'],
      }],
    };
  }

  private prepareThreatTimeline(threats: Threat[]): any {
    // Group threats by month
    const timeline: Record<string, number> = {};
    
    // This is simplified - in real implementation, you'd use actual dates
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    months.forEach(month => {
      timeline[month] = Math.floor(Math.random() * 10) + 1;
    });

    return {
      labels: Object.keys(timeline),
      datasets: [{
        label: 'Threats Identified',
        data: Object.values(timeline),
        borderColor: '#1a73e8',
        fill: false,
      }],
    };
  }

  private getLikelihoodIndex(likelihood: string): number {
    const map: Record<string, number> = {
      'very-low': 0,
      'low': 1,
      'medium': 2,
      'high': 3,
      'very-high': 4,
    };
    return map[likelihood] || 2;
  }

  private getImpactIndex(impact: string): number {
    const map: Record<string, number> = {
      'negligible': 0,
      'minor': 1,
      'moderate': 2,
      'major': 3,
      'catastrophic': 4,
    };
    return map[impact] || 2;
  }

  private generateExecutiveSummaryText(threatModel: ThreatModelData): string {
    const stats = this.calculateStatistics(threatModel);
    return `The ${threatModel.name} threat model analysis identified ${stats.totalThreats} threats, ` +
           `with ${stats.threatsBySeverity.critical} critical and ${stats.threatsBySeverity.high} high severity issues. ` +
           `Current mitigation coverage is ${stats.mitigationCoverage}% with an overall risk score of ${stats.overallRiskScore}.`;
  }

  private generateTechnicalSummary(threatModel: ThreatModelData): string {
    const components = threatModel.components.length;
    const dataFlows = threatModel.dataFlows.length;
    return `The system consists of ${components} components with ${dataFlows} data flows. ` +
           `Analysis covered STRIDE threat categories with DREAD risk scoring methodology.`;
  }
}