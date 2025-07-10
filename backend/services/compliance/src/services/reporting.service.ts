import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs/promises';
import * as path from 'path';
import PDFDocument from 'pdf-lib';
import { logger } from '../utils/logger';
import {
  ComplianceReport,
  ComplianceFramework,
  ComplianceAssessment,
  ComplianceControl,
  ComplianceFinding,
  ComplianceRecommendation,
  GenerateReportRequest,
  ComplianceDashboard,
  AssessmentEvidence
} from '../types/compliance';

export class ComplianceReportingService {
  private reports: Map<string, ComplianceReport> = new Map();
  private reportsDirectory = '/tmp/compliance-reports';

  constructor() {
    this.initializeReportsDirectory();
  }

  private async initializeReportsDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.reportsDirectory, { recursive: true });
      logger.info('Compliance reports directory initialized');
    } catch (error) {
      logger.error('Error creating reports directory:', error);
    }
  }

  /**
   * Generate a compliance report
   */
  async generateReport(
    request: GenerateReportRequest,
    assessments: ComplianceAssessment[],
    controls: ComplianceControl[],
    findings: ComplianceFinding[],
    recommendations: ComplianceRecommendation[],
    evidence: AssessmentEvidence[],
    userId: string
  ): Promise<ComplianceReport> {
    try {
      const report: ComplianceReport = {
        id: uuidv4(),
        name: request.name,
        description: `${request.type} report for ${request.frameworks.join(', ')} frameworks`,
        type: request.type,
        format: request.format,
        frameworks: request.frameworks,
        assessmentIds: request.assessmentIds,
        dateRange: request.dateRange ? {
          startDate: new Date(request.dateRange.startDate),
          endDate: new Date(request.dateRange.endDate)
        } : undefined,
        includeExecutiveSummary: request.includeExecutiveSummary || true,
        includeDetailedFindings: request.includeDetailedFindings || true,
        includeRecommendations: request.includeRecommendations || true,
        includeEvidence: request.includeEvidence || false,
        includeCharts: true,
        includeTrendAnalysis: true,
        status: 'queued',
        recipients: request.recipients,
        encrypted: false,
        passwordProtected: false,
        accessLevel: 'internal',
        generatedBy: userId,
        version: '1.0',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      this.reports.set(report.id, report);

      // Generate the report content based on format
      await this.generateReportContent(report, assessments, controls, findings, recommendations, evidence);

      // Update report status
      report.status = 'completed';
      report.generatedAt = new Date();
      report.updatedAt = new Date();

      this.reports.set(report.id, report);

      logger.info(`Generated compliance report: ${report.id} (${report.format})`);
      return report;
    } catch (error) {
      logger.error('Error generating compliance report:', error);
      throw error;
    }
  }

  /**
   * Generate report content based on format
   */
  private async generateReportContent(
    report: ComplianceReport,
    assessments: ComplianceAssessment[],
    controls: ComplianceControl[],
    findings: ComplianceFinding[],
    recommendations: ComplianceRecommendation[],
    evidence: AssessmentEvidence[]
  ): Promise<void> {
    try {
      report.status = 'generating';

      // Filter data based on report scope
      const filteredAssessments = this.filterAssessments(assessments, report);
      const filteredControls = this.filterControls(controls, report);
      const filteredFindings = this.filterFindings(findings, report);
      const filteredRecommendations = this.filterRecommendations(recommendations, report);
      const filteredEvidence = this.filterEvidence(evidence, report);

      // Generate content based on format
      switch (report.format) {
        case 'pdf':
          await this.generatePDFReport(report, filteredAssessments, filteredControls, filteredFindings, filteredRecommendations, filteredEvidence);
          break;
        case 'html':
          await this.generateHTMLReport(report, filteredAssessments, filteredControls, filteredFindings, filteredRecommendations, filteredEvidence);
          break;
        case 'excel':
          await this.generateExcelReport(report, filteredAssessments, filteredControls, filteredFindings, filteredRecommendations, filteredEvidence);
          break;
        case 'csv':
          await this.generateCSVReport(report, filteredAssessments, filteredControls, filteredFindings, filteredRecommendations, filteredEvidence);
          break;
        case 'json':
          await this.generateJSONReport(report, filteredAssessments, filteredControls, filteredFindings, filteredRecommendations, filteredEvidence);
          break;
        case 'xml':
          await this.generateXMLReport(report, filteredAssessments, filteredControls, filteredFindings, filteredRecommendations, filteredEvidence);
          break;
        default:
          throw new Error(`Unsupported report format: ${report.format}`);
      }
    } catch (error) {
      report.status = 'failed';
      throw error;
    }
  }

  /**
   * Generate PDF report
   */
  private async generatePDFReport(
    report: ComplianceReport,
    assessments: ComplianceAssessment[],
    controls: ComplianceControl[],
    findings: ComplianceFinding[],
    recommendations: ComplianceRecommendation[],
    evidence: AssessmentEvidence[]
  ): Promise<void> {
    const fileName = `${report.id}.pdf`;
    const filePath = path.join(this.reportsDirectory, fileName);

    // Create comprehensive PDF content
    const pdfContent = this.generatePDFContent(report, assessments, controls, findings, recommendations, evidence);
    
    // For now, create a simple text file (in production, would use proper PDF generation)
    await fs.writeFile(filePath, pdfContent, 'utf8');

    const stats = await fs.stat(filePath);
    report.filePath = filePath;
    report.fileSize = stats.size;
  }

  /**
   * Generate HTML report
   */
  private async generateHTMLReport(
    report: ComplianceReport,
    assessments: ComplianceAssessment[],
    controls: ComplianceControl[],
    findings: ComplianceFinding[],
    recommendations: ComplianceRecommendation[],
    evidence: AssessmentEvidence[]
  ): Promise<void> {
    const fileName = `${report.id}.html`;
    const filePath = path.join(this.reportsDirectory, fileName);

    const htmlContent = this.generateHTMLContent(report, assessments, controls, findings, recommendations, evidence);
    await fs.writeFile(filePath, htmlContent, 'utf8');

    const stats = await fs.stat(filePath);
    report.filePath = filePath;
    report.fileSize = stats.size;
  }

  /**
   * Generate JSON report
   */
  private async generateJSONReport(
    report: ComplianceReport,
    assessments: ComplianceAssessment[],
    controls: ComplianceControl[],
    findings: ComplianceFinding[],
    recommendations: ComplianceRecommendation[],
    evidence: AssessmentEvidence[]
  ): Promise<void> {
    const fileName = `${report.id}.json`;
    const filePath = path.join(this.reportsDirectory, fileName);

    const jsonData = {
      reportMetadata: {
        id: report.id,
        name: report.name,
        type: report.type,
        frameworks: report.frameworks,
        generatedAt: report.generatedAt,
        generatedBy: report.generatedBy
      },
      executiveSummary: this.generateExecutiveSummary(assessments, controls, findings),
      assessments: assessments.map(a => ({
        id: a.id,
        name: a.name,
        framework: a.framework,
        status: a.status,
        overallStatus: a.overallStatus,
        complianceScore: a.complianceScore,
        totalControls: a.totalControls,
        compliantControls: a.compliantControls,
        nonCompliantControls: a.nonCompliantControls,
        startDate: a.startDate,
        endDate: a.endDate
      })),
      controls: controls.map(c => ({
        id: c.id,
        framework: c.framework,
        controlId: c.controlId,
        title: c.title,
        category: c.category,
        status: c.status,
        priority: c.priority,
        riskLevel: c.riskLevel,
        implementationStatus: c.implementationStatus,
        lastAssessed: c.lastAssessed
      })),
      findings: findings.map(f => ({
        id: f.id,
        controlId: f.controlId,
        title: f.title,
        description: f.description,
        severity: f.severity,
        category: f.category,
        status: f.status,
        discoveryDate: f.discoveryDate
      })),
      recommendations: recommendations.map(r => ({
        id: r.id,
        title: r.title,
        description: r.description,
        priority: r.priority,
        effort: r.effort,
        status: r.status,
        affectedControls: r.affectedControls
      })),
      statistics: this.generateStatistics(assessments, controls, findings),
      charts: this.generateChartData(assessments, controls, findings)
    };

    await fs.writeFile(filePath, JSON.stringify(jsonData, null, 2), 'utf8');

    const stats = await fs.stat(filePath);
    report.filePath = filePath;
    report.fileSize = stats.size;
  }

  /**
   * Generate CSV report
   */
  private async generateCSVReport(
    report: ComplianceReport,
    assessments: ComplianceAssessment[],
    controls: ComplianceControl[],
    findings: ComplianceFinding[],
    recommendations: ComplianceRecommendation[],
    evidence: AssessmentEvidence[]
  ): Promise<void> {
    const fileName = `${report.id}.csv`;
    const filePath = path.join(this.reportsDirectory, fileName);

    let csvContent = '';

    // Add controls data
    csvContent += 'Control ID,Framework,Title,Category,Status,Priority,Risk Level,Implementation Status,Last Assessed\n';
    for (const control of controls) {
      csvContent += `"${control.controlId}","${control.framework}","${control.title}","${control.category}","${control.status}","${control.priority}","${control.riskLevel}","${control.implementationStatus}","${control.lastAssessed || 'Never'}"\n`;
    }

    csvContent += '\n\nFindings\n';
    csvContent += 'Finding ID,Control ID,Title,Severity,Category,Status,Discovery Date\n';
    for (const finding of findings) {
      csvContent += `"${finding.id}","${finding.controlId}","${finding.title}","${finding.severity}","${finding.category}","${finding.status}","${finding.discoveryDate}"\n`;
    }

    await fs.writeFile(filePath, csvContent, 'utf8');

    const stats = await fs.stat(filePath);
    report.filePath = filePath;
    report.fileSize = stats.size;
  }

  /**
   * Generate Excel report
   */
  private async generateExcelReport(
    report: ComplianceReport,
    assessments: ComplianceAssessment[],
    controls: ComplianceControl[],
    findings: ComplianceFinding[],
    recommendations: ComplianceRecommendation[],
    evidence: AssessmentEvidence[]
  ): Promise<void> {
    // For simplicity, generate as CSV with Excel-compatible formatting
    await this.generateCSVReport(report, assessments, controls, findings, recommendations, evidence);
    
    // Rename to .xlsx extension
    const oldPath = report.filePath!;
    const newPath = oldPath.replace('.csv', '.xlsx');
    await fs.rename(oldPath, newPath);
    report.filePath = newPath;
  }

  /**
   * Generate XML report
   */
  private async generateXMLReport(
    report: ComplianceReport,
    assessments: ComplianceAssessment[],
    controls: ComplianceControl[],
    findings: ComplianceFinding[],
    recommendations: ComplianceRecommendation[],
    evidence: AssessmentEvidence[]
  ): Promise<void> {
    const fileName = `${report.id}.xml`;
    const filePath = path.join(this.reportsDirectory, fileName);

    const xmlContent = this.generateXMLContent(report, assessments, controls, findings, recommendations, evidence);
    await fs.writeFile(filePath, xmlContent, 'utf8');

    const stats = await fs.stat(filePath);
    report.filePath = filePath;
    report.fileSize = stats.size;
  }

  /**
   * Generate executive summary
   */
  private generateExecutiveSummary(
    assessments: ComplianceAssessment[],
    controls: ComplianceControl[],
    findings: ComplianceFinding[]
  ): any {
    const totalAssessments = assessments.length;
    const completedAssessments = assessments.filter(a => a.status === 'completed').length;
    
    const averageScore = assessments.length > 0 
      ? Math.round(assessments.reduce((sum, a) => sum + a.complianceScore, 0) / assessments.length)
      : 0;
    
    const totalControls = controls.length;
    const compliantControls = controls.filter(c => c.status === 'compliant').length;
    const nonCompliantControls = controls.filter(c => c.status === 'non-compliant').length;
    
    const totalFindings = findings.length;
    const criticalFindings = findings.filter(f => f.severity === 'critical').length;
    const highFindings = findings.filter(f => f.severity === 'high').length;
    const openFindings = findings.filter(f => f.status === 'open').length;

    return {
      assessmentSummary: {
        totalAssessments,
        completedAssessments,
        averageComplianceScore: averageScore,
        assessmentCompletionRate: totalAssessments > 0 ? Math.round((completedAssessments / totalAssessments) * 100) : 0
      },
      controlSummary: {
        totalControls,
        compliantControls,
        nonCompliantControls,
        complianceRate: totalControls > 0 ? Math.round((compliantControls / totalControls) * 100) : 0
      },
      findingsSummary: {
        totalFindings,
        criticalFindings,
        highFindings,
        openFindings,
        resolutionRate: totalFindings > 0 ? Math.round(((totalFindings - openFindings) / totalFindings) * 100) : 0
      },
      riskAssessment: {
        overallRiskLevel: this.calculateOverallRiskLevel(findings),
        riskTrend: 'stable', // Would be calculated from historical data
        keyRiskAreas: this.identifyKeyRiskAreas(findings)
      }
    };
  }

  /**
   * Generate statistics for the report
   */
  private generateStatistics(
    assessments: ComplianceAssessment[],
    controls: ComplianceControl[],
    findings: ComplianceFinding[]
  ): any {
    return {
      frameworkStats: this.calculateFrameworkStatistics(assessments, controls),
      categoryStats: this.calculateCategoryStatistics(controls),
      severityStats: this.calculateSeverityStatistics(findings),
      trendStats: this.calculateTrendStatistics(assessments),
      performanceStats: this.calculatePerformanceStatistics(assessments, controls)
    };
  }

  /**
   * Generate chart data for visualizations
   */
  private generateChartData(
    assessments: ComplianceAssessment[],
    controls: ComplianceControl[],
    findings: ComplianceFinding[]
  ): any {
    return {
      complianceScoreChart: this.generateComplianceScoreChartData(assessments),
      frameworkComparisonChart: this.generateFrameworkComparisonChartData(controls),
      findingsSeverityChart: this.generateFindingsSeverityChartData(findings),
      trendsChart: this.generateTrendsChartData(assessments),
      controlStatusChart: this.generateControlStatusChartData(controls)
    };
  }

  /**
   * Generate PDF content as text (simplified version)
   */
  private generatePDFContent(
    report: ComplianceReport,
    assessments: ComplianceAssessment[],
    controls: ComplianceControl[],
    findings: ComplianceFinding[],
    recommendations: ComplianceRecommendation[],
    evidence: AssessmentEvidence[]
  ): string {
    let content = '';
    
    // Title page
    content += `COMPLIANCE ASSESSMENT REPORT\n`;
    content += `${report.name}\n`;
    content += `Generated: ${new Date().toISOString()}\n`;
    content += `Frameworks: ${report.frameworks.join(', ')}\n\n`;
    
    // Executive Summary
    if (report.includeExecutiveSummary) {
      const summary = this.generateExecutiveSummary(assessments, controls, findings);
      content += `EXECUTIVE SUMMARY\n`;
      content += `=================\n`;
      content += `Average Compliance Score: ${summary.assessmentSummary.averageComplianceScore}%\n`;
      content += `Total Controls: ${summary.controlSummary.totalControls}\n`;
      content += `Compliant Controls: ${summary.controlSummary.compliantControls}\n`;
      content += `Total Findings: ${summary.findingsSummary.totalFindings}\n`;
      content += `Critical Findings: ${summary.findingsSummary.criticalFindings}\n\n`;
    }
    
    // Assessments
    content += `ASSESSMENTS\n`;
    content += `===========\n`;
    for (const assessment of assessments) {
      content += `${assessment.name} (${assessment.framework})\n`;
      content += `Status: ${assessment.status}\n`;
      content += `Score: ${assessment.complianceScore}%\n`;
      content += `Controls: ${assessment.totalControls} total, ${assessment.compliantControls} compliant\n\n`;
    }
    
    // Detailed Findings
    if (report.includeDetailedFindings && findings.length > 0) {
      content += `DETAILED FINDINGS\n`;
      content += `=================\n`;
      for (const finding of findings) {
        content += `${finding.title} (${finding.severity.toUpperCase()})\n`;
        content += `Control: ${finding.controlId}\n`;
        content += `Description: ${finding.description}\n`;
        content += `Status: ${finding.status}\n\n`;
      }
    }
    
    // Recommendations
    if (report.includeRecommendations && recommendations.length > 0) {
      content += `RECOMMENDATIONS\n`;
      content += `===============\n`;
      for (const recommendation of recommendations) {
        content += `${recommendation.title} (${recommendation.priority.toUpperCase()} Priority)\n`;
        content += `Description: ${recommendation.description}\n`;
        content += `Effort: ${recommendation.effort}\n`;
        content += `Expected Benefit: ${recommendation.estimatedBenefit}\n\n`;
      }
    }
    
    return content;
  }

  /**
   * Generate HTML content
   */
  private generateHTMLContent(
    report: ComplianceReport,
    assessments: ComplianceAssessment[],
    controls: ComplianceControl[],
    findings: ComplianceFinding[],
    recommendations: ComplianceRecommendation[],
    evidence: AssessmentEvidence[]
  ): string {
    const summary = this.generateExecutiveSummary(assessments, controls, findings);
    
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${report.name}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
        .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
        .section { margin-bottom: 30px; }
        .section h2 { color: #333; border-bottom: 1px solid #ccc; padding-bottom: 10px; }
        .metric { display: inline-block; margin: 10px 20px; padding: 15px; background: #f5f5f5; border-radius: 8px; }
        .metric .value { font-size: 24px; font-weight: bold; color: #2c5aa0; }
        .metric .label { font-size: 14px; color: #666; }
        .finding { margin-bottom: 15px; padding: 15px; border-left: 4px solid #e74c3c; background: #fff5f5; }
        .finding.critical { border-left-color: #c0392b; }
        .finding.high { border-left-color: #e74c3c; }
        .finding.medium { border-left-color: #f39c12; }
        .finding.low { border-left-color: #27ae60; }
        .recommendation { margin-bottom: 15px; padding: 15px; border-left: 4px solid #3498db; background: #f0f8ff; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f5f5f5; font-weight: bold; }
        .status-compliant { color: #27ae60; font-weight: bold; }
        .status-non-compliant { color: #e74c3c; font-weight: bold; }
        .status-partially-compliant { color: #f39c12; font-weight: bold; }
    </style>
</head>
<body>
    <div class="header">
        <h1>${report.name}</h1>
        <p>Compliance Assessment Report</p>
        <p>Generated: ${new Date().toLocaleDateString()}</p>
        <p>Frameworks: ${report.frameworks.join(', ')}</p>
    </div>

    ${report.includeExecutiveSummary ? `
    <div class="section">
        <h2>Executive Summary</h2>
        <div class="metrics">
            <div class="metric">
                <div class="value">${summary.assessmentSummary.averageComplianceScore}%</div>
                <div class="label">Average Compliance Score</div>
            </div>
            <div class="metric">
                <div class="value">${summary.controlSummary.totalControls}</div>
                <div class="label">Total Controls</div>
            </div>
            <div class="metric">
                <div class="value">${summary.controlSummary.compliantControls}</div>
                <div class="label">Compliant Controls</div>
            </div>
            <div class="metric">
                <div class="value">${summary.findingsSummary.totalFindings}</div>
                <div class="label">Total Findings</div>
            </div>
            <div class="metric">
                <div class="value">${summary.findingsSummary.criticalFindings}</div>
                <div class="label">Critical Findings</div>
            </div>
        </div>
    </div>
    ` : ''}

    <div class="section">
        <h2>Assessment Results</h2>
        <table>
            <thead>
                <tr>
                    <th>Assessment</th>
                    <th>Framework</th>
                    <th>Status</th>
                    <th>Score</th>
                    <th>Controls</th>
                    <th>Compliant</th>
                </tr>
            </thead>
            <tbody>
                ${assessments.map(a => `
                    <tr>
                        <td>${a.name}</td>
                        <td>${a.framework.toUpperCase()}</td>
                        <td class="status-${a.overallStatus}">${a.overallStatus}</td>
                        <td>${a.complianceScore}%</td>
                        <td>${a.totalControls}</td>
                        <td>${a.compliantControls}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </div>

    ${report.includeDetailedFindings && findings.length > 0 ? `
    <div class="section">
        <h2>Detailed Findings</h2>
        ${findings.map(f => `
            <div class="finding ${f.severity}">
                <h3>${f.title}</h3>
                <p><strong>Control:</strong> ${f.controlId}</p>
                <p><strong>Severity:</strong> ${f.severity.toUpperCase()}</p>
                <p><strong>Description:</strong> ${f.description}</p>
                <p><strong>Status:</strong> ${f.status}</p>
            </div>
        `).join('')}
    </div>
    ` : ''}

    ${report.includeRecommendations && recommendations.length > 0 ? `
    <div class="section">
        <h2>Recommendations</h2>
        ${recommendations.map(r => `
            <div class="recommendation">
                <h3>${r.title}</h3>
                <p><strong>Priority:</strong> ${r.priority.toUpperCase()}</p>
                <p><strong>Effort:</strong> ${r.effort}</p>
                <p><strong>Description:</strong> ${r.description}</p>
                <p><strong>Expected Benefit:</strong> ${r.estimatedBenefit}</p>
            </div>
        `).join('')}
    </div>
    ` : ''}

    <div class="section">
        <h2>Control Status Summary</h2>
        <table>
            <thead>
                <tr>
                    <th>Control ID</th>
                    <th>Framework</th>
                    <th>Title</th>
                    <th>Category</th>
                    <th>Status</th>
                    <th>Priority</th>
                    <th>Risk Level</th>
                </tr>
            </thead>
            <tbody>
                ${controls.map(c => `
                    <tr>
                        <td>${c.controlId}</td>
                        <td>${c.framework.toUpperCase()}</td>
                        <td>${c.title}</td>
                        <td>${c.category}</td>
                        <td class="status-${c.status}">${c.status}</td>
                        <td>${c.priority}</td>
                        <td>${c.riskLevel}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </div>
</body>
</html>`;
  }

  /**
   * Generate XML content
   */
  private generateXMLContent(
    report: ComplianceReport,
    assessments: ComplianceAssessment[],
    controls: ComplianceControl[],
    findings: ComplianceFinding[],
    recommendations: ComplianceRecommendation[],
    evidence: AssessmentEvidence[]
  ): string {
    const summary = this.generateExecutiveSummary(assessments, controls, findings);
    
    return `<?xml version="1.0" encoding="UTF-8"?>
<complianceReport>
    <metadata>
        <id>${report.id}</id>
        <name>${report.name}</name>
        <type>${report.type}</type>
        <frameworks>${report.frameworks.join(',')}</frameworks>
        <generatedAt>${report.generatedAt}</generatedAt>
        <generatedBy>${report.generatedBy}</generatedBy>
    </metadata>
    
    <executiveSummary>
        <averageScore>${summary.assessmentSummary.averageComplianceScore}</averageScore>
        <totalControls>${summary.controlSummary.totalControls}</totalControls>
        <compliantControls>${summary.controlSummary.compliantControls}</compliantControls>
        <totalFindings>${summary.findingsSummary.totalFindings}</totalFindings>
        <criticalFindings>${summary.findingsSummary.criticalFindings}</criticalFindings>
    </executiveSummary>
    
    <assessments>
        ${assessments.map(a => `
        <assessment>
            <id>${a.id}</id>
            <name>${a.name}</name>
            <framework>${a.framework}</framework>
            <status>${a.status}</status>
            <overallStatus>${a.overallStatus}</overallStatus>
            <complianceScore>${a.complianceScore}</complianceScore>
            <totalControls>${a.totalControls}</totalControls>
            <compliantControls>${a.compliantControls}</compliantControls>
        </assessment>
        `).join('')}
    </assessments>
    
    <controls>
        ${controls.map(c => `
        <control>
            <id>${c.id}</id>
            <controlId>${c.controlId}</controlId>
            <framework>${c.framework}</framework>
            <title>${c.title}</title>
            <category>${c.category}</category>
            <status>${c.status}</status>
            <priority>${c.priority}</priority>
            <riskLevel>${c.riskLevel}</riskLevel>
            <implementationStatus>${c.implementationStatus}</implementationStatus>
        </control>
        `).join('')}
    </controls>
    
    <findings>
        ${findings.map(f => `
        <finding>
            <id>${f.id}</id>
            <controlId>${f.controlId}</controlId>
            <title>${f.title}</title>
            <severity>${f.severity}</severity>
            <category>${f.category}</category>
            <status>${f.status}</status>
            <discoveryDate>${f.discoveryDate}</discoveryDate>
        </finding>
        `).join('')}
    </findings>
    
    <recommendations>
        ${recommendations.map(r => `
        <recommendation>
            <id>${r.id}</id>
            <title>${r.title}</title>
            <priority>${r.priority}</priority>
            <effort>${r.effort}</effort>
            <status>${r.status}</status>
            <estimatedBenefit>${r.estimatedBenefit}</estimatedBenefit>
        </recommendation>
        `).join('')}
    </recommendations>
</complianceReport>`;
  }

  // Data filtering methods
  
  private filterAssessments(assessments: ComplianceAssessment[], report: ComplianceReport): ComplianceAssessment[] {
    let filtered = assessments.filter(a => report.frameworks.includes(a.framework));
    
    if (report.assessmentIds && report.assessmentIds.length > 0) {
      filtered = filtered.filter(a => report.assessmentIds!.includes(a.id));
    }
    
    if (report.dateRange) {
      filtered = filtered.filter(a => 
        a.endDate && 
        a.endDate >= report.dateRange!.startDate && 
        a.endDate <= report.dateRange!.endDate
      );
    }
    
    return filtered;
  }
  
  private filterControls(controls: ComplianceControl[], report: ComplianceReport): ComplianceControl[] {
    return controls.filter(c => report.frameworks.includes(c.framework));
  }
  
  private filterFindings(findings: ComplianceFinding[], report: ComplianceReport): ComplianceFinding[] {
    // Filter findings based on controls in scope
    return findings; // For now, return all findings
  }
  
  private filterRecommendations(recommendations: ComplianceRecommendation[], report: ComplianceReport): ComplianceRecommendation[] {
    return recommendations; // For now, return all recommendations
  }
  
  private filterEvidence(evidence: AssessmentEvidence[], report: ComplianceReport): AssessmentEvidence[] {
    if (!report.includeEvidence) return [];
    return evidence; // For now, return all evidence if included
  }

  // Helper calculation methods
  
  private calculateOverallRiskLevel(findings: ComplianceFinding[]): 'low' | 'medium' | 'high' | 'critical' {
    if (findings.some(f => f.severity === 'critical')) return 'critical';
    if (findings.some(f => f.severity === 'high')) return 'high';
    if (findings.some(f => f.severity === 'medium')) return 'medium';
    return 'low';
  }
  
  private identifyKeyRiskAreas(findings: ComplianceFinding[]): string[] {
    const categories = findings.map(f => f.category);
    const categoryCounts = categories.reduce((acc, cat) => {
      acc[cat] = (acc[cat] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return Object.entries(categoryCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([category]) => category);
  }
  
  private calculateFrameworkStatistics(assessments: ComplianceAssessment[], controls: ComplianceControl[]): any {
    const frameworks = ['gdpr', 'hipaa', 'soc2', 'pci-dss', 'iso27001', 'nist', 'owasp'];
    return frameworks.reduce((stats, framework) => {
      const frameworkControls = controls.filter(c => c.framework === framework);
      const frameworkAssessments = assessments.filter(a => a.framework === framework);
      
      stats[framework] = {
        totalControls: frameworkControls.length,
        compliantControls: frameworkControls.filter(c => c.status === 'compliant').length,
        assessments: frameworkAssessments.length,
        averageScore: frameworkAssessments.length > 0 
          ? Math.round(frameworkAssessments.reduce((sum, a) => sum + a.complianceScore, 0) / frameworkAssessments.length)
          : 0
      };
      return stats;
    }, {} as any);
  }
  
  private calculateCategoryStatistics(controls: ComplianceControl[]): any {
    const categories = [...new Set(controls.map(c => c.category))];
    return categories.reduce((stats, category) => {
      const categoryControls = controls.filter(c => c.category === category);
      stats[category] = {
        total: categoryControls.length,
        compliant: categoryControls.filter(c => c.status === 'compliant').length,
        nonCompliant: categoryControls.filter(c => c.status === 'non-compliant').length,
        partiallyCompliant: categoryControls.filter(c => c.status === 'partially-compliant').length
      };
      return stats;
    }, {} as any);
  }
  
  private calculateSeverityStatistics(findings: ComplianceFinding[]): any {
    return {
      critical: findings.filter(f => f.severity === 'critical').length,
      high: findings.filter(f => f.severity === 'high').length,
      medium: findings.filter(f => f.severity === 'medium').length,
      low: findings.filter(f => f.severity === 'low').length
    };
  }
  
  private calculateTrendStatistics(assessments: ComplianceAssessment[]): any {
    // Mock trend calculation - in production would use historical data
    return {
      complianceScoreTrend: 'improving',
      assessmentFrequency: 'quarterly',
      averageImprovementRate: 5.2
    };
  }
  
  private calculatePerformanceStatistics(assessments: ComplianceAssessment[], controls: ComplianceControl[]): any {
    const completedAssessments = assessments.filter(a => a.status === 'completed');
    const avgDuration = completedAssessments.length > 0
      ? Math.round(completedAssessments.reduce((sum, a) => {
          const duration = a.endDate && a.startDate 
            ? (a.endDate.getTime() - a.startDate.getTime()) / (1000 * 60 * 60 * 24)
            : 0;
          return sum + duration;
        }, 0) / completedAssessments.length)
      : 0;
    
    return {
      averageAssessmentDuration: avgDuration,
      assessmentCompletionRate: assessments.length > 0 
        ? Math.round((completedAssessments.length / assessments.length) * 100)
        : 0,
      controlImplementationRate: controls.length > 0
        ? Math.round((controls.filter(c => c.implementationStatus === 'implemented').length / controls.length) * 100)
        : 0
    };
  }
  
  // Chart data generation methods
  
  private generateComplianceScoreChartData(assessments: ComplianceAssessment[]): any {
    return assessments.map(a => ({
      name: a.name,
      framework: a.framework,
      score: a.complianceScore
    }));
  }
  
  private generateFrameworkComparisonChartData(controls: ComplianceControl[]): any {
    const frameworks = ['gdpr', 'hipaa', 'soc2', 'pci-dss', 'iso27001', 'nist', 'owasp'];
    return frameworks.map(framework => {
      const frameworkControls = controls.filter(c => c.framework === framework);
      const compliantCount = frameworkControls.filter(c => c.status === 'compliant').length;
      return {
        framework,
        total: frameworkControls.length,
        compliant: compliantCount,
        complianceRate: frameworkControls.length > 0 
          ? Math.round((compliantCount / frameworkControls.length) * 100)
          : 0
      };
    });
  }
  
  private generateFindingsSeverityChartData(findings: ComplianceFinding[]): any {
    const severities = ['critical', 'high', 'medium', 'low'];
    return severities.map(severity => ({
      severity,
      count: findings.filter(f => f.severity === severity).length
    }));
  }
  
  private generateTrendsChartData(assessments: ComplianceAssessment[]): any {
    // Mock trend data - in production would be calculated from historical data
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    return months.map((month, index) => ({
      month,
      score: 65 + (index * 5) + Math.random() * 10 // Mock upward trend
    }));
  }
  
  private generateControlStatusChartData(controls: ComplianceControl[]): any {
    const statuses = ['compliant', 'partially-compliant', 'non-compliant', 'not-assessed'];
    return statuses.map(status => ({
      status,
      count: controls.filter(c => c.status === status).length
    }));
  }

  // Public methods for retrieving reports
  
  async getReport(reportId: string): Promise<ComplianceReport | null> {
    return this.reports.get(reportId) || null;
  }
  
  async getAllReports(): Promise<ComplianceReport[]> {
    return Array.from(this.reports.values());
  }
  
  async getReportFile(reportId: string): Promise<Buffer | null> {
    const report = this.reports.get(reportId);
    if (!report || !report.filePath) return null;
    
    try {
      return await fs.readFile(report.filePath);
    } catch (error) {
      logger.error(`Error reading report file: ${report.filePath}`, error);
      return null;
    }
  }
  
  async deleteReport(reportId: string): Promise<boolean> {
    const report = this.reports.get(reportId);
    if (!report) return false;
    
    try {
      if (report.filePath) {
        await fs.unlink(report.filePath);
      }
      this.reports.delete(reportId);
      return true;
    } catch (error) {
      logger.error(`Error deleting report: ${reportId}`, error);
      return false;
    }
  }
}