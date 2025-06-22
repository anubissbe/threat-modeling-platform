# Integration Service

API Gateway and service orchestration service for the threat modeling application. This service acts as the central entry point for all client requests and manages communication between microservices.

## Features

### Core Functionality
- **API Gateway**: Single entry point for all client requests with dynamic routing
- **Service Discovery**: Automatic registration and discovery of microservices
- **Load Balancing**: Multiple strategies (round-robin, least connections, weighted)
- **Circuit Breaker**: Fault tolerance and failure detection
- **Health Monitoring**: Real-time service health checks and metrics
- **Service Communication**: Inter-service communication with retry and timeout handling

### Security & Performance
- **Authentication & Authorization**: JWT-based auth with role-based access control
- **Rate Limiting**: Per-user and global rate limiting
- **CORS Protection**: Configurable cross-origin resource sharing
- **Security Headers**: Helmet.js integration for security headers
- **Request/Response Logging**: Comprehensive logging and monitoring

### Monitoring & Operations
- **System Health Endpoints**: Health checks and status monitoring
- **Metrics Collection**: Performance metrics and statistics
- **Circuit Breaker Status**: Real-time circuit breaker monitoring
- **Load Balancer Stats**: Load distribution and performance metrics
- **Swagger Documentation**: API documentation (development mode)

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Client Apps   │───▶│ Integration      │───▶│   Auth Service  │
│                 │    │ Service          │    │                 │
└─────────────────┘    │ (API Gateway)    │    └─────────────────┘
                       │                  │    
                       │ ┌──────────────┐ │    ┌─────────────────┐
                       │ │Service       │ │───▶│  User Service   │
                       │ │Discovery     │ │    │                 │
                       │ └──────────────┘ │    └─────────────────┘
                       │                  │    
                       │ ┌──────────────┐ │    ┌─────────────────┐
                       │ │Load Balancer │ │───▶│Project Service  │
                       │ └──────────────┘ │    │                 │
                       │                  │    └─────────────────┘
                       │ ┌──────────────┐ │    
                       │ │Circuit       │ │    ┌─────────────────┐
                       │ │Breaker       │ │───▶│ Threat Engine   │
                       │ └──────────────┘ │    │                 │
                       │                  │    └─────────────────┘
                       │ ┌──────────────┐ │    
                       │ │Monitoring    │ │    
                       │ │Service       │ │    
                       │ └──────────────┘ │    
                       └──────────────────┘    
```

## Components

### Service Discovery
- Automatic service registration and deregistration
- Health check monitoring with configurable intervals
- Service availability tracking
- Dynamic service routing updates

### Load Balancer
- **Round Robin**: Equal distribution across healthy instances
- **Least Connections**: Route to instance with fewest active connections
- **Weighted**: Route based on configured instance weights
- Connection tracking and capacity management

### Circuit Breaker
- Configurable failure thresholds and timeouts
- Automatic state transitions (Closed → Open → Half-Open)
- Fallback mechanism for failed requests
- Recovery detection and circuit closing

### Monitoring Service
- Request/response metrics collection
- Error rate and performance tracking
- System-wide health reporting
- Performance alerts and notifications

### API Gateway
- Dynamic route registration based on discovered services
- Authentication and authorization middleware
- Rate limiting per service and user
- Request proxying with timeout and retry handling

## Configuration

Environment variables:

```bash
# Server Configuration
NODE_ENV=development
PORT=3005
HOST=0.0.0.0

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-here
JWT_ACCESS_TOKEN_TTL=3600

# Service URLs
AUTH_SERVICE_URL=http://localhost:3001
USER_SERVICE_URL=http://localhost:3002
PROJECT_SERVICE_URL=http://localhost:3003
THREAT_ENGINE_URL=http://localhost:3004

# Redis Configuration
REDIS_URL=redis://localhost:6379

# CORS Configuration
CORS_ORIGINS=http://localhost:3000

# Logging
LOG_LEVEL=info

# Service Discovery
SERVICE_DISCOVERY_ENABLED=true
HEALTH_CHECK_INTERVAL=30000

# Rate Limiting
RATE_LIMIT_MAX=1000
RATE_LIMIT_WINDOW=60000

