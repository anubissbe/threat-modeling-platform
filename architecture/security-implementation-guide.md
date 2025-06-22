# Security Implementation Guide

## Overview

This guide provides practical implementation details for the security architecture, including code examples, configuration templates, and best practices for developers.

## Authentication Implementation

### JWT Service Implementation

```typescript
// services/auth/src/jwt.service.ts
import { Injectable } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class JwtService {
  private readonly algorithm = 'RS256';
  private readonly accessTokenTTL = 15 * 60; // 15 minutes
  private readonly refreshTokenTTL = 7 * 24 * 60 * 60; // 7 days

  constructor(
    private config: ConfigService,
    private redis: Redis,
    private keyManager: KeyManagementService
  ) {}

  async generateTokenPair(user: User, sessionId: string): Promise<TokenPair> {
    const tokenId = uuidv4();
    const tokenFamily = uuidv4();
    
    const accessToken = await this.generateAccessToken(user, sessionId, tokenId);
    const refreshToken = await this.generateRefreshToken(user, sessionId, tokenFamily);
    
    // Store refresh token in Redis with encryption
    await this.storeRefreshToken(refreshToken, user.id, sessionId, tokenFamily);
    
    return { accessToken, refreshToken };
  }

  private async generateAccessToken(
    user: User, 
    sessionId: string, 
    tokenId: string
  ): Promise<string> {
    const privateKey = await this.keyManager.getSigningKey();
    
    const payload: AccessTokenPayload = {
      sub: user.id,
      iss: this.config.get('JWT_ISSUER'),
      aud: this.config.get('JWT_AUDIENCE'),
      exp: Math.floor(Date.now() / 1000) + this.accessTokenTTL,
      iat: Math.floor(Date.now() / 1000),
      jti: tokenId,
      org: user.organizationId,
      roles: user.roles.map(r => r.name),
      permissions: await this.getUserPermissions(user),
      session_id: sessionId,
      auth_time: Math.floor(Date.now() / 1000),
      amr: this.getAuthMethods(user)
    };

    return jwt.sign(payload, privateKey, {
      algorithm: this.algorithm,
      keyid: await this.keyManager.getCurrentKeyId()
    });
  }

  async validateAccessToken(token: string): Promise<AccessTokenPayload> {
    try {
      const publicKey = await this.keyManager.getVerificationKey();
      const payload = jwt.verify(token, publicKey, {
        algorithms: [this.algorithm],
        issuer: this.config.get('JWT_ISSUER'),
        audience: this.config.get('JWT_AUDIENCE')
      }) as AccessTokenPayload;

      // Check if token is blacklisted
      const isBlacklisted = await this.redis.get(`blacklist:${payload.jti}`);
      if (isBlacklisted) {
        throw new UnauthorizedException('Token has been revoked');
      }

      // Validate session
      const session = await this.redis.get(`session:${payload.session_id}`);
      if (!session) {
        throw new UnauthorizedException('Session expired');
      }

      return payload;
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }

  private async storeRefreshToken(
    token: string, 
    userId: string, 
    sessionId: string,
    tokenFamily: string
  ): Promise<void> {
    const encrypted = await this.encrypt(token);
    const key = `refresh:${userId}:${sessionId}`;
    
    await this.redis.setex(
      key, 
      this.refreshTokenTTL,
      JSON.stringify({
        token: encrypted,
        family: tokenFamily,
        createdAt: new Date().toISOString()
      })
    );
  }

  private async encrypt(data: string): Promise<string> {
    return this.keyManager.encrypt(data, 'token-encryption');
  }
}
```

### Password Service Implementation

