import { describe, it, expect } from '@jest/globals';
import { generateAccessToken, generateRefreshToken, verifyAccessToken, verifyRefreshToken } from '../../src/utils/jwt';
import { User, UserRole } from '../../src/types/auth';

describe('JWT Utils', () => {
  const mockUser: User = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
    role: UserRole.DEVELOPER,
    organization: 'Test Org',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  describe('generateAccessToken', () => {
    it('should generate a valid access token', () => {
      const token = generateAccessToken(mockUser);
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate a valid refresh token', () => {
      const token = generateRefreshToken(mockUser.id);
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify a valid access token', () => {
      const token = generateAccessToken(mockUser);
      const payload = verifyAccessToken(token);
      
      expect(payload).toBeTruthy();
      expect(payload?.userId).toBe(mockUser.id);
      expect(payload?.email).toBe(mockUser.email);
      expect(payload?.role).toBe(mockUser.role);
    });

    it('should return null for invalid token', () => {
      const payload = verifyAccessToken('invalid-token');
      expect(payload).toBeNull();
    });
  });

  describe('verifyRefreshToken', () => {
    it('should verify a valid refresh token', () => {
      const token = generateRefreshToken(mockUser.id);
      const payload = verifyRefreshToken(token);
      
      expect(payload).toBeTruthy();
      expect(payload?.userId).toBe(mockUser.id);
    });

    it('should return null for invalid token', () => {
      const payload = verifyRefreshToken('invalid-token');
      expect(payload).toBeNull();
    });
  });
});