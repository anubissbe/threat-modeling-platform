import {
  Component,
  IdentifiedThreat,
  ThreatPattern,
  StrideCategory,
  ThreatCategory,
  ThreatSeverity,
  ThreatLikelihood,
  ThreatImpact,
  ThreatSource,
  ComponentType,
  PatternCondition,
  ConditionType,
  ConditionOperator,
  AttackComplexity,
} from '../types';
import { logger } from '../utils/logger';
import { generateId, calculateRiskScore } from '../utils/helpers';

export class ThreatPatternMatcher {
  private patterns: ThreatPattern[] = [];

  constructor() {
    this.initializeDefaultPatterns();
  }

  /**
   * Find threats for a component using pattern matching
   */
  async findThreats(component: Component, category?: StrideCategory): Promise<IdentifiedThreat[]> {
    const threats: IdentifiedThreat[] = [];
    const applicablePatterns = this.getApplicablePatterns(component, category);

    for (const pattern of applicablePatterns) {
      const confidence = this.calculatePatternConfidence(component, pattern);
      
      if (confidence >= 0.6) { // Minimum confidence threshold
        const threat = this.createThreatFromPattern(component, pattern, confidence);
        threats.push(threat);
        
        logger.debug('Pattern matched', {
          componentId: component.id,
          patternId: pattern.id,
          confidence,
        });
      }
    }

    return threats;
  }

  /**
   * Add custom pattern to the matcher
   */
  addPattern(pattern: ThreatPattern): void {
    this.patterns.push(pattern);
    logger.info('Custom pattern added', { patternId: pattern.id });
  }

  /**
   * Remove pattern from the matcher
   */
  removePattern(patternId: string): boolean {
    const initialLength = this.patterns.length;
    this.patterns = this.patterns.filter(p => p.id !== patternId);
    return this.patterns.length < initialLength;
  }

  /**
   * Update existing pattern
   */
  updatePattern(patternId: string, updates: Partial<ThreatPattern>): boolean {
    const patternIndex = this.patterns.findIndex(p => p.id === patternId);
    if (patternIndex === -1) return false;

    this.patterns[patternIndex] = { ...this.patterns[patternIndex], ...updates };
    return true;
  }

  /**
   * Get all patterns
   */
  getPatterns(): ThreatPattern[] {
    return [...this.patterns];
  }

  private getApplicablePatterns(component: Component, category?: StrideCategory): ThreatPattern[] {
    return this.patterns.filter(pattern => {
      // Check if pattern applies to component type
      if (!pattern.applicableComponents.includes(component.type)) {
        return false;
      }

      // Check if pattern matches the requested category
      if (category && pattern.category !== this.strideToCategoryMap(category)) {
        return false;
      }

      // Check if pattern conditions are potentially matchable
      return this.hasMatchableConditions(component, pattern);
    });
  }

  private hasMatchableConditions(component: Component, pattern: ThreatPattern): boolean {
    // Quick pre-filter to avoid expensive condition checking
    // This is a basic heuristic that can be enhanced
    return pattern.conditions.length === 0 || 
           pattern.conditions.some(condition => 
             this.couldConditionMatch(component, condition)
           );
  }

  private couldConditionMatch(component: Component, condition: PatternCondition): boolean {
    switch (condition.type) {
      case ConditionType.COMPONENT_PROPERTY:
        return this.hasComponentProperty(component, condition.property);
      case ConditionType.RELATIONSHIP:
        return true; // Would need relationship data to properly evaluate
      default:
        return true;
    }
  }

  private hasComponentProperty(component: Component, property: string): boolean {
    const properties = component.properties as any;
    return properties && properties[property] !== undefined;
  }

