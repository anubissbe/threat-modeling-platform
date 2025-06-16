# Core Threat Modeling Service

The core service is the heart of the threat modeling platform, providing comprehensive threat modeling capabilities with support for multiple methodologies.

## Overview

This service handles:
- Project management and organization
- Threat model creation and lifecycle management
- Threat identification, analysis, and mitigation tracking
- Multi-methodology support (STRIDE, PASTA, LINDDUN, VAST, DREAD)
- AI-powered threat suggestions
- Risk scoring and prioritization

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Core Service                        │
├─────────────────────────────────────────────────────────┤
│  Routes           │  Services         │  Data Access    │
├───────────────────┼───────────────────┼─────────────────┤
│ • /projects       │ • ProjectService  │ • PostgreSQL    │
│ • /threat-models  │ • ThreatModel     │ • Connection    │
│ • /threats        │   Service         │   Pooling       │
│ • /methodologies  │ • ThreatService   │ • Transactions  │
│ • /health         │ • Validation      │ • Type Safety   │
└───────────────────┴───────────────────┴─────────────────┘
```

## API Endpoints

### Projects
- `GET /api/projects` - List projects with filtering and pagination
- `POST /api/projects` - Create new project
- `GET /api/projects/:id` - Get project details
- `PUT /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project (soft delete)
- `GET /api/projects/:id/statistics` - Get project statistics

### Threat Models
- `GET /api/threat-models` - List threat models for a project
- `POST /api/threat-models` - Create new threat model
- `GET /api/threat-models/:id` - Get threat model details
- `PUT /api/threat-models/:id` - Update threat model
- `DELETE /api/threat-models/:id` - Delete threat model
- `POST /api/threat-models/:id/validate` - Validate threat model
- `POST /api/threat-models/:id/clone` - Clone threat model
- `GET /api/threat-models/:id/export` - Export threat model

### Threats
- `GET /api/threats?threatModelId=xxx` - List threats for a threat model
- `POST /api/threats` - Create new threat
- `GET /api/threats/:id` - Get threat details
- `PUT /api/threats/:id` - Update threat
- `DELETE /api/threats/:id` - Delete threat
- `GET /api/threats/:id/mitigations` - Get threat mitigations
- `POST /api/threats/:id/mitigations` - Add mitigation
- `POST /api/threats/suggest` - Get AI-powered threat suggestions

### Methodologies
- `GET /api/methodologies` - List all supported methodologies
- `GET /api/methodologies/:type` - Get methodology details
- `POST /api/methodologies/recommend` - Get methodology recommendation

### Health
- `GET /api/health` - Basic health check
- `GET /api/health/detailed` - Detailed health with dependencies
- `GET /api/health/ready` - Kubernetes readiness probe
- `GET /api/health/live` - Kubernetes liveness probe

## Features

### Multi-Methodology Support
The service supports multiple threat modeling methodologies with specific data structures and analysis approaches:

- **STRIDE**: Spoofing, Tampering, Repudiation, Information Disclosure, DoS, Elevation of Privilege
- **PASTA**: Process for Attack Simulation and Threat Analysis (7-stage process)
- **LINDDUN**: Privacy threat modeling methodology
- **VAST**: Visual, Agile, and Simple Threat modeling
- **DREAD**: Risk rating methodology

### AI-Powered Threat Suggestions
Basic implementation provides methodology-specific threat suggestions based on:
- System architecture and components
- Data flows and trust boundaries
- Asset sensitivity levels
- Actor trust levels

### Risk Scoring
Automatic risk score calculation based on:
- Threat severity (Critical, High, Medium, Low, Info)
- Likelihood (Very High, High, Medium, Low, Very Low)
- Impact analysis
- Mitigation effectiveness

### Validation
Comprehensive validation using Zod schemas ensures data integrity:
- Request body validation
- Type safety
- Business rule enforcement
- Clear error messages

## Development

### Prerequisites
- Node.js 20.x
- PostgreSQL 15+
- TypeScript 5.x

### Setup
```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run development server
npm run dev

# Run tests
npm test
```

### Environment Variables
```env
# Server Configuration
PORT=3002
NODE_ENV=development

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=threat_modeling
DB_USER=threat_user
DB_PASSWORD=your_password

# Security
JWT_SECRET=your_jwt_secret
ALLOWED_ORIGINS=http://localhost:3006

# Logging
LOG_LEVEL=info
```

### Type System
The service uses comprehensive TypeScript types:
- Domain models (Project, ThreatModel, Threat, etc.)
- Request/Response types
- Methodology-specific types
- Validation schemas

### Middleware
- **Authentication**: JWT token validation
- **Authorization**: Role-based access control
- **Error Handling**: Centralized error handling
- **Rate Limiting**: Prevent abuse
- **Request Validation**: Zod schema validation

## Testing

```bash
# Unit tests
npm run test:unit

# Integration tests
npm run test:integration

# Test coverage
npm run test:coverage
```

## Deployment

### Docker
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 3002
CMD ["node", "dist/index.js"]
```

### Health Checks
The service provides comprehensive health checks:
- Database connectivity
- Memory usage monitoring
- Dependency status
- Readiness and liveness probes

## Security Considerations

1. **Authentication**: All endpoints require JWT authentication
2. **Authorization**: Role-based access control enforced
3. **Input Validation**: Strict validation on all inputs
4. **SQL Injection**: Parameterized queries only
5. **Rate Limiting**: Prevents brute force attacks
6. **Audit Logging**: All actions are logged

## Performance

- Connection pooling for database efficiency
- Indexed database queries
- Pagination for large result sets
- Caching strategies (planned)
- Async/await for non-blocking operations

## Future Enhancements

1. **Enhanced AI Integration**: ML models for better threat predictions
2. **Caching Layer**: Redis integration for performance
3. **WebSocket Support**: Real-time updates
4. **Batch Operations**: Bulk threat management
5. **Advanced Analytics**: Threat trends and patterns