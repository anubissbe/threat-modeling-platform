// Multi-Factor Authentication Types

export type MFAProvider = 'totp' | 'sms' | 'email' | 'webauthn' | 'u2f' | 'biometric' | 'push' | 'voice';

// MFA Setup Response
export interface MFASetupResponse {
  provider: MFAProvider;
  setupData: TOTPSetupData | SMSSetupData | EmailSetupData | WebAuthnSetupData | BiometricSetupData | U2FSetupData;
  setupComplete: boolean;
  nextStep: string;
  backupCodes?: string[];
}

// TOTP (Time-based One-Time Password) Setup
export interface TOTPSetupData {
  secret: string;
  qrCode: string;
  backupCodes: MFABackupCodes;
  manualEntryKey: string;
  issuer: string;
  accountName: string;
  algorithm?: 'SHA1' | 'SHA256' | 'SHA512';
  digits?: 6 | 8;
  period?: number; // seconds
}

// SMS Setup Data
export interface SMSSetupData {
  phoneNumber: string;
  maskedPhoneNumber: string;
  verificationCodeSent: boolean;
  backupCodes: MFABackupCodes;
  provider?: 'twilio' | 'aws-sns' | 'azure-sms' | 'custom';
  rateLimitRemaining?: number;
}

// Email Setup Data
export interface EmailSetupData {
  emailAddress: string;
  maskedEmail: string;
  verificationCodeSent: boolean;
  backupCodes: MFABackupCodes;
  provider?: 'sendgrid' | 'ses' | 'mailgun' | 'custom';
  rateLimitRemaining?: number;
}

// WebAuthn (FIDO2) Setup Data
export interface WebAuthnSetupData {
  challenge: string;
  publicKeyCredentialCreationOptions: any;
  deviceName: string;
  backupCodes: MFABackupCodes;
  timeout?: number;
  attestation?: 'none' | 'indirect' | 'direct';
}

// Biometric Setup Data
export interface BiometricSetupData {
  supportedTypes: BiometricType[];
  deviceCapabilities: BiometricCapabilities;
  enrollmentChallenge: string;
  backupCodes: MFABackupCodes;
  securityLevel: 'low' | 'medium' | 'high';
}

export type BiometricType = 'fingerprint' | 'face' | 'voice' | 'iris' | 'palm' | 'behavioral';

export interface BiometricCapabilities {
  hasFingerprint: boolean;
  hasFaceRecognition: boolean;
  hasVoiceRecognition: boolean;
  hasIrisScanning: boolean;
  secureEnclaveAvailable: boolean;
  livenessDetection: boolean;
}

// U2F (Universal 2nd Factor) Setup Data
export interface U2FSetupData {
  challenge: string;
  appId: string;
  deviceName: string;
  backupCodes: MFABackupCodes;
  version: 'U2F_V2' | 'FIDO2';
  registrationData?: string;
}

// MFA Verification Request
export interface MFAVerificationRequest {
  userId: string;
  provider: MFAProvider;
  code: string;
  sessionId?: string;
  challenge?: string;
  
  // Additional verification data
  webauthnResponse?: any;
  biometricData?: BiometricVerificationData;
  deviceFingerprint?: string;
  
  // Context information
  ipAddress?: string;
  userAgent?: string;
  location?: GeolocationData;
  timestamp: Date;
  
  // Backup code usage
  isBackupCode?: boolean;
  
  // Risk context
  riskFactors?: RiskFactor[];
}

export interface BiometricVerificationData {
  type: BiometricType;
  template: string; // Encrypted biometric template
  confidence: number; // 0-1
  livenessScore?: number; // 0-1
  quality: number; // 0-1
}

export interface GeolocationData {
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  country?: string;
  region?: string;
  city?: string;
  timezone?: string;
  isp?: string;
}

export interface RiskFactor {
  type: 'location' | 'device' | 'network' | 'behavior' | 'time' | 'velocity';
  score: number; // 0-1
  description: string;
  confidence: number; // 0-1
}

// MFA Verification Response
export interface MFAVerificationResponse {
  success: boolean;
  sessionId?: string;
  expiresAt?: Date;
  error?: string;
  
  // Verification details
  usedBackupCode?: boolean;
  remainingBackupCodes?: number;
  responseTime: number;
  
  // Risk assessment
  riskScore?: number;
  riskLevel?: 'low' | 'medium' | 'high';
  adaptiveResult?: AdaptiveMFADecision;
  
  // Next steps
  requiresStepUp?: boolean;
  recommendedActions?: string[];
}

// MFA Backup Codes
export interface MFABackupCodes {
  codes: string[];
  generatedAt: Date;
  usedCodes: string[];
  expiresAt?: Date;
  usagePolicy?: BackupCodePolicy;
}

