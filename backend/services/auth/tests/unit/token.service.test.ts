import { TokenService } from '../../src/services/token.service';
import jwt from 'jsonwebtoken';
import { createClient } from 'redis';
import { AuthenticationError } from '../../src/utils/errors';

// Mock dependencies
jest.mock('jsonwebtoken');
jest.mock('redis');

const mockJwt = jwt as jest.Mocked<typeof jwt>;
const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;

describe('TokenService', () => {
  let tokenService: TokenService;
  let mockRedisClient: any;

  beforeEach(() => {
    mockRedisClient = {
      connect: jest.fn(),
      disconnect: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      exists: jest.fn(),
      expire: jest.fn(),
      on: jest.fn(),
      isReady: true,
      isOpen: true
    };

    mockCreateClient.mockReturnValue(mockRedisClient);
    tokenService = new TokenService();
  });

  describe('generateTokens', () => {
    const mockUser = {
      id: 'user-1',
      email: 'test@example.com',
      role: 'user'
    };

    it('should generate access and refresh tokens', async () => {
      const mockAccessToken = 'mock-access-token';
      const mockRefreshToken = 'mock-refresh-token';

      mockJwt.sign
        .mockReturnValueOnce(mockAccessToken)
        .mockReturnValueOnce(mockRefreshToken);

      mockRedisClient.set.mockResolvedValue('OK');
      mockRedisClient.expire.mockResolvedValue(1);

      const result = await tokenService.generateTokens(mockUser as any);

      expect(result).toEqual({
        accessToken: mockAccessToken,
        refreshToken: mockRefreshToken
      });

      // Verify JWT generation
      expect(mockJwt.sign).toHaveBeenCalledTimes(2);
      
      // Access token call
      expect(mockJwt.sign).toHaveBeenNthCalledWith(
        1,
        { userId: mockUser.id, email: mockUser.email, role: mockUser.role },
        process.env.JWT_SECRET,
        { expiresIn: '15m' }
      );
      
      // Refresh token call
      expect(mockJwt.sign).toHaveBeenNthCalledWith(
        2,
        { userId: mockUser.id },
        process.env.REFRESH_TOKEN_SECRET,
        { expiresIn: '7d' }
      );

      // Verify Redis storage
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        `refresh_token:${mockUser.id}`,
        mockRefreshToken
      );
      expect(mockRedisClient.expire).toHaveBeenCalledWith(
        `refresh_token:${mockUser.id}`,
        7 * 24 * 60 * 60 // 7 days in seconds
      );
    });

    it('should handle Redis errors gracefully', async () => {
      const mockAccessToken = 'mock-access-token';
      const mockRefreshToken = 'mock-refresh-token';

      mockJwt.sign
        .mockReturnValueOnce(mockAccessToken)
        .mockReturnValueOnce(mockRefreshToken);

      mockRedisClient.set.mockRejectedValue(new Error('Redis connection failed'));

      await expect(tokenService.generateTokens(mockUser as any))
        .rejects.toThrow('Redis connection failed');
    });
  });

  describe('validateAccessToken', () => {
    const mockToken = 'valid-access-token';

    it('should validate access token successfully', async () => {
      const mockPayload = {
        userId: 'user-1',
        email: 'test@example.com',
        role: 'user',
        iat: Date.now(),
        exp: Date.now() + 15 * 60 * 1000
      };

      mockJwt.verify.mockReturnValue(mockPayload);

      const result = await tokenService.validateAccessToken(mockToken);

      expect(mockJwt.verify).toHaveBeenCalledWith(
        mockToken,
        process.env.JWT_SECRET
      );
      expect(result).toEqual(mockPayload);
    });

    it('should throw AuthenticationError for invalid token', async () => {
      mockJwt.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(tokenService.validateAccessToken(mockToken))
        .rejects.toThrow(AuthenticationError);
    });

    it('should throw AuthenticationError for expired token', async () => {
      mockJwt.verify.mockImplementation(() => {
        const error = new Error('Token expired');
        (error as any).name = 'TokenExpiredError';
        throw error;
      });

      await expect(tokenService.validateAccessToken(mockToken))
        .rejects.toThrow(AuthenticationError);
    });
  });

  describe('validateRefreshToken', () => {
    const mockToken = 'valid-refresh-token';
    const userId = 'user-1';

    it('should validate refresh token successfully', async () => {
      const mockPayload = {
        userId,
        iat: Date.now(),
        exp: Date.now() + 7 * 24 * 60 * 60 * 1000
      };

      mockJwt.verify.mockReturnValue(mockPayload);
      mockRedisClient.get.mockResolvedValue(mockToken);

      const mockUser = {
        id: userId,
        email: 'test@example.com',
        role: 'user'
      };

      // Mock user repository (should be injected in real implementation)
      const mockUserRepository = {
        findById: jest.fn().mockResolvedValue(mockUser)
      };
      (tokenService as any).userRepository = mockUserRepository;

      const result = await tokenService.validateRefreshToken(mockToken);

      expect(mockJwt.verify).toHaveBeenCalledWith(
        mockToken,
        process.env.REFRESH_TOKEN_SECRET
      );
      expect(mockRedisClient.get).toHaveBeenCalledWith(`refresh_token:${userId}`);
      expect(result).toEqual(mockUser);
    });

    it('should throw AuthenticationError for token not in Redis', async () => {
      const mockPayload = {
        userId,
        iat: Date.now(),
        exp: Date.now() + 7 * 24 * 60 * 60 * 1000
      };

      mockJwt.verify.mockReturnValue(mockPayload);
      mockRedisClient.get.mockResolvedValue(null);

      await expect(tokenService.validateRefreshToken(mockToken))
        .rejects.toThrow(AuthenticationError);
    });

    it('should throw AuthenticationError for mismatched token', async () => {
      const mockPayload = {
        userId,
        iat: Date.now(),
        exp: Date.now() + 7 * 24 * 60 * 60 * 1000
      };

      mockJwt.verify.mockReturnValue(mockPayload);
      mockRedisClient.get.mockResolvedValue('different-token');

      await expect(tokenService.validateRefreshToken(mockToken))
        .rejects.toThrow(AuthenticationError);
    });

    it('should throw AuthenticationError for invalid JWT', async () => {
      mockJwt.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(tokenService.validateRefreshToken(mockToken))
        .rejects.toThrow(AuthenticationError);
    });

    it('should handle user not found', async () => {
      const mockPayload = {
        userId,
        iat: Date.now(),
        exp: Date.now() + 7 * 24 * 60 * 60 * 1000
      };

      mockJwt.verify.mockReturnValue(mockPayload);
      mockRedisClient.get.mockResolvedValue(mockToken);

      const mockUserRepository = {
        findById: jest.fn().mockResolvedValue(null)
      };
      (tokenService as any).userRepository = mockUserRepository;

      await expect(tokenService.validateRefreshToken(mockToken))
        .rejects.toThrow(AuthenticationError);
    });
  });

  describe('revokeRefreshToken', () => {
    const mockToken = 'refresh-token';
    const userId = 'user-1';

    it('should revoke refresh token successfully', async () => {
      const mockPayload = {
        userId,
        iat: Date.now(),
        exp: Date.now() + 7 * 24 * 60 * 60 * 1000
      };

      mockJwt.verify.mockReturnValue(mockPayload);
      mockRedisClient.del.mockResolvedValue(1);

      await tokenService.revokeRefreshToken(mockToken);

      expect(mockJwt.verify).toHaveBeenCalledWith(
        mockToken,
        process.env.REFRESH_TOKEN_SECRET
      );
      expect(mockRedisClient.del).toHaveBeenCalledWith(`refresh_token:${userId}`);
    });

    it('should handle token deletion failure', async () => {
      const mockPayload = {
        userId,
        iat: Date.now(),
        exp: Date.now() + 7 * 24 * 60 * 60 * 1000
      };

      mockJwt.verify.mockReturnValue(mockPayload);
      mockRedisClient.del.mockResolvedValue(0);

      // Should not throw error, just log warning
      await expect(tokenService.revokeRefreshToken(mockToken))
        .resolves.not.toThrow();
    });

    it('should handle invalid JWT during revocation', async () => {
      mockJwt.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(tokenService.revokeRefreshToken(mockToken))
        .rejects.toThrow(AuthenticationError);
    });

    it('should handle Redis errors during revocation', async () => {
      const mockPayload = {
        userId,
        iat: Date.now(),
        exp: Date.now() + 7 * 24 * 60 * 60 * 1000
      };

      mockJwt.verify.mockReturnValue(mockPayload);
      mockRedisClient.del.mockRejectedValue(new Error('Redis error'));

      await expect(tokenService.revokeRefreshToken(mockToken))
        .rejects.toThrow('Redis error');
    });
  });

  describe('revokeAllUserTokens', () => {
    const userId = 'user-1';

    it('should revoke all user tokens successfully', async () => {
      mockRedisClient.del.mockResolvedValue(1);

      await tokenService.revokeAllUserTokens(userId);

      expect(mockRedisClient.del).toHaveBeenCalledWith(`refresh_token:${userId}`);
    });

    it('should handle Redis errors', async () => {
      mockRedisClient.del.mockRejectedValue(new Error('Redis error'));

      await expect(tokenService.revokeAllUserTokens(userId))
        .rejects.toThrow('Redis error');
    });
  });
});