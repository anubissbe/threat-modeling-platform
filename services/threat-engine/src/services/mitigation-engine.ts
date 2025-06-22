import {
  IdentifiedThreat,
  MitigationRecommendation,
  Component,
  MitigationCategory,
  MitigationImplementation,
  MitigationCost,
  MitigationEffort,
  MitigationPriority,
  ImplementationStep,
  AlternativeMitigation,
  ThreatCategory,
  ThreatSeverity,
  ComponentType,
} from '../types';
import { logger } from '../utils/logger';
import { generateId } from '../utils/helpers';

interface MitigationRule {
  id: string;
  name: string;
  applicableThreats: ThreatCategory[];
  applicableComponents: ComponentType[];
  conditions: MitigationCondition[];
  mitigationTemplate: MitigationTemplate;
  priority: number;
}

interface MitigationCondition {
  property: string;
  operator: 'equals' | 'contains' | 'not_contains' | 'exists' | 'not_exists';
  value?: any;
}

interface MitigationTemplate {
  title: string;
  description: string;
  category: MitigationCategory;
  implementation: MitigationImplementation;
  effectiveness: number;
  cost: MitigationCost;
  effort: MitigationEffort;
  steps: Omit<ImplementationStep, 'step'>[];
  alternatives: AlternativeMitigation[];
  complianceFrameworks: string[];
}

export class MitigationEngine {
  private mitigationRules: MitigationRule[] = [];

  constructor() {
    this.initializeDefaultRules();
  }

  /**
   * Generate mitigation recommendations for threats
   */
  async generateRecommendations(
    threats: IdentifiedThreat[],
    components: Component[]
  ): Promise<MitigationRecommendation[]> {
    const recommendations: MitigationRecommendation[] = [];
    const processedThreatTypes = new Set<string>();

    for (const threat of threats) {
      // Group similar threats to avoid duplicate recommendations
      const threatKey = `${threat.category}-${threat.affectedComponents.join('-')}`;
      if (processedThreatTypes.has(threatKey)) {
        continue;
      }
      processedThreatTypes.add(threatKey);

      const threatRecommendations = await this.generateThreatRecommendations(threat, components);
      recommendations.push(...threatRecommendations);
    }

    // Sort by priority and effectiveness
    return this.prioritizeRecommendations(recommendations);
  }

  /**
   * Generate recommendations for a specific threat
   */
  async generateThreatRecommendations(
    threat: IdentifiedThreat,
    components: Component[]
  ): Promise<MitigationRecommendation[]> {
    const recommendations: MitigationRecommendation[] = [];
    const affectedComponents = components.filter(c => 
      threat.affectedComponents.includes(c.id)
    );

    // Find applicable mitigation rules
    const applicableRules = this.findApplicableRules(threat, affectedComponents);

    for (const rule of applicableRules) {
      const recommendation = this.createRecommendationFromRule(
        threat,
        affectedComponents,
        rule
      );
      recommendations.push(recommendation);
    }

    // Add general recommendations based on threat category
    const generalRecommendations = this.getGeneralRecommendations(threat, affectedComponents);
    recommendations.push(...generalRecommendations);

    return recommendations;
  }

  private findApplicableRules(
    threat: IdentifiedThreat,
    components: Component[]
  ): MitigationRule[] {
    return this.mitigationRules.filter(rule => {
      // Check if rule applies to threat category
      if (!rule.applicableThreats.includes(threat.category)) {
        return false;
      }

      // Check if rule applies to any affected component
      const hasApplicableComponent = components.some(component =>
        rule.applicableComponents.includes(component.type)
      );
      if (!hasApplicableComponent) {
        return false;
      }

      // Check rule conditions
      return this.evaluateRuleConditions(rule, threat, components);
    });
  }

  private evaluateRuleConditions(
    rule: MitigationRule,
    threat: IdentifiedThreat,
    components: Component[]
  ): boolean {
    return rule.conditions.every(condition =>
      this.evaluateCondition(condition, threat, components)
    );
  }