  private calculatePatternConfidence(component: Component, pattern: ThreatPattern): number {
    let totalWeight = 0;
    let matchedWeight = 0;

    for (const condition of pattern.conditions) {
      totalWeight += condition.weight;
      
      if (this.evaluateCondition(component, condition)) {
        matchedWeight += condition.weight;
      }
    }

    // If no conditions, return base confidence
    if (totalWeight === 0) {
      return pattern.confidence;
    }

    // Calculate match ratio and combine with pattern confidence
    const matchRatio = matchedWeight / totalWeight;
    return matchRatio * pattern.confidence;
  }

  private evaluateCondition(component: Component, condition: PatternCondition): boolean {
    switch (condition.type) {
      case ConditionType.COMPONENT_PROPERTY:
        return this.evaluateComponentPropertyCondition(component, condition);
      case ConditionType.DATA_FLOW_PROPERTY:
        // Would need data flow context for full evaluation
        return false;
      case ConditionType.RELATIONSHIP:
        // Would need relationship context for full evaluation
        return false;
      case ConditionType.SECURITY_REQUIREMENT:
        // Would need security requirements context for full evaluation
        return false;
      default:
        return false;
    }
  }

  private evaluateComponentPropertyCondition(component: Component, condition: PatternCondition): boolean {
    const propertyValue = this.getComponentPropertyValue(component, condition.property);
    
    if (propertyValue === undefined) {
      return condition.operator === ConditionOperator.NOT_EXISTS;
    }

    switch (condition.operator) {
      case ConditionOperator.EQUALS:
        return propertyValue === condition.value;
      case ConditionOperator.NOT_EQUALS:
        return propertyValue !== condition.value;
      case ConditionOperator.CONTAINS:
        return Array.isArray(propertyValue) 
          ? propertyValue.includes(condition.value)
          : String(propertyValue).includes(String(condition.value));
      case ConditionOperator.NOT_CONTAINS:
        return Array.isArray(propertyValue)
          ? !propertyValue.includes(condition.value)
          : !String(propertyValue).includes(String(condition.value));
      case ConditionOperator.GREATER_THAN:
        return Number(propertyValue) > Number(condition.value);
      case ConditionOperator.LESS_THAN:
        return Number(propertyValue) < Number(condition.value);
      case ConditionOperator.EXISTS:
        return true; // Already checked above
      case ConditionOperator.NOT_EXISTS:
        return false; // Already checked above
      default:
        return false;
    }
  }

