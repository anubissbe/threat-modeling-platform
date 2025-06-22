import { ServiceDiscovery } from '../../src/services/service-discovery';
import { CircuitBreaker } from '../../src/services/circuit-breaker';
import { LoadBalancer } from '../../src/services/load-balancer';
import { MonitoringService } from '../../src/services/monitoring';
import { ServiceCommunication } from '../../src/services/communication';
import { CircuitBreakerState, LoadBalancingStrategy } from '../../src/types';

describe('Integration Service Core Components', () => {
  let serviceDiscovery: ServiceDiscovery;
  let circuitBreaker: CircuitBreaker;
  let loadBalancer: LoadBalancer;
  let monitoring: MonitoringService;
  let communication: ServiceCommunication;

  beforeEach(() => {
    serviceDiscovery = new ServiceDiscovery();
    circuitBreaker = new CircuitBreaker();
    loadBalancer = new LoadBalancer(serviceDiscovery);
    monitoring = new MonitoringService(serviceDiscovery, circuitBreaker, loadBalancer);
    communication = new ServiceCommunication(serviceDiscovery, circuitBreaker, loadBalancer);
  });

  afterEach(() => {
    serviceDiscovery.shutdown();
    circuitBreaker.shutdown();
    loadBalancer.shutdown();
    monitoring.shutdown();
    communication.shutdown();
  });

  describe('Service Discovery Integration', () => {
    it('should register and retrieve services', () => {
      const service = {
        name: 'test-service',
        url: 'http://localhost:3001',
        healthCheckPath: '/health',
        version: '1.0.0',
      };

      serviceDiscovery.registerService(service);
      const retrieved = serviceDiscovery.getService('test-service');
      
      expect(retrieved).toBeTruthy();
      expect(retrieved?.name).toBe('test-service');
      expect(retrieved?.url).toBe('http://localhost:3001');
    });

    it('should detect service availability', () => {
      const service = {
        name: 'test-service',
        url: 'http://localhost:3001',
        healthCheckPath: '/health',
        version: '1.0.0',
      };

      serviceDiscovery.registerService(service);
      
      // Initially should be considered available (no health check performed yet)
      const isAvailable = serviceDiscovery.getService('test-service') !== null;
      expect(isAvailable).toBe(true);
    });
  });

  describe('Circuit Breaker Integration', () => {
    it('should protect against service failures', () => {
      const serviceName = 'unreliable-service';
      
      // Configure circuit breaker to open after 2 failures
      circuitBreaker.initializeCircuit(serviceName, {
        failureThreshold: 2,
        timeoutMs: 1000,
        resetTimeoutMs: 5000,
      });

      expect(circuitBreaker.isClosed(serviceName)).toBe(true);

      // Simulate failures
      circuitBreaker.recordFailure(serviceName);
      expect(circuitBreaker.isClosed(serviceName)).toBe(true);

      circuitBreaker.recordFailure(serviceName);
      expect(circuitBreaker.isOpen(serviceName)).toBe(true);
    });

    it('should recover from failures after timeout', () => {
      const serviceName = 'recovering-service';
      
      // Open the circuit
      circuitBreaker.openCircuit(serviceName);
      expect(circuitBreaker.isOpen(serviceName)).toBe(true);

      // Manually transition to half-open (simulating timeout)
      const circuit = circuitBreaker['getOrCreateCircuit'](serviceName);
      circuit.state = CircuitBreakerState.HALF_OPEN;

      // Success should close the circuit
      circuitBreaker.recordSuccess(serviceName);
      expect(circuitBreaker.isClosed(serviceName)).toBe(true);
    });
  });

  describe('Load Balancer Integration', () => {
    beforeEach(() => {
      // Register test services
      serviceDiscovery.registerService({
        name: 'service-1',
        url: 'http://localhost:3001',
        healthCheckPath: '/health',
        version: '1.0.0',
      });

      serviceDiscovery.registerService({
        name: 'service-2',
        url: 'http://localhost:3002',
        healthCheckPath: '/health',
        version: '1.0.0',
      });
    });

    it('should distribute load across instances', () => {
      loadBalancer.setStrategy(LoadBalancingStrategy.ROUND_ROBIN);
      
      const instance1 = loadBalancer.getInstance('service-1');
      expect(instance1).toBeTruthy();
      expect(instance1?.name).toBe('service-1');

      const instance2 = loadBalancer.getInstance('service-2');
      expect(instance2).toBeTruthy();
      expect(instance2?.name).toBe('service-2');
    });

    it('should handle unavailable services gracefully', () => {
      const instance = loadBalancer.getInstance('non-existent-service');
      expect(instance).toBeNull();
    });

    it('should support different load balancing strategies', () => {
      expect(loadBalancer.getStrategy()).toBe(LoadBalancingStrategy.ROUND_ROBIN);

      loadBalancer.setStrategy(LoadBalancingStrategy.LEAST_CONNECTIONS);
      expect(loadBalancer.getStrategy()).toBe(LoadBalancingStrategy.LEAST_CONNECTIONS);

      loadBalancer.setStrategy(LoadBalancingStrategy.WEIGHTED);
      expect(loadBalancer.getStrategy()).toBe(LoadBalancingStrategy.WEIGHTED);
    });
  });

  describe('Monitoring Integration', () => {
    it('should track service metrics', () => {
      const serviceName = 'monitored-service';
      
      // Record some requests
      monitoring.recordRequest(serviceName, 100);
      monitoring.recordRequest(serviceName, 200);
      monitoring.recordError(serviceName, 300);

      const metrics = monitoring.getServiceMetrics(serviceName);
      expect(metrics).toBeTruthy();
      expect(metrics?.requestCount).toBe(3);
      expect(metrics?.errorCount).toBe(1);
      expect(metrics?.averageResponseTime).toBeGreaterThan(0);
    });

    it('should generate system-wide metrics', () => {
      monitoring.recordRequest('service-1', 100);
      monitoring.recordRequest('service-2', 150);
      monitoring.recordError('service-1', 200);

      const systemMetrics = monitoring.getSystemMetrics();
      expect(systemMetrics.totalRequests).toBe(3);
      expect(systemMetrics.totalErrors).toBe(1);
      expect(systemMetrics.averageResponseTime).toBeGreaterThan(0);
    });

    it('should provide health reports', () => {
      monitoring.recordRequest('service-1', 100);
      
      const healthReport = monitoring.getHealthReport();
      expect(healthReport.status).toMatch(/healthy|degraded|unhealthy/);
      expect(healthReport.systemMetrics).toBeTruthy();
      expect(healthReport.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('Service Communication Integration', () => {
    beforeEach(() => {
      serviceDiscovery.registerService({
        name: 'api-service',
        url: 'http://localhost:3001',
        healthCheckPath: '/health',
        version: '1.0.0',
      });
    });

    it('should handle service unavailability', async () => {
      const response = await communication.get('api-service', '/test');
      
      expect(response.success).toBe(false);
      expect(response.serviceName).toBe('api-service');
      expect(response.statusCode).toBeGreaterThanOrEqual(400);
    });

    it('should support different HTTP methods', async () => {
      const getResponse = await communication.get('api-service', '/test');
      expect(getResponse.serviceName).toBe('api-service');

      const postResponse = await communication.post('api-service', '/test', { data: 'test' });
      expect(postResponse.serviceName).toBe('api-service');

      const putResponse = await communication.put('api-service', '/test', { data: 'updated' });
      expect(putResponse.serviceName).toBe('api-service');

      const deleteResponse = await communication.delete('api-service', '/test');
      expect(deleteResponse.serviceName).toBe('api-service');
    });

    it('should track communication statistics', () => {
      const stats = communication.getStats();
      expect(stats).toHaveProperty('totalClients');
      expect(stats).toHaveProperty('activeServices');
      expect(Array.isArray(stats.activeServices)).toBe(true);
    });
  });

  describe('End-to-End Integration', () => {
    it('should handle service failure cascade', () => {
      const serviceName = 'critical-service';

      // Register service
      serviceDiscovery.registerService({
        name: serviceName,
        url: 'http://localhost:3001',
        healthCheckPath: '/health',
        version: '1.0.0',
      });

      // Simulate multiple failures
      for (let i = 0; i < 5; i++) {
        circuitBreaker.recordFailure(serviceName);
        monitoring.recordError(serviceName);
      }

      // Circuit breaker should be open
      expect(circuitBreaker.isOpen(serviceName)).toBe(true);

      // Load balancer should handle gracefully
      const instance = loadBalancer.getInstance(serviceName);
      // May return null if no healthy instances
      if (instance) {
        expect(instance.name).toBe(serviceName);
      }

      // Monitoring should show degraded state
      const healthReport = monitoring.getHealthReport();
      expect(['degraded', 'unhealthy']).toContain(healthReport.status);
    });

    it('should recover from failures', () => {
      const serviceName = 'recovering-service';

      // Start with failed state
      circuitBreaker.openCircuit(serviceName);
      monitoring.recordError(serviceName);

      expect(circuitBreaker.isOpen(serviceName)).toBe(true);

      // Simulate recovery
      circuitBreaker.closeCircuit(serviceName);
      monitoring.recordRequest(serviceName, 100);

      expect(circuitBreaker.isClosed(serviceName)).toBe(true);

      const metrics = monitoring.getServiceMetrics(serviceName);
      expect(metrics?.requestCount).toBeGreaterThan(0);
    });
  });
});