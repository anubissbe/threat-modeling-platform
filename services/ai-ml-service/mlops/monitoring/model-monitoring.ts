/**
 * Model Monitoring for performance tracking, drift detection, and alerting
 */

import { EventEmitter } from 'events';
import pino from 'pino';
import { z } from 'zod';
import * as prom from 'prom-client';
import { ModelServer, PredictionResponse } from '../serving/model-server';
import { ModelRegistry, ModelMetadata } from '../model-registry/model-registry';

const logger = pino({ name: 'model-monitoring' });

// Monitoring configuration
export interface MonitoringConfig {
  metricsPort: number;
  collectInterval: number; // seconds
  driftDetection: {
    enabled: boolean;
    method: 'psi' | 'kl-divergence' | 'wasserstein';
    threshold: number;
    windowSize: number;
  };
  performanceTracking: {
    latencyThreshold: number; // milliseconds
    errorRateThreshold: number; // percentage
    throughputThreshold: number; // requests per second
  };
  alerting: {
    enabled: boolean;
    channels: Array<'slack' | 'email' | 'webhook'>;
    webhookUrl?: string;
    emailConfig?: {
      smtp: string;
      from: string;
      to: string[];
    };
    slackWebhook?: string;
  };
  dataQuality: {
    enabled: boolean;
    checksumValidation: boolean;
    schemaValidation: boolean;
    rangeValidation: boolean;
  };
}

// Metrics collector
export class MetricsCollector {
  private register: prom.Registry;
  
  // Model performance metrics
  private predictionLatency: prom.Histogram;
  private predictionErrors: prom.Counter;
  private predictionTotal: prom.Counter;
  private modelLoadTime: prom.Histogram;
  private modelMemoryUsage: prom.Gauge;
  
  // Data drift metrics
  private featureDrift: prom.Gauge;
  private predictionDrift: prom.Gauge;
  
  // System metrics
  private cpuUsage: prom.Gauge;
  private memoryUsage: prom.Gauge;
  private diskUsage: prom.Gauge;

  constructor() {
    this.register = new prom.Registry();
    this.initializeMetrics();
  }

  private initializeMetrics(): void {
    // Model performance metrics
    this.predictionLatency = new prom.Histogram({
      name: 'ml_prediction_latency_seconds',
      help: 'Prediction latency in seconds',
      labelNames: ['model_id', 'model_version', 'status'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5]
    });

    this.predictionErrors = new prom.Counter({
      name: 'ml_prediction_errors_total',
      help: 'Total number of prediction errors',
      labelNames: ['model_id', 'model_version', 'error_type']
    });

    this.predictionTotal = new prom.Counter({
      name: 'ml_predictions_total',
      help: 'Total number of predictions',
      labelNames: ['model_id', 'model_version']
    });

    this.modelLoadTime = new prom.Histogram({
      name: 'ml_model_load_time_seconds',
      help: 'Model loading time in seconds',
      labelNames: ['model_id', 'model_version'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30]
    });

    this.modelMemoryUsage = new prom.Gauge({
      name: 'ml_model_memory_usage_bytes',
      help: 'Model memory usage in bytes',
      labelNames: ['model_id', 'model_version']
    });

    // Data drift metrics
    this.featureDrift = new prom.Gauge({
      name: 'ml_feature_drift_score',
      help: 'Feature drift score',
      labelNames: ['model_id', 'model_version', 'feature_name']
    });

    this.predictionDrift = new prom.Gauge({
      name: 'ml_prediction_drift_score',
      help: 'Prediction drift score',
      labelNames: ['model_id', 'model_version']
    });

    // System metrics
    this.cpuUsage = new prom.Gauge({
      name: 'ml_system_cpu_usage_percent',
      help: 'CPU usage percentage'
    });

    this.memoryUsage = new prom.Gauge({
      name: 'ml_system_memory_usage_bytes',
      help: 'Memory usage in bytes'
    });

    this.diskUsage = new prom.Gauge({
      name: 'ml_system_disk_usage_bytes',
      help: 'Disk usage in bytes'
    });

    // Register all metrics
    this.register.registerMetric(this.predictionLatency);
    this.register.registerMetric(this.predictionErrors);
    this.register.registerMetric(this.predictionTotal);
    this.register.registerMetric(this.modelLoadTime);
    this.register.registerMetric(this.modelMemoryUsage);
    this.register.registerMetric(this.featureDrift);
    this.register.registerMetric(this.predictionDrift);
    this.register.registerMetric(this.cpuUsage);
    this.register.registerMetric(this.memoryUsage);
    this.register.registerMetric(this.diskUsage);
  }

