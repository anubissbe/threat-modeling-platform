import Ajv from 'ajv';
import * as yaml from 'js-yaml';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ThreatModel } from './types';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export class TMACValidator {
  private static ajv: Ajv;
  private static schema: any;

  /**
   * Initialize validator with schema
   */
  private static async init(): Promise<void> {
    if (this.ajv && this.schema) return;

    this.ajv = new Ajv({ allErrors: true, verbose: true });
    
    // Load schema
    const schemaPath = path.join(__dirname, '../schema/tmac-schema.yaml');
    const schemaContent = await fs.readFile(schemaPath, 'utf-8');
    this.schema = yaml.load(schemaContent);
  }

  /**
   * Validate a threat model
   */
  static async validate(model: ThreatModel): Promise<ValidationResult> {
    await this.init();

    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: []
    };

    // Schema validation
    const valid = this.ajv.validate(this.schema, model);
    if (!valid) {
      result.valid = false;
      result.errors = this.ajv.errors?.map(err => {
        return `${err.instancePath} ${err.message}`;
      }) || [];
    }

    // Business logic validation
    this.validateBusinessLogic(model, result);

    return result;
  }

  /**
   * Validate business logic and best practices
   */
  private static validateBusinessLogic(model: ThreatModel, result: ValidationResult): void {
    // Check component references
    const componentIds = new Set(model.system.components.map(c => c.id));
    
    // Validate data flows reference existing components
    model.dataFlows.forEach(flow => {
      if (!componentIds.has(flow.source)) {
        result.valid = false;
        result.errors.push(`Data flow ${flow.id} references non-existent source component: ${flow.source}`);
      }
      if (!componentIds.has(flow.destination)) {
        result.valid = false;
        result.errors.push(`Data flow ${flow.id} references non-existent destination component: ${flow.destination}`);
      }
    });

    // Validate threats reference existing components
    model.threats.forEach(threat => {
      threat.components.forEach(compId => {
        if (!componentIds.has(compId)) {
          result.valid = false;
          result.errors.push(`Threat ${threat.id} references non-existent component: ${compId}`);
        }
      });
    });

    // Validate trust boundaries reference existing components
    model.system.trustBoundaries?.forEach(boundary => {
      boundary.components.forEach(compId => {
        if (!componentIds.has(compId)) {
          result.valid = false;
          result.errors.push(`Trust boundary ${boundary.id} references non-existent component: ${compId}`);
        }
      });
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
        `Found ${unmitigatedCritical.length} unmitigated critical threats: ${unmitigatedCritical.map(t => t.id).join(', ')}`
      );
    }

    // Check for components without encryption
    const unencryptedComponents = model.system.components.filter(
      c => c.dataClassification !== 'public' && 
           (!c.encryption?.atRest || !c.encryption?.inTransit)
    );
    
    if (unencryptedComponents.length > 0) {
      result.warnings.push(
        `Found ${unencryptedComponents.length} components handling non-public data without full encryption`
      );
    }

    // Check for unauthenticated data flows
    const unauthenticatedFlows = model.dataFlows.filter(
      f => f.dataClassification !== 'public' && !f.authentication
    );
    
    if (unauthenticatedFlows.length > 0) {
      result.warnings.push(
        `Found ${unauthenticatedFlows.length} data flows with non-public data lacking authentication`
      );
    }

    // Validate CVSS scores match severity
    model.threats.forEach(threat => {
      if (threat.cvssScore !== undefined) {
        const expectedSeverity = this.getSeverityFromCVSS(threat.cvssScore);
        if (threat.severity !== expectedSeverity) {
          result.warnings.push(
            `Threat ${threat.id} has mismatched severity. CVSS ${threat.cvssScore} suggests '${expectedSeverity}' but marked as '${threat.severity}'`
          );
        }
      }
    });

    // Check for missing compliance mappings
    if (model.metadata.compliance && model.metadata.compliance.length > 0) {
      const threatsWithoutCompliance = model.threats.filter(
        t => !t.cweId && t.severity !== 'low' && t.severity !== 'info'
      );
      
      if (threatsWithoutCompliance.length > 0) {
        result.warnings.push(
          `${threatsWithoutCompliance.length} medium+ severity threats lack CWE mappings for compliance`
        );
      }
    }
  }

  /**
   * Get severity from CVSS score
   */
  private static getSeverityFromCVSS(score: number): string {
    if (score >= 9.0) return 'critical';
    if (score >= 7.0) return 'high';
    if (score >= 4.0) return 'medium';
    if (score >= 0.1) return 'low';
    return 'info';
  }
}

/**
 * Convenience function for validation
 */
export async function validate(model: any): Promise<ValidationResult> {
  return TMACValidator.validate(model);
}