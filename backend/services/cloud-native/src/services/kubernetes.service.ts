import * as k8s from '@kubernetes/client-node';
import { logger } from '../utils/logger';
import {
  KubernetesConfig,
  K8sCluster,
  HorizontalScalingConfig,
  VerticalScalingConfig,
  K8sDeployment,
  K8sService,
  PodStatus,
  DeploymentStatus,
  ServiceStatus
} from '../types/cloud-native';

export class KubernetesService {
  private config: KubernetesConfig;
  private k8sClients: Map<string, k8s.KubeConfig> = new Map();
  private activeCluster: string | null = null;

  constructor(config: KubernetesConfig) {
    this.config = config;
    this.initializeClusters();
  }

  /**
   * Initialize Kubernetes clusters
   */
  private initializeClusters(): void {
    for (const cluster of this.config.clusters) {
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
        
        if (cluster.active && !this.activeCluster) {
          this.activeCluster = cluster.name;
        }

        logger.info(`Kubernetes cluster initialized: ${cluster.name}`);
      } catch (error) {
        logger.error(`Failed to initialize cluster ${cluster.name}`, error);
      }
    }

    if (!this.activeCluster && this.config.clusters.length > 0) {
      this.activeCluster = this.config.clusters[0].name;
    }
  }

  /**
   * Get active KubeConfig
   */
  private getKubeConfig(clusterName?: string): k8s.KubeConfig {
    const name = clusterName || this.activeCluster;
    if (!name) {
      throw new Error('No active cluster configured');
    }

    const kc = this.k8sClients.get(name);
    if (!kc) {
      throw new Error(`Cluster ${name} not found`);
    }

    return kc;
  }

  /**
   * Create namespace
   */
  public async createNamespace(name: string, labels?: Record<string, string>): Promise<void> {
    try {
      const kc = this.getKubeConfig();
      const k8sCoreApi = kc.makeApiClient(k8s.CoreV1Api);

      const namespace = {
        apiVersion: 'v1',
        kind: 'Namespace',
        metadata: {
          name,
          labels: {
            'managed-by': 'cloud-native-service',
            ...labels
          }
        }
      };

      await k8sCoreApi.createNamespace(namespace);
      logger.info(`Namespace ${name} created`);
    } catch (error: any) {
      if (error.response?.statusCode === 409) {
        logger.info(`Namespace ${name} already exists`);
      } else {
        logger.error(`Failed to create namespace ${name}`, error);
        throw error;
      }
    }
  }

  /**
   * List namespaces
   */
  public async listNamespaces(): Promise<string[]> {
    try {
      const kc = this.getKubeConfig();
      const k8sCoreApi = kc.makeApiClient(k8s.CoreV1Api);

      const { body } = await k8sCoreApi.listNamespace();
      return body.items.map(ns => ns.metadata?.name || '').filter(name => name);
    } catch (error) {
      logger.error('Failed to list namespaces', error);
      throw error;
    }
  }

  /**
   * Create or update deployment
   */
  public async applyDeployment(deployment: K8sDeployment): Promise<DeploymentStatus> {
    try {
      const kc = this.getKubeConfig();
      const k8sAppsApi = kc.makeApiClient(k8s.AppsV1Api);
      const namespace = deployment.metadata.namespace || this.config.namespace;

      try {
        // Try to update existing deployment
        await k8sAppsApi.patchNamespacedDeployment(
          deployment.metadata.name,
          namespace,
          deployment,
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
        logger.info(`Deployment ${deployment.metadata.name} updated`);
      } catch (error: any) {
        if (error.response?.statusCode === 404) {
          // Create new deployment
          await k8sAppsApi.createNamespacedDeployment(namespace, deployment as any);
          logger.info(`Deployment ${deployment.metadata.name} created`);
        } else {
          throw error;
        }
      }

      return await this.getDeploymentStatus(deployment.metadata.name, namespace);
    } catch (error) {
      logger.error('Failed to apply deployment', error);
      throw error;
    }
  }

  /**
   * Get deployment status
   */
  public async getDeploymentStatus(name: string, namespace?: string): Promise<DeploymentStatus> {
    try {
      const kc = this.getKubeConfig();
      const k8sAppsApi = kc.makeApiClient(k8s.AppsV1Api);
      const ns = namespace || this.config.namespace;

      const { body: deployment } = await k8sAppsApi.readNamespacedDeployment(name, ns);

      return {
        name,
        namespace: ns,
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
    } catch (error) {
      logger.error(`Failed to get deployment status for ${name}`, error);
      throw error;
    }
  }

  /**
   * List deployments
   */
  public async listDeployments(namespace?: string): Promise<DeploymentStatus[]> {
    try {
      const kc = this.getKubeConfig();
      const k8sAppsApi = kc.makeApiClient(k8s.AppsV1Api);
      const ns = namespace || this.config.namespace;

      const { body } = await k8sAppsApi.listNamespacedDeployment(ns);

      return Promise.all(
        body.items.map(deployment => 
          this.getDeploymentStatus(deployment.metadata?.name || '', ns)
        )
      );
    } catch (error) {
      logger.error('Failed to list deployments', error);
      throw error;
    }
  }

  /**
   * Scale deployment
   */
  public async scaleDeployment(name: string, replicas: number, namespace?: string): Promise<DeploymentStatus> {
    try {
      const kc = this.getKubeConfig();
      const k8sAppsApi = kc.makeApiClient(k8s.AppsV1Api);
      const ns = namespace || this.config.namespace;

      await k8sAppsApi.patchNamespacedDeploymentScale(
        name,
        ns,
        {
          spec: {
            replicas
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

      logger.info(`Deployment ${name} scaled to ${replicas} replicas`);
      return await this.getDeploymentStatus(name, ns);
    } catch (error) {
      logger.error(`Failed to scale deployment ${name}`, error);
      throw error;
    }
  }

  /**
   * Delete deployment
   */
  public async deleteDeployment(name: string, namespace?: string): Promise<void> {
    try {
      const kc = this.getKubeConfig();
      const k8sAppsApi = kc.makeApiClient(k8s.AppsV1Api);
      const ns = namespace || this.config.namespace;

      await k8sAppsApi.deleteNamespacedDeployment(name, ns);
      logger.info(`Deployment ${name} deleted`);
    } catch (error) {
      logger.error(`Failed to delete deployment ${name}`, error);
      throw error;
    }
  }

  /**
   * Create or update service
   */
  public async applyService(service: K8sService): Promise<ServiceStatus> {
    try {
      const kc = this.getKubeConfig();
      const k8sCoreApi = kc.makeApiClient(k8s.CoreV1Api);
      const namespace = service.metadata.namespace || this.config.namespace;

      try {
        // Try to update existing service
        await k8sCoreApi.patchNamespacedService(
          service.metadata.name,
          namespace,
          service,
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
        logger.info(`Service ${service.metadata.name} updated`);
      } catch (error: any) {
        if (error.response?.statusCode === 404) {
          // Create new service
          await k8sCoreApi.createNamespacedService(namespace, service);
          logger.info(`Service ${service.metadata.name} created`);
        } else {
          throw error;
        }
      }

      return await this.getServiceStatus(service.metadata.name, namespace);
    } catch (error) {
      logger.error('Failed to apply service', error);
      throw error;
    }
  }

  /**
   * Get service status
   */
  public async getServiceStatus(name: string, namespace?: string): Promise<ServiceStatus> {
    try {
      const kc = this.getKubeConfig();
      const k8sCoreApi = kc.makeApiClient(k8s.CoreV1Api);
      const ns = namespace || this.config.namespace;

      const { body: service } = await k8sCoreApi.readNamespacedService(name, ns);

      return {
        name,
        namespace: ns,
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
    } catch (error) {
      logger.error(`Failed to get service status for ${name}`, error);
      throw error;
    }
  }

  /**
   * List services
   */
  public async listServices(namespace?: string): Promise<ServiceStatus[]> {
    try {
      const kc = this.getKubeConfig();
      const k8sCoreApi = kc.makeApiClient(k8s.CoreV1Api);
      const ns = namespace || this.config.namespace;

      const { body } = await k8sCoreApi.listNamespacedService(ns);

      return Promise.all(
        body.items.map(service => 
          this.getServiceStatus(service.metadata?.name || '', ns)
        )
      );
    } catch (error) {
      logger.error('Failed to list services', error);
      throw error;
    }
  }

  /**
   * Get pods
   */
  public async getPods(namespace?: string, labelSelector?: string): Promise<PodStatus[]> {
    try {
      const kc = this.getKubeConfig();
      const k8sCoreApi = kc.makeApiClient(k8s.CoreV1Api);
      const ns = namespace || this.config.namespace;

      const { body } = await k8sCoreApi.listNamespacedPod(
        ns,
        undefined,
        undefined,
        undefined,
        undefined,
        labelSelector
      );

      return body.items.map(pod => ({
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
      logger.error('Failed to get pods', error);
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
   * Get pod logs
   */
  public async getPodLogs(podName: string, namespace?: string, containerName?: string, lines?: number): Promise<string> {
    try {
      const kc = this.getKubeConfig();
      const k8sCoreApi = kc.makeApiClient(k8s.CoreV1Api);
      const ns = namespace || this.config.namespace;

      const { body } = await k8sCoreApi.readNamespacedPodLog(
        podName,
        ns,
        containerName,
        false,
        false,
        undefined,
        undefined,
        false,
        undefined,
        lines
      );

      return body;
    } catch (error) {
      logger.error(`Failed to get pod logs for ${podName}`, error);
      throw error;
    }
  }

  /**
   * Execute command in pod
   */
  public async execInPod(
    podName: string,
    command: string[],
    namespace?: string,
    containerName?: string
  ): Promise<string> {
    try {
      const kc = this.getKubeConfig();
      const exec = new k8s.Exec(kc);
      const ns = namespace || this.config.namespace;

      return new Promise((resolve, reject) => {
        let stdout = '';
        let stderr = '';

        exec.exec(
          ns,
          podName,
          containerName!,
          command,
          process.stdout,
          process.stderr,
          process.stdin,
          false,
          (status: k8s.V1Status) => {
            if (status.status === 'Success') {
              resolve(stdout);
            } else {
              reject(new Error(stderr || status.message));
            }
          }
        );
      });
    } catch (error) {
      logger.error(`Failed to execute command in pod ${podName}`, error);
      throw error;
    }
  }

  /**
   * Create horizontal pod autoscaler
   */
  public async createHPA(
    name: string,
    targetName: string,
    config: HorizontalScalingConfig,
    namespace?: string
  ): Promise<void> {
    try {
      const kc = this.getKubeConfig();
      const k8sAutoscalingApi = kc.makeApiClient(k8s.AutoscalingV2Api);
      const ns = namespace || this.config.namespace;

      const hpa = {
        apiVersion: 'autoscaling/v2',
        kind: 'HorizontalPodAutoscaler',
        metadata: {
          name,
          namespace: ns
        },
        spec: {
          scaleTargetRef: {
            apiVersion: 'apps/v1',
            kind: 'Deployment',
            name: targetName
          },
          minReplicas: config.minReplicas,
          maxReplicas: config.maxReplicas,
          metrics: config.metrics.map(m => {
            if (m.type === 'cpu') {
              return {
                type: 'Resource',
                resource: {
                  name: 'cpu',
                  target: {
                    type: m.target.type === 'utilization' ? 'Utilization' : 'AverageValue',
                    averageUtilization: m.target.type === 'utilization' ? m.target.value : undefined,
                    averageValue: m.target.type !== 'utilization' ? `${m.target.value}m` : undefined
                  }
                }
              };
            } else if (m.type === 'memory') {
              return {
                type: 'Resource',
                resource: {
                  name: 'memory',
                  target: {
                    type: m.target.type === 'utilization' ? 'Utilization' : 'AverageValue',
                    averageUtilization: m.target.type === 'utilization' ? m.target.value : undefined,
                    averageValue: m.target.type !== 'utilization' ? `${m.target.value}Mi` : undefined
                  }
                }
              };
            } else {
              return {
                type: 'External',
                external: {
                  metric: {
                    name: m.resource || '',
                    selector: {}
                  },
                  target: {
                    type: 'Value',
                    value: `${m.target.value}`
                  }
                }
              };
            }
          }),
          behavior: {
            scaleUp: {
              policies: config.behavior.scaleUp.policies.map(p => ({
                type: p.type === 'pods' ? 'Pods' : 'Percent',
                value: p.value,
                periodSeconds: p.periodSeconds
              })),
              stabilizationWindowSeconds: config.behavior.scaleUp.stabilizationWindowSeconds
            },
            scaleDown: {
              policies: config.behavior.scaleDown.policies.map(p => ({
                type: p.type === 'pods' ? 'Pods' : 'Percent',
                value: p.value,
                periodSeconds: p.periodSeconds
              })),
              stabilizationWindowSeconds: config.behavior.scaleDown.stabilizationWindowSeconds
            }
          }
        }
      };

      await k8sAutoscalingApi.createNamespacedHorizontalPodAutoscaler(ns, hpa);
      logger.info(`HPA ${name} created for ${targetName}`);
    } catch (error) {
      logger.error('Failed to create HPA', error);
      throw error;
    }
  }

  /**
   * Create vertical pod autoscaler
   */
  public async createVPA(
    name: string,
    targetName: string,
    config: VerticalScalingConfig,
    namespace?: string
  ): Promise<void> {
    try {
      const kc = this.getKubeConfig();
      const k8sCustomApi = kc.makeApiClient(k8s.CustomObjectsApi);
      const ns = namespace || this.config.namespace;

      const vpa = {
        apiVersion: 'autoscaling.k8s.io/v1',
        kind: 'VerticalPodAutoscaler',
        metadata: {
          name,
          namespace: ns
        },
        spec: {
          targetRef: {
            apiVersion: 'apps/v1',
            kind: 'Deployment',
            name: targetName
          },
          updatePolicy: {
            updateMode: config.updateMode
          },
          resourcePolicy: {
            containerPolicies: config.resourcePolicy.containerPolicies.map(cp => ({
              containerName: cp.containerName,
              minAllowed: cp.minAllowed,
              maxAllowed: cp.maxAllowed,
              controlledResources: cp.controlledResources
            }))
          }
        }
      };

      await k8sCustomApi.createNamespacedCustomObject(
        'autoscaling.k8s.io',
        'v1',
        ns,
        'verticalpodautoscalers',
        vpa
      );

      logger.info(`VPA ${name} created for ${targetName}`);
    } catch (error) {
      logger.error('Failed to create VPA', error);
      throw error;
    }
  }

  /**
   * Switch active cluster
   */
  public switchCluster(clusterName: string): void {
    if (!this.k8sClients.has(clusterName)) {
      throw new Error(`Cluster ${clusterName} not found`);
    }

    this.activeCluster = clusterName;
    logger.info(`Switched to cluster: ${clusterName}`);
  }

  /**
   * Get active cluster
   */
  public getActiveCluster(): string | null {
    return this.activeCluster;
  }

  /**
   * Get all clusters
   */
  public getClusters(): K8sCluster[] {
    return this.config.clusters;
  }

  /**
   * Health check
   */
  public async healthCheck(clusterName?: string): Promise<boolean> {
    try {
      const kc = this.getKubeConfig(clusterName);
      const k8sCoreApi = kc.makeApiClient(k8s.CoreV1Api);
      
      await k8sCoreApi.listNamespace();
      return true;
    } catch (error) {
      logger.error('Kubernetes health check failed', error);
      return false;
    }
  }
}