  recordPrediction(
    modelId: string,
    modelVersion: string,
    latency: number,
    success: boolean,
    errorType?: string
  ): void {
    const labels = { model_id: modelId, model_version: modelVersion };
    
    this.predictionTotal.inc(labels);
    this.predictionLatency.observe({ ...labels, status: success ? 'success' : 'error' }, latency / 1000);
    
    if (!success && errorType) {
      this.predictionErrors.inc({ ...labels, error_type: errorType });
    }
  }

  recordModelLoad(modelId: string, modelVersion: string, loadTime: number): void {
    this.modelLoadTime.observe({ model_id: modelId, model_version: modelVersion }, loadTime / 1000);
  }

  updateModelMemory(modelId: string, modelVersion: string, memoryBytes: number): void {
    this.modelMemoryUsage.set({ model_id: modelId, model_version: modelVersion }, memoryBytes);
  }

  updateDriftScore(modelId: string, modelVersion: string, driftScore: number, featureName?: string): void {
    if (featureName) {
      this.featureDrift.set({ model_id: modelId, model_version: modelVersion, feature_name: featureName }, driftScore);
    } else {
      this.predictionDrift.set({ model_id: modelId, model_version: modelVersion }, driftScore);
    }
  }

  updateSystemMetrics(cpu: number, memory: number, disk: number): void {
    this.cpuUsage.set(cpu);
    this.memoryUsage.set(memory);
    this.diskUsage.set(disk);
  }

  getMetrics(): string {
    return this.register.metrics();
  }

  getRegistry(): prom.Registry {
    return this.register;
  }
}

// Drift detector
export class DriftDetector {
  private referenceDistributions: Map<string, any> = new Map();
  private currentWindow: Map<string, any[]> = new Map();

  constructor(private config: MonitoringConfig['driftDetection']) {}

  async initializeReference(modelId: string, referenceData: any[]): Promise<void> {
    const distribution = this.calculateDistribution(referenceData);
    this.referenceDistributions.set(modelId, distribution);
    this.currentWindow.set(modelId, []);
  }

  async detectDrift(modelId: string, newData: any): Promise<number> {
    if (!this.config.enabled) return 0;

    // Add to current window
    const window = this.currentWindow.get(modelId) || [];
    window.push(newData);
    
    if (window.length > this.config.windowSize) {
      window.shift();
    }
    this.currentWindow.set(modelId, window);

    // Calculate drift only when window is full
    if (window.length < this.config.windowSize) {
      return 0;
    }

    const currentDistribution = this.calculateDistribution(window);
    const referenceDistribution = this.referenceDistributions.get(modelId);
    
    if (!referenceDistribution) {
      logger.warn({ modelId }, 'No reference distribution found for drift detection');
      return 0;
    }

    return this.calculateDriftScore(referenceDistribution, currentDistribution);
  }

  private calculateDistribution(data: any[]): any {
    // Simplified distribution calculation
    // In practice, this would be more sophisticated based on data type
    const values = data.map(d => {
      if (typeof d === 'number') return d;
      if (Array.isArray(d)) return d[0]; // Take first element for simplicity
      return 0;
    });

    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
    
    return { mean, variance, values };
  }

  private calculateDriftScore(reference: any, current: any): number {
    switch (this.config.method) {
      case 'psi':
        return this.calculatePSI(reference.values, current.values);
      case 'kl-divergence':
        return this.calculateKLDivergence(reference, current);
      case 'wasserstein':
        return this.calculateWasserstein(reference.values, current.values);
      default:
        return 0;
    }
  }

  private calculatePSI(reference: number[], current: number[]): number {
    // Population Stability Index implementation
    const bins = 10;
    const refHist = this.histogram(reference, bins);
    const currHist = this.histogram(current, bins);
    
    let psi = 0;
    for (let i = 0; i < bins; i++) {
      const refPct = refHist[i] || 0.0001;
      const currPct = currHist[i] || 0.0001;
      psi += (currPct - refPct) * Math.log(currPct / refPct);
    }
    
    return Math.abs(psi);
  }

