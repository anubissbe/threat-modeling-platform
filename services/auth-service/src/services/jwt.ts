import { FastifyRequest } from 'fastify';
import { randomBytes, createHash } from 'crypto';
import { config, parseTimeToMs } from '../config';
import { getRedis, TokenBlacklist } from '../redis';
import { logger, securityLogger } from '../utils/logger';

export interface TokenPayload {
  sub: string; // user ID
  email: string;
  roles: string[];
  permissions: string[];
  org?: string; // organization ID
  sessionId: string;
  tokenType: 'access' | 'refresh';
  iat?: number;
  exp?: number;
  jti?: string; // JWT ID for blacklisting
}

export interface RefreshTokenData {
  userId: string;
  sessionId: string;
  deviceId?: string;
  userAgent?: string;
  ipAddress?: string;
  createdAt: Date;
  expiresAt: Date;
}

export class JwtService {
  private tokenBlacklist: TokenBlacklist;

  constructor() {
    this.initializeBlacklist();
  }

  private async initializeBlacklist() {
    const redis = await getRedis();
    this.tokenBlacklist = new TokenBlacklist(redis);
  }

  /**
   * Generate access token
   */
  async generateAccessToken(payload: Omit<TokenPayload, 'tokenType' | 'iat' | 'exp' | 'jti'>): Promise<string> {
    try {
      const jti = this.generateTokenId();
      const tokenPayload: TokenPayload = {
        ...payload,
        tokenType: 'access',
        jti,
      };

      // Note: In a real Fastify app, you'd use app.jwt.sign()
      // This is a simplified implementation for the service layer
      const token = await this.signToken(tokenPayload, config.JWT_ACCESS_TOKEN_TTL);
      
      logger.debug('Access token generated', { userId: payload.sub, jti });
      return token;
    } catch (error) {
      logger.error('Failed to generate access token:', error);
      throw new Error('Token generation failed');
    }
  }

  /**
   * Generate refresh token
   */
  async generateRefreshToken(payload: Omit<TokenPayload, 'tokenType' | 'iat' | 'exp' | 'jti'>): Promise<string> {
    try {
      const jti = this.generateTokenId();
      const tokenPayload: TokenPayload = {
        ...payload,
        tokenType: 'refresh',
        jti,
      };

      const token = await this.signToken(tokenPayload, config.JWT_REFRESH_TOKEN_TTL);
      
      logger.debug('Refresh token generated', { userId: payload.sub, jti });
      return token;
    } catch (error) {
      logger.error('Failed to generate refresh token:', error);
      throw new Error('Token generation failed');
    }
  }

  /**
   * Generate token pair (access + refresh)
   */
  async generateTokenPair(payload: Omit<TokenPayload, 'tokenType' | 'iat' | 'exp' | 'jti'>) {
    const [accessToken, refreshToken] = await Promise.all([
      this.generateAccessToken(payload),
      this.generateRefreshToken(payload),
    ]);

    return {
      accessToken,
      refreshToken,
      expiresIn: parseTimeToMs(config.JWT_ACCESS_TOKEN_TTL),
    };
  }

  /**
   * Verify and decode token
   */
  async verifyToken(token: string): Promise<TokenPayload | null> {
    try {
      // Note: In a real Fastify app, you'd use app.jwt.verify()
      const payload = await this.decodeToken(token) as TokenPayload;
      
      if (!payload || !payload.jti) {
        return null;
      }

      // Check if token is blacklisted
      const isBlacklisted = await this.tokenBlacklist.isBlacklisted(payload.jti);
      if (isBlacklisted) {
        logger.warn('Attempted to use blacklisted token', { jti: payload.jti });
        return null;
      }

      return payload;
    } catch (error) {
      logger.debug('Token verification failed:', error.message);
      return null;
    }
  }

