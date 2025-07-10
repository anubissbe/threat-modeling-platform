# 🔐 Enterprise SSO Integration Guide

## Overview

The Threat Modeling Platform provides world-class enterprise Single Sign-On (SSO) integration supporting multiple identity providers, comprehensive monitoring, and enterprise-grade security features.

## 🚀 Supported Identity Providers

### Microsoft Azure AD / Entra ID
- **Protocol**: OpenID Connect / SAML 2.0
- **Features**: Conditional Access, MFA, Group-based roles
- **Integration**: Native Azure AD app registration
- **Compliance**: SOC2, ISO27001, GDPR ready

### Google Workspace
- **Protocol**: OpenID Connect
- **Features**: G Suite domain restrictions, Organizational units
- **Integration**: Google Cloud Console app
- **Compliance**: Google Cloud security standards

### Okta
- **Protocol**: SAML 2.0 / OpenID Connect
- **Features**: Adaptive MFA, API Access Management
- **Integration**: Okta application catalog
- **Compliance**: FedRAMP, SOC2 Type II

### Generic SAML 2.0
- **Protocol**: SAML 2.0
- **Features**: Custom attribute mapping, Encrypted assertions
- **Integration**: Any SAML 2.0 compliant provider
- **Compliance**: OASIS SAML standards

### Generic OpenID Connect
- **Protocol**: OpenID Connect 1.0
- **Features**: JWT tokens, Discovery endpoints
- **Integration**: Any OIDC compliant provider
- **Compliance**: OpenID Foundation standards

### PingIdentity
- **Protocol**: OpenID Connect / SAML 2.0
- **Features**: Cloud-native identity, Risk-based authentication
- **Integration**: PingOne platform
- **Compliance**: FedRAMP High, CJIS

## 🏗️ Architecture Overview

```mermaid
graph TB
    subgraph "Identity Providers"
        AZURE[Azure AD]
        GOOGLE[Google Workspace]
        OKTA[Okta]
        SAML[Generic SAML]
        OIDC[Generic OIDC]
        PING[PingIdentity]
    end
    
    subgraph "Threat Modeling Platform"
        subgraph "SSO Gateway"
            AUTH[Auth Service]
            SSO[SSO Router]
            MONITOR[SSO Monitoring]
        end
        
        subgraph "Core Services"
            API[API Gateway]
            CORE[Core Service]
            AI[AI Service]
        end
        
        subgraph "Data Layer"
            DB[(User Database)]
            AUDIT[(Audit Logs)]
            SESSIONS[(Session Store)]
        end
    end
    
    subgraph "Management"
        ADMIN[Admin Dashboard]
        ALERTS[Alert System]
        COMPLIANCE[Compliance Reports]
    end
    
    AZURE --> SSO
    GOOGLE --> SSO
    OKTA --> SSO
    SAML --> SSO
    OIDC --> SSO
    PING --> SSO
    
    SSO --> AUTH
    AUTH --> API
    API --> CORE
    API --> AI
    
    AUTH --> DB
    AUTH --> AUDIT
    AUTH --> SESSIONS
    
    MONITOR --> ALERTS
    MONITOR --> COMPLIANCE
    ADMIN --> AUTH
```

## 🛠️ Configuration Guide

### 1. Azure AD Integration

#### Prerequisites
- Azure AD tenant with admin privileges
- Application registration in Azure portal
- Required permissions: `User.Read`, `email`, `profile`, `openid`

#### Configuration Steps

1. **Create App Registration**
```bash
# Azure CLI commands
az ad app create \
  --display-name "Threat Modeling Platform" \
  --sign-in-audience "AzureADMyOrg" \
  --web-redirect-uris "https://your-domain.com/api/auth/sso/callback/azure-ad"
```

2. **Configure Platform Settings**
```json
{
  "organizationId": "your-org-id",
  "provider": "azure-ad",
  "name": "Microsoft Azure AD",
  "azureAd": {
    "tenantId": "12345678-1234-1234-1234-123456789012",
    "clientId": "87654321-4321-4321-4321-210987654321",
    "clientSecret": "your-client-secret",
    "authority": "https://login.microsoftonline.com/12345678-1234-1234-1234-123456789012",
    "redirectUri": "https://your-domain.com/api/auth/sso/callback/azure-ad",
    "scope": "openid profile email User.Read"
  },
  "attributeMapping": {
    "email": "email",
    "firstName": "given_name",
    "lastName": "family_name",
    "groups": "groups"
  },
  "roleMapping": [
    {
      "groupName": "ThreatModel-Admins",
      "role": "admin",
      "priority": 100
    }
  ]
}
```

### 2. Google Workspace Integration

