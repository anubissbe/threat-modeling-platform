import { Request, Response } from 'express';

// Core Cloud-Native Types
export interface CloudNativeConfig {
  kubernetes: KubernetesConfig;
  docker: DockerConfig;
  serviceMesh: ServiceMeshConfig;
  registry: RegistryConfig;
  observability: ObservabilityConfig;
  deployment: DeploymentConfig;
  security: SecurityConfig;
  scaling: ScalingConfig;
}

// Kubernetes Configuration
export interface KubernetesConfig {
  enabled: boolean;
  namespace: string;
  clusters: K8sCluster[];
  defaultReplicas: number;
  resourceQuotas: ResourceQuotas;
  networkPolicies: NetworkPolicy[];
  serviceAccount: string;
  rbac: RBACConfig;
}

export interface K8sCluster {
  name: string;
  endpoint: string;
  region: string;
  provider: 'eks' | 'gke' | 'aks' | 'self-managed';
  kubeconfig?: string;
  context?: string;
  active: boolean;
}

export interface ResourceQuotas {
  cpu: string;
  memory: string;
  storage: string;
  persistentVolumeClaims: number;
  services: number;
  configMaps: number;
  secrets: number;
}

export interface NetworkPolicy {
  name: string;
  podSelector: Record<string, string>;
  policyTypes: ('Ingress' | 'Egress')[];
  ingress?: NetworkPolicyRule[];
  egress?: NetworkPolicyRule[];
}

export interface NetworkPolicyRule {
  from?: NetworkPolicyPeer[];
  to?: NetworkPolicyPeer[];
  ports?: NetworkPolicyPort[];
}

export interface NetworkPolicyPeer {
  podSelector?: Record<string, string>;
  namespaceSelector?: Record<string, string>;
  ipBlock?: {
    cidr: string;
    except?: string[];
  };
}

export interface NetworkPolicyPort {
  protocol: 'TCP' | 'UDP' | 'SCTP';
  port: number | string;
}

export interface RBACConfig {
  enabled: boolean;
  roles: K8sRole[];
  roleBindings: K8sRoleBinding[];
}

export interface K8sRole {
  name: string;
  rules: PolicyRule[];
}

export interface PolicyRule {
  apiGroups: string[];
  resources: string[];
  verbs: string[];
}

export interface K8sRoleBinding {
  name: string;
  roleRef: {
    apiGroup: string;
    kind: string;
    name: string;
  };
  subjects: {
    kind: string;
    name: string;
    namespace?: string;
  }[];
}

// Docker Configuration
export interface DockerConfig {
  registries: DockerRegistry[];
  buildConfig: DockerBuildConfig;
  runtimeConfig: DockerRuntimeConfig;
  compose: DockerComposeConfig;
}

export interface DockerRegistry {
  name: string;
  url: string;
  username?: string;
  password?: string;
  email?: string;
  secure: boolean;
}

export interface DockerBuildConfig {
  dockerfile: string;
  context: string;
  args: Record<string, string>;
  target?: string;
  cache: boolean;
  multiStage: boolean;
  platforms: string[];
}

export interface DockerRuntimeConfig {
  network: string;
  volumes: VolumeConfig[];
  environment: Record<string, string>;
  resources: {
    cpus: string;
    memory: string;
  };
}

export interface VolumeConfig {
  name: string;
  driver: string;
  driverOpts?: Record<string, string>;
  external?: boolean;
}

export interface DockerComposeConfig {
  version: string;
  services: Record<string, ComposeService>;
  networks?: Record<string, any>;
  volumes?: Record<string, any>;
}

export interface ComposeService {
  image?: string;
  build?: {
    context: string;
    dockerfile?: string;
    args?: Record<string, string>;
  };
  ports?: string[];
  environment?: Record<string, string>;
  volumes?: string[];
  depends_on?: string[];
  networks?: string[];
  deploy?: {
    replicas?: number;
    resources?: {
      limits?: {
        cpus?: string;
        memory?: string;
      };
      reservations?: {
        cpus?: string;
        memory?: string;
      };
    };
  };
}

