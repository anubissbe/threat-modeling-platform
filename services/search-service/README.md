# Search Service

A comprehensive Elasticsearch-powered search service for the threat modeling application, providing full-text search, analytics, and real-time indexing capabilities.

## Features

- **Full-text Search**: Advanced Elasticsearch queries with custom analyzers for threat modeling content
- **Multi-content Type Search**: Search across threats, projects, threat models, users, files, and reports
- **Auto-complete & Suggestions**: Real-time search suggestions and query auto-completion
- **Search Analytics**: Comprehensive search metrics, popular queries, and user behavior tracking
- **Real-time Indexing**: Kafka-based event streaming for instant content synchronization
- **Advanced Filtering**: Complex filters, facets, and aggregations
- **Security**: JWT authentication, role-based access control, and rate limiting
- **Admin Tools**: Index management, bulk operations, snapshots, and system monitoring

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   API Gateway   │────│   Search Service │────│  Elasticsearch  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │
                                │
                       ┌──────────────────┐
                       │   Kafka Topics   │
                       │  (Real-time)     │
                       └──────────────────┘
```

### Core Components

1. **Search Query Service**: Handles all search operations, filtering, and aggregations
2. **Search Indexer Service**: Manages document indexing, updates, and bulk operations
3. **Index Manager Service**: Controls Elasticsearch indices, mappings, and health
4. **Analytics Service**: Tracks search behavior and generates insights
5. **Kafka Consumer**: Processes real-time indexing events

## Quick Start

### Prerequisites

- Node.js 18+
- Elasticsearch 8.x
- Kafka (optional, for real-time indexing)
- PostgreSQL (for other services)

### Installation

```bash
# Install dependencies
npm install

# Copy environment configuration
cp .env.example .env

# Edit configuration
nano .env
```

### Environment Configuration

```env
# Server
NODE_ENV=development
PORT=3010
HOST=0.0.0.0

# Security
JWT_SECRET=your-super-secret-jwt-key-at-least-32-characters
CORS_ORIGINS=http://localhost:3000

# Elasticsearch
ELASTICSEARCH_NODE=http://localhost:9200
ELASTICSEARCH_USERNAME=elastic
ELASTICSEARCH_PASSWORD=password

# Search Configuration
INDEX_PREFIX=threatmodel
SEARCH_DEFAULT_SIZE=20
SEARCH_MAX_SIZE=1000

# Analytics
ANALYTICS_ENABLED=true
ANALYTICS_RETENTION_DAYS=90

# Real-time Indexing
ENABLE_REAL_TIME_INDEXING=true
KAFKA_BROKERS=localhost:9092
KAFKA_TOPIC_PREFIX=threatmodel
```

### Running the Service

```bash
# Development
npm run dev

# Production build
npm run build
npm start

# Docker
docker-compose up search-service
```

### Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test search-query.service.test.ts
```

## API Documentation

The service provides a comprehensive REST API with OpenAPI documentation.

### Accessing Documentation

- **Swagger UI**: `http://localhost:3010/docs`
- **OpenAPI JSON**: `http://localhost:3010/docs/json`

### Key Endpoints

#### Search Operations

```bash
# Basic search
POST /api/v1/search
{
  "query": "SQL injection",
  "contentTypes": ["threat", "project"],
  "filters": {
    "severity": ["high", "critical"],
    "status": ["open"]
  },
  "pagination": {
    "page": 1,
    "size": 20
  },
  "aggregations": ["severity", "status"],
  "highlight": true
}

# Auto-complete
GET /api/v1/search/autocomplete?prefix=SQL&size=10

# Get by ID
GET /api/v1/threat/threat-123

# More like this
POST /api/v1/more-like-this
{
  "contentType": "threat",
  "id": "threat-123",
  "size": 5
}
```

#### Analytics

```bash
# Search metrics
GET /api/v1/analytics/metrics?from=2024-01-01&to=2024-01-31

# Popular searches
GET /api/v1/analytics/popular-searches?limit=20

# User search history
GET /api/v1/analytics/my-history?limit=50
```

#### Admin Operations

