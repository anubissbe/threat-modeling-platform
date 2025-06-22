# MLOps Infrastructure for AI/ML Service

## Overview

This MLOps infrastructure provides a production-ready machine learning platform for the Threat Modeling Application's AI/ML service. It includes model versioning, automated training pipelines, A/B testing, monitoring, and experiment tracking.

## Architecture

```
mlops/
├── model-registry/         # Model versioning and storage
├── serving/               # Model serving and deployment
├── training-pipeline/     # Training automation and orchestration
├── monitoring/            # Performance and drift monitoring
├── experiments/           # Experiment tracking and hyperparameter tuning
└── mlops-orchestrator.ts  # Central coordinator
```

## Key Components

### 1. Model Registry

**Purpose**: Centralized model storage with versioning and lifecycle management.

**Features**:
- Semantic versioning (e.g., 1.0.20240614)
- S3/MinIO and local storage support
- Model metadata tracking (metrics, hyperparameters, training info)
- Model promotion workflow (draft → staging → production → archived)
- Checksum validation for model integrity

**Usage**:
```typescript
const registry = new ModelRegistry(storage);

// Register a new model
const metadata = await registry.registerModel(modelPath, {
  modelId: 'threat-classifier-001',
  modelName: 'STRIDE Threat Classifier',
  version: '1.0.0',
  modelType: 'threat-classifier',
  framework: 'tensorflow',
  metrics: { accuracy: 0.95, f1Score: 0.93 },
  // ... other metadata
});

// Promote to production
await registry.promoteModel('threat-classifier-001', '1.0.0', 'production');
```

### 2. Model Serving

**Purpose**: High-performance model serving with caching and lifecycle management.

**Features**:
- Multi-model serving with memory management
- Model warm-up and preloading
- Batch prediction support
- A/B testing capabilities
- Automatic model eviction (LRU)
- Framework support (TensorFlow, ONNX planned)

**Configuration**:
```typescript
const serverConfig: ModelServerConfig = {
  maxModelsInMemory: 5,
  preloadModels: ['threat-classifier', 'vulnerability-predictor'],
  warmupOnLoad: true,
  enableGPU: false,
  cacheTTL: 3600,
  healthCheckInterval: 60
};
```

### 3. Training Pipeline

**Purpose**: Automated model training with distributed support and experiment tracking.

**Features**:
- Queue-based job management (Bull/Redis)
- MLflow integration for experiment tracking
- Distributed training support (planned)
- Automatic hyperparameter logging
- Training data versioning
- Model evaluation and comparison

**Training Configuration**:
```typescript
const trainingConfig: TrainingConfig = {
  modelType: 'threat-classifier',
  datasetConfig: {
    trainPath: '/data/train',
    validationPath: '/data/validation',
    testPath: '/data/test',
    augmentation: {
      enabled: true,
      techniques: ['noise', 'rotation']
    }
  },
  modelConfig: {
    architecture: 'lstm',
    optimizer: {
      type: 'adam',
      learningRate: 0.001,
      decay: 0.0001
    },
    loss: 'categorical_crossentropy',
    metrics: ['accuracy', 'precision', 'recall']
  },
  trainingConfig: {
    epochs: 50,
    batchSize: 32,
    earlyStopping: {
      enabled: true,
      patience: 5,
      monitor: 'val_loss',
      mode: 'min'
    }
  }
};
```

### 4. Model Monitoring

**Purpose**: Real-time monitoring of model performance, data drift, and system health.

**Features**:
- Prometheus metrics integration
- Data drift detection (PSI, KL-divergence, Wasserstein)
- Performance tracking (latency, throughput, error rates)
- Alert management (Slack, email, webhooks)
- Model memory usage tracking
- System resource monitoring

**Metrics Exposed**:
- `ml_prediction_latency_seconds` - Prediction latency histogram
- `ml_prediction_errors_total` - Total prediction errors
- `ml_feature_drift_score` - Feature drift scores
- `ml_model_memory_usage_bytes` - Model memory usage
- `ml_system_cpu_usage_percent` - CPU usage

**Alert Configuration**:
```typescript
const monitoringConfig: MonitoringConfig = {
  metricsPort: 9090,
  collectInterval: 30,
  driftDetection: {
    enabled: true,
    method: 'psi',
    threshold: 0.1,
    windowSize: 1000
  },
  performanceTracking: {
    latencyThreshold: 1000, // ms
    errorRateThreshold: 5, // %
    throughputThreshold: 100 // req/s
  },
  alerting: {
    enabled: true,
    channels: ['slack', 'email'],
    slackWebhook: 'https://hooks.slack.com/...'
  }
};
```

### 5. Experiment Manager

**Purpose**: Hyperparameter tuning and experiment tracking.

