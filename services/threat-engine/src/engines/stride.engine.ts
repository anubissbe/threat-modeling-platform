import {
  ThreatAnalysisRequest,
  ThreatAnalysisResponse,
  IdentifiedThreat,
  Component,
  DataFlow,
  StrideCategory,
  ThreatCategory,
  ThreatSeverity,
  ThreatLikelihood,
  ThreatImpact,
  AttackVector,
  AttackComplexity,
  ThreatSource,
  ComponentType,
  RiskAssessment,
  RiskLevel,
  RiskDistribution,
  AnalysisMetadata,
  ProcessingStep,
  ProcessingStatus,
  MitigationRecommendation,
} from '../types';
import { logger } from '../utils/logger';
import { generateId, calculateRiskScore } from '../utils/helpers';
import { ThreatPatternMatcher } from '../services/pattern-matcher';
import { MitigationEngine } from '../services/mitigation-engine';

export class StrideEngine {
  private patternMatcher: ThreatPatternMatcher;
  private mitigationEngine: MitigationEngine;

  constructor() {
    this.patternMatcher = new ThreatPatternMatcher();
    this.mitigationEngine = new MitigationEngine();
  }

  async analyze(request: ThreatAnalysisRequest): Promise<ThreatAnalysisResponse> {
    const startTime = Date.now();
    const processingSteps: ProcessingStep[] = [];

    try {
      // Validate request
      if (!request.threatModelId) {
        throw new Error('Threat model ID is required');
      }

      if (!request.components || request.components.length === 0) {
        throw new Error('At least one component is required for analysis');
      }

      logger.info('Starting STRIDE analysis', {
        threatModelId: request.threatModelId,
        componentsCount: request.components.length,
        dataFlowsCount: request.dataFlows.length,
      });

      // Step 1: Component Analysis
      const componentStep = this.createProcessingStep('Component Analysis');
      processingSteps.push(componentStep);
      
      const componentThreats = await this.analyzeComponents(request.components, request.options);
      this.completeProcessingStep(componentStep);

      // Step 2: Data Flow Analysis
      const dataFlowStep = this.createProcessingStep('Data Flow Analysis');
      processingSteps.push(dataFlowStep);
      
      const dataFlowThreats = await this.analyzeDataFlows(request.dataFlows, request.components, request.options);
      this.completeProcessingStep(dataFlowStep);

      // Step 3: Cross-component Analysis
      const crossComponentStep = this.createProcessingStep('Cross-Component Analysis');
      processingSteps.push(crossComponentStep);
      
      const crossComponentThreats = await this.analyzeCrossComponentThreats(
        request.components,
        request.dataFlows,
        request.options
      );
      this.completeProcessingStep(crossComponentStep);

      // Step 4: Combine all threats
      const allThreats = [
        ...componentThreats,
        ...dataFlowThreats,
        ...crossComponentThreats,
      ];

      // Step 5: Risk Assessment
      const riskStep = this.createProcessingStep('Risk Assessment');
      processingSteps.push(riskStep);
      
      const riskAssessment = this.calculateRiskAssessment(allThreats);
      this.completeProcessingStep(riskStep);

      // Step 6: Mitigation Recommendations
      const mitigationStep = this.createProcessingStep('Mitigation Analysis');
      processingSteps.push(mitigationStep);
      
      const mitigations = await this.mitigationEngine.generateRecommendations(allThreats, request.components);
      this.completeProcessingStep(mitigationStep);

      const processingTime = Date.now() - startTime;

      const response: ThreatAnalysisResponse = {
        threatModelId: request.threatModelId,
        methodology: request.methodology,
        threats: allThreats,
        riskAssessment,
        mitigationRecommendations: mitigations,
        analysisMetadata: {
          timestamp: new Date(),
          version: '1.0.0',
          methodology: request.methodology,
          totalThreats: allThreats.length,
          componentsAnalyzed: request.components.length,
          dataFlowsAnalyzed: request.dataFlows.length,
          processingSteps,
          warnings: [],
          recommendations: [],
        },
        confidence: this.calculateOverallConfidence(allThreats),
        processingTimeMs: processingTime,
      };

      logger.info('STRIDE analysis completed', {
        threatModelId: request.threatModelId,
        threatsFound: allThreats.length,
        processingTime,
      });

      return response;
    } catch (error) {
      logger.error('STRIDE analysis failed', {
        threatModelId: request.threatModelId,
        error: error.message,
      });
      throw error;
    }
  }

