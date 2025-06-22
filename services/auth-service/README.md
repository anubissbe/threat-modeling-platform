# Authentication Service

## Overview

The Authentication Service is a core microservice in the Threat Modeling Application that handles user authentication, authorization, session management, and multi-factor authentication (MFA). Built with Node.js, TypeScript, and Fastify, it provides secure JWT-based authentication with comprehensive security features.

## Features

- **JWT Authentication**: Access and refresh token management
- **Multi-Factor Authentication**: TOTP-based 2FA with backup codes
- **Session Management**: Redis-backed session storage
- **Password Security**: Argon2id hashing with pepper
- **Rate Limiting**: Protection against brute force attacks
- **Account Security**: Account lockout after failed attempts
- **Role-Based Access Control**: RBAC with permissions
- **Security Monitoring**: Comprehensive security event logging

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   API Gateway   │────▶│  Auth Service   │────▶│   PostgreSQL    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │                          ▲
                               ▼                          │
                        ┌─────────────────┐              │
                        │     Redis       │──────────────┘
                        └─────────────────┘
```

## Prerequisites

- Node.js 18+
- PostgreSQL 15+ with pgvector extension
- Redis 7+
- Docker (for containerized deployment)

## Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd services/auth-service
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
| `PORT` | Service port | `8080` |
| `DATABASE_URL` | PostgreSQL connection string | - |
| `REDIS_URL` | Redis connection string | - |
| `JWT_SECRET` | Secret for JWT signing (min 32 chars) | - |
| `JWT_ACCESS_TOKEN_TTL` | Access token lifetime | `15m` |
| `JWT_REFRESH_TOKEN_TTL` | Refresh token lifetime | `7d` |
| `PASSWORD_PEPPER` | Password hashing pepper (min 16 chars) | - |
| `MFA_ISSUER` | TOTP issuer name | `ThreatModel.io` |

See `.env.example` for complete list.

## API Endpoints

### Authentication

- `POST /auth/login` - User login
- `POST /auth/logout` - User logout
- `POST /auth/refresh` - Refresh access token
- `POST /auth/mfa/verify` - Verify MFA token

### User Management

- `GET /users/me` - Get current user profile
- `PUT /users/me` - Update user profile
- `POST /users/me/password` - Change password
- `POST /users/me/mfa/setup` - Setup MFA
- `POST /users/me/mfa/confirm` - Confirm MFA setup
- `DELETE /users/me/mfa` - Disable MFA
- `GET /users/me/sessions` - Get active sessions

### MFA

- `POST /mfa/backup-codes/regenerate` - Generate new backup codes
- `POST /mfa/verify-token` - Verify TOTP token
- `GET /mfa/status` - Get MFA status
- `DELETE /mfa/setup` - Cancel MFA setup
- `GET /mfa/qr-code` - Get QR code for MFA

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

# E2E tests
npm run test:e2e
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

## Security Features

### Password Security
- Argon2id hashing with configurable parameters
- Password pepper for additional security
- Password complexity validation
- Common pattern detection

### Account Security
- Account lockout after configurable failed attempts
- Session management across devices
- Token blacklisting on logout
- Security event logging

### MFA Implementation
- TOTP (Time-based One-Time Password)
- Backup codes for recovery
- QR code generation for easy setup
- Token window tolerance for clock skew

### Rate Limiting
- Per-IP rate limiting on auth endpoints
- Configurable limits and windows
- Bypass for successful requests (optional)

## Monitoring

The service exposes health and metrics endpoints:

- `/health/status` - Comprehensive health check
- `/health/metrics` - Prometheus-compatible metrics
- Structured JSON logging
- Security event tracking

## Deployment

### Docker

```bash
# Build image
docker build -t auth-service .

# Run container
docker run -p 8080:8080 --env-file .env auth-service
```

### Kubernetes

```bash
# Apply manifests
kubectl apply -f k8s/

# Check deployment
kubectl get pods -l app=auth-service
```

## API Documentation

When running in development mode, OpenAPI documentation is available at:
- `http://localhost:8080/docs`

## Troubleshooting

### Common Issues

1. **Database connection errors**:
   - Ensure PostgreSQL is running
   - Check DATABASE_URL format
   - Verify network connectivity

2. **Redis connection errors**:
   - Ensure Redis is running
   - Check REDIS_URL format
   - Verify authentication credentials

3. **JWT errors**:
   - Ensure JWT_SECRET is set
   - Check token expiration
   - Verify token format

### Debug Mode

Enable debug logging:
```bash
LOG_LEVEL=debug npm run dev
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.