import { beforeAll, afterAll, afterEach } from '@jest/globals';

// Mock Redis
jest.mock('redis', () => ({
  createClient: jest.fn().mockReturnValue({
    connect: jest.fn(),
    disconnect: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
    expire: jest.fn(),
    on: jest.fn(),
    isReady: true,
    isOpen: true
  })
}));

// Mock PostgreSQL client (pg)
jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({
    query: jest.fn(),
    end: jest.fn(),
    connect: jest.fn().mockResolvedValue({
      query: jest.fn(),
      release: jest.fn()
    })
  }))
}));

// Mock bcrypt
jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('mock-hashed-password'),
  compare: jest.fn().mockResolvedValue(true),
  genSalt: jest.fn().mockResolvedValue('mock-salt')
}));

// Mock jsonwebtoken
jest.mock('jsonwebtoken', () => ({
  sign: jest.fn().mockReturnValue('mock-jwt-token'),
  verify: jest.fn().mockReturnValue({ userId: 'test-user-id', email: 'test@example.com' }),
  decode: jest.fn().mockReturnValue({ userId: 'test-user-id' })
}));

beforeAll(async () => {
  // Setup test environment
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-jwt-secret-for-testing-purposes-only';
  process.env.REFRESH_TOKEN_SECRET = 'test-refresh-secret-for-testing-purposes-only';
  process.env.DB_NAME = 'threat_modeling_test';
  process.env.REDIS_URL = 'redis://localhost:6379/15'; // Use test DB
  process.env.DB_HOST = 'localhost';
  process.env.DB_PORT = '5432';
  process.env.DB_USER = 'test_user';
  process.env.DB_PASSWORD = 'test_password';
  
  // Clear any existing timers
  jest.clearAllTimers();
});

afterEach(() => {
  // Clear all mocks after each test
  jest.clearAllMocks();
});

afterAll(async () => {
  // Cleanup after tests
  jest.clearAllTimers();
  jest.restoreAllMocks();
});

// Global test helpers
global.mockUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  password_hash: '$2b$10$mockhashedpassword',
  role: 'user',
  is_active: true,
  created_at: new Date(),
  updated_at: new Date()
};

global.mockAdminUser = {
  id: 'admin-user-id',
  email: 'admin@example.com',
  password_hash: '$2b$10$mockhashedpassword',
  role: 'admin',
  is_active: true,
  created_at: new Date(),
  updated_at: new Date()
};