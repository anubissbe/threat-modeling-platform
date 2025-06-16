# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned
- Visual threat model editor with drag-and-drop
- Enhanced AI-powered threat suggestions and analysis
- Real-time collaboration features
- Integration with external security tools
- TMAC (Threat Modeling as Code) implementation

## [0.2.0] - 2024-06-16

### Added - Core Threat Modeling Engine
- **Core Service Implementation**: Complete threat modeling engine with TypeScript
  - Project management service with CRUD operations and statistics
  - Threat model service with validation, cloning, and version control
  - Comprehensive threat service with full lifecycle management
  - Mitigation tracking and effectiveness analysis
  
- **Threat Analysis Features**:
  - Multi-methodology support (STRIDE, PASTA, LINDDUN, VAST, DREAD)
  - AI-powered threat suggestions (basic implementation)
  - Risk scoring and prioritization algorithms
  - Threat-to-mitigation mapping
  
- **API Endpoints**:
  - `/api/projects` - Full project management with filtering and pagination
  - `/api/threat-models` - Threat model CRUD with validation and cloning
  - `/api/threats` - Threat management with filtering and mitigations
  - `/api/methodologies` - Methodology information and recommendations
  - `/api/health` - Service health monitoring with detailed checks
  
- **Validation & Security**:
  - Zod schema validation for all endpoints
  - Request validation middleware
  - Rate limiting for resource-intensive operations
  - Role-based access control integration

- **Type System**:
  - Comprehensive TypeScript types for all domain models
  - Methodology-specific type extensions (STRIDE, PASTA, LINDDUN)
  - Request/Response type interfaces
  - Express type augmentation for custom properties

### Technical Improvements
- Database connection pooling with PostgreSQL
- Structured logging with winston
- Error handling middleware with detailed error responses
- Health check endpoints with database connectivity monitoring
- Async request handlers with proper error propagation

## [0.3.0] - 2024-06-16

### Added - Visual Threat Model Editor
- **Complete Visual Editor**: Full-featured drag-and-drop interface for threat modeling
  - Custom Canvas API implementation with HTML5 Canvas
  - Drag-and-drop component creation and positioning
  - Real-time connection creation between elements
  - Pan, zoom, and grid functionality
  - Visual selection and hover feedback

- **Component Palette**: 13 pre-defined threat modeling elements
  - **Actors**: User, Administrator, Threat Actor
  - **Systems**: Process, Web Server, API, Mobile App
  - **Data Stores**: Database, Cache, File Storage
  - **Infrastructure**: Firewall, Load Balancer, External System
  - Organized by category with descriptive tooltips

- **Properties Panel**: Comprehensive element configuration
  - **General Tab**: Name, trust boundary, description, technologies
  - **Security Tab**: Authentication, encryption, controls, compliance
  - **Threats Tab**: Threat creation and management per element
  - Real-time updates with immediate visual feedback

- **Threat Panel**: Advanced threat analysis interface
  - Statistics dashboard with threat metrics
  - Search and filter capabilities by category and severity
  - STRIDE/PASTA/LINDDUN methodology support
  - Click-to-navigate between threats and elements
  - Inline threat editing and mitigation tracking

- **Redux Integration**: Complete state management
  - Editor slice with actions for nodes, connections, threats
  - Canvas state management (zoom, pan, selection)
  - Undo/redo infrastructure (foundation)
  - Optimistic updates with error handling

### Technical Features
- TypeScript strict mode implementation
- Material-UI integration for consistent design
- Custom Canvas rendering engine (no external dependencies)
- Responsive design for various screen sizes
- Keyboard shortcuts support
- Context menus for quick actions

### User Experience
- Intuitive drag-and-drop interface
- Visual feedback for all interactions
- Contextual property editing
- Threat-to-element navigation
- Professional toolbar with common operations
- Floating action buttons for quick access

### Integration
- Seamless routing integration with existing app
- Connected to threat models list page
- Mock data integration for demonstration
- Prepared for API integration

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