import { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { logger } from '../utils/logger';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
  organizationId?: string;
  permissions?: string[];
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthenticatedUser;
  }
}

export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const authorization = request.headers.authorization;
    
    if (!authorization) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Missing authorization header',
      });
    }

    const token = authorization.replace('Bearer ', '');
    
    if (!token) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Missing token',
      });
    }

    try {
      const decoded = jwt.verify(token, config.JWT_SECRET) as any;
      
      request.user = {
        id: decoded.sub || decoded.userId,
        email: decoded.email,
        role: decoded.role,
        organizationId: decoded.organizationId,
        permissions: decoded.permissions || [],
      };

      // Log authenticated request
      logger.debug('Authenticated request', {
        userId: request.user.id,
        email: request.user.email,
        role: request.user.role,
        route: request.routerPath,
        method: request.method,
      });

    } catch (jwtError: any) {
      logger.warn('JWT verification failed:', {
        error: jwtError.message,
        token: token.substring(0, 20) + '...',
      });
      
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Invalid token',
      });
    }

  } catch (error: any) {
    logger.error('Auth middleware error:', error);
    return reply.status(500).send({
      error: 'Internal Server Error',
      message: 'Authentication error',
    });
  }
}

export async function optionalAuthMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const authorization = request.headers.authorization;
    
    if (!authorization) {
      // No auth header, continue without user
      return;
    }

    const token = authorization.replace('Bearer ', '');
    
    if (!token) {
      // No token, continue without user
      return;
    }

    try {
      const decoded = jwt.verify(token, config.JWT_SECRET) as any;
      
      request.user = {
        id: decoded.sub || decoded.userId,
        email: decoded.email,
        role: decoded.role,
        organizationId: decoded.organizationId,
        permissions: decoded.permissions || [],
      };
    } catch (jwtError: any) {
      // Invalid token, but continue without user
      logger.debug('Optional auth failed, continuing without user:', jwtError.message);
    }

  } catch (error: any) {
    logger.error('Optional auth middleware error:', error);
    // Continue without throwing error
  }
}

export function requireRole(roles: string | string[]) {
  const allowedRoles = Array.isArray(roles) ? roles : [roles];
  
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    if (!allowedRoles.includes(request.user.role)) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: `Role '${request.user.role}' is not authorized for this action`,
      });
    }
  };
}

export function requirePermission(permission: string) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    const hasPermission = request.user.permissions?.includes(permission) || 
                         request.user.role === 'admin';

    if (!hasPermission) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: `Permission '${permission}' required`,
      });
    }
  };
}

export function requireOrganization() {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    if (!request.user.organizationId) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'Organization membership required',
      });
    }
  };
}

export async function rateLimitMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  // Rate limiting is typically handled by the server configuration
  // This is a placeholder for additional rate limiting logic if needed
  
  const userAgent = request.headers['user-agent'];
  const ip = request.ip;
  
  // Log request for monitoring
  logger.debug('API request', {
    ip,
    userAgent,
    route: request.routerPath,
    method: request.method,
    userId: request.user?.id,
  });
}

export function validateSearchAccess() {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    // Allow public searches for certain content types
    const allowPublicSearch = ['user', 'project']; // Configurable
    
    // If user is authenticated, allow all searches
    if (request.user) {
      return;
    }

    // For unauthenticated users, check if they're searching public content
    const body = request.body as any;
    const contentTypes = body?.contentTypes || [];
    
    const hasRestrictedContent = contentTypes.some((type: string) => 
      !allowPublicSearch.includes(type)
    );

    if (hasRestrictedContent) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Authentication required for this search',
      });
    }
  };
}