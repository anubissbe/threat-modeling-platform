/**
 * Performance Types and Interfaces
 * 
 * Comprehensive type definitions for the world-class performance optimization system
 */

export interface PerformanceMetrics {
  timestamp: Date;
  cpu: CpuMetrics;
  memory: MemoryMetrics;
  network: NetworkMetrics;
  disk?: DiskMetrics;
  responseTime: ResponseTimeMetrics;
  throughput: ThroughputMetrics;
  errors: ErrorMetrics;
  database: DatabaseMetrics;
  cache: CacheMetrics;
}

export interface CpuMetrics {
  usage: number; // Percentage
  cores: number;
  loadAverage: number[];
}

export interface MemoryMetrics {
  usage: number; // Percentage
  total: number; // Bytes
  used: number; // Bytes
  free: number; // Bytes
  heapUsed: number; // Bytes
}

export interface NetworkMetrics {
  bytesIn: number;
  bytesOut: number;
  packetsIn: number;
  packetsOut: number;
}

export interface DiskMetrics {
  usage: number; // Percentage
  total: number; // Bytes
  used: number; // Bytes
  free: number; // Bytes
}

export interface ResponseTimeMetrics {
  average: number; // Milliseconds
  p50: number; // Milliseconds
  p95: number; // Milliseconds
  p99: number; // Milliseconds
}

export interface ThroughputMetrics {
  current: number; // Requests per second
  peak: number; // Requests per second
  average: number; // Requests per second
}

export interface ErrorMetrics {
  rate: number; // Percentage
  total: number; // Count
}

export interface DatabaseMetrics {
  connections: number;
  queryTime: number; // Average query time in ms
  slowQueries: number;
}

export interface CacheMetrics {
  hitRate: number; // Percentage
  missRate: number; // Percentage
  size: number; // Bytes
}

export interface RequestMetric {
  method: string;
  path: string;
  statusCode: number;
  duration: number; // Milliseconds
  timestamp: Date;
}

export interface OptimizationRecommendation {
  id: string;
  type: OptimizationType;
  priority: Priority;
  title: string;
  description: string;
  impact: Impact;
  effort: Effort;
  recommendations: string[];
  estimatedImprovement: string;
  implementation: {
    immediate: string[];
    shortTerm: string[];
    longTerm: string[];
  };
  timestamp: Date;
}

export type OptimizationType = 
  | 'cpu' 
  | 'memory' 
  | 'database' 
  | 'cache' 
  | 'network' 
  | 'response-time' 
  | 'throughput' 
  | 'security' 
  | 'scalability';

export type Priority = 'low' | 'medium' | 'high' | 'critical';
export type Impact = 'low' | 'medium' | 'high';
export type Effort = 'low' | 'medium' | 'high';
export type Severity = 'info' | 'warning' | 'critical';

export interface BenchmarkResult {
  id: string;
  target: string;
  timestamp: Date;
  duration: number; // Seconds
  connections: number;
  results: {
    requests: {
      total: number;
      average: number;
      mean: number;
      stddev: number;
      min: number;
      max: number;
    };
    latency: {
      average: number;
      mean: number;
      stddev: number;
      min: number;
      max: number;
      p50: number;
      p75: number;
      p90: number;
      p95: number;
      p99: number;
    };
    throughput: {
      average: number;
      mean: number;
      stddev: number;
      min: number;
      max: number;
    };
    errors: number;
    timeouts: number;
    mismatches: number;
    non2xx: number;
  };
  analysis: {
    performance: string;
    recommendations: string[];
  };
}

export interface AlertConfig {
  id: string;
  name: string;
  metric: string; // Dot notation path to metric
  threshold: number;
  operator: '>' | '<' | '>=' | '<=' | '==';
  severity: Severity;
  enabled: boolean;
}

export interface PerformanceAlert {
  id: string;
  configId: string;
  name: string;
  severity: Severity;
  message: string;
  metric: string;
  value: number;
  threshold: number;
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
}

export interface CacheOptimizationResult {
  type: 'cache-optimization';
  timestamp: Date;
  optimizations: {
    hitRateImprovement: number;
    evictionPolicy: string;
    cacheSize: number;
    keyOptimization: boolean;
  };
  beforeMetrics: CacheMetrics;
  afterMetrics: CacheMetrics;
  estimatedImpact: string;
}

