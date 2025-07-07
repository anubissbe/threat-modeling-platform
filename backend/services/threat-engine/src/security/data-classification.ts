/**
 * Data Classification Service for Threat Models
 * Implements security controls based on data sensitivity
 */

export enum DataClassification {
  PUBLIC = 'PUBLIC',
  INTERNAL = 'INTERNAL',
  CONFIDENTIAL = 'CONFIDENTIAL',
  RESTRICTED = 'RESTRICTED',
  TOP_SECRET = 'TOP_SECRET',
}

export interface ClassificationPolicy {
  level: DataClassification;
  encryptionRequired: boolean;
  accessControls: string[];
  auditingRequired: boolean;
  retentionDays: number;
  allowedRegions?: string[];
  requiresMFA?: boolean;
  requiresApproval?: boolean;
}

export class DataClassificationService {
  private policies: Map<DataClassification, ClassificationPolicy> = new Map([
    [DataClassification.PUBLIC, {
      level: DataClassification.PUBLIC,
      encryptionRequired: false,
      accessControls: ['read:public'],
      auditingRequired: false,
      retentionDays: 365,
    }],
    [DataClassification.INTERNAL, {
      level: DataClassification.INTERNAL,
      encryptionRequired: true,
      accessControls: ['read:internal', 'write:internal'],
      auditingRequired: true,
      retentionDays: 730,
    }],
    [DataClassification.CONFIDENTIAL, {
      level: DataClassification.CONFIDENTIAL,
      encryptionRequired: true,
      accessControls: ['read:confidential', 'write:confidential'],
      auditingRequired: true,
      retentionDays: 1825, // 5 years
      requiresMFA: true,
    }],
    [DataClassification.RESTRICTED, {
      level: DataClassification.RESTRICTED,
      encryptionRequired: true,
      accessControls: ['read:restricted', 'write:restricted'],
      auditingRequired: true,
      retentionDays: 2555, // 7 years
      requiresMFA: true,
      requiresApproval: true,
      allowedRegions: ['us-east-1', 'eu-west-1'],
    }],
    [DataClassification.TOP_SECRET, {
      level: DataClassification.TOP_SECRET,
      encryptionRequired: true,
      accessControls: ['read:top-secret', 'write:top-secret'],
      auditingRequired: true,
      retentionDays: 3650, // 10 years
      requiresMFA: true,
      requiresApproval: true,
      allowedRegions: ['us-east-1'],
    }],
  ]);

  /**
   * Classify threat model data based on content
   */
  classifyThreatModel(threatModel: any): DataClassification {
    // Check for sensitive patterns
    const content = JSON.stringify(threatModel).toLowerCase();
    
    // Top Secret indicators
    if (this.containsTopSecretIndicators(content)) {
      return DataClassification.TOP_SECRET;
    }
    
    // Restricted indicators
    if (this.containsRestrictedIndicators(content)) {
      return DataClassification.RESTRICTED;
    }
    
    // Confidential indicators
    if (this.containsConfidentialIndicators(content)) {
      return DataClassification.CONFIDENTIAL;
    }
    
    // Internal by default for authenticated content
    if (threatModel.organizationId) {
      return DataClassification.INTERNAL;
    }
    
    return DataClassification.PUBLIC;
  }

  /**
   * Get security policy for classification level
   */
  getPolicy(classification: DataClassification): ClassificationPolicy {
    return this.policies.get(classification) || this.policies.get(DataClassification.INTERNAL)!;
  }

  /**
   * Check if user has access to classified data
   */
  hasAccess(
    userPermissions: string[],
    classification: DataClassification,
    operation: 'read' | 'write'
  ): boolean {
    const policy = this.getPolicy(classification);
    const requiredPermission = `${operation}:${classification.toLowerCase()}`;
    
    return userPermissions.some(perm => 
      policy.accessControls.includes(perm) || 
      perm === requiredPermission ||
      perm === 'admin:all'
    );
  }

  /**
   * Apply security controls based on classification
   */
  applySecurityControls(data: any, classification: DataClassification): {
    encrypted: boolean;
    maskedFields: string[];
    metadata: any;
  } {
    const policy = this.getPolicy(classification);
    const maskedFields: string[] = [];
    
    // Mask sensitive fields for lower privilege users
    if (classification >= DataClassification.CONFIDENTIAL) {
      maskedFields.push(...this.identifySensitiveFields(data));
    }
    
    return {
      encrypted: policy.encryptionRequired,
      maskedFields,
      metadata: {
        classification,
        classifiedAt: new Date(),
        policy: policy.level,
        retentionDate: this.calculateRetentionDate(policy.retentionDays),
      },
    };
  }

