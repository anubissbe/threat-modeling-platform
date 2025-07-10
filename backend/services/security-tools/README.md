# Security Tools Integration Service

A comprehensive security tool ecosystem integration service for the threat modeling platform that enables seamless integration with various security tools including SIEMs, vulnerability scanners, cloud security centers, and ticketing systems.

## Features

### 🔌 Multi-Tool Integration
- **SIEM Integration**: Splunk, QRadar, Elastic, Sentinel, Chronicle, Sumo Logic
- **Vulnerability Scanners**: Nessus, Qualys, Rapid7, OpenVAS, Acunetix, Burp
- **Cloud Security**: AWS Security Hub, Azure Security Center, Google Cloud Security Command Center
- **Ticketing Systems**: Jira, ServiceNow, Remedy, Zendesk, FreshService

### 🔍 Advanced Correlation Engine
- Real-time threat correlation across multiple security tools
- Configurable correlation rules with aggregations and conditions
- Automated threat detection and classification
- Risk scoring and confidence assessment
- Deduplication and event enrichment

### 🎯 Key Capabilities
- **Bidirectional Sync**: Synchronize data between threat models and external tools
- **Automated Ticket Creation**: Create tickets from threats, vulnerabilities, and findings
- **Real-time Streaming**: WebSocket support for live security events
- **Alert Aggregation**: Consolidate alerts from multiple sources
- **Automated Response**: Execute remediation actions based on findings

### 📊 Security Dashboard
- Unified security posture dashboard
- Real-time metrics and KPIs
- Threat trends and vulnerability analysis
- Integration health monitoring
- Customizable reporting

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Security Tools Service                     │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │   Adapters   │  │  Correlation │  │    Dashboard     │   │
│  │             │  │    Engine    │  │   & Reporting    │   │
│  ├─────────────┤  ├──────────────┤  ├──────────────────┤   │
│  │ • Splunk    │  │ • Rules      │  │ • Metrics        │   │
│  │ • QRadar    │  │ • Enrichment │  │ • Trends         │   │
│  │ • Nessus    │  │ • Dedup      │  │ • Health         │   │
│  │ • AWS       │  │ • Actions    │  │ • Reports        │   │
│  │ • Jira      │  └──────────────┘  └──────────────────┘   │
│  └─────────────┘                                             │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │                    Data Layer                           │ │
│  ├────────────────────────────────────────────────────────┤ │
│  │  PostgreSQL  │  Redis Cache  │  Event Queue            │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Installation

### Prerequisites
- Node.js 18+ and npm
- PostgreSQL 14+
- Redis 6+
- Docker (optional)

### Setup

1. Clone the repository:
```bash
cd /opt/projects/threat-modeling-platform/backend/services/security-tools
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Initialize the database:
```bash
psql -U postgres -d threat_modeling -f src/config/schema.sql
```

5. Start the service:
```bash
# Development
npm run dev

# Production
npm run build
npm start
```

## Configuration

### Environment Variables

```env
# Server Configuration
PORT=3024
NODE_ENV=development

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=threat_modeling
DB_USER=postgres
DB_PASSWORD=postgres

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# Security
JWT_SECRET=your-secret-key
ENCRYPTION_KEY=your-encryption-key

# CORS
CORS_ORIGIN=http://localhost:3000,http://localhost:3001

# Service Configuration
MAX_CONCURRENT_SYNCS=3
CORRELATION_WINDOW_MINUTES=15
CORRELATION_INTERVAL_MS=60000

# External Services (Optional)
VAULT_ADDR=http://localhost:8200
VAULT_TOKEN=your-vault-token
```

## API Documentation

### Authentication
All endpoints require JWT authentication via Bearer token:
```
Authorization: Bearer <jwt-token>
```

### Core Endpoints

#### Integration Management

**Create Integration**
```http
POST /api/security-tools/integrations
Content-Type: application/json

{
  "name": "Production Splunk",
  "type": "siem",
  "platform": "splunk",
  "description": "Main production SIEM",
  "connectionConfig": {
    "endpoint": "https://splunk.example.com:8089",
    "authType": "basic",
    "credentials": {
      "username": "admin",
      "password": "password"
    }
  },
  "syncConfig": {
    "enabled": true,
    "direction": "inbound",
    "interval": 60
  }
}
```

**List Integrations**
```http
GET /api/security-tools/integrations
```

**Test Connection**
```http
POST /api/security-tools/integrations/{integrationId}/test
```

#### Event Correlation

**Correlate Events**
```http
POST /api/security-tools/correlate
Content-Type: application/json

{
  "timeRange": {
    "start": "2024-01-01T00:00:00Z",
    "end": "2024-01-02T00:00:00Z"
  },
  "sources": ["siem", "vulnerability-scanner"],
  "severities": ["critical", "high"]
}
```

#### Threat Management

**List Threats**
```http
GET /api/security-tools/threats?limit=50&severity=critical
```

**Update Threat Status**
```http
PUT /api/security-tools/threats/{threatId}
Content-Type: application/json

{
  "status": "investigating",
  "assignee": "security-team@example.com"
}
```

#### Ticketing

**Create Ticket**
```http
POST /api/security-tools/tickets
Content-Type: application/json

{
  "threatId": "threat-123",
  "integrationId": "jira-integration-id",
  "ticketData": {
    "title": "Critical Security Threat Detected",
    "description": "Automated ticket for threat response",
    "priority": "High",
    "assignee": "security-team"
  }
}
```

### WebSocket Events

Connect to real-time events:
```javascript
const ws = new WebSocket('ws://localhost:3024/ws/security-tools');

