import { v4 as uuidv4 } from 'uuid';
import { encryptionService } from '../utils/encryption';
import { logger } from '../utils/logger';

export enum AuditEventType {
  // Authentication events
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAILURE = 'LOGIN_FAILURE',
  LOGOUT = 'LOGOUT',
  PASSWORD_CHANGE = 'PASSWORD_CHANGE',
  PASSWORD_RESET_REQUEST = 'PASSWORD_RESET_REQUEST',
  PASSWORD_RESET_COMPLETE = 'PASSWORD_RESET_COMPLETE',
  
  // Authorization events
  ACCESS_GRANTED = 'ACCESS_GRANTED',
  ACCESS_DENIED = 'ACCESS_DENIED',
  PRIVILEGE_ESCALATION = 'PRIVILEGE_ESCALATION',
  
  // Data events
  DATA_CREATE = 'DATA_CREATE',
  DATA_READ = 'DATA_READ',
  DATA_UPDATE = 'DATA_UPDATE',
  DATA_DELETE = 'DATA_DELETE',
  DATA_EXPORT = 'DATA_EXPORT',
  
  // Security events
  SECURITY_ALERT = 'SECURITY_ALERT',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  
  // System events
  SYSTEM_START = 'SYSTEM_START',
  SYSTEM_STOP = 'SYSTEM_STOP',
  CONFIGURATION_CHANGE = 'CONFIGURATION_CHANGE',
  
  // Threat model events
  THREAT_MODEL_CREATE = 'THREAT_MODEL_CREATE',
  THREAT_MODEL_UPDATE = 'THREAT_MODEL_UPDATE',
  THREAT_MODEL_DELETE = 'THREAT_MODEL_DELETE',
  THREAT_MODEL_SHARE = 'THREAT_MODEL_SHARE',
  THREAT_MODEL_EXPORT = 'THREAT_MODEL_EXPORT',
}

export interface AuditEvent {
  id: string;
  timestamp: Date;
  eventType: AuditEventType;
  userId?: string;
  username?: string;
  userRole?: string;
  ipAddress?: string;
  userAgent?: string;
  resourceType?: string;
  resourceId?: string;
  action: string;
  result: 'SUCCESS' | 'FAILURE';
  details?: any;
  metadata?: Record<string, any>;
  risk_score?: number;
}

export class AuditService {
  private auditQueue: AuditEvent[] = [];
  private flushInterval: NodeJS.Timeout;
  private readonly BATCH_SIZE = 100;
  private readonly FLUSH_INTERVAL = 5000; // 5 seconds

  constructor() {
    // Start the flush interval
    this.flushInterval = setInterval(() => {
      this.flushAuditEvents();
    }, this.FLUSH_INTERVAL);
  }

  /**
   * Log an audit event
   */
  async logEvent(params: {
    eventType: AuditEventType;
    userId?: string;
    username?: string;
    userRole?: string;
    ipAddress?: string;
    userAgent?: string;
    resourceType?: string;
    resourceId?: string;
    action: string;
    result: 'SUCCESS' | 'FAILURE';
    details?: any;
    metadata?: Record<string, any>;
  }): Promise<void> {
    const auditEvent: AuditEvent = {
      id: uuidv4(),
      timestamp: new Date(),
      risk_score: this.calculateRiskScore(params.eventType, params.result),
      ...params,
    };

    // Encrypt sensitive details if present
    if (auditEvent.details && this.containsSensitiveData(auditEvent.details)) {
      auditEvent.details = encryptionService.encryptField(JSON.stringify(auditEvent.details));
    }

    // Add to queue for batch processing
    this.auditQueue.push(auditEvent);

    // Immediate flush for high-risk events
    if (this.isHighRiskEvent(params.eventType) || this.auditQueue.length >= this.BATCH_SIZE) {
      await this.flushAuditEvents();
    }

    // Log to application logger as well
    logger.info('Audit event', {
      eventType: params.eventType,
      userId: params.userId,
      action: params.action,
      result: params.result,
    });
  }

  /**
   * Log a security alert
   */
  async logSecurityAlert(params: {
    alertType: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    userId?: string;
    ipAddress?: string;
    details: any;
  }): Promise<void> {
    await this.logEvent({
      eventType: AuditEventType.SECURITY_ALERT,
      userId: params.userId,
      ipAddress: params.ipAddress,
      action: `Security Alert: ${params.alertType}`,
      result: 'FAILURE',
      details: params.details,
      metadata: { severity: params.severity },
    });

    // For critical alerts, also trigger immediate notification
    if (params.severity === 'CRITICAL') {
      // TODO: Implement notification service
      logger.error('CRITICAL SECURITY ALERT', params);
    }
  }

