import axios from 'axios';
import { config } from '../config';
import { logger, serviceLogger } from '../utils/logger';
import {
  ServiceConfig,
  ServiceHealth,
  ServiceStatus,
  ServiceRegistry,
  HealthCheckResult,
  SystemHealthResult,
} from '../types';

export class ServiceDiscovery {
  private registry: ServiceRegistry;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private isShuttingDown = false;

  constructor() {
    this.registry = {
      services: new Map(),
      healthChecks: new Map(),
    };

    this.initializeServices();
  }

  /**
   * Initialize default services from configuration
   */
  private initializeServices(): void {
    const services: ServiceConfig[] = [
      {
        name: 'auth-service',
        url: config.AUTH_SERVICE_URL,
        healthPath: '/health',
        timeout: 5000,
        retries: 3,
        prefix: '/api/auth',
      },
      {
        name: 'user-service',
        url: config.USER_SERVICE_URL,
        healthPath: '/health',
        timeout: 5000,
        retries: 3,
        prefix: '/api/users',
      },
      {
        name: 'project-service',
        url: config.PROJECT_SERVICE_URL,
        healthPath: '/health',
        timeout: 5000,
        retries: 3,
        prefix: '/api/projects',
      },
      {
        name: 'threat-engine',
        url: config.THREAT_ENGINE_URL,
        healthPath: '/health',
        timeout: 5000,
        retries: 3,
        prefix: '/api/threats',
      },
    ];

    for (const service of services) {
      this.registerService(service);
    }

    serviceLogger.configurationLoaded(services.length, 0);

    // Start health checking if enabled
    if (config.SERVICE_DISCOVERY_ENABLED) {
      this.startHealthChecking();
    }
  }

  /**
   * Register a new service
   */
  registerService(serviceConfig: ServiceConfig): void {
    this.registry.services.set(serviceConfig.name, serviceConfig);
    
    // Initialize health status as unknown
    this.registry.healthChecks.set(serviceConfig.name, {
      name: serviceConfig.name,
      status: ServiceStatus.UNKNOWN,
      url: serviceConfig.url,
      lastCheck: new Date(),
    });

    serviceLogger.serviceDiscoveryUpdate('register', serviceConfig.name, {
      url: serviceConfig.url,
      healthPath: serviceConfig.healthPath,
    });

    logger.info(`Service registered: ${serviceConfig.name} at ${serviceConfig.url}`);
  }

  /**
   * Unregister a service
   */
  unregisterService(serviceName: string): boolean {
    const removed = this.registry.services.delete(serviceName);
    this.registry.healthChecks.delete(serviceName);

    if (removed) {
      serviceLogger.serviceDiscoveryUpdate('unregister', serviceName);
      logger.info(`Service unregistered: ${serviceName}`);
    }

    return removed;
  }

  /**
   * Get service configuration
   */
  getService(serviceName: string): ServiceConfig | undefined {
    return this.registry.services.get(serviceName);
  }

  /**
   * Get all registered services
   */
  getAllServices(): ServiceConfig[] {
    return Array.from(this.registry.services.values());
  }

  /**
   * Get service health status
   */
  getServiceHealth(serviceName: string): ServiceHealth | undefined {
    return this.registry.healthChecks.get(serviceName);
  }

  /**
   * Get health status for all services
   */
  getAllServiceHealth(): ServiceHealth[] {
    return Array.from(this.registry.healthChecks.values());
  }

  /**
   * Check if a service is healthy
   */
  isServiceHealthy(serviceName: string): boolean {
    const health = this.getServiceHealth(serviceName);
    return health?.status === ServiceStatus.HEALTHY;
  }

  /**
   * Get healthy services only
   */
  getHealthyServices(): ServiceConfig[] {
    return this.getAllServices().filter(service => 
      this.isServiceHealthy(service.name)
    );
  }

  /**
   * Perform health check for a specific service
   */
  async checkServiceHealth(serviceName: string): Promise<ServiceHealth> {
    const service = this.getService(serviceName);
    if (!service) {
      throw new Error(`Service not found: ${serviceName}`);
    }

    const startTime = Date.now();
    let health: ServiceHealth;

    try {
      const response = await axios.get(
        `${service.url}${service.healthPath}`,
        {
          timeout: service.timeout,
          validateStatus: (status) => status < 500, // Accept 4xx as potentially healthy
        }
      );

      const responseTime = Date.now() - startTime;
      const isHealthy = response.status >= 200 && response.status < 400;

      health = {
        name: serviceName,
        status: isHealthy ? ServiceStatus.HEALTHY : ServiceStatus.DEGRADED,
        url: service.url,
        lastCheck: new Date(),
        responseTime,
        version: response.data?.version,
        uptime: response.data?.uptime,
      };

      if (isHealthy) {
        serviceLogger.serviceUp(serviceName, service.url, responseTime);
      } else {
        serviceLogger.serviceDown(serviceName, service.url, `Status: ${response.status}`);
      }

    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      
      health = {
        name: serviceName,
        status: ServiceStatus.UNHEALTHY,
        url: service.url,
        lastCheck: new Date(),
        responseTime,
        error: error.message,
      };

      serviceLogger.serviceDown(serviceName, service.url, error.message);
    }

    // Update registry
    this.registry.healthChecks.set(serviceName, health);
    serviceLogger.healthCheckPerformed(serviceName, health.status, health.responseTime || 0);

    return health;
  }

