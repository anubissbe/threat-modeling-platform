import { Request, Response } from 'express';

// Core Infrastructure Types
export interface InfrastructureConfig {
  cluster: ClusterConfig;
  loadBalancer: LoadBalancerConfig;
  cache: CacheConfig;
  queue: QueueConfig;
  monitoring: MonitoringConfig;
  storage: StorageConfig;
  security: SecurityConfig;
  scaling: ScalingConfig;
}

// Cluster Configuration
export interface ClusterConfig {
  enabled: boolean;
  workerCount: number;
  maxRestarts: number;
  restartDelay: number;
  gracefulShutdownTimeout: number;
  healthCheckInterval: number;
  autoRestart: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

// Load Balancer Configuration
export interface LoadBalancerConfig {
  algorithm: 'round-robin' | 'least-connections' | 'ip-hash' | 'weighted-round-robin';
  healthCheck: {
    enabled: boolean;
    interval: number;
    timeout: number;
    path: string;
    unhealthyThreshold: number;
    healthyThreshold: number;
  };
  sticky: boolean;
  compression: boolean;
  ssl: {
    enabled: boolean;
    certPath?: string;
    keyPath?: string;
    protocols: string[];
  };
  rateLimiting: {
    enabled: boolean;
    windowMs: number;
    maxRequests: number;
    skipSuccessfulRequests: boolean;
  };
}

// Cache Configuration
export interface CacheConfig {
  redis: {
    enabled: boolean;
    host: string;
    port: number;
    password?: string;
    database: number;
    keyPrefix: string;
    ttl: number;
    maxRetries: number;
    retryDelayOnFailover: number;
  };
  memory: {
    enabled: boolean;
    maxSize: number;
    ttl: number;
    checkPeriod: number;
  };
  distributed: {
    enabled: boolean;
    consistentHashing: boolean;
    replicationFactor: number;
  };
}

// Queue Configuration
export interface QueueConfig {
  redis: {
    host: string;
    port: number;
    password?: string;
    database: number;
  };
  concurrency: number;
  retryAttempts: number;
  retryDelay: number;
  removeOnComplete: number;
  removeOnFail: number;
  defaultJobOptions: {
    removeOnComplete: number;
    removeOnFail: number;
    attempts: number;
    backoff: {
      type: 'exponential' | 'fixed';
      delay: number;
    };
  };
}

// Monitoring Configuration
export interface MonitoringConfig {
  prometheus: {
    enabled: boolean;
    port: number;
    path: string;
    collectDefaultMetrics: boolean;
  };
  healthChecks: {
    enabled: boolean;
    interval: number;
    timeout: number;
    services: string[];
  };
  alerts: {
    enabled: boolean;
    thresholds: {
      cpuUsage: number;
      memoryUsage: number;
      diskUsage: number;
      responseTime: number;
      errorRate: number;
    };
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    format: 'json' | 'text';
    maxSize: string;
    maxFiles: number;
    datePattern: string;
  };
}

// Storage Configuration
export interface StorageConfig {
  type: 'local' | 's3' | 'gcs' | 'azure';
  local?: {
    path: string;
    maxSize: number;
  };
  s3?: {
    region: string;
    bucket: string;
    accessKeyId: string;
    secretAccessKey: string;
    endpoint?: string;
  };
  gcs?: {
    projectId: string;
    keyFilename: string;
    bucket: string;
  };
  azure?: {
    storageAccount: string;
    accessKey: string;
    containerName: string;
  };
}

// Security Configuration
export interface SecurityConfig {
  authentication: {
    enabled: boolean;
    algorithm: 'RS256' | 'HS256';
    publicKey?: string;
    secret?: string;
    expiresIn: string;
  };
  authorization: {
    enabled: boolean;
    roles: string[];
    permissions: Record<string, string[]>;
  };
  encryption: {
    enabled: boolean;
    algorithm: 'aes-256-gcm' | 'aes-256-cbc';
    keyRotationInterval: number;
  };
  rateLimit: {
    windowMs: number;
    maxRequests: number;
    skipSuccessfulRequests: boolean;
    keyGenerator: (req: Request) => string;
  };
}

// Scaling Configuration
export interface ScalingConfig {
  autoScaling: {
    enabled: boolean;
    minInstances: number;
    maxInstances: number;
    targetCpuPercent: number;
    targetMemoryPercent: number;
    scaleUpCooldown: number;
    scaleDownCooldown: number;
  };
  horizontal: {
    enabled: boolean;
    strategy: 'cpu' | 'memory' | 'custom';
    thresholds: {
      scaleUp: number;
      scaleDown: number;
    };
  };
  vertical: {
    enabled: boolean;
    maxCpu: string;
    maxMemory: string;
    minCpu: string;
    minMemory: string;
  };
}

// Service Health Types
export interface ServiceHealth {
  service: string;
  status: 'healthy' | 'unhealthy' | 'degraded' | 'unknown';
  timestamp: Date;
  responseTime: number;
  details: {
    uptime: number;
    cpuUsage: number;
    memoryUsage: number;
    diskUsage: number;
    connections: number;
    errors: number;
    lastError?: string;
  };
  dependencies: ServiceDependency[];
}

export interface ServiceDependency {
  name: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  responseTime: number;
  lastChecked: Date;
}

// Load Balancer Types
export interface LoadBalancerServer {
  id: string;
  host: string;
  port: number;
  weight: number;
  status: 'active' | 'inactive' | 'maintenance';
  health: 'healthy' | 'unhealthy';
  connections: number;
  responseTime: number;
  lastHealthCheck: Date;
}

export interface LoadBalancerStats {
  totalRequests: number;
  totalConnections: number;
  activeConnections: number;
  averageResponseTime: number;
  errorRate: number;
  servers: LoadBalancerServer[];
  algorithm: string;
  uptime: number;
}

// Cache Types
export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  keys: number;
  memory: {
    used: number;
    available: number;
    percentage: number;
  };
  operations: {
    get: number;
    set: number;
    del: number;
    expire: number;
  };
}

