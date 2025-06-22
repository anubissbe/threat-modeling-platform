# Project Service

The Project Service is a core microservice in the threat modeling application that manages projects, threat models, and collaboration features. It provides comprehensive CRUD operations, version control, and role-based access control.

## Task 2.3 Completion Status: ✅ COMPLETE

### Features Implemented

#### 1. Project Management
- **Full CRUD Operations**: Create, read, update, delete projects
- **Project Metadata**: Industry, criticality levels, compliance tracking
- **Project Settings**: Collaboration modes, notifications, auto-save
- **Project Statistics**: Threat model counts, collaborator counts
- **Soft Delete**: Projects are soft-deleted for audit trail
- **Access Control**: Integration with collaboration service for permissions

#### 2. Threat Model Management
- **Complete Lifecycle**: Create, update, delete threat models
- **Multiple Methodologies**: STRIDE, PASTA, VAST, TRIKE, OCTAVE, LINDDUN, CUSTOM
- **Version Control**: Semantic versioning with change tracking
- **Content Management**: System descriptions, components, data flows, threats, mitigations
- **Status Tracking**: Draft, review, approved, rejected, archived
- **Access Control**: Project-based permissions with collaboration service

#### 3. Collaboration Features
- **Role-Based Access**: Owner, Admin, Editor, Reviewer, Viewer roles
- **Granular Permissions**: Read, write, comment, review, approve, manage, delete
- **Invitation System**: Invite users with specific roles and permissions
- **Activity Tracking**: Last active timestamps for collaborators
- **Permission Checks**: Comprehensive permission validation for all operations

#### 4. Version Control System
- **Semantic Versioning**: Major.minor.patch with optional tags
- **Change Tracking**: Metadata about what changed between versions
- **Version History**: Complete history of all threat model versions
- **Diff Analysis**: Automatic detection of changes between versions
- **Review Requirements**: Configurable review requirements for changes

#### 5. Technical Architecture
- **Fastify Framework**: High-performance Node.js web framework
- **PostgreSQL Database**: Robust relational database with JSON support
- **TypeScript**: Full type safety and excellent developer experience
- **Comprehensive Types**: Detailed interfaces for all data structures
- **Audit Logging**: Detailed logging of all user actions
- **Error Handling**: Comprehensive error handling with proper HTTP status codes
- **Security**: Rate limiting, CORS, Helmet security headers

#### 6. Database Integration
- **Connection Pooling**: Efficient database connection management
- **Query Helpers**: Utility functions for common database operations
- **Transaction Support**: Atomic operations for complex workflows
- **Pagination**: Built-in pagination support for large datasets
- **Full-Text Search**: PostgreSQL full-text search capabilities
- **Bulk Operations**: Efficient bulk insert and update operations

#### 7. API Design
- **RESTful Routes**: Well-designed REST API endpoints
- **OpenAPI Ready**: Structured for easy OpenAPI documentation
- **Request Validation**: Input validation and sanitization
- **Response Formatting**: Consistent API response structure
- **Error Responses**: Standardized error response format
- **Health Checks**: Comprehensive health check endpoints

#### 8. Testing Framework
- **Jest Configuration**: Complete testing setup
- **Unit Tests**: Service layer unit tests with mocking
- **Route Tests**: HTTP endpoint testing with Fastify
- **Mock Services**: Comprehensive mocking of dependencies
- **Test Coverage**: Structured for high test coverage

## Directory Structure

```
services/project-service/
├── src/
│   ├── app.ts                    # Fastify application setup
│   ├── index.ts                  # Server entry point
│   ├── config/
│   │   └── index.ts              # Configuration management
│   ├── database/
│   │   └── index.ts              # Database connection and helpers
│   ├── routes/
│   │   ├── projects.routes.ts    # Project management routes
│   │   ├── threat-models.routes.ts # Threat model routes
│   │   └── health.routes.ts      # Health check routes
│   ├── services/
│   │   ├── project.service.ts    # Project business logic
│   │   ├── threat-model.service.ts # Threat model business logic
│   │   └── collaboration.service.ts # Collaboration business logic
│   ├── types/
│   │   └── index.ts              # Comprehensive type definitions
│   └── utils/
│       ├── helpers.ts            # Utility functions
│       └── logger.ts             # Logging and audit utilities
├── tests/
│   ├── setup.ts                  # Test configuration
│   ├── services/
│   │   └── project.service.test.ts # Service unit tests
│   └── routes/
│       └── projects.routes.test.ts # Route integration tests
├── package.json                  # Dependencies and scripts
├── tsconfig.json                 # TypeScript configuration
├── jest.config.js                # Jest testing configuration
└── README.md                     # This documentation
```

## API Endpoints

### Project Management
- `POST /api/v1/projects` - Create new project
- `GET /api/v1/projects/:projectId` - Get project by ID
- `PATCH /api/v1/projects/:projectId` - Update project
- `DELETE /api/v1/projects/:projectId` - Delete project
- `GET /api/v1/projects` - List projects with filtering
- `GET /api/v1/projects/:projectId/stats` - Get project statistics

### Collaboration
- `POST /api/v1/projects/:projectId/collaborators` - Add collaborator
- `PATCH /api/v1/projects/:projectId/collaborators/:userId` - Update collaborator
- `DELETE /api/v1/projects/:projectId/collaborators/:userId` - Remove collaborator
- `GET /api/v1/projects/:projectId/collaborators` - List collaborators
- `POST /api/v1/projects/:projectId/collaborators/accept` - Accept invitation
- `POST /api/v1/projects/:projectId/activity` - Update activity timestamp

