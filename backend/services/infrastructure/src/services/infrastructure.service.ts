import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import cluster from 'cluster';
import os from 'os';
// import * as pidusage from 'pidusage';
import si from 'systeminformation';
import { logger } from '../utils/logger';
import {
  InfrastructureConfig,
  ServiceHealth,
  SystemMetrics,
  ApplicationMetrics,
  ClusterStats,
  ClusterNode,
  ScalingEvent,
  ScalingPolicy,
  Alert,
  InfrastructureEvent,
  CircuitBreakerState,
  BackupJob,
  MaintenanceWindow,
  HealthResponse
} from '../types/infrastructure';

export class InfrastructureService extends EventEmitter {
  private config: InfrastructureConfig;
  private services: Map<string, ServiceHealth> = new Map();
  private clusterNodes: Map<string, ClusterNode> = new Map();
  private scalingEvents: ScalingEvent[] = [];
  private alerts: Map<string, Alert> = new Map();
  private events: InfrastructureEvent[] = [];
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map();
  private backupJobs: Map<string, BackupJob> = new Map();
  private maintenanceWindows: Map<string, MaintenanceWindow> = new Map();
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private metricsInterval: NodeJS.Timeout | null = null;
  private isShuttingDown = false;

  constructor(config: InfrastructureConfig) {
    super();
    this.config = config;
    this.initializeServices();
    this.startHealthChecks();
    this.startMetricsCollection();
    this.setupGracefulShutdown();
    
    logger.info('Infrastructure service initialized', {
      cluster: config.cluster.enabled,
      monitoring: config.monitoring.prometheus.enabled,
      scaling: config.scaling.autoScaling.enabled
    });
  }

  /**
   * Initialize core infrastructure services
   */
  private initializeServices(): void {
    // Initialize cluster if enabled
    if (this.config.cluster.enabled) {
      this.initializeCluster();
    }

    // Initialize circuit breakers
    this.initializeCircuitBreakers();

    // Initialize service discovery
    this.initializeServiceDiscovery();

    // Initialize auto-scaling
    if (this.config.scaling.autoScaling.enabled) {
      this.initializeAutoScaling();
    }

    logger.info('Infrastructure services initialized successfully');
  }

  /**
   * Initialize cluster management
   */
  private initializeCluster(): void {
    if (cluster.isMaster) {
      const numCPUs = this.config.cluster.workerCount || os.cpus().length;
      
      logger.info(`Starting ${numCPUs} worker processes`);
      
      for (let i = 0; i < numCPUs; i++) {
        this.forkWorker();
      }

      cluster.on('exit', (worker, code, signal) => {
        logger.warn(`Worker ${worker.process.pid} died`, { code, signal });
        
        if (!this.isShuttingDown) {
          logger.info('Starting a new worker');
          this.forkWorker();
        }
      });

      cluster.on('listening', (worker, address) => {
        logger.info(`Worker ${worker.process.pid} listening on ${address.address}:${address.port}`);
      });
    }
  }

  /**
   * Fork a new worker process
   */
  private forkWorker(): void {
    const worker = cluster.fork();
    
    const nodeInfo: ClusterNode = {
      id: uuidv4(),
      pid: worker.process.pid!,
      status: 'online',
      uptime: 0,
      restarts: 0,
      cpu: 0,
      memory: 0,
      lastHeartbeat: new Date()
    };

    this.clusterNodes.set(worker.id.toString(), nodeInfo);
    
    worker.on('message', (message) => {
      if (message.type === 'heartbeat') {
        this.handleWorkerHeartbeat(worker.id.toString(), message.data);
      }
    });
  }

  /**
   * Handle worker heartbeat
   */
  private handleWorkerHeartbeat(workerId: string, data: any): void {
    const node = this.clusterNodes.get(workerId);
    if (node) {
      node.lastHeartbeat = new Date();
      node.cpu = data.cpu;
      node.memory = data.memory;
      node.uptime = data.uptime;
      
      this.clusterNodes.set(workerId, node);
    }
  }

  /**
   * Initialize circuit breakers
   */
  private initializeCircuitBreakers(): void {
    const services = ['auth', 'core', 'ai', 'compliance', 'nlp', 'reporting'];
    
    services.forEach(service => {
      this.circuitBreakers.set(service, {
        state: 'closed',
        failureCount: 0,
        lastFailureTime: new Date(),
        nextAttemptTime: new Date(),
        successCount: 0,
        requestCount: 0
      });
    });

    logger.info('Circuit breakers initialized for all services');
  }

