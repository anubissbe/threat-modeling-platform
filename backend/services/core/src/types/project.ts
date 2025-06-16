export interface Project {
  id: string;
  name: string;
  description: string;
  organization_id: string;
  owner_id: string;
  status: ProjectStatus;
  risk_level: RiskLevel;
  metadata: ProjectMetadata;
  created_at: Date;
  updated_at: Date;
  archived_at?: Date;
}

export enum ProjectStatus {
  ACTIVE = 'active',
  IN_REVIEW = 'in_review',
  COMPLETED = 'completed',
  ARCHIVED = 'archived'
}

export enum RiskLevel {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  INFO = 'info'
}

export interface ProjectMetadata {
  industry?: string;
  compliance_requirements?: string[];
  technology_stack?: string[];
  deployment_environment?: string;
  tags?: string[];
  custom_fields?: Record<string, any>;
}

export interface CreateProjectRequest {
  name: string;
  description: string;
  metadata?: ProjectMetadata;
}

export interface UpdateProjectRequest {
  name?: string;
  description?: string;
  status?: ProjectStatus;
  risk_level?: RiskLevel;
  metadata?: ProjectMetadata;
}

export interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  role: ProjectRole;
  permissions: string[];
  joined_at: Date;
}

export enum ProjectRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  CONTRIBUTOR = 'contributor',
  REVIEWER = 'reviewer',
  VIEWER = 'viewer'
}

export interface ProjectStatistics {
  total_threat_models: number;
  total_threats: number;
  threats_by_severity: Record<string, number>;
  threats_by_status: Record<string, number>;
  mitigation_coverage: number;
  last_activity: Date;
}