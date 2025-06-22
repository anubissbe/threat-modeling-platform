import { logger, serviceLogger } from '../utils/logger';
import { ServiceDiscovery } from './service-discovery';
import {
  LoadBalancingStrategy,
  LoadBalancerConfig,
  ServiceConfig,
} from '../types';

interface ServiceInstance {
  id: string;
  service: ServiceConfig;
  weight: number;
  connections: number;
  lastUsed: Date;
}

export class LoadBalancer {
  private serviceDiscovery: ServiceDiscovery;
  private config: LoadBalancerConfig;
  private instances: Map<string, ServiceInstance[]> = new Map();
  private roundRobinCounters: Map<string, number> = new Map();

  constructor(serviceDiscovery: ServiceDiscovery, config?: LoadBalancerConfig) {
    this.serviceDiscovery = serviceDiscovery;
    this.config = config || {
      strategy: LoadBalancingStrategy.ROUND_ROBIN,
      healthCheckEnabled: true,
      healthCheckInterval: 30000,
    };

    this.initializeInstances();
  }

  /**
   * Initialize service instances
   */
  private initializeInstances(): void {
    const services = this.serviceDiscovery.getAllServices();
    
    for (const service of services) {
      this.addServiceInstance(service.name, service);
    }

    logger.info(`Load balancer initialized with ${services.length} services`);
  }

  /**
   * Add a service instance
   */
  addServiceInstance(serviceName: string, service: ServiceConfig, weight: number = 1): void {
    if (!this.instances.has(serviceName)) {
      this.instances.set(serviceName, []);
    }

    const instances = this.instances.get(serviceName)!;
    const instance: ServiceInstance = {
      id: `${serviceName}-${instances.length}`,
      service,
      weight,
      connections: 0,
      lastUsed: new Date(),
    };

    instances.push(instance);
    logger.debug(`Service instance added: ${instance.id}`);
  }

  /**
   * Remove a service instance
   */
  removeServiceInstance(serviceName: string, instanceId: string): boolean {
    const instances = this.instances.get(serviceName);
    if (!instances) return false;

    const initialLength = instances.length;
    const filteredInstances = instances.filter(instance => instance.id !== instanceId);
    
    if (filteredInstances.length < initialLength) {
      this.instances.set(serviceName, filteredInstances);
      logger.debug(`Service instance removed: ${instanceId}`);
      return true;
    }

    return false;
  }

  /**
   * Get the best available instance for a service
   */
  getInstance(serviceName: string): ServiceConfig | null {
    const instances = this.getHealthyInstances(serviceName);
    
    if (instances.length === 0) {
      logger.warn(`No healthy instances available for service: ${serviceName}`);
      return null;
    }

    let selectedInstance: ServiceInstance | undefined;

    switch (this.config.strategy) {
      case LoadBalancingStrategy.ROUND_ROBIN:
        selectedInstance = this.selectRoundRobin(serviceName, instances);
        break;
      case LoadBalancingStrategy.LEAST_CONNECTIONS:
        selectedInstance = this.selectLeastConnections(instances);
        break;
      case LoadBalancingStrategy.WEIGHTED:
        selectedInstance = this.selectWeighted(instances);
        break;
      default:
        selectedInstance = instances[0];
    }

    if (!selectedInstance) {
      logger.warn(`No instance selected for service: ${serviceName}`);
      return null;
    }

    // Update instance usage
    selectedInstance.connections++;
    selectedInstance.lastUsed = new Date();

    serviceLogger.loadBalancerAction(
      serviceName,
      this.config.strategy,
      selectedInstance.id
    );

    logger.debug(`Selected instance: ${selectedInstance.id} for service: ${serviceName}`);
    return selectedInstance.service;
  }

  /**
   * Release a connection from an instance
   */
  releaseConnection(serviceName: string, serviceConfig: ServiceConfig): void {
    const instances = this.instances.get(serviceName);
    if (!instances) return;

    const instance = instances.find(inst => inst.service.url === serviceConfig.url);
    if (instance && instance.connections > 0) {
      instance.connections--;
      logger.debug(`Connection released for instance: ${instance.id}`);
    }
  }

  /**
   * Get healthy instances for a service
   */
  private getHealthyInstances(serviceName: string): ServiceInstance[] {
    const instances = this.instances.get(serviceName) || [];
    
    if (!this.config.healthCheckEnabled) {
      return instances;
    }

    return instances.filter(instance => {
      const isHealthy = this.serviceDiscovery.isServiceHealthy(serviceName);
      return isHealthy;
    });
  }

  /**
   * Round-robin selection
   */
  private selectRoundRobin(serviceName: string, instances: ServiceInstance[]): ServiceInstance | undefined {
    if (instances.length === 0) {
      return undefined;
    }
    
    let counter = this.roundRobinCounters.get(serviceName) || 0;
    const selectedInstance = instances[counter % instances.length];
    
    this.roundRobinCounters.set(serviceName, counter + 1);
    return selectedInstance;
  }

