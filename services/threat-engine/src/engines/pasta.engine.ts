import {
  ThreatAnalysisRequest,
  ThreatAnalysisResponse,
  IdentifiedThreat,
  Component,
  DataFlow,
  PastaStage,
  ThreatCategory,
  ThreatSeverity,
  ThreatLikelihood,
  ThreatImpact,
  ThreatSource,
  RiskAssessment,
  RiskLevel,
  RiskDistribution,
  AnalysisMetadata,
  ProcessingStep,
  ProcessingStatus,
  MitigationRecommendation,
  SecurityRequirement,
  AnalysisWarning,
  WarningLevel,
  SystemRecommendation,
  RecommendationCategory,
  RequirementPriority,
} from '../types';
import { logger } from '../utils/logger';
import { generateId, calculateRiskScore } from '../utils/helpers';
import { MitigationEngine } from '../services/mitigation-engine';

interface PastaObjective {
  id: string;
  description: string;
  businessImpact: ThreatSeverity;
  securityRequirements: string[];
}

interface TechnicalScope {
  architecture: string;
  technologies: string[];
  dataClassification: string[];
  networkSegments: string[];
  trustBoundaries: string[];
}

interface ApplicationDecomposition {
  entryPoints: EntryPoint[];
  assets: Asset[];
  services: Service[];
  dependencies: Dependency[];
}

interface EntryPoint {
  id: string;
  name: string;
  type: 'ui' | 'api' | 'service' | 'file';
  accessLevel: 'public' | 'authenticated' | 'privileged';
  protocols: string[];
}

interface Asset {
  id: string;
  name: string;
  classification: 'public' | 'internal' | 'confidential' | 'restricted';
  value: 'low' | 'medium' | 'high' | 'critical';
  location: string;
}

interface Service {
  id: string;
  name: string;
  functionality: string;
  privileges: string[];
  dependencies: string[];
}

interface Dependency {
  id: string;
  name: string;
  type: 'internal' | 'external' | 'third_party';
  trustLevel: 'trusted' | 'semi_trusted' | 'untrusted';
  criticality: ThreatSeverity;
}

interface WeaknessAnalysis {
  weaknesses: Weakness[];
  vulnerabilities: Vulnerability[];
  securityGaps: SecurityGap[];
}

interface Weakness {
  id: string;
  type: string;
  description: string;
  affectedComponents: string[];
  severity: ThreatSeverity;
  cweId?: string;
}

interface Vulnerability {
  id: string;
  cveId?: string;
  description: string;
  cvssScore?: number;
  affectedAssets: string[];
  exploitability: ThreatSeverity;
}

interface SecurityGap {
  id: string;
  requirement: string;
  currentState: string;
  desiredState: string;
  impact: ThreatSeverity;
}

interface AttackModel {
  attackScenarios: AttackScenario[];
  attackTrees: AttackTree[];
  threatActors: ThreatActor[];
}

interface AttackScenario {
  id: string;
  name: string;
  description: string;
  threatActor: string;
  motivation: string;
  capability: 'low' | 'medium' | 'high' | 'advanced';
  steps: AttackStep[];
  likelihood: ThreatLikelihood;
  impact: ThreatImpact;
}

interface AttackStep {
  step: number;
  action: string;
  technique: string;
  preconditions: string[];
  outcome: string;
}

interface AttackTree {
  id: string;
  rootGoal: string;
  nodes: AttackTreeNode[];
}

interface AttackTreeNode {
  id: string;
  goal: string;
  type: 'and' | 'or' | 'leaf';
  children: string[];
  probability?: number;
  cost?: number;
  difficulty?: 'trivial' | 'easy' | 'moderate' | 'hard' | 'very_hard';
}

interface ThreatActor {
  id: string;
  name: string;
  type: 'insider' | 'outsider' | 'nation_state' | 'criminal' | 'hacktivist';
  motivation: string[];
  capabilities: string[];
  resources: 'limited' | 'moderate' | 'extensive' | 'government';
}

export class PastaEngine {
  private mitigationEngine: MitigationEngine;

  constructor() {
    this.mitigationEngine = new MitigationEngine();
  }

