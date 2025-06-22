# Enhanced AI/ML Service with MLOps

## Overview

The AI/ML Service has been enhanced with a comprehensive MLOps infrastructure that provides production-ready model management, automated training pipelines, A/B testing, monitoring, and experiment tracking.

## New Features in Phase 3

### 1. Model Registry & Versioning
- Centralized model storage with semantic versioning
- S3/MinIO and local storage support
- Model lifecycle management (draft → staging → production → archived)
- Model metadata tracking and comparison

### 2. Advanced Model Serving
- Multi-model serving with memory management
- A/B testing capabilities
- Batch prediction support
- Model warm-up and preloading
- Automatic model eviction (LRU)

### 3. Automated Training Pipelines
- Queue-based job management with Bull/Redis
- MLflow integration for experiment tracking
- Distributed training support (planned)
- Automatic hyperparameter logging
- Early stopping and checkpointing

### 4. Real-time Monitoring
- Prometheus metrics integration
- Data drift detection (PSI, KL-divergence, Wasserstein)
- Performance tracking (latency, throughput, error rates)
- Alert management (Slack, email, webhooks)
- Model and system resource monitoring

### 5. Experiment Management
- Hyperparameter tuning with multiple search strategies
- Parallel trial execution
- Automatic best model selection
- Experiment comparison and visualization

## Architecture

```
ai-ml-service/
├── src/                    # Existing AI/ML service
│   ├── services/          # ML model services
│   ├── controllers/       # API controllers
│   └── mlops-integration.ts # MLOps integration layer
├── mlops/                  # New MLOps infrastructure
│   ├── model-registry/    # Model versioning & storage
│   ├── serving/          # Model serving & deployment
│   ├── training-pipeline/ # Training automation
│   ├── monitoring/       # Performance & drift monitoring
│   ├── experiments/      # Experiment tracking
│   └── mlops-orchestrator.ts # Central coordinator
└── models/                # Model storage
```

## Quick Start

### 1. Environment Setup

```bash
# Required environment variables
export REDIS_URL=redis://localhost:6379
export MODEL_STORAGE_TYPE=local  # or 's3'
export MODEL_STORAGE_PATH=./models
export METRICS_PORT=9090
export DRIFT_DETECTION_ENABLED=true
export USE_MLOPS_SERVING=true  # Feature flag
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Start Services

```bash
# Start Redis (required for training pipeline)
docker run -d -p 6379:6379 redis:7-alpine

# Start MLflow (optional, for experiment tracking)
docker run -d -p 5000:5000 mlflow/mlflow:latest mlflow server --host 0.0.0.0

# Start the enhanced AI/ML service
npm run dev
```

### 4. Access Services

- AI/ML API: http://localhost:3006
- MLOps API: http://localhost:3006/mlops
- Metrics: http://localhost:9090/metrics
- Swagger Docs: http://localhost:3006/docs

## API Endpoints

### Existing AI/ML Endpoints
- `POST /api/ai/analyze` - Comprehensive AI analysis
- `POST /api/ai/predict/threats` - Threat prediction
- `POST /api/ai/predict/vulnerabilities` - Vulnerability prediction
- `POST /api/ai/mitigations` - Mitigation recommendations
- `POST /api/ai/patterns` - Pattern recognition
- `POST /api/ai/intelligence` - Threat intelligence
- `GET /api/ai/health` - Service health

### New MLOps Endpoints

#### Model Training
```bash
# Submit training job
POST /mlops/train
{
  "config": {
    "modelType": "threat-classifier",
    "datasetConfig": {
      "trainPath": "/data/train",
      "validationPath": "/data/val"
    },
    "modelConfig": {
      "architecture": "lstm",
      "optimizer": {
        "type": "adam",
        "learningRate": 0.001
      }
    },
    "trainingConfig": {
      "epochs": 50,
      "batchSize": 32
    }
  },
  "experimentName": "threat-classifier-v2"
}

# Check training status
GET /mlops/train/{jobId}
```

#### Model Management
```bash
# List models
GET /mlops/models?modelId=threat-classifier

# Get model details
GET /mlops/models/{modelId}/{version}

