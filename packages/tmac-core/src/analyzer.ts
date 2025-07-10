import {
  ThreatModel,
  AnalysisResult,
  AnalysisSummary,
  Finding,
  FindingType,
  Recommendation,
  ComplianceStatus,
  Severity,
  Component,
  Threat,
  DataFlow
} from './types';

export class TMACAnalyzer {
  /**
   * Analyze a threat model and generate findings
   */
  static analyze(model: ThreatModel): AnalysisResult {
    const summary = this.generateSummary(model);
    const riskScore = this.calculateRiskScore(model);
    const findings = this.generateFindings(model);
    const recommendations = this.generateRecommendations(model, findings);
    const complianceStatus = this.assessCompliance(model);

    return {
      summary,
      riskScore,
      findings,
      recommendations,
      complianceStatus
    };
  }

  /**
   * Generate analysis summary
   */
  private static generateSummary(model: ThreatModel): AnalysisSummary {
    const totalComponents = model.system.components.length;
    const totalDataFlows = model.dataFlows.length;
    const totalThreats = model.threats.length;
    const totalMitigations = model.mitigations?.length || 0;

    const criticalThreats = model.threats.filter(t => t.severity === 'critical').length;
    const highThreats = model.threats.filter(t => t.severity === 'high').length;

    const mitigatedThreats = new Set(
      model.mitigations?.flatMap(m => m.threats) || []
    );
    const unmitigatedThreats = model.threats.filter(
      t => !mitigatedThreats.has(t.id)
    ).length;

    const coveragePercentage = totalThreats > 0
      ? Math.round((mitigatedThreats.size / totalThreats) * 100)
      : 0;

    return {
      totalComponents,
      totalDataFlows,
      totalThreats,
      totalMitigations,
      criticalThreats,
      highThreats,
      unmitigatedThreats,
      coveragePercentage
    };
  }

  /**
   * Calculate overall risk score (0-100)
   */
  private static calculateRiskScore(model: ThreatModel): number {
    let score = 0;
    const weights = {
      critical: 10,
      high: 7,
      medium: 4,
      low: 2,
      info: 1
    };

    const mitigatedThreats = new Set(
      model.mitigations?.flatMap(m => m.threats) || []
    );

    model.threats.forEach(threat => {
      const baseScore = weights[threat.severity] || 0;
      const likelihoodMultiplier = this.getLikelihoodMultiplier(threat.likelihood);
      const mitigationReduction = mitigatedThreats.has(threat.id) ? 0.7 : 0;
      
      score += baseScore * likelihoodMultiplier * (1 - mitigationReduction);
    });

    // Normalize to 0-100
    const maxPossibleScore = model.threats.length * weights.critical * 1.0;
    return Math.min(100, Math.round((score / maxPossibleScore) * 100));
  }

  /**
   * Get likelihood multiplier
   */
  private static getLikelihoodMultiplier(likelihood?: string): number {
    const multipliers: Record<string, number> = {
      certain: 1.0,
      likely: 0.8,
      possible: 0.6,
      unlikely: 0.4,
      rare: 0.2
    };
    return multipliers[likelihood || 'possible'] || 0.6;
  }