  private async analyzeComponents(components: Component[], options: any): Promise<IdentifiedThreat[]> {
    const threats: IdentifiedThreat[] = [];

    for (const component of components) {
      const componentThreats = await this.analyzeComponent(component, options);
      threats.push(...componentThreats);
    }

    return threats;
  }

  private async analyzeComponent(component: Component, options: any): Promise<IdentifiedThreat[]> {
    const threats: IdentifiedThreat[] = [];

    // Apply STRIDE categories based on component type and properties
    const applicableCategories = this.getApplicableStrideCategories(component);

    for (const category of applicableCategories) {
      const categoryThreats = await this.generateThreatsForCategory(component, category, options);
      threats.push(...categoryThreats);
    }

    return threats;
  }

  private getApplicableStrideCategories(component: Component): StrideCategory[] {
    const categories: StrideCategory[] = [];

    switch (component.type) {
      case ComponentType.PROCESS:
        // Processes are vulnerable to all STRIDE categories
        categories.push(
          StrideCategory.SPOOFING,
          StrideCategory.TAMPERING,
          StrideCategory.REPUDIATION,
          StrideCategory.INFORMATION_DISCLOSURE,
          StrideCategory.DENIAL_OF_SERVICE,
          StrideCategory.ELEVATION_OF_PRIVILEGE
        );
        break;

      case ComponentType.DATA_STORE:
        // Data stores are primarily vulnerable to T, I, D
        categories.push(
          StrideCategory.TAMPERING,
          StrideCategory.INFORMATION_DISCLOSURE,
          StrideCategory.DENIAL_OF_SERVICE
        );
        // Add R if logging is not implemented
        if (!component.properties?.authentication?.includes('audit_logging')) {
          categories.push(StrideCategory.REPUDIATION);
        }
        break;

      case ComponentType.EXTERNAL_ENTITY:
        // External entities can be spoofed and can repudiate actions
        categories.push(
          StrideCategory.SPOOFING,
          StrideCategory.REPUDIATION
        );
        break;

      case ComponentType.TRUST_BOUNDARY:
        // Trust boundaries are vulnerable to all categories
        categories.push(
          StrideCategory.SPOOFING,
          StrideCategory.TAMPERING,
          StrideCategory.REPUDIATION,
          StrideCategory.INFORMATION_DISCLOSURE,
          StrideCategory.DENIAL_OF_SERVICE,
          StrideCategory.ELEVATION_OF_PRIVILEGE
        );
        break;
    }

    return categories;
  }

  private async generateThreatsForCategory(
    component: Component,
    category: StrideCategory,
    options: any
  ): Promise<IdentifiedThreat[]> {
    const threats: IdentifiedThreat[] = [];

    // Get pattern-based threats
    if (options.includeCommonThreats) {
      const patternThreats = await this.patternMatcher.findThreats(component, category);
      threats.push(...patternThreats);
    }

    // Generate rule-based threats
    const ruleBasedThreats = this.generateRuleBasedThreats(component, category);
    threats.push(...ruleBasedThreats);

    return threats;
  }

  private generateRuleBasedThreats(component: Component, category: StrideCategory): IdentifiedThreat[] {
    const threats: IdentifiedThreat[] = [];

    switch (category) {
      case StrideCategory.SPOOFING:
        threats.push(...this.generateSpoofingThreats(component));
        break;
      case StrideCategory.TAMPERING:
        threats.push(...this.generateTamperingThreats(component));
        break;
      case StrideCategory.REPUDIATION:
        threats.push(...this.generateRepudiationThreats(component));
        break;
      case StrideCategory.INFORMATION_DISCLOSURE:
        threats.push(...this.generateInformationDisclosureThreats(component));
        break;
      case StrideCategory.DENIAL_OF_SERVICE:
        threats.push(...this.generateDenialOfServiceThreats(component));
        break;
      case StrideCategory.ELEVATION_OF_PRIVILEGE:
        threats.push(...this.generateElevationOfPrivilegeThreats(component));
        break;
    }

    return threats;
  }

