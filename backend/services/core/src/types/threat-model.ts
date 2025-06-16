import { MethodologyType } from './methodology';

export interface ThreatModel {
  id: string;
  project_id: string;
  name: string;
  description: string;
  version: string;
  methodology: MethodologyType;
  status: ThreatModelStatus;
  scope: ThreatModelScope;
  assumptions: string[];
  architecture_diagram?: string;
  data_flow_diagram?: string;
  metadata: ThreatModelMetadata;
  created_by: string;
  created_at: Date;
  updated_at: Date;
  published_at?: Date;
}

export enum ThreatModelStatus {
  DRAFT = 'draft',
  IN_REVIEW = 'in_review',
  APPROVED = 'approved',
  PUBLISHED = 'published',
  DEPRECATED = 'deprecated'
}

export interface ThreatModelScope {
  systems: string[];
  boundaries: string[];
  assets: Asset[];
  actors: Actor[];
  data_flows: DataFlow[];
}

export interface Asset {
  id: string;
  name: string;
  type: AssetType;
  description: string;
  sensitivity: SensitivityLevel;
  location?: string;
  owner?: string;
}

export enum AssetType {
  DATA = 'data',
  APPLICATION = 'application',
  SERVICE = 'service',
  INFRASTRUCTURE = 'infrastructure',
  PHYSICAL = 'physical'
}

export enum SensitivityLevel {
  PUBLIC = 'public',
  INTERNAL = 'internal',
  CONFIDENTIAL = 'confidential',
  SECRET = 'secret',
  TOP_SECRET = 'top_secret'
}

export interface Actor {
  id: string;
  name: string;
  type: ActorType;
  description: string;
  trust_level: TrustLevel;
  capabilities?: string[];
}

export enum ActorType {
  USER = 'user',
  ADMIN = 'admin',
  SYSTEM = 'system',
  EXTERNAL_SYSTEM = 'external_system',
  ATTACKER = 'attacker'
}

export enum TrustLevel {
  UNTRUSTED = 'untrusted',
  PARTIALLY_TRUSTED = 'partially_trusted',
  TRUSTED = 'trusted',
  HIGHLY_TRUSTED = 'highly_trusted'
}

export interface DataFlow {
  id: string;
  name: string;
  source: string;
  destination: string;
  protocol?: string;
  data_classification: SensitivityLevel;
  authentication?: string;
  encryption?: string;
}

export interface ThreatModelMetadata {
  tags?: string[];
  reviewers?: string[];
  approvers?: string[];
  references?: string[];
  compliance_mapping?: Record<string, string[]>;
  custom_fields?: Record<string, any>;
}

export interface CreateThreatModelRequest {
  project_id: string;
  name: string;
  description: string;
  methodology: MethodologyType;
  scope: ThreatModelScope;
  assumptions?: string[];
  metadata?: ThreatModelMetadata;
}

export interface UpdateThreatModelRequest {
  name?: string;
  description?: string;
  version?: string;
  status?: ThreatModelStatus;
  scope?: ThreatModelScope;
  assumptions?: string[];
  architecture_diagram?: string;
  data_flow_diagram?: string;
  metadata?: ThreatModelMetadata;
}

export interface ThreatModelValidation {
  is_valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  completeness_score: number;
}

export interface ValidationError {
  field: string;
  message: string;
  severity: 'error';
}

export interface ValidationWarning {
  field: string;
  message: string;
  severity: 'warning';
}