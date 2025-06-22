# Infrastructure Design - Threat Modeling Application

## Overview

This document outlines the complete infrastructure design for the Threat Modeling Application, including Kubernetes deployment architecture, Helm charts, CI/CD pipelines, and monitoring/observability setup. The infrastructure is designed for high availability, scalability, and security.

## Infrastructure Architecture

### High-Level Architecture

```mermaid
graph TB
    subgraph "External"
        Users[Users]
        CDN[CloudFlare CDN]
    end
    
    subgraph "Cloud Provider"
        subgraph "Kubernetes Cluster"
            subgraph "Ingress Layer"
                Nginx[Nginx Ingress]
                CertManager[Cert Manager]
            end
            
            subgraph "API Gateway"
                Kong[Kong Gateway]
                KongDB[(Kong DB)]
            end
            
            subgraph "Service Mesh"
                Istio[Istio Control Plane]
                Envoy[Envoy Proxies]
            end
            
            subgraph "Application Services"
                Auth[Auth Service]
                API[API Services]
                Workers[Background Workers]
            end
            
            subgraph "Data Layer"
                PG[(PostgreSQL)]
                Redis[(Redis)]
                Minio[MinIO S3]
            end
            
            subgraph "Observability"
                Prom[Prometheus]
                Grafana[Grafana]
                Jaeger[Jaeger]
                ELK[ELK Stack]
            end
        end
        
        subgraph "External Services"
            Vault[HashiCorp Vault]
            Registry[Container Registry]
            Backup[Backup Storage]
        end
    end
    
    Users --> CDN
    CDN --> Nginx
    Nginx --> Kong
    Kong --> Istio
    Istio --> Auth
    Istio --> API
    API --> PG
    API --> Redis
    Workers --> Minio
```

### Kubernetes Cluster Design

```yaml
cluster_configuration:
  provider: AWS/GCP/Azure
  version: "1.28"
  
  node_pools:
    system:
      instance_type: t3.large
      min_nodes: 3
      max_nodes: 5
      labels:
        workload-type: system
      taints:
        - key: system
          value: "true"
          effect: NoSchedule
          
    application:
      instance_type: c5.xlarge
      min_nodes: 3
      max_nodes: 20
      labels:
        workload-type: application
      availability_zones: 3
      
    database:
      instance_type: r5.2xlarge
      min_nodes: 3
      max_nodes: 6
      labels:
        workload-type: database
      taints:
        - key: database
          value: "true"
          effect: NoSchedule
      local_ssd: true
      
    monitoring:
      instance_type: m5.xlarge
      min_nodes: 2
      max_nodes: 4
      labels:
        workload-type: monitoring
        
  networking:
    pod_cidr: 10.0.0.0/16
    service_cidr: 10.1.0.0/16
    cni: calico
    network_policy: enabled
    
  security:
    rbac: enabled
    pod_security_policy: restricted
    network_policies: enforced
    secrets_encryption: enabled
    audit_logging: enabled
```

## Kubernetes Manifests

### Namespace Configuration

```yaml
# namespaces/namespaces.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: threatmodel-prod
  labels:
    name: threatmodel-prod
    environment: production
    istio-injection: enabled
---
apiVersion: v1
kind: Namespace
metadata:
  name: threatmodel-staging
  labels:
    name: threatmodel-staging
    environment: staging
    istio-injection: enabled
---
apiVersion: v1
kind: Namespace
metadata:
  name: threatmodel-data
  labels:
    name: threatmodel-data
    environment: production
---
apiVersion: v1
kind: Namespace
metadata:
  name: threatmodel-monitoring
  labels:
    name: threatmodel-monitoring
    environment: production
```

### Network Policies

```yaml
# network-policies/default-deny.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
  namespace: threatmodel-prod
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress
---
# network-policies/allow-ingress.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-ingress-to-api
  namespace: threatmodel-prod
spec:
  podSelector:
    matchLabels:
      app: api-gateway
  policyTypes:
  - Ingress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: ingress-nginx
    ports:
    - protocol: TCP
      port: 8000
---
# network-policies/allow-db-access.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-db-access
  namespace: threatmodel-data
spec:
  podSelector:
    matchLabels:
      app: postgresql
  policyTypes:
  - Ingress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          environment: production
    - podSelector:
        matchLabels:
          db-access: "true"
    ports:
    - protocol: TCP
      port: 5432
```

### Service Deployments

#### Authentication Service

```yaml
# services/auth-service/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: auth-service
  namespace: threatmodel-prod
  labels:
    app: auth-service
    version: v1
spec:
  replicas: 3
  selector:
    matchLabels:
      app: auth-service
      version: v1
  template:
    metadata:
      labels:
        app: auth-service
        version: v1
        db-access: "true"
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "9090"
        prometheus.io/path: "/metrics"
    spec:
      serviceAccountName: auth-service
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        fsGroup: 1000
      containers:
      - name: auth-service
        image: threatmodel/auth-service:1.0.0
        imagePullPolicy: Always
        ports:
        - containerPort: 8080
          name: http
          protocol: TCP
        - containerPort: 9090
          name: metrics
          protocol: TCP
        env:
        - name: NODE_ENV
          value: "production"
        - name: PORT
          value: "8080"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: auth-db-secret
              key: connection-string
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: redis-secret
              key: connection-string
        - name: JWT_PRIVATE_KEY
          valueFrom:
            secretKeyRef:
              name: jwt-keys
              key: private-key
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health/live
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 8080
          initialDelaySeconds: 10
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 3
        volumeMounts:
        - name: config
          mountPath: /app/config
          readOnly: true
        - name: secrets
          mountPath: /app/secrets
          readOnly: true
        securityContext:
          allowPrivilegeEscalation: false
          readOnlyRootFilesystem: true
          capabilities:
            drop:
            - ALL
      volumes:
      - name: config
        configMap:
          name: auth-service-config
      - name: secrets
        secret:
          secretName: auth-service-secrets
      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
          - weight: 100
            podAffinityTerm:
              labelSelector:
                matchExpressions:
                - key: app
                  operator: In
                  values:
                  - auth-service
              topologyKey: kubernetes.io/hostname
---
# services/auth-service/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: auth-service
  namespace: threatmodel-prod
  labels:
    app: auth-service
spec:
  type: ClusterIP
  ports:
  - port: 8080
    targetPort: 8080
    protocol: TCP
    name: http
  - port: 9090
    targetPort: 9090
    protocol: TCP
    name: metrics
  selector:
    app: auth-service
---
# services/auth-service/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: auth-service-hpa
  namespace: threatmodel-prod
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: auth-service
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  - type: Pods
    pods:
      metric:
        name: http_requests_per_second
      target:
        type: AverageValue
        averageValue: "1000"
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 10
        periodSeconds: 60
      - type: Pods
        value: 1
        periodSeconds: 60
      selectPolicy: Min
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
      - type: Percent
        value: 50
        periodSeconds: 60
      - type: Pods
        value: 2
        periodSeconds: 60
      selectPolicy: Max
---
# services/auth-service/pdb.yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: auth-service-pdb
  namespace: threatmodel-prod
spec:
  minAvailable: 2
  selector:
    matchLabels:
      app: auth-service
```

