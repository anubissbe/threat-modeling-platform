import { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { logger, serviceLogger } from '../utils/logger';

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
 * JWT Authentication middleware for integration service
 */
export async function authMiddleware(
  request: AuthenticatedRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const authHeader = request.headers.authorization;
    
    if (!authHeader) {
      serviceLogger.authenticationFailed(
        request.url,
        'Authorization header missing',
        request.ip
      );
      
      return reply.status(401).send({
        success: false,
        error: 'Authorization header missing',
        message: 'Please provide a valid authorization token',
        statusCode: 401,
        timestamp: new Date(),
      });
    }

    const token = authHeader.replace('Bearer ', '');
    
    if (!token) {
      serviceLogger.authenticationFailed(
        request.url,
        'Token missing',
        request.ip
      );
      
      return reply.status(401).send({
        success: false,
        error: 'Token missing',
        message: 'Authorization token is required',
        statusCode: 401,
        timestamp: new Date(),
      });
    }

    // Verify JWT token
    const decoded = jwt.verify(token, config.JWT_SECRET) as JwtPayload;
    
    // Validate token type
    if (decoded.tokenType !== 'access') {
      serviceLogger.authenticationFailed(
        request.url,
        'Invalid token type',
        request.ip
      );
      
      return reply.status(401).send({
        success: false,
        error: 'Invalid token type',
        message: 'Access token required',
        statusCode: 401,
        timestamp: new Date(),
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

    logger.debug('User authenticated successfully', {
      userId: decoded.userId,
      email: decoded.email,
      roles: decoded.roles,
      path: request.url,
    });

  } catch (error: any) {
    serviceLogger.authenticationFailed(
      request.url,
      error.message,
      request.ip
    );

    if (error.name === 'TokenExpiredError') {
      return reply.status(401).send({
        success: false,
        error: 'Token expired',
        message: 'Your session has expired. Please login again.',
        statusCode: 401,
        timestamp: new Date(),
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return reply.status(401).send({
        success: false,
        error: 'Invalid token',
        message: 'The provided token is invalid',
        statusCode: 401,
        timestamp: new Date(),
      });
    }

    return reply.status(401).send({
      success: false,
      error: 'Authentication failed',
      message: 'Unable to authenticate the request',
      statusCode: 401,
      timestamp: new Date(),
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
        path: request.url,
      });
    }

  } catch (error: any) {
    // Log but don't fail the request
    logger.debug('Optional auth failed (continuing)', {
      error: error.message,
      path: request.url,
    });
  }
}

/**
 * Role-based authorization middleware
 */
export function requireRole(requiredRole: string) {
  return async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) {
      serviceLogger.authorizationFailed('unknown', request.url);
      
      return reply.status(401).send({
        success: false,
        error: 'Authentication required',
        message: 'This endpoint requires authentication',
        statusCode: 401,
        timestamp: new Date(),
      });
    }

    if (!request.user.roles.includes(requiredRole)) {
      serviceLogger.authorizationFailed(
        request.user.id,
        request.url,
        requiredRole
      );

      return reply.status(403).send({
        success: false,
        error: 'Insufficient permissions',
        message: `This endpoint requires the '${requiredRole}' role`,
        statusCode: 403,
        timestamp: new Date(),
      });
    }

    logger.debug('Role authorization passed', {
      userId: request.user.id,
      requiredRole,
      userRoles: request.user.roles,
      path: request.url,
    });
  };
}

/**
 * Organization access middleware
 */
export function requireOrganizationAccess(organizationIdParam: string = 'organizationId') {
  return async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) {
      serviceLogger.authorizationFailed('unknown', request.url);
      
      return reply.status(401).send({
        success: false,
        error: 'Authentication required',
        message: 'This endpoint requires authentication',
        statusCode: 401,
        timestamp: new Date(),
      });
    }

    const requestedOrgId = (request.params as any)[organizationIdParam];
    
    // Super admins can access any organization
    if (request.user.roles.includes('super_admin')) {
      return;
    }

    // Users can only access their own organization
    if (request.user.organizationId !== requestedOrgId) {
      serviceLogger.authorizationFailed(
        request.user.id,
        request.url
      );

      return reply.status(403).send({
        success: false,
        error: 'Organization access denied',
        message: 'You can only access resources from your organization',
        statusCode: 403,
        timestamp: new Date(),
      });
    }

    logger.debug('Organization access granted', {
      userId: request.user.id,
      organizationId: requestedOrgId,
      path: request.url,
    });
  };
}

/**
 * Rate limiting based on user
 */
export function userRateLimit(maxRequests: number, windowMs: number) {
  const userRequests = new Map<string, { count: number; resetTime: number }>();

  return async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    const userId = request.user?.id || request.ip;
    const now = Date.now();

    const userRecord = userRequests.get(userId);

    if (!userRecord || now > userRecord.resetTime) {
      // New window or expired window
      userRequests.set(userId, {
        count: 1,
        resetTime: now + windowMs,
      });
      return;
    }

    if (userRecord.count >= maxRequests) {
      serviceLogger.rateLimitExceeded(
        request.user?.id || 'anonymous',
        request.url,
        maxRequests
      );

      return reply.status(429).send({
        success: false,
        error: 'Rate limit exceeded',
        message: `Too many requests. Limit: ${maxRequests} per ${windowMs / 1000} seconds`,
        statusCode: 429,
        retryAfter: Math.ceil((userRecord.resetTime - now) / 1000),
        timestamp: new Date(),
      });
    }

    // Increment count
    userRecord.count++;
    userRequests.set(userId, userRecord);
  };
}