  private generateSpoofingThreats(component: Component): IdentifiedThreat[] {
    const threats: IdentifiedThreat[] = [];

    // Check for weak authentication
    if (!component.properties?.authentication?.length || 
        component.properties?.authentication?.includes('none')) {
      threats.push(this.createThreat({
        title: `Identity Spoofing of ${component.name}`,
        description: `An attacker could impersonate ${component.name} due to lack of proper authentication mechanisms.`,
        category: ThreatCategory.SPOOFING,
        strideCategories: [StrideCategory.SPOOFING],
        severity: ThreatSeverity.HIGH,
        likelihood: ThreatLikelihood.MEDIUM,
        impact: ThreatImpact.HIGH,
        affectedComponents: [component.id],
        attackVectors: [{
          vector: 'Credential theft or session hijacking',
          complexity: AttackComplexity.MEDIUM,
          requirements: ['Network access to component'],
          mitigations: ['Implement strong authentication', 'Use mutual TLS'],
        }],
        source: ThreatSource.RULE_BASED,
      }));
    }

    // Check for internet-facing components without proper authentication
    if (component.properties?.internetFacing && 
        !component.properties?.authentication?.includes('multi_factor')) {
      threats.push(this.createThreat({
        title: `Remote Identity Spoofing of ${component.name}`,
        description: `Internet-facing ${component.name} lacks multi-factor authentication, making it vulnerable to remote spoofing attacks.`,
        category: ThreatCategory.SPOOFING,
        strideCategories: [StrideCategory.SPOOFING],
        severity: ThreatSeverity.CRITICAL,
        likelihood: ThreatLikelihood.HIGH,
        impact: ThreatImpact.HIGH,
        affectedComponents: [component.id],
        attackVectors: [{
          vector: 'Remote authentication bypass',
          complexity: AttackComplexity.LOW,
          requirements: ['Internet access'],
          mitigations: ['Implement MFA', 'Use certificate-based authentication'],
        }],
        source: ThreatSource.RULE_BASED,
      }));
    }

    return threats;
  }

  private generateTamperingThreats(component: Component): IdentifiedThreat[] {
    const threats: IdentifiedThreat[] = [];

    // Check for lack of integrity protection
    if (!component.properties?.encryption?.includes('integrity') &&
        !component.properties?.encryption?.includes('hmac')) {
      threats.push(this.createThreat({
        title: `Data Tampering in ${component.name}`,
        description: `${component.name} lacks integrity protection mechanisms, allowing attackers to modify data without detection.`,
        category: ThreatCategory.TAMPERING,
        strideCategories: [StrideCategory.TAMPERING],
        severity: ThreatSeverity.HIGH,
        likelihood: ThreatLikelihood.MEDIUM,
        impact: ThreatImpact.HIGH,
        affectedComponents: [component.id],
        attackVectors: [{
          vector: 'Man-in-the-middle attack',
          complexity: AttackComplexity.MEDIUM,
          requirements: ['Network access', 'Ability to intercept traffic'],
          mitigations: ['Implement digital signatures', 'Use HMAC', 'Apply checksums'],
        }],
        source: ThreatSource.RULE_BASED,
      }));
    }

    // Check for privileged components without access controls
    if (component.properties?.privileged && 
        !component.properties?.authorization.length) {
      threats.push(this.createThreat({
        title: `Unauthorized Modification of ${component.name}`,
        description: `Privileged component ${component.name} lacks proper authorization controls, allowing unauthorized modifications.`,
        category: ThreatCategory.TAMPERING,
        strideCategories: [StrideCategory.TAMPERING],
        severity: ThreatSeverity.CRITICAL,
        likelihood: ThreatLikelihood.MEDIUM,
        impact: ThreatImpact.VERY_HIGH,
        affectedComponents: [component.id],
        attackVectors: [{
          vector: 'Privilege escalation',
          complexity: AttackComplexity.MEDIUM,
          requirements: ['Initial access to system'],
          mitigations: ['Implement RBAC', 'Use principle of least privilege', 'Add audit logging'],
        }],
        source: ThreatSource.RULE_BASED,
      }));
    }

    return threats;
  }

