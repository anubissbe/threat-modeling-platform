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

export interface AuthenticatedRequest extends FastifyRequest {
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
      logger.warn('Authorization header missing', {
        path: request.url,
        ip: request.ip,
      });
      
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
      logger.warn('Token missing', {
        path: request.url,
        ip: request.ip,
      });
      
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
      logger.warn('Invalid token type', {
        path: request.url,
        tokenType: decoded.tokenType,
        userId: decoded.userId,
      });
      
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

    logger.debug('User authenticated', {
      userId: decoded.userId,
      email: decoded.email,
      path: request.url,
    });

  } catch (error: any) {
    logger.warn('Authentication failed', {
      path: request.url,
      error: error.message,
      ip: request.ip,
    });

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
 * Role-based authorization middleware
 */
export function requireRole(requiredRole: string) {
  return async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) {
      logger.warn('Authorization failed - no user', {
        path: request.url,
        requiredRole,
      });
      
      return reply.status(401).send({
        success: false,
        error: 'Authentication required',
        message: 'This endpoint requires authentication',
        statusCode: 401,
        timestamp: new Date(),
      });
    }

    if (!request.user.roles.includes(requiredRole)) {
      logger.warn('Authorization failed - insufficient role', {
        userId: request.user.id,
        userRoles: request.user.roles,
        requiredRole,
        path: request.url,
      });

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
      path: request.url,
    });
  };
}

/**
 * Project access middleware
 */
export async function requireProjectAccess(
  request: AuthenticatedRequest & { params: { projectId: string } },
  reply: FastifyReply
): Promise<void> {
  if (!request.user) {
    return reply.status(401).send({
      success: false,
      error: 'Authentication required',
      statusCode: 401,
      timestamp: new Date(),
    });
  }

  const projectId = request.params.projectId || request.body?.projectId;
  
  if (!projectId) {
    return reply.status(400).send({
      success: false,
      error: 'Project ID required',
      statusCode: 400,
      timestamp: new Date(),
    });
  }

  // TODO: Check project access permissions via project service
  // For now, we'll allow access if the user is authenticated
  logger.debug('Project access check', {
    userId: request.user.id,
    projectId,
  });
}