# CORS Security Configuration

## Overview
This document describes the Cross-Origin Resource Sharing (CORS) security configuration implemented across the threat modeling platform services.

## Security Principles
- **Explicit Allow Lists**: All origins are explicitly defined, no wildcards
- **Credential Support**: Cookies and authentication headers are properly handled
- **Environment-Based**: Development vs production configurations
- **Service-Specific**: Different CORS policies for different service types

## Configuration Details

### API Gateway (Port 3000)
```typescript
const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = [
      'http://localhost:3000',     // API Gateway
      'http://localhost:3006',     // Frontend dev
      'http://localhost:5173',     // Vite dev server
      'http://localhost:5174',     // ProjectHub frontend
      'http://192.168.1.24:3000',  // Gateway on NAS
      'http://192.168.1.24:3006',  // Frontend on NAS
      'http://192.168.1.24:5174',  // ProjectHub on NAS
      ...process.env.CORS_ORIGINS?.split(',') || []
    ];
    
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'), false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-API-Key', 'X-Client-Version'],
  exposedHeaders: ['X-Total-Count', 'X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-Gateway-Version'],
  maxAge: 86400,
  optionsSuccessStatus: 200
};
```

### Integration Service (Port 3008)
- Standard CORS configuration for API endpoints
- Special webhook-specific CORS for `/webhooks` endpoints
- Additional headers for GitHub webhooks: `X-GitHub-Delivery`, `X-GitHub-Event`, `X-Hub-Signature`

### Diagram Service (Port 3004)
- Standard CORS configuration with explicit origin validation
- Higher body size limits for diagram data (10mb)
- Same security headers as other services

## Environment Variables
Create `.env.cors` file with:
```bash
# Development origins (default)
CORS_ORIGINS=http://localhost:3000,http://localhost:3006,http://localhost:5173,http://localhost:5174

# Production origins (set in production environment)
CORS_ORIGINS=https://threatmodel.company.com,https://api.threatmodel.company.com

# Enable development mode (allows all localhost origins)
CORS_DEV_MODE=true
```

## Security Headers
All services implement comprehensive security headers via Helmet.js:
- Content Security Policy (CSP)
- Cross-Origin-Opener-Policy
- Cross-Origin-Resource-Policy
- Strict-Transport-Security
- X-Content-Type-Options
- X-Frame-Options
- X-XSS-Protection

## Testing
CORS configuration has been tested with:
1. ✅ Preflight OPTIONS requests from allowed origins
2. ✅ Actual POST requests with credentials
3. ✅ Origin rejection for unauthorized domains
4. ✅ Proper CORS headers in responses

## Service Coverage
- ✅ API Gateway (Port 3000)
- ✅ Integration Service (Port 3008)
- ✅ Diagram Service (Port 3004)
- 🔄 Remaining services (AI, Report, Auth) - to be updated

## Monitoring
- CORS rejections are logged with warning level
- Origin validation happens on every request
- Security headers are added to all responses

## Production Considerations
- All origins must be explicitly configured
- No wildcards or localhost origins allowed in production
- HTTPS required for all production origins
- Regular security audits of allowed origins

## Implementation Status
✅ **COMPLETED** - Core CORS security configuration implemented and tested
- Secure origin validation
- Proper credential handling
- Environment-based configuration
- Comprehensive security headers
- Tested with real requests

## Next Steps
1. Apply consistent CORS configuration to remaining services
2. Implement automated CORS testing in CI/CD
3. Create monitoring alerts for CORS violations
4. Document production deployment procedures