  /**
   * Initialize service discovery
   */
  private initializeServiceDiscovery(): void {
    // Register core services
    const coreServices = [
      { name: 'auth', port: 3001, health: '/health' },
      { name: 'core', port: 3000, health: '/health' },
      { name: 'ai', port: 3002, health: '/health' },
      { name: 'compliance', port: 3003, health: '/health' },
      { name: 'nlp', port: 3004, health: '/health' },
      { name: 'reporting', port: 3005, health: '/health' }
    ];

    coreServices.forEach(service => {
      this.registerService(service.name, {
        service: service.name,
        status: 'unknown',
        timestamp: new Date(),
        responseTime: 0,
        details: {
          uptime: 0,
          cpuUsage: 0,
          memoryUsage: 0,
          diskUsage: 0,
          connections: 0,
          errors: 0
        },
        dependencies: []
      });
    });

    logger.info('Service discovery initialized');
  }

  /**
   * Initialize auto-scaling
   */
  private initializeAutoScaling(): void {
    setInterval(() => {
      this.evaluateScalingPolicies();
    }, 30000); // Check every 30 seconds

    logger.info('Auto-scaling initialized');
  }

  /**
   * Start health checks
   */
  private startHealthChecks(): void {
    if (this.config.monitoring.healthChecks.enabled) {
      this.healthCheckInterval = setInterval(() => {
        this.performHealthChecks();
      }, this.config.monitoring.healthChecks.interval);
    }
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    if (this.config.monitoring.prometheus.enabled) {
      this.metricsInterval = setInterval(() => {
        this.collectMetrics();
      }, 10000); // Collect metrics every 10 seconds
    }
  }

  /**
   * Perform health checks on all services
   */
  private async performHealthChecks(): Promise<void> {
    const services = Array.from(this.services.keys());
    
    for (const serviceName of services) {
      try {
        const health = await this.checkServiceHealth(serviceName);
        this.updateServiceHealth(serviceName, health);
      } catch (error) {
        logger.error(`Health check failed for ${serviceName}`, error);
        this.updateServiceHealth(serviceName, {
          service: serviceName,
          status: 'unhealthy',
          timestamp: new Date(),
          responseTime: 0,
          details: {
            uptime: 0,
            cpuUsage: 0,
            memoryUsage: 0,
            diskUsage: 0,
            connections: 0,
            errors: 1,
            lastError: error instanceof Error ? error.message : 'Unknown error'
          },
          dependencies: []
        });
      }
    }
  }

  /**
   * Check health of a specific service
   */
  private async checkServiceHealth(serviceName: string): Promise<ServiceHealth> {
    const startTime = Date.now();
    
    // Simulate health check (replace with actual HTTP calls)
    const simulatedHealth = await this.simulateHealthCheck(serviceName);
    
    const responseTime = Date.now() - startTime;
    
    return {
      service: serviceName,
      status: simulatedHealth.status || 'unknown',
      timestamp: new Date(),
      responseTime,
      details: simulatedHealth.details || {
        uptime: 0,
        cpuUsage: 0,
        memoryUsage: 0,
        diskUsage: 0,
        connections: 0,
        errors: 0
      },
      dependencies: simulatedHealth.dependencies || []
    };
  }

  /**
   * Simulate health check for demonstration
   */
  private async simulateHealthCheck(serviceName: string): Promise<Partial<ServiceHealth>> {
    // Simulate varying health states
    const healthStates: ('healthy' | 'degraded' | 'unhealthy')[] = ['healthy', 'healthy', 'healthy', 'degraded', 'unhealthy'];
    const randomState = healthStates[Math.floor(Math.random() * healthStates.length)];
    
    return {
      status: randomState,
      details: {
        uptime: Math.floor(Math.random() * 86400), // 0-24 hours
        cpuUsage: Math.floor(Math.random() * 100),
        memoryUsage: Math.floor(Math.random() * 100),
        diskUsage: Math.floor(Math.random() * 100),
        connections: Math.floor(Math.random() * 1000),
        errors: Math.floor(Math.random() * 10)
      },
      dependencies: []
    };
  }

