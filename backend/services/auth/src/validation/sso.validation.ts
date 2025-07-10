import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { logger } from '../utils/logger';
import { UserRole } from '../types/auth';

// Base SSO Provider Schema
const SSOProviderSchema = z.object({
  organizationId: z.string().min(1, 'Organization ID is required'),
  provider: z.enum(['saml', 'oidc', 'oauth2', 'ldap', 'azure-ad', 'google-workspace', 'okta', 'ping-identity']),
  name: z.string().min(1, 'Provider name is required'),
  description: z.string().optional(),
  status: z.enum(['active', 'inactive', 'testing']).default('testing'),
  autoProvisioning: z.boolean().default(false),
  justInTimeProvisioning: z.boolean().default(false),
  certificateValidation: z.boolean().default(true),
  signatureValidation: z.boolean().default(true),
  encryptionRequired: z.boolean().default(false),
  sessionTimeout: z.number().min(5).max(1440).default(60), // 5 minutes to 24 hours
  maxConcurrentSessions: z.number().min(1).max(100).default(5),
  auditLogging: z.boolean().default(true),
  complianceMode: z.enum(['strict', 'normal', 'relaxed']).default('normal'),
  dataRetentionDays: z.number().min(30).max(2555).default(365) // 30 days to 7 years
});

// SAML Configuration Schema
const SAMLConfigSchema = z.object({
  entityId: z.string().min(1, 'Entity ID is required'),
  ssoUrl: z.string().url('Valid SSO URL is required'),
  sloUrl: z.string().url('Valid SLO URL is required').optional(),
  metadataUrl: z.string().url('Valid metadata URL is required').optional(),
  x509Certificate: z.string().min(1, 'X.509 certificate is required'),
  privateKey: z.string().optional(),
  callbackUrl: z.string().url('Valid callback URL is required'),
  signatureAlgorithm: z.enum(['sha1', 'sha256', 'sha512']).default('sha256'),
  digestAlgorithm: z.enum(['sha1', 'sha256', 'sha512']).default('sha256'),
  wantAssertionsSigned: z.boolean().default(true),
  wantAuthnResponseSigned: z.boolean().default(true),
  acceptedClockSkewMs: z.number().min(0).max(300000).default(0), // 0 to 5 minutes
  attributeConsumingServiceIndex: z.number().optional(),
  disableRequestedAuthnContext: z.boolean().default(false),
  authnContext: z.array(z.string()).optional(),
  forceAuthn: z.boolean().default(false),
  passive: z.boolean().default(false),
  nameIdFormat: z.enum([
    'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
    'urn:oasis:names:tc:SAML:2.0:nameid-format:persistent',
    'urn:oasis:names:tc:SAML:2.0:nameid-format:transient'
  ]).default('urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress')
});

// OIDC Configuration Schema
const OIDCConfigSchema = z.object({
  issuer: z.string().url('Valid issuer URL is required'),
  clientId: z.string().min(1, 'Client ID is required'),
  clientSecret: z.string().min(1, 'Client secret is required'),
  redirectUri: z.string().url('Valid redirect URI is required'),
  postLogoutRedirectUri: z.string().url('Valid post-logout redirect URI is required').optional(),
  scope: z.string().default('openid profile email'),
  responseType: z.enum(['code', 'id_token', 'token', 'code id_token', 'code token', 'id_token token', 'code id_token token']).default('code'),
  responseMode: z.enum(['query', 'fragment', 'form_post']).default('query'),
  prompt: z.enum(['none', 'login', 'consent', 'select_account']).optional(),
  maxAge: z.number().min(0).optional(),
  uiLocales: z.string().optional(),
  acrValues: z.string().optional(),
  discoveryUrl: z.string().url().optional(),
  jwksUri: z.string().url().optional(),
  clockTolerance: z.number().min(0).max(300).default(30), // 0 to 5 minutes
  tokenEndpointAuthMethod: z.enum(['client_secret_basic', 'client_secret_post', 'client_secret_jwt', 'private_key_jwt']).default('client_secret_basic')
});

