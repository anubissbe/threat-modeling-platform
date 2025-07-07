# 🛡️ Threat Modeling Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.2-61dafb.svg)](https://reactjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ed.svg)](https://www.docker.com/)
[![Security](https://img.shields.io/badge/Security-Enterprise%20Grade-red.svg)](./docs/SECURITY_CHECKLIST.md)
[![Status](https://img.shields.io/badge/Status-Under%20Development-orange?style=for-the-badge)](https://github.com/anubissbe/threat-modeling-platform)

> 🚀 Enterprise-grade threat modeling platform supporting multiple methodologies (STRIDE, PASTA, LINDDUN, VAST, DREAD) with AI-powered threat suggestions, visual DFD editor, and comprehensive security features.

## 📊 Project Status

```
Architecture Design    ████████████████████ 100%
Core Backend          ████████████████████ 100%
Auth Service          ████████████████████ 100%
Threat Engine         ████████████████████ 100%
Frontend UI           ████████████████████ 100%
Security Hardening    ████████████████████ 100%
Testing Suite         ████████░░░░░░░░░░░░  40%
Real-time Collab      ░░░░░░░░░░░░░░░░░░░░   0%
AI Integration        ████████░░░░░░░░░░░░  40%
Documentation         ████████████░░░░░░░░  60%
```

## 🎯 Overview

A comprehensive threat modeling application that democratizes security analysis by making it accessible to both security professionals and developers. The platform combines traditional methodologies with modern AI capabilities to identify, assess, and mitigate security threats throughout the software development lifecycle.

### 🔑 Key Features

#### ✅ Implemented
- **Multi-Methodology Support**: STRIDE, PASTA, LINDDUN, VAST, DREAD, and Trike
- **Visual DFD Editor**: Drag-and-drop interface with trust boundary visualization
- **Core Threat Engine**: Automated threat identification based on selected methodology
- **Authentication & Authorization**: JWT-based auth with RBAC, SSO support (SAML/OIDC ready)
- **Enterprise Security**: Comprehensive security hardening with encryption, audit logging, and compliance features
- **Project Management**: Complete CRUD operations for projects and threat models
- **Real-time Updates**: WebSocket-based architecture for collaborative features (infrastructure ready)

#### 🚧 In Progress
- **AI-Powered Suggestions**: ML-based threat prediction and mitigation recommendations
- **Real-time Collaboration**: Multi-user editing with conflict resolution
- **TMAC (Threat Modeling as Code)**: YAML/JSON-based threat model definitions
- **External Integrations**: Jira, Azure DevOps, GitHub, vulnerability scanners
- **Comprehensive Testing**: Unit, integration, and E2E test suites
- **Advanced Reporting**: Customizable reports with compliance mappings

## 🏗️ Architecture

### System Overview
```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Frontend (React + TypeScript)                  │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐  ┌──────────────┐ │
│  │ DFD Editor  │  │ Threat Panel │  │  Projects   │  │   Reports    │ │
│  └─────────────┘  └──────────────┘  └─────────────┘  └──────────────┘ │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │ HTTPS
┌────────────────────────────────┴────────────────────────────────────────┐
│                         API Gateway (Express)                            │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ Security Middleware: Auth, Rate Limit, Encryption, Audit, CORS   │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
┌────────────────────────────────┴────────────────────────────────────────┐
│                          Microservices Layer                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │Auth Service  │  │Threat Engine │  │Project Mgmt  │  │AI Service  │ │
│  │JWT/SSO/RBAC  │  │Methodologies │  │CRUD/Sharing  │  │ML Models   │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └────────────┘ │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
┌────────────────────────────────┴────────────────────────────────────────┐
│                           Data Layer                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │ PostgreSQL   │  │    Redis     │  │Elasticsearch │  │   MinIO    │ │
│  │(Primary DB)  │  │(Cache/Queue) │  │(Search/Logs) │  │(File Store)│ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

## 🚀 Quick Start

### Prerequisites
- Node.js 20+ 
- Docker & Docker Compose
- PostgreSQL 15+
- Redis 7+
- Git

### 🐳 Docker Deployment (Recommended)

```bash
# 1. Clone the repository
git clone https://github.com/anubissbe/threat-modeling-platform.git
cd threat-modeling-platform

# 2. Configure environment
cp .env.example .env
cp .env.security.example .env.security
# Edit both .env files with your credentials

# 3. Start all services
docker-compose up -d

# 4. Access the application
# Frontend: http://localhost:3000
# API: http://localhost:3001
# Swagger Docs: http://localhost:3001/api-docs
```

### 🛠️ Local Development

```bash
# 1. Install dependencies
npm install

# 2. Set up databases
docker-compose up -d postgres redis

# 3. Run migrations
npm run migrate

# 4. Start development servers
npm run dev

# Frontend: http://localhost:5173
# Backend: http://localhost:3001
```

## ⚙️ Configuration

### Security Configuration (Required for Production)

Create `.env.security` file:

```env
# Critical Security Settings
MASTER_ENCRYPTION_KEY=<32+ character random key>
SESSION_SECRET=<secure random secret>
JWT_SECRET=<secure random secret>
JWT_REFRESH_SECRET=<different secure secret>

# Enable Security Features
MFA_ENABLED=true
SECURITY_MONITORING_ENABLED=true
DETAILED_AUDIT_LOGGING=true
GDPR_COMPLIANCE_ENABLED=true

# See .env.security.example for complete list
```

## 🔒 Security Features

### Implemented Security Controls

#### 1. **Authentication & Authorization**
- JWT-based authentication with refresh tokens
- Role-Based Access Control (RBAC)
- Multi-Factor Authentication (backend ready)
- SSO support (SAML 2.0, OIDC)
- Strong password policies
- Session management

#### 2. **Data Protection**
- AES-256-GCM encryption for sensitive data
- Field-level encryption with decorators
- Data classification system (PUBLIC to TOP_SECRET)
- Encrypted storage and transmission
- Secure key management

#### 3. **Security Monitoring**
- Real-time threat detection
- Brute force protection
- Injection attempt detection
- Anomaly detection
- Automated IP blocking
- Security event dashboard

#### 4. **Audit & Compliance**
- Comprehensive audit logging
- GDPR compliance features
- Data retention policies
- Consent management
- Right to erasure support

#### 5. **Input Security**
- SQL injection prevention
- XSS protection
- NoSQL injection prevention
- File upload validation
- Request size limiting

See [Security Checklist](./docs/SECURITY_CHECKLIST.md) for complete details.

## 🧪 Testing

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit
npm run test:integration
npm run test:security
npm run test:e2e

# Coverage report
npm run test:coverage
```

## 📁 Project Structure

```
threat-modeling-platform/
├── backend/
│   ├── services/
│   │   ├── auth/          # Authentication service
│   │   ├── threat-engine/ # Core threat modeling engine
│   │   ├── projects/      # Project management
│   │   └── ai/           # AI/ML service
│   └── shared/           # Shared utilities
├── frontend/
│   ├── src/
│   │   ├── components/   # React components
│   │   ├── pages/        # Page components
│   │   ├── services/     # API services
│   │   └── store/        # Redux store
│   └── public/           # Static assets
├── docs/                 # Documentation
├── scripts/              # Build/deployment scripts
└── docker-compose.yml    # Docker configuration
```

## 🔧 Technology Stack

### Backend
- **Node.js + TypeScript**: Core runtime
- **Express.js**: Web framework
- **PostgreSQL**: Primary database
- **Redis**: Caching and queues
- **JWT**: Authentication
- **Passport.js**: Auth strategies
- **Winston**: Logging

### Frontend
- **React 18**: UI framework
- **TypeScript**: Type safety
- **Material-UI**: Component library
- **Redux Toolkit**: State management
- **React Flow**: DFD editor
- **Vite**: Build tool

### Infrastructure
- **Docker**: Containerization
- **Kubernetes**: Orchestration (production)
- **Prometheus/Grafana**: Monitoring
- **Elasticsearch**: Search and logs
- **MinIO**: Object storage

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

### Development Setup

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes and add tests
4. Ensure all tests pass: `npm test`
5. Submit a pull request

### Code Standards
- TypeScript strict mode
- ESLint + Prettier formatting
- 90%+ test coverage for new code
- Security-first development

## 📋 Roadmap

### Current Sprint (January 2025)
- [x] Security hardening implementation
- [ ] Complete testing suite
- [ ] Real-time collaboration features
- [ ] Enhanced AI threat suggestions

### Q1 2025
- [ ] TMAC (Threat Modeling as Code)
- [ ] External tool integrations
- [ ] Advanced reporting engine
- [ ] Performance optimization

### Q2 2025
- [ ] Mobile application
- [ ] Advanced ML models
- [ ] Compliance automation
- [ ] Enterprise features

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- OWASP Threat Modeling community
- STRIDE methodology creators at Microsoft
- Open source security tools community
- All contributors and testers

## 📞 Support

- 📧 **Email**: support@threatmodeling.com
- 🐛 **Issues**: [GitHub Issues](https://github.com/anubissbe/threat-modeling-platform/issues)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/anubissbe/threat-modeling-platform/discussions)
- 📚 **Documentation**: [Project Wiki](https://github.com/anubissbe/threat-modeling-platform/wiki)

---

<div align="center">
  <strong>Built with ❤️ for the security community</strong>
  <br>
  <em>Making threat modeling accessible to everyone</em>
</div>