  private evaluateCondition(
    condition: MitigationCondition,
    threat: IdentifiedThreat,
    components: Component[]
  ): boolean {
    // This is a simplified evaluation - could be enhanced with more sophisticated logic
    for (const component of components) {
      const value = this.getPropertyValue(component, condition.property);
      
      switch (condition.operator) {
        case 'equals':
          if (value === condition.value) return true;
          break;
        case 'contains':
          if (Array.isArray(value) && value.includes(condition.value)) return true;
          if (typeof value === 'string' && value.includes(condition.value)) return true;
          break;
        case 'not_contains':
          if (Array.isArray(value) && !value.includes(condition.value)) return true;
          if (typeof value === 'string' && !value.includes(condition.value)) return true;
          break;
        case 'exists':
          if (value !== undefined) return true;
          break;
        case 'not_exists':
          if (value === undefined) return true;
          break;
      }
    }
    return false;
  }

  private getPropertyValue(component: Component, property: string): any {
    const keys = property.split('.');
    let value: any = component;

    for (const key of keys) {
      if (value && typeof value === 'object') {
        value = value[key];
      } else {
        return undefined;
      }
    }

    return value;
  }

  private createRecommendationFromRule(
    threat: IdentifiedThreat,
    components: Component[],
    rule: MitigationRule
  ): MitigationRecommendation {
    const template = rule.mitigationTemplate;
    
    // Customize mitigation based on threat and components
    const componentNames = components.map(c => c.name).join(', ');
    const title = template.title.replace('{components}', componentNames);
    const description = template.description.replace('{components}', componentNames);

    // Calculate priority based on threat severity and mitigation effectiveness
    const priority = this.calculateMitigationPriority(threat, template.effectiveness);

    // Create implementation steps with proper numbering
    const steps: ImplementationStep[] = template.steps.map((step, index) => ({
      step: index + 1,
      description: step.description.replace('{components}', componentNames),
      estimatedHours: step.estimatedHours,
      dependencies: step.dependencies,
    }));

    return {
      id: generateId(),
      title,
      description,
      category: template.category,
      implementation: template.implementation,
      applicableThreats: [threat.id],
      effectiveness: template.effectiveness,
      cost: template.cost,
      effort: template.effort,
      priority,
      steps,
      alternatives: template.alternatives,
      complianceFrameworks: template.complianceFrameworks,
    };
  }

  private calculateMitigationPriority(
    threat: IdentifiedThreat,
    effectiveness: number
  ): MitigationPriority {
    const severityWeight = {
      [ThreatSeverity.CRITICAL]: 4,
      [ThreatSeverity.HIGH]: 3,
      [ThreatSeverity.MEDIUM]: 2,
      [ThreatSeverity.LOW]: 1,
    };

    const score = severityWeight[threat.severity] * effectiveness;

    if (score >= 3.2) return MitigationPriority.IMMEDIATE;
    if (score >= 2.4) return MitigationPriority.HIGH;
    if (score >= 1.6) return MitigationPriority.MEDIUM;
    return MitigationPriority.LOW;
  }

  private getGeneralRecommendations(
    threat: IdentifiedThreat,
    components: Component[]
  ): MitigationRecommendation[] {
    const recommendations: MitigationRecommendation[] = [];

    // Add category-specific general recommendations
    switch (threat.category) {
      case ThreatCategory.SPOOFING:
        recommendations.push(...this.getSpoofingRecommendations(threat, components));
        break;
      case ThreatCategory.TAMPERING:
        recommendations.push(...this.getTamperingRecommendations(threat, components));
        break;
      case ThreatCategory.REPUDIATION:
        recommendations.push(...this.getRepudiationRecommendations(threat, components));
        break;
      case ThreatCategory.INFORMATION_DISCLOSURE:
        recommendations.push(...this.getInformationDisclosureRecommendations(threat, components));
        break;
      case ThreatCategory.DENIAL_OF_SERVICE:
        recommendations.push(...this.getDenialOfServiceRecommendations(threat, components));
        break;
      case ThreatCategory.ELEVATION_OF_PRIVILEGE:
        recommendations.push(...this.getElevationOfPrivilegeRecommendations(threat, components));
        break;
    }

    return recommendations;
  }

