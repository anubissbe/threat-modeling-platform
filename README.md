# 🛡️ Threat Modeling Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![CI/CD Pipeline](https://github.com/anubissbe/threat-modeling-platform/actions/workflows/ci.yml/badge.svg)](https://github.com/anubissbe/threat-modeling-platform/actions)
[![Security Scan](https://github.com/anubissbe/threat-modeling-platform/actions/workflows/security.yml/badge.svg)](https://github.com/anubissbe/threat-modeling-platform/actions)
[![Code Quality](https://github.com/anubissbe/threat-modeling-platform/actions/workflows/quality.yml/badge.svg)](https://github.com/anubissbe/threat-modeling-platform/actions)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg)](https://hub.docker.com/r/threatmodeling/platform)
[![Node.js](https://img.shields.io/badge/Node.js-20.x-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.x-61dafb.svg)](https://reactjs.org/)

## 🚀 Overview

An enterprise-grade threat modeling platform that democratizes security analysis by supporting multiple methodologies (STRIDE, PASTA, LINDDUN, VAST, DREAD) with AI-powered features. This platform transforms threat modeling from a manual, expert-driven process into an accessible, automated workflow integrated with modern DevSecOps practices.

### 🎯 Key Features

- **Multi-Methodology Support**: STRIDE, PASTA, LINDDUN, VAST, DREAD, OCTAVE, and custom methodologies
- **AI-Powered Analysis**: Automated threat suggestions, risk scoring, and mitigation recommendations
- **Visual DFD Editor**: Intuitive drag-and-drop interface for creating data flow diagrams
- **Threat Modeling as Code (TMAC)**: Version-controlled threat models with CI/CD integration
- **Real-time Collaboration**: Multiple users can work on threat models simultaneously
- **Enterprise Integrations**: Jira, Azure DevOps, GitHub, GitLab, and vulnerability scanners
- **Compliance Reporting**: Generate reports for ISO 27001, NIST, GDPR, and other frameworks
- **Role-Based Access Control**: Fine-grained permissions with SSO/SAML support

## 📋 Table of Contents

- [Architecture](#-architecture)
- [Getting Started](#-getting-started)
- [Development](#-development)
- [API Documentation](#-api-documentation)
- [Testing](#-testing)
- [Deployment](#-deployment)
- [Security](#-security)
- [Contributing](#-contributing)
- [License](#-license)

## 🏗️ Architecture

The platform follows a microservices architecture designed for scalability and maintainability:

```
┌─────────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
│   Web Client        │     │   Mobile Client     │     │   CLI Tool          │
│   (React/TS)        │     │   (React Native)    │     │   (Node.js)         │
└──────────┬──────────┘     └──────────┬──────────┘     └──────────┬──────────┘
           │                           │                           │
           └───────────────────────────┴───────────────────────────┘
                                      │
                          ┌───────────▼────────────┐
                          │    API Gateway        │
                          │  (Load Balancing)     │
                          └───────────┬────────────┘
                                      │
        ┌─────────────────────────────┴─────────────────────────────┐
        │                                                           │
┌───────▼────────┐  ┌──────▼──────┐  ┌──────▼──────┐  ┌──────▼──────┐
│ Auth Service   │  │Core Service │  │ AI Service  │  │Report Service│
│ (JWT/SSO)      │  │(Business)   │  │(ML Models)  │  │(PDF/HTML)    │
└────────────────┘  └─────────────┘  └─────────────┘  └──────────────┘
```

### Tech Stack

- **Backend**: Node.js with TypeScript, Express, Apollo GraphQL
- **Frontend**: React with TypeScript, Material-UI, Redux Toolkit
- **Database**: PostgreSQL with pgvector extension
- **Cache**: Redis
- **Search**: Elasticsearch
- **Message Queue**: RabbitMQ
- **Storage**: MinIO (S3-compatible)
- **AI/ML**: Python services with TensorFlow/PyTorch
- **Container**: Docker & Kubernetes
- **Monitoring**: Prometheus & Grafana

## 🚀 Getting Started

### Prerequisites

- Docker Desktop (20.10+)
- Node.js (20.x)
- Python (3.11+)
- Git

### Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/anubissbe/threat-modeling-platform.git
   cd threat-modeling-platform
   ```

2. **Set up environment**
   ```bash
   make setup
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start the platform**
   ```bash
   make up
   ```

5. **Access the application**
   - Frontend: http://localhost:3006
   - API Gateway: http://localhost:3000
   - API Documentation: http://localhost:3000/docs

### First-Time Setup

After starting the platform:

1. Create an admin account
2. Configure your organization
3. Set up integrations (optional)
4. Create your first project

## 💻 Development

### Project Structure

```
threat-modeling-platform/
├── backend/
│   ├── gateway/          # API Gateway
│   └── services/         # Microservices
│       ├── auth/         # Authentication service
│       ├── core/         # Core business logic
│       ├── ai/           # AI/ML service
│       ├── diagram/      # Diagram processing
│       └── reporting/    # Report generation
├── frontend/             # React application
├── docs/                 # Documentation
│   ├── api/             # API specifications
│   └── architecture/    # Architecture docs
├── infrastructure/       # Deployment configs
└── scripts/             # Utility scripts
```

### Development Commands

```bash
# Start development environment
make dev

# Run specific service
make auth-shell

# View logs
make logs service=auth-service

# Run tests
make test

# Lint code
make lint

# Reset database
make db-reset
```

### Code Style

We use:
- ESLint for JavaScript/TypeScript
- Black for Python
- Prettier for formatting

## 📚 API Documentation

### REST API

The platform provides a comprehensive REST API documented with OpenAPI 3.0:

- Specification: [`docs/api/openapi-spec.yaml`](docs/api/openapi-spec.yaml)
- Interactive docs: http://localhost:3000/api-docs

### GraphQL API

For complex queries and real-time updates:

- Schema: [`docs/api/graphql-schema.graphql`](docs/api/graphql-schema.graphql)
- Playground: http://localhost:3000/graphql

### WebSocket

Real-time collaboration features use WebSocket connections:

```javascript
const ws = new WebSocket('ws://localhost:3000');
ws.on('threat.created', (threat) => {
  // Handle new threat
});
```

## 🧪 Testing

### Running Tests

```bash
# All tests
make test

# Unit tests only
npm run test:unit

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e
```

### Test Coverage

We maintain >80% code coverage:

```bash
npm run test:coverage
```

## 🚀 Deployment

### Docker Deployment

```bash
# Build production images
make build-prod

# Deploy with Docker Compose
docker-compose -f docker-compose.prod.yml up -d
```

### Kubernetes Deployment

```bash
# Apply Kubernetes manifests
kubectl apply -f infrastructure/kubernetes/

# Check deployment status
kubectl get pods -n threat-modeling
```

### Cloud Deployment

We support deployment to:
- AWS EKS
- Google GKE
- Azure AKS
- On-premises Kubernetes

See [`docs/deployment/`](docs/deployment/) for detailed guides.

## 🔒 Security

### Security Features

- **Authentication**: JWT with refresh tokens, SSO/SAML support
- **Authorization**: Role-based access control (RBAC)
- **Encryption**: TLS 1.3 for transit, AES-256 for storage
- **Audit Logging**: Comprehensive activity tracking
- **Security Headers**: OWASP recommended headers
- **Input Validation**: Strict validation on all inputs
- **Rate Limiting**: API rate limiting per user/IP

### Reporting Security Issues

Please see our [Security Policy](SECURITY.md) for reporting vulnerabilities.

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md).

### Development Workflow

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code of Conduct

Please read our [Code of Conduct](CODE_OF_CONDUCT.md) before contributing.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- OWASP for threat modeling methodologies
- MITRE for ATT&CK framework
- The open-source community for amazing tools and libraries

## 📞 Support

- 📧 Email: support@threatmodeling.io
- 💬 Discord: [Join our community](https://discord.gg/threatmodeling)
- 📖 Documentation: [docs.threatmodeling.io](https://docs.threatmodeling.io)
- 🐛 Issues: [GitHub Issues](https://github.com/anubissbe/threat-modeling-platform/issues)

---

Built with ❤️ by the Threat Modeling Platform Team