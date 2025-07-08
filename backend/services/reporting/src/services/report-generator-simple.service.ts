import fs from 'fs/promises';
import path from 'path';
import { ReportData, ThreatModelData, ReportConfig } from '../types/report.types';
import { logger } from '../utils/logger';

export class ReportGenerator {
  private outputDir: string;

  constructor() {
    this.outputDir = process.env.REPORT_OUTPUT_DIR || '/tmp/reports';
    this.ensureOutputDir();
  }

  async generateReport(report: ReportData, threatModelData: ThreatModelData): Promise<string> {
    const fileName = `${report.id}-${Date.now()}.${report.config.format}`;
    const filePath = path.join(this.outputDir, fileName);

    switch (report.config.format) {
      case 'html':
        return await this.generateHTMLReport(report, threatModelData, filePath);
      case 'json':
        return await this.generateJSONReport(report, threatModelData, filePath);
      case 'pdf':
        // For now, generate HTML version for PDF requests
        logger.warn('PDF generation not fully implemented, generating HTML instead');
        return await this.generateHTMLReport(report, threatModelData, filePath.replace('.pdf', '.html'));
      default:
        throw new Error(`Unsupported report format: ${report.config.format}`);
    }
  }

  private async generateHTMLReport(report: ReportData, data: ThreatModelData, filePath: string): Promise<string> {
    const html = this.generateHTMLContent(report, data);
    await fs.writeFile(filePath, html, 'utf8');
    logger.info(`HTML report generated: ${filePath}`);
    return filePath;
  }

  private async generateJSONReport(report: ReportData, data: ThreatModelData, filePath: string): Promise<string> {
    const reportData = {
      metadata: {
        reportId: report.id,
        reportName: report.name,
        generatedAt: new Date().toISOString(),
        format: report.config.format,
        config: report.config
      },
      threatModel: data,
      summary: {
        totalThreats: data.threats.length,
        highRiskThreats: data.threats.filter(t => t.severity === 'high' || t.severity === 'critical').length,
        averageRiskScore: data.threats.length > 0 ? 
          data.threats.reduce((sum, t) => sum + t.riskScore, 0) / data.threats.length : 0,
        methodologyUsed: data.methodology,
        completionStatus: data.status
      },
      analysis: {
        threatsByCategory: this.groupThreatsByCategory(data.threats),
        riskDistribution: this.calculateRiskDistribution(data.threats),
        topThreats: data.threats
          .sort((a, b) => b.riskScore - a.riskScore)
          .slice(0, 10),
        recommendations: this.generateRecommendations(data)
      }
    };

    await fs.writeFile(filePath, JSON.stringify(reportData, null, 2), 'utf8');
    logger.info(`JSON report generated: ${filePath}`);
    return filePath;
  }

