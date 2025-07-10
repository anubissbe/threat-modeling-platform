import { Pool } from 'pg';
import { pool } from '../config/database';
import { logger } from '../utils/logger';
import { 
  ProjectReport,
  CreateReportRequest,
  ReportFilters,
  ReportContent,
  ReportSummary,
  VulnerabilityReportSection,
  ThreatReportSection,
  RiskReportSection,
  RecommendationSection,
  ReportStatistics,
  ReportType
} from '../types/reports';
import { v4 as uuidv4 } from 'uuid';

export class ReportsService {
  
  constructor(private db: Pool = pool) {}

  async generateProjectReport(
    userId: string,
    organizationId: string,
    projectId: string,
    request: CreateReportRequest
  ): Promise<ProjectReport> {
    const client = await this.db.connect();
    
    try {
      // Verify project access
      const projectQuery = `
        SELECT id, name FROM projects 
        WHERE id = $1 AND organization_id = $2
      `;
      const projectResult = await client.query(projectQuery, [projectId, organizationId]);
      
      if (projectResult.rows.length === 0) {
        throw new Error('Project not found or access denied');
      }
      
      const project = projectResult.rows[0];
      const reportId = uuidv4();
      const now = new Date();
      
      // Create report record
      const reportQuery = `
        INSERT INTO project_reports (
          id, project_id, project_name, report_type, title, description,
          generated_at, generated_by, organization_id, metadata, status,
          created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
        ) RETURNING *
      `;
      
      const reportValues = [
        reportId,
        projectId,
        project.name,
        request.reportType,
        request.title,
        request.description || null,
        now,
        userId,
        organizationId,
        JSON.stringify(request.metadata),
        'generating',
        now,
        now
      ];
      
      await client.query(reportQuery, reportValues);
      
      // Generate report content asynchronously
      const content = await this.generateReportContent(projectId, organizationId, request);
      
      // Update report with content and mark as completed
      const updateQuery = `
        UPDATE project_reports 
        SET content = $1, status = $2, updated_at = $3
        WHERE id = $4
        RETURNING *
      `;
      
      const updateValues = [
        JSON.stringify(content),
        'completed',
        new Date(),
        reportId
      ];
      
      const result = await client.query(updateQuery, updateValues);
      
      logger.info(`Generated project report: ${reportId}`, { 
        projectId, 
        reportType: request.reportType,
        userId, 
        organizationId 
      });
      
      return this.mapRowToReport(result.rows[0]);
    } catch (error) {
      // Mark report as failed if it exists
      await client.query(
        'UPDATE project_reports SET status = $1, updated_at = $2 WHERE project_id = $3 AND generated_by = $4 AND status = $5',
        ['failed', new Date(), projectId, userId, 'generating']
      ).catch(() => {}); // Ignore errors
      
      throw error;
    } finally {
      client.release();
    }
  }

  async getProjectReports(
    userId: string,
    organizationId: string,
    projectId: string,
    filters: ReportFilters = {}
  ): Promise<{ reports: ProjectReport[]; total: number }> {
    const client = await this.db.connect();
    
    try {
      // Verify project access
      const accessQuery = `
        SELECT id FROM projects 
        WHERE id = $1 AND organization_id = $2
      `;
      const accessResult = await client.query(accessQuery, [projectId, organizationId]);
      
      if (accessResult.rows.length === 0) {
        throw new Error('Project not found or access denied');
      }
      
      let whereConditions = ['project_id = $1', 'organization_id = $2'];
      let queryParams: any[] = [projectId, organizationId];
      let paramIndex = 3;
      
      // Add filters
      if (filters.reportType) {
        whereConditions.push(`report_type = $${paramIndex}`);
        queryParams.push(filters.reportType);
        paramIndex++;
      }
      
      if (filters.status) {
        whereConditions.push(`status = $${paramIndex}`);
        queryParams.push(filters.status);
        paramIndex++;
      }
      
      if (filters.generatedBy) {
        whereConditions.push(`generated_by = $${paramIndex}`);
        queryParams.push(filters.generatedBy);
        paramIndex++;
      }
      
      if (filters.startDate) {
        whereConditions.push(`generated_at >= $${paramIndex}`);
        queryParams.push(filters.startDate);
        paramIndex++;
      }
      
      if (filters.endDate) {
        whereConditions.push(`generated_at <= $${paramIndex}`);
        queryParams.push(filters.endDate);
        paramIndex++;
      }
      
      const whereClause = whereConditions.join(' AND ');
      
      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total 
        FROM project_reports 
        WHERE ${whereClause}
      `;
      
      const countResult = await client.query(countQuery, queryParams);
      const total = parseInt(countResult.rows[0].total);
      
      // Get reports with pagination
      const limit = filters.limit || 20;
      const offset = filters.offset || 0;
      
      const query = `
        SELECT *
        FROM project_reports
        WHERE ${whereClause}
        ORDER BY generated_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
      
      queryParams.push(limit, offset);
      
      const result = await client.query(query, queryParams);
      
      const reports = result.rows.map(row => this.mapRowToReport(row));
      
      return { reports, total };
    } finally {
      client.release();
    }
  }

