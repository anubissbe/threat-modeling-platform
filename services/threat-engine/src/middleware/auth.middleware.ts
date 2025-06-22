import { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { logger } from '../utils/logger';

interface JwtPayload {
  userId: string;
  email: string;
  roles: string[];
  organizationId?: string;
  sessionId: string;
  tokenType: 'access';
  iat: number;
  exp: number;
  jti: string;
}

interface AuthenticatedRequest extends FastifyRequest {
  user?: {
    id: string;
    email: string;
    roles: string[];
    organizationId?: string;
    sessionId: string;
  };
}

/**
 * JWT Authentication middleware
 */
export async function authMiddleware(
  request: AuthenticatedRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const authHeader = request.headers.authorization;
    
    if (!authHeader) {
      return reply.status(401).send({
        success: false,
        error: 'Authorization header missing',
      });
    }

    const token = authHeader.replace('Bearer ', '');
    
    if (!token) {
      return reply.status(401).send({
        success: false,
        error: 'Token missing',
      });
    }

    // Verify JWT token
    const decoded = jwt.verify(token, config.JWT_SECRET) as JwtPayload;
    
    // Validate token type
    if (decoded.tokenType !== 'access') {
      return reply.status(401).send({
        success: false,
        error: 'Invalid token type',
      });
    }

    // Add user information to request
    request.user = {
      id: decoded.userId,
      email: decoded.email,
      roles: decoded.roles,
      organizationId: decoded.organizationId,
      sessionId: decoded.sessionId,
    };

    logger.debug('User authenticated', {
      userId: decoded.userId,
      email: decoded.email,
      roles: decoded.roles,
    });

  } catch (error: any) {
    logger.warn('Authentication failed', {
      error: error.message,
      token: request.headers.authorization?.substring(0, 20) + '...',
    });

    if (error.name === 'TokenExpiredError') {
      return reply.status(401).send({
        success: false,
        error: 'Token expired',
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return reply.status(401).send({
        success: false,
        error: 'Invalid token',
      });
    }

    return reply.status(401).send({
      success: false,
      error: 'Authentication failed',
    });
  }
}

/**
 * Optional authentication middleware (allows unauthenticated access)
 */
export async function optionalAuthMiddleware(
  request: AuthenticatedRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const authHeader = request.headers.authorization;
    
    if (!authHeader) {
      // No authentication provided, but continue
      return;
    }

    const token = authHeader.replace('Bearer ', '');
    
    if (!token) {
      // No token provided, but continue
      return;
    }

    // Try to verify JWT token
    const decoded = jwt.verify(token, config.JWT_SECRET) as JwtPayload;
    
    // Validate token type
    if (decoded.tokenType === 'access') {
      // Add user information to request
      request.user = {
        id: decoded.userId,
        email: decoded.email,
        roles: decoded.roles,
        organizationId: decoded.organizationId,
        sessionId: decoded.sessionId,
      };

      logger.debug('Optional auth: User authenticated', {
        userId: decoded.userId,
        email: decoded.email,
      });
    }

  } catch (error: any) {
    // Log but don't fail the request
    logger.debug('Optional auth failed (continuing)', {
      error: error.message,
    });
  }
}

/**
 * Role-based authorization middleware
 */
export function requireRole(requiredRole: string) {
  return async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) {
      return reply.status(401).send({
        success: false,
        error: 'Authentication required',
      });
    }

    if (!request.user.roles.includes(requiredRole)) {
      logger.warn('Authorization failed', {
        userId: request.user.id,
        requiredRole,
        userRoles: request.user.roles,
      });

      return reply.status(403).send({
        success: false,
        error: 'Insufficient permissions',
      });
    }

    logger.debug('Role authorization passed', {
      userId: request.user.id,
      requiredRole,
      userRoles: request.user.roles,
    });
  };
}

/**
 * Organization access middleware
 */
export function requireOrganizationAccess(organizationIdParam: string = 'organizationId') {
  return async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) {
      return reply.status(401).send({
        success: false,
        error: 'Authentication required',
      });
    }

    const requestedOrgId = (request.params as any)[organizationIdParam];
    
    // Super admins can access any organization
    if (request.user.roles.includes('super_admin')) {
      return;
    }

    // Users can only access their own organization
    if (request.user.organizationId !== requestedOrgId) {
      logger.warn('Organization access denied', {
        userId: request.user.id,
        userOrgId: request.user.organizationId,
        requestedOrgId,
      });

      return reply.status(403).send({
        success: false,
        error: 'Organization access denied',
      });
    }

    logger.debug('Organization access granted', {
      userId: request.user.id,
      organizationId: requestedOrgId,
    });
  };
}

/**
 * Rate limiting middleware (basic implementation)
 */
interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
}

const requestCounts = new Map<string, { count: number; resetTime: number }>();

export function rateLimit(options: RateLimitOptions) {
  return async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    const key = request.user?.id || request.ip;
    const now = Date.now();
    const windowMs = options.windowMs;
    const maxRequests = options.maxRequests;

    const record = requestCounts.get(key);

    if (!record || now > record.resetTime) {
      // New window or expired window
      requestCounts.set(key, {
        count: 1,
        resetTime: now + windowMs,
      });
      return;
    }

    if (record.count >= maxRequests) {
      logger.warn('Rate limit exceeded', {
        key,
        count: record.count,
        maxRequests,
        windowMs,
      });

      return reply.status(429).send({
        success: false,
        error: 'Rate limit exceeded',
        retryAfter: Math.ceil((record.resetTime - now) / 1000),
      });
    }

    // Increment count
    record.count++;
    requestCounts.set(key, record);
  };
}