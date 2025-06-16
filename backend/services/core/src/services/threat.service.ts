import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import {
  Threat,
  ThreatStatus,
  ThreatSeverity,
  CreateThreatRequest,
  UpdateThreatRequest,
  ThreatMitigation,
  MitigationStatus,
  ThreatSuggestion,
  MethodologyType
} from '../types';

export class ThreatService {
  constructor(private pool: Pool) {}

  /**
   * Create a new threat
   */
  async createThreat(
    userId: string,
    data: CreateThreatRequest
  ): Promise<Threat> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // Verify user has access to the threat model
      const accessCheck = await client.query(
        `SELECT tm.id FROM threat_models tm
         JOIN projects p ON tm.project_id = p.id
         LEFT JOIN user_projects up ON p.id = up.project_id
         WHERE tm.id = $1 AND (p.owner_id = $2 OR up.user_id = $2)`,
        [data.threat_model_id, userId]
      );

      if (accessCheck.rows.length === 0) {
        throw new Error('Access denied to threat model');
      }

      const threatId = uuidv4();
      const now = new Date();

      // Create the threat
      const result = await client.query(
        `INSERT INTO threats (
          id, threat_model_id, name, description, category,
          methodology_specific, affected_assets, threat_actors,
          severity, likelihood, risk_score, status,
          created_by, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING *`,
        [
          threatId,
          data.threat_model_id,
          data.name,
          data.description,
          data.category,
          JSON.stringify(data.methodology_specific || {}),
          data.affected_assets || [],
          data.threat_actors || [],
          data.severity || ThreatSeverity.MEDIUM,
          data.likelihood || 'medium',
          this.calculateRiskScore(data.severity || ThreatSeverity.MEDIUM, data.likelihood || 'medium'),
          data.status || ThreatStatus.IDENTIFIED,
          userId,
          now,
          now
        ]
      );

      await client.query('COMMIT');