#### API Gateway (Kong)

```yaml
# gateway/kong-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: kong-gateway
  namespace: threatmodel-prod
spec:
  replicas: 3
  selector:
    matchLabels:
      app: kong-gateway
  template:
    metadata:
      labels:
        app: kong-gateway
        db-access: "true"
      annotations:
        kuma.io/gateway: enabled
        traffic.sidecar.istio.io/includeInboundPorts: ""
    spec:
      serviceAccountName: kong
      containers:
      - name: kong
        image: kong:3.4-alpine
        env:
        - name: KONG_DATABASE
          value: "postgres"
        - name: KONG_PG_HOST
          value: "kong-postgres.threatmodel-data.svc.cluster.local"
        - name: KONG_PG_DATABASE
          valueFrom:
            secretKeyRef:
              name: kong-postgres-secret
              key: database
        - name: KONG_PG_USER
          valueFrom:
            secretKeyRef:
              name: kong-postgres-secret
              key: username
        - name: KONG_PG_PASSWORD
          valueFrom:
            secretKeyRef:
              name: kong-postgres-secret
              key: password
        - name: KONG_PROXY_ACCESS_LOG
          value: "/dev/stdout"
        - name: KONG_ADMIN_ACCESS_LOG
          value: "/dev/stdout"
        - name: KONG_PROXY_ERROR_LOG
          value: "/dev/stderr"
        - name: KONG_ADMIN_ERROR_LOG
          value: "/dev/stderr"
        - name: KONG_ADMIN_LISTEN
          value: "0.0.0.0:8001"
        - name: KONG_PROXY_LISTEN
          value: "0.0.0.0:8000, 0.0.0.0:8443 ssl http2"
        - name: KONG_PLUGINS
          value: "bundled,jwt,oauth2,rate-limiting,request-transformer,response-transformer,correlation-id"
        ports:
        - name: proxy
          containerPort: 8000
          protocol: TCP
        - name: proxy-ssl
          containerPort: 8443
          protocol: TCP
        - name: admin
          containerPort: 8001
          protocol: TCP
        livenessProbe:
          httpGet:
            path: /status
            port: 8001
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /status
            port: 8001
          initialDelaySeconds: 5
          periodSeconds: 5
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
        volumeMounts:
        - name: kong-config
          mountPath: /etc/kong
      volumes:
      - name: kong-config
        configMap:
          name: kong-config
      affinity:
        podAntiAffinity:
          requiredDuringSchedulingIgnoredDuringExecution:
          - labelSelector:
              matchExpressions:
              - key: app
                operator: In
                values:
                - kong-gateway
            topologyKey: kubernetes.io/hostname
---
# gateway/kong-service.yaml
apiVersion: v1
kind: Service
metadata:
  name: kong-proxy
  namespace: threatmodel-prod
  annotations:
    service.beta.kubernetes.io/aws-load-balancer-type: "nlb"
spec:
  type: LoadBalancer
  ports:
  - name: proxy
    port: 80
    targetPort: 8000
    protocol: TCP
  - name: proxy-ssl
    port: 443
    targetPort: 8443
    protocol: TCP
  selector:
    app: kong-gateway
```

### Database Deployments

#### PostgreSQL StatefulSet

```yaml
# databases/postgresql-statefulset.yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgresql
  namespace: threatmodel-data
spec:
  serviceName: postgresql
  replicas: 3
  selector:
    matchLabels:
      app: postgresql
  template:
    metadata:
      labels:
        app: postgresql
    spec:
      serviceAccountName: postgresql
      securityContext:
        fsGroup: 999
      containers:
      - name: postgresql
        image: postgres:15-alpine
        env:
        - name: POSTGRES_USER
          valueFrom:
            secretKeyRef:
              name: postgresql-secret
              key: username
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: postgresql-secret
              key: password
        - name: POSTGRES_DB
          value: "threatmodel"
        - name: PGDATA
          value: "/var/lib/postgresql/data/pgdata"
        - name: POSTGRES_REPLICATION_MODE
          value: "master"
        - name: POSTGRES_REPLICATION_USER
          value: "replicator"
        - name: POSTGRES_REPLICATION_PASSWORD
          valueFrom:
            secretKeyRef:
              name: postgresql-secret
              key: replication-password
        ports:
        - name: postgresql
          containerPort: 5432
        livenessProbe:
          exec:
            command:
            - pg_isready
            - -U
            - postgres
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          exec:
            command:
            - pg_isready
            - -U
            - postgres
          initialDelaySeconds: 5
          periodSeconds: 5
        resources:
          requests:
            memory: "1Gi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
        volumeMounts:
        - name: data
          mountPath: /var/lib/postgresql/data
        - name: config
          mountPath: /etc/postgresql
        - name: init-scripts
          mountPath: /docker-entrypoint-initdb.d
      volumes:
      - name: config
        configMap:
          name: postgresql-config
      - name: init-scripts
        configMap:
          name: postgresql-init
      nodeSelector:
        workload-type: database
      tolerations:
      - key: database
        operator: Equal
        value: "true"
        effect: NoSchedule
  volumeClaimTemplates:
  - metadata:
      name: data
    spec:
      accessModes: ["ReadWriteOnce"]
      storageClassName: fast-ssd
      resources:
        requests:
          storage: 100Gi
---
# databases/postgresql-service.yaml
apiVersion: v1
kind: Service
metadata:
  name: postgresql
  namespace: threatmodel-data
spec:
  type: ClusterIP
  clusterIP: None
  ports:
  - port: 5432
    targetPort: 5432
  selector:
    app: postgresql
---
# databases/postgresql-service-read.yaml
apiVersion: v1
kind: Service
metadata:
  name: postgresql-read
  namespace: threatmodel-data
spec:
  type: ClusterIP
  ports:
  - port: 5432
    targetPort: 5432
  selector:
    app: postgresql
    role: replica
```

