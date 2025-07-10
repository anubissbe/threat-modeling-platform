/**
 * Enterprise SSO Configuration Templates
 * Pre-configured templates for popular identity providers
 */

import { SSOProviderConfig } from '../types/enterprise-sso';
import { UserRole } from '../types/auth';

export class SSOConfigurationTemplates {
  /**
   * Microsoft Azure AD / Entra ID Template
   */
  static createAzureADTemplate(organizationId: string, domain: string): SSOProviderConfig {
    return {
      organizationId,
      provider: 'azure-ad',
      name: 'Microsoft Azure AD',
      description: 'Microsoft Azure Active Directory / Entra ID integration',
      status: 'inactive',
      autoProvisioning: true,
      justInTimeProvisioning: true,
      
      azureAd: {
        tenantId: '', // To be filled by admin
        clientId: '', // To be filled by admin
        clientSecret: '', // To be filled by admin
        authority: `https://login.microsoftonline.com/`, // Will be completed with tenantId
        cloudInstance: 'AzurePublic',
        redirectUri: `https://${domain}/api/auth/sso/callback/azure-ad`,
        postLogoutRedirectUri: `https://${domain}/logout-success`,
        scope: 'openid profile email User.Read',
        claims: 'email,given_name,family_name,name,oid,preferred_username'
      },
      
      attributeMapping: {
        email: 'email',
        firstName: 'given_name',
        lastName: 'family_name',
        displayName: 'name',
        employeeId: 'oid',
        department: 'department',
        title: 'jobTitle',
        groups: 'groups'
      },
      
      roleMapping: [
        {
          groupName: 'ThreatModel-Admins',
          role: UserRole.ADMIN,
          priority: 100
        },
        {
          groupName: 'ThreatModel-SecurityArchitects',
          role: UserRole.ARCHITECT,
          priority: 90
        },
        {
          groupName: 'ThreatModel-Analysts',
          role: UserRole.SECURITY_ANALYST,
          priority: 80
        },
        {
          groupName: 'ThreatModel-Developers',
          role: UserRole.DEVELOPER,
          priority: 70
        },
        {
          attributeName: 'department',
          attributeValue: 'Security',
          role: UserRole.SECURITY_ANALYST,
          priority: 60
        }
      ],
      
      certificateValidation: true,
      signatureValidation: true,
      encryptionRequired: false,
      sessionTimeout: 480, // 8 hours
      maxConcurrentSessions: 3,
      auditLogging: true,
      complianceMode: 'strict',
      dataRetentionDays: 365
    };
  }

  /**
   * Google Workspace Template
   */
  static createGoogleWorkspaceTemplate(organizationId: string, domain: string, hostedDomain?: string): SSOProviderConfig {
    return {
      organizationId,
      provider: 'google-workspace',
      name: 'Google Workspace',
      description: 'Google Workspace (G Suite) integration',
      status: 'inactive',
      autoProvisioning: true,
      justInTimeProvisioning: true,
      
      googleWorkspace: {
        clientId: '', // To be filled by admin
        clientSecret: '', // To be filled by admin
        redirectUri: `https://${domain}/api/auth/sso/callback/google-workspace`,
        hostedDomain: hostedDomain,
        accessType: 'offline',
        approvalPrompt: 'auto',
        includeGrantedScopes: true,
        prompt: 'select_account'
      },
      
      attributeMapping: {
        email: 'email',
        firstName: 'given_name',
        lastName: 'family_name',
        displayName: 'name',
        groups: 'groups'
      },
      
      roleMapping: [
        {
          attributeName: 'hd',
          attributeValue: hostedDomain || '',
          role: UserRole.VIEWER,
          priority: 50
        }
      ],
      
      certificateValidation: true,
      signatureValidation: true,
      encryptionRequired: false,
      sessionTimeout: 480,
      maxConcurrentSessions: 5,
      auditLogging: true,
      complianceMode: 'normal',
      dataRetentionDays: 365
    };
  }

