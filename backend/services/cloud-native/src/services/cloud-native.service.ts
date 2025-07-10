import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import * as k8s from '@kubernetes/client-node';
import Docker from 'dockerode';
import * as yaml from 'js-yaml';
import { logger } from '../utils/logger';
import {
  CloudNativeConfig,
  K8sDeployment,
  K8sService,
  K8sConfigMap,
  K8sSecret,
  DeploymentStatus,
  ServiceStatus,
  PodStatus,
  CloudNativeEvent,
  DeployRequest,
  ScaleRequest,
  RolloutRequest,
  K8sDeploymentSpec,
  K8sPodSpec,
  K8sContainer,
  K8sServiceSpec
} from '../types/cloud-native';

export class CloudNativeService extends EventEmitter {
  private config: CloudNativeConfig;
  private k8sClients: Map<string, k8s.KubeConfig> = new Map();
  private dockerClient!: Docker;
  private events: CloudNativeEvent[] = [];
  private deployments: Map<string, DeploymentStatus> = new Map();
  private services: Map<string, ServiceStatus> = new Map();

  constructor(config: CloudNativeConfig) {
    super();
    this.config = config;
    this.initializeKubernetes();
    this.initializeDocker();
    
    logger.info('Cloud-native service initialized', {
      kubernetes: config.kubernetes.enabled,
      clusters: config.kubernetes.clusters.length,
      serviceMesh: config.serviceMesh.type,
      registry: config.registry.type
    });
  }

  /**
   * Initialize Kubernetes clients
   */
  private initializeKubernetes(): void {
    if (!this.config.kubernetes.enabled) {
      logger.info('Kubernetes is disabled');
      return;
    }

    for (const cluster of this.config.kubernetes.clusters) {
      try {
        const kc = new k8s.KubeConfig();
        
        if (cluster.kubeconfig) {
          kc.loadFromFile(cluster.kubeconfig);
        } else {
          kc.loadFromDefault();
        }

        if (cluster.context) {
          kc.setCurrentContext(cluster.context);
        }

        this.k8sClients.set(cluster.name, kc);
        logger.info(`Kubernetes client initialized for cluster: ${cluster.name}`);
      } catch (error) {
        logger.error(`Failed to initialize Kubernetes client for cluster: ${cluster.name}`, error);
      }
    }
  }

  /**
   * Initialize Docker client
   */
  private initializeDocker(): void {
    try {
      this.dockerClient = new Docker({
        socketPath: '/var/run/docker.sock'
      });
      
      logger.info('Docker client initialized');
    } catch (error) {
      logger.error('Failed to initialize Docker client', error);
    }
  }

  /**
   * Deploy application to Kubernetes
   */
  public async deployApplication(request: DeployRequest): Promise<DeploymentStatus> {
    try {
      const deployment = this.createDeployment(request);
      const service = this.createService(request);
      
      const kc = this.getActiveKubeConfig();
      const k8sAppsApi = kc.makeApiClient(k8s.AppsV1Api);
      const k8sCoreApi = kc.makeApiClient(k8s.CoreV1Api);

      // Create deployment
      await k8sAppsApi.createNamespacedDeployment(
        request.namespace,
        deployment as any
      );

      // Create service
      await k8sCoreApi.createNamespacedService(
        request.namespace,
        service
      );

      const status = await this.getDeploymentStatus(request.name, request.namespace);
      
      this.addEvent({
        type: 'deployment',
        resource: request.name,
        namespace: request.namespace,
        message: `Application ${request.name} deployed successfully`,
        level: 'info',
        metadata: {}
      });

      return status;
    } catch (error) {
      logger.error('Failed to deploy application', error);
      this.addEvent({
        type: 'deployment',
        resource: request.name,
        namespace: request.namespace,
        message: `Failed to deploy application: ${error instanceof Error ? error.message : 'Unknown error'}`,
        level: 'error',
        metadata: {}
      });
      throw error;
    }
  }

