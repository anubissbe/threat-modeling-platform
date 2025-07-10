import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import http from 'http';
import https from 'https';
import { logger } from '../utils/logger';
import {
  LoadBalancerConfig,
  LoadBalancerServer,
  LoadBalancerStats,
  ServiceHealth
} from '../types/infrastructure';

export class LoadBalancerService extends EventEmitter {
  private config: LoadBalancerConfig;
  private servers: Map<string, LoadBalancerServer> = new Map();
  private currentServerIndex = 0;
  private connectionCounts: Map<string, number> = new Map();
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private stats: LoadBalancerStats;

  constructor(config: LoadBalancerConfig) {
    super();
    this.config = config;
    this.stats = this.initializeStats();
    this.startHealthChecks();
    
    logger.info('Load balancer service initialized', {
      algorithm: config.algorithm,
      healthCheck: config.healthCheck.enabled,
      stickySession: config.sticky
    });
  }

  /**
   * Initialize load balancer statistics
   */
  private initializeStats(): LoadBalancerStats {
    return {
      totalRequests: 0,
      totalConnections: 0,
      activeConnections: 0,
      averageResponseTime: 0,
      errorRate: 0,
      servers: [],
      algorithm: this.config.algorithm,
      uptime: Date.now()
    };
  }

  /**
   * Add server to load balancer
   */
  public addServer(host: string, port: number, weight: number = 1): string {
    const serverId = uuidv4();
    const server: LoadBalancerServer = {
      id: serverId,
      host,
      port,
      weight,
      status: 'active',
      health: 'healthy',
      connections: 0,
      responseTime: 0,
      lastHealthCheck: new Date()
    };

    this.servers.set(serverId, server);
    this.connectionCounts.set(serverId, 0);
    
    logger.info(`Server added to load balancer: ${host}:${port}`, { serverId, weight });
    this.emit('serverAdded', server);
    
    return serverId;
  }

  /**
   * Remove server from load balancer
   */
  public removeServer(serverId: string): boolean {
    const server = this.servers.get(serverId);
    if (!server) {
      return false;
    }

    this.servers.delete(serverId);
    this.connectionCounts.delete(serverId);
    
    logger.info(`Server removed from load balancer: ${server.host}:${server.port}`, { serverId });
    this.emit('serverRemoved', server);
    
    return true;
  }

  /**
   * Get next server based on load balancing algorithm
   */
  public getNextServer(): LoadBalancerServer | null {
    const healthyServers = Array.from(this.servers.values())
      .filter(server => server.status === 'active' && server.health === 'healthy');

    if (healthyServers.length === 0) {
      logger.warn('No healthy servers available for load balancing');
      return null;
    }

    switch (this.config.algorithm) {
      case 'round-robin':
        return this.roundRobinSelection(healthyServers);
      case 'least-connections':
        return this.leastConnectionsSelection(healthyServers);
      case 'weighted-round-robin':
        return this.weightedRoundRobinSelection(healthyServers);
      case 'ip-hash':
        return this.ipHashSelection(healthyServers);
      default:
        return this.roundRobinSelection(healthyServers);
    }
  }

  /**
   * Round-robin server selection
   */
  private roundRobinSelection(servers: LoadBalancerServer[]): LoadBalancerServer {
    const server = servers[this.currentServerIndex % servers.length];
    this.currentServerIndex++;
    return server;
  }

  /**
   * Least connections server selection
   */
  private leastConnectionsSelection(servers: LoadBalancerServer[]): LoadBalancerServer {
    return servers.reduce((leastConnected, current) => {
      return current.connections < leastConnected.connections ? current : leastConnected;
    });
  }

  /**
   * Weighted round-robin server selection
   */
  private weightedRoundRobinSelection(servers: LoadBalancerServer[]): LoadBalancerServer {
    const weightedServers: LoadBalancerServer[] = [];
    
    servers.forEach(server => {
      for (let i = 0; i < server.weight; i++) {
        weightedServers.push(server);
      }
    });

    return this.roundRobinSelection(weightedServers);
  }