// Service Mesh Configuration
export interface ServiceMeshConfig {
  type: 'istio' | 'linkerd' | 'consul' | 'kuma';
  enabled: boolean;
  mtls: {
    enabled: boolean;
    mode: 'strict' | 'permissive';
  };
  trafficManagement: TrafficManagementConfig;
  observability: MeshObservabilityConfig;
  security: MeshSecurityConfig;
}

export interface TrafficManagementConfig {
  retries: {
    attempts: number;
    perTryTimeout: string;
    retryOn: string[];
  };
  circuitBreaker: {
    consecutiveErrors: number;
    interval: string;
    baseEjectionTime: string;
    maxEjectionPercent: number;
  };
  loadBalancing: {
    algorithm: 'round_robin' | 'least_request' | 'random' | 'passthrough';
  };
  canary: {
    enabled: boolean;
    weight: number;
    headers?: Record<string, string>;
  };
}

export interface MeshObservabilityConfig {
  tracing: {
    enabled: boolean;
    sampling: number;
    backend: 'jaeger' | 'zipkin' | 'datadog';
  };
  metrics: {
    enabled: boolean;
    prometheus: boolean;
    grafana: boolean;
  };
  accessLogs: {
    enabled: boolean;
    format: string;
  };
}

export interface MeshSecurityConfig {
  authz: {
    enabled: boolean;
    provider: 'opa' | 'custom';
    policies: AuthorizationPolicy[];
  };
  authentication: {
    jwt: {
      enabled: boolean;
      issuer: string;
      jwksUri: string;
    };
  };
}

export interface AuthorizationPolicy {
  name: string;
  namespace: string;
  selector: Record<string, string>;
  action: 'ALLOW' | 'DENY';
  rules: AuthzRule[];
}

export interface AuthzRule {
  from?: {
    source: {
      principals?: string[];
      namespaces?: string[];
    };
  };
  to?: {
    operation: {
      methods?: string[];
      paths?: string[];
    };
  };
  when?: Condition[];
}

export interface Condition {
  key: string;
  values: string[];
}

// Registry Configuration
export interface RegistryConfig {
  type: 'harbor' | 'dockerhub' | 'ecr' | 'gcr' | 'acr';
  url: string;
  credentials: {
    username?: string;
    password?: string;
    token?: string;
  };
  scanOnPush: boolean;
  vulnerabilityThreshold: 'low' | 'medium' | 'high' | 'critical';
  signImages: boolean;
  replication: {
    enabled: boolean;
    targets: string[];
  };
}

// Observability Configuration
export interface ObservabilityConfig {
  metrics: MetricsConfig;
  logging: LoggingConfig;
  tracing: TracingConfig;
  monitoring: MonitoringConfig;
}

export interface MetricsConfig {
  provider: 'prometheus' | 'datadog' | 'newrelic' | 'cloudwatch';
  endpoint: string;
  interval: string;
  labels: Record<string, string>;
  customMetrics: CustomMetric[];
}

export interface CustomMetric {
  name: string;
  type: 'counter' | 'gauge' | 'histogram' | 'summary';
  help: string;
  labels?: string[];
}

export interface LoggingConfig {
  level: 'debug' | 'info' | 'warn' | 'error';
  format: 'json' | 'text';
  outputs: LogOutput[];
  structured: boolean;
}

export interface LogOutput {
  type: 'stdout' | 'file' | 'elasticsearch' | 'splunk' | 'datadog';
  config: Record<string, any>;
}

export interface TracingConfig {
  enabled: boolean;
  backend: 'jaeger' | 'zipkin' | 'datadog' | 'xray';
  endpoint: string;
  sampling: {
    type: 'probabilistic' | 'ratelimiting' | 'adaptive';
    param: number;
  };
}

export interface MonitoringConfig {
  dashboards: Dashboard[];
  alerts: Alert[];
  slos: SLO[];
}

