// Project types
export interface Project {
  id: string;
  name: string;
  description?: string;
  organizationId: string;
  ownerId: string;
  status: ProjectStatus;
  visibility: ProjectVisibility;
  tags: string[];
  metadata: ProjectMetadata;
  settings: ProjectSettings;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export enum ProjectStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  ARCHIVED = 'archived',
}

export enum ProjectVisibility {
  PRIVATE = 'private',
  ORGANIZATION = 'organization',
  PUBLIC = 'public',
}

export interface ProjectMetadata {
  industry?: string;
  criticality: 'low' | 'medium' | 'high' | 'critical';
  compliance: string[];
  stakeholders: string[];
  lastReviewDate?: Date;
  nextReviewDate?: Date;
}

export interface ProjectSettings {
  allowComments: boolean;
  requireApproval: boolean;
  autoSave: boolean;
  versioningEnabled: boolean;
  collaborationMode: 'open' | 'restricted';
  notificationsEnabled: boolean;
}

export interface CreateProjectDto {
  name: string;
  description?: string;
  organizationId: string;
  visibility?: ProjectVisibility;
  tags?: string[];
  metadata?: Partial<ProjectMetadata>;
  settings?: Partial<ProjectSettings>;
}

export interface UpdateProjectDto {
  name?: string;
  description?: string;
  status?: ProjectStatus;
  visibility?: ProjectVisibility;
  tags?: string[];
  metadata?: Partial<ProjectMetadata>;
  settings?: Partial<ProjectSettings>;
}

// Threat Model types
export interface ThreatModel {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  version: string;
  methodology: ThreatModelingMethodology;
  status: ThreatModelStatus;
  content: ThreatModelContent;
  metadata: ThreatModelMetadata;
  createdAt: Date;
  updatedAt: Date;
  createdById: string;
  lastModifiedById: string;
}

export enum ThreatModelingMethodology {
  STRIDE = 'stride',
  PASTA = 'pasta',
  VAST = 'vast',
  TRIKE = 'trike',
  OCTAVE = 'octave',
  LINDDUN = 'linddun',
  CUSTOM = 'custom',
}

export enum ThreatModelStatus {
  DRAFT = 'draft',
  REVIEW = 'review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  ARCHIVED = 'archived',
}

export interface ThreatModelContent {
  systemDescription: string;
  assumptions: string[];
  dependencies: Dependency[];
  components: Component[];
  dataFlows: DataFlow[];
  threats: Threat[];
  mitigations: Mitigation[];
  residualRisks: ResidualRisk[];
}

export interface ThreatModelMetadata {
  reviewers: string[];
  reviewDeadline?: Date;
  approvedAt?: Date;
  approvedById?: string;
  rejectionReason?: string;
  confidentialityLevel: 'public' | 'internal' | 'confidential' | 'restricted';
}

// Component types
export interface Component {
  id: string;
  name: string;
  type: ComponentType;
  description?: string;
  properties: ComponentProperties;
  position?: Position;
  connections: string[];
}

export enum ComponentType {
  PROCESS = 'process',
  DATA_STORE = 'data_store',
  EXTERNAL_ENTITY = 'external_entity',
  TRUST_BOUNDARY = 'trust_boundary',
}

export interface ComponentProperties {
  technology?: string;
  platform?: string;
  protocols: string[];
  authentication: string[];
  authorization: string[];
  encryption: string[];
  sensitive: boolean;
  internetFacing: boolean;
  privileged: boolean;
}

export interface Position {
  x: number;
  y: number;
  width?: number;
  height?: number;
}

// Data Flow types
export interface DataFlow {
  id: string;
  name: string;
  sourceId: string;
  targetId: string;
  description?: string;
  dataType: string;
  protocol?: string;
  authentication?: string;
  encryption?: string;
  sensitive: boolean;
  bidirectional: boolean;
}

// Threat types
export interface Threat {
  id: string;
  title: string;
  description: string;
  category: ThreatCategory;
  stride: StrideCategory[];
  severity: ThreatSeverity;
  likelihood: ThreatLikelihood;
  riskScore: number;
  affectedComponents: string[];
  affectedDataFlows: string[];
  mitigations: string[];
  status: ThreatStatus;
  discoveredAt: Date;
  discoveredById: string;
}

