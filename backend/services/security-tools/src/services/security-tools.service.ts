import { EventEmitter } from 'events';
import {
  SecurityToolIntegration,
  Vulnerability,
  ScanPolicy,
  ScanResult,
  SeverityLevel
} from '../types/security-tools';
import { SecurityScannerService } from './security-scanner.service';
import { logger } from '../utils/logger';

export class SecurityToolsService extends EventEmitter {
  private integrations: Map<string, SecurityToolIntegration> = new Map();
  private scannerService: SecurityScannerService;

  constructor() {
    super();
    this.scannerService = new SecurityScannerService();
    this.setupEventHandlers();
  }

  async createIntegration(integration: SecurityToolIntegration): Promise<string> {
    try {
      // Generate ID if not provided
      if (!integration.id) {
        integration.id = this.generateIntegrationId();
      }

      // Validate integration
      this.validateIntegration(integration);

      // Store integration
      this.integrations.set(integration.id, integration);

      // Initialize adapter for vulnerability scanners
      if (integration.type === 'vulnerability-scanner') {
        await this.scannerService.initializeAdapter(integration);
      }

      logger.info('Security tool integration created', {
        integrationId: integration.id,
        type: integration.type,
        platform: integration.platform
      });

      this.emit('integration.created', integration);
      return integration.id;
    } catch (error) {
      logger.error('Failed to create security tool integration', {
        error: error instanceof Error ? error.message : String(error),
        integration: integration.name
      });
      throw error;
    }
  }

  async getIntegration(id: string): Promise<SecurityToolIntegration | null> {
    return this.integrations.get(id) || null;
  }

  async getAllIntegrations(): Promise<SecurityToolIntegration[]> {
    return Array.from(this.integrations.values());
  }

  async updateIntegration(id: string, updates: Partial<SecurityToolIntegration>): Promise<void> {
    const integration = this.integrations.get(id);
    
    if (!integration) {
      throw new Error(`Integration ${id} not found`);
    }

    const updatedIntegration = { ...integration, ...updates };
    this.validateIntegration(updatedIntegration);
    
    this.integrations.set(id, updatedIntegration);
    
    logger.info('Security tool integration updated', { integrationId: id });
    this.emit('integration.updated', updatedIntegration);
  }

  async deleteIntegration(id: string): Promise<void> {
    const integration = this.integrations.get(id);
    
    if (!integration) {
      throw new Error(`Integration ${id} not found`);
    }

    // Disconnect adapter if it's a vulnerability scanner
    if (integration.type === 'vulnerability-scanner') {
      await this.scannerService.disconnectAdapter(id);
    }

    this.integrations.delete(id);
    
    logger.info('Security tool integration deleted', { integrationId: id });
    this.emit('integration.deleted', { id });
  }

