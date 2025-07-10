import { Strategy as SamlStrategy, SamlConfig } from '@node-saml/passport-saml';
import passport from 'passport';
import { UserService } from './user.service';
import { AuditService } from './audit.service';
import { logger } from '../utils/logger';
import {
  SSOProvider,
  SSOConfig,
  SAMLConfig,
  OIDCConfig,
  OAuth2Config,
  SSOUserProfile,
  SSOProviderConfig,
  RoleMapping,
  AttributeMapping,
  SSOSessionInfo,
  GroupMapping,
  TenantConfig,
  SSOMetrics,
  LDAPConfig,
  SSOProviderStatus
} from '../types/enterprise-sso';
import { User, UserRole } from '../types/auth';
import { generateAccessToken, generateRefreshToken } from '../utils/jwt';
import { RefreshTokenService } from './refresh-token.service';

export class EnterpriseSSOService {
  private userService: UserService;
  private auditService: AuditService;
  private refreshTokenService: RefreshTokenService;
  private ssoProviders: Map<string, SSOProviderConfig> = new Map();
  private activeSessions: Map<string, SSOSessionInfo> = new Map();
  private ssoMetrics: SSOMetrics = {
    totalLogins: 0,
    successfulLogins: 0,
    failedLogins: 0,
    activeProviders: 0,
    activeSessions: 0,
    averageLoginTime: 0,
    providerMetrics: new Map()
  };

  constructor() {
    this.userService = new UserService();
    this.auditService = new AuditService();
    this.refreshTokenService = new RefreshTokenService();
    this.initializePassportStrategies();
  }

