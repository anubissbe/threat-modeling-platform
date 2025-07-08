import { BaseNotification, NotificationType, RetryableError } from '../types';
import { logger } from '../utils/logger';

export abstract class NotificationProvider {
  abstract readonly type: NotificationType;
  protected abstract configuration: Record<string, any>;

  abstract send(notification: BaseNotification): Promise<void>;
  abstract validateConfiguration(config: Record<string, any>): boolean;

  protected createRetryableError(message: string, retryable: boolean = true, retryAfter?: number): RetryableError {
    const error = new Error(message) as RetryableError;
    error.retryable = retryable;
    error.retryAfter = retryAfter;
    return error;
  }

  protected async handleProviderError(error: any, context: string): Promise<never> {
    logger.error(`${this.type} provider error in ${context}:`, error);
    
    // Check if it's a rate limit error
    if (this.isRateLimitError(error)) {
      const retryAfter = this.extractRetryAfter(error);
      throw this.createRetryableError(
        `Rate limit exceeded in ${context}`,
        true,
        retryAfter
      );
    }

    // Check if it's a temporary error
    if (this.isTemporaryError(error)) {
      throw this.createRetryableError(`Temporary error in ${context}: ${error.message}`);
    }

    // Check if it's a permanent error
    if (this.isPermanentError(error)) {
      throw this.createRetryableError(`Permanent error in ${context}: ${error.message}`, false);
    }

    // Default to retryable for unknown errors
    throw this.createRetryableError(`Unknown error in ${context}: ${error.message}`);
  }

  protected isRateLimitError(error: any): boolean {
    const status = error.response?.status || error.status;
    return status === 429 || error.message?.includes('rate limit');
  }

  protected isTemporaryError(error: any): boolean {
    const status = error.response?.status || error.status;
    const temporaryStatuses = [408, 429, 500, 502, 503, 504];
    const temporaryMessages = [
      'ECONNREFUSED',
      'ENOTFOUND',
      'ETIMEDOUT',
      'ECONNRESET',
      'EPIPE',
      'timeout',
      'connection refused',
    ];

    return temporaryStatuses.includes(status) ||
           temporaryMessages.some(msg => error.message?.toLowerCase().includes(msg));
  }

  protected isPermanentError(error: any): boolean {
    const status = error.response?.status || error.status;
    const permanentStatuses = [400, 401, 403, 404, 422];
    const permanentMessages = [
      'invalid recipient',
      'invalid token',
      'unauthorized',
      'forbidden',
      'not found',
      'invalid request',
    ];

    return permanentStatuses.includes(status) ||
           permanentMessages.some(msg => error.message?.toLowerCase().includes(msg));
  }

  protected extractRetryAfter(error: any): number {
    const retryAfter = error.response?.headers?.['retry-after'] || 
                      error.response?.headers?.['Retry-After'] ||
                      error.retryAfter;

    if (retryAfter) {
      const parsed = parseInt(retryAfter);
      return isNaN(parsed) ? 60 : parsed * 1000; // Convert to milliseconds
    }

    return 60000; // Default to 1 minute
  }

  protected sanitizeLogData(data: any): any {
    if (!data || typeof data !== 'object') return data;

    const sanitized = { ...data };
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'auth', 'authorization'];

    for (const field of sensitiveFields) {
      if (sensitiveFields.some(sensitive => field.toLowerCase().includes(sensitive))) {
        sanitized[field] = '[REDACTED]';
      }
    }

    return sanitized;
  }

  protected validateRequiredConfig(config: Record<string, any>, requiredFields: string[]): boolean {
    for (const field of requiredFields) {
      if (!config[field]) {
        logger.error(`Missing required configuration field: ${field}`);
        return false;
      }
    }
    return true;
  }

  protected async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  protected truncateMessage(message: string, maxLength: number): string {
    if (message.length <= maxLength) return message;
    return message.substring(0, maxLength - 3) + '...';
  }

  protected formatMessage(template: string, variables: Record<string, any>): string {
    let formatted = template;
    
    Object.entries(variables).forEach(([key, value]) => {
      const placeholder = `{{${key}}}`;
      formatted = formatted.replace(new RegExp(placeholder, 'g'), String(value));
    });

    return formatted;
  }

  protected async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    const timeout = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Operation timed out')), timeoutMs);
    });

    return Promise.race([promise, timeout]);
  }

  protected async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === maxRetries) break;
        
        if (!this.isTemporaryError(error)) {
          throw error;
        }

        const delay = baseDelay * Math.pow(2, attempt); // Exponential backoff
        await this.delay(delay);
      }
    }

    throw lastError!;
  }
}

export default NotificationProvider;