  async analyze(request: ThreatAnalysisRequest): Promise<ThreatAnalysisResponse> {
    const startTime = Date.now();
    const processingSteps: ProcessingStep[] = [];
    const warnings: AnalysisWarning[] = [];
    const recommendations: SystemRecommendation[] = [];

    try {
      logger.info('Starting PASTA analysis', {
        threatModelId: request.threatModelId,
        componentsCount: request.components.length,
        dataFlowsCount: request.dataFlows.length,
      });

      // Stage 1: Define Objectives
      const objectivesStep = this.createProcessingStep('Stage 1: Define Objectives');
      processingSteps.push(objectivesStep);
      
      const objectives = await this.defineObjectives(request);
      this.completeProcessingStep(objectivesStep);

      // Stage 2: Define Technical Scope
      const scopeStep = this.createProcessingStep('Stage 2: Define Technical Scope');
      processingSteps.push(scopeStep);
      
      const technicalScope = await this.defineTechnicalScope(request);
      this.completeProcessingStep(scopeStep);

      // Stage 3: Application Decomposition
      const decompositionStep = this.createProcessingStep('Stage 3: Application Decomposition');
      processingSteps.push(decompositionStep);
      
      const decomposition = await this.performApplicationDecomposition(request);
      this.completeProcessingStep(decompositionStep);

      // Stage 4: Threat Analysis
      const threatAnalysisStep = this.createProcessingStep('Stage 4: Threat Analysis');
      processingSteps.push(threatAnalysisStep);
      
      const threats = await this.performThreatAnalysis(request, decomposition, technicalScope);
      this.completeProcessingStep(threatAnalysisStep);

      // Stage 5: Weakness Analysis
      const weaknessStep = this.createProcessingStep('Stage 5: Weakness Analysis');
      processingSteps.push(weaknessStep);
      
      const weaknessAnalysis = await this.performWeaknessAnalysis(request, threats);
      this.completeProcessingStep(weaknessStep);

      // Stage 6: Attack Modeling
      const attackModelingStep = this.createProcessingStep('Stage 6: Attack Modeling');
      processingSteps.push(attackModelingStep);
      
      const attackModel = await this.performAttackModeling(threats, decomposition);
      this.completeProcessingStep(attackModelingStep);

      // Stage 7: Risk Impact Analysis
      const riskAnalysisStep = this.createProcessingStep('Stage 7: Risk Impact Analysis');
      processingSteps.push(riskAnalysisStep);
      
      const riskAssessment = await this.performRiskImpactAnalysis(
        threats,
        attackModel,
        objectives,
        decomposition
      );
      this.completeProcessingStep(riskAnalysisStep);

      // Generate mitigation recommendations
      const mitigationStep = this.createProcessingStep('Mitigation Analysis');
      processingSteps.push(mitigationStep);
      
      const mitigations = await this.mitigationEngine.generateRecommendations(threats, request.components);
      this.completeProcessingStep(mitigationStep);

      // Add PASTA-specific recommendations
      this.addPastaRecommendations(recommendations, weaknessAnalysis, attackModel);

      const processingTime = Date.now() - startTime;

      const response: ThreatAnalysisResponse = {
        threatModelId: request.threatModelId,
        methodology: request.methodology,
        threats,
        riskAssessment,
        mitigationRecommendations: mitigations,
        analysisMetadata: {
          timestamp: new Date(),
          version: '1.0.0',
          methodology: request.methodology,
          totalThreats: threats.length,
          componentsAnalyzed: request.components.length,
          dataFlowsAnalyzed: request.dataFlows.length,
          processingSteps,
          warnings,
          recommendations,
        },
        confidence: this.calculateOverallConfidence(threats),
        processingTimeMs: processingTime,
      };

      logger.info('PASTA analysis completed', {
        threatModelId: request.threatModelId,
        threatsFound: threats.length,
        processingTime,
      });

      return response;
    } catch (error) {
      logger.error('PASTA analysis failed', {
        threatModelId: request.threatModelId,
        error: error.message,
      });
      throw error;
    }
  }

