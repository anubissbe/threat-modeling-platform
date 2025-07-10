// Inline TMAC core functionality to avoid dependency issues
import * as yaml from 'js-yaml';

export interface ThreatModel {
  version: string;
  metadata: {
    name: string;
    description?: string;
    author?: string;
    created?: string;
    updated?: string;
    version?: string;
    tags?: string[];
    compliance?: string[];
  };
  system: {
    name: string;
    description?: string;
    type?: string;
    architecture?: string;
    components: Component[];
    trustBoundaries?: TrustBoundary[];
  };
  dataFlows: DataFlow[];
  threats: Threat[];
  mitigations?: Mitigation[];
  assumptions?: string[];
  outOfScope?: string[];
}

export interface Component {
  id: string;
  name: string;
  type: string;
  description?: string;
  technologies?: string[];
  trustLevel?: string;
  dataClassification?: string;
  encryption?: {
    atRest?: boolean;
    inTransit?: boolean;
  };
}

export interface TrustBoundary {
  id: string;
  name: string;
  components: string[];
  description?: string;
}

export interface DataFlow {
  id: string;
  name: string;
  source: string;
  destination: string;
  protocol?: string;
  data?: string[];
  authentication?: string;
  authorization?: string;
  dataClassification?: string;
}

export interface Threat {
  id: string;
  name: string;
  description: string;
  components: string[];
  category: string;
  severity: string;
  stride?: string[];
  mitre?: {
    tactics?: string[];
    techniques?: string[];
  };
  cvssScore?: number;
  likelihood?: string;
  impact?: string;
  cweId?: string;
  mitigations?: string[];
}

export interface Mitigation {
  id: string;
  name: string;
  description: string;
  type?: string;
  implemented?: boolean;
  threats: string[];
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface AnalysisResult {
  summary: {
    totalComponents: number;
    totalDataFlows: number;
    totalThreats: number;
    totalMitigations: number;
    criticalThreats: number;
    highThreats: number;
    unmitigatedThreats: number;
    coveragePercentage: number;
    riskScore: number;
    complianceScore: number;
    maturityScore: number;
  };
  threats: {
    byCategory: Record<string, number>;
    bySeverity: Record<string, number>;
    byComponent: Record<string, number>;
    emerging: any[];
    aiGenerated: any[];
  };
  mitigations: {
    coverage: number;
    effectiveness: number;
    gaps: string[];
  };
  compliance: {
    frameworks: any;
    controls: any;
    gaps: string[];
  };
  architecture: {
    complexity: number;
    trustBoundaries: any;
    attackSurface: any;
  };
  recommendations: {
    priority: any[];
    architecture: string[];
    security: string[];
    compliance: string[];
  };
  automation: {
    cicd: any;
    monitoring: any;
    response: any;
  };
  metrics: {
    coverageMetrics: any;
    effectivenessMetrics: any;
    maturityMetrics: any;
    riskMetrics: any;
  };
  findings?: Array<{
    type: string;
    severity: string;
    title: string;
    description: string;
  }>;
}

export class TMACParser {
  static parse(content: string, format: 'yaml' | 'json' = 'yaml'): ThreatModel {
    let data: any;
    
    try {
      if (format === 'yaml') {
        data = yaml.load(content);
      } else {
        data = JSON.parse(content);
      }
    } catch (error) {
      throw new Error(`Failed to parse ${format.toUpperCase()} content: ${error}`);
    }

    // Basic validation
    if (!data.version) throw new Error('version is required');
    if (!data.metadata) throw new Error('metadata is required');
    if (!data.system) throw new Error('system is required');
    if (!data.dataFlows) throw new Error('dataFlows is required');
    if (!data.threats) throw new Error('threats is required');

    return data as ThreatModel;
  }

  static stringify(model: ThreatModel, format: 'yaml' | 'json' = 'yaml'): string {
    if (format === 'yaml') {
      return yaml.dump(model, {
        indent: 2,
        lineWidth: 120,
        noRefs: true,
        sortKeys: false
      });
    } else {
      return JSON.stringify(model, null, 2);
    }
  }

  static merge(models: ThreatModel[]): ThreatModel {
    if (models.length === 0) {
      throw new Error('At least one model required for merging');
    }

    const merged = JSON.parse(JSON.stringify(models[0])); // Deep clone

    for (let i = 1; i < models.length; i++) {
      const model = models[i];
      
      // Merge components
      const componentMap = new Map(merged.system.components.map((c: Component) => [c.id, c]));
      model.system.components.forEach(component => {
        if (!componentMap.has(component.id)) {
          merged.system.components.push(component);
        }
      });

      // Merge threats
      const threatMap = new Map(merged.threats.map((t: Threat) => [t.id, t]));
      model.threats.forEach(threat => {
        if (!threatMap.has(threat.id)) {
          merged.threats.push(threat);
        }
      });

      // Merge mitigations
      if (model.mitigations) {
        merged.mitigations = merged.mitigations || [];
        const mitigationMap = new Map(merged.mitigations.map((m: Mitigation) => [m.id, m]));
        model.mitigations.forEach(mitigation => {
          if (!mitigationMap.has(mitigation.id)) {
            merged.mitigations.push(mitigation);
          }
        });
      }
    }

    return merged;
  }
}

export class TMACValidator {
  static async validate(model: ThreatModel): Promise<ValidationResult> {
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: []
    };

