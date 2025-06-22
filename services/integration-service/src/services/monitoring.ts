import { logger, serviceLogger } from '../utils/logger';
import { ServiceDiscovery } from './service-discovery';
import { CircuitBreaker } from './circuit-breaker';
import { LoadBalancer } from './load-balancer';
import {
  ServiceMetrics,
  SystemMetrics,
  ServiceEvent,
  ServiceEventType,
} from '../types';

export class MonitoringService {
  private serviceDiscovery: ServiceDiscovery;
  private circuitBreaker: CircuitBreaker;
  private loadBalancer: LoadBalancer;
  private metrics: Map<string, ServiceMetrics> = new Map();
  private systemStartTime: Date = new Date();
  private monitoringInterval: NodeJS.Timeout | null = null;
  private eventListeners: Map<ServiceEventType, ((event: ServiceEvent) => void)[]> = new Map();

  constructor(
    serviceDiscovery: ServiceDiscovery,
    circuitBreaker: CircuitBreaker,
    loadBalancer: LoadBalancer
  ) {
    this.serviceDiscovery = serviceDiscovery;
    this.circuitBreaker = circuitBreaker;
    this.loadBalancer = loadBalancer;
    this.initializeMetrics();
  }

  /**
   * Initialize metrics for all services
   */
  private initializeMetrics(): void {
    const services = this.serviceDiscovery.getAllServices();
    
    for (const service of services) {
      this.metrics.set(service.name, {
        serviceName: service.name,
        requestCount: 0,
        errorCount: 0,
        averageResponseTime: 0,
        lastRequestTime: new Date(),
        uptime: 0,
      });
    }

    logger.info(`Monitoring initialized for ${services.length} services`);
  }

