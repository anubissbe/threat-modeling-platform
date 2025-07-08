import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthenticationError, AuthorizationError } from './error-handler';
import { logger } from '../utils/logger';

export interface JwtPayload {
  id: string;
  email: string;
  roles: string[];
  iat?: number;
  exp?: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

const JWT_SECRET = process.env['JWT_SECRET'];
if (!JWT_SECRET) {
  logger.error('JWT_SECRET not configured');
  process.exit(1);
}

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      throw new AuthenticationError('No authorization header provided');
    }

    const [bearer, token] = authHeader.split(' ');
    if (bearer !== 'Bearer' || !token) {
      throw new AuthenticationError('Invalid authorization header format');
    }

    const decoded = jwt.verify(token, JWT_SECRET!);
    req.user = decoded as unknown as JwtPayload;

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      next(new AuthenticationError('Token has expired'));
    } else if (error instanceof jwt.JsonWebTokenError) {
      next(new AuthenticationError('Invalid token'));
    } else {
      next(error);
    }
  }
}

export function authorize(...allowedRoles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AuthenticationError('User not authenticated'));
    }

    const hasRole = req.user.roles.some(role => allowedRoles.includes(role));
    if (!hasRole) {
      return next(new AuthorizationError(`Requires one of these roles: ${allowedRoles.join(', ')}`));
    }

    next();
  };
}

// Optional authentication - doesn't fail if no token provided
export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return next();
  }

  const [bearer, token] = authHeader.split(' ');
  if (bearer !== 'Bearer' || !token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET!);
    req.user = decoded as unknown as JwtPayload;
  } catch (error) {
    // Log but don't fail
    logger.debug('Optional auth token invalid:', error);
  }

  next();
}

// Verify webhook signatures
export function verifyWebhookSignature(
  getSecret: (req: Request) => Promise<string | null>
) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const signature = req.headers['x-webhook-signature'] as string;
      if (!signature) {
        throw new AuthenticationError('No webhook signature provided');
      }

      const secret = await getSecret(req);
      if (!secret) {
        throw new AuthenticationError('Webhook not configured');
      }

      // Different providers use different signature methods
      const provider = req.params['provider'];
      let isValid = false;

      switch (provider) {
        case 'github':
          isValid = verifyGitHubSignature(req, secret, signature);
          break;
        case 'gitlab':
          isValid = verifyGitLabToken(req, secret);
          break;
        case 'jira':
          isValid = await verifyJiraSignature(req, secret, signature);
          break;
        case 'azure_devops':
          isValid = verifyAzureDevOpsSignature(req, secret, signature);
          break;
        default:
          throw new AuthenticationError(`Unknown provider: ${provider}`);
      }

      if (!isValid) {
        throw new AuthenticationError('Invalid webhook signature');
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

function verifyGitHubSignature(req: Request, secret: string, signature: string): boolean {
  const crypto = require('crypto');
  const body = JSON.stringify(req.body);
  const expectedSignature = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(body, 'utf8')
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

function verifyGitLabToken(req: Request, secret: string): boolean {
  const token = req.headers['x-gitlab-token'] as string;
  return token === secret;
}

async function verifyJiraSignature(_req: Request, secret: string, signature: string): Promise<boolean> {
  // Jira uses JWT for webhook authentication
  try {
    jwt.verify(signature, secret);
    return true;
  } catch {
    return false;
  }
}

function verifyAzureDevOpsSignature(req: Request, secret: string, signature: string): boolean {
  const crypto = require('crypto');
  const body = JSON.stringify(req.body);
  const expectedSignature = crypto
    .createHmac('sha1', secret)
    .update(body, 'utf8')
    .digest('base64');
  
  return signature === expectedSignature;
}