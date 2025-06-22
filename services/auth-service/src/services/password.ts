import * as argon2 from 'argon2';
import { randomBytes, timingSafeEqual } from 'crypto';
import { config, getArgon2Config } from '../config';
import { logger } from '../utils/logger';

export class PasswordService {
  private readonly pepper: string;
  private readonly argon2Options: argon2.Options;

  constructor() {
    this.pepper = config.PASSWORD_PEPPER;
    this.argon2Options = {
      ...getArgon2Config(),
      type: argon2.argon2id,
      hashLength: 32,
    };
  }

  /**
   * Hash a password using Argon2id with pepper
   */
  async hash(password: string): Promise<string> {
    try {
      // Add pepper to password
      const pepperedPassword = password + this.pepper;
      
      // Generate random salt
      const salt = randomBytes(32);
      
      // Hash with Argon2id
      const hash = await argon2.hash(pepperedPassword, {
        ...this.argon2Options,
        salt,
      });

      logger.debug('Password hashed successfully');
      return hash;
    } catch (error) {
      logger.error('Password hashing error:', error);
      throw new Error('Failed to hash password');
    }
  }

  /**
   * Verify a password against a hash
   */
  async verify(password: string, hash: string): Promise<boolean> {
    try {
      // Add pepper to password
      const pepperedPassword = password + this.pepper;
      
      // Verify with Argon2
      const isValid = await argon2.verify(hash, pepperedPassword);
      
      logger.debug('Password verification completed', { isValid });
      return isValid;
    } catch (error) {
      logger.error('Password verification error:', error);
      return false;
    }
  }

  /**
   * Check if password meets security requirements
   */
  validatePassword(password: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Minimum length
    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }

    // Maximum length (prevent DoS)
    if (password.length > 128) {
      errors.push('Password must be no more than 128 characters long');
    }

    // Must contain lowercase letter
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    // Must contain uppercase letter
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    // Must contain number
    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    // Must contain special character
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    // Check for common patterns
    if (this.hasCommonPatterns(password)) {
      errors.push('Password contains common patterns and is not secure');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Check for common password patterns
   */
  private hasCommonPatterns(password: string): boolean {
    const lowercasePassword = password.toLowerCase();

    // Common words and patterns
    const commonPatterns = [
      'password',
      'admin',
      'user',
      'login',
      'welcome',
      'qwerty',
      'abc123',
      '123456',
      'letmein',
      'monkey',
      'dragon',
    ];

    // Check for common patterns
    for (const pattern of commonPatterns) {
      if (lowercasePassword.includes(pattern)) {
        return true;
      }
    }

    // Check for sequential characters
    if (this.hasSequentialChars(password)) {
      return true;
    }

    // Check for repeated characters
    if (this.hasRepeatedChars(password)) {
      return true;
    }

    return false;
  }

  /**
   * Check for sequential characters (e.g., "abc", "123")
   */
  private hasSequentialChars(password: string): boolean {
    for (let i = 0; i < password.length - 2; i++) {
      const char1 = password.charCodeAt(i);
      const char2 = password.charCodeAt(i + 1);
      const char3 = password.charCodeAt(i + 2);

      if (char2 === char1 + 1 && char3 === char2 + 1) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check for repeated characters (e.g., "aaa", "111")
   */
  private hasRepeatedChars(password: string): boolean {
    for (let i = 0; i < password.length - 2; i++) {
      if (password[i] === password[i + 1] && password[i + 1] === password[i + 2]) {
        return true;
      }
    }
    return false;
  }

  /**
   * Generate a secure random password
   */
  generateSecurePassword(length = 16): string {
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    
    const allChars = lowercase + uppercase + numbers + symbols;
    
    let password = '';
    
    // Ensure at least one character from each category
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += symbols[Math.floor(Math.random() * symbols.length)];
    
    // Fill the rest with random characters
    for (let i = password.length; i < length; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }
    
    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('');
  }

  /**
   * Constant-time string comparison to prevent timing attacks
   */
  constantTimeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    const bufferA = Buffer.from(a);
    const bufferB = Buffer.from(b);

    return timingSafeEqual(bufferA, bufferB);
  }
}