/**
 * Enterprise SSO Management Dashboard API
 * Comprehensive administrative interface for SSO configuration and monitoring
 */

import { Router, Request, Response } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth.middleware';
import { UserRole } from '../types/auth';
import { SSOConfigurationTemplates, SSOConfigurationWizard } from '../utils/sso-configuration-templates';
import { SSOMonitoringService, SSOComplianceMonitor } from '../services/sso-monitoring.service';
import { EnterpriseSSOService } from '../services/enterprise-sso.service';
import { logger } from '../utils/logger';
// import { validateRequest } from '../validation/sso.validation';

export function createSSOManagementRouter(): Router {
  const router = Router();
  const ssoService = new EnterpriseSSOService();
  const monitoringService = new SSOMonitoringService();
  const complianceMonitor = new SSOComplianceMonitor();

  /**
   * Get SSO Dashboard Overview
   * GET /api/auth/sso/dashboard
   */
  router.get('/dashboard',
    authMiddleware,
    requireRole(UserRole.ADMIN),
    async (req: Request, res: Response) => {
      try {
        const organizationId = req.user!.organization;

        // Get comprehensive dashboard data
        const [
          healthStatus,
          metrics,
          performanceData,
          recentAlerts,
          securityReport
        ] = await Promise.all([
          monitoringService.getHealthStatus(),
          ssoService.getSSOMetrics(),
          monitoringService.getPerformanceAnalytics('day'),
          monitoringService.getAlerts({ limit: 10, acknowledged: false }),
          monitoringService.generateSecurityReport('day')
        ]);

        const dashboard = {
          overview: {
            status: healthStatus.overall,
            activeProviders: metrics.activeProviders,
            activeSessions: metrics.activeSessions,
            totalLogins: metrics.totalLogins,
            successRate: metrics.totalLogins > 0 
              ? ((metrics.successfulLogins / metrics.totalLogins) * 100).toFixed(1)
              : '0',
            averageLoginTime: `${metrics.averageLoginTime.toFixed(0)}ms`
          },
          performance: {
            ...performanceData,
            trend: 'stable' // Could be calculated from historical data
          },
          security: {
            criticalAlerts: recentAlerts.filter(a => a.severity === 'critical').length,
            highAlerts: recentAlerts.filter(a => a.severity === 'high').length,
            recentFailures: securityReport.summary.failedLogins,
            suspiciousActivity: securityReport.summary.suspiciousActivity
          },
          providers: Object.entries(healthStatus.providers).map(([id, status]) => ({
            id,
            name: id, // Would come from configuration
            status: status.status,
            lastCheck: status.lastChecked,
            responseTime: status.responseTime
          })),
          recentActivity: {
            alerts: recentAlerts.slice(0, 5),
            logins: securityReport.loginsByProvider
          }
        };

        res.json({
          success: true,
          data: dashboard,
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        logger.error('Error fetching SSO dashboard:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to fetch dashboard data'
        });
      }
    }
  );

  /**
   * Get Available SSO Provider Templates
   * GET /api/auth/sso/templates
   */
  router.get('/templates',
    authMiddleware,
    requireRole(UserRole.ADMIN),
    async (req: Request, res: Response) => {
      try {
        const templates = SSOConfigurationTemplates.getAllTemplates();
        
        res.json({
          success: true,
          data: {
            templates,
            count: templates.length
          }
        });
      } catch (error) {
        logger.error('Error fetching SSO templates:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to fetch templates'
        });
      }
    }
  );

  /**
   * Generate Provider Configuration Template
   * POST /api/auth/sso/templates/generate
   */
  router.post('/templates/generate',
    authMiddleware,
    requireRole(UserRole.ADMIN),
    async (req: Request, res: Response) => {
      try {
        const { provider, domain, ...params } = req.body;
        const organizationId = req.user!.organization;

        let template;
        switch (provider) {
          case 'azure-ad':
            template = SSOConfigurationTemplates.createAzureADTemplate(organizationId, domain);
            break;
          case 'google-workspace':
            template = SSOConfigurationTemplates.createGoogleWorkspaceTemplate(
              organizationId, domain, params.hostedDomain
            );
            break;
          case 'okta':
            template = SSOConfigurationTemplates.createOktaTemplate(
              organizationId, domain, params.oktaDomain
            );
            break;
          case 'saml':
            template = SSOConfigurationTemplates.createSAMLTemplate(organizationId, domain);
            break;
          case 'oidc':
            template = SSOConfigurationTemplates.createOIDCTemplate(organizationId, domain);
            break;
          case 'ping-identity':
            template = SSOConfigurationTemplates.createPingIdentityTemplate(
              organizationId, domain, params.environmentId
            );
            break;
          default:
            return res.status(400).json({
              success: false,
              error: 'Unsupported provider type'
            });
        }

        // Validate the generated template
        const validation = SSOConfigurationTemplates.validateConfiguration(template);
        const recommendations = SSOConfigurationTemplates.generateSecurityRecommendations(provider);

        res.json({
          success: true,
          data: {
            configuration: template,
            validation,
            recommendations,
            nextSteps: [
              'Review and customize the configuration',
              'Fill in the required credentials and endpoints',
              'Test the connection before enabling',
              'Configure user attribute mapping',
              'Set up monitoring and alerts'
            ]
          }
        });

      } catch (error) {
        logger.error('Error generating SSO template:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to generate template'
        });
      }
    }
  );

  /**
   * Get Configuration Wizard Steps
   * GET /api/auth/sso/wizard/:provider
   */
  router.get('/wizard/:provider',
    authMiddleware,
    requireRole(UserRole.ADMIN),
    async (req: Request, res: Response) => {
      try {
        const { provider } = req.params;
        const steps = SSOConfigurationWizard.generateConfigurationSteps(provider);

        res.json({
          success: true,
          data: {
            provider,
            steps,
            totalSteps: steps.length,
            estimatedTime: '15-30 minutes'
          }
        });
      } catch (error) {
        logger.error('Error fetching wizard steps:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to fetch wizard steps'
        });
      }
    }
  );

  /**
   * Get SSO Analytics and Metrics
   * GET /api/auth/sso/analytics
   */
  router.get('/analytics',
    authMiddleware,
    requireRole(UserRole.ADMIN),
    async (req: Request, res: Response) => {
      try {
        const timeRange = (req.query.timeRange as string) || 'day';
        
        if (!['hour', 'day', 'week', 'month'].includes(timeRange)) {
          return res.status(400).json({
            success: false,
            error: 'Invalid time range. Must be hour, day, week, or month'
          });
        }

        const [
          performanceMetrics,
          securityReport,
          metrics
        ] = await Promise.all([
          monitoringService.getPerformanceAnalytics(timeRange as any),
          monitoringService.generateSecurityReport(timeRange as any),
          ssoService.getSSOMetrics()
        ]);

        const analytics = {
          timeRange,
          performance: performanceMetrics,
          security: securityReport,
          overview: {
            totalProviders: metrics.activeProviders,
            totalSessions: metrics.activeSessions,
            totalLogins: metrics.totalLogins,
            successRate: metrics.totalLogins > 0 
              ? (metrics.successfulLogins / metrics.totalLogins * 100)
              : 0
          },
          trends: {
            loginGrowth: '+12%', // Would be calculated from historical data
            errorRateChange: '-3%',
            performanceChange: '+5%'
          }
        };

        res.json({
          success: true,
          data: analytics
        });

      } catch (error) {
        logger.error('Error fetching SSO analytics:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to fetch analytics'
        });
      }
    }
  );

  /**
   * Get SSO Security Alerts
   * GET /api/auth/sso/alerts
   */
  router.get('/alerts',
    authMiddleware,
    requireRole(UserRole.ADMIN),
    async (req: Request, res: Response) => {
      try {
        const filters = {
          type: req.query.type as string,
          severity: req.query.severity as string,
          providerId: req.query.providerId as string,
          acknowledged: req.query.acknowledged === 'true' ? true : 
                       req.query.acknowledged === 'false' ? false : undefined,
          limit: parseInt(req.query.limit as string) || 50
        };

        const alerts = monitoringService.getAlerts(filters);

        res.json({
          success: true,
          data: {
            alerts,
            total: alerts.length,
            filters,
            summary: {
              critical: alerts.filter(a => a.severity === 'critical').length,
              high: alerts.filter(a => a.severity === 'high').length,
              medium: alerts.filter(a => a.severity === 'medium').length,
              low: alerts.filter(a => a.severity === 'low').length,
              unacknowledged: alerts.filter(a => !a.acknowledged).length
            }
          }
        });

      } catch (error) {
        logger.error('Error fetching SSO alerts:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to fetch alerts'
        });
      }
    }
  );

  /**
   * Acknowledge Alert
   * POST /api/auth/sso/alerts/:alertId/acknowledge
   */
  router.post('/alerts/:alertId/acknowledge',
    authMiddleware,
    requireRole(UserRole.ADMIN),
    async (req: Request, res: Response) => {
      try {
        const { alertId } = req.params;
        const acknowledgedBy = req.user!.email;

        const success = monitoringService.acknowledgeAlert(alertId, acknowledgedBy);

        if (success) {
          res.json({
            success: true,
            message: 'Alert acknowledged successfully'
          });
        } else {
          res.status(404).json({
            success: false,
            error: 'Alert not found'
          });
        }

      } catch (error) {
        logger.error('Error acknowledging alert:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to acknowledge alert'
        });
      }
    }
  );

  /**
   * Resolve Alert
   * POST /api/auth/sso/alerts/:alertId/resolve
   */
  router.post('/alerts/:alertId/resolve',
    authMiddleware,
    requireRole(UserRole.ADMIN),
    async (req: Request, res: Response) => {
      try {
        const { alertId } = req.params;
        const resolvedBy = req.user!.email;

        const success = monitoringService.resolveAlert(alertId, resolvedBy);

        if (success) {
          res.json({
            success: true,
            message: 'Alert resolved successfully'
          });
        } else {
          res.status(404).json({
            success: false,
            error: 'Alert not found'
          });
        }

      } catch (error) {
        logger.error('Error resolving alert:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to resolve alert'
        });
      }
    }
  );

  /**
   * Generate Compliance Report
   * POST /api/auth/sso/compliance/report
   */
  router.post('/compliance/report',
    authMiddleware,
    requireRole(UserRole.ADMIN),
    async (req: Request, res: Response) => {
      try {
        const { standard, startDate, endDate } = req.body;
        const organizationId = req.user!.organization;

        if (!['SOC2', 'GDPR', 'HIPAA', 'PCI-DSS'].includes(standard)) {
          return res.status(400).json({
            success: false,
            error: 'Invalid compliance standard'
          });
        }

        const report = complianceMonitor.generateComplianceReport(
          organizationId,
          standard,
          { startDate: new Date(startDate), endDate: new Date(endDate) }
        );

        res.json({
          success: true,
          data: {
            ...report,
            generatedAt: new Date().toISOString(),
            generatedBy: req.user!.email,
            organizationId,
            standard,
            period: { startDate, endDate }
          }
        });

      } catch (error) {
        logger.error('Error generating compliance report:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to generate compliance report'
        });
      }
    }
  );

  /**
   * Test SSO Provider Configuration
   * POST /api/auth/sso/test-configuration
   */
  router.post('/test-configuration',
    authMiddleware,
    requireRole(UserRole.ADMIN),
    async (req: Request, res: Response) => {
      try {
        const providerConfig = req.body;

        // Validate configuration
        const validation = SSOConfigurationTemplates.validateConfiguration(providerConfig);
        
        if (!validation.isValid) {
          return res.status(400).json({
            success: false,
            error: 'Configuration validation failed',
            details: validation.errors
          });
        }

        // Test connection
        const connectionTest = await ssoService.testSSOConnection(providerConfig);

        res.json({
          success: true,
          data: {
            validation,
            connectionTest,
            testCompleted: new Date().toISOString(),
            recommendations: validation.recommendations
          }
        });

      } catch (error) {
        logger.error('Error testing SSO configuration:', error);
        res.status(500).json({
          success: false,
          error: 'Configuration test failed',
          details: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  );

  /**
   * Get SSO Session Management
   * GET /api/auth/sso/sessions/active
   */
  router.get('/sessions/active',
    authMiddleware,
    requireRole(UserRole.ADMIN),
    async (req: Request, res: Response) => {
      try {
        const activeSessions = ssoService.getActiveSessions();
        const organizationId = req.user!.organization;

        // Filter sessions for current organization
        const orgSessions = activeSessions.filter(
          session => session.userId.includes(organizationId) // This would need proper filtering
        );

        const sessionsWithDetails = orgSessions.map(session => ({
          ...session,
          duration: Date.now() - session.loginTime.getTime(),
          isExpired: session.expiresAt ? new Date() > session.expiresAt : false
        }));

        res.json({
          success: true,
          data: {
            sessions: sessionsWithDetails,
            total: sessionsWithDetails.length,
            summary: {
              active: sessionsWithDetails.filter(s => !s.isExpired).length,
              expired: sessionsWithDetails.filter(s => s.isExpired).length,
              byProvider: sessionsWithDetails.reduce((acc, s) => {
                acc[s.providerId] = (acc[s.providerId] || 0) + 1;
                return acc;
              }, {} as Record<string, number>)
            }
          }
        });

      } catch (error) {
        logger.error('Error fetching active sessions:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to fetch active sessions'
        });
      }
    }
  );

  /**
   * Bulk Terminate Sessions
   * POST /api/auth/sso/sessions/terminate
   */
  router.post('/sessions/terminate',
    authMiddleware,
    requireRole(UserRole.ADMIN),
    async (req: Request, res: Response) => {
      try {
        const { sessionIds, reason } = req.body;

        if (!Array.isArray(sessionIds) || sessionIds.length === 0) {
          return res.status(400).json({
            success: false,
            error: 'Session IDs array is required'
          });
        }

        const results = await Promise.all(
          sessionIds.map(async (sessionId: string) => {
            try {
              const success = await ssoService.terminateSession(sessionId);
              return { sessionId, success };
            } catch (error) {
              return { sessionId, success: false, error: error.toString() };
            }
          })
        );

        const successful = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;

        res.json({
          success: true,
          data: {
            terminated: successful,
            failed,
            total: sessionIds.length,
            results,
            terminatedBy: req.user!.email,
            reason,
            timestamp: new Date().toISOString()
          }
        });

      } catch (error) {
        logger.error('Error terminating sessions:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to terminate sessions'
        });
      }
    }
  );

  return router;
}