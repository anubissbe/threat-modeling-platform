import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import { randomBytes, createHash } from 'crypto';
import { config } from '../config';
import { logger, securityLogger } from '../utils/logger';

export interface TOTPSetupData {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
  manualEntryKey: string;
}

export interface MFAVerificationResult {
  valid: boolean;
  method: 'totp' | 'backup' | 'sms';
  backupCodeUsed?: string;
}

export class MFAService {
  private readonly serviceName: string;
  private readonly issuer: string;

  constructor() {
    this.serviceName = 'ThreatModel.io';
    this.issuer = config.MFA_ISSUER;
    
    // Configure TOTP settings
    authenticator.options = {
      window: config.TOTP_WINDOW,
      step: config.TOTP_STEP,
    };
  }

  /**
   * Generate TOTP setup data for a user
   */
  async generateTOTPSetup(userEmail: string): Promise<TOTPSetupData> {
    try {
      // Generate secret
      const secret = authenticator.generateSecret();
      
      // Create service name with user email
      const serviceName = `${this.serviceName} (${userEmail})`;
      
      // Generate TOTP URL
      const otpUrl = authenticator.keyuri(userEmail, this.issuer, secret);
      
      // Generate QR code
      const qrCodeUrl = await QRCode.toDataURL(otpUrl);
      
      // Generate backup codes
      const backupCodes = this.generateBackupCodes();
      
      // Manual entry key (formatted secret)
      const manualEntryKey = secret.replace(/(.{4})/g, '$1 ').trim();

      logger.info('TOTP setup generated', { userEmail });

      return {
        secret,
        qrCodeUrl,
        backupCodes,
        manualEntryKey,
      };
    } catch (error) {
      logger.error('Failed to generate TOTP setup:', error);
      throw new Error('Failed to generate TOTP setup');
    }
  }

  /**
   * Verify TOTP token
   */
  verifyTOTP(token: string, secret: string): boolean {
    try {
      // Remove any spaces or dashes from token
      const cleanToken = token.replace(/[\s-]/g, '');
      
      // Verify token
      const isValid = authenticator.verify({
        token: cleanToken,
        secret,
      });

      return isValid;
    } catch (error) {
      logger.error('TOTP verification error:', error);
      return false;
    }
  }

  /**
   * Verify backup code
   */
  verifyBackupCode(inputCode: string, storedCodes: string[]): { valid: boolean; codeUsed?: string } {
    try {
      // Hash the input code
      const hashedInput = this.hashBackupCode(inputCode);
      
      // Find matching code
      const matchingCode = storedCodes.find(code => code === hashedInput);
      
      if (matchingCode) {
        return { valid: true, codeUsed: matchingCode };
      }

      return { valid: false };
    } catch (error) {
      logger.error('Backup code verification error:', error);
      return { valid: false };
    }
  }

  /**
   * Generate backup codes
   */
  generateBackupCodes(count: number = config.MFA_BACKUP_CODES_COUNT): string[] {
    const codes: string[] = [];
    
    for (let i = 0; i < count; i++) {
      // Generate 8-character alphanumeric code
      const code = randomBytes(4).toString('hex').toUpperCase();
      // Format as XXXX-XXXX
      const formattedCode = `${code.substring(0, 4)}-${code.substring(4, 8)}`;
      // Hash and store
      codes.push(this.hashBackupCode(formattedCode));
    }

    return codes;
  }

  /**
   * Hash backup code for secure storage
   */
  private hashBackupCode(code: string): string {
    return createHash('sha256').update(code + config.PASSWORD_PEPPER).digest('hex');
  }

  /**
   * Remove used backup code from array
   */
  removeUsedBackupCode(codes: string[], usedCode: string): string[] {
    return codes.filter(code => code !== usedCode);
  }

  /**
   * Generate new backup codes (when user requests refresh)
   */
  regenerateBackupCodes(): string[] {
    return this.generateBackupCodes();
  }