  /**
   * Create Kubernetes deployment
   */
  private createDeployment(request: DeployRequest): K8sDeployment {
    const labels = {
      app: request.name,
      version: 'v1',
      'managed-by': 'cloud-native-service'
    };

    const containers: K8sContainer[] = [{
      name: request.name,
      image: request.image,
      imagePullPolicy: 'IfNotPresent',
      ports: request.ports?.map(port => ({
        containerPort: port,
        protocol: 'TCP'
      })),
      env: request.env ? Object.entries(request.env).map(([name, value]) => ({
        name,
        value
      })) : undefined,
      resources: request.resources,
      livenessProbe: {
        httpGet: {
          path: '/health',
          port: request.ports?.[0] || 8080
        },
        initialDelaySeconds: 30,
        periodSeconds: 10
      },
      readinessProbe: {
        httpGet: {
          path: '/ready',
          port: request.ports?.[0] || 8080
        },
        initialDelaySeconds: 5,
        periodSeconds: 5
      }
    }];

    const podSpec: K8sPodSpec = {
      containers,
      serviceAccountName: this.config.kubernetes.serviceAccount
    };

    const deploymentSpec: K8sDeploymentSpec = {
      replicas: request.replicas || this.config.kubernetes.defaultReplicas,
      selector: {
        matchLabels: labels
      },
      template: {
        metadata: {
          name: request.name,
          namespace: request.namespace,
          labels
        },
        spec: podSpec
      },
      strategy: {
        type: 'rolling',
        maxSurge: '25%',
        maxUnavailable: '25%',
        progressDeadlineSeconds: 600
      }
    };

    return {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: {
        name: request.name,
        namespace: request.namespace,
        labels
      },
      spec: deploymentSpec
    };
  }

  /**
   * Create Kubernetes service
   */
  private createService(request: DeployRequest): K8sService {
    const labels = {
      app: request.name,
      'managed-by': 'cloud-native-service'
    };

    const serviceSpec: K8sServiceSpec = {
      type: 'ClusterIP',
      selector: {
        app: request.name
      },
      ports: request.ports?.map((port, index) => ({
        name: `port-${index}`,
        protocol: 'TCP',
        port,
        targetPort: port
      })) || [{
        name: 'http',
        protocol: 'TCP',
        port: 80,
        targetPort: 8080
      }]
    };

    return {
      apiVersion: 'v1',
      kind: 'Service',
      metadata: {
        name: request.name,
        namespace: request.namespace,
        labels
      },
      spec: serviceSpec
    };
  }

  /**
   * Scale deployment
   */
  public async scaleDeployment(request: ScaleRequest): Promise<DeploymentStatus> {
    try {
      const kc = this.getActiveKubeConfig();
      const k8sAppsApi = kc.makeApiClient(k8s.AppsV1Api);

      await k8sAppsApi.patchNamespacedDeploymentScale(
        request.name,
        request.namespace,
        {
          spec: {
            replicas: request.replicas
          }
        },
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        {
          headers: {
            'Content-Type': 'application/merge-patch+json'
          }
        }
      );

      const status = await this.getDeploymentStatus(request.name, request.namespace);
      
      this.addEvent({
        type: 'scaling',
        resource: request.name,
        namespace: request.namespace,
        message: `Deployment ${request.name} scaled to ${request.replicas} replicas`,
        level: 'info',
        metadata: {}
      });

      return status;
    } catch (error) {
      logger.error('Failed to scale deployment', error);
      throw error;
    }
  }

  /**
   * Perform rolling update
   */
  public async performRollout(request: RolloutRequest): Promise<DeploymentStatus> {
    try {
      const kc = this.getActiveKubeConfig();
      const k8sAppsApi = kc.makeApiClient(k8s.AppsV1Api);

      // Get current deployment
      const { body: deployment } = await k8sAppsApi.readNamespacedDeployment(
        request.name,
        request.namespace
      );

      // Update image
      if (deployment.spec?.template.spec?.containers[0]) {
        deployment.spec.template.spec.containers[0].image = request.image;
      }

      // Apply rollout strategy
      if (request.strategy === 'canary' && request.canaryWeight) {
        // Implement canary deployment using service mesh or multiple deployments
        logger.info(`Performing canary rollout with ${request.canaryWeight}% traffic`);
      }

      // Update deployment
      await k8sAppsApi.replaceNamespacedDeployment(
        request.name,
        request.namespace,
        deployment
      );

      const status = await this.getDeploymentStatus(request.name, request.namespace);
      
      this.addEvent({
        type: 'deployment',
        resource: request.name,
        namespace: request.namespace,
        message: `Rollout started for ${request.name} with image ${request.image}`,
        level: 'info',
        metadata: {}
      });

      return status;
    } catch (error) {
      logger.error('Failed to perform rollout', error);
      throw error;
    }
  }