export interface ResourceOptimizationResult {
  type: 'resource-optimization';
  timestamp: Date;
  optimizations: {
    memoryLeaksFixed: number;
    cpuOptimizations: string[];
    memoryOptimizations: string[];
    networkOptimizations: string[];
  };
  beforeMetrics: {
    cpu: number;
    memory: number;
    network: number;
  };
  afterMetrics: {
    cpu: number;
    memory: number;
    network: number;
  };
  estimatedImpact: string;
}

export interface DatabaseOptimizationResult {
  type: 'database-optimization';
  timestamp: Date;
  optimizations: {
    indexesAdded: number;
    queriesOptimized: number;
    connectionPoolOptimized: boolean;
    cacheImplemented: boolean;
  };
  beforeMetrics: DatabaseMetrics;
  afterMetrics: DatabaseMetrics;
  estimatedImpact: string;
}

export interface NetworkOptimizationResult {
  type: 'network-optimization';
  timestamp: Date;
  optimizations: {
    compressionEnabled: boolean;
    keepAliveOptimized: boolean;
    payloadOptimized: boolean;
    cdnImplemented: boolean;
  };
  beforeMetrics: NetworkMetrics;
  afterMetrics: NetworkMetrics;
  estimatedImpact: string;
}

export interface LoadBalancingOptimizationResult {
  type: 'load-balancing-optimization';
  timestamp: Date;
  optimizations: {
    algorithm: string;
    healthChecksOptimized: boolean;
    stickySessionsOptimized: boolean;
    routingOptimized: boolean;
  };
  beforeMetrics: {
    requestDistribution: number[];
    responseTime: number;
    throughput: number;
  };
  afterMetrics: {
    requestDistribution: number[];
    responseTime: number;
    throughput: number;
  };
  estimatedImpact: string;
}

export interface AutoScalingRecommendation {
  type: 'scaling-recommendation';
  timestamp: Date;
  action: 'scale-up' | 'scale-down' | 'scale-out' | 'scale-in' | 'no-action';
  reason: string;
  currentMetrics: PerformanceMetrics;
  recommendedConfig: {
    instances?: number;
    cpu?: number;
    memory?: number;
    bandwidth?: number;
  };
  confidence: number; // 0-1
  estimatedImpact: string;
  costImpact: {
    current: number;
    projected: number;
    savings: number;
  };
}

export interface MemoryLeak {
  id: string;
  timestamp: Date;
  type: 'heap-growth' | 'listener-leak' | 'timer-leak' | 'closure-leak';
  severity: Severity;
  description: string;
  location?: string;
  stackTrace?: string;
  memoryGrowth: number; // MB
  recommendation: string;
}

export interface PerformanceProfile {
  id: string;
  timestamp: Date;
  duration: number; // Seconds
  type: 'cpu' | 'memory' | 'heap' | 'allocation';
  data: any; // Profiling data
  analysis: {
    hotspots: Array<{
      function: string;
      file: string;
      line: number;
      percentage: number;
    }>;
    recommendations: string[];
  };
}

export interface OptimizationTask {
  id: string;
  type: OptimizationType;
  priority: Priority;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  title: string;
  description: string;
  estimatedDuration: number; // Minutes
  actualDuration?: number; // Minutes
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  result?: any;
  error?: string;
}

export interface PerformanceBudget {
  id: string;
  name: string;
  enabled: boolean;
  thresholds: {
    responseTime: number; // ms
    throughput: number; // RPS
    errorRate: number; // percentage
    cpu: number; // percentage
    memory: number; // percentage
  };
  violations: Array<{
    metric: string;
    threshold: number;
    actual: number;
    timestamp: Date;
  }>;
}

export interface PerformanceReport {
  id: string;
  timestamp: Date;
  period: {
    start: Date;
    end: Date;
  };
  summary: {
    averageResponseTime: number;
    averageThroughput: number;
    averageErrorRate: number;
    averageCpuUsage: number;
    averageMemoryUsage: number;
    totalRequests: number;
    totalErrors: number;
    uptime: number;
  };
  trends: {
    responseTime: number; // percentage change
    throughput: number; // percentage change
    errorRate: number; // percentage change
    cpuUsage: number; // percentage change
    memoryUsage: number; // percentage change
  };
  topIssues: Array<{
    type: string;
    severity: Severity;
    occurrences: number;
    impact: string;
  }>;
  optimizations: OptimizationRecommendation[];
  budgetViolations: number;
  performanceScore: number; // 0-100
}

export type OptimizationResult = 
  | CacheOptimizationResult 
  | ResourceOptimizationResult 
  | DatabaseOptimizationResult 
  | NetworkOptimizationResult 
  | LoadBalancingOptimizationResult;