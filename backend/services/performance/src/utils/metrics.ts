/**
 * Prometheus Metrics Configuration
 * 
 * Provides Prometheus metrics collection for performance monitoring
 */

import { register, collectDefaultMetrics, Counter, Histogram, Gauge } from 'prom-client';

// Collect default metrics
collectDefaultMetrics({ register });

// Custom metrics for performance service
export const httpRequestCounter = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'path', 'status_code'],
});

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'path', 'status_code'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5, 10],
});

export const performanceOptimizationCounter = new Counter({
  name: 'performance_optimizations_total',
  help: 'Total number of performance optimizations performed',
  labelNames: ['type', 'success'],
});

export const cacheHitRateGauge = new Gauge({
  name: 'cache_hit_rate_percentage',
  help: 'Cache hit rate percentage',
});

export const memoryUsageGauge = new Gauge({
  name: 'memory_usage_percentage',
  help: 'Memory usage percentage',
});

export const cpuUsageGauge = new Gauge({
  name: 'cpu_usage_percentage',
  help: 'CPU usage percentage',
});

export const responseTimeGauge = new Gauge({
  name: 'average_response_time_milliseconds',
  help: 'Average response time in milliseconds',
});

export const throughputGauge = new Gauge({
  name: 'throughput_requests_per_second',
  help: 'Throughput in requests per second',
});

export const errorRateGauge = new Gauge({
  name: 'error_rate_percentage',
  help: 'Error rate percentage',
});

export const activeAlertsGauge = new Gauge({
  name: 'active_alerts_total',
  help: 'Total number of active performance alerts',
});

export const performanceScoreGauge = new Gauge({
  name: 'performance_score',
  help: 'Overall performance score (0-100)',
});

// Register all metrics
register.registerMetric(httpRequestCounter);
register.registerMetric(httpRequestDuration);
register.registerMetric(performanceOptimizationCounter);
register.registerMetric(cacheHitRateGauge);
register.registerMetric(memoryUsageGauge);
register.registerMetric(cpuUsageGauge);
register.registerMetric(responseTimeGauge);
register.registerMetric(throughputGauge);
register.registerMetric(errorRateGauge);
register.registerMetric(activeAlertsGauge);
register.registerMetric(performanceScoreGauge);

export { register, collectDefaultMetrics };