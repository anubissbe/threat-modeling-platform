/**
 * World-Class Performance Monitor Service
 * 
 * Provides real-time performance monitoring capabilities:
 * - System resource monitoring
 * - Application performance tracking
 * - Real-time metrics collection
 * - Performance analytics
 * - Alert management
 * - Historical data analysis
 */

import { logger } from '../utils/logger';
import { PerformanceMetrics, RequestMetric, AlertConfig, PerformanceAlert } from '../types/performance.types';
import { EventEmitter } from 'events';
import pidusage from 'pidusage';
import si from 'systeminformation';

export class PerformanceMonitor extends EventEmitter {
  private metrics: PerformanceMetrics[] = [];
  private requestMetrics: RequestMetric[] = [];
  private alerts: PerformanceAlert[] = [];
  private alertConfigs: AlertConfig[] = [];
  private isMonitoring = false;
  private monitoringInterval: NodeJS.Timeout | null = null;
  
  private readonly defaultAlertConfigs: AlertConfig[] = [
    {
      id: 'high-cpu',
      name: 'High CPU Usage',
      metric: 'cpu.usage',
      threshold: 80,
      operator: '>',
      severity: 'warning',
      enabled: true,
    },
    {
      id: 'high-memory',
      name: 'High Memory Usage',
      metric: 'memory.usage',
      threshold: 85,
      operator: '>',
      severity: 'critical',
      enabled: true,
    },
    {
      id: 'slow-response',
      name: 'Slow Response Time',
      metric: 'responseTime.average',
      threshold: 2000,
      operator: '>',
      severity: 'warning',
      enabled: true,
    },
    {
      id: 'low-throughput',
      name: 'Low Throughput',
      metric: 'throughput.current',
      threshold: 50,
      operator: '<',
      severity: 'warning',
      enabled: true,
    },
    {
      id: 'high-error-rate',
      name: 'High Error Rate',
      metric: 'errors.rate',
      threshold: 5,
      operator: '>',
      severity: 'critical',
      enabled: true,
    },
  ];

  constructor() {
    super();
    this.alertConfigs = [...this.defaultAlertConfigs];
  }

