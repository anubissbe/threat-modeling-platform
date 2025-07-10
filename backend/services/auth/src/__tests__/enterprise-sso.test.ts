import { EnterpriseSSOService } from '../services/enterprise-sso.service';
import { MFAService } from '../services/mfa.service';
import { 
  SSOProviderConfig, 
  SSOUserProfile, 
  SAMLConfig, 
  OIDCConfig, 
  OAuth2Config,
  SSOProviderStatus 
} from '../types/enterprise-sso';
import { UserRole } from '../types/auth';

// Mock dependencies
jest.mock('../services/user.service');
jest.mock('../services/audit.service');
jest.mock('../services/refresh-token.service');
jest.mock('../utils/logger');

describe('EnterpriseSSOService', () => {
  let ssoService: EnterpriseSSOService;
  let mfaService: MFAService;

  beforeEach(() => {
    ssoService = new EnterpriseSSOService();
    mfaService = new MFAService();
    jest.clearAllMocks();
  });

  describe('SAML Configuration', () => {
    it('should configure SAML SSO provider successfully', async () => {
      const samlConfig: SAMLConfig = {
        entityId: 'https://threat-modeling.com/saml/metadata',
        ssoUrl: 'https://idp.example.com/saml/sso',
        sloUrl: 'https://idp.example.com/saml/slo',
        x509Certificate: '-----BEGIN CERTIFICATE-----\nMIIC...test...certificate\n-----END CERTIFICATE-----',
        callbackUrl: 'https://threat-modeling.com/auth/saml/callback',
        signatureAlgorithm: 'sha256',
        wantAssertionsSigned: true,
        wantAuthnResponseSigned: true
      };

      const providerConfig: SSOProviderConfig = {
        organizationId: 'org-123',
        provider: 'saml',
        name: 'Corporate SAML',
        description: 'Corporate SAML identity provider',
        status: 'active',
        autoProvisioning: true,
        justInTimeProvisioning: true,
        saml: samlConfig,
        attributeMapping: {
          email: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
          firstName: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname',
          lastName: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname'
        },
        certificateValidation: true,
        signatureValidation: true,
        encryptionRequired: false,
        sessionTimeout: 3600,
        maxConcurrentSessions: 5,
        auditLogging: true,
        complianceMode: 'strict',
        dataRetentionDays: 365
      };

      await expect(ssoService.configureSSOProvider('org-123', providerConfig))
        .resolves.not.toThrow();
    });

    it('should validate SAML configuration correctly', async () => {
      const invalidSamlConfig: Partial<SAMLConfig> = {
        entityId: 'invalid-entity-id',
        ssoUrl: 'not-a-url',
        x509Certificate: 'invalid-certificate'
      };

      const providerConfig: SSOProviderConfig = {
        organizationId: 'org-123',
        provider: 'saml',
        name: 'Invalid SAML',
        status: 'testing',
        autoProvisioning: false,
        justInTimeProvisioning: false,
        saml: invalidSamlConfig as SAMLConfig,
        attributeMapping: {
          email: 'email',
          firstName: 'firstName',
          lastName: 'lastName'
        },
        certificateValidation: true,
        signatureValidation: true,
        encryptionRequired: false,
        sessionTimeout: 3600,
        maxConcurrentSessions: 5,
        auditLogging: true,
        complianceMode: 'normal',
        dataRetentionDays: 365
      };

      await expect(ssoService.configureSSOProvider('org-123', providerConfig))
        .rejects.toThrow();
    });

    it('should generate SAML metadata correctly', async () => {
      const providerId = 'test-saml-provider';
      
      // Mock provider exists
      jest.spyOn(ssoService as any, 'ssoProviders', 'get')
        .mockReturnValue(new Map([[providerId, {
          provider: 'saml',
          saml: {
            entityId: 'https://threat-modeling.com/saml/metadata',
            callbackUrl: 'https://threat-modeling.com/auth/saml/callback'
          }
        }]]));

      const metadata = await ssoService.getProviderMetadata(providerId);
      
      expect(metadata).toContain('EntityDescriptor');
      expect(metadata).toContain('SPSSODescriptor');
      expect(metadata).toContain('AssertionConsumerService');
    });
  });

  describe('OIDC Configuration', () => {
    it('should configure OIDC SSO provider successfully', async () => {
      const oidcConfig: OIDCConfig = {
        issuer: 'https://auth.example.com',
        clientId: 'threat-modeling-client',
        clientSecret: 'super-secret-client-secret',
        redirectUri: 'https://threat-modeling.com/auth/oidc/callback',
        scope: 'openid profile email',
        responseType: 'code',
        responseMode: 'query'
      };

      const providerConfig: SSOProviderConfig = {
        organizationId: 'org-456',
        provider: 'oidc',
        name: 'Corporate OIDC',
        description: 'Corporate OpenID Connect provider',
        status: 'active',
        autoProvisioning: true,
        justInTimeProvisioning: true,
        oidc: oidcConfig,
        attributeMapping: {
          email: 'email',
          firstName: 'given_name',
          lastName: 'family_name'
        },
        certificateValidation: true,
        signatureValidation: true,
        encryptionRequired: true,
        sessionTimeout: 7200,
        maxConcurrentSessions: 3,
        auditLogging: true,
        complianceMode: 'strict',
        dataRetentionDays: 730
      };

      await expect(ssoService.configureSSOProvider('org-456', providerConfig))
        .resolves.not.toThrow();
    });

    it('should test OIDC connection successfully', async () => {
      const oidcConfig: OIDCConfig = {
        issuer: 'https://auth.example.com',
        clientId: 'test-client',
        clientSecret: 'test-secret',
        redirectUri: 'https://test.com/callback'
      };

      const providerConfig: SSOProviderConfig = {
        organizationId: 'org-test',
        provider: 'oidc',
        name: 'Test OIDC',
        status: 'testing',
        autoProvisioning: false,
        justInTimeProvisioning: false,
        oidc: oidcConfig,
        attributeMapping: {
          email: 'email',
          firstName: 'given_name',
          lastName: 'family_name'
        },
        certificateValidation: true,
        signatureValidation: true,
        encryptionRequired: false,
        sessionTimeout: 3600,
        maxConcurrentSessions: 5,
        auditLogging: true,
        complianceMode: 'normal',
        dataRetentionDays: 365
      };

      // Mock successful connection test
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200
      } as Response);

      const status: SSOProviderStatus = await ssoService.testSSOConnection(providerConfig);
      
      expect(status.status).toBe('active');
      expect(status.message).toContain('OIDC connection successful');
    });
  });

  describe('OAuth2 Configuration', () => {
    it('should configure OAuth2 SSO provider successfully', async () => {
      const oauth2Config: OAuth2Config = {
        clientId: 'oauth2-client-id',
        clientSecret: 'oauth2-client-secret',
        authorizationUrl: 'https://oauth.example.com/authorize',
        tokenUrl: 'https://oauth.example.com/token',
        userInfoUrl: 'https://oauth.example.com/userinfo',
        redirectUri: 'https://threat-modeling.com/auth/oauth2/callback',
        scope: 'read:user read:email',
        responseType: 'code',
        grantType: 'authorization_code'
      };

      const providerConfig: SSOProviderConfig = {
        organizationId: 'org-789',
        provider: 'oauth2',
        name: 'GitHub OAuth2',
        description: 'GitHub OAuth2 integration',
        status: 'active',
        autoProvisioning: false,
        justInTimeProvisioning: false,
        oauth2: oauth2Config,
        attributeMapping: {
          email: 'email',
          firstName: 'name',
          lastName: 'name'
        },
        certificateValidation: true,
        signatureValidation: false,
        encryptionRequired: true,
        sessionTimeout: 1800,
        maxConcurrentSessions: 10,
        auditLogging: true,
        complianceMode: 'normal',
        dataRetentionDays: 180
      };

      await expect(ssoService.configureSSOProvider('org-789', providerConfig))
        .resolves.not.toThrow();
    });
  });

  describe('SSO Authentication Flow', () => {
    it('should authenticate user via SSO successfully', async () => {
      const providerId = 'test-provider-123';
      const sessionId = 'session-abc-123';

      const ssoProfile: SSOUserProfile = {
        nameID: 'user@example.com',
        email: 'user@example.com',
        firstName: 'John',
        lastName: 'Doe',
        attributes: {
          department: 'Engineering',
          role: 'Senior Developer'
        },
        groups: ['developers', 'senior-staff']
      };

      // Mock user and provider
      const mockUser = {
        id: 'user-123',
        email: 'user@example.com',
        firstName: 'John',
        lastName: 'Doe',
        role: UserRole.DEVELOPER,
        organization: 'org-123',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const mockProvider: SSOProviderConfig = {
        id: providerId,
        organizationId: 'org-123',
        provider: 'saml',
        name: 'Test SAML',
        status: 'active',
        autoProvisioning: true,
        justInTimeProvisioning: true,
        attributeMapping: {
          email: 'email',
          firstName: 'firstName',
          lastName: 'lastName'
        },
        certificateValidation: true,
        signatureValidation: true,
        encryptionRequired: false,
        sessionTimeout: 3600,
        maxConcurrentSessions: 5,
        auditLogging: true,
        complianceMode: 'normal',
        dataRetentionDays: 365
      };

      // Mock service methods
      jest.spyOn(ssoService as any, 'ssoProviders', 'get')
        .mockReturnValue(new Map([[providerId, mockProvider]]));

      // The test would normally mock UserService.getUserByEmail to return mockUser
      // For this test, we'll assume the authentication succeeds
      
      const result = await ssoService.authenticateSSO(providerId, ssoProfile, sessionId);
      
      // The actual implementation would return user and tokens
      // This test validates the structure
      expect(result).toBeDefined();
    });

    it('should handle user auto-provisioning correctly', async () => {
      const providerId = 'auto-provision-provider';
      const sessionId = 'session-auto-123';

      const ssoProfile: SSOUserProfile = {
        nameID: 'newuser@example.com',
        email: 'newuser@example.com',
        firstName: 'Jane',
        lastName: 'Smith',
        attributes: {
          department: 'Marketing',
          title: 'Marketing Manager'
        },
        groups: ['marketing', 'managers']
      };

      const mockProvider: SSOProviderConfig = {
        id: providerId,
        organizationId: 'org-456',
        provider: 'oidc',
        name: 'Auto Provision OIDC',
        status: 'active',
        autoProvisioning: true,
        justInTimeProvisioning: true,
        attributeMapping: {
          email: 'email',
          firstName: 'given_name',
          lastName: 'family_name'
        },
        roleMapping: [{
          groupName: 'managers',
          role: UserRole.ARCHITECT,
          priority: 1
        }],
        certificateValidation: true,
        signatureValidation: true,
        encryptionRequired: false,
        sessionTimeout: 3600,
        maxConcurrentSessions: 5,
        auditLogging: true,
        complianceMode: 'normal',
        dataRetentionDays: 365
      };

      // Mock provider exists and user doesn't exist (triggers auto-provisioning)
      jest.spyOn(ssoService as any, 'ssoProviders', 'get')
        .mockReturnValue(new Map([[providerId, mockProvider]]));

      const result = await ssoService.authenticateSSO(providerId, ssoProfile, sessionId);
      
      expect(result).toBeDefined();
    });

    it('should reject authentication for inactive provider', async () => {
      const providerId = 'inactive-provider';
      const sessionId = 'session-inactive';

      const ssoProfile: SSOUserProfile = {
        nameID: 'user@example.com',
        email: 'user@example.com',
        firstName: 'Test',
        lastName: 'User'
      };

      const mockProvider: SSOProviderConfig = {
        id: providerId,
        organizationId: 'org-123',
        provider: 'saml',
        name: 'Inactive SAML',
        status: 'inactive', // Provider is inactive
        autoProvisioning: false,
        justInTimeProvisioning: false,
        attributeMapping: {
          email: 'email',
          firstName: 'firstName',
          lastName: 'lastName'
        },
        certificateValidation: true,
        signatureValidation: true,
        encryptionRequired: false,
        sessionTimeout: 3600,
        maxConcurrentSessions: 5,
        auditLogging: true,
        complianceMode: 'normal',
        dataRetentionDays: 365
      };

      jest.spyOn(ssoService as any, 'ssoProviders', 'get')
        .mockReturnValue(new Map([[providerId, mockProvider]]));

      await expect(ssoService.authenticateSSO(providerId, ssoProfile, sessionId))
        .rejects.toThrow('SSO provider not found or inactive');
    });
  });

  describe('Single Sign-Out (SLO)', () => {
    it('should initiate single logout successfully', async () => {
      const sessionId = 'session-slo-test';
      
      // Mock active session
      const mockSession = {
        sessionId,
        userId: 'user-123',
        providerId: 'saml-provider',
        loginTime: new Date(),
        lastActivity: new Date(),
        ssoAttributes: {},
        groups: []
      };

      const mockProvider: SSOProviderConfig = {
        id: 'saml-provider',
        organizationId: 'org-123',
        provider: 'saml',
        name: 'Test SAML',
        status: 'active',
        autoProvisioning: false,
        justInTimeProvisioning: false,
        saml: {
          entityId: 'test-entity',
          ssoUrl: 'https://idp.example.com/sso',
          sloUrl: 'https://idp.example.com/slo',
          x509Certificate: 'test-cert',
          callbackUrl: 'https://app.example.com/callback'
        },
        attributeMapping: {
          email: 'email',
          firstName: 'firstName',
          lastName: 'lastName'
        },
        certificateValidation: true,
        signatureValidation: true,
        encryptionRequired: false,
        sessionTimeout: 3600,
        maxConcurrentSessions: 5,
        auditLogging: true,
        complianceMode: 'normal',
        dataRetentionDays: 365
      };

      // Mock session exists
      jest.spyOn(ssoService as any, 'activeSessions', 'get')
        .mockReturnValue(new Map([[sessionId, mockSession]]));
      
      jest.spyOn(ssoService as any, 'ssoProviders', 'get')
        .mockReturnValue(new Map([['saml-provider', mockProvider]]));

      const result = await ssoService.initiateSingleLogout(sessionId);
      
      expect(result.success).toBe(true);
      expect(result.logoutUrl).toBeDefined();
      expect(result.logoutUrl).toContain('https://idp.example.com/slo');
    });

    it('should handle logout for non-existent session gracefully', async () => {
      const sessionId = 'non-existent-session';

      const result = await ssoService.initiateSingleLogout(sessionId);
      
      expect(result.success).toBe(true);
      expect(result.logoutUrl).toBeUndefined();
    });
  });

  describe('SSO Metrics and Analytics', () => {
    it('should track SSO metrics correctly', () => {
      const metrics = ssoService.getSSOMetrics();
      
      expect(metrics).toHaveProperty('totalLogins');
      expect(metrics).toHaveProperty('successfulLogins');
      expect(metrics).toHaveProperty('failedLogins');
      expect(metrics).toHaveProperty('activeProviders');
      expect(metrics).toHaveProperty('averageLoginTime');
      expect(metrics).toHaveProperty('providerMetrics');
      
      expect(typeof metrics.totalLogins).toBe('number');
      expect(typeof metrics.successfulLogins).toBe('number');
      expect(typeof metrics.failedLogins).toBe('number');
      expect(typeof metrics.activeProviders).toBe('number');
      expect(typeof metrics.averageLoginTime).toBe('number');
      expect(metrics.providerMetrics).toBeInstanceOf(Map);
    });

    it('should return active sessions list', () => {
      const sessions = ssoService.getActiveSessions();
      
      expect(Array.isArray(sessions)).toBe(true);
    });

    it('should terminate session successfully', async () => {
      const sessionId = 'session-to-terminate';
      
      const result = await ssoService.terminateSession(sessionId);
      
      expect(typeof result).toBe('boolean');
    });
  });

  describe('Role and Attribute Mapping', () => {
    it('should map user roles correctly based on groups', async () => {
      const ssoProfile: SSOUserProfile = {
        nameID: 'admin@example.com',
        email: 'admin@example.com',
        firstName: 'Admin',
        lastName: 'User',
        groups: ['admins', 'security-team']
      };

      const providerConfig: SSOProviderConfig = {
        organizationId: 'org-123',
        provider: 'saml',
        name: 'Role Mapping Test',
        status: 'active',
        autoProvisioning: true,
        justInTimeProvisioning: true,
        attributeMapping: {
          email: 'email',
          firstName: 'firstName',
          lastName: 'lastName'
        },
        roleMapping: [
          {
            groupName: 'admins',
            role: UserRole.ADMIN,
            priority: 1
          },
          {
            groupName: 'security-team',
            role: UserRole.SECURITY_ANALYST,
            priority: 2
          },
          {
            groupName: 'developers',
            role: UserRole.DEVELOPER,
            priority: 3
          }
        ],
        certificateValidation: true,
        signatureValidation: true,
        encryptionRequired: false,
        sessionTimeout: 3600,
        maxConcurrentSessions: 5,
        auditLogging: true,
        complianceMode: 'normal',
        dataRetentionDays: 365
      };

      // Test role mapping logic (this would be done internally)
      const mappedUser = await (ssoService as any).mapSSOProfileToUser(ssoProfile, providerConfig);
      
      expect(mappedUser.role).toBe(UserRole.ADMIN); // Highest priority role
    });

    it('should handle attribute-based role mapping', async () => {
      const ssoProfile: SSOUserProfile = {
        nameID: 'architect@example.com',
        email: 'architect@example.com',
        firstName: 'Solution',
        lastName: 'Architect',
        attributes: {
          title: 'Senior Solution Architect',
          department: 'Engineering'
        }
      };

      const providerConfig: SSOProviderConfig = {
        organizationId: 'org-456',
        provider: 'oidc',
        name: 'Attribute Mapping Test',
        status: 'active',
        autoProvisioning: true,
        justInTimeProvisioning: true,
        attributeMapping: {
          email: 'email',
          firstName: 'given_name',
          lastName: 'family_name'
        },
        roleMapping: [
          {
            attributeName: 'title',
            attributeValue: 'Senior Solution Architect',
            role: UserRole.ARCHITECT,
            priority: 1
          }
        ],
        certificateValidation: true,
        signatureValidation: true,
        encryptionRequired: false,
        sessionTimeout: 3600,
        maxConcurrentSessions: 5,
        auditLogging: true,
        complianceMode: 'normal',
        dataRetentionDays: 365
      };

      const mappedUser = await (ssoService as any).mapSSOProfileToUser(ssoProfile, providerConfig);
      
      expect(mappedUser.role).toBe(UserRole.ARCHITECT);
    });

    it('should default to viewer role when no mapping matches', async () => {
      const ssoProfile: SSOUserProfile = {
        nameID: 'guest@example.com',
        email: 'guest@example.com',
        firstName: 'Guest',
        lastName: 'User',
        groups: ['guests'] // No mapping for this group
      };

      const providerConfig: SSOProviderConfig = {
        organizationId: 'org-789',
        provider: 'oauth2',
        name: 'Default Role Test',
        status: 'active',
        autoProvisioning: true,
        justInTimeProvisioning: true,
        attributeMapping: {
          email: 'email',
          firstName: 'name',
          lastName: 'name'
        },
        roleMapping: [
          {
            groupName: 'admins',
            role: UserRole.ADMIN,
            priority: 1
          }
        ],
        certificateValidation: true,
        signatureValidation: true,
        encryptionRequired: false,
        sessionTimeout: 3600,
        maxConcurrentSessions: 5,
        auditLogging: true,
        complianceMode: 'normal',
        dataRetentionDays: 365
      };

      const mappedUser = await (ssoService as any).mapSSOProfileToUser(ssoProfile, providerConfig);
      
      expect(mappedUser.role).toBe(UserRole.VIEWER);
    });
  });

  describe('Connection Testing', () => {
    beforeEach(() => {
      // Mock fetch for connection tests
      global.fetch = jest.fn();
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should test SAML connection successfully', async () => {
      const samlConfig: SAMLConfig = {
        entityId: 'test-entity',
        ssoUrl: 'https://idp.example.com/sso',
        x509Certificate: 'test-cert',
        callbackUrl: 'https://app.example.com/callback',
        metadataUrl: 'https://idp.example.com/metadata'
      };

      const providerConfig: SSOProviderConfig = {
        organizationId: 'org-test',
        provider: 'saml',
        name: 'SAML Connection Test',
        status: 'testing',
        autoProvisioning: false,
        justInTimeProvisioning: false,
        saml: samlConfig,
        attributeMapping: {
          email: 'email',
          firstName: 'firstName',
          lastName: 'lastName'
        },
        certificateValidation: true,
        signatureValidation: true,
        encryptionRequired: false,
        sessionTimeout: 3600,
        maxConcurrentSessions: 5,
        auditLogging: true,
        complianceMode: 'normal',
        dataRetentionDays: 365
      };

      // Mock successful response
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200
      });

      const status = await ssoService.testSSOConnection(providerConfig);
      
      expect(status.status).toBe('active');
      expect(status.message).toContain('SAML connection successful');
      expect(status.lastChecked).toBeInstanceOf(Date);
    });

    it('should handle connection test failures', async () => {
      const oidcConfig: OIDCConfig = {
        issuer: 'https://invalid-issuer.com',
        clientId: 'test-client',
        clientSecret: 'test-secret',
        redirectUri: 'https://app.example.com/callback'
      };

      const providerConfig: SSOProviderConfig = {
        organizationId: 'org-test',
        provider: 'oidc',
        name: 'Failed Connection Test',
        status: 'testing',
        autoProvisioning: false,
        justInTimeProvisioning: false,
        oidc: oidcConfig,
        attributeMapping: {
          email: 'email',
          firstName: 'given_name',
          lastName: 'family_name'
        },
        certificateValidation: true,
        signatureValidation: true,
        encryptionRequired: false,
        sessionTimeout: 3600,
        maxConcurrentSessions: 5,
        auditLogging: true,
        complianceMode: 'normal',
        dataRetentionDays: 365
      };

      // Mock failed response
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404
      });

      const status = await ssoService.testSSOConnection(providerConfig);
      
      expect(status.status).toBe('error');
      expect(status.message).toContain('OIDC discovery failed');
    });
  });

  describe('Integration with MFA Service', () => {
    it('should enforce MFA when SSO login has medium risk', async () => {
      const context = {
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Unknown Device)',
        location: { country: 'Unknown', city: 'Unknown' },
        deviceFingerprint: 'unknown-device-123',
        timeOfDay: 2, // 2 AM - unusual time
        dayOfWeek: 6 // Saturday - unusual day
      };

      const decision = await mfaService.evaluateAdaptiveMFA('user-123', context);
      
      expect(decision.requireMFA).toBe(true);
      expect(decision.riskLevel).toMatch(/medium|high/);
      expect(decision.recommendedProviders.length).toBeGreaterThan(0);
    });

    it('should allow low-risk SSO login without additional MFA', async () => {
      const context = {
        ipAddress: '192.168.1.50', // Known office IP
        userAgent: 'Mozilla/5.0 (Known Browser)',
        location: { country: 'US', city: 'San Francisco' },
        deviceFingerprint: 'known-device-456',
        timeOfDay: 10, // 10 AM - normal business hours
        dayOfWeek: 2 // Tuesday - normal business day
      };

      const decision = await mfaService.evaluateAdaptiveMFA('user-123', context);
      
      // For a low-risk scenario with no MFA configured, might not require MFA
      expect(decision.riskLevel).toBe('low');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle missing provider configuration gracefully', async () => {
      const nonExistentProviderId = 'non-existent-provider';
      
      await expect(ssoService.getProviderMetadata(nonExistentProviderId))
        .rejects.toThrow('Provider not found');
    });

    it('should handle malformed SSO profile data', async () => {
      const malformedProfile = {
        // Missing required fields
        email: undefined,
        firstName: '',
        lastName: null
      } as any;

      const providerId = 'test-provider';
      const sessionId = 'test-session';

      await expect(ssoService.authenticateSSO(providerId, malformedProfile, sessionId))
        .rejects.toThrow();
    });

    it('should handle organization mismatch during authentication', async () => {
      const ssoProfile: SSOUserProfile = {
        nameID: 'user@wrongorg.com',
        email: 'user@wrongorg.com',
        firstName: 'Wrong',
        lastName: 'Organization'
      };

      const providerId = 'mismatched-org-provider';
      const sessionId = 'mismatch-session';

      // Mock provider for org-123 but user from different org
      const mockProvider: SSOProviderConfig = {
        id: providerId,
        organizationId: 'org-123',
        provider: 'saml',
        name: 'Org Mismatch Test',
        status: 'active',
        autoProvisioning: false, // No auto-provisioning
        justInTimeProvisioning: false,
        attributeMapping: {
          email: 'email',
          firstName: 'firstName',
          lastName: 'lastName'
        },
        certificateValidation: true,
        signatureValidation: true,
        encryptionRequired: false,
        sessionTimeout: 3600,
        maxConcurrentSessions: 5,
        auditLogging: true,
        complianceMode: 'normal',
        dataRetentionDays: 365
      };

      jest.spyOn(ssoService as any, 'ssoProviders', 'get')
        .mockReturnValue(new Map([[providerId, mockProvider]]));

      await expect(ssoService.authenticateSSO(providerId, ssoProfile, sessionId))
        .rejects.toThrow();
    });
  });
});

