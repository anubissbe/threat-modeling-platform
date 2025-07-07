import { encryptionService } from '../utils/encryption';

/**
 * Decorator to automatically encrypt/decrypt sensitive fields
 */
export function Encrypted() {
  return function (target: any, propertyKey: string) {
    const privateKey = `_${propertyKey}`;

    Object.defineProperty(target, propertyKey, {
      get() {
        const encryptedValue = this[privateKey];
        if (!encryptedValue) return null;
        
        try {
          return encryptionService.decryptField(encryptedValue);
        } catch (error) {
          console.error(`Failed to decrypt field ${propertyKey}:`, error);
          return null;
        }
      },
      set(value: string) {
        if (!value) {
          this[privateKey] = null;
          return;
        }
        
        try {
          this[privateKey] = encryptionService.encryptField(value);
        } catch (error) {
          console.error(`Failed to encrypt field ${propertyKey}:`, error);
          throw new Error(`Encryption failed for field ${propertyKey}`);
        }
      },
      enumerable: true,
      configurable: true,
    });
  };
}

/**
 * Decorator to hash fields (one-way encryption)
 */
export function Hashed() {
  return function (target: any, propertyKey: string) {
    const privateKey = `_${propertyKey}`;

    Object.defineProperty(target, propertyKey, {
      get() {
        return this[privateKey];
      },
      set(value: string) {
        if (!value) {
          this[privateKey] = null;
          return;
        }
        
        this[privateKey] = encryptionService.hash(value);
      },
      enumerable: true,
      configurable: true,
    });
  };
}

/**
 * Decorator to anonymize PII fields
 */
export function Anonymized(showLastChars: number = 4) {
  return function (target: any, propertyKey: string) {
    const privateKey = `_${propertyKey}`;
    const anonymizedKey = `_${propertyKey}_anonymized`;

    Object.defineProperty(target, propertyKey, {
      get() {
        return this[privateKey];
      },
      set(value: string) {
        if (!value) {
          this[privateKey] = null;
          this[anonymizedKey] = null;
          return;
        }
        
        this[privateKey] = value;
        this[anonymizedKey] = encryptionService.anonymize(value, showLastChars);
      },
      enumerable: true,
      configurable: true,
    });

    // Add getter for anonymized value
    Object.defineProperty(target, `${propertyKey}Anonymized`, {
      get() {
        return this[anonymizedKey];
      },
      enumerable: true,
      configurable: true,
    });
  };
}

/**
 * Class decorator to mark models that contain sensitive data
 */
export function SensitiveData(options?: { 
  auditAccess?: boolean; 
  encryptStorage?: boolean;
  anonymizeOnExport?: boolean;
}) {
  return function (constructor: Function) {
    constructor.prototype._isSensitive = true;
    constructor.prototype._sensitiveOptions = options || {};
    
    // Add method to get sanitized version for export
    constructor.prototype.toSanitized = function() {
      const sanitized: any = {};
      
      for (const key in this) {
        if (key.startsWith('_')) continue;
        
        const descriptor = Object.getOwnPropertyDescriptor(this, key);
        if (descriptor && descriptor.get) {
          // This is likely an encrypted field
          if (options?.anonymizeOnExport) {
            sanitized[key] = this[`${key}Anonymized`] || '***';
          } else {
            sanitized[key] = '***ENCRYPTED***';
          }
        } else {
          sanitized[key] = this[key];
        }
      }
      
      return sanitized;
    };
  };
}

/**
 * Method decorator to audit access to sensitive methods
 */
export function AuditAccess(action: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const startTime = Date.now();
      let result;
      let error;

      try {
        result = await originalMethod.apply(this, args);
      } catch (e) {
        error = e;
      }

      const duration = Date.now() - startTime;

      // Log access attempt
      const auditLog = {
        timestamp: new Date(),
        method: `${target.constructor.name}.${propertyKey}`,
        action,
        duration,
        success: !error,
        error: (error as any)?.message,
        // Add user context if available
        userId: (global as any).currentUser?.id,
        requestId: (global as any).currentRequestId,
      };

      // In production, send to audit service
      console.log('AUDIT_ACCESS', auditLog);

      if (error) {
        throw error;
      }

      return result;
    };

    return descriptor;
  };
}

/**
 * Example usage:
 * 
 * @SensitiveData({ auditAccess: true, anonymizeOnExport: true })
 * class User {
 *   @Encrypted()
 *   email: string;
 * 
 *   @Encrypted()
 *   phoneNumber: string;
 * 
 *   @Hashed()
 *   socialSecurityNumber: string;
 * 
 *   @Anonymized(4)
 *   creditCardNumber: string;
 * 
 *   @AuditAccess('VIEW_SENSITIVE_DATA')
 *   async getSensitiveInfo() {
 *     return {
 *       email: this.email,
 *       phone: this.phoneNumber
 *     };
 *   }
 * }
 */