#### Redis Deployment

```yaml
# databases/redis-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: redis
  namespace: threatmodel-data
spec:
  replicas: 1
  selector:
    matchLabels:
      app: redis
  template:
    metadata:
      labels:
        app: redis
    spec:
      containers:
      - name: redis
        image: redis:7-alpine
        command:
        - redis-server
        - /usr/local/etc/redis/redis.conf
        ports:
        - containerPort: 6379
        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "200m"
        livenessProbe:
          tcpSocket:
            port: 6379
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          exec:
            command:
            - redis-cli
            - ping
          initialDelaySeconds: 5
          periodSeconds: 5
        volumeMounts:
        - name: config
          mountPath: /usr/local/etc/redis
        - name: data
          mountPath: /data
      volumes:
      - name: config
        configMap:
          name: redis-config
      - name: data
        persistentVolumeClaim:
          claimName: redis-data
      nodeSelector:
        workload-type: database
      tolerations:
      - key: database
        operator: Equal
        value: "true"
        effect: NoSchedule
---
# databases/redis-service.yaml
apiVersion: v1
kind: Service
metadata:
  name: redis
  namespace: threatmodel-data
spec:
  type: ClusterIP
  ports:
  - port: 6379
    targetPort: 6379
  selector:
    app: redis
```

### Observability Stack

#### Prometheus

```yaml
# monitoring/prometheus-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: prometheus
  namespace: threatmodel-monitoring
spec:
  replicas: 2
  selector:
    matchLabels:
      app: prometheus
  template:
    metadata:
      labels:
        app: prometheus
    spec:
      serviceAccountName: prometheus
      containers:
      - name: prometheus
        image: prom/prometheus:latest
        args:
        - '--config.file=/etc/prometheus/prometheus.yml'
        - '--storage.tsdb.path=/prometheus/'
        - '--web.console.libraries=/etc/prometheus/console_libraries'
        - '--web.console.templates=/etc/prometheus/consoles'
        - '--storage.tsdb.retention.time=30d'
        - '--web.enable-lifecycle'
        ports:
        - containerPort: 9090
        resources:
          requests:
            memory: "1Gi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
        volumeMounts:
        - name: config
          mountPath: /etc/prometheus
        - name: storage
          mountPath: /prometheus
      volumes:
      - name: config
        configMap:
          name: prometheus-config
      - name: storage
        persistentVolumeClaim:
          claimName: prometheus-storage
      nodeSelector:
        workload-type: monitoring
---
# monitoring/prometheus-config.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: prometheus-config
  namespace: threatmodel-monitoring
data:
  prometheus.yml: |
    global:
      scrape_interval: 15s
      evaluation_interval: 15s
    
    alerting:
      alertmanagers:
      - static_configs:
        - targets:
          - alertmanager:9093
    
    rule_files:
      - "alerts/*.yml"
    
    scrape_configs:
    - job_name: 'kubernetes-apiservers'
      kubernetes_sd_configs:
      - role: endpoints
      scheme: https
      tls_config:
        ca_file: /var/run/secrets/kubernetes.io/serviceaccount/ca.crt
      bearer_token_file: /var/run/secrets/kubernetes.io/serviceaccount/token
      relabel_configs:
      - source_labels: [__meta_kubernetes_namespace, __meta_kubernetes_service_name, __meta_kubernetes_endpoint_port_name]
        action: keep
        regex: default;kubernetes;https
    
    - job_name: 'kubernetes-pods'
      kubernetes_sd_configs:
      - role: pod
      relabel_configs:
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
        action: keep
        regex: true
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_path]
        action: replace
        target_label: __metrics_path__
        regex: (.+)
      - source_labels: [__address__, __meta_kubernetes_pod_annotation_prometheus_io_port]
        action: replace
        regex: ([^:]+)(?::\d+)?;(\d+)
        replacement: $1:$2
        target_label: __address__
      - action: labelmap
        regex: __meta_kubernetes_pod_label_(.+)
      - source_labels: [__meta_kubernetes_namespace]
        action: replace
        target_label: kubernetes_namespace
      - source_labels: [__meta_kubernetes_pod_name]
        action: replace
        target_label: kubernetes_pod_name
```

## Helm Charts

### Chart Structure

```
helm/
├── threatmodel-app/
│   ├── Chart.yaml
│   ├── values.yaml
│   ├── values-prod.yaml
│   ├── values-staging.yaml
│   ├── templates/
│   │   ├── _helpers.tpl
│   │   ├── namespace.yaml
│   │   ├── configmap.yaml
│   │   ├── secret.yaml
│   │   ├── deployment.yaml
│   │   ├── service.yaml
│   │   ├── ingress.yaml
│   │   ├── hpa.yaml
│   │   ├── pdb.yaml
│   │   └── servicemonitor.yaml
│   └── charts/
│       ├── postgresql/
│       ├── redis/
│       └── minio/
```

### Main Chart Configuration