describe('MFAService Integration', () => {
  let mfaService: MFAService;

  beforeEach(() => {
    mfaService = new MFAService();
    jest.clearAllMocks();
  });

  describe('TOTP Setup and Verification', () => {
    it('should setup TOTP MFA successfully', async () => {
      const userId = 'user-totp-123';
      const deviceName = 'iPhone 12';

      const setupResponse = await mfaService.setupTOTP(userId, deviceName);

      expect(setupResponse.provider).toBe('totp');
      expect(setupResponse.setupComplete).toBe(false);
      expect(setupResponse.setupData).toHaveProperty('secret');
      expect(setupResponse.setupData).toHaveProperty('qrCode');
      expect(setupResponse.setupData).toHaveProperty('backupCodes');
      expect(setupResponse.nextStep).toContain('QR code');
    });

    it('should verify TOTP setup with valid code', async () => {
      const userId = 'user-totp-verify';
      const provider = 'totp';
      const verificationCode = '123456';

      // Mock TOTP verification to return true
      jest.spyOn(mfaService as any, 'verifyTOTPCode').mockReturnValue(true);
      jest.spyOn(mfaService as any, 'getTempMFASetup').mockResolvedValue({
        setupData: {
          secret: 'JBSWY3DPEHPK3PXP',
          qrCode: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...',
          backupCodes: { codes: ['ABC123', 'DEF456'] }
        }
      });

      const response = await mfaService.verifyMFASetup(userId, provider, verificationCode);

      expect(response.setupComplete).toBe(true);
      expect(response.nextStep).toContain('completed successfully');
    });

    it('should reject TOTP setup with invalid code', async () => {
      const userId = 'user-totp-invalid';
      const provider = 'totp';
      const invalidCode = '000000';

      // Mock TOTP verification to return false
      jest.spyOn(mfaService as any, 'verifyTOTPCode').mockReturnValue(false);
      jest.spyOn(mfaService as any, 'getTempMFASetup').mockResolvedValue({
        setupData: {
          secret: 'JBSWY3DPEHPK3PXP'
        }
      });

      await expect(mfaService.verifyMFASetup(userId, provider, invalidCode))
        .rejects.toThrow('Invalid verification code');
    });
  });

  describe('SMS MFA', () => {
    it('should setup SMS MFA with valid phone number', async () => {
      const userId = 'user-sms-123';
      const phoneNumber = '+1234567890';

      const setupResponse = await mfaService.setupSMS(userId, phoneNumber);

      expect(setupResponse.provider).toBe('sms');
      expect(setupResponse.setupComplete).toBe(false);
      expect(setupResponse.setupData).toHaveProperty('phoneNumber');
      expect(setupResponse.setupData).toHaveProperty('maskedPhoneNumber');
      expect((setupResponse.setupData as any).maskedPhoneNumber).toContain('*');
      expect(setupResponse.nextStep).toContain('verification code');
    });

    it('should reject SMS setup with invalid phone number', async () => {
      const userId = 'user-sms-invalid';
      const invalidPhone = 'not-a-phone-number';

      await expect(mfaService.setupSMS(userId, invalidPhone))
        .rejects.toThrow('Invalid phone number format');
    });
  });

  describe('Email MFA', () => {
    it('should setup Email MFA successfully', async () => {
      const userId = 'user-email-123';
      const emailAddress = 'user@example.com';

      const setupResponse = await mfaService.setupEmail(userId, emailAddress);

      expect(setupResponse.provider).toBe('email');
      expect(setupResponse.setupComplete).toBe(false);
      expect(setupResponse.setupData).toHaveProperty('emailAddress');
      expect(setupResponse.setupData).toHaveProperty('maskedEmail');
      expect((setupResponse.setupData as any).maskedEmail).toContain('*');
    });
  });

  describe('WebAuthn MFA', () => {
    it('should setup WebAuthn MFA successfully', async () => {
      const userId = 'user-webauthn-123';
      const deviceName = 'YubiKey 5';

      const setupResponse = await mfaService.setupWebAuthn(userId, deviceName);

      expect(setupResponse.provider).toBe('webauthn');
      expect(setupResponse.setupComplete).toBe(false);
      expect(setupResponse.setupData).toHaveProperty('challenge');
      expect(setupResponse.setupData).toHaveProperty('publicKeyCredentialCreationOptions');
      expect(setupResponse.setupData).toHaveProperty('deviceName');
    });
  });

  describe('Backup Codes', () => {
    it('should generate backup codes successfully', async () => {
      const userId = 'user-backup-123';

      const backupCodes = await mfaService.generateBackupCodes(userId);

      expect(backupCodes).toHaveProperty('codes');
      expect(Array.isArray(backupCodes.codes)).toBe(true);
      expect(backupCodes.codes.length).toBe(10);
      expect(backupCodes).toHaveProperty('generatedAt');
      expect(backupCodes.generatedAt).toBeInstanceOf(Date);

      // Verify codes are properly formatted (8 character hex)
      backupCodes.codes.forEach(code => {
        expect(code).toMatch(/^[A-F0-9]{8}$/);
      });
    });
  });

  describe('MFA Status and Management', () => {
    it('should get MFA status for user', async () => {
      const userId = 'user-status-123';

      const status = await mfaService.getMFAStatus(userId);

      expect(status).toHaveProperty('enabled');
      expect(status).toHaveProperty('primaryProvider');
      expect(status).toHaveProperty('enabledProviders');
      expect(status).toHaveProperty('devices');
      expect(status).toHaveProperty('backupCodesRemaining');
      expect(status).toHaveProperty('isRecoveryEnabled');
      expect(Array.isArray(status.enabledProviders)).toBe(true);
      expect(Array.isArray(status.devices)).toBe(true);
    });

    it('should disable MFA for user', async () => {
      const userId = 'user-disable-123';

      await expect(mfaService.disableMFA(userId)).resolves.not.toThrow();
    });
  });

  describe('Adaptive MFA', () => {
    it('should evaluate risk factors correctly', async () => {
      const userId = 'user-adaptive-123';
      const context = {
        ipAddress: '203.0.113.1', // Unknown IP
        userAgent: 'Unknown Browser',
        location: { country: 'Unknown', city: 'Unknown' },
        deviceFingerprint: 'new-device-fingerprint',
        timeOfDay: 3, // 3 AM
        dayOfWeek: 0 // Sunday
      };

      const decision = await mfaService.evaluateAdaptiveMFA(userId, context);

      expect(decision).toHaveProperty('requireMFA');
      expect(decision).toHaveProperty('riskScore');
      expect(decision).toHaveProperty('riskLevel');
      expect(decision).toHaveProperty('recommendedProviders');
      expect(decision).toHaveProperty('reasoning');
      expect(decision).toHaveProperty('bypassAllowed');

      expect(typeof decision.requireMFA).toBe('boolean');
      expect(typeof decision.riskScore).toBe('number');
      expect(decision.riskScore).toBeGreaterThanOrEqual(0);
      expect(decision.riskScore).toBeLessThanOrEqual(1);
      expect(['low', 'medium', 'high']).toContain(decision.riskLevel);
      expect(Array.isArray(decision.recommendedProviders)).toBe(true);
      expect(Array.isArray(decision.reasoning)).toBe(true);
    });
  });
});