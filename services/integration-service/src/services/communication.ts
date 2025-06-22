import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { logger, serviceLogger } from '../utils/logger';
import { ServiceDiscovery } from './service-discovery';
import { CircuitBreaker } from './circuit-breaker';
import { LoadBalancer } from './load-balancer';
import { ServiceConfig } from '../types';

interface CommunicationOptions {
  retries?: number;
  timeout?: number;
  circuitBreaker?: boolean;
  loadBalancing?: boolean;
}

interface ServiceRequest {
  serviceName: string;
  path: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  data?: any;
  headers?: Record<string, string>;
  options?: CommunicationOptions;
}

interface ServiceResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode: number;
  serviceName: string;
  responseTime: number;
}

export class ServiceCommunication {
  private serviceDiscovery: ServiceDiscovery;
  private circuitBreaker: CircuitBreaker;
  private loadBalancer: LoadBalancer;
  private httpClients: Map<string, AxiosInstance> = new Map();
  private defaultOptions: CommunicationOptions = {
    retries: 3,
    timeout: 10000,
    circuitBreaker: true,
    loadBalancing: true,
  };

  constructor(
    serviceDiscovery: ServiceDiscovery,
    circuitBreaker: CircuitBreaker,
    loadBalancer: LoadBalancer
  ) {
    this.serviceDiscovery = serviceDiscovery;
    this.circuitBreaker = circuitBreaker;
    this.loadBalancer = loadBalancer;
  }

  /**
   * Make a request to another service
   */
  async request<T = any>(request: ServiceRequest): Promise<ServiceResponse<T>> {
    const startTime = Date.now();
    const options = { ...this.defaultOptions, ...request.options };

    try {
      // Check if circuit breaker is open
      if (options.circuitBreaker && this.circuitBreaker.isOpen(request.serviceName)) {
        return {
          success: false,
          error: 'Circuit breaker is open',
          statusCode: 503,
          serviceName: request.serviceName,
          responseTime: Date.now() - startTime,
        };
      }

      // Get service instance (with load balancing if enabled)
      const serviceConfig = options.loadBalancing
        ? this.loadBalancer.getInstance(request.serviceName)
        : this.serviceDiscovery.getService(request.serviceName);

      if (!serviceConfig) {
        return {
          success: false,
          error: 'Service not available',
          statusCode: 503,
          serviceName: request.serviceName,
          responseTime: Date.now() - startTime,
        };
      }

      // Make the request with retries
      const response = await this.makeRequestWithRetries(
        serviceConfig,
        request,
        options
      );

      // Record success
      if (options.circuitBreaker) {
        this.circuitBreaker.recordSuccess(request.serviceName);
      }

      // Release load balancer connection
      if (options.loadBalancing) {
        this.loadBalancer.releaseConnection(request.serviceName, serviceConfig);
      }

      const responseTime = Date.now() - startTime;
      
      serviceLogger.serviceRequestCompleted(
        request.serviceName,
        request.method || 'GET',
        request.path,
        response.status,
        responseTime
      );

      return {
        success: true,
        data: response.data,
        statusCode: response.status,
        serviceName: request.serviceName,
        responseTime,
      };

    } catch (error: any) {
      const responseTime = Date.now() - startTime;

      // Record failure
      if (options.circuitBreaker) {
        this.circuitBreaker.recordFailure(request.serviceName);
      }

      serviceLogger.serviceRequestFailed(
        request.serviceName,
        request.method || 'GET',
        request.path,
        error.message
      );

      logger.error('Service request failed', {
        serviceName: request.serviceName,
        path: request.path,
        error: error.message,
        responseTime,
      });

      return {
        success: false,
        error: error.message,
        statusCode: error.response?.status || 500,
        serviceName: request.serviceName,
        responseTime,
      };
    }
  }

  /**
   * Convenience method for GET requests
   */
  async get<T = any>(
    serviceName: string,
    path: string,
    options?: CommunicationOptions
  ): Promise<ServiceResponse<T>> {
    return this.request<T>({
      serviceName,
      path,
      method: 'GET',
      options,
    });
  }

  /**
   * Convenience method for POST requests
   */
  async post<T = any>(
    serviceName: string,
    path: string,
    data?: any,
    options?: CommunicationOptions
  ): Promise<ServiceResponse<T>> {
    return this.request<T>({
      serviceName,
      path,
      method: 'POST',
      data,
      options,
    });
  }

  /**
   * Convenience method for PUT requests
   */
  async put<T = any>(
    serviceName: string,
    path: string,
    data?: any,
    options?: CommunicationOptions
  ): Promise<ServiceResponse<T>> {
    return this.request<T>({
      serviceName,
      path,
      method: 'PUT',
      data,
      options,
    });
  }

