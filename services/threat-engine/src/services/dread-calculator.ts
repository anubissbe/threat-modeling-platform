import {
  IdentifiedThreat,
  DreadScore,
  ThreatSeverity,
  ThreatLikelihood,
  ThreatImpact,
  Component,
  ComponentType,
} from '../types';
import { logger } from '../utils/logger';
import { calculateDreadScore, dreadScoreToRiskLevel } from '../utils/helpers';

export class DreadCalculator {
  /**
   * Calculate DREAD score for a threat
   */
  calculateDreadScore(threat: IdentifiedThreat, components: Component[]): DreadScore {
    const damage = this.calculateDamage(threat, components);
    const reproducibility = this.calculateReproducibility(threat, components);
    const exploitability = this.calculateExploitability(threat, components);
    const affectedUsers = this.calculateAffectedUsers(threat, components);
    const discoverability = this.calculateDiscoverability(threat, components);

    const overallScore = calculateDreadScore(
      damage,
      reproducibility,
      exploitability,
      affectedUsers,
      discoverability
    );

    logger.debug('DREAD score calculated', {
      threatId: threat.id,
      damage,
      reproducibility,
      exploitability,
      affectedUsers,
      discoverability,
      overallScore,
    });

    return {
      damage,
      reproducibility,
      exploitability,
      affectedUsers,
      discoverability,
      overallScore,
    };
  }

  /**
   * Update threat with DREAD-based risk assessment
   */
  updateThreatWithDread(threat: IdentifiedThreat, components: Component[]): IdentifiedThreat {
    const dreadScore = this.calculateDreadScore(threat, components);
    const updatedSeverity = dreadScoreToRiskLevel(dreadScore.overallScore);
    
    return {
      ...threat,
      severity: updatedSeverity,
      riskScore: Math.round(dreadScore.overallScore * 2.5), // Scale to 0-25 range
    };
  }

  /**
   * Batch calculate DREAD scores for multiple threats
   */
  calculateBatchDreadScores(threats: IdentifiedThreat[], components: Component[]): IdentifiedThreat[] {
    return threats.map(threat => this.updateThreatWithDread(threat, components));
  }

  private calculateDamage(threat: IdentifiedThreat, components: Component[]): number {
    let damageScore = 1; // Base score

    // Get affected components
    const affectedComponents = components.filter(c => 
      threat.affectedComponents.includes(c.id)
    );

    // Assess damage based on threat category
    switch (threat.category) {
      case 'information_disclosure':
        damageScore += this.assessInformationDisclosureDamage(affectedComponents);
        break;
      case 'tampering':
        damageScore += this.assessTamperingDamage(affectedComponents);
        break;
      case 'denial_of_service':
        damageScore += this.assessDenialOfServiceDamage(affectedComponents);
        break;
      case 'elevation_of_privilege':
        damageScore += this.assessPrivilegeEscalationDamage(affectedComponents);
        break;
      case 'spoofing':
        damageScore += this.assessSpoofingDamage(affectedComponents);
        break;
      case 'repudiation':
        damageScore += this.assessRepudiationDamage(affectedComponents);
        break;
    }

    // Cap at 10
    return Math.min(damageScore, 10);
  }

  private assessInformationDisclosureDamage(components: Component[]): number {
    let damage = 0;

    for (const component of components) {
      // Sensitive data adds significant damage
      if (component.properties.sensitive) {
        damage += 4;
      }

      // Data stores with sensitive info are critical
      if (component.type === ComponentType.DATA_STORE && component.properties.sensitive) {
        damage += 3;
      }

      // Internet-facing components increase exposure
      if (component.properties.internetFacing) {
        damage += 2;
      }

      // Check for regulatory data (PII, financial, health)
      if (this.containsRegulatoryData(component)) {
        damage += 3;
      }
    }

    return Math.min(damage, 9);
  }