export interface CacheEntry<T = any> {
  key: string;
  value: T;
  ttl: number;
  createdAt: Date;
  lastAccessed: Date;
  accessCount: number;
}

// Queue Types
export interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
  throughput: {
    processingRate: number;
    completionRate: number;
    failureRate: number;
  };
}

export interface QueueJob {
  id: string;
  name: string;
  data: any;
  priority: number;
  attempts: number;
  maxAttempts: number;
  status: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed';
  createdAt: Date;
  processedAt?: Date;
  completedAt?: Date;
  failedAt?: Date;
  error?: string;
  progress?: number;
}

// Monitoring Types
export interface SystemMetrics {
  cpu: {
    usage: number;
    cores: number;
    loadAverage: number[];
  };
  memory: {
    total: number;
    used: number;
    free: number;
    percentage: number;
    buffers: number;
    cached: number;
  };
  disk: {
    total: number;
    used: number;
    free: number;
    percentage: number;
    readRate: number;
    writeRate: number;
  };
  network: {
    bytesIn: number;
    bytesOut: number;
    packetsIn: number;
    packetsOut: number;
    errors: number;
  };
  processes: {
    total: number;
    running: number;
    sleeping: number;
    zombie: number;
  };
}

export interface ApplicationMetrics {
  requests: {
    total: number;
    rate: number;
    averageResponseTime: number;
    percentiles: {
      p50: number;
      p90: number;
      p95: number;
      p99: number;
    };
  };
  errors: {
    total: number;
    rate: number;
    byStatusCode: Record<number, number>;
  };
  database: {
    connections: {
      active: number;
      idle: number;
      waiting: number;
    };
    queries: {
      total: number;
      rate: number;
      averageTime: number;
      slowQueries: number;
    };
  };
  cache: CacheStats;
  queue: QueueStats;
}

// Alert Types
export interface Alert {
  id: string;
  type: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  message: string;
  service: string;
  metric: string;
  value: number;
  threshold: number;
  timestamp: Date;
  status: 'active' | 'resolved' | 'acknowledged';
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  resolvedAt?: Date;
}

// Cluster Types
export interface ClusterNode {
  id: string;
  pid: number;
  status: 'online' | 'offline' | 'stopping' | 'stopped' | 'errored';
  uptime: number;
  restarts: number;
  cpu: number;
  memory: number;
  lastHeartbeat: Date;
}

export interface ClusterStats {
  master: {
    pid: number;
    uptime: number;
    memoryUsage: number;
  };
  workers: ClusterNode[];
  totalRequests: number;
  totalRestarts: number;
  averageResponseTime: number;
}

