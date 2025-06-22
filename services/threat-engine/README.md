# Threat Modeling Engine Service

The Threat Modeling Engine is a comprehensive threat analysis service that implements multiple threat modeling methodologies including STRIDE and PASTA. It provides automated threat identification, risk assessment, and mitigation recommendations for application architectures.

## Features

### Core Analysis Engines
- **STRIDE Engine**: Comprehensive STRIDE methodology implementation
- **PASTA Engine**: Complete 7-stage PASTA (Process for Attack Simulation and Threat Analysis) methodology
- **Pattern Matching**: Threat pattern matching with customizable rules
- **DREAD Calculator**: Risk scoring using DREAD methodology
- **Mitigation Engine**: Automated mitigation recommendation generation

### Analysis Capabilities
- Multi-methodology threat analysis (STRIDE/PASTA)
- Component-based threat identification
- Data flow analysis
- Risk assessment and scoring
- Threat deduplication and consolidation
- Confidence scoring for all threats
- Comprehensive mitigation recommendations

### Security Features
- JWT-based authentication
- Role-based access control
- Rate limiting
- Request/response logging
- Audit trail for all analysis activities
- Input validation and sanitization

## Quick Start

### Prerequisites
- Node.js 18+ and npm
- PostgreSQL 15+ (for data persistence)
- Redis (for caching)

### Installation

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Run database migrations (if using database)
npm run migrate

# Start development server
npm run dev

# Start production server
npm run start
```

### Environment Variables

```bash
NODE_ENV=development
PORT=3004
HOST=0.0.0.0

# JWT Configuration
JWT_SECRET=your-jwt-secret-key
JWT_ACCESS_TOKEN_TTL=3600

# Database (if using persistence)
DATABASE_URL=postgresql://user:password@localhost:5432/threat_engine

# Redis (for caching)
REDIS_URL=redis://localhost:6379

# CORS Configuration
CORS_ORIGINS=http://localhost:3000,http://localhost:3001

# Logging
LOG_LEVEL=info
```

## API Documentation

### Core Endpoints

#### Analyze Threat Model
```http
POST /api/analyze
Content-Type: application/json
Authorization: Bearer <token>

{
  "threatModelId": "model-123",
  "methodology": "STRIDE",
  "components": [
    {
      "id": "comp-1",
      "name": "Web Server",
      "type": "process",
      "properties": {
        "internetFacing": true,
        "protocols": ["http", "https"],
        "authentication": ["oauth2"],
        "sensitive": false
      }
    }
  ],
  "dataFlows": [],
  "options": {
    "enablePatternMatching": true,
    "enableDreadScoring": true
  }
}
```

#### Analyze Single Component
```http
POST /api/analyze/component
Content-Type: application/json

{
  "component": {
    "id": "db-1",
    "name": "User Database",
    "type": "data_store",
    "properties": {
      "sensitive": true,
      "encryption": ["at_rest"],
      "authentication": ["database_auth"]
    }
  },
  "methodology": "STRIDE"
}
```

#### Get Available Patterns
```http
GET /api/patterns
```

#### Generate Mitigations
```http
POST /api/mitigations
Content-Type: application/json

{
  "threats": [...],
  "components": [...]
}
```

### Response Format

```json
{
  "success": true,
  "data": {
    "threatModelId": "model-123",
    "methodology": "STRIDE",
    "threats": [
      {
        "id": "threat-1",
        "title": "SQL Injection Attack",
        "description": "Web application vulnerable to SQL injection",
        "category": "tampering",
        "severity": "high",
        "riskScore": 15,
        "affectedComponents": ["comp-1"],
        "attackVectors": [
          {
            "vector": "Malicious SQL queries through user input",
            "complexity": "medium",
            "mitigations": ["Use parameterized queries"]
          }
        ],
        "confidence": 0.85
      }
    ],
    "riskAssessment": {
      "overallRiskScore": 12.5,
      "riskLevel": "high",
      "riskDistribution": {
        "critical": 0,
        "high": 3,
        "medium": 5,
        "low": 2
      }
    },
    "mitigationRecommendations": [...],
    "analysisMetadata": {
      "timestamp": "2024-01-15T10:30:00Z",
      "processingTime": 1250,
      "totalThreats": 10,
      "confidence": 0.82
    }
  }
}
```

## Architecture

### Component Structure
```
src/
├── engines/           # Analysis engines
│   ├── stride.engine.ts
│   └── pasta.engine.ts
├── services/          # Business logic services
│   ├── threat-analysis.service.ts
│   ├── pattern-matcher.ts
│   ├── dread-calculator.ts
│   └── mitigation-engine.ts
├── routes/            # API routes
│   ├── analysis.routes.ts
│   └── index.ts
├── middleware/        # Express middleware
│   └── auth.middleware.ts
├── types/             # TypeScript type definitions
│   └── index.ts
├── utils/             # Utility functions
│   ├── helpers.ts
│   └── logger.ts
├── config/            # Configuration
│   └── index.ts
└── app.ts            # Application setup
```

### Analysis Flow

1. **Request Validation**: Validate threat model components and configuration
2. **Methodology Selection**: Route to appropriate analysis engine (STRIDE/PASTA)
3. **Core Analysis**: Execute methodology-specific threat identification
4. **Pattern Enhancement**: Apply pattern matching for additional threats
5. **Risk Calculation**: Calculate DREAD scores and risk assessments
6. **Deduplication**: Remove duplicate and similar threats
7. **Mitigation Generation**: Generate targeted mitigation recommendations
8. **Response Assembly**: Compile comprehensive analysis response

## Methodologies

### STRIDE Analysis
- **Spoofing**: Identity verification threats
- **Tampering**: Data integrity threats
- **Repudiation**: Non-repudiation threats
- **Information Disclosure**: Confidentiality threats
- **Denial of Service**: Availability threats
- **Elevation of Privilege**: Authorization threats

### PASTA Analysis
1. **Define Objectives**: Business and security objectives
2. **Define Technical Scope**: Technology and architecture scope
3. **Application Decomposition**: Component and service analysis
4. **Threat Analysis**: Comprehensive threat identification
5. **Weakness Analysis**: Vulnerability and gap analysis
6. **Attack Modeling**: Attack scenario development
7. **Risk Impact Analysis**: Business impact assessment

### Pattern Matching
- **Rule-based Patterns**: Predefined threat patterns
- **Custom Patterns**: User-defined threat patterns
- **Confidence Scoring**: Pattern match confidence
- **Dynamic Updates**: Runtime pattern additions

## Testing

### Unit Tests
```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test suite
npm test -- stride.engine.test.ts
```

### Integration Tests
```bash
# Run integration tests
npm run test:integration