export interface BackupCodePolicy {
  maxUsage: number; // Maximum times a single code can be used
  expirationDays: number;
  regenerateAfterUse: boolean;
  requireRegeneration: boolean;
  minCodesRemaining: number; // Warn when below this threshold
}

// MFA Recovery Request
export interface MFARecoveryRequest {
  email: string;
  backupCode: string;
  newPassword?: string;
  disableMFA?: boolean;
  resetMethod: 'backup_code' | 'admin_override' | 'identity_verification';
  
  // Identity verification data
  identityVerification?: {
    documentType: 'passport' | 'drivers_license' | 'national_id';
    documentNumber: string;
    verificationImage?: string;
    selfieImage?: string;
  };
}

// MFA Status
export interface MFAStatus {
  enabled: boolean;
  primaryProvider?: MFAProvider;
  enabledProviders: MFAProvider[];
  devices: MFADeviceInfo[];
  backupCodesRemaining: number;
  lastUsed?: Date;
  isRecoveryEnabled: boolean;
  
  // Security status
  securityScore: number; // 0-100
  recommendations: MFARecommendation[];
  vulnerabilities: MFAVulnerability[];
}

export interface MFARecommendation {
  type: 'enable_additional_method' | 'update_backup_codes' | 'review_devices' | 'security_key';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  actionUrl?: string;
}

export interface MFAVulnerability {
  type: 'weak_method' | 'expired_backup_codes' | 'single_method' | 'insecure_device';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  remediation: string;
  detectedAt: Date;
}

// MFA Device Information
export interface MFADeviceInfo {
  id: string;
  name: string;
  provider: MFAProvider;
  deviceType: MFADeviceType;
  status: 'active' | 'inactive' | 'revoked' | 'expired';
  
  // Device details
  manufacturer?: string;
  model?: string;
  os?: string;
  appVersion?: string;
  
  // Security information
  isSecure: boolean;
  encryptionLevel: 'none' | 'basic' | 'hardware' | 'tee' | 'secure_enclave';
  attestationLevel?: 'none' | 'basic' | 'self' | 'surrogate' | 'attca';
  
  // Usage tracking
  registeredAt: Date;
  lastUsed?: Date;
  usageCount: number;
  
  // Location tracking
  registrationLocation?: GeolocationData;
  lastUsedLocation?: GeolocationData;
  
  // Risk assessment
  riskScore: number; // 0-1
  trustLevel: 'untrusted' | 'low' | 'medium' | 'high' | 'verified';
}

export type MFADeviceType = 
  | 'mobile_app'
  | 'hardware_key'
  | 'smart_card'
  | 'biometric_scanner'
  | 'phone_number'
  | 'email_address'
  | 'browser_extension'
  | 'desktop_app';

// MFA Session Information
export interface MFASessionInfo {
  sessionId: string;
  userId: string;
  provider: MFAProvider;
  deviceId?: string;
  
  // Session timing
  verifiedAt: Date;
  expiresAt: Date;
  lastActivity?: Date;
  
  // Context
  ipAddress?: string;
  userAgent?: string;
  location?: GeolocationData;
  
  // Session state
  isActive: boolean;
  usedBackupCode: boolean;
  stepUpRequired?: boolean;
  
  // Risk assessment
  riskScore?: number;
  riskFactors?: RiskFactor[];
}

// MFA Policy Configuration
export interface MFAPolicy {
  id?: string;
  organizationId?: string;
  name: string;
  description?: string;
  
  // Policy enforcement
  enforced: boolean;
  gracePeriodDays?: number;
  exemptUsers?: string[];
  exemptRoles?: string[];
  
  // Provider requirements
  allowedProviders: MFAProvider[];
  requiredProviders?: MFAProvider[];
  minimumProviders: number;
  prohibitedProviders?: MFAProvider[];
  
  // Provider-specific policies
  totpPolicy?: TOTPPolicy;
  smsPolicy?: SMSPolicy;
  emailPolicy?: EmailPolicy;
  webauthnPolicy?: WebAuthnPolicy;
  biometricPolicy?: BiometricPolicy;
  
  // Session management
  sessionTimeout: number; // seconds
  maxConcurrentSessions: number;
  reauthenticationRequired: boolean;
  reauthenticationInterval?: number; // seconds
  
  // Backup and recovery
  backupCodesRequired: boolean;
  backupCodesPolicy?: BackupCodePolicy;
  recoveryMethods: RecoveryMethod[];
  
  // Risk and adaptive authentication
  adaptiveMFA: boolean;
  riskBasedMFA?: RiskBasedMFAConfig;
  
  // Compliance and audit
  auditLogging: boolean;
  complianceFrameworks?: string[];
  dataRetentionDays: number;
  
