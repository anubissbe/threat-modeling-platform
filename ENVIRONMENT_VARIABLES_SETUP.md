# Environment Variables Setup Guide

## Overview

This document provides a comprehensive guide for setting up all required and optional environment variables for the threat modeling platform services.

## Environment Files Structure

```
threat-modeling-platform/
├── .env                           # Main environment file
├── .env.example                   # Template for main environment
├── .env.security                  # Security-specific variables
├── .env.cors                      # CORS configuration
├── backend/services/auth/.env.example
├── backend/services/integration/.env.example
├── backend/services/cloud-native/.env.example
├── backend/services/security-tools/.env.example
└── frontend/.env                  # React frontend environment
```

## Core Infrastructure Variables

### Database Configuration
```bash
# PostgreSQL Database
DB_PASSWORD=threatmodel123
DATABASE_URL=postgresql://threatmodel:threatmodel123@localhost:5432/threatmodel_db
DB_HOST=postgres
DB_PORT=5432
DB_NAME=threatmodel_db
DB_USER=threatmodel
```

### Cache & Message Queue
```bash
# Redis Cache
REDIS_PASSWORD=redis123
REDIS_URL=redis://:redis123@localhost:6379

# RabbitMQ Message Broker
RABBITMQ_USER=threatmodel
RABBITMQ_PASSWORD=rabbitmq123
RABBITMQ_URL=amqp://threatmodel:rabbitmq123@localhost:5672
```

### Object Storage
```bash
# MinIO (S3-compatible storage)
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=minioadmin123
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin123
```

## Security & Authentication

### JWT Configuration
```bash
# JSON Web Tokens
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-this-in-production
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
REFRESH_TOKEN_SECRET=your-super-secret-refresh-key
```

### Encryption
```bash
# Service-to-service encryption
ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
```

## Notification Services (Optional)

### Email Configuration
```bash
# SMTP Email Settings
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM=threatmodel@company.com
```

**Setup Instructions:**
1. Use Gmail App Passwords for `SMTP_PASSWORD`
2. Enable 2FA on Gmail account
3. Generate App Password: Account Settings → Security → App passwords
4. Use generated password, not regular password

### Slack Integration
```bash
# Slack Bot Configuration
SLACK_BOT_TOKEN=xoxb-your-bot-token-here
SLACK_SIGNING_SECRET=your-slack-signing-secret-here
```

**Setup Instructions:**
1. Create Slack App: https://api.slack.com/apps
2. Add Bot Token Scopes: `chat:write`, `channels:read`, `users:read`
3. Install app to workspace
4. Copy Bot User OAuth Token (starts with `xoxb-`)
5. Copy Signing Secret from Basic Information

### Microsoft Teams
```bash
# Teams Webhook Configuration
TEAMS_WEBHOOK_URL=https://outlook.office.com/webhook/your-webhook-url
```

**Setup Instructions:**
1. Open Teams channel
2. Click ⋯ → Connectors → Incoming Webhook
3. Configure webhook name and upload image
4. Copy webhook URL

### SMS (Twilio)
```bash
# Twilio SMS Configuration
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_FROM_NUMBER=+1234567890
```

**Setup Instructions:**
1. Create Twilio account: https://www.twilio.com/
2. Get Account SID and Auth Token from Console Dashboard
3. Purchase phone number for `TWILIO_FROM_NUMBER`

### Generic Webhook
```bash
# Custom Webhook Configuration
WEBHOOK_URL=https://your-webhook-endpoint.com/notifications
WEBHOOK_SECRET=your-webhook-secret-for-hmac-validation
```

## AI & External Services

### OpenAI Integration
```bash
# OpenAI API for AI-powered threat analysis
OPENAI_API_KEY=your-openai-api-key-here
```

**Setup Instructions:**
1. Create OpenAI account: https://platform.openai.com/
2. Generate API key: API Keys → Create new secret key
3. Set billing limits to control costs

## SSO & Identity Providers

### SAML Configuration
```bash
# SAML SSO Settings
SAML_ENTRY_POINT=https://your-idp.com/sso/saml
SAML_ISSUER=threat-modeling-platform
SAML_CERT=path/to/saml-cert.pem
```

### OAuth2 Providers
```bash
# Google OAuth2
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Azure AD OAuth2
AZURE_CLIENT_ID=your-azure-client-id
AZURE_CLIENT_SECRET=your-azure-client-secret
```

