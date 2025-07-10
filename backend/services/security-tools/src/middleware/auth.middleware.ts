import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: string;
    organization: string;
  };
}

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = extractToken(req);

    if (!token) {
      res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
      return;
    }

    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      organization: decoded.organization
    };

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        success: false,
        error: 'Token expired'
      });
      return;
    }

    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        success: false,
        error: 'Invalid token'
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: 'Authentication error'
    });
  }
};

export const authorize = (roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: 'Insufficient permissions'
      });
      return;
    }

    next();
  };
};

function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Check for token in query params (for WebSocket connections)
  if (req.query.token && typeof req.query.token === 'string') {
    return req.query.token;
  }

  return null;
}

// Middleware for security tool access control
export const checkIntegrationAccess = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const integrationId = req.params.integrationId || req.body.integrationId;
    
    if (!integrationId) {
      next();
      return;
    }

    // Check if user has access to this integration
    // In production, this would check against a database
    const hasAccess = await checkUserIntegrationAccess(req.user!.userId, integrationId);
    
    if (!hasAccess) {
      res.status(403).json({
        success: false,
        error: 'Access denied to this integration'
      });
      return;
    }

    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Access control error'
    });
  }
};

async function checkUserIntegrationAccess(userId: string, integrationId: string): Promise<boolean> {
  // Placeholder - in production, query database
  // Check if user's organization owns the integration
  return true;
}

// Rate limiting for security operations
const operationCounts = new Map<string, { count: number; resetTime: number }>();

export const rateLimitSecurityOps = (
  maxRequests: number = 100,
  windowMinutes: number = 15
) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      next();
      return;
    }

    const key = `${req.user.userId}:${req.path}`;
    const now = Date.now();
    const windowMs = windowMinutes * 60 * 1000;

    const userOps = operationCounts.get(key);

    if (!userOps || userOps.resetTime < now) {
      operationCounts.set(key, {
        count: 1,
        resetTime: now + windowMs
      });
      next();
      return;
    }

    if (userOps.count >= maxRequests) {
      const remainingTime = Math.ceil((userOps.resetTime - now) / 1000);
      res.status(429).json({
        success: false,
        error: 'Rate limit exceeded',
        retryAfter: remainingTime
      });
      return;
    }

    userOps.count++;
    next();
  };
};