  /**
   * Configure SSO provider for organization
   */
  async configureSSOProvider(
    organizationId: string,
    providerConfig: SSOProviderConfig
  ): Promise<void> {
    try {
      // Validate configuration
      await this.validateSSOConfig(providerConfig);

      // Store configuration securely
      const providerId = `${organizationId}_${providerConfig.provider}_${Date.now()}`;
      this.ssoProviders.set(providerId, {
        ...providerConfig,
        id: providerId,
        organizationId,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Initialize passport strategy for this provider
      await this.initializeProviderStrategy(providerId, providerConfig);

      // Update metrics
      this.ssoMetrics.activeProviders = this.ssoProviders.size;

      // Audit log
      await this.auditService.logEvent({
        action: 'SSO_PROVIDER_CONFIGURED',
        userId: providerConfig.configuredBy || 'system',
        organizationId,
        details: {
          provider: providerConfig.provider,
          providerId,
          entityId: providerConfig.saml?.entityId || providerConfig.oidc?.clientId
        },
        timestamp: new Date()
      });

      logger.info(`SSO provider configured: ${providerId} for organization: ${organizationId}`);
    } catch (error) {
      logger.error('Error configuring SSO provider:', error);
      throw new Error(`Failed to configure SSO provider: ${error}`);
    }
  }

  /**
   * Authenticate user via SSO
   */
  async authenticateSSO(
    providerId: string,
    ssoProfile: SSOUserProfile,
    sessionId: string
  ): Promise<{ user: User; tokens: { accessToken: string; refreshToken: string } }> {
    const startTime = Date.now();
    
    try {
      this.ssoMetrics.totalLogins++;

      const provider = this.ssoProviders.get(providerId);
      if (!provider || provider.status !== 'active') {
        throw new Error('SSO provider not found or inactive');
      }

      // Map SSO profile to user attributes
      const mappedUser = await this.mapSSOProfileToUser(ssoProfile, provider);

      // Get or create user
      let user = await this.userService.getUserByEmail(mappedUser.email);
      if (!user) {
        // Auto-provision user if enabled
        if (provider.autoProvisioning) {
          user = await this.userService.createUser({
            email: mappedUser.email,
            firstName: mappedUser.firstName,
            lastName: mappedUser.lastName,
            organization: provider.organizationId,
            password: '', // SSO users don't need passwords
            role: mappedUser.role || UserRole.VIEWER,
            ssoProvider: provider.provider,
            ssoSubject: ssoProfile.nameID || ssoProfile.subject
          });
          
          logger.info(`Auto-provisioned SSO user: ${user.email}`);
        } else {
          throw new Error('User not found and auto-provisioning is disabled');
        }
      } else {
        // Update user info if changed
        await this.userService.updateUser(user.id, {
          firstName: mappedUser.firstName,
          lastName: mappedUser.lastName,
          lastLogin: new Date()
        });
      }

      // Validate user organization matches provider
      if (user.organization !== provider.organizationId) {
        throw new Error('User organization mismatch');
      }

      // Generate JWT tokens
      const accessToken = generateAccessToken(user);
      const refreshToken = generateRefreshToken(user.id);

      // Store refresh token
      await this.refreshTokenService.storeRefreshToken(user.id, refreshToken);

      // Create SSO session
      const sessionInfo: SSOSessionInfo = {
        sessionId,
        userId: user.id,
        providerId,
        loginTime: new Date(),
        lastActivity: new Date(),
        ssoAttributes: ssoProfile.attributes || {},
        groups: ssoProfile.groups || []
      };
      this.activeSessions.set(sessionId, sessionInfo);

      // Update metrics
      this.ssoMetrics.successfulLogins++;
      const loginTime = Date.now() - startTime;
      this.ssoMetrics.averageLoginTime = 
        (this.ssoMetrics.averageLoginTime + loginTime) / 2;

      const providerMetrics = this.ssoMetrics.providerMetrics.get(providerId) || {
        totalLogins: 0,
        successfulLogins: 0,
        failedLogins: 0,
        averageLoginTime: 0
      };
      providerMetrics.totalLogins++;
      providerMetrics.successfulLogins++;
      providerMetrics.averageLoginTime = 
        (providerMetrics.averageLoginTime + loginTime) / 2;
      this.ssoMetrics.providerMetrics.set(providerId, providerMetrics);

      // Audit log
      await this.auditService.logEvent({
        action: 'SSO_LOGIN_SUCCESS',
        userId: user.id,
        organizationId: user.organization,
        details: {
          provider: provider.provider,
          providerId,
          sessionId,
          loginTime
        },
        timestamp: new Date()
      });

      logger.info(`SSO authentication successful for user: ${user.email} via provider: ${providerId}`);

      return {
        user,
        tokens: {
          accessToken,
          refreshToken
        }
      };
    } catch (error) {
      this.ssoMetrics.failedLogins++;
      
      const providerMetrics = this.ssoMetrics.providerMetrics.get(providerId) || {
        totalLogins: 0,
        successfulLogins: 0,
        failedLogins: 0,
        averageLoginTime: 0
      };
      providerMetrics.failedLogins++;
      this.ssoMetrics.providerMetrics.set(providerId, providerMetrics);

      await this.auditService.logEvent({
        action: 'SSO_LOGIN_FAILED',
        userId: 'unknown',
        organizationId: '',
        details: {
          providerId,
          sessionId,
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        timestamp: new Date()
      });

      logger.error(`SSO authentication failed for provider: ${providerId}`, error);
      throw error;
    }
  }

  /**
   * Initialize Single Sign-Out (SLO)
   */
  async initiateSingleLogout(
    sessionId: string,
    redirectUrl?: string
  ): Promise<{ logoutUrl?: string; success: boolean }> {
    try {
      const session = this.activeSessions.get(sessionId);
      if (!session) {
        return { success: true }; // Already logged out
      }

      const provider = this.ssoProviders.get(session.providerId);
      if (!provider) {
        return { success: true };
      }

      // Revoke refresh tokens
      await this.refreshTokenService.revokeAllRefreshTokens(session.userId);

      // Remove session
      this.activeSessions.delete(sessionId);

      // Generate SLO URL for SAML
      let logoutUrl: string | undefined;
      if (provider.provider === 'saml' && provider.saml?.sloUrl) {
        logoutUrl = this.generateSAMLLogoutUrl(provider.saml, redirectUrl);
      }

      // Audit log
      await this.auditService.logEvent({
        action: 'SSO_LOGOUT',
        userId: session.userId,
        organizationId: provider.organizationId,
        details: {
          provider: provider.provider,
          providerId: session.providerId,
          sessionId
        },
        timestamp: new Date()
      });

      logger.info(`Single logout initiated for session: ${sessionId}`);

      return {
        logoutUrl,
        success: true
      };
    } catch (error) {
      logger.error('Error during single logout:', error);
      return { success: false };
    }
  }

  /**
   * Get SSO provider metadata
   */
  async getProviderMetadata(providerId: string): Promise<any> {
    const provider = this.ssoProviders.get(providerId);
    if (!provider) {
      throw new Error('Provider not found');
    }

    switch (provider.provider) {
      case 'saml':
        return this.generateSAMLMetadata(provider.saml!);
      case 'oidc':
        return this.generateOIDCMetadata(provider.oidc!);
      default:
        throw new Error('Metadata not supported for this provider type');
    }
  }

  /**
   * Test SSO connection
   */
  async testSSOConnection(providerConfig: SSOProviderConfig): Promise<SSOProviderStatus> {
    try {
      switch (providerConfig.provider) {
        case 'saml':
          return await this.testSAMLConnection(providerConfig.saml!);
        case 'oidc':
          return await this.testOIDCConnection(providerConfig.oidc!);
        case 'oauth2':
          return await this.testOAuth2Connection(providerConfig.oauth2!);
        case 'ldap':
          return await this.testLDAPConnection(providerConfig.ldap!);
        default:
          throw new Error('Unsupported provider type');
      }
    } catch (error) {
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Connection test failed',
        lastChecked: new Date()
      };
    }
  }

  /**
   * Get SSO metrics and analytics
   */
  getSSOMetrics(): SSOMetrics {
    return { ...this.ssoMetrics };
  }

  /**
   * Get active SSO sessions
   */
  getActiveSessions(): SSOSessionInfo[] {
    return Array.from(this.activeSessions.values());
  }

  /**
   * Terminate SSO session
   */
  async terminateSession(sessionId: string): Promise<boolean> {
    try {
      const session = this.activeSessions.get(sessionId);
      if (session) {
        await this.refreshTokenService.revokeAllRefreshTokens(session.userId);
        this.activeSessions.delete(sessionId);
        
        await this.auditService.logEvent({
          action: 'SSO_SESSION_TERMINATED',
          userId: session.userId,
          organizationId: '',
          details: { sessionId },
          timestamp: new Date()
        });
      }
      return true;
    } catch (error) {
      logger.error('Error terminating session:', error);
      return false;
    }
  }

  // Private helper methods

  private async validateSSOConfig(config: SSOProviderConfig): Promise<void> {
    if (!config.provider || !config.organizationId) {
      throw new Error('Provider type and organization ID are required');
    }

    switch (config.provider) {
      case 'saml':
        if (!config.saml?.ssoUrl || !config.saml?.x509Certificate) {
          throw new Error('SAML SSO URL and certificate are required');
        }
        break;
      case 'oidc':
        if (!config.oidc?.issuer || !config.oidc?.clientId || !config.oidc?.clientSecret) {
          throw new Error('OIDC issuer, client ID, and client secret are required');
        }
        break;
      case 'oauth2':
        if (!config.oauth2?.authorizationUrl || !config.oauth2?.tokenUrl) {
          throw new Error('OAuth2 authorization and token URLs are required');
        }
        break;
      case 'ldap':
        if (!config.ldap?.host || !config.ldap?.baseDN) {
          throw new Error('LDAP host and base DN are required');
        }
        break;
    }
  }

  private async mapSSOProfileToUser(
    profile: SSOUserProfile,
    provider: SSOProviderConfig
  ): Promise<Partial<User> & { role?: UserRole }> {
    const mapping = provider.attributeMapping;
    
    // Extract basic attributes
    const email = this.extractAttribute(profile.attributes, mapping.email, profile.email);
    const firstName = this.extractAttribute(profile.attributes, mapping.firstName, profile.firstName);
    const lastName = this.extractAttribute(profile.attributes, mapping.lastName, profile.lastName);
    
    // Map role from groups or attributes
    let role: UserRole = UserRole.VIEWER;
    if (provider.roleMapping && provider.roleMapping.length > 0) {
      role = this.mapUserRole(profile.groups || [], profile.attributes || {}, provider.roleMapping);
    }

    return {
      email,
      firstName,
      lastName,
      role,
      organization: provider.organizationId
    };
  }

  private extractAttribute(
    attributes: Record<string, any> | undefined,
    attributeName: string,
    fallback?: string
  ): string {
    if (!attributes || !attributeName) {
      return fallback || '';
    }
    
    const value = attributes[attributeName];
    if (Array.isArray(value)) {
      return value[0] || fallback || '';
    }
    return value || fallback || '';
  }

  private mapUserRole(
    groups: string[],
    attributes: Record<string, any>,
    roleMapping: RoleMapping[]
  ): UserRole {
    for (const mapping of roleMapping) {
      // Check group-based mapping
      if (mapping.groupName && groups.includes(mapping.groupName)) {
        return mapping.role;
      }
      
      // Check attribute-based mapping
      if (mapping.attributeName && mapping.attributeValue) {
        const attributeValue = this.extractAttribute(attributes, mapping.attributeName);
        if (attributeValue === mapping.attributeValue) {
          return mapping.role;
        }
      }
    }
    
    return UserRole.VIEWER; // Default role
  }

  private async initializePassportStrategies(): Promise<void> {
    // This will be called during service initialization
    // Individual strategies will be added as providers are configured
  }

  private async initializeProviderStrategy(
    providerId: string,
    config: SSOProviderConfig
  ): Promise<void> {
    switch (config.provider) {
      case 'saml':
        await this.initializeSAMLStrategy(providerId, config.saml!);
        break;
      // Other provider strategies would be initialized here
    }
  }

  private async initializeSAMLStrategy(providerId: string, samlConfig: SAMLConfig): Promise<void> {
    const strategy = new SamlStrategy(
      {
        callbackUrl: samlConfig.callbackUrl,
        entryPoint: samlConfig.ssoUrl,
        issuer: samlConfig.entityId,
        cert: samlConfig.x509Certificate,
        signatureAlgorithm: samlConfig.signatureAlgorithm || 'sha256',
        wantAssertionsSigned: samlConfig.wantAssertionsSigned !== false,
        wantAuthnResponseSigned: samlConfig.wantAuthnResponseSigned !== false
      } as SamlConfig,
      async (profile: any, done: any) => {
        try {
          const ssoProfile: SSOUserProfile = {
            nameID: profile.nameID,
            email: profile.email || profile.nameID,
            firstName: profile.firstName || profile.givenName,
            lastName: profile.lastName || profile.surname,
            attributes: profile,
            groups: profile.groups || []
          };
          
          done(null, ssoProfile);
        } catch (error) {
          done(error, null);
        }
      }
    );

    passport.use(`saml-${providerId}`, strategy);
  }

  private generateSAMLMetadata(samlConfig: SAMLConfig): string {
    // Generate SAML SP metadata XML
    return `<?xml version="1.0"?>
<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata"
                     entityID="${samlConfig.entityId}">
  <md:SPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <md:AssertionConsumerService index="1"
                                 isDefault="true"
                                 Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
                                 Location="${samlConfig.callbackUrl}" />
  </md:SPSSODescriptor>
</md:EntityDescriptor>`;
  }

  private generateOIDCMetadata(oidcConfig: OIDCConfig): any {
    return {
      client_id: oidcConfig.clientId,
      redirect_uris: [oidcConfig.redirectUri],
      response_types: ['code'],
      grant_types: ['authorization_code', 'refresh_token'],
      scope: oidcConfig.scope || 'openid profile email'
    };
  }

  private generateSAMLLogoutUrl(samlConfig: SAMLConfig, redirectUrl?: string): string {
    const logoutRequest = `<samlp:LogoutRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol">
      <saml:Issuer xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">${samlConfig.entityId}</saml:Issuer>
    </samlp:LogoutRequest>`;
    
    const encodedRequest = Buffer.from(logoutRequest).toString('base64');
    let logoutUrl = `${samlConfig.sloUrl}?SAMLRequest=${encodeURIComponent(encodedRequest)}`;
    
    if (redirectUrl) {
      logoutUrl += `&RelayState=${encodeURIComponent(redirectUrl)}`;
    }
    
    return logoutUrl;
  }

  private async testSAMLConnection(samlConfig: SAMLConfig): Promise<SSOProviderStatus> {
    try {
      // Test SAML metadata endpoint
      const response = await fetch(samlConfig.metadataUrl || samlConfig.ssoUrl);
      if (response.ok) {
        return {
          status: 'active',
          message: 'SAML connection successful',
          lastChecked: new Date()
        };
      } else {
        return {
          status: 'error',
          message: `SAML endpoint returned ${response.status}`,
          lastChecked: new Date()
        };
      }
    } catch (error) {
      return {
        status: 'error',
        message: `SAML connection failed: ${error}`,
        lastChecked: new Date()
      };
    }
  }

  private async testOIDCConnection(oidcConfig: OIDCConfig): Promise<SSOProviderStatus> {
    try {
      // Test OIDC discovery endpoint
      const discoveryUrl = `${oidcConfig.issuer}/.well-known/openid_configuration`;
      const response = await fetch(discoveryUrl);
      if (response.ok) {
        return {
          status: 'active',
          message: 'OIDC connection successful',
          lastChecked: new Date()
        };
      } else {
        return {
          status: 'error',
          message: `OIDC discovery failed with ${response.status}`,
          lastChecked: new Date()
        };
      }
    } catch (error) {
      return {
        status: 'error',
        message: `OIDC connection failed: ${error}`,
        lastChecked: new Date()
      };
    }
  }

  private async testOAuth2Connection(oauth2Config: OAuth2Config): Promise<SSOProviderStatus> {
    try {
      // Test OAuth2 authorization endpoint
      const response = await fetch(oauth2Config.authorizationUrl, { method: 'HEAD' });
      if (response.ok || response.status === 400) { // 400 is expected for HEAD request without params
        return {
          status: 'active',
          message: 'OAuth2 connection successful',
          lastChecked: new Date()
        };
      } else {
        return {
          status: 'error',
          message: `OAuth2 endpoint returned ${response.status}`,
          lastChecked: new Date()
        };
      }
    } catch (error) {
      return {
        status: 'error',
        message: `OAuth2 connection failed: ${error}`,
        lastChecked: new Date()
      };
    }
  }

  private async testLDAPConnection(ldapConfig: LDAPConfig): Promise<SSOProviderStatus> {
    // LDAP connection testing would require ldapjs or similar library
    // For now, return a placeholder
    return {
      status: 'active',
      message: 'LDAP connection test not implemented',
      lastChecked: new Date()
    };
  }
}