  /**
   * Convenience method for DELETE requests
   */
  async delete<T = any>(
    serviceName: string,
    path: string,
    options?: CommunicationOptions
  ): Promise<ServiceResponse<T>> {
    return this.request<T>({
      serviceName,
      path,
      method: 'DELETE',
      options,
    });
  }

  /**
   * Broadcast a request to multiple services
   */
  async broadcast<T = any>(
    serviceNames: string[],
    path: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    data?: any,
    options?: CommunicationOptions
  ): Promise<ServiceResponse<T>[]> {
    const requests = serviceNames.map(serviceName =>
      this.request<T>({
        serviceName,
        path,
        method,
        data,
        options,
      })
    );

    return Promise.all(requests);
  }

  /**
   * Health check for a service
   */
  async healthCheck(serviceName: string): Promise<boolean> {
    try {
      const response = await this.get(serviceName, '/health', {
        timeout: 5000,
        retries: 1,
        circuitBreaker: false,
      });

      return response.success && response.statusCode === 200;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get service metrics
   */
  async getServiceMetrics(serviceName: string): Promise<ServiceResponse<any>> {
    return this.get(serviceName, '/metrics', {
      timeout: 5000,
      retries: 1,
    });
  }

  /**
   * Make request with retries
   */
  private async makeRequestWithRetries(
    serviceConfig: ServiceConfig,
    request: ServiceRequest,
    options: CommunicationOptions
  ): Promise<AxiosResponse> {
    const client = this.getHttpClient(serviceConfig);
    let lastError: any;

    for (let attempt = 1; attempt <= (options.retries || 1); attempt++) {
      try {
        const config: AxiosRequestConfig = {
          method: request.method?.toLowerCase() as any || 'get',
          url: request.path,
          data: request.data,
          headers: request.headers,
          timeout: options.timeout,
        };

        logger.debug(`Service request attempt ${attempt}`, {
          serviceName: request.serviceName,
          method: request.method,
          path: request.path,
          url: serviceConfig.url,
        });

        const response = await client.request(config);
        return response;

      } catch (error: any) {
        lastError = error;
        
        if (attempt < (options.retries || 1)) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Exponential backoff
          logger.debug(`Service request failed, retrying in ${delay}ms`, {
            serviceName: request.serviceName,
            attempt,
            error: error.message,
          });
          
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }

  /**
   * Get or create HTTP client for a service
   */
  private getHttpClient(serviceConfig: ServiceConfig): AxiosInstance {
    const key = `${serviceConfig.name}-${serviceConfig.url}`;
    
    if (!this.httpClients.has(key)) {
      const client = axios.create({
        baseURL: serviceConfig.url,
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Integration-Service/1.0.0',
        },
      });

      // Request interceptor
      client.interceptors.request.use(
        (config) => {
          logger.debug('Making HTTP request', {
            service: serviceConfig.name,
            method: config.method?.toUpperCase(),
            url: config.url,
            baseURL: config.baseURL,
          });
          return config;
        },
        (error) => {
          logger.error('HTTP request interceptor error', error);
          return Promise.reject(error);
        }
      );

      // Response interceptor
      client.interceptors.response.use(
        (response) => {
          logger.debug('HTTP response received', {
            service: serviceConfig.name,
            status: response.status,
            statusText: response.statusText,
          });
          return response;
        },
        (error) => {
          logger.error('HTTP response error', {
            service: serviceConfig.name,
            status: error.response?.status,
            statusText: error.response?.statusText,
            message: error.message,
          });
          return Promise.reject(error);
        }
      );

      this.httpClients.set(key, client);
    }

    return this.httpClients.get(key)!;
  }

  /**
   * Clear HTTP clients cache
   */
  clearClients(): void {
    this.httpClients.clear();
    logger.debug('HTTP clients cache cleared');
  }

  /**
   * Get communication statistics
   */
  getStats(): {
    totalClients: number;
    activeServices: string[];
  } {
    const activeServices = Array.from(this.httpClients.keys());
    
    return {
      totalClients: this.httpClients.size,
      activeServices,
    };
  }

  /**
   * Test connectivity to all services
   */
  async testConnectivity(): Promise<Map<string, boolean>> {
    const services = this.serviceDiscovery.getAllServices();
    const results = new Map<string, boolean>();

    for (const service of services) {
      const isHealthy = await this.healthCheck(service.name);
      results.set(service.name, isHealthy);
    }

    return results;
  }

  /**
   * Shutdown and cleanup
   */
  shutdown(): void {
    this.clearClients();
    logger.info('Service communication shutdown complete');
  }
}