  private generateRepudiationThreats(component: Component): IdentifiedThreat[] {
    const threats: IdentifiedThreat[] = [];

    // Check for lack of audit logging
    if (!component.properties?.authentication?.includes('audit_logging')) {
      threats.push(this.createThreat({
        title: `Action Repudiation in ${component.name}`,
        description: `${component.name} lacks audit logging, making it impossible to prove or disprove user actions.`,
        category: ThreatCategory.REPUDIATION,
        strideCategories: [StrideCategory.REPUDIATION],
        severity: ThreatSeverity.MEDIUM,
        likelihood: ThreatLikelihood.HIGH,
        impact: ThreatImpact.MEDIUM,
        affectedComponents: [component.id],
        attackVectors: [{
          vector: 'Denial of performed actions',
          complexity: AttackComplexity.LOW,
          requirements: ['User access to component'],
          mitigations: ['Implement comprehensive audit logging', 'Use digital signatures', 'Add non-repudiation mechanisms'],
        }],
        source: ThreatSource.RULE_BASED,
      }));
    }

    return threats;
  }

  private generateInformationDisclosureThreats(component: Component): IdentifiedThreat[] {
    const threats: IdentifiedThreat[] = [];

    // Check for sensitive data without encryption
    if (component.properties?.sensitive && 
        !component.properties?.encryption?.includes('at_rest') &&
        !component.properties?.encryption?.includes('in_transit')) {
      threats.push(this.createThreat({
        title: `Sensitive Data Exposure in ${component.name}`,
        description: `${component.name} handles sensitive data without proper encryption, risking data exposure.`,
        category: ThreatCategory.INFORMATION_DISCLOSURE,
        strideCategories: [StrideCategory.INFORMATION_DISCLOSURE],
        severity: ThreatSeverity.CRITICAL,
        likelihood: ThreatLikelihood.MEDIUM,
        impact: ThreatImpact.VERY_HIGH,
        affectedComponents: [component.id],
        attackVectors: [{
          vector: 'Data interception or unauthorized access',
          complexity: AttackComplexity.LOW,
          requirements: ['Network or system access'],
          mitigations: ['Implement encryption at rest', 'Use TLS for data in transit', 'Apply data masking'],
        }],
        source: ThreatSource.RULE_BASED,
      }));
    }

    // Check for internet-facing components with sensitive data
    if (component.properties?.internetFacing && component.properties?.sensitive) {
      threats.push(this.createThreat({
        title: `Remote Data Exposure in ${component.name}`,
        description: `Internet-facing ${component.name} exposes sensitive data to remote attackers.`,
        category: ThreatCategory.INFORMATION_DISCLOSURE,
        strideCategories: [StrideCategory.INFORMATION_DISCLOSURE],
        severity: ThreatSeverity.CRITICAL,
        likelihood: ThreatLikelihood.HIGH,
        impact: ThreatImpact.VERY_HIGH,
        affectedComponents: [component.id],
        attackVectors: [{
          vector: 'Remote data extraction',
          complexity: AttackComplexity.LOW,
          requirements: ['Internet access'],
          mitigations: ['Implement strong access controls', 'Use encryption', 'Add rate limiting'],
        }],
        source: ThreatSource.RULE_BASED,
      }));
    }

    return threats;
  }