```typescript
// services/auth/src/password.service.ts
import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as zxcvbn from 'zxcvbn';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PasswordService {
  private readonly minLength = 12;
  private readonly bcryptRounds = 12;
  private readonly maxLoginAttempts = 5;
  private readonly lockoutDuration = 15 * 60 * 1000; // 15 minutes

  constructor(
    private config: ConfigService,
    private userRepo: UserRepository,
    private auditService: AuditService
  ) {}

  async hashPassword(password: string): Promise<string> {
    // Add pepper before hashing
    const pepper = this.config.get('PASSWORD_PEPPER');
    const pepperedPassword = password + pepper;
    
    return bcrypt.hash(pepperedPassword, this.bcryptRounds);
  }

  async validatePassword(
    password: string, 
    hashedPassword: string,
    userId: string
  ): Promise<boolean> {
    // Check if account is locked
    const lockoutKey = `lockout:${userId}`;
    const lockoutData = await this.redis.get(lockoutKey);
    
    if (lockoutData) {
      const lockout = JSON.parse(lockoutData);
      if (Date.now() < lockout.until) {
        throw new AccountLockedException(
          `Account locked until ${new Date(lockout.until).toISOString()}`
        );
      }
    }

    const pepper = this.config.get('PASSWORD_PEPPER');
    const isValid = await bcrypt.compare(password + pepper, hashedPassword);

    if (!isValid) {
      await this.handleFailedLogin(userId);
      return false;
    }

    // Reset failed attempts on successful login
    await this.redis.del(`failed_attempts:${userId}`);
    return true;
  }

  async checkPasswordStrength(password: string): Promise<PasswordStrengthResult> {
    const result = zxcvbn(password);
    
    // Custom checks
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChars = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    const meetsRequirements = 
      password.length >= this.minLength &&
      hasUppercase &&
      hasLowercase &&
      hasNumbers &&
      hasSpecialChars;

    return {
      score: result.score,
      feedback: result.feedback,
      meetsRequirements,
      details: {
        length: password.length,
        hasUppercase,
        hasLowercase,
        hasNumbers,
        hasSpecialChars
      }
    };
  }

  private async handleFailedLogin(userId: string): Promise<void> {
    const attemptsKey = `failed_attempts:${userId}`;
    const attempts = await this.redis.incr(attemptsKey);
    
    // Set expiry on first attempt
    if (attempts === 1) {
      await this.redis.expire(attemptsKey, 24 * 60 * 60); // 24 hours
    }

    // Lock account after max attempts
    if (attempts >= this.maxLoginAttempts) {
      const lockoutKey = `lockout:${userId}`;
      const lockoutUntil = Date.now() + this.lockoutDuration;
      
      await this.redis.setex(
        lockoutKey,
        Math.ceil(this.lockoutDuration / 1000),
        JSON.stringify({
          attempts,
          until: lockoutUntil,
          lockedAt: new Date().toISOString()
        })
      );

      await this.auditService.log({
        action: 'account_locked',
        userId,
        details: { attempts, duration: this.lockoutDuration }
      });
    }
  }
}
```

### MFA Service Implementation

```typescript
// services/auth/src/mfa.service.ts
import { Injectable } from '@nestjs/common';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MfaService {
  constructor(
    private config: ConfigService,
    private smsService: SmsService,
    private emailService: EmailService,
    private cryptoService: CryptoService
  ) {}

  async setupTotp(user: User): Promise<TotpSetupResult> {
    const secret = speakeasy.generateSecret({
      length: 32,
      name: `ThreatModel.io (${user.email})`,
      issuer: 'ThreatModel.io'
    });

    // Encrypt secret before storing
    const encryptedSecret = await this.cryptoService.encrypt(secret.base32);
    
    // Generate QR code
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

    return {
      secret: secret.base32,
      qrCode: qrCodeUrl,
      backupCodes: await this.generateBackupCodes(user.id)
    };
  }

  async verifyTotp(
    user: User, 
    token: string, 
    window: number = 1
  ): Promise<boolean> {
    const encryptedSecret = await this.getUserTotpSecret(user.id);
    const secret = await this.cryptoService.decrypt(encryptedSecret);

    const isValid = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window,
      algorithm: 'sha256'
    });

    if (isValid) {
      await this.auditService.log({
        action: 'mfa_success',
        userId: user.id,
        method: 'totp'
      });
    }

    return isValid;
  }

  async sendSmsCode(user: User): Promise<void> {
    const code = this.generateNumericCode(6);
    const hashedCode = await this.hashCode(code);
    
    // Store code with expiry
    await this.redis.setex(
      `sms_code:${user.id}`,
      300, // 5 minutes
      JSON.stringify({
        code: hashedCode,
        attempts: 0,
        sentAt: new Date().toISOString()
      })
    );

    await this.smsService.send({
      to: user.phoneNumber,
      message: `Your ThreatModel.io verification code is: ${code}`
    });
  }

  async verifySmsCode(user: User, code: string): Promise<boolean> {
    const key = `sms_code:${user.id}`;
    const data = await this.redis.get(key);
    
    if (!data) {
      throw new BadRequestException('Code expired or not found');
    }

    const { code: hashedCode, attempts } = JSON.parse(data);
    
    // Check attempts
    if (attempts >= 3) {
      await this.redis.del(key);
      throw new TooManyAttemptsException('Too many attempts');
    }

    // Increment attempts
    await this.redis.set(key, JSON.stringify({
      ...JSON.parse(data),
      attempts: attempts + 1
    }));

    const isValid = await this.verifyCode(code, hashedCode);
    
    if (isValid) {
      await this.redis.del(key);
      await this.auditService.log({
        action: 'mfa_success',
        userId: user.id,
        method: 'sms'
      });
    }

    return isValid;
  }

  private async generateBackupCodes(userId: string): Promise<string[]> {
    const codes: string[] = [];
    
    for (let i = 0; i < 10; i++) {
      const code = this.generateAlphanumericCode(8);
      const hashedCode = await this.hashCode(code);
      codes.push(code);
      
      // Store hashed backup code
      await this.redis.sadd(`backup_codes:${userId}`, hashedCode);
    }

    return codes;
  }

  private generateNumericCode(length: number): string {
    return Array.from(
      { length }, 
      () => Math.floor(Math.random() * 10)
    ).join('');
  }

  private generateAlphanumericCode(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    return Array.from(
      { length },
      () => chars[Math.floor(Math.random() * chars.length)]
    ).join('');
  }
}
```