  /**
   * Generate findings
   */
  private static generateFindings(model: ThreatModel): Finding[] {
    const findings: Finding[] = [];

    // Check for unmitigated threats
    const mitigatedThreats = new Set(
      model.mitigations?.flatMap(m => m.threats) || []
    );

    model.threats.forEach(threat => {
      if (!mitigatedThreats.has(threat.id) && 
          (threat.severity === 'critical' || threat.severity === 'high')) {
        findings.push({
          type: 'unmitigated-threat',
          severity: threat.severity,
          title: `Unmitigated ${threat.severity} threat: ${threat.name}`,
          description: threat.description || `Threat ${threat.id} lacks mitigation`,
          affectedComponents: threat.components,
          recommendation: `Implement mitigation controls for threat ${threat.id}`
        });
      }
    });

    // Check for missing encryption
    model.system.components.forEach(component => {
      if (component.dataClassification === 'confidential' || 
          component.dataClassification === 'restricted') {
        if (!component.encryption?.atRest) {
          findings.push({
            type: 'missing-encryption',
            severity: 'high',
            title: `Missing encryption at rest for ${component.name}`,
            description: `Component handles ${component.dataClassification} data without encryption at rest`,
            affectedComponents: [component.id],
            recommendation: 'Enable encryption at rest for sensitive data'
          });
        }
        if (!component.encryption?.inTransit) {
          findings.push({
            type: 'missing-encryption',
            severity: 'high',
            title: `Missing encryption in transit for ${component.name}`,
            description: `Component handles ${component.dataClassification} data without encryption in transit`,
            affectedComponents: [component.id],
            recommendation: 'Enable TLS/SSL for data in transit'
          });
        }
      }
    });

    // Check for weak authentication
    model.system.components.forEach(component => {
      if (component.trust === 'untrusted' && 
          (!component.authentication || component.authentication === 'none' || component.authentication === 'basic')) {
        findings.push({
          type: 'weak-authentication',
          severity: 'medium',
          title: `Weak authentication for ${component.name}`,
          description: `Untrusted component uses ${component.authentication || 'no'} authentication`,
          affectedComponents: [component.id],
          recommendation: 'Implement strong authentication (OAuth2, SAML, or certificate-based)'
        });
      }
    });

    // Check trust boundary violations
    this.checkTrustBoundaryViolations(model, findings);

    // Check data flow risks
    this.checkDataFlowRisks(model, findings);

    return findings;
  }

  /**
   * Check for trust boundary violations
   */
  private static checkTrustBoundaryViolations(model: ThreatModel, findings: Finding[]): void {
    const componentTrustMap = new Map<string, string>();
    model.system.components.forEach(c => componentTrustMap.set(c.id, c.trust || 'semi-trusted'));

    model.dataFlows.forEach(flow => {
      const sourceTrust = componentTrustMap.get(flow.source);
      const destTrust = componentTrustMap.get(flow.destination);

      if (sourceTrust === 'untrusted' && destTrust === 'trusted' && !flow.authentication) {
        findings.push({
          type: 'trust-boundary-violation',
          severity: 'high',
          title: `Trust boundary violation in ${flow.name}`,
          description: 'Untrusted source connects to trusted destination without authentication',
          affectedComponents: [flow.source, flow.destination],
          recommendation: 'Add authentication and input validation at trust boundary'
        });
      }
    });
  }

  /**
   * Check for data flow risks
   */
  private static checkDataFlowRisks(model: ThreatModel, findings: Finding[]): void {
    model.dataFlows.forEach(flow => {
      // Check for sensitive data over insecure protocols
      if ((flow.dataClassification === 'confidential' || flow.dataClassification === 'restricted') &&
          flow.protocol === 'http') {
        findings.push({
          type: 'data-flow-risk',
          severity: 'critical',
          title: `Sensitive data over insecure protocol in ${flow.name}`,
          description: `${flow.dataClassification} data transmitted over HTTP`,
          affectedComponents: [flow.source, flow.destination],
          recommendation: 'Use HTTPS or other secure protocols for sensitive data'
        });
      }

      // Check for missing encryption on sensitive flows
      if ((flow.dataClassification === 'confidential' || flow.dataClassification === 'restricted') &&
          !flow.encryption) {
        findings.push({
          type: 'data-flow-risk',
          severity: 'high',
          title: `Unencrypted sensitive data flow: ${flow.name}`,
          description: `${flow.dataClassification} data transmitted without encryption`,
          affectedComponents: [flow.source, flow.destination],
          recommendation: 'Enable encryption for this data flow'
        });
      }
    });
  }