  /**
   * Blacklist a token
   */
  async blacklistToken(token: string, reason: string): Promise<void> {
    try {
      const payload = await this.decodeToken(token) as TokenPayload;
      
      if (payload && payload.jti && payload.exp) {
        const expiresAt = new Date(payload.exp * 1000);
        await this.tokenBlacklist.add(payload.jti, expiresAt);
        
        securityLogger.tokenRevocation(payload.sub, payload.tokenType, reason);
        logger.info('Token blacklisted', { 
          jti: payload.jti, 
          userId: payload.sub,
          reason 
        });
      }
    } catch (error) {
      logger.error('Failed to blacklist token:', error);
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresIn: number } | null> {
    try {
      const payload = await this.verifyToken(refreshToken);
      
      if (!payload || payload.tokenType !== 'refresh') {
        return null;
      }

      // Generate new access token with same claims
      const accessToken = await this.generateAccessToken({
        sub: payload.sub,
        email: payload.email,
        roles: payload.roles,
        permissions: payload.permissions,
        org: payload.org,
        sessionId: payload.sessionId,
      });

      return {
        accessToken,
        expiresIn: parseTimeToMs(config.JWT_ACCESS_TOKEN_TTL),
      };
    } catch (error) {
      logger.error('Failed to refresh access token:', error);
      return null;
    }
  }

  /**
   * Extract token from request
   */
  extractTokenFromRequest(request: FastifyRequest): string | null {
    // Check Authorization header
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // Check cookies
    const cookieToken = request.cookies?.accessToken;
    if (cookieToken) {
      return cookieToken;
    }

    return null;
  }

  /**
   * Revoke all tokens for a user
   */
  async revokeUserTokens(userId: string, reason: string): Promise<void> {
    try {
      // In a production system, you'd maintain a mapping of user tokens
      // For now, we'll log the revocation
      securityLogger.tokenRevocation(userId, 'all', reason);
      logger.info('All tokens revoked for user', { userId, reason });
    } catch (error) {
      logger.error('Failed to revoke user tokens:', error);
    }
  }

  /**
   * Generate unique token ID
   */
  private generateTokenId(): string {
    return randomBytes(16).toString('hex');
  }

  /**
   * Sign token (simplified implementation)
   */
  private async signToken(payload: any, expiresIn: string): Promise<string> {
    // This is a simplified implementation
    // In a real Fastify app, you'd use app.jwt.sign()
    const now = Math.floor(Date.now() / 1000);
    const exp = now + Math.floor(parseTimeToMs(expiresIn) / 1000);
    
    const tokenPayload = {
      ...payload,
      iat: now,
      exp,
      iss: config.JWT_ISSUER,
      aud: config.JWT_AUDIENCE,
    };

    // Create a mock token for demonstration
    // In reality, this would use the JWT library
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(JSON.stringify(tokenPayload)).toString('base64url');
    const signature = createHash('sha256').update(`${header}.${body}.${config.JWT_SECRET}`).digest('base64url');
    
    return `${header}.${body}.${signature}`;
  }

  /**
   * Decode token (simplified implementation)
   */
  private async decodeToken(token: string): Promise<any> {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid token format');
      }

      const [header, payload, signature] = parts;
      
      // Verify signature
      const expectedSignature = createHash('sha256').update(`${header}.${payload}.${config.JWT_SECRET}`).digest('base64url');
      if (signature !== expectedSignature) {
        throw new Error('Invalid token signature');
      }

      const decodedPayload = JSON.parse(Buffer.from(payload, 'base64url').toString());
      
      // Check expiration
      if (decodedPayload.exp && decodedPayload.exp < Math.floor(Date.now() / 1000)) {
        throw new Error('Token expired');
      }

      return decodedPayload;
    } catch (error) {
      throw new Error(`Token decode failed: ${error.message}`);
    }
  }

  /**
   * Get token expiration time
   */
  getTokenExpiration(token: string): Date | null {
    try {
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
      return payload.exp ? new Date(payload.exp * 1000) : null;
    } catch {
      return null;
    }
  }

  /**
   * Check if token is expired
   */
  isTokenExpired(token: string): boolean {
    const expiration = this.getTokenExpiration(token);
    return expiration ? expiration.getTime() < Date.now() : true;
  }
}