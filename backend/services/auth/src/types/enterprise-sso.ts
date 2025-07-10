import { UserRole } from './auth';

// Core SSO Provider Types
export type SSOProvider = 'saml' | 'oidc' | 'oauth2' | 'ldap' | 'azure-ad' | 'google-workspace' | 'okta' | 'ping-identity';

export interface SSOConfig {
  provider: SSOProvider;
  entityId: string;
  ssoUrl: string;
  x509Certificate: string;
  attributeMapping: AttributeMapping;
}

// Comprehensive SSO Provider Configuration
export interface SSOProviderConfig {
  id?: string;
  organizationId: string;
  provider: SSOProvider;
  name: string;
  description?: string;
  status: 'active' | 'inactive' | 'testing';
  autoProvisioning: boolean;
  justInTimeProvisioning: boolean;
  
  // Provider-specific configurations
  saml?: SAMLConfig;
  oidc?: OIDCConfig;
  oauth2?: OAuth2Config;
  ldap?: LDAPConfig;
  azureAd?: AzureADConfig;
  googleWorkspace?: GoogleWorkspaceConfig;
  okta?: OktaConfig;
  pingIdentity?: PingIdentityConfig;
  
  // User and role mapping
  attributeMapping: AttributeMapping;
  roleMapping?: RoleMapping[];
  groupMapping?: GroupMapping[];
  tenantMapping?: TenantConfig[];
  
  // Security settings
  certificateValidation: boolean;
  signatureValidation: boolean;
  encryptionRequired: boolean;
  sessionTimeout: number; // minutes
  maxConcurrentSessions: number;
  
  // Audit and compliance
  auditLogging: boolean;
  complianceMode: 'strict' | 'normal' | 'relaxed';
  dataRetentionDays: number;
  
  // Metadata
  configuredBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
  lastUsed?: Date;
  usageCount?: number;
}

// SAML 2.0 Configuration
export interface SAMLConfig {
  entityId: string;
  ssoUrl: string;
  sloUrl?: string; // Single Logout URL
  metadataUrl?: string;
  x509Certificate: string;
  privateKey?: string;
  callbackUrl: string;
  
  // SAML specific settings
  signatureAlgorithm?: 'sha1' | 'sha256' | 'sha512';
  digestAlgorithm?: 'sha1' | 'sha256' | 'sha512';
  wantAssertionsSigned?: boolean;
  wantAuthnResponseSigned?: boolean;
  acceptedClockSkewMs?: number;
  attributeConsumingServiceIndex?: number;
  disableRequestedAuthnContext?: boolean;
  authnContext?: string[];
  forceAuthn?: boolean;
  passive?: boolean;
  
  // Name ID format
  nameIdFormat?: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress' | 
                 'urn:oasis:names:tc:SAML:2.0:nameid-format:persistent' |
                 'urn:oasis:names:tc:SAML:2.0:nameid-format:transient';
}

// OpenID Connect Configuration
export interface OIDCConfig {
  issuer: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  postLogoutRedirectUri?: string;
  
  // OIDC specific settings
  scope?: string;
  responseType?: 'code' | 'id_token' | 'token' | 'code id_token' | 'code token' | 'id_token token' | 'code id_token token';
  responseMode?: 'query' | 'fragment' | 'form_post';
  prompt?: 'none' | 'login' | 'consent' | 'select_account';
  maxAge?: number;
  uiLocales?: string;
  acrValues?: string;
  
  // Discovery and jwks
  discoveryUrl?: string;
  jwksUri?: string;
  
  // Token validation
  clockTolerance?: number;
  tokenEndpointAuthMethod?: 'client_secret_basic' | 'client_secret_post' | 'client_secret_jwt' | 'private_key_jwt';
}

// OAuth 2.0 Configuration
export interface OAuth2Config {
  clientId: string;
  clientSecret: string;
  authorizationUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  redirectUri: string;
  
  // OAuth2 specific settings
  scope?: string;
  state?: string;
  responseType?: 'code' | 'token';
  grantType?: 'authorization_code' | 'client_credentials' | 'refresh_token';
  accessType?: 'online' | 'offline';
  approvalPrompt?: 'auto' | 'force';
  
