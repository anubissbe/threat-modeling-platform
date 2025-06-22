# Service Mesh Architecture - Istio

## Overview
The Service Mesh provides a dedicated infrastructure layer for managing service-to-service communication within the Threat Modeling Application. Istio handles traffic management, security, and observability without requiring changes to application code.

## Why Istio?

### Key Benefits
- **Traffic Management**: Advanced routing, retries, failovers, and fault injection
- **Security**: Strong identity-based authentication and authorization
- **Observability**: Metrics, logs, and traces for all service communications
- **Policy Enforcement**: Fine-grained access control and rate limiting
- **Service Resilience**: Circuit breaking, timeouts, and retries

## Architecture Components

### 1. Control Plane
```
┌─────────────────────────────────────────────────────────────┐
│                     Istio Control Plane                      │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │    Pilot     │  │    Citadel   │  │    Galley    │     │
│  │              │  │              │  │              │     │
│  │ Traffic Mgmt │  │   Security   │  │Configuration │     │
│  │              │  │   & Certs    │  │  Validation  │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

### 2. Data Plane
```
┌─────────────────────────────────────────────────────────────┐
│                      Service Pod                             │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐          ┌─────────────────┐          │
│  │                 │◄────────►│                 │          │
│  │  Microservice   │          │  Envoy Proxy    │          │
│  │                 │          │    (Sidecar)    │          │
│  └─────────────────┘          └─────────────────┘          │
└─────────────────────────────────────────────────────────────┘
```

## Traffic Management

### 1. Virtual Services
```yaml
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: threat-engine-vs
spec:
  hosts:
  - threat-engine
  http:
  - match:
    - headers:
        version:
          exact: v2
    route:
    - destination:
        host: threat-engine
        subset: v2
      weight: 100
  - route:
    - destination:
        host: threat-engine
        subset: v1
      weight: 90
    - destination:
        host: threat-engine
        subset: v2
      weight: 10
```

### 2. Destination Rules
```yaml
apiVersion: networking.istio.io/v1beta1
kind: DestinationRule
metadata:
  name: threat-engine-dr
spec:
  host: threat-engine
  trafficPolicy:
    connectionPool:
      tcp:
        maxConnections: 100
      http:
        http1MaxPendingRequests: 100
        http2MaxRequests: 100
        maxRequestsPerConnection: 1
    loadBalancer:
      simple: ROUND_ROBIN
    outlierDetection:
      consecutiveErrors: 5
      interval: 30s
      baseEjectionTime: 30s
      maxEjectionPercent: 50
  subsets:
  - name: v1
    labels:
      version: v1
  - name: v2
    labels:
      version: v2
```

### 3. Circuit Breaking
```yaml
apiVersion: networking.istio.io/v1beta1
kind: DestinationRule
metadata:
  name: ai-service-circuit-breaker
spec:
  host: ai-service
  trafficPolicy:
    connectionPool:
      tcp:
        maxConnections: 10
      http:
        http1MaxPendingRequests: 10
        http2MaxRequests: 20
        maxRequestsPerConnection: 2
    outlierDetection:
      consecutive5xxErrors: 5
      interval: 10s
      baseEjectionTime: 30s
      maxEjectionPercent: 100
      minHealthPercent: 50
```

### 4. Retry Policy
```yaml
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: project-service-retry
spec:
  hosts:
  - project-service
  http:
  - route:
    - destination:
        host: project-service
    retries:
      attempts: 3
      perTryTimeout: 5s
      retryOn: gateway-error,connect-failure,refused-stream
```

### 5. Timeout Configuration
```yaml
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: report-service-timeout
spec:
  hosts:
  - report-service
  http:
  - timeout: 30s
    route:
    - destination:
        host: report-service
```

## Security Architecture

### 1. Mutual TLS (mTLS)
```yaml
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: default
  namespace: threat-modeling
spec:
  mtls:
    mode: STRICT
```

### 2. Authorization Policies
```yaml
apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:
  name: threat-engine-authz
spec:
  selector:
    matchLabels:
      app: threat-engine
  action: ALLOW
  rules:
  - from:
    - source:
        principals: ["cluster.local/ns/threat-modeling/sa/api-gateway"]
    - source:
        principals: ["cluster.local/ns/threat-modeling/sa/project-service"]
  - to:
    - operation:
        methods: ["GET", "POST"]
        paths: ["/api/v1/analysis/*"]
