# Security Policy

## 🛡️ Security Standards

The Threat Modeling Platform is built with security as a top priority. We follow industry best practices and continuously monitor for vulnerabilities.

### Security Features

- **Authentication**: JWT with refresh tokens, SSO/SAML/OIDC support
- **Authorization**: Role-based access control (RBAC) with fine-grained permissions
- **Encryption**: 
  - TLS 1.3 for all data in transit
  - AES-256-GCM for sensitive data at rest
  - Encrypted database connections
- **Input Validation**: Strict validation on all user inputs
- **Output Encoding**: Context-aware encoding to prevent XSS
- **Security Headers**: OWASP recommended security headers
- **Rate Limiting**: API rate limiting per user and IP
- **Audit Logging**: Comprehensive logging of all security events

## 🔍 Supported Versions

We provide security updates for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| 0.x.x   | :x:                |

## 🚨 Reporting a Vulnerability

We take the security of our platform seriously. If you believe you have found a security vulnerability, please report it to us responsibly.

### Where to Report

**Please DO NOT report security vulnerabilities through public GitHub issues.**

Instead, please report them via one of these methods:

1. **Email**: security@threatmodeling.io
2. **Security Form**: https://threatmodeling.io/security-report
3. **HackerOne**: https://hackerone.com/threatmodeling (if available)

### What to Include

Please include the following information:

- Type of vulnerability (e.g., XSS, SQL Injection, Authentication Bypass)
- Affected component(s)
- Steps to reproduce
- Proof of concept (if possible)
- Impact assessment
- Your recommended fix (if any)

### Response Timeline

- **Initial Response**: Within 24 hours
- **Triage**: Within 48 hours
- **Status Update**: Within 5 business days
- **Resolution**: Varies based on severity

### Severity Levels

We use CVSS v3.1 for scoring vulnerabilities:

- **Critical** (9.0-10.0): Immediate patch release
- **High** (7.0-8.9): Patch within 7 days
- **Medium** (4.0-6.9): Patch within 30 days
- **Low** (0.1-3.9): Patch in next regular release

## 🏆 Recognition

We appreciate responsible disclosure and recognize security researchers who help us maintain platform security:

- Acknowledgment in release notes
- Entry in our [Security Hall of Fame](https://threatmodeling.io/security-hall-of-fame)
- Potential bug bounty rewards (case-by-case basis)

## 🔐 Security Best Practices for Deployment

### Environment Configuration

1. **Use strong passwords**: All default passwords must be changed
2. **Enable 2FA**: For all administrative accounts
3. **Restrict network access**: Use firewalls and VPNs
4. **Keep dependencies updated**: Regular security patches
5. **Monitor logs**: Set up alerting for suspicious activities

### Secure Deployment Checklist

- [ ] Change all default passwords
- [ ] Configure TLS certificates
- [ ] Enable security headers
- [ ] Set up rate limiting
- [ ] Configure CORS properly
- [ ] Enable audit logging
- [ ] Set up backup encryption
- [ ] Configure firewall rules
- [ ] Enable intrusion detection
- [ ] Set up security monitoring

### Database Security

```sql
-- Example: Enable row-level security
ALTER TABLE threats ENABLE ROW LEVEL SECURITY;

-- Create policy for organization isolation
CREATE POLICY org_isolation ON threats
    USING (organization_id = current_setting('app.current_org_id')::uuid);
```

### API Security

```typescript
// Example: Input validation middleware
const validateThreatInput = [
  body('title').isString().trim().isLength({ min: 1, max: 255 }),
  body('description').optional().isString().trim(),
  body('likelihood').isInt({ min: 1, max: 5 }),
  body('impact').isInt({ min: 1, max: 5 }),
  handleValidationErrors
];
```

## 📋 Security Compliance

The platform is designed to help meet various compliance requirements:

- **GDPR**: Data protection and privacy features
- **ISO 27001**: Information security management
- **SOC 2**: Security, availability, and confidentiality
- **NIST**: Cybersecurity framework alignment
- **OWASP**: Application security best practices

## 🔄 Security Updates

### Staying Informed

- **Security Advisories**: https://github.com/anubissbe/threat-modeling-platform/security/advisories
- **Mailing List**: security-announce@threatmodeling.io
- **RSS Feed**: https://threatmodeling.io/security/feed.xml

### Update Process

```bash
# Check for security updates
npm audit

# Apply security patches
npm audit fix

# Update to latest secure version
npm update --save
```

## 🛠️ Security Tools Integration

The platform integrates with various security tools:

- **SAST**: SonarQube, Checkmarx
- **DAST**: OWASP ZAP, Burp Suite
- **Dependency Scanning**: Snyk, GitHub Dependabot
- **Container Scanning**: Trivy, Clair
- **Secret Detection**: GitLeaks, TruffleHog

## 📞 Contact

For security-related questions that are not vulnerabilities:

- **Email**: security@threatmodeling.io
- **Documentation**: https://docs.threatmodeling.io/security
- **Community**: Use #security channel in our Discord

---

Thank you for helping us keep the Threat Modeling Platform secure! 🙏