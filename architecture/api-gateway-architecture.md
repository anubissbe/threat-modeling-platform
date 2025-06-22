# API Gateway Architecture

## Overview
The API Gateway serves as the single entry point for all client requests to the Threat Modeling Application microservices. It provides a unified interface while handling cross-cutting concerns such as authentication, rate limiting, and request routing.

## Technology Selection: Kong Gateway

### Why Kong?
- **Open Source**: Community edition available with enterprise features
- **Performance**: Built on NGINX, handles 100k+ requests/second
- **Extensibility**: Rich plugin ecosystem
- **Kubernetes Native**: Excellent K8s integration
- **Multi-Protocol**: Supports REST, GraphQL, gRPC, WebSockets

## Architecture Components

### 1. Gateway Core
```
┌─────────────────────────────────────────────────────────┐
│                    Kong Gateway                         │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │   Proxy     │  │   Router    │  │   Admin     │    │
│  │   Engine    │  │   Engine    │  │    API      │    │
│  └─────────────┘  └─────────────┘  └─────────────┘    │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │  Plugin     │  │  Service    │  │   Route     │    │
│  │  System     │  │  Registry   │  │   Config    │    │
│  └─────────────┘  └─────────────┘  └─────────────┘    │
└─────────────────────────────────────────────────────────┘
```

### 2. Data Stores
- **PostgreSQL**: Configuration, routes, services, plugins
- **Redis**: Rate limiting counters, session data, cache

## Key Features Implementation

### 1. Authentication & Authorization
```yaml
plugins:
  - name: jwt
    config:
      key_claim_name: "kid"
      secret_is_base64: false
      run_on_preflight: true
  
  - name: oauth2
    config:
      enable_password_grant: true
      enable_client_credentials: true
      token_expiration: 7200
      refresh_token_ttl: 1209600
```

### 2. Rate Limiting
```yaml
plugins:
  - name: rate-limiting
    config:
      minute: 60
      hour: 1000
      policy: redis
      redis_host: redis-service
      redis_port: 6379
      fault_tolerant: true
```

### 3. Request/Response Transformation
```yaml
plugins:
  - name: request-transformer
    config:
      add:
        headers:
          - "X-Request-ID:$(request_id)"
          - "X-Forwarded-Prefix:/api/v1"
      remove:
        headers:
          - "Authorization"
```

### 4. CORS Configuration
```yaml
plugins:
  - name: cors
    config:
      origins:
        - https://app.threatmodel.io
        - http://localhost:3000
      methods:
        - GET
        - POST
        - PUT
        - DELETE
        - OPTIONS
      headers:
        - Authorization
        - Content-Type
      exposed_headers:
        - X-Request-ID
      credentials: true
      max_age: 3600
```

## API Routes Configuration

### Service Definitions
```yaml
services:
  - name: auth-service
    url: http://auth-service:3000
    
  - name: user-service
    url: http://user-service:3001
    
  - name: project-service
    url: http://project-service:3002
    
  - name: threat-engine-service
    url: http://threat-engine:8000
    
  - name: ai-service
    url: http://ai-service:8001
    
  - name: report-service
    url: http://report-service:3003
```

### Route Mappings
```yaml
routes:
  # Authentication Routes
  - name: auth-routes
    service: auth-service
    paths:
      - /api/v1/auth
    strip_path: false
    
  # User Management Routes  
  - name: user-routes
    service: user-service
    paths:
      - /api/v1/users
      - /api/v1/teams
    strip_path: false
    plugins:
      - name: jwt
      
  # Project Routes
  - name: project-routes
    service: project-service
    paths:
      - /api/v1/projects
    strip_path: false
    plugins:
      - name: jwt
      - name: acl
        config:
          allow:
            - project-read
            - project-write
            
  # Threat Modeling Routes
  - name: threat-routes
    service: threat-engine-service
    paths:
      - /api/v1/threats
      - /api/v1/analysis
    strip_path: false
    plugins:
      - name: jwt
      - name: rate-limiting
        config:
          minute: 30
          
  # AI Routes
  - name: ai-routes
    service: ai-service
    paths:
      - /api/v1/ai
    strip_path: false
    plugins:
      - name: jwt
      - name: rate-limiting
        config:
          minute: 10
          hour: 100
```

## Security Implementation

### 1. SSL/TLS Termination
```yaml
ssl:
  cert: /etc/kong/ssl/cert.pem
  key: /etc/kong/ssl/key.pem
  protocols:
    - TLSv1.2
    - TLSv1.3
  ciphers: "ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384"
```