  // User experience
  allowUserDisable: boolean;
  allowUserBypass: boolean;
  bypassDurationHours?: number;
  
  // Metadata
  createdAt?: Date;
  updatedAt?: Date;
  createdBy?: string;
  version?: number;
}

export interface TOTPPolicy {
  algorithm: 'SHA1' | 'SHA256' | 'SHA512';
  digits: 6 | 8;
  period: number; // seconds
  window: number; // number of periods to check
  allowedIssuers?: string[];
  requireSecureSetup: boolean;
}

export interface SMSPolicy {
  allowedCountries?: string[];
  blockedCountries?: string[];
  rateLimitPerHour: number;
  rateLimitPerDay: number;
  requireCarrierVerification: boolean;
  allowVoIP: boolean;
  providers: string[];
}

export interface EmailPolicy {
  allowedDomains?: string[];
  blockedDomains?: string[];
  rateLimitPerHour: number;
  rateLimitPerDay: number;
  requireDomainVerification: boolean;
  allowPersonalEmail: boolean;
  providers: string[];
}

export interface WebAuthnPolicy {
  requireResidentKey: boolean;
  requireUserVerification: boolean;
  allowedAAGUIDs?: string[]; // Authenticator attestation GUIDs
  blockedAAGUIDs?: string[];
  attestationRequirement: 'none' | 'indirect' | 'direct';
  timeout: number; // milliseconds
  allowCredentialsGet: boolean;
}

export interface BiometricPolicy {
  allowedTypes: BiometricType[];
  minimumConfidence: number; // 0-1
  requireLivenessDetection: boolean;
  allowFallback: boolean;
  encryptionRequired: boolean;
  localStorageOnly: boolean;
}

export type RecoveryMethod = 'backup_codes' | 'admin_reset' | 'identity_verification' | 'alternate_email' | 'alternate_phone';

// Risk-Based MFA Configuration
export interface RiskBasedMFAConfig {
  enabled: boolean;
  lowRiskThreshold: number; // 0-1
  mediumRiskThreshold: number; // 0-1
  highRiskThreshold: number; // 0-1
  
  // Risk factors and their weights
  factors: {
    location: RiskFactorConfig;
    device: RiskFactorConfig;
    network: RiskFactorConfig;
    behavior: RiskFactorConfig;
    time: RiskFactorConfig;
    velocity: RiskFactorConfig;
  };
  
  // Actions based on risk level
  lowRiskAction: RiskAction;
  mediumRiskAction: RiskAction;
  highRiskAction: RiskAction;
  
  // Machine learning settings
  mlEnabled: boolean;
  modelVersion?: string;
  trainingDataDays: number;
  adaptationEnabled: boolean;
}

export interface RiskFactorConfig {
  enabled: boolean;
  weight: number; // 0-1
  configuration: Record<string, any>;
}

export type RiskAction = 'allow' | 'mfa_required' | 'strong_mfa_required' | 'block' | 'manual_review';

// Adaptive MFA Decision
export interface AdaptiveMFADecision {
  requireMFA: boolean;
  riskScore: number; // 0-1
  riskLevel: 'low' | 'medium' | 'high';
  recommendedProviders: MFAProvider[];
  reasoning: string[];
  bypassAllowed: boolean;
  
  // Additional security measures
  additionalVerification?: string[];
  sessionRestrictions?: SessionRestriction[];
  monitoringRequired?: boolean;
}

export interface SessionRestriction {
  type: 'ip_restriction' | 'time_limit' | 'action_limit' | 'location_restriction';
  description: string;
  value: any;
  expiresAt?: Date;
}

// MFA User Settings
export interface MFAUserSettings {
  enabled: boolean;
  primaryProvider: MFAProvider;
  enabledProviders: MFAProvider[];
  
  // User preferences
  defaultProvider?: MFAProvider;
  sessionTimeout?: number; // seconds
  requireMFAForSensitiveActions: boolean;
  allowRememberDevice: boolean;
  rememberDeviceDays: number;
  
  // Notification preferences
  notifyOnNewDevice: boolean;
  notifyOnUnusualActivity: boolean;
  notifyOnBackupCodeUsage: boolean;
  
  // Recovery settings
  recoveryEmail?: string;
  recoveryPhone?: string;
  allowedRecoveryMethods: RecoveryMethod[];
  
  // Security preferences
  adaptiveMFAConsent: boolean;
  biometricDataConsent: boolean;
  locationTrackingConsent: boolean;
  
  // Usage tracking
  lastUsed?: Date;
  totalLogins: number;
  failedAttempts: number;
  lastFailedAttempt?: Date;
  
  // Metadata
  setupCompletedAt?: Date;
  lastUpdated?: Date;
}

