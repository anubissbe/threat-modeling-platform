# Enterprise SSO & Authentication System Documentation

## Overview

The Enterprise SSO & Authentication System provides comprehensive single sign-on capabilities for the Threat Modeling Platform, supporting multiple identity providers and advanced security features including multi-factor authentication, adaptive security, and compliance controls.

## 🚀 Key Features

### Core SSO Capabilities
- **Multi-Provider Support**: SAML 2.0, OpenID Connect (OIDC), OAuth 2.0, LDAP, Azure AD, Google Workspace, Okta, PingIdentity
- **Just-in-Time (JIT) Provisioning**: Automatic user creation and updates
- **Attribute & Role Mapping**: Flexible mapping of SSO attributes to application roles
- **Single Sign-Out (SLO)**: Coordinated logout across all connected applications
- **Certificate Management**: X.509 certificate validation and rotation
- **Metadata Management**: Automatic SP metadata generation and IdP metadata consumption

### Advanced Security Features
- **Multi-Factor Authentication (MFA)**: TOTP, SMS, Email, WebAuthn, Biometric, Push notifications
- **Adaptive Authentication**: Risk-based authentication using ML-powered risk scoring
- **Conditional Access**: Policy-based access control with context awareness
- **Session Management**: Secure session handling with configurable timeouts
- **Audit & Compliance**: Comprehensive logging for SOC2, GDPR, HIPAA compliance
- **Threat Detection**: Real-time security monitoring and anomaly detection

### Enterprise Features
- **Multi-Tenant Support**: Organization-specific SSO configurations
- **High Availability**: Redundant deployment with failover capabilities
- **Scalability**: Horizontal scaling support for large enterprises
- **API-First Design**: RESTful APIs for all SSO operations
- **Integration Ready**: Webhooks, SCIM provisioning, and federation trust
- **Mobile Support**: Native mobile app integration with biometric authentication

## 🏗️ Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                    Threat Modeling Platform                     │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   Web Frontend  │  │   Mobile App    │  │   API Gateway   │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                 Enterprise SSO & Auth Service                  │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │  SSO Service    │  │   MFA Service   │  │  Auth Service   │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │ Audit Service   │  │  Risk Engine    │  │ Session Mgmt    │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Identity Providers                           │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   Azure AD      │  │   Google WS     │  │     Okta        │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │  SAML 2.0 IdP   │  │   OIDC Provider │  │  Custom LDAP    │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
User → Identity Provider → SSO Service → Risk Engine → MFA Service → Application
  │                                                                        │
  └──────────────────── Audit Service ←──────────────────────────────────┘
```

## 🔧 Configuration

### Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/threat_modeling_auth
REDIS_URL=redis://localhost:6379

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=3600
JWT_REFRESH_EXPIRES_IN=604800

# SSO Configuration
SSO_BASE_URL=https://your-domain.com
SSO_METADATA_PATH=/auth/sso/metadata
SSO_CALLBACK_PATH=/auth/sso/callback

# MFA Configuration
MFA_ENABLED=true
MFA_TOTP_ISSUER=Threat Modeling Platform
MFA_SESSION_TIMEOUT=3600

# Security
BCRYPT_ROUNDS=12
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=100

# Audit & Compliance
AUDIT_LOG_RETENTION_DAYS=2555
COMPLIANCE_MODE=strict
GDPR_ENABLED=true
HIPAA_ENABLED=false

# External Services
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-token
SENDGRID_API_KEY=your-sendgrid-key
```

### Provider Configuration Examples

#### SAML 2.0 Configuration
```json
{
  "organizationId": "acme-corp",
  "provider": "saml",
  "name": "ACME Corporate SAML",
  "status": "active",
  "autoProvisioning": true,
  "justInTimeProvisioning": true,
  "saml": {
    "entityId": "https://threat-modeling.com/saml/metadata",
    "ssoUrl": "https://idp.acme.com/saml/sso",
    "sloUrl": "https://idp.acme.com/saml/slo",
    "x509Certificate": "-----BEGIN CERTIFICATE-----\nMIIC...\n-----END CERTIFICATE-----",
    "callbackUrl": "https://threat-modeling.com/auth/saml/callback",
    "signatureAlgorithm": "sha256",
    "wantAssertionsSigned": true,
    "wantAuthnResponseSigned": true,
    "nameIdFormat": "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress"
  },
  "attributeMapping": {
    "email": "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
    "firstName": "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname",
    "lastName": "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname",
    "groups": "http://schemas.microsoft.com/ws/2008/06/identity/claims/groups"
  },
  "roleMapping": [
    {
      "groupName": "ThreatModelingAdmins",
      "role": "admin",
      "priority": 1
    },
    {
      "groupName": "SecurityAnalysts",
      "role": "security_analyst",
      "priority": 2
    }
  ]
}
```