  // Token settings
  tokenType?: 'Bearer' | 'MAC';
  refreshTokenEnabled?: boolean;
}

// LDAP Configuration
export interface LDAPConfig {
  host: string;
  port: number;
  secure: boolean; // LDAPS
  baseDN: string;
  bindDN: string;
  bindPassword: string;
  
  // Search settings
  userSearchBase: string;
  userSearchFilter: string;
  userSearchScope: 'base' | 'one' | 'sub';
  
  // Group settings
  groupSearchBase?: string;
  groupSearchFilter?: string;
  groupSearchScope?: 'base' | 'one' | 'sub';
  groupMemberAttribute?: string;
  
  // Connection settings
  timeout: number;
  connectTimeout: number;
  tlsOptions?: {
    rejectUnauthorized?: boolean;
    ca?: string[];
    cert?: string;
    key?: string;
  };
}

// Azure AD Configuration
export interface AzureADConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  
  // Azure AD specific
  authority?: string;
  cloudInstance?: 'AzurePublic' | 'AzureChina' | 'AzureGermany' | 'AzureUsGovernment';
  knownAuthorities?: string[];
  redirectUri: string;
  postLogoutRedirectUri?: string;
  
  // Token and claims
  scope?: string;
  claims?: string;
  extraQueryParameters?: Record<string, string>;
}

// Google Workspace Configuration
export interface GoogleWorkspaceConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  hostedDomain?: string; // G Suite domain
  
  // Google specific
  accessType?: 'online' | 'offline';
  approvalPrompt?: 'auto' | 'force';
  includeGrantedScopes?: boolean;
  loginHint?: string;
  prompt?: 'none' | 'consent' | 'select_account';
}

// Okta Configuration
export interface OktaConfig {
  domain: string; // your-org.okta.com
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  
  // Okta specific
  authorizationServerId?: string;
  scope?: string;
  responseType?: string;
  responseMode?: string;
  state?: string;
  nonce?: string;
}

// PingIdentity Configuration
export interface PingIdentityConfig {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  
  // PingIdentity specific
  environmentId: string;
  scope?: string;
  responseType?: string;
  grantType?: string;
}

// Attribute Mapping
export interface AttributeMapping {
  email: string;
  firstName: string;
  lastName: string;
  displayName?: string;
  department?: string;
  title?: string;
  phone?: string;
  manager?: string;
  employeeId?: string;
  location?: string;
  timezone?: string;
  locale?: string;
  groups?: string;
  roles?: string;
  
  // Custom attribute mappings
  customAttributes?: Record<string, string>;
}

// Role Mapping
export interface RoleMapping {
  id?: string;
  groupName?: string;
  attributeName?: string;
  attributeValue?: string;
  role: UserRole;
  conditions?: RoleMappingCondition[];
  priority: number; // Higher number = higher priority
}

export interface RoleMappingCondition {
  type: 'attribute' | 'group' | 'email_domain' | 'regex';
  field: string;
  operator: 'equals' | 'contains' | 'starts_with' | 'ends_with' | 'regex' | 'in';
  value: string | string[];
  caseSensitive?: boolean;
}

// Group Mapping
export interface GroupMapping {
  id?: string;
  ssoGroupName: string;
  localGroupId: string;
  localGroupName: string;
  syncMembers: boolean;
  autoCreate: boolean;
}

// Tenant Configuration for Multi-tenant scenarios
export interface TenantConfig {
  id: string;
  name: string;
  domain: string;
  ssoProviderId: string;
  defaultRole: UserRole;
  allowSelfRegistration: boolean;
  requireEmailVerification: boolean;
  
  // Tenant-specific settings
  branding?: {
    logoUrl?: string;
    primaryColor?: string;
    companyName?: string;
  };
}

// SSO User Profile from Provider
export interface SSOUserProfile {
  nameID?: string;
  subject?: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName?: string;
  attributes?: Record<string, any>;
  groups?: string[];
  roles?: string[];
  
  // Provider-specific fields
  azureObjectId?: string;
  googleId?: string;
  oktaId?: string;
  pingId?: string;
}