  /**
   * IP hash server selection
   */
  private ipHashSelection(servers: LoadBalancerServer[], clientIp?: string): LoadBalancerServer {
    if (!clientIp) {
      return this.roundRobinSelection(servers);
    }

    // Simple hash function for IP
    const hash = clientIp.split('.').reduce((acc, octet) => acc + parseInt(octet), 0);
    const index = hash % servers.length;
    return servers[index];
  }

  /**
   * Update server connection count
   */
  public updateServerConnections(serverId: string, increment: number): void {
    const server = this.servers.get(serverId);
    if (server) {
      server.connections += increment;
      const currentCount = this.connectionCounts.get(serverId) || 0;
      this.connectionCounts.set(serverId, currentCount + increment);
      
      // Update stats
      this.stats.activeConnections = Array.from(this.servers.values())
        .reduce((sum, s) => sum + s.connections, 0);
    }
  }

  /**
   * Update server response time
   */
  public updateServerResponseTime(serverId: string, responseTime: number): void {
    const server = this.servers.get(serverId);
    if (server) {
      server.responseTime = responseTime;
      
      // Update average response time
      const allResponseTimes = Array.from(this.servers.values())
        .map(s => s.responseTime)
        .filter(rt => rt > 0);
      
      if (allResponseTimes.length > 0) {
        this.stats.averageResponseTime = allResponseTimes.reduce((sum, rt) => sum + rt, 0) / allResponseTimes.length;
      }
    }
  }

  /**
   * Start health checks
   */
  private startHealthChecks(): void {
    if (!this.config.healthCheck.enabled) {
      return;
    }

    this.healthCheckInterval = setInterval(() => {
      this.performHealthChecks();
    }, this.config.healthCheck.interval);

    logger.info('Health checks started', { interval: this.config.healthCheck.interval });
  }

  /**
   * Perform health checks on all servers
   */
  private async performHealthChecks(): Promise<void> {
    const servers = Array.from(this.servers.values());
    
    for (const server of servers) {
      try {
        const isHealthy = await this.checkServerHealth(server);
        this.updateServerHealth(server.id, isHealthy);
      } catch (error) {
        logger.error(`Health check failed for server ${server.host}:${server.port}`, error);
        this.updateServerHealth(server.id, false);
      }
    }
  }