  private async defineObjectives(request: ThreatAnalysisRequest): Promise<PastaObjective[]> {
    const objectives: PastaObjective[] = [];

    // Analyze security requirements to derive objectives
    for (const requirement of request.securityRequirements || []) {
      const objective: PastaObjective = {
        id: generateId(),
        description: `Ensure ${requirement.requirement}`,
        businessImpact: this.mapPriorityToSeverity(requirement.priority),
        securityRequirements: [requirement.id],
      };
      objectives.push(objective);
    }

    // Add default business objectives if none specified
    if (objectives.length === 0) {
      objectives.push({
        id: generateId(),
        description: 'Protect confidentiality of sensitive data',
        businessImpact: ThreatSeverity.HIGH,
        securityRequirements: [],
      });
      objectives.push({
        id: generateId(),
        description: 'Maintain system availability',
        businessImpact: ThreatSeverity.MEDIUM,
        securityRequirements: [],
      });
      objectives.push({
        id: generateId(),
        description: 'Ensure data integrity',
        businessImpact: ThreatSeverity.HIGH,
        securityRequirements: [],
      });
    }

    return objectives;
  }

  private async defineTechnicalScope(request: ThreatAnalysisRequest): Promise<TechnicalScope> {
    const technologies = new Set<string>();
    const dataClassifications = new Set<string>();
    const networkSegments = new Set<string>();

    // Extract information from components
    for (const component of request.components) {
      if (component.properties.technology) {
        technologies.add(component.properties.technology);
      }
      
      component.properties.protocols.forEach(protocol => technologies.add(protocol));

      if (component.properties.sensitive) {
        dataClassifications.add('sensitive');
      }

      if (component.properties.internetFacing) {
        networkSegments.add('public');
      } else {
        networkSegments.add('internal');
      }
    }

    return {
      architecture: 'microservices', // Could be inferred from component analysis
      technologies: Array.from(technologies),
      dataClassification: Array.from(dataClassifications),
      networkSegments: Array.from(networkSegments),
      trustBoundaries: this.identifyTrustBoundaries(request.components),
    };
  }

  private identifyTrustBoundaries(components: Component[]): string[] {
    const boundaries = new Set<string>();

    for (const component of components) {
      if (component.properties.internetFacing) {
        boundaries.add('internet-internal');
      }
      if (component.properties.privileged) {
        boundaries.add('user-admin');
      }
      if (component.properties.sensitive) {
        boundaries.add('public-sensitive');
      }
    }

    return Array.from(boundaries);
  }

  private async performApplicationDecomposition(
    request: ThreatAnalysisRequest
  ): Promise<ApplicationDecomposition> {
    const entryPoints: EntryPoint[] = [];
    const assets: Asset[] = [];
    const services: Service[] = [];
    const dependencies: Dependency[] = [];

    // Analyze components to create decomposition
    for (const component of request.components) {
      // Create entry points for internet-facing components
      if (component.properties.internetFacing) {
        entryPoints.push({
          id: generateId(),
          name: `${component.name} Entry Point`,
          type: this.determineEntryPointType(component),
          accessLevel: this.determineAccessLevel(component),
          protocols: component.properties.protocols,
        });
      }

      // Create assets for sensitive components
      if (component.properties.sensitive) {
        assets.push({
          id: component.id,
          name: component.name,
          classification: this.determineDataClassification(component),
          value: this.determineAssetValue(component),
          location: component.properties.internetFacing ? 'external' : 'internal',
        });
      }

      // Create services for process components
      if (component.type === 'process') {
        services.push({
          id: component.id,
          name: component.name,
          functionality: component.description || 'Processing service',
          privileges: component.properties.privileged ? ['admin'] : ['user'],
          dependencies: component.connections,
        });
      }
    }

    return {
      entryPoints,
      assets,
      services,
      dependencies,
    };
  }