    // Basic validation
    if (!model.version) {
      result.valid = false;
      result.errors.push('version is required');
    }

    if (!model.metadata?.name) {
      result.valid = false;
      result.errors.push('metadata.name is required');
    }

    if (!model.system?.name) {
      result.valid = false;
      result.errors.push('system.name is required');
    }

    if (!model.system?.components || model.system.components.length === 0) {
      result.valid = false;
      result.errors.push('at least one system component is required');
    }

    // Business logic validation
    const componentIds = new Set(model.system.components.map(c => c.id));
    
    // Validate data flows reference existing components
    model.dataFlows.forEach(flow => {
      if (!componentIds.has(flow.source)) {
        result.valid = false;
        result.errors.push(`Data flow ${flow.id} references non-existent source: ${flow.source}`);
      }
      if (!componentIds.has(flow.destination)) {
        result.valid = false;
        result.errors.push(`Data flow ${flow.id} references non-existent destination: ${flow.destination}`);
      }
    });

    // Check for unmitigated critical threats
    const mitigatedThreats = new Set(
      model.mitigations?.flatMap(m => m.threats) || []
    );
    
    const unmitigatedCritical = model.threats.filter(
      t => t.severity === 'critical' && !mitigatedThreats.has(t.id)
    );
    
    if (unmitigatedCritical.length > 0) {
      result.warnings.push(
        `Found ${unmitigatedCritical.length} unmitigated critical threats`
      );
    }

    return result;
  }
}

export class TMACAnalyzer {
  static analyze(model: ThreatModel): AnalysisResult {
    const totalComponents = model.system.components.length;
    const totalThreats = model.threats.length;
    const criticalThreats = model.threats.filter(t => t.severity === 'critical').length;
    const highThreats = model.threats.filter(t => t.severity === 'high').length;
    
    const mitigatedThreats = new Set(
      model.mitigations?.flatMap(m => m.threats) || []
    );
    const unmitigatedThreats = model.threats.filter(t => !mitigatedThreats.has(t.id)).length;
    
    const coveragePercentage = totalThreats > 0 ? 
      Math.round(((totalThreats - unmitigatedThreats) / totalThreats) * 100) : 0;
    
    // Simple risk score calculation
    let riskScore = 0;
    riskScore += criticalThreats * 25;
    riskScore += highThreats * 15;
    riskScore += unmitigatedThreats * 10;
    riskScore = Math.min(riskScore, 100);

    const findings: Array<{type: string; severity: string; title: string; description: string}> = [];
    const recommendations: Array<{priority: string; title: string; description: string}> = [];

    // Generate findings
    if (unmitigatedThreats > 0) {
      findings.push({
        type: 'security',
        severity: criticalThreats > 0 ? 'critical' : 'high',
        title: 'Unmitigated Threats Found',
        description: `Found ${unmitigatedThreats} threats without mitigations`
      });
    }

    // Generate recommendations
    if (coveragePercentage < 80) {
      recommendations.push({
        priority: 'high',
        title: 'Improve Threat Coverage',
        description: 'Add mitigations for unaddressed threats to improve security posture'
      });
    }

    if (model.threats.some(t => !t.stride || t.stride.length === 0)) {
      recommendations.push({
        priority: 'medium',
        title: 'Add STRIDE Categories',
        description: 'Categorize threats using STRIDE methodology for better analysis'
      });
    }

    return {
      summary: {
        totalComponents,
        totalDataFlows: 0,
        totalThreats,
        totalMitigations: 0,
        criticalThreats,
        highThreats,
        unmitigatedThreats,
        coveragePercentage,
        riskScore,
        complianceScore: 0,
        maturityScore: 0
      },
      threats: {
        byCategory: {},
        bySeverity: {},
        byComponent: {},
        emerging: [],
        aiGenerated: []
      },
      mitigations: {
        coverage: 0,
        effectiveness: 0,
        gaps: []
      },
      compliance: {
        frameworks: {},
        controls: {},
        gaps: []
      },
      architecture: {
        complexity: 0,
        trustBoundaries: {},
        attackSurface: {}
      },
      recommendations: {
        priority: [],
        architecture: [],
        security: [],
        compliance: []
      },
      automation: {
        cicd: {},
        monitoring: {},
        response: {}
      },
      metrics: {
        coverageMetrics: {},
        effectivenessMetrics: {},
        maturityMetrics: {},
        riskMetrics: {}
      },
      findings
    };
  }
}