# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial architecture design and documentation
- Comprehensive system architecture with microservices design
- Database schema supporting multiple threat modeling methodologies
- REST API specification (OpenAPI 3.0)
- GraphQL schema for complex queries and subscriptions
- Docker development environment with 12 services
- Professional repository structure and documentation

### Architecture
- Microservices: Auth, Core, AI, Diagram, Reporting services
- Databases: PostgreSQL (main), Redis (cache), Elasticsearch (search), MinIO (files)
- Message Queue: RabbitMQ for async operations
- API Gateway: Centralized entry point with authentication
- Real-time: WebSocket support for collaboration

### Documentation
- System architecture documentation
- Database design documentation
- API specifications (REST and GraphQL)
- Development environment setup guide
- Contributing guidelines
- Security policy

## [0.0.1] - 2025-06-15

### Added
- Initial project setup
- Basic project structure
- README with project overview
- Development environment configuration

[Unreleased]: https://github.com/anubissbe/threat-modeling-platform/compare/v0.0.1...HEAD
[0.0.1]: https://github.com/anubissbe/threat-modeling-platform/releases/tag/v0.0.1