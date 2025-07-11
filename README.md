# 🛡️ Threat Modeling Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.2-61dafb.svg)](https://reactjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ed.svg)](https://www.docker.com/)
[![Security](https://img.shields.io/badge/Security-Enterprise%20Grade-red.svg)](./docs/SECURITY_CHECKLIST.md)
[![Status](https://img.shields.io/badge/Status-Under%20Development-orange?style=for-the-badge)](https://github.com/anubissbe/threat-modeling-platform)

> 🚀 Enterprise-grade threat modeling platform supporting multiple methodologies (STRIDE, PASTA, LINDDUN, VAST, DREAD) with AI-powered threat suggestions, visual DFD editor, and comprehensive security features.

## 📊 Project Status (as of 2025-07-08)

```
Architecture Design    ████████████████████ 100%
Database Schema       ████████████████████ 100%
Auth Service          ████████████████████ 100% ✅ OPERATIONAL
API Gateway           ████████████████████ 100% ✅ OPERATIONAL
Core Service          ████████████████████ 100% ✅ OPERATIONAL
Diagram Service       ████████████████████ 100% ✅ OPERATIONAL
AI Service            ████████████████████ 100% ✅ OPERATIONAL
Report Service        ████████████████████ 100% ✅ OPERATIONAL
Integration Service   ████████████████████ 100% ✅ OPERATIONAL
Notification Service  ████████████████████ 100% ✅ IMPLEMENTED
Frontend UI           ████████████████████ 100% ✅ OPERATIONAL
Infrastructure        ████████████████████ 100% ✅ OPERATIONAL
Testing Suite         ████████████░░░░░░░░  60%
Documentation         ████████░░░░░░░░░░░░  40%
```

### ✅ Current Status - FULL STACK ENTERPRISE PLATFORM COMPLETE
- **17 of 17 services implemented**: All backend services + frontend + complete infrastructure + monitoring stack + integration service + notification service
- **Frontend**: React application containerized and running on port 3006 with production nginx
- **Backend Services**: Auth, Core, AI, Diagram, Report, Integration, Notification Services + API Gateway (all healthy)
- **Infrastructure**: PostgreSQL, Redis, RabbitMQ, MinIO, Elasticsearch (all operational)
- **Monitoring Stack**: Prometheus metrics collection, Grafana dashboards, Adminer DB UI
- **AI-Powered Analysis**: AI Service with threat analysis, risk assessment, and intelligent suggestions
- **Search Functionality**: Elasticsearch with threat model indexing for advanced search
- **Visual Diagrams**: DFD editor with canvas rendering and export capabilities
- **Report Generation**: HTML, JSON, PDF generation with comprehensive CRUD management
- **Database**: Complete schema (21 tables) with search indexing
- **Full Stack Ready**: Complete enterprise-grade threat modeling platform with frontend, backend, and infrastructure

## 🎯 Overview

A comprehensive threat modeling application that democratizes security analysis by making it accessible to both security professionals and developers. The platform combines traditional methodologies with modern AI capabilities to identify, assess, and mitigate security threats throughout the software development lifecycle.

### 🔑 Key Features

#### ✅ Implemented
- **Multi-Methodology Support**: STRIDE, PASTA, LINDDUN, VAST, DREAD, and Trike
- **Visual DFD Editor**: Drag-and-drop interface with trust boundary visualization
- **AI-Powered Threat Suggestions**: ML-based threat prediction with MITRE ATT&CK integration
- **Authentication & Authorization**: JWT-based auth with RBAC (currently has token refresh issues)
- **API Gateway**: Request routing and service orchestration
- **Frontend Application**: Complete React UI with Material-UI components
- **Database Schema**: PostgreSQL with pgvector for AI embeddings
- **External Integrations**: GitHub, Jira, GitLab, Azure DevOps with webhook support
- **Integration Service**: OAuth2 authentication, rate limiting, and bidirectional sync
- **Notification Service**: Multi-channel notifications (email, Slack, Teams, SMS, webhooks)

#### ❌ Not Yet Implemented
- **Real-time Collaboration**: WebSocket-based multi-user editing
- **TMAC (Threat Modeling as Code)**: YAML/JSON-based definitions

## 🏗️ Architecture

The platform follows a microservices architecture with the following components:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Frontend      │────▶│   API Gateway   │────▶│  Auth Service   │
│  (React/TS)     │     │   (Port 3000)   │     │  (Port 3001)    │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    ▼                         ▼
           ┌─────────────────┐       ┌─────────────────┐
           │  Core Service   │       │   AI Service    │
           │  (Port 3002)    │       │  (Port 3003)    │
           └─────────────────┘       └─────────────────┘
                    │
      ┌─────────────┴─────────────┬─────────────────┬─────────────────┬─────────────────┐
      ▼                           ▼                 ▼                 ▼                 ▼
┌─────────────────┐     ┌─────────────────┐ ┌──────────────────┐ ┌──────────────────┐ ┌─────────────────┐
│ Diagram Service │     │ Report Service  │ │Integration Service│ │Notification Service│ │ Infrastructure  │
│  (Port 3004)    │     │  (Port 3005)    │ │  (Port 3008)     │ │  (Port 3009)     │ │   Services      │
└─────────────────┘     └─────────────────┘ └──────────────────┘ └──────────────────┘ └─────────────────┘
```

## 🚀 Quick Start

### Prerequisites
- Docker and Docker Compose
- Node.js 20+
- Git

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/anubissbe/threat-modeling-platform.git
cd threat-modeling-platform
```

2. **Set up environment variables**
```bash
cp .env.example .env
cp .env.security.example .env.security
# Edit .env files with your configuration
```

3. **Start infrastructure services**
```bash
# Currently only starts PostgreSQL, Redis, and Auth Service
docker-compose up -d postgres redis auth-service
```

4. **Run the frontend** (backend services need implementation)
```bash
cd frontend
npm install
npm run dev
```

5. **Access the application**
- Frontend: http://localhost:5173
- API Gateway: http://localhost:3000 (when implemented)
- Auth Service: http://localhost:3001

## 🛠️ Development

### Current Working Services

| Service | Port | Status | Health |
|---------|------|--------|---------|
| PostgreSQL | 5432 | ✅ Running | Healthy |
| Redis | 6379 | ✅ Running | Healthy |
| Auth Service | 3001 | ⚠️ Running | Unhealthy (JWT issues) |
| API Gateway | 3000 | ✅ Implemented | Not deployed |
| Frontend | 5173 | ✅ Implemented | Dev mode only |

### Services Needing Implementation

| Service | Port | Purpose | Status |
|---------|------|---------|--------|
| Notification Service | - | Alerts and notifications | ❌ Not implemented |

### Infrastructure Services Not Running

| Service | Port | Purpose |
|---------|------|---------|
| Elasticsearch | 9200 | Search functionality |
| MinIO | 9000/9001 | Object storage |
| RabbitMQ | 5672/15672 | Message queue |
| Prometheus | 9090 | Metrics collection |
| Grafana | 3030 | Monitoring dashboards |

## 📁 Project Structure

```
threat-modeling-platform/
├── backend/
│   ├── gateway/            # ✅ API Gateway (just created)
│   ├── services/
│   │   ├── ai/            # ✅ AI-powered threat suggestions
│   │   ├── auth/          # ✅ Authentication service
│   │   ├── core/          # ❌ Core business logic (empty)
│   │   ├── diagram/       # ❌ DFD editor backend (empty)
│   │   ├── integration/   # ❌ External integrations (empty)
│   │   ├── notification/  # ❌ Notification service (empty)
│   │   ├── reporting/     # ❌ Report generation (empty)
│   │   └── threat-engine/ # ⚠️ Threat modeling engine (partial)
│   └── shared/            # Shared utilities
├── frontend/              # ✅ React application
├── docs/                  # Documentation
├── tests/                 # Test suites
└── docker-compose.yml     # Docker configuration
```

## 🧪 Testing

```bash
# Frontend tests
cd frontend
npm test
npm run test:coverage

# Backend tests (when services are implemented)
cd backend/services/<service-name>
npm test
```

## 🔒 Security

The platform implements enterprise-grade security:
- JWT authentication with refresh tokens (has issues)
- Role-based access control (RBAC)
- Data encryption at rest and in transit
- Comprehensive audit logging
- Input validation and sanitization
- Rate limiting and DDoS protection

## 📚 Documentation

- [Architecture Overview](./docs/architecture/system-architecture.md)
- [API Documentation](./docs/api/)
- [Security Checklist](./docs/SECURITY_CHECKLIST.md)
- [Development Guide](./docs/DEVELOPMENT.md)
- [Deployment Guide](./docs/DEPLOYMENT.md)

## 🤝 Contributing

This project is currently under active development. Key areas needing work:

1. **Backend Service Implementation**
   - Core Service (projects, threat models)
   - Diagram Service (DFD editor backend)
   - Report Service (report generation)

2. **Infrastructure Setup**
   - Fix Auth Service JWT refresh issues
   - Start Elasticsearch, MinIO, RabbitMQ
   - Configure monitoring stack

3. **Testing & Documentation**
   - Implement missing tests
   - Complete API documentation
   - Add deployment guides

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- OWASP for threat modeling methodologies
- MITRE for ATT&CK framework
- The open-source security community

---

**Note**: This project is under active development. Many features are not yet implemented. See [PROJECT_STATE.md](PROJECT_STATE.md) for detailed status.