```bash
# System health
GET /api/v1/admin/health

# Reindex content
POST /api/v1/admin/indices/reindex
{
  "contentType": "threat"
}

# Create snapshot
POST /api/v1/admin/snapshots
{
  "repositoryName": "backup",
  "snapshotName": "snapshot-2024-01-01"
}
```

## Search Features

### Content Types

The service supports searching across multiple content types:

- **Threats**: Security threats and vulnerabilities
- **Projects**: Threat modeling projects
- **Threat Models**: Detailed threat model documents
- **Users**: User profiles and information
- **Files**: Uploaded files with extracted text
- **Reports**: Generated reports and assessments

### Search Capabilities

#### Full-text Search
- Custom analyzers for threat modeling terminology
- Synonym support for security terms
- Fuzzy matching for typos
- Stemming for word variations

#### Filtering
- Field-based filters (severity, status, tags)
- Date range filtering
- Numeric range filtering
- User and organization scoping

#### Aggregations
- Term aggregations (count by field values)
- Date histograms (trends over time)
- Statistical aggregations (min, max, avg)
- Nested aggregations for complex data

#### Auto-complete
- Real-time suggestions as you type
- Context-aware suggestions
- Popular query suggestions
- Content-specific completions

### Analytics

The service provides comprehensive search analytics:

#### Metrics Tracked
- Search queries and results
- Click-through rates
- Response times
- Popular searches
- No-results queries
- User search patterns

#### Reports Available
- Search volume trends
- Popular search terms
- User engagement metrics
- Performance analytics
- Query optimization insights

## Real-time Indexing

The service supports real-time content synchronization through Kafka event streaming.

### Event Types

```typescript
interface IndexingEvent {
  type: 'create' | 'update' | 'delete';
  contentType: string;
  contentId: string;
  content?: any;
  userId?: string;
  timestamp: string;
}
```

### Kafka Topics

- `threatmodel_threats` - Threat document events
- `threatmodel_projects` - Project document events
- `threatmodel_threat_models` - Threat model events
- `threatmodel_users` - User profile events
- `threatmodel_files` - File document events
- `threatmodel_reports` - Report document events

### Producer Integration

Other services can publish indexing events:

```typescript
import { Kafka } from 'kafkajs';

const kafka = new Kafka({
  clientId: 'threat-service',
  brokers: ['localhost:9092']
});

const producer = kafka.producer();

// Send indexing event
await producer.send({
  topic: 'threatmodel_threats',
  messages: [{
    value: JSON.stringify({
      type: 'create',
      contentType: 'threat',
      contentId: 'threat-123',
      content: threatData,
      userId: 'user-123',
      timestamp: new Date().toISOString()
    })
  }]
});
```

## Configuration

### Elasticsearch Configuration

```typescript
// Custom analyzers for threat modeling content
const analysisConfig = {
  analyzer: {
    threat_analyzer: {
      type: 'custom',
      tokenizer: 'standard',
      filter: ['lowercase', 'stop', 'stemmer', 'threat_synonym']
    },
    autocomplete_analyzer: {
      type: 'custom',
      tokenizer: 'autocomplete_tokenizer',
      filter: ['lowercase']
    }
  },
  tokenizer: {
    autocomplete_tokenizer: {
      type: 'edge_ngram',
      min_gram: 1,
      max_gram: 20,
      token_chars: ['letter', 'digit']
    }
  },
  filter: {
    threat_synonym: {
      type: 'synonym',
      synonyms: [
        'vulnerability,vuln,weakness',
        'attack,threat,exploit',
        'mitigation,countermeasure,control'
      ]
    }
  }
};
```

### Index Mappings

Each content type has optimized field mappings:

```typescript
const threatMapping = {
  properties: {
    title: {
      type: 'text',
      analyzer: 'threat_analyzer',
      fields: {
        keyword: { type: 'keyword' },
        autocomplete: {
          type: 'text',
          analyzer: 'autocomplete_analyzer'
        }
      }
    },
    severity: { type: 'keyword' },
    riskScore: { type: 'float' },
    tags: { type: 'keyword' },
    createdAt: { type: 'date' }
  }
};
```

## Monitoring and Observability

### Health Checks

