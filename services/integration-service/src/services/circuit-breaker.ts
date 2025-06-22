import { logger, serviceLogger } from '../utils/logger';
import {
  CircuitBreakerConfig,
  CircuitBreakerState,
  CircuitBreaker as ICircuitBreaker,
} from '../types';

export class CircuitBreaker {
  private circuits: Map<string, ICircuitBreaker> = new Map();
  private defaultConfig: CircuitBreakerConfig = {
    failureThreshold: 5,
    timeoutMs: 10000,
    resetTimeoutMs: 60000,
  };

  constructor(config?: Partial<CircuitBreakerConfig>) {
    if (config) {
      this.defaultConfig = { ...this.defaultConfig, ...config };
    }
  }

  /**
   * Initialize circuit breaker for a service
   */
  initializeCircuit(serviceName: string, config?: CircuitBreakerConfig): void {
    const circuitConfig = config || this.defaultConfig;
    
    this.circuits.set(serviceName, {
      state: CircuitBreakerState.CLOSED,
      failureCount: 0,
      config: circuitConfig,
    });

    logger.debug(`Circuit breaker initialized for ${serviceName}`, circuitConfig);
  }

  /**
   * Check if circuit is open for a service
   */
  isOpen(serviceName: string): boolean {
    const circuit = this.getOrCreateCircuit(serviceName);
    
    if (circuit.state === CircuitBreakerState.OPEN) {
      // Check if reset timeout has passed
      if (circuit.lastFailureTime && 
          Date.now() - circuit.lastFailureTime.getTime() > circuit.config.resetTimeoutMs) {
        // Move to half-open state
        circuit.state = CircuitBreakerState.HALF_OPEN;
        logger.info(`Circuit breaker for ${serviceName} moved to HALF_OPEN state`);
      }
    }

    return circuit.state === CircuitBreakerState.OPEN;
  }

  /**
   * Check if circuit is closed (allowing requests)
   */
  isClosed(serviceName: string): boolean {
    const circuit = this.getOrCreateCircuit(serviceName);
    return circuit.state === CircuitBreakerState.CLOSED;
  }

  /**
   * Check if circuit is half-open (testing state)
   */
  isHalfOpen(serviceName: string): boolean {
    const circuit = this.getOrCreateCircuit(serviceName);
    return circuit.state === CircuitBreakerState.HALF_OPEN;
  }

  /**
   * Record a successful request
   */
  recordSuccess(serviceName: string): void {
    const circuit = this.getOrCreateCircuit(serviceName);
    
    if (circuit.state === CircuitBreakerState.HALF_OPEN) {
      // Success in half-open state closes the circuit
      circuit.state = CircuitBreakerState.CLOSED;
      circuit.failureCount = 0;
      circuit.lastFailureTime = undefined;
      
      serviceLogger.circuitBreakerClosed(serviceName);
      logger.info(`Circuit breaker for ${serviceName} closed after successful request`);
    } else if (circuit.state === CircuitBreakerState.CLOSED) {
      // Reset failure count on success
      circuit.failureCount = 0;
    }
  }

  /**
   * Record a failed request
   */
  recordFailure(serviceName: string): void {
    const circuit = this.getOrCreateCircuit(serviceName);
    
    circuit.failureCount++;
    circuit.lastFailureTime = new Date();

    if (circuit.state === CircuitBreakerState.HALF_OPEN) {
      // Failure in half-open state opens the circuit again
      circuit.state = CircuitBreakerState.OPEN;
      serviceLogger.circuitBreakerOpen(serviceName, circuit.failureCount);
      logger.warn(`Circuit breaker for ${serviceName} opened again after failure in HALF_OPEN state`);
    } else if (circuit.state === CircuitBreakerState.CLOSED && 
               circuit.failureCount >= circuit.config.failureThreshold) {
      // Too many failures, open the circuit
      circuit.state = CircuitBreakerState.OPEN;
      serviceLogger.circuitBreakerOpen(serviceName, circuit.failureCount);
      logger.warn(`Circuit breaker for ${serviceName} opened after ${circuit.failureCount} failures`);
    }
  }

  /**
   * Get circuit breaker state for a service
   */
  getState(serviceName: string): CircuitBreakerState {
    const circuit = this.getOrCreateCircuit(serviceName);
    return circuit.state;
  }

  /**
   * Get failure count for a service
   */
  getFailureCount(serviceName: string): number {
    const circuit = this.getOrCreateCircuit(serviceName);
    return circuit.failureCount;
  }

