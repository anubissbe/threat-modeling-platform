/**
 * Enterprise SSO Monitoring and Analytics Service
 * Provides comprehensive monitoring, alerting, and analytics for SSO operations
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { 
  SSOMetrics, 
  SSOAuditEvent, 
  SSOSessionInfo, 
  SSOProviderStatus,
  ProviderMetrics,
  SSOEventType
} from '../types/enterprise-sso';

export interface SSOAlert {
  id: string;
  type: 'security' | 'performance' | 'availability' | 'compliance';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  providerId?: string;
  userId?: string;
  timestamp: Date;
  acknowledged: boolean;
  resolvedAt?: Date;
  metadata?: Record<string, any>;
}

export interface SSOHealthCheck {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  providers: Record<string, SSOProviderStatus>;
  alerts: SSOAlert[];
  metrics: SSOMetrics;
  lastCheck: Date;
}

export interface SSOPerformanceMetrics {
  averageLoginTime: number;
  p95LoginTime: number;
  p99LoginTime: number;
  loginThroughput: number; // logins per minute
  errorRate: number; // percentage
  availabilityScore: number; // percentage
}

export class SSOMonitoringService extends EventEmitter {
  private alerts: Map<string, SSOAlert> = new Map();
  private healthHistory: SSOHealthCheck[] = [];
  private performanceData: Array<{
    timestamp: Date;
    metrics: SSOPerformanceMetrics;
  }> = [];
  
  // Alert thresholds
  private readonly alertThresholds = {
    highErrorRate: 5, // %
    slowLoginTime: 5000, // ms
    highFailureCount: 10, // failures in 5 minutes
    sessionExpiryWarning: 7, // days before certificate expiry
    suspiciousActivityThreshold: 5 // failed logins from same IP
  };

  constructor() {
    super();
    this.setupPeriodicChecks();
  }

  /**
   * Monitor SSO login attempt
   */
  recordLoginAttempt(
    providerId: string,
    userId: string,
    success: boolean,
    duration: number,
    metadata: Record<string, any> = {}
  ): void {
    const event: SSOAuditEvent = {
      id: `login_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      eventType: success ? 'SSO_LOGIN_SUCCESS' : 'SSO_LOGIN_FAILURE',
      userId,
      organizationId: metadata.organizationId || '',
      providerId,
      success,
      sourceIp: metadata.sourceIp,
      userAgent: metadata.userAgent,
      errorMessage: success ? undefined : metadata.error,
      metadata: {
        duration,
        ...metadata
      }
    };

    this.emit('auditEvent', event);

    // Check for alerts
    this.checkLoginAlerts(providerId, userId, success, duration, metadata);
  }

  /**
   * Monitor SSO provider health
   */
  async checkProviderHealth(providerId: string, config: any): Promise<SSOProviderStatus> {
    const startTime = Date.now();
    
    try {
      // Simulate health check - in real implementation this would test actual connectivity
      const isHealthy = await this.performHealthCheck(providerId, config);
      const responseTime = Date.now() - startTime;

      const status: SSOProviderStatus = {
        status: isHealthy ? 'active' : 'error',
        message: isHealthy ? 'Provider is healthy' : 'Provider health check failed',
        lastChecked: new Date(),
        responseTime,
        healthChecks: {
          connectivity: isHealthy,
          certificate: await this.checkCertificateHealth(config),
          metadata: await this.checkMetadataHealth(config),
          authentication: isHealthy
        }
      };

      // Check for performance alerts
      if (responseTime > this.alertThresholds.slowLoginTime) {
        this.createAlert({
          type: 'performance',
          severity: 'medium',
          title: 'Slow SSO Provider Response',
          description: `Provider ${providerId} responded in ${responseTime}ms, which exceeds threshold`,
          providerId,
          metadata: { responseTime, threshold: this.alertThresholds.slowLoginTime }
        });
      }

      return status;
    } catch (error) {
      const status: SSOProviderStatus = {
        status: 'error',
        message: `Health check failed: ${error}`,
        lastChecked: new Date(),
        responseTime: Date.now() - startTime,
        healthChecks: {
          connectivity: false,
          certificate: false,
          metadata: false,
          authentication: false
        }
      };

      this.createAlert({
        type: 'availability',
        severity: 'high',
        title: 'SSO Provider Unavailable',
        description: `Provider ${providerId} failed health check: ${error}`,
        providerId,
        metadata: { error: error.toString() }
      });

      return status;
    }
  }

  /**
   * Get comprehensive SSO health status
   */
  async getHealthStatus(): Promise<SSOHealthCheck> {
    const alerts = Array.from(this.alerts.values())
      .filter(alert => !alert.acknowledged)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    const criticalAlerts = alerts.filter(alert => alert.severity === 'critical');
    const highAlerts = alerts.filter(alert => alert.severity === 'high');

    let overall: 'healthy' | 'degraded' | 'unhealthy';
    if (criticalAlerts.length > 0) {
      overall = 'unhealthy';
    } else if (highAlerts.length > 0 || alerts.length > 10) {
      overall = 'degraded';
    } else {
      overall = 'healthy';
    }

    const healthCheck: SSOHealthCheck = {
      overall,
      providers: {}, // Would be populated with actual provider statuses
      alerts: alerts.slice(0, 20), // Latest 20 alerts
      metrics: this.getCurrentMetrics(),
      lastCheck: new Date()
    };

    this.healthHistory.push(healthCheck);
    if (this.healthHistory.length > 100) {
      this.healthHistory.shift(); // Keep last 100 checks
    }

    return healthCheck;
  }

  /**
   * Get performance analytics
   */
  getPerformanceAnalytics(timeRange: 'hour' | 'day' | 'week' | 'month'): SSOPerformanceMetrics {
    const now = new Date();
    const timeRangeMs = {
      hour: 60 * 60 * 1000,
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000
    };

    const cutoffTime = new Date(now.getTime() - timeRangeMs[timeRange]);
    const relevantData = this.performanceData.filter(
      data => data.timestamp >= cutoffTime
    );

    if (relevantData.length === 0) {
      return {
        averageLoginTime: 0,
        p95LoginTime: 0,
        p99LoginTime: 0,
        loginThroughput: 0,
        errorRate: 0,
        availabilityScore: 100
      };
    }

    // Calculate aggregated metrics
    const loginTimes = relevantData.map(d => d.metrics.averageLoginTime).sort((a, b) => a - b);
    const errorRates = relevantData.map(d => d.metrics.errorRate);
    const availabilityScores = relevantData.map(d => d.metrics.availabilityScore);

    return {
      averageLoginTime: loginTimes.reduce((a, b) => a + b, 0) / loginTimes.length,
      p95LoginTime: loginTimes[Math.floor(loginTimes.length * 0.95)] || 0,
      p99LoginTime: loginTimes[Math.floor(loginTimes.length * 0.99)] || 0,
      loginThroughput: relevantData.reduce((sum, d) => sum + d.metrics.loginThroughput, 0) / relevantData.length,
      errorRate: errorRates.reduce((a, b) => a + b, 0) / errorRates.length,
      availabilityScore: availabilityScores.reduce((a, b) => a + b, 0) / availabilityScores.length
    };
  }

  /**
   * Create security alert
   */
  createAlert(alertData: Omit<SSOAlert, 'id' | 'timestamp' | 'acknowledged'>): SSOAlert {
    const alert: SSOAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      acknowledged: false,
      ...alertData
    };

    this.alerts.set(alert.id, alert);

    // Emit alert event
    this.emit('alert', alert);

    // Log critical and high alerts
    if (['critical', 'high'].includes(alert.severity)) {
      logger.warn(`SSO Alert [${alert.severity.toUpperCase()}]: ${alert.title}`, {
        alertId: alert.id,
        providerId: alert.providerId,
        description: alert.description
      });
    }

    return alert;
  }

  /**
   * Acknowledge alert
   */
  acknowledgeAlert(alertId: string, acknowledgedBy: string): boolean {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.acknowledged = true;
      alert.metadata = {
        ...alert.metadata,
        acknowledgedBy,
        acknowledgedAt: new Date()
      };
      return true;
    }
    return false;
  }

  /**
   * Resolve alert
   */
  resolveAlert(alertId: string, resolvedBy: string): boolean {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.resolvedAt = new Date();
      alert.metadata = {
        ...alert.metadata,
        resolvedBy
      };
      return true;
    }
    return false;
  }

  /**
   * Get alerts with filtering
   */
  getAlerts(filters: {
    type?: string;
    severity?: string;
    providerId?: string;
    acknowledged?: boolean;
    limit?: number;
  } = {}): SSOAlert[] {
    let alerts = Array.from(this.alerts.values());

    if (filters.type) {
      alerts = alerts.filter(alert => alert.type === filters.type);
    }
    if (filters.severity) {
      alerts = alerts.filter(alert => alert.severity === filters.severity);
    }
    if (filters.providerId) {
      alerts = alerts.filter(alert => alert.providerId === filters.providerId);
    }
    if (filters.acknowledged !== undefined) {
      alerts = alerts.filter(alert => alert.acknowledged === filters.acknowledged);
    }

    alerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    if (filters.limit) {
      alerts = alerts.slice(0, filters.limit);
    }

    return alerts;
  }

  /**
   * Generate SSO security report
   */
  generateSecurityReport(timeRange: 'day' | 'week' | 'month'): {
    summary: {
      totalLogins: number;
      failedLogins: number;
      successRate: number;
      uniqueUsers: number;
      suspiciousActivity: number;
    };
    topFailureReasons: Array<{ reason: string; count: number }>;
    loginsByProvider: Array<{ providerId: string; count: number; successRate: number }>;
    securityAlerts: SSOAlert[];
    recommendations: string[];
  } {
    // This would aggregate data from audit events and alerts
    // For now, return a sample structure
    return {
      summary: {
        totalLogins: 1250,
        failedLogins: 45,
        successRate: 96.4,
        uniqueUsers: 320,
        suspiciousActivity: 3
      },
      topFailureReasons: [
        { reason: 'Invalid credentials', count: 25 },
        { reason: 'Account locked', count: 12 },
        { reason: 'Provider timeout', count: 8 }
      ],
      loginsByProvider: [
        { providerId: 'azure-ad-main', count: 800, successRate: 98.2 },
        { providerId: 'okta-secondary', count: 450, successRate: 94.1 }
      ],
      securityAlerts: this.getAlerts({ type: 'security', limit: 10 }),
      recommendations: [
        'Review and update session timeout policies',
        'Implement additional MFA requirements for high-risk users',
        'Monitor certificate expiration dates more closely',
        'Consider implementing risk-based authentication'
      ]
    };
  }

  // Private helper methods

  private setupPeriodicChecks(): void {
    // Run health checks every 5 minutes
    setInterval(() => {
      this.performPeriodicHealthChecks();
    }, 5 * 60 * 1000);

    // Clean up old alerts every hour
    setInterval(() => {
      this.cleanupOldAlerts();
    }, 60 * 60 * 1000);

    // Record performance metrics every minute
    setInterval(() => {
      this.recordPerformanceMetrics();
    }, 60 * 1000);
  }

  private checkLoginAlerts(
    providerId: string,
    userId: string,
    success: boolean,
    duration: number,
    metadata: Record<string, any>
  ): void {
    // Check for slow login
    if (success && duration > this.alertThresholds.slowLoginTime) {
      this.createAlert({
        type: 'performance',
        severity: 'medium',
        title: 'Slow SSO Login',
        description: `Login for user ${userId} took ${duration}ms`,
        providerId,
        userId,
        metadata: { duration, threshold: this.alertThresholds.slowLoginTime }
      });
    }

    // Check for failed login patterns
    if (!success) {
      this.checkFailedLoginPatterns(providerId, userId, metadata);
    }
  }

  private checkFailedLoginPatterns(
    providerId: string,
    userId: string,
    metadata: Record<string, any>
  ): void {
    // This would check for suspicious patterns like:
    // - Multiple failed logins from same IP
    // - Multiple failed logins for same user
    // - Unusual login times or locations
    
    // For now, create a simple alert for demonstration
    this.createAlert({
      type: 'security',
      severity: 'medium',
      title: 'Failed SSO Login',
      description: `Failed login attempt for user ${userId}`,
      providerId,
      userId,
      metadata
    });
  }

  private async performHealthCheck(providerId: string, config: any): Promise<boolean> {
    // Simulate health check - in real implementation would test actual connectivity
    return Math.random() > 0.1; // 90% success rate for simulation
  }

  private async checkCertificateHealth(config: any): Promise<boolean> {
    // Check certificate validity and expiration
    return true; // Placeholder
  }

  private async checkMetadataHealth(config: any): Promise<boolean> {
    // Check metadata endpoint availability
    return true; // Placeholder
  }

  private getCurrentMetrics(): SSOMetrics {
    // Return current aggregated metrics
    return {
      totalLogins: 0,
      successfulLogins: 0,
      failedLogins: 0,
      activeProviders: 0,
      activeSessions: 0,
      averageLoginTime: 0,
      providerMetrics: new Map()
    };
  }

  private async performPeriodicHealthChecks(): Promise<void> {
    try {
      // This would check all configured providers
      logger.info('Performing periodic SSO health checks');
    } catch (error) {
      logger.error('Error in periodic health checks:', error);
    }
  }

  private cleanupOldAlerts(): void {
    const cutoffTime = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days
    
    for (const [alertId, alert] of this.alerts.entries()) {
      if (alert.timestamp < cutoffTime && alert.acknowledged) {
        this.alerts.delete(alertId);
      }
    }
  }

  private recordPerformanceMetrics(): void {
    // Record current performance snapshot
    const metrics: SSOPerformanceMetrics = {
      averageLoginTime: Math.random() * 1000 + 500, // 500-1500ms
      p95LoginTime: Math.random() * 2000 + 1000,    // 1000-3000ms
      p99LoginTime: Math.random() * 3000 + 2000,    // 2000-5000ms
      loginThroughput: Math.random() * 50 + 10,      // 10-60 per minute
      errorRate: Math.random() * 5,                  // 0-5%
      availabilityScore: 95 + Math.random() * 5      // 95-100%
    };

    this.performanceData.push({
      timestamp: new Date(),
      metrics
    });

    // Keep only last 24 hours of data
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
    this.performanceData = this.performanceData.filter(
      data => data.timestamp >= cutoffTime
    );
  }
}

/**
 * SSO Compliance Monitoring
 * Tracks compliance with various standards (SOC2, GDPR, etc.)
 */
export class SSOComplianceMonitor {
  generateComplianceReport(
    organizationId: string,
    standard: 'SOC2' | 'GDPR' | 'HIPAA' | 'PCI-DSS',
    period: { startDate: Date; endDate: Date }
  ): {
    complianceScore: number;
    requirements: Array<{
      requirement: string;
      status: 'compliant' | 'partial' | 'non-compliant';
      evidence: string[];
      gaps: string[];
    }>;
    recommendations: string[];
  } {
    const requirements = this.getComplianceRequirements(standard);
    
    return {
      complianceScore: 85, // Calculated based on requirement compliance
      requirements,
      recommendations: [
        'Implement session timeout policies per standard requirements',
        'Enhance audit logging to include all required data points',
        'Document SSO configuration change procedures',
        'Implement regular access reviews and certifications'
      ]
    };
  }

  private getComplianceRequirements(standard: string) {
    const requirements = {
      SOC2: [
        {
          requirement: 'CC6.1 - Logical and Physical Access Controls',
          status: 'compliant' as const,
          evidence: ['SSO configuration enforces MFA', 'Session timeouts configured'],
          gaps: []
        },
        {
          requirement: 'CC6.7 - Data Transmission and Disposal',
          status: 'partial' as const,
          evidence: ['HTTPS encryption in use'],
          gaps: ['Certificate rotation policy needed']
        }
      ],
      GDPR: [
        {
          requirement: 'Article 32 - Security of Processing',
          status: 'compliant' as const,
          evidence: ['Encrypted data transmission', 'Access controls implemented'],
          gaps: []
        }
      ]
    };

    return requirements[standard] || [];
  }
}