ws.on('message', (data) => {
  const event = JSON.parse(data);
  switch(event.type) {
    case 'threat.detected':
      console.log('New threat:', event.data);
      break;
    case 'integration.error':
      console.error('Integration error:', event.data);
      break;
  }
});
```

Available events:
- `integration.connected`
- `integration.disconnected`
- `integration.error`
- `sync.started`
- `sync.completed`
- `sync.failed`
- `threat.detected`
- `threat.correlated`
- `vulnerability.discovered`
- `finding.created`
- `ticket.created`
- `ticket.updated`

## Integration Adapters

### SIEM Adapters

#### Splunk
```typescript
const splunkConfig = {
  endpoint: 'https://splunk.example.com:8089',
  authType: 'basic',
  credentials: {
    username: 'admin',
    password: 'password'
  }
};
```

Supported features:
- Event search and retrieval
- Alert creation
- Dashboard integration
- Real-time event streaming

#### QRadar
```typescript
const qradarConfig = {
  endpoint: 'https://qradar.example.com',
  authType: 'token',
  credentials: {
    apiToken: 'your-api-token'
  }
};
```

Supported features:
- Offense management
- Event correlation
- Reference set management
- Custom properties

### Vulnerability Scanner Adapters

#### Nessus
```typescript
const nessusConfig = {
  endpoint: 'https://nessus.example.com:8834',
  authType: 'basic',
  credentials: {
    username: 'admin',
    password: 'password'
  }
};
```

Supported features:
- Scan management
- Vulnerability import
- Policy configuration
- Report generation

### Cloud Security Adapters

#### AWS Security Hub
```typescript
const awsConfig = {
  endpoint: 'https://securityhub.amazonaws.com',
  authType: 'token',
  credentials: {
    accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
    secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
    region: 'us-east-1'
  }
};
```

Supported features:
- Finding aggregation
- Compliance monitoring
- Automated remediation
- Multi-account support

### Ticketing Adapters

#### Jira
```typescript
const jiraConfig = {
  endpoint: 'https://your-domain.atlassian.net',
  authType: 'basic',
  credentials: {
    email: 'user@example.com',
    apiToken: 'your-api-token'
  }
};
```

Supported features:
- Issue creation and updates
- Custom field mapping
- Workflow automation
- Attachment support

## Correlation Rules

### Rule Configuration

```typescript
const correlationRule = {
  id: 'multi-source-critical',
  name: 'Multi-Source Critical Threat',
  enabled: true,
  sourceTypes: ['siem', 'vulnerability-scanner'],
  conditions: [
    { field: 'severity', operator: 'eq', value: 'critical' }
  ],
  aggregations: [
    {
      field: 'sourceIP',
      function: 'count',
      having: { field: 'count', operator: 'gte', value: 5 }
    }
  ],
  severity: 'critical',
  tags: ['multi-source', 'critical'],
  actions: [
    { type: 'create-threat', parameters: {} },
    { type: 'create-ticket', parameters: { priority: 'highest' } }
  ]
};
```

### Built-in Rules

1. **Multi-Source Critical Threat**: Correlates critical events from multiple sources
2. **Repeated Attack Pattern**: Detects repeated attacks from same source
3. **Vulnerability Exploitation**: Matches active exploits with known vulnerabilities
4. **Lateral Movement Detection**: Identifies potential lateral movement
5. **Data Exfiltration**: Detects potential data exfiltration patterns

## Development

### Running Tests

```bash
# Unit tests
npm test

# Integration tests
npm run test:integration

# Coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

### Linting

```bash
# Lint code
npm run lint

# Fix lint issues
npm run lint:fix

# Type checking
npm run typecheck
```

### Building

```bash
# Build for production
npm run build

# Clean build
rm -rf dist && npm run build
```

## Deployment

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3024
CMD ["node", "dist/index.js"]
```

Build and run:
```bash
docker build -t security-tools-service .
docker run -p 3024:3024 --env-file .env security-tools-service
```

### Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: security-tools-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: security-tools-service
  template:
    metadata:
      labels:
        app: security-tools-service
    spec:
      containers:
      - name: security-tools
        image: security-tools-service:latest
        ports:
        - containerPort: 3024
        env:
        - name: NODE_ENV
          value: "production"
        envFrom:
        - secretRef:
            name: security-tools-secrets
```

## Monitoring

### Health Check
```http
GET /health
```

Response:
```json
{
  "status": "healthy",
  "service": "security-tools",
  "version": "1.0.0",
  "uptime": 3600,
  "integrations": {
    "total": 5,
    "connected": 4,
    "error": 1
  }
}
```

### Metrics
The service exposes Prometheus metrics at `/metrics`:
- `security_tools_integrations_total`
- `security_tools_threats_detected`
- `security_tools_correlation_duration`
- `security_tools_sync_errors_total`

## Troubleshooting

### Common Issues

1. **Integration Connection Failed**
   - Check network connectivity
   - Verify credentials
   - Check SSL certificate validity
   - Review firewall rules

2. **Correlation Not Working**
   - Check correlation engine rules
   - Verify event ingestion
   - Review Redis connectivity
   - Check correlation window settings

3. **High Memory Usage**
   - Adjust correlation window
   - Increase deduplication
   - Review event retention
   - Scale horizontally

### Debug Mode

Enable debug logging:
```env
LOG_LEVEL=debug
```

## Security Considerations

1. **Credential Storage**: All credentials are encrypted at rest
2. **API Authentication**: JWT-based authentication required
3. **Rate Limiting**: Built-in rate limiting for API endpoints
4. **Audit Logging**: All actions are logged for compliance
5. **Data Encryption**: TLS for all external communications
6. **Input Validation**: Strict schema validation on all inputs

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is part of the Threat Modeling Platform and follows the same license terms.