export interface Dashboard {
  name: string;
  provider: 'grafana' | 'datadog' | 'cloudwatch';
  uid: string;
  panels: Panel[];
}

export interface Panel {
  title: string;
  type: 'graph' | 'stat' | 'table' | 'heatmap';
  query: string;
  thresholds?: number[];
}

export interface Alert {
  name: string;
  condition: string;
  threshold: number;
  duration: string;
  severity: 'info' | 'warning' | 'critical';
  annotations: Record<string, string>;
  receivers: string[];
}

export interface SLO {
  name: string;
  description: string;
  target: number;
  window: string;
  indicators: SLI[];
}

export interface SLI {
  name: string;
  query: string;
  type: 'availability' | 'latency' | 'error_rate' | 'custom';
}

// Deployment Configuration
export interface DeploymentConfig {
  strategy: DeploymentStrategy;
  environments: Environment[];
  gitOps: GitOpsConfig;
  pipeline: PipelineConfig;
}

export interface DeploymentStrategy {
  type: 'rolling' | 'blue_green' | 'canary' | 'recreate';
  maxSurge: number | string;
  maxUnavailable: number | string;
  progressDeadlineSeconds: number;
}

export interface Environment {
  name: string;
  cluster: string;
  namespace: string;
  values: Record<string, any>;
  secrets: Record<string, string>;
  configMaps: Record<string, string>;
}

export interface GitOpsConfig {
  enabled: boolean;
  tool: 'argocd' | 'flux' | 'jenkins-x';
  repository: string;
  branch: string;
  path: string;
  syncPolicy: {
    automated: boolean;
    prune: boolean;
    selfHeal: boolean;
  };
}

export interface PipelineConfig {
  stages: PipelineStage[];
  triggers: PipelineTrigger[];
  notifications: PipelineNotification[];
}

export interface PipelineStage {
  name: string;
  type: 'build' | 'test' | 'scan' | 'deploy' | 'verify';
  steps: PipelineStep[];
  when?: string;
}

export interface PipelineStep {
  name: string;
  image?: string;
  command?: string[];
  environment?: Record<string, string>;
  artifacts?: string[];
}

export interface PipelineTrigger {
  type: 'push' | 'pull_request' | 'tag' | 'schedule';
  branches?: string[];
  schedule?: string;
}

export interface PipelineNotification {
  type: 'email' | 'slack' | 'webhook';
  events: string[];
  config: Record<string, string>;
}

// Security Configuration
export interface SecurityConfig {
  scanning: SecurityScanningConfig;
  policies: SecurityPolicyConfig;
  secrets: SecretsConfig;
  compliance: ComplianceConfig;
}

export interface SecurityScanningConfig {
  vulnerability: {
    enabled: boolean;
    scanners: ('trivy' | 'clair' | 'snyk' | 'twistlock')[];
    severity: string[];
    ignoreUnfixed: boolean;
  };
  static: {
    enabled: boolean;
    tools: ('sonarqube' | 'checkmarx' | 'veracode')[];
  };
  runtime: {
    enabled: boolean;
    tools: ('falco' | 'sysdig' | 'aqua')[];
  };
}

export interface SecurityPolicyConfig {
  admission: {
    enabled: boolean;
    provider: 'opa' | 'kyverno' | 'polaris';
    policies: AdmissionPolicy[];
  };
  runtime: {
    enabled: boolean;
    provider: 'falco' | 'sysdig';
    rules: RuntimeRule[];
  };
}

export interface AdmissionPolicy {
  name: string;
  resource: string;
  match: Record<string, any>;
  validate: Record<string, any>;
  enforce: boolean;
}

export interface RuntimeRule {
  name: string;
  description: string;
  condition: string;
  action: 'alert' | 'block' | 'audit';
  severity: string;
}

export interface SecretsConfig {
  provider: 'vault' | 'sealed-secrets' | 'external-secrets' | 'kubernetes';
  encryption: {
    enabled: boolean;
    key: string;
  };
  rotation: {
    enabled: boolean;
    interval: string;
  };
}