  /**
   * Okta Template
   */
  static createOktaTemplate(organizationId: string, domain: string, oktaDomain: string): SSOProviderConfig {
    return {
      organizationId,
      provider: 'okta',
      name: 'Okta',
      description: 'Okta identity provider integration',
      status: 'inactive',
      autoProvisioning: true,
      justInTimeProvisioning: true,
      
      okta: {
        domain: oktaDomain,
        clientId: '', // To be filled by admin
        clientSecret: '', // To be filled by admin
        redirectUri: `https://${domain}/api/auth/sso/callback/okta`,
        scope: 'openid profile email groups',
        responseType: 'code',
        responseMode: 'query'
      },
      
      attributeMapping: {
        email: 'email',
        firstName: 'given_name',
        lastName: 'family_name',
        displayName: 'name',
        groups: 'groups'
      },
      
      roleMapping: [
        {
          groupName: 'ThreatModeling-Admin',
          role: UserRole.ADMIN,
          priority: 100
        },
        {
          groupName: 'ThreatModeling-SecurityTeam',
          role: UserRole.ARCHITECT,
          priority: 90
        },
        {
          groupName: 'Everyone',
          role: UserRole.VIEWER,
          priority: 10
        }
      ],
      
      certificateValidation: true,
      signatureValidation: true,
      encryptionRequired: false,
      sessionTimeout: 240, // 4 hours
      maxConcurrentSessions: 3,
      auditLogging: true,
      complianceMode: 'strict',
      dataRetentionDays: 730 // 2 years for compliance
    };
  }

  /**
   * Generic SAML 2.0 Template
   */
  static createSAMLTemplate(organizationId: string, domain: string): SSOProviderConfig {
    return {
      organizationId,
      provider: 'saml',
      name: 'SAML 2.0 Provider',
      description: 'Generic SAML 2.0 identity provider',
      status: 'inactive',
      autoProvisioning: false, // Conservative default
      justInTimeProvisioning: false,
      
      saml: {
        entityId: `https://${domain}/saml/metadata`,
        ssoUrl: '', // To be filled by admin
        sloUrl: '', // To be filled by admin
        metadataUrl: '', // To be filled by admin
        x509Certificate: '', // To be filled by admin
        callbackUrl: `https://${domain}/api/auth/sso/callback/saml`,
        signatureAlgorithm: 'sha256',
        digestAlgorithm: 'sha256',
        wantAssertionsSigned: true,
        wantAuthnResponseSigned: true,
        acceptedClockSkewMs: 0,
        nameIdFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
        forceAuthn: false,
        passive: false
      },
      
      attributeMapping: {
        email: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
        firstName: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname',
        lastName: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname',
        displayName: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name',
        groups: 'http://schemas.microsoft.com/ws/2008/06/identity/claims/groups'
      },
      
      roleMapping: [
        {
          attributeName: 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role',
          attributeValue: 'Admin',
          role: UserRole.ADMIN,
          priority: 100
        },
        {
          attributeName: 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role',
          attributeValue: 'SecurityArchitect',
          role: UserRole.ARCHITECT,
          priority: 90
        }
      ],
      
      certificateValidation: true,
      signatureValidation: true,
      encryptionRequired: true,
      sessionTimeout: 480,
      maxConcurrentSessions: 2,
      auditLogging: true,
      complianceMode: 'strict',
      dataRetentionDays: 365
    };
  }