#### OpenID Connect (OIDC) Configuration
```json
{
  "organizationId": "tech-startup",
  "provider": "oidc",
  "name": "Auth0 OIDC",
  "status": "active",
  "autoProvisioning": true,
  "oidc": {
    "issuer": "https://acme.auth0.com",
    "clientId": "your-client-id",
    "clientSecret": "your-client-secret",
    "redirectUri": "https://threat-modeling.com/auth/oidc/callback",
    "scope": "openid profile email groups",
    "responseType": "code",
    "responseMode": "query"
  },
  "attributeMapping": {
    "email": "email",
    "firstName": "given_name",
    "lastName": "family_name",
    "groups": "https://threat-modeling.com/groups"
  }
}
```

#### Azure AD Configuration
```json
{
  "organizationId": "enterprise-corp",
  "provider": "azure-ad",
  "name": "Enterprise Azure AD",
  "status": "active",
  "autoProvisioning": true,
  "azureAd": {
    "tenantId": "your-tenant-id",
    "clientId": "your-client-id",
    "clientSecret": "your-client-secret",
    "redirectUri": "https://threat-modeling.com/auth/azure/callback",
    "scope": "User.Read Group.Read.All"
  },
  "attributeMapping": {
    "email": "mail",
    "firstName": "givenName",
    "lastName": "surname",
    "groups": "groups"
  }
}
```

## 🔐 Security Features

### Multi-Factor Authentication (MFA)

#### TOTP (Time-based One-Time Password)
```javascript
// Setup TOTP
const totpSetup = await mfaService.setupTOTP(userId, 'iPhone 12');

// Verify setup
const verification = await mfaService.verifyMFASetup(
  userId, 
  'totp', 
  '123456'
);
```

#### SMS Authentication
```javascript
// Setup SMS MFA
const smsSetup = await mfaService.setupSMS(userId, '+1234567890');

// Verify SMS code
const verification = await mfaService.verifyMFA({
  userId,
  provider: 'sms',
  code: '123456',
  ipAddress: '192.168.1.100',
  userAgent: 'Mozilla/5.0...'
});
```

#### WebAuthn (FIDO2)
```javascript
// Setup WebAuthn
const webauthnSetup = await mfaService.setupWebAuthn(userId, 'YubiKey 5');

// Verify WebAuthn
const verification = await mfaService.verifyMFA({
  userId,
  provider: 'webauthn',
  webauthnResponse: authenticatorResponse,
  ipAddress: '192.168.1.100'
});
```

### Adaptive Authentication

The system uses machine learning to assess risk and adapt authentication requirements:

```javascript
// Evaluate adaptive MFA
const decision = await mfaService.evaluateAdaptiveMFA(userId, {
  ipAddress: '203.0.113.1',
  userAgent: 'Mozilla/5.0...',
  location: { country: 'US', city: 'San Francisco' },
  deviceFingerprint: 'device-fingerprint-hash',
  timeOfDay: 14, // 2 PM
  dayOfWeek: 2   // Tuesday
});

// Decision includes:
// - requireMFA: boolean
// - riskScore: 0-1
// - riskLevel: 'low' | 'medium' | 'high'
// - recommendedProviders: MFAProvider[]
// - reasoning: string[]
```

### Risk Factors
- **Location**: New or suspicious geographic locations
- **Device**: Unrecognized devices or browsers
- **Network**: VPN, Tor, or malicious IP addresses
- **Behavioral**: Unusual access patterns or times
- **Velocity**: Multiple rapid login attempts
- **Threat Intelligence**: Known compromised credentials

## 📊 API Reference

### SSO Provider Management

#### Configure SSO Provider
```http
POST /api/auth/sso/providers
Content-Type: application/json
Authorization: Bearer {admin-token}

{
  "organizationId": "acme-corp",
  "provider": "saml",
  "name": "ACME SAML",
  "status": "active",
  "autoProvisioning": true,
  "saml": {
    "entityId": "https://threat-modeling.com/saml/metadata",
    "ssoUrl": "https://idp.acme.com/saml/sso",
    "x509Certificate": "-----BEGIN CERTIFICATE-----..."
  }
}
```