## Authorization Implementation

### Policy Engine Implementation

```typescript
// services/authz/src/policy-engine.ts
import { Injectable } from '@nestjs/common';
import { PolicyEvaluator } from './policy-evaluator';
import { AttributeResolver } from './attribute-resolver';

@Injectable()
export class PolicyEngine {
  constructor(
    private policyRepo: PolicyRepository,
    private evaluator: PolicyEvaluator,
    private resolver: AttributeResolver,
    private cache: CacheService
  ) {}

  async authorize(context: AuthorizationContext): Promise<AuthorizationResult> {
    const startTime = Date.now();
    
    try {
      // Check cache first
      const cacheKey = this.buildCacheKey(context);
      const cachedResult = await this.cache.get(cacheKey);
      if (cachedResult) {
        return JSON.parse(cachedResult);
      }

      // Resolve all attributes
      const enrichedContext = await this.resolver.resolve(context);

      // Get applicable policies
      const policies = await this.getApplicablePolicies(enrichedContext);

      // Evaluate policies
      const decisions = await Promise.all(
        policies.map(policy => this.evaluator.evaluate(policy, enrichedContext))
      );

      // Combine decisions
      const result = this.combineDecisions(decisions);

      // Cache the result
      await this.cache.setex(cacheKey, 300, JSON.stringify(result));

      // Audit the decision
      await this.auditDecision(enrichedContext, result, Date.now() - startTime);

      return result;
    } catch (error) {
      // Fail secure - deny on any error
      return {
        decision: 'deny',
        reason: 'Authorization error',
        error: error.message
      };
    }
  }

  private async getApplicablePolicies(
    context: EnrichedContext
  ): Promise<Policy[]> {
    // Get all policies
    const allPolicies = await this.policyRepo.findActive();

    // Filter applicable policies
    return allPolicies.filter(policy => {
      // Check resource type
      if (policy.resourceType && policy.resourceType !== context.resource.type) {
        return false;
      }

      // Check action
      if (policy.actions && !policy.actions.includes(context.action)) {
        return false;
      }

      // Check conditions
      if (policy.conditions) {
        return this.evaluator.evaluateConditions(policy.conditions, context);
      }

      return true;
    }).sort((a, b) => b.priority - a.priority); // Higher priority first
  }

  private combineDecisions(decisions: PolicyDecision[]): AuthorizationResult {
    // Explicit deny takes precedence
    const deny = decisions.find(d => d.effect === 'deny');
    if (deny) {
      return {
        decision: 'deny',
        reason: deny.reason,
        policy: deny.policyId
      };
    }

    // At least one allow required
    const allow = decisions.find(d => d.effect === 'allow');
    if (allow) {
      return {
        decision: 'allow',
        reason: allow.reason,
        policy: allow.policyId,
        obligations: this.collectObligations(decisions)
      };
    }

    // Default deny
    return {
      decision: 'deny',
      reason: 'No applicable allow policy'
    };
  }

  private collectObligations(decisions: PolicyDecision[]): Obligation[] {
    return decisions
      .filter(d => d.obligations)
      .flatMap(d => d.obligations)
      .filter((v, i, a) => a.findIndex(o => o.id === v.id) === i); // Unique
  }

  private async auditDecision(
    context: EnrichedContext,
    result: AuthorizationResult,
    duration: number
  ): Promise<void> {
    await this.auditService.logAuthzDecision({
      timestamp: new Date(),
      subject: context.subject,
      action: context.action,
      resource: context.resource,
      decision: result.decision,
      reason: result.reason,
      policy: result.policy,
      duration
    });
  }
}
```

### ABAC Attribute Resolver

