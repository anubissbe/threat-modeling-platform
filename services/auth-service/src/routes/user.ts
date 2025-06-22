import { FastifyPluginAsync } from 'fastify';
import { PasswordService } from '../services/password';
import { MFAService } from '../services/mfa';
import { query } from '../database';
import { logger, securityLogger } from '../utils/logger';
import { randomBytes } from 'crypto';

const passwordService = new PasswordService();
const mfaService = new MFAService();

const userRoutes: FastifyPluginAsync = async (fastify) => {
  // Get current user profile
  fastify.get('/me', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['User Management'],
      summary: 'Get current user profile',
      description: 'Get the authenticated user\'s profile information',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            email: { type: 'string' },
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            roles: { type: 'array', items: { type: 'string' } },
            permissions: { type: 'array', items: { type: 'string' } },
            organizationId: { type: 'string' },
            mfaEnabled: { type: 'boolean' },
            emailVerified: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
            lastLoginAt: { type: 'string', format: 'date-time' },
          },
        },
        401: { $ref: '#/components/schemas/ErrorResponse' },
      },
    },
  }, async (request, reply) => {
    const userId = request.user!.sub;

    try {
      const result = await query(
        `SELECT id, email, first_name, last_name, roles, permissions, organization_id,
                mfa_enabled, email_verified, created_at, last_login_at
         FROM auth.users 
         WHERE id = $1 AND deleted_at IS NULL`,
        [userId]
      );

      if (result.rows.length === 0) {
        return reply.status(404).send({
          error: 'User Not Found',
          message: 'User profile not found',
        });
      }

      const user = result.rows[0];

      return reply.send({
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        roles: user.roles || [],
        permissions: user.permissions || [],
        organizationId: user.organization_id,
        mfaEnabled: user.mfa_enabled,
        emailVerified: user.email_verified,
        createdAt: user.created_at,
        lastLoginAt: user.last_login_at,
      });
    } catch (error) {
      logger.error('Get user profile error:', error);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to retrieve user profile',
      });
    }
  });

  // Update user profile
  fastify.put('/me', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['User Management'],
      summary: 'Update user profile',
      description: 'Update the authenticated user\'s profile information',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        properties: {
          firstName: { type: 'string', minLength: 1, maxLength: 100 },
          lastName: { type: 'string', minLength: 1, maxLength: 100 },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            user: { $ref: '#/components/schemas/User' },
          },
        },
        400: { $ref: '#/components/schemas/ErrorResponse' },
        401: { $ref: '#/components/schemas/ErrorResponse' },
      },
    },
  }, async (request, reply) => {
    const userId = request.user!.sub;
    const { firstName, lastName } = request.body as any;

    try {
      // Update user profile
      const result = await query(
        `UPDATE auth.users 
         SET first_name = COALESCE($1, first_name),
             last_name = COALESCE($2, last_name),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3 AND deleted_at IS NULL
         RETURNING id, email, first_name, last_name, roles, permissions, organization_id`,
        [firstName, lastName, userId]
      );

      if (result.rows.length === 0) {
        return reply.status(404).send({
          error: 'User Not Found',
          message: 'User profile not found',
        });
      }

      const user = result.rows[0];

      logger.info('User profile updated', { userId, changes: { firstName, lastName } });

      return reply.send({
        message: 'Profile updated successfully',
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          roles: user.roles || [],
          permissions: user.permissions || [],
          organizationId: user.organization_id,
        },
      });
    } catch (error) {
      logger.error('Update user profile error:', error);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to update user profile',
      });
    }
  });

  // Change password
  fastify.post('/me/password', {
    preHandler: [fastify.authenticate, fastify.authRateLimit(3, 30)],
    schema: {
      tags: ['User Management'],
      summary: 'Change password',
      description: 'Change the authenticated user\'s password',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['currentPassword', 'newPassword'],
        properties: {
          currentPassword: { type: 'string', minLength: 1 },
          newPassword: { type: 'string', minLength: 8, maxLength: 128 },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            message: { type: 'string' },
          },
        },
        400: { $ref: '#/components/schemas/ErrorResponse' },
        401: { $ref: '#/components/schemas/ErrorResponse' },
      },
    },
  }, async (request, reply) => {
    const userId = request.user!.sub;
    const { currentPassword, newPassword } = request.body as any;
    const ip = request.ip;

    try {
      // Validate new password
      const passwordValidation = passwordService.validatePassword(newPassword);
      if (!passwordValidation.valid) {
        return reply.status(400).send({
          error: 'Invalid Password',
          message: 'New password does not meet security requirements',
          details: passwordValidation.errors,
        });
      }

      // Get current password hash
      const userResult = await query(
        'SELECT password_hash FROM auth.users WHERE id = $1 AND deleted_at IS NULL',
        [userId]
      );

      if (userResult.rows.length === 0) {
        return reply.status(404).send({
          error: 'User Not Found',
          message: 'User account not found',
        });
      }

      const user = userResult.rows[0];

      // Verify current password
      const isValidCurrentPassword = await passwordService.verify(
        currentPassword,
        user.password_hash
      );

      if (!isValidCurrentPassword) {
        securityLogger.suspiciousActivity(
          userId,
          ip,
          'INVALID_CURRENT_PASSWORD',
          { action: 'password_change' }
        );

        return reply.status(401).send({
          error: 'Invalid Current Password',
          message: 'The current password is incorrect',
        });
      }

      // Hash new password
      const newPasswordHash = await passwordService.hash(newPassword);

      // Update password
      await query(
        `UPDATE auth.users 
         SET password_hash = $1, 
             password_changed_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [newPasswordHash, userId]
      );

      securityLogger.passwordReset(userId, ip);
      logger.info('Password changed successfully', { userId });

      return reply.send({
        message: 'Password changed successfully',
      });
    } catch (error) {
      logger.error('Change password error:', error);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to change password',
      });
    }
  });

  // Setup MFA
  fastify.post('/me/mfa/setup', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['User Management', 'MFA'],
      summary: 'Setup MFA',
      description: 'Setup multi-factor authentication for the user',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            secret: { type: 'string' },
            qrCodeUrl: { type: 'string' },
            backupCodes: { type: 'array', items: { type: 'string' } },
            manualEntryKey: { type: 'string' },
          },
        },
        409: { $ref: '#/components/schemas/ErrorResponse' },
      },
    },
  }, async (request, reply) => {
    const userId = request.user!.sub;
    const userEmail = request.user!.email;

    try {
      // Check if MFA is already enabled
      const userResult = await query(
        'SELECT mfa_enabled FROM auth.users WHERE id = $1',
        [userId]
      );

      if (userResult.rows[0]?.mfa_enabled) {
        return reply.status(409).send({
          error: 'MFA Already Enabled',
          message: 'Multi-factor authentication is already enabled for this account',
        });
      }

      // Generate MFA setup data
      const setupData = await mfaService.generateTOTPSetup(userEmail);

      // Store temporary MFA setup data (not yet confirmed)
      await query(
        `UPDATE auth.users 
         SET mfa_secret_temp = $1, 
             backup_codes_temp = $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [setupData.secret, JSON.stringify(setupData.backupCodes), userId]
      );

      logger.info('MFA setup initiated', { userId });

      return reply.send({
        secret: setupData.secret,
        qrCodeUrl: setupData.qrCodeUrl,
        backupCodes: setupData.backupCodes,
        manualEntryKey: setupData.manualEntryKey,
      });
    } catch (error) {
      logger.error('MFA setup error:', error);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to setup MFA',
      });
    }
  });

  // Confirm MFA setup
  fastify.post('/me/mfa/confirm', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['User Management', 'MFA'],
      summary: 'Confirm MFA setup',
      description: 'Confirm MFA setup by verifying a TOTP token',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['token'],
        properties: {
          token: { type: 'string', pattern: '^[0-9]{6}$' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            backupCodes: { type: 'array', items: { type: 'string' } },
          },
        },
        400: { $ref: '#/components/schemas/ErrorResponse' },
      },
    },
  }, async (request, reply) => {
    const userId = request.user!.sub;
    const { token } = request.body as any;
    const ip = request.ip;

    try {
      // Get temporary MFA data
      const userResult = await query(
        'SELECT mfa_secret_temp, backup_codes_temp FROM auth.users WHERE id = $1',
        [userId]
      );

      const user = userResult.rows[0];
      if (!user?.mfa_secret_temp) {
        return reply.status(400).send({
          error: 'No MFA Setup',
          message: 'No pending MFA setup found. Please start MFA setup first.',
        });
      }

      // Verify TOTP token
      const isValidToken = mfaService.verifyTOTP(token, user.mfa_secret_temp);
      
      if (!isValidToken) {
        securityLogger.mfaAttempt(userId, 'totp', false);
        return reply.status(400).send({
          error: 'Invalid Token',
          message: 'The provided TOTP token is invalid',
        });
      }

      // Confirm MFA setup
      await query(
        `UPDATE auth.users 
         SET mfa_enabled = true,
             mfa_secret = mfa_secret_temp,
             backup_codes = backup_codes_temp,
             mfa_secret_temp = NULL,
             backup_codes_temp = NULL,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [userId]
      );

      securityLogger.mfaAttempt(userId, 'totp', true);
      logger.info('MFA setup confirmed', { userId });

      return reply.send({
        message: 'MFA setup completed successfully',
        backupCodes: JSON.parse(user.backup_codes_temp),
      });
    } catch (error) {
      logger.error('MFA confirmation error:', error);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to confirm MFA setup',
      });
    }
  });

  // Disable MFA
  fastify.delete('/me/mfa', {
    preHandler: [fastify.authenticate, fastify.requireMFA],
    schema: {
      tags: ['User Management', 'MFA'],
      summary: 'Disable MFA',
      description: 'Disable multi-factor authentication',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['token'],
        properties: {
          token: { type: 'string' },
          method: { type: 'string', enum: ['totp', 'backup'] },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            message: { type: 'string' },
          },
        },
        400: { $ref: '#/components/schemas/ErrorResponse' },
      },
    },
  }, async (request, reply) => {
    const userId = request.user!.sub;
    const { token, method } = request.body as any;
    const ip = request.ip;

    try {
      // Get user MFA data
      const userResult = await query(
        'SELECT mfa_secret, backup_codes FROM auth.users WHERE id = $1 AND mfa_enabled = true',
        [userId]
      );

      if (userResult.rows.length === 0) {
        return reply.status(400).send({
          error: 'MFA Not Enabled',
          message: 'MFA is not enabled for this account',
        });
      }

      const user = userResult.rows[0];

      // Verify MFA token before disabling
      const mfaResult = await mfaService.verifyMFA(
        userId,
        method,
        token,
        user.mfa_secret,
        user.backup_codes
      );

      if (!mfaResult.valid) {
        return reply.status(400).send({
          error: 'Invalid MFA Token',
          message: 'MFA verification failed',
        });
      }

      // Disable MFA
      await query(
        `UPDATE auth.users 
         SET mfa_enabled = false,
             mfa_secret = NULL,
             backup_codes = NULL,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [userId]
      );

      logger.info('MFA disabled', { userId });

      return reply.send({
        message: 'MFA disabled successfully',
      });
    } catch (error) {
      logger.error('MFA disable error:', error);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to disable MFA',
      });
    }
  });

  // Get user sessions
  fastify.get('/me/sessions', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['User Management'],
      summary: 'Get user sessions',
      description: 'Get all active sessions for the authenticated user',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            sessions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  sessionId: { type: 'string' },
                  deviceId: { type: 'string' },
                  userAgent: { type: 'string' },
                  ip: { type: 'string' },
                  createdAt: { type: 'string', format: 'date-time' },
                  lastActivity: { type: 'string', format: 'date-time' },
                  current: { type: 'boolean' },
                },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    // Note: This would require storing session metadata in database
    // For now, return current session only
    const currentSessionId = request.user!.sessionId;

    return reply.send({
      sessions: [{
        sessionId: currentSessionId,
        current: true,
        userAgent: request.headers['user-agent'],
        ip: request.ip,
        createdAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
      }],
    });
  });
};

export { userRoutes };