// OAuth2 Configuration Schema
const OAuth2ConfigSchema = z.object({
  clientId: z.string().min(1, 'Client ID is required'),
  clientSecret: z.string().min(1, 'Client secret is required'),
  authorizationUrl: z.string().url('Valid authorization URL is required'),
  tokenUrl: z.string().url('Valid token URL is required'),
  userInfoUrl: z.string().url('Valid user info URL is required'),
  redirectUri: z.string().url('Valid redirect URI is required'),
  scope: z.string().default('read'),
  state: z.string().optional(),
  responseType: z.enum(['code', 'token']).default('code'),
  grantType: z.enum(['authorization_code', 'client_credentials', 'refresh_token']).default('authorization_code'),
  accessType: z.enum(['online', 'offline']).default('online'),
  approvalPrompt: z.enum(['auto', 'force']).default('auto'),
  tokenType: z.enum(['Bearer', 'MAC']).default('Bearer'),
  refreshTokenEnabled: z.boolean().default(true)
});

// LDAP Configuration Schema
const LDAPConfigSchema = z.object({
  host: z.string().min(1, 'LDAP host is required'),
  port: z.number().min(1).max(65535).default(389),
  secure: z.boolean().default(false),
  baseDN: z.string().min(1, 'Base DN is required'),
  bindDN: z.string().min(1, 'Bind DN is required'),
  bindPassword: z.string().min(1, 'Bind password is required'),
  userSearchBase: z.string().min(1, 'User search base is required'),
  userSearchFilter: z.string().min(1, 'User search filter is required'),
  userSearchScope: z.enum(['base', 'one', 'sub']).default('sub'),
  groupSearchBase: z.string().optional(),
  groupSearchFilter: z.string().optional(),
  groupSearchScope: z.enum(['base', 'one', 'sub']).default('sub'),
  groupMemberAttribute: z.string().optional(),
  timeout: z.number().min(1000).max(60000).default(5000), // 1 second to 1 minute
  connectTimeout: z.number().min(1000).max(30000).default(10000) // 1 second to 30 seconds
});

// Azure AD Configuration Schema
const AzureADConfigSchema = z.object({
  tenantId: z.string().min(1, 'Tenant ID is required'),
  clientId: z.string().min(1, 'Client ID is required'),
  clientSecret: z.string().min(1, 'Client secret is required'),
  authority: z.string().url().optional(),
  cloudInstance: z.enum(['AzurePublic', 'AzureChina', 'AzureGermany', 'AzureUsGovernment']).default('AzurePublic'),
  knownAuthorities: z.array(z.string().url()).optional(),
  redirectUri: z.string().url('Valid redirect URI is required'),
  postLogoutRedirectUri: z.string().url().optional(),
  scope: z.string().default('User.Read'),
  claims: z.string().optional(),
  extraQueryParameters: z.record(z.string()).optional()
});

// Google Workspace Configuration Schema
const GoogleWorkspaceConfigSchema = z.object({
  clientId: z.string().min(1, 'Client ID is required'),
  clientSecret: z.string().min(1, 'Client secret is required'),
  redirectUri: z.string().url('Valid redirect URI is required'),
  hostedDomain: z.string().optional(),
  accessType: z.enum(['online', 'offline']).default('online'),
  approvalPrompt: z.enum(['auto', 'force']).default('auto'),
  includeGrantedScopes: z.boolean().default(false),
  loginHint: z.string().optional(),
  prompt: z.enum(['none', 'consent', 'select_account']).optional()
});

// Okta Configuration Schema
const OktaConfigSchema = z.object({
  domain: z.string().min(1, 'Okta domain is required'),
  clientId: z.string().min(1, 'Client ID is required'),
  clientSecret: z.string().min(1, 'Client secret is required'),
  redirectUri: z.string().url('Valid redirect URI is required'),
  authorizationServerId: z.string().optional(),
  scope: z.string().default('openid profile email'),
  responseType: z.string().default('code'),
  responseMode: z.string().optional(),
  state: z.string().optional(),
  nonce: z.string().optional()
});

// PingIdentity Configuration Schema
const PingIdentityConfigSchema = z.object({
  baseUrl: z.string().url('Valid base URL is required'),
  clientId: z.string().min(1, 'Client ID is required'),
  clientSecret: z.string().min(1, 'Client secret is required'),
  redirectUri: z.string().url('Valid redirect URI is required'),
  environmentId: z.string().min(1, 'Environment ID is required'),
  scope: z.string().default('openid profile email'),
  responseType: z.string().default('code'),
  grantType: z.string().default('authorization_code')
});

