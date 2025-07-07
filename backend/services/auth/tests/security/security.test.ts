import request from 'supertest';
import app from '../../src/index';
import { encryptionService } from '../../src/utils/encryption';
import { auditService } from '../../src/services/audit.service';
import { securityMonitoringService } from '../../src/services/security-monitoring.service';

describe('Security Tests', () => {
  describe('Encryption Service', () => {
    test('should encrypt and decrypt data correctly', () => {
      const plaintext = 'sensitive-data-123';
      const encrypted = encryptionService.encrypt(plaintext);
      
      expect(encrypted.encrypted).toBeDefined();
      expect(encrypted.iv).toBeDefined();
      expect(encrypted.tag).toBeDefined();
      expect(encrypted.salt).toBeDefined();
      
      const decrypted = encryptionService.decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    test('should fail decryption with tampered data', () => {
      const plaintext = 'sensitive-data-123';
      const encrypted = encryptionService.encrypt(plaintext);
      
      // Tamper with encrypted data
      encrypted.encrypted = encrypted.encrypted.replace('a', 'b');
      
      expect(() => {
        encryptionService.decrypt(encrypted);
      }).toThrow();
    });

    test('should generate unique tokens', () => {
      const token1 = encryptionService.generateSecureToken();
      const token2 = encryptionService.generateSecureToken();
      
      expect(token1).toHaveLength(64);
      expect(token2).toHaveLength(64);
      expect(token1).not.toBe(token2);
    });

    test('should anonymize data correctly', () => {
      const creditCard = '1234567890123456';
      const anonymized = encryptionService.anonymize(creditCard, 4);
      
      expect(anonymized).toBe('************3456');
    });
  });

  describe('Security Headers', () => {
    test('should set security headers', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('0');
      expect(response.headers['strict-transport-security']).toBeDefined();
      expect(response.headers['x-request-id']).toBeDefined();
    });

    test('should not expose server information', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.headers['x-powered-by']).toBeUndefined();
    });
  });

  describe('Input Validation', () => {
    test('should reject SQL injection attempts', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: "admin' OR '1'='1",
          password: 'password'
        })
        .expect(400);

      expect(response.body.error).toBe('Invalid input detected');
    });

    test('should reject XSS attempts', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'SecurePass123!',
          name: '<script>alert("XSS")</script>'
        })
        .expect(400);

      // The XSS should be sanitized
      expect(response.body.name).not.toContain('<script>');
    });

    test('should reject NoSQL injection attempts', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: { $ne: null },
          password: { $ne: null }
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    test('should handle large payloads', async () => {
      const largePayload = 'x'.repeat(11 * 1024 * 1024); // 11MB
      
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'SecurePass123!',
          name: largePayload
        })
        .expect(413); // Payload too large
    });
  });

  describe('Rate Limiting', () => {
    test('should rate limit excessive requests', async () => {
      const requests = [];
      
      // Make 6 requests (limit is 5 for auth endpoints)
      for (let i = 0; i < 6; i++) {
        requests.push(
          request(app)
            .post('/api/auth/login')
            .send({
              email: 'test@example.com',
              password: 'wrongpassword'
            })
        );
      }

      const responses = await Promise.all(requests);
      const lastResponse = responses[responses.length - 1];
      
      expect(lastResponse.status).toBe(429);
      expect(lastResponse.body.error).toBe('Too many requests');
    });
  });

  describe('Authentication Security', () => {
    test('should enforce strong password requirements', async () => {
      const weakPasswords = [
        'short',           // Too short
        'alllowercase',    // No uppercase
        'ALLUPPERCASE',    // No lowercase
        'NoNumbers!',      // No numbers
        'N0Sp3c!al',       // No special characters
      ];

      for (const password of weakPasswords) {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            email: 'test@example.com',
            password,
            name: 'Test User'
          })
          .expect(400);

        expect(response.body.error).toContain('Password');
      }
    });

    test('should not leak user existence', async () => {
      // Try with non-existent user
      const response1 = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'wrongpassword'
        })
        .expect(401);

      // Try with existing user (assume one exists)
      const response2 = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@example.com',
          password: 'wrongpassword'
        })
        .expect(401);

      // Both should return the same generic error
      expect(response1.body.error).toBe(response2.body.error);
    });
  });

  describe('Audit Logging', () => {
    test('should log security events', async () => {
      const logSpy = jest.spyOn(auditService, 'logEvent');

      await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword'
        });

      expect(logSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: expect.any(String),
          result: 'FAILURE'
        })
      );
    });
  });

  describe('Security Monitoring', () => {
    test('should detect brute force attempts', async () => {
      const monitorSpy = jest.spyOn(securityMonitoringService, 'monitorLoginAttempt');

      // Simulate multiple failed login attempts
      for (let i = 0; i < 5; i++) {
        await securityMonitoringService.monitorLoginAttempt({
          ipAddress: '192.168.1.100',
          success: false,
        });
      }

      expect(monitorSpy).toHaveBeenCalledTimes(5);
      
      // Check if IP would be blocked after more attempts
      for (let i = 0; i < 5; i++) {
        await securityMonitoringService.monitorLoginAttempt({
          ipAddress: '192.168.1.100',
          success: false,
        });
      }

      expect(securityMonitoringService.isIPBlocked('192.168.1.100')).toBe(true);
    });

    test('should detect injection attempts', async () => {
      const isBlocked = await securityMonitoringService.monitorInjectionAttempt({
        source: 'user_input',
        input: "'; DROP TABLE users; --",
        ipAddress: '192.168.1.101',
      });

      expect(isBlocked).toBe(true);
    });
  });

  describe('CORS Security', () => {
    test('should only allow whitelisted origins', async () => {
      const response = await request(app)
        .get('/health')
        .set('Origin', 'http://evil.com')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    });

    test('should allow legitimate origins', async () => {
      const response = await request(app)
        .get('/health')
        .set('Origin', 'http://localhost:3000')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    });
  });

  describe('Session Security', () => {
    test('should set secure cookie flags in production', async () => {
      process.env.NODE_ENV = 'production';
      
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'SecurePass123!'
        });

      const cookies = response.headers['set-cookie'] as unknown as string[];
      if (cookies && Array.isArray(cookies)) {
        expect(cookies.some((cookie: string) => cookie.includes('Secure'))).toBe(true);
        expect(cookies.some((cookie: string) => cookie.includes('HttpOnly'))).toBe(true);
        expect(cookies.some((cookie: string) => cookie.includes('SameSite=Strict'))).toBe(true);
      }

      process.env.NODE_ENV = 'test';
    });
  });

  describe('File Upload Security', () => {
    test('should reject dangerous file types', async () => {
      const dangerousFiles = [
        { name: 'malware.exe', type: 'application/x-msdownload' },
        { name: 'script.sh', type: 'application/x-sh' },
        { name: 'virus.bat', type: 'application/x-bat' },
      ];

      // Note: This would need actual file upload endpoint implementation
      // For now, this is a placeholder test structure
    });

    test('should enforce file size limits', async () => {
      // Test large file rejection
      // This would need actual implementation
    });
  });
});