import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import { InfrastructureService } from '../services/infrastructure.service';
import { LoadBalancerService } from '../services/load-balancer.service';
import { CacheService } from '../services/cache.service';
import {
  InfrastructureResponse,
  InfrastructureRequest,
  ScaleRequest,
  ConfigUpdateRequest
} from '../types/infrastructure';

export class InfrastructureController {
  private infrastructureService: InfrastructureService;
  private loadBalancerService: LoadBalancerService;
  private cacheService: CacheService;

  constructor(
    infrastructureService: InfrastructureService,
    loadBalancerService: LoadBalancerService,
    cacheService: CacheService
  ) {
    this.infrastructureService = infrastructureService;
    this.loadBalancerService = loadBalancerService;
    this.cacheService = cacheService;
  }

  /**
   * Get overall infrastructure health
   */
  public async getHealth(req: InfrastructureRequest, res: Response): Promise<void> {
    try {
      const health = await this.infrastructureService.getHealthStatus();
      
      res.json({
        success: true,
        data: health,
        timestamp: new Date(),
        requestId: req.requestId
      } as InfrastructureResponse);
    } catch (error) {
      logger.error('Health check failed', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get health status',
        timestamp: new Date(),
        requestId: req.requestId
      } as InfrastructureResponse);
    }
  }

  /**
   * Get cluster statistics
   */
  public async getClusterStats(req: InfrastructureRequest, res: Response): Promise<void> {
    try {
      const stats = this.infrastructureService.getClusterStats();
      
      res.json({
        success: true,
        data: stats,
        timestamp: new Date(),
        requestId: req.requestId
      } as InfrastructureResponse);
    } catch (error) {
      logger.error('Failed to get cluster stats', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get cluster statistics',
        timestamp: new Date(),
        requestId: req.requestId
      } as InfrastructureResponse);
    }
  }

  /**
   * Get load balancer statistics
   */
  public async getLoadBalancerStats(req: InfrastructureRequest, res: Response): Promise<void> {
    try {
      const stats = this.loadBalancerService.getStats();
      
      res.json({
        success: true,
        data: stats,
        timestamp: new Date(),
        requestId: req.requestId
      } as InfrastructureResponse);
    } catch (error) {
      logger.error('Failed to get load balancer stats', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get load balancer statistics',
        timestamp: new Date(),
        requestId: req.requestId
      } as InfrastructureResponse);
    }
  }

  /**
   * Get cache statistics
   */
  public async getCacheStats(req: InfrastructureRequest, res: Response): Promise<void> {
    try {
      const stats = this.cacheService.getStats();
      
      res.json({
        success: true,
        data: stats,
        timestamp: new Date(),
        requestId: req.requestId
      } as InfrastructureResponse);
    } catch (error) {
      logger.error('Failed to get cache stats', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get cache statistics',
        timestamp: new Date(),
        requestId: req.requestId
      } as InfrastructureResponse);
    }
  }

  /**
   * Get scaling events
   */
  public async getScalingEvents(req: InfrastructureRequest, res: Response): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const events = this.infrastructureService.getScalingEvents(limit);
      
      res.json({
        success: true,
        data: events,
        timestamp: new Date(),
        requestId: req.requestId
      } as InfrastructureResponse);
    } catch (error) {
      logger.error('Failed to get scaling events', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get scaling events',
        timestamp: new Date(),
        requestId: req.requestId
      } as InfrastructureResponse);
    }
  }

  /**
   * Get active alerts
   */
  public async getActiveAlerts(req: InfrastructureRequest, res: Response): Promise<void> {
    try {
      const alerts = this.infrastructureService.getActiveAlerts();
      
      res.json({
        success: true,
        data: alerts,
        timestamp: new Date(),
        requestId: req.requestId
      } as InfrastructureResponse);
    } catch (error) {
      logger.error('Failed to get active alerts', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get active alerts',
        timestamp: new Date(),
        requestId: req.requestId
      } as InfrastructureResponse);
    }
  }

  /**
   * Get infrastructure events
   */
  public async getEvents(req: InfrastructureRequest, res: Response): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const events = this.infrastructureService.getEvents(limit);
      
      res.json({
        success: true,
        data: events,
        timestamp: new Date(),
        requestId: req.requestId
      } as InfrastructureResponse);
    } catch (error) {
      logger.error('Failed to get events', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get events',
        timestamp: new Date(),
        requestId: req.requestId
      } as InfrastructureResponse);
    }
  }

  /**
   * Scale infrastructure
   */
  public async scaleInfrastructure(req: InfrastructureRequest, res: Response): Promise<void> {
    try {
      const scaleRequest: ScaleRequest = req.body;
      
      // Validate scale request
      if (!scaleRequest.service || !scaleRequest.instances) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields: service and instances',
          timestamp: new Date(),
          requestId: req.requestId
        } as InfrastructureResponse);
        return;
      }

      // Simulate scaling operation
      logger.info(`Scaling ${scaleRequest.service} to ${scaleRequest.instances} instances`, {
        reason: scaleRequest.reason,
        force: scaleRequest.force
      });

      res.json({
        success: true,
        data: {
          service: scaleRequest.service,
          instances: scaleRequest.instances,
          status: 'scaling',
          message: `Scaling ${scaleRequest.service} to ${scaleRequest.instances} instances`
        },
        timestamp: new Date(),
        requestId: req.requestId
      } as InfrastructureResponse);
    } catch (error) {
      logger.error('Failed to scale infrastructure', error);
      res.status(500).json({
        success: false,
        error: 'Failed to scale infrastructure',
        timestamp: new Date(),
        requestId: req.requestId
      } as InfrastructureResponse);
    }
  }

  /**
   * Add server to load balancer
   */
  public async addServer(req: InfrastructureRequest, res: Response): Promise<void> {
    try {
      const { host, port, weight } = req.body;
      
      if (!host || !port) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields: host and port',
          timestamp: new Date(),
          requestId: req.requestId
        } as InfrastructureResponse);
        return;
      }

      const serverId = this.loadBalancerService.addServer(host, port, weight || 1);
      
      res.json({
        success: true,
        data: {
          serverId,
          host,
          port,
          weight: weight || 1,
          status: 'added'
        },
        timestamp: new Date(),
        requestId: req.requestId
      } as InfrastructureResponse);
    } catch (error) {
      logger.error('Failed to add server', error);
      res.status(500).json({
        success: false,
        error: 'Failed to add server',
        timestamp: new Date(),
        requestId: req.requestId
      } as InfrastructureResponse);
    }
  }

  /**
   * Remove server from load balancer
   */
  public async removeServer(req: InfrastructureRequest, res: Response): Promise<void> {
    try {
      const { serverId } = req.params;
      
      const removed = this.loadBalancerService.removeServer(serverId);
      
      if (!removed) {
        res.status(404).json({
          success: false,
          error: 'Server not found',
          timestamp: new Date(),
          requestId: req.requestId
        } as InfrastructureResponse);
        return;
      }

      res.json({
        success: true,
        data: {
          serverId,
          status: 'removed'
        },
        timestamp: new Date(),
        requestId: req.requestId
      } as InfrastructureResponse);
    } catch (error) {
      logger.error('Failed to remove server', error);
      res.status(500).json({
        success: false,
        error: 'Failed to remove server',
        timestamp: new Date(),
        requestId: req.requestId
      } as InfrastructureResponse);
    }
  }

  /**
   * Set server maintenance mode
   */
  public async setServerMaintenance(req: InfrastructureRequest, res: Response): Promise<void> {
    try {
      const { serverId } = req.params;
      const { maintenance } = req.body;
      
      const updated = this.loadBalancerService.setServerMaintenance(serverId, maintenance);
      
      if (!updated) {
        res.status(404).json({
          success: false,
          error: 'Server not found',
          timestamp: new Date(),
          requestId: req.requestId
        } as InfrastructureResponse);
        return;
      }

      res.json({
        success: true,
        data: {
          serverId,
          maintenance,
          status: 'updated'
        },
        timestamp: new Date(),
        requestId: req.requestId
      } as InfrastructureResponse);
    } catch (error) {
      logger.error('Failed to set server maintenance', error);
      res.status(500).json({
        success: false,
        error: 'Failed to set server maintenance',
        timestamp: new Date(),
        requestId: req.requestId
      } as InfrastructureResponse);
    }
  }

  /**
   * Get cache value
   */
  public async getCacheValue(req: InfrastructureRequest, res: Response): Promise<void> {
    try {
      const { key } = req.params;
      const value = await this.cacheService.get(key);
      
      if (value === null) {
        res.status(404).json({
          success: false,
          error: 'Key not found',
          timestamp: new Date(),
          requestId: req.requestId
        } as InfrastructureResponse);
        return;
      }

      res.json({
        success: true,
        data: {
          key,
          value
        },
        timestamp: new Date(),
        requestId: req.requestId
      } as InfrastructureResponse);
    } catch (error) {
      logger.error('Failed to get cache value', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get cache value',
        timestamp: new Date(),
        requestId: req.requestId
      } as InfrastructureResponse);
    }
  }

  /**
   * Set cache value
   */
  public async setCacheValue(req: InfrastructureRequest, res: Response): Promise<void> {
    try {
      const { key } = req.params;
      const { value, ttl } = req.body;
      
      const success = await this.cacheService.set(key, value, ttl);
      
      if (!success) {
        res.status(500).json({
          success: false,
          error: 'Failed to set cache value',
          timestamp: new Date(),
          requestId: req.requestId
        } as InfrastructureResponse);
        return;
      }

      res.json({
        success: true,
        data: {
          key,
          value,
          ttl,
          status: 'set'
        },
        timestamp: new Date(),
        requestId: req.requestId
      } as InfrastructureResponse);
    } catch (error) {
      logger.error('Failed to set cache value', error);
      res.status(500).json({
        success: false,
        error: 'Failed to set cache value',
        timestamp: new Date(),
        requestId: req.requestId
      } as InfrastructureResponse);
    }
  }

  /**
   * Delete cache value
   */
  public async deleteCacheValue(req: InfrastructureRequest, res: Response): Promise<void> {
    try {
      const { key } = req.params;
      const deleted = await this.cacheService.delete(key);
      
      if (!deleted) {
        res.status(404).json({
          success: false,
          error: 'Key not found',
          timestamp: new Date(),
          requestId: req.requestId
        } as InfrastructureResponse);
        return;
      }

      res.json({
        success: true,
        data: {
          key,
          status: 'deleted'
        },
        timestamp: new Date(),
        requestId: req.requestId
      } as InfrastructureResponse);
    } catch (error) {
      logger.error('Failed to delete cache value', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete cache value',
        timestamp: new Date(),
        requestId: req.requestId
      } as InfrastructureResponse);
    }
  }

  /**
   * Clear cache
   */
  public async clearCache(req: InfrastructureRequest, res: Response): Promise<void> {
    try {
      const success = await this.cacheService.clear();
      
      if (!success) {
        res.status(500).json({
          success: false,
          error: 'Failed to clear cache',
          timestamp: new Date(),
          requestId: req.requestId
        } as InfrastructureResponse);
        return;
      }

      res.json({
        success: true,
        data: {
          status: 'cleared'
        },
        timestamp: new Date(),
        requestId: req.requestId
      } as InfrastructureResponse);
    } catch (error) {
      logger.error('Failed to clear cache', error);
      res.status(500).json({
        success: false,
        error: 'Failed to clear cache',
        timestamp: new Date(),
        requestId: req.requestId
      } as InfrastructureResponse);
    }
  }

  /**
   * Get infrastructure dashboard
   */
  public async getDashboard(req: InfrastructureRequest, res: Response): Promise<void> {
    try {
      const [health, clusterStats, loadBalancerStats, cacheStats, scalingEvents, alerts] = await Promise.all([
        this.infrastructureService.getHealthStatus(),
        this.infrastructureService.getClusterStats(),
        this.loadBalancerService.getStats(),
        this.cacheService.getStats(),
        this.infrastructureService.getScalingEvents(10),
        this.infrastructureService.getActiveAlerts()
      ]);

      const dashboard = {
        health,
        cluster: clusterStats,
        loadBalancer: loadBalancerStats,
        cache: cacheStats,
        scaling: {
          recentEvents: scalingEvents,
          totalEvents: scalingEvents.length
        },
        alerts: {
          active: alerts,
          count: alerts.length
        },
        timestamp: new Date()
      };

      res.json({
        success: true,
        data: dashboard,
        timestamp: new Date(),
        requestId: req.requestId
      } as InfrastructureResponse);
    } catch (error) {
      logger.error('Failed to get dashboard', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get dashboard',
        timestamp: new Date(),
        requestId: req.requestId
      } as InfrastructureResponse);
    }
  }
}