```bash
# Service health
GET /health
{
  "status": "healthy",
  "service": "search-service",
  "timestamp": "2024-01-01T00:00:00.000Z"
}

# Detailed system health (admin only)
GET /api/v1/admin/health
{
  "elasticsearch": {
    "status": "green",
    "numberOfNodes": 1,
    "activeShards": 15
  },
  "indices": [...],
  "indexing": {...}
}
```

### Logging

The service uses structured logging with different levels:

```typescript
import { logger, searchLogger } from './utils/logger';

// General logging
logger.info('Service started');
logger.error('Error occurred', { error, context });

// Search-specific logging
searchLogger.queryExecuted(query, userId, resultCount, responseTime);
searchLogger.indexCreated(indexName, duration);
searchLogger.elasticsearchError(operation, error);
```

### Metrics

Key metrics are logged and can be collected by monitoring systems:

- Search query latency
- Index operations per second
- Error rates
- Cache hit rates
- Memory and CPU usage

## Security

### Authentication

JWT token-based authentication:

```bash
# Include in Authorization header
Authorization: Bearer <jwt-token>
```

### Authorization

Role-based access control:

- **User**: Basic search capabilities
- **Analyst**: Search analytics access
- **Admin**: Full system administration

### Rate Limiting

Configurable rate limits per user/IP:

```typescript
{
  max: 100,        // requests
  timeWindow: 60000 // per minute
}
```

## Performance Optimization

### Search Performance

- Index optimization and force merge
- Query caching
- Result pagination
- Field filtering to reduce payload

### Indexing Performance

- Bulk operations for high throughput
- Asynchronous processing
- Retry mechanisms
- Circuit breakers

### Memory Management

- Connection pooling
- Streaming for large datasets
- Garbage collection optimization

## Troubleshooting

### Common Issues

#### Elasticsearch Connection
```bash
# Check connectivity
curl http://localhost:9200/_cluster/health

# Check service logs
docker logs search-service
```

#### Index Issues
```bash
# Check index health
GET /api/v1/admin/health

# Recreate problematic index
POST /api/v1/admin/indices/reindex
{
  "contentType": "threat",
  "force": true
}
```

#### Search Performance
```bash
# Check slow queries
GET /api/v1/analytics/slow-queries?threshold=5000

# Optimize indices
POST /api/v1/admin/indices/optimize
```

### Log Analysis

Search for specific issues:

```bash
# Error logs
grep "ERROR" logs/search-service.log

# Search performance
grep "search.query.executed" logs/search-service.log | grep "responseTime"

# Index operations
grep "search.document.indexed" logs/search-service.log
```

## Development

### Project Structure

```
src/
├── config/           # Configuration management
├── controllers/      # HTTP request handlers
├── middleware/       # Authentication, validation
├── routes/          # API route definitions
├── services/        # Business logic
├── types/           # TypeScript type definitions
├── utils/           # Utility functions
└── tests/           # Test suites
```

### Adding New Search Features

1. **Define Types**: Add interfaces in `src/types/`
2. **Implement Service**: Add logic in `src/services/`
3. **Create Controller**: Add handler in `src/controllers/`
4. **Define Routes**: Add endpoints in `src/routes/`
5. **Add Tests**: Create test files in `src/tests/`

### Testing Strategy

- **Unit Tests**: Service layer logic
- **Integration Tests**: API endpoints
- **E2E Tests**: Full search workflows
- **Performance Tests**: Load and stress testing

## Deployment

### Docker Deployment

```yaml
# docker-compose.yml
version: '3.8'
services:
  search-service:
    build: .
    ports:
      - "3010:3010"
    environment:
      - NODE_ENV=production
      - ELASTICSEARCH_NODE=http://elasticsearch:9200
    depends_on:
      - elasticsearch
      - kafka
```

### Production Considerations

1. **Elasticsearch Cluster**: Multi-node setup for HA
2. **Load Balancing**: Multiple service instances
3. **Monitoring**: APM and log aggregation
4. **Backup**: Regular snapshots
5. **Security**: TLS encryption, VPN access

## License

MIT License - see LICENSE file for details.

## Support

For questions or issues:

- Create an issue in the project repository
- Contact the development team
- Check the troubleshooting guide above