# Promote model
POST /mlops/models/{modelId}/{version}/promote
{
  "stage": "production"
}

# Compare models
POST /mlops/models/compare
{
  "modelId": "threat-classifier",
  "version1": "1.0.0",
  "version2": "1.1.0"
}
```

#### Model Deployment
```bash
# Deploy model
POST /mlops/deploy
{
  "modelId": "threat-classifier",
  "version": "1.1.0",
  "stage": "production"
}

# Make prediction with MLOps
POST /mlops/predict
{
  "modelId": "threat-classifier",
  "input": {
    "description": "SQL injection attempt detected",
    "context": {...}
  }
}

# Batch prediction
POST /mlops/predict/batch
{
  "requests": [...]
}
```

#### Experiments
```bash
# Create experiment
POST /mlops/experiments
{
  "config": {
    "name": "threat-classifier-optimization",
    "objective": "maximize",
    "metric": "accuracy",
    "searchSpace": {
      "learning_rate": {
        "type": "log_uniform",
        "low": 0.0001,
        "high": 0.1
      },
      "batch_size": {
        "type": "categorical",
        "choices": [16, 32, 64, 128]
      }
    },
    "searchStrategy": "bayesian",
    "maxTrials": 50
  }
}

# Get experiment status
GET /mlops/experiments/{experimentId}

# Compare experiments
POST /mlops/experiments/compare
{
  "experimentIds": ["exp1", "exp2"]
}
```

#### Monitoring
```bash
# Prometheus metrics
GET /mlops/metrics

# Service health
GET /mlops/health

# Drift detection status
GET /mlops/models/{modelId}/drift
```

## Usage Examples

### 1. Train a New Model

```typescript
// Using the training pipeline
const jobId = await trainingPipeline.submitJob({
  modelType: 'threat-classifier',
  datasetConfig: {
    trainPath: '/data/threats/train',
    validationPath: '/data/threats/val',
    testPath: '/data/threats/test'
  },
  modelConfig: {
    architecture: 'lstm',
    optimizer: {
      type: 'adam',
      learningRate: 0.001
    },
    loss: 'categorical_crossentropy',
    metrics: ['accuracy', 'precision', 'recall']
  },
  trainingConfig: {
    epochs: 100,
    batchSize: 32,
    earlyStopping: {
      enabled: true,
      patience: 10,
      monitor: 'val_loss',
      mode: 'min'
    }
  },
  experimentName: 'threat-classifier-lstm-v2'
});
```

### 2. Deploy a Model

```typescript
// Promote model to production
await modelRegistry.promoteModel('threat-classifier', '1.2.0', 'production');

// Load in serving infrastructure
const response = await fetch('/mlops/deploy', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    modelId: 'threat-classifier',
    version: '1.2.0',
    stage: 'production'
  })
});
```

### 3. Run Hyperparameter Tuning

```typescript
// Create and run experiment
const experimentId = await experimentManager.createExperiment({
  name: 'threat-classifier-tuning',
  objective: 'maximize',
  metric: 'val_accuracy',
  searchSpace: {
    learning_rate: {
      type: 'log_uniform',
      low: 0.0001,
      high: 0.1
    },
    dropout: {
      type: 'float',
      low: 0.1,
      high: 0.5
    },
    lstm_units: {
      type: 'categorical',
      choices: [64, 128, 256]
    }
  },
  searchStrategy: 'bayesian',
  maxTrials: 100,
  parallelTrials: 4
});
```

### 4. Monitor Model Performance

```typescript
// Initialize drift detection
await fetch('/mlops/models/threat-classifier/drift/init', {
  method: 'POST',
  body: JSON.stringify({
    referenceData: trainingData
  })
});

// Check metrics
const metrics = await fetch('/mlops/metrics').then(r => r.text());
console.log(metrics); // Prometheus format
```

## Configuration

### Environment Variables

```env
# MLOps Storage
MODEL_STORAGE_TYPE=s3|local
MODEL_STORAGE_PATH=./models
S3_ENDPOINT=http://localhost:9000  # MinIO
S3_REGION=us-east-1
MODEL_BUCKET=ml-models