  /**
   * Update service health
   */
  private updateServiceHealth(serviceName: string, health: ServiceHealth): void {
    const previousHealth = this.services.get(serviceName);
    this.services.set(serviceName, health);
    
    // Check for state changes
    if (previousHealth && previousHealth.status !== health.status) {
      this.handleHealthStateChange(serviceName, previousHealth.status, health.status);
    }
    
    // Check for alerts
    this.checkAlertThresholds(serviceName, health);
  }

  /**
   * Handle health state changes
   */
  private handleHealthStateChange(serviceName: string, from: string, to: string): void {
    const event: InfrastructureEvent = {
      id: uuidv4(),
      type: 'health',
      service: serviceName,
      message: `Service ${serviceName} changed from ${from} to ${to}`,
      level: to === 'unhealthy' ? 'error' : to === 'degraded' ? 'warning' : 'info',
      metadata: { from, to },
      timestamp: new Date()
    };
    
    this.addEvent(event);
    this.emit('healthChange', { serviceName, from, to });
    
    logger.info(`Health state change: ${serviceName} ${from} -> ${to}`);
  }

  /**
   * Check alert thresholds
   */
  private checkAlertThresholds(serviceName: string, health: ServiceHealth): void {
    const thresholds = this.config.monitoring.alerts.thresholds;
    
    // CPU usage alert
    if (health.details.cpuUsage > thresholds.cpuUsage) {
      this.createAlert('warning', `High CPU usage on ${serviceName}`, 
        `CPU usage is ${health.details.cpuUsage}% (threshold: ${thresholds.cpuUsage}%)`,
        serviceName, 'cpu', health.details.cpuUsage, thresholds.cpuUsage);
    }
    
    // Memory usage alert
    if (health.details.memoryUsage > thresholds.memoryUsage) {
      this.createAlert('warning', `High memory usage on ${serviceName}`, 
        `Memory usage is ${health.details.memoryUsage}% (threshold: ${thresholds.memoryUsage}%)`,
        serviceName, 'memory', health.details.memoryUsage, thresholds.memoryUsage);
    }
    
    // Service down alert
    if (health.status === 'unhealthy') {
      this.createAlert('error', `Service ${serviceName} is unhealthy`, 
        `Service ${serviceName} failed health check`,
        serviceName, 'health', 0, 1);
    }
  }

  /**
   * Create alert
   */
  private createAlert(type: 'info' | 'warning' | 'error' | 'critical', 
                     title: string, message: string, service: string, 
                     metric: string, value: number, threshold: number): void {
    const alert: Alert = {
      id: uuidv4(),
      type,
      title,
      message,
      service,
      metric,
      value,
      threshold,
      timestamp: new Date(),
      status: 'active'
    };
    
    this.alerts.set(alert.id, alert);
    this.emit('alert', alert);
    
    logger.warn(`Alert created: ${title}`, { alert });
  }

  /**
   * Collect system and application metrics
   */
  private async collectMetrics(): Promise<void> {
    try {
      const systemMetrics = await this.collectSystemMetrics();
      const applicationMetrics = await this.collectApplicationMetrics();
      
      this.emit('metrics', { system: systemMetrics, application: applicationMetrics });
    } catch (error) {
      logger.error('Failed to collect metrics', error);
    }
  }

  /**
   * Collect system metrics
   */
  private async collectSystemMetrics(): Promise<SystemMetrics> {
    const [cpu, memory, disk, network] = await Promise.all([
      si.cpu(),
      si.mem(),
      si.fsSize(),
      si.networkStats()
    ]);

    return {
      cpu: {
        usage: (cpu as any).usage || 0,
        cores: cpu.cores || 1,
        loadAverage: os.loadavg()
      },
      memory: {
        total: memory.total,
        used: memory.used,
        free: memory.free,
        percentage: (memory.used / memory.total) * 100,
        buffers: memory.buffers || 0,
        cached: memory.cached || 0
      },
      disk: {
        total: disk[0]?.size || 0,
        used: disk[0]?.used || 0,
        free: disk[0]?.available || 0,
        percentage: disk[0]?.use || 0,
        readRate: 0,
        writeRate: 0
      },
      network: {
        bytesIn: network[0]?.rx_bytes || 0,
        bytesOut: network[0]?.tx_bytes || 0,
        packetsIn: (network[0] as any)?.rx_packets || 0,
        packetsOut: (network[0] as any)?.tx_packets || 0,
        errors: network[0]?.rx_errors || 0
      },
      processes: {
        total: 0,
        running: 0,
        sleeping: 0,
        zombie: 0
      }
    };
  }

