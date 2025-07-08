import crypto from 'crypto';
import { logger } from './logger';

const ENCRYPTION_KEY = process.env['ENCRYPTION_KEY'] || crypto.randomBytes(32).toString('hex');
const IV_LENGTH = 16;
const ALGORITHM = 'aes-256-cbc';

if (!process.env['ENCRYPTION_KEY']) {
  logger.warn('ENCRYPTION_KEY not set in environment, using random key. This is not suitable for production!');
}

export function encrypt(text: string): string {
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(
      ALGORITHM,
      Buffer.from(ENCRYPTION_KEY, 'hex'),
      iv
    );

    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);

    return iv.toString('hex') + ':' + encrypted.toString('hex');
  } catch (error) {
    logger.error('Encryption failed:', error);
    throw new Error('Failed to encrypt data');
  }
}

export function decrypt(text: string): string {
  try {
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift()!, 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    
    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      Buffer.from(ENCRYPTION_KEY, 'hex'),
      iv
    );

    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted.toString();
  } catch (error) {
    logger.error('Decryption failed:', error);
    throw new Error('Failed to decrypt data');
  }
}

export function hashSecret(secret: string): string {
  return crypto
    .createHash('sha256')
    .update(secret)
    .digest('hex');
}

export function generateWebhookSecret(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  
  return crypto.timingSafeEqual(
    Buffer.from(a),
    Buffer.from(b)
  );
}