  /**
   * Get circuit breaker configuration for a service
   */
  getConfig(serviceName: string): CircuitBreakerConfig {
    const circuit = this.getOrCreateCircuit(serviceName);
    return circuit.config;
  }

  /**
   * Manually open a circuit breaker
   */
  openCircuit(serviceName: string): void {
    const circuit = this.getOrCreateCircuit(serviceName);
    circuit.state = CircuitBreakerState.OPEN;
    circuit.lastFailureTime = new Date();
    
    serviceLogger.circuitBreakerOpen(serviceName, circuit.failureCount);
    logger.info(`Circuit breaker for ${serviceName} manually opened`);
  }

  /**
   * Manually close a circuit breaker
   */
  closeCircuit(serviceName: string): void {
    const circuit = this.getOrCreateCircuit(serviceName);
    circuit.state = CircuitBreakerState.CLOSED;
    circuit.failureCount = 0;
    circuit.lastFailureTime = undefined;
    
    serviceLogger.circuitBreakerClosed(serviceName);
    logger.info(`Circuit breaker for ${serviceName} manually closed`);
  }

  /**
   * Reset a circuit breaker to initial state
   */
  resetCircuit(serviceName: string): void {
    this.circuits.delete(serviceName);
    this.getOrCreateCircuit(serviceName); // This will create a new one
    logger.info(`Circuit breaker for ${serviceName} reset`);
  }

  /**
   * Get all circuit breaker states
   */
  getAllStates(): Map<string, CircuitBreakerState> {
    const states = new Map<string, CircuitBreakerState>();
    
    for (const [serviceName, circuit] of this.circuits) {
      states.set(serviceName, circuit.state);
    }
    
    return states;
  }

  /**
   * Get list of services with open circuits
   */
  getOpenCircuits(): string[] {
    const openCircuits: string[] = [];
    
    for (const [serviceName, circuit] of this.circuits) {
      if (circuit.state === CircuitBreakerState.OPEN) {
        openCircuits.push(serviceName);
      }
    }
    
    return openCircuits;
  }

  /**
   * Get circuit breaker statistics
   */
  getStats(): {
    totalCircuits: number;
    closedCircuits: number;
    openCircuits: number;
    halfOpenCircuits: number;
    averageFailureCount: number;
  } {
    const circuits = Array.from(this.circuits.values());
    
    if (circuits.length === 0) {
      return {
        totalCircuits: 0,
        closedCircuits: 0,
        openCircuits: 0,
        halfOpenCircuits: 0,
        averageFailureCount: 0,
      };
    }

    const closedCount = circuits.filter(c => c.state === CircuitBreakerState.CLOSED).length;
    const openCount = circuits.filter(c => c.state === CircuitBreakerState.OPEN).length;
    const halfOpenCount = circuits.filter(c => c.state === CircuitBreakerState.HALF_OPEN).length;
    const totalFailures = circuits.reduce((sum, c) => sum + c.failureCount, 0);

    return {
      totalCircuits: circuits.length,
      closedCircuits: closedCount,
      openCircuits: openCount,
      halfOpenCircuits: halfOpenCount,
      averageFailureCount: totalFailures / circuits.length,
    };
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(
    serviceName: string,
    operation: () => Promise<T>,
    fallback?: () => Promise<T>
  ): Promise<T> {
    if (this.isOpen(serviceName)) {
      if (fallback) {
        logger.debug(`Circuit breaker open for ${serviceName}, executing fallback`);
        return fallback();
      } else {
        throw new Error(`Circuit breaker is open for service: ${serviceName}`);
      }
    }

    try {
      const result = await operation();
      this.recordSuccess(serviceName);
      return result;
    } catch (error) {
      this.recordFailure(serviceName);
      
      if (fallback && this.isOpen(serviceName)) {
        logger.debug(`Circuit breaker opened for ${serviceName}, executing fallback`);
        return fallback();
      }
      
      throw error;
    }
  }

  /**
   * Get or create circuit breaker for a service
   */
  private getOrCreateCircuit(serviceName: string): ICircuitBreaker {
    let circuit = this.circuits.get(serviceName);
    
    if (!circuit) {
      circuit = {
        state: CircuitBreakerState.CLOSED,
        failureCount: 0,
        config: this.defaultConfig,
      };
      this.circuits.set(serviceName, circuit);
    }
    
    return circuit;
  }

  /**
   * Cleanup and shutdown
   */
  shutdown(): void {
    this.circuits.clear();
    logger.info('Circuit breaker shutdown complete');
  }
}