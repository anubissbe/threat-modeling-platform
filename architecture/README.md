# Threat Modeling Application - Architecture Overview

## Table of Contents
1. [System Overview](#system-overview)
2. [Architecture Principles](#architecture-principles)
3. [High-Level Architecture](#high-level-architecture)
4. [Component Architecture](#component-architecture)
5. [Data Flow](#data-flow)
6. [Deployment Architecture](#deployment-architecture)
7. [Security Architecture](#security-architecture)
8. [Technology Stack](#technology-stack)

## System Overview

The Threat Modeling Application is an enterprise-grade platform designed to support multiple threat modeling methodologies (STRIDE, PASTA, LINDDUN, VAST, DREAD) with AI-powered analysis capabilities. The system is built using a microservices architecture with modern cloud-native technologies.

### Key Features
- Multi-methodology threat modeling support
- AI-powered threat detection and analysis
- Threat Modeling as Code (TMAC) capabilities
- Advanced diagramming with DFD and attack trees
- Comprehensive threat libraries (OWASP, MITRE ATT&CK, CAPEC)
- Privacy threat modeling with LINDDUN support
- Real-time collaboration
- Comprehensive reporting
- Enterprise integrations (JIRA, GitHub, Slack)
- Role-based access control
- Audit logging and compliance

## Architecture Principles

1. **Microservices Architecture**: Domain-driven design with bounded contexts
2. **API-First Design**: All services expose well-defined APIs
3. **Cloud-Native**: Containerized, orchestrated with Kubernetes
4. **Event-Driven**: Asynchronous communication via message brokers
5. **Security by Design**: Zero-trust, encryption at rest and in transit
6. **Observability**: Comprehensive monitoring, logging, and tracing
7. **Scalability**: Horizontal scaling, stateless services
8. **Resilience**: Circuit breakers, retries, fault tolerance

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Client Applications                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │
│  │  Web App    │  │ Mobile App  │  │   CLI       │  │     API     │       │
│  │  (React)    │  │   (React    │  │   (Node.js) │  │  (External) │       │
│  │             │  │   Native)   │  │             │  │             │       │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘       │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │ HTTPS
                    ┌───────────────┴───────────────┐
                    │                               │
                    │      Kong API Gateway         │
                    │   (Auth, Rate Limit, Route)   │
                    │                               │
                    └───────────────┬───────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
                    │      Istio Service Mesh       │
                    │  (mTLS, Observability, LB)    │
                    │                               │
                    └───────────────┬───────────────┘
                                    │
┌───────────────────────────────────┴─────────────────────────────────────────┐
│                            Microservices Layer                               │
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │    Auth      │  │    User      │  │   Project    │  │   Threat     │   │
│  │   Service    │  │  Management  │  │   Service    │  │   Engine     │   │
│  │              │  │   Service    │  │              │  │   Service    │   │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘   │
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │   AI/ML      │  │   Report     │  │ Integration  │  │ Notification │   │
│  │   Service    │  │  Generation  │  │   Service    │  │   Service    │   │
│  │              │  │   Service    │  │              │  │              │   │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘   │
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │    Audit     │  │  Analytics   │  │     TMAC     │  │ Diagramming  │   │
│  │   Service    │  │   Service    │  │   Service    │  │   Service    │   │
│  │              │  │              │  │              │  │              │   │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘   │
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐                                        │
│  │   Threat     │  │   Privacy    │                                        │
│  │  Libraries   │  │   Service    │                                        │
│  │   Service    │  │  (LINDDUN)   │                                        │
│  └──────────────┘  └──────────────┘                                        │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
                    │      Message Broker           │
                    │    (RabbitMQ/Kafka)          │
                    │                               │
                    └───────────────┬───────────────┘
                                    │
┌───────────────────────────────────┴─────────────────────────────────────────┐
│                              Data Layer                                      │
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │  PostgreSQL  │  │    Redis     │  │   pgvector   │  │  ClickHouse  │   │
│  │  (Primary)   │  │   (Cache)    │  │ (Embeddings) │  │ (Analytics)  │   │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘   │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    S3-Compatible Object Storage                       │   │
│  │                      (Files, Reports, Backups)                       │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Component Architecture

### Frontend Architecture
```
┌─────────────────────────────────────────────────────────────────┐
│                        Web Application                           │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │   React     │  │   Redux     │  │   React     │            │
│  │   18.x      │  │   Toolkit   │  │   Query     │            │
│  └─────────────┘  └─────────────┘  └─────────────┘            │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │  Material   │  │   D3.js     │  │  Socket.io  │            │
│  │    UI       │  │ (Diagrams)  │  │  (Realtime) │            │
│  └─────────────┘  └─────────────┘  └─────────────┘            │
└─────────────────────────────────────────────────────────────────┘
```

### Backend Service Architecture
```
┌─────────────────────────────────────────────────────────────────┐
│                    Microservice Template                         │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │   API       │  │  Business   │  │    Data     │            │
│  │  Layer      │  │   Logic     │  │   Access    │            │
│  │  (REST/     │  │   Layer     │  │   Layer     │            │
│  │  GraphQL)   │  │             │  │             │            │
│  └─────────────┘  └─────────────┘  └─────────────┘            │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │   Event     │  │   Cache     │  │  External   │            │
│  │  Publisher  │  │   Layer     │  │Integration  │            │
│  └─────────────┘  └─────────────┘  └─────────────┘            │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow

### 1. Authentication Flow
```
User → Web App → API Gateway → Auth Service → Database
                      ↓
                 JWT Token
                      ↓
              Subsequent Requests
```

### 2. Threat Analysis Flow
```
User Input → Project Service → Message Queue → Threat Engine
                                      ↓
                                 AI Service
                                      ↓
                              Analysis Results
                                      ↓
                            Notification Service → User
```

### 3. Report Generation Flow
```
User Request → Report Service → Gather Data → Generate Report
                     ↓                              ↓
              Template Engine                 Store in S3
                                                   ↓
                                             Download Link
```

## Deployment Architecture

### Kubernetes Cluster Layout
```
┌─────────────────────────────────────────────────────────────────┐
│                     Kubernetes Cluster                           │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────┐  ┌─────────────────────────┐      │
│  │    Namespace: prod      │  │   Namespace: istio      │      │
│  │  ┌─────┐ ┌─────┐       │  │  ┌─────────────────┐    │      │
│  │  │Pod 1│ │Pod 2│       │  │  │ Control Plane   │    │      │
│  │  └─────┘ └─────┘       │  │  └─────────────────┘    │      │
│  └─────────────────────────┘  └─────────────────────────┘      │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────┐  ┌─────────────────────────┐      │
│  │  Namespace: monitoring  │  │  Namespace: logging    │      │
│  │  ┌─────────────────┐    │  │  ┌─────────────────┐    │      │
│  │  │Prometheus/Grafana│   │  │  │  ELK Stack     │    │      │
│  │  └─────────────────┘    │  │  └─────────────────┘    │      │
│  └─────────────────────────┘  └─────────────────────────┘      │
└─────────────────────────────────────────────────────────────────┘
```

### CI/CD Pipeline
```
Code Push → GitLab → CI Pipeline → Build & Test → Container Registry
                           ↓
                     Security Scan
                           ↓
                     Deploy to Dev
                           ↓
                    Integration Tests
                           ↓
                    Deploy to Staging
                           ↓
                     Deploy to Prod
```

## Security Architecture

### Security Layers
1. **Network Security**
   - WAF at edge
   - DDoS protection
   - VPC isolation

2. **Application Security**
   - OAuth2/OIDC authentication
   - JWT tokens
   - RBAC authorization
   - Input validation

3. **Data Security**
   - Encryption at rest (AES-256)
   - Encryption in transit (TLS 1.3)
   - Key management (HashiCorp Vault)

4. **Infrastructure Security**
   - mTLS between services
   - Network policies
   - Pod security policies
   - Container scanning

### Compliance
- SOC 2 Type II
- ISO 27001
- GDPR compliant
- HIPAA ready

## Technology Stack

### Languages & Frameworks
- **Backend**: Node.js (Express), Python (FastAPI)
- **Frontend**: React, TypeScript
- **AI/ML**: Python, TensorFlow, scikit-learn

### Infrastructure
- **Container**: Docker
- **Orchestration**: Kubernetes
- **Service Mesh**: Istio
- **API Gateway**: Kong

### Data Stores
- **Primary DB**: PostgreSQL 15
- **Vector DB**: pgvector
- **Cache**: Redis 7
- **Analytics**: ClickHouse
- **Object Storage**: MinIO/S3

### Messaging & Streaming
- **Message Broker**: RabbitMQ
- **Event Streaming**: Apache Kafka (future)

### Monitoring & Observability
- **Metrics**: Prometheus + Grafana
- **Logging**: ELK Stack
- **Tracing**: Jaeger
- **APM**: New Relic

### CI/CD & DevOps
- **Version Control**: GitLab
- **CI/CD**: GitLab CI
- **IaC**: Terraform
- **Config Management**: Helm

## Performance Targets

- **API Response Time**: < 200ms (p95)
- **Threat Analysis**: < 5s for standard analysis
- **Report Generation**: < 30s for complex reports
- **Availability**: 99.9% SLA
- **Concurrent Users**: 10,000+
- **RPS**: 1,000+ requests/second

## Scalability Strategy

1. **Horizontal Scaling**: All services support horizontal scaling
2. **Database Sharding**: User-based sharding for multi-tenancy
3. **Caching Strategy**: Multi-level caching (CDN, API, DB)
4. **Async Processing**: Background jobs for heavy operations
5. **Auto-scaling**: HPA and VPA for dynamic scaling

## Disaster Recovery

1. **Backup Strategy**
   - Daily automated backups
   - Cross-region replication
   - Point-in-time recovery

2. **High Availability**
   - Multi-AZ deployment
   - Active-passive failover
   - Health checks and auto-recovery

3. **RTO/RPO Targets**
   - RTO: < 1 hour
   - RPO: < 15 minutes

## Documentation Index

1. [Microservices Architecture](./microservices-architecture.md)
2. [API Gateway Architecture](./api-gateway-architecture.md)
3. [Service Mesh Architecture](./service-mesh-architecture.md)
4. [TMAC Architecture](./tmac-architecture.md)
5. [Diagramming Service Architecture](./diagramming-service-architecture.md)
6. [Threat Libraries Architecture](./threat-libraries-architecture.md)
7. [Privacy Architecture (LINDDUN)](./privacy-architecture.md)
8. [Database Design](./database-design.md) (To be created)
9. [API Specifications](./api-specifications.md) (To be created)
10. [Security Design](./security-design.md) (To be created)
11. [Deployment Guide](./deployment-guide.md) (To be created)

## Next Steps

1. Complete database schema design
2. Create detailed API specifications
3. Set up development environment
4. Implement authentication service
5. Create CI/CD pipelines