```yaml
# helm/threatmodel-app/Chart.yaml
apiVersion: v2
name: threatmodel-app
description: A comprehensive threat modeling application
type: application
version: 1.0.0
appVersion: "1.0.0"
dependencies:
  - name: postgresql
    version: 12.1.9
    repository: https://charts.bitnami.com/bitnami
    condition: postgresql.enabled
  - name: redis
    version: 17.3.14
    repository: https://charts.bitnami.com/bitnami
    condition: redis.enabled
  - name: minio
    version: 12.0.1
    repository: https://charts.bitnami.com/bitnami
    condition: minio.enabled
  - name: kong
    version: 2.26.3
    repository: https://charts.konghq.com
    condition: kong.enabled
maintainers:
  - name: Security Team
    email: security@threatmodel.io
```

### Values Configuration

```yaml
# helm/threatmodel-app/values.yaml
global:
  environment: production
  domain: threatmodel.io
  imageRegistry: gcr.io/threatmodel
  imagePullSecrets:
    - name: gcr-secret
  
  security:
    tls:
      enabled: true
      certManager:
        enabled: true
        issuer: letsencrypt-prod
    
    networkPolicies:
      enabled: true
      
    podSecurityPolicies:
      enabled: true

auth-service:
  enabled: true
  replicaCount: 3
  image:
    repository: auth-service
    tag: 1.0.0
    pullPolicy: IfNotPresent
  
  service:
    type: ClusterIP
    port: 8080
  
  resources:
    requests:
      memory: "256Mi"
      cpu: "250m"
    limits:
      memory: "512Mi"
      cpu: "500m"
  
  autoscaling:
    enabled: true
    minReplicas: 3
    maxReplicas: 10
    targetCPUUtilizationPercentage: 70
    targetMemoryUtilizationPercentage: 80
  
  env:
    - name: NODE_ENV
      value: production
    - name: LOG_LEVEL
      value: info
  
  secrets:
    - name: DATABASE_URL
      valueFrom:
        secretKeyRef:
          name: auth-db-secret
          key: connection-string
    - name: REDIS_URL
      valueFrom:
        secretKeyRef:
          name: redis-secret
          key: connection-string

api-gateway:
  enabled: true
  kong:
    enabled: true
    proxy:
      type: LoadBalancer
      annotations:
        service.beta.kubernetes.io/aws-load-balancer-type: "nlb"
    
    env:
      database: postgres
      plugins: bundled,jwt,oauth2,rate-limiting
    
    postgresql:
      enabled: false
      external:
        host: postgresql.threatmodel-data.svc.cluster.local
        user: kong
        database: kong

postgresql:
  enabled: true
  auth:
    enablePostgresUser: true
    postgresPassword: ""
    database: threatmodel
  
  primary:
    persistence:
      enabled: true
      size: 100Gi
      storageClass: fast-ssd
    
    resources:
      requests:
        memory: "1Gi"
        cpu: "500m"
      limits:
        memory: "2Gi"
        cpu: "1000m"
    
    nodeSelector:
      workload-type: database
    
    tolerations:
      - key: database
        operator: Equal
        value: "true"
        effect: NoSchedule
  
  metrics:
    enabled: true
    serviceMonitor:
      enabled: true

redis:
  enabled: true
  auth:
    enabled: true
    password: ""
  
  master:
    persistence:
      enabled: true
      size: 10Gi
    
    resources:
      requests:
        memory: "256Mi"
        cpu: "100m"
      limits:
        memory: "512Mi"
        cpu: "200m"
  
  sentinel:
    enabled: true
    quorum: 2
  
  metrics:
    enabled: true
    serviceMonitor:
      enabled: true

ingress:
  enabled: true
  className: nginx
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/rate-limit: "100"
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/force-ssl-redirect: "true"
  
  hosts:
    - host: api.threatmodel.io
      paths:
        - path: /
          pathType: Prefix
          backend:
            service:
              name: kong-proxy
              port: 80
  
  tls:
    - secretName: api-tls-secret
      hosts:
        - api.threatmodel.io
```

### Helm Template Examples

```yaml
# helm/threatmodel-app/templates/deployment.yaml
{{- range $service, $config := .Values.services }}
{{- if $config.enabled }}
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "threatmodel-app.fullname" $ }}-{{ $service }}
  labels:
    {{- include "threatmodel-app.labels" $ | nindent 4 }}
    app.kubernetes.io/component: {{ $service }}
spec:
  {{- if not $config.autoscaling.enabled }}
  replicas: {{ $config.replicaCount }}
  {{- end }}
  selector:
    matchLabels:
      {{- include "threatmodel-app.selectorLabels" $ | nindent 6 }}
      app.kubernetes.io/component: {{ $service }}
  template:
    metadata:
      annotations:
        checksum/config: {{ include (print $.Template.BasePath "/configmap.yaml") $ | sha256sum }}
        checksum/secret: {{ include (print $.Template.BasePath "/secret.yaml") $ | sha256sum }}
        {{- with $config.podAnnotations }}
        {{- toYaml . | nindent 8 }}
        {{- end }}
      labels:
        {{- include "threatmodel-app.selectorLabels" $ | nindent 8 }}
        app.kubernetes.io/component: {{ $service }}
    spec:
      {{- with $.Values.global.imagePullSecrets }}
      imagePullSecrets:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      serviceAccountName: {{ include "threatmodel-app.serviceAccountName" $ }}-{{ $service }}
      securityContext:
        {{- toYaml $config.podSecurityContext | nindent 8 }}
      containers:
      - name: {{ $service }}
        securityContext:
          {{- toYaml $config.securityContext | nindent 12 }}
        image: "{{ $.Values.global.imageRegistry }}/{{ $config.image.repository }}:{{ $config.image.tag | default $.Chart.AppVersion }}"
        imagePullPolicy: {{ $config.image.pullPolicy }}
        ports:
        - name: http
          containerPort: {{ $config.service.port }}
          protocol: TCP
        {{- if $config.metrics.enabled }}
        - name: metrics
          containerPort: {{ $config.metrics.port }}
          protocol: TCP
        {{- end }}
        env:
        {{- range $config.env }}
        - name: {{ .name }}
          value: {{ .value | quote }}
        {{- end }}
        {{- range $config.secrets }}
        - name: {{ .name }}
          valueFrom:
            {{- toYaml .valueFrom | nindent 12 }}
        {{- end }}
        livenessProbe:
          {{- toYaml $config.livenessProbe | nindent 12 }}
        readinessProbe:
          {{- toYaml $config.readinessProbe | nindent 12 }}
        resources:
          {{- toYaml $config.resources | nindent 12 }}
        {{- with $config.volumeMounts }}
        volumeMounts:
          {{- toYaml . | nindent 12 }}
        {{- end }}
      {{- with $config.volumes }}
      volumes:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      {{- with $config.nodeSelector }}
      nodeSelector:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      {{- with $config.affinity }}
      affinity:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      {{- with $config.tolerations }}
      tolerations:
        {{- toYaml . | nindent 8 }}
      {{- end }}
{{- end }}
{{- end }}
```