export interface ComplianceConfig {
  frameworks: string[];
  scanning: {
    enabled: boolean;
    schedule: string;
  };
  reporting: {
    enabled: boolean;
    format: 'json' | 'pdf' | 'html';
  };
}

// Scaling Configuration
export interface ScalingConfig {
  horizontal: HorizontalScalingConfig;
  vertical: VerticalScalingConfig;
  cluster: ClusterScalingConfig;
}

export interface HorizontalScalingConfig {
  enabled: boolean;
  minReplicas: number;
  maxReplicas: number;
  metrics: ScalingMetric[];
  behavior: ScalingBehavior;
}

export interface ScalingMetric {
  type: 'cpu' | 'memory' | 'custom';
  target: {
    type: 'utilization' | 'value' | 'averagevalue';
    value: number;
  };
  resource?: string;
}

export interface ScalingBehavior {
  scaleUp: {
    policies: ScalingPolicy[];
    stabilizationWindowSeconds: number;
  };
  scaleDown: {
    policies: ScalingPolicy[];
    stabilizationWindowSeconds: number;
  };
}

export interface ScalingPolicy {
  type: 'pods' | 'percent';
  value: number;
  periodSeconds: number;
}

export interface VerticalScalingConfig {
  enabled: boolean;
  updateMode: 'auto' | 'recreate' | 'initial';
  resourcePolicy: {
    containerPolicies: ContainerResourcePolicy[];
  };
}

export interface ContainerResourcePolicy {
  containerName: string;
  minAllowed: ResourceList;
  maxAllowed: ResourceList;
  controlledResources: string[];
}

export interface ResourceList {
  cpu?: string;
  memory?: string;
}

export interface ClusterScalingConfig {
  enabled: boolean;
  nodeGroups: NodeGroup[];
  autoScaling: {
    minNodes: number;
    maxNodes: number;
    scaleDownDelay: string;
    scaleDownUnneededTime: string;
  };
}

export interface NodeGroup {
  name: string;
  instanceType: string;
  minSize: number;
  maxSize: number;
  desiredSize: number;
  labels: Record<string, string>;
  taints: Taint[];
}

export interface Taint {
  key: string;
  value: string;
  effect: 'NoSchedule' | 'PreferNoSchedule' | 'NoExecute';
}

// Kubernetes Resources
export interface K8sDeployment {
  apiVersion: string;
  kind: 'Deployment';
  metadata: K8sMetadata;
  spec: K8sDeploymentSpec;
}

export interface K8sService {
  apiVersion: string;
  kind: 'Service';
  metadata: K8sMetadata;
  spec: K8sServiceSpec;
}

export interface K8sConfigMap {
  apiVersion: string;
  kind: 'ConfigMap';
  metadata: K8sMetadata;
  data: Record<string, string>;
}

export interface K8sSecret {
  apiVersion: string;
  kind: 'Secret';
  metadata: K8sMetadata;
  type: string;
  data: Record<string, string>;
}

