# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned
- Core threat modeling engine implementation
- Visual threat model editor with drag-and-drop
- AI-powered threat suggestions and analysis
- Real-time collaboration features
- Integration with external security tools

## [0.1.0] - 2024-06-15

### Added - Core Foundation Complete
- **Authentication Service**: Production-ready JWT authentication with:
  - Role-based access control (RBAC) with 5 user roles
  - Secure password hashing with bcrypt
  - Automatic token refresh mechanism
  - Rate limiting and brute force protection
  - SSO infrastructure (SAML, OAuth2 ready)
  - Comprehensive security middleware
  - Health checks and monitoring
  - Docker containerization with multi-stage builds
- **React Frontend**: Professional web application with:
  - Material-UI design system with custom theme
  - Redux Toolkit for state management
  - React Router v6 with protected routes
  - Authentication flow with automatic token refresh
  - Responsive dashboard with metrics and activity feed
  - Project management interface with search/filter
  - Threat models management with methodology support
  - Notification system with toast messages
  - Comprehensive form validation using React Hook Form and Zod
- **TypeScript Infrastructure**: Complete project setup with:
  - NPM workspaces for monorepo management
  - Individual package.json for each service
  - Strict TypeScript configuration
  - ESLint and Prettier for code quality
  - Jest (backend) and Vitest (frontend) testing setup
- **Development Environment**: Production-grade setup with:
  - Docker development environment
  - GitHub Actions CI/CD pipelines with security scanning
  - Professional documentation and README files
  - Comprehensive environment configuration

### Architecture & Design
- **System Architecture**: Comprehensive microservices design with 12 services
- **Database Design**: PostgreSQL schema supporting multiple threat modeling methodologies
- **API Specifications**: Complete REST (OpenAPI 3.0) and GraphQL schemas
- **Security Design**: Enterprise-grade security with multiple layers of protection

### Documentation
- Complete system architecture documentation
- Database design with ERD diagrams
- API specifications (REST and GraphQL)
- Individual service documentation (auth service, frontend)
- Development environment setup guide
- Contributing guidelines and security policy
- Professional README with comprehensive setup instructions

### Security Features
- Content Security Policy (CSP) headers
- HTTP Strict Transport Security (HSTS)
- Input validation and sanitization
- SQL injection prevention with parameterized queries
- XSS protection with CSP and input encoding
- Rate limiting on authentication endpoints
- Secure session management with JWT rotation

### Technical Stack
- **Backend**: Node.js with TypeScript, Express, PostgreSQL
- **Frontend**: React 18 with TypeScript, Material-UI, Redux Toolkit
- **Database**: PostgreSQL with pgvector extension
- **Authentication**: JWT with secure refresh token rotation
- **Testing**: Jest (backend), Vitest (frontend), React Testing Library
- **Containerization**: Docker with security-hardened multi-stage builds

## [0.0.1] - 2024-06-15

### Added
- Initial project setup
- Basic project structure
- README with project overview
- Development environment configuration

[Unreleased]: https://github.com/anubissbe/threat-modeling-platform/compare/v0.0.1...HEAD
[0.0.1]: https://github.com/anubissbe/threat-modeling-platform/releases/tag/v0.0.1