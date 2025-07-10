import 'jest';

// Global test setup
beforeAll(() => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'error';
  
  // Mock environment variables
  process.env.OPENAI_API_KEY = 'test-key';
  process.env.OPENAI_API_URL = 'https://api.openai.com/v1';
  process.env.VAULT_ADDR = 'http://localhost:8200';
  process.env.VAULT_TOKEN = 'test-token';
});

// Mock console methods to reduce test output noise
const originalConsole = console;
beforeEach(() => {
  console.log = jest.fn();
  console.info = jest.fn();
  console.warn = jest.fn();
  console.error = jest.fn();
});

afterEach(() => {
  console.log = originalConsole.log;
  console.info = originalConsole.info;
  console.warn = originalConsole.warn;
  console.error = originalConsole.error;
});

// Global test timeout
jest.setTimeout(30000);