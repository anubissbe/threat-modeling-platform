import { CircuitBreaker } from '../../../src/services/circuit-breaker';
import { CircuitBreakerState } from '../../../src/types';

describe('CircuitBreaker', () => {
  let circuitBreaker: CircuitBreaker;

  beforeEach(() => {
    circuitBreaker = new CircuitBreaker({
      failureThreshold: 3,
      timeoutMs: 1000,
      resetTimeoutMs: 5000,
    });
  });

  afterEach(() => {
    circuitBreaker.shutdown();
  });

  describe('Circuit States', () => {
    it('should start in closed state', () => {
      expect(circuitBreaker.isClosed('test-service')).toBe(true);
      expect(circuitBreaker.isOpen('test-service')).toBe(false);
      expect(circuitBreaker.isHalfOpen('test-service')).toBe(false);
    });

    it('should open circuit after failure threshold', () => {
      // Record failures up to threshold
      circuitBreaker.recordFailure('test-service');
      circuitBreaker.recordFailure('test-service');
      expect(circuitBreaker.isClosed('test-service')).toBe(true);

      // This should open the circuit
      circuitBreaker.recordFailure('test-service');
      expect(circuitBreaker.isOpen('test-service')).toBe(true);
      expect(circuitBreaker.isClosed('test-service')).toBe(false);
    });

    it('should reset failure count on success', () => {
      circuitBreaker.recordFailure('test-service');
      circuitBreaker.recordFailure('test-service');
      expect(circuitBreaker.getFailureCount('test-service')).toBe(2);

      circuitBreaker.recordSuccess('test-service');
      expect(circuitBreaker.getFailureCount('test-service')).toBe(0);
    });

    it('should transition from open to half-open after timeout', async () => {
      // Open the circuit
      circuitBreaker.recordFailure('test-service');
      circuitBreaker.recordFailure('test-service');
      circuitBreaker.recordFailure('test-service');
      expect(circuitBreaker.isOpen('test-service')).toBe(true);

      // Mock the passage of time
      const circuit = circuitBreaker['getOrCreateCircuit']('test-service');
      circuit.lastFailureTime = new Date(Date.now() - 6000); // 6 seconds ago

      // Next check should transition to half-open
      expect(circuitBreaker.isOpen('test-service')).toBe(false);
      expect(circuitBreaker.isHalfOpen('test-service')).toBe(true);
    });

    it('should close circuit on success in half-open state', () => {
      // Open the circuit
      circuitBreaker.openCircuit('test-service');
      
      // Manually set to half-open
      const circuit = circuitBreaker['getOrCreateCircuit']('test-service');
      circuit.state = CircuitBreakerState.HALF_OPEN;

      circuitBreaker.recordSuccess('test-service');
      expect(circuitBreaker.isClosed('test-service')).toBe(true);
      expect(circuitBreaker.getFailureCount('test-service')).toBe(0);
    });

    it('should open circuit on failure in half-open state', () => {
      // Set to half-open
      const circuit = circuitBreaker['getOrCreateCircuit']('test-service');
      circuit.state = CircuitBreakerState.HALF_OPEN;

      circuitBreaker.recordFailure('test-service');
      expect(circuitBreaker.isOpen('test-service')).toBe(true);
    });
  });

  describe('Manual Control', () => {
    it('should manually open circuit', () => {
      circuitBreaker.openCircuit('test-service');
      expect(circuitBreaker.isOpen('test-service')).toBe(true);
    });

    it('should manually close circuit', () => {
      circuitBreaker.openCircuit('test-service');
      expect(circuitBreaker.isOpen('test-service')).toBe(true);

      circuitBreaker.closeCircuit('test-service');
      expect(circuitBreaker.isClosed('test-service')).toBe(true);
      expect(circuitBreaker.getFailureCount('test-service')).toBe(0);
    });

    it('should reset circuit to initial state', () => {
      circuitBreaker.recordFailure('test-service');
      circuitBreaker.recordFailure('test-service');
      expect(circuitBreaker.getFailureCount('test-service')).toBe(2);

      circuitBreaker.resetCircuit('test-service');
      expect(circuitBreaker.getFailureCount('test-service')).toBe(0);
      expect(circuitBreaker.isClosed('test-service')).toBe(true);
    });
  });

  describe('Statistics', () => {
    it('should get circuit states', () => {
      circuitBreaker.recordFailure('service1');
      circuitBreaker.openCircuit('service2');
      
      const states = circuitBreaker.getAllStates();
      expect(states.has('service1')).toBe(true);
      expect(states.has('service2')).toBe(true);
      expect(states.get('service1')).toBe(CircuitBreakerState.CLOSED);
      expect(states.get('service2')).toBe(CircuitBreakerState.OPEN);
    });

    it('should get open circuits', () => {
      circuitBreaker.openCircuit('service1');
      circuitBreaker.openCircuit('service2');
      circuitBreaker.recordFailure('service3'); // This should stay closed

      const openCircuits = circuitBreaker.getOpenCircuits();
      expect(openCircuits).toContain('service1');
      expect(openCircuits).toContain('service2');
      expect(openCircuits).not.toContain('service3');
    });

    it('should get circuit breaker statistics', () => {
      circuitBreaker.openCircuit('service1');
      circuitBreaker.recordFailure('service2');
      
      const stats = circuitBreaker.getStats();
      expect(stats.totalCircuits).toBe(2);
      expect(stats.openCircuits).toBe(1);
      expect(stats.closedCircuits).toBe(1);
      expect(stats.halfOpenCircuits).toBe(0);
    });
  });

  describe('Execute with Circuit Breaker', () => {
    it('should execute operation when circuit is closed', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      
      const result = await circuitBreaker.execute('test-service', operation);
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalled();
    });

    it('should execute fallback when circuit is open', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      const fallback = jest.fn().mockResolvedValue('fallback');
      
      circuitBreaker.openCircuit('test-service');
      
      const result = await circuitBreaker.execute('test-service', operation, fallback);
      expect(result).toBe('fallback');
      expect(operation).not.toHaveBeenCalled();
      expect(fallback).toHaveBeenCalled();
    });

    it('should throw error when circuit is open and no fallback', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      
      circuitBreaker.openCircuit('test-service');
      
      await expect(circuitBreaker.execute('test-service', operation))
        .rejects.toThrow('Circuit breaker is open for service: test-service');
    });

    it('should record failure and execute fallback on operation failure', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Operation failed'));
      const fallback = jest.fn().mockResolvedValue('fallback');
      
      // Configure to open after 1 failure for this test
      circuitBreaker = new CircuitBreaker({ failureThreshold: 1 });
      
      await expect(circuitBreaker.execute('test-service', operation, fallback))
        .rejects.toThrow('Operation failed');
      
      expect(circuitBreaker.isOpen('test-service')).toBe(true);
    });

    it('should record success on successful operation', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      
      // Add some failures first
      circuitBreaker.recordFailure('test-service');
      expect(circuitBreaker.getFailureCount('test-service')).toBe(1);
      
      await circuitBreaker.execute('test-service', operation);
      expect(circuitBreaker.getFailureCount('test-service')).toBe(0);
    });
  });

  describe('Configuration', () => {
    it('should use custom configuration', () => {
      const customCircuitBreaker = new CircuitBreaker({
        failureThreshold: 5,
        timeoutMs: 2000,
        resetTimeoutMs: 10000,
      });

      const config = customCircuitBreaker.getConfig('test-service');
      expect(config.failureThreshold).toBe(5);
      expect(config.timeoutMs).toBe(2000);
      expect(config.resetTimeoutMs).toBe(10000);

      customCircuitBreaker.shutdown();
    });

    it('should initialize circuit with custom config', () => {
      circuitBreaker.initializeCircuit('custom-service', {
        failureThreshold: 10,
        timeoutMs: 5000,
        resetTimeoutMs: 30000,
      });

      const config = circuitBreaker.getConfig('custom-service');
      expect(config.failureThreshold).toBe(10);
      expect(config.timeoutMs).toBe(5000);
      expect(config.resetTimeoutMs).toBe(30000);
    });
  });
});