  private async performThreatAnalysis(
    request: ThreatAnalysisRequest,
    decomposition: ApplicationDecomposition,
    scope: TechnicalScope
  ): Promise<IdentifiedThreat[]> {
    const threats: IdentifiedThreat[] = [];

    // Analyze entry points for threats
    for (const entryPoint of decomposition.entryPoints) {
      const entryPointThreats = this.analyzeEntryPointThreats(entryPoint);
      threats.push(...entryPointThreats);
    }

    // Analyze assets for threats
    for (const asset of decomposition.assets) {
      const assetThreats = this.analyzeAssetThreats(asset);
      threats.push(...assetThreats);
    }

    // Analyze services for threats
    for (const service of decomposition.services) {
      const serviceThreats = this.analyzeServiceThreats(service);
      threats.push(...serviceThreats);
    }

    // Analyze trust boundaries
    for (const boundary of scope.trustBoundaries) {
      const boundaryThreats = this.analyzeTrustBoundaryThreats(boundary);
      threats.push(...boundaryThreats);
    }

    return threats;
  }

  private analyzeEntryPointThreats(entryPoint: EntryPoint): IdentifiedThreat[] {
    const threats: IdentifiedThreat[] = [];

    // Common entry point threats
    if (entryPoint.accessLevel === 'public') {
      threats.push(this.createThreat({
        title: `Unauthorized Access via ${entryPoint.name}`,
        description: `Public entry point ${entryPoint.name} may allow unauthorized access`,
        category: ThreatCategory.SPOOFING,
        severity: ThreatSeverity.HIGH,
        likelihood: ThreatLikelihood.MEDIUM,
        impact: ThreatImpact.HIGH,
        source: ThreatSource.RULE_BASED,
      }));
    }

    if (entryPoint.protocols.includes('http')) {
      threats.push(this.createThreat({
        title: `Data Interception at ${entryPoint.name}`,
        description: `HTTP protocol at ${entryPoint.name} allows data interception`,
        category: ThreatCategory.INFORMATION_DISCLOSURE,
        severity: ThreatSeverity.MEDIUM,
        likelihood: ThreatLikelihood.MEDIUM,
        impact: ThreatImpact.MEDIUM,
        source: ThreatSource.RULE_BASED,
      }));
    }

    return threats;
  }

  private analyzeAssetThreats(asset: Asset): IdentifiedThreat[] {
    const threats: IdentifiedThreat[] = [];

    if (asset.classification === 'confidential' || asset.classification === 'restricted') {
      threats.push(this.createThreat({
        title: `Sensitive Data Exposure in ${asset.name}`,
        description: `High-value asset ${asset.name} is at risk of unauthorized disclosure`,
        category: ThreatCategory.INFORMATION_DISCLOSURE,
        severity: ThreatSeverity.CRITICAL,
        likelihood: ThreatLikelihood.MEDIUM,
        impact: ThreatImpact.VERY_HIGH,
        source: ThreatSource.RULE_BASED,
      }));
    }

    if (asset.value === 'critical') {
      threats.push(this.createThreat({
        title: `Critical Asset Tampering in ${asset.name}`,
        description: `Critical asset ${asset.name} is vulnerable to tampering attacks`,
        category: ThreatCategory.TAMPERING,
        severity: ThreatSeverity.HIGH,
        likelihood: ThreatLikelihood.LOW,
        impact: ThreatImpact.VERY_HIGH,
        source: ThreatSource.RULE_BASED,
      }));
    }

    return threats;
  }

  private analyzeServiceThreats(service: Service): IdentifiedThreat[] {
    const threats: IdentifiedThreat[] = [];

    if (service.privileges.includes('admin')) {
      threats.push(this.createThreat({
        title: `Privilege Escalation in ${service.name}`,
        description: `Privileged service ${service.name} could be exploited for privilege escalation`,
        category: ThreatCategory.ELEVATION_OF_PRIVILEGE,
        severity: ThreatSeverity.HIGH,
        likelihood: ThreatLikelihood.LOW,
        impact: ThreatImpact.VERY_HIGH,
        source: ThreatSource.RULE_BASED,
      }));
    }

    if (service.dependencies.length > 0) {
      threats.push(this.createThreat({
        title: `Service Dependency Attack on ${service.name}`,
        description: `Service ${service.name} depends on other services, creating attack vectors`,
        category: ThreatCategory.DENIAL_OF_SERVICE,
        severity: ThreatSeverity.MEDIUM,
        likelihood: ThreatLikelihood.MEDIUM,
        impact: ThreatImpact.MEDIUM,
        source: ThreatSource.RULE_BASED,
      }));
    }

    return threats;
  }

