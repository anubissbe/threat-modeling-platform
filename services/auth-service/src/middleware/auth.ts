import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { JwtService, TokenPayload } from '../services/jwt';
import { getRedis, RateLimiter } from '../redis';
import { config } from '../config';
import { logger, securityLogger } from '../utils/logger';

// Extend Fastify request interface
declare module 'fastify' {
  interface FastifyRequest {
    user?: TokenPayload;
    sessionId?: string;
  }
}

const jwtService = new JwtService();

/**
 * Authentication middleware plugin
 */
const authMiddleware: FastifyPluginAsync = async (fastify) => {
  // Rate limiter for auth endpoints
  const redis = await getRedis();
  const rateLimiter = new RateLimiter(redis, 'auth_rate_limit:');

  /**
   * Verify JWT token decorator
   */
  fastify.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const token = jwtService.extractTokenFromRequest(request);
      
      if (!token) {
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'Access token required',
        });
      }

      const payload = await jwtService.verifyToken(token);
      
      if (!payload) {
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'Invalid or expired token',
        });
      }

      // Attach user info to request
      request.user = payload;
      request.sessionId = payload.sessionId;

      // Log successful authentication
      securityLogger.loginAttempt(
        payload.sub,
        request.ip,
        request.headers['user-agent'] || '',
        true
      );

    } catch (error) {
      logger.error('Authentication error:', error);
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Authentication failed',
      });
    }
  });

  /**
   * Optional authentication decorator (for public endpoints that can benefit from user context)
   */
  fastify.decorate('optionalAuth', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const token = jwtService.extractTokenFromRequest(request);
      
      if (token) {
        const payload = await jwtService.verifyToken(token);
        if (payload) {
          request.user = payload;
          request.sessionId = payload.sessionId;
        }
      }
    } catch (error) {
      // Silent fail for optional auth
      logger.debug('Optional auth failed:', error.message);
    }
  });

  /**
   * Role-based authorization decorator
   */
  fastify.decorate('authorize', (requiredRoles: string[]) => {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      if (!request.user) {
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'Authentication required',
        });
      }

      const userRoles = request.user.roles || [];
      const hasRequiredRole = requiredRoles.some(role => userRoles.includes(role));

      if (!hasRequiredRole) {
        securityLogger.suspiciousActivity(
          request.user.sub,
          request.ip,
          'INSUFFICIENT_PRIVILEGES',
          { requiredRoles, userRoles, endpoint: request.url }
        );

        return reply.status(403).send({
          error: 'Forbidden',
          message: 'Insufficient privileges',
        });
      }
    };
  });

  /**
   * Permission-based authorization decorator
   */
  fastify.decorate('requirePermissions', (requiredPermissions: string[]) => {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      if (!request.user) {
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'Authentication required',
        });
      }

      const userPermissions = request.user.permissions || [];
      const hasAllPermissions = requiredPermissions.every(permission => 
        userPermissions.includes(permission)
      );

      if (!hasAllPermissions) {
        securityLogger.suspiciousActivity(
          request.user.sub,
          request.ip,
          'INSUFFICIENT_PERMISSIONS',
          { requiredPermissions, userPermissions, endpoint: request.url }
        );

        return reply.status(403).send({
          error: 'Forbidden',
          message: 'Insufficient permissions',
        });
      }
    };
  });

  /**
   * Rate limiting decorator for authentication endpoints
   */
  fastify.decorate('authRateLimit', (maxAttempts: number = 5, windowMinutes: number = 15) => {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      const identifier = `${request.ip}:auth`;
      const windowSeconds = windowMinutes * 60;

      const result = await rateLimiter.isAllowed(identifier, maxAttempts, windowSeconds);

      if (!result.allowed) {
        securityLogger.suspiciousActivity(
          request.user?.sub || 'anonymous',
          request.ip,
          'RATE_LIMIT_EXCEEDED',
          { endpoint: request.url, remaining: result.remaining }
        );

        return reply.status(429).send({
          error: 'Too Many Requests',
          message: 'Too many authentication attempts. Please try again later.',
          retryAfter: result.resetTime,
        });
      }

      // Add rate limit headers
      reply.headers({
        'X-RateLimit-Limit': maxAttempts.toString(),
        'X-RateLimit-Remaining': result.remaining.toString(),
        'X-RateLimit-Reset': result.resetTime.toString(),
      });
    };
  });

  /**
   * MFA verification decorator
   */
  fastify.decorate('requireMFA', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    // Check if user has completed MFA for this session
    // This would typically check session data or token claims
    const mfaCompleted = request.user.sessionId && await checkMFAStatus(request.user.sessionId);

    if (!mfaCompleted) {
      return reply.status(403).send({
        error: 'MFA Required',
        message: 'Multi-factor authentication required',
        code: 'MFA_REQUIRED',
      });
    }
  });

  /**
   * Organization membership decorator
   */
  fastify.decorate('requireOrganization', (organizationId?: string) => {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      if (!request.user) {
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'Authentication required',
        });
      }

      const userOrg = request.user.org;
      const requiredOrg = organizationId || request.params?.organizationId;

      if (!userOrg || (requiredOrg && userOrg !== requiredOrg)) {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'Organization access required',
        });
      }
    };
  });

  /**
   * Session validation decorator
   */
  fastify.decorate('validateSession', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user || !request.sessionId) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Valid session required',
      });
    }

    // Check if session exists and is valid
    const sessionValid = await validateSession(request.sessionId);

    if (!sessionValid) {
      return reply.status(401).send({
        error: 'Session Invalid',
        message: 'Session has expired or is invalid',
        code: 'SESSION_INVALID',
      });
    }
  });
};

/**
 * Helper function to check MFA status
 */
async function checkMFAStatus(sessionId: string): Promise<boolean> {
  try {
    const redis = await getRedis();
    const mfaStatus = await redis.get(`mfa:${sessionId}`);
    return mfaStatus === 'completed';
  } catch (error) {
    logger.error('Failed to check MFA status:', error);
    return false;
  }
}

/**
 * Helper function to validate session
 */
async function validateSession(sessionId: string): Promise<boolean> {
  try {
    const redis = await getRedis();
    const sessionData = await redis.get(`session:${sessionId}`);
    return !!sessionData;
  } catch (error) {
    logger.error('Failed to validate session:', error);
    return false;
  }
}

/**
 * Utility function to extract user ID from request
 */
export function getUserId(request: FastifyRequest): string | null {
  return request.user?.sub || null;
}

/**
 * Utility function to extract user roles from request
 */
export function getUserRoles(request: FastifyRequest): string[] {
  return request.user?.roles || [];
}

/**
 * Utility function to extract user permissions from request
 */
export function getUserPermissions(request: FastifyRequest): string[] {
  return request.user?.permissions || [];
}

/**
 * Utility function to check if user has specific role
 */
export function hasRole(request: FastifyRequest, role: string): boolean {
  const userRoles = getUserRoles(request);
  return userRoles.includes(role);
}

/**
 * Utility function to check if user has specific permission
 */
export function hasPermission(request: FastifyRequest, permission: string): boolean {
  const userPermissions = getUserPermissions(request);
  return userPermissions.includes(permission);
}

/**
 * Utility function to check if user belongs to organization
 */
export function belongsToOrganization(request: FastifyRequest, organizationId: string): boolean {
  return request.user?.org === organizationId;
}

export default fp(authMiddleware, {
  name: 'auth-middleware',
});