  private generateDenialOfServiceThreats(component: Component): IdentifiedThreat[] {
    const threats: IdentifiedThreat[] = [];

    // Check for internet-facing components without rate limiting
    if (component.properties?.internetFacing) {
      threats.push(this.createThreat({
        title: `Denial of Service Attack on ${component.name}`,
        description: `Internet-facing ${component.name} is vulnerable to DoS attacks due to lack of rate limiting and resource protection.`,
        category: ThreatCategory.DENIAL_OF_SERVICE,
        strideCategories: [StrideCategory.DENIAL_OF_SERVICE],
        severity: ThreatSeverity.HIGH,
        likelihood: ThreatLikelihood.HIGH,
        impact: ThreatImpact.HIGH,
        affectedComponents: [component.id],
        attackVectors: [{
          vector: 'Resource exhaustion attack',
          complexity: AttackComplexity.LOW,
          requirements: ['Internet access'],
          mitigations: ['Implement rate limiting', 'Use load balancing', 'Add DDoS protection'],
        }],
        source: ThreatSource.RULE_BASED,
      }));
    }

    // Check for single points of failure
    if (component.type === ComponentType.DATA_STORE || component.type === ComponentType.PROCESS) {
      threats.push(this.createThreat({
        title: `Service Unavailability of ${component.name}`,
        description: `${component.name} represents a potential single point of failure that could cause service unavailability.`,
        category: ThreatCategory.DENIAL_OF_SERVICE,
        strideCategories: [StrideCategory.DENIAL_OF_SERVICE],
        severity: ThreatSeverity.MEDIUM,
        likelihood: ThreatLikelihood.MEDIUM,
        impact: ThreatImpact.HIGH,
        affectedComponents: [component.id],
        attackVectors: [{
          vector: 'Component failure or overload',
          complexity: AttackComplexity.LOW,
          requirements: ['System access or resource exhaustion'],
          mitigations: ['Implement redundancy', 'Use circuit breakers', 'Add health monitoring'],
        }],
        source: ThreatSource.RULE_BASED,
      }));
    }

    return threats;
  }

  private generateElevationOfPrivilegeThreats(component: Component): IdentifiedThreat[] {
    const threats: IdentifiedThreat[] = [];

    // Check for privileged components with weak access controls
    if (component.properties?.privileged && 
        (!component.properties?.authorization?.length || 
         component.properties?.authorization?.includes('basic'))) {
      threats.push(this.createThreat({
        title: `Privilege Escalation in ${component.name}`,
        description: `Privileged component ${component.name} has weak access controls, allowing potential privilege escalation.`,
        category: ThreatCategory.ELEVATION_OF_PRIVILEGE,
        strideCategories: [StrideCategory.ELEVATION_OF_PRIVILEGE],
        severity: ThreatSeverity.CRITICAL,
        likelihood: ThreatLikelihood.MEDIUM,
        impact: ThreatImpact.VERY_HIGH,
        affectedComponents: [component.id],
        attackVectors: [{
          vector: 'Authorization bypass or privilege escalation',
          complexity: AttackComplexity.MEDIUM,
          requirements: ['Initial user access'],
          mitigations: ['Implement strong RBAC', 'Use principle of least privilege', 'Add privilege monitoring'],
        }],
        source: ThreatSource.RULE_BASED,
      }));
    }

    return threats;
  }

  private async analyzeDataFlows(
    dataFlows: DataFlow[],
    components: Component[],
    options: any
  ): Promise<IdentifiedThreat[]> {
    const threats: IdentifiedThreat[] = [];

    for (const dataFlow of dataFlows) {
      const dataFlowThreats = await this.analyzeDataFlow(dataFlow, components, options);
      threats.push(...dataFlowThreats);
    }

    return threats;
  }

  private async analyzeDataFlow(
    dataFlow: DataFlow,
    components: Component[],
    options: any
  ): Promise<IdentifiedThreat[]> {
    const threats: IdentifiedThreat[] = [];

    // Check for unencrypted sensitive data flows
    if (dataFlow.sensitive && !dataFlow.encryption) {
      threats.push(this.createThreat({
        title: `Unencrypted Sensitive Data Flow: ${dataFlow.name}`,
        description: `Data flow ${dataFlow.name} transmits sensitive data without encryption.`,
        category: ThreatCategory.INFORMATION_DISCLOSURE,
        strideCategories: [StrideCategory.INFORMATION_DISCLOSURE],
        severity: ThreatSeverity.HIGH,
        likelihood: ThreatLikelihood.MEDIUM,
        impact: ThreatImpact.HIGH,
        affectedComponents: [dataFlow.sourceId, dataFlow.targetId],
        affectedDataFlows: [dataFlow.id],
        attackVectors: [{
          vector: 'Network traffic interception',
          complexity: AttackComplexity.MEDIUM,
          requirements: ['Network access'],
          mitigations: ['Implement TLS encryption', 'Use VPN', 'Apply end-to-end encryption'],
        }],
        source: ThreatSource.RULE_BASED,
      }));
    }

    // Check for unauthenticated data flows
    if (!dataFlow.authentication) {
      threats.push(this.createThreat({
        title: `Unauthenticated Data Flow: ${dataFlow.name}`,
        description: `Data flow ${dataFlow.name} lacks authentication, allowing unauthorized data access.`,
        category: ThreatCategory.SPOOFING,
        strideCategories: [StrideCategory.SPOOFING],
        severity: ThreatSeverity.MEDIUM,
        likelihood: ThreatLikelihood.HIGH,
        impact: ThreatImpact.MEDIUM,
        affectedComponents: [dataFlow.sourceId, dataFlow.targetId],
        affectedDataFlows: [dataFlow.id],
        attackVectors: [{
          vector: 'Connection spoofing',
          complexity: AttackComplexity.LOW,
          requirements: ['Network access'],
          mitigations: ['Implement connection authentication', 'Use API keys', 'Apply mutual TLS'],
        }],
        source: ThreatSource.RULE_BASED,
      }));
    }

    return threats;
  }

