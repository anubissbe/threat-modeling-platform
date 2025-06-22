// Service types
export interface ServiceConfig {
  name: string;
  url: string;
  healthPath: string;
  timeout: number;
  retries: number;
  prefix: string;
}

export interface ServiceHealth {
  name: string;
  status: ServiceStatus;
  url: string;
  lastCheck: Date;
  responseTime?: number;
  error?: string;
  version?: string;
  uptime?: number;
}

export enum ServiceStatus {
  HEALTHY = 'healthy',
  UNHEALTHY = 'unhealthy',
  UNKNOWN = 'unknown',
  DEGRADED = 'degraded',
}

// Service discovery types
export interface ServiceRegistry {
  services: Map<string, ServiceConfig>;
  healthChecks: Map<string, ServiceHealth>;
}

// API Gateway types
export interface RouteConfig {
  path: string;
  serviceName: string;
  methods: string[];
  requireAuth: boolean;
  rateLimit?: RateLimitConfig;
  timeout?: number;
  retries?: number;
}

export interface RateLimitConfig {
  max: number;
  windowMs: number;
  message?: string;
}

// Proxy types
export interface ProxyRequest {
  serviceName: string;
  path: string;
  method: string;
  headers: Record<string, string>;
  body?: any;
  query?: Record<string, string>;
}

export interface ProxyResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: any;
  responseTime: number;
}

// Monitoring types
export interface ServiceMetrics {
  serviceName: string;
  requestCount: number;
  errorCount: number;
  averageResponseTime: number;
  lastRequestTime: Date;
  uptime: number;
}

export interface SystemMetrics {
  totalRequests: number;
  totalErrors: number;
  averageResponseTime: number;
  servicesUp: number;
  servicesDown: number;
  uptime: number;
}

// Load balancing types
export enum LoadBalancingStrategy {
  ROUND_ROBIN = 'round_robin',
  LEAST_CONNECTIONS = 'least_connections',
  WEIGHTED = 'weighted',
}

export interface LoadBalancerConfig {
  strategy: LoadBalancingStrategy;
  healthCheckEnabled: boolean;
  healthCheckInterval: number;
}

// Circuit breaker types
export interface CircuitBreakerConfig {
  failureThreshold: number;
  timeoutMs: number;
  resetTimeoutMs: number;
}

export enum CircuitBreakerState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half_open',
}

export interface CircuitBreaker {
  state: CircuitBreakerState;
  failureCount: number;
  lastFailureTime?: Date;
  config: CircuitBreakerConfig;
}

// Authentication types
export interface User {
  id: string;
  email: string;
  roles: string[];
  organizationId?: string;
  sessionId: string;
}

export interface AuthContext {
  user?: User;
  token?: string;
  isAuthenticated: boolean;
}

// Request/Response types
export interface ApiRequest {
  id: string;
  path: string;
  method: string;
  headers: Record<string, string>;
  body?: any;
  query?: Record<string, string>;
  user?: User;
  timestamp: Date;
}

export interface ApiResponse {
  id: string;
  statusCode: number;
  headers: Record<string, string>;
  body: any;
  responseTime: number;
  timestamp: Date;
}

// Error types
export interface ServiceError {
  code: string;
  message: string;
  service: string;
  statusCode: number;
  details?: any;
  timestamp: Date;
}

export interface ErrorResponse {
  success: false;
  error: string;
  message: string;
  statusCode: number;
  requestId?: string;
  service?: string;
  timestamp: Date;
}

// Event types
export interface ServiceEvent {
  type: ServiceEventType;
  serviceName: string;
  timestamp: Date;
  data?: any;
}

export enum ServiceEventType {
  SERVICE_UP = 'service_up',
  SERVICE_DOWN = 'service_down',
  SERVICE_DEGRADED = 'service_degraded',
  HIGH_ERROR_RATE = 'high_error_rate',
  SLOW_RESPONSE = 'slow_response',
  CIRCUIT_BREAKER_OPEN = 'circuit_breaker_open',
  CIRCUIT_BREAKER_CLOSED = 'circuit_breaker_closed',
}

// Cache types
export interface CacheConfig {
  ttl: number;
  maxSize: number;
  enabled: boolean;
}

export interface CachedResponse {
  data: any;
  timestamp: Date;
  ttl: number;
}

// Configuration types
export interface GatewayConfig {
  services: ServiceConfig[];
  routes: RouteConfig[];
  loadBalancer: LoadBalancerConfig;
  circuitBreaker: CircuitBreakerConfig;
  cache: CacheConfig;
  monitoring: {
    enabled: boolean;
    metricsInterval: number;
    alertThresholds: {
      errorRate: number;
      responseTime: number;
    };
  };
}

// Health check types
export interface HealthCheckResult {
  service: string;
  status: ServiceStatus;
  responseTime: number;
  timestamp: Date;
  checks: {
    name: string;
    status: ServiceStatus;
    message?: string;
  }[];
}

export interface SystemHealthResult {
  status: ServiceStatus;
  timestamp: Date;
  services: HealthCheckResult[];
  metrics: SystemMetrics;
  version: string;
}

// Logging types
export interface LogEntry {
  level: 'error' | 'warn' | 'info' | 'debug';
  message: string;
  timestamp: Date;
  service: string;
  requestId?: string;
  userId?: string;
  metadata?: Record<string, any>;
}

export interface RequestLog extends LogEntry {
  method: string;
  path: string;
  statusCode: number;
  responseTime: number;
  userAgent?: string;
  ip?: string;
}

// API types for integration with other services
export interface ProjectData {
  id: string;
  name: string;
  description?: string;
  organizationId: string;
  createdBy: string;
  status: string;
  threatModels: ThreatModelSummary[];
}

export interface ThreatModelSummary {
  id: string;
  name: string;
  version: string;
  status: string;
  lastAnalysis?: Date;
  riskLevel?: string;
}

export interface AnalysisRequest {
  threatModelId: string;
  methodology: string;
  components: any[];
  dataFlows: any[];
  options?: any;
}

export interface AnalysisResult {
  threatModelId: string;
  threats: any[];
  riskAssessment: any;
  recommendations: any[];
  metadata: any;
}