  /**
   * Least connections selection
   */
  private selectLeastConnections(instances: ServiceInstance[]): ServiceInstance | undefined {
    if (instances.length === 0) {
      return undefined;
    }
    
    return instances.reduce((least, current) => {
      return current.connections < least.connections ? current : least;
    });
  }

  /**
   * Weighted selection
   */
  private selectWeighted(instances: ServiceInstance[]): ServiceInstance | undefined {
    if (instances.length === 0) {
      return undefined;
    }

    const totalWeight = instances.reduce((sum, instance) => sum + instance.weight, 0);
    let random = Math.random() * totalWeight;

    for (const instance of instances) {
      random -= instance.weight;
      if (random <= 0) {
        return instance;
      }
    }

    // Fallback to first instance
    return instances[0];
  }

  /**
   * Set load balancing strategy
   */
  setStrategy(strategy: LoadBalancingStrategy): void {
    this.config.strategy = strategy;
    logger.info(`Load balancing strategy changed to: ${strategy}`);
  }

  /**
   * Get current strategy
   */
  getStrategy(): LoadBalancingStrategy {
    return this.config.strategy;
  }

  /**
   * Get instance statistics for a service
   */
  getServiceStats(serviceName: string): {
    totalInstances: number;
    healthyInstances: number;
    totalConnections: number;
    averageConnections: number;
  } | null {
    const instances = this.instances.get(serviceName);
    if (!instances) return null;

    const healthyInstances = this.getHealthyInstances(serviceName);
    const totalConnections = instances.reduce((sum, inst) => sum + inst.connections, 0);

    return {
      totalInstances: instances.length,
      healthyInstances: healthyInstances.length,
      totalConnections,
      averageConnections: instances.length > 0 ? totalConnections / instances.length : 0,
    };
  }

  /**
   * Get all load balancer statistics
   */
  getAllStats(): {
    strategy: LoadBalancingStrategy;
    totalServices: number;
    totalInstances: number;
    healthyInstances: number;
    totalConnections: number;
    serviceStats: Map<string, any>;
  } {
    const serviceStats = new Map();
    let totalInstances = 0;
    let healthyInstances = 0;
    let totalConnections = 0;

    for (const [serviceName] of this.instances) {
      const stats = this.getServiceStats(serviceName);
      if (stats) {
        serviceStats.set(serviceName, stats);
        totalInstances += stats.totalInstances;
        healthyInstances += stats.healthyInstances;
        totalConnections += stats.totalConnections;
      }
    }

    return {
      strategy: this.config.strategy,
      totalServices: this.instances.size,
      totalInstances,
      healthyInstances,
      totalConnections,
      serviceStats,
    };
  }

  /**
   * Update service instance weight
   */
  updateInstanceWeight(serviceName: string, instanceId: string, weight: number): boolean {
    const instances = this.instances.get(serviceName);
    if (!instances) return false;

    const instance = instances.find(inst => inst.id === instanceId);
    if (instance) {
      instance.weight = weight;
      logger.debug(`Updated weight for instance ${instanceId}: ${weight}`);
      return true;
    }

    return false;
  }

  /**
   * Get instance details for a service
   */
  getInstanceDetails(serviceName: string): ServiceInstance[] {
    return this.instances.get(serviceName) || [];
  }

  /**
   * Reset connection counts (useful for testing or maintenance)
   */
  resetConnections(serviceName?: string): void {
    if (serviceName) {
      const instances = this.instances.get(serviceName);
      if (instances) {
        instances.forEach(instance => {
          instance.connections = 0;
        });
        logger.debug(`Reset connections for service: ${serviceName}`);
      }
    } else {
      for (const instances of this.instances.values()) {
        instances.forEach(instance => {
          instance.connections = 0;
        });
      }
      logger.debug('Reset connections for all services');
    }
  }

  /**
   * Check if a service has available capacity
   */
  hasCapacity(serviceName: string, maxConnectionsPerInstance: number = 100): boolean {
    const instances = this.getHealthyInstances(serviceName);
    
    return instances.some(instance => instance.connections < maxConnectionsPerInstance);
  }

  /**
   * Get least loaded instance (for debugging/monitoring)
   */
  getLeastLoadedInstance(serviceName: string): ServiceInstance | null {
    const instances = this.getHealthyInstances(serviceName);
    
    if (instances.length === 0) return null;
    
    return this.selectLeastConnections(instances) || null;
  }

  /**
   * Get most loaded instance (for debugging/monitoring)
   */
  getMostLoadedInstance(serviceName: string): ServiceInstance | null {
    const instances = this.getHealthyInstances(serviceName);
    
    if (instances.length === 0) return null;
    
    return instances.reduce((most, current) => {
      return current.connections > most.connections ? current : most;
    });
  }

  /**
   * Shutdown and cleanup
   */
  shutdown(): void {
    this.instances.clear();
    this.roundRobinCounters.clear();
    logger.info('Load balancer shutdown complete');
  }
}