  private getSpoofingRecommendations(
    threat: IdentifiedThreat,
    components: Component[]
  ): MitigationRecommendation[] {
    return [
      {
        id: generateId(),
        title: 'Implement Strong Authentication',
        description: 'Deploy multi-factor authentication to prevent identity spoofing attacks.',
        category: MitigationCategory.PREVENTIVE,
        implementation: MitigationImplementation.TECHNICAL,
        applicableThreats: [threat.id],
        effectiveness: 0.85,
        cost: MitigationCost.MEDIUM,
        effort: MitigationEffort.MEDIUM,
        priority: this.calculateMitigationPriority(threat, 0.85),
        steps: [
          {
            step: 1,
            description: 'Assess current authentication mechanisms',
            estimatedHours: 4,
            dependencies: [],
          },
          {
            step: 2,
            description: 'Design MFA implementation strategy',
            estimatedHours: 8,
            dependencies: ['Step 1'],
          },
          {
            step: 3,
            description: 'Implement MFA solution',
            estimatedHours: 16,
            dependencies: ['Step 2'],
          },
          {
            step: 4,
            description: 'Test and validate MFA functionality',
            estimatedHours: 8,
            dependencies: ['Step 3'],
          },
        ],
        alternatives: [
          {
            title: 'Certificate-based Authentication',
            description: 'Use digital certificates for strong authentication',
            effectiveness: 0.90,
            cost: MitigationCost.HIGH,
            effort: MitigationEffort.HIGH,
          },
        ],
        complianceFrameworks: ['NIST', 'ISO 27001', 'PCI DSS'],
      },
    ];
  }

  private getTamperingRecommendations(
    threat: IdentifiedThreat,
    components: Component[]
  ): MitigationRecommendation[] {
    return [
      {
        id: generateId(),
        title: 'Implement Data Integrity Controls',
        description: 'Deploy checksums, digital signatures, and integrity monitoring to detect tampering.',
        category: MitigationCategory.DETECTIVE,
        implementation: MitigationImplementation.TECHNICAL,
        applicableThreats: [threat.id],
        effectiveness: 0.80,
        cost: MitigationCost.MEDIUM,
        effort: MitigationEffort.MEDIUM,
        priority: this.calculateMitigationPriority(threat, 0.80),
        steps: [
          {
            step: 1,
            description: 'Identify critical data requiring integrity protection',
            estimatedHours: 6,
            dependencies: [],
          },
          {
            step: 2,
            description: 'Implement checksum validation',
            estimatedHours: 12,
            dependencies: ['Step 1'],
          },
          {
            step: 3,
            description: 'Deploy integrity monitoring system',
            estimatedHours: 16,
            dependencies: ['Step 2'],
          },
        ],
        alternatives: [
          {
            title: 'Blockchain-based Integrity',
            description: 'Use blockchain technology for tamper-evident records',
            effectiveness: 0.95,
            cost: MitigationCost.VERY_HIGH,
            effort: MitigationEffort.VERY_HIGH,
          },
        ],
        complianceFrameworks: ['NIST', 'ISO 27001'],
      },
    ];
  }