## CI/CD Pipeline Design

### GitLab CI/CD Pipeline

```yaml
# .gitlab-ci.yml
stages:
  - build
  - test
  - scan
  - package
  - deploy-staging
  - test-staging
  - deploy-production

variables:
  DOCKER_DRIVER: overlay2
  DOCKER_TLS_CERTDIR: "/certs"
  REGISTRY: gcr.io/threatmodel
  HELM_VERSION: 3.12.0
  KUBECTL_VERSION: 1.28.0

.docker-login: &docker-login
  - echo $GCP_SERVICE_ACCOUNT | base64 -d > ${HOME}/gcp-key.json
  - gcloud auth activate-service-account --key-file ${HOME}/gcp-key.json
  - gcloud auth configure-docker

# Build Stage
build:auth-service:
  stage: build
  image: docker:latest
  services:
    - docker:dind
  before_script:
    - *docker-login
  script:
    - docker build -t $REGISTRY/auth-service:$CI_COMMIT_SHA services/auth
    - docker push $REGISTRY/auth-service:$CI_COMMIT_SHA
    - docker tag $REGISTRY/auth-service:$CI_COMMIT_SHA $REGISTRY/auth-service:latest
    - docker push $REGISTRY/auth-service:latest
  only:
    - main
    - develop
    - /^release\/.*$/

# Test Stage
test:unit:
  stage: test
  image: node:18-alpine
  before_script:
    - npm ci
  script:
    - npm run test:unit
    - npm run test:coverage
  coverage: '/Lines\s*:\s*(\d+\.\d+)%/'
  artifacts:
    reports:
      coverage_report:
        coverage_format: cobertura
        path: coverage/cobertura-coverage.xml
      junit: coverage/junit.xml

test:integration:
  stage: test
  image: node:18-alpine
  services:
    - postgres:15-alpine
    - redis:7-alpine
  variables:
    POSTGRES_USER: test
    POSTGRES_PASSWORD: test
    POSTGRES_DB: test
    DATABASE_URL: postgres://test:test@postgres:5432/test
    REDIS_URL: redis://redis:6379
  before_script:
    - npm ci
  script:
    - npm run test:integration

# Security Scanning
scan:dependencies:
  stage: scan
  image: node:18-alpine
  script:
    - npm audit --production
    - npx snyk test
  allow_failure: true

scan:container:
  stage: scan
  image: aquasec/trivy:latest
  script:
    - trivy image --severity HIGH,CRITICAL --no-progress --format json -o trivy-report.json $REGISTRY/auth-service:$CI_COMMIT_SHA
  artifacts:
    reports:
      container_scanning: trivy-report.json

scan:sast:
  stage: scan
  image: returntocorp/semgrep:latest
  script:
    - semgrep --config=auto --json -o sast-report.json .
  artifacts:
    reports:
      sast: sast-report.json

# Package Stage
package:helm:
  stage: package
  image: alpine/helm:$HELM_VERSION
  script:
    - helm dependency update helm/threatmodel-app
    - helm package helm/threatmodel-app --version $CI_COMMIT_SHA
    - helm push threatmodel-app-$CI_COMMIT_SHA.tgz oci://$REGISTRY/charts
  only:
    - main
    - develop
    - /^release\/.*$/

# Deploy to Staging
deploy:staging:
  stage: deploy-staging
  image: alpine/k8s:$KUBECTL_VERSION
  environment:
    name: staging
    url: https://staging-api.threatmodel.io
  before_script:
    - echo $KUBE_CONFIG_STAGING | base64 -d > ${HOME}/.kube/config
    - *docker-login
  script:
    - helm upgrade --install threatmodel-staging oci://$REGISTRY/charts/threatmodel-app
      --version $CI_COMMIT_SHA
      --namespace threatmodel-staging
      --values helm/threatmodel-app/values-staging.yaml
      --set global.image.tag=$CI_COMMIT_SHA
      --wait
      --timeout 10m
  only:
    - develop

# Staging Tests
test:staging:smoke:
  stage: test-staging
  image: postman/newman:alpine
  script:
    - newman run tests/postman/smoke-tests.json
      --environment tests/postman/staging-env.json
      --reporters cli,junit
      --reporter-junit-export results/newman-results.xml
  artifacts:
    reports:
      junit: results/newman-results.xml
  only:
    - develop

test:staging:e2e:
  stage: test-staging
  image: cypress/included:latest
  script:
    - npm ci
    - npm run cypress:run -- --config baseUrl=https://staging.threatmodel.io
  artifacts:
    when: always
    paths:
      - cypress/screenshots
      - cypress/videos
    reports:
      junit: cypress/results/junit.xml
  only:
    - develop

# Deploy to Production
deploy:production:
  stage: deploy-production
  image: alpine/k8s:$KUBECTL_VERSION
  environment:
    name: production
    url: https://api.threatmodel.io
  before_script:
    - echo $KUBE_CONFIG_PROD | base64 -d > ${HOME}/.kube/config
    - *docker-login
  script:
    - helm upgrade --install threatmodel-prod oci://$REGISTRY/charts/threatmodel-app
      --version $CI_COMMIT_SHA
      --namespace threatmodel-prod
      --values helm/threatmodel-app/values-prod.yaml
      --set global.image.tag=$CI_COMMIT_SHA
      --wait
      --timeout 15m
      --atomic
  when: manual
  only:
    - main
    - /^release\/.*$/

# Rollback job
rollback:production:
  stage: deploy-production
  image: alpine/k8s:$KUBECTL_VERSION
  environment:
    name: production
  before_script:
    - echo $KUBE_CONFIG_PROD | base64 -d > ${HOME}/.kube/config
  script:
    - helm rollback threatmodel-prod --namespace threatmodel-prod
  when: manual
  only:
    - main
```

