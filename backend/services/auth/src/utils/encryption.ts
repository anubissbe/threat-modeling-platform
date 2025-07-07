import crypto from 'crypto';
import { securityConfig } from '../config/security';

const { algorithm, keyLength, ivLength, saltLength, iterations } = securityConfig.encryption;

export class EncryptionService {
  private masterKey: Buffer;

  constructor() {
    // In production, this should come from a secure key management service
    const masterKeyString = process.env['MASTER_ENCRYPTION_KEY'] || 'default-dev-key-change-in-production';
    if (!masterKeyString || masterKeyString === 'default-dev-key-change-in-production') {
      console.warn('WARNING: Using default encryption key. Set MASTER_ENCRYPTION_KEY in production!');
    }
    
    // Derive a key from the master key
    this.masterKey = crypto.pbkdf2Sync(
      masterKeyString,
      'threat-modeling-platform-salt',
      iterations,
      keyLength,
      'sha256'
    );
  }

  /**
   * Encrypt sensitive data
   */
  encrypt(plaintext: string): { encrypted: string; iv: string; tag: string; salt: string } {
    const salt = crypto.randomBytes(saltLength);
    const key = crypto.pbkdf2Sync(this.masterKey, salt, iterations, keyLength, 'sha256');
    const iv = crypto.randomBytes(ivLength);
    
    const cipher = crypto.createCipheriv(algorithm, key, iv) as any;
    
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const tag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      tag: tag.toString('hex'),
      salt: salt.toString('hex'),
    };
  }

  /**
   * Decrypt sensitive data
   */
  decrypt(encryptedData: { encrypted: string; iv: string; tag: string; salt: string }): string {
    const salt = Buffer.from(encryptedData.salt, 'hex');
    const key = crypto.pbkdf2Sync(this.masterKey, salt, iterations, keyLength, 'sha256');
    const iv = Buffer.from(encryptedData.iv, 'hex');
    const tag = Buffer.from(encryptedData.tag, 'hex');
    
    const decipher = crypto.createDecipheriv(algorithm, key, iv) as any;
    decipher.setAuthTag(tag);
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * Hash sensitive data (one-way)
   */
  hash(data: string): string {
    return crypto
      .createHash('sha256')
      .update(data)
      .digest('hex');
  }

  /**
   * Generate a cryptographically secure random token
   */
  generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Encrypt field-level data for database storage
   */
  encryptField(value: string): string {
    const encryptedData = this.encrypt(value);
    return JSON.stringify(encryptedData);
  }

  /**
   * Decrypt field-level data from database
   */
  decryptField(encryptedValue: string): string {
    try {
      const encryptedData = JSON.parse(encryptedValue);
      return this.decrypt(encryptedData);
    } catch (error) {
      throw new Error('Invalid encrypted data format');
    }
  }

  /**
   * Anonymize PII data
   */
  anonymize(data: string, showLastChars: number = 4): string {
    if (data.length <= showLastChars) {
      return '*'.repeat(data.length);
    }
    
    const masked = '*'.repeat(data.length - showLastChars);
    const visible = data.slice(-showLastChars);
    return masked + visible;
  }

  /**
   * Validate data integrity using HMAC
   */
  generateHMAC(data: string, secret: string): string {
    return crypto
      .createHmac('sha256', secret)
      .update(data)
      .digest('hex');
  }

  verifyHMAC(data: string, hmac: string, secret: string): boolean {
    const calculatedHMAC = this.generateHMAC(data, secret);
    return crypto.timingSafeEqual(
      Buffer.from(calculatedHMAC),
      Buffer.from(hmac)
    );
  }
}

// Export singleton instance
export const encryptionService = new EncryptionService();