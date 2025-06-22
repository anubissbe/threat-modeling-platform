import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { logger } from '../utils/logger';
import { extractBearerToken } from '../utils/helpers';

// Extend Fastify request interface
declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      sub: string; // user ID
      email: string;
      roles: string[];
      permissions: string[];
      org?: string; // organization ID
      sessionId: string;
    };
  }
}

const authMiddleware: FastifyPluginAsync = async (fastify) => {
  /**
   * Verify JWT token decorator
   */
  fastify.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const token = extractBearerToken(request.headers.authorization);
      
      if (!token) {
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'Access token required',
        });
      }

      // Verify token using the JWT plugin
      const payload = await request.jwtVerify();
      
      // Attach user info to request
      request.user = payload as any;

      logger.debug('User authenticated', { 
        userId: request.user?.sub,
        email: request.user?.email 
      });

    } catch (error) {
      logger.debug('Authentication failed:', error);
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Invalid or expired token',
      });
    }
  });

  /**
   * Verify internal API key for service-to-service communication
   */
  fastify.decorate('authenticateService', async (request: FastifyRequest, reply: FastifyReply) => {
    const apiKey = request.headers['x-api-key'];
    
    if (!apiKey) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'API key required',
      });
    }

    // In production, verify against stored API keys
    if (apiKey !== fastify.config.API_KEY) {
      logger.warn('Invalid API key attempt', {
        ip: request.ip,
        userAgent: request.headers['user-agent'],
      });
      
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Invalid API key',
      });
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
        logger.warn('Insufficient privileges', {
          userId: request.user.sub,
          requiredRoles,
          userRoles,
          endpoint: request.url,
        });

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
        logger.warn('Insufficient permissions', {
          userId: request.user.sub,
          requiredPermissions,
          userPermissions,
          endpoint: request.url,
        });

        return reply.status(403).send({
          error: 'Forbidden',
          message: 'Insufficient permissions',
        });
      }
    };
  });

  /**
   * Organization membership decorator
   */
  fastify.decorate('requireOrganization', (paramName: string = 'organizationId') => {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      if (!request.user) {
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'Authentication required',
        });
      }

      const orgId = request.params?.[paramName] || request.body?.[paramName];
      const userOrg = request.user.org;

      // System admins can access any organization
      if (request.user.roles.includes('system_admin')) {
        return;
      }

      if (!userOrg || userOrg !== orgId) {
        logger.warn('Organization access denied', {
          userId: request.user.sub,
          userOrg,
          requestedOrg: orgId,
        });

        return reply.status(403).send({
          error: 'Forbidden',
          message: 'Organization access required',
        });
      }
    };
  });

  /**
   * Self or admin decorator - user can only access their own resources unless admin
   */
  fastify.decorate('selfOrAdmin', (paramName: string = 'userId') => {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      if (!request.user) {
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'Authentication required',
        });
      }

      const resourceUserId = request.params?.[paramName];
      const isAdmin = request.user.roles.includes('admin') || 
                     request.user.roles.includes('system_admin');
      const isSelf = request.user.sub === resourceUserId;

      if (!isAdmin && !isSelf) {
        logger.warn('Access denied to user resource', {
          userId: request.user.sub,
          resourceUserId,
          endpoint: request.url,
        });

        return reply.status(403).send({
          error: 'Forbidden',
          message: 'Access denied',
        });
      }
    };
  });
};

export default fp(authMiddleware, {
  name: 'auth-middleware',
  dependencies: ['@fastify/jwt'],
});