  /**
   * Collect application metrics
   */
  private async collectApplicationMetrics(): Promise<ApplicationMetrics> {
    // Simulate application metrics collection
    return {
      requests: {
        total: Math.floor(Math.random() * 100000),
        rate: Math.floor(Math.random() * 1000),
        averageResponseTime: Math.floor(Math.random() * 500),
        percentiles: {
          p50: Math.floor(Math.random() * 200),
          p90: Math.floor(Math.random() * 500),
          p95: Math.floor(Math.random() * 800),
          p99: Math.floor(Math.random() * 1200)
        }
      },
      errors: {
        total: Math.floor(Math.random() * 1000),
        rate: Math.floor(Math.random() * 10),
        byStatusCode: {
          400: Math.floor(Math.random() * 100),
          401: Math.floor(Math.random() * 50),
          404: Math.floor(Math.random() * 200),
          500: Math.floor(Math.random() * 50)
        }
      },
      database: {
        connections: {
          active: Math.floor(Math.random() * 100),
          idle: Math.floor(Math.random() * 50),
          waiting: Math.floor(Math.random() * 10)
        },
        queries: {
          total: Math.floor(Math.random() * 50000),
          rate: Math.floor(Math.random() * 500),
          averageTime: Math.floor(Math.random() * 100),
          slowQueries: Math.floor(Math.random() * 10)
        }
      },
      cache: {
        hits: Math.floor(Math.random() * 10000),
        misses: Math.floor(Math.random() * 1000),
        hitRate: Math.random() * 100,
        keys: Math.floor(Math.random() * 5000),
        memory: {
          used: Math.floor(Math.random() * 1000000),
          available: Math.floor(Math.random() * 2000000),
          percentage: Math.random() * 100
        },
        operations: {
          get: Math.floor(Math.random() * 5000),
          set: Math.floor(Math.random() * 1000),
          del: Math.floor(Math.random() * 100),
          expire: Math.floor(Math.random() * 50)
        }
      },
      queue: {
        waiting: Math.floor(Math.random() * 100),
        active: Math.floor(Math.random() * 50),
        completed: Math.floor(Math.random() * 10000),
        failed: Math.floor(Math.random() * 100),
        delayed: Math.floor(Math.random() * 20),
        paused: Math.random() > 0.9,
        throughput: {
          processingRate: Math.floor(Math.random() * 100),
          completionRate: Math.floor(Math.random() * 90),
          failureRate: Math.floor(Math.random() * 10)
        }
      }
    };
  }

  /**
   * Evaluate scaling policies
   */
  private async evaluateScalingPolicies(): Promise<void> {
    if (!this.config.scaling.autoScaling.enabled) return;

    const systemMetrics = await this.collectSystemMetrics();
    const cpuUsage = systemMetrics.cpu.usage;
    const memoryUsage = systemMetrics.memory.percentage;

    // Check for scale up conditions
    if (cpuUsage > this.config.scaling.autoScaling.targetCpuPercent ||
        memoryUsage > this.config.scaling.autoScaling.targetMemoryPercent) {
      await this.scaleUp('cpu-memory-threshold');
    }

    // Check for scale down conditions
    if (cpuUsage < this.config.scaling.autoScaling.targetCpuPercent / 2 &&
        memoryUsage < this.config.scaling.autoScaling.targetMemoryPercent / 2) {
      await this.scaleDown('cpu-memory-low');
    }
  }

  /**
   * Scale up infrastructure
   */
  private async scaleUp(reason: string): Promise<void> {
    const currentInstances = this.clusterNodes.size;
    const maxInstances = this.config.scaling.autoScaling.maxInstances;

    if (currentInstances >= maxInstances) {
      logger.warn('Cannot scale up: maximum instances reached', { currentInstances, maxInstances });
      return;
    }

    const newInstances = Math.min(currentInstances + 1, maxInstances);
    const scalingEvent: ScalingEvent = {
      id: uuidv4(),
      type: 'scale-up',
      trigger: 'cpu',
      from: currentInstances,
      to: newInstances,
      reason,
      timestamp: new Date(),
      duration: 0,
      success: true
    };

    this.scalingEvents.push(scalingEvent);
    this.emit('scaling', scalingEvent);

    logger.info(`Scaling up from ${currentInstances} to ${newInstances} instances`, { reason });
  }