```

### 3. Request Authentication
```yaml
apiVersion: security.istio.io/v1beta1
kind: RequestAuthentication
metadata:
  name: jwt-auth
spec:
  selector:
    matchLabels:
      app: api-gateway
  jwtRules:
  - issuer: "https://auth.threatmodel.io"
    jwksUri: "https://auth.threatmodel.io/.well-known/jwks.json"
    audiences:
    - "threat-modeling-app"
```

## Service Discovery & Load Balancing

### 1. Service Entry for External Services
```yaml
apiVersion: networking.istio.io/v1beta1
kind: ServiceEntry
metadata:
  name: external-ai-api
spec:
  hosts:
  - api.openai.com
  ports:
  - number: 443
    name: https
    protocol: HTTPS
  location: MESH_EXTERNAL
  resolution: DNS
```

### 2. Load Balancing Algorithms
```yaml
apiVersion: networking.istio.io/v1beta1
kind: DestinationRule
metadata:
  name: user-service-lb
spec:
  host: user-service
  trafficPolicy:
    loadBalancer:
      consistentHash:
        httpCookie:
          name: "session-cookie"
          ttl: 3600s
```

## Observability

### 1. Telemetry Configuration
```yaml
apiVersion: telemetry.istio.io/v1alpha1
kind: Telemetry
metadata:
  name: metrics-config
spec:
  metrics:
  - providers:
    - name: prometheus
    overrides:
    - match:
        metric: REQUEST_COUNT
      tagOverrides:
        method:
          value: request.method
        response_code:
          value: response.code | "unknown"
```

### 2. Distributed Tracing
```yaml
apiVersion: v1
data:
  mesh: |-
    defaultConfig:
      proxyStatsMatcher:
        inclusionRegexps:
        - ".*outlier_detection.*"
        - ".*circuit_breakers.*"
      tracing:
        sampling: 10.0
        zipkin:
          address: zipkin.istio-system:9411
kind: ConfigMap
metadata:
  name: istio
```

### 3. Access Logging
```yaml
apiVersion: v1
data:
  mesh: |-
    defaultConfig:
      accessLogFile: /dev/stdout
      accessLogFormat: |
        [%START_TIME%] "%REQ(:METHOD)% %REQ(X-ENVOY-ORIGINAL-PATH?:PATH)% %PROTOCOL%"
        %RESPONSE_CODE% %RESPONSE_FLAGS% %BYTES_RECEIVED% %BYTES_SENT%
        "%REQ(X-FORWARDED-FOR)%" "%REQ(USER-AGENT)%" "%REQ(X-REQUEST-ID)%"
        "%REQ(:AUTHORITY)%" "%UPSTREAM_HOST%" %DOWNSTREAM_REMOTE_ADDRESS%
        %UPSTREAM_CLUSTER% %RESPONSE_DURATION% %DURATION%
kind: ConfigMap
metadata:
  name: istio
```

## Policy Enforcement

### 1. Rate Limiting
```yaml
apiVersion: networking.istio.io/v1beta1
kind: EnvoyFilter
metadata:
  name: rate-limit-filter
spec:
  workloadSelector:
    labels:
      app: api-gateway
  configPatches:
  - applyTo: HTTP_FILTER
    match:
      context: SIDECAR_INBOUND
      listener:
        filterChain:
          filter:
            name: "envoy.filters.network.http_connection_manager"
    patch:
      operation: INSERT_BEFORE
      value:
        name: envoy.filters.http.local_ratelimit
        typed_config:
          "@type": type.googleapis.com/udpa.type.v1.TypedStruct
          type_url: type.googleapis.com/envoy.extensions.filters.http.local_ratelimit.v3.LocalRateLimit
          value:
            stat_prefix: http_local_rate_limiter
            token_bucket:
              max_tokens: 100
              tokens_per_fill: 100
              fill_interval: 60s
            filter_enabled:
              runtime_key: local_rate_limit_enabled
              default_value:
                numerator: 100
                denominator: HUNDRED
            filter_enforced:
              runtime_key: local_rate_limit_enforced
              default_value:
                numerator: 100
                denominator: HUNDRED
