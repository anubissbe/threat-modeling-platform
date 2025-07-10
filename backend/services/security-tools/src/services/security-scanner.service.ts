import { EventEmitter } from 'events';
import {
  SecurityToolIntegration,
  Vulnerability,
  ScanPolicy,
  ScanResult,
  SeverityLevel,
  ScanStatus
} from '../types/security-tools';
import { NessusAdapter } from '../adapters/vulnerability/nessus.adapter';
import { BaseSecurityToolAdapter } from '../adapters/base.adapter';
import { logger } from '../utils/logger';

export class SecurityScannerService extends EventEmitter {
  private adapters: Map<string, BaseSecurityToolAdapter> = new Map();
  private activeScans: Map<string, ScanStatus> = new Map();

  constructor() {
    super();
    this.setupEventHandlers();
  }

  async initializeAdapter(integration: SecurityToolIntegration): Promise<void> {
    try {
      let adapter: BaseSecurityToolAdapter;

      switch (integration.platform) {
        case 'nessus':
          adapter = new NessusAdapter(integration);
          break;
        case 'qualys':
          // adapter = new QualysAdapter(integration);
          throw new Error('Qualys adapter not yet implemented');
        case 'rapid7':
          // adapter = new Rapid7Adapter(integration);
          throw new Error('Rapid7 adapter not yet implemented');
        case 'openvas':
          // adapter = new OpenVASAdapter(integration);
          throw new Error('OpenVAS adapter not yet implemented');
        default:
          throw new Error(`Unsupported scanner platform: ${integration.platform}`);
      }

      // Test connection
      await adapter.connect();
      const isHealthy = await adapter.testConnection();
      
      if (!isHealthy) {
        throw new Error(`Health check failed for ${integration.platform} adapter`);
      }

      this.adapters.set(integration.id, adapter);
      
      logger.info(`Security scanner adapter initialized successfully`, {
        integrationId: integration.id,
        platform: integration.platform
      });

      this.emit('adapter.initialized', { integrationId: integration.id });
    } catch (error) {
      logger.error(`Failed to initialize security scanner adapter`, {
        integrationId: integration.id,
        platform: integration.platform,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  async createScan(integrationId: string, policy: ScanPolicy): Promise<string> {
    const adapter = this.getAdapter(integrationId);
    
    if (!('createScan' in adapter)) {
      throw new Error('Adapter does not support scan creation');
    }

    try {
      const scanId = await (adapter as any).createScan(policy);
      
      this.activeScans.set(scanId, {
        id: scanId,
        integrationId,
        policy,
        status: 'created',
        createdAt: new Date(),
        progress: 0
      });

      logger.info(`Scan created successfully`, {
        scanId,
        integrationId,
        policyName: policy.name
      });

      this.emit('scan.created', { scanId, integrationId, policy });
      return scanId;
    } catch (error) {
      logger.error(`Failed to create scan`, {
        integrationId,
        policyName: policy.name,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  async launchScan(integrationId: string, scanId: string): Promise<void> {
    const adapter = this.getAdapter(integrationId);
    
    if (!('launchScan' in adapter)) {
      throw new Error('Adapter does not support scan launching');
    }

    try {
      await (adapter as any).launchScan(scanId);
      
      // Update scan status
      const scanStatus = this.activeScans.get(scanId);
      if (scanStatus) {
        scanStatus.status = 'running';
        scanStatus.startedAt = new Date();
        this.activeScans.set(scanId, scanStatus);
      }

      logger.info(`Scan launched successfully`, { scanId, integrationId });
      this.emit('scan.launched', { scanId, integrationId });

      // Start monitoring scan progress
      this.monitorScanProgress(integrationId, scanId);
    } catch (error) {
      logger.error(`Failed to launch scan`, {
        scanId,
        integrationId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  async getScanStatus(integrationId: string, scanId: string): Promise<ScanStatus> {
    const adapter = this.getAdapter(integrationId);
    
    try {
      let status: string;
      
      if ('getScanStatus' in adapter) {
        status = await (adapter as any).getScanStatus(scanId);
      } else {
        // Fallback to cached status
        const cachedStatus = this.activeScans.get(scanId);
        return cachedStatus || {
          id: scanId,
          integrationId,
          status: 'unknown',
          createdAt: new Date(),
          progress: 0
        };
      }

      // Update cached status
      const scanStatus = this.activeScans.get(scanId);
      if (scanStatus) {
        scanStatus.status = this.normalizeStatus(status);
        if (scanStatus.status === 'completed') {
          scanStatus.completedAt = new Date();
          scanStatus.progress = 100;
        }
        this.activeScans.set(scanId, scanStatus);
        return scanStatus;
      }

      return {
        id: scanId,
        integrationId,
        status: this.normalizeStatus(status),
        createdAt: new Date(),
        progress: this.calculateProgress(status)
      };
    } catch (error) {
      logger.error(`Failed to get scan status`, {
        scanId,
        integrationId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  async syncVulnerabilities(integrationId: string): Promise<Vulnerability[]> {
    const adapter = this.getAdapter(integrationId);
    const vulnerabilities: Vulnerability[] = [];

    try {
      // Set up event listener to collect vulnerabilities
      const vulnerabilityHandler = (event: any) => {
        if (event.vulnerability) {
          vulnerabilities.push(event.vulnerability);
        }
      };

      // Listen for vulnerability discovery events
      this.on('vulnerability.discovered', vulnerabilityHandler);

      // Perform sync
      await adapter.sync();

      // Remove event listener
      this.off('vulnerability.discovered', vulnerabilityHandler);

      logger.info(`Vulnerability sync completed`, {
        integrationId,
        vulnerabilityCount: vulnerabilities.length
      });

      this.emit('sync.completed', { integrationId, vulnerabilities });
      return vulnerabilities;
    } catch (error) {
      logger.error(`Failed to sync vulnerabilities`, {
        integrationId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  async exportScanResults(integrationId: string, scanId: string, format: string = 'pdf'): Promise<string> {
    const adapter = this.getAdapter(integrationId);
    
    if (!('exportScan' in adapter)) {
      throw new Error('Adapter does not support scan export');
    }

    try {
      const exportData = await (adapter as any).exportScan(scanId, format);
      
      logger.info(`Scan export completed`, {
        scanId,
        integrationId,
        format
      });

      this.emit('scan.exported', { scanId, integrationId, format });
      return exportData;
    } catch (error) {
      logger.error(`Failed to export scan results`, {
        scanId,
        integrationId,
        format,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  async getAvailablePolicies(integrationId: string): Promise<any[]> {
    const adapter = this.getAdapter(integrationId);
    
    if (!('getPluginFamilies' in adapter)) {
      // Return default policies if adapter doesn't support policy enumeration
      return this.getDefaultScanPolicies();
    }

    try {
      const families = await (adapter as any).getPluginFamilies();
      
      return families.map((family: any) => ({
        id: family.id,
        name: family.name,
        description: `Scan policy for ${family.name}`,
        category: family.name,
        targets: [],
        scanType: family.name
      }));
    } catch (error) {
      logger.error(`Failed to get available policies`, {
        integrationId,
        error: error instanceof Error ? error.message : String(error)
      });
      return this.getDefaultScanPolicies();
    }
  }

  async disconnectAdapter(integrationId: string): Promise<void> {
    const adapter = this.adapters.get(integrationId);
    
    if (adapter) {
      try {
        await adapter.disconnect();
        this.adapters.delete(integrationId);
        
        logger.info(`Security scanner adapter disconnected`, { integrationId });
        this.emit('adapter.disconnected', { integrationId });
      } catch (error) {
        logger.error(`Failed to disconnect adapter`, {
          integrationId,
          error: error instanceof Error ? error.message : String(error)
        });
        throw error;
      }
    }
  }

  getActiveScans(): ScanStatus[] {
    return Array.from(this.activeScans.values());
  }

  private getAdapter(integrationId: string): BaseSecurityToolAdapter {
    const adapter = this.adapters.get(integrationId);
    if (!adapter) {
      throw new Error(`No adapter found for integration: ${integrationId}`);
    }
    return adapter;
  }

  private async monitorScanProgress(integrationId: string, scanId: string): Promise<void> {
    const maxChecks = 1440; // 24 hours at 1-minute intervals
    let checks = 0;
    
    const checkProgress = async () => {
      try {
        if (checks >= maxChecks) {
          logger.warn(`Scan monitoring timeout reached`, { scanId, integrationId });
          return;
        }

        const status = await this.getScanStatus(integrationId, scanId);
        
        if (status.status === 'completed' || status.status === 'failed' || status.status === 'cancelled') {
          logger.info(`Scan monitoring completed`, {
            scanId,
            integrationId,
            finalStatus: status.status
          });
          
          this.emit('scan.completed', { scanId, integrationId, status });
          return;
        }

        checks++;
        
        // Continue monitoring
        setTimeout(checkProgress, 60000); // Check every minute
      } catch (error) {
        logger.error(`Error monitoring scan progress`, {
          scanId,
          integrationId,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    };

    // Start monitoring after initial delay
    setTimeout(checkProgress, 60000);
  }

  private normalizeStatus(status: string): string {
    const statusMap: { [key: string]: string } = {
      'running': 'running',
      'completed': 'completed',
      'aborted': 'failed',
      'cancelled': 'cancelled',
      'paused': 'paused',
      'resuming': 'running',
      'stopping': 'stopping',
      'imported': 'completed'
    };

    return statusMap[status.toLowerCase()] || status.toLowerCase();
  }

  private calculateProgress(status: string): number {
    const progressMap: { [key: string]: number } = {
      'created': 0,
      'running': 50,
      'completed': 100,
      'failed': 0,
      'cancelled': 0,
      'paused': 25
    };

    return progressMap[this.normalizeStatus(status)] || 0;
  }

  private getDefaultScanPolicies(): any[] {
    return [
      {
        id: 'basic-network-scan',
        name: 'Basic Network Scan',
        description: 'Basic vulnerability scan for network services',
        category: 'Network',
        scanType: 'basic',
        targets: []
      },
      {
        id: 'web-application-scan',
        name: 'Web Application Scan',
        description: 'Comprehensive web application security scan',
        category: 'Web Application',
        scanType: 'web',
        targets: []
      },
      {
        id: 'compliance-scan',
        name: 'Compliance Scan',
        description: 'Security compliance assessment',
        category: 'Compliance',
        scanType: 'compliance',
        targets: []
      },
      {
        id: 'malware-scan',
        name: 'Malware Detection',
        description: 'Malware and backdoor detection scan',
        category: 'Malware',
        scanType: 'malware',
        targets: []
      }
    ];
  }

  private setupEventHandlers(): void {
    this.on('vulnerability.discovered', (data) => {
      logger.debug('Vulnerability discovered', {
        integrationId: data.integrationId,
        vulnerabilityId: data.vulnerability?.id
      });
    });

    this.on('scan.completed', (data) => {
      // Clean up completed scans from active scans map
      this.activeScans.delete(data.scanId);
    });
  }
}