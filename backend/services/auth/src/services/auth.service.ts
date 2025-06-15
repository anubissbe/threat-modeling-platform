import { AuthTokens, LoginRequest, RegisterRequest, RefreshTokenRequest } from '../types/auth';
import { UserService } from './user.service';
import { RefreshTokenService } from './refresh-token.service';
import { comparePassword, validatePasswordStrength } from '../utils/password';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken, getTokenExpirationTime } from '../utils/jwt';
import { logger } from '../utils/logger';

export class AuthService {
  private userService: UserService;
  private refreshTokenService: RefreshTokenService;

  constructor() {
    this.userService = new UserService();
    this.refreshTokenService = new RefreshTokenService();
  }

  async login(loginData: LoginRequest): Promise<AuthTokens> {
    try {
      // Get user by email
      const user = await this.userService.getUserByEmail(loginData.email);
      if (!user) {
        throw new Error('Invalid credentials');
      }

      // Verify password
      const passwordHash = await this.userService.getUserPasswordHash(loginData.email);
      if (!passwordHash) {
        throw new Error('Invalid credentials');
      }

      const isPasswordValid = await comparePassword(loginData.password, passwordHash);
      if (!isPasswordValid) {
        throw new Error('Invalid credentials');
      }

      // Generate tokens
      const accessToken = generateAccessToken(user);
      const refreshToken = generateRefreshToken(user.id);

      // Store refresh token
      await this.refreshTokenService.storeRefreshToken(user.id, refreshToken);

      // Update last login
      await this.userService.updateLastLogin(user.id);

      logger.info(`User logged in successfully: ${user.email}`);

      return {
        accessToken,
        refreshToken,
        expiresIn: getTokenExpirationTime(),
      };
    } catch (error) {
      logger.error('Login error:', error);
      throw error;
    }
  }

  async register(registerData: RegisterRequest): Promise<AuthTokens> {
    try {
      // Validate password strength
      const passwordValidation = validatePasswordStrength(registerData.password);
      if (!passwordValidation.isValid) {
        throw new Error(`Password validation failed: ${passwordValidation.errors.join(', ')}`);
      }

      // Create user
      const user = await this.userService.createUser(registerData);

      // Generate tokens
      const accessToken = generateAccessToken(user);
      const refreshToken = generateRefreshToken(user.id);

      // Store refresh token
      await this.refreshTokenService.storeRefreshToken(user.id, refreshToken);

      logger.info(`User registered successfully: ${user.email}`);

      return {
        accessToken,
        refreshToken,
        expiresIn: getTokenExpirationTime(),
      };
    } catch (error) {
      logger.error('Registration error:', error);
      throw error;
    }
  }

  async refreshToken(refreshData: RefreshTokenRequest): Promise<AuthTokens> {
    try {
      // Verify refresh token
      const payload = verifyRefreshToken(refreshData.refreshToken);
      if (!payload) {
        throw new Error('Invalid refresh token');
      }

      // Check if refresh token exists in database
      const isValid = await this.refreshTokenService.validateRefreshToken(
        payload.userId,
        refreshData.refreshToken
      );
      if (!isValid) {
        throw new Error('Invalid refresh token');
      }

      // Get user
      const user = await this.userService.getUserById(payload.userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Generate new tokens
      const accessToken = generateAccessToken(user);
      const newRefreshToken = generateRefreshToken(user.id);

      // Replace old refresh token with new one
      await this.refreshTokenService.replaceRefreshToken(
        user.id,
        refreshData.refreshToken,
        newRefreshToken
      );

      logger.info(`Tokens refreshed for user: ${user.email}`);

      return {
        accessToken,
        refreshToken: newRefreshToken,
        expiresIn: getTokenExpirationTime(),
      };
    } catch (error) {
      logger.error('Token refresh error:', error);
      throw error;
    }
  }

  async logout(userId: string, refreshToken: string): Promise<void> {
    try {
      await this.refreshTokenService.revokeRefreshToken(userId, refreshToken);
      logger.info(`User logged out: ${userId}`);
    } catch (error) {
      logger.error('Logout error:', error);
      throw error;
    }
  }

  async logoutAll(userId: string): Promise<void> {
    try {
      await this.refreshTokenService.revokeAllRefreshTokens(userId);
      logger.info(`All sessions logged out for user: ${userId}`);
    } catch (error) {
      logger.error('Logout all error:', error);
      throw error;
    }
  }
}