// Service Discovery Types
export interface ServiceRegistration {
  id: string;
  name: string;
  version: string;
  host: string;
  port: number;
  tags: string[];
  metadata: Record<string, any>;
  health: {
    check: string;
    interval: string;
    timeout: string;
    ttl: string;
  };
  registeredAt: Date;
  lastSeen: Date;
}

// Auto Scaling Types
export interface ScalingEvent {
  id: string;
  type: 'scale-up' | 'scale-down';
  trigger: 'cpu' | 'memory' | 'custom' | 'manual';
  from: number;
  to: number;
  reason: string;
  timestamp: Date;
  duration: number;
  success: boolean;
  error?: string;
}

export interface ScalingPolicy {
  id: string;
  name: string;
  enabled: boolean;
  minInstances: number;
  maxInstances: number;
  rules: ScalingRule[];
  cooldown: {
    scaleUp: number;
    scaleDown: number;
  };
}

export interface ScalingRule {
  metric: string;
  threshold: number;
  comparison: 'greater' | 'less' | 'equal';
  duration: number;
  action: 'scale-up' | 'scale-down';
  adjustment: number;
  adjustmentType: 'absolute' | 'percentage';
}

// API Response Types
export interface InfrastructureResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: Date;
  requestId: string;
}

export interface HealthResponse {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: Date;
  services: ServiceHealth[];
  system: SystemMetrics;
  application: ApplicationMetrics;
  uptime: number;
}

// Request Types
export interface ScaleRequest {
  service: string;
  instances: number;
  force?: boolean;
  reason?: string;
}

export interface ConfigUpdateRequest {
  service: string;
  config: Partial<InfrastructureConfig>;
  restart?: boolean;
}

// Event Types
export interface InfrastructureEvent {
  id: string;
  type: 'health' | 'scaling' | 'config' | 'alert' | 'deployment';
  service: string;
  message: string;
  level: 'info' | 'warning' | 'error' | 'critical';
  metadata: Record<string, any>;
  timestamp: Date;
  userId?: string;
}

// Circuit Breaker Types
export interface CircuitBreakerConfig {
  enabled: boolean;
  failureThreshold: number;
  recoveryTimeout: number;
  monitoringPeriod: number;
  fallbackEnabled: boolean;
  fallbackTimeout: number;
}

export interface CircuitBreakerState {
  state: 'closed' | 'open' | 'half-open';
  failureCount: number;
  lastFailureTime: Date;
  nextAttemptTime: Date;
  successCount: number;
  requestCount: number;
}

// Disaster Recovery Types
export interface BackupConfig {
  enabled: boolean;
  schedule: string;
  retention: number;
  compression: boolean;
  encryption: boolean;
  destinations: BackupDestination[];
}

export interface BackupDestination {
  type: 'local' | 's3' | 'gcs' | 'azure';
  config: any;
  priority: number;
}

export interface BackupJob {
  id: string;
  type: 'full' | 'incremental' | 'differential';
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime: Date;
  endTime?: Date;
  duration?: number;
  size?: number;
  error?: string;
  destination: BackupDestination;
}

// Performance Optimization Types
export interface PerformanceProfile {
  id: string;
  name: string;
  enabled: boolean;
  rules: PerformanceRule[];
  priority: number;
}

export interface PerformanceRule {
  condition: string;
  action: 'cache' | 'compress' | 'throttle' | 'redirect' | 'block';
  parameters: Record<string, any>;
  enabled: boolean;
}

// Maintenance Types
export interface MaintenanceWindow {
  id: string;
  title: string;
  description: string;
  startTime: Date;
  endTime: Date;
  services: string[];
  type: 'planned' | 'emergency';
  impact: 'none' | 'low' | 'medium' | 'high';
  status: 'scheduled' | 'active' | 'completed' | 'cancelled';
  notifications: boolean;
}

export interface MaintenanceTask {
  id: string;
  windowId: string;
  title: string;
  description: string;
  type: 'restart' | 'update' | 'backup' | 'cleanup' | 'migration';
  order: number;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startTime?: Date;
  endTime?: Date;
  duration?: number;
  error?: string;
  rollbackEnabled: boolean;
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

export interface InfrastructureRequest extends AuthenticatedRequest {
  requestId: string;
  startTime: Date;
  clientIp: string;
  userAgent: string;
}

// Controller Response Helper
export interface ControllerResponse extends Response {
  success: (data?: any) => void;
  error: (message: string, statusCode?: number) => void;
  paginated: (data: any[], total: number, page: number, limit: number) => void;
}