# Test specific endpoint
npm run test:integration -- --grep "analyze threat model"
```

### Load Testing
```bash
# Install artillery (if not installed)
npm install -g artillery

# Run load tests
npm run test:load
```

## Development

### Adding New Threat Patterns

```typescript
import { ThreatPattern, ThreatCategory } from '../types';

const customPattern: ThreatPattern = {
  id: 'custom-web-vuln',
  name: 'Custom Web Vulnerability',
  category: ThreatCategory.TAMPERING,
  applicableComponents: ['process'],
  conditions: [
    {
      type: 'component_property',
      property: 'properties.protocols',
      operator: 'contains',
      value: 'http',
      weight: 0.6
    }
  ],
  threatTemplate: {
    title: 'Custom Threat: {component}',
    description: 'Custom vulnerability in {component}',
    // ... threat details
  },
  confidence: 0.75
};

// Add pattern to engine
patternMatcher.addPattern(customPattern);
```

### Custom Analysis Engine

```typescript
import { AnalysisEngine, ThreatAnalysisRequest, ThreatAnalysisResponse } from '../types';

export class CustomEngine implements AnalysisEngine {
  async analyze(request: ThreatAnalysisRequest): Promise<ThreatAnalysisResponse> {
    // Implement custom analysis logic
    const threats = await this.identifyThreats(request.components);
    const riskAssessment = await this.assessRisk(threats);
    
    return {
      threatModelId: request.threatModelId,
      methodology: 'CUSTOM',
      threats,
      riskAssessment,
      // ... response data
    };
  }
}
```

## Performance

### Optimization Features
- **Caching**: Redis-based caching for patterns and results
- **Parallel Processing**: Concurrent component analysis
- **Streaming**: Large dataset streaming support
- **Rate Limiting**: API rate limiting and throttling

### Performance Metrics
- **Analysis Speed**: ~100ms per component
- **Throughput**: 1000+ requests/minute
- **Memory Usage**: <200MB typical
- **Cache Hit Rate**: >80% for common patterns

## Security Considerations

### Data Protection
- All sensitive data encrypted in transit and at rest
- No persistent storage of threat model data by default
- Audit logging for all analysis activities
- Input sanitization and validation

### Access Control
- JWT-based authentication required
- Role-based access control (RBAC)
- Organization-level data isolation
- API rate limiting per user/organization

### Deployment Security
- HTTPS/TLS required in production
- Security headers via Helmet.js
- CORS protection
- Environment variable security

## Monitoring and Logging

### Audit Events
- Analysis started/completed/failed
- Threat identification events
- Risk calculation events
- Pattern matching events
- User authentication/authorization
- Performance metrics

### Health Monitoring
```http
GET /health
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "engines": {
    "stride": "available",
    "pasta": "available",
    "patternMatcher": "available"
  }
}
```

## Troubleshooting

### Common Issues

#### Analysis Fails with Validation Error
- Check component structure matches schema
- Verify all required fields are present
- Ensure methodology is supported

#### Low Confidence Scores
- Review component property completeness
- Check pattern matching configuration
- Validate security requirement specifications

#### Performance Issues
- Enable caching for repeat analyses
- Reduce pattern matching scope
- Optimize component connection mapping

### Debug Mode
```bash
# Enable debug logging
LOG_LEVEL=debug npm run dev

# View detailed processing steps
curl -H "Authorization: Bearer $TOKEN" \
     http://localhost:3004/api/analyze \
     -d @threat-model.json
```

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

### Development Guidelines
- Follow TypeScript best practices
- Write comprehensive tests
- Update documentation
- Follow security guidelines
- Use conventional commits

## License

This project is licensed under the MIT License - see the LICENSE file for details.