  /**
   * Generic OIDC Template
   */
  static createOIDCTemplate(organizationId: string, domain: string): SSOProviderConfig {
    return {
      organizationId,
      provider: 'oidc',
      name: 'OpenID Connect Provider',
      description: 'Generic OpenID Connect identity provider',
      status: 'inactive',
      autoProvisioning: false,
      justInTimeProvisioning: false,
      
      oidc: {
        issuer: '', // To be filled by admin
        clientId: '', // To be filled by admin
        clientSecret: '', // To be filled by admin
        redirectUri: `https://${domain}/api/auth/sso/callback/oidc`,
        postLogoutRedirectUri: `https://${domain}/logout-success`,
        scope: 'openid profile email',
        responseType: 'code',
        responseMode: 'query',
        prompt: 'login',
        maxAge: 3600,
        clockTolerance: 300,
        tokenEndpointAuthMethod: 'client_secret_post'
      },
      
      attributeMapping: {
        email: 'email',
        firstName: 'given_name',
        lastName: 'family_name',
        displayName: 'name',
        groups: 'groups'
      },
      
      roleMapping: [
        {
          attributeName: 'groups',
          attributeValue: 'admin',
          role: UserRole.ADMIN,
          priority: 100
        }
      ],
      
      certificateValidation: true,
      signatureValidation: true,
      encryptionRequired: false,
      sessionTimeout: 240,
      maxConcurrentSessions: 3,
      auditLogging: true,
      complianceMode: 'normal',
      dataRetentionDays: 365
    };
  }

  /**
   * PingIdentity Template
   */
  static createPingIdentityTemplate(organizationId: string, domain: string, environmentId: string): SSOProviderConfig {
    return {
      organizationId,
      provider: 'ping-identity',
      name: 'PingIdentity',
      description: 'PingIdentity Cloud integration',
      status: 'inactive',
      autoProvisioning: true,
      justInTimeProvisioning: true,
      
      pingIdentity: {
        baseUrl: `https://auth.pingone.com/${environmentId}/as`,
        clientId: '', // To be filled by admin
        clientSecret: '', // To be filled by admin
        redirectUri: `https://${domain}/api/auth/sso/callback/ping-identity`,
        environmentId,
        scope: 'openid profile email',
        responseType: 'code',
        grantType: 'authorization_code'
      },
      
      attributeMapping: {
        email: 'email',
        firstName: 'given_name',
        lastName: 'family_name',
        displayName: 'name',
        groups: 'memberOf'
      },
      
      roleMapping: [
        {
          groupName: 'ThreatModel-Administrators',
          role: UserRole.ADMIN,
          priority: 100
        },
        {
          groupName: 'Security-Team',
          role: UserRole.ARCHITECT,
          priority: 90
        }
      ],
      
      certificateValidation: true,
      signatureValidation: true,
      encryptionRequired: false,
      sessionTimeout: 480,
      maxConcurrentSessions: 5,
      auditLogging: true,
      complianceMode: 'strict',
      dataRetentionDays: 1095 // 3 years
    };
  }

  /**
   * Get all available templates
   */
  static getAllTemplates(): Array<{
    provider: string;
    name: string;
    description: string;
    requiredParams: string[];
  }> {
    return [
      {
        provider: 'azure-ad',
        name: 'Microsoft Azure AD / Entra ID',
        description: 'Enterprise-grade identity management with Microsoft Azure Active Directory',
        requiredParams: ['organizationId', 'domain', 'tenantId', 'clientId', 'clientSecret']
      },
      {
        provider: 'google-workspace',
        name: 'Google Workspace',
        description: 'Google Workspace (formerly G Suite) integration',
        requiredParams: ['organizationId', 'domain', 'clientId', 'clientSecret', 'hostedDomain?']
      },
      {
        provider: 'okta',
        name: 'Okta',
        description: 'Okta identity and access management platform',
        requiredParams: ['organizationId', 'domain', 'oktaDomain', 'clientId', 'clientSecret']
      },
      {
        provider: 'saml',
        name: 'Generic SAML 2.0',
        description: 'Standards-based SAML 2.0 for enterprise identity providers',
        requiredParams: ['organizationId', 'domain', 'ssoUrl', 'x509Certificate']
      },
      {
        provider: 'oidc',
        name: 'OpenID Connect',
        description: 'Modern OpenID Connect for identity and authentication',
        requiredParams: ['organizationId', 'domain', 'issuer', 'clientId', 'clientSecret']
      },
      {
        provider: 'ping-identity',
        name: 'PingIdentity',
        description: 'PingIdentity Cloud identity management platform',
        requiredParams: ['organizationId', 'domain', 'environmentId', 'clientId', 'clientSecret']
      }
    ];
  }

