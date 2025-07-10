import request from 'supertest';
import express from 'express';
import { AuthController } from '../../src/controllers/auth.controller';
import { AuthService } from '../../src/services/auth.service';
import { ValidationError, AuthenticationError } from '../../src/utils/errors';

// Mock the AuthService
jest.mock('../../src/services/auth.service');
const MockedAuthService = AuthService as jest.MockedClass<typeof AuthService>;

describe('AuthController', () => {
  let app: express.Application;
  let authController: AuthController;
  let mockAuthService: jest.Mocked<AuthService>;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    
    mockAuthService = new MockedAuthService() as jest.Mocked<AuthService>;
    authController = new AuthController();
    
    // Replace the service instance
    (authController as any).authService = mockAuthService;
    
    app.post('/register', authController.register.bind(authController));
    app.post('/login', authController.login.bind(authController));
    app.post('/refresh', authController.refreshToken.bind(authController));
    app.post('/logout', authController.logout.bind(authController));
  });

  describe('POST /register', () => {
    const validRegisterData = {
      email: 'test@example.com',
      password: 'Password123!',
      role: 'user'
    };

    it('should register a new user successfully', async () => {
      const mockUser = { id: '1', email: 'test@example.com', role: 'user' };
      const mockTokens = { accessToken: 'access-token', refreshToken: 'refresh-token' };
      
      mockAuthService.register.mockResolvedValue({ user: mockUser, tokens: mockTokens });

      const response = await request(app)
        .post('/register')
        .send(validRegisterData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.user).toEqual(mockUser);
      expect(response.body.accessToken).toBe('access-token');
      expect(mockAuthService.register).toHaveBeenCalledWith(
        validRegisterData.email,
        validRegisterData.password,
        validRegisterData.role
      );
    });

    it('should return 400 for invalid email format', async () => {
      const response = await request(app)
        .post('/register')
        .send({ ...validRegisterData, email: 'invalid-email' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('valid email');
    });

    it('should return 400 for weak password', async () => {
      const response = await request(app)
        .post('/register')
        .send({ ...validRegisterData, password: '123' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('password');
    });

    it('should return 409 when email already exists', async () => {
      mockAuthService.register.mockRejectedValue(
        new ValidationError('Email already exists')
      );

      const response = await request(app)
        .post('/register')
        .send(validRegisterData);

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Email already exists');
    });

    it('should return 500 for server errors', async () => {
      mockAuthService.register.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/register')
        .send(validRegisterData);

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /login', () => {
    const validLoginData = {
      email: 'test@example.com',
      password: 'Password123!'
    };

    it('should login user successfully', async () => {
      const mockUser = { id: '1', email: 'test@example.com', role: 'user' };
      const mockTokens = { accessToken: 'access-token', refreshToken: 'refresh-token' };
      
      mockAuthService.login.mockResolvedValue({ user: mockUser, tokens: mockTokens });

      const response = await request(app)
        .post('/login')
        .send(validLoginData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.user).toEqual(mockUser);
      expect(response.body.accessToken).toBe('access-token');
      expect(mockAuthService.login).toHaveBeenCalledWith(
        validLoginData.email,
        validLoginData.password
      );
    });

    it('should return 401 for invalid credentials', async () => {
      mockAuthService.login.mockRejectedValue(
        new AuthenticationError('Invalid credentials')
      );

      const response = await request(app)
        .post('/login')
        .send(validLoginData);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid credentials');
    });

    it('should return 400 for missing fields', async () => {
      const response = await request(app)
        .post('/login')
        .send({ email: 'test@example.com' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return 400 for invalid email format', async () => {
      const response = await request(app)
        .post('/login')
        .send({ ...validLoginData, email: 'invalid-email' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /refresh', () => {
    it('should refresh tokens successfully', async () => {
      const refreshToken = 'valid-refresh-token';
      const mockTokens = { accessToken: 'new-access-token', refreshToken: 'new-refresh-token' };
      
      mockAuthService.refreshToken.mockResolvedValue(mockTokens);

      const response = await request(app)
        .post('/refresh')
        .send({ refreshToken });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.accessToken).toBe('new-access-token');
      expect(mockAuthService.refreshToken).toHaveBeenCalledWith(refreshToken);
    });

    it('should return 401 for invalid refresh token', async () => {
      mockAuthService.refreshToken.mockRejectedValue(
        new AuthenticationError('Invalid refresh token')
      );

      const response = await request(app)
        .post('/refresh')
        .send({ refreshToken: 'invalid-token' });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should return 400 for missing refresh token', async () => {
      const response = await request(app)
        .post('/refresh')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /logout', () => {
    it('should logout user successfully', async () => {
      const refreshToken = 'valid-refresh-token';
      
      mockAuthService.logout.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/logout')
        .send({ refreshToken });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Logged out successfully');
      expect(mockAuthService.logout).toHaveBeenCalledWith(refreshToken);
    });

    it('should return 400 for missing refresh token', async () => {
      const response = await request(app)
        .post('/logout')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should handle service errors gracefully', async () => {
      mockAuthService.logout.mockRejectedValue(new Error('Redis error'));

      const response = await request(app)
        .post('/logout')
        .send({ refreshToken: 'some-token' });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });
});