  /**
   * Generate recommendations based on findings
   */
  private static generateRecommendations(model: ThreatModel, findings: Finding[]): Recommendation[] {
    const recommendations: Recommendation[] = [];
    const processedTypes = new Set<string>();

    // Group findings by type for consolidated recommendations
    const findingsByType = findings.reduce((acc, finding) => {
      if (!acc[finding.type]) acc[finding.type] = [];
      acc[finding.type].push(finding);
      return acc;
    }, {} as Record<FindingType, Finding[]>);

    // Generate recommendations for each finding type
    Object.entries(findingsByType).forEach(([type, findings]) => {
      if (type === 'unmitigated-threat' && findings.length > 0) {
        recommendations.push({
          priority: 'critical',
          title: 'Implement threat mitigations',
          description: `${findings.length} high/critical threats lack mitigation controls. Prioritize implementing controls for these threats.`,
          effort: 'high',
          components: [...new Set(findings.flatMap(f => f.affectedComponents || []))]
        });
      }

      if (type === 'missing-encryption' && findings.length > 0) {
        recommendations.push({
          priority: 'high',
          title: 'Enable encryption for sensitive data',
          description: `${findings.length} components handling sensitive data lack proper encryption. Implement AES-256 or stronger encryption.`,
          effort: 'medium',
          components: [...new Set(findings.flatMap(f => f.affectedComponents || []))]
        });
      }

      if (type === 'weak-authentication' && findings.length > 0) {
        recommendations.push({
          priority: 'medium',
          title: 'Strengthen authentication mechanisms',
          description: `${findings.length} components use weak or no authentication. Implement OAuth2, SAML, or certificate-based authentication.`,
          effort: 'medium',
          components: [...new Set(findings.flatMap(f => f.affectedComponents || []))]
        });
      }
    });

    // Add general best practice recommendations
    if (model.threats.length > 20 && !model.metadata.tags?.includes('automated-scanning')) {
      recommendations.push({
        priority: 'low',
        title: 'Implement automated threat scanning',
        description: 'Consider integrating automated security scanning tools to continuously identify new threats.',
        effort: 'medium'
      });
    }

    return recommendations.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
      return (priorityOrder[a.priority] || 4) - (priorityOrder[b.priority] || 4);
    });
  }

  /**
   * Assess compliance status
   */
  private static assessCompliance(model: ThreatModel): ComplianceStatus[] {
    const statuses: ComplianceStatus[] = [];

    model.metadata.compliance?.forEach(framework => {
      const status = this.assessFrameworkCompliance(model, framework);
      statuses.push(status);
    });

    return statuses;
  }

  /**
   * Assess compliance for a specific framework
   */
  private static assessFrameworkCompliance(model: ThreatModel, framework: string): ComplianceStatus {
    const gaps: string[] = [];
    let compliant = true;

    switch (framework.toUpperCase()) {
      case 'PCI-DSS':
        // Check PCI-DSS specific requirements
        const paymentComponents = model.system.components.filter(
          c => c.name.toLowerCase().includes('payment') || 
               c.description?.toLowerCase().includes('payment')
        );
        
        paymentComponents.forEach(component => {
          if (!component.encryption?.atRest || !component.encryption?.inTransit) {
            gaps.push(`Payment component ${component.name} lacks required encryption`);
            compliant = false;
          }
        });

        // Check for network segmentation
        const hasSegmentation = model.system.trustBoundaries && 
                               model.system.trustBoundaries.length > 1;
        if (!hasSegmentation && paymentComponents.length > 0) {
          gaps.push('Missing network segmentation for payment processing');
          compliant = false;
        }
        break;

      case 'GDPR':
        // Check GDPR requirements
        const personalDataComponents = model.system.components.filter(
          c => c.dataClassification === 'confidential' || 
               c.dataClassification === 'restricted'
        );

        if (personalDataComponents.length > 0 && 
            !model.threats.some(t => t.name.toLowerCase().includes('data breach'))) {
          gaps.push('Missing data breach threat scenarios');
          compliant = false;
        }
        break;

      case 'SOC2':
        // Check SOC2 requirements
        const hasAccessControls = model.system.components.every(
          c => c.authentication && c.authentication !== 'none'
        );
        if (!hasAccessControls) {
          gaps.push('Not all components have access controls');
          compliant = false;
        }

        const hasAuditLogging = model.threats.some(
          t => t.category === 'repudiation'
        );
        if (!hasAuditLogging) {
          gaps.push('Missing audit logging considerations');
          compliant = false;
        }
        break;
    }

    return {
      framework,
      status: compliant ? 'compliant' : gaps.length < 3 ? 'partial' : 'non-compliant',
      gaps: gaps.length > 0 ? gaps : undefined
    };
  }
}