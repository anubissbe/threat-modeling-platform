import { EventEmitter } from 'events';
import { auditService, AuditEventType } from './audit.service';
import { logger } from '../utils/logger';

export interface SecurityEvent {
  id: string;
  timestamp: Date;
  type: SecurityEventType;
  severity: SecuritySeverity;
  source: string;
  userId?: string;
  ipAddress?: string;
  details: any;
  indicators: string[];
  riskScore: number;
}

export enum SecurityEventType {
  BRUTE_FORCE_ATTEMPT = 'BRUTE_FORCE_ATTEMPT',
  CREDENTIAL_STUFFING = 'CREDENTIAL_STUFFING',
  SUSPICIOUS_LOGIN = 'SUSPICIOUS_LOGIN',
  PRIVILEGE_ESCALATION_ATTEMPT = 'PRIVILEGE_ESCALATION_ATTEMPT',
  DATA_EXFILTRATION_ATTEMPT = 'DATA_EXFILTRATION_ATTEMPT',
  INJECTION_ATTEMPT = 'INJECTION_ATTEMPT',
  UNAUTHORIZED_ACCESS = 'UNAUTHORIZED_ACCESS',
  ANOMALOUS_BEHAVIOR = 'ANOMALOUS_BEHAVIOR',
  POLICY_VIOLATION = 'POLICY_VIOLATION',
}

export enum SecuritySeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

interface UserBehaviorProfile {
  userId: string;
  normalLoginTimes: number[]; // Hour of day
  normalIpAddresses: string[];
  normalUserAgents: string[];
  normalLocations: string[];
  averageSessionDuration: number;
  failedLoginAttempts: number;
  lastSuccessfulLogin?: Date;
  riskScore: number;
}

export class SecurityMonitoringService extends EventEmitter {
  private loginAttempts: Map<string, { count: number; lastAttempt: Date }> = new Map();
  private userProfiles: Map<string, UserBehaviorProfile> = new Map();
  private blockedIPs: Set<string> = new Set();
  private suspiciousPatterns: RegExp[] = [
    /(<script|javascript:|onerror=|onload=)/i,
    /(union.*select|select.*from|insert.*into|delete.*from)/i,
    /(\.\.\/|\.\.\\)/,
    /(\$\{.*\})/,
    /(eval|exec|system|shell_exec)/i,
  ];

  constructor() {
    super();
    this.setupEventHandlers();
    this.startMonitoringLoop();
  }

  /**
   * Monitor login attempts for brute force detection
   */
  async monitorLoginAttempt(params: {
    userId?: string;
    ipAddress: string;
    success: boolean;
    userAgent?: string;
  }): Promise<void> {
    const key = params.userId || params.ipAddress;
    const attempt = this.loginAttempts.get(key) || { count: 0, lastAttempt: new Date() };

    if (!params.success) {
      attempt.count++;
      attempt.lastAttempt = new Date();
      this.loginAttempts.set(key, attempt);

      // Check for brute force
      if (attempt.count >= 5) {
        await this.handleSecurityEvent({
          type: SecurityEventType.BRUTE_FORCE_ATTEMPT,
          severity: SecuritySeverity.HIGH,
          source: 'auth',
          userId: params.userId,
          ipAddress: params.ipAddress,
          details: {
            attemptCount: attempt.count,
            timeWindow: '15 minutes',
          },
          indicators: ['multiple_failed_logins', 'rapid_attempts'],
          riskScore: 8,
        });

        // Block IP after 10 attempts
        if (attempt.count >= 10) {
          this.blockIP(params.ipAddress);
        }
      }
    } else {
      // Reset counter on successful login
      this.loginAttempts.delete(key);

      // Check for suspicious login patterns
      if (params.userId) {
        await this.analyzeLoginBehavior({
          userId: params.userId,
          ipAddress: params.ipAddress,
          userAgent: params.userAgent,
          timestamp: new Date(),
        });
      }
    }
  }

