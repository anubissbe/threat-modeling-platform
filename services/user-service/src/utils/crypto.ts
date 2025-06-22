import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'crypto';
import { config } from '../config';

// Argon2 configuration
const argon2Options: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 65536, // 64MB
  timeCost: 3,
  parallelism: 4,
  hashLength: 32,
};

/**
 * Hash a password using Argon2id
 */
export async function hashPassword(password: string): Promise<string> {
  try {
    const salt = randomBytes(32);
    return await argon2.hash(password, {
      ...argon2Options,
      salt,
    });
  } catch (error) {
    throw new Error('Failed to hash password');
  }
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch (error) {
    return false;
  }
}

/**
 * Generate a secure random token
 */
export function generateToken(length: number = 32): string {
  return randomBytes(length).toString('hex');
}

/**
 * Generate a numeric OTP
 */
export function generateOTP(length: number = 6): string {
  const digits = '0123456789';
  let otp = '';
  const bytes = randomBytes(length);
  
  for (let i = 0; i < length; i++) {
    otp += digits[bytes[i] % 10];
  }
  
  return otp;
}

/**
 * Hash a string using SHA256
 */
export function sha256(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

/**
 * Create a secure hash for tokens
 */
export function hashToken(token: string): string {
  return createHash('sha256')
    .update(token + config.JWT_SECRET)
    .digest('hex');
}

/**
 * Generate API key
 */
export function generateApiKey(): string {
  const prefix = 'tm_';
  const key = randomBytes(32).toString('base64url');
  return `${prefix}${key}`;
}

/**
 * Mask API key for display
 */
export function maskApiKey(apiKey: string): string {
  if (apiKey.length < 8) {
    return '*'.repeat(apiKey.length);
  }
  
  const prefix = apiKey.substring(0, 6);
  const suffix = apiKey.substring(apiKey.length - 4);
  const masked = '*'.repeat(apiKey.length - 10);
  
  return `${prefix}${masked}${suffix}`;
}

/**
 * Generate a secure invitation token
 */
export interface InvitationToken {
  token: string;
  hash: string;
  expiresAt: Date;
}

export function generateInvitationToken(
  expirationHours: number = 72
): InvitationToken {
  const token = generateToken(32);
  const hash = hashToken(token);
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + expirationHours);
  
  return {
    token,
    hash,
    expiresAt,
  };
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
export function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

/**
 * Generate a secure session ID
 */
export function generateSessionId(): string {
  const timestamp = Date.now().toString(36);
  const random = randomBytes(16).toString('hex');
  return `${timestamp}-${random}`;
}

/**
 * Encrypt sensitive data (placeholder - implement with proper encryption)
 */
export function encrypt(data: string): string {
  // TODO: Implement proper encryption using AES-256-GCM
  // This is a placeholder that should not be used in production
  return Buffer.from(data).toString('base64');
}

/**
 * Decrypt sensitive data (placeholder - implement with proper decryption)
 */
export function decrypt(encryptedData: string): string {
  // TODO: Implement proper decryption using AES-256-GCM
  // This is a placeholder that should not be used in production
  return Buffer.from(encryptedData, 'base64').toString('utf-8');
}