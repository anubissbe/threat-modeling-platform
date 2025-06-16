import { MethodologyType } from './methodology';
import { RiskLevel } from './project';

export interface Threat {
  id: string;
  threat_model_id: string;
  name: string;
  description: string;
  category: string;
  methodology_specific?: Record<string, any>;
  affected_assets?: string[];
  threat_actors?: string[];
  severity: ThreatSeverity;
  likelihood: string;
  risk_score: number;
  status: ThreatStatus;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

export interface ThreatMitigation {
  id: string;
  threat_id: string;
  name: string;
  description: string;
  type: MitigationType;
  effectiveness: string;
  cost?: string;
  implementation_effort?: string;
  status: MitigationStatus;
  assigned_to?: string;
  created_at: Date;
  updated_at: Date;
}

export interface ThreatSuggestion {
  category: string;
  threats: {
    name: string;
    description: string;
    likelihood: string;
    impact: string;
    affected_assets?: string[];
    methodology_specific?: Record<string, any>;
  }[];
}

export enum LikelihoodLevel {
  VERY_LOW = 'very_low',
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  VERY_HIGH = 'very_high'
}

export enum ImpactLevel {
  NEGLIGIBLE = 'negligible',
  MINOR = 'minor',
  MODERATE = 'moderate',
  MAJOR = 'major',
  CATASTROPHIC = 'catastrophic'
}

export enum ThreatSeverity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  INFO = 'info'
}

export enum ThreatStatus {
  IDENTIFIED = 'identified',
  ANALYZING = 'analyzing',
  MITIGATING = 'mitigating',
  MITIGATED = 'mitigated',
  ACCEPTED = 'accepted',
  TRANSFERRED = 'transferred'
}

export enum MitigationStatus {
  PROPOSED = 'proposed',
  APPROVED = 'approved',
  IN_PROGRESS = 'in_progress',
  IMPLEMENTED = 'implemented',
  VERIFIED = 'verified',
  REJECTED = 'rejected'
}

export interface Mitigation {
  id: string;
  threat_id: string;
  name: string;
  description: string;
  type: MitigationType;
  effectiveness: EffectivenessLevel;
  implementation_status: ImplementationStatus;
  cost_estimate?: number;
  effort_estimate?: string;
  responsible_party?: string;
  deadline?: Date;
  verification_method?: string;
}

export enum MitigationType {
  PREVENTIVE = 'preventive',
  DETECTIVE = 'detective',
  CORRECTIVE = 'corrective',
  DETERRENT = 'deterrent',
  COMPENSATING = 'compensating'
}

export enum EffectivenessLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  VERY_HIGH = 'very_high'
}

export enum ImplementationStatus {
  PLANNED = 'planned',
  IN_PROGRESS = 'in_progress',
  IMPLEMENTED = 'implemented',
  VERIFIED = 'verified',
  FAILED = 'failed'
}

export interface ThreatMetadata {
  cve_references?: string[];
  cwe_references?: string[];
  attack_patterns?: string[];
  owasp_references?: string[];
  references?: string[];
  tags?: string[];
  custom_fields?: Record<string, any>;
}

// STRIDE-specific threat categories
export interface STRIDEThreat extends Threat {
  stride_category: STRIDECategory;
  stride_specific_data: {
    authentication_bypass?: boolean;
    data_tampering_method?: string;
    repudiation_evidence?: string;
    information_disclosure_type?: string;
    resource_exhaustion?: boolean;
    privilege_escalation_path?: string;
  };
}

export enum STRIDECategory {
  SPOOFING = 'spoofing',
  TAMPERING = 'tampering',
  REPUDIATION = 'repudiation',
  INFORMATION_DISCLOSURE = 'information_disclosure',
  DENIAL_OF_SERVICE = 'denial_of_service',
  ELEVATION_OF_PRIVILEGE = 'elevation_of_privilege'
}

// PASTA-specific threat data
export interface PASTAThreat extends Threat {
  pasta_stage: PASTAStage;
  business_objectives_impacted: string[];
  technical_scope: string[];
  attack_scenarios: AttackScenario[];
}

export enum PASTAStage {
  STAGE_1_OBJECTIVES = 'stage_1_objectives',
  STAGE_2_TECHNICAL_SCOPE = 'stage_2_technical_scope',
  STAGE_3_DECOMPOSITION = 'stage_3_decomposition',
  STAGE_4_THREAT_ANALYSIS = 'stage_4_threat_analysis',
  STAGE_5_VULNERABILITY_ANALYSIS = 'stage_5_vulnerability_analysis',
  STAGE_6_ATTACK_MODELING = 'stage_6_attack_modeling',
  STAGE_7_RISK_ANALYSIS = 'stage_7_risk_analysis'
}

export interface AttackScenario {
  id: string;
  name: string;
  description: string;
  attack_path: string[];
  prerequisites: string[];
  likelihood: LikelihoodLevel;
}

// Request/Response types
export interface CreateThreatRequest {
  threat_model_id: string;
  name: string;
  description: string;
  category: string;
  severity?: ThreatSeverity;
  likelihood?: string;
  status?: ThreatStatus;
  affected_assets?: string[];
  threat_actors?: string[];
  methodology_specific?: Record<string, any>;
}

export interface UpdateThreatRequest {
  name?: string;
  description?: string;
  category?: string;
  severity?: ThreatSeverity;
  likelihood?: string;
  status?: ThreatStatus;
  affected_assets?: string[];
  threat_actors?: string[];
  methodology_specific?: Record<string, any>;
}

export interface ThreatAnalysis {
  threat_id: string;
  risk_score: number;
  risk_matrix_position: { x: number; y: number };
  recommendations: string[];
  similar_threats: string[];
  historical_data?: {
    occurrence_rate: number;
    average_impact: number;
    mitigation_success_rate: number;
  };
}