  /**
   * Validate data handling compliance
   */
  validateCompliance(
    data: any,
    classification: DataClassification,
    context: {
      region?: string;
      hasMFA?: boolean;
      hasApproval?: boolean;
    }
  ): { compliant: boolean; violations: string[] } {
    const policy = this.getPolicy(classification);
    const violations: string[] = [];
    
    // Check region compliance
    if (policy.allowedRegions && context.region) {
      if (!policy.allowedRegions.includes(context.region)) {
        violations.push(`Data classified as ${classification} cannot be stored in region ${context.region}`);
      }
    }
    
    // Check MFA requirement
    if (policy.requiresMFA && !context.hasMFA) {
      violations.push(`MFA required for ${classification} data access`);
    }
    
    // Check approval requirement
    if (policy.requiresApproval && !context.hasApproval) {
      violations.push(`Approval required for ${classification} data access`);
    }
    
    return {
      compliant: violations.length === 0,
      violations,
    };
  }

  private containsTopSecretIndicators(content: string): boolean {
    const indicators = [
      'top secret',
      'classified',
      'eyes only',
      'nuclear',
      'weapon',
      'defense',
      'military',
    ];
    
    return indicators.some(indicator => content.includes(indicator));
  }

  private containsRestrictedIndicators(content: string): boolean {
    const indicators = [
      'restricted',
      'highly sensitive',
      'proprietary',
      'trade secret',
      'competitive advantage',
      'merger',
      'acquisition',
    ];
    
    return indicators.some(indicator => content.includes(indicator));
  }

  private containsConfidentialIndicators(content: string): boolean {
    const indicators = [
      'confidential',
      'sensitive',
      'private',
      'personal',
      'financial',
      'health',
      'pii',
      'credit card',
      'ssn',
      'passport',
    ];
    
    return indicators.some(indicator => content.includes(indicator));
  }

  private identifySensitiveFields(data: any): string[] {
    const sensitivePatterns = [
      /password/i,
      /secret/i,
      /token/i,
      /key/i,
      /credential/i,
      /ssn/i,
      /credit_?card/i,
      /account_?number/i,
      /routing_?number/i,
      /api_?key/i,
    ];
    
    const sensitiveFields: string[] = [];
    
    const checkObject = (obj: any, path: string = '') => {
      for (const key in obj) {
        const fullPath = path ? `${path}.${key}` : key;
        
        if (sensitivePatterns.some(pattern => pattern.test(key))) {
          sensitiveFields.push(fullPath);
        }
        
        if (typeof obj[key] === 'object' && obj[key] !== null) {
          checkObject(obj[key], fullPath);
        }
      }
    };
    
    checkObject(data);
    return sensitiveFields;
  }

  private calculateRetentionDate(days: number): Date {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date;
  }

  /**
   * Generate classification report
   */
  generateClassificationReport(threatModels: any[]): {
    summary: Record<DataClassification, number>;
    details: any[];
    recommendations: string[];
  } {
    const summary: Record<DataClassification, number> = {
      [DataClassification.PUBLIC]: 0,
      [DataClassification.INTERNAL]: 0,
      [DataClassification.CONFIDENTIAL]: 0,
      [DataClassification.RESTRICTED]: 0,
      [DataClassification.TOP_SECRET]: 0,
    };
    
    const details = threatModels.map(model => {
      const classification = this.classifyThreatModel(model);
      summary[classification]++;
      
      return {
        id: model.id,
        name: model.name,
        classification,
        policy: this.getPolicy(classification),
      };
    });
    
    const recommendations: string[] = [];
    
    if (summary[DataClassification.TOP_SECRET] > 0) {
      recommendations.push('Implement air-gapped storage for TOP SECRET threat models');
    }
    
    if (summary[DataClassification.RESTRICTED] > 0) {
      recommendations.push('Enable geo-fencing for RESTRICTED data access');
    }
    
    if (summary[DataClassification.CONFIDENTIAL] > 10) {
      recommendations.push('Consider implementing automated classification scanning');
    }
    
    return { summary, details, recommendations };
  }
}

// Export singleton instance
export const dataClassificationService = new DataClassificationService();