  async getReport(
    userId: string,
    organizationId: string,
    reportId: string
  ): Promise<ProjectReport> {
    const client = await this.db.connect();
    
    try {
      const query = `
        SELECT pr.*, p.name as project_name
        FROM project_reports pr
        JOIN projects p ON pr.project_id = p.id
        WHERE pr.id = $1 AND pr.organization_id = $2
      `;
      
      const result = await client.query(query, [reportId, organizationId]);
      
      if (result.rows.length === 0) {
        throw new Error('Report not found or access denied');
      }
      
      return this.mapRowToReport(result.rows[0]);
    } finally {
      client.release();
    }
  }

  async deleteReport(
    userId: string,
    organizationId: string,
    reportId: string
  ): Promise<void> {
    const client = await this.db.connect();
    
    try {
      // Verify access
      await this.getReport(userId, organizationId, reportId);
      
      const query = `
        DELETE FROM project_reports 
        WHERE id = $1 AND organization_id = $2
      `;
      
      await client.query(query, [reportId, organizationId]);
      
      logger.info(`Deleted project report: ${reportId}`, { userId, organizationId });
    } finally {
      client.release();
    }
  }

  async getReportStatistics(
    organizationId: string,
    projectId?: string
  ): Promise<ReportStatistics> {
    const client = await this.db.connect();
    
    try {
      let whereClause = 'WHERE organization_id = $1';
      const params = [organizationId];
      
      if (projectId) {
        whereClause += ' AND project_id = $2';
        params.push(projectId);
      }
      
      // Get overall statistics
      const statsQuery = `
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN generated_at >= NOW() - INTERVAL '30 days' THEN 1 END) as this_month,
          AVG(EXTRACT(EPOCH FROM (updated_at - generated_at))) as avg_generation_time
        FROM project_reports 
        ${whereClause}
      `;
      
      const statsResult = await client.query(statsQuery, params);
      const stats = statsResult.rows[0];
      
      // Get by type
      const typeQuery = `
        SELECT report_type, COUNT(*) as count
        FROM project_reports
        ${whereClause}
        GROUP BY report_type
        ORDER BY count DESC
      `;
      
      const typeResult = await client.query(typeQuery, params);
      const byType: { [key in ReportType]?: number } = {};
      let mostGeneratedType: ReportType = 'vulnerability_summary';
      let maxCount = 0;
      
      typeResult.rows.forEach(row => {
        const count = parseInt(row.count);
        byType[row.report_type as ReportType] = count;
        if (count > maxCount) {
          maxCount = count;
          mostGeneratedType = row.report_type as ReportType;
        }
      });
      
      // Get by status
      const statusQuery = `
        SELECT status, COUNT(*) as count
        FROM project_reports
        ${whereClause}
        GROUP BY status
      `;
      
      const statusResult = await client.query(statusQuery, params);
      const byStatus = {
        generating: 0,
        completed: 0,
        failed: 0
      };
      
      statusResult.rows.forEach(row => {
        if (byStatus.hasOwnProperty(row.status)) {
          byStatus[row.status as keyof typeof byStatus] = parseInt(row.count);
        }
      });
      
      return {
        totalReports: parseInt(stats.total),
        reportsThisMonth: parseInt(stats.this_month),
        mostGeneratedType,
        avgGenerationTime: parseFloat(stats.avg_generation_time) || 0,
        byType,
        byStatus
      };
    } finally {
      client.release();
    }
  }