  /**
   * Perform health checks for all services
   */
  async checkAllServicesHealth(): Promise<ServiceHealth[]> {
    const services = this.getAllServices();
    const healthPromises = services.map(service => 
      this.checkServiceHealth(service.name).catch(error => {
        logger.error(`Health check failed for ${service.name}:`, error);
        return {
          name: service.name,
          status: ServiceStatus.UNHEALTHY,
          url: service.url,
          lastCheck: new Date(),
          error: error.message,
        } as ServiceHealth;
      })
    );

    return Promise.all(healthPromises);
  }

  /**
   * Get comprehensive system health
   */
  async getSystemHealth(): Promise<SystemHealthResult> {
    const services = await this.checkAllServicesHealth();
    
    const healthyCount = services.filter(s => s.status === ServiceStatus.HEALTHY).length;
    const totalCount = services.length;
    
    let systemStatus: ServiceStatus;
    if (healthyCount === totalCount) {
      systemStatus = ServiceStatus.HEALTHY;
    } else if (healthyCount === 0) {
      systemStatus = ServiceStatus.UNHEALTHY;
    } else {
      systemStatus = ServiceStatus.DEGRADED;
    }

    const healthCheckResults: HealthCheckResult[] = services.map(service => ({
      service: service.name,
      status: service.status,
      responseTime: service.responseTime || 0,
      timestamp: service.lastCheck,
      checks: [
        {
          name: 'connectivity',
          status: service.status,
          message: service.error || 'OK',
        },
      ],
    }));

    return {
      status: systemStatus,
      timestamp: new Date(),
      services: healthCheckResults,
      metrics: {
        totalRequests: 0, // Would be populated by metrics service
        totalErrors: 0,
        averageResponseTime: services.reduce((sum, s) => sum + (s.responseTime || 0), 0) / services.length,
        servicesUp: healthyCount,
        servicesDown: totalCount - healthyCount,
        uptime: process.uptime(),
      },
      version: '1.0.0',
    };
  }

  /**
   * Start periodic health checking
   */
  startHealthChecking(): void {
    if (this.healthCheckInterval) {
      return; // Already started
    }

    logger.info(`Starting health checks every ${config.HEALTH_CHECK_INTERVAL}ms`);
    
    this.healthCheckInterval = setInterval(async () => {
      if (this.isShuttingDown) return;

      try {
        await this.checkAllServicesHealth();
      } catch (error) {
        logger.error('Error during health check cycle:', error);
      }
    }, config.HEALTH_CHECK_INTERVAL);

    // Perform initial health check
    this.checkAllServicesHealth().catch(error => {
      logger.error('Initial health check failed:', error);
    });
  }

  /**
   * Stop health checking
   */
  stopHealthChecking(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
      logger.info('Health checking stopped');
    }
  }

  /**
   * Get service by prefix for routing
   */
  getServiceByPrefix(prefix: string): ServiceConfig | undefined {
    for (const service of this.registry.services.values()) {
      if (prefix.startsWith(service.prefix)) {
        return service;
      }
    }
    return undefined;
  }

  /**
   * Wait for service to become healthy
   */
  async waitForService(serviceName: string, timeoutMs: number = 30000): Promise<boolean> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      const health = await this.checkServiceHealth(serviceName);
      if (health.status === ServiceStatus.HEALTHY) {
        return true;
      }
      
      // Wait before next check
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    return false;
  }

  /**
   * Wait for all services to become healthy
   */
  async waitForAllServices(timeoutMs: number = 60000): Promise<boolean> {
    const services = this.getAllServices();
    const promises = services.map(service => 
      this.waitForService(service.name, timeoutMs)
    );
    
    const results = await Promise.all(promises);
    return results.every(result => result);
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    this.isShuttingDown = true;
    this.stopHealthChecking();
    
    // Clear registry
    this.registry.services.clear();
    this.registry.healthChecks.clear();
    
    logger.info('Service discovery shutdown complete');
  }
}