#### Prerequisites
- Google Workspace admin access
- Google Cloud Console project
- OAuth 2.0 credentials configured

#### Configuration Steps

1. **Create OAuth 2.0 Credentials**
```bash
# Enable required APIs
gcloud services enable admin.googleapis.com
gcloud services enable oauth2.googleapis.com
```

2. **Platform Configuration**
```json
{
  "organizationId": "your-org-id",
  "provider": "google-workspace",
  "name": "Google Workspace",
  "googleWorkspace": {
    "clientId": "your-client-id.apps.googleusercontent.com",
    "clientSecret": "your-client-secret",
    "redirectUri": "https://your-domain.com/api/auth/sso/callback/google-workspace",
    "hostedDomain": "your-company.com"
  },
  "attributeMapping": {
    "email": "email",
    "firstName": "given_name",
    "lastName": "family_name"
  }
}
```

### 3. Okta Integration

#### Prerequisites
- Okta developer or admin account
- Application created in Okta admin console
- Authorization server configured

#### Configuration Steps

1. **Create OIDC Application**
```bash
# Okta CLI (optional)
okta apps create web \
  --name "Threat Modeling Platform" \
  --redirect-uri "https://your-domain.com/api/auth/sso/callback/okta"
```

2. **Platform Configuration**
```json
{
  "organizationId": "your-org-id",
  "provider": "okta",
  "name": "Okta",
  "okta": {
    "domain": "your-company.okta.com",
    "clientId": "your-client-id",
    "clientSecret": "your-client-secret",
    "redirectUri": "https://your-domain.com/api/auth/sso/callback/okta",
    "scope": "openid profile email groups"
  },
  "attributeMapping": {
    "email": "email",
    "firstName": "given_name",
    "lastName": "family_name",
    "groups": "groups"
  }
}
```

## 🔧 API Integration

### Authentication Flow

```typescript
// Initiate SSO Login
const initiateSSO = async (provider: string, organizationId: string) => {
  const response = await fetch(`/api/auth/sso/login/${provider}?organizationId=${organizationId}`);
  
  if (response.ok) {
    // Redirect to identity provider
    window.location.href = response.url;
  }
};

// Handle SSO Callback
const handleCallback = async (code: string, state: string) => {
  const response = await fetch('/api/auth/sso/callback/azure-ad', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, state })
  });
  
  const result = await response.json();
  
  if (result.success) {
    // Store tokens and redirect to application
    localStorage.setItem('accessToken', result.tokens.accessToken);
    localStorage.setItem('refreshToken', result.tokens.refreshToken);
    window.location.href = '/dashboard';
  }
};
```

### Management API

```typescript
// Get SSO Dashboard Data
const getDashboard = async () => {
  const response = await fetch('/api/auth/sso/dashboard', {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  return response.json();
};

// Configure New Provider
const configureProvider = async (config: SSOProviderConfig) => {
  const response = await fetch('/api/auth/sso/providers', {
    method: 'POST',
    headers: { 
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(config)
  });
  return response.json();
};

// Test Provider Configuration
const testProvider = async (config: SSOProviderConfig) => {
  const response = await fetch('/api/auth/sso/test-configuration', {
    method: 'POST',
    headers: { 
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(config)
  });
  return response.json();
};
```

## 📊 Monitoring & Analytics

### Dashboard Metrics
- **Login Success Rate**: Real-time success/failure rates
- **Performance Metrics**: Average login times, P95/P99 latencies
- **Security Alerts**: Failed login attempts, suspicious activity
- **Provider Health**: Connectivity, certificate status, response times

### Alert Types
- **Security**: Multiple failed logins, suspicious IP addresses
- **Performance**: Slow response times, timeout errors
- **Availability**: Provider downtime, certificate expiry
- **Compliance**: Policy violations, audit requirements

### Sample Monitoring Code
```typescript
// Monitor SSO Login
const monitorLogin = (providerId: string, success: boolean, duration: number) => {
  ssoMonitoring.recordLoginAttempt(providerId, userId, success, duration, {
    sourceIp: req.ip,
    userAgent: req.get('User-Agent'),
    organizationId: user.organization
  });
};

// Check Provider Health
const healthCheck = async (providerId: string) => {
  const status = await ssoMonitoring.checkProviderHealth(providerId, config);
  
  if (status.status === 'error') {
    await alerting.sendAlert({
      type: 'availability',
      severity: 'high',
      title: 'SSO Provider Down',
      description: `Provider ${providerId} is not responding`
    });
  }
};
```

## 🔒 Security Features

### Multi-Factor Authentication (MFA)
- Enforced at identity provider level
- Risk-based authentication triggers
- Device trust policies