```

### 2. CORS Policy
```yaml
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: api-cors
spec:
  hosts:
  - api.threatmodel.io
  http:
  - corsPolicy:
      allowOrigins:
      - exact: https://app.threatmodel.io
      - exact: http://localhost:3000
      allowMethods:
      - GET
      - POST
      - PUT
      - DELETE
      - OPTIONS
      allowHeaders:
      - authorization
      - content-type
      - x-request-id
      exposeHeaders:
      - x-request-id
      - x-trace-id
      maxAge: 24h
      allowCredentials: true
    route:
    - destination:
        host: api-gateway
```

## Fault Injection

### 1. Delay Injection
```yaml
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: ai-service-fault
spec:
  hosts:
  - ai-service
  http:
  - fault:
      delay:
        percentage:
          value: 0.1
        fixedDelay: 5s
    route:
    - destination:
        host: ai-service
```

### 2. Abort Injection
```yaml
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: threat-engine-fault
spec:
  hosts:
  - threat-engine
  http:
  - fault:
      abort:
        percentage:
          value: 0.1
        httpStatus: 503
    route:
    - destination:
        host: threat-engine
```

## Multi-Cluster Deployment

### 1. Multi-Cluster Configuration
```yaml
apiVersion: install.istio.io/v1alpha1
kind: IstioOperator
metadata:
  name: control-plane
spec:
  values:
    pilot:
      env:
        PILOT_ENABLE_WORKLOAD_ENTRY_AUTOREGISTRATION: true
    global:
      meshID: mesh1
      multiCluster:
        clusterName: cluster1
      network: network1
```

### 2. Gateway for Cross-Cluster Communication
```yaml
apiVersion: networking.istio.io/v1beta1
kind: Gateway
metadata:
  name: cross-network-gateway
spec:
  selector:
    istio: eastwestgateway
  servers:
  - port:
      number: 15443
      name: tls
      protocol: TLS
    tls:
      mode: ISTIO_MUTUAL
    hosts:
    - "*.local"
```

## Performance Optimization

### 1. Sidecar Configuration
```yaml
apiVersion: networking.istio.io/v1beta1
kind: Sidecar
metadata:
  name: default
spec:
  egress:
  - hosts:
    - "./*"
    - "istio-system/*"
    - "istio-ingress/*"
```

### 2. Protocol Selection
```yaml
apiVersion: v1
kind: Service
metadata:
  name: ai-service
spec:
  ports:
  - name: grpc-ai
    port: 50051
    appProtocol: grpc
  - name: http-metrics
    port: 8080
    appProtocol: http
```

## Deployment Strategy

### 1. Namespace Injection
```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: threat-modeling
  labels:
    istio-injection: enabled
```

### 2. Pod Annotations
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: threat-engine
spec:
  template:
    metadata:
      annotations:
        sidecar.istio.io/inject: "true"
        sidecar.istio.io/proxyCPULimit: "200m"
        sidecar.istio.io/proxyMemoryLimit: "128Mi"
        traffic.sidecar.istio.io/includeInboundPorts: "8000"
        traffic.sidecar.istio.io/excludeOutboundPorts: "3306"
```

## Monitoring Integration

### 1. Prometheus Configuration
```yaml
apiVersion: v1
kind: Service
metadata:
  name: prometheus
spec:
  selector:
    app: prometheus
  ports:
  - name: http-prometheus
    protocol: TCP
    port: 9090
```

### 2. Grafana Dashboards
- Service mesh overview
- Service-level metrics
- Request rates and latencies
- Error rates
- Circuit breaker status

### 3. Kiali Integration
```yaml
apiVersion: kiali.io/v1alpha1
kind: Kiali
metadata:
  name: kiali
spec:
  auth:
    strategy: token
  deployment:
    accessible_namespaces:
    - threat-modeling
    - istio-system
  external_services:
    prometheus:
      url: http://prometheus:9090
    grafana:
      url: http://grafana:3000
    tracing:
      url: http://jaeger:16686
```

## Best Practices

### 1. Service Naming
- Use consistent naming: `{service-name}-{version}`
- Example: `threat-engine-v1`, `threat-engine-v2`

### 2. Label Standards
```yaml
labels:
  app: threat-engine
  version: v1
  environment: production
  team: threat-modeling
```

### 3. Resource Limits
```yaml
resources:
  requests:
    cpu: 100m
    memory: 128Mi
  limits:
    cpu: 200m
    memory: 256Mi
```

## Next Steps
1. Create architecture diagrams
2. Set up development environment
3. Implement service templates
4. Configure CI/CD pipelines
5. Create operational runbooks