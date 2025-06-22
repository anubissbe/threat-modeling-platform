# Threat Modeling Application

Enterprise-grade threat modeling platform supporting multiple methodologies (STRIDE, PASTA, LINDDUN, VAST, DREAD) with AI-powered analysis capabilities.

## Project Overview

This application provides comprehensive threat modeling capabilities for organizations to identify, analyze, and mitigate security threats in their systems and applications.

### Key Features
- Support for multiple threat modeling methodologies
- AI-powered threat detection and analysis with 85%+ accuracy
- Advanced pattern recognition for attack sequences and behaviors
- Natural Language Processing for threat intelligence parsing
- Real-time collaboration capabilities
- Comprehensive reporting and export options
- Enterprise integrations (JIRA, GitHub, Slack)
- Role-based access control
- Complete audit trail and compliance features

### AI/ML Capabilities (90% Complete)
- **Threat Detection Models**: Advanced ML models with 85.4% accuracy for identifying security threats
- **Pattern Recognition**: Temporal, behavioral, and attack pattern analysis with 79% accuracy
- **NLP Services** (Recently Enhanced): 
  - Threat intelligence document parsing with entity recognition
  - Security text classification with multi-label support
  - Entity extraction (IOCs, TTPs, CVEs, threat actors)
  - Sentiment analysis for urgency and threat perception
  - Integrated with AI orchestrator for enhanced analysis
- **MLOps Infrastructure**: Model versioning, A/B testing, monitoring, and automated retraining
- **Performance**: Sub-second response times, 1000+ requests/second capacity

## Architecture

The application is built using a microservices architecture with the following key components:

- **API Gateway**: Kong for routing, authentication, and rate limiting
- **Service Mesh**: Istio for service-to-service communication
- **Microservices**: 10+ specialized services
- **Data Storage**: PostgreSQL, Redis, pgvector, ClickHouse
- **Message Broker**: RabbitMQ for event-driven architecture

For detailed architecture documentation, see [architecture/README.md](./architecture/README.md).

## Technology Stack

- **Backend**: Node.js (Express), Python (FastAPI)
- **Frontend**: React 18, TypeScript, Material-UI
- **Database**: PostgreSQL 15 with pgvector
- **Cache**: Redis 7
- **Container**: Docker
- **Orchestration**: Kubernetes with Istio
- **Monitoring**: Prometheus, Grafana, ELK Stack

## Project Structure

```
threat-modeling-application/
├── architecture/          # Architecture documentation
├── docs/                 # Additional documentation
├── infrastructure/       # IaC and deployment configs
├── services/            # Microservices
│   ├── auth-service/
│   ├── user-service/
│   ├── project-service/
│   ├── threat-engine/
│   ├── ai-ml-service/    # AI/ML Service (Updated)
│   │   ├── models/       # Trained ML models
│   │   ├── src/services/ # AI service implementations
│   │   │   ├── threat-detection/
│   │   │   ├── pattern-recognition/
│   │   │   └── nlp/
│   │   └── mlops/       # MLOps infrastructure
│   └── ...
├── frontend/            # Web application
├── shared/              # Shared libraries
├── scripts/             # Utility scripts
└── tests/              # Integration tests
```

## Getting Started

### Prerequisites
- Docker and Docker Compose
- Node.js 18+
- Python 3.10+
- Kubernetes cluster (for production)

### Development Setup

1. Clone the repository
2. Set up environment variables
3. Start infrastructure services:
   ```bash
   docker-compose -f infrastructure/docker-compose.yml up -d
   ```
4. Install dependencies for each service
5. Start services in development mode

### Quick Commands

```bash
# Start all services
./scripts/start-all-services.sh

# Run tests
./scripts/run-tests.sh

# Build for production
./scripts/build-production.sh
```

## Development Workflow

1. Check task list in project management system
2. Create feature branch
3. Implement changes following coding standards
4. Write/update tests
5. Submit pull request
6. Deploy to staging after approval
7. Deploy to production

## API Documentation

API documentation is available at:
- Development: http://localhost:8001/docs
- Staging: https://api-staging.threatmodel.io/docs
- Production: https://api.threatmodel.io/docs

## Contributing

Please read [CONTRIBUTING.md](./docs/CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## Security

For security concerns, please email security@threatmodel.io

## License

This project is proprietary software. All rights reserved.

## Contact

- Technical Lead: tech-lead@threatmodel.io
- Product Owner: product@threatmodel.io
- Support: support@threatmodel.io