// Attribute Mapping Schema
const AttributeMappingSchema = z.object({
  email: z.string().min(1, 'Email attribute mapping is required'),
  firstName: z.string().min(1, 'First name attribute mapping is required'),
  lastName: z.string().min(1, 'Last name attribute mapping is required'),
  displayName: z.string().optional(),
  department: z.string().optional(),
  title: z.string().optional(),
  phone: z.string().optional(),
  manager: z.string().optional(),
  employeeId: z.string().optional(),
  location: z.string().optional(),
  timezone: z.string().optional(),
  locale: z.string().optional(),
  groups: z.string().optional(),
  roles: z.string().optional(),
  customAttributes: z.record(z.string()).optional()
});

// Role Mapping Schema
const RoleMappingSchema = z.object({
  id: z.string().optional(),
  groupName: z.string().optional(),
  attributeName: z.string().optional(),
  attributeValue: z.string().optional(),
  role: z.nativeEnum(UserRole),
  conditions: z.array(z.object({
    type: z.enum(['attribute', 'group', 'email_domain', 'regex']),
    field: z.string().min(1),
    operator: z.enum(['equals', 'contains', 'starts_with', 'ends_with', 'regex', 'in']),
    value: z.union([z.string(), z.array(z.string())]),
    caseSensitive: z.boolean().default(false)
  })).optional(),
  priority: z.number().min(1).max(100).default(1)
}).refine(data => data.groupName || data.attributeName, {
  message: 'Either groupName or attributeName must be provided'
});

// Group Mapping Schema
const GroupMappingSchema = z.object({
  id: z.string().optional(),
  ssoGroupName: z.string().min(1, 'SSO group name is required'),
  localGroupId: z.string().min(1, 'Local group ID is required'),
  localGroupName: z.string().min(1, 'Local group name is required'),
  syncMembers: z.boolean().default(true),
  autoCreate: z.boolean().default(false)
});

// Complete SSO Provider Configuration Schema
const CompleteSSOProviderSchema = SSOProviderSchema.extend({
  saml: SAMLConfigSchema.optional(),
  oidc: OIDCConfigSchema.optional(),
  oauth2: OAuth2ConfigSchema.optional(),
  ldap: LDAPConfigSchema.optional(),
  azureAd: AzureADConfigSchema.optional(),
  googleWorkspace: GoogleWorkspaceConfigSchema.optional(),
  okta: OktaConfigSchema.optional(),
  pingIdentity: PingIdentityConfigSchema.optional(),
  attributeMapping: AttributeMappingSchema,
  roleMapping: z.array(RoleMappingSchema).optional(),
  groupMapping: z.array(GroupMappingSchema).optional()
}).refine(data => {
  // Ensure the appropriate configuration is provided based on provider type
  switch (data.provider) {
    case 'saml':
      return data.saml !== undefined;
    case 'oidc':
      return data.oidc !== undefined;
    case 'oauth2':
      return data.oauth2 !== undefined;
    case 'ldap':
      return data.ldap !== undefined;
    case 'azure-ad':
      return data.azureAd !== undefined;
    case 'google-workspace':
      return data.googleWorkspace !== undefined;
    case 'okta':
      return data.okta !== undefined;
    case 'ping-identity':
      return data.pingIdentity !== undefined;
    default:
      return false;
  }
}, {
  message: 'Provider-specific configuration is required'
});

// Provider Test Schema
const ProviderTestSchema = z.object({
  provider: z.enum(['saml', 'oidc', 'oauth2', 'ldap', 'azure-ad', 'google-workspace', 'okta', 'ping-identity']),
  testType: z.enum(['connectivity', 'metadata', 'authentication', 'full']).default('connectivity'),
  saml: SAMLConfigSchema.optional(),
  oidc: OIDCConfigSchema.optional(),
  oauth2: OAuth2ConfigSchema.optional(),
  ldap: LDAPConfigSchema.optional(),
  azureAd: AzureADConfigSchema.optional(),
  googleWorkspace: GoogleWorkspaceConfigSchema.optional(),
  okta: OktaConfigSchema.optional(),
  pingIdentity: PingIdentityConfigSchema.optional()
});

/**
 * Validate SSO Provider Configuration
 */