  private getComponentPropertyValue(component: Component, property: string): any {
    // Handle nested property access like 'properties.sensitive'
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

  private createThreatFromPattern(
    component: Component, 
    pattern: ThreatPattern, 
    confidence: number
  ): IdentifiedThreat {
    const template = pattern.threatTemplate;
    
    // Customize threat based on component
    const title = template.title.replace('{component}', component.name);
    const description = template.description.replace('{component}', component.name);

    const riskScore = calculateRiskScore(template.severity, template.likelihood);

    return {
      id: generateId(),
      title,
      description,
      category: template.category,
      strideCategories: template.strideCategories,
      severity: template.severity,
      likelihood: template.likelihood,
      impact: template.impact,
      riskScore,
      affectedComponents: [component.id],
      affectedDataFlows: [],
      attackVectors: template.attackVectors,
      prerequisites: [],
      securityRequirements: [],
      confidence,
      source: ThreatSource.PATTERN_MATCHING,
    };
  }

  private strideToCategoryMap(stride: StrideCategory): ThreatCategory {
    switch (stride) {
      case StrideCategory.SPOOFING:
        return ThreatCategory.SPOOFING;
      case StrideCategory.TAMPERING:
        return ThreatCategory.TAMPERING;
      case StrideCategory.REPUDIATION:
        return ThreatCategory.REPUDIATION;
      case StrideCategory.INFORMATION_DISCLOSURE:
        return ThreatCategory.INFORMATION_DISCLOSURE;
      case StrideCategory.DENIAL_OF_SERVICE:
        return ThreatCategory.DENIAL_OF_SERVICE;
      case StrideCategory.ELEVATION_OF_PRIVILEGE:
        return ThreatCategory.ELEVATION_OF_PRIVILEGE;
      default:
        return ThreatCategory.SPOOFING;
    }
  }

  private initializeDefaultPatterns(): void {
    // Web Application Patterns
    this.patterns.push({
      id: 'web-sql-injection',
      name: 'SQL Injection in Web Application',
      description: 'Web applications without proper input validation are vulnerable to SQL injection',
      category: ThreatCategory.TAMPERING,
      applicableComponents: [ComponentType.PROCESS],
      conditions: [
        {
          type: ConditionType.COMPONENT_PROPERTY,
          property: 'properties.protocols',
          operator: ConditionOperator.CONTAINS,
          value: 'http',
          weight: 0.4,
        },
        {
          type: ConditionType.COMPONENT_PROPERTY,
          property: 'properties.internetFacing',
          operator: ConditionOperator.EQUALS,
          value: true,
          weight: 0.3,
        },
        {
          type: ConditionType.COMPONENT_PROPERTY,
          property: 'properties.authentication',
          operator: ConditionOperator.NOT_CONTAINS,
          value: 'input_validation',
          weight: 0.3,
        },
      ],
      threatTemplate: {
        title: 'SQL Injection in {component}',
        description: 'The web application {component} may be vulnerable to SQL injection attacks due to insufficient input validation.',
        category: ThreatCategory.TAMPERING,
        strideCategories: [StrideCategory.TAMPERING, StrideCategory.INFORMATION_DISCLOSURE],
        severity: ThreatSeverity.HIGH,
        likelihood: ThreatLikelihood.MEDIUM,
        impact: ThreatImpact.HIGH,
        attackVectors: [
          {
            vector: 'Malicious SQL queries through user input',
            complexity: AttackComplexity.MEDIUM,
            requirements: ['Web application access', 'Knowledge of SQL'],
            mitigations: ['Parameterized queries', 'Input validation', 'Stored procedures'],
          },
        ],
        mitigationSuggestions: [
          'Implement parameterized queries',
          'Add comprehensive input validation',
          'Use stored procedures where possible',
          'Apply principle of least privilege to database connections',
        ],
      },
      confidence: 0.85,
      lastUpdated: new Date(),
    });

    this.patterns.push({
      id: 'web-xss',
      name: 'Cross-Site Scripting (XSS)',
      description: 'Web applications without output encoding are vulnerable to XSS attacks',
      category: ThreatCategory.TAMPERING,
      applicableComponents: [ComponentType.PROCESS],
      conditions: [
        {
          type: ConditionType.COMPONENT_PROPERTY,
          property: 'properties.protocols',
          operator: ConditionOperator.CONTAINS,
          value: 'http',
          weight: 0.4,
        },
        {
          type: ConditionType.COMPONENT_PROPERTY,
          property: 'properties.internetFacing',
          operator: ConditionOperator.EQUALS,
          value: true,
          weight: 0.3,
        },
        {
          type: ConditionType.COMPONENT_PROPERTY,
          property: 'properties.authentication',
          operator: ConditionOperator.NOT_CONTAINS,
          value: 'output_encoding',
          weight: 0.3,
        },
      ],
      threatTemplate: {
        title: 'Cross-Site Scripting (XSS) in {component}',
        description: 'The web application {component} may be vulnerable to XSS attacks due to insufficient output encoding.',
        category: ThreatCategory.TAMPERING,
        strideCategories: [StrideCategory.TAMPERING, StrideCategory.INFORMATION_DISCLOSURE],
        severity: ThreatSeverity.MEDIUM,
        likelihood: ThreatLikelihood.MEDIUM,
        impact: ThreatImpact.MEDIUM,
        attackVectors: [
          {
            vector: 'Malicious scripts injected into web pages',
            complexity: AttackComplexity.LOW,
            requirements: ['Web application access'],
            mitigations: ['Output encoding', 'Content Security Policy', 'Input validation'],
          },
        ],
        mitigationSuggestions: [
          'Implement proper output encoding',
          'Use Content Security Policy (CSP)',
          'Validate and sanitize all user inputs',
          'Use secure coding practices',
        ],
      },
      confidence: 0.80,
      lastUpdated: new Date(),
    });

    // Database Patterns
    this.patterns.push({
      id: 'db-unauthorized-access',
      name: 'Unauthorized Database Access',
      description: 'Databases without proper authentication are vulnerable to unauthorized access',
      category: ThreatCategory.SPOOFING,
      applicableComponents: [ComponentType.DATA_STORE],
      conditions: [
        {
          type: ConditionType.COMPONENT_PROPERTY,
          property: 'properties.authentication',
          operator: ConditionOperator.CONTAINS,
          value: 'none',
          weight: 0.6,
        },
        {
          type: ConditionType.COMPONENT_PROPERTY,
          property: 'properties.sensitive',
          operator: ConditionOperator.EQUALS,
          value: true,
          weight: 0.4,
        },
      ],
      threatTemplate: {
        title: 'Unauthorized Access to {component}',
        description: 'The database {component} lacks proper authentication controls, allowing unauthorized access to sensitive data.',
        category: ThreatCategory.SPOOFING,
        strideCategories: [StrideCategory.SPOOFING, StrideCategory.INFORMATION_DISCLOSURE],
        severity: ThreatSeverity.CRITICAL,
        likelihood: ThreatLikelihood.HIGH,
        impact: ThreatImpact.VERY_HIGH,
        attackVectors: [
          {
            vector: 'Direct database connection without authentication',
            complexity: AttackComplexity.LOW,
            requirements: ['Network access to database'],
            mitigations: ['Strong authentication', 'Network segmentation', 'Access controls'],
          },
        ],
        mitigationSuggestions: [
          'Implement strong database authentication',
          'Use role-based access controls',
          'Enable database auditing',
          'Implement network segmentation',
        ],
      },
      confidence: 0.95,
      lastUpdated: new Date(),
    });

    this.patterns.push({
      id: 'db-data-exposure',
      name: 'Sensitive Data Exposure in Database',
      description: 'Databases with sensitive data but no encryption are vulnerable to data exposure',
      category: ThreatCategory.INFORMATION_DISCLOSURE,
      applicableComponents: [ComponentType.DATA_STORE],
      conditions: [
        {
          type: ConditionType.COMPONENT_PROPERTY,
          property: 'properties.sensitive',
          operator: ConditionOperator.EQUALS,
          value: true,
          weight: 0.5,
        },
        {
          type: ConditionType.COMPONENT_PROPERTY,
          property: 'properties.encryption',
          operator: ConditionOperator.NOT_CONTAINS,
          value: 'at_rest',
          weight: 0.5,
        },
      ],
      threatTemplate: {
        title: 'Sensitive Data Exposure in {component}',
        description: 'The database {component} stores sensitive data without encryption, risking data exposure.',
        category: ThreatCategory.INFORMATION_DISCLOSURE,
        strideCategories: [StrideCategory.INFORMATION_DISCLOSURE],
        severity: ThreatSeverity.HIGH,
        likelihood: ThreatLikelihood.MEDIUM,
        impact: ThreatImpact.HIGH,
        attackVectors: [
          {
            vector: 'Unauthorized access to unencrypted data',
            complexity: AttackComplexity.LOW,
            requirements: ['Database access', 'File system access'],
            mitigations: ['Database encryption', 'Access controls', 'Data masking'],
          },
        ],
        mitigationSuggestions: [
          'Implement database encryption at rest',
          'Use transparent data encryption (TDE)',
          'Apply data masking for non-production environments',
          'Implement proper access controls',
        ],
      },
      confidence: 0.90,
      lastUpdated: new Date(),
    });

    // API Patterns
    this.patterns.push({
      id: 'api-no-auth',
      name: 'Unauthenticated API Access',
      description: 'APIs without authentication allow unauthorized access',
      category: ThreatCategory.SPOOFING,
      applicableComponents: [ComponentType.PROCESS],
      conditions: [
        {
          type: ConditionType.COMPONENT_PROPERTY,
          property: 'properties.protocols',
          operator: ConditionOperator.CONTAINS,
          value: 'rest',
          weight: 0.3,
        },
        {
          type: ConditionType.COMPONENT_PROPERTY,
          property: 'properties.authentication',
          operator: ConditionOperator.CONTAINS,
          value: 'none',
          weight: 0.4,
        },
        {
          type: ConditionType.COMPONENT_PROPERTY,
          property: 'properties.internetFacing',
          operator: ConditionOperator.EQUALS,
          value: true,
          weight: 0.3,
        },
      ],
      threatTemplate: {
        title: 'Unauthenticated API Access in {component}',
        description: 'The API {component} allows unauthenticated access, enabling unauthorized operations.',
        category: ThreatCategory.SPOOFING,
        strideCategories: [StrideCategory.SPOOFING, StrideCategory.ELEVATION_OF_PRIVILEGE],
        severity: ThreatSeverity.HIGH,
        likelihood: ThreatLikelihood.HIGH,
        impact: ThreatImpact.HIGH,
        attackVectors: [
          {
            vector: 'Direct API access without credentials',
            complexity: AttackComplexity.LOW,
            requirements: ['Network access to API'],
            mitigations: ['API authentication', 'Rate limiting', 'API gateway'],
          },
        ],
        mitigationSuggestions: [
          'Implement API key authentication',
          'Use OAuth 2.0 or JWT tokens',
          'Add rate limiting and throttling',
          'Deploy API gateway for centralized security',
        ],
      },
      confidence: 0.85,
      lastUpdated: new Date(),
    });

    // Network Patterns
    this.patterns.push({
      id: 'network-unencrypted',
      name: 'Unencrypted Network Communication',
      description: 'Components communicating over unencrypted channels are vulnerable to interception',
      category: ThreatCategory.INFORMATION_DISCLOSURE,
      applicableComponents: [ComponentType.PROCESS, ComponentType.EXTERNAL_ENTITY],
      conditions: [
        {
          type: ConditionType.COMPONENT_PROPERTY,
          property: 'properties.protocols',
          operator: ConditionOperator.CONTAINS,
          value: 'http',
          weight: 0.4,
        },
        {
          type: ConditionType.COMPONENT_PROPERTY,
          property: 'properties.encryption',
          operator: ConditionOperator.NOT_CONTAINS,
          value: 'in_transit',
          weight: 0.6,
        },
      ],
      threatTemplate: {
        title: 'Unencrypted Communication from {component}',
        description: 'The component {component} communicates over unencrypted channels, allowing traffic interception.',
        category: ThreatCategory.INFORMATION_DISCLOSURE,
        strideCategories: [StrideCategory.INFORMATION_DISCLOSURE, StrideCategory.TAMPERING],
        severity: ThreatSeverity.MEDIUM,
        likelihood: ThreatLikelihood.MEDIUM,
        impact: ThreatImpact.MEDIUM,
        attackVectors: [
          {
            vector: 'Network traffic interception',
            complexity: AttackComplexity.MEDIUM,
            requirements: ['Network access', 'Traffic analysis tools'],
            mitigations: ['TLS encryption', 'VPN', 'Network segmentation'],
          },
        ],
        mitigationSuggestions: [
          'Use TLS/SSL for all communications',
          'Implement certificate pinning',
          'Use VPN for sensitive communications',
          'Apply network segmentation',
        ],
      },
      confidence: 0.75,
      lastUpdated: new Date(),
    });

    logger.info('Default threat patterns initialized', { 
      patternCount: this.patterns.length 
    });
  }
}