```typescript
// services/authz/src/attribute-resolver.ts
import { Injectable } from '@nestjs/common';

@Injectable()
export class AttributeResolver {
  constructor(
    private userService: UserService,
    private resourceService: ResourceService,
    private contextService: ContextService
  ) {}

  async resolve(context: AuthorizationContext): Promise<EnrichedContext> {
    const [
      subjectAttrs,
      resourceAttrs,
      environmentAttrs
    ] = await Promise.all([
      this.resolveSubjectAttributes(context.subject),
      this.resolveResourceAttributes(context.resource),
      this.resolveEnvironmentAttributes(context.environment)
    ]);

    return {
      ...context,
      subject: { ...context.subject, ...subjectAttrs },
      resource: { ...context.resource, ...resourceAttrs },
      environment: { ...context.environment, ...environmentAttrs }
    };
  }

  private async resolveSubjectAttributes(
    subject: Subject
  ): Promise<SubjectAttributes> {
    const user = await this.userService.findById(subject.id);
    
    return {
      roles: user.roles.map(r => r.name),
      permissions: await this.userService.getAllPermissions(user.id),
      organizationId: user.organizationId,
      department: user.department,
      clearanceLevel: user.clearanceLevel,
      seniority: this.calculateSeniority(user.createdAt),
      attributes: user.customAttributes
    };
  }

  private async resolveResourceAttributes(
    resource: Resource
  ): Promise<ResourceAttributes> {
    const fullResource = await this.resourceService.findById(
      resource.id, 
      resource.type
    );

    return {
      owner: fullResource.ownerId,
      organization: fullResource.organizationId,
      project: fullResource.projectId,
      classification: fullResource.dataClassification,
      sensitivity: fullResource.sensitivityLevel,
      tags: fullResource.tags,
      status: fullResource.status,
      createdAt: fullResource.createdAt,
      attributes: fullResource.customAttributes
    };
  }

  private async resolveEnvironmentAttributes(
    environment: Environment
  ): Promise<EnvironmentAttributes> {
    return {
      time: new Date(),
      dayOfWeek: new Date().getDay(),
      isWeekend: [0, 6].includes(new Date().getDay()),
      isBusinessHours: this.isBusinessHours(),
      ipAddress: environment.ipAddress,
      country: await this.getCountryFromIp(environment.ipAddress),
      deviceType: environment.deviceType,
      riskScore: await this.calculateRiskScore(environment)
    };
  }

  private calculateSeniority(joinDate: Date): number {
    const years = (Date.now() - joinDate.getTime()) / (365 * 24 * 60 * 60 * 1000);
    return Math.floor(years);
  }

  private isBusinessHours(): boolean {
    const hour = new Date().getHours();
    return hour >= 9 && hour < 17;
  }

  private async getCountryFromIp(ip: string): Promise<string> {
    // Implementation would use GeoIP service
    return this.geoIpService.getCountry(ip);
  }

  private async calculateRiskScore(environment: Environment): Promise<number> {
    // Implementation would calculate risk based on various factors
    return this.riskService.calculate(environment);
  }
}
```

### Permission Service Implementation

```typescript
// services/authz/src/permission.service.ts
import { Injectable } from '@nestjs/common';

@Injectable()
export class PermissionService {
  constructor(
    private roleRepo: RoleRepository,
    private permissionRepo: PermissionRepository,
    private cache: CacheService
  ) {}

  async getUserPermissions(userId: string): Promise<string[]> {
    const cacheKey = `permissions:${userId}`;
    const cached = await this.cache.get(cacheKey);
    
    if (cached) {
      return JSON.parse(cached);
    }

    // Get user's roles
    const userRoles = await this.roleRepo.findByUserId(userId);
    
    // Get role hierarchy
    const allRoles = await this.expandRoleHierarchy(userRoles);
    
    // Get all permissions
    const permissions = new Set<string>();
    
    for (const role of allRoles) {
      const rolePermissions = await this.permissionRepo.findByRoleId(role.id);
      rolePermissions.forEach(p => permissions.add(p.permission));
    }

    // Add user-specific permissions
    const userPermissions = await this.permissionRepo.findByUserId(userId);
    userPermissions.forEach(p => permissions.add(p.permission));

    const result = Array.from(permissions);
    
    // Cache for 5 minutes
    await this.cache.setex(cacheKey, 300, JSON.stringify(result));
    
    return result;
  }

  async checkPermission(
    userId: string, 
    permission: string,
    context?: PermissionContext
  ): Promise<boolean> {
    const userPermissions = await this.getUserPermissions(userId);
    
    // Check exact match
    if (userPermissions.includes(permission)) {
      return true;
    }

    // Check wildcard permissions
    const wildcardMatch = this.checkWildcardPermissions(
      userPermissions, 
      permission
    );
    
    if (wildcardMatch) {
      return true;
    }

    // Check contextual permissions
    if (context) {
      return this.checkContextualPermission(
        userPermissions, 
        permission, 
        context
      );
    }

    return false;
  }

  private checkWildcardPermissions(
    userPermissions: string[], 
    required: string
  ): boolean {
    const parts = required.split(':');
    
    for (let i = parts.length; i > 0; i--) {
      const wildcard = parts.slice(0, i).join(':') + ':*';
      if (userPermissions.includes(wildcard)) {
        return true;
      }
    }

    // Check for full wildcard
    return userPermissions.includes('*:*:*') || userPermissions.includes('*');
  }

  private async checkContextualPermission(
    userPermissions: string[],
    required: string,
    context: PermissionContext
  ): Promise<boolean> {
    // Parse permission
    const [resource, action, scope] = required.split(':');
    
    // Check scoped permissions
    if (scope === 'own' && context.ownerId) {
      const ownPermission = `${resource}:${action}:own`;
      if (userPermissions.includes(ownPermission) && 
          context.userId === context.ownerId) {
        return true;
      }
    }

    if (scope === 'team' && context.teamId) {
      const teamPermission = `${resource}:${action}:team`;
      const userTeams = await this.getUserTeams(context.userId);
      if (userPermissions.includes(teamPermission) && 
          userTeams.includes(context.teamId)) {
        return true;
      }
    }

    if (scope === 'org' && context.organizationId) {
      const orgPermission = `${resource}:${action}:org`;
      const userOrg = await this.getUserOrganization(context.userId);
      if (userPermissions.includes(orgPermission) && 
          userOrg === context.organizationId) {
        return true;
      }
    }

    return false;
  }

  private async expandRoleHierarchy(roles: Role[]): Promise<Role[]> {
    const expanded = new Set<Role>();
    const queue = [...roles];
    
    while (queue.length > 0) {
      const role = queue.shift();
      if (!expanded.has(role)) {
        expanded.add(role);
        
        // Add inherited roles
        const inherited = await this.roleRepo.findInherited(role.id);
        queue.push(...inherited);
      }
    }

    return Array.from(expanded);
  }
}
```

