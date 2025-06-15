# Threat Modeling Application - System Architecture

## Overview
This document describes the system architecture for the enterprise-grade threat modeling platform that supports multiple methodologies (STRIDE, PASTA, LINDDUN, VAST, DREAD) with AI-powered features.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                    CLIENT LAYER                                      │
├─────────────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐│
│  │   Web Client    │  │  Mobile Client  │  │   CLI Client    │  │   API Client    ││
│  │   (React/TS)    │  │  (React Native) │  │  (Node.js/TS)   │  │   (REST/GQL)    ││
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘│
└───────────┼────────────────────┼────────────────────┼────────────────────┼─────────┘
            │                    │                    │                    │
            └────────────────────┴────────────────────┴────────────────────┘
                                          │
                                          ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                   API GATEWAY                                        │
├─────────────────────────────────────────────────────────────────────────────────────┤
│  ┌───────────────────┐  ┌──────────────────┐  ┌──────────────────┐                 │
│  │   Load Balancer   │  │  Authentication  │  │   Rate Limiting   │                 │
│  │    (HAProxy)      │  │  (JWT/OAuth2.0)  │  │   (Redis-based)   │                 │
│  └──────────┬────────┘  └────────┬─────────┘  └────────┬─────────┘                 │
│             └─────────────────────┴──────────────────────┘                          │
│                                    │                                                 │
│  ┌────────────────┐  ┌────────────┴───────────┐  ┌────────────────┐               │
│  │  REST API      │  │     GraphQL API        │  │  WebSocket      │               │
│  │  (Express)     │  │   (Apollo Server)      │  │  (Socket.io)    │               │
│  └────────┬───────┘  └────────────┬───────────┘  └────────┬───────┘               │
└───────────┼───────────────────────┼───────────────────────┼────────────────────────┘
            │                       │                       │
            └───────────────────────┴───────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              MICROSERVICES LAYER                                     │
