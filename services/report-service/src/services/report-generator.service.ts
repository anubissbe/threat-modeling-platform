import { v4 as uuidv4 } from 'uuid';
import { logger, reportLogger } from '../utils/logger';
import {
  ReportRequest,
  ReportType,
  ReportFormat,
  ReportStatus,
  Report,
  ReportGenerationResult,
  ThreatModelData,
  User,
  ReportMetadata,
} from '../types';
import { PDFGeneratorService } from './pdf-generator.service';
import { HTMLGeneratorService } from './html-generator.service';
import { ChartGeneratorService } from './chart-generator.service';
import { ReportStorageService } from './report-storage.service';
import { config } from '../config';

export class ReportGeneratorService {
  private pdfGenerator: PDFGeneratorService;
  private htmlGenerator: HTMLGeneratorService;
  private chartGenerator: ChartGeneratorService;
  private storageService: ReportStorageService;

  constructor() {
    this.pdfGenerator = new PDFGeneratorService();
    this.htmlGenerator = new HTMLGeneratorService();
    this.chartGenerator = new ChartGeneratorService();
    this.storageService = new ReportStorageService();
  }

  /**
   * Initialize all services
   */
  async initialize(): Promise<void> {
    await Promise.all([
      this.pdfGenerator.initialize(),
      this.htmlGenerator.initialize(),
      this.storageService.initialize(),
    ]);
    logger.info('Report generator initialized');
  }