### GitHub Actions Pipeline

```yaml
# .github/workflows/main.yml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    
    strategy:
      matrix:
        service: [auth-service, user-service, project-service]
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v3
    
    - name: Set up Docker Buildx
      uses: docker/setup-buildx-action@v2
    
    - name: Log in to Container Registry
      uses: docker/login-action@v2
      with:
        registry: ${{ env.REGISTRY }}
        username: ${{ github.actor }}
        password: ${{ secrets.GITHUB_TOKEN }}
    
    - name: Extract metadata
      id: meta
      uses: docker/metadata-action@v4
      with:
        images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/${{ matrix.service }}
        tags: |
          type=ref,event=branch
          type=ref,event=pr
          type=semver,pattern={{version}}
          type=semver,pattern={{major}}.{{minor}}
          type=sha
    
    - name: Build and push Docker image
      uses: docker/build-push-action@v4
      with:
        context: ./services/${{ matrix.service }}
        push: true
        tags: ${{ steps.meta.outputs.tags }}
        labels: ${{ steps.meta.outputs.labels }}
        cache-from: type=gha
        cache-to: type=gha,mode=max

  test:
    needs: build
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      
      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Use Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run tests
      run: |
        npm run test:unit
        npm run test:integration
      env:
        DATABASE_URL: postgres://test:test@localhost:5432/test
        REDIS_URL: redis://localhost:6379
    
    - name: Upload coverage
      uses: codecov/codecov-action@v3
      with:
        file: ./coverage/lcov.info

  security-scan:
    needs: build
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Run Trivy vulnerability scanner
      uses: aquasecurity/trivy-action@master
      with:
        image-ref: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/auth-service:${{ github.sha }}
        format: 'sarif'
        output: 'trivy-results.sarif'
    
    - name: Upload Trivy scan results
      uses: github/codeql-action/upload-sarif@v2
      with:
        sarif_file: 'trivy-results.sarif'
    
    - name: Run Snyk security scan
      uses: snyk/actions/node@master
      env:
        SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}

  deploy-staging:
    needs: [test, security-scan]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/develop'
    environment:
      name: staging
      url: https://staging-api.threatmodel.io
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Install Helm
      uses: azure/setup-helm@v3
      with:
        version: '3.12.0'
    
    - name: Deploy to Kubernetes
      run: |
        echo "${{ secrets.KUBE_CONFIG_STAGING }}" | base64 -d > kubeconfig
        export KUBECONFIG=kubeconfig
        
        helm upgrade --install threatmodel-staging ./helm/threatmodel-app \
          --namespace threatmodel-staging \
          --values ./helm/threatmodel-app/values-staging.yaml \
          --set global.image.tag=${{ github.sha }} \
          --wait \
          --timeout 10m

  deploy-production:
    needs: [test, security-scan]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    environment:
      name: production
      url: https://api.threatmodel.io
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Install Helm
      uses: azure/setup-helm@v3
      with:
        version: '3.12.0'
    
    - name: Deploy to Kubernetes
      run: |
        echo "${{ secrets.KUBE_CONFIG_PROD }}" | base64 -d > kubeconfig
        export KUBECONFIG=kubeconfig
        
        helm upgrade --install threatmodel-prod ./helm/threatmodel-app \
          --namespace threatmodel-prod \
          --values ./helm/threatmodel-app/values-prod.yaml \
          --set global.image.tag=${{ github.sha }} \
          --wait \
          --timeout 15m \
          --atomic
```

## Monitoring and Observability

### Monitoring Stack Architecture

```yaml
monitoring_stack:
  metrics:
    prometheus:
      retention: 30d
      scrape_interval: 15s
      storage: 100Gi
      
  visualization:
    grafana:
      datasources:
        - prometheus
        - elasticsearch
        - jaeger
      dashboards:
        - kubernetes-cluster
        - application-metrics
        - business-metrics
        - security-events
        
  logging:
    elasticsearch:
      nodes: 3
      storage: 500Gi
      retention: 30d
      
    fluentd:
      inputs:
        - kubernetes-pods
        - system-logs
        - audit-logs
      
    kibana:
      dashboards:
        - application-logs
        - security-audit
        - error-analysis
        
  tracing:
    jaeger:
      sampling_rate: 0.1
      storage: elasticsearch
      retention: 7d
      
  alerting:
    alertmanager:
      receivers:
        - pagerduty
        - slack
        - email
      routes:
        - critical: pagerduty
        - warning: slack
        - info: email
```

### Prometheus Configuration

```yaml
# monitoring/prometheus-values.yaml
prometheus:
  prometheusSpec:
    retention: 30d
    retentionSize: 90GB
    
    storageSpec:
      volumeClaimTemplate:
        spec:
          storageClassName: fast-ssd
          accessModes: ["ReadWriteOnce"]
          resources:
            requests:
              storage: 100Gi
    
    resources:
      requests:
        memory: 2Gi
        cpu: 1000m
      limits:
        memory: 4Gi
        cpu: 2000m
    
    serviceMonitorSelectorNilUsesHelmValues: false
    podMonitorSelectorNilUsesHelmValues: false
    ruleSelectorNilUsesHelmValues: false
    
    additionalScrapeConfigs:
    - job_name: 'kubernetes-pods'
      kubernetes_sd_configs:
      - role: pod
      relabel_configs:
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
        action: keep
        regex: true

alertmanager:
  config:
    global:
      resolve_timeout: 5m
      slack_api_url: '{{ .Values.slack.apiUrl }}'
      pagerduty_url: 'https://events.pagerduty.com/v2/enqueue'
    
    route:
      group_by: ['alertname', 'cluster', 'service']
      group_wait: 10s
      group_interval: 10s
      repeat_interval: 12h
      receiver: 'default'
      routes:
      - match:
          severity: critical
        receiver: pagerduty
        continue: true
      - match:
          severity: warning
        receiver: slack
        continue: true
    
    receivers:
    - name: 'default'
      slack_configs:
      - channel: '#alerts'
        title: 'ThreatModel Alert'
        text: '{{ range .Alerts }}{{ .Annotations.summary }}\n{{ end }}'
    
    - name: 'pagerduty'
      pagerduty_configs:
      - routing_key: '{{ .Values.pagerduty.routingKey }}'
        description: '{{ .GroupLabels.alertname }}'
    
    - name: 'slack'
      slack_configs:
      - channel: '#alerts'
        title: 'Warning: {{ .GroupLabels.alertname }}'
```