  async testConnection(id: string): Promise<boolean> {
    const integration = this.integrations.get(id);
    
    if (!integration) {
      throw new Error(`Integration ${id} not found`);
    }

    try {
      if (integration.type === 'vulnerability-scanner') {
        // Test connection by trying to get scan status (dummy test)
        try {
          await this.scannerService.getScanStatus(id, 'test');
          return true;
        } catch {
          return false;
        }
      }
      
      // For other integration types, implement specific connection tests
      return true;
    } catch (error) {
      logger.error('Connection test failed', {
        integrationId: id,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  async syncVulnerabilities(integrationId: string): Promise<Vulnerability[]> {
    const integration = this.integrations.get(integrationId);
    
    if (!integration) {
      throw new Error(`Integration ${integrationId} not found`);
    }

    if (integration.type !== 'vulnerability-scanner') {
      throw new Error('Integration type must be vulnerability-scanner');
    }

    try {
      const vulnerabilities = await this.scannerService.syncVulnerabilities(integrationId);
      
      logger.info('Vulnerability sync completed', {
        integrationId,
        vulnerabilityCount: vulnerabilities.length
      });

      this.emit('vulnerabilities.synced', { integrationId, vulnerabilities });
      return vulnerabilities;
    } catch (error) {
      logger.error('Failed to sync vulnerabilities', {
        integrationId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  async createScan(integrationId: string, policy: ScanPolicy): Promise<string> {
    const integration = this.integrations.get(integrationId);
    
    if (!integration) {
      throw new Error(`Integration ${integrationId} not found`);
    }

    if (integration.type !== 'vulnerability-scanner') {
      throw new Error('Integration type must be vulnerability-scanner');
    }

    try {
      const scanId = await this.scannerService.createScan(integrationId, policy);
      
      logger.info('Scan created', { integrationId, scanId, policyName: policy.name });
      this.emit('scan.created', { integrationId, scanId, policy });
      
      return scanId;
    } catch (error) {
      logger.error('Failed to create scan', {
        integrationId,
        policyName: policy.name,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  async launchScan(integrationId: string, scanId: string): Promise<void> {
    const integration = this.integrations.get(integrationId);
    
    if (!integration) {
      throw new Error(`Integration ${integrationId} not found`);
    }

    if (integration.type !== 'vulnerability-scanner') {
      throw new Error('Integration type must be vulnerability-scanner');
    }

    try {
      await this.scannerService.launchScan(integrationId, scanId);
      
      logger.info('Scan launched', { integrationId, scanId });
      this.emit('scan.launched', { integrationId, scanId });
    } catch (error) {
      logger.error('Failed to launch scan', {
        integrationId,
        scanId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  async getScanStatus(integrationId: string, scanId: string): Promise<any> {
    const integration = this.integrations.get(integrationId);
    
    if (!integration) {
      throw new Error(`Integration ${integrationId} not found`);
    }

    if (integration.type !== 'vulnerability-scanner') {
      throw new Error('Integration type must be vulnerability-scanner');
    }

    return await this.scannerService.getScanStatus(integrationId, scanId);
  }

  async getActiveScans(): Promise<any[]> {
    return this.scannerService.getActiveScans();
  }

  async exportScanResults(integrationId: string, scanId: string, format: string = 'pdf'): Promise<string> {
    const integration = this.integrations.get(integrationId);
    
    if (!integration) {
      throw new Error(`Integration ${integrationId} not found`);
    }

    if (integration.type !== 'vulnerability-scanner') {
      throw new Error('Integration type must be vulnerability-scanner');
    }

    return await this.scannerService.exportScanResults(integrationId, scanId, format);
  }

  async getAvailablePolicies(integrationId: string): Promise<any[]> {
    const integration = this.integrations.get(integrationId);
    
    if (!integration) {
      throw new Error(`Integration ${integrationId} not found`);
    }

    if (integration.type !== 'vulnerability-scanner') {
      throw new Error('Integration type must be vulnerability-scanner');
    }

    return await this.scannerService.getAvailablePolicies(integrationId);
  }

  private validateIntegration(integration: SecurityToolIntegration): void {
    if (!integration.name || !integration.type || !integration.platform) {
      throw new Error('Missing required integration fields');
    }

    if (!integration.connectionConfig) {
      throw new Error('Connection configuration is required');
    }

    // Validate connection config
    const { endpoint, credentials } = integration.connectionConfig;
    
    if (!endpoint) {
      throw new Error('Endpoint is required in connection configuration');
    }

    if (!credentials || !credentials.username) {
      throw new Error('Credentials are required in connection configuration');
    }
  }

  private generateIntegrationId(): string {
    return `integration-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private setupEventHandlers(): void {
    // Forward scanner service events
    this.scannerService.on('vulnerability.discovered', (data) => {
      this.emit('vulnerability.discovered', data);
    });

    this.scannerService.on('scan.completed', (data) => {
      this.emit('scan.completed', data);
    });

    this.scannerService.on('scan.failed', (data) => {
      this.emit('scan.failed', data);
    });
  }
}