  /**
   * Get deployment status
   */
  public async getDeploymentStatus(name: string, namespace: string): Promise<DeploymentStatus> {
    try {
      const kc = this.getActiveKubeConfig();
      const k8sAppsApi = kc.makeApiClient(k8s.AppsV1Api);

      const { body: deployment } = await k8sAppsApi.readNamespacedDeployment(
        name,
        namespace
      );

      const status: DeploymentStatus = {
        name,
        namespace,
        ready: deployment.status?.readyReplicas === deployment.status?.replicas,
        replicas: {
          desired: deployment.spec?.replicas || 0,
          current: deployment.status?.replicas || 0,
          ready: deployment.status?.readyReplicas || 0,
          available: deployment.status?.availableReplicas || 0
        },
        conditions: deployment.status?.conditions?.map(c => ({
          type: c.type,
          status: c.status,
          lastUpdateTime: new Date(c.lastUpdateTime || ''),
          reason: c.reason,
          message: c.message
        })) || [],
        images: deployment.spec?.template.spec?.containers.map(c => c.image || '') || []
      };

      this.deployments.set(`${namespace}/${name}`, status);
      return status;
    } catch (error) {
      logger.error('Failed to get deployment status', error);
      throw error;
    }
  }

  /**
   * Get service status
   */
  public async getServiceStatus(name: string, namespace: string): Promise<ServiceStatus> {
    try {
      const kc = this.getActiveKubeConfig();
      const k8sCoreApi = kc.makeApiClient(k8s.CoreV1Api);

      const { body: service } = await k8sCoreApi.readNamespacedService(
        name,
        namespace
      );

      const status: ServiceStatus = {
        name,
        namespace,
        type: service.spec?.type || 'ClusterIP',
        clusterIP: service.spec?.clusterIP || '',
        externalIPs: service.spec?.externalIPs,
        ports: service.spec?.ports?.map(p => ({
          name: p.name,
          protocol: p.protocol || 'TCP',
          port: p.port,
          targetPort: p.targetPort as number,
          nodePort: p.nodePort
        })) || [],
        selector: service.spec?.selector || {}
      };

      this.services.set(`${namespace}/${name}`, status);
      return status;
    } catch (error) {
      logger.error('Failed to get service status', error);
      throw error;
    }
  }

  /**
   * Get pod status
   */
  public async getPodStatus(namespace: string, labelSelector?: string): Promise<PodStatus[]> {
    try {
      const kc = this.getActiveKubeConfig();
      const k8sCoreApi = kc.makeApiClient(k8s.CoreV1Api);

      const { body: podList } = await k8sCoreApi.listNamespacedPod(
        namespace,
        undefined,
        undefined,
        undefined,
        undefined,
        labelSelector
      );

      return podList.items.map(pod => ({
        name: pod.metadata?.name || '',
        namespace: pod.metadata?.namespace || '',
        phase: pod.status?.phase as any || 'Unknown',
        conditions: pod.status?.conditions?.map(c => ({
          type: c.type,
          status: c.status,
          lastProbeTime: c.lastProbeTime ? new Date(c.lastProbeTime) : undefined,
          lastTransitionTime: c.lastTransitionTime ? new Date(c.lastTransitionTime) : undefined,
          reason: c.reason,
          message: c.message
        })) || [],
        containerStatuses: pod.status?.containerStatuses?.map(cs => ({
          name: cs.name,
          ready: cs.ready,
          restartCount: cs.restartCount,
          image: cs.image || '',
          imageID: cs.imageID || '',
          state: this.parseContainerState(cs.state)
        })) || [],
        ip: pod.status?.podIP,
        node: pod.spec?.nodeName
      }));
    } catch (error) {
      logger.error('Failed to get pod status', error);
      throw error;
    }
  }