### 2. Security Headers
```yaml
plugins:
  - name: response-transformer
    config:
      add:
        headers:
          - "X-Frame-Options: DENY"
          - "X-Content-Type-Options: nosniff"
          - "X-XSS-Protection: 1; mode=block"
          - "Strict-Transport-Security: max-age=31536000; includeSubDomains"
```

### 3. IP Restriction
```yaml
plugins:
  - name: ip-restriction
    config:
      allow:
        - 10.0.0.0/8
        - 172.16.0.0/12
      deny:
        - 192.168.1.0/24
```

## Monitoring & Observability

### 1. Prometheus Integration
```yaml
plugins:
  - name: prometheus
    config:
      per_consumer: true
      status_code_metrics: true
      latency_metrics: true
      bandwidth_metrics: true
      upstream_health_metrics: true
```

### 2. Logging
```yaml
plugins:
  - name: http-log
    config:
      http_endpoint: http://logstash:5000
      method: POST
      timeout: 1000
      keepalive: 1000
      flush_timeout: 2
      retry_count: 10
```

### 3. Distributed Tracing
```yaml
plugins:
  - name: zipkin
    config:
      http_endpoint: http://zipkin:9411/api/v2/spans
      sample_ratio: 0.1
      include_credential: true
```

## Load Balancing

### Algorithm Configuration
```yaml
upstreams:
  - name: auth-service-upstream
    algorithm: round-robin
    slots: 10000
    healthchecks:
      active:
        healthy:
          interval: 5
          successes: 2
        unhealthy:
          interval: 5
          failures: 3
      passive:
        healthy:
          successes: 5
        unhealthy:
          failures: 5
    targets:
      - target: auth-service-1:3000
        weight: 100
      - target: auth-service-2:3000
        weight: 100
```

## Caching Strategy

### Response Caching
```yaml
plugins:
  - name: proxy-cache
    config:
      strategy: memory
      memory:
        dictionary_name: kong_cache
      content_type:
        - application/json
      cache_ttl: 300
      vary_headers:
        - Accept-Encoding
```

## API Versioning

### URL Path Versioning
- Pattern: `/api/v{version}/{resource}`
- Example: `/api/v1/projects`, `/api/v2/projects`

### Header Versioning Support
```yaml
plugins:
  - name: request-transformer
    config:
      add:
        headers:
          - "API-Version: v1"
```

## WebSocket Support

### Configuration
```yaml
routes:
  - name: websocket-route
    service: notification-service
    paths:
      - /ws
    protocols:
      - ws
      - wss
    strip_path: false
```

## GraphQL Support

### GraphQL Proxy
```yaml
plugins:
  - name: graphql-proxy-cache-advanced
    config:
      graphql_endpoint: http://graphql-service:4000/graphql
      cache_ttl: 300
      vary_on_headers:
        - Authorization
```

## Deployment Configuration

### Kubernetes Deployment
```yaml
apiVersion: v1
kind: Service
metadata:
  name: kong-gateway
spec:
  type: LoadBalancer
  ports:
    - name: http
      port: 80
      targetPort: 8000
    - name: https
      port: 443
      targetPort: 8443
    - name: admin
      port: 8001
      targetPort: 8001
  selector:
    app: kong
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: kong-gateway
spec:
  replicas: 3
  selector:
    matchLabels:
      app: kong
  template:
    metadata:
      labels:
        app: kong
    spec:
      containers:
      - name: kong
        image: kong:3.4
        env:
        - name: KONG_DATABASE
          value: postgres
        - name: KONG_PG_HOST
          value: postgres-service
        - name: KONG_PG_USER
          value: kong
        - name: KONG_PG_PASSWORD
          valueFrom:
            secretKeyRef:
              name: kong-secrets
              key: pg-password
        ports:
        - containerPort: 8000
        - containerPort: 8443
        - containerPort: 8001
```

## Performance Optimization

### Connection Pooling
```yaml
nginx_http_upstream_keepalive: 60
nginx_http_upstream_keepalive_requests: 100
nginx_http_upstream_keepalive_timeout: 60s
```

### Buffer Sizes
```yaml
nginx_proxy_buffer_size: 128k
nginx_proxy_buffers: 4 256k
nginx_proxy_busy_buffers_size: 256k
```

## Disaster Recovery

### Backup Strategy
- Configuration backup every 6 hours
- Route definitions in Git
- Automated restore procedures

### High Availability
- Multiple gateway instances (3+)
- Database replication
- Cross-region deployment option

## Next Steps
1. Implement Service Mesh architecture
2. Create API specifications for each service
3. Set up monitoring dashboards
4. Configure CI/CD pipelines
5. Performance testing setup