  /**
   * Analyze user behavior for anomalies
   */
  private async analyzeLoginBehavior(params: {
    userId: string;
    ipAddress: string;
    userAgent?: string;
    timestamp: Date;
  }): Promise<void> {
    const profile = this.userProfiles.get(params.userId) || this.createNewProfile(params.userId);
    const hour = params.timestamp.getHours();
    const indicators: string[] = [];

    // Check login time anomaly
    if (!profile.normalLoginTimes.includes(hour)) {
      const avgTime = profile.normalLoginTimes.reduce((a, b) => a + b, 0) / profile.normalLoginTimes.length;
      const deviation = Math.abs(hour - avgTime);
      
      if (deviation > 6) {
        indicators.push('unusual_login_time');
      }
    }

    // Check IP address anomaly
    if (!profile.normalIpAddresses.includes(params.ipAddress)) {
      indicators.push('new_ip_address');
      
      // Check if IP is from different country/region
      if (this.isSignificantLocationChange(profile.normalIpAddresses, params.ipAddress)) {
        indicators.push('location_anomaly');
      }
    }

    // Check user agent anomaly
    if (params.userAgent && !profile.normalUserAgents.includes(params.userAgent)) {
      indicators.push('new_device');
    }

    // If multiple indicators, flag as suspicious
    if (indicators.length >= 2) {
      await this.handleSecurityEvent({
        type: SecurityEventType.SUSPICIOUS_LOGIN,
        severity: SecuritySeverity.MEDIUM,
        source: 'auth',
        userId: params.userId,
        ipAddress: params.ipAddress,
        details: {
          indicators,
          profile: {
            normalLoginTimes: profile.normalLoginTimes,
            normalLocations: profile.normalLocations,
          },
        },
        indicators,
        riskScore: indicators.length * 2,
      });
    }

    // Update profile
    this.updateUserProfile(params.userId, params);
  }

  /**
   * Monitor for injection attempts
   */
  async monitorInjectionAttempt(params: {
    source: string;
    input: string;
    userId?: string;
    ipAddress?: string;
  }): Promise<boolean> {
    let isBlocked = false;

    for (const pattern of this.suspiciousPatterns) {
      if (pattern.test(params.input)) {
        await this.handleSecurityEvent({
          type: SecurityEventType.INJECTION_ATTEMPT,
          severity: SecuritySeverity.CRITICAL,
          source: params.source,
          userId: params.userId,
          ipAddress: params.ipAddress,
          details: {
            pattern: pattern.toString(),
            input: params.input.substring(0, 100),
          },
          indicators: ['malicious_pattern', 'injection_attempt'],
          riskScore: 9,
        });

        isBlocked = true;
        break;
      }
    }

    return isBlocked;
  }

  /**
   * Monitor data access patterns for exfiltration
   */
  async monitorDataAccess(params: {
    userId: string;
    resourceType: string;
    resourceCount: number;
    timeWindow: number; // minutes
  }): Promise<void> {
    const threshold = this.getExfiltrationThreshold(params.resourceType);
    
    if (params.resourceCount > threshold) {
      await this.handleSecurityEvent({
        type: SecurityEventType.DATA_EXFILTRATION_ATTEMPT,
        severity: SecuritySeverity.HIGH,
        source: 'data_access',
        userId: params.userId,
        details: {
          resourceType: params.resourceType,
          resourceCount: params.resourceCount,
          timeWindow: params.timeWindow,
          threshold,
        },
        indicators: ['excessive_data_access', 'rapid_requests'],
        riskScore: 7,
      });
    }
  }