### Threat Model Management
- `POST /api/v1/projects/:projectId/threat-models` - Create threat model
- `GET /api/v1/threat-models/:threatModelId` - Get threat model
- `PATCH /api/v1/threat-models/:threatModelId` - Update threat model
- `DELETE /api/v1/threat-models/:threatModelId` - Delete threat model
- `GET /api/v1/threat-models` - List threat models
- `GET /api/v1/projects/:projectId/threat-models` - List project threat models

### Version Control
- `GET /api/v1/threat-models/:threatModelId/versions` - Get all versions
- `GET /api/v1/threat-models/:threatModelId/versions/:versionId` - Get specific version
- `POST /api/v1/threat-models/:threatModelId/versions` - Create new version

### Health Checks
- `GET /health` - Basic health status
- `GET /health/detailed` - Detailed health with dependencies
- `GET /ready` - Readiness probe
- `GET /live` - Liveness probe

## Key Data Models

### Project
- Complete project metadata with settings and compliance tracking
- Support for multiple visibility levels (private, organization, public)
- Flexible tagging and categorization system
- Audit trail with creation and modification tracking

### Threat Model
- Support for all major threat modeling methodologies
- Comprehensive content structure for threats, mitigations, components
- Status workflow from draft to approved
- Version control with semantic versioning

### Collaboration
- Role-based access control with five distinct roles
- Granular permission system for fine-grained access control
- Invitation and acceptance workflow
- Activity tracking for user engagement

### Version Control
- Complete version history with parent-child relationships
- Change metadata tracking additions, removals, modifications
- Configurable review requirements based on change type
- Support for tags and pre-release versions

## Configuration

The service uses environment variables for configuration:

```bash
# Server Configuration
PORT=3003
HOST=0.0.0.0
NODE_ENV=development

# Database Configuration
DATABASE_URL=postgresql://mcp_user:mcp_secure_password_2024@localhost:5432/mcp_learning

# Security Configuration
JWT_SECRET=your-jwt-secret
CORS_ORIGINS=http://localhost:3000,http://localhost:8080

# Rate Limiting
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=60000
```

## Development

### Prerequisites
- Node.js 18+
- PostgreSQL 15+
- npm or yarn

### Setup
```bash
# Install dependencies
npm install

# Build the service
npm run build

# Run in development mode
npm run dev

# Run tests
npm test

# Run linting
npm run lint
```

### Database Setup
The service expects a PostgreSQL database with the threat modeling schema. Refer to the database migration scripts in the main project for schema setup.

## Integration

This service integrates with:
- **Authentication Service**: For user authentication and JWT verification
- **User Service**: For user information and organization management
- **Collaboration features**: Built-in role and permission management
- **PostgreSQL Database**: For data persistence and complex queries
- **Redis Cache**: For session management and performance optimization

## Security Features

- **Authentication**: JWT token validation on all endpoints
- **Authorization**: Role-based access control with permission checks
- **Rate Limiting**: Configurable rate limiting to prevent abuse
- **Input Validation**: Comprehensive input validation and sanitization
- **Audit Logging**: Detailed logging of all user actions
- **CORS Protection**: Configurable CORS settings for web security
- **Security Headers**: Helmet.js for security headers

## Performance Features

- **Connection Pooling**: Efficient database connection management
- **Pagination**: Built-in pagination for large datasets
- **Caching Ready**: Structured for Redis caching integration
- **Bulk Operations**: Optimized bulk insert and update operations
- **Query Optimization**: Efficient database queries with proper indexing
- **Async Operations**: Non-blocking asynchronous operations throughout

## Error Handling

- **Structured Errors**: Consistent error response format
- **HTTP Status Codes**: Proper HTTP status codes for all scenarios
- **Error Logging**: Comprehensive error logging for debugging
- **Validation Errors**: Detailed validation error messages
- **Database Errors**: Proper handling of database constraint violations
- **Permission Errors**: Clear permission denied messages

## Monitoring and Observability

- **Health Checks**: Multiple health check endpoints for different purposes
- **Audit Logging**: Comprehensive audit trail for all operations
- **Performance Logging**: Database query performance logging
- **Error Tracking**: Structured error logging for monitoring systems
- **Metrics Ready**: Structured for Prometheus metrics integration

## Task 2.3 Deliverables ✅

All planned deliverables for Task 2.3 have been completed:

1. ✅ **Complete Service Architecture** - Fastify-based microservice with proper structure
2. ✅ **Project Management** - Full CRUD operations with metadata and settings
3. ✅ **Threat Model Management** - Complete lifecycle with multiple methodologies
4. ✅ **Collaboration System** - Role-based access with granular permissions
5. ✅ **Version Control** - Semantic versioning with change tracking
6. ✅ **Database Integration** - PostgreSQL with connection pooling and helpers
7. ✅ **API Design** - RESTful endpoints with proper validation
8. ✅ **Security Implementation** - Authentication, authorization, and audit logging
9. ✅ **Testing Framework** - Jest configuration with unit and integration tests
10. ✅ **Documentation** - Comprehensive README and inline documentation

## Next Steps

Task 2.3 is complete. The next task in the development workflow is:

**Task 2.4: Core Threat Modeling Engine (32 hours)**
- Implement STRIDE methodology engine
- Add DREAD risk calculation
- Create threat pattern matching
- Build mitigation recommendations

The project service provides the foundation for threat model management that will be enhanced by the threat modeling engine.