  /**
   * Parse container state
   */
  private parseContainerState(state: any): any {
    const result: any = {};
    
    if (state?.waiting) {
      result.waiting = {
        reason: state.waiting.reason,
        message: state.waiting.message
      };
    }
    
    if (state?.running) {
      result.running = {
        startedAt: new Date(state.running.startedAt)
      };
    }
    
    if (state?.terminated) {
      result.terminated = {
        exitCode: state.terminated.exitCode,
        reason: state.terminated.reason,
        message: state.terminated.message,
        startedAt: state.terminated.startedAt ? new Date(state.terminated.startedAt) : undefined,
        finishedAt: state.terminated.finishedAt ? new Date(state.terminated.finishedAt) : undefined
      };
    }
    
    return result;
  }

  /**
   * Build Docker image
   */
  public async buildDockerImage(
    dockerfile: string,
    context: string,
    tag: string,
    buildArgs?: Record<string, string>
  ): Promise<void> {
    try {
      const stream = await this.dockerClient.buildImage(
        {
          context,
          src: [dockerfile]
        },
        {
          t: tag,
          buildargs: buildArgs
        }
      );

      await new Promise((resolve, reject) => {
        this.dockerClient.modem.followProgress(
          stream,
          (err: any, res: any) => err ? reject(err) : resolve(res),
          (event: any) => {
            if (event.stream) {
              logger.debug(`Docker build: ${event.stream.trim()}`);
            }
          }
        );
      });

      logger.info(`Docker image built successfully: ${tag}`);
      
      this.addEvent({
        type: 'deployment',
        resource: tag,
        namespace: 'docker',
        message: `Docker image ${tag} built successfully`,
        level: 'info',
        metadata: {}
      });
    } catch (error) {
      logger.error('Failed to build Docker image', error);
      throw error;
    }
  }

  /**
   * Push Docker image to registry
   */
  public async pushDockerImage(tag: string): Promise<void> {
    try {
      const image = this.dockerClient.getImage(tag);
      const stream = await image.push({
        authconfig: {
          username: this.config.docker.registries[0]?.username,
          password: this.config.docker.registries[0]?.password,
          email: this.config.docker.registries[0]?.email,
          serveraddress: this.config.docker.registries[0]?.url
        }
      });

      await new Promise((resolve, reject) => {
        this.dockerClient.modem.followProgress(
          stream,
          (err: any, res: any) => err ? reject(err) : resolve(res),
          (event: any) => {
            if (event.status) {
              logger.debug(`Docker push: ${event.status}`);
            }
          }
        );
      });

      logger.info(`Docker image pushed successfully: ${tag}`);
      
      this.addEvent({
        type: 'deployment',
        resource: tag,
        namespace: 'docker',
        message: `Docker image ${tag} pushed to registry`,
        level: 'info',
        metadata: {}
      });
    } catch (error) {
      logger.error('Failed to push Docker image', error);
      throw error;
    }
  }

  /**
   * Create ConfigMap
   */
  public async createConfigMap(
    name: string,
    namespace: string,
    data: Record<string, string>
  ): Promise<void> {
    try {
      const kc = this.getActiveKubeConfig();
      const k8sCoreApi = kc.makeApiClient(k8s.CoreV1Api);

      const configMap: K8sConfigMap = {
        apiVersion: 'v1',
        kind: 'ConfigMap',
        metadata: {
          name,
          namespace,
          labels: {
            'managed-by': 'cloud-native-service'
          }
        },
        data
      };

      await k8sCoreApi.createNamespacedConfigMap(namespace, configMap);
      
      logger.info(`ConfigMap ${name} created in namespace ${namespace}`);
      
      this.addEvent({
        type: 'config',
        resource: name,
        namespace,
        message: `ConfigMap ${name} created`,
        level: 'info',
        metadata: {}
      });
    } catch (error) {
      logger.error('Failed to create ConfigMap', error);
      throw error;
    }
  }

  /**
   * Create Secret
   */
  public async createSecret(
    name: string,
    namespace: string,
    data: Record<string, string>,
    type: string = 'Opaque'
  ): Promise<void> {
    try {
      const kc = this.getActiveKubeConfig();
      const k8sCoreApi = kc.makeApiClient(k8s.CoreV1Api);

      // Encode data to base64
      const encodedData: Record<string, string> = {};
      for (const [key, value] of Object.entries(data)) {
        encodedData[key] = Buffer.from(value).toString('base64');
      }

      const secret: K8sSecret = {
        apiVersion: 'v1',
        kind: 'Secret',
        metadata: {
          name,
          namespace,
          labels: {
            'managed-by': 'cloud-native-service'
          }
        },
        type,
        data: encodedData
      };

      await k8sCoreApi.createNamespacedSecret(namespace, secret);
      
      logger.info(`Secret ${name} created in namespace ${namespace}`);
      
      this.addEvent({
        type: 'security',
        resource: name,
        namespace,
        message: `Secret ${name} created`,
        level: 'info',
        metadata: {}
      });
    } catch (error) {
      logger.error('Failed to create Secret', error);
      throw error;
    }
  }