## Encryption Implementation

### Encryption Service

```typescript
// services/crypto/src/encryption.service.ts
import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { KeyManagementService } from './key-management.service';

@Injectable()
export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly ivLength = 16;
  private readonly saltLength = 32;
  private readonly tagLength = 16;
  private readonly pbkdf2Iterations = 100000;

  constructor(
    private keyManager: KeyManagementService,
    private auditService: AuditService
  ) {}

  async encryptData(
    plaintext: string | Buffer,
    context: EncryptionContext
  ): Promise<EncryptedData> {
    // Get encryption key
    const masterKey = await this.keyManager.getDataEncryptionKey(context.purpose);
    
    // Generate random IV and salt
    const iv = crypto.randomBytes(this.ivLength);
    const salt = crypto.randomBytes(this.saltLength);
    
    // Derive key from master key
    const key = crypto.pbkdf2Sync(
      masterKey,
      salt,
      this.pbkdf2Iterations,
      32,
      'sha256'
    );

    // Create cipher
    const cipher = crypto.createCipheriv(this.algorithm, key, iv);
    
    // Add additional authenticated data
    const aad = Buffer.from(JSON.stringify({
      purpose: context.purpose,
      timestamp: Date.now(),
      version: '1.0'
    }));
    cipher.setAAD(aad);

    // Encrypt data
    const encrypted = Buffer.concat([
      cipher.update(plaintext),
      cipher.final()
    ]);

    // Get authentication tag
    const tag = cipher.getAuthTag();

    // Combine all components
    const combined = Buffer.concat([
      Buffer.from([1]), // Version byte
      salt,
      iv,
      tag,
      encrypted
    ]);

    // Audit encryption operation
    await this.auditService.logEncryption({
      purpose: context.purpose,
      dataType: context.dataType,
      size: Buffer.byteLength(plaintext)
    });

    return {
      data: combined.toString('base64'),
      keyVersion: masterKey.version,
      algorithm: this.algorithm
    };
  }

  async decryptData(
    encryptedData: EncryptedData,
    context: DecryptionContext
  ): Promise<Buffer> {
    const combined = Buffer.from(encryptedData.data, 'base64');
    
    // Extract components
    const version = combined[0];
    if (version !== 1) {
      throw new Error(`Unsupported encryption version: ${version}`);
    }

    const salt = combined.slice(1, 1 + this.saltLength);
    const iv = combined.slice(1 + this.saltLength, 1 + this.saltLength + this.ivLength);
    const tag = combined.slice(
      1 + this.saltLength + this.ivLength,
      1 + this.saltLength + this.ivLength + this.tagLength
    );
    const encrypted = combined.slice(1 + this.saltLength + this.ivLength + this.tagLength);

    // Get decryption key
    const masterKey = await this.keyManager.getDataEncryptionKey(
      context.purpose,
      encryptedData.keyVersion
    );

    // Derive key
    const key = crypto.pbkdf2Sync(
      masterKey,
      salt,
      this.pbkdf2Iterations,
      32,
      'sha256'
    );

    // Create decipher
    const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
    decipher.setAuthTag(tag);

    // Set AAD
    const aad = Buffer.from(JSON.stringify({
      purpose: context.purpose,
      timestamp: Date.now(),
      version: '1.0'
    }));
    decipher.setAAD(aad);

    // Decrypt
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]);

    // Audit decryption
    await this.auditService.logDecryption({
      purpose: context.purpose,
      dataType: context.dataType,
      keyVersion: encryptedData.keyVersion
    });

    return decrypted;
  }

  async encryptField(
    value: any,
    fieldName: string,
    mode: 'deterministic' | 'randomized' = 'randomized'
  ): Promise<string> {
    if (mode === 'deterministic') {
      // For searchable fields - use deterministic encryption
      return this.encryptDeterministic(value, fieldName);
    } else {
      // For sensitive data - use randomized encryption
      return this.encryptRandomized(value, fieldName);
    }
  }

  private async encryptDeterministic(
    value: any,
    fieldName: string
  ): Promise<string> {
    const key = await this.keyManager.getFieldEncryptionKey(fieldName);
    
    // Use HMAC for deterministic encryption (searchable)
    const hmac = crypto.createHmac('sha256', key);
    hmac.update(JSON.stringify(value));
    
    return hmac.digest('base64');
  }

  private async encryptRandomized(
    value: any,
    fieldName: string
  ): Promise<string> {
    const context: EncryptionContext = {
      purpose: 'field_encryption',
      dataType: fieldName
    };

    const encrypted = await this.encryptData(
      Buffer.from(JSON.stringify(value)),
      context
    );

    return encrypted.data;
  }
}
```