  private assessTamperingDamage(components: Component[]): number {
    let damage = 0;

    for (const component of components) {
      // Critical processes
      if (component.type === ComponentType.PROCESS && component.properties.privileged) {
        damage += 4;
      }

      // Data stores with integrity requirements
      if (component.type === ComponentType.DATA_STORE) {
        damage += 3;
      }

      // Financial or safety-critical systems
      if (this.isCriticalSystem(component)) {
        damage += 4;
      }
    }

    return Math.min(damage, 9);
  }

  private assessDenialOfServiceDamage(components: Component[]): number {
    let damage = 0;

    for (const component of components) {
      // Critical services
      if (component.type === ComponentType.PROCESS && component.properties.internetFacing) {
        damage += 3;
      }

      // Single point of failure
      if (this.isSinglePointOfFailure(component)) {
        damage += 4;
      }

      // Business-critical systems
      if (this.isBusinessCritical(component)) {
        damage += 3;
      }
    }

    return Math.min(damage, 9);
  }

  private assessPrivilegeEscalationDamage(components: Component[]): number {
    let damage = 0;

    for (const component of components) {
      // Privileged components
      if (component.properties.privileged) {
        damage += 5;
      }

      // Administrative systems
      if (this.isAdministrativeSystem(component)) {
        damage += 4;
      }

      // Internet-facing privileged systems
      if (component.properties.internetFacing && component.properties.privileged) {
        damage += 3;
      }
    }

    return Math.min(damage, 9);
  }

  private assessSpoofingDamage(components: Component[]): number {
    let damage = 0;

    for (const component of components) {
      // External entities that can be spoofed
      if (component.type === ComponentType.EXTERNAL_ENTITY) {
        damage += 2;
      }

      // Privileged accounts
      if (component.properties.privileged) {
        damage += 3;
      }

      // Financial or payment systems
      if (this.isFinancialSystem(component)) {
        damage += 4;
      }
    }

    return Math.min(damage, 9);
  }

  private assessRepudiationDamage(components: Component[]): number {
    let damage = 1; // Base damage for repudiation

    for (const component of components) {
      // Financial transactions
      if (this.isFinancialSystem(component)) {
        damage += 4;
      }

      // Legal or compliance-sensitive systems
      if (this.isComplianceSensitive(component)) {
        damage += 3;
      }

      // Audit-critical systems
      if (this.isAuditCritical(component)) {
        damage += 2;
      }
    }

    return Math.min(damage, 9);
  }

  private calculateReproducibility(threat: IdentifiedThreat, components: Component[]): number {
    let reproducibilityScore = 5; // Default medium

    // Check attack vectors complexity
    const avgComplexity = this.getAverageAttackComplexity(threat);
    switch (avgComplexity) {
      case 'low':
        reproducibilityScore = 9;
        break;
      case 'medium':
        reproducibilityScore = 6;
        break;
      case 'high':
        reproducibilityScore = 3;
        break;
    }

    // Adjust based on component characteristics
    const affectedComponents = components.filter(c => 
      threat.affectedComponents.includes(c.id)
    );

    for (const component of affectedComponents) {
      // Internet-facing components are easier to reproduce
      if (component.properties.internetFacing) {
        reproducibilityScore += 1;
      }

      // Well-documented protocols make reproduction easier
      if (this.hasWellDocumentedProtocols(component)) {
        reproducibilityScore += 1;
      }

      // Custom or proprietary systems are harder to reproduce
      if (this.isCustomSystem(component)) {
        reproducibilityScore -= 2;
      }
    }

    return Math.max(1, Math.min(reproducibilityScore, 10));
  }

