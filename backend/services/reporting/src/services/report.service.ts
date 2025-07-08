import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { 
  ReportData, 
  CreateReportRequest, 
  UpdateReportRequest, 
  ReportStatus, 
  PaginationOptions,
  ThreatModelData,
  ReportGenerationJob
} from '../types/report.types';
import { ReportGenerator } from './report-generator-simple.service';
import { logger } from '../utils/logger';

export class ReportService {
  private pool: Pool;
  private generator: ReportGenerator;

  constructor() {
    // Use DATABASE_URL if available, otherwise build from individual components
    const databaseUrl = process.env.DATABASE_URL;
    
    if (databaseUrl) {
      this.pool = new Pool({
        connectionString: databaseUrl,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });
    } else {
      this.pool = new Pool({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'threat_modeling',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'password',
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });
    }

    this.generator = new ReportGenerator();
  }

  async getAllReports(options: PaginationOptions): Promise<{ reports: ReportData[]; total: number; page: number; limit: number }> {
    const offset = (options.page - 1) * options.limit;
    
    let query = `
      SELECT r.*, tm.name as threat_model_name
      FROM reports r
      LEFT JOIN threat_models tm ON r.threat_model_id = tm.id
    `;
    
    const params: any[] = [];
    const conditions: string[] = [];
    
    if (options.threatModelId) {
      conditions.push(`r.threat_model_id = $${params.length + 1}`);
      params.push(options.threatModelId);
    }
    
    // Note: status field doesn't exist in current schema, skip for now
    
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }
    
    query += ` ORDER BY r.generated_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(options.limit, offset);

    const result = await this.pool.query(query, params);
    
    // Get total count
    let countQuery = 'SELECT COUNT(*) FROM reports r';
    const countParams: any[] = [];
    
    if (options.threatModelId) {
      countQuery += ` WHERE r.threat_model_id = $${countParams.length + 1}`;
      countParams.push(options.threatModelId);
    }
    
    // Skip status filtering as it doesn't exist in current schema
    
    const countResult = await this.pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    const reports = result.rows.map(row => this.mapRowToReport(row));

    return {
      reports,
      total,
      page: options.page,
      limit: options.limit
    };
  }

  async getReportById(id: string): Promise<ReportData | null> {
    const query = `
      SELECT r.*, tm.name as threat_model_name
      FROM reports r
      LEFT JOIN threat_models tm ON r.threat_model_id = tm.id
      WHERE r.id = $1
    `;
    
    const result = await this.pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToReport(result.rows[0]);
  }

  async createReport(reportRequest: CreateReportRequest): Promise<ReportData> {
    const id = uuidv4();
    const now = new Date().toISOString();
    
    const report: ReportData = {
      id,
      threatModelId: reportRequest.threatModelId,
      name: reportRequest.name,
      description: reportRequest.description || '',
      config: reportRequest.config,
      status: 'pending' as ReportStatus,
      createdAt: now,
      updatedAt: now,
      createdBy: 'system' // TODO: Get from auth context
    };

    const query = `
      INSERT INTO reports (id, threat_model_id, name, type, format, content, generated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const values = [
      report.id,
      report.threatModelId,
      report.name,
      'custom', // type field
      report.config.format,
      JSON.stringify({
        description: report.description,
        config: report.config,
        status: report.status,
        createdBy: report.createdBy
      }),
      report.createdAt
    ];

    const result = await this.pool.query(query, values);
    const createdReport = this.mapRowToReport(result.rows[0]);

    // Start report generation asynchronously
    this.generateReportAsync(createdReport).catch(error => {
      logger.error('Report generation failed:', error);
      this.updateReportStatus(id, 'failed', error.message);
    });

    return createdReport;
  }

  async updateReport(id: string, updateData: UpdateReportRequest): Promise<ReportData | null> {
    const existingReport = await this.getReportById(id);
    if (!existingReport) {
      return null;
    }

    const updatedReport = {
      ...existingReport,
      ...updateData,
      config: updateData.config ? { ...existingReport.config, ...updateData.config } : existingReport.config,
      updatedAt: new Date().toISOString()
    };

    const query = `
      UPDATE reports
      SET name = $1, content = $2
      WHERE id = $3
      RETURNING *
    `;

    const values = [
      updatedReport.name,
      JSON.stringify({
        description: updatedReport.description,
        config: updatedReport.config,
        status: updatedReport.status,
        createdBy: updatedReport.createdBy
      }),
      id
    ];

    const result = await this.pool.query(query, values);
    return this.mapRowToReport(result.rows[0]);
  }

