/**
 * MLflow client for experiment tracking and model management
 */

import axios, { AxiosInstance } from 'axios';
import FormData from 'form-data';
import { createReadStream } from 'fs';

export interface MLflowExperiment {
  experiment_id: string;
  name: string;
  artifact_location: string;
  lifecycle_stage: string;
  tags: Record<string, string>;
}

export interface MLflowRun {
  run_id: string;
  experiment_id: string;
  status: string;
  start_time: number;
  end_time?: number;
  lifecycle_stage: string;
}

export interface MLflowMetric {
  key: string;
  value: number;
  timestamp: number;
  step: number;
}

export interface MLflowParam {
  key: string;
  value: string;
}

export interface MLflowModel {
  name: string;
  version: string;
  creation_timestamp: number;
  last_updated_timestamp: number;
  description?: string;
  stage: string;
  tags: Record<string, string>;
}

export class MLflow {
  private client: AxiosInstance;

  constructor(baseURL: string) {
    this.client = axios.create({
      baseURL,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  // Experiment Management
  async createExperiment(name: string, artifactLocation?: string): Promise<string> {
    try {
      const response = await this.client.post('/api/2.0/mlflow/experiments/create', {
        name,
        artifact_location: artifactLocation
      });
      return response.data.experiment_id;
    } catch (error) {
      if ((error as any).response?.data?.error_code === 'RESOURCE_ALREADY_EXISTS') {
        // Get existing experiment
        const experiments = await this.listExperiments();
        const existing = experiments.find(exp => exp.name === name);
        if (existing) return existing.experiment_id;
      }
      throw error;
    }
  }

  async getExperiment(experimentId: string): Promise<MLflowExperiment> {
    const response = await this.client.get('/api/2.0/mlflow/experiments/get', {
      params: { experiment_id: experimentId }
    });
    return response.data.experiment;
  }

  async listExperiments(): Promise<MLflowExperiment[]> {
    const response = await this.client.get('/api/2.0/mlflow/experiments/list');
    return response.data.experiments || [];
  }

  async deleteExperiment(experimentId: string): Promise<void> {
    await this.client.post('/api/2.0/mlflow/experiments/delete', {
      experiment_id: experimentId
    });
  }

  // Run Management
  async startRun(
    experimentId: string, 
    tags?: string[], 
    runName?: string
  ): Promise<string> {
    const response = await this.client.post('/api/2.0/mlflow/runs/create', {
      experiment_id: experimentId,
      run_name: runName,
      tags: tags?.map(tag => ({ key: 'tag', value: tag }))
    });
    return response.data.run.info.run_id;
  }

  async endRun(runId: string, status: 'FINISHED' | 'FAILED' | 'KILLED'): Promise<void> {
    await this.client.post('/api/2.0/mlflow/runs/update', {
      run_id: runId,
      status,
      end_time: Date.now()
    });
  }

  async getRun(runId: string): Promise<MLflowRun> {
    const response = await this.client.get('/api/2.0/mlflow/runs/get', {
      params: { run_id: runId }
    });
    return response.data.run.info;
  }

  async searchRuns(
    experimentIds: string[], 
    filter?: string, 
    maxResults?: number
  ): Promise<MLflowRun[]> {
    const response = await this.client.post('/api/2.0/mlflow/runs/search', {
      experiment_ids: experimentIds,
      filter_string: filter,
      max_results: maxResults
    });
    return response.data.runs?.map((run: any) => run.info) || [];
  }

  // Metrics Logging
  async logMetric(
    runId: string, 
    key: string, 
    value: number, 
    step?: number
  ): Promise<void> {
    await this.client.post('/api/2.0/mlflow/runs/log-metric', {
      run_id: runId,
      key,
      value,
      timestamp: Date.now(),
      step: step || 0
    });
  }

  async logMetrics(
    runId: string, 
    metrics: Record<string, number>, 
    step?: number
  ): Promise<void> {
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

  async getMetricHistory(runId: string, metricKey: string): Promise<MLflowMetric[]> {
    const response = await this.client.get('/api/2.0/mlflow/metrics/get-history', {
      params: {
        run_id: runId,
        metric_key: metricKey
      }
    });
    return response.data.metrics || [];
  }

  // Parameters Logging
  async logParam(runId: string, key: string, value: string): Promise<void> {
    await this.client.post('/api/2.0/mlflow/runs/log-parameter', {
      run_id: runId,
      key,
      value
    });
  }

  async logParams(runId: string, params: Record<string, any>): Promise<void> {
    const batch = Object.entries(params).map(([key, value]) => ({
      key,
      value: String(value)
    }));

    await this.client.post('/api/2.0/mlflow/runs/log-batch', {
      run_id: runId,
      params: batch
    });
  }

  // Artifacts Management
  async logArtifact(runId: string, localPath: string, artifactPath?: string): Promise<void> {
    const formData = new FormData();
    formData.append('file', createReadStream(localPath));
    
    await this.client.post(`/api/2.0/mlflow/artifacts/log-artifact`, formData, {
      params: {
        run_id: runId,
        artifact_path: artifactPath
      },
      headers: formData.getHeaders()
    });
  }

  async listArtifacts(runId: string, path?: string): Promise<any[]> {
    const response = await this.client.get('/api/2.0/mlflow/artifacts/list', {
      params: {
        run_id: runId,
        path
      }
    });
    return response.data.files || [];
  }

  // Model Registry
  async createRegisteredModel(name: string, description?: string): Promise<void> {
    await this.client.post('/api/2.0/mlflow/registered-models/create', {
      name,
      description
    });
  }

  async createModelVersion(
    name: string, 
    source: string, 
    runId: string,
    description?: string
  ): Promise<string> {
    const response = await this.client.post('/api/2.0/mlflow/model-versions/create', {
      name,
      source,
      run_id: runId,
      description
    });
    return response.data.model_version.version;
  }

  async transitionModelVersionStage(
    name: string,
    version: string,
    stage: 'None' | 'Staging' | 'Production' | 'Archived'
  ): Promise<void> {
    await this.client.post('/api/2.0/mlflow/model-versions/transition-stage', {
      name,
      version,
      stage
    });
  }

  async getModelVersion(name: string, version: string): Promise<MLflowModel> {
    const response = await this.client.get('/api/2.0/mlflow/model-versions/get', {
      params: { name, version }
    });
    return response.data.model_version;
  }

  async searchModelVersions(filter?: string): Promise<MLflowModel[]> {
    const response = await this.client.post('/api/2.0/mlflow/model-versions/search', {
      filter_string: filter
    });
    return response.data.model_versions || [];
  }

  // Tags Management
  async setTag(runId: string, key: string, value: string): Promise<void> {
    await this.client.post('/api/2.0/mlflow/runs/set-tag', {
      run_id: runId,
      key,
      value
    });
  }

  async setTags(runId: string, tags: Record<string, string>): Promise<void> {
    for (const [key, value] of Object.entries(tags)) {
      await this.setTag(runId, key, value);
    }
  }

  // Comparison and Analysis
  async compareRuns(runIds: string[]): Promise<{
    metrics: Record<string, MLflowMetric[]>;
    params: Record<string, MLflowParam[]>;
  }> {
    const metrics: Record<string, MLflowMetric[]> = {};
    const params: Record<string, MLflowParam[]> = {};

    for (const runId of runIds) {
      const run = await this.getRun(runId);
      // Fetch metrics and params for each run
      // This is a simplified version - actual implementation would fetch all data
    }

    return { metrics, params };
  }

  // Model Serving Integration
  async deployModel(
    modelName: string, 
    modelVersion: string,
    endpoint: string
  ): Promise<void> {
    // This would integrate with model serving infrastructure
    // Implementation depends on deployment platform (K8s, SageMaker, etc.)
    await this.setTag(
      `${modelName}/${modelVersion}`, 
      'deployment.endpoint', 
      endpoint
    );
  }

  // Experiment Tracking Helpers
  async logModelMetrics(
    runId: string,
    trainMetrics: Record<string, number>,
    valMetrics: Record<string, number>,
    testMetrics?: Record<string, number>
  ): Promise<void> {
    const allMetrics: Record<string, number> = {};
    
    // Prefix metrics
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

  async logConfusionMatrix(
    runId: string,
    confusionMatrix: number[][],
    labels: string[]
  ): Promise<void> {
    // Log as artifact
    const matrixData = {
      matrix: confusionMatrix,
      labels: labels
    };
    
    // Save to temp file and log as artifact
    const fs = await import('fs/promises');
    const tempPath = `/tmp/confusion_matrix_${runId}.json`;
    await fs.writeFile(tempPath, JSON.stringify(matrixData, null, 2));
    await this.logArtifact(runId, tempPath, 'confusion_matrix.json');
  }

  async logModelExplanation(
    runId: string,
    explanations: any,
    explanationType: 'shap' | 'lime' | 'gradcam'
  ): Promise<void> {
    // Log model explanations as artifacts
    const fs = await import('fs/promises');
    const tempPath = `/tmp/${explanationType}_explanation_${runId}.json`;
    await fs.writeFile(tempPath, JSON.stringify(explanations, null, 2));
    await this.logArtifact(runId, tempPath, `explanations/${explanationType}.json`);
  }
}