#### Test SSO Connection
```http
POST /api/auth/sso/providers/{providerId}/test
Content-Type: application/json
Authorization: Bearer {admin-token}

{
  "testType": "full",
  "saml": {
    "entityId": "test-entity",
    "ssoUrl": "https://idp.example.com/sso"
  }
}
```

### SSO Authentication Flow

#### Initiate SSO Login
```http
GET /api/auth/sso/login/saml?organizationId=acme-corp&RelayState=dashboard
```

#### SSO Callback
```http
POST /api/auth/sso/callback/saml
Content-Type: application/x-www-form-urlencoded

SAMLResponse=PHNhbWxwOlJlc3BvbnNlIHhtbG5zOnNh...
```

#### SSO Logout
```http
POST /api/auth/sso/logout
Content-Type: application/json
Authorization: Bearer {token}

{
  "redirectUrl": "https://threat-modeling.com/logged-out"
}
```

### MFA Operations

#### Setup MFA
```http
POST /api/auth/mfa/setup/totp
Content-Type: application/json
Authorization: Bearer {token}

{
  "deviceName": "iPhone 12"
}
```

#### Verify MFA
```http
POST /api/auth/mfa/verify
Content-Type: application/json
Authorization: Bearer {token}

{
  "provider": "totp",
  "code": "123456"
}
```

#### Generate Backup Codes
```http
POST /api/auth/mfa/backup-codes
Authorization: Bearer {token}
```

### Analytics and Monitoring

#### Get SSO Metrics
```http
GET /api/auth/sso/metrics
Authorization: Bearer {admin-token}
```

#### Get Active Sessions
```http
GET /api/auth/sso/sessions
Authorization: Bearer {admin-token}
```

#### Terminate Session
```http
DELETE /api/auth/sso/sessions/{sessionId}
Authorization: Bearer {admin-token}
```

## 🔧 Deployment

### Docker Compose
```yaml
version: '3.8'
services:
  auth-service:
    build: ./backend/services/auth
    ports:
      - "3001:3001"
    environment:
      - DATABASE_URL=postgresql://user:pass@db:5432/auth
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET=your-jwt-secret
    depends_on:
      - db
      - redis
    volumes:
      - ./backend/services/auth/certs:/app/certs
    networks:
      - threat-modeling-network

  db:
    image: postgres:15
    environment:
      - POSTGRES_DB=auth
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
    volumes:
      - postgres-data:/var/lib/postgresql/data
    networks:
      - threat-modeling-network

  redis:
    image: redis:7-alpine
    volumes:
      - redis-data:/data
    networks:
      - threat-modeling-network

volumes:
  postgres-data:
  redis-data:

networks:
  threat-modeling-network:
    driver: bridge
```

### Kubernetes Deployment
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: auth-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: auth-service
  template:
    metadata:
      labels:
        app: auth-service
    spec:
      containers:
      - name: auth-service
        image: threat-modeling/auth-service:latest
        ports:
        - containerPort: 3001
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: auth-secrets
              key: database-url
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: auth-secrets
              key: jwt-secret
        livenessProbe:
          httpGet:
            path: /health/live
            port: 3001
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 3001
          initialDelaySeconds: 5
          periodSeconds: 5
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
```

### Health Checks
```bash
# Basic health check
curl http://localhost:3001/health

# Detailed health check
curl http://localhost:3001/health/detailed

# Readiness check (Kubernetes)
curl http://localhost:3001/health/ready

# Liveness check (Kubernetes)
curl http://localhost:3001/health/live

# SSO-specific health check
curl http://localhost:3001/api/auth/sso/health
```

## 🧪 Testing

### Unit Tests
```bash
# Run all tests
npm test

# Run SSO tests specifically
npm test -- --testPathPattern=enterprise-sso

# Run MFA tests
npm test -- --testPathPattern=mfa

# Run with coverage
npm run test:coverage
```

### Integration Tests
```bash
# Run integration tests
npm run test:integration

# Run security tests
npm run test:security
```

### Load Testing
```bash
# Install artillery
npm install -g artillery

# Run load tests
artillery run load-test.yml
```

### Security Testing
```bash
# Run security scan
npm audit