  private calculateKLDivergence(reference: any, current: any): number {
    // Simplified KL divergence for normal distributions
    const klDiv = Math.log(Math.sqrt(current.variance) / Math.sqrt(reference.variance)) +
      (reference.variance + Math.pow(reference.mean - current.mean, 2)) / (2 * current.variance) - 0.5;
    
    return Math.abs(klDiv);
  }

  private calculateWasserstein(reference: number[], current: number[]): number {
    // Simplified 1D Wasserstein distance
    const sortedRef = [...reference].sort((a, b) => a - b);
    const sortedCurr = [...current].sort((a, b) => a - b);
    
    let distance = 0;
    const minLen = Math.min(sortedRef.length, sortedCurr.length);
    
    for (let i = 0; i < minLen; i++) {
      distance += Math.abs(sortedRef[i] - sortedCurr[i]);
    }
    
    return distance / minLen;
  }

  private histogram(data: number[], bins: number): number[] {
    const min = Math.min(...data);
    const max = Math.max(...data);
    const binWidth = (max - min) / bins;
    const hist = new Array(bins).fill(0);
    
    for (const value of data) {
      const binIndex = Math.min(Math.floor((value - min) / binWidth), bins - 1);
      hist[binIndex]++;
    }
    
    return hist.map(count => count / data.length);
  }
}

// Alert manager
export class AlertManager extends EventEmitter {
  constructor(private config: MonitoringConfig['alerting']) {
    super();
  }

  async sendAlert(alert: {
    severity: 'warning' | 'error' | 'critical';
    title: string;
    message: string;
    modelId?: string;
    modelVersion?: string;
    metrics?: Record<string, any>;
  }): Promise<void> {
    if (!this.config.enabled) return;

    logger.warn({ alert }, 'Sending alert');

    for (const channel of this.config.channels) {
      try {
        switch (channel) {
          case 'slack':
            await this.sendSlackAlert(alert);
            break;
          case 'email':
            await this.sendEmailAlert(alert);
            break;
          case 'webhook':
            await this.sendWebhookAlert(alert);
            break;
        }
      } catch (error) {
        logger.error({ error, channel }, 'Failed to send alert');
      }
    }

    this.emit('alert:sent', alert);
  }

  private async sendSlackAlert(alert: any): Promise<void> {
    if (!this.config.slackWebhook) return;

    const color = {
      warning: '#ff9800',
      error: '#f44336',
      critical: '#d32f2f'
    }[alert.severity];

    const payload = {
      attachments: [{
        color,
        title: alert.title,
        text: alert.message,
        fields: [
          {
            title: 'Model',
            value: `${alert.modelId || 'N/A'} v${alert.modelVersion || 'N/A'}`,
            short: true
          },
          {
            title: 'Severity',
            value: alert.severity.toUpperCase(),
            short: true
          },
          ...(alert.metrics ? Object.entries(alert.metrics).map(([key, value]) => ({
            title: key,
            value: String(value),
            short: true
          })) : [])
        ],
        footer: 'ML Monitoring',
        ts: Math.floor(Date.now() / 1000)
      }]
    };

    // Send to Slack webhook
    const axios = (await import('axios')).default;
    await axios.post(this.config.slackWebhook, payload);
  }

  private async sendEmailAlert(alert: any): Promise<void> {
    if (!this.config.emailConfig) return;

    // Implementation would use nodemailer or similar
    logger.info({ alert }, 'Email alert would be sent');
  }

  private async sendWebhookAlert(alert: any): Promise<void> {
    if (!this.config.webhookUrl) return;

    const axios = (await import('axios')).default;
    await axios.post(this.config.webhookUrl, {
      ...alert,
      timestamp: new Date().toISOString()
    });
  }
}

// Main monitoring service
export class ModelMonitoring extends EventEmitter {
  private metricsCollector: MetricsCollector;
  private driftDetector: DriftDetector;
  private alertManager: AlertManager;
  private modelServer?: ModelServer;
  private registry?: ModelRegistry;
  private monitoringTimer?: NodeJS.Timeout;

  constructor(
    private config: MonitoringConfig,
    modelServer?: ModelServer,
    registry?: ModelRegistry
  ) {
    super();
    this.metricsCollector = new MetricsCollector();
    this.driftDetector = new DriftDetector(config.driftDetection);
    this.alertManager = new AlertManager(config.alerting);
    this.modelServer = modelServer;
    this.registry = registry;
  }

