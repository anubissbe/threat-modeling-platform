import { FastifyPluginAsync } from 'fastify';
import { MFAService } from '../services/mfa';
import { query } from '../database';
import { logger, securityLogger } from '../utils/logger';

const mfaService = new MFAService();

const mfaRoutes: FastifyPluginAsync = async (fastify) => {
  // Generate new backup codes
  fastify.post('/backup-codes/regenerate', {
    preHandler: [fastify.authenticate, fastify.requireMFA],
    schema: {
      tags: ['MFA'],
      summary: 'Regenerate backup codes',
      description: 'Generate new MFA backup codes',
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
            backupCodes: { type: 'array', items: { type: 'string' } },
            message: { type: 'string' },
          },
        },
        400: { $ref: '#/components/schemas/ErrorResponse' },
        403: { $ref: '#/components/schemas/ErrorResponse' },
      },
    },
  }, async (request, reply) => {
    const userId = request.user!.sub;
    const { token, method } = request.body as any;
    const ip = request.ip;

    try {
      // Verify user has MFA enabled
      const userResult = await query(
        'SELECT mfa_enabled, mfa_secret, backup_codes FROM auth.users WHERE id = $1',
        [userId]
      );

      const user = userResult.rows[0];
      if (!user?.mfa_enabled) {
        return reply.status(403).send({
          error: 'MFA Not Enabled',
          message: 'MFA must be enabled to regenerate backup codes',
        });
      }

      // Verify MFA token
      const mfaResult = await mfaService.verifyMFA(
        userId,
        method,
        token,
        user.mfa_secret,
        user.backup_codes
      );

      if (!mfaResult.valid) {
        securityLogger.mfaAttempt(userId, method, false);
        return reply.status(400).send({
          error: 'Invalid MFA Token',
          message: 'MFA verification failed',
        });
      }

      // Generate new backup codes
      const newBackupCodes = mfaService.regenerateBackupCodes();

      // Update user with new backup codes
      await query(
        `UPDATE auth.users 
         SET backup_codes = $1, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $2`,
        [JSON.stringify(newBackupCodes), userId]
      );

      securityLogger.mfaAttempt(userId, method, true);
      logger.info('Backup codes regenerated', { userId });

      return reply.send({
        backupCodes: newBackupCodes,
        message: 'New backup codes generated successfully',
      });
    } catch (error) {
      logger.error('Backup codes regeneration error:', error);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to regenerate backup codes',
      });
    }
  });

  // Verify TOTP token (for testing/validation)
  fastify.post('/verify-token', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['MFA'],
      summary: 'Verify TOTP token',
      description: 'Verify a TOTP token for testing purposes',
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
            valid: { type: 'boolean' },
            message: { type: 'string' },
          },
        },
        400: { $ref: '#/components/schemas/ErrorResponse' },
        403: { $ref: '#/components/schemas/ErrorResponse' },
      },
    },
  }, async (request, reply) => {
    const userId = request.user!.sub;
    const { token } = request.body as any;

    try {
      // Get user MFA secret
      const userResult = await query(
        'SELECT mfa_enabled, mfa_secret FROM auth.users WHERE id = $1',
        [userId]
      );

      const user = userResult.rows[0];
      if (!user?.mfa_enabled || !user.mfa_secret) {
        return reply.status(403).send({
          error: 'MFA Not Setup',
          message: 'MFA is not enabled for this account',
        });
      }

      // Verify token
      const isValid = mfaService.verifyTOTP(token, user.mfa_secret);

      securityLogger.mfaAttempt(userId, 'totp', isValid);

      return reply.send({
        valid: isValid,
        message: isValid ? 'Token is valid' : 'Token is invalid',
      });
    } catch (error) {
      logger.error('TOTP verification error:', error);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to verify TOTP token',
      });
    }
  });

  // Get MFA status
  fastify.get('/status', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['MFA'],
      summary: 'Get MFA status',
      description: 'Get the current MFA status for the authenticated user',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            mfaEnabled: { type: 'boolean' },
            backupCodesCount: { type: 'number' },
            setupComplete: { type: 'boolean' },
          },
        },
      },
    },
  }, async (request, reply) => {
    const userId = request.user!.sub;

    try {
      const userResult = await query(
        'SELECT mfa_enabled, backup_codes FROM auth.users WHERE id = $1',
        [userId]
      );

      const user = userResult.rows[0];
      const backupCodes = user?.backup_codes ? JSON.parse(user.backup_codes) : [];

      return reply.send({
        mfaEnabled: user?.mfa_enabled || false,
        backupCodesCount: backupCodes.length || 0,
        setupComplete: !!(user?.mfa_enabled && backupCodes.length > 0),
      });
    } catch (error) {
      logger.error('Get MFA status error:', error);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to get MFA status',
      });
    }
  });

  // Cancel MFA setup
  fastify.delete('/setup', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['MFA'],
      summary: 'Cancel MFA setup',
      description: 'Cancel pending MFA setup',
      security: [{ bearerAuth: [] }],
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
    const userId = request.user!.sub;

    try {
      // Clear temporary MFA setup data
      await query(
        `UPDATE auth.users 
         SET mfa_secret_temp = NULL, 
             backup_codes_temp = NULL,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [userId]
      );

      logger.info('MFA setup cancelled', { userId });

      return reply.send({
        message: 'MFA setup cancelled successfully',
      });
    } catch (error) {
      logger.error('Cancel MFA setup error:', error);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to cancel MFA setup',
      });
    }
  });

  // Generate QR code for existing MFA secret (for re-setup)
  fastify.get('/qr-code', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['MFA'],
      summary: 'Get MFA QR code',
      description: 'Generate QR code for existing MFA setup',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            qrCodeUrl: { type: 'string' },
            manualEntryKey: { type: 'string' },
          },
        },
        403: { $ref: '#/components/schemas/ErrorResponse' },
      },
    },
  }, async (request, reply) => {
    const userId = request.user!.sub;
    const userEmail = request.user!.email;

    try {
      // Get user MFA secret
      const userResult = await query(
        'SELECT mfa_enabled, mfa_secret FROM auth.users WHERE id = $1',
        [userId]
      );

      const user = userResult.rows[0];
      if (!user?.mfa_enabled || !user.mfa_secret) {
        return reply.status(403).send({
          error: 'MFA Not Setup',
          message: 'MFA is not enabled for this account',
        });
      }

      // Generate QR code for existing secret
      const qrCodeUrl = await mfaService.generateQRCode(userEmail, user.mfa_secret);
      const manualEntryKey = user.mfa_secret.replace(/(.{4})/g, '$1 ').trim();

      return reply.send({
        qrCodeUrl,
        manualEntryKey,
      });
    } catch (error) {
      logger.error('Generate QR code error:', error);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to generate QR code',
      });
    }
  });

  // Validate backup code format
  fastify.post('/backup-codes/validate', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['MFA'],
      summary: 'Validate backup code',
      description: 'Validate a backup code without consuming it',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['code'],
        properties: {
          code: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            valid: { type: 'boolean' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    const userId = request.user!.sub;
    const { code } = request.body as any;

    try {
      // Get user backup codes
      const userResult = await query(
        'SELECT backup_codes FROM auth.users WHERE id = $1 AND mfa_enabled = true',
        [userId]
      );

      const user = userResult.rows[0];
      if (!user?.backup_codes) {
        return reply.send({
          valid: false,
          message: 'No backup codes available',
        });
      }

      const backupCodes = JSON.parse(user.backup_codes);
      const result = mfaService.verifyBackupCode(code, backupCodes);

      return reply.send({
        valid: result.valid,
        message: result.valid ? 'Backup code is valid' : 'Backup code is invalid',
      });
    } catch (error) {
      logger.error('Backup code validation error:', error);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to validate backup code',
      });
    }
  });
};

export { mfaRoutes };