# Model Serving
MAX_MODELS_IN_MEMORY=5
PRELOAD_MODELS=threat-classifier,vulnerability-predictor
WARMUP_ON_LOAD=true
MODEL_CACHE_TTL=3600

# Monitoring
METRICS_PORT=9090
DRIFT_DETECTION_ENABLED=true
DRIFT_DETECTION_METHOD=psi
DRIFT_DETECTION_THRESHOLD=0.1
DRIFT_WINDOW_SIZE=1000

# Training
REDIS_URL=redis://localhost:6379
MLFLOW_URL=http://localhost:5000

# Alerting
ALERTING_ENABLED=true
ALERT_CHANNELS=slack,email
SLACK_WEBHOOK_URL=https://hooks.slack.com/...

# Feature Flags
USE_MLOPS_SERVING=true
USE_MLOPS_TRAINING=true
USE_MLOPS_MONITORING=true
USE_MLOPS_REGISTRY=true
```

## Monitoring Dashboard

### Prometheus Metrics

Key metrics exposed:
- `ml_prediction_latency_seconds` - Prediction latency
- `ml_prediction_errors_total` - Total prediction errors
- `ml_predictions_total` - Total predictions
- `ml_model_memory_usage_bytes` - Model memory usage
- `ml_feature_drift_score` - Feature drift scores
- `ml_system_cpu_usage_percent` - CPU usage

### Grafana Dashboard

Import the provided dashboard JSON to visualize:
- Model performance trends
- Drift detection alerts
- System resource usage
- Training job status
- A/B test results

## Migration Guide

### Gradual Migration Strategy

1. **Phase 1: Registry Only**
   ```env
   USE_MLOPS_REGISTRY=true
   USE_MLOPS_SERVING=false
   ```

2. **Phase 2: Add Monitoring**
   ```env
   USE_MLOPS_MONITORING=true
   ```

3. **Phase 3: Enable Serving**
   ```env
   USE_MLOPS_SERVING=true
   ```

4. **Phase 4: Full MLOps**
   ```env
   USE_MLOPS_TRAINING=true
   ```

### Migrating Existing Models

```bash
# Run migration script
npm run migrate:models

# Or programmatically
await migrateExistingModels();
```

## Best Practices

### 1. Model Versioning
- Use semantic versioning (MAJOR.MINOR.PATCH)
- Tag models with experiment IDs
- Document changes in metadata
- Never delete models, archive instead

### 2. Training
- Always split data (train/val/test)
- Enable early stopping
- Log all hyperparameters
- Save checkpoints frequently
- Version your training data

### 3. Deployment
- Test in staging first
- Use canary deployments (10% → 50% → 100%)
- Monitor drift continuously
- Set up alerts for anomalies
- Keep fallback models ready

### 4. Monitoring
- Set baseline metrics
- Track prediction latency
- Monitor accuracy over time
- Alert on drift > threshold
- Log prediction inputs/outputs

## Troubleshooting

### Common Issues

1. **Models not loading**
   - Check model registry path
   - Verify model files exist
   - Check permissions

2. **High memory usage**
   - Reduce MAX_MODELS_IN_MEMORY
   - Enable model pruning
   - Use model quantization

3. **Slow predictions**
   - Enable model warmup
   - Check Redis connection
   - Use batch predictions

4. **Training failures**
   - Check Redis connection
   - Verify data paths
   - Check GPU availability

## Future Enhancements

1. **Model Explainability**
   - SHAP/LIME integration
   - Feature importance
   - Prediction explanations

2. **Advanced Serving**
   - GPU support
   - Model quantization
   - Edge deployment
   - Federated learning

3. **AutoML**
   - Neural architecture search
   - Automated feature engineering
   - Ensemble creation

4. **Data Pipeline**
   - Feature store integration
   - Data validation
   - Automated quality checks

## Support

For issues or questions:
- Check logs: `docker logs ai-ml-service`
- View metrics: http://localhost:9090/metrics
- API docs: http://localhost:3006/docs
- Health check: http://localhost:3006/mlops/health