### Key Management Service

```typescript
// services/crypto/src/key-management.service.ts
import { Injectable } from '@nestjs/common';
import { VaultService } from './vault.service';
import * as crypto from 'crypto';

@Injectable()
export class KeyManagementService {
  private keyCache = new Map<string, CachedKey>();
  private readonly cacheTimeout = 5 * 60 * 1000; // 5 minutes

  constructor(
    private vault: VaultService,
    private config: ConfigService,
    private auditService: AuditService
  ) {}

  async getSigningKey(): Promise<string> {
    const keyId = await this.getCurrentKeyId();
    return this.getKey(`signing/${keyId}`, 'rsa_private');
  }

  async getVerificationKey(keyId?: string): Promise<string> {
    const id = keyId || await this.getCurrentKeyId();
    return this.getKey(`signing/${id}`, 'rsa_public');
  }

  async getDataEncryptionKey(
    purpose: string,
    version?: string
  ): Promise<EncryptionKey> {
    const path = `encryption/${purpose}/${version || 'current'}`;
    const key = await this.getKey(path, 'aes256');

    return {
      key,
      version: version || await this.getCurrentVersion(purpose),
      algorithm: 'aes-256-gcm'
    };
  }

  async rotateKey(keyType: string): Promise<void> {
    // Generate new key
    const newKey = await this.generateKey(keyType);
    
    // Store in Vault
    const version = Date.now().toString();
    await this.vault.write(`keys/${keyType}/${version}`, {
      key: newKey,
      created: new Date().toISOString(),
      status: 'active'
    });

    // Update current pointer
    await this.vault.write(`keys/${keyType}/current`, {
      version,
      rotated: new Date().toISOString()
    });

    // Clear cache
    this.clearCache(keyType);

    // Audit rotation
    await this.auditService.logKeyRotation({
      keyType,
      version,
      timestamp: new Date()
    });
  }

  private async getKey(path: string, keyType: string): Promise<string> {
    // Check cache
    const cached = this.keyCache.get(path);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.key;
    }

    // Fetch from Vault
    const response = await this.vault.read(`keys/${path}`);
    if (!response || !response.data || !response.data.key) {
      throw new Error(`Key not found: ${path}`);
    }

    // Cache the key
    this.keyCache.set(path, {
      key: response.data.key,
      timestamp: Date.now()
    });

    return response.data.key;
  }

  private async generateKey(keyType: string): Promise<string> {
    switch (keyType) {
      case 'aes256':
        return crypto.randomBytes(32).toString('base64');
      
      case 'rsa':
        const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
          modulusLength: 4096,
          publicKeyEncoding: {
            type: 'spki',
            format: 'pem'
          },
          privateKeyEncoding: {
            type: 'pkcs8',
            format: 'pem'
          }
        });
        
        // Store both keys
        await this.vault.write(`keys/${keyType}/public`, { key: publicKey });
        return privateKey;
      
      default:
        throw new Error(`Unknown key type: ${keyType}`);
    }
  }

  private clearCache(keyType: string): void {
    for (const [key] of this.keyCache) {
      if (key.includes(keyType)) {
        this.keyCache.delete(key);
      }
    }
  }

  async encrypt(data: string, purpose: string): Promise<string> {
    const key = await this.getDataEncryptionKey(purpose);
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(key.key, 'base64'), iv);
    
    let encrypted = cipher.update(data, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    
    const tag = cipher.getAuthTag();
    
    return JSON.stringify({
      encrypted,
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
      version: key.version
    });
  }

  async decrypt(encryptedData: string, purpose: string): Promise<string> {
    const { encrypted, iv, tag, version } = JSON.parse(encryptedData);
    const key = await this.getDataEncryptionKey(purpose, version);
    
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      Buffer.from(key.key, 'base64'),
      Buffer.from(iv, 'base64')
    );
    
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    
    let decrypted = decipher.update(encrypted, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}
```