# Proxy Configuration
PROXY_TIMEOUT=30000
PROXY_RETRIES=3
```

## API Endpoints

### Management Endpoints

#### System Health
```
GET /system/health
```
Returns overall system health status including service availability and performance metrics.

#### Service Discovery
```
GET /system/services
```
Returns list of registered services with health status and summary statistics.

#### System Metrics
```
GET /system/metrics
```
Returns comprehensive system and service metrics including request counts, error rates, and response times.

#### Circuit Breaker Status
```
GET /system/circuit-breakers
```
Returns status of all circuit breakers including states and failure statistics.

#### Load Balancer Status
```
GET /system/load-balancer
```
Returns load balancer statistics including strategy and instance distribution.

### Gateway Routes

All service routes are dynamically registered based on discovered services:

- `/api/auth/*` → Auth Service
- `/api/users/*` → User Service  
- `/api/projects/*` → Project Service
- `/api/threats/*` → Threat Engine

## Installation

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. Build the service:
```bash
npm run build
```

4. Start the service:
```bash
# Development
npm run dev

# Production
npm start
```

## Development

### Scripts

```bash
npm run dev         # Start in development mode with hot reload
npm run build       # Build TypeScript to JavaScript
npm run start       # Start production server
npm test            # Run tests
npm run test:watch  # Run tests in watch mode
npm run test:coverage # Run tests with coverage
npm run lint        # Run ESLint
npm run lint:fix    # Fix ESLint issues
npm run typecheck   # Type checking without compilation
```

### Testing

The service includes comprehensive tests:

- **Unit Tests**: Individual component testing
- **Integration Tests**: Component interaction testing
- **API Tests**: HTTP endpoint testing

Run tests:
```bash
npm test
```

Generate coverage report:
```bash
npm run test:coverage
```

### API Documentation

In development mode, Swagger documentation is available at:
```
http://localhost:3005/docs
```

## Deployment

### Docker

Build and run with Docker:

```bash
# Build image
docker build -t threat-modeling/integration-service .

# Run container
docker run -p 3005:3005 \
  -e NODE_ENV=production \
  -e JWT_SECRET=your-secret \
  threat-modeling/integration-service
```

### Docker Compose

```yaml
version: '3.8'
services:
  integration-service:
    build: .
    ports:
      - "3005:3005"
    environment:
      - NODE_ENV=production
      - JWT_SECRET=your-secret-key
      - REDIS_URL=redis://redis:6379
    depends_on:
      - redis
      - auth-service
      - user-service
      - project-service
      - threat-engine
```

## Monitoring

### Health Checks

The service provides multiple levels of health checking:

1. **Service Health**: Individual service availability
2. **System Health**: Overall system status
3. **Component Health**: Internal component status

### Metrics

Key metrics tracked:

- Request count and rate
- Error count and rate
- Response time (average, p95, p99)
- Service availability
- Circuit breaker states
- Load balancer distribution

### Logging

Structured logging with different levels:

- **Error**: System errors and failures
- **Warn**: Performance issues and alerts
- **Info**: System events and operations
- **Debug**: Detailed debugging information

### Alerts

Automatic alerts for:

- High error rates (>10% system-wide, >20% per service)
- Slow response times (>5s system-wide, >10s per service)
- Low service availability (<80%)
- Circuit breaker activations

## Performance

### Optimizations

- Connection pooling for HTTP requests
- Request caching for frequently accessed data
- Circuit breaker for fast failure
- Load balancing for optimal resource utilization
- Monitoring with minimal overhead

### Benchmarks

Target performance metrics:

- **Response Time**: <100ms for health checks, <500ms for proxied requests
- **Throughput**: 1000+ requests/second
- **Availability**: 99.9% uptime
- **Error Rate**: <1% under normal conditions

## Security

### Features

- JWT token validation
- Role-based access control
- Rate limiting per user and endpoint
- CORS protection
- Security headers (CSP, XSS protection, etc.)
- Request/response logging for audit

### Best Practices

- Secrets management via environment variables
- No sensitive data in logs
- Regular security header updates
- Input validation and sanitization
- Secure error handling (no stack traces in production)

## Troubleshooting

### Common Issues

1. **Service Discovery Failures**
   - Check service URLs and health endpoints
   - Verify network connectivity
   - Review service registration logs

2. **Circuit Breaker Activation**
   - Check downstream service health
   - Review error rates and thresholds
   - Monitor service response times

3. **Load Balancer Issues**
   - Verify healthy service instances
   - Check load balancing strategy configuration
   - Review connection counts and capacity

4. **Authentication Failures**
   - Verify JWT secret configuration
   - Check token expiration settings
   - Review authentication logs

### Debug Mode

Enable debug logging:
```bash
LOG_LEVEL=debug npm run dev
```

### Health Check Commands

Check individual components:
```bash
# System health
curl http://localhost:3005/system/health

# Service status
curl http://localhost:3005/system/services

# Metrics
curl http://localhost:3005/system/metrics
```

## Contributing

1. Follow TypeScript and ESLint configurations
2. Write tests for new features
3. Update documentation
4. Follow conventional commit messages
5. Ensure all tests pass before submitting

## License

MIT License - see LICENSE file for details.