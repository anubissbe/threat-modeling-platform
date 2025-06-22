import { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import { config } from '../config';
import { logger } from '../utils/logger';

interface JWTPayload {
  sub: string;
  email: string;
  roles?: string[];
  iat: number;
  exp: number;
}

export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Skip auth for health check and unsubscribe endpoints
  const publicPaths = ['/health', '/api/v1/health', '/api/v1/unsubscribe'];
  
  if (publicPaths.some(path => request.url.startsWith(path))) {
    return;
  }

  try {
    const authHeader = request.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      reply.status(401).send({
        success: false,
        error: 'Missing or invalid authorization header',
      });
      return;
    }

    const token = authHeader.substring(7);
    
    // Verify JWT token
    const decoded = jwt.verify(token, config.JWT_SECRET) as JWTPayload;
    
    // Validate token with auth service
    const user = await validateUserWithAuthService(decoded.sub, token);
    
    if (!user) {
      reply.status(401).send({
        success: false,
        error: 'Invalid or expired token',
      });
      return;
    }

    // Attach user to request
    request.user = {
      id: decoded.sub,
      email: decoded.email,
      roles: decoded.roles || [],
    };

    logger.debug('User authenticated', {
      userId: request.user.id,
      email: request.user.email,
      requestId: request.id,
    });

  } catch (error: any) {
    logger.error('Authentication error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      reply.status(401).send({
        success: false,
        error: 'Invalid token',
      });
    } else if (error.name === 'TokenExpiredError') {
      reply.status(401).send({
        success: false,
        error: 'Token expired',
      });
    } else {
      reply.status(500).send({
        success: false,
        error: 'Authentication service error',
      });
    }
    return;
  }
}

async function validateUserWithAuthService(
  userId: string,
  token: string
): Promise<any> {
  try {
    const response = await axios.get(
      `${config.AUTH_SERVICE_URL}/api/v1/auth/validate`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        timeout: 5000,
      }
    );

    return response.data.user;
  } catch (error: any) {
    logger.error('Failed to validate user with auth service:', error);
    
    // If auth service is unavailable, allow the request but log the issue
    if (error.code === 'ECONNREFUSED' || error.code === 'TIMEOUT') {
      logger.warn('Auth service unavailable, allowing request');
      return { id: userId };
    }
    
    return null;
  }
}

// Role-based authorization middleware
export function requireRole(requiredRoles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const user = request.user;
    
    if (!user) {
      reply.status(401).send({
        success: false,
        error: 'Authentication required',
      });
      return;
    }

    const userRoles = user.roles || [];
    const hasRequiredRole = requiredRoles.some(role => 
      userRoles.includes(role) || userRoles.includes('admin')
    );

    if (!hasRequiredRole) {
      reply.status(403).send({
        success: false,
        error: 'Insufficient permissions',
        required: requiredRoles,
      });
      return;
    }
  };
}

// Admin-only middleware
export function requireAdmin() {
  return requireRole(['admin']);
}

// User or admin middleware (for accessing own resources)
export function requireUserOrAdmin() {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const user = request.user;
    
    if (!user) {
      reply.status(401).send({
        success: false,
        error: 'Authentication required',
      });
      return;
    }

    // Extract userId from params
    const params = request.params as any;
    const targetUserId = params.userId;

    // Allow if user is admin or accessing their own resources
    const isAdmin = user.roles?.includes('admin');
    const isOwner = user.id === targetUserId;

    if (!isAdmin && !isOwner) {
      reply.status(403).send({
        success: false,
        error: 'Access denied',
      });
      return;
    }
  };
}

// Rate limiting by user
export function rateLimitByUser(maxRequests: number = 100, windowMs: number = 60000) {
  const userRequests = new Map<string, { count: number; resetTime: number }>();

  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const user = request.user;
    
    if (!user) {
      return; // Will be handled by auth middleware
    }

    const now = Date.now();
    const userId = user.id;
    const userLimit = userRequests.get(userId);

    if (!userLimit || now > userLimit.resetTime) {
      // Reset or initialize user limit
      userRequests.set(userId, {
        count: 1,
        resetTime: now + windowMs,
      });
      return;
    }

    if (userLimit.count >= maxRequests) {
      const retryAfter = Math.ceil((userLimit.resetTime - now) / 1000);
      
      reply.status(429).send({
        success: false,
        error: 'Rate limit exceeded for user',
        retryAfter,
      });
      return;
    }

    userLimit.count++;
  };
}