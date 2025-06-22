"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModelMonitoring = exports.AlertManager = exports.DriftDetector = exports.MetricsCollector = void 0;
const events_1 = require("events");
const pino_1 = __importDefault(require("pino"));
const prom = __importStar(require("prom-client"));
const logger = (0, pino_1.default)({ name: 'model-monitoring' });
class MetricsCollector {
    register;
    predictionLatency;
    predictionErrors;
    predictionTotal;
    modelLoadTime;
    modelMemoryUsage;
    featureDrift;
    predictionDrift;
    cpuUsage;
    memoryUsage;
    diskUsage;
    constructor() {
        this.register = new prom.Registry();
        this.initializeMetrics();
    }
    initializeMetrics() {
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
    recordPrediction(modelId, modelVersion, latency, success, errorType) {
        const labels = { model_id: modelId, model_version: modelVersion };
        this.predictionTotal.inc(labels);
        this.predictionLatency.observe({ ...labels, status: success ? 'success' : 'error' }, latency / 1000);
        if (!success && errorType) {
            this.predictionErrors.inc({ ...labels, error_type: errorType });
        }
    }
    recordModelLoad(modelId, modelVersion, loadTime) {
        this.modelLoadTime.observe({ model_id: modelId, model_version: modelVersion }, loadTime / 1000);
    }
    updateModelMemory(modelId, modelVersion, memoryBytes) {
        this.modelMemoryUsage.set({ model_id: modelId, model_version: modelVersion }, memoryBytes);
    }
    updateDriftScore(modelId, modelVersion, driftScore, featureName) {
        if (featureName) {
            this.featureDrift.set({ model_id: modelId, model_version: modelVersion, feature_name: featureName }, driftScore);
        }
        else {
            this.predictionDrift.set({ model_id: modelId, model_version: modelVersion }, driftScore);
        }
    }
    updateSystemMetrics(cpu, memory, disk) {
        this.cpuUsage.set(cpu);
        this.memoryUsage.set(memory);
        this.diskUsage.set(disk);
    }
    getMetrics() {
        return this.register.metrics();
    }
    getRegistry() {
        return this.register;
    }
}
exports.MetricsCollector = MetricsCollector;
class DriftDetector {
    config;
    referenceDistributions = new Map();
    currentWindow = new Map();
    constructor(config) {
        this.config = config;
    }
    async initializeReference(modelId, referenceData) {
        const distribution = this.calculateDistribution(referenceData);
        this.referenceDistributions.set(modelId, distribution);
        this.currentWindow.set(modelId, []);
    }
    async detectDrift(modelId, newData) {
        if (!this.config.enabled)
            return 0;
        const window = this.currentWindow.get(modelId) || [];
        window.push(newData);
        if (window.length > this.config.windowSize) {
            window.shift();
        }
        this.currentWindow.set(modelId, window);
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
    calculateDistribution(data) {
        const values = data.map(d => {
            if (typeof d === 'number')
                return d;
            if (Array.isArray(d))
                return d[0];
            return 0;
        });
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
        return { mean, variance, values };
    }
    calculateDriftScore(reference, current) {
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
    calculatePSI(reference, current) {
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
    calculateKLDivergence(reference, current) {
        const klDiv = Math.log(Math.sqrt(current.variance) / Math.sqrt(reference.variance)) +
            (reference.variance + Math.pow(reference.mean - current.mean, 2)) / (2 * current.variance) - 0.5;
        return Math.abs(klDiv);
    }
    calculateWasserstein(reference, current) {
        const sortedRef = [...reference].sort((a, b) => a - b);
        const sortedCurr = [...current].sort((a, b) => a - b);
        let distance = 0;
        const minLen = Math.min(sortedRef.length, sortedCurr.length);
        for (let i = 0; i < minLen; i++) {
            distance += Math.abs(sortedRef[i] - sortedCurr[i]);
        }
        return distance / minLen;
    }
    histogram(data, bins) {
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
exports.DriftDetector = DriftDetector;
class AlertManager extends events_1.EventEmitter {
    config;
    constructor(config) {
        super();
        this.config = config;
    }
    async sendAlert(alert) {
        if (!this.config.enabled)
            return;
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
            }
            catch (error) {
                logger.error({ error, channel }, 'Failed to send alert');
            }
        }
        this.emit('alert:sent', alert);
    }
    async sendSlackAlert(alert) {
        if (!this.config.slackWebhook)
            return;
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
        const axios = (await Promise.resolve().then(() => __importStar(require('axios')))).default;
        await axios.post(this.config.slackWebhook, payload);
    }
    async sendEmailAlert(alert) {
        if (!this.config.emailConfig)
            return;
        logger.info({ alert }, 'Email alert would be sent');
    }
    async sendWebhookAlert(alert) {
        if (!this.config.webhookUrl)
            return;
        const axios = (await Promise.resolve().then(() => __importStar(require('axios')))).default;
        await axios.post(this.config.webhookUrl, {
            ...alert,
            timestamp: new Date().toISOString()
        });
    }
}
exports.AlertManager = AlertManager;
class ModelMonitoring extends events_1.EventEmitter {
    config;
    metricsCollector;
    driftDetector;
    alertManager;
    modelServer;
    registry;
    monitoringTimer;
    constructor(config, modelServer, registry) {
        super();
        this.config = config;
        this.metricsCollector = new MetricsCollector();
        this.driftDetector = new DriftDetector(config.driftDetection);
        this.alertManager = new AlertManager(config.alerting);
        this.modelServer = modelServer;
        this.registry = registry;
    }
    async start() {
        logger.info('Starting model monitoring...');
        await this.startMetricsServer();
        if (this.modelServer) {
            this.setupModelServerHooks();
        }
        this.monitoringTimer = setInterval(() => this.runMonitoringCycle(), this.config.collectInterval * 1000);
        this.emit('started');
    }
    async stop() {
        logger.info('Stopping model monitoring...');
        if (this.monitoringTimer) {
            clearInterval(this.monitoringTimer);
        }
        this.emit('stopped');
    }
    async startMetricsServer() {
        const express = (await Promise.resolve().then(() => __importStar(require('express')))).default;
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
    setupModelServerHooks() {
        if (!this.modelServer)
            return;
        this.modelServer.on('prediction', ({ request, response }) => {
            this.metricsCollector.recordPrediction(response.modelId, response.modelVersion, response.processingTime, true);
            this.checkDrift(response.modelId, request.input).catch(error => {
                logger.error({ error }, 'Drift detection failed');
            });
        });
        this.modelServer.on('predictionError', ({ request, error }) => {
            this.metricsCollector.recordPrediction(request.modelId, 'unknown', 0, false, error.name);
        });
        this.modelServer.on('modelLoaded', ({ modelId, version }) => {
            logger.info({ modelId, version }, 'Model loaded event');
        });
    }
    async runMonitoringCycle() {
        try {
            const systemMetrics = await this.collectSystemMetrics();
            this.metricsCollector.updateSystemMetrics(systemMetrics.cpu, systemMetrics.memory, systemMetrics.disk);
            if (this.modelServer) {
                const health = await this.modelServer.getHealth();
                for (const modelStat of health.modelStats) {
                    this.metricsCollector.updateModelMemory(modelStat.modelId, modelStat.version, modelStat.memoryUsage);
                }
            }
            await this.checkAlerts();
        }
        catch (error) {
            logger.error({ error }, 'Monitoring cycle failed');
        }
    }
    async collectSystemMetrics() {
        const os = await Promise.resolve().then(() => __importStar(require('os')));
        const cpus = os.cpus();
        const cpuUsage = cpus.reduce((acc, cpu) => {
            const total = Object.values(cpu.times).reduce((a, b) => a + b);
            const idle = cpu.times.idle;
            return acc + ((total - idle) / total) * 100;
        }, 0) / cpus.length;
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const memoryUsage = totalMem - freeMem;
        const diskUsage = 0;
        return {
            cpu: cpuUsage,
            memory: memoryUsage,
            disk: diskUsage
        };
    }
    async checkDrift(modelId, input) {
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
    async checkAlerts() {
    }
    async initializeDriftDetection(modelId, referenceData) {
        await this.driftDetector.initializeReference(modelId, referenceData);
        logger.info({ modelId }, 'Drift detection initialized');
    }
    getMetrics() {
        return this.metricsCollector.getMetrics();
    }
}
exports.ModelMonitoring = ModelMonitoring;
//# sourceMappingURL=model-monitoring.js.map