## Security Middleware Implementation

### Authentication Middleware

```typescript
// middleware/auth.middleware.ts
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class AuthenticationMiddleware implements NestMiddleware {
  constructor(
    private jwtService: JwtService,
    private sessionService: SessionService,
    private auditService: AuditService
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    try {
      // Extract token from various sources
      const token = this.extractToken(req);
      
      if (!token) {
        return this.unauthorized(res, 'No authentication token provided');
      }

      // Validate token
      const payload = await this.jwtService.validateAccessToken(token);
      
      // Verify session
      const session = await this.sessionService.getSession(payload.session_id);
      if (!session || session.status !== 'active') {
        return this.unauthorized(res, 'Invalid or expired session');
      }

      // Check for concurrent session limits
      if (!await this.checkConcurrentSessions(payload.sub)) {
        return this.unauthorized(res, 'Concurrent session limit exceeded');
      }

      // Attach user context to request
      req['user'] = {
        id: payload.sub,
        organizationId: payload.org,
        roles: payload.roles,
        permissions: payload.permissions,
        sessionId: payload.session_id
      };

      // Update session activity
      await this.sessionService.updateActivity(payload.session_id);

      next();
    } catch (error) {
      await this.auditService.logFailedAuth({
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        error: error.message,
        path: req.path
      });

      return this.unauthorized(res, 'Authentication failed');
    }
  }

  private extractToken(req: Request): string | null {
    // Bearer token from Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // API key from X-API-Key header
    const apiKey = req.headers['x-api-key'];
    if (apiKey) {
      return apiKey as string;
    }

    // Token from cookie
    if (req.cookies && req.cookies.access_token) {
      return req.cookies.access_token;
    }

    return null;
  }

  private unauthorized(res: Response, message: string) {
    return res.status(401).json({
      type: 'https://api.threatmodel.io/errors/unauthorized',
      title: 'Unauthorized',
      status: 401,
      detail: message
    });
  }

  private async checkConcurrentSessions(userId: string): Promise<boolean> {
    const sessions = await this.sessionService.getActiveUserSessions(userId);
    return sessions.length <= 5; // Max 5 concurrent sessions
  }
}
```

### Authorization Middleware

```typescript
// middleware/authz.middleware.ts
import { Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class AuthorizationGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private policyEngine: PolicyEngine,
    private permissionService: PermissionService,
    private auditService: AuditService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return false;
    }

    // Get required permissions from decorator
    const requiredPermissions = this.reflector.get<string[]>(
      'permissions',
      context.getHandler()
    );

    // Get required roles from decorator
    const requiredRoles = this.reflector.get<string[]>(
      'roles',
      context.getHandler()
    );

    // Get policy from decorator
    const policy = this.reflector.get<string>(
      'policy',
      context.getHandler()
    );

    try {
      // Check role-based access
      if (requiredRoles && requiredRoles.length > 0) {
        const hasRole = requiredRoles.some(role => user.roles.includes(role));
        if (!hasRole) {
          await this.logUnauthorized(request, 'Missing required role');
          return false;
        }
      }

      // Check permission-based access
      if (requiredPermissions && requiredPermissions.length > 0) {
        for (const permission of requiredPermissions) {
          const hasPermission = await this.permissionService.checkPermission(
            user.id,
            permission,
            this.buildPermissionContext(request)
          );

          if (!hasPermission) {
            await this.logUnauthorized(request, `Missing permission: ${permission}`);
            return false;
          }
        }
      }

      // Check policy-based access
      if (policy) {
        const authzContext = this.buildAuthorizationContext(request);
        const result = await this.policyEngine.authorize(authzContext);

        if (result.decision !== 'allow') {
          await this.logUnauthorized(request, result.reason);
          return false;
        }

        // Apply obligations
        if (result.obligations) {
          request.obligations = result.obligations;
        }
      }

      return true;
    } catch (error) {
      await this.auditService.logAuthzError({
        userId: user.id,
        path: request.path,
        error: error.message
      });
      return false;
    }
  }

  private buildPermissionContext(request: any): PermissionContext {
    const resourceId = request.params.id || request.params.resourceId;
    
    return {
      userId: request.user.id,
      organizationId: request.user.organizationId,
      resourceId,
      resourceType: this.extractResourceType(request.path),
      ownerId: request.resource?.ownerId,
      teamId: request.resource?.teamId
    };
  }

  private buildAuthorizationContext(request: any): AuthorizationContext {
    return {
      subject: {
        id: request.user.id,
        type: 'user',
        attributes: {
          roles: request.user.roles,
          permissions: request.user.permissions,
          organizationId: request.user.organizationId
        }
      },
      action: `${request.method.toLowerCase()}:${this.extractAction(request.path)}`,
      resource: {
        id: request.params.id,
        type: this.extractResourceType(request.path),
        attributes: request.resource || {}
      },
      environment: {
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
        timestamp: new Date(),
        requestId: request.id
      }
    };
  }

  private extractResourceType(path: string): string {
    const parts = path.split('/').filter(p => p && !p.match(/^[a-f0-9-]+$/));
    return parts[parts.length - 1] || 'unknown';
  }

  private extractAction(path: string): string {
    const parts = path.split('/');
    return parts[parts.length - 1] || 'unknown';
  }

  private async logUnauthorized(request: any, reason: string): Promise<void> {
    await this.auditService.logUnauthorizedAccess({
      userId: request.user?.id,
      path: request.path,
      method: request.method,
      reason,
      ip: request.ip,
      timestamp: new Date()
    });
  }
}
```