  /**
   * Check health of a specific server
   */
  private async checkServerHealth(server: LoadBalancerServer): Promise<boolean> {
    return new Promise((resolve) => {
      const protocol = this.config.ssl.enabled ? https : http;
      const options = {
        hostname: server.host,
        port: server.port,
        path: this.config.healthCheck.path,
        method: 'GET',
        timeout: this.config.healthCheck.timeout
      };

      const startTime = Date.now();
      const req = protocol.request(options, (res) => {
        const responseTime = Date.now() - startTime;
        this.updateServerResponseTime(server.id, responseTime);
        
        // Consider 2xx and 3xx as healthy
        const isHealthy = res.statusCode !== undefined && res.statusCode < 400;
        resolve(isHealthy);
      });

      req.on('error', () => {
        resolve(false);
      });

      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });

      req.end();
    });
  }

  /**
   * Update server health status
   */
  private updateServerHealth(serverId: string, isHealthy: boolean): void {
    const server = this.servers.get(serverId);
    if (!server) {
      return;
    }

    const previousHealth = server.health;
    server.health = isHealthy ? 'healthy' : 'unhealthy';
    server.lastHealthCheck = new Date();

    // Handle health state changes
    if (previousHealth !== server.health) {
      this.handleHealthStateChange(server, previousHealth, server.health);
    }

    this.servers.set(serverId, server);
  }

  /**
   * Handle server health state changes
   */
  private handleHealthStateChange(server: LoadBalancerServer, from: string, to: string): void {
    logger.info(`Server health changed: ${server.host}:${server.port} ${from} -> ${to}`);
    
    // Implement health threshold logic
    if (to === 'unhealthy') {
      server.status = 'inactive';
      this.emit('serverUnhealthy', server);
    } else if (to === 'healthy' && from === 'unhealthy') {
      server.status = 'active';
      this.emit('serverHealthy', server);
    }
  }

  /**
   * Set server maintenance mode
   */
  public setServerMaintenance(serverId: string, maintenance: boolean): boolean {
    const server = this.servers.get(serverId);
    if (!server) {
      return false;
    }

    server.status = maintenance ? 'maintenance' : 'active';
    this.servers.set(serverId, server);
    
    logger.info(`Server ${maintenance ? 'entering' : 'exiting'} maintenance mode: ${server.host}:${server.port}`);
    this.emit('serverMaintenance', { server, maintenance });
    
    return true;
  }

  /**
   * Get load balancer statistics
   */
  public getStats(): LoadBalancerStats {
    const servers = Array.from(this.servers.values());
    
    return {
      ...this.stats,
      servers,
      totalConnections: Array.from(this.connectionCounts.values())
        .reduce((sum, count) => sum + count, 0),
      uptime: Date.now() - this.stats.uptime
    };
  }

  /**
   * Get server by ID
   */
  public getServer(serverId: string): LoadBalancerServer | undefined {
    return this.servers.get(serverId);
  }

  /**
   * Get all servers
   */
  public getServers(): LoadBalancerServer[] {
    return Array.from(this.servers.values());
  }

  /**
   * Get healthy servers
   */
  public getHealthyServers(): LoadBalancerServer[] {
    return Array.from(this.servers.values())
      .filter(server => server.status === 'active' && server.health === 'healthy');
  }

  /**
   * Update statistics
   */
  public updateStats(requests: number, errors: number): void {
    this.stats.totalRequests += requests;
    
    if (requests > 0) {
      this.stats.errorRate = errors / requests;
    }
  }

  /**
   * Proxy request to selected server
   */
  public async proxyRequest(req: http.IncomingMessage, res: http.ServerResponse, clientIp?: string): Promise<void> {
    const server = this.getNextServer();
    if (!server) {
      res.statusCode = 503;
      res.end('Service Unavailable');
      return;
    }

    const startTime = Date.now();
    this.updateServerConnections(server.id, 1);

    try {
      await this.forwardRequest(req, res, server);
      this.updateStats(1, 0);
    } catch (error) {
      logger.error(`Request forwarding failed for server ${server.host}:${server.port}`, error);
      this.updateStats(1, 1);
      
      if (!res.headersSent) {
        res.statusCode = 500;
        res.end('Internal Server Error');
      }
    } finally {
      const responseTime = Date.now() - startTime;
      this.updateServerResponseTime(server.id, responseTime);
      this.updateServerConnections(server.id, -1);
    }
  }

  /**
   * Forward request to target server
   */
  private async forwardRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    server: LoadBalancerServer
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const protocol = this.config.ssl.enabled ? https : http;
      const options = {
        hostname: server.host,
        port: server.port,
        path: req.url,
        method: req.method,
        headers: req.headers
      };

      const proxyReq = protocol.request(options, (proxyRes) => {
        res.statusCode = proxyRes.statusCode || 200;
        
        // Copy headers
        Object.keys(proxyRes.headers).forEach(key => {
          const value = proxyRes.headers[key];
          if (value) {
            res.setHeader(key, value);
          }
        });

        proxyRes.pipe(res);
        proxyRes.on('end', resolve);
      });

      proxyReq.on('error', reject);
      req.pipe(proxyReq);
    });
  }

  /**
   * Shutdown load balancer
   */
  public shutdown(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    logger.info('Load balancer service shutdown');
  }
}