  /**
   * Handle security events
   */
  private async handleSecurityEvent(event: Omit<SecurityEvent, 'id' | 'timestamp'>): Promise<void> {
    const securityEvent: SecurityEvent = {
      id: `sec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      ...event,
    };

    // Emit event for real-time monitoring
    this.emit('security:event', securityEvent);

    // Log to audit service
    await auditService.logSecurityAlert({
      alertType: event.type,
      severity: event.severity,
      userId: event.userId,
      ipAddress: event.ipAddress,
      details: event.details,
    });

    // Take automated actions based on severity
    if (event.severity === SecuritySeverity.CRITICAL) {
      await this.handleCriticalEvent(securityEvent);
    }

    logger.warn('Security event detected', securityEvent);
  }

  /**
   * Handle critical security events
   */
  private async handleCriticalEvent(event: SecurityEvent): Promise<void> {
    // Immediate actions for critical events
    switch (event.type) {
      case SecurityEventType.INJECTION_ATTEMPT:
        if (event.ipAddress) {
          this.blockIP(event.ipAddress);
        }
        break;

      case SecurityEventType.DATA_EXFILTRATION_ATTEMPT:
        if (event.userId) {
          // TODO: Temporarily suspend user access
          await auditService.logEvent({
            eventType: AuditEventType.ACCESS_DENIED,
            userId: event.userId,
            action: 'User access suspended due to security threat',
            result: 'SUCCESS',
            metadata: { reason: event.type },
          });
        }
        break;

      case SecurityEventType.PRIVILEGE_ESCALATION_ATTEMPT:
        // TODO: Revoke all sessions for the user
        break;
    }

    // TODO: Send notifications to security team
  }

  /**
   * Block an IP address
   */
  private blockIP(ipAddress: string): void {
    this.blockedIPs.add(ipAddress);
    logger.warn(`IP address blocked: ${ipAddress}`);
    
    // TODO: Update firewall rules
    // TODO: Notify security team
  }

  /**
   * Check if IP is blocked
   */
  isIPBlocked(ipAddress: string): boolean {
    return this.blockedIPs.has(ipAddress);
  }

  /**
   * Create new user behavior profile
   */
  private createNewProfile(userId: string): UserBehaviorProfile {
    return {
      userId,
      normalLoginTimes: [],
      normalIpAddresses: [],
      normalUserAgents: [],
      normalLocations: [],
      averageSessionDuration: 0,
      failedLoginAttempts: 0,
      riskScore: 0,
    };
  }

  /**
   * Update user behavior profile
   */
  private updateUserProfile(userId: string, loginData: any): void {
    const profile = this.userProfiles.get(userId) || this.createNewProfile(userId);
    
    // Update login times
    const hour = new Date().getHours();
    if (!profile.normalLoginTimes.includes(hour)) {
      profile.normalLoginTimes.push(hour);
      // Keep only last 10 unique hours
      if (profile.normalLoginTimes.length > 10) {
        profile.normalLoginTimes.shift();
      }
    }

    // Update IP addresses
    if (loginData.ipAddress && !profile.normalIpAddresses.includes(loginData.ipAddress)) {
      profile.normalIpAddresses.push(loginData.ipAddress);
      // Keep only last 5 IPs
      if (profile.normalIpAddresses.length > 5) {
        profile.normalIpAddresses.shift();
      }
    }

    // Update user agents
    if (loginData.userAgent && !profile.normalUserAgents.includes(loginData.userAgent)) {
      profile.normalUserAgents.push(loginData.userAgent);
      // Keep only last 3 user agents
      if (profile.normalUserAgents.length > 3) {
        profile.normalUserAgents.shift();
      }
    }

    profile.lastSuccessfulLogin = new Date();
    this.userProfiles.set(userId, profile);
  }

  /**
   * Check if location change is significant
   */
  private isSignificantLocationChange(knownIPs: string[], newIP: string): boolean {
    // TODO: Implement GeoIP lookup and distance calculation
    // For now, simple check if IP is from different subnet
    if (knownIPs.length === 0) return false;
    
    const newSubnet = newIP.split('.').slice(0, 2).join('.');
    const knownSubnets = knownIPs.map(ip => ip.split('.').slice(0, 2).join('.'));
    
    return !knownSubnets.includes(newSubnet);
  }

  /**
   * Get data exfiltration threshold
   */
  private getExfiltrationThreshold(resourceType: string): number {
    const thresholds: Record<string, number> = {
      'threat_model': 10,
      'user_data': 50,
      'audit_log': 100,
      'system_config': 5,
    };
    
    return thresholds[resourceType] || 100;
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    // Listen for authentication events
    this.on('auth:login_attempt', this.monitorLoginAttempt.bind(this));
    this.on('auth:suspicious_activity', this.handleSecurityEvent.bind(this));
  }

  /**
   * Start monitoring loop
   */
  private startMonitoringLoop(): void {
    // Clean up old login attempts every 15 minutes
    setInterval(() => {
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
      
      for (const [key, attempt] of this.loginAttempts) {
        if (attempt.lastAttempt < fifteenMinutesAgo) {
          this.loginAttempts.delete(key);
        }
      }
    }, 15 * 60 * 1000);

    // Analyze security trends every hour
    setInterval(async () => {
      await this.analyzeSecurityTrends();
    }, 60 * 60 * 1000);
  }

  /**
   * Analyze security trends
   */
  private async analyzeSecurityTrends(): Promise<void> {
    // TODO: Implement trend analysis
    // - Analyze patterns in security events
    // - Identify emerging threats
    // - Update risk scores
    // - Generate security insights
    
    logger.info('Security trend analysis completed');
  }

  /**
   * Get security dashboard data
   */
  async getSecurityDashboard(): Promise<{
    currentThreats: number;
    blockedIPs: number;
    suspiciousLogins24h: number;
    injectionAttempts24h: number;
    overallRiskScore: number;
    topThreats: any[];
  }> {
    // TODO: Implement actual metrics collection
    return {
      currentThreats: 0,
      blockedIPs: this.blockedIPs.size,
      suspiciousLogins24h: 0,
      injectionAttempts24h: 0,
      overallRiskScore: 3.5,
      topThreats: [],
    };
  }
}

// Export singleton instance
export const securityMonitoringService = new SecurityMonitoringService();