  /**
   * Flush audit events to storage
   */
  private async flushAuditEvents(): Promise<void> {
    if (this.auditQueue.length === 0) {
      return;
    }

    const eventsToFlush = [...this.auditQueue];
    this.auditQueue = [];

    try {
      // TODO: Implement actual storage (e.g., to database or SIEM)
      // For now, log to file/console
      for (const event of eventsToFlush) {
        logger.info('AUDIT_LOG', event);
      }

      // In production, you would:
      // 1. Store in a secure audit database
      // 2. Forward to SIEM system
      // 3. Archive old logs
      // 4. Implement log retention policies
    } catch (error) {
      logger.error('Failed to flush audit events', error);
      // Re-queue events on failure
      this.auditQueue = eventsToFlush.concat(this.auditQueue);
    }
  }

  /**
   * Calculate risk score for an event
   */
  private calculateRiskScore(eventType: AuditEventType, result: 'SUCCESS' | 'FAILURE'): number {
    const baseScores: Record<AuditEventType, number> = {
      [AuditEventType.LOGIN_SUCCESS]: 1,
      [AuditEventType.LOGIN_FAILURE]: 3,
      [AuditEventType.LOGOUT]: 0,
      [AuditEventType.PASSWORD_CHANGE]: 2,
      [AuditEventType.PASSWORD_RESET_REQUEST]: 2,
      [AuditEventType.PASSWORD_RESET_COMPLETE]: 2,
      [AuditEventType.ACCESS_GRANTED]: 1,
      [AuditEventType.ACCESS_DENIED]: 4,
      [AuditEventType.PRIVILEGE_ESCALATION]: 8,
      [AuditEventType.DATA_CREATE]: 2,
      [AuditEventType.DATA_READ]: 1,
      [AuditEventType.DATA_UPDATE]: 3,
      [AuditEventType.DATA_DELETE]: 5,
      [AuditEventType.DATA_EXPORT]: 4,
      [AuditEventType.SECURITY_ALERT]: 7,
      [AuditEventType.SUSPICIOUS_ACTIVITY]: 9,
      [AuditEventType.RATE_LIMIT_EXCEEDED]: 6,
      [AuditEventType.SYSTEM_START]: 1,
      [AuditEventType.SYSTEM_STOP]: 1,
      [AuditEventType.CONFIGURATION_CHANGE]: 5,
      [AuditEventType.THREAT_MODEL_CREATE]: 2,
      [AuditEventType.THREAT_MODEL_UPDATE]: 2,
      [AuditEventType.THREAT_MODEL_DELETE]: 4,
      [AuditEventType.THREAT_MODEL_SHARE]: 3,
      [AuditEventType.THREAT_MODEL_EXPORT]: 4,
    };

    let score = baseScores[eventType] || 5;
    
    // Increase score for failures
    if (result === 'FAILURE') {
      score = Math.min(score * 1.5, 10);
    }

    return Math.round(score);
  }

  /**
   * Check if event type is high risk
   */
  private isHighRiskEvent(eventType: AuditEventType): boolean {
    const highRiskEvents = [
      AuditEventType.PRIVILEGE_ESCALATION,
      AuditEventType.SECURITY_ALERT,
      AuditEventType.SUSPICIOUS_ACTIVITY,
      AuditEventType.DATA_DELETE,
      AuditEventType.CONFIGURATION_CHANGE,
    ];

    return highRiskEvents.includes(eventType);
  }

  /**
   * Check if data contains sensitive information
   */
  private containsSensitiveData(data: any): boolean {
    if (typeof data !== 'object' || !data) {
      return false;
    }

    const sensitiveFields = [
      'password',
      'token',
      'secret',
      'key',
      'ssn',
      'creditCard',
      'apiKey',
      'privateKey',
    ];

    const dataString = JSON.stringify(data).toLowerCase();
    return sensitiveFields.some(field => dataString.includes(field.toLowerCase()));
  }

  /**
   * Query audit logs
   */
  async queryAuditLogs(params: {
    startDate?: Date;
    endDate?: Date;
    userId?: string;
    eventType?: AuditEventType;
    resourceType?: string;
    resourceId?: string;
    minRiskScore?: number;
    limit?: number;
    offset?: number;
  }): Promise<AuditEvent[]> {
    // TODO: Implement actual query from storage
    // This would query the audit database with appropriate filters
    logger.info('Querying audit logs', params);
    return [];
  }

  /**
   * Generate audit report
   */
  async generateAuditReport(params: {
    startDate: Date;
    endDate: Date;
    reportType: 'SUMMARY' | 'DETAILED' | 'COMPLIANCE';
  }): Promise<any> {
    // TODO: Implement report generation
    logger.info('Generating audit report', params);
    return {
      reportType: params.reportType,
      period: {
        start: params.startDate,
        end: params.endDate,
      },
      summary: {
        totalEvents: 0,
        successfulEvents: 0,
        failedEvents: 0,
        highRiskEvents: 0,
      },
    };
  }

  /**
   * Cleanup on service shutdown
   */
  async shutdown(): Promise<void> {
    clearInterval(this.flushInterval);
    await this.flushAuditEvents();
  }
}

// Export singleton instance
export const auditService = new AuditService();