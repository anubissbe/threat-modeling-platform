# Integration Service

The Integration Service provides connectivity between the Threat Modeling Platform and external tools like Jira, GitHub, GitLab, and Azure DevOps.

## Features

- **Multi-Provider Support**: Connect to Jira, GitHub, GitLab, and Azure DevOps
- **Bi-directional Sync**: Push threat models to external tools and receive updates via webhooks
- **Secure Credential Storage**: All credentials are encrypted using AES-256
- **Event-Driven Architecture**: Uses Redis pub/sub for real-time updates
- **Rate Limiting**: Protects against abuse with configurable rate limits
- **Webhook Support**: Receive real-time updates from external tools
- **Scheduled Sync**: Configurable automatic synchronization intervals

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   API Gateway   │────▶│ Integration Svc  │────▶│ External Tools  │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                              │        │
                              ▼        ▼
                        ┌──────────┐ ┌─────────┐
                        │ PostgreSQL│ │  Redis  │
                        └──────────┘ └─────────┘
```

## API Endpoints

### Integrations

- `GET /api/integrations` - List all integrations
- `GET /api/integrations/:id` - Get integration details
- `GET /api/integrations/:id/status` - Get integration status
- `POST /api/integrations` - Create new integration
- `PUT /api/integrations/:id` - Update integration
- `DELETE /api/integrations/:id` - Delete integration
- `POST /api/integrations/:id/sync` - Trigger manual sync
- `POST /api/integrations/connect` - Test connection

### Webhooks

- `POST /webhooks/:provider/:id` - Webhook receiver endpoint

### Health

- `GET /health` - Service health check
- `GET /health/ready` - Readiness probe
- `GET /health/live` - Liveness probe

## Configuration

### Environment Variables

```bash
# Service Configuration
NODE_ENV=development
PORT=3008
LOG_LEVEL=info

# Database
DATABASE_URL=postgresql://user:pass@host:5432/db
DB_HOST=postgres
DB_PORT=5432
DB_NAME=threatmodel_db
DB_USER=threatmodel
DB_PASSWORD=password

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=password

# Security
JWT_SECRET=your-jwt-secret
ENCRYPTION_KEY=32-byte-hex-key

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3006
```

## Supported Providers

### GitHub

```typescript
{
  provider: "github",
  config: {
    baseUrl: "https://api.github.com",
    owner: "organization",
    repo: "repository",
    labels: ["threat-model"],
    webhookUrl: "https://your-domain.com"
  },
  credentials: {
    type: "token",
    token: "ghp_xxxxxxxxxxxx"
  }
}
```

### Jira

```typescript
{
  provider: "jira",
  config: {
    baseUrl: "https://your-domain.atlassian.net",
    projectKey: "TM",
    issueTypeId: "10001",
    webhookUrl: "https://your-domain.com"
  },
  credentials: {
    type: "basic",
    username: "email@example.com",
    password: "api-token"
  }
}
```

### GitLab

```typescript
{
  provider: "gitlab",
  config: {
    baseUrl: "https://gitlab.com/api/v4",
    projectId: "12345",
    labels: ["threat-model"],
    webhookUrl: "https://your-domain.com"
  },
  credentials: {
    type: "token",
    token: "glpat-xxxxxxxxxxxx"
  }
}
```

### Azure DevOps

```typescript
{
  provider: "azure_devops",
  config: {
    baseUrl: "https://dev.azure.com",
    organization: "your-org",
    project: "your-project",
    workItemType: "Issue",
    webhookUrl: "https://your-domain.com"
  },
  credentials: {
    type: "token",
    token: "your-pat-token"
  }
}
```

## Development

### Running Locally

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Run tests
npm test

# Build for production
npm run build

# Start production server
npm start
```

### Docker

```bash
# Build image
docker build -t threat-model-integration .

# Run container
docker run -p 3008:3008 \
  -e DATABASE_URL=postgresql://... \
  -e REDIS_URL=redis://... \
  threat-model-integration
```

## Security Considerations

1. **Credential Encryption**: All credentials are encrypted using AES-256-CBC
2. **Webhook Verification**: All webhooks are verified using provider-specific signatures
3. **Rate Limiting**: API endpoints are rate-limited to prevent abuse
4. **Authentication**: All endpoints (except webhooks) require JWT authentication
5. **Input Validation**: All inputs are validated using Zod schemas

## Monitoring

The service exposes the following metrics:

- Integration count by provider and status
- Sync success/failure rates
- Webhook processing times
- API response times
- Error rates

## Error Handling

The service implements comprehensive error handling:

- Structured error responses with error codes
- Retry logic for external API calls
- Circuit breaker pattern for external services
- Graceful degradation when external services are unavailable

## Contributing

1. Follow the existing code structure
2. Add tests for new features
3. Update documentation
4. Run linting and tests before submitting PRs