## Monitoring & Observability

### Grafana
```bash
# Grafana Dashboard
GRAFANA_PASSWORD=admin123
```

### Application Settings
```bash
# Environment
NODE_ENV=development
ENVIRONMENT=development

# Frontend
REACT_APP_API_URL=http://localhost:3000
REACT_APP_WS_URL=ws://localhost:3000

# CORS Origins
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3006,http://localhost:5173
```

## Service Status & Requirements

### Required Variables (Service fails without these)
- `JWT_SECRET` - All services require this
- `DB_*` variables - Database connection
- `REDIS_*` variables - Cache and session storage

### Optional Variables (Service works but features limited)

| Variable | Service | Impact if Missing |
|----------|---------|-------------------|
| `SMTP_FROM` | Notification | Email notifications disabled |
| `SLACK_BOT_TOKEN` | Notification | Slack notifications disabled |
| `SLACK_SIGNING_SECRET` | Notification | Slack webhook verification disabled |
| `TWILIO_AUTH_TOKEN` | Notification | SMS notifications disabled |
| `TEAMS_WEBHOOK_URL` | Notification | Teams notifications disabled |
| `WEBHOOK_SECRET` | Notification | Webhook HMAC verification disabled |
| `OPENAI_API_KEY` | AI Service | AI threat analysis disabled |

## Security Best Practices

### Production Environment
1. **Change all default passwords**
2. **Use strong, unique secrets for JWT**
3. **Enable HTTPS for all external endpoints**
4. **Rotate secrets regularly**
5. **Use secret management systems (HashiCorp Vault)**

### Secret Management
```bash
# Example using environment-specific files
cp .env.example .env.production
# Edit .env.production with production values
# Never commit .env.production to git
```

### Docker Secrets (Production)
```yaml
# docker-compose.prod.yml
services:
  notification-service:
    environment:
      SMTP_PASSWORD_FILE: /run/secrets/smtp_password
    secrets:
      - smtp_password

secrets:
  smtp_password:
    external: true
```

## Validation & Testing

### Environment Validation
The services automatically validate required variables on startup:

```javascript
// Example validation output
[INFO] Environment validation completed
[WARN] Missing optional environment variables: [
  "SMTP_FROM: Email notifications will not work without SMTP_FROM",
  "SLACK_BOT_TOKEN: Slack notifications will not work without SLACK_BOT_TOKEN"
]
```

### Testing Configuration
```bash
# Test database connection
docker exec threatmodel-postgres pg_isready -U threatmodel

# Test Redis connection
docker exec threatmodel-redis redis-cli ping

# Test notification service environment
curl http://localhost:3009/health/detailed
```

## Common Issues & Solutions

### Issue: Service won't start
**Check:** Required environment variables are set
```bash
docker logs threatmodel-notification | grep -i "missing\|error"
```

### Issue: Notifications not working
**Check:** Optional provider variables are configured
```bash
# Check notification service logs
docker logs threatmodel-notification --tail=50
```

### Issue: JWT tokens invalid
**Check:** JWT_SECRET is consistent across all services
```bash
# Verify JWT secret in all services
docker exec threatmodel-auth env | grep JWT_SECRET
docker exec threatmodel-core env | grep JWT_SECRET
```

## Environment Setup Script

```bash
#!/bin/bash
# setup-environment.sh

echo "Setting up threat modeling platform environment..."

# Copy example files
cp .env.example .env
cp backend/services/auth/.env.example backend/services/auth/.env
cp frontend/.env.example frontend/.env

# Generate secure secrets
JWT_SECRET=$(openssl rand -hex 32)
ENCRYPTION_KEY=$(openssl rand -hex 64)

# Update .env with generated secrets
sed -i "s/your-super-secret-jwt-key-change-this-in-production/$JWT_SECRET/g" .env
sed -i "s/0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef/$ENCRYPTION_KEY/g" .env

echo "Environment setup completed!"
echo "Please configure optional notification providers in .env"
```

## Next Steps

1. **Configure required variables** in `.env`
2. **Set up optional notification providers** as needed
3. **Test service startup:** `docker-compose up -d`
4. **Verify health checks:** `curl http://localhost:3009/health`
5. **Configure monitoring** in Grafana dashboard

For production deployment, use HashiCorp Vault or similar secret management system instead of `.env` files.