  private analyzeTrustBoundaryThreats(boundary: string): IdentifiedThreat[] {
    const threats: IdentifiedThreat[] = [];

    threats.push(this.createThreat({
      title: `Trust Boundary Violation: ${boundary}`,
      description: `Trust boundary ${boundary} may be compromised, allowing unauthorized access`,
      category: ThreatCategory.ELEVATION_OF_PRIVILEGE,
      severity: ThreatSeverity.MEDIUM,
      likelihood: ThreatLikelihood.LOW,
      impact: ThreatImpact.HIGH,
      source: ThreatSource.RULE_BASED,
    }));

    return threats;
  }

  private async performWeaknessAnalysis(
    request: ThreatAnalysisRequest,
    threats: IdentifiedThreat[]
  ): Promise<WeaknessAnalysis> {
    const weaknesses: Weakness[] = [];
    const vulnerabilities: Vulnerability[] = [];
    const securityGaps: SecurityGap[] = [];

    // Analyze components for common weaknesses
    for (const component of request.components) {
      if (!component.properties.authentication.length) {
        weaknesses.push({
          id: generateId(),
          type: 'Missing Authentication',
          description: `Component ${component.name} lacks authentication controls`,
          affectedComponents: [component.id],
          severity: ThreatSeverity.HIGH,
          cweId: 'CWE-306',
        });
      }

      if (!component.properties.encryption.length && component.properties.sensitive) {
        weaknesses.push({
          id: generateId(),
          type: 'Missing Encryption',
          description: `Sensitive component ${component.name} lacks encryption`,
          affectedComponents: [component.id],
          severity: ThreatSeverity.HIGH,
          cweId: 'CWE-311',
        });
      }

      if (component.properties.internetFacing && !component.properties.authorization.length) {
        weaknesses.push({
          id: generateId(),
          type: 'Missing Authorization',
          description: `Internet-facing component ${component.name} lacks authorization controls`,
          affectedComponents: [component.id],
          severity: ThreatSeverity.CRITICAL,
          cweId: 'CWE-862',
        });
      }
    }

    return {
      weaknesses,
      vulnerabilities,
      securityGaps,
    };
  }

  private async performAttackModeling(
    threats: IdentifiedThreat[],
    decomposition: ApplicationDecomposition
  ): Promise<AttackModel> {
    const attackScenarios: AttackScenario[] = [];
    const attackTrees: AttackTree[] = [];
    const threatActors: ThreatActor[] = this.getDefaultThreatActors();

    // Create attack scenarios for high-severity threats
    const highSeverityThreats = threats.filter(t => 
      t.severity === ThreatSeverity.HIGH || t.severity === ThreatSeverity.CRITICAL
    );

    for (const threat of highSeverityThreats) {
      const scenario: AttackScenario = {
        id: generateId(),
        name: `Attack Scenario: ${threat.title}`,
        description: threat.description,
        threatActor: this.selectAppropriateActor(threat),
        motivation: this.deriveMotivation(threat),
        capability: this.assessRequiredCapability(threat),
        steps: this.generateAttackSteps(threat),
        likelihood: threat.likelihood,
        impact: threat.impact,
      };
      attackScenarios.push(scenario);
    }

    return {
      attackScenarios,
      attackTrees,
      threatActors,
    };
  }