## Security Headers and CORS

```typescript
// config/security.config.ts
import helmet from 'helmet';
import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

export const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'wss://api.threatmodel.io'],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'none'"],
      frameSrc: ["'none'"],
      sandbox: ['allow-forms', 'allow-scripts', 'allow-same-origin'],
      reportUri: '/api/v1/security/csp-report',
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: true,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  dnsPrefetchControl: true,
  frameguard: { action: 'deny' },
  hidePoweredBy: true,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  ieNoOpen: true,
  noSniff: true,
  originAgentCluster: true,
  permittedCrossDomainPolicies: false,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xssFilter: true,
});

export const corsConfig: CorsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
      'https://app.threatmodel.io',
      'https://staging.threatmodel.io',
    ];

    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-API-Key',
    'X-Request-ID',
    'X-Session-ID',
  ],
  exposedHeaders: [
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset',
    'X-Request-ID',
  ],
  maxAge: 86400, // 24 hours
};
```

## Rate Limiting Implementation

```typescript
// middleware/rate-limit.middleware.ts
import { Injectable } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerException } from '@nestjs/throttler';

@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    // Use user ID for authenticated requests, IP for anonymous
    return req.user?.id || req.ip;
  }

  protected async handleRequest(
    context: ExecutionContext,
    limit: number,
    ttl: number,
    throttler: ThrottlerOptions,
  ): Promise<boolean> {
    const client = context.switchToHttp().getRequest();
    const key = await this.getTracker(client);
    const { totalHits } = await this.storageService.increment(key, ttl);

    // Dynamic rate limiting based on user tier
    const userLimit = await this.getUserRateLimit(client.user);
    const effectiveLimit = userLimit || limit;

    if (totalHits > effectiveLimit) {
      throw new ThrottlerException('Rate limit exceeded');
    }

    // Set rate limit headers
    const response = context.switchToHttp().getResponse();
    response.setHeader('X-RateLimit-Limit', effectiveLimit);
    response.setHeader('X-RateLimit-Remaining', Math.max(0, effectiveLimit - totalHits));
    response.setHeader('X-RateLimit-Reset', new Date(Date.now() + ttl * 1000).toISOString());

    return true;
  }

  private async getUserRateLimit(user: any): Promise<number | null> {
    if (!user) return null;

    // Different limits based on user tier
    const tierLimits = {
      free: 100,
      basic: 1000,
      pro: 5000,
      enterprise: 10000,
    };

    const userTier = await this.getUserTier(user.id);
    return tierLimits[userTier] || tierLimits.free;
  }
}
```

This completes the comprehensive security architecture and implementation guide. The security measures include:

1. **Authentication**: JWT-based with MFA support
2. **Authorization**: RBAC/ABAC hybrid model
3. **Encryption**: AES-256-GCM for data at rest, TLS 1.3 for transit
4. **Key Management**: Vault-based with automatic rotation
5. **Session Management**: Redis-based with concurrent limits
6. **Security Headers**: Comprehensive CSP and security headers
7. **Rate Limiting**: Tiered rate limits based on user type
8. **Audit Logging**: Complete audit trail for compliance

All implementations follow security best practices and are designed for scalability and maintainability.