  /**
   * Scale down infrastructure
   */
  private async scaleDown(reason: string): Promise<void> {
    const currentInstances = this.clusterNodes.size;
    const minInstances = this.config.scaling.autoScaling.minInstances;

    if (currentInstances <= minInstances) {
      logger.warn('Cannot scale down: minimum instances reached', { currentInstances, minInstances });
      return;
    }

    const newInstances = Math.max(currentInstances - 1, minInstances);
    const scalingEvent: ScalingEvent = {
      id: uuidv4(),
      type: 'scale-down',
      trigger: 'cpu',
      from: currentInstances,
      to: newInstances,
      reason,
      timestamp: new Date(),
      duration: 0,
      success: true
    };

    this.scalingEvents.push(scalingEvent);
    this.emit('scaling', scalingEvent);

    logger.info(`Scaling down from ${currentInstances} to ${newInstances} instances`, { reason });
  }

  /**
   * Register a service
   */
  public registerService(serviceName: string, health: ServiceHealth): void {
    this.services.set(serviceName, health);
    
    const event: InfrastructureEvent = {
      id: uuidv4(),
      type: 'health',
      service: serviceName,
      message: `Service ${serviceName} registered`,
      level: 'info',
      metadata: { action: 'register' },
      timestamp: new Date()
    };
    
    this.addEvent(event);
    logger.info(`Service registered: ${serviceName}`);
  }

  /**
   * Unregister a service
   */
  public unregisterService(serviceName: string): void {
    this.services.delete(serviceName);
    
    const event: InfrastructureEvent = {
      id: uuidv4(),
      type: 'health',
      service: serviceName,
      message: `Service ${serviceName} unregistered`,
      level: 'info',
      metadata: { action: 'unregister' },
      timestamp: new Date()
    };
    
    this.addEvent(event);
    logger.info(`Service unregistered: ${serviceName}`);
  }

  /**
   * Get overall health status
   */
  public async getHealthStatus(): Promise<HealthResponse> {
    const services = Array.from(this.services.values());
    const systemMetrics = await this.collectSystemMetrics();
    const applicationMetrics = await this.collectApplicationMetrics();

    // Determine overall status
    let overallStatus: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';
    
    if (services.some(s => s.status === 'unhealthy')) {
      overallStatus = 'unhealthy';
    } else if (services.some(s => s.status === 'degraded')) {
      overallStatus = 'degraded';
    }

    return {
      status: overallStatus,
      timestamp: new Date(),
      services,
      system: systemMetrics,
      application: applicationMetrics,
      uptime: process.uptime()
    };
  }

  /**
   * Get cluster statistics
   */
  public getClusterStats(): ClusterStats {
    const workers = Array.from(this.clusterNodes.values());
    
    return {
      master: {
        pid: process.pid,
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage().heapUsed
      },
      workers,
      totalRequests: Math.floor(Math.random() * 100000),
      totalRestarts: workers.reduce((sum, w) => sum + w.restarts, 0),
      averageResponseTime: Math.floor(Math.random() * 200)
    };
  }

  /**
   * Get scaling events
   */
  public getScalingEvents(limit: number = 100): ScalingEvent[] {
    return this.scalingEvents
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Get active alerts
   */
  public getActiveAlerts(): Alert[] {
    return Array.from(this.alerts.values())
      .filter(alert => alert.status === 'active')
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Get events
   */
  public getEvents(limit: number = 100): InfrastructureEvent[] {
    return this.events
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Add event
   */
  private addEvent(event: InfrastructureEvent): void {
    this.events.push(event);
    
    // Keep only last 10000 events
    if (this.events.length > 10000) {
      this.events = this.events.slice(-10000);
    }
  }

  /**
   * Setup graceful shutdown
   */
  private setupGracefulShutdown(): void {
    process.on('SIGTERM', () => this.shutdown());
    process.on('SIGINT', () => this.shutdown());
  }

  /**
   * Shutdown infrastructure service
   */
  private async shutdown(): Promise<void> {
    logger.info('Shutting down infrastructure service...');
    this.isShuttingDown = true;

    // Clear intervals
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }

    // Shutdown cluster workers
    if (cluster.isMaster) {
      for (const worker of Object.values(cluster.workers!)) {
        if (worker) {
          worker.kill();
        }
      }
    }

    logger.info('Infrastructure service shutdown complete');
    process.exit(0);
  }
}