export const validateSSOConfig = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const validationResult = CompleteSSOProviderSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
        code: err.code
      }));

      logger.warn('SSO configuration validation failed:', errors);
      
      res.status(400).json({
        success: false,
        message: 'Invalid SSO configuration',
        errors
      });
      return;
    }

    // Additional business logic validation
    const config = validationResult.data;
    
    // Validate certificate format for SAML
    if (config.provider === 'saml' && config.saml) {
      if (!isValidX509Certificate(config.saml.x509Certificate)) {
        res.status(400).json({
          success: false,
          message: 'Invalid X.509 certificate format'
        });
        return;
      }
    }

    // Validate URL accessibility (optional)
    if (config.provider === 'oidc' && config.oidc) {
      if (!isValidUrl(config.oidc.issuer)) {
        res.status(400).json({
          success: false,
          message: 'OIDC issuer URL is not valid'
        });
        return;
      }
    }

    // Replace request body with validated data
    req.body = validationResult.data;
    next();
  } catch (error) {
    logger.error('Error in SSO configuration validation:', error);
    res.status(500).json({
      success: false,
      message: 'Validation error'
    });
  }
};

/**
 * Validate Provider Test Configuration
 */
export const validateProviderTest = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const validationResult = ProviderTestSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
        code: err.code
      }));

      logger.warn('Provider test validation failed:', errors);
      
      res.status(400).json({
        success: false,
        message: 'Invalid provider test configuration',
        errors
      });
      return;
    }

    req.body = validationResult.data;
    next();
  } catch (error) {
    logger.error('Error in provider test validation:', error);
    res.status(500).json({
      success: false,
      message: 'Validation error'
    });
  }
};

/**
 * Validate User Provisioning Data
 */
export const validateUserProvisioning = (req: Request, res: Response, next: NextFunction): void => {
  const UserProvisioningSchema = z.object({
    email: z.string().email('Valid email is required'),
    firstName: z.string().min(1, 'First name is required'),
    lastName: z.string().min(1, 'Last name is required'),
    role: z.nativeEnum(UserRole),
    groups: z.array(z.string()).optional(),
    attributes: z.record(z.any()).optional(),
    autoActivate: z.boolean().default(true),
    sendWelcomeEmail: z.boolean().default(false)
  });

  try {
    const validationResult = UserProvisioningSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
        code: err.code
      }));

      res.status(400).json({
        success: false,
        message: 'Invalid user provisioning data',
        errors
      });
      return;
    }

    req.body = validationResult.data;
    next();
  } catch (error) {
    logger.error('Error in user provisioning validation:', error);
    res.status(500).json({
      success: false,
      message: 'Validation error'
    });
  }
};

// Helper functions

/**
 * Validate X.509 certificate format
 */
function isValidX509Certificate(certificate: string): boolean {
  try {
    // Basic format check - X.509 certificates should start and end with specific markers
    const trimmed = certificate.trim();
    return trimmed.startsWith('-----BEGIN CERTIFICATE-----') && 
           trimmed.endsWith('-----END CERTIFICATE-----');
  } catch {
    return false;
  }
}

/**
 * Validate URL format and basic accessibility
 */
function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate email domain format
 */
export function isValidEmailDomain(domain: string): boolean {
  const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return domainRegex.test(domain);
}

/**
 * Validate attribute mapping
 */
export function validateAttributeMapping(mapping: any, requiredAttributes: string[]): boolean {
  for (const required of requiredAttributes) {
    if (!mapping[required] || typeof mapping[required] !== 'string') {
      return false;
    }
  }
  return true;
}

/**
 * Sanitize SSO configuration for logging (remove sensitive data)
 */
export function sanitizeSSOConfig(config: any): any {
  const sanitized = { ...config };
  
  // Remove sensitive fields
  const sensitiveFields = [
    'clientSecret',
    'privateKey',
    'bindPassword',
    'x509Certificate'
  ];
  
  function removeSensitive(obj: any, path: string = ''): any {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }
    
    const result: any = Array.isArray(obj) ? [] : {};
    
    for (const [key, value] of Object.entries(obj)) {
      const currentPath = path ? `${path}.${key}` : key;
      
      if (sensitiveFields.includes(key)) {
        result[key] = '***REDACTED***';
      } else if (typeof value === 'object' && value !== null) {
        result[key] = removeSensitive(value, currentPath);
      } else {
        result[key] = value;
      }
    }
    
    return result;
  }
  
  return removeSensitive(sanitized);
}

// Export schemas for testing
export {
  CompleteSSOProviderSchema,
  SAMLConfigSchema,
  OIDCConfigSchema,
  OAuth2ConfigSchema,
  LDAPConfigSchema,
  AzureADConfigSchema,
  GoogleWorkspaceConfigSchema,
  OktaConfigSchema,
  PingIdentityConfigSchema,
  AttributeMappingSchema,
  RoleMappingSchema,
  GroupMappingSchema,
  ProviderTestSchema
};