  /**
   * Generate report based on request
   */
  async generateReport(
    request: ReportRequest,
    threatModelData: ThreatModelData,
    projectData: any,
    userData: User,
    organizationData?: any
  ): Promise<ReportGenerationResult> {
    const startTime = Date.now();
    const reportId = request.id || uuidv4();

    try {
      reportLogger.generationStarted(reportId, request.type, request.format);

      // Prepare metadata
      const metadata: ReportMetadata = {
        title: this.generateReportTitle(request.type, threatModelData.name),
        subtitle: projectData.description,
        author: userData.name || userData.email,
        version: threatModelData.version,
        date: new Date().toISOString(),
        confidentiality: request.metadata?.confidentiality || 'internal',
        tags: request.metadata?.tags || [],
      };

      // Generate report content based on format
      let reportBuffer: Buffer;
      let filename: string;
      let mimeType: string;

      switch (request.format) {
        case ReportFormat.PDF:
          reportBuffer = await this.generatePDFReport(
            request,
            threatModelData,
            metadata
          );
          filename = `${this.sanitizeFilename(threatModelData.name)}_${request.type}_${Date.now()}.pdf`;
          mimeType = 'application/pdf';
          break;

        case ReportFormat.HTML:
          const html = await this.generateHTMLReport(
            request,
            threatModelData,
            metadata
          );
          reportBuffer = Buffer.from(html, 'utf-8');
          filename = `${this.sanitizeFilename(threatModelData.name)}_${request.type}_${Date.now()}.html`;
          mimeType = 'text/html';
          break;

        case ReportFormat.MARKDOWN:
          const markdown = await this.generateMarkdownReport(
            request,
            threatModelData,
            metadata
          );
          reportBuffer = Buffer.from(markdown, 'utf-8');
          filename = `${this.sanitizeFilename(threatModelData.name)}_${request.type}_${Date.now()}.md`;
          mimeType = 'text/markdown';
          break;

        case ReportFormat.JSON:
          const jsonData = {
            metadata,
            threatModel: threatModelData,
            project: projectData,
            generatedAt: new Date().toISOString(),
          };
          reportBuffer = Buffer.from(JSON.stringify(jsonData, null, 2), 'utf-8');
          filename = `${this.sanitizeFilename(threatModelData.name)}_${request.type}_${Date.now()}.json`;
          mimeType = 'application/json';
          break;

        default:
          throw new Error(`Unsupported report format: ${request.format}`);
      }

      // Generate checksum
      const checksum = this.generateChecksum(reportBuffer);
      metadata.checksum = checksum;

      // Save report to storage
      const storageUrl = await this.storageService.save(reportId, reportBuffer, {
        filename,
        mimeType,
        metadata,
      });

      // Create report record
      const report: Report = {
        id: reportId,
        type: request.type,
        format: request.format,
        status: ReportStatus.COMPLETED,
        projectId: request.projectId,
        threatModelId: request.threatModelId,
        userId: request.userId,
        organizationId: userData.organizationId,
        filename,
        url: storageUrl,
        size: reportBuffer.length,
        pages: request.format === ReportFormat.PDF ? await this.countPDFPages(reportBuffer) : undefined,
        generatedAt: new Date(),
        expiresAt: new Date(Date.now() + config.REPORT_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
        metadata,
      };

      const duration = Date.now() - startTime;
      reportLogger.generationCompleted(reportId, duration, report.pages, report.size);

      return {
        success: true,
        report,
        duration,
      };

    } catch (error: any) {
      const duration = Date.now() - startTime;
      reportLogger.generationFailed(reportId, error, duration);

      return {
        success: false,
        error: error.message,
        duration,
      };
    }
  }

  /**
   * Generate PDF report
   */
  private async generatePDFReport(
    request: ReportRequest,
    threatModelData: ThreatModelData,
    metadata: ReportMetadata
  ): Promise<Buffer> {
    // First generate HTML
    const html = await this.htmlGenerator.generateHTML(request.type, {
      threatModel: threatModelData,
      metadata,
      options: request.options,
      branding: request.options?.branding,
    });

    // Add charts if requested
    let enhancedHtml = html;
    if (request.options?.includeCharts) {
      enhancedHtml = await this.embedChartsInHTML(html, threatModelData);
    }

    // Convert HTML to PDF
    const pdfBuffer = await this.pdfGenerator.generatePDF(enhancedHtml, {
      filename: metadata.title,
      branding: request.options?.branding,
      metadata: {
        Title: metadata.title,
        Author: metadata.author,
        Subject: `${request.type} Report`,
        Keywords: metadata.tags?.join(', ') || '',
        Creator: 'Threat Modeling Application',
        Producer: 'Puppeteer',
      },
    });

    // Add watermark if requested
    if (request.options?.branding?.watermark) {
      return await this.pdfGenerator.addWatermark(
        pdfBuffer,
        request.options.branding.watermark
      );
    }

    return pdfBuffer;
  }

  /**
   * Generate HTML report
   */
  private async generateHTMLReport(
    request: ReportRequest,
    threatModelData: ThreatModelData,
    metadata: ReportMetadata
  ): Promise<string> {
    const html = await this.htmlGenerator.generateHTML(request.type, {
      threatModel: threatModelData,
      metadata,
      options: request.options,
      branding: request.options?.branding,
    });

    // Embed charts as base64 images if requested
    if (request.options?.includeCharts) {
      return await this.embedChartsInHTML(html, threatModelData);
    }

    return html;
  }

  /**
   * Generate Markdown report
   */
  private async generateMarkdownReport(
    request: ReportRequest,
    threatModelData: ThreatModelData,
    metadata: ReportMetadata
  ): Promise<string> {
    const sections: string[] = [];

    // Title and metadata
    sections.push(`# ${metadata.title}`);
    sections.push('');
    sections.push(`**Version:** ${metadata.version}`);
    sections.push(`**Date:** ${new Date(metadata.date).toLocaleDateString()}`);
    sections.push(`**Author:** ${metadata.author}`);
    sections.push(`**Confidentiality:** ${metadata.confidentiality}`);
    sections.push('');

    // Executive Summary
    if (request.options?.includeExecutiveSummary) {
      sections.push('## Executive Summary');
      sections.push('');
      sections.push(this.generateExecutiveSummaryMarkdown(threatModelData));
      sections.push('');
    }

    // System Overview
    sections.push('## System Overview');
    sections.push('');
    sections.push(threatModelData.description);
    sections.push('');

    // Components
    sections.push('### Components');
    sections.push('');
    threatModelData.components.forEach(component => {
      sections.push(`#### ${component.name}`);
      sections.push(`- **Type:** ${component.type}`);
      sections.push(`- **Trust Level:** ${component.trustLevel}`);
      sections.push(`- **Technologies:** ${component.technologies.join(', ')}`);
      sections.push(`- **Description:** ${component.description}`);
      sections.push('');
    });

    // Threats
    if (request.options?.includeDetailedThreats) {
      sections.push('## Threat Analysis');
      sections.push('');
      
      threatModelData.threats.forEach(threat => {
        sections.push(`### ${threat.title}`);
        sections.push(`- **ID:** ${threat.id}`);
        sections.push(`- **Severity:** ${threat.severity}`);
        sections.push(`- **Category:** ${threat.category}`);
        sections.push(`- **Status:** ${threat.status}`);
        sections.push(`- **Risk Score:** ${threat.riskScore}/10`);
        sections.push('');
        sections.push(threat.description);
        sections.push('');
      });
    }

    // Mitigations
    if (request.options?.includeMitigations) {
      sections.push('## Mitigations');
      sections.push('');
      
      threatModelData.mitigations.forEach(mitigation => {
        sections.push(`### ${mitigation.title}`);
        sections.push(`- **Status:** ${mitigation.status}`);
        sections.push(`- **Priority:** ${mitigation.priority}`);
        sections.push(`- **Effectiveness:** ${mitigation.effectiveness}%`);
        sections.push('');
        sections.push(mitigation.description);
        sections.push('');
      });
    }

    return sections.join('\n');
  }

  /**
   * Embed charts in HTML as base64 images
   */
  private async embedChartsInHTML(
    html: string,
    threatModelData: ThreatModelData
  ): Promise<string> {
    // Generate charts
    const charts = await this.chartGenerator.generateDashboard(threatModelData);
    
    // Convert charts to base64
    const chartDataUrls = charts.map((chart, index) => {
      const base64 = chart.toString('base64');
      return `data:image/png;base64,${base64}`;
    });

    // Replace chart placeholders in HTML
    let enhancedHtml = html;
    chartDataUrls.forEach((dataUrl, index) => {
      const placeholder = `<div class="chart-container" data-chart-index="${index}"></div>`;
      const img = `<img src="${dataUrl}" class="chart-image" alt="Chart ${index + 1}" />`;
      enhancedHtml = enhancedHtml.replace(placeholder, img);
    });

    return enhancedHtml;
  }

  /**
   * Generate report title
   */
  private generateReportTitle(type: ReportType, projectName: string): string {
    const titles: Record<ReportType, string> = {
      [ReportType.THREAT_MODEL]: `Threat Model Report - ${projectName}`,
      [ReportType.EXECUTIVE_SUMMARY]: `Executive Summary - ${projectName}`,
      [ReportType.TECHNICAL_DETAILED]: `Technical Security Assessment - ${projectName}`,
      [ReportType.COMPLIANCE]: `Compliance Report - ${projectName}`,
      [ReportType.RISK_ASSESSMENT]: `Risk Assessment Report - ${projectName}`,
      [ReportType.MITIGATION_PLAN]: `Mitigation Plan - ${projectName}`,
      [ReportType.AUDIT_LOG]: `Audit Log Report - ${projectName}`,
    };

    return titles[type] || `Security Report - ${projectName}`;
  }

  /**
   * Generate executive summary for markdown
   */
  private generateExecutiveSummaryMarkdown(threatModelData: ThreatModelData): string {
    const totalThreats = threatModelData.threats.length;
    const criticalThreats = threatModelData.threats.filter(t => t.severity === 'critical').length;
    const highThreats = threatModelData.threats.filter(t => t.severity === 'high').length;
    const mitigatedThreats = threatModelData.threats.filter(t => t.status === 'mitigated').length;

    return `The ${threatModelData.name} threat model analysis has identified ${totalThreats} potential security threats. ` +
           `Of these, ${criticalThreats} are classified as critical severity and ${highThreats} as high severity. ` +
           `Currently, ${mitigatedThreats} threats have been mitigated, representing ${Math.round((mitigatedThreats / totalThreats) * 100)}% coverage. ` +
           `The system consists of ${threatModelData.components.length} components with ${threatModelData.dataFlows.length} data flows between them.`;
  }

  /**
   * Sanitize filename
   */
  private sanitizeFilename(filename: string): string {
    return filename
      .replace(/[^a-z0-9]/gi, '_')
      .replace(/_+/g, '_')
      .toLowerCase();
  }

  /**
   * Generate checksum
   */
  private generateChecksum(buffer: Buffer): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Count PDF pages (simplified)
   */
  private async countPDFPages(pdfBuffer: Buffer): Promise<number> {
    // In a real implementation, you would use a PDF parsing library
    // For now, estimate based on size
    const estimatedPages = Math.ceil(pdfBuffer.length / (1024 * 100));
    return Math.max(1, estimatedPages);
  }

  /**
   * Shutdown services
   */
  async shutdown(): Promise<void> {
    await Promise.all([
      this.pdfGenerator.shutdown(),
      // Other services don't need explicit shutdown
    ]);
    logger.info('Report generator shut down');
  }
}