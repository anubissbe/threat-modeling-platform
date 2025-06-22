// Test environment setup
process.env.NODE_ENV = 'testing';
process.env.JWT_SECRET = 'test-jwt-secret-for-testing-only-32-characters-long';
process.env.PASSWORD_PEPPER = 'test-pepper-16-chars';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.REDIS_URL = 'redis://localhost:6379';

// Mock logger to prevent console output during tests
jest.mock('../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    fatal: jest.fn(),
  },
  securityLogger: {
    loginAttempt: jest.fn(),
    loginFailure: jest.fn(),
    mfaAttempt: jest.fn(),
    passwordReset: jest.fn(),
    accountLockout: jest.fn(),
    suspiciousActivity: jest.fn(),
    tokenRevocation: jest.fn(),
  },
}));

// Global test timeout
jest.setTimeout(10000);

// Clean up after tests
afterAll(async () => {
  // Close any open handles
  await new Promise(resolve => setTimeout(resolve, 500));
});