  private async generateReportContent(
    projectId: string,
    organizationId: string,
    request: CreateReportRequest
  ): Promise<ReportContent> {
    const client = await this.db.connect();
    const startTime = Date.now();
    
    try {
      // Generate summary
      const summary = await this.generateReportSummary(client, projectId, organizationId);
      
      const content: ReportContent = {
        summary
      };
      
      // Generate specific sections based on report type
      switch (request.reportType) {
        case 'vulnerability_summary':
        case 'security_posture':
          content.vulnerabilities = await this.generateVulnerabilitySection(client, projectId, organizationId);
          break;
          
        case 'threat_analysis':
          content.threats = await this.generateThreatSection(client, projectId, organizationId);
          break;
          
        case 'risk_assessment':
          content.risks = await this.generateRiskSection(client, projectId, organizationId);
          break;
          
        case 'executive_summary':
          content.vulnerabilities = await this.generateVulnerabilitySection(client, projectId, organizationId);
          content.threats = await this.generateThreatSection(client, projectId, organizationId);
          content.risks = await this.generateRiskSection(client, projectId, organizationId);
          content.recommendations = await this.generateRecommendations(client, projectId, organizationId);
          break;
      }
      
      // Update generation time
      content.summary.generationTime = Math.round((Date.now() - startTime) / 1000);
      
      return content;
    } finally {
      client.release();
    }
  }

  private async generateReportSummary(
    client: any,
    projectId: string,
    organizationId: string
  ): Promise<ReportSummary> {
    // Get vulnerability counts
    const vulnQuery = `
      SELECT COUNT(*) as total_vulns
      FROM vulnerabilities
      WHERE project_id = $1 AND organization_id = $2
    `;
    const vulnResult = await client.query(vulnQuery, [projectId, organizationId]);
    
    // Get project count (for this org)
    const projectQuery = `
      SELECT COUNT(*) as total_projects
      FROM projects
      WHERE organization_id = $1
    `;
    const projectResult = await client.query(projectQuery, [organizationId]);
    
    // Calculate basic risk score based on vulnerabilities
    const riskQuery = `
      SELECT 
        COUNT(CASE WHEN severity = 'Critical' THEN 1 END) as critical,
        COUNT(CASE WHEN severity = 'High' THEN 1 END) as high,
        COUNT(CASE WHEN severity = 'Medium' THEN 1 END) as medium,
        COUNT(CASE WHEN severity = 'Low' THEN 1 END) as low
      FROM vulnerabilities
      WHERE project_id = $1 AND organization_id = $2
    `;
    const riskResult = await client.query(riskQuery, [projectId, organizationId]);
    const risk = riskResult.rows[0];
    
    // Simple risk score calculation
    const riskScore = Math.min(100, 
      (parseInt(risk.critical) * 25) + 
      (parseInt(risk.high) * 15) + 
      (parseInt(risk.medium) * 8) + 
      (parseInt(risk.low) * 3)
    );
    
    return {
      totalProjects: parseInt(projectResult.rows[0].total_projects),
      totalVulnerabilities: parseInt(vulnResult.rows[0].total_vulns),
      totalThreats: 0, // Would come from threat_models table
      riskScore,
      keyFindings: [
        `${vulnResult.rows[0].total_vulns} vulnerabilities identified`,
        `Risk score: ${riskScore}/100`,
        'Security assessment completed'
      ],
      executiveSummary: `Security analysis of the project reveals ${vulnResult.rows[0].total_vulns} vulnerabilities with an overall risk score of ${riskScore}/100. Immediate attention required for critical and high severity issues.`,
      generationTime: 0 // Will be updated later
    };
  }