  private async performRiskImpactAnalysis(
    threats: IdentifiedThreat[],
    attackModel: AttackModel,
    objectives: PastaObjective[],
    decomposition: ApplicationDecomposition
  ): Promise<RiskAssessment> {
    const riskDistribution: RiskDistribution = {
      critical: threats.filter(t => t.severity === ThreatSeverity.CRITICAL).length,
      high: threats.filter(t => t.severity === ThreatSeverity.HIGH).length,
      medium: threats.filter(t => t.severity === ThreatSeverity.MEDIUM).length,
      low: threats.filter(t => t.severity === ThreatSeverity.LOW).length,
    };

    // Calculate business impact based on objectives
    let businessImpactMultiplier = 1.0;
    const criticalObjectives = objectives.filter(o => 
      o.businessImpact === ThreatSeverity.CRITICAL || o.businessImpact === ThreatSeverity.HIGH
    );
    if (criticalObjectives.length > 0) {
      businessImpactMultiplier = 1.5;
    }

    const overallRiskScore = (threats.reduce((sum, threat) => sum + threat.riskScore, 0) / threats.length || 0) * businessImpactMultiplier;
    
    let riskLevel: RiskLevel;
    if (riskDistribution.critical > 0 && businessImpactMultiplier > 1.2) {
      riskLevel = RiskLevel.CRITICAL;
    } else if (riskDistribution.critical > 0 || (riskDistribution.high > 3 && businessImpactMultiplier > 1.0)) {
      riskLevel = RiskLevel.VERY_HIGH;
    } else if (riskDistribution.high > 0) {
      riskLevel = RiskLevel.HIGH;
    } else if (riskDistribution.medium > 5) {
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
      riskFactors: [
        {
          factor: 'Business Impact',
          impact: businessImpactMultiplier,
          description: 'Impact on business objectives and assets',
        },
        {
          factor: 'Attack Complexity',
          impact: this.calculateAttackComplexityFactor(attackModel),
          description: 'Complexity of potential attack scenarios',
        },
      ],
      complianceGaps: [],
    };
  }

  private addPastaRecommendations(
    recommendations: SystemRecommendation[],
    weaknessAnalysis: WeaknessAnalysis,
    attackModel: AttackModel
  ): void {
    // Add architecture recommendations
    if (weaknessAnalysis.weaknesses.length > 5) {
      recommendations.push({
        category: RecommendationCategory.ARCHITECTURE,
        recommendation: 'Implement defense-in-depth security architecture',
        rationale: 'Multiple security weaknesses indicate need for layered security controls',
        priority: RequirementPriority.HIGH,
      });
    }

    // Add process recommendations
    if (attackModel.attackScenarios.length > 3) {
      recommendations.push({
        category: RecommendationCategory.PROCESS_IMPROVEMENT,
        recommendation: 'Establish regular security testing and red team exercises',
        rationale: 'Multiple attack scenarios indicate need for proactive security testing',
        priority: RequirementPriority.MEDIUM,
      });
    }
  }

  // Helper methods
  private mapPriorityToSeverity(priority: RequirementPriority): ThreatSeverity {
    switch (priority) {
      case RequirementPriority.CRITICAL:
        return ThreatSeverity.CRITICAL;
      case RequirementPriority.HIGH:
        return ThreatSeverity.HIGH;
      case RequirementPriority.MEDIUM:
        return ThreatSeverity.MEDIUM;
      case RequirementPriority.LOW:
        return ThreatSeverity.LOW;
      default:
        return ThreatSeverity.MEDIUM;
    }
  }

  private determineEntryPointType(component: Component): 'ui' | 'api' | 'service' | 'file' {
    if (component.properties.protocols.includes('http') || component.properties.protocols.includes('https')) {
      return component.properties.protocols.includes('rest') ? 'api' : 'ui';
    }
    if (component.properties.protocols.includes('grpc')) {
      return 'service';
    }
    return 'service';
  }

  private determineAccessLevel(component: Component): 'public' | 'authenticated' | 'privileged' {
    if (!component.properties.authentication.length) {
      return 'public';
    }
    if (component.properties.privileged) {
      return 'privileged';
    }
    return 'authenticated';
  }

  private determineDataClassification(component: Component): 'public' | 'internal' | 'confidential' | 'restricted' {
    if (component.properties.sensitive) {
      return component.properties.internetFacing ? 'confidential' : 'restricted';
    }
    return component.properties.internetFacing ? 'public' : 'internal';
  }