  private generateHTMLContent(report: ReportData, data: ThreatModelData): string {
    const config = report.config;
    const styling = config.styling || {};
    
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${report.name}</title>
    <style>
        body {
            font-family: ${styling.fontFamily || 'Arial, sans-serif'};
            font-size: ${styling.fontSize || 12}px;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            text-align: center;
            border-bottom: 2px solid ${styling.primaryColor || '#2196F3'};
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .header h1 {
            color: ${styling.primaryColor || '#2196F3'};
            margin: 0;
        }
        .section {
            margin-bottom: 30px;
        }
        .section h2 {
            color: ${styling.primaryColor || '#2196F3'};
            border-bottom: 1px solid #ddd;
            padding-bottom: 5px;
        }
        .threat-item, .risk-item {
            border: 1px solid #ddd;
            padding: 15px;
            margin-bottom: 10px;
            border-radius: 5px;
        }
        .severity-critical { border-left: 5px solid #f44336; }
        .severity-high { border-left: 5px solid #ff9800; }
        .severity-medium { border-left: 5px solid #ffeb3b; }
        .severity-low { border-left: 5px solid #4caf50; }
        .footer {
            text-align: center;
            margin-top: 50px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            color: #666;
            font-size: 10px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }
        th, td {
            border: 1px solid #ddd;
            padding: 8px;
            text-align: left;
        }
        th {
            background-color: ${styling.primaryColor || '#2196F3'};
            color: white;
        }
    </style>
</head>
<body>
    <div class="header">
        ${styling.logoUrl ? `<img src="${styling.logoUrl}" alt="Logo" style="max-height: 60px; margin-bottom: 10px;">` : ''}
        <h1>${report.name}</h1>
        <p>${styling.headerText || 'Threat Modeling Report'}</p>
        <p>Generated on: ${new Date().toLocaleDateString()}</p>
    </div>

    <div class="section">
        <h2>Executive Summary</h2>
        <p>${this.generateExecutiveSummary(data)}</p>
    </div>

    <div class="section">
        <h2>Threat Model Overview</h2>
        <table>
            <tr><th>Property</th><th>Value</th></tr>
            <tr><td>Project</td><td>${data.project.name}</td></tr>
            <tr><td>Methodology</td><td>${data.methodology}</td></tr>
            <tr><td>Status</td><td>${data.status}</td></tr>
            <tr><td>Total Threats</td><td>${data.threats.length}</td></tr>
            <tr><td>High Risk Threats</td><td>${data.threats.filter(t => t.severity === 'high' || t.severity === 'critical').length}</td></tr>
        </table>
    </div>

    ${config.includeThreats !== false ? `
    <div class="section">
        <h2>Identified Threats</h2>
        ${data.threats.map(threat => `
            <div class="threat-item severity-${threat.severity}">
                <h3>${threat.title}</h3>
                <p><strong>Description:</strong> ${threat.description}</p>
                <p><strong>Category:</strong> ${threat.category}</p>
                <p><strong>Severity:</strong> ${threat.severity}</p>
                <p><strong>Risk Score:</strong> ${threat.riskScore}</p>
                ${threat.mitigation ? `<p><strong>Mitigation:</strong> ${threat.mitigation}</p>` : ''}
            </div>
        `).join('')}
    </div>
    ` : ''}

    ${config.includeRisks !== false ? `
    <div class="section">
        <h2>Risk Assessment</h2>
        ${data.risks.map(risk => `
            <div class="risk-item severity-${risk.severity}">
                <h3>${risk.title}</h3>
                <p><strong>Description:</strong> ${risk.description}</p>
                <p><strong>Likelihood:</strong> ${risk.likelihood}</p>
                <p><strong>Impact:</strong> ${risk.impact}</p>
                <p><strong>Risk Score:</strong> ${risk.riskScore}</p>
                <p><strong>Mitigation:</strong> ${risk.mitigation}</p>
            </div>
        `).join('')}
    </div>
    ` : ''}

    ${config.includeRecommendations !== false ? `
    <div class="section">
        <h2>Recommendations</h2>
        <ul>
            ${this.generateRecommendations(data).map(rec => `<li>${rec}</li>`).join('')}
        </ul>
    </div>
    ` : ''}

    <div class="footer">
        <p>${styling.footerText || `Generated by Threat Modeling Platform | ${new Date().toISOString()}`}</p>
    </div>
</body>
</html>`;
  }

  private generateExecutiveSummary(data: ThreatModelData): string {
    const totalThreats = data.threats.length;
    const highRiskThreats = data.threats.filter(t => t.severity === 'high' || t.severity === 'critical').length;
    const avgRiskScore = totalThreats > 0 ? 
      data.threats.reduce((sum, t) => sum + t.riskScore, 0) / totalThreats : 0;

    return `This threat modeling analysis of "${data.name}" identified ${totalThreats} potential threats, ` +
           `with ${highRiskThreats} classified as high or critical risk. The average risk score is ${avgRiskScore.toFixed(2)}. ` +
           `The analysis was conducted using the ${data.methodology} methodology. ` +
           `Key focus areas include implementing appropriate security controls and monitoring mechanisms ` +
           `to mitigate identified risks.`;
  }

  private generateRecommendations(data: ThreatModelData): string[] {
    const recommendations: string[] = [];

    // High priority threats
    const highPriorityThreats = data.threats.filter(t => t.severity === 'critical' || t.severity === 'high');
    if (highPriorityThreats.length > 0) {
      recommendations.push(`Prioritize immediate mitigation of ${highPriorityThreats.length} high/critical severity threats`);
    }

    // Common threat categories
    const threatCategories = this.groupThreatsByCategory(data.threats);
    Object.entries(threatCategories).forEach(([category, threats]) => {
      if (threats.length >= 3) {
        recommendations.push(`Implement comprehensive controls for ${category} threats (${threats.length} identified)`);
      }
    });

    // General recommendations
    recommendations.push('Establish regular threat model review cycles');
    recommendations.push('Implement security monitoring and incident response procedures');
    recommendations.push('Conduct security awareness training for development teams');
    recommendations.push('Integrate security testing into the CI/CD pipeline');

    return recommendations;
  }

  private groupThreatsByCategory(threats: any[]): Record<string, any[]> {
    return threats.reduce((groups, threat) => {
      const category = threat.category || 'Uncategorized';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(threat);
      return groups;
    }, {} as Record<string, any[]>);
  }

  private calculateRiskDistribution(threats: any[]): Record<string, number> {
    return threats.reduce((distribution, threat) => {
      const severity = threat.severity || 'unknown';
      distribution[severity] = (distribution[severity] || 0) + 1;
      return distribution;
    }, {} as Record<string, number>);
  }

  private async ensureOutputDir(): Promise<void> {
    try {
      await fs.access(this.outputDir);
    } catch {
      await fs.mkdir(this.outputDir, { recursive: true });
    }
  }
}