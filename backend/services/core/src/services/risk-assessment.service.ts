import { pool } from '../config/database';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export interface RiskAssessment {
  id: string;
  projectId: string;
  overallRisk: 'Critical' | 'High' | 'Medium' | 'Low';
  score: number;
  status: 'pending' | 'in_progress' | 'completed';
  assessmentType: 'automated' | 'manual';
  createdBy: string;
  organizationId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface RiskRecommendation {
  id: string;
  assessmentId: string;
  recommendation: string;
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  category: string;
}

export interface AssessmentDetails extends RiskAssessment {
  projectName: string;
  vulnerabilities: any[];
  threats: any[];
  recommendations: RiskRecommendation[];
}

export class RiskAssessmentService {
  async createAssessment(
    userId: string,
    organizationId: string,
    data: {
      projectId: string;
      assessmentType: 'automated' | 'manual';
    }
  ): Promise<RiskAssessment> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Create assessment
      const assessmentId = uuidv4();
      const assessmentResult = await client.query(
        `INSERT INTO risk_assessments 
         (id, project_id, overall_risk, score, status, assessment_type, created_by, organization_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [assessmentId, data.projectId, 'Low', 0, 'in_progress', data.assessmentType, userId, organizationId]
      );
      
      const assessment = assessmentResult.rows[0];
      
      // Start risk calculation
      await this.calculateRiskScore(assessmentId, data.projectId, organizationId, client);
      
      await client.query('COMMIT');
      
      // Return updated assessment
      const finalResult = await client.query(
        'SELECT * FROM risk_assessments WHERE id = $1',
        [assessmentId]
      );
      
      return this.mapToRiskAssessment(finalResult.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error creating risk assessment:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async calculateRiskScore(
    assessmentId: string,
    projectId: string,
    organizationId: string,
    client: any
  ): Promise<void> {
    try {
      // Get vulnerabilities for the project
      const vulnResult = await client.query(
        `SELECT v.*, 
                CASE 
                  WHEN v.severity = 'Critical' THEN 40
                  WHEN v.severity = 'High' THEN 30
                  WHEN v.severity = 'Medium' THEN 20
                  WHEN v.severity = 'Low' THEN 10
                  ELSE 5
                END as risk_contribution
         FROM vulnerabilities v
         WHERE v.project_id = $1 
           AND v.organization_id = $2 
           AND v.status IN ('open', 'in_progress')`,
        [projectId, organizationId]
      );

      // Get threats for the project
      const threatResult = await client.query(
        `SELECT t.*,
                tm.id as threat_model_id
         FROM threats t
         JOIN threat_models tm ON t.threat_model_id = tm.id
         WHERE tm.project_id = $1 
           AND t.status IN ('identified', 'analyzing')`,
        [projectId]
      );

      // Calculate base score from vulnerabilities
      let vulnerabilityScore = 0;
      const vulnerabilities = vulnResult.rows;
      
      for (const vuln of vulnerabilities) {
        // Insert into junction table
        await client.query(
          `INSERT INTO assessment_vulnerabilities (assessment_id, vulnerability_id, risk_contribution)
           VALUES ($1, $2, $3)
           ON CONFLICT DO NOTHING`,
          [assessmentId, vuln.id, vuln.risk_contribution]
        );
        
        vulnerabilityScore += vuln.risk_contribution;
      }

      // Calculate threat score
      let threatScore = 0;
      const threats = threatResult.rows;
      
      for (const threat of threats) {
        // Calculate threat risk level based on likelihood and impact
        const likelihood = threat.likelihood || 'Medium';
        const impact = threat.impact || 'Medium';
        const riskLevel = this.calculateThreatRiskLevel(likelihood, impact);
        
        // Insert into junction table
        await client.query(
          `INSERT INTO assessment_threats (assessment_id, threat_id, likelihood, impact, risk_level)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT DO NOTHING`,
          [assessmentId, threat.id, likelihood, impact, riskLevel]
        );
        
        // Add to threat score
        const threatContribution = riskLevel === 'Critical' ? 30 : 
                                  riskLevel === 'High' ? 20 : 
                                  riskLevel === 'Medium' ? 10 : 5;
        threatScore += threatContribution;
      }

      // Calculate overall score (0-100)
      const totalScore = Math.min(100, vulnerabilityScore + threatScore);
      
      // Determine overall risk level
      const overallRisk = totalScore >= 75 ? 'Critical' :
                         totalScore >= 50 ? 'High' :
                         totalScore >= 25 ? 'Medium' : 'Low';

      // Generate recommendations
      await this.generateRecommendations(assessmentId, vulnerabilities, threats, client);

      // Update assessment with calculated values
      await client.query(
        `UPDATE risk_assessments 
         SET score = $1, overall_risk = $2, status = 'completed', updated_at = NOW()
         WHERE id = $3`,
        [totalScore, overallRisk, assessmentId]
      );

    } catch (error) {
      logger.error('Error calculating risk score:', error);
      throw error;
    }
  }

  private calculateThreatRiskLevel(likelihood: string, impact: string): string {
    const likelihoodScore = likelihood === 'Very High' ? 5 :
                           likelihood === 'High' ? 4 :
                           likelihood === 'Medium' ? 3 :
                           likelihood === 'Low' ? 2 : 1;
    
    const impactScore = impact === 'Very High' ? 5 :
                       impact === 'High' ? 4 :
                       impact === 'Medium' ? 3 :
                       impact === 'Low' ? 2 : 1;
    
    const riskScore = likelihoodScore * impactScore;
    
    return riskScore >= 20 ? 'Critical' :
           riskScore >= 12 ? 'High' :
           riskScore >= 6 ? 'Medium' : 'Low';
  }

  private async generateRecommendations(
    assessmentId: string,
    vulnerabilities: any[],
    threats: any[],
    client: any
  ): Promise<void> {
    const recommendations: Array<{
      recommendation: string;
      priority: string;
      category: string;
    }> = [];

    // Vulnerability-based recommendations
    const criticalVulns = vulnerabilities.filter(v => v.severity === 'Critical').length;
    const highVulns = vulnerabilities.filter(v => v.severity === 'High').length;
    
    if (criticalVulns > 0) {
      recommendations.push({
        recommendation: `Address ${criticalVulns} critical vulnerabilities immediately to prevent potential system compromise`,
        priority: 'Critical',
        category: 'Vulnerability Management'
      });
    }
    
    if (highVulns > 0) {
      recommendations.push({
        recommendation: `Prioritize fixing ${highVulns} high-severity vulnerabilities within the next sprint`,
        priority: 'High',
        category: 'Vulnerability Management'
      });
    }

    // Security testing recommendations
    if (vulnerabilities.length > 5) {
      recommendations.push({
        recommendation: 'Implement automated security scanning in CI/CD pipeline',
        priority: 'High',
        category: 'Security Testing'
      });
    }

    // Threat-based recommendations
    const criticalThreats = threats.filter(t => 
      this.calculateThreatRiskLevel(t.likelihood || 'Medium', t.impact || 'Medium') === 'Critical'
    ).length;
    
    if (criticalThreats > 0) {
      recommendations.push({
        recommendation: `Develop mitigation strategies for ${criticalThreats} critical threats`,
        priority: 'Critical',
        category: 'Threat Mitigation'
      });
    }

    // General security recommendations
    recommendations.push({
      recommendation: 'Conduct regular security code reviews',
      priority: 'Medium',
      category: 'Security Process'
    });
    
    recommendations.push({
      recommendation: 'Implement comprehensive logging and monitoring',
      priority: 'Medium',
      category: 'Security Monitoring'
    });

    // Insert recommendations
    for (const rec of recommendations) {
      await client.query(
        `INSERT INTO risk_recommendations (assessment_id, recommendation, priority, category)
         VALUES ($1, $2, $3, $4)`,
        [assessmentId, rec.recommendation, rec.priority, rec.category]
      );
    }
  }

  async getAssessments(
    userId: string,
    organizationId: string,
    filters: {
      projectId?: string;
      status?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ assessments: AssessmentDetails[]; total: number }> {
    try {
      let query = `
        SELECT ra.*, p.name as project_name,
               COUNT(*) OVER() as total_count
        FROM risk_assessments ra
        JOIN projects p ON ra.project_id = p.id
        WHERE ra.organization_id = $1
      `;
      
      const params: any[] = [organizationId];
      let paramIndex = 2;

      if (filters.projectId) {
        query += ` AND ra.project_id = $${paramIndex}`;
        params.push(filters.projectId);
        paramIndex++;
      }

      if (filters.status) {
        query += ` AND ra.status = $${paramIndex}`;
        params.push(filters.status);
        paramIndex++;
      }

      query += ` ORDER BY ra.created_at DESC`;

      if (filters.limit) {
        query += ` LIMIT $${paramIndex}`;
        params.push(filters.limit);
        paramIndex++;
      }

      if (filters.offset) {
        query += ` OFFSET $${paramIndex}`;
        params.push(filters.offset);
      }

      const result = await pool.query(query, params);
      
      // Get details for each assessment
      const assessments = await Promise.all(
        result.rows.map(row => this.getAssessmentDetails(row.id))
      );

      return {
        assessments,
        total: result.rows[0]?.total_count || 0
      };
    } catch (error) {
      logger.error('Error fetching risk assessments:', error);
      throw error;
    }
  }

  async getAssessmentDetails(assessmentId: string): Promise<AssessmentDetails> {
    const client = await pool.connect();
    
    try {
      // Get assessment with project name
      const assessmentResult = await client.query(
        `SELECT ra.*, p.name as project_name
         FROM risk_assessments ra
         JOIN projects p ON ra.project_id = p.id
         WHERE ra.id = $1`,
        [assessmentId]
      );

      if (assessmentResult.rows.length === 0) {
        throw new Error('Assessment not found');
      }

      const assessment = assessmentResult.rows[0];

      // Get vulnerabilities
      const vulnResult = await client.query(
        `SELECT v.*, av.risk_contribution
         FROM vulnerabilities v
         JOIN assessment_vulnerabilities av ON v.id = av.vulnerability_id
         WHERE av.assessment_id = $1
         ORDER BY v.severity DESC, av.risk_contribution DESC`,
        [assessmentId]
      );

      // Get threats
      const threatResult = await client.query(
        `SELECT t.*, at.likelihood, at.impact, at.risk_level,
                tm.name as threat_model_name
         FROM threats t
         JOIN assessment_threats at ON t.id = at.threat_id
         JOIN threat_models tm ON t.threat_model_id = tm.id
         WHERE at.assessment_id = $1
         ORDER BY at.risk_level DESC`,
        [assessmentId]
      );

      // Get recommendations
      const recResult = await client.query(
        `SELECT * FROM risk_recommendations
         WHERE assessment_id = $1
         ORDER BY 
           CASE priority 
             WHEN 'Critical' THEN 1
             WHEN 'High' THEN 2
             WHEN 'Medium' THEN 3
             WHEN 'Low' THEN 4
           END`,
        [assessmentId]
      );

      return {
        id: assessment.id,
        projectId: assessment.project_id,
        projectName: assessment.project_name,
        overallRisk: assessment.overall_risk,
        score: assessment.score,
        status: assessment.status,
        assessmentType: assessment.assessment_type,
        createdBy: assessment.created_by,
        organizationId: assessment.organization_id,
        createdAt: assessment.created_at,
        updatedAt: assessment.updated_at,
        vulnerabilities: vulnResult.rows,
        threats: threatResult.rows,
        recommendations: recResult.rows.map(r => ({
          id: r.id,
          assessmentId: r.assessment_id,
          recommendation: r.recommendation,
          priority: r.priority,
          category: r.category
        }))
      };
    } finally {
      client.release();
    }
  }

  async refreshAssessment(
    assessmentId: string,
    userId: string,
    organizationId: string
  ): Promise<RiskAssessment> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Get assessment
      const assessmentResult = await client.query(
        'SELECT * FROM risk_assessments WHERE id = $1 AND organization_id = $2',
        [assessmentId, organizationId]
      );

      if (assessmentResult.rows.length === 0) {
        throw new Error('Assessment not found');
      }

      const assessment = assessmentResult.rows[0];

      // Clear old data
      await client.query('DELETE FROM assessment_vulnerabilities WHERE assessment_id = $1', [assessmentId]);
      await client.query('DELETE FROM assessment_threats WHERE assessment_id = $1', [assessmentId]);
      await client.query('DELETE FROM risk_recommendations WHERE assessment_id = $1', [assessmentId]);

      // Update status
      await client.query(
        'UPDATE risk_assessments SET status = $1, updated_at = NOW() WHERE id = $2',
        ['in_progress', assessmentId]
      );

      // Recalculate
      await this.calculateRiskScore(assessmentId, assessment.project_id, organizationId, client);

      await client.query('COMMIT');

      // Return updated assessment
      const finalResult = await client.query(
        'SELECT * FROM risk_assessments WHERE id = $1',
        [assessmentId]
      );

      return this.mapToRiskAssessment(finalResult.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error refreshing assessment:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  private mapToRiskAssessment(row: any): RiskAssessment {
    return {
      id: row.id,
      projectId: row.project_id,
      overallRisk: row.overall_risk,
      score: row.score,
      status: row.status,
      assessmentType: row.assessment_type,
      createdBy: row.created_by,
      organizationId: row.organization_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}