### Grafana Dashboards

```json
// monitoring/dashboards/application-metrics.json
{
  "dashboard": {
    "title": "ThreatModel Application Metrics",
    "panels": [
      {
        "title": "Request Rate",
        "targets": [
          {
            "expr": "sum(rate(http_requests_total[5m])) by (service)"
          }
        ],
        "type": "graph"
      },
      {
        "title": "Error Rate",
        "targets": [
          {
            "expr": "sum(rate(http_requests_total{status=~\"5..\"}[5m])) by (service)"
          }
        ],
        "type": "graph"
      },
      {
        "title": "Response Time",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (service, le))"
          }
        ],
        "type": "graph"
      },
      {
        "title": "Active Users",
        "targets": [
          {
            "expr": "sum(active_users_total)"
          }
        ],
        "type": "stat"
      }
    ]
  }
}
```

### Logging Configuration

```yaml
# monitoring/fluentd-config.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: fluentd-config
  namespace: threatmodel-monitoring
data:
  fluent.conf: |
    <source>
      @type tail
      path /var/log/containers/*.log
      pos_file /var/log/fluentd-containers.log.pos
      tag kubernetes.*
      read_from_head true
      <parse>
        @type json
        time_format %Y-%m-%dT%H:%M:%S.%NZ
      </parse>
    </source>
    
    <filter kubernetes.**>
      @type kubernetes_metadata
      @id filter_kube_metadata
      kubernetes_url "#{ENV['FLUENT_FILTER_KUBERNETES_URL'] || 'https://' + ENV.fetch('KUBERNETES_SERVICE_HOST') + ':' + ENV.fetch('KUBERNETES_SERVICE_PORT') + '/api'}"
      verify_ssl "#{ENV['KUBERNETES_VERIFY_SSL'] || true}"
    </filter>
    
    <filter kubernetes.**>
      @type record_transformer
      enable_ruby true
      <record>
        hostname ${hostname}
        environment ${record["kubernetes"]["namespace_name"]}
        service ${record["kubernetes"]["labels"]["app"]}
        version ${record["kubernetes"]["labels"]["version"]}
      </record>
    </filter>
    
    <match kubernetes.**>
      @type elasticsearch
      @id out_es
      @log_level info
      include_tag_key true
      host "#{ENV['FLUENT_ELASTICSEARCH_HOST']}"
      port "#{ENV['FLUENT_ELASTICSEARCH_PORT']}"
      path "#{ENV['FLUENT_ELASTICSEARCH_PATH']}"
      scheme "#{ENV['FLUENT_ELASTICSEARCH_SCHEME'] || 'http'}"
      ssl_verify "#{ENV['FLUENT_ELASTICSEARCH_SSL_VERIFY'] || 'true'}"
      ssl_version "#{ENV['FLUENT_ELASTICSEARCH_SSL_VERSION'] || 'TLSv1_2'}"
      user "#{ENV['FLUENT_ELASTICSEARCH_USER'] || use_default}"
      password "#{ENV['FLUENT_ELASTICSEARCH_PASSWORD'] || use_default}"
      reload_connections "#{ENV['FLUENT_ELASTICSEARCH_RELOAD_CONNECTIONS'] || 'false'}"
      reconnect_on_error "#{ENV['FLUENT_ELASTICSEARCH_RECONNECT_ON_ERROR'] || 'true'}"
      reload_on_failure "#{ENV['FLUENT_ELASTICSEARCH_RELOAD_ON_FAILURE'] || 'true'}"
      log_es_400_reason "#{ENV['FLUENT_ELASTICSEARCH_LOG_ES_400_REASON'] || 'false'}"
      logstash_prefix "#{ENV['FLUENT_ELASTICSEARCH_LOGSTASH_PREFIX'] || 'logstash'}"
      logstash_dateformat "#{ENV['FLUENT_ELASTICSEARCH_LOGSTASH_DATEFORMAT'] || '%Y.%m.%d'}"
      logstash_format "#{ENV['FLUENT_ELASTICSEARCH_LOGSTASH_FORMAT'] || 'true'}"
      index_name "#{ENV['FLUENT_ELASTICSEARCH_LOGSTASH_INDEX_NAME'] || 'logstash'}"
      type_name "#{ENV['FLUENT_ELASTICSEARCH_LOGSTASH_TYPE_NAME'] || 'fluentd'}"
      include_timestamp "#{ENV['FLUENT_ELASTICSEARCH_INCLUDE_TIMESTAMP'] || 'false'}"
      template_name "#{ENV['FLUENT_ELASTICSEARCH_TEMPLATE_NAME'] || use_nil}"
      template_file "#{ENV['FLUENT_ELASTICSEARCH_TEMPLATE_FILE'] || use_nil}"
      template_overwrite "#{ENV['FLUENT_ELASTICSEARCH_TEMPLATE_OVERWRITE'] || use_default}"
      sniffer_class_name "#{ENV['FLUENT_SNIFFER_CLASS_NAME'] || 'Fluent::Plugin::ElasticsearchSimpleSniffer'}"
      request_timeout "#{ENV['FLUENT_ELASTICSEARCH_REQUEST_TIMEOUT'] || '5s'}"
      <buffer>
        flush_thread_count "#{ENV['FLUENT_ELASTICSEARCH_BUFFER_FLUSH_THREAD_COUNT'] || '8'}"
        flush_interval "#{ENV['FLUENT_ELASTICSEARCH_BUFFER_FLUSH_INTERVAL'] || '5s'}"
        chunk_limit_size "#{ENV['FLUENT_ELASTICSEARCH_BUFFER_CHUNK_LIMIT_SIZE'] || '2M'}"
        queue_limit_length "#{ENV['FLUENT_ELASTICSEARCH_BUFFER_QUEUE_LIMIT_LENGTH'] || '32'}"
        retry_max_interval "#{ENV['FLUENT_ELASTICSEARCH_BUFFER_RETRY_MAX_INTERVAL'] || '30'}"
        retry_forever true
      </buffer>
    </match>
```