**Features**:
- Multiple search strategies (Grid, Random, Bayesian)
- Parallel trial execution
- Early stopping support
- MLflow integration
- Experiment comparison
- Automatic best model selection

**Search Strategies**:
- **Grid Search**: Exhaustive search over parameter grid
- **Random Search**: Random sampling from parameter space
- **Bayesian Optimization**: Smart search using surrogate models
- **Hyperband**: (Planned) Bandit-based approach

**Example Experiment**:
```typescript
const experimentConfig: ExperimentConfig = {
  name: 'threat-classifier-optimization',
  objective: 'maximize',
  metric: 'accuracy',
  searchSpace: {
    learning_rate: {
      type: 'log_uniform',
      low: 0.0001,
      high: 0.1
    },
    batch_size: {
      type: 'categorical',
      choices: [16, 32, 64, 128]
    },
    dropout: {
      type: 'float',
      low: 0.1,
      high: 0.5
    }
  },
  searchStrategy: 'bayesian',
  maxTrials: 50,
  parallelTrials: 4
};
```

## API Endpoints

### Training
- `POST /mlops/train` - Submit training job
- `GET /mlops/train/:jobId` - Get training job status

### Model Registry
- `GET /mlops/models` - List all models
- `GET /mlops/models/:modelId/:version` - Get model metadata
- `POST /mlops/models/:modelId/:version/promote` - Promote model

### Deployment
- `POST /mlops/deploy` - Deploy model to serving
- `POST /mlops/predict` - Single prediction
- `POST /mlops/predict/batch` - Batch predictions

### Experiments
- `POST /mlops/experiments` - Create and run experiment
- `GET /mlops/experiments/:experimentId` - Get experiment status
- `POST /mlops/experiments/compare` - Compare experiments

### Monitoring
- `GET /mlops/metrics` - Prometheus metrics
- `GET /mlops/health` - Service health check
- `GET /mlops/models/:modelId/drift` - Get drift metrics

## Deployment

### Docker Deployment

```dockerfile
FROM node:18-alpine

# Install Python for TensorFlow.js
RUN apk add --no-cache python3 py3-pip

WORKDIR /app

# Copy MLOps infrastructure
COPY mlops/ ./mlops/
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Build TypeScript
RUN npm run build

EXPOSE 3006 9090

CMD ["node", "dist/mlops-server.js"]
```

### Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ai-ml-service
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: mlops
        image: threat-model/ai-ml-service:latest
        ports:
        - containerPort: 3006  # API
        - containerPort: 9090  # Metrics
        env:
        - name: MODEL_STORAGE_TYPE
          value: "s3"
        - name: S3_BUCKET
          value: "ml-models"
        resources:
          requests:
            memory: "2Gi"
            cpu: "1"
          limits:
            memory: "4Gi"
            cpu: "2"
```

## Best Practices

### 1. Model Versioning
- Use semantic versioning for models
- Tag models with experiment IDs
- Document model changes in metadata
- Never delete models, archive instead

### 2. Training
- Always use validation data
- Enable early stopping
- Log all hyperparameters
- Save training checkpoints
- Version training data

### 3. Deployment
- Test models in staging first
- Use canary deployments
- Monitor drift continuously
- Set up alerts for anomalies
- Keep fallback models ready

### 4. Monitoring
- Track prediction latency
- Monitor model accuracy over time
- Set up drift detection baselines
- Alert on performance degradation
- Log prediction inputs/outputs

### 5. Experiments
- Use consistent metrics
- Document hypothesis
- Compare against baseline
- Save all experiment artifacts
- Share results with team

## Integration with AI/ML Service

The MLOps infrastructure integrates seamlessly with the existing AI/ML service:

1. **Training Integration**:
```typescript
// In existing train-models.ts
import { TrainingPipeline } from './mlops/training-pipeline/training-pipeline';

const pipeline = new TrainingPipeline(registry, redisUrl);
const jobId = await pipeline.submitJob(config);
```

2. **Serving Integration**:
```typescript
// In existing services
import { ModelServer } from './mlops/serving/model-server';

const server = new ModelServer(registry, config);
const prediction = await server.predict({
  modelId: 'threat-classifier',
  input: threatData
});
```

3. **Monitoring Integration**:
```typescript
// Add to existing routes
app.register(monitoring.metricsPlugin);
app.register(monitoring.healthPlugin);
```

## Future Enhancements

1. **Model Explainability**
   - SHAP/LIME integration
   - Feature importance tracking
   - Prediction explanations

2. **Advanced Serving**
   - GPU support
   - Model quantization
   - Edge deployment

3. **Data Pipeline**
   - Feature store integration
   - Data validation
   - Automated data quality checks

4. **AutoML**
   - Neural architecture search
   - Automated feature engineering
   - Model ensemble creation

5. **Governance**
   - Model approval workflows
   - Compliance tracking
   - Audit trails