  /**
   * Generate security recommendations for SSO configuration
   */
  static generateSecurityRecommendations(provider: string): string[] {
    const baseRecommendations = [
      'Enable multi-factor authentication (MFA) at the identity provider',
      'Use certificate-based authentication where possible',
      'Implement session timeout policies',
      'Enable audit logging for all SSO activities',
      'Regularly rotate client secrets and certificates',
      'Use encrypted assertions for SAML',
      'Implement IP allowlisting for administrative access',
      'Enable single logout (SLO) to prevent session persistence'
    ];

    const providerSpecific: Record<string, string[]> = {
      'azure-ad': [
        'Enable Azure AD Conditional Access policies',
        'Use Azure AD Identity Protection for risk-based authentication',
        'Configure Azure AD Privileged Identity Management (PIM)',
        'Enable Azure AD audit logs integration'
      ],
      'google-workspace': [
        'Enable 2-Step Verification for all users',
        'Configure Google Workspace security center monitoring',
        'Use domain-restricted authentication',
        'Enable Google Workspace audit logs'
      ],
      'okta': [
        'Configure Okta Adaptive MFA policies',
        'Enable Okta ThreatInsight for suspicious activity detection',
        'Use Okta device trust policies',
        'Configure Okta API access management'
      ],
      'saml': [
        'Validate SAML assertions are signed',
        'Use short-lived SAML assertions (max 5 minutes)',
        'Implement SAML encryption for sensitive data',
        'Validate certificate chain and expiration'
      ],
      'oidc': [
        'Use PKCE (Proof Key for Code Exchange) for public clients',
        'Validate JWT tokens using public keys',
        'Implement token refresh rotation',
        'Use the state parameter to prevent CSRF attacks'
      ]
    };

    return [...baseRecommendations, ...(providerSpecific[provider] || [])];
  }

  /**
   * Validate SSO configuration for security best practices
   */
  static validateConfiguration(config: SSOProviderConfig): {
    isValid: boolean;
    warnings: string[];
    errors: string[];
    recommendations: string[];
  } {
    const warnings: string[] = [];
    const errors: string[] = [];
    const recommendations: string[] = [];

    // Check session timeout
    if (config.sessionTimeout > 480) {
      warnings.push('Session timeout exceeds 8 hours - consider shorter sessions for security');
    }

    // Check auto-provisioning
    if (config.autoProvisioning && config.complianceMode === 'strict') {
      warnings.push('Auto-provisioning enabled in strict compliance mode - ensure proper approval workflows');
    }

    // Check certificate validation
    if (!config.certificateValidation) {
      errors.push('Certificate validation must be enabled for production environments');
    }

    // Check audit logging
    if (!config.auditLogging) {
      errors.push('Audit logging must be enabled for compliance and security');
    }

    // Provider-specific validations
    switch (config.provider) {
      case 'saml':
        if (config.saml && !config.saml.wantAssertionsSigned) {
          warnings.push('SAML assertions should be signed for security');
        }
        if (config.saml && config.saml.signatureAlgorithm === 'sha1') {
          errors.push('SHA-1 signature algorithm is deprecated - use SHA-256 or higher');
        }
        break;
      
      case 'oidc':
        if (config.oidc && !config.oidc.scope?.includes('openid')) {
          errors.push('OIDC scope must include "openid"');
        }
        break;
    }

    // Generate recommendations
    recommendations.push(...this.generateSecurityRecommendations(config.provider));

    return {
      isValid: errors.length === 0,
      warnings,
      errors,
      recommendations
    };
  }
}

/**
 * SSO Configuration Wizard
 * Helps administrators set up SSO providers step by step
 */
