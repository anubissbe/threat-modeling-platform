import { ServiceDiscovery } from '../../../src/services/service-discovery';
import { ServiceConfig } from '../../../src/types';

describe('ServiceDiscovery', () => {
  let serviceDiscovery: ServiceDiscovery;

  beforeEach(() => {
    serviceDiscovery = new ServiceDiscovery();
  });

  afterEach(() => {
    serviceDiscovery.shutdown();
  });

  describe('Service Registration', () => {
    it('should register a service', () => {
      const service: ServiceConfig = {
        name: 'test-service',
        url: 'http://localhost:3001',
        healthCheckPath: '/health',
        version: '1.0.0',
      };

      serviceDiscovery.registerService(service);
      
      const registeredService = serviceDiscovery.getService('test-service');
      expect(registeredService).toEqual(service);
    });

    it('should get all registered services', () => {
      const service1: ServiceConfig = {
        name: 'service1',
        url: 'http://localhost:3001',
        healthCheckPath: '/health',
        version: '1.0.0',
      };

      const service2: ServiceConfig = {
        name: 'service2',
        url: 'http://localhost:3002',
        healthCheckPath: '/health',
        version: '1.0.0',
      };

      serviceDiscovery.registerService(service1);
      serviceDiscovery.registerService(service2);

      const services = serviceDiscovery.getAllServices();
      expect(services).toHaveLength(2);
      expect(services.map(s => s.name)).toContain('service1');
      expect(services.map(s => s.name)).toContain('service2');
    });

    it('should deregister a service', () => {
      const service: ServiceConfig = {
        name: 'test-service',
        url: 'http://localhost:3001',
        healthCheckPath: '/health',
        version: '1.0.0',
      };

      serviceDiscovery.registerService(service);
      expect(serviceDiscovery.getService('test-service')).toBeTruthy();

      serviceDiscovery.deregisterService('test-service');
      expect(serviceDiscovery.getService('test-service')).toBeNull();
    });

    it('should return null for non-existent service', () => {
      const service = serviceDiscovery.getService('non-existent');
      expect(service).toBeNull();
    });
  });

  describe('Health Checking', () => {
    beforeEach(() => {
      const service: ServiceConfig = {
        name: 'test-service',
        url: 'http://localhost:3001',
        healthCheckPath: '/health',
        version: '1.0.0',
      };
      serviceDiscovery.registerService(service);
    });

    it('should check service health', async () => {
      // Mock the health check to avoid actual HTTP calls
      const originalCheckHealth = serviceDiscovery['checkServiceHealth'];
      serviceDiscovery['checkServiceHealth'] = jest.fn().mockResolvedValue({
        name: 'test-service',
        status: 'healthy',
        responseTime: 100,
        timestamp: new Date(),
      });

      const health = await serviceDiscovery.checkServiceHealth('test-service');
      expect(health.status).toBe('healthy');
      expect(health.name).toBe('test-service');
    });

    it('should mark service as unhealthy on health check failure', async () => {
      // Mock the health check to simulate failure
      serviceDiscovery['checkServiceHealth'] = jest.fn().mockResolvedValue({
        name: 'test-service',
        status: 'unhealthy',
        responseTime: 0,
        timestamp: new Date(),
        error: 'Connection failed',
      });

      const health = await serviceDiscovery.checkServiceHealth('test-service');
      expect(health.status).toBe('unhealthy');
      expect(health.error).toBe('Connection failed');
    });

    it('should get healthy services only', () => {
      // Register multiple services
      const service1: ServiceConfig = {
        name: 'healthy-service',
        url: 'http://localhost:3001',
        healthCheckPath: '/health',
        version: '1.0.0',
      };

      const service2: ServiceConfig = {
        name: 'unhealthy-service',
        url: 'http://localhost:3002',
        healthCheckPath: '/health',
        version: '1.0.0',
      };

      serviceDiscovery.registerService(service1);
      serviceDiscovery.registerService(service2);

      // Mock health status
      serviceDiscovery['serviceHealth'].set('healthy-service', {
        name: 'healthy-service',
        status: 'healthy',
        responseTime: 100,
        timestamp: new Date(),
      });

      serviceDiscovery['serviceHealth'].set('unhealthy-service', {
        name: 'unhealthy-service',
        status: 'unhealthy',
        responseTime: 0,
        timestamp: new Date(),
        error: 'Connection failed',
      });

      const healthyServices = serviceDiscovery.getHealthyServices();
      expect(healthyServices).toHaveLength(1);
      expect(healthyServices[0].name).toBe('healthy-service');
    });

    it('should check if a specific service is healthy', () => {
      // Mock health status
      serviceDiscovery['serviceHealth'].set('test-service', {
        name: 'test-service',
        status: 'healthy',
        responseTime: 100,
        timestamp: new Date(),
      });

      expect(serviceDiscovery.isServiceHealthy('test-service')).toBe(true);

      // Update to unhealthy
      serviceDiscovery['serviceHealth'].set('test-service', {
        name: 'test-service',
        status: 'unhealthy',
        responseTime: 0,
        timestamp: new Date(),
        error: 'Connection failed',
      });

      expect(serviceDiscovery.isServiceHealthy('test-service')).toBe(false);
    });
  });

  describe('Service Monitoring', () => {
    it('should start and stop monitoring', () => {
      expect(() => serviceDiscovery.startMonitoring(1000)).not.toThrow();
      expect(() => serviceDiscovery.stopMonitoring()).not.toThrow();
    });

    it('should not start monitoring twice', () => {
      serviceDiscovery.startMonitoring(1000);
      
      // Starting again should not throw
      expect(() => serviceDiscovery.startMonitoring(1000)).not.toThrow();
      
      serviceDiscovery.stopMonitoring();
    });
  });

  describe('Shutdown', () => {
    it('should shutdown gracefully', () => {
      const service: ServiceConfig = {
        name: 'test-service',
        url: 'http://localhost:3001',
        healthCheckPath: '/health',
        version: '1.0.0',
      };

      serviceDiscovery.registerService(service);
      serviceDiscovery.startMonitoring(1000);

      expect(() => serviceDiscovery.shutdown()).not.toThrow();
      expect(serviceDiscovery.getAllServices()).toHaveLength(0);
    });
  });
});