  async deleteReport(id: string): Promise<boolean> {
    const query = 'DELETE FROM reports WHERE id = $1';
    const result = await this.pool.query(query, [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async getReportsByThreatModel(threatModelId: string): Promise<ReportData[]> {
    const result = await this.getAllReports({
      page: 1,
      limit: 1000, // Large limit to get all reports
      threatModelId
    });
    
    return result.reports;
  }

  async generateReport(reportId: string): Promise<string> {
    const report = await this.getReportById(reportId);
    if (!report) {
      throw new Error('Report not found');
    }

    if (report.status === 'generating') {
      throw new Error('Report is already being generated');
    }

    // Update status to generating
    await this.updateReportStatus(reportId, 'generating');

    try {
      // Get threat model data
      const threatModelData = await this.getThreatModelData(report.threatModelId);
      
      // Generate the report file
      const filePath = await this.generator.generateReport(report, threatModelData);
      
      // Update report with file info
      await this.updateReportWithFile(reportId, filePath);
      
      // Update status to completed
      await this.updateReportStatus(reportId, 'completed');
      
      return filePath;
    } catch (error) {
      await this.updateReportStatus(reportId, 'failed', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  async downloadReport(reportId: string): Promise<{ filePath: string; fileName: string } | null> {
    const report = await this.getReportById(reportId);
    if (!report || !report.filePath) {
      return null;
    }

    const fileName = `${report.name}.${report.config.format}`;
    return {
      filePath: report.filePath,
      fileName
    };
  }

  private async generateReportAsync(report: ReportData): Promise<void> {
    await this.generateReport(report.id);
  }

  private async updateReportStatus(reportId: string, status: ReportStatus, error?: string): Promise<void> {
    // Get existing content
    const existingReport = await this.getReportById(reportId);
    if (!existingReport) return;
    
    const query = `
      UPDATE reports 
      SET content = $1
      WHERE id = $2
    `;
    
    const updatedContent = {
      description: existingReport.description,
      config: existingReport.config,
      status: status,
      error: error,
      createdBy: existingReport.createdBy
    };
    
    await this.pool.query(query, [JSON.stringify(updatedContent), reportId]);
  }

  private async updateReportWithFile(reportId: string, filePath: string): Promise<void> {
    const query = `
      UPDATE reports 
      SET file_url = $1
      WHERE id = $2
    `;
    
    await this.pool.query(query, [filePath, reportId]);
  }

  private async getThreatModelData(threatModelId: string): Promise<ThreatModelData> {
    // Get threat model basic info
    const tmQuery = `
      SELECT tm.*, p.name as project_name, p.description as project_description, p.organization
      FROM threat_models tm
      LEFT JOIN projects p ON tm.project_id = p.id
      WHERE tm.id = $1
    `;
    
    const tmResult = await this.pool.query(tmQuery, [threatModelId]);
    if (tmResult.rows.length === 0) {
      throw new Error('Threat model not found');
    }
    
    const threatModel = tmResult.rows[0];
    
    // Get threats
    const threatsQuery = `
      SELECT * FROM threats 
      WHERE threat_model_id = $1 
      ORDER BY risk_score DESC
    `;
    const threatsResult = await this.pool.query(threatsQuery, [threatModelId]);
    
    // Get risks
    const risksQuery = `
      SELECT * FROM risks 
      WHERE threat_model_id = $1 
      ORDER BY risk_score DESC
    `;
    const risksResult = await this.pool.query(risksQuery, [threatModelId]);
    
    // Get diagrams
    const diagramsQuery = `
      SELECT * FROM diagrams 
      WHERE threat_model_id = $1 
      ORDER BY created_at
    `;
    const diagramsResult = await this.pool.query(diagramsQuery, [threatModelId]);
    
    return {
      id: threatModel.id,
      name: threatModel.name,
      description: threatModel.description,
      methodology: threatModel.methodology,
      status: threatModel.status,
      createdAt: threatModel.created_at,
      updatedAt: threatModel.updated_at,
      threats: threatsResult.rows,
      risks: risksResult.rows,
      diagrams: diagramsResult.rows.map(row => ({
        id: row.id,
        name: row.name,
        description: row.description || '',
        elements: JSON.parse(row.data || '{}').elements || [],
        connections: JSON.parse(row.data || '{}').connections || [],
        metadata: JSON.parse(row.data || '{}').metadata || {}
      })),
      project: {
        id: threatModel.project_id,
        name: threatModel.project_name,
        description: threatModel.project_description,
        organization: threatModel.organization
      }
    };
  }

  private mapRowToReport(row: Record<string, any>): ReportData {
    const content = JSON.parse(row.content || '{}');
    
    return {
      id: row.id,
      threatModelId: row.threat_model_id,
      name: row.name,
      description: content.description || '',
      config: content.config || { format: row.format },
      status: content.status || 'completed',
      filePath: row.file_url,
      fileSize: undefined, // Not stored in current schema
      generatedAt: row.generated_at,
      createdAt: row.generated_at, // Use generated_at as created_at
      updatedAt: row.generated_at, // Use generated_at as updated_at
      createdBy: content.createdBy || 'system'
    };
  }
}