  private calculateExploitability(threat: IdentifiedThreat, components: Component[]): number {
    let exploitabilityScore = 5; // Default medium

    // Base exploitability on attack complexity
    const avgComplexity = this.getAverageAttackComplexity(threat);
    switch (avgComplexity) {
      case 'low':
        exploitabilityScore = 8;
        break;
      case 'medium':
        exploitabilityScore = 5;
        break;
      case 'high':
        exploitabilityScore = 2;
        break;
    }

    const affectedComponents = components.filter(c => 
      threat.affectedComponents.includes(c.id)
    );

    for (const component of affectedComponents) {
      // No authentication makes exploitation easier
      if (!component.properties.authentication.length) {
        exploitabilityScore += 3;
      }

      // Weak authentication
      if (component.properties.authentication.includes('basic') || 
          component.properties.authentication.includes('none')) {
        exploitabilityScore += 2;
      }

      // No encryption makes exploitation easier
      if (!component.properties.encryption.length) {
        exploitabilityScore += 1;
      }

      // Internet-facing increases exploitability
      if (component.properties.internetFacing) {
        exploitabilityScore += 2;
      }

      // Strong security controls reduce exploitability
      if (this.hasStrongSecurityControls(component)) {
        exploitabilityScore -= 3;
      }
    }

    return Math.max(1, Math.min(exploitabilityScore, 10));
  }

  private calculateAffectedUsers(threat: IdentifiedThreat, components: Component[]): number {
    let affectedUsersScore = 1;

    const affectedComponents = components.filter(c => 
      threat.affectedComponents.includes(c.id)
    );

    for (const component of affectedComponents) {
      // Internet-facing components affect more users
      if (component.properties.internetFacing) {
        affectedUsersScore += 4;
      }

      // Core business processes affect many users
      if (this.isCoreBusinessProcess(component)) {
        affectedUsersScore += 3;
      }

      // Shared services affect multiple systems
      if (this.isSharedService(component)) {
        affectedUsersScore += 2;
      }

      // Data stores potentially affect all users who depend on the data
      if (component.type === ComponentType.DATA_STORE) {
        affectedUsersScore += 2;
      }
    }

    return Math.min(affectedUsersScore, 10);
  }

  private calculateDiscoverability(threat: IdentifiedThreat, components: Component[]): number {
    let discoverabilityScore = 5; // Default medium

    const affectedComponents = components.filter(c => 
      threat.affectedComponents.includes(c.id)
    );

    for (const component of affectedComponents) {
      // Internet-facing components are more discoverable
      if (component.properties.internetFacing) {
        discoverabilityScore += 3;
      }

      // Well-known technologies are more discoverable
      if (this.isWellKnownTechnology(component)) {
        discoverabilityScore += 2;
      }

      // Default configurations increase discoverability
      if (this.hasDefaultConfiguration(component)) {
        discoverabilityScore += 2;
      }

      // Hidden or internal systems are less discoverable
      if (this.isHiddenSystem(component)) {
        discoverabilityScore -= 3;
      }

      // Security by obscurity reduces discoverability
      if (this.usesSecurityByObscurity(component)) {
        discoverabilityScore -= 1;
      }
    }

    return Math.max(1, Math.min(discoverabilityScore, 10));
  }

  // Helper methods for component analysis
  private containsRegulatoryData(component: Component): boolean {
    const name = component.name.toLowerCase();
    const description = (component.description || '').toLowerCase();
    
    const regulatoryKeywords = [
      'pii', 'personal', 'financial', 'health', 'medical', 'credit card', 
      'ssn', 'patient', 'gdpr', 'hipaa', 'pci', 'sox'
    ];
    
    return regulatoryKeywords.some(keyword => 
      name.includes(keyword) || description.includes(keyword)
    );
  }

  private isCriticalSystem(component: Component): boolean {
    const name = component.name.toLowerCase();
    const criticalKeywords = ['payment', 'financial', 'safety', 'emergency', 'critical'];
    return criticalKeywords.some(keyword => name.includes(keyword));
  }

  private isSinglePointOfFailure(component: Component): boolean {
    // Simplified heuristic - could be enhanced with dependency analysis
    return component.type === ComponentType.DATA_STORE || 
           component.name.toLowerCase().includes('primary') ||
           component.name.toLowerCase().includes('master');
  }

  private isBusinessCritical(component: Component): boolean {
    const name = component.name.toLowerCase();
    const businessKeywords = ['order', 'payment', 'customer', 'billing', 'inventory'];
    return businessKeywords.some(keyword => name.includes(keyword));
  }

  private isAdministrativeSystem(component: Component): boolean {
    const name = component.name.toLowerCase();
    const adminKeywords = ['admin', 'management', 'control', 'config'];
    return adminKeywords.some(keyword => name.includes(keyword));
  }

