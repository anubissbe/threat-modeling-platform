import { hashPassword, comparePassword, validatePasswordStrength } from '../../src/utils/password';

describe('Password Utils', () => {
  describe('validatePasswordStrength', () => {
    it('should accept strong passwords', () => {
      const strongPasswords = [
        'Password123!',
        'MySecure#Pass1',
        'Str0ng!Password',
        'C0mplex@Pass2023'
      ];

      strongPasswords.forEach(password => {
        expect(validatePasswordStrength(password)).toBe(true);
      });
    });

    it('should reject weak passwords', () => {
      const weakPasswords = [
        'password',        // no uppercase, no numbers, no special chars
        'PASSWORD',        // no lowercase, no numbers, no special chars
        '12345678',        // no letters, no special chars
        'Password',        // no numbers, no special chars
        'Password123',     // no special chars
        'Pass123!',        // too short
        '',                // empty
        'short'            // too short
      ];

      weakPasswords.forEach(password => {
        expect(validatePasswordStrength(password)).toBe(false);
      });
    });

    it('should handle edge cases', () => {
      expect(validatePasswordStrength(null as any)).toBe(false);
      expect(validatePasswordStrength(undefined as any)).toBe(false);
      expect(validatePasswordStrength(123 as any)).toBe(false);
    });
  });

  describe('hashPassword', () => {
    it('should hash password successfully', async () => {
      const password = 'TestPassword123!';
      const hash = await hashPassword(password);
      
      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(typeof hash).toBe('string');
      expect(hash.length).toBeGreaterThan(0);
    });

    it('should generate different hashes for same password', async () => {
      const password = 'TestPassword123!';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);
      
      expect(hash1).not.toBe(hash2);
    });

    it('should handle empty password', async () => {
      await expect(hashPassword('')).rejects.toThrow();
    });

    it('should handle null/undefined passwords', async () => {
      await expect(hashPassword(null as any)).rejects.toThrow();
      await expect(hashPassword(undefined as any)).rejects.toThrow();
    });
  });

  describe('comparePassword', () => {
    it('should compare passwords correctly', async () => {
      const password = 'TestPassword123!';
      const hash = await hashPassword(password);
      
      const isMatch = await comparePassword(password, hash);
      expect(isMatch).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const password = 'TestPassword123!';
      const wrongPassword = 'WrongPassword123!';
      const hash = await hashPassword(password);
      
      const isMatch = await comparePassword(wrongPassword, hash);
      expect(isMatch).toBe(false);
    });

    it('should handle malformed hash', async () => {
      const password = 'TestPassword123!';
      const malformedHash = 'invalid-hash';
      
      await expect(comparePassword(password, malformedHash)).rejects.toThrow();
    });

    it('should handle empty inputs', async () => {
      const hash = await hashPassword('TestPassword123!');
      
      await expect(comparePassword('', hash)).rejects.toThrow();
      await expect(comparePassword('TestPassword123!', '')).rejects.toThrow();
    });
  });

  describe('integration', () => {
    it('should work with realistic password flow', async () => {
      const originalPassword = 'UserPassword123!';
      
      // Validate password strength
      expect(validatePasswordStrength(originalPassword)).toBe(true);
      
      // Hash the password
      const hashedPassword = await hashPassword(originalPassword);
      expect(hashedPassword).toBeDefined();
      
      // Verify correct password
      const isCorrect = await comparePassword(originalPassword, hashedPassword);
      expect(isCorrect).toBe(true);
      
      // Verify incorrect password
      const isIncorrect = await comparePassword('WrongPassword123!', hashedPassword);
      expect(isIncorrect).toBe(false);
    });

    it('should handle multiple password operations', async () => {
      const passwords = [
        'Password1!',
        'AnotherPass2@',
        'ThirdPassword3#',
        'FinalPassword4$'
      ];
      
      const hashes = await Promise.all(
        passwords.map(pwd => hashPassword(pwd))
      );
      
      // Verify all hashes are unique
      const uniqueHashes = new Set(hashes);
      expect(uniqueHashes.size).toBe(passwords.length);
      
      // Verify all passwords match their hashes
      for (let i = 0; i < passwords.length; i++) {
        const isMatch = await comparePassword(passwords[i], hashes[i]);
        expect(isMatch).toBe(true);
      }
      
      // Verify cross-password verification fails
      for (let i = 0; i < passwords.length; i++) {
        for (let j = 0; j < passwords.length; j++) {
          if (i !== j) {
            const isMatch = await comparePassword(passwords[i], hashes[j]);
            expect(isMatch).toBe(false);
          }
        }
      }
    });
  });
});