  private async generateVulnerabilitySection(
    client: any,
    projectId: string,
    organizationId: string
  ): Promise<VulnerabilityReportSection> {
    const query = `
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN severity = 'Critical' THEN 1 END) as critical,
        COUNT(CASE WHEN severity = 'High' THEN 1 END) as high,
        COUNT(CASE WHEN severity = 'Medium' THEN 1 END) as medium,
        COUNT(CASE WHEN severity = 'Low' THEN 1 END) as low,
        COUNT(CASE WHEN status = 'open' THEN 1 END) as open,
        COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress,
        COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved,
        COUNT(CASE WHEN status = 'false_positive' THEN 1 END) as false_positive,
        COUNT(CASE WHEN status = 'wont_fix' THEN 1 END) as wont_fix,
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as new_this_week,
        COUNT(CASE WHEN status = 'resolved' AND resolved_at >= NOW() - INTERVAL '7 days' THEN 1 END) as resolved_this_week
      FROM vulnerabilities
      WHERE project_id = $1 AND organization_id = $2
    `;
    
    const result = await client.query(query, [projectId, organizationId]);
    const stats = result.rows[0];
    
    // Get top vulnerabilities
    const topQuery = `
      SELECT id, title, severity, cvss_score, component
      FROM vulnerabilities
      WHERE project_id = $1 AND organization_id = $2
      ORDER BY 
        CASE severity 
          WHEN 'Critical' THEN 1 
          WHEN 'High' THEN 2 
          WHEN 'Medium' THEN 3 
          WHEN 'Low' THEN 4 
        END,
        cvss_score DESC NULLS LAST
      LIMIT 10
    `;
    
    const topResult = await client.query(topQuery, [projectId, organizationId]);
    
    return {
      total: parseInt(stats.total),
      bySeverity: {
        critical: parseInt(stats.critical),
        high: parseInt(stats.high),
        medium: parseInt(stats.medium),
        low: parseInt(stats.low)
      },
      byStatus: {
        open: parseInt(stats.open),
        inProgress: parseInt(stats.in_progress),
        resolved: parseInt(stats.resolved),
        falsePositive: parseInt(stats.false_positive),
        wontFix: parseInt(stats.wont_fix)
      },
      trending: {
        newThisWeek: parseInt(stats.new_this_week),
        resolvedThisWeek: parseInt(stats.resolved_this_week),
        avgResolutionTime: 0 // Would need more complex calculation
      },
      topVulnerabilities: topResult.rows.map((row: any) => ({
        id: row.id,
        title: row.title,
        severity: row.severity,
        cvssScore: row.cvss_score,
        component: row.component
      }))
    };
  }

  private async generateThreatSection(
    client: any,
    projectId: string,
    organizationId: string
  ): Promise<ThreatReportSection> {
    // Placeholder - would integrate with threat_models table
    return {
      total: 0,
      byCategory: {},
      byLikelihood: { high: 0, medium: 0, low: 0 },
      byImpact: { high: 0, medium: 0, low: 0 },
      topThreats: []
    };
  }

  private async generateRiskSection(
    client: any,
    projectId: string,
    organizationId: string
  ): Promise<RiskReportSection> {
    // Placeholder - would calculate based on vulnerabilities and threats
    return {
      overallRiskScore: 0,
      riskDistribution: { critical: 0, high: 0, medium: 0, low: 0 },
      riskTrends: [],
      topRisks: []
    };
  }

  private async generateRecommendations(
    client: any,
    projectId: string,
    organizationId: string
  ): Promise<RecommendationSection> {
    // Placeholder - would generate based on vulnerabilities and threats
    return {
      immediate: ['Address critical vulnerabilities', 'Implement security patches'],
      shortTerm: ['Conduct security training', 'Update security policies'],
      longTerm: ['Implement security architecture review', 'Establish security metrics'],
      strategic: ['Develop security roadmap', 'Invest in security tools'],
      priorityMatrix: []
    };
  }

  private mapRowToReport(row: any): ProjectReport {
    const safeJsonParse = (value: any, defaultValue: any = {}) => {
      if (!value || value === null || value === undefined) return defaultValue;
      try {
        return JSON.parse(value);
      } catch (error) {
        return defaultValue;
      }
    };

    return {
      id: row.id,
      projectId: row.project_id,
      projectName: row.project_name,
      reportType: row.report_type,
      title: row.title,
      description: row.description,
      generatedAt: row.generated_at,
      generatedBy: row.generated_by,
      organizationId: row.organization_id,
      metadata: safeJsonParse(row.metadata, {}),
      content: safeJsonParse(row.content, {}),
      status: row.status,
      downloadUrl: row.download_url,
      expiresAt: row.expires_at
    };
  }
}