├─────────────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐│
│  │ Auth Service    │  │ Core Service    │  │ Diagram Service │  │ Report Service  ││
│  │ - SSO/SAML     │  │ - Projects      │  │ - DFD Editor    │  │ - PDF/HTML Gen  ││
│  │ - OIDC         │  │ - Threat Models │  │ - Flow Analysis │  │ - Templates     ││
│  │ - RBAC         │  │ - Methodologies │  │ - Boundaries    │  │ - Scheduling    ││
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  └─────────────────┘│
│                                                                                      │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐│
│  │ AI/ML Service   │  │ Risk Service    │  │ Integration Svc │  │ Collab Service  ││
│  │ - Threat Pred. │  │ - Scoring       │  │ - Jira/Azure    │  │ - Real-time     ││
│  │ - NLP Analysis │  │ - CVSS/DREAD    │  │ - CI/CD Hooks   │  │ - Notifications ││
│  │ - Suggestions  │  │ - Mitigations   │  │ - Vuln Scanners │  │ - Comments      ││
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  └─────────────────┘│
│                                                                                      │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐│
│  │ TMAC Service    │  │ Audit Service   │  │ Search Service  │  │ Storage Service ││
│  │ - Code Gen     │  │ - Logging       │  │ - Elasticsearch │  │ - File Upload   ││
│  │ - Git Sync     │  │ - Compliance    │  │ - Indexing      │  │ - S3/MinIO      ││
│  │ - Validation   │  │ - History       │  │ - Full-text     │  │ - Attachments   ││
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  └─────────────────┘│
└─────────────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                            MESSAGE BROKER LAYER                                      │
├─────────────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐         │
│  │   RabbitMQ/Kafka    │  │   Event Streaming   │  │   CQRS/Event Store │         │
│  │   - Async Tasks     │  │   - Real-time sync  │  │   - Audit trail    │         │
│  │   - Service comm    │  │   - Notifications   │  │   - Time travel    │         │
│  └─────────────────────┘  └─────────────────────┘  └─────────────────────┘         │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              DATA LAYER                                              │
├─────────────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐│
│  │  PostgreSQL     │  │     Redis       │  │  Elasticsearch  │  │    MinIO/S3     ││
│  │  - Primary DB   │  │  - Caching      │  │  - Search idx   │  │  - File store   ││
│  │  - JSONB docs   │  │  - Sessions     │  │  - Analytics    │  │  - Attachments  ││
│  │  - Time series  │  │  - Rate limit   │  │  - Logs         │  │  - Reports      ││
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  └─────────────────┘│
└─────────────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                          INFRASTRUCTURE LAYER                                        │
├─────────────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐│
│  │   Kubernetes    │  │     Docker      │  │   Monitoring    │  │    Security     ││
│  │  - Orchestration│  │  - Containers   │  │  - Prometheus   │  │  - Vault        ││
│  │  - Auto-scaling │  │  - Registry     │  │  - Grafana      │  │  - Cert Manager ││
│  │  - Service mesh │  │  - Compose      │  │  - ELK Stack    │  │  - WAF/IDS      ││
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  └─────────────────┘│
└─────────────────────────────────────────────────────────────────────────────────────┘
```

## Key Architecture Decisions

### 1. Microservices Architecture
- **Rationale**: Enables independent scaling, deployment, and development of different components
- **Benefits**: 
  - Each methodology can be implemented as a plugin
  - AI/ML services can scale independently
  - Better fault isolation

### 2. API Gateway Pattern
- **Components**: Load balancer, authentication, rate limiting
- **Benefits**:
  - Single entry point for all clients
  - Centralized authentication and authorization
  - API versioning and routing

### 3. Event-Driven Architecture
- **Message Broker**: RabbitMQ or Kafka for async communication
- **Benefits**:
  - Real-time collaboration features
  - Decoupled services
  - Event sourcing for audit trails

### 4. CQRS Pattern
- **Command**: Write operations through microservices
- **Query**: Read operations optimized with caching and search
- **Benefits**:
  - Performance optimization
  - Scalability
  - Complex query support

### 5. Plugin Architecture for Methodologies
- **Design**: Each methodology (STRIDE, PASTA, etc.) as a plugin
- **Benefits**:
  - Easy to add new methodologies
  - Methodology-specific logic isolation
  - Customization per organization

## Service Descriptions

### Auth Service
- Handles all authentication and authorization
- Supports SSO, SAML, OIDC
- Role-based access control (RBAC)
- API key management

### Core Service
- Project management
- Threat model lifecycle
- Methodology orchestration
- Business logic coordination

### Diagram Service
- DFD editor backend
- Trust boundary management
- Flow analysis
- Diagram versioning

### AI/ML Service
- Threat prediction using ML models
- Natural language processing for requirements
- Automated threat suggestions
- Risk scoring algorithms

### Risk Service
- Quantitative and qualitative risk assessment
- CVSS, DREAD scoring
- Mitigation tracking
- Risk matrix generation

### Integration Service
- External system connectors
- Jira, Azure DevOps integration
- CI/CD pipeline hooks
- Vulnerability scanner interfaces

### TMAC Service
- Threat Modeling as Code support
- YAML/JSON parsing and validation
- Code generation
- Git synchronization

### Collaboration Service
- Real-time updates via WebSocket
- Comments and annotations
- Notification system
- Activity feeds

### Report Service
- PDF/HTML report generation
- Compliance report templates
- Scheduled reporting
- Export functionality

### Audit Service
- Comprehensive logging
- Compliance tracking
- Change history
- Security monitoring

### Search Service
- Full-text search across all entities
- Elasticsearch integration
- Faceted search
- Saved searches

## Data Flow

1. **Client Request** → API Gateway → Authentication → Rate Limiting → Route to Service
2. **Service Processing** → Business Logic → Database Operations → Cache Update
3. **Async Operations** → Message Queue → Worker Processing → Notification
4. **Real-time Updates** → WebSocket → Event Broadcasting → Client Update

## Security Considerations

1. **Zero Trust Architecture**
   - Every request authenticated
   - Service-to-service authentication
   - Network segmentation

2. **Data Encryption**
   - TLS for all communications
   - Encryption at rest for sensitive data
   - Key rotation policies

3. **Security Headers**
   - CORS configuration
   - CSP headers
   - XSS protection

4. **Audit Logging**
   - All actions logged
   - Immutable audit trail
   - Real-time security monitoring

## Scalability Strategy

1. **Horizontal Scaling**
   - Kubernetes auto-scaling
   - Load balancing
   - Database read replicas

2. **Caching Strategy**
   - Redis for session management
   - API response caching
   - CDN for static assets

3. **Performance Optimization**
   - Database query optimization
   - Lazy loading
   - Pagination and filtering

## Deployment Architecture

1. **Development**: Docker Compose for local development
2. **Staging**: Kubernetes cluster with reduced resources
3. **Production**: Multi-region Kubernetes deployment with high availability

## Technology Stack Summary

- **Backend**: Node.js with TypeScript
- **Frontend**: React with TypeScript
- **Database**: PostgreSQL (primary), Redis (cache), Elasticsearch (search)
- **Message Queue**: RabbitMQ or Kafka
- **Container**: Docker
- **Orchestration**: Kubernetes
- **API**: REST + GraphQL
- **Real-time**: WebSocket (Socket.io)
- **AI/ML**: Python microservices with TensorFlow/PyTorch
- **Monitoring**: Prometheus + Grafana
- **Logging**: ELK Stack