  private getRepudiationRecommendations(
    threat: IdentifiedThreat,
    components: Component[]
  ): MitigationRecommendation[] {
    return [
      {
        id: generateId(),
        title: 'Implement Comprehensive Audit Logging',
        description: 'Deploy detailed audit logs with digital signatures to prevent repudiation.',
        category: MitigationCategory.DETECTIVE,
        implementation: MitigationImplementation.TECHNICAL,
        applicableThreats: [threat.id],
        effectiveness: 0.75,
        cost: MitigationCost.LOW,
        effort: MitigationEffort.MEDIUM,
        priority: this.calculateMitigationPriority(threat, 0.75),
        steps: [
          {
            step: 1,
            description: 'Design audit logging strategy',
            estimatedHours: 8,
            dependencies: [],
          },
          {
            step: 2,
            description: 'Implement centralized logging system',
            estimatedHours: 20,
            dependencies: ['Step 1'],
          },
          {
            step: 3,
            description: 'Add digital signatures to log entries',
            estimatedHours: 12,
            dependencies: ['Step 2'],
          },
        ],
        alternatives: [],
        complianceFrameworks: ['SOX', 'GDPR', 'HIPAA'],
      },
    ];
  }

  private getInformationDisclosureRecommendations(
    threat: IdentifiedThreat,
    components: Component[]
  ): MitigationRecommendation[] {
    return [
      {
        id: generateId(),
        title: 'Implement Data Encryption',
        description: 'Deploy encryption for data at rest and in transit to prevent information disclosure.',
        category: MitigationCategory.PREVENTIVE,
        implementation: MitigationImplementation.TECHNICAL,
        applicableThreats: [threat.id],
        effectiveness: 0.90,
        cost: MitigationCost.MEDIUM,
        effort: MitigationEffort.MEDIUM,
        priority: this.calculateMitigationPriority(threat, 0.90),
        steps: [
          {
            step: 1,
            description: 'Classify data sensitivity levels',
            estimatedHours: 8,
            dependencies: [],
          },
          {
            step: 2,
            description: 'Select appropriate encryption algorithms',
            estimatedHours: 4,
            dependencies: ['Step 1'],
          },
          {
            step: 3,
            description: 'Implement encryption at rest',
            estimatedHours: 16,
            dependencies: ['Step 2'],
          },
          {
            step: 4,
            description: 'Implement encryption in transit',
            estimatedHours: 12,
            dependencies: ['Step 2'],
          },
        ],
        alternatives: [
          {
            title: 'Data Masking',
            description: 'Use data masking for non-production environments',
            effectiveness: 0.60,
            cost: MitigationCost.LOW,
            effort: MitigationEffort.LOW,
          },
        ],
        complianceFrameworks: ['GDPR', 'HIPAA', 'PCI DSS'],
      },
    ];
  }

  private getDenialOfServiceRecommendations(
    threat: IdentifiedThreat,
    components: Component[]
  ): MitigationRecommendation[] {
    return [
      {
        id: generateId(),
        title: 'Implement Rate Limiting and DDoS Protection',
        description: 'Deploy rate limiting, load balancing, and DDoS protection to maintain availability.',
        category: MitigationCategory.PREVENTIVE,
        implementation: MitigationImplementation.TECHNICAL,
        applicableThreats: [threat.id],
        effectiveness: 0.70,
        cost: MitigationCost.MEDIUM,
        effort: MitigationEffort.MEDIUM,
        priority: this.calculateMitigationPriority(threat, 0.70),
        steps: [
          {
            step: 1,
            description: 'Analyze traffic patterns and capacity requirements',
            estimatedHours: 8,
            dependencies: [],
          },
          {
            step: 2,
            description: 'Implement rate limiting mechanisms',
            estimatedHours: 12,
            dependencies: ['Step 1'],
          },
          {
            step: 3,
            description: 'Deploy load balancing solution',
            estimatedHours: 16,
            dependencies: ['Step 1'],
          },
          {
            step: 4,
            description: 'Configure DDoS protection service',
            estimatedHours: 8,
            dependencies: ['Step 3'],
          },
        ],
        alternatives: [
          {
            title: 'CDN-based Protection',
            description: 'Use Content Delivery Network for DDoS mitigation',
            effectiveness: 0.80,
            cost: MitigationCost.HIGH,
            effort: MitigationEffort.LOW,
          },
        ],
        complianceFrameworks: ['NIST'],
      },
    ];
  }