  private async analyzeCrossComponentThreats(
    components: Component[],
    dataFlows: DataFlow[],
    options: any
  ): Promise<IdentifiedThreat[]> {
    const threats: IdentifiedThreat[] = [];

    // Analyze trust boundary crossings
    const trustBoundaryThreats = this.analyzeTrustBoundaries(components, dataFlows);
    threats.push(...trustBoundaryThreats);

    // Analyze privilege escalation paths
    const privilegeThreats = this.analyzePrivilegePaths(components, dataFlows);
    threats.push(...privilegeThreats);

    return threats;
  }

  private analyzeTrustBoundaries(components: Component[], dataFlows: DataFlow[]): IdentifiedThreat[] {
    const threats: IdentifiedThreat[] = [];

    // Find data flows that cross trust boundaries
    for (const dataFlow of dataFlows) {
      const sourceComponent = components.find(c => c.id === dataFlow.sourceId);
      const targetComponent = components.find(c => c.id === dataFlow.targetId);

      if (sourceComponent && targetComponent) {
        // Check if flow crosses from internet-facing to internal
        if (sourceComponent.properties.internetFacing && !targetComponent.properties.internetFacing) {
          threats.push(this.createThreat({
            title: `Trust Boundary Violation: ${dataFlow.name}`,
            description: `Data flow ${dataFlow.name} crosses from internet-facing to internal components without proper validation.`,
            category: ThreatCategory.TAMPERING,
            strideCategories: [StrideCategory.TAMPERING, StrideCategory.ELEVATION_OF_PRIVILEGE],
            severity: ThreatSeverity.HIGH,
            likelihood: ThreatLikelihood.MEDIUM,
            impact: ThreatImpact.HIGH,
            affectedComponents: [dataFlow.sourceId, dataFlow.targetId],
            affectedDataFlows: [dataFlow.id],
            attackVectors: [{
              vector: 'Trust boundary bypass',
              complexity: AttackComplexity.MEDIUM,
              requirements: ['Internet access', 'Protocol knowledge'],
              mitigations: ['Implement input validation', 'Use application firewalls', 'Add boundary controls'],
            }],
            source: ThreatSource.RULE_BASED,
          }));
        }
      }
    }

    return threats;
  }