export enum ThreatCategory {
  SPOOFING = 'spoofing',
  TAMPERING = 'tampering',
  REPUDIATION = 'repudiation',
  INFORMATION_DISCLOSURE = 'information_disclosure',
  DENIAL_OF_SERVICE = 'denial_of_service',
  ELEVATION_OF_PRIVILEGE = 'elevation_of_privilege',
}

export type StrideCategory = ThreatCategory;

export enum ThreatSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum ThreatLikelihood {
  VERY_LOW = 'very_low',
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  VERY_HIGH = 'very_high',
}

export enum ThreatStatus {
  IDENTIFIED = 'identified',
  CONFIRMED = 'confirmed',
  MITIGATED = 'mitigated',
  ACCEPTED = 'accepted',
  TRANSFERRED = 'transferred',
  AVOIDED = 'avoided',
}

// Mitigation types
export interface Mitigation {
  id: string;
  title: string;
  description: string;
  category: MitigationCategory;
  implementation: MitigationImplementation;
  cost: MitigationCost;
  effort: MitigationEffort;
  effectiveness: number;
  threats: string[];
  status: MitigationStatus;
  assignedTo?: string;
  dueDate?: Date;
  implementedAt?: Date;
}

export enum MitigationCategory {
  PREVENTIVE = 'preventive',
  DETECTIVE = 'detective',
  CORRECTIVE = 'corrective',
  COMPENSATING = 'compensating',
}

export enum MitigationImplementation {
  TECHNICAL = 'technical',
  OPERATIONAL = 'operational',
  MANAGEMENT = 'management',
}

export enum MitigationCost {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  VERY_HIGH = 'very_high',
}

export enum MitigationEffort {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  VERY_HIGH = 'very_high',
}

export enum MitigationStatus {
  PLANNED = 'planned',
  IN_PROGRESS = 'in_progress',
  IMPLEMENTED = 'implemented',
  VERIFIED = 'verified',
  REJECTED = 'rejected',
}

// Risk types
export interface ResidualRisk {
  id: string;
  threatId: string;
  description: string;
  severity: ThreatSeverity;
  likelihood: ThreatLikelihood;
  riskScore: number;
  acceptanceReason?: string;
  acceptedById?: string;
  acceptedAt?: Date;
  reviewDate?: Date;
}

// Dependency types
export interface Dependency {
  id: string;
  name: string;
  type: DependencyType;
  version?: string;
  description?: string;
  criticality: 'low' | 'medium' | 'high' | 'critical';
  vendor?: string;
  licenseType?: string;
  securityContact?: string;
  vulnerabilities: Vulnerability[];
}

export enum DependencyType {
  LIBRARY = 'library',
  FRAMEWORK = 'framework',
  SERVICE = 'service',
  DATABASE = 'database',
  INFRASTRUCTURE = 'infrastructure',
  THIRD_PARTY = 'third_party',
}

export interface Vulnerability {
  id: string;
  cveId?: string;
  severity: ThreatSeverity;
  description: string;
  discoveredAt: Date;
  patchAvailable: boolean;
  patchVersion?: string;
}

// Collaboration types
export interface Collaborator {
  userId: string;
  projectId: string;
  role: CollaboratorRole;
  permissions: CollaboratorPermission[];
  invitedAt: Date;
  invitedById: string;
  joinedAt?: Date;
  lastActiveAt?: Date;
}

export enum CollaboratorRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  EDITOR = 'editor',
  REVIEWER = 'reviewer',
  VIEWER = 'viewer',
}

export enum CollaboratorPermission {
  READ = 'read',
  WRITE = 'write',
  COMMENT = 'comment',
  REVIEW = 'review',
  APPROVE = 'approve',
  MANAGE_COLLABORATORS = 'manage_collaborators',
  DELETE = 'delete',
}