### Alert Rules

```yaml
# monitoring/alerts/application-alerts.yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: application-alerts
  namespace: threatmodel-monitoring
spec:
  groups:
  - name: application
    interval: 30s
    rules:
    - alert: HighErrorRate
      expr: |
        sum(rate(http_requests_total{status=~"5.."}[5m])) by (service)
        /
        sum(rate(http_requests_total[5m])) by (service)
        > 0.05
      for: 5m
      labels:
        severity: critical
      annotations:
        summary: "High error rate on {{ $labels.service }}"
        description: "{{ $labels.service }} has error rate of {{ $value | humanizePercentage }}"
    
    - alert: HighResponseTime
      expr: |
        histogram_quantile(0.95,
          sum(rate(http_request_duration_seconds_bucket[5m])) by (service, le)
        ) > 1
      for: 5m
      labels:
        severity: warning
      annotations:
        summary: "High response time on {{ $labels.service }}"
        description: "95th percentile response time is {{ $value }}s"
    
    - alert: PodCrashLooping
      expr: |
        rate(kube_pod_container_status_restarts_total[15m]) > 0
      for: 5m
      labels:
        severity: critical
      annotations:
        summary: "Pod {{ $labels.namespace }}/{{ $labels.pod }} is crash looping"
        description: "Pod {{ $labels.namespace }}/{{ $labels.pod }} has restarted {{ $value }} times in the last 15 minutes"
    
    - alert: HighMemoryUsage
      expr: |
        container_memory_usage_bytes{pod!=""}
        /
        container_spec_memory_limit_bytes{pod!=""}
        > 0.9
      for: 5m
      labels:
        severity: warning
      annotations:
        summary: "High memory usage in {{ $labels.pod }}"
        description: "Pod {{ $labels.namespace }}/{{ $labels.pod }} is using {{ $value | humanizePercentage }} of its memory limit"
    
    - alert: DatabaseConnectionPoolExhausted
      expr: |
        pg_stat_database_numbackends{datname="threatmodel"}
        /
        pg_settings_max_connections
        > 0.8
      for: 5m
      labels:
        severity: critical
      annotations:
        summary: "Database connection pool nearly exhausted"
        description: "{{ $value | humanizePercentage }} of max connections are in use"
```

## Disaster Recovery

### Backup Strategy

```yaml
backup_strategy:
  databases:
    postgresql:
      schedule: "0 2 * * *"  # Daily at 2 AM
      retention: 30  # days
      method: pg_dump
      storage: s3://backup-bucket/postgresql/
      
    redis:
      schedule: "0 * * * *"  # Hourly
      retention: 7  # days
      method: rdb_snapshot
      storage: s3://backup-bucket/redis/
      
  persistent_volumes:
    schedule: "0 3 * * *"  # Daily at 3 AM
    retention: 14  # days
    method: volume_snapshot
    
  configurations:
    schedule: "0 4 * * *"  # Daily at 4 AM
    retention: 90  # days
    includes:
      - configmaps
      - secrets
      - deployments
      - services
```

### Backup Implementation

```yaml
# backups/postgresql-backup-cronjob.yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: postgresql-backup
  namespace: threatmodel-data
spec:
  schedule: "0 2 * * *"
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: backup
            image: postgres:15-alpine
            env:
            - name: PGHOST
              value: postgresql
            - name: PGUSER
              valueFrom:
                secretKeyRef:
                  name: postgresql-secret
                  key: username
            - name: PGPASSWORD
              valueFrom:
                secretKeyRef:
                  name: postgresql-secret
                  key: password
            - name: S3_BUCKET
              value: s3://backup-bucket/postgresql/
            - name: AWS_ACCESS_KEY_ID
              valueFrom:
                secretKeyRef:
                  name: backup-s3-credentials
                  key: access-key
            - name: AWS_SECRET_ACCESS_KEY
              valueFrom:
                secretKeyRef:
                  name: backup-s3-credentials
                  key: secret-key
            command:
            - /bin/sh
            - -c
            - |
              DATE=$(date +%Y%m%d_%H%M%S)
              BACKUP_FILE="backup_${DATE}.sql.gz"
              
              echo "Starting backup..."
              pg_dumpall | gzip > /tmp/${BACKUP_FILE}
              
              echo "Uploading to S3..."
              aws s3 cp /tmp/${BACKUP_FILE} ${S3_BUCKET}${BACKUP_FILE}
              
              echo "Cleaning up old backups..."
              aws s3 ls ${S3_BUCKET} | \
                awk '{print $4}' | \
                sort -r | \
                tail -n +31 | \
                xargs -I {} aws s3 rm ${S3_BUCKET}{}
              
              echo "Backup completed successfully"
          restartPolicy: OnFailure
```

This comprehensive infrastructure design document covers:

1. **Kubernetes Architecture**: Multi-node cluster design with specialized node pools
2. **Kubernetes Manifests**: Complete deployment configurations for all services
3. **Helm Charts**: Templated deployments for easy management
4. **CI/CD Pipelines**: Complete GitLab CI and GitHub Actions pipelines
5. **Monitoring & Observability**: Prometheus, Grafana, ELK stack, and Jaeger
6. **Disaster Recovery**: Automated backup strategies and implementations

The infrastructure is designed for:
- High availability with pod anti-affinity
- Automatic scaling based on metrics
- Security with network policies and RBAC
- Comprehensive monitoring and alerting
- Automated backup and disaster recovery