// MFA Analytics and Metrics
export interface MFAMetrics {
  // Usage statistics
  totalUsers: number;
  enabledUsers: number;
  activeUsers: number; // users who used MFA in last 30 days
  
  // Provider distribution
  providerDistribution: Map<MFAProvider, number>;
  primaryProviderDistribution: Map<MFAProvider, number>;
  
  // Success metrics
  totalAttempts: number;
  successfulAttempts: number;
  failedAttempts: number;
  successRate: number; // percentage
  
  // Performance metrics
  averageVerificationTime: number; // milliseconds
  medianVerificationTime: number;
  p95VerificationTime: number;
  p99VerificationTime: number;
  
  // Security metrics
  averageRiskScore: number;
  highRiskLogins: number;
  blockedAttempts: number;
  compromisedAccounts: number;
  
  // Recovery metrics
  backupCodeUsage: number;
  recoveryAttempts: number;
  successfulRecoveries: number;
  
  // Time-series data
  usageByHour: number[];
  usageByDay: number[];
  usageByMonth: number[];
  
  // Geographic distribution
  usageByCountry: Map<string, number>;
  riskByCountry: Map<string, number>;
  
  // Device metrics
  deviceDistribution: Map<MFADeviceType, number>;
  deviceSecurityScores: Map<string, number>;
  
  // Compliance metrics
  complianceRate: number; // percentage of users meeting policy
  policyViolations: number;
  auditEvents: number;
  
  // Metadata
  reportPeriod: {
    startDate: Date;
    endDate: Date;
  };
  generatedAt: Date;
  version: string;
}

// MFA Audit Events
export interface MFAAuditEvent {
  id: string;
  timestamp: Date;
  eventType: MFAEventType;
  userId: string;
  organizationId?: string;
  
  // Event details
  provider?: MFAProvider;
  deviceId?: string;
  sessionId?: string;
  
  // Context
  ipAddress?: string;
  userAgent?: string;
  location?: GeolocationData;
  
  // Results
  success: boolean;
  errorCode?: string;
  errorMessage?: string;
  riskScore?: number;
  
  // Additional data
  metadata?: Record<string, any>;
  
  // Compliance
  retentionDate: Date;
  complianceFlags?: string[];
}

export type MFAEventType =
  | 'MFA_SETUP_INITIATED'
  | 'MFA_SETUP_COMPLETED'
  | 'MFA_SETUP_FAILED'
  | 'MFA_VERIFICATION_ATTEMPTED'
  | 'MFA_VERIFICATION_SUCCESS'
  | 'MFA_VERIFICATION_FAILED'
  | 'MFA_BACKUP_CODE_USED'
  | 'MFA_BACKUP_CODE_GENERATED'
  | 'MFA_DEVICE_REGISTERED'
  | 'MFA_DEVICE_REVOKED'
  | 'MFA_POLICY_UPDATED'
  | 'MFA_DISABLED'
  | 'MFA_RECOVERY_INITIATED'
  | 'MFA_RECOVERY_COMPLETED'
  | 'MFA_SECURITY_ALERT'
  | 'MFA_COMPLIANCE_VIOLATION'
  | 'MFA_ADMIN_OVERRIDE';

// Push Notification MFA (for mobile apps)
export interface PushMFARequest {
  userId: string;
  deviceId: string;
  challenge: string;
  context: {
    action: string;
    ipAddress: string;
    location?: GeolocationData;
    userAgent: string;
    timestamp: Date;
  };
  expiresAt: Date;
  allowApprovalTypes: PushApprovalType[];
}

export type PushApprovalType = 'tap' | 'biometric' | 'number_matching' | 'location_confirmation';

export interface PushMFAResponse {
  challengeId: string;
  action: 'approve' | 'deny' | 'report_fraud';
  approvalType?: PushApprovalType;
  biometricResult?: BiometricVerificationData;
  location?: GeolocationData;
  respondedAt: Date;
}

// Voice Call MFA
export interface VoiceMFAConfig {
  phoneNumber: string;
  language: string;
  codeLength: number; // typically 6 digits
  maxRetries: number;
  callTimeout: number; // seconds
  provider: 'twilio' | 'aws-connect' | 'azure-voice' | 'custom';
}

// Progressive MFA (Step-up Authentication)
export interface StepUpMFARequest {
  currentSessionId: string;
  requiredLevel: SecurityLevel;
  context: string; // action being performed
  additionalProviders?: MFAProvider[];
  timeout?: number; // seconds
}

export type SecurityLevel = 'basic' | 'elevated' | 'high' | 'critical';

export interface StepUpMFAResponse {
  success: boolean;
  newSessionId?: string;
  achievedLevel: SecurityLevel;
  expiresAt?: Date;
  error?: string;
}