  async start(): Promise<void> {
    if (this.isMonitoring) {
      logger.warn('Performance monitoring already started');
      return;
    }

    logger.info('Starting performance monitoring...');
    this.isMonitoring = true;
    
    // Start monitoring interval
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.collectMetrics();
      } catch (error) {
        logger.error('Error collecting metrics:', error);
      }
    }, 5000); // Collect metrics every 5 seconds

    logger.info('✅ Performance monitoring started');
  }

  async stop(): Promise<void> {
    if (!this.isMonitoring) {
      return;
    }

    logger.info('Stopping performance monitoring...');
    this.isMonitoring = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    logger.info('Performance monitoring stopped');
  }

  async collectMetrics(): Promise<PerformanceMetrics> {
    try {
      const metrics = await this.getCurrentMetrics();
      
      // Store metrics (keep last 1000 entries)
      this.metrics.push(metrics);
      if (this.metrics.length > 1000) {
        this.metrics = this.metrics.slice(-1000);
      }
      
      // Check alerts
      await this.checkAlerts(metrics);
      
      // Emit metrics event
      this.emit('metrics', metrics);
      
      return metrics;

    } catch (error) {
      logger.error('Error collecting metrics:', error);
      throw error;
    }
  }

  recordRequest(requestMetric: RequestMetric): void {
    // Store request metrics (keep last 10000 entries)
    this.requestMetrics.push(requestMetric);
    if (this.requestMetrics.length > 10000) {
      this.requestMetrics = this.requestMetrics.slice(-10000);
    }
    
    // Emit request metric event
    this.emit('request', requestMetric);
  }

  async getLiveMetrics(): Promise<PerformanceMetrics> {
    return await this.getCurrentMetrics();
  }

  async getMetricsHistory(minutes: number = 60): Promise<PerformanceMetrics[]> {
    const cutoff = new Date(Date.now() - minutes * 60 * 1000);
    return this.metrics.filter(m => m.timestamp > cutoff);
  }

  async getRequestMetrics(minutes: number = 60): Promise<RequestMetric[]> {
    const cutoff = new Date(Date.now() - minutes * 60 * 1000);
    return this.requestMetrics.filter(m => m.timestamp > cutoff);
  }

  async getAnalyticsDashboard(): Promise<any> {
    try {
      const currentMetrics = await this.getCurrentMetrics();
      const historyMetrics = await this.getMetricsHistory(60);
      const requestMetrics = await this.getRequestMetrics(60);
      
      // Calculate trends
      const trends = this.calculateTrends(historyMetrics);
      
      // Calculate request statistics
      const requestStats = this.calculateRequestStats(requestMetrics);
      
      // Get top issues
      const topIssues = this.getTopIssues(currentMetrics);
      
      // Performance score
      const performanceScore = this.calculatePerformanceScore(currentMetrics);

      return {
        current: currentMetrics,
        trends,
        requests: requestStats,
        topIssues,
        performanceScore,
        alerts: {
          active: this.getActiveAlerts(),
          total: this.alerts.length,
          critical: this.alerts.filter(a => a.severity === 'critical').length,
        },
        summary: {
          uptime: process.uptime(),
          totalRequests: this.requestMetrics.length,
          avgResponseTime: requestStats.averageResponseTime,
          errorRate: requestStats.errorRate,
          throughput: requestStats.throughput,
        },
      };

    } catch (error) {
      logger.error('Error getting analytics dashboard:', error);
      throw error;
    }
  }

  async getHealthStatus(): Promise<any> {
    try {
      const metrics = await this.getCurrentMetrics();
      const activeAlerts = this.getActiveAlerts();
      
      const health = {
        status: this.determineHealthStatus(metrics, activeAlerts),
        cpu: {
          usage: metrics.cpu.usage,
          status: metrics.cpu.usage < 80 ? 'good' : metrics.cpu.usage < 90 ? 'warning' : 'critical',
        },
        memory: {
          usage: metrics.memory.usage,
          status: metrics.memory.usage < 85 ? 'good' : metrics.memory.usage < 95 ? 'warning' : 'critical',
        },
        responseTime: {
          average: metrics.responseTime.average,
          status: metrics.responseTime.average < 1000 ? 'good' : metrics.responseTime.average < 2000 ? 'warning' : 'critical',
        },
        throughput: {
          current: metrics.throughput.current,
          status: metrics.throughput.current > 100 ? 'good' : metrics.throughput.current > 50 ? 'warning' : 'critical',
        },
        errors: {
          rate: metrics.errors.rate,
          status: metrics.errors.rate < 1 ? 'good' : metrics.errors.rate < 5 ? 'warning' : 'critical',
        },
        alerts: {
          active: activeAlerts.length,
          critical: activeAlerts.filter(a => a.severity === 'critical').length,
        },
        uptime: process.uptime(),
        monitoring: this.isMonitoring,
      };

      return health;

    } catch (error) {
      logger.error('Error getting health status:', error);
      throw error;
    }
  }

  async configureAlerts(alertConfig: AlertConfig[]): Promise<void> {
    try {
      this.alertConfigs = [...alertConfig];
      logger.info(`Configured ${alertConfig.length} alert rules`);
    } catch (error) {
      logger.error('Error configuring alerts:', error);
      throw error;
    }
  }

  getActiveAlerts(): PerformanceAlert[] {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    return this.alerts.filter(alert => 
      alert.timestamp > fiveMinutesAgo && !alert.resolved
    );
  }

  private async getCurrentMetrics(): Promise<PerformanceMetrics> {
    try {
      // System metrics
      const cpuInfo = await si.currentLoad();
      const memInfo = await si.mem();
      const processInfo = await pidusage(process.pid);
      const networkStats = await si.networkStats();
      const diskInfo = await si.fsSize();

      // Calculate request metrics from recent data
      const recentRequests = this.requestMetrics.filter(
        r => r.timestamp > new Date(Date.now() - 60000) // Last minute
      );

      const responseTime = this.calculateResponseTimeMetrics(recentRequests);
      const throughput = this.calculateThroughputMetrics(recentRequests);
      const errors = this.calculateErrorMetrics(recentRequests);

      return {
        timestamp: new Date(),
        cpu: {
          usage: cpuInfo.currentLoad,
          cores: cpuInfo.cpus?.length || 1,
          loadAverage: [cpuInfo.avgLoad, cpuInfo.avgLoad, cpuInfo.avgLoad],
        },
        memory: {
          usage: (memInfo.used / memInfo.total) * 100,
          total: memInfo.total,
          used: memInfo.used,
          free: memInfo.free,
          heapUsed: processInfo.memory,
        },
        network: {
          bytesIn: networkStats[0]?.rx_bytes || 0,
          bytesOut: networkStats[0]?.tx_bytes || 0,
          packetsIn: networkStats[0]?.rx_sec || 0,
          packetsOut: networkStats[0]?.tx_sec || 0,
        },
        disk: {
          usage: diskInfo[0] ? ((diskInfo[0].used / diskInfo[0].size) * 100) : 0,
          total: diskInfo[0]?.size || 0,
          used: diskInfo[0]?.used || 0,
          free: diskInfo[0]?.available || 0,
        },
        responseTime,
        throughput,
        errors,
        database: await this.getDatabaseMetrics(),
        cache: await this.getCacheMetrics(),
      };

    } catch (error) {
      logger.error('Error getting current metrics:', error);
      throw error;
    }
  }

  private calculateResponseTimeMetrics(requests: RequestMetric[]): any {
    if (requests.length === 0) {
      return {
        average: 0,
        p50: 0,
        p95: 0,
        p99: 0,
      };
    }

    const durations = requests.map(r => r.duration).sort((a, b) => a - b);
    const average = durations.reduce((sum, d) => sum + d, 0) / durations.length;
    
    return {
      average,
      p50: this.percentile(durations, 0.5),
      p95: this.percentile(durations, 0.95),
      p99: this.percentile(durations, 0.99),
    };
  }

  private calculateThroughputMetrics(requests: RequestMetric[]): any {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    const recentRequests = requests.filter(r => r.timestamp.getTime() > oneMinuteAgo);
    const current = recentRequests.length; // Requests per minute
    
    return {
      current: current / 60, // Convert to requests per second
      peak: current, // Simplified - would track actual peak
      average: current / 60,
    };
  }

  private calculateErrorMetrics(requests: RequestMetric[]): any {
    if (requests.length === 0) {
      return {
        rate: 0,
        total: 0,
      };
    }

    const errorRequests = requests.filter(r => r.statusCode >= 400);
    const rate = (errorRequests.length / requests.length) * 100;

    return {
      rate,
      total: errorRequests.length,
    };
  }

  private async getDatabaseMetrics(): Promise<any> {
    // Mock database metrics - would integrate with actual database monitoring
    return {
      connections: Math.floor(Math.random() * 50 + 10),
      queryTime: Math.random() * 500 + 50,
      slowQueries: Math.floor(Math.random() * 10),
    };
  }

  private async getCacheMetrics(): Promise<any> {
    // Mock cache metrics - would integrate with actual cache monitoring
    return {
      hitRate: Math.random() * 40 + 60, // 60-100% hit rate
      missRate: Math.random() * 40,
      size: Math.random() * 1000000000, // Random cache size
    };
  }

  private async checkAlerts(metrics: PerformanceMetrics): Promise<void> {
    for (const config of this.alertConfigs) {
      if (!config.enabled) continue;

      try {
        const value = this.getMetricValue(metrics, config.metric);
        const threshold = config.threshold;
        
        let triggered = false;
        
        switch (config.operator) {
          case '>':
            triggered = value > threshold;
            break;
          case '<':
            triggered = value < threshold;
            break;
          case '>=':
            triggered = value >= threshold;
            break;
          case '<=':
            triggered = value <= threshold;
            break;
          case '==':
            triggered = value === threshold;
            break;
        }

        if (triggered) {
          await this.triggerAlert(config, value, metrics);
        }

      } catch (error) {
        logger.error(`Error checking alert ${config.id}:`, error);
      }
    }
  }

  private getMetricValue(metrics: PerformanceMetrics, metricPath: string): number {
    const parts = metricPath.split('.');
    let value: any = metrics;
    
    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        throw new Error(`Metric path not found: ${metricPath}`);
      }
    }
    
    return typeof value === 'number' ? value : 0;
  }

  private async triggerAlert(config: AlertConfig, value: number, metrics: PerformanceMetrics): Promise<void> {
    // Check if alert already exists for this config in the last 5 minutes
    const recentAlert = this.alerts.find(alert => 
      alert.configId === config.id && 
      alert.timestamp > new Date(Date.now() - 5 * 60 * 1000) &&
      !alert.resolved
    );

    if (recentAlert) {
      return; // Don't trigger duplicate alerts
    }

    const alert: PerformanceAlert = {
      id: `alert-${config.id}-${Date.now()}`,
      configId: config.id,
      name: config.name,
      severity: config.severity,
      message: `${config.name}: ${config.metric} is ${value.toFixed(2)} (threshold: ${config.threshold})`,
      metric: config.metric,
      value,
      threshold: config.threshold,
      timestamp: new Date(),
      resolved: false,
    };

    this.alerts.push(alert);
    
    // Keep only last 1000 alerts
    if (this.alerts.length > 1000) {
      this.alerts = this.alerts.slice(-1000);
    }

    // Emit alert event
    this.emit('alert', alert);
    
    logger.warn(`Performance alert triggered: ${alert.message}`);
  }

  private calculateTrends(metrics: PerformanceMetrics[]): any {
    if (metrics.length < 2) {
      return {
        cpu: 0,
        memory: 0,
        responseTime: 0,
        throughput: 0,
        errors: 0,
      };
    }

    const recent = metrics.slice(-10); // Last 10 data points
    const older = metrics.slice(-20, -10); // Previous 10 data points

    const calculateTrend = (recentValues: number[], olderValues: number[]): number => {
      if (recentValues.length === 0 || olderValues.length === 0) return 0;
      
      const recentAvg = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
      const olderAvg = olderValues.reduce((sum, val) => sum + val, 0) / olderValues.length;
      
      return olderAvg === 0 ? 0 : ((recentAvg - olderAvg) / olderAvg) * 100;
    };

    return {
      cpu: calculateTrend(
        recent.map(m => m.cpu.usage),
        older.map(m => m.cpu.usage)
      ),
      memory: calculateTrend(
        recent.map(m => m.memory.usage),
        older.map(m => m.memory.usage)
      ),
      responseTime: calculateTrend(
        recent.map(m => m.responseTime.average),
        older.map(m => m.responseTime.average)
      ),
      throughput: calculateTrend(
        recent.map(m => m.throughput.current),
        older.map(m => m.throughput.current)
      ),
      errors: calculateTrend(
        recent.map(m => m.errors.rate),
        older.map(m => m.errors.rate)
      ),
    };
  }

  private calculateRequestStats(requests: RequestMetric[]): any {
    if (requests.length === 0) {
      return {
        total: 0,
        averageResponseTime: 0,
        errorRate: 0,
        throughput: 0,
        statusCodes: {},
        methods: {},
        slowestEndpoints: [],
      };
    }

    const total = requests.length;
    const averageResponseTime = requests.reduce((sum, r) => sum + r.duration, 0) / total;
    const errorRequests = requests.filter(r => r.statusCode >= 400);
    const errorRate = (errorRequests.length / total) * 100;
    const throughput = total / 60; // Assuming 1 hour of data, convert to per minute

    // Group by status codes
    const statusCodes: { [key: string]: number } = {};
    requests.forEach(r => {
      statusCodes[r.statusCode] = (statusCodes[r.statusCode] || 0) + 1;
    });

    // Group by methods
    const methods: { [key: string]: number } = {};
    requests.forEach(r => {
      methods[r.method] = (methods[r.method] || 0) + 1;
    });

    // Find slowest endpoints
    const endpointStats: { [key: string]: { total: number; avgTime: number; count: number } } = {};
    requests.forEach(r => {
      if (!endpointStats[r.path]) {
        endpointStats[r.path] = { total: 0, avgTime: 0, count: 0 };
      }
      endpointStats[r.path].total += r.duration;
      endpointStats[r.path].count += 1;
      endpointStats[r.path].avgTime = endpointStats[r.path].total / endpointStats[r.path].count;
    });

    const slowestEndpoints = Object.entries(endpointStats)
      .sort(([, a], [, b]) => b.avgTime - a.avgTime)
      .slice(0, 10)
      .map(([path, stats]) => ({ path, avgTime: stats.avgTime, count: stats.count }));

    return {
      total,
      averageResponseTime,
      errorRate,
      throughput,
      statusCodes,
      methods,
      slowestEndpoints,
    };
  }

  private getTopIssues(metrics: PerformanceMetrics): any[] {
    const issues: any[] = [];

    if (metrics.cpu.usage > 80) {
      issues.push({
        type: 'cpu',
        severity: metrics.cpu.usage > 90 ? 'critical' : 'warning',
        message: `High CPU usage: ${metrics.cpu.usage.toFixed(1)}%`,
        value: metrics.cpu.usage,
      });
    }

    if (metrics.memory.usage > 85) {
      issues.push({
        type: 'memory',
        severity: metrics.memory.usage > 95 ? 'critical' : 'warning',
        message: `High memory usage: ${metrics.memory.usage.toFixed(1)}%`,
        value: metrics.memory.usage,
      });
    }

    if (metrics.responseTime.average > 1000) {
      issues.push({
        type: 'response-time',
        severity: metrics.responseTime.average > 2000 ? 'critical' : 'warning',
        message: `Slow response time: ${metrics.responseTime.average.toFixed(0)}ms`,
        value: metrics.responseTime.average,
      });
    }

    if (metrics.errors.rate > 1) {
      issues.push({
        type: 'errors',
        severity: metrics.errors.rate > 5 ? 'critical' : 'warning',
        message: `High error rate: ${metrics.errors.rate.toFixed(1)}%`,
        value: metrics.errors.rate,
      });
    }

    return issues.sort((a, b) => {
      const severityOrder: { [key: string]: number } = { critical: 3, warning: 2, info: 1 };
      return (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0);
    });
  }

  private calculatePerformanceScore(metrics: PerformanceMetrics): number {
    let score = 100;

    // CPU penalty
    if (metrics.cpu.usage > 50) {
      score -= Math.min((metrics.cpu.usage - 50) * 2, 30);
    }

    // Memory penalty
    if (metrics.memory.usage > 60) {
      score -= Math.min((metrics.memory.usage - 60) * 2, 30);
    }

    // Response time penalty
    if (metrics.responseTime.average > 500) {
      score -= Math.min((metrics.responseTime.average - 500) / 50, 20);
    }

    // Error rate penalty
    if (metrics.errors.rate > 1) {
      score -= Math.min(metrics.errors.rate * 5, 20);
    }

    return Math.max(score, 0);
  }

  private determineHealthStatus(metrics: PerformanceMetrics, alerts: PerformanceAlert[]): string {
    const criticalAlerts = alerts.filter(a => a.severity === 'critical');
    const warningAlerts = alerts.filter(a => a.severity === 'warning');

    if (criticalAlerts.length > 0) {
      return 'critical';
    }

    if (warningAlerts.length > 0) {
      return 'warning';
    }

    if (metrics.cpu.usage > 80 || metrics.memory.usage > 85 || metrics.responseTime.average > 2000) {
      return 'degraded';
    }

    return 'healthy';
  }

  private percentile(values: number[], p: number): number {
    if (values.length === 0) return 0;
    
    const index = Math.ceil(values.length * p) - 1;
    return values[Math.min(index, values.length - 1)];
  }
}