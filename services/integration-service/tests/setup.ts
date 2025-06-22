import { config } from '../src/config';

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.PORT = '3005';
process.env.HOST = '0.0.0.0';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-integration-service';
process.env.CORS_ORIGINS = 'http://localhost:3000,http://localhost:3001';
process.env.RATE_LIMIT_MAX = '100';
process.env.RATE_LIMIT_WINDOW = '60000';

// Mock Redis URL for testing
process.env.REDIS_URL = 'redis://localhost:6379';

// Global test timeout
jest.setTimeout(30000);

// Global setup
beforeAll(async () => {
  // Setup global test resources if needed
});

// Global cleanup
afterAll(async () => {
  // Cleanup global test resources if needed
});

// Reset modules between tests
beforeEach(() => {
  jest.clearAllMocks();
});

// Suppress console output during tests
const originalConsole = global.console;
global.console = {
  ...originalConsole,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

export {};