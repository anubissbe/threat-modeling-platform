import request from 'supertest';
import app from '../../src/index';
import { Pool } from 'pg';
import { Redis } from 'ioredis';

describe('Authentication Integration Tests', () => {
  let db: Pool;
  let redis: Redis;
  let adminUser: any;
  let adminToken: string;

  beforeAll(async () => {
    // Initialize test database connection
    db = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'threatmodel_db_test',
      user: process.env.DB_USER || 'threatmodel',
      password: process.env.DB_PASSWORD || 'threatmodel123',
    });

    // Initialize Redis connection
    redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
    });

    // Clean test database
    await db.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');
    await redis.flushall();
  });

  afterAll(async () => {
    await db.end();
    await redis.quit();
  });

  beforeEach(async () => {
    // Clear data before each test
    await db.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');
    await redis.flushall();
  });

  describe('User Registration Flow', () => {
    test('should register a new user successfully', async () => {
      const userData = {
        email: 'newuser@example.com',
        password: 'SecurePass123!',
        firstName: 'John',
        lastName: 'Doe',
        organization: 'Test Org'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe(userData.email);
      expect(response.body.user.firstName).toBe(userData.firstName);
      expect(response.body.tokens).toBeDefined();
      expect(response.body.tokens.accessToken).toBeDefined();
      expect(response.body.tokens.refreshToken).toBeDefined();

      // Verify user was created in database
      const userResult = await db.query('SELECT * FROM users WHERE email = $1', [userData.email]);
      expect(userResult.rows).toHaveLength(1);
      expect(userResult.rows[0].email).toBe(userData.email);
    });

    test('should not allow duplicate email registration', async () => {
      const userData = {
        email: 'duplicate@example.com',
        password: 'SecurePass123!',
        firstName: 'John',
        lastName: 'Doe',
        organization: 'Test Org'
      };

      // First registration
      await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      // Second registration with same email
      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(409);

      expect(response.body.error).toContain('already exists');
    });
  });

  describe('User Login Flow', () => {
    beforeEach(async () => {
      // Create a test user
      const userData = {
        email: 'testuser@example.com',
        password: 'SecurePass123!',
        firstName: 'Test',
        lastName: 'User',
        organization: 'Test Org'
      };

      await request(app)
        .post('/api/auth/register')
        .send(userData);
    });

    test('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'testuser@example.com',
          password: 'SecurePass123!'
        })
        .expect(200);

      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe('testuser@example.com');
      expect(response.body.tokens).toBeDefined();
      expect(response.body.tokens.accessToken).toBeDefined();
      expect(response.body.tokens.refreshToken).toBeDefined();
    });

    test('should reject invalid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'testuser@example.com',
          password: 'WrongPassword'
        })
        .expect(401);

      expect(response.body.error).toBeDefined();
      expect(response.body.tokens).toBeUndefined();
    });

    test('should reject login for non-existent user', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'SecurePass123!'
        })
        .expect(401);

      expect(response.body.error).toBeDefined();
    });
  });

  describe('Token Management', () => {
    let userTokens: any;

    beforeEach(async () => {
      // Create and login user
      await request(app)
        .post('/api/auth/register')
        .send({
          email: 'tokenuser@example.com',
          password: 'SecurePass123!',
          firstName: 'Token',
          lastName: 'User',
          organization: 'Test Org'
        });

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'tokenuser@example.com',
          password: 'SecurePass123!'
        });

      userTokens = loginResponse.body.tokens;
    });

    test('should access protected route with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${userTokens.accessToken}`)
        .expect(200);

      expect(response.body.email).toBe('tokenuser@example.com');
    });

    test('should reject access with invalid token', async () => {
      await request(app)
        .get('/api/auth/profile')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });

    test('should refresh tokens successfully', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({
          refreshToken: userTokens.refreshToken
        })
        .expect(200);

      expect(response.body.tokens).toBeDefined();
      expect(response.body.tokens.accessToken).toBeDefined();
      expect(response.body.tokens.refreshToken).toBeDefined();
      expect(response.body.tokens.accessToken).not.toBe(userTokens.accessToken);
    });

    test('should logout and invalidate tokens', async () => {
      // Logout
      await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${userTokens.accessToken}`)
        .expect(200);

      // Try to use token after logout
      await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${userTokens.accessToken}`)
        .expect(401);
    });
  });

  describe('Password Management', () => {
    let userTokens: any;

    beforeEach(async () => {
      await request(app)
        .post('/api/auth/register')
        .send({
          email: 'passworduser@example.com',
          password: 'OldSecurePass123!',
          firstName: 'Password',
          lastName: 'User',
          organization: 'Test Org'
        });

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'passworduser@example.com',
          password: 'OldSecurePass123!'
        });

      userTokens = loginResponse.body.tokens;
    });

    test('should change password with valid current password', async () => {
      const response = await request(app)
        .put('/api/auth/change-password')
        .set('Authorization', `Bearer ${userTokens.accessToken}`)
        .send({
          currentPassword: 'OldSecurePass123!',
          newPassword: 'NewSecurePass123!'
        })
        .expect(200);

      expect(response.body.message).toContain('Password changed successfully');

      // Verify old password no longer works
      await request(app)
        .post('/api/auth/login')
        .send({
          email: 'passworduser@example.com',
          password: 'OldSecurePass123!'
        })
        .expect(401);

      // Verify new password works
      await request(app)
        .post('/api/auth/login')
        .send({
          email: 'passworduser@example.com',
          password: 'NewSecurePass123!'
        })
        .expect(200);
    });

    test('should reject password change with wrong current password', async () => {
      const response = await request(app)
        .put('/api/auth/change-password')
        .set('Authorization', `Bearer ${userTokens.accessToken}`)
        .send({
          currentPassword: 'WrongPassword',
          newPassword: 'NewSecurePass123!'
        })
        .expect(400);

      expect(response.body.error).toContain('Current password is incorrect');
    });
  });

  describe('Role-Based Access Control', () => {
    let adminTokens: any;
    let userTokens: any;

    beforeEach(async () => {
      // Create admin user
      await request(app)
        .post('/api/auth/register')
        .send({
          email: 'admin@example.com',
          password: 'AdminPass123!',
          firstName: 'Admin',
          lastName: 'User',
          organization: 'Test Org',
          role: 'admin'
        });

      const adminLogin = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@example.com',
          password: 'AdminPass123!'
        });

      adminTokens = adminLogin.body.tokens;

      // Create regular user
      await request(app)
        .post('/api/auth/register')
        .send({
          email: 'user@example.com',
          password: 'UserPass123!',
          firstName: 'Regular',
          lastName: 'User',
          organization: 'Test Org',
          role: 'user'
        });

      const userLogin = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'user@example.com',
          password: 'UserPass123!'
        });

      userTokens = userLogin.body.tokens;
    });

    test('should allow admin access to admin endpoints', async () => {
      await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminTokens.accessToken}`)
        .expect(200);
    });

    test('should deny user access to admin endpoints', async () => {
      await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${userTokens.accessToken}`)
        .expect(403);
    });
  });

  describe('Session Management', () => {
    test('should handle concurrent sessions', async () => {
      const userData = {
        email: 'concurrent@example.com',
        password: 'SecurePass123!',
        firstName: 'Concurrent',
        lastName: 'User',
        organization: 'Test Org'
      };

      await request(app)
        .post('/api/auth/register')
        .send(userData);

      // Login from multiple devices/locations
      const session1 = await request(app)
        .post('/api/auth/login')
        .send({
          email: userData.email,
          password: userData.password
        })
        .expect(200);

      const session2 = await request(app)
        .post('/api/auth/login')
        .send({
          email: userData.email,
          password: userData.password
        })
        .expect(200);

      // Both sessions should be valid
      await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${session1.body.tokens.accessToken}`)
        .expect(200);

      await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${session2.body.tokens.accessToken}`)
        .expect(200);
    });

    test('should invalidate all sessions on password change', async () => {
      const userData = {
        email: 'invalidate@example.com',
        password: 'SecurePass123!',
        firstName: 'Invalidate',
        lastName: 'User',
        organization: 'Test Org'
      };

      await request(app)
        .post('/api/auth/register')
        .send(userData);

      const session1 = await request(app)
        .post('/api/auth/login')
        .send({
          email: userData.email,
          password: userData.password
        });

      const session2 = await request(app)
        .post('/api/auth/login')
        .send({
          email: userData.email,
          password: userData.password
        });

      // Change password from session1
      await request(app)
        .put('/api/auth/change-password')
        .set('Authorization', `Bearer ${session1.body.tokens.accessToken}`)
        .send({
          currentPassword: userData.password,
          newPassword: 'NewSecurePass123!'
        })
        .expect(200);

      // Both sessions should now be invalid
      await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${session1.body.tokens.accessToken}`)
        .expect(401);

      await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${session2.body.tokens.accessToken}`)
        .expect(401);
    });
  });
});