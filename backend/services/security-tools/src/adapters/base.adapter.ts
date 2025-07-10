import {
  SecurityToolIntegration,
  ConnectionConfig,
  SyncFilter,
  IntegrationStatus,
  SecurityToolEvent,
  SecurityToolError,
  FieldMapping,
  SeverityLevel
} from '../types/security-tools';

export abstract class BaseSecurityToolAdapter {
  protected integration: SecurityToolIntegration;
  protected connectionConfig: ConnectionConfig;
  protected isConnected: boolean = false;

  constructor(integration: SecurityToolIntegration) {
    this.integration = integration;
    this.connectionConfig = integration.connectionConfig;
  }

  // Abstract methods that must be implemented by each adapter
  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract testConnection(): Promise<boolean>;
  abstract sync(filter?: SyncFilter): Promise<void>;
  
  // Common methods with default implementations
  async getStatus(): Promise<IntegrationStatus> {
    try {
      if (!this.isConnected) {
        await this.connect();
      }
      const healthy = await this.testConnection();
      return healthy ? 'connected' : 'error';
    } catch (error) {
      return 'error';
    }
  }

  protected mapSeverity(sourceSeverity: string): SeverityLevel {
    const mapping = this.integration.severityMapping;
    
    for (const [level, values] of Object.entries(mapping)) {
      if (values.includes(sourceSeverity.toLowerCase())) {
        return level as SeverityLevel;
      }
    }
    
    // Default mapping if not found
    return 'medium';
  }

  protected applyFieldMappings(sourceData: any): any {
    const mappedData: any = {};
    
    for (const mapping of this.integration.fieldMappings) {
      const sourceValue = this.getNestedValue(sourceData, mapping.sourceField);
      
      if (sourceValue === undefined && mapping.required && mapping.defaultValue === undefined) {
        throw new Error(`Required field ${mapping.sourceField} is missing`);
      }
      
      const value = sourceValue !== undefined ? sourceValue : mapping.defaultValue;
      
      if (value !== undefined) {
        const transformedValue = this.transformValue(value, mapping);
        this.setNestedValue(mappedData, mapping.targetField, transformedValue);
      }
    }
    
    return mappedData;
  }

  private getNestedValue(obj: any, path: string): any {
    const keys = path.split('.');
    let current = obj;
    
    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        return undefined;
      }
    }
    
    return current;
  }

  private setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    let current = obj;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (key && (!(key in current) || typeof current[key] !== 'object')) {
        current[key] = {};
      }
      if (key) {
        current = current[key];
      }
    }
    
    const lastKey = keys[keys.length - 1];
    if (lastKey) {
      current[lastKey] = value;
    }
  }

  private transformValue(value: any, mapping: FieldMapping): any {
    switch (mapping.transformation) {
      case 'uppercase':
        return String(value).toUpperCase();
      case 'lowercase':
        return String(value).toLowerCase();
      case 'date':
        return new Date(value);
      case 'custom':
        if (mapping.transformFunction) {
          // In a real implementation, this would execute a sandboxed function
          // For security, custom functions should be pre-defined and validated
          return this.executeCustomTransform(value, mapping.transformFunction);
        }
        return value;
      default:
        return value;
    }
  }

  private executeCustomTransform(value: any, functionName: string): any {
    // This is a placeholder for custom transformation execution
    // In production, implement a secure sandboxed execution environment
    console.warn(`Custom transformation ${functionName} not implemented`);
    return value;
  }

  protected async emitEvent(type: string, data: any): Promise<void> {
    const event: SecurityToolEvent = {
      id: this.generateEventId(),
      type: type as any,
      integrationId: this.integration.id,
      timestamp: new Date(),
      data
    };
    
    // In a real implementation, this would emit to an event bus
    console.log('Emitting event:', event);
  }

  protected handleError(error: any): SecurityToolError {
    return {
      code: error.code || 'UNKNOWN_ERROR',
      message: error.message || 'An unknown error occurred',
      toolType: this.integration.type,
      platform: this.integration.platform,
      integrationId: this.integration.id,
      details: error.details || {},
      timestamp: new Date()
    };
  }

  protected generateEventId(): string {
    return `${this.integration.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Utility methods for rate limiting and retries
  protected async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000
  ): Promise<T> {
    let lastError: any;
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        if (i < maxRetries - 1) {
          await this.sleep(delay * Math.pow(2, i)); // Exponential backoff
        }
      }
    }
    
    throw lastError;
  }

  protected async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Rate limiting helper
  private rateLimitMap = new Map<string, number>();
  
  protected async rateLimit(key: string, minInterval: number): Promise<void> {
    const lastCall = this.rateLimitMap.get(key) || 0;
    const now = Date.now();
    const elapsed = now - lastCall;
    
    if (elapsed < minInterval) {
      await this.sleep(minInterval - elapsed);
    }
    
    this.rateLimitMap.set(key, Date.now());
  }
}