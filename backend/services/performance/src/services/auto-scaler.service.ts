/**
 * Auto-Scaler Service
 * 
 * Provides intelligent auto-scaling recommendations and automation
 */

import { logger } from '../utils/logger';
import { AutoScalingRecommendation, PerformanceMetrics } from '../types/performance.types';

export class AutoScaler {
  private scalingHistory: AutoScalingRecommendation[] = [];
  private scalingThresholds = {
    cpu: { scaleUp: 70, scaleDown: 30 },
    memory: { scaleUp: 80, scaleDown: 40 },
    responseTime: { scaleUp: 1000, scaleDown: 300 },
    throughput: { scaleUp: 80, scaleDown: 20 },
    errorRate: { scaleUp: 5, scaleDown: 1 },
  };

  async initialize(): Promise<void> {
    logger.info('Initializing Auto-Scaler...');
    await this.loadScalingHistory();
    await this.calibrateThresholds();
    logger.info('✅ Auto-Scaler initialized');
  }

  async getScalingRecommendations(): Promise<AutoScalingRecommendation[]> {
    try {
      const currentMetrics = await this.getCurrentMetrics();
      const recommendations: AutoScalingRecommendation[] = [];

      // Analyze scaling needs
      const scaleUp = this.shouldScaleUp(currentMetrics);
      const scaleDown = this.shouldScaleDown(currentMetrics);

      if (scaleUp.needed) {
        recommendations.push(await this.createScaleUpRecommendation(currentMetrics, scaleUp.reasons));
      } else if (scaleDown.needed) {
        recommendations.push(await this.createScaleDownRecommendation(currentMetrics, scaleDown.reasons));
      } else {
        recommendations.push(await this.createNoActionRecommendation(currentMetrics));
      }

      // Store recommendations
      this.scalingHistory.push(...recommendations);
      
      return recommendations;

    } catch (error) {
      logger.error('Error getting scaling recommendations:', error);
      throw error;
    }
  }

  private async getCurrentMetrics(): Promise<PerformanceMetrics> {
    // Mock current metrics - would integrate with actual monitoring
    return {
      timestamp: new Date(),
      cpu: {
        usage: Math.random() * 60 + 20, // 20-80%
        cores: 8,
        loadAverage: [1.2, 1.1, 1.0],
      },
      memory: {
        usage: Math.random() * 50 + 30, // 30-80%
        total: 16 * 1024 * 1024 * 1024,
        used: 8 * 1024 * 1024 * 1024,
        free: 8 * 1024 * 1024 * 1024,
        heapUsed: 2 * 1024 * 1024 * 1024,
      },
      network: {
        bytesIn: Math.random() * 1000000,
        bytesOut: Math.random() * 5000000,
        packetsIn: Math.random() * 10000,
        packetsOut: Math.random() * 15000,
      },
      responseTime: {
        average: Math.random() * 800 + 200, // 200-1000ms
        p50: Math.random() * 600 + 150,
        p95: Math.random() * 1200 + 400,
        p99: Math.random() * 2000 + 600,
      },
      throughput: {
        current: Math.random() * 100 + 30, // 30-130 RPS
        peak: Math.random() * 200 + 100,
        average: Math.random() * 80 + 50,
      },
      errors: {
        rate: Math.random() * 8, // 0-8%
        total: Math.floor(Math.random() * 100),
      },
      database: {
        connections: Math.floor(Math.random() * 50 + 10),
        queryTime: Math.random() * 500 + 50,
        slowQueries: Math.floor(Math.random() * 10),
      },
      cache: {
        hitRate: Math.random() * 40 + 60, // 60-100%
        missRate: Math.random() * 40,
        size: Math.random() * 1000000000,
      },
    };
  }

  private shouldScaleUp(metrics: PerformanceMetrics): { needed: boolean; reasons: string[] } {
    const reasons: string[] = [];

    if (metrics.cpu.usage > this.scalingThresholds.cpu.scaleUp) {
      reasons.push(`High CPU usage: ${metrics.cpu.usage.toFixed(1)}%`);
    }

    if (metrics.memory.usage > this.scalingThresholds.memory.scaleUp) {
      reasons.push(`High memory usage: ${metrics.memory.usage.toFixed(1)}%`);
    }

    if (metrics.responseTime.average > this.scalingThresholds.responseTime.scaleUp) {
      reasons.push(`Slow response time: ${metrics.responseTime.average.toFixed(0)}ms`);
    }

    if (metrics.errors.rate > this.scalingThresholds.errorRate.scaleUp) {
      reasons.push(`High error rate: ${metrics.errors.rate.toFixed(1)}%`);
    }

    return {
      needed: reasons.length >= 2, // Require at least 2 indicators
      reasons,
    };
  }

