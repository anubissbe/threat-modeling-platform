import { encrypt, decrypt, hashSecret, generateWebhookSecret, constantTimeCompare } from '../../src/utils/encryption';

describe('Encryption Utils', () => {
  describe('encrypt/decrypt', () => {
    it('should encrypt and decrypt text correctly', () => {
      const plainText = 'This is a secret message';
      const encrypted = encrypt(plainText);
      const decrypted = decrypt(encrypted);

      expect(encrypted).not.toBe(plainText);
      expect(decrypted).toBe(plainText);
    });

    it('should produce different encrypted values for same input', () => {
      const plainText = 'Same message';
      const encrypted1 = encrypt(plainText);
      const encrypted2 = encrypt(plainText);

      expect(encrypted1).not.toBe(encrypted2);
      expect(decrypt(encrypted1)).toBe(plainText);
      expect(decrypt(encrypted2)).toBe(plainText);
    });

    it('should handle special characters', () => {
      const plainText = '!@#$%^&*()_+-=[]{}|;:\'",.<>?/\\`~';
      const encrypted = encrypt(plainText);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plainText);
    });

    it('should handle JSON objects', () => {
      const obj = { username: 'test', password: 'secret123' };
      const jsonString = JSON.stringify(obj);
      const encrypted = encrypt(jsonString);
      const decrypted = decrypt(encrypted);

      expect(JSON.parse(decrypted)).toEqual(obj);
    });
  });

  describe('hashSecret', () => {
    it('should create consistent hash for same input', () => {
      const secret = 'my-secret-key';
      const hash1 = hashSecret(secret);
      const hash2 = hashSecret(secret);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 produces 64 character hex string
    });

    it('should create different hashes for different inputs', () => {
      const hash1 = hashSecret('secret1');
      const hash2 = hashSecret('secret2');

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('generateWebhookSecret', () => {
    it('should generate a random webhook secret', () => {
      const secret1 = generateWebhookSecret();
      const secret2 = generateWebhookSecret();

      expect(secret1).not.toBe(secret2);
      expect(secret1).toHaveLength(64); // 32 bytes = 64 hex characters
    });

    it('should generate valid hex strings', () => {
      const secret = generateWebhookSecret();
      const hexRegex = /^[a-f0-9]{64}$/;

      expect(secret).toMatch(hexRegex);
    });
  });

  describe('constantTimeCompare', () => {
    it('should return true for identical strings', () => {
      const str = 'test-string-123';
      expect(constantTimeCompare(str, str)).toBe(true);
    });

    it('should return false for different strings', () => {
      expect(constantTimeCompare('string1', 'string2')).toBe(false);
    });

    it('should return false for different length strings', () => {
      expect(constantTimeCompare('short', 'longer-string')).toBe(false);
    });

    it('should handle empty strings', () => {
      expect(constantTimeCompare('', '')).toBe(true);
      expect(constantTimeCompare('', 'not-empty')).toBe(false);
    });
  });
});