  /**
   * Verify any MFA method
   */
  async verifyMFA(
    userId: string,
    method: 'totp' | 'backup' | 'sms',
    token: string,
    secret?: string,
    backupCodes?: string[]
  ): Promise<MFAVerificationResult> {
    let result: MFAVerificationResult;

    try {
      switch (method) {
        case 'totp':
          if (!secret) {
            throw new Error('TOTP secret required');
          }
          const totpValid = this.verifyTOTP(token, secret);
          result = { valid: totpValid, method: 'totp' };
          break;

        case 'backup':
          if (!backupCodes) {
            throw new Error('Backup codes required');
          }
          const backupResult = this.verifyBackupCode(token, backupCodes);
          result = {
            valid: backupResult.valid,
            method: 'backup',
            backupCodeUsed: backupResult.codeUsed,
          };
          break;

        case 'sms':
          // SMS verification would integrate with SMS service
          // For now, this is a placeholder
          result = { valid: false, method: 'sms' };
          break;

        default:
          throw new Error('Invalid MFA method');
      }

      // Log MFA attempt
      securityLogger.mfaAttempt(userId, method, result.valid);

      return result;
    } catch (error) {
      logger.error('MFA verification error:', error);
      securityLogger.mfaAttempt(userId, method, false);
      return { valid: false, method };
    }
  }

  /**
   * Check if TOTP window allows for clock skew
   */
  isValidTOTPWindow(token: string, secret: string, window: number = 1): boolean {
    try {
      return authenticator.verify({
        token,
        secret,
        window,
      });
    } catch {
      return false;
    }
  }

  /**
   * Get current TOTP token for testing/admin purposes
   */
  getCurrentTOTP(secret: string): string {
    return authenticator.generate(secret);
  }

  /**
   * Validate TOTP secret format
   */
  isValidTOTPSecret(secret: string): boolean {
    try {
      // Try to generate a token with the secret
      authenticator.generate(secret);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Generate QR code for manual TOTP setup
   */
  async generateQRCode(userEmail: string, secret: string): Promise<string> {
    try {
      const otpUrl = authenticator.keyuri(userEmail, this.issuer, secret);
      return await QRCode.toDataURL(otpUrl);
    } catch (error) {
      logger.error('QR code generation error:', error);
      throw new Error('Failed to generate QR code');
    }
  }

  /**
   * Format backup codes for display
   */
  formatBackupCodesForDisplay(hashedCodes: string[]): string[] {
    // This is for display purposes only - in production,
    // you'd store the original codes temporarily during setup
    // and only hash them after user confirms setup
    return hashedCodes.map((_, index) => `****-****`);
  }
}

// SMS MFA Service (placeholder for future implementation)
export class SMSMFAService {
  private readonly twilioSid: string | undefined;
  private readonly twilioToken: string | undefined;
  private readonly twilioPhone: string | undefined;

  constructor() {
    this.twilioSid = config.TWILIO_ACCOUNT_SID;
    this.twilioToken = config.TWILIO_AUTH_TOKEN;
    this.twilioPhone = config.TWILIO_PHONE_NUMBER;
  }

  /**
   * Send SMS verification code
   */
  async sendVerificationCode(phoneNumber: string): Promise<{ success: boolean; code?: string }> {
    // This would integrate with Twilio or another SMS provider
    // For now, return a mock implementation
    
    if (!this.twilioSid || !this.twilioToken || !this.twilioPhone) {
      logger.warn('SMS MFA not configured');
      return { success: false };
    }

    try {
      // Generate 6-digit code
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      
      // In production, you would:
      // 1. Send SMS using Twilio SDK
      // 2. Store code in Redis with expiration
      // 3. Return success status
      
      logger.info('SMS verification code generated', { phoneNumber });
      return { success: true, code }; // Don't return code in production
    } catch (error) {
      logger.error('SMS sending error:', error);
      return { success: false };
    }
  }

  /**
   * Verify SMS code
   */
  async verifyCode(phoneNumber: string, code: string): Promise<boolean> {
    // This would verify against stored code in Redis
    // For now, return false as placeholder
    return false;
  }
}