// SSO Session Information
export interface SSOSessionInfo {
  sessionId: string;
  userId: string;
  providerId: string;
  loginTime: Date;
  lastActivity: Date;
  expiresAt?: Date;
  ipAddress?: string;
  userAgent?: string;
  ssoAttributes: Record<string, any>;
  groups: string[];
  
  // Session state
  isActive: boolean;
  isExpired?: boolean;
  logoutInitiated?: boolean;
}

// SSO Provider Status
export interface SSOProviderStatus {
  status: 'active' | 'inactive' | 'error' | 'testing';
  message: string;
  lastChecked: Date;
  responseTime?: number;
  certificateExpiry?: Date;
  certificateValid?: boolean;
  metadataValid?: boolean;
  
  // Health check details
  healthChecks?: {
    connectivity: boolean;
    certificate: boolean;
    metadata: boolean;
    authentication: boolean;
  };
}

// SSO Analytics and Metrics
export interface SSOMetrics {
  totalLogins: number;
  successfulLogins: number;
  failedLogins: number;
  activeProviders: number;
  activeSessions: number;
  averageLoginTime: number; // milliseconds
  
  // Per-provider metrics
  providerMetrics: Map<string, ProviderMetrics>;
  
  // Time-series data
  loginsByHour?: number[];
  loginsByDay?: number[];
  failuresByProvider?: Map<string, number>;
}

export interface ProviderMetrics {
  totalLogins: number;
  successfulLogins: number;
  failedLogins: number;
  averageLoginTime: number;
  lastUsed?: Date;
  
  // Error tracking
  commonErrors?: Map<string, number>;
  slowLogins?: number; // logins over threshold
}

// SSO Events for Audit Trail
export interface SSOAuditEvent {
  id: string;
  timestamp: Date;
  eventType: SSOEventType;
  userId?: string;
  organizationId: string;
  providerId: string;
  sessionId?: string;
  
  // Event details
  sourceIp?: string;
  userAgent?: string;
  success: boolean;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

export type SSOEventType = 
  | 'SSO_LOGIN_ATTEMPT'
  | 'SSO_LOGIN_SUCCESS'
  | 'SSO_LOGIN_FAILURE'
  | 'SSO_LOGOUT'
  | 'SSO_SESSION_EXPIRED'
  | 'SSO_PROVIDER_CONFIGURED'
  | 'SSO_PROVIDER_UPDATED'
  | 'SSO_PROVIDER_DELETED'
  | 'SSO_PROVIDER_TESTED'
  | 'SSO_USER_PROVISIONED'
  | 'SSO_USER_UPDATED'
  | 'SSO_CERTIFICATE_EXPIRED'
  | 'SSO_METADATA_UPDATED';

// SSO Integration Response Types
export interface SSOInitiationResponse {
  redirectUrl: string;
  state?: string;
  relayState?: string;
  method: 'GET' | 'POST';
  parameters?: Record<string, string>;
}

export interface SSOCallbackResponse {
  success: boolean;
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: UserRole;
    organization: string;
  };
  tokens?: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  };
  error?: string;
  redirect?: string;
}

// Just-in-Time (JIT) Provisioning
export interface JITProvisioningConfig {
  enabled: boolean;
  updateExistingUsers: boolean;
  defaultRole: UserRole;
  requiredAttributes: string[];
  attributeTransformations?: AttributeTransformation[];
  
  // User lifecycle
  disableUsersOnLogout?: boolean;
  deleteUsersAfterDays?: number;
  suspendInactiveUsersAfterDays?: number;
}

export interface AttributeTransformation {
  sourceAttribute: string;
  targetAttribute: string;
  transformation: 'lowercase' | 'uppercase' | 'trim' | 'regex' | 'custom';
  transformationConfig?: {
    pattern?: string;
    replacement?: string;
    customFunction?: string;
  };
}

// SCIM (System for Cross-domain Identity Management) Integration
export interface SCIMConfig {
  enabled: boolean;
  endpoint: string;
  bearerToken: string;
  version: '1.1' | '2.0';
  
  // Sync settings
  syncUsers: boolean;
  syncGroups: boolean;
  syncInterval: number; // minutes
  
