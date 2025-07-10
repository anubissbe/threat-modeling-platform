import { beforeAll, afterAll, afterEach } from '@jest/globals';

// Mock dependencies
jest.mock('../src/db/connection', () => ({
  pool: {
    query: jest.fn(),
    end: jest.fn()
  },
  getDb: jest.fn().mockReturnValue({
    query: jest.fn(),
    one: jest.fn(),
    any: jest.fn(),
    none: jest.fn(),
    manyOrNone: jest.fn(),
    oneOrNone: jest.fn()
  })
}));

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
    hGet: jest.fn(),
    hSet: jest.fn(),
    hDel: jest.fn(),
    isReady: true,
    isOpen: true
  })
}));

jest.mock('openai', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: jest.fn()
        }
      }
    }))
  };
});

// Global test setup
beforeAll(() => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'error';
  process.env.OPENAI_API_KEY = 'test-openai-key';
  process.env.JWT_SECRET = 'test-jwt-secret-for-testing-purposes-only';
  process.env.DB_NAME = 'threat_modeling_test';
  process.env.DB_HOST = 'localhost';
  process.env.DB_PORT = '5432';
  process.env.DB_USER = 'test_user';
  process.env.DB_PASSWORD = 'test_password';
  process.env.REDIS_HOST = 'localhost';
  process.env.REDIS_PORT = '6379';
  process.env.REDIS_PASSWORD = '';
  
  // Clear any existing timers
  jest.clearAllTimers();
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
  
  // Clear all mocks after each test
  jest.clearAllMocks();
});

afterAll(async () => {
  // Cleanup after tests
  jest.clearAllTimers();
  jest.restoreAllMocks();
});

// Global test timeout
jest.setTimeout(30000);

// Global test helpers
global.mockThreatModel = {
  id: 'tm-1',
  name: 'E-commerce Platform',
  description: 'Threat model for e-commerce application',
  components: [
    {
      id: 'comp-1',
      name: 'Web Frontend',
      type: 'web_application',
      technologies: ['React', 'TypeScript']
    },
    {
      id: 'comp-2',
      name: 'API Gateway',
      type: 'api_gateway',
      technologies: ['Node.js', 'Express']
    }
  ],
  dataFlows: [
    {
      id: 'df-1',
      name: 'User Authentication',
      source: 'comp-1',
      destination: 'comp-2',
      protocol: 'HTTPS',
      authentication: 'OAuth2'
    }
  ]
};