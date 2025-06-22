import { UserService } from '../../../src/services/user.service';
import { CacheManager } from '../../../src/redis';
import * as db from '../../../src/database';
import { CreateUserDto, UpdateUserDto, UserFilters } from '../../../src/types';

// Mock dependencies
jest.mock('../../../src/database');
jest.mock('../../../src/redis');
jest.mock('../../../src/utils/logger');
jest.mock('../../../src/utils/crypto');

describe('UserService', () => {
  let userService: UserService;
  let mockCache: jest.Mocked<CacheManager>;
  let mockQuery: jest.MockedFunction<typeof db.query>;

  beforeEach(() => {
    // Setup mocks
    mockCache = {
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
      invalidateUser: jest.fn(),
    } as any;

    mockQuery = db.query as jest.MockedFunction<typeof db.query>;
    mockQuery.mockClear();

    userService = new UserService(mockCache);
  });

  describe('createUser', () => {
    it('should create a new user successfully', async () => {
      const createUserDto: CreateUserDto = {
        email: 'test@example.com',
        password: 'SecurePassword123!',
        firstName: 'Test',
        lastName: 'User',
        organizationId: '123e4567-e89b-12d3-a456-426614174000',
      };

      const mockUser = {
        id: '123e4567-e89b-12d3-a456-426614174001',
        email: 'test@example.com',
        first_name: 'Test',
        last_name: 'User',
        organization_id: '123e4567-e89b-12d3-a456-426614174000',
        roles: ['user'],
        permissions: [],
        is_active: true,
        email_verified: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockQuery.mockResolvedValueOnce({
        rows: [mockUser],
        rowCount: 1,
      } as any);

      const result = await userService.createUser(createUserDto);

      expect(result).toHaveProperty('id', mockUser.id);
      expect(result).toHaveProperty('email', mockUser.email);
      expect(mockCache.set).toHaveBeenCalledWith(
        `user:${mockUser.id}`,
        expect.any(Object),
        3600
      );
    });

    it('should throw error for duplicate email', async () => {
      const createUserDto: CreateUserDto = {
        email: 'existing@example.com',
        password: 'SecurePassword123!',
      };

      const error = new Error('duplicate key value');
      (error as any).code = '23505';
      mockQuery.mockRejectedValueOnce(error);

      await expect(userService.createUser(createUserDto)).rejects.toThrow(
        'Email already exists'
      );
    });
  });

  describe('getUser', () => {
    it('should get user from cache if available', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174001';
      const cachedUser = {
        id: userId,
        email: 'test@example.com',
        roles: ['user'],
      };

      mockCache.get.mockResolvedValueOnce(cachedUser);

      const result = await userService.getUser(userId);

      expect(result).toEqual(cachedUser);
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it('should get user from database if not in cache', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174001';
      const dbUser = {
        id: userId,
        email: 'test@example.com',
        role_names: ['user', 'admin'],
        permission_names: ['users:read', 'users:write'],
      };

      mockCache.get.mockResolvedValueOnce(null);
      mockQuery.mockResolvedValueOnce({
        rows: [dbUser],
        rowCount: 1,
      } as any);

      const result = await userService.getUser(userId);

      expect(result).toHaveProperty('id', userId);
      expect(result).toHaveProperty('roles', ['user', 'admin']);
      expect(mockCache.set).toHaveBeenCalled();
    });

    it('should return null for non-existent user', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174001';

      mockCache.get.mockResolvedValueOnce(null);
      mockQuery.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      } as any);

      const result = await userService.getUser(userId);

      expect(result).toBeNull();
    });
  });

  describe('updateUser', () => {
    it('should update user successfully', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174001';
      const adminId = '123e4567-e89b-12d3-a456-426614174002';
      const updateDto: UpdateUserDto = {
        firstName: 'Updated',
        lastName: 'Name',
      };

      const updatedUser = {
        id: userId,
        first_name: 'Updated',
        last_name: 'Name',
      };

      mockQuery.mockResolvedValueOnce({
        rows: [updatedUser],
        rowCount: 1,
      } as any);

      const result = await userService.updateUser(userId, updateDto, adminId);

      expect(result).toHaveProperty('firstName', 'Updated');
      expect(mockCache.invalidateUser).toHaveBeenCalledWith(userId);
    });

    it('should throw error for non-existent user', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174001';
      const adminId = '123e4567-e89b-12d3-a456-426614174002';
      const updateDto: UpdateUserDto = { firstName: 'Test' };

      mockQuery.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      } as any);

      await expect(
        userService.updateUser(userId, updateDto, adminId)
      ).rejects.toThrow('User not found');
    });
  });

  describe('deleteUser', () => {
    it('should soft delete user successfully', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174001';
      const adminId = '123e4567-e89b-12d3-a456-426614174002';

      mockQuery.mockResolvedValueOnce({
        rowCount: 1,
      } as any);

      await userService.deleteUser(userId, adminId);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE auth.users'),
        [userId]
      );
      expect(mockCache.invalidateUser).toHaveBeenCalledWith(userId);
    });

    it('should throw error for non-existent user', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174001';
      const adminId = '123e4567-e89b-12d3-a456-426614174002';

      mockQuery.mockResolvedValueOnce({
        rowCount: 0,
      } as any);

      await expect(userService.deleteUser(userId, adminId)).rejects.toThrow(
        'User not found'
      );
    });
  });

  describe('hasPermission', () => {
    it('should return true when user has permission', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174001';
      const permission = 'users:read';

      mockQuery.mockResolvedValueOnce({
        rows: [{ has_permission: true }],
      } as any);

      const result = await userService.hasPermission(userId, permission);

      expect(result).toBe(true);
    });

    it('should return false when user lacks permission', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174001';
      const permission = 'admin:delete';

      mockQuery.mockResolvedValueOnce({
        rows: [{ has_permission: false }],
      } as any);

      const result = await userService.hasPermission(userId, permission);

      expect(result).toBe(false);
    });
  });
});