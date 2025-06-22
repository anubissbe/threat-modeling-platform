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
exports.MLflow = void 0;
const axios_1 = __importDefault(require("axios"));
const form_data_1 = __importDefault(require("form-data"));
const fs_1 = require("fs");
class MLflow {
    client;
    constructor(baseURL) {
        this.client = axios_1.default.create({
            baseURL,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }
    async createExperiment(name, artifactLocation) {
        try {
            const response = await this.client.post('/api/2.0/mlflow/experiments/create', {
                name,
                artifact_location: artifactLocation
            });
            return response.data.experiment_id;
        }
        catch (error) {
            if (error.response?.data?.error_code === 'RESOURCE_ALREADY_EXISTS') {
                const experiments = await this.listExperiments();
                const existing = experiments.find(exp => exp.name === name);
                if (existing)
                    return existing.experiment_id;
            }
            throw error;
        }
    }
    async getExperiment(experimentId) {
        const response = await this.client.get('/api/2.0/mlflow/experiments/get', {
            params: { experiment_id: experimentId }
        });
        return response.data.experiment;
    }
    async listExperiments() {
        const response = await this.client.get('/api/2.0/mlflow/experiments/list');
        return response.data.experiments || [];
    }
    async deleteExperiment(experimentId) {
        await this.client.post('/api/2.0/mlflow/experiments/delete', {
            experiment_id: experimentId
        });
    }
    async startRun(experimentId, tags, runName) {
        const response = await this.client.post('/api/2.0/mlflow/runs/create', {
            experiment_id: experimentId,
            run_name: runName,
            tags: tags?.map(tag => ({ key: 'tag', value: tag }))
        });
        return response.data.run.info.run_id;
    }
    async endRun(runId, status) {
        await this.client.post('/api/2.0/mlflow/runs/update', {
            run_id: runId,
            status,
            end_time: Date.now()
        });
    }
    async getRun(runId) {
        const response = await this.client.get('/api/2.0/mlflow/runs/get', {
            params: { run_id: runId }
        });
        return response.data.run.info;
    }
    async searchRuns(experimentIds, filter, maxResults) {
        const response = await this.client.post('/api/2.0/mlflow/runs/search', {
            experiment_ids: experimentIds,
            filter_string: filter,
            max_results: maxResults
        });
        return response.data.runs?.map((run) => run.info) || [];
    }
    async logMetric(runId, key, value, step) {
        await this.client.post('/api/2.0/mlflow/runs/log-metric', {
            run_id: runId,
            key,
            value,
            timestamp: Date.now(),
            step: step || 0
        });
    }
    async logMetrics(runId, metrics, step) {
        const batch = Object.entries(metrics).map(([key, value]) => ({
            key,
            value,
            timestamp: Date.now(),
            step: step || 0
        }));
        await this.client.post('/api/2.0/mlflow/runs/log-batch', {
            run_id: runId,
            metrics: batch
        });
    }
    async getMetricHistory(runId, metricKey) {
        const response = await this.client.get('/api/2.0/mlflow/metrics/get-history', {
            params: {
                run_id: runId,
                metric_key: metricKey
            }
        });
        return response.data.metrics || [];
    }
    async logParam(runId, key, value) {
        await this.client.post('/api/2.0/mlflow/runs/log-parameter', {
            run_id: runId,
            key,
            value
        });
    }
    async logParams(runId, params) {
        const batch = Object.entries(params).map(([key, value]) => ({
            key,
            value: String(value)
        }));
        await this.client.post('/api/2.0/mlflow/runs/log-batch', {
            run_id: runId,
            params: batch
        });
    }
    async logArtifact(runId, localPath, artifactPath) {
        const formData = new form_data_1.default();
        formData.append('file', (0, fs_1.createReadStream)(localPath));
        await this.client.post(`/api/2.0/mlflow/artifacts/log-artifact`, formData, {
            params: {
                run_id: runId,
                artifact_path: artifactPath
            },
            headers: formData.getHeaders()
        });
    }
    async listArtifacts(runId, path) {
        const response = await this.client.get('/api/2.0/mlflow/artifacts/list', {
            params: {
                run_id: runId,
                path
            }
        });
        return response.data.files || [];
    }
    async createRegisteredModel(name, description) {
        await this.client.post('/api/2.0/mlflow/registered-models/create', {
            name,
            description
        });
    }
    async createModelVersion(name, source, runId, description) {
        const response = await this.client.post('/api/2.0/mlflow/model-versions/create', {
            name,
            source,
            run_id: runId,
            description
        });
        return response.data.model_version.version;
    }
    async transitionModelVersionStage(name, version, stage) {
        await this.client.post('/api/2.0/mlflow/model-versions/transition-stage', {
            name,
            version,
            stage
        });
    }
    async getModelVersion(name, version) {
        const response = await this.client.get('/api/2.0/mlflow/model-versions/get', {
            params: { name, version }
        });
        return response.data.model_version;
    }
    async searchModelVersions(filter) {
        const response = await this.client.post('/api/2.0/mlflow/model-versions/search', {
            filter_string: filter
        });
        return response.data.model_versions || [];
    }
    async setTag(runId, key, value) {
        await this.client.post('/api/2.0/mlflow/runs/set-tag', {
            run_id: runId,
            key,
            value
        });
    }
    async setTags(runId, tags) {
        for (const [key, value] of Object.entries(tags)) {
            await this.setTag(runId, key, value);
        }
    }
    async compareRuns(runIds) {
        const metrics = {};
        const params = {};
        for (const runId of runIds) {
            const run = await this.getRun(runId);
        }
        return { metrics, params };
    }
    async deployModel(modelName, modelVersion, endpoint) {
        await this.setTag(`${modelName}/${modelVersion}`, 'deployment.endpoint', endpoint);
    }
    async logModelMetrics(runId, trainMetrics, valMetrics, testMetrics) {
        const allMetrics = {};
        Object.entries(trainMetrics).forEach(([key, value]) => {
            allMetrics[`train_${key}`] = value;
        });
        Object.entries(valMetrics).forEach(([key, value]) => {
            allMetrics[`val_${key}`] = value;
        });
        if (testMetrics) {
            Object.entries(testMetrics).forEach(([key, value]) => {
                allMetrics[`test_${key}`] = value;
            });
        }
        await this.logMetrics(runId, allMetrics);
    }
    async logConfusionMatrix(runId, confusionMatrix, labels) {
        const matrixData = {
            matrix: confusionMatrix,
            labels: labels
        };
        const fs = await Promise.resolve().then(() => __importStar(require('fs/promises')));
        const tempPath = `/tmp/confusion_matrix_${runId}.json`;
        await fs.writeFile(tempPath, JSON.stringify(matrixData, null, 2));
        await this.logArtifact(runId, tempPath, 'confusion_matrix.json');
    }
    async logModelExplanation(runId, explanations, explanationType) {
        const fs = await Promise.resolve().then(() => __importStar(require('fs/promises')));
        const tempPath = `/tmp/${explanationType}_explanation_${runId}.json`;
        await fs.writeFile(tempPath, JSON.stringify(explanations, null, 2));
        await this.logArtifact(runId, tempPath, `explanations/${explanationType}.json`);
    }
}
exports.MLflow = MLflow;
//# sourceMappingURL=mlflow-client.js.map