  private determineAssetValue(component: Component): 'low' | 'medium' | 'high' | 'critical' {
    if (component.properties.sensitive && component.properties.privileged) {
      return 'critical';
    }
    if (component.properties.sensitive) {
      return 'high';
    }
    if (component.properties.privileged) {
      return 'medium';
    }
    return 'low';
  }

  private getDefaultThreatActors(): ThreatActor[] {
    return [
      {
        id: generateId(),
        name: 'External Attacker',
        type: 'outsider',
        motivation: ['financial gain', 'data theft'],
        capabilities: ['basic hacking', 'social engineering'],
        resources: 'limited',
      },
      {
        id: generateId(),
        name: 'Malicious Insider',
        type: 'insider',
        motivation: ['revenge', 'financial gain'],
        capabilities: ['system access', 'insider knowledge'],
        resources: 'moderate',
      },
      {
        id: generateId(),
        name: 'Advanced Persistent Threat',
        type: 'nation_state',
        motivation: ['espionage', 'sabotage'],
        capabilities: ['advanced techniques', 'zero-day exploits'],
        resources: 'extensive',
      },
    ];
  }

  private selectAppropriateActor(threat: IdentifiedThreat): string {
    if (threat.severity === ThreatSeverity.CRITICAL) {
      return 'Advanced Persistent Threat';
    }
    if (threat.category === ThreatCategory.ELEVATION_OF_PRIVILEGE) {
      return 'Malicious Insider';
    }
    return 'External Attacker';
  }

  private deriveMotivation(threat: IdentifiedThreat): string {
    switch (threat.category) {
      case ThreatCategory.INFORMATION_DISCLOSURE:
        return 'data theft';
      case ThreatCategory.TAMPERING:
        return 'sabotage';
      case ThreatCategory.DENIAL_OF_SERVICE:
        return 'disruption';
      case ThreatCategory.ELEVATION_OF_PRIVILEGE:
        return 'system control';
      default:
        return 'financial gain';
    }
  }

  private assessRequiredCapability(threat: IdentifiedThreat): 'low' | 'medium' | 'high' | 'advanced' {
    const complexity = threat.attackVectors[0]?.complexity || 'medium';
    switch (complexity) {
      case 'low':
        return 'low';
      case 'medium':
        return 'medium';
      case 'high':
        return 'advanced';
      default:
        return 'medium';
    }
  }

  private generateAttackSteps(threat: IdentifiedThreat): AttackStep[] {
    // Simplified attack step generation
    return [
      {
        step: 1,
        action: 'Reconnaissance',
        technique: 'Information gathering',
        preconditions: [],
        outcome: 'Target identification',
      },
      {
        step: 2,
        action: 'Initial Access',
        technique: threat.attackVectors[0]?.vector || 'Unknown vector',
        preconditions: ['Target identification'],
        outcome: 'System access',
      },
      {
        step: 3,
        action: 'Exploit',
        technique: `Exploit ${threat.category}`,
        preconditions: ['System access'],
        outcome: threat.description,
      },
    ];
  }

  private calculateAttackComplexityFactor(attackModel: AttackModel): number {
    const avgComplexity = attackModel.attackScenarios.reduce((sum, scenario) => {
      const complexityScore = {
        'low': 1,
        'medium': 2,
        'high': 3,
        'advanced': 4,
      }[scenario.capability] || 2;
      return sum + complexityScore;
    }, 0) / (attackModel.attackScenarios.length || 1);

    return avgComplexity / 4; // Normalize to 0-1 range
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
      strideCategories: [], // PASTA doesn't use STRIDE categories directly
      severity: threatData.severity || ThreatSeverity.MEDIUM,
      likelihood: threatData.likelihood || ThreatLikelihood.MEDIUM,
      impact: threatData.impact || ThreatImpact.MEDIUM,
      riskScore,
      affectedComponents: threatData.affectedComponents || [],
      affectedDataFlows: threatData.affectedDataFlows || [],
      attackVectors: threatData.attackVectors || [],
      prerequisites: threatData.prerequisites || [],
      securityRequirements: threatData.securityRequirements || [],
      confidence: 0.75, // Default confidence for PASTA analysis
      source: threatData.source || ThreatSource.RULE_BASED,
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