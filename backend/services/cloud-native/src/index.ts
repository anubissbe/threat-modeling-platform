import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import dotenv from 'dotenv';
import { CloudNativeService } from './services/cloud-native.service';
import { CloudNativeController } from './controllers/cloud-native.controller';
import { createCloudNativeRoutes } from './routes/cloud-native.routes';
import { logger } from './utils/logger';
import { CloudNativeConfig } from './types/cloud-native';

// Load environment variables
dotenv.config();

// Default configuration
const defaultConfig: CloudNativeConfig = {
  kubernetes: {
    enabled: true,
    namespace: 'threat-modeling',
    clusters: [
      {
        name: 'default',
        endpoint: process.env.K8S_ENDPOINT || 'https://kubernetes.default.svc',
        region: process.env.K8S_REGION || 'us-east-1',
        provider: 'self-managed',
        active: true
      }
    ],
    defaultReplicas: 3,
    resourceQuotas: {
      cpu: '1000m',
      memory: '2Gi',
      storage: '10Gi',
      persistentVolumeClaims: 10,
      services: 10,
      configMaps: 20,
      secrets: 20
    },
    networkPolicies: [],
    serviceAccount: 'threat-modeling-sa',
    rbac: {
      enabled: true,
      roles: [],
      roleBindings: []
    }
  },
  docker: {
    registries: [
      {
        name: 'dockerhub',
        url: 'https://index.docker.io/v1/',
        username: process.env.DOCKER_USERNAME,
        password: process.env.DOCKER_PASSWORD,
        email: process.env.DOCKER_EMAIL,
        secure: true
      }
    ],
    buildConfig: {
      dockerfile: 'Dockerfile',
      context: '.',
      args: {},
      cache: true,
      multiStage: true,
      platforms: ['linux/amd64', 'linux/arm64']
    },
    runtimeConfig: {
      network: 'bridge',
      volumes: [],
      environment: {},
      resources: {
        cpus: '1',
        memory: '512m'
      }
    },
    compose: {
      version: '3.8',
      services: {}
    }
  },
  serviceMesh: {
    type: 'istio',
    enabled: true,
    mtls: {
      enabled: true,
      mode: 'strict'
    },
    trafficManagement: {
      retries: {
        attempts: 3,
        perTryTimeout: '30s',
        retryOn: ['5xx', 'reset', 'connect-failure', 'refused-stream']
      },
      circuitBreaker: {
        consecutiveErrors: 5,
        interval: '30s',
        baseEjectionTime: '30s',
        maxEjectionPercent: 50
      },
      loadBalancing: {
        algorithm: 'round_robin'
      },
      canary: {
        enabled: false,
        weight: 10
      }
    },
    observability: {
      tracing: {
        enabled: true,
        sampling: 0.1,
        backend: 'jaeger'
      },
      metrics: {
        enabled: true,
        prometheus: true,
        grafana: true
      },
      accessLogs: {
        enabled: true,
        format: 'JSON'
      }
    },
    security: {
      authz: {
        enabled: true,
        provider: 'opa',
        policies: []
      },
      authentication: {
        jwt: {
          enabled: true,
          issuer: process.env.JWT_ISSUER || 'https://auth.threat-modeling.com',
          jwksUri: process.env.JWKS_URI || 'https://auth.threat-modeling.com/.well-known/jwks.json'
        }
      }
    }
  },
  registry: {
    type: 'harbor',
    url: process.env.REGISTRY_URL || 'https://registry.threat-modeling.com',
    credentials: {
      username: process.env.REGISTRY_USERNAME,
      password: process.env.REGISTRY_PASSWORD
    },
    scanOnPush: true,
    vulnerabilityThreshold: 'high',
    signImages: true,
    replication: {
      enabled: false,
      targets: []
    }
  },
  observability: {
    metrics: {
      provider: 'prometheus',
      endpoint: process.env.METRICS_ENDPOINT || 'http://prometheus:9090',
      interval: '30s',
      labels: {
        service: 'cloud-native',
        environment: process.env.NODE_ENV || 'development'
      },
      customMetrics: []
    },
    logging: {
      level: 'info',
      format: 'json',
      outputs: [
        {
          type: 'stdout',
          config: {}
        }
      ],
      structured: true
    },
    tracing: {
      enabled: true,
      backend: 'jaeger',
      endpoint: process.env.TRACING_ENDPOINT || 'http://jaeger:14268/api/traces',
      sampling: {
        type: 'probabilistic',
        param: 0.1
      }
    },
    monitoring: {
      dashboards: [],
      alerts: [],
      slos: []
    }
  },
  deployment: {
    strategy: {
      type: 'rolling',
      maxSurge: '25%',
      maxUnavailable: '25%',
      progressDeadlineSeconds: 600
    },
    environments: [
      {
        name: 'development',
        cluster: 'default',
        namespace: 'threat-modeling-dev',
        values: {},
        secrets: {},
        configMaps: {}
      },
      {
        name: 'staging',
        cluster: 'default',
        namespace: 'threat-modeling-staging',
        values: {},
        secrets: {},
        configMaps: {}
      },
      {
        name: 'production',
        cluster: 'default',
        namespace: 'threat-modeling-prod',
        values: {},
        secrets: {},
        configMaps: {}
      }
    ],
    gitOps: {
      enabled: true,
      tool: 'argocd',
      repository: process.env.GITOPS_REPO || 'https://github.com/threat-modeling/deployments',
      branch: 'main',
      path: 'applications',
      syncPolicy: {
        automated: true,
        prune: true,
        selfHeal: true
      }
    },
    pipeline: {
      stages: [],
      triggers: [],
      notifications: []
    }
  },
  security: {
    scanning: {
      vulnerability: {
        enabled: true,
        scanners: ['trivy'],
        severity: ['CRITICAL', 'HIGH'],
        ignoreUnfixed: false
      },
      static: {
        enabled: true,
        tools: ['sonarqube']
      },
      runtime: {
        enabled: true,
        tools: ['falco']
      }
    },
    policies: {
      admission: {
        enabled: true,
        provider: 'opa',
        policies: []
      },
      runtime: {
        enabled: true,
        provider: 'falco',
        rules: []
      }
    },
    secrets: {
      provider: 'vault',
      encryption: {
        enabled: true,
        key: process.env.ENCRYPTION_KEY || ''
      },
      rotation: {
        enabled: true,
        interval: '90d'
      }
    },
    compliance: {
      frameworks: ['SOC2', 'ISO27001'],
      scanning: {
        enabled: true,
        schedule: '0 0 * * *'
      },
      reporting: {
        enabled: true,
        format: 'json'
      }
    }
  },
  scaling: {
    horizontal: {
      enabled: true,
      minReplicas: 2,
      maxReplicas: 10,
      metrics: [
        {
          type: 'cpu',
          target: {
            type: 'utilization',
            value: 70
          }
        },
        {
          type: 'memory',
          target: {
            type: 'utilization',
            value: 80
          }
        }
      ],
      behavior: {
        scaleUp: {
          policies: [
            {
              type: 'percent',
              value: 100,
              periodSeconds: 60
            }
          ],
          stabilizationWindowSeconds: 60
        },
        scaleDown: {
          policies: [
            {
              type: 'percent',
              value: 50,
              periodSeconds: 300
            }
          ],
          stabilizationWindowSeconds: 300
        }
      }
    },
    vertical: {
      enabled: true,
      updateMode: 'auto',
      resourcePolicy: {
        containerPolicies: []
      }
    },
    cluster: {
      enabled: true,
      nodeGroups: [
        {
          name: 'general',
          instanceType: 't3.medium',
          minSize: 2,
          maxSize: 10,
          desiredSize: 3,
          labels: {
            'nodegroup-type': 'general'
          },
          taints: []
        }
      ],
      autoScaling: {
        minNodes: 2,
        maxNodes: 20,
        scaleDownDelay: '10m',
        scaleDownUnneededTime: '10m'
      }
    }
  }
};

// Initialize services
const config = defaultConfig; // In production, load from config file or environment
const cloudNativeService = new CloudNativeService(config);

// Initialize controller
const controller = new CloudNativeController(
  cloudNativeService
);

// Create Express app
const app = express();

// Apply middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (_, res) => {
  res.json({
    status: 'healthy',
    service: 'cloud-native',
    timestamp: new Date().toISOString()
  });
});

// Apply routes
app.use('/api/v1/cloud-native', createCloudNativeRoutes(controller));

// Error handling middleware
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error', err);
  
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    timestamp: new Date()
  });
});

// Start server
const PORT = parseInt(process.env.PORT || '3015', 10);
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
  logger.info(`Cloud-Native service started on ${HOST}:${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, starting graceful shutdown');
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, starting graceful shutdown');
  process.exit(0);
});

export { app };