  /**
   * Start monitoring services
   */
  startMonitoring(intervalMs: number = 60000): void {
    if (this.monitoringInterval) {
      return; // Already started
    }

    logger.info(`Starting monitoring with ${intervalMs}ms interval`);
    
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
      this.checkAlerts();
    }, intervalMs);

    // Initial collection
    this.collectMetrics();
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      logger.info('Monitoring stopped');
    }
  }

  /**
   * Record a successful request
   */
  recordRequest(serviceName: string, responseTime: number): void {
    const metrics = this.getOrCreateMetrics(serviceName);
    
    metrics.requestCount++;
    metrics.lastRequestTime = new Date();
    
    // Update average response time (exponential moving average)
    const alpha = 0.1; // Smoothing factor
    metrics.averageResponseTime = 
      (alpha * responseTime) + ((1 - alpha) * metrics.averageResponseTime);

    this.metrics.set(serviceName, metrics);
  }

  /**
   * Record a failed request
   */
  recordError(serviceName: string, responseTime?: number): void {
    const metrics = this.getOrCreateMetrics(serviceName);
    
    metrics.requestCount++;
    metrics.errorCount++;
    metrics.lastRequestTime = new Date();
    
    if (responseTime !== undefined) {
      const alpha = 0.1;
      metrics.averageResponseTime = 
        (alpha * responseTime) + ((1 - alpha) * metrics.averageResponseTime);
    }

    this.metrics.set(serviceName, metrics);
    
    // Emit error event
    this.emitEvent({
      type: ServiceEventType.HIGH_ERROR_RATE,
      serviceName,
      timestamp: new Date(),
      data: { errorCount: metrics.errorCount, requestCount: metrics.requestCount },
    });
  }

  /**
   * Get metrics for a specific service
   */
  getServiceMetrics(serviceName: string): ServiceMetrics | undefined {
    return this.metrics.get(serviceName);
  }

  /**
   * Get metrics for all services
   */
  getAllServiceMetrics(): ServiceMetrics[] {
    return Array.from(this.metrics.values());
  }

  /**
   * Get system-wide metrics
   */
  getSystemMetrics(): SystemMetrics {
    const allMetrics = this.getAllServiceMetrics();
    
    const totalRequests = allMetrics.reduce((sum, m) => sum + m.requestCount, 0);
    const totalErrors = allMetrics.reduce((sum, m) => sum + m.errorCount, 0);
    const avgResponseTime = allMetrics.length > 0
      ? allMetrics.reduce((sum, m) => sum + m.averageResponseTime, 0) / allMetrics.length
      : 0;

    const healthyServices = this.serviceDiscovery.getHealthyServices().length;
    const totalServices = this.serviceDiscovery.getAllServices().length;

    return {
      totalRequests,
      totalErrors,
      averageResponseTime: Math.round(avgResponseTime),
      servicesUp: healthyServices,
      servicesDown: totalServices - healthyServices,
      uptime: Math.round((Date.now() - this.systemStartTime.getTime()) / 1000),
    };
  }

  /**
   * Collect current metrics from all services
   */
  private async collectMetrics(): Promise<void> {
    try {
      // Update service health metrics
      const healthChecks = await this.serviceDiscovery.checkAllServicesHealth();
      
      for (const health of healthChecks) {
        const metrics = this.getOrCreateMetrics(health.name);
        
        // Update uptime based on health status
        if (health.status === 'healthy') {
          metrics.uptime = Date.now() - this.systemStartTime.getTime();
        }
        
        this.metrics.set(health.name, metrics);
      }

      // Get system metrics
      const systemMetrics = this.getSystemMetrics();
      
      serviceLogger.metricsCollected(
        systemMetrics.totalRequests,
        systemMetrics.totalErrors / Math.max(systemMetrics.totalRequests, 1),
        systemMetrics.averageResponseTime
      );

    } catch (error) {
      logger.error('Error collecting metrics:', error);
    }
  }

  /**
   * Check for alerts and emit events
   */
  private checkAlerts(): void {
    const systemMetrics = this.getSystemMetrics();
    
    // Check error rate alert
    const errorRate = systemMetrics.totalErrors / Math.max(systemMetrics.totalRequests, 1);
    if (errorRate > 0.1) { // 10% error rate threshold
      serviceLogger.performanceAlert('error_rate', errorRate, 0.1);
    }

    // Check response time alert
    if (systemMetrics.averageResponseTime > 5000) { // 5 second threshold
      serviceLogger.performanceAlert('response_time', systemMetrics.averageResponseTime, 5000);
    }

    // Check individual service metrics
    for (const metrics of this.getAllServiceMetrics()) {
      const serviceErrorRate = metrics.errorCount / Math.max(metrics.requestCount, 1);
      
      if (serviceErrorRate > 0.2) { // 20% error rate for individual service
        serviceLogger.performanceAlert(
          'service_error_rate',
          serviceErrorRate,
          0.2,
          metrics.serviceName
        );
      }
      
      if (metrics.averageResponseTime > 10000) { // 10 second threshold for individual service
        serviceLogger.performanceAlert(
          'service_response_time',
          metrics.averageResponseTime,
          10000,
          metrics.serviceName
        );
      }
    }

    // Check service availability
    const healthyServices = this.serviceDiscovery.getHealthyServices().length;
    const totalServices = this.serviceDiscovery.getAllServices().length;
    const availabilityRate = healthyServices / totalServices;
    
    if (availabilityRate < 0.8) { // 80% availability threshold
      serviceLogger.performanceAlert('availability', availabilityRate, 0.8);
    }
  }

  /**
   * Get comprehensive health report
   */
  getHealthReport(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: Date;
    systemMetrics: SystemMetrics;
    serviceMetrics: ServiceMetrics[];
    circuitBreakers: any;
    loadBalancer: any;
    alerts: string[];
  } {
    const systemMetrics = this.getSystemMetrics();
    const serviceMetrics = this.getAllServiceMetrics();
    const circuitBreakerStats = this.circuitBreaker.getStats();
    const loadBalancerStats = this.loadBalancer.getAllStats();
    
    // Determine overall status
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    const alerts: string[] = [];
    
    // Check system health
    const errorRate = systemMetrics.totalErrors / Math.max(systemMetrics.totalRequests, 1);
    const availabilityRate = systemMetrics.servicesUp / (systemMetrics.servicesUp + systemMetrics.servicesDown);
    
    if (errorRate > 0.1) {
      alerts.push(`High system error rate: ${(errorRate * 100).toFixed(1)}%`);
      status = 'degraded';
    }
    
    if (availabilityRate < 0.8) {
      alerts.push(`Low service availability: ${(availabilityRate * 100).toFixed(1)}%`);
      status = availabilityRate < 0.5 ? 'unhealthy' : 'degraded';
    }
    
    if (systemMetrics.averageResponseTime > 5000) {
      alerts.push(`High average response time: ${systemMetrics.averageResponseTime}ms`);
      status = 'degraded';
    }
    
    if (circuitBreakerStats.openCircuits > 0) {
      alerts.push(`${circuitBreakerStats.openCircuits} circuit breakers are open`);
      status = 'degraded';
    }

    return {
      status,
      timestamp: new Date(),
      systemMetrics,
      serviceMetrics,
      circuitBreakers: circuitBreakerStats,
      loadBalancer: loadBalancerStats,
      alerts,
    };
  }

  /**
   * Reset metrics for a service
   */
  resetServiceMetrics(serviceName: string): void {
    const metrics = this.getOrCreateMetrics(serviceName);
    metrics.requestCount = 0;
    metrics.errorCount = 0;
    metrics.averageResponseTime = 0;
    metrics.lastRequestTime = new Date();
    
    this.metrics.set(serviceName, metrics);
    logger.info(`Metrics reset for service: ${serviceName}`);
  }

  /**
   * Reset all metrics
   */
  resetAllMetrics(): void {
    for (const serviceName of this.metrics.keys()) {
      this.resetServiceMetrics(serviceName);
    }
    this.systemStartTime = new Date();
    logger.info('All metrics reset');
  }

  /**
   * Subscribe to service events
   */
  on(eventType: ServiceEventType, listener: (event: ServiceEvent) => void): void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, []);
    }
    this.eventListeners.get(eventType)!.push(listener);
  }

  /**
   * Unsubscribe from service events
   */
  off(eventType: ServiceEventType, listener: (event: ServiceEvent) => void): void {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Emit a service event
   */
  private emitEvent(event: ServiceEvent): void {
    const listeners = this.eventListeners.get(event.type);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(event);
        } catch (error) {
          logger.error('Error in event listener:', error);
        }
      }
    }
  }

  /**
   * Get or create metrics for a service
   */
  private getOrCreateMetrics(serviceName: string): ServiceMetrics {
    let metrics = this.metrics.get(serviceName);
    
    if (!metrics) {
      metrics = {
        serviceName,
        requestCount: 0,
        errorCount: 0,
        averageResponseTime: 0,
        lastRequestTime: new Date(),
        uptime: 0,
      };
      this.metrics.set(serviceName, metrics);
    }
    
    return metrics;
  }

  /**
   * Shutdown monitoring
   */
  shutdown(): void {
    this.stopMonitoring();
    this.metrics.clear();
    this.eventListeners.clear();
    logger.info('Monitoring service shutdown complete');
  }
}