  async start(): Promise<void> {
    logger.info('Starting model monitoring...');

    // Start metrics server
    await this.startMetricsServer();

    // Setup model server hooks if available
    if (this.modelServer) {
      this.setupModelServerHooks();
    }

    // Start monitoring loop
    this.monitoringTimer = setInterval(
      () => this.runMonitoringCycle(),
      this.config.collectInterval * 1000
    );

    this.emit('started');
  }

  async stop(): Promise<void> {
    logger.info('Stopping model monitoring...');

    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
    }

    this.emit('stopped');
  }

  private async startMetricsServer(): Promise<void> {
    const express = (await import('express')).default;
    const app = express();

    app.get('/metrics', (req, res) => {
      res.set('Content-Type', this.metricsCollector.getRegistry().contentType);
      res.end(this.metricsCollector.getMetrics());
    });

    app.get('/health', (req, res) => {
      res.json({ status: 'healthy' });
    });

    app.listen(this.config.metricsPort, () => {
      logger.info({ port: this.config.metricsPort }, 'Metrics server started');
    });
  }

  private setupModelServerHooks(): void {
    if (!this.modelServer) return;

    // Hook into prediction events
    this.modelServer.on('prediction', ({ request, response }) => {
      this.metricsCollector.recordPrediction(
        response.modelId,
        response.modelVersion,
        response.processingTime,
        true
      );

      // Check for drift
      this.checkDrift(response.modelId, request.input).catch(error => {
        logger.error({ error }, 'Drift detection failed');
      });
    });

    this.modelServer.on('predictionError', ({ request, error }) => {
      this.metricsCollector.recordPrediction(
        request.modelId,
        'unknown',
        0,
        false,
        error.name
      );
    });

    this.modelServer.on('modelLoaded', ({ modelId, version }) => {
      logger.info({ modelId, version }, 'Model loaded event');
    });
  }

  private async runMonitoringCycle(): Promise<void> {
    try {
      // Collect system metrics
      const systemMetrics = await this.collectSystemMetrics();
      this.metricsCollector.updateSystemMetrics(
        systemMetrics.cpu,
        systemMetrics.memory,
        systemMetrics.disk
      );

      // Check model health
      if (this.modelServer) {
        const health = await this.modelServer.getHealth();
        
        for (const modelStat of health.modelStats) {
          this.metricsCollector.updateModelMemory(
            modelStat.modelId,
            modelStat.version,
            modelStat.memoryUsage
          );
        }
      }

      // Check for alerts
      await this.checkAlerts();

    } catch (error) {
      logger.error({ error }, 'Monitoring cycle failed');
    }
  }

  private async collectSystemMetrics(): Promise<{ cpu: number; memory: number; disk: number }> {
    const os = await import('os');
    
    // CPU usage (simplified)
    const cpus = os.cpus();
    const cpuUsage = cpus.reduce((acc, cpu) => {
      const total = Object.values(cpu.times).reduce((a, b) => a + b);
      const idle = cpu.times.idle;
      return acc + ((total - idle) / total) * 100;
    }, 0) / cpus.length;

    // Memory usage
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const memoryUsage = totalMem - freeMem;

    // Disk usage (simplified - would need proper implementation)
    const diskUsage = 0; // Placeholder

    return {
      cpu: cpuUsage,
      memory: memoryUsage,
      disk: diskUsage
    };
  }

  private async checkDrift(modelId: string, input: any): Promise<void> {
    const driftScore = await this.driftDetector.detectDrift(modelId, input);
    this.metricsCollector.updateDriftScore(modelId, 'latest', driftScore);

    if (driftScore > this.config.driftDetection.threshold) {
      await this.alertManager.sendAlert({
        severity: 'warning',
        title: 'Data Drift Detected',
        message: `Drift score ${driftScore.toFixed(3)} exceeds threshold ${this.config.driftDetection.threshold}`,
        modelId,
        metrics: { driftScore }
      });
    }
  }

  private async checkAlerts(): Promise<void> {
    // Check performance thresholds
    // This would analyze collected metrics and trigger alerts
    // Implementation depends on specific requirements
  }

  async initializeDriftDetection(modelId: string, referenceData: any[]): Promise<void> {
    await this.driftDetector.initializeReference(modelId, referenceData);
    logger.info({ modelId }, 'Drift detection initialized');
  }

  getMetrics(): string {
    return this.metricsCollector.getMetrics();
  }
}