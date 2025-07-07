// Shared types across the threat modeling platform

export enum ThreatSeverity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  INFO = 'info'
}

export enum MethodologyType {
  STRIDE = 'stride',
  LINDDUN = 'linddun',
  PASTA = 'pasta',
  VAST = 'vast',
  DREAD = 'dread',
  TRIKE = 'trike',
  OCTAVE = 'octave',
  CVSS = 'cvss'
}

export enum RiskLevel {
  VERY_LOW = 'very_low',
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  VERY_HIGH = 'very_high',
  CRITICAL = 'critical'
}

export enum DataClassification {
  PUBLIC = 'public',
  INTERNAL = 'internal',
  CONFIDENTIAL = 'confidential',
  SECRET = 'secret',
  TOP_SECRET = 'top_secret'
}

export enum ThreatStatus {
  IDENTIFIED = 'identified',
  ANALYZING = 'analyzing',
  MITIGATING = 'mitigating',
  MITIGATED = 'mitigated',
  ACCEPTED = 'accepted',
  TRANSFERRED = 'transferred',
  REJECTED = 'rejected'
}

export enum ComponentType {
  PROCESS = 'process',
  DATA_STORE = 'data_store',
  EXTERNAL_ENTITY = 'external_entity',
  TRUST_BOUNDARY = 'trust_boundary',
  DATA_FLOW = 'data_flow'
}

export enum SecurityControlType {
  PREVENTIVE = 'preventive',
  DETECTIVE = 'detective',
  CORRECTIVE = 'corrective',
  DETERRENT = 'deterrent',
  COMPENSATING = 'compensating'
}

export enum ComplianceFramework {
  GDPR = 'gdpr',
  HIPAA = 'hipaa',
  PCI_DSS = 'pci_dss',
  SOX = 'sox',
  ISO_27001 = 'iso_27001',
  NIST = 'nist',
  SOC2 = 'soc2',
  CCPA = 'ccpa'
}

export enum IndustryType {
  FINANCIAL_SERVICES = 'financial_services',
  HEALTHCARE = 'healthcare',
  GOVERNMENT = 'government',
  EDUCATION = 'education',
  RETAIL = 'retail',
  MANUFACTURING = 'manufacturing',
  TECHNOLOGY = 'technology',
  TELECOMMUNICATIONS = 'telecommunications',
  ENERGY = 'energy',
  TRANSPORTATION = 'transportation',
  OTHER = 'other'
}

export enum OrganizationSize {
  SMALL = 'small',          // < 50 employees
  MEDIUM = 'medium',        // 50-500 employees
  LARGE = 'large',          // 500-5000 employees
  ENTERPRISE = 'enterprise' // > 5000 employees
}

export interface BaseEntity {
  id: string;
  created_at: Date;
  updated_at: Date;
  created_by?: string;
  updated_by?: string;
}

export interface AuditableEntity extends BaseEntity {
  version: number;
  audit_trail: AuditEvent[];
}

export interface AuditEvent {
  timestamp: Date;
  user_id: string;
  action: string;
  changes: Record<string, { old: any; new: any }>;
  ip_address?: string;
  user_agent?: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

export interface FilterOptions {
  search?: string;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  filters?: Record<string, any>;
}

export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  pagination?: Pagination;
  metadata?: Record<string, any>;
}

// Common validation schemas
export interface ValidationRule {
  field: string;
  rules: Array<{
    type: 'required' | 'min' | 'max' | 'pattern' | 'email' | 'url' | 'custom';
    value?: any;
    message: string;
  }>;
}

export interface SecurityContext {
  user_id: string;
  roles: string[];
  permissions: string[];
  session_id: string;
  ip_address: string;
  user_agent: string;
  authentication_method: 'password' | 'sso' | 'mfa' | 'api_key';
  session_expires_at: Date;
}

export interface EncryptionMetadata {
  algorithm: string;
  key_id: string;
  iv?: string;
  tag?: string;
  encrypted_at: Date;
}

export interface DataRetentionPolicy {
  retention_period_days: number;
  auto_deletion_enabled: boolean;
  backup_before_deletion: boolean;
  notification_before_deletion_days: number;
}

// Error types
export class ThreatModelingError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message);
    this.name = 'ThreatModelingError';
  }
}

export class ValidationError extends ThreatModelingError {
  constructor(message: string, details?: any) {
    super(message, 'VALIDATION_ERROR', 400, details);
    this.name = 'ValidationError';
  }
}

export class AuthorizationError extends ThreatModelingError {
  constructor(message: string = 'Access denied') {
    super(message, 'AUTHORIZATION_ERROR', 403);
    this.name = 'AuthorizationError';
  }
}

export class AuthenticationError extends ThreatModelingError {
  constructor(message: string = 'Authentication required') {
    super(message, 'AUTHENTICATION_ERROR', 401);
    this.name = 'AuthenticationError';
  }
}

export class NotFoundError extends ThreatModelingError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 'NOT_FOUND_ERROR', 404);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends ThreatModelingError {
  constructor(message: string) {
    super(message, 'CONFLICT_ERROR', 409);
    this.name = 'ConflictError';
  }
}

export class RateLimitError extends ThreatModelingError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, 'RATE_LIMIT_ERROR', 429);
    this.name = 'RateLimitError';
  }
}

// Utility types
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// Database connection configuration
export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
  pool_size?: number;
  connection_timeout?: number;
  idle_timeout?: number;
}

// Redis configuration
export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  database?: number;
  key_prefix?: string;
  connection_timeout?: number;
}

// Logging configuration
export interface LoggingConfig {
  level: 'error' | 'warn' | 'info' | 'debug';
  format: 'json' | 'simple';
  output: 'console' | 'file' | 'both';
  file_path?: string;
  max_file_size?: string;
  max_files?: number;
}

// Application configuration
export interface AppConfig {
  port: number;
  host: string;
  cors_origins: string[];
  rate_limit: {
    window_ms: number;
    max_requests: number;
  };
  security: {
    helmet_enabled: boolean;
    csrf_protection: boolean;
    content_security_policy: boolean;
  };
}