export interface K8sMetadata {
  name: string;
  namespace: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

export interface K8sDeploymentSpec {
  replicas: number;
  selector: {
    matchLabels: Record<string, string>;
  };
  template: {
    metadata: K8sMetadata;
    spec: K8sPodSpec;
  };
  strategy?: {
    type: 'rolling' | 'recreate';
    maxSurge?: string;
    maxUnavailable?: string;
    progressDeadlineSeconds?: number;
  };
}

export interface K8sPodSpec {
  containers: K8sContainer[];
  initContainers?: K8sContainer[];
  volumes?: K8sVolume[];
  serviceAccountName?: string;
  securityContext?: K8sSecurityContext;
  affinity?: K8sAffinity;
  tolerations?: K8sToleration[];
}

export interface K8sContainer {
  name: string;
  image: string;
  imagePullPolicy?: 'Always' | 'IfNotPresent' | 'Never';
  ports?: K8sContainerPort[];
  env?: K8sEnvVar[];
  envFrom?: K8sEnvFrom[];
  resources?: K8sResourceRequirements;
  volumeMounts?: K8sVolumeMount[];
  livenessProbe?: K8sProbe;
  readinessProbe?: K8sProbe;
  startupProbe?: K8sProbe;
  securityContext?: K8sSecurityContext;
}

export interface K8sContainerPort {
  name?: string;
  containerPort: number;
  protocol?: 'TCP' | 'UDP' | 'SCTP';
}

export interface K8sEnvVar {
  name: string;
  value?: string;
  valueFrom?: {
    configMapKeyRef?: {
      name: string;
      key: string;
    };
    secretKeyRef?: {
      name: string;
      key: string;
    };
  };
}

export interface K8sEnvFrom {
  configMapRef?: {
    name: string;
  };
  secretRef?: {
    name: string;
  };
}

export interface K8sResourceRequirements {
  requests?: ResourceList;
  limits?: ResourceList;
}

export interface K8sVolume {
  name: string;
  configMap?: {
    name: string;
    items?: {
      key: string;
      path: string;
    }[];
  };
  secret?: {
    secretName: string;
    items?: {
      key: string;
      path: string;
    }[];
  };
  persistentVolumeClaim?: {
    claimName: string;
  };
  emptyDir?: {
    medium?: string;
    sizeLimit?: string;
  };
}

export interface K8sVolumeMount {
  name: string;
  mountPath: string;
  subPath?: string;
  readOnly?: boolean;
}

export interface K8sProbe {
  httpGet?: {
    path: string;
    port: number | string;
    scheme?: 'HTTP' | 'HTTPS';
  };
  tcpSocket?: {
    port: number | string;
  };
  exec?: {
    command: string[];
  };
  initialDelaySeconds?: number;
  periodSeconds?: number;
  timeoutSeconds?: number;
  successThreshold?: number;
  failureThreshold?: number;
}

export interface K8sSecurityContext {
  runAsUser?: number;
  runAsGroup?: number;
  runAsNonRoot?: boolean;
  readOnlyRootFilesystem?: boolean;
  allowPrivilegeEscalation?: boolean;
  capabilities?: {
    add?: string[];
    drop?: string[];
  };
}

export interface K8sAffinity {
  nodeAffinity?: {
    requiredDuringSchedulingIgnoredDuringExecution?: {
      nodeSelectorTerms: {
        matchExpressions?: {
          key: string;
          operator: string;
          values?: string[];
        }[];
      }[];
    };
  };
  podAffinity?: any;
  podAntiAffinity?: any;
}

export interface K8sToleration {
  key: string;
  operator?: 'Exists' | 'Equal';
  value?: string;
  effect?: 'NoSchedule' | 'PreferNoSchedule' | 'NoExecute';
  tolerationSeconds?: number;
}

export interface K8sServiceSpec {
  type: 'ClusterIP' | 'NodePort' | 'LoadBalancer' | 'ExternalName';
  selector: Record<string, string>;
  ports: K8sServicePort[];
  clusterIP?: string;
  externalTrafficPolicy?: 'Cluster' | 'Local';
  sessionAffinity?: 'None' | 'ClientIP';
}

export interface K8sServicePort {
  name?: string;
  protocol: 'TCP' | 'UDP' | 'SCTP';
  port: number;
  targetPort: number | string;
  nodePort?: number;
}

// API Response Types
export interface CloudNativeResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: Date;
  requestId: string;
}

export interface DeploymentStatus {
  name: string;
  namespace: string;
  ready: boolean;
  replicas: {
    desired: number;
    current: number;
    ready: number;
    available: number;
  };
  conditions: DeploymentCondition[];
  images: string[];
}

export interface DeploymentCondition {
  type: string;
  status: string;
  lastUpdateTime: Date;
  reason?: string;
  message?: string;
}

export interface ServiceStatus {
  name: string;
  namespace: string;
  type: string;
  clusterIP: string;
  externalIPs?: string[];
  ports: ServicePortStatus[];
  selector: Record<string, string>;
}