  private shouldScaleDown(metrics: PerformanceMetrics): { needed: boolean; reasons: string[] } {
    const reasons: string[] = [];

    if (metrics.cpu.usage < this.scalingThresholds.cpu.scaleDown) {
      reasons.push(`Low CPU usage: ${metrics.cpu.usage.toFixed(1)}%`);
    }

    if (metrics.memory.usage < this.scalingThresholds.memory.scaleDown) {
      reasons.push(`Low memory usage: ${metrics.memory.usage.toFixed(1)}%`);
    }

    if (metrics.responseTime.average < this.scalingThresholds.responseTime.scaleDown) {
      reasons.push(`Fast response time: ${metrics.responseTime.average.toFixed(0)}ms`);
    }

    if (metrics.throughput.current < this.scalingThresholds.throughput.scaleDown) {
      reasons.push(`Low throughput: ${metrics.throughput.current.toFixed(1)} RPS`);
    }

    return {
      needed: reasons.length >= 3, // Require more indicators for scale down
      reasons,
    };
  }

  private async createScaleUpRecommendation(
    metrics: PerformanceMetrics,
    reasons: string[]
  ): Promise<AutoScalingRecommendation> {
    const currentInstances = 3; // Mock current instance count
    const recommendedInstances = Math.min(currentInstances + 2, 10); // Scale up by 2, max 10

    return {
      type: 'scaling-recommendation',
      timestamp: new Date(),
      action: 'scale-out',
      reason: `Performance degradation detected: ${reasons.join(', ')}`,
      currentMetrics: metrics,
      recommendedConfig: {
        instances: recommendedInstances,
        cpu: 4, // cores per instance
        memory: 8 * 1024 * 1024 * 1024, // 8GB per instance
        bandwidth: 1000, // Mbps
      },
      confidence: this.calculateConfidence(metrics, 'scale-up'),
      estimatedImpact: `Expected ${Math.round((recommendedInstances / currentInstances - 1) * 100)}% capacity increase`,
      costImpact: {
        current: currentInstances * 100, // $100 per instance
        projected: recommendedInstances * 100,
        savings: (recommendedInstances - currentInstances) * -100, // Negative = additional cost
      },
    };
  }

  private async createScaleDownRecommendation(
    metrics: PerformanceMetrics,
    reasons: string[]
  ): Promise<AutoScalingRecommendation> {
    const currentInstances = 5; // Mock current instance count
    const recommendedInstances = Math.max(currentInstances - 1, 2); // Scale down by 1, min 2

    return {
      type: 'scaling-recommendation',
      timestamp: new Date(),
      action: 'scale-in',
      reason: `Resource under-utilization detected: ${reasons.join(', ')}`,
      currentMetrics: metrics,
      recommendedConfig: {
        instances: recommendedInstances,
        cpu: 4,
        memory: 8 * 1024 * 1024 * 1024,
        bandwidth: 1000,
      },
      confidence: this.calculateConfidence(metrics, 'scale-down'),
      estimatedImpact: `Expected ${Math.round((1 - recommendedInstances / currentInstances) * 100)}% cost reduction`,
      costImpact: {
        current: currentInstances * 100,
        projected: recommendedInstances * 100,
        savings: (currentInstances - recommendedInstances) * 100, // Positive = savings
      },
    };
  }

  private async createNoActionRecommendation(metrics: PerformanceMetrics): Promise<AutoScalingRecommendation> {
    return {
      type: 'scaling-recommendation',
      timestamp: new Date(),
      action: 'no-action',
      reason: 'System is operating within optimal performance parameters',
      currentMetrics: metrics,
      recommendedConfig: {
        instances: 3, // Current instance count
      },
      confidence: 0.95,
      estimatedImpact: 'No changes needed - system is well-balanced',
      costImpact: {
        current: 300, // 3 instances * $100
        projected: 300,
        savings: 0,
      },
    };
  }

  private calculateConfidence(metrics: PerformanceMetrics, action: 'scale-up' | 'scale-down'): number {
    let confidence = 0.5; // Base confidence

    // Increase confidence based on clear indicators
    if (action === 'scale-up') {
      if (metrics.cpu.usage > 80) confidence += 0.2;
      if (metrics.memory.usage > 85) confidence += 0.2;
      if (metrics.responseTime.average > 1500) confidence += 0.2;
      if (metrics.errors.rate > 7) confidence += 0.3;
    } else {
      if (metrics.cpu.usage < 25) confidence += 0.2;
      if (metrics.memory.usage < 35) confidence += 0.2;
      if (metrics.responseTime.average < 250) confidence += 0.2;
      if (metrics.throughput.current < 15) confidence += 0.2;
    }

    return Math.min(confidence, 1.0);
  }

  private async loadScalingHistory(): Promise<void> {
    // Load scaling history from storage
    logger.debug('Loading scaling history...');
  }

  private async calibrateThresholds(): Promise<void> {
    // Calibrate scaling thresholds based on historical data
    logger.debug('Calibrating scaling thresholds...');
  }

  getScalingHistory(): AutoScalingRecommendation[] {
    return [...this.scalingHistory];
  }

  getScalingThresholds(): any {
    return { ...this.scalingThresholds };
  }
}