  /**
   * Apply YAML manifest
   */
  public async applyManifest(yamlContent: string): Promise<void> {
    try {
      const manifests = yaml.loadAll(yamlContent) as any[];
      
      for (const manifest of manifests) {
        await this.applyResource(manifest);
      }
      
      logger.info('YAML manifest applied successfully');
    } catch (error) {
      logger.error('Failed to apply YAML manifest', error);
      throw error;
    }
  }

  /**
   * Apply single resource
   */
  private async applyResource(resource: any): Promise<void> {
    const kc = this.getActiveKubeConfig();
    
    switch (resource.kind) {
      case 'Deployment':
        const k8sAppsApi = kc.makeApiClient(k8s.AppsV1Api);
        await k8sAppsApi.createNamespacedDeployment(
          resource.metadata.namespace || 'default',
          resource
        );
        break;
        
      case 'Service':
        const k8sCoreApi = kc.makeApiClient(k8s.CoreV1Api);
        await k8sCoreApi.createNamespacedService(
          resource.metadata.namespace || 'default',
          resource
        );
        break;
        
      case 'ConfigMap':
        const k8sConfigMapApi = kc.makeApiClient(k8s.CoreV1Api);
        await k8sConfigMapApi.createNamespacedConfigMap(
          resource.metadata.namespace || 'default',
          resource
        );
        break;
        
      case 'Secret':
        const k8sSecretApi = kc.makeApiClient(k8s.CoreV1Api);
        await k8sSecretApi.createNamespacedSecret(
          resource.metadata.namespace || 'default',
          resource
        );
        break;
        
      default:
        logger.warn(`Unsupported resource kind: ${resource.kind}`);
    }
  }

  /**
   * Get active Kubernetes configuration
   */
  private getActiveKubeConfig(): k8s.KubeConfig {
    const activeCluster = this.config.kubernetes.clusters.find(c => c.active);
    if (!activeCluster) {
      throw new Error('No active Kubernetes cluster configured');
    }

    const kc = this.k8sClients.get(activeCluster.name);
    if (!kc) {
      throw new Error(`Kubernetes client not found for cluster: ${activeCluster.name}`);
    }

    return kc;
  }

  /**
   * Add event
   */
  private addEvent(event: Omit<CloudNativeEvent, 'id' | 'timestamp'>): void {
    const fullEvent: CloudNativeEvent = {
      id: uuidv4(),
      timestamp: new Date(),
      ...event,
      metadata: event.metadata || {}
    };

    this.events.push(fullEvent);
    this.emit('event', fullEvent);

    // Keep only last 10000 events
    if (this.events.length > 10000) {
      this.events = this.events.slice(-10000);
    }
  }

  /**
   * Get events
   */
  public getEvents(limit: number = 100): CloudNativeEvent[] {
    return this.events
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Get all deployments
   */
  public getAllDeployments(): DeploymentStatus[] {
    return Array.from(this.deployments.values());
  }

  /**
   * Get all services
   */
  public getAllServices(): ServiceStatus[] {
    return Array.from(this.services.values());
  }

  /**
   * Health check
   */
  public async healthCheck(): Promise<{ kubernetes: boolean; docker: boolean }> {
    const health = {
      kubernetes: false,
      docker: false
    };

    // Check Kubernetes
    try {
      const kc = this.getActiveKubeConfig();
      const k8sCoreApi = kc.makeApiClient(k8s.CoreV1Api);
      await k8sCoreApi.listNamespace();
      health.kubernetes = true;
    } catch (error) {
      logger.error('Kubernetes health check failed', error);
    }

    // Check Docker
    try {
      await this.dockerClient.ping();
      health.docker = true;
    } catch (error) {
      logger.error('Docker health check failed', error);
    }

    return health;
  }
}