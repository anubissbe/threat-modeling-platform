import { AuthService } from '../../src/services/auth.service';
import { UserRepository } from '../../src/repositories/user.repository';
import { TokenService } from '../../src/services/token.service';
import { PasswordService } from '../../src/utils/password';
import { ValidationError, AuthenticationError } from '../../src/utils/errors';

// Mock all dependencies
jest.mock('../../src/repositories/user.repository');
jest.mock('../../src/services/token.service');
jest.mock('../../src/utils/password');

const MockedUserRepository = UserRepository as jest.MockedClass<typeof UserRepository>;
const MockedTokenService = TokenService as jest.MockedClass<typeof TokenService>;
const MockedPasswordService = PasswordService as jest.Mocked<typeof PasswordService>;

describe('AuthService', () => {
  let authService: AuthService;
  let mockUserRepository: jest.Mocked<UserRepository>;
  let mockTokenService: jest.Mocked<TokenService>;

  beforeEach(() => {
    mockUserRepository = new MockedUserRepository() as jest.Mocked<UserRepository>;
    mockTokenService = new MockedTokenService() as jest.Mocked<TokenService>;
    
    authService = new AuthService();
    (authService as any).userRepository = mockUserRepository;
    (authService as any).tokenService = mockTokenService;
  });

  describe('register', () => {
    const validEmail = 'test@example.com';
    const validPassword = 'Password123!';
    const userRole = 'user';

    it('should register a new user successfully', async () => {
      // Setup mocks
      mockUserRepository.findByEmail.mockResolvedValue(null);
      (MockedPasswordService.hashPassword as jest.Mock).mockResolvedValue('hashed-password');
      
      const mockUser = {
        id: '1',
        email: validEmail,
        password_hash: 'hashed-password',
        role: userRole,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      };
      
      mockUserRepository.create.mockResolvedValue(mockUser);
      
      const mockTokens = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token'
      };
      
      mockTokenService.generateTokens.mockResolvedValue(mockTokens);

      // Execute
      const result = await authService.register(validEmail, validPassword, userRole);

      // Verify
      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith(validEmail);
      expect(MockedPasswordService.hashPassword).toHaveBeenCalledWith(validPassword);
      expect(mockUserRepository.create).toHaveBeenCalledWith({
        email: validEmail,
        password_hash: 'hashed-password',
        role: userRole
      });
      expect(mockTokenService.generateTokens).toHaveBeenCalledWith(mockUser);
      
      expect(result.user).toEqual(mockUser);
      expect(result.tokens).toEqual(mockTokens);
    });

    it('should throw ValidationError if email already exists', async () => {
      const existingUser = { id: '1', email: validEmail };
      mockUserRepository.findByEmail.mockResolvedValue(existingUser as any);

      await expect(
        authService.register(validEmail, validPassword, userRole)
      ).rejects.toThrow(ValidationError);
      
      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith(validEmail);
      expect(MockedPasswordService.hashPassword).not.toHaveBeenCalled();
      expect(mockUserRepository.create).not.toHaveBeenCalled();
    });

    it('should handle password hashing errors', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null);
      (MockedPasswordService.hashPassword as jest.Mock).mockRejectedValue(
        new Error('Hashing failed')
      );

      await expect(
        authService.register(validEmail, validPassword, userRole)
      ).rejects.toThrow('Hashing failed');
    });

    it('should handle user creation errors', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null);
      (MockedPasswordService.hashPassword as jest.Mock).mockResolvedValue('hashed-password');
      mockUserRepository.create.mockRejectedValue(new Error('Database error'));

      await expect(
        authService.register(validEmail, validPassword, userRole)
      ).rejects.toThrow('Database error');
    });
  });

  describe('login', () => {
    const validEmail = 'test@example.com';
    const validPassword = 'Password123!';

    it('should login user successfully', async () => {
      const mockUser = {
        id: '1',
        email: validEmail,
        password_hash: 'hashed-password',
        role: 'user',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      };

      mockUserRepository.findByEmail.mockResolvedValue(mockUser);
      (MockedPasswordService.comparePassword as jest.Mock).mockResolvedValue(true);
      
      const mockTokens = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token'
      };
      
      mockTokenService.generateTokens.mockResolvedValue(mockTokens);

      const result = await authService.login(validEmail, validPassword);

      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith(validEmail);
      expect(MockedPasswordService.comparePassword).toHaveBeenCalledWith(
        validPassword,
        'hashed-password'
      );
      expect(mockTokenService.generateTokens).toHaveBeenCalledWith(mockUser);
      
      expect(result.user).toEqual(mockUser);
      expect(result.tokens).toEqual(mockTokens);
    });

    it('should throw AuthenticationError for non-existent user', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null);

      await expect(
        authService.login(validEmail, validPassword)
      ).rejects.toThrow(AuthenticationError);
      
      expect(MockedPasswordService.comparePassword).not.toHaveBeenCalled();
    });

    it('should throw AuthenticationError for invalid password', async () => {
      const mockUser = {
        id: '1',
        email: validEmail,
        password_hash: 'hashed-password',
        role: 'user',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      };

      mockUserRepository.findByEmail.mockResolvedValue(mockUser);
      (MockedPasswordService.comparePassword as jest.Mock).mockResolvedValue(false);

      await expect(
        authService.login(validEmail, validPassword)
      ).rejects.toThrow(AuthenticationError);
      
      expect(MockedPasswordService.comparePassword).toHaveBeenCalledWith(
        validPassword,
        'hashed-password'
      );
      expect(mockTokenService.generateTokens).not.toHaveBeenCalled();
    });

    it('should throw AuthenticationError for inactive user', async () => {
      const mockUser = {
        id: '1',
        email: validEmail,
        password_hash: 'hashed-password',
        role: 'user',
        is_active: false,
        created_at: new Date(),
        updated_at: new Date()
      };

      mockUserRepository.findByEmail.mockResolvedValue(mockUser);

      await expect(
        authService.login(validEmail, validPassword)
      ).rejects.toThrow(AuthenticationError);
      
      expect(MockedPasswordService.comparePassword).not.toHaveBeenCalled();
    });
  });

  describe('refreshToken', () => {
    const validRefreshToken = 'valid-refresh-token';

    it('should refresh tokens successfully', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        role: 'user'
      };

      mockTokenService.validateRefreshToken.mockResolvedValue(mockUser as any);
      
      const mockTokens = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token'
      };
      
      mockTokenService.generateTokens.mockResolvedValue(mockTokens);

      const result = await authService.refreshToken(validRefreshToken);

      expect(mockTokenService.validateRefreshToken).toHaveBeenCalledWith(validRefreshToken);
      expect(mockTokenService.generateTokens).toHaveBeenCalledWith(mockUser);
      expect(result).toEqual(mockTokens);
    });

    it('should throw AuthenticationError for invalid refresh token', async () => {
      mockTokenService.validateRefreshToken.mockRejectedValue(
        new AuthenticationError('Invalid refresh token')
      );

      await expect(
        authService.refreshToken(validRefreshToken)
      ).rejects.toThrow(AuthenticationError);
    });
  });

  describe('logout', () => {
    const refreshToken = 'refresh-token';

    it('should logout successfully', async () => {
      mockTokenService.revokeRefreshToken.mockResolvedValue(undefined);

      await authService.logout(refreshToken);

      expect(mockTokenService.revokeRefreshToken).toHaveBeenCalledWith(refreshToken);
    });

    it('should handle token service errors', async () => {
      mockTokenService.revokeRefreshToken.mockRejectedValue(new Error('Redis error'));

      await expect(authService.logout(refreshToken)).rejects.toThrow('Redis error');
    });
  });

  describe('getCurrentUser', () => {
    it('should return current user successfully', async () => {
      const userId = '1';
      const mockUser = {
        id: userId,
        email: 'test@example.com',
        role: 'user',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      };

      mockUserRepository.findById.mockResolvedValue(mockUser);

      const result = await authService.getCurrentUser(userId);

      expect(mockUserRepository.findById).toHaveBeenCalledWith(userId);
      expect(result).toEqual(mockUser);
    });

    it('should throw AuthenticationError for non-existent user', async () => {
      const userId = 'non-existent';
      mockUserRepository.findById.mockResolvedValue(null);

      await expect(
        authService.getCurrentUser(userId)
      ).rejects.toThrow(AuthenticationError);
    });
  });
});