// Version Control types
export interface Version {
  id: string;
  threatModelId: string;
  version: string;
  major: number;
  minor: number;
  patch: number;
  tag?: string;
  message: string;
  content: ThreatModelContent;
  metadata: VersionMetadata;
  createdAt: Date;
  createdById: string;
  parentVersionId?: string;
}

export interface VersionMetadata {
  changeType: ChangeType;
  changedComponents: string[];
  addedThreats: number;
  removedThreats: number;
  modifiedThreats: number;
  addedMitigations: number;
  removedMitigations: number;
  reviewRequired: boolean;
}

export enum ChangeType {
  MAJOR = 'major',
  MINOR = 'minor',
  PATCH = 'patch',
  HOTFIX = 'hotfix',
}

// Comment types
export interface Comment {
  id: string;
  projectId: string;
  threatModelId?: string;
  parentCommentId?: string;
  content: string;
  type: CommentType;
  status: CommentStatus;
  metadata: CommentMetadata;
  createdAt: Date;
  createdById: string;
  updatedAt?: Date;
  resolvedAt?: Date;
  resolvedById?: string;
}

export enum CommentType {
  GENERAL = 'general',
  SUGGESTION = 'suggestion',
  ISSUE = 'issue',
  APPROVAL = 'approval',
  QUESTION = 'question',
}

export enum CommentStatus {
  OPEN = 'open',
  RESOLVED = 'resolved',
  DISMISSED = 'dismissed',
}

export interface CommentMetadata {
  targetType?: 'threat' | 'mitigation' | 'component' | 'dataflow';
  targetId?: string;
  position?: Position;
  priority?: 'low' | 'medium' | 'high';
  tags?: string[];
}

// Export types
export interface ExportOptions {
  format: ExportFormat;
  includeMetadata: boolean;
  includeComments: boolean;
  includeVersionHistory: boolean;
  components?: string[];
  threats?: string[];
  mitigations?: string[];
}

export enum ExportFormat {
  JSON = 'json',
  PDF = 'pdf',
  DOCX = 'docx',
  HTML = 'html',
  CSV = 'csv',
  EXCEL = 'excel',
}

// Search and Filter types
export interface ProjectFilters {
  organizationId?: string;
  ownerId?: string;
  status?: ProjectStatus;
  visibility?: ProjectVisibility;
  tags?: string[];
  industry?: string;
  criticality?: string;
  search?: string;
  dateRange?: DateRange;
}

export interface ThreatModelFilters {
  projectId?: string;
  methodology?: ThreatModelingMethodology;
  status?: ThreatModelStatus;
  createdById?: string;
  search?: string;
  dateRange?: DateRange;
}

export interface DateRange {
  start: Date;
  end: Date;
}

// Pagination types
export interface PaginationParams {
  page?: number;
  pageSize?: number;
  orderBy?: string;
  orderDirection?: 'ASC' | 'DESC';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

// Webhook types
export interface WebhookEvent {
  id: string;
  type: WebhookEventType;
  projectId: string;
  threatModelId?: string;
  payload: any;
  timestamp: Date;
  userId: string;
}

export enum WebhookEventType {
  PROJECT_CREATED = 'project.created',
  PROJECT_UPDATED = 'project.updated',
  PROJECT_DELETED = 'project.deleted',
  THREAT_MODEL_CREATED = 'threat_model.created',
  THREAT_MODEL_UPDATED = 'threat_model.updated',
  THREAT_MODEL_APPROVED = 'threat_model.approved',
  THREAT_MODEL_REJECTED = 'threat_model.rejected',
  THREAT_ADDED = 'threat.added',
  THREAT_UPDATED = 'threat.updated',
  THREAT_MITIGATED = 'threat.mitigated',
  MITIGATION_ADDED = 'mitigation.added',
  MITIGATION_IMPLEMENTED = 'mitigation.implemented',
  COLLABORATOR_ADDED = 'collaborator.added',
  COLLABORATOR_REMOVED = 'collaborator.removed',
  COMMENT_ADDED = 'comment.added',
  VERSION_CREATED = 'version.created',
}

// Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface ErrorResponse {
  error: string;
  message: string;
  statusCode: number;
  requestId?: string;
  details?: any;
}