  // Mapping
  userMapping: SCIMUserMapping;
  groupMapping?: SCIMGroupMapping;
}

export interface SCIMUserMapping {
  userName: string;
  email: string;
  familyName: string;
  givenName: string;
  displayName?: string;
  active: string;
  groups?: string;
}

export interface SCIMGroupMapping {
  displayName: string;
  members: string;
  externalId?: string;
}

// Federation Trust Relationships
export interface FederationTrust {
  id: string;
  name: string;
  partnerOrganization: string;
  trustType: 'bidirectional' | 'outbound' | 'inbound';
  status: 'active' | 'pending' | 'suspended';
  
  // Trust settings
  allowedUsers?: string[]; // email patterns
  allowedGroups?: string[];
  maximumTrustLevel: 'low' | 'medium' | 'high';
  
  // Certificates and keys
  signingCertificate: string;
  encryptionCertificate?: string;
  
  // Metadata
  createdBy: string;
  createdAt: Date;
  expiresAt?: Date;
  lastActivity?: Date;
}

// Advanced Security Features
export interface SSOSecurityPolicy {
  id: string;
  name: string;
  organizationId: string;
  
  // Risk-based authentication
  riskBasedAuth: {
    enabled: boolean;
    lowRiskActions: string[];
    mediumRiskActions: string[];
    highRiskActions: string[];
    riskFactors: RiskFactor[];
  };
  
  // Conditional access
  conditionalAccess: {
    enabled: boolean;
    rules: ConditionalAccessRule[];
  };
  
  // Device management
  deviceTrust: {
    enabled: boolean;
    requireManagedDevices: boolean;
    allowUnmanagedDevices: boolean;
    deviceRegistrationRequired: boolean;
  };
  
  // Session management
  sessionPolicy: {
    maxSessionDuration: number; // minutes
    idleTimeout: number; // minutes
    requireReauthentication: boolean;
    reauthenticationInterval: number; // minutes
  };
}

export interface RiskFactor {
  type: 'location' | 'device' | 'network' | 'behavior' | 'time';
  weight: number; // 0-1
  enabled: boolean;
  configuration: Record<string, any>;
}

export interface ConditionalAccessRule {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
  
  // Conditions
  conditions: {
    users?: string[];
    groups?: string[];
    applications?: string[];
    locations?: string[];
    devices?: string[];
    riskLevel?: 'low' | 'medium' | 'high';
  };
  
  // Actions
  actions: {
    grant: boolean;
    requireMFA?: boolean;
    requireCompliantDevice?: boolean;
    requireDomainJoined?: boolean;
    blockAccess?: boolean;
    requirePasswordChange?: boolean;
  };
}

// Certificate Management
export interface CertificateInfo {
  id: string;
  name: string;
  purpose: 'signing' | 'encryption' | 'both';
  certificate: string;
  privateKey?: string;
  
  // Certificate details
  issuer: string;
  subject: string;
  serialNumber: string;
  fingerprint: string;
  notBefore: Date;
  notAfter: Date;
  
  // Management
  isActive: boolean;
  autoRenewal: boolean;
  renewalDays: number; // days before expiry to renew
  
  // Usage tracking
  usedByProviders: string[];
  lastUsed?: Date;
}

// Compliance and Audit
export interface ComplianceReport {
  id: string;
  organizationId: string;
  reportType: 'SOC2' | 'GDPR' | 'HIPAA' | 'PCI-DSS' | 'ISO27001' | 'custom';
  period: {
    startDate: Date;
    endDate: Date;
  };
  
  // Report data
  totalLogins: number;
  failedLogins: number;
  suspiciousActivity: number;
  dataExported: number;
  
  // Compliance metrics
  complianceScore: number; // 0-100
  findings: ComplianceFinding[];
  recommendations: string[];
  
  // Metadata
  generatedBy: string;
  generatedAt: Date;
  approvedBy?: string;
  approvedAt?: Date;
}

export interface ComplianceFinding {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  description: string;
  evidence: string[];
  remediation: string;
  status: 'open' | 'in_progress' | 'resolved' | 'accepted_risk';
}