      logger.info(`Threat created: ${threatId}`);
      return this.formatThreat(result.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error creating threat:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get threats for a threat model
   */
  async getThreatsByThreatModel(
    userId: string,
    threatModelId: string,
    filters?: {
      status?: ThreatStatus;
      severity?: ThreatSeverity;
      category?: string;
    }
  ): Promise<Threat[]> {
    // Build query with filters
    let query = `
      SELECT t.* FROM threats t
      JOIN threat_models tm ON t.threat_model_id = tm.id
      JOIN projects p ON tm.project_id = p.id
      LEFT JOIN user_projects up ON p.id = up.project_id
      WHERE tm.id = $1 AND (p.owner_id = $2 OR up.user_id = $2)
    `;
    
    const params: any[] = [threatModelId, userId];
    let paramIndex = 3;

    if (filters?.status) {
      query += ` AND t.status = $${paramIndex}`;
      params.push(filters.status);
      paramIndex++;
    }

    if (filters?.severity) {
      query += ` AND t.severity = $${paramIndex}`;
      params.push(filters.severity);
      paramIndex++;
    }

    if (filters?.category) {
      query += ` AND t.category = $${paramIndex}`;
      params.push(filters.category);
      paramIndex++;
    }

    query += ' ORDER BY t.risk_score DESC, t.created_at DESC';

    const result = await this.pool.query(query, params);
    return result.rows.map(row => this.formatThreat(row));
  }

  /**
   * Get a specific threat
   */
  async getThreat(userId: string, threatId: string): Promise<Threat | null> {
    const result = await this.pool.query(
      `SELECT t.* FROM threats t
       JOIN threat_models tm ON t.threat_model_id = tm.id
       JOIN projects p ON tm.project_id = p.id
       LEFT JOIN user_projects up ON p.id = up.project_id
       WHERE t.id = $1 AND (p.owner_id = $2 OR up.user_id = $2)`,
      [threatId, userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.formatThreat(result.rows[0]);
  }

  /**
   * Update a threat
   */
  async updateThreat(
    userId: string,
    threatId: string,
    data: UpdateThreatRequest
  ): Promise<Threat | null> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // Verify access
      const accessCheck = await client.query(
        `SELECT t.* FROM threats t
         JOIN threat_models tm ON t.threat_model_id = tm.id
         JOIN projects p ON tm.project_id = p.id
         LEFT JOIN user_projects up ON p.id = up.project_id
         WHERE t.id = $1 AND (p.owner_id = $2 OR up.user_id = $2)`,
        [threatId, userId]
      );

      if (accessCheck.rows.length === 0) {
        return null;
      }

      const updates: string[] = [];
      const values: any[] = [];
      let valueIndex = 1;

      // Build dynamic update query
      if (data.name !== undefined) {
        updates.push(`name = $${valueIndex}`);
        values.push(data.name);
        valueIndex++;
      }

      if (data.description !== undefined) {
        updates.push(`description = $${valueIndex}`);
        values.push(data.description);
        valueIndex++;
      }

      if (data.category !== undefined) {
        updates.push(`category = $${valueIndex}`);
        values.push(data.category);
        valueIndex++;
      }

      if (data.severity !== undefined) {
        updates.push(`severity = $${valueIndex}`);
        values.push(data.severity);
        valueIndex++;
      }

      if (data.likelihood !== undefined) {
        updates.push(`likelihood = $${valueIndex}`);
        values.push(data.likelihood);
        valueIndex++;
      }

      if (data.status !== undefined) {
        updates.push(`status = $${valueIndex}`);
        values.push(data.status);
        valueIndex++;
      }

      if (data.affected_assets !== undefined) {
        updates.push(`affected_assets = $${valueIndex}`);
        values.push(data.affected_assets);
        valueIndex++;
      }

      if (data.threat_actors !== undefined) {
        updates.push(`threat_actors = $${valueIndex}`);
        values.push(data.threat_actors);
        valueIndex++;
      }

      if (data.methodology_specific !== undefined) {
        updates.push(`methodology_specific = $${valueIndex}`);
        values.push(JSON.stringify(data.methodology_specific));
        valueIndex++;
      }

      // Recalculate risk score if severity or likelihood changed
      if (data.severity !== undefined || data.likelihood !== undefined) {
        const currentThreat = accessCheck.rows[0];
        const severity = data.severity || currentThreat.severity;
        const likelihood = data.likelihood || currentThreat.likelihood;
        const riskScore = this.calculateRiskScore(severity, likelihood);
        
        updates.push(`risk_score = $${valueIndex}`);
        values.push(riskScore);
        valueIndex++;
      }

      updates.push(`updated_at = $${valueIndex}`);
      values.push(new Date());
      valueIndex++;

      values.push(threatId);

      const result = await client.query(
        `UPDATE threats SET ${updates.join(', ')} WHERE id = $${valueIndex} RETURNING *`,
        values
      );

      await client.query('COMMIT');

      logger.info(`Threat updated: ${threatId}`);
      return this.formatThreat(result.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error updating threat:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Delete a threat
   */
  async deleteThreat(userId: string, threatId: string): Promise<boolean> {
    const result = await this.pool.query(
      `DELETE FROM threats t
       USING threat_models tm, projects p
       LEFT JOIN user_projects up ON p.id = up.project_id
       WHERE t.threat_model_id = tm.id 
       AND tm.project_id = p.id
       AND t.id = $1 
       AND (p.owner_id = $2 OR up.user_id = $2)`,
      [threatId, userId]
    );

    return result.rowCount > 0;
  }

  /**
   * Add a mitigation to a threat
   */
  async addMitigation(
    userId: string,
    threatId: string,
    mitigation: Omit<ThreatMitigation, 'id' | 'created_at' | 'updated_at'>
  ): Promise<ThreatMitigation> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // Verify access
      const accessCheck = await client.query(
        `SELECT t.id FROM threats t
         JOIN threat_models tm ON t.threat_model_id = tm.id
         JOIN projects p ON tm.project_id = p.id
         LEFT JOIN user_projects up ON p.id = up.project_id
         WHERE t.id = $1 AND (p.owner_id = $2 OR up.user_id = $2)`,
        [threatId, userId]
      );

      if (accessCheck.rows.length === 0) {
        throw new Error('Access denied to threat');
      }

      const mitigationId = uuidv4();
      const now = new Date();

      const result = await client.query(
        `INSERT INTO threat_mitigations (
          id, threat_id, name, description, type,
          effectiveness, cost, implementation_effort,
          status, assigned_to, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *`,
        [
          mitigationId,
          threatId,
          mitigation.name,
          mitigation.description,
          mitigation.type,
          mitigation.effectiveness,
          mitigation.cost || 'medium',
          mitigation.implementation_effort || 'medium',
          mitigation.status || MitigationStatus.PROPOSED,
          mitigation.assigned_to,
          now,
          now
        ]
      );

      await client.query('COMMIT');

      logger.info(`Mitigation added to threat ${threatId}: ${mitigationId}`);
      return this.formatMitigation(result.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error adding mitigation:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get mitigations for a threat
   */
  async getMitigations(userId: string, threatId: string): Promise<ThreatMitigation[]> {
    const result = await this.pool.query(
      `SELECT m.* FROM threat_mitigations m
       JOIN threats t ON m.threat_id = t.id
       JOIN threat_models tm ON t.threat_model_id = tm.id
       JOIN projects p ON tm.project_id = p.id
       LEFT JOIN user_projects up ON p.id = up.project_id
       WHERE t.id = $1 AND (p.owner_id = $2 OR up.user_id = $2)
       ORDER BY m.effectiveness DESC, m.created_at DESC`,
      [threatId, userId]
    );

    return result.rows.map(row => this.formatMitigation(row));
  }

  /**
   * Generate AI-powered threat suggestions
   */
  async generateThreatSuggestions(
    userId: string,
    threatModelId: string,
    methodology: MethodologyType
  ): Promise<ThreatSuggestion[]> {
    // This is a placeholder implementation
    // In production, this would integrate with an AI service
    
    const suggestions: ThreatSuggestion[] = [];

    // Get threat model details for context
    const tmResult = await this.pool.query(
      `SELECT tm.*, p.metadata as project_metadata
       FROM threat_models tm
       JOIN projects p ON tm.project_id = p.id
       LEFT JOIN user_projects up ON p.id = up.project_id
       WHERE tm.id = $1 AND (p.owner_id = $2 OR up.user_id = $2)`,
      [threatModelId, userId]
    );

    if (tmResult.rows.length === 0) {
      throw new Error('Threat model not found');
    }

    const threatModel = tmResult.rows[0];
    const scope = threatModel.scope;

    // Generate methodology-specific suggestions
    if (methodology === MethodologyType.STRIDE) {
      suggestions.push(...this.generateSTRIDESuggestions(scope));
    } else if (methodology === MethodologyType.LINDDUN) {
      suggestions.push(...this.generateLINDDUNSuggestions(scope));
    } else if (methodology === MethodologyType.PASTA) {
      suggestions.push(...this.generatePASTASuggestions(scope));
    }

    return suggestions;
  }

  /**
   * Generate STRIDE-specific threat suggestions
   */
  private generateSTRIDESuggestions(scope: any): ThreatSuggestion[] {
    const suggestions: ThreatSuggestion[] = [];

    // Spoofing threats
    if (scope.actors?.some((a: any) => a.type === 'external_system')) {
      suggestions.push({
        category: 'Spoofing',
        threats: [
          {
            name: 'API Key Theft',
            description: 'External systems could have their API keys compromised, allowing attackers to impersonate them',
            likelihood: 'medium',
            impact: 'high',
            methodology_specific: {
              stride_category: 'spoofing'
            }
          }
        ]
      });
    }

    // Tampering threats
    if (scope.data_flows?.some((df: any) => !df.encryption)) {
      suggestions.push({
        category: 'Tampering',
        threats: [
          {
            name: 'Man-in-the-Middle Attack',
            description: 'Unencrypted data flows are vulnerable to interception and modification',
            likelihood: 'high',
            impact: 'high',
            methodology_specific: {
              stride_category: 'tampering'
            }
          }
        ]
      });
    }

    // Information Disclosure threats
    if (scope.assets?.some((a: any) => a.sensitivity === 'confidential' || a.sensitivity === 'secret')) {
      suggestions.push({
        category: 'Information Disclosure',
        threats: [
          {
            name: 'Data Exposure',
            description: 'Sensitive data could be exposed through improper access controls or logging',
            likelihood: 'medium',
            impact: 'high',
            methodology_specific: {
              stride_category: 'information_disclosure'
            }
          }
        ]
      });
    }

    return suggestions;
  }

  /**
   * Generate LINDDUN-specific threat suggestions
   */
  private generateLINDDUNSuggestions(scope: any): ThreatSuggestion[] {
    const suggestions: ThreatSuggestion[] = [];

    // Linkability threats
    if (scope.assets?.some((a: any) => a.type === 'data')) {
      suggestions.push({
        category: 'Linkability',
        threats: [
          {
            name: 'User Activity Correlation',
            description: 'User activities across different services could be linked together',
            likelihood: 'medium',
            impact: 'medium',
            methodology_specific: {
              linddun_category: 'linkability'
            }
          }
        ]
      });
    }

    // Identifiability threats
    suggestions.push({
      category: 'Identifiability',
      threats: [
        {
          name: 'User Re-identification',
          description: 'Anonymized data could potentially be re-identified through data analysis',
          likelihood: 'low',
          impact: 'high',
          methodology_specific: {
            linddun_category: 'identifiability'
          }
        }
      ]
    });

    return suggestions;
  }

  /**
   * Generate PASTA-specific threat suggestions
   */
  private generatePASTASuggestions(scope: any): ThreatSuggestion[] {
    const suggestions: ThreatSuggestion[] = [];

    // Business-focused threats
    suggestions.push({
      category: 'Business Impact',
      threats: [
        {
          name: 'Service Disruption',
          description: 'Critical business processes could be disrupted by targeted attacks',
          likelihood: 'medium',
          impact: 'high',
          methodology_specific: {
            pasta_stage: 'stage_4_threat_analysis'
          }
        }
      ]
    });

    return suggestions;
  }

  /**
   * Calculate risk score based on severity and likelihood
   */
  private calculateRiskScore(severity: ThreatSeverity, likelihood: string): number {
    const severityScores: Record<ThreatSeverity, number> = {
      [ThreatSeverity.CRITICAL]: 5,
      [ThreatSeverity.HIGH]: 4,
      [ThreatSeverity.MEDIUM]: 3,
      [ThreatSeverity.LOW]: 2,
      [ThreatSeverity.INFO]: 1
    };

    const likelihoodScores: Record<string, number> = {
      'very_high': 5,
      'high': 4,
      'medium': 3,
      'low': 2,
      'very_low': 1
    };

    const severityScore = severityScores[severity] || 3;
    const likelihoodScore = likelihoodScores[likelihood] || 3;

    return severityScore * likelihoodScore;
  }

  /**
   * Format threat from database row
   */
  private formatThreat(row: any): Threat {
    return {
      id: row.id,
      threat_model_id: row.threat_model_id,
      name: row.name,
      description: row.description,
      category: row.category,
      methodology_specific: row.methodology_specific,
      affected_assets: row.affected_assets,
      threat_actors: row.threat_actors,
      severity: row.severity,
      likelihood: row.likelihood,
      risk_score: row.risk_score,
      status: row.status,
      created_by: row.created_by,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }

  /**
   * Format mitigation from database row
   */
  private formatMitigation(row: any): ThreatMitigation {
    return {
      id: row.id,
      threat_id: row.threat_id,
      name: row.name,
      description: row.description,
      type: row.type,
      effectiveness: row.effectiveness,
      cost: row.cost,
      implementation_effort: row.implementation_effort,
      status: row.status,
      assigned_to: row.assigned_to,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }
}