  private isFinancialSystem(component: Component): boolean {
    const name = component.name.toLowerCase();
    const financialKeywords = ['payment', 'financial', 'billing', 'transaction', 'money'];
    return financialKeywords.some(keyword => name.includes(keyword));
  }

  private isComplianceSensitive(component: Component): boolean {
    const name = component.name.toLowerCase();
    const complianceKeywords = ['audit', 'compliance', 'regulatory', 'legal'];
    return complianceKeywords.some(keyword => name.includes(keyword));
  }

  private isAuditCritical(component: Component): boolean {
    const name = component.name.toLowerCase();
    return name.includes('audit') || name.includes('log');
  }

  private getAverageAttackComplexity(threat: IdentifiedThreat): string {
    if (!threat.attackVectors.length) return 'medium';
    
    const complexityScores = threat.attackVectors.map(av => {
      switch (av.complexity) {
        case 'low': return 1;
        case 'medium': return 2;
        case 'high': return 3;
        default: return 2;
      }
    });
    
    const avgScore = complexityScores.reduce((sum, score) => sum + score, 0) / complexityScores.length;
    
    if (avgScore <= 1.5) return 'low';
    if (avgScore <= 2.5) return 'medium';
    return 'high';
  }

  private hasWellDocumentedProtocols(component: Component): boolean {
    const wellKnownProtocols = ['http', 'https', 'rest', 'soap', 'grpc', 'tcp', 'udp'];
    return component.properties.protocols.some(protocol => 
      wellKnownProtocols.includes(protocol.toLowerCase())
    );
  }

  private isCustomSystem(component: Component): boolean {
    const name = component.name.toLowerCase();
    return name.includes('custom') || name.includes('proprietary') || name.includes('internal');
  }

  private hasStrongSecurityControls(component: Component): boolean {
    const strongAuth = component.properties.authentication.includes('multi_factor') ||
                      component.properties.authentication.includes('certificate');
    const strongEncryption = component.properties.encryption.includes('aes') ||
                            component.properties.encryption.includes('tls');
    const strongAuthz = component.properties.authorization.includes('rbac') ||
                       component.properties.authorization.includes('abac');
    
    return strongAuth && strongEncryption && strongAuthz;
  }

  private isCoreBusinessProcess(component: Component): boolean {
    const name = component.name.toLowerCase();
    const coreKeywords = ['core', 'main', 'primary', 'central', 'key'];
    return coreKeywords.some(keyword => name.includes(keyword));
  }

  private isSharedService(component: Component): boolean {
    const name = component.name.toLowerCase();
    const sharedKeywords = ['shared', 'common', 'service', 'api', 'gateway'];
    return sharedKeywords.some(keyword => name.includes(keyword));
  }

  private isWellKnownTechnology(component: Component): boolean {
    const name = component.name.toLowerCase();
    const tech = component.properties.technology?.toLowerCase() || '';
    const wellKnownTechs = [
      'apache', 'nginx', 'mysql', 'postgresql', 'redis', 'mongodb',
      'java', 'python', 'nodejs', 'docker', 'kubernetes'
    ];
    return wellKnownTechs.some(techName => 
      name.includes(techName) || tech.includes(techName)
    );
  }

  private hasDefaultConfiguration(component: Component): boolean {
    // Heuristic: components with no authentication or basic auth likely have default configs
    return component.properties.authentication.length === 0 ||
           component.properties.authentication.includes('none') ||
           component.properties.authentication.includes('basic');
  }

  private isHiddenSystem(component: Component): boolean {
    const name = component.name.toLowerCase();
    const hiddenKeywords = ['internal', 'private', 'hidden', 'backend'];
    return hiddenKeywords.some(keyword => name.includes(keyword)) && 
           !component.properties.internetFacing;
  }

  private usesSecurityByObscurity(component: Component): boolean {
    const name = component.name.toLowerCase();
    return name.includes('obfuscated') || name.includes('hidden') || name.includes('secret');
  }
}