export interface ServicePortStatus {
  name?: string;
  protocol: string;
  port: number;
  targetPort: number | string;
  nodePort?: number;
}

export interface PodStatus {
  name: string;
  namespace: string;
  phase: 'Pending' | 'Running' | 'Succeeded' | 'Failed' | 'Unknown';
  conditions: PodCondition[];
  containerStatuses: ContainerStatus[];
  ip?: string;
  node?: string;
}

export interface PodCondition {
  type: string;
  status: string;
  lastProbeTime?: Date;
  lastTransitionTime?: Date;
  reason?: string;
  message?: string;
}

export interface ContainerStatus {
  name: string;
  ready: boolean;
  restartCount: number;
  image: string;
  imageID: string;
  state: ContainerState;
}

export interface ContainerState {
  waiting?: {
    reason: string;
    message?: string;
  };
  running?: {
    startedAt: Date;
  };
  terminated?: {
    exitCode: number;
    reason?: string;
    message?: string;
    startedAt?: Date;
    finishedAt?: Date;
  };
}

// Helm Types
export interface HelmChart {
  name: string;
  version: string;
  description: string;
  apiVersion: string;
  appVersion: string;
  dependencies?: HelmDependency[];
  values: Record<string, any>;
}

export interface HelmDependency {
  name: string;
  version: string;
  repository: string;
  condition?: string;
  tags?: string[];
}

export interface HelmRelease {
  name: string;
  namespace: string;
  chart: string;
  version: string;
  status: 'deployed' | 'pending' | 'failed' | 'superseded';
  revision: number;
  updated: Date;
  values: Record<string, any>;
}

// Operator Types
export interface Operator {
  name: string;
  version: string;
  kind: string;
  apiVersion: string;
  status: OperatorStatus;
  spec: OperatorSpec;
}

export interface OperatorStatus {
  phase: 'installing' | 'succeeded' | 'failed';
  conditions: OperatorCondition[];
  components: OperatorComponent[];
}

export interface OperatorCondition {
  type: string;
  status: string;
  lastUpdateTime: Date;
  reason?: string;
  message?: string;
}

export interface OperatorComponent {
  name: string;
  kind: string;
  status: string;
}

export interface OperatorSpec {
  customResourceDefinitions: CRD[];
  permissions: OperatorPermission[];
  installModes: InstallMode[];
}

export interface CRD {
  name: string;
  version: string;
  kind: string;
  displayName: string;
  description: string;
}

export interface OperatorPermission {
  serviceAccountName: string;
  rules: PolicyRule[];
}

export interface InstallMode {
  type: 'OwnNamespace' | 'SingleNamespace' | 'MultiNamespace' | 'AllNamespaces';
  supported: boolean;
}

// Event Types
export interface CloudNativeEvent {
  id: string;
  type: 'deployment' | 'scaling' | 'health' | 'security' | 'config';
  resource: string;
  namespace: string;
  message: string;
  level: 'info' | 'warning' | 'error' | 'critical';
  metadata: Record<string, any>;
  timestamp: Date;
  userId?: string;
}

// Request Types
export interface DeployRequest {
  name: string;
  namespace: string;
  image: string;
  replicas?: number;
  resources?: K8sResourceRequirements;
  env?: Record<string, string>;
  ports?: number[];
  volumes?: VolumeMount[];
}

export interface VolumeMount {
  name: string;
  mountPath: string;
  type: 'configMap' | 'secret' | 'persistentVolume';
  source: string;
}

export interface ScaleRequest {
  name: string;
  namespace: string;
  replicas: number;
}

export interface RolloutRequest {
  name: string;
  namespace: string;
  image: string;
  strategy?: 'rolling' | 'blue-green' | 'canary';
  canaryWeight?: number;
}

// Express Request Extensions
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    permissions: string[];
  };
}

export interface CloudNativeRequest extends AuthenticatedRequest {
  requestId: string;
  startTime: Date;
  cluster?: string;
}