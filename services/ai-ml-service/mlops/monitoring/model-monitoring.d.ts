import { EventEmitter } from 'events';
import * as prom from 'prom-client';
import { ModelServer } from '../serving/model-server';
import { ModelRegistry } from '../model-registry/model-registry';
export interface MonitoringConfig {
    metricsPort: number;
    collectInterval: number;
    driftDetection: {
        enabled: boolean;
        method: 'psi' | 'kl-divergence' | 'wasserstein';
        threshold: number;
        windowSize: number;
    };
    performanceTracking: {
        latencyThreshold: number;
        errorRateThreshold: number;
        throughputThreshold: number;
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
export declare class MetricsCollector {
    private register;
    private predictionLatency;
    private predictionErrors;
    private predictionTotal;
    private modelLoadTime;
    private modelMemoryUsage;
    private featureDrift;
    private predictionDrift;
    private cpuUsage;
    private memoryUsage;
    private diskUsage;
    constructor();
    private initializeMetrics;
    recordPrediction(modelId: string, modelVersion: string, latency: number, success: boolean, errorType?: string): void;
    recordModelLoad(modelId: string, modelVersion: string, loadTime: number): void;
    updateModelMemory(modelId: string, modelVersion: string, memoryBytes: number): void;
    updateDriftScore(modelId: string, modelVersion: string, driftScore: number, featureName?: string): void;
    updateSystemMetrics(cpu: number, memory: number, disk: number): void;
    getMetrics(): string;
    getRegistry(): prom.Registry;
}
export declare class DriftDetector {
    private config;
    private referenceDistributions;
    private currentWindow;
    constructor(config: MonitoringConfig['driftDetection']);
    initializeReference(modelId: string, referenceData: any[]): Promise<void>;
    detectDrift(modelId: string, newData: any): Promise<number>;
    private calculateDistribution;
    private calculateDriftScore;
    private calculatePSI;
    private calculateKLDivergence;
    private calculateWasserstein;
    private histogram;
}
export declare class AlertManager extends EventEmitter {
    private config;
    constructor(config: MonitoringConfig['alerting']);
    sendAlert(alert: {
        severity: 'warning' | 'error' | 'critical';
        title: string;
        message: string;
        modelId?: string;
        modelVersion?: string;
        metrics?: Record<string, any>;
    }): Promise<void>;
    private sendSlackAlert;
    private sendEmailAlert;
    private sendWebhookAlert;
}
export declare class ModelMonitoring extends EventEmitter {
    private config;
    private metricsCollector;
    private driftDetector;
    private alertManager;
    private modelServer?;
    private registry?;
    private monitoringTimer?;
    constructor(config: MonitoringConfig, modelServer?: ModelServer, registry?: ModelRegistry);
    start(): Promise<void>;
    stop(): Promise<void>;
    private startMetricsServer;
    private setupModelServerHooks;
    private runMonitoringCycle;
    private collectSystemMetrics;
    private checkDrift;
    private checkAlerts;
    initializeDriftDetection(modelId: string, referenceData: any[]): Promise<void>;
    getMetrics(): string;
}
//# sourceMappingURL=model-monitoring.d.ts.map