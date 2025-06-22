import { PasswordService } from '../../../src/services/password';

describe('PasswordService', () => {
  let passwordService: PasswordService;

  beforeEach(() => {
    passwordService = new PasswordService();
  });

  describe('hash', () => {
    it('should hash a password successfully', async () => {
      const password = 'TestPassword123!';
      const hash = await passwordService.hash(password);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash).toMatch(/^\$argon2id\$/);
    });

    it('should generate different hashes for the same password', async () => {
      const password = 'TestPassword123!';
      const hash1 = await passwordService.hash(password);
      const hash2 = await passwordService.hash(password);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('verify', () => {
    it('should verify a correct password', async () => {
      const password = 'TestPassword123!';
      const hash = await passwordService.hash(password);
      const isValid = await passwordService.verify(password, hash);

      expect(isValid).toBe(true);
    });

    it('should reject an incorrect password', async () => {
      const password = 'TestPassword123!';
      const wrongPassword = 'WrongPassword123!';
      const hash = await passwordService.hash(password);
      const isValid = await passwordService.verify(wrongPassword, hash);

      expect(isValid).toBe(false);
    });

    it('should handle invalid hash gracefully', async () => {
      const password = 'TestPassword123!';
      const invalidHash = 'invalid-hash';
      const isValid = await passwordService.verify(password, invalidHash);

      expect(isValid).toBe(false);
    });
  });

  describe('validatePassword', () => {
    it('should validate a strong password', () => {
      const result = passwordService.validatePassword('StrongP@ssw0rd');

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject password shorter than 8 characters', () => {
      const result = passwordService.validatePassword('Sh0rt!');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must be at least 8 characters long');
    });

    it('should reject password longer than 128 characters', () => {
      const longPassword = 'a'.repeat(129);
      const result = passwordService.validatePassword(longPassword);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must be no more than 128 characters long');
    });

    it('should require lowercase letter', () => {
      const result = passwordService.validatePassword('PASSWORD123!');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one lowercase letter');
    });

    it('should require uppercase letter', () => {
      const result = passwordService.validatePassword('password123!');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one uppercase letter');
    });

    it('should require number', () => {
      const result = passwordService.validatePassword('Password!');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one number');
    });

    it('should require special character', () => {
      const result = passwordService.validatePassword('Password123');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one special character');
    });

    it('should reject common patterns', () => {
      const commonPasswords = [
        'Password123!',
        'Admin123!',
        'Welcome123!',
        'Qwerty123!',
        'Abc123456!',
      ];

      commonPasswords.forEach(password => {
        const result = passwordService.validatePassword(password);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Password contains common patterns and is not secure');
      });
    });

    it('should reject sequential characters', () => {
      const result = passwordService.validatePassword('Abc123!@#');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password contains common patterns and is not secure');
    });

    it('should reject repeated characters', () => {
      const result = passwordService.validatePassword('Paaa123!');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password contains common patterns and is not secure');
    });
  });

  describe('generateSecurePassword', () => {
    it('should generate password of specified length', () => {
      const password = passwordService.generateSecurePassword(16);

      expect(password).toHaveLength(16);
    });

    it('should generate password with all required character types', () => {
      const password = passwordService.generateSecurePassword(16);

      expect(password).toMatch(/[a-z]/); // lowercase
      expect(password).toMatch(/[A-Z]/); // uppercase
      expect(password).toMatch(/[0-9]/); // number
      expect(password).toMatch(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>?]/); // special
    });

    it('should generate different passwords each time', () => {
      const password1 = passwordService.generateSecurePassword(16);
      const password2 = passwordService.generateSecurePassword(16);

      expect(password1).not.toBe(password2);
    });

    it('should pass its own validation', () => {
      const password = passwordService.generateSecurePassword(16);
      const result = passwordService.validatePassword(password);

      expect(result.valid).toBe(true);
    });
  });

  describe('constantTimeCompare', () => {
    it('should return true for equal strings', () => {
      const result = passwordService.constantTimeCompare('test123', 'test123');

      expect(result).toBe(true);
    });

    it('should return false for different strings', () => {
      const result = passwordService.constantTimeCompare('test123', 'test456');

      expect(result).toBe(false);
    });

    it('should return false for different length strings', () => {
      const result = passwordService.constantTimeCompare('test', 'test123');

      expect(result).toBe(false);
    });
  });
});