### Session Management
- Configurable session timeouts
- Maximum concurrent sessions per user
- Single logout (SLO) support
- Session monitoring and termination

### Certificate Management
- Automatic certificate validation
- Expiry monitoring and alerts
- Certificate rotation workflows
- Strong signature algorithms (SHA-256+)

### Audit Logging
- Comprehensive audit trail
- SIEM integration ready
- Compliance report generation
- Real-time monitoring

## 📋 Compliance & Standards

### SOC2 Type II
- Access controls and monitoring
- Data encryption in transit
- Audit logging and retention
- Regular security assessments

### GDPR Compliance
- Data minimization principles
- Right to erasure support
- Data portability features
- Privacy by design

### SAML 2.0 Standards
- OASIS SAML 2.0 compliance
- Encrypted assertions
- Signed responses
- Proper XML validation

### OpenID Connect Standards
- OAuth 2.0 / OIDC 1.0 compliance
- PKCE for public clients
- JWT token validation
- Proper state management

## 🚀 Deployment Guide

### Environment Variables
```bash
# Production Environment
NODE_ENV=production
SSO_ENCRYPTION_KEY=your-32-char-encryption-key
SESSION_SECRET=your-session-secret
REDIS_URL=redis://localhost:6379
DATABASE_URL=postgresql://user:pass@localhost/threatmodel

# Azure AD
AZURE_TENANT_ID=your-tenant-id
AZURE_CLIENT_ID=your-client-id
AZURE_CLIENT_SECRET=your-client-secret

# Monitoring
PROMETHEUS_ENDPOINT=http://prometheus:9090
GRAFANA_ENDPOINT=http://grafana:3000
```

### Docker Deployment
```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:18-alpine
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001
WORKDIR /app
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --chown=nodejs:nodejs . .
USER nodejs
EXPOSE 3001
CMD ["npm", "start"]
```

### Kubernetes Deployment
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: threat-modeling-auth
spec:
  replicas: 3
  selector:
    matchLabels:
      app: threat-modeling-auth
  template:
    metadata:
      labels:
        app: threat-modeling-auth
    spec:
      containers:
      - name: auth-service
        image: threat-modeling/auth-service:latest
        ports:
        - containerPort: 3001
        env:
        - name: NODE_ENV
          value: "production"
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: auth-secrets
              key: redis-url
        livenessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 5
          periodSeconds: 5
```

## 🛠️ Troubleshooting

### Common Issues

#### Provider Configuration Errors
```bash
# Check configuration validation
curl -X POST /api/auth/sso/test-configuration \
  -H "Content-Type: application/json" \
  -d @provider-config.json
```

#### Certificate Problems
```bash
# Validate certificate
openssl x509 -in certificate.pem -text -noout

# Check expiry
openssl x509 -in certificate.pem -noout -dates
```

#### Network Connectivity
```bash
# Test provider endpoints
curl -I https://login.microsoftonline.com/common/v2.0/.well-known/openid_configuration
curl -I https://your-company.okta.com/.well-known/openid_configuration
```

### Debugging Tools
- **SSO Health Dashboard**: Real-time provider status
- **Audit Logs**: Detailed authentication traces
- **Performance Metrics**: Login timing and success rates
- **Alert System**: Proactive issue detection

## 📞 Support & Resources

### Documentation Links
- [Azure AD Integration Guide](https://docs.microsoft.com/en-us/azure/active-directory/)
- [Google Workspace Setup](https://developers.google.com/workspace)
- [Okta Developer Portal](https://developer.okta.com/)
- [SAML 2.0 Specification](https://docs.oasis-open.org/security/saml/v2.0/)
- [OpenID Connect Specification](https://openid.net/connect/)

### Best Practices
1. **Security First**: Always validate certificates and signatures
2. **Monitor Everything**: Set up comprehensive monitoring and alerts
3. **Test Thoroughly**: Use test environments before production
4. **Document Changes**: Maintain configuration documentation
5. **Regular Reviews**: Periodic access and configuration reviews
6. **Backup Plans**: Have fallback authentication methods
7. **Compliance Ready**: Ensure audit trail and reporting capabilities

### Performance Optimization
- **Connection Pooling**: Reuse HTTP connections to providers
- **Caching**: Cache provider metadata and certificates
- **Load Balancing**: Distribute SSO processing across instances
- **Rate Limiting**: Protect against authentication abuse
- **Monitoring**: Track performance metrics and optimize bottlenecks

---

This enterprise SSO integration provides world-class identity management capabilities, making the threat modeling platform ready for large-scale enterprise deployments with comprehensive security, monitoring, and compliance features.