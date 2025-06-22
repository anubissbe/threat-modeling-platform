# User Management Service

## Overview

The User Management Service is a microservice in the Threat Modeling Application that manages users, organizations, teams, roles, and permissions. Built with Node.js, TypeScript, and Fastify, it provides comprehensive user management with multi-tenancy support and role-based access control (RBAC).

## Features

- **User Management**: Complete CRUD operations for user accounts
- **Organization Management**: Multi-tenant support with organization isolation
- **Team Management**: Create and manage teams within organizations
- **RBAC System**: Flexible role-based access control with permissions
- **Multi-tenancy**: Complete data isolation between organizations
- **Caching**: Redis-based caching for improved performance
- **Audit Logging**: Comprehensive audit trail for all operations
- **API Documentation**: OpenAPI/Swagger documentation

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   API Gateway   │────▶│   User Service  │────▶│   PostgreSQL    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │                          ▲
                               ▼                          │
                        ┌─────────────────┐              │
                        │     Redis       │──────────────┘
                        └─────────────────┘
                               ▲
                               │
                        ┌─────────────────┐
                        │  Auth Service   │
                        └─────────────────┘
```

## Prerequisites

- Node.js 18+
- PostgreSQL 15+ 
- Redis 7+
- Docker (for containerized deployment)
- Auth Service running on port 8080

## Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd services/user-service
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up environment variables**:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Run database migrations**:
   ```bash
   # Ensure PostgreSQL is running
   npm run migrate
   ```

5. **Start the service**:
   ```bash
   # Development
   npm run dev

   # Production
   npm run build
   npm start
   ```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment (development/production) | `development` |
| `PORT` | Service port | `8081` |
| `DATABASE_URL` | PostgreSQL connection string | - |
| `REDIS_URL` | Redis connection string | - |
| `JWT_SECRET` | Secret for JWT verification (shared with auth-service) | - |
| `AUTH_SERVICE_URL` | URL of authentication service | `http://localhost:8080` |
| `API_KEY` | Internal service communication key | - |
| `DEFAULT_PAGE_SIZE` | Default pagination size | `20` |
| `MAX_PAGE_SIZE` | Maximum allowed page size | `100` |

See `.env.example` for complete list.

## API Endpoints

### Users

- `GET /users` - List users with filtering and pagination
- `GET /users/:userId` - Get user by ID
- `POST /users` - Create new user
- `PUT /users/:userId` - Update user
- `DELETE /users/:userId` - Delete user (soft delete)
- `POST /users/:userId/roles/:roleId` - Assign role to user
- `DELETE /users/:userId/roles/:roleId` - Revoke role from user
- `GET /users/:userId/permissions` - Get user permissions
- `POST /users/:userId/permissions/check` - Check user permission

### Organizations

- `GET /organizations` - List organizations
- `GET /organizations/:orgId` - Get organization by ID
- `POST /organizations` - Create organization
- `PUT /organizations/:orgId` - Update organization
- `DELETE /organizations/:orgId` - Delete organization
- `GET /organizations/:orgId/stats` - Get organization statistics

### Teams

- `GET /teams` - List teams
- `GET /teams/:teamId` - Get team by ID
- `POST /teams` - Create team
- `PUT /teams/:teamId` - Update team
- `DELETE /teams/:teamId` - Delete team
- `POST /teams/:teamId/members` - Add team member
- `DELETE /teams/:teamId/members/:userId` - Remove team member

### Roles

- `GET /roles` - List roles
- `GET /roles/:roleId` - Get role by ID
- `POST /roles` - Create role
- `PUT /roles/:roleId` - Update role
- `DELETE /roles/:roleId` - Delete role

### Permissions

- `GET /permissions` - List permissions
- `GET /permissions/:permissionId` - Get permission by ID
- `POST /permissions/check` - Check permission

### Health

- `GET /health/status` - Service health status
- `GET /health/ready` - Readiness probe
- `GET /health/live` - Liveness probe
- `GET /health/metrics` - Basic metrics

## Development

### Running with Docker Compose

```bash
# Start all dependencies
docker-compose -f docker-compose.dev.yml up -d

# Start the service
npm run dev
```

### Running Tests

```bash
# Unit tests
npm test

# Integration tests
npm run test:integration

# Test coverage
npm run test:coverage
```

### Code Quality

```bash
# Linting
npm run lint

# Type checking
npm run typecheck

# Format code
npm run format
```

## Security

### Authentication
- JWT-based authentication (tokens issued by auth-service)
- Service-to-service authentication via API keys
- Bearer token required for all protected endpoints

### Authorization
- Role-based access control (RBAC)
- Permission-based authorization
- Organization-level data isolation
- Self-or-admin access patterns

### Data Protection
- Passwords hashed with Argon2id
- Sensitive data encryption
- SQL injection prevention
- Input validation and sanitization

## Database Schema

### Users Table
```sql
CREATE TABLE auth.users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    organization_id UUID,
    roles TEXT[],
    permissions TEXT[],
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);
```

### Organizations Table
```sql
CREATE TABLE management.organizations (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    settings JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);
```

### Teams Table
```sql
CREATE TABLE management.teams (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    permissions TEXT[],
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);
```

## Monitoring

The service exposes health and metrics endpoints:

- `/health/status` - Comprehensive health check
- `/health/metrics` - Prometheus-compatible metrics
- Structured JSON logging with correlation IDs
- Audit logging for all data modifications

## Deployment

### Docker

```bash
# Build image
docker build -t user-service .

# Run container
docker run -p 8081:8081 --env-file .env user-service
```

### Kubernetes

```bash
# Apply manifests
kubectl apply -f k8s/

# Check deployment
kubectl get pods -l app=user-service
```

## API Documentation

When running in development mode, OpenAPI documentation is available at:
- `http://localhost:8081/docs`

## Error Codes

| Code | Description |
|------|-------------|
| `USER_NOT_FOUND` | User does not exist |
| `ORGANIZATION_NOT_FOUND` | Organization does not exist |
| `EMAIL_ALREADY_EXISTS` | Email address is already registered |
| `INSUFFICIENT_PERMISSIONS` | User lacks required permissions |
| `ORGANIZATION_LIMIT_REACHED` | Organization has reached user/resource limits |

## Performance Considerations

- Redis caching for frequently accessed data
- Database connection pooling
- Pagination for large datasets
- Indexed database queries
- Efficient permission checking

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.