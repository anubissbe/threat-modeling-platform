import { FastifyPluginAsync } from 'fastify';
import { PasswordService } from '../services/password';
import { JwtService } from '../services/jwt';
import { MFAService } from '../services/mfa';
import { getRedis, SessionManager, RateLimiter } from '../redis';
import { query } from '../database';
import { config, parseTimeToMs } from '../config';
import { logger, securityLogger } from '../utils/logger';
import { randomBytes } from 'crypto';

const passwordService = new PasswordService();
const jwtService = new JwtService();
const mfaService = new MFAService();

let sessionManager: SessionManager;
let rateLimiter: RateLimiter;

const authRoutes: FastifyPluginAsync = async (fastify) => {
  // Initialize Redis-dependent services
  const redis = await getRedis();
  sessionManager = new SessionManager(redis);
  rateLimiter = new RateLimiter(redis, 'auth:');

  // Login endpoint
  fastify.post('/login', {
    preHandler: [fastify.authRateLimit(5, 15)], // 5 attempts per 15 minutes
    schema: {
      tags: ['Authentication'],
      summary: 'User login',
      description: 'Authenticate user with email and password',
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 1 },
          rememberMe: { type: 'boolean', default: false },
          deviceId: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            accessToken: { type: 'string' },
            refreshToken: { type: 'string' },
            expiresIn: { type: 'number' },
            user: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                email: { type: 'string' },
                roles: { type: 'array', items: { type: 'string' } },
                mfaEnabled: { type: 'boolean' },
              },
            },
            mfaRequired: { type: 'boolean' },
          },
        },
        401: { $ref: '#/components/schemas/ErrorResponse' },
        423: { $ref: '#/components/schemas/ErrorResponse' },
      },
    },
  }, async (request, reply) => {
    const { email, password, rememberMe = false, deviceId } = request.body as any;
    const ip = request.ip;
    const userAgent = request.headers['user-agent'] || '';

    try {
      // Get user from database
      const userResult = await query(
        `SELECT id, email, password_hash, roles, permissions, mfa_enabled, mfa_secret, 
                failed_login_attempts, locked_until, email_verified, organization_id
         FROM auth.users 
         WHERE email = $1 AND deleted_at IS NULL`,
        [email.toLowerCase()]
      );

      if (userResult.rows.length === 0) {
        securityLogger.loginFailure(email, ip, 'USER_NOT_FOUND');
        await reply.status(401).send({
          error: 'Authentication Failed',
          message: 'Invalid email or password',
        });
        return;
      }

      const user = userResult.rows[0];

      // Check if account is locked
      if (user.locked_until && new Date() < user.locked_until) {
        securityLogger.loginFailure(email, ip, 'ACCOUNT_LOCKED');
        await reply.status(423).send({
          error: 'Account Locked',
          message: 'Account is locked due to too many failed login attempts',
          code: 'ACCOUNT_LOCKED',
        });
        return;
      }

      // Check if email is verified
      if (!user.email_verified) {
        securityLogger.loginFailure(email, ip, 'EMAIL_NOT_VERIFIED');
        await reply.status(403).send({
          error: 'Email Not Verified',
          message: 'Please verify your email address before logging in',
          code: 'EMAIL_NOT_VERIFIED',
        });
        return;
      }

      // Verify password
      const isValidPassword = await passwordService.verify(password, user.password_hash);
      
      if (!isValidPassword) {
        // Increment failed login attempts
        const newAttempts = (user.failed_login_attempts || 0) + 1;
        const lockUntil = newAttempts >= config.MAX_LOGIN_ATTEMPTS 
          ? new Date(Date.now() + parseTimeToMs(config.LOCKOUT_DURATION))
          : null;

        await query(
          `UPDATE auth.users 
           SET failed_login_attempts = $1, locked_until = $2, updated_at = CURRENT_TIMESTAMP
           WHERE id = $3`,
          [newAttempts, lockUntil, user.id]
        );

        if (lockUntil) {
          securityLogger.accountLockout(user.id, ip, newAttempts);
        } else {
          securityLogger.loginFailure(email, ip, 'INVALID_PASSWORD');
        }

        await reply.status(401).send({
          error: 'Authentication Failed',
          message: 'Invalid email or password',
        });
        return;
      }

      // Reset failed login attempts on successful password verification
      await query(
        `UPDATE auth.users 
         SET failed_login_attempts = 0, locked_until = NULL, last_login_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [user.id]
      );

      // Generate session ID
      const sessionId = randomBytes(32).toString('hex');

      // Check if MFA is required
      if (user.mfa_enabled) {
        // Create temporary session for MFA verification
        await sessionManager.create(
          `mfa_pending:${sessionId}`,
          {
            userId: user.id,
            email: user.email,
            ip,
            userAgent,
            deviceId,
            stage: 'mfa_required',
          },
          600 // 10 minutes
        );

        securityLogger.loginAttempt(user.id, ip, userAgent, false);

        return reply.send({
          mfaRequired: true,
          sessionId,
          message: 'Multi-factor authentication required',
        });
      }

      // Create full session and tokens
      const tokens = await createUserSession(user, sessionId, ip, userAgent, deviceId, rememberMe);

      securityLogger.loginAttempt(user.id, ip, userAgent, true);

      return reply.send({
        ...tokens,
        user: {
          id: user.id,
          email: user.email,
          roles: user.roles || [],
          mfaEnabled: user.mfa_enabled,
        },
        mfaRequired: false,
      });

    } catch (error) {
      logger.error('Login error:', error);
      await reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Login failed due to server error',
      });
    }
  });

  // MFA verification endpoint
  fastify.post('/mfa/verify', {
    preHandler: [fastify.authRateLimit(5, 15)],
    schema: {
      tags: ['Authentication'],
      summary: 'Verify MFA token',
      description: 'Complete login by verifying MFA token',
      body: {
        type: 'object',
        required: ['sessionId', 'token', 'method'],
        properties: {
          sessionId: { type: 'string' },
          token: { type: 'string' },
          method: { type: 'string', enum: ['totp', 'backup'] },
          rememberMe: { type: 'boolean', default: false },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            accessToken: { type: 'string' },
            refreshToken: { type: 'string' },
            expiresIn: { type: 'number' },
            user: { $ref: '#/components/schemas/User' },
          },
        },
        400: { $ref: '#/components/schemas/ErrorResponse' },
        401: { $ref: '#/components/schemas/ErrorResponse' },
      },
    },
  }, async (request, reply) => {
    const { sessionId, token, method, rememberMe = false } = request.body as any;
    const ip = request.ip;
    const userAgent = request.headers['user-agent'] || '';

    try {
      // Get pending MFA session
      const pendingSession = await sessionManager.get(`mfa_pending:${sessionId}`);
      
      if (!pendingSession) {
        await reply.status(401).send({
          error: 'Invalid Session',
          message: 'MFA session not found or expired',
        });
        return;
      }

      // Get user from database
      const userResult = await query(
        `SELECT id, email, roles, permissions, mfa_secret, backup_codes, organization_id
         FROM auth.users 
         WHERE id = $1 AND deleted_at IS NULL`,
        [pendingSession.userId]
      );

      if (userResult.rows.length === 0) {
        await reply.status(401).send({
          error: 'User Not Found',
          message: 'User account not found',
        });
        return;
      }

      const user = userResult.rows[0];

      // Verify MFA token
      const mfaResult = await mfaService.verifyMFA(
        user.id,
        method,
        token,
        user.mfa_secret,
        user.backup_codes
      );

      if (!mfaResult.valid) {
        securityLogger.mfaAttempt(user.id, method, false);
        await reply.status(400).send({
          error: 'Invalid MFA Token',
          message: 'The provided MFA token is invalid',
          code: 'INVALID_MFA_TOKEN',
        });
        return;
      }

      // If backup code was used, remove it from user's backup codes
      if (mfaResult.method === 'backup' && mfaResult.backupCodeUsed) {
        const updatedBackupCodes = mfaService.removeUsedBackupCode(
          user.backup_codes,
          mfaResult.backupCodeUsed
        );
        
        await query(
          'UPDATE auth.users SET backup_codes = $1 WHERE id = $2',
          [JSON.stringify(updatedBackupCodes), user.id]
        );
      }

      // Remove pending MFA session
      await sessionManager.delete(`mfa_pending:${sessionId}`);

      // Create full session and tokens
      const tokens = await createUserSession(
        user,
        sessionId,
        ip,
        userAgent,
        pendingSession.deviceId,
        rememberMe
      );

      securityLogger.mfaAttempt(user.id, method, true);
      securityLogger.loginAttempt(user.id, ip, userAgent, true);

      return reply.send({
        ...tokens,
        user: {
          id: user.id,
          email: user.email,
          roles: user.roles || [],
          mfaEnabled: true,
        },
      });

    } catch (error) {
      logger.error('MFA verification error:', error);
      await reply.status(500).send({
        error: 'Internal Server Error',
        message: 'MFA verification failed due to server error',
      });
    }
  });

  // Refresh token endpoint
  fastify.post('/refresh', {
    schema: {
      tags: ['Authentication'],
      summary: 'Refresh access token',
      description: 'Get new access token using refresh token',
      body: {
        type: 'object',
        required: ['refreshToken'],
        properties: {
          refreshToken: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            accessToken: { type: 'string' },
            expiresIn: { type: 'number' },
          },
        },
        401: { $ref: '#/components/schemas/ErrorResponse' },
      },
    },
  }, async (request, reply) => {
    const { refreshToken } = request.body as any;

    try {
      const result = await jwtService.refreshAccessToken(refreshToken);
      
      if (!result) {
        await reply.status(401).send({
          error: 'Invalid Refresh Token',
          message: 'The provided refresh token is invalid or expired',
        });
        return;
      }

      return reply.send(result);
    } catch (error) {
      logger.error('Token refresh error:', error);
      await reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Token refresh failed',
      });
    }
  });

  // Logout endpoint
  fastify.post('/logout', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['Authentication'],
      summary: 'User logout',
      description: 'Logout user and invalidate tokens',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        properties: {
          allDevices: { type: 'boolean', default: false },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { allDevices = false } = request.body as any;
    const user = request.user!;

    try {
      // Get tokens from request
      const accessToken = jwtService.extractTokenFromRequest(request);
      
      if (accessToken) {
        // Blacklist current access token
        await jwtService.blacklistToken(accessToken, 'USER_LOGOUT');
      }

      if (allDevices) {
        // Revoke all user sessions
        await sessionManager.deleteUserSessions(user.sub);
        await jwtService.revokeUserTokens(user.sub, 'LOGOUT_ALL_DEVICES');
      } else {
        // Remove current session
        if (user.sessionId) {
          await sessionManager.delete(user.sessionId);
        }
      }

      logger.info('User logged out', {
        userId: user.sub,
        sessionId: user.sessionId,
        allDevices,
      });

      return reply.send({
        message: allDevices ? 'Logged out from all devices' : 'Logged out successfully',
      });
    } catch (error) {
      logger.error('Logout error:', error);
      await reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Logout failed',
      });
    }
  });
};

// Helper function to create user session and tokens
async function createUserSession(
  user: any,
  sessionId: string,
  ip: string,
  userAgent: string,
  deviceId?: string,
  rememberMe = false
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  // Create session data
  const sessionData = {
    userId: user.id,
    email: user.email,
    ip,
    userAgent,
    deviceId,
    createdAt: new Date().toISOString(),
    lastActivity: new Date().toISOString(),
  };

  // Store session
  const sessionTTL = rememberMe 
    ? parseTimeToMs('30d') / 1000  // 30 days for remember me
    : parseTimeToMs(config.SESSION_TIMEOUT) / 1000;
    
  await sessionManager.create(sessionId, sessionData, sessionTTL);

  // Generate tokens
  const tokenPayload = {
    sub: user.id,
    email: user.email,
    roles: user.roles || [],
    permissions: user.permissions || [],
    org: user.organization_id,
    sessionId,
  };

  const tokens = await jwtService.generateTokenPair(tokenPayload);

  return tokens;
}

export { authRoutes };