  private analyzePrivilegePaths(components: Component[], dataFlows: DataFlow[]): IdentifiedThreat[] {
    const threats: IdentifiedThreat[] = [];

    // Find potential privilege escalation paths
    for (const dataFlow of dataFlows) {
      const sourceComponent = components.find(c => c.id === dataFlow.sourceId);
      const targetComponent = components.find(c => c.id === dataFlow.targetId);

      if (sourceComponent && targetComponent) {
        // Check if flow goes from low to high privilege
        if (!sourceComponent.properties.privileged && targetComponent.properties.privileged) {
          threats.push(this.createThreat({
            title: `Privilege Escalation Path: ${dataFlow.name}`,
            description: `Data flow ${dataFlow.name} provides a potential path for privilege escalation from ${sourceComponent.name} to ${targetComponent.name}.`,
            category: ThreatCategory.ELEVATION_OF_PRIVILEGE,
            strideCategories: [StrideCategory.ELEVATION_OF_PRIVILEGE],
            severity: ThreatSeverity.HIGH,
            likelihood: ThreatLikelihood.LOW,
            impact: ThreatImpact.VERY_HIGH,
            affectedComponents: [dataFlow.sourceId, dataFlow.targetId],
            affectedDataFlows: [dataFlow.id],
            attackVectors: [{
              vector: 'Privilege escalation through data flow',
              complexity: AttackComplexity.HIGH,
              requirements: ['Access to source component', 'Knowledge of data flow'],
              mitigations: ['Implement strict authorization', 'Use input validation', 'Add privilege checks'],
            }],
            source: ThreatSource.RULE_BASED,
          }));
        }
      }
    }

    return threats;
  }

  private createThreat(threatData: Partial<IdentifiedThreat>): IdentifiedThreat {
    const riskScore = calculateRiskScore(
      threatData.severity || ThreatSeverity.MEDIUM,
      threatData.likelihood || ThreatLikelihood.MEDIUM
    );

    return {
      id: generateId(),
      title: threatData.title || 'Unknown Threat',
      description: threatData.description || 'No description available',
      category: threatData.category || ThreatCategory.SPOOFING,
      strideCategories: threatData.strideCategories || [],
      severity: threatData.severity || ThreatSeverity.MEDIUM,
      likelihood: threatData.likelihood || ThreatLikelihood.MEDIUM,
      impact: threatData.impact || ThreatImpact.MEDIUM,
      riskScore,
      affectedComponents: threatData.affectedComponents || [],
      affectedDataFlows: threatData.affectedDataFlows || [],
      attackVectors: threatData.attackVectors || [],
      prerequisites: threatData.prerequisites || [],
      securityRequirements: threatData.securityRequirements || [],
      confidence: 0.8, // Default confidence for rule-based threats
      source: threatData.source || ThreatSource.RULE_BASED,
    };
  }

  private calculateRiskAssessment(threats: IdentifiedThreat[]): RiskAssessment {
    const riskDistribution: RiskDistribution = {
      critical: threats.filter(t => t.severity === ThreatSeverity.CRITICAL).length,
      high: threats.filter(t => t.severity === ThreatSeverity.HIGH).length,
      medium: threats.filter(t => t.severity === ThreatSeverity.MEDIUM).length,
      low: threats.filter(t => t.severity === ThreatSeverity.LOW).length,
    };

    const overallRiskScore = threats.reduce((sum, threat) => sum + threat.riskScore, 0) / threats.length || 0;
    
    let riskLevel: RiskLevel;
    if (riskDistribution.critical > 0) {
      riskLevel = RiskLevel.CRITICAL;
    } else if (riskDistribution.high > 5) {
      riskLevel = RiskLevel.VERY_HIGH;
    } else if (riskDistribution.high > 0) {
      riskLevel = RiskLevel.HIGH;
    } else if (riskDistribution.medium > 10) {
      riskLevel = RiskLevel.MEDIUM;
    } else {
      riskLevel = RiskLevel.LOW;
    }

    const criticalThreats = threats
      .filter(t => t.severity === ThreatSeverity.CRITICAL || t.riskScore >= 15)
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, 10);

    return {
      overallRiskScore,
      riskLevel,
      riskDistribution,
      criticalThreats,
      riskFactors: [],
      complianceGaps: [],
    };
  }

  private calculateOverallConfidence(threats: IdentifiedThreat[]): number {
    if (threats.length === 0) return 0;
    return threats.reduce((sum, threat) => sum + threat.confidence, 0) / threats.length;
  }

  private createProcessingStep(stepName: string): ProcessingStep {
    return {
      step: stepName,
      startTime: new Date(),
      endTime: new Date(),
      duration: 0,
      status: ProcessingStatus.RUNNING,
    };
  }

  private completeProcessingStep(step: ProcessingStep): void {
    step.endTime = new Date();
    step.duration = step.endTime.getTime() - step.startTime.getTime();
    step.status = ProcessingStatus.COMPLETED;
  }
}