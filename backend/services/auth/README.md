# Authentication Service

The authentication service handles user authentication, authorization, and session management for the threat modeling platform.

## Features

- **JWT Authentication**: Secure token-based authentication
- **Role-Based Access Control (RBAC)**: Fine-grained permissions
- **Refresh Tokens**: Secure token refresh mechanism
- **Rate Limiting**: Protection against brute force attacks
- **Password Security**: Strong password requirements and bcrypt hashing
- **SSO Support**: SAML and OAuth2 integration ready
- **Session Management**: Multiple session support with logout all functionality
- **Security Headers**: Comprehensive security middleware
- **Health Checks**: Kubernetes-ready health endpoints

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `POST /api/auth/refresh` - Token refresh
- `POST /api/auth/logout` - Single session logout
- `POST /api/auth/logout-all` - All sessions logout

### User Management
- `GET /api/auth/profile` - Get current user profile
- `GET /api/auth/users/:userId` - Get user by ID (admin only)
- `PATCH /api/auth/users/:userId/role` - Update user role (admin only)

### Health Checks
- `GET /health` - Basic health check
- `GET /health/detailed` - Detailed health with dependencies
- `GET /health/ready` - Readiness probe (Kubernetes)
- `GET /health/live` - Liveness probe (Kubernetes)

## User Roles

- **ADMIN**: Full system access
- **SECURITY_ANALYST**: Security analysis and threat modeling
- **ARCHITECT**: System architecture and design
- **DEVELOPER**: Development and implementation
- **VIEWER**: Read-only access

## Configuration

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

### Required Environment Variables

```env
# Server
PORT=3001
NODE_ENV=development

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=threat_modeling
DB_USER=postgres
DB_PASSWORD=password

# JWT
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_SECRET=your-super-secret-refresh-key
REFRESH_TOKEN_EXPIRES_IN=7d

# CORS
ALLOWED_ORIGINS=http://localhost:3006
```

## Database Schema

The service expects the following database tables:

```sql
-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'viewer',
    organization VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Refresh tokens table
CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    revoked_at TIMESTAMP
);
```

## Development

### Install Dependencies
```bash
npm install
```

### Development Mode
```bash
npm run dev
```

### Build
```bash
npm run build
```

### Start Production
```bash
npm start
```

### Run Tests
```bash
npm test
npm run test:watch
npm run test:coverage
```

### Linting
```bash
npm run lint
npm run lint:fix
```

### Type Checking
```bash
npm run typecheck
```

## Security Features

### Rate Limiting
- General API: 100 requests per 15 minutes
- Authentication endpoints: 5 attempts per 15 minutes
- Registration: 3 attempts per hour
- Password reset: 3 attempts per hour

### Password Requirements
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character

### JWT Security
- Short-lived access tokens (15 minutes)
- Long-lived refresh tokens (7 days)
- Secure token storage and validation
- Token rotation on refresh

### Headers Security
- Content Security Policy (CSP)
- HTTP Strict Transport Security (HSTS)
- X-Frame-Options
- X-Content-Type-Options
- X-XSS-Protection

## SSO Integration

### SAML Configuration
```env
SAML_ENABLED=true
SAML_ENTITY_ID=your-entity-id
SAML_SSO_URL=https://your-idp.com/sso
SAML_X509_CERTIFICATE=your-certificate
```

### OAuth2 Configuration
```env
OAUTH2_ENABLED=true
OAUTH2_CLIENT_ID=your-client-id
OAUTH2_CLIENT_SECRET=your-client-secret
OAUTH2_REDIRECT_URI=http://localhost:3001/auth/oauth2/callback
```

## Error Handling

The service provides detailed error responses:

```json
{
  "success": false,
  "error": "Invalid credentials",
  "statusCode": 401
}
```

Common error codes:
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (authentication failed)
- `403` - Forbidden (insufficient permissions)
- `409` - Conflict (user already exists)
- `429` - Too Many Requests (rate limited)
- `500` - Internal Server Error

## Monitoring

### Health Checks
The service provides comprehensive health checks for monitoring:

- Basic health: Service status and uptime
- Detailed health: Database and memory checks
- Readiness: Kubernetes readiness probe
- Liveness: Kubernetes liveness probe

### Logging
Structured logging with Winston:
- Request/response logging
- Error tracking with stack traces
- Authentication events
- Rate limiting events

## Docker

Build the service:
```bash
docker build -t threat-modeling/auth-service .
```

Run with Docker Compose:
```bash
docker-compose up auth-service
```