# Run dependency check
npm run security:check

# Run OWASP ZAP scan
docker run -t owasp/zap2docker-stable zap-baseline.py \
  -t http://localhost:3001
```

## 🔍 Monitoring & Observability

### Metrics
The service exposes Prometheus metrics at `/metrics`:

```
# Authentication metrics
auth_login_attempts_total{method="sso",provider="saml"} 1500
auth_login_success_total{method="sso",provider="saml"} 1485
auth_login_failures_total{method="sso",provider="saml"} 15

# MFA metrics
mfa_setup_total{provider="totp"} 450
mfa_verification_attempts_total{provider="totp"} 2340
mfa_verification_success_total{provider="totp"} 2298

# Session metrics
active_sessions_total 847
session_duration_seconds{quantile="0.5"} 1800
session_duration_seconds{quantile="0.95"} 7200

# Risk metrics
risk_score_distribution{level="low"} 0.75
risk_score_distribution{level="medium"} 0.20
risk_score_distribution{level="high"} 0.05
```

### Logging
Structured JSON logging with correlation IDs:

```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "level": "info",
  "message": "SSO authentication successful",
  "correlationId": "req-123-456",
  "userId": "user-789",
  "organizationId": "acme-corp",
  "provider": "saml",
  "sessionId": "session-abc-123",
  "ipAddress": "192.168.1.100",
  "userAgent": "Mozilla/5.0...",
  "responseTime": 245,
  "riskScore": 0.15
}
```

### Alerting
Common alerts to configure:

```yaml
# High failure rate
- alert: SSOHighFailureRate
  expr: rate(auth_login_failures_total[5m]) > 0.1
  for: 2m
  labels:
    severity: warning
  annotations:
    summary: "High SSO failure rate detected"

# MFA bypass attempts
- alert: MFABypassAttempts
  expr: increase(mfa_bypass_attempts_total[5m]) > 5
  for: 0m
  labels:
    severity: critical
  annotations:
    summary: "Multiple MFA bypass attempts detected"

# High risk score
- alert: HighRiskAuthentication
  expr: rate(risk_score_distribution{level="high"}[5m]) > 0.1
  for: 1m
  labels:
    severity: warning
  annotations:
    summary: "High risk authentication attempts detected"
```

## 📋 Compliance & Audit

### Audit Events
All authentication events are logged for compliance:

```json
{
  "eventId": "evt-123-456",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "eventType": "SSO_LOGIN_SUCCESS",
  "userId": "user-789",
  "organizationId": "acme-corp",
  "sessionId": "session-abc-123",
  "details": {
    "provider": "saml",
    "ipAddress": "192.168.1.100",
    "userAgent": "Mozilla/5.0...",
    "riskScore": 0.15,
    "mfaUsed": true,
    "mfaProvider": "totp"
  },
  "complianceFlags": ["GDPR", "SOC2"],
  "retentionDate": "2031-01-15T10:30:00.000Z"
}
```

### GDPR Compliance
- **Data Minimization**: Only collect necessary authentication data
- **Right to Access**: API endpoints for user data export
- **Right to Deletion**: Secure data deletion with audit trails
- **Consent Management**: Granular consent for data processing
- **Data Portability**: Export authentication data in standard formats

### SOC2 Compliance
- **Security**: Encrypted data at rest and in transit
- **Availability**: High availability deployment with monitoring
- **Processing Integrity**: Input validation and secure processing
- **Confidentiality**: Access controls and data classification
- **Privacy**: Privacy controls and data handling procedures

## 🚨 Troubleshooting

### Common Issues

#### SAML Authentication Failures
```bash
# Check SAML configuration
curl -X POST http://localhost:3001/api/auth/sso/providers/test \
  -H "Content-Type: application/json" \
  -d '{"provider": "saml", "testType": "metadata"}'

# Validate certificate
openssl x509 -in certificate.pem -text -noout

# Check logs
docker logs auth-service | grep "SAML"
```

#### MFA Issues
```bash
# Check MFA status
curl -X GET http://localhost:3001/api/auth/mfa/status \
  -H "Authorization: Bearer {token}"

# Verify TOTP time sync
date -u
```

#### Performance Issues
```bash
# Check metrics
curl http://localhost:3001/metrics | grep auth_

# Monitor resource usage
docker stats auth-service