export class SSOConfigurationWizard {
  static generateConfigurationSteps(provider: string): Array<{
    step: number;
    title: string;
    description: string;
    fields: Array<{
      name: string;
      type: 'text' | 'password' | 'url' | 'certificate' | 'select' | 'boolean';
      required: boolean;
      description: string;
      placeholder?: string;
      options?: string[];
    }>;
  }> {
    const commonSteps = [
      {
        step: 1,
        title: 'Basic Configuration',
        description: 'Configure basic provider information',
        fields: [
          {
            name: 'name',
            type: 'text' as const,
            required: true,
            description: 'Display name for this SSO provider',
            placeholder: 'My Company SSO'
          },
          {
            name: 'description',
            type: 'text' as const,
            required: false,
            description: 'Optional description for this provider',
            placeholder: 'Single sign-on for company employees'
          },
          {
            name: 'autoProvisioning',
            type: 'boolean' as const,
            required: true,
            description: 'Automatically create user accounts on first login'
          }
        ]
      }
    ];

    const providerSteps: Record<string, any[]> = {
      'azure-ad': [
        {
          step: 2,
          title: 'Azure AD Configuration',
          description: 'Configure Microsoft Azure AD connection',
          fields: [
            {
              name: 'tenantId',
              type: 'text',
              required: true,
              description: 'Azure AD Tenant ID (Directory ID)',
              placeholder: '12345678-1234-1234-1234-123456789012'
            },
            {
              name: 'clientId',
              type: 'text',
              required: true,
              description: 'Application (Client) ID from Azure AD app registration',
              placeholder: '87654321-4321-4321-4321-210987654321'
            },
            {
              name: 'clientSecret',
              type: 'password',
              required: true,
              description: 'Client secret from Azure AD app registration'
            }
          ]
        }
      ],
      'okta': [
        {
          step: 2,
          title: 'Okta Configuration',
          description: 'Configure Okta identity provider',
          fields: [
            {
              name: 'domain',
              type: 'text',
              required: true,
              description: 'Your Okta domain',
              placeholder: 'your-company.okta.com'
            },
            {
              name: 'clientId',
              type: 'text',
              required: true,
              description: 'Client ID from Okta application'
            },
            {
              name: 'clientSecret',
              type: 'password',
              required: true,
              description: 'Client secret from Okta application'
            }
          ]
        }
      ]
    };

    const attributeMappingStep = {
      step: 3,
      title: 'Attribute Mapping',
      description: 'Map identity provider attributes to user fields',
      fields: [
        {
          name: 'email',
          type: 'text',
          required: true,
          description: 'Attribute name for email address',
          placeholder: 'email'
        },
        {
          name: 'firstName',
          type: 'text',
          required: true,
          description: 'Attribute name for first name',
          placeholder: 'given_name'
        },
        {
          name: 'lastName',
          type: 'text',
          required: true,
          description: 'Attribute name for last name',
          placeholder: 'family_name'
        },
        {
          name: 'groups',
          type: 'text',
          required: false,
          description: 'Attribute name for group membership',
          placeholder: 'groups'
        }
      ]
    };

    const securityStep = {
      step: 4,
      title: 'Security Settings',
      description: 'Configure security and session policies',
      fields: [
        {
          name: 'sessionTimeout',
          type: 'select',
          required: true,
          description: 'Session timeout duration',
          options: ['60', '120', '240', '480', '720']
        },
        {
          name: 'maxConcurrentSessions',
          type: 'select',
          required: true,
          description: 'Maximum concurrent sessions per user',
          options: ['1', '2', '3', '5', '10']
        },
        {
          name: 'complianceMode',
          type: 'select',
          required: true,
          description: 'Compliance mode for audit and security',
          options: ['relaxed', 'normal', 'strict']
        }
      ]
    };

    return [
      ...commonSteps,
      ...(providerSteps[provider] || []),
      attributeMappingStep,
      securityStep
    ];
  }
}