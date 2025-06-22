import pino from 'pino';
import { config } from '../config';

// Create logger instance
export const logger = pino({
  level: config.LOG_LEVEL,
  formatters: {
    level: (label) => {
      return { level: label.toUpperCase() };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  ...(config.NODE_ENV === 'development' && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        ignore: 'pid,hostname',
        translateTime: 'yyyy-mm-dd HH:MM:ss',
      },
    },
  }),
});

// Audit logging utilities
export const auditLogger = {
  userCreated: (adminId: string, userId: string, email: string) => {
    logger.info({
      event: 'USER_CREATED',
      adminId,
      userId,
      email,
      timestamp: new Date().toISOString(),
    });
  },

  userUpdated: (adminId: string, userId: string, changes: any) => {
    logger.info({
      event: 'USER_UPDATED',
      adminId,
      userId,
      changes,
      timestamp: new Date().toISOString(),
    });
  },

  userDeleted: (adminId: string, userId: string) => {
    logger.info({
      event: 'USER_DELETED',
      adminId,
      userId,
      timestamp: new Date().toISOString(),
    });
  },

  roleAssigned: (adminId: string, userId: string, roleId: string) => {
    logger.info({
      event: 'ROLE_ASSIGNED',
      adminId,
      userId,
      roleId,
      timestamp: new Date().toISOString(),
    });
  },

  roleRevoked: (adminId: string, userId: string, roleId: string) => {
    logger.info({
      event: 'ROLE_REVOKED',
      adminId,
      userId,
      roleId,
      timestamp: new Date().toISOString(),
    });
  },

  organizationCreated: (adminId: string, orgId: string, name: string) => {
    logger.info({
      event: 'ORGANIZATION_CREATED',
      adminId,
      orgId,
      name,
      timestamp: new Date().toISOString(),
    });
  },

  organizationUpdated: (adminId: string, orgId: string, changes: any) => {
    logger.info({
      event: 'ORGANIZATION_UPDATED',
      adminId,
      orgId,
      changes,
      timestamp: new Date().toISOString(),
    });
  },

  teamCreated: (adminId: string, teamId: string, name: string, orgId: string) => {
    logger.info({
      event: 'TEAM_CREATED',
      adminId,
      teamId,
      name,
      orgId,
      timestamp: new Date().toISOString(),
    });
  },

  teamMemberAdded: (adminId: string, teamId: string, userId: string) => {
    logger.info({
      event: 'TEAM_MEMBER_ADDED',
      adminId,
      teamId,
      userId,
      timestamp: new Date().toISOString(),
    });
  },

  teamMemberRemoved: (adminId: string, teamId: string, userId: string) => {
    logger.info({
      event: 'TEAM_MEMBER_REMOVED',
      adminId,
      teamId,
      userId,
      timestamp: new Date().toISOString(),
    });
  },

  permissionGranted: (adminId: string, subjectId: string, permission: string, resourceId?: string) => {
    logger.info({
      event: 'PERMISSION_GRANTED',
      adminId,
      subjectId,
      permission,
      resourceId,
      timestamp: new Date().toISOString(),
    });
  },

  permissionRevoked: (adminId: string, subjectId: string, permission: string, resourceId?: string) => {
    logger.info({
      event: 'PERMISSION_REVOKED',
      adminId,
      subjectId,
      permission,
      resourceId,
      timestamp: new Date().toISOString(),
    });
  },

  suspiciousActivity: (userId: string, activity: string, details?: any) => {
    logger.warn({
      event: 'SUSPICIOUS_ACTIVITY',
      userId,
      activity,
      details,
      timestamp: new Date().toISOString(),
    });
  },
};

export default logger;