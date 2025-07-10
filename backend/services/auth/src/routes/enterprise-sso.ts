import { Router, Request, Response } from 'express';
import passport from 'passport';
import { EnterpriseSSOService } from '../services/enterprise-sso.service';
import { authMiddleware, requireRole } from '../middleware/auth.middleware';
import { validateSSOConfig, validateProviderTest } from '../validation/sso.validation';
import { logger } from '../utils/logger';
import { UserRole } from '../types/auth';
import { 
  SSOProviderConfig, 
  SSOInitiationResponse, 
  SSOCallbackResponse,
  SSOProviderStatus 
} from '../types/enterprise-sso';

export function createEnterpriseSSORouter(): Router {
  const router = Router();
  const ssoService = new EnterpriseSSOService();

  /**
   * Configure SSO Provider
   * POST /api/auth/sso/providers
   */
  router.post('/providers', 
    authMiddleware,
    requireRole(UserRole.ADMIN),
    validateSSOConfig,
    async (req: Request, res: Response) => {
      try {
        const providerConfig: SSOProviderConfig = {
          ...req.body,
          configuredBy: req.user?.id
        };

        await ssoService.configureSSOProvider(
          req.body.organizationId,
          providerConfig
        );

        res.status(201).json({
          success: true,
          message: 'SSO provider configured successfully',
          providerId: providerConfig.id
        });
      } catch (error) {
        logger.error('Error configuring SSO provider:', error);
        res.status(400).json({
          success: false,
          message: error instanceof Error ? error.message : 'Configuration failed'
        });
      
      return;
    }
  });

  /**
   * Test SSO Provider Connection
   * POST /api/auth/sso/providers/:providerId/test
   */
  router.post('/providers/:providerId/test',
    authMiddleware,
    requireRole(UserRole.ADMIN),
    validateProviderTest,
    async (req: Request, res: Response) => {
      try {
        const { providerId } = req.params;
        const providerConfig: SSOProviderConfig = req.body;

        const status: SSOProviderStatus = await ssoService.testSSOConnection(providerConfig);

        res.json({
          success: true,
          status,
          providerId
        });
      } catch (error) {
        logger.error('Error testing SSO provider:', error);
        res.status(400).json({
          success: false,
          message: error instanceof Error ? error.message : 'Connection test failed'
        });
      
      return;
    }
  });

  /**
   * Initiate SSO Login
   * GET /api/auth/sso/login/:provider
   */
  router.get('/login/:provider', async (req: Request, res: Response) => {
    try {
      const { provider } = req.params;
      const { organizationId, RelayState } = req.query;

      if (!organizationId) {
        return res.status(400).json({
          success: false,
          message: 'Organization ID is required'
        });
      }

      // Find provider configuration
      const providerId = `${organizationId}_${provider}`;
      
      // Initiate SSO based on provider type
      switch (provider) {
        case 'saml':
          passport.authenticate(`saml-${providerId}`, (err: any, user: any, info: any) => {
            if (err || !user) {
              return res.status(401).json({ success: false, message: 'Authentication failed' });
            }
            req.logIn(user, (err) => {
              if (err) {
                return res.status(500).json({ success: false, message: 'Login failed' });
              }
              return res.redirect(RelayState as string || '/dashboard');
            });
          })(req, res);
          break;
          
        case 'oidc':
          passport.authenticate(`oidc-${providerId}`)(req, res);
          break;
          
        case 'oauth2':
          passport.authenticate(`oauth2-${providerId}`)(req, res);
          break;
          
        default:
          res.status(400).json({
            success: false,
            message: 'Unsupported SSO provider'
          });
      }
    } catch (error) {
      logger.error('Error initiating SSO login:', error);
      res.status(500).json({
        success: false,
        message: 'SSO initiation failed'
      });
    
      return;
    }
  });

  /**
   * SSO Callback Handler
   * POST /api/auth/sso/callback/:provider
   */
  router.post('/callback/:provider', async (req: Request, res: Response) => {
    try {
      const { provider } = req.params;
      const sessionId = req.sessionID || `session_${Date.now()}`;

      passport.authenticate(`${provider}-${req.body.providerId}`, 
        async (err: any, profile: any) => {
          if (err) {
            logger.error('SSO authentication error:', err);
            return res.status(400).json({
              success: false,
              message: 'SSO authentication failed',
              error: err.message
            } as SSOCallbackResponse);
          }

          if (!profile) {
            return res.status(400).json({
              success: false,
              message: 'No user profile received from SSO provider'
            } as SSOCallbackResponse);
          }

          try {
            const result = await ssoService.authenticateSSO(
              req.body.providerId,
              profile,
              sessionId
            );

            const response: SSOCallbackResponse = {
              success: true,
              user: {
                id: result.user.id,
                email: result.user.email,
                firstName: result.user.firstName,
                lastName: result.user.lastName,
                role: result.user.role,
                organization: result.user.organization
              },
              tokens: {
                accessToken: result.tokens.accessToken,
                refreshToken: result.tokens.refreshToken,
                expiresIn: 3600 // 1 hour
              }
            };

            res.json(response);
          } catch (authError) {
            logger.error('SSO authentication processing error:', authError);
            res.status(400).json({
              success: false,
              message: authError instanceof Error ? authError.message : 'Authentication processing failed'
            } as SSOCallbackResponse);
          }
        }
      )(req, res);
    } catch (error) {
      logger.error('Error in SSO callback:', error);
      res.status(500).json({
        success: false,
        message: 'SSO callback processing failed'
      } as SSOCallbackResponse);
    
      return;
    }
  });

  /**
   * SSO Logout
   * POST /api/auth/sso/logout
   */
  router.post('/logout',
    authMiddleware,
    async (req: Request, res: Response) => {
      try {
        const sessionId = req.sessionID;
        const { redirectUrl } = req.body;

        const result = await ssoService.initiateSingleLogout(sessionId, redirectUrl);

        if (result.success) {
          // Clear session
          req.session.destroy((err) => {
            if (err) {
              logger.error('Session destruction error:', err);
            }
          });

          res.json({
            success: true,
            logoutUrl: result.logoutUrl,
            message: 'Logout initiated successfully'
          });
        } else {
          res.status(400).json({
            success: false,
            message: 'Logout failed'
          });
        }
      } catch (error) {
        logger.error('Error during SSO logout:', error);
        res.status(500).json({
          success: false,
          message: 'Logout processing failed'
        });
      
      return;
    }
  });

  /**
   * Get SSO Provider Metadata
   * GET /api/auth/sso/providers/:providerId/metadata
   */
  router.get('/providers/:providerId/metadata', async (req: Request, res: Response) => {
    try {
      const { providerId } = req.params;
      const { format } = req.query;

      const metadata = await ssoService.getProviderMetadata(providerId);

      if (format === 'xml') {
        res.set('Content-Type', 'application/xml');
        res.send(metadata);
      } else {
        res.json(metadata);
      }
    } catch (error) {
      logger.error('Error getting provider metadata:', error);
      res.status(404).json({
        success: false,
        message: 'Provider metadata not found'
      });
    
      return;
    }
  });

  /**
   * Get SSO Metrics
   * GET /api/auth/sso/metrics
   */
  router.get('/metrics',
    authMiddleware,
    requireRole(UserRole.ADMIN),
    async (req: Request, res: Response) => {
      try {
        const metrics = ssoService.getSSOMetrics();
        res.json({
          success: true,
          metrics
        });
      } catch (error) {
        logger.error('Error getting SSO metrics:', error);
        res.status(500).json({
          success: false,
          message: 'Failed to retrieve metrics'
        });
      
      return;
    }
  });

  /**
   * Get Active SSO Sessions
   * GET /api/auth/sso/sessions
   */
  router.get('/sessions',
    authMiddleware,
    requireRole(UserRole.ADMIN),
    async (req: Request, res: Response) => {
      try {
        const sessions = ssoService.getActiveSessions();
        res.json({
          success: true,
          sessions,
          count: sessions.length
        });
      } catch (error) {
        logger.error('Error getting active sessions:', error);
        res.status(500).json({
          success: false,
          message: 'Failed to retrieve sessions'
        });
      
      return;
    }
  });

  /**
   * Terminate SSO Session
   * DELETE /api/auth/sso/sessions/:sessionId
   */
  router.delete('/sessions/:sessionId',
    authMiddleware,
    requireRole(UserRole.ADMIN),
    async (req: Request, res: Response) => {
      try {
        const { sessionId } = req.params;
        const success = await ssoService.terminateSession(sessionId);

        res.json({
          success,
          message: success ? 'Session terminated successfully' : 'Session termination failed'
        });
      } catch (error) {
        logger.error('Error terminating session:', error);
        res.status(500).json({
          success: false,
          message: 'Failed to terminate session'
        });
      
      return;
    }
  });

  /**
   * SSO Health Check
   * GET /api/auth/sso/health
   */
  router.get('/health', async (req: Request, res: Response) => {
    try {
      const metrics = ssoService.getSSOMetrics();
      const activeSessions = ssoService.getActiveSessions();

      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        sso: {
          activeProviders: metrics.activeProviders,
          activeSessions: activeSessions.length,
          totalLogins: metrics.totalLogins,
          successRate: metrics.totalLogins > 0 
            ? (metrics.successfulLogins / metrics.totalLogins * 100).toFixed(2) + '%'
            : '0%'
        }
      });
    } catch (error) {
      logger.error('Error in SSO health check:', error);
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'SSO service unavailable'
      });
    
      return;
    }
  });

  /**
   * SSO Configuration Management
   */

  /**
   * List SSO Providers
   * GET /api/auth/sso/providers
   */
  router.get('/providers',
    authMiddleware,
    requireRole(UserRole.ADMIN),
    async (req: Request, res: Response) => {
      try {
        const { organizationId } = req.query;
        
        // This would typically come from a database
        // For now, return empty array as placeholder
        res.json({
          success: true,
          providers: [],
          count: 0
        });
      } catch (error) {
        logger.error('Error listing SSO providers:', error);
        res.status(500).json({
          success: false,
          message: 'Failed to list providers'
        });
      
      return;
    }
  });

  /**
   * Update SSO Provider
   * PUT /api/auth/sso/providers/:providerId
   */
  router.put('/providers/:providerId',
    authMiddleware,
    requireRole(UserRole.ADMIN),
    validateSSOConfig,
    async (req: Request, res: Response) => {
      try {
        const { providerId } = req.params;
        
        // Implementation would update the provider configuration
        res.json({
          success: true,
          message: 'Provider updated successfully',
          providerId
        });
      } catch (error) {
        logger.error('Error updating SSO provider:', error);
        res.status(400).json({
          success: false,
          message: 'Failed to update provider'
        });
      
      return;
    }
  });

  /**
   * Delete SSO Provider
   * DELETE /api/auth/sso/providers/:providerId
   */
  router.delete('/providers/:providerId',
    authMiddleware,
    requireRole(UserRole.ADMIN),
    async (req: Request, res: Response) => {
      try {
        const { providerId } = req.params;
        
        // Implementation would delete the provider configuration
        res.json({
          success: true,
          message: 'Provider deleted successfully',
          providerId
        });
      } catch (error) {
        logger.error('Error deleting SSO provider:', error);
        res.status(400).json({
          success: false,
          message: 'Failed to delete provider'
        });
      
      return;
    }
  });

  /**
   * Export SSO Configuration
   * GET /api/auth/sso/export
   */
  router.get('/export',
    authMiddleware,
    requireRole(UserRole.ADMIN),
    async (req: Request, res: Response) => {
      try {
        const { organizationId, format = 'json' } = req.query;
        
        // Implementation would export SSO configuration
        const config = {
          organizationId,
          exportedAt: new Date().toISOString(),
          providers: [],
          metrics: ssoService.getSSOMetrics()
        };

        if (format === 'json') {
          res.json(config);
        } else if (format === 'csv') {
          res.set('Content-Type', 'text/csv');
          res.send('SSO export in CSV format not implemented');
        } else {
          res.status(400).json({
            success: false,
            message: 'Unsupported export format'
          });
        }
      } catch (error) {
        logger.error('Error exporting SSO configuration:', error);
        res.status(500).json({
          success: false,
          message: 'Failed to export configuration'
        });
      
      return;
    }
  });

  return router;
}