# Check database performance
EXPLAIN ANALYZE SELECT * FROM auth_sessions WHERE active = true;
```

### Error Codes

| Code | Description | Solution |
|------|-------------|----------|
| AUTH_001 | Invalid SSO configuration | Check provider configuration |
| AUTH_002 | SAML signature validation failed | Verify certificates |
| AUTH_003 | MFA verification failed | Check time synchronization |
| AUTH_004 | Session expired | Refresh session |
| AUTH_005 | Rate limit exceeded | Implement backoff |
| AUTH_006 | Risk score too high | Enable MFA |
| AUTH_007 | Organization mismatch | Check user organization |
| AUTH_008 | Provider not found | Verify provider configuration |

## 🔧 Development

### Setup Development Environment
```bash
# Clone repository
git clone https://github.com/your-org/threat-modeling-platform.git
cd threat-modeling-platform/backend/services/auth

# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env with your configuration

# Start development server
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

### Code Quality
```bash
# Linting
npm run lint
npm run lint:fix

# Type checking
npm run typecheck

# Security scan
npm audit
npm run security:check

# Code formatting
npm run format
```

### Contributing
1. Fork the repository
2. Create a feature branch
3. Write tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## 🔗 Integration Examples

### Frontend Integration (React)
```javascript
import { SSOClient } from '@threat-modeling/sso-client';

const ssoClient = new SSOClient({
  baseUrl: 'https://api.threat-modeling.com',
  organizationId: 'acme-corp'
});

// Initiate SSO login
const loginUrl = await ssoClient.initiateLogin('saml');
window.location.href = loginUrl;

// Handle callback
const tokens = await ssoClient.handleCallback(window.location.search);
localStorage.setItem('accessToken', tokens.accessToken);
```

### Mobile Integration (React Native)
```javascript
import { SSOClient } from '@threat-modeling/sso-mobile';

const ssoClient = new SSOClient({
  baseUrl: 'https://api.threat-modeling.com',
  organizationId: 'acme-corp'
});

// Biometric authentication
const biometricResult = await ssoClient.authenticateBiometric();
if (biometricResult.success) {
  // Handle successful authentication
}
```

### API Integration (Node.js)
```javascript
const { AuthClient } = require('@threat-modeling/auth-client');

const authClient = new AuthClient({
  baseUrl: 'https://api.threat-modeling.com',
  clientId: 'your-client-id',
  clientSecret: 'your-client-secret'
});

// Validate token
const user = await authClient.validateToken(accessToken);
console.log('Authenticated user:', user);
```

## 📚 Additional Resources

### Documentation
- [SAML 2.0 Specification](https://docs.oasis-open.org/security/saml/v2.0/)
- [OpenID Connect Core 1.0](https://openid.net/specs/openid-connect-core-1_0.html)
- [OAuth 2.0 Authorization Framework](https://tools.ietf.org/html/rfc6749)
- [WebAuthn Level 2](https://w3c.github.io/webauthn/)

### Security Best Practices
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [NIST Digital Identity Guidelines](https://pages.nist.gov/800-63-3/)
- [Security Assertion Markup Language (SAML) V2.0 Security Considerations](https://docs.oasis-open.org/security/saml/v2.0/saml-sec-consider-2.0-os.pdf)

### Community
- [GitHub Repository](https://github.com/your-org/threat-modeling-platform)
- [Security Discussions](https://github.com/your-org/threat-modeling-platform/discussions)
- [Issue Tracker](https://github.com/your-org/threat-modeling-platform/issues)

---

## 📊 Implementation Summary

The Enterprise SSO & Authentication System has been successfully implemented with:

✅ **Complete SSO Support**: SAML 2.0, OIDC, OAuth 2.0, LDAP, Azure AD, Google Workspace, Okta, PingIdentity  
✅ **Advanced MFA**: TOTP, SMS, Email, WebAuthn, Biometric, Push notifications  
✅ **Adaptive Security**: ML-powered risk assessment and conditional access  
✅ **Enterprise Features**: Multi-tenant, high availability, SCIM provisioning  
✅ **Compliance Ready**: GDPR, SOC2, HIPAA audit trails and controls  
✅ **Production Ready**: Comprehensive testing, monitoring, and documentation  

**Status: IMPLEMENTATION COMPLETE ✅**

This system provides enterprise-grade authentication and SSO capabilities, positioning the Threat Modeling Platform as the world's #1 solution for secure, scalable threat modeling.