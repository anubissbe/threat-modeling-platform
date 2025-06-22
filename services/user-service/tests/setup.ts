// Test environment setup
process.env.NODE_ENV = 'testing';
process.env.JWT_SECRET = 'test-jwt-secret-for-testing-only-32-characters-long';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.AUTH_SERVICE_URL = 'http://localhost:8080';
process.env.API_KEY = 'test-api-key-for-testing';

// Mock logger to prevent console output during tests
jest.mock('../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    fatal: jest.fn(),
  },
  auditLogger: {
    userCreated: jest.fn(),
    userUpdated: jest.fn(),
    userDeleted: jest.fn(),
    roleAssigned: jest.fn(),
    roleRevoked: jest.fn(),
    organizationCreated: jest.fn(),
    organizationUpdated: jest.fn(),
    teamCreated: jest.fn(),
    teamMemberAdded: jest.fn(),
    teamMemberRemoved: jest.fn(),
    permissionGranted: jest.fn(),
    permissionRevoked: jest.fn(),
    suspiciousActivity: jest.fn(),
  },
}));

// Mock crypto functions
jest.mock('../src/utils/crypto', () => ({
  hashPassword: jest.fn().mockResolvedValue('hashed_password'),
  verifyPassword: jest.fn().mockResolvedValue(true),
  generateToken: jest.fn().mockReturnValue('test_token'),
  generateApiKey: jest.fn().mockReturnValue('tm_test_api_key'),
  hashToken: jest.fn().mockReturnValue('hashed_token'),
}));

// Global test timeout
jest.setTimeout(10000);

// Clean up after tests
afterAll(async () => {
  // Close any open handles
  await new Promise(resolve => setTimeout(resolve, 500));
});