  private getElevationOfPrivilegeRecommendations(
    threat: IdentifiedThreat,
    components: Component[]
  ): MitigationRecommendation[] {
    return [
      {
        id: generateId(),
        title: 'Implement Principle of Least Privilege',
        description: 'Deploy role-based access controls and minimize privileges to prevent escalation.',
        category: MitigationCategory.PREVENTIVE,
        implementation: MitigationImplementation.OPERATIONAL,
        applicableThreats: [threat.id],
        effectiveness: 0.85,
        cost: MitigationCost.MEDIUM,
        effort: MitigationEffort.HIGH,
        priority: this.calculateMitigationPriority(threat, 0.85),
        steps: [
          {
            step: 1,
            description: 'Audit current privilege assignments',
            estimatedHours: 16,
            dependencies: [],
          },
          {
            step: 2,
            description: 'Design role-based access control model',
            estimatedHours: 20,
            dependencies: ['Step 1'],
          },
          {
            step: 3,
            description: 'Implement RBAC system',
            estimatedHours: 32,
            dependencies: ['Step 2'],
          },
          {
            step: 4,
            description: 'Deploy privilege monitoring and alerting',
            estimatedHours: 12,
            dependencies: ['Step 3'],
          },
        ],
        alternatives: [
          {
            title: 'Attribute-based Access Control (ABAC)',
            description: 'Use fine-grained attribute-based access controls',
            effectiveness: 0.90,
            cost: MitigationCost.HIGH,
            effort: MitigationEffort.VERY_HIGH,
          },
        ],
        complianceFrameworks: ['NIST', 'ISO 27001', 'SOX'],
      },
    ];
  }

  private prioritizeRecommendations(
    recommendations: MitigationRecommendation[]
  ): MitigationRecommendation[] {
    const priorityWeight = {
      [MitigationPriority.IMMEDIATE]: 4,
      [MitigationPriority.HIGH]: 3,
      [MitigationPriority.MEDIUM]: 2,
      [MitigationPriority.LOW]: 1,
    };

    return recommendations.sort((a, b) => {
      const aPriority = priorityWeight[a.priority];
      const bPriority = priorityWeight[b.priority];
      
      if (aPriority !== bPriority) {
        return bPriority - aPriority; // Higher priority first
      }
      
      // If same priority, sort by effectiveness
      return b.effectiveness - a.effectiveness;
    });
  }

  private initializeDefaultRules(): void {
    // Initialize with some default mitigation rules
    this.mitigationRules = [
      {
        id: 'web-input-validation',
        name: 'Web Application Input Validation',
        applicableThreats: [ThreatCategory.TAMPERING],
        applicableComponents: [ComponentType.PROCESS],
        conditions: [
          {
            property: 'properties.protocols',
            operator: 'contains',
            value: 'http',
          },
        ],
        mitigationTemplate: {
          title: 'Implement Input Validation for {components}',
          description: 'Deploy comprehensive input validation to prevent injection attacks on {components}.',
          category: MitigationCategory.PREVENTIVE,
          implementation: MitigationImplementation.TECHNICAL,
          effectiveness: 0.80,
          cost: MitigationCost.LOW,
          effort: MitigationEffort.MEDIUM,
          steps: [
            {
              description: 'Identify all input points in {components}',
              estimatedHours: 8,
              dependencies: [],
            },
            {
              description: 'Implement server-side validation',
              estimatedHours: 16,
              dependencies: ['Input analysis'],
            },
            {
              description: 'Add client-side validation for user experience',
              estimatedHours: 8,
              dependencies: ['Server-side validation'],
            },
          ],
          alternatives: [
            {
              title: 'Web Application Firewall (WAF)',
              description: 'Deploy WAF for automated input filtering',
              effectiveness: 0.70,
              cost: MitigationCost.MEDIUM,
              effort: MitigationEffort.LOW,
            },
          ],
          complianceFrameworks: ['OWASP', 'PCI DSS'],
        },
        priority: 1,
      },
    ];

    logger.info('Default mitigation rules initialized', { 
      ruleCount: this.mitigationRules.length 
    });
  }
}