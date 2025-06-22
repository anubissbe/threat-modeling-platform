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

// Security-focused logging utilities
export const securityLogger = {
  loginAttempt: (userId: string, ip: string, userAgent: string, success: boolean) => {
    logger.info({
      event: 'LOGIN_ATTEMPT',
      userId,
      ip,
      userAgent,
      success,
      timestamp: new Date().toISOString(),
    });
  },

  loginFailure: (email: string, ip: string, reason: string) => {
    logger.warn({
      event: 'LOGIN_FAILURE',
      email,
      ip,
      reason,
      timestamp: new Date().toISOString(),
    });
  },

  mfaAttempt: (userId: string, method: string, success: boolean) => {
    logger.info({
      event: 'MFA_ATTEMPT',
      userId,
      method,
      success,
      timestamp: new Date().toISOString(),
    });
  },

  passwordReset: (userId: string, ip: string) => {
    logger.info({
      event: 'PASSWORD_RESET',
      userId,
      ip,
      timestamp: new Date().toISOString(),
    });
  },

  accountLockout: (userId: string, ip: string, attempts: number) => {
    logger.warn({
      event: 'ACCOUNT_LOCKOUT',
      userId,
      ip,
      attempts,
      timestamp: new Date().toISOString(),
    });
  },

  suspiciousActivity: (userId: string, ip: string, activity: string, details?: any) => {
    logger.warn({
      event: 'SUSPICIOUS_ACTIVITY',
      userId,
      ip,
      activity,
      details,
      timestamp: new Date().toISOString(),
    });
  },

  tokenRevocation: (userId: string, tokenType: string, reason: string) => {
    logger.info({
      event: 'TOKEN_REVOCATION',
      userId,
      tokenType,
      reason,
      timestamp: new Date().toISOString(),
    });
  },
};

export default logger;