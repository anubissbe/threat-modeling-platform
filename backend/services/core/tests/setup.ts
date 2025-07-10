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

jest.mock('amqplib', () => ({
  connect: jest.fn().mockResolvedValue({
    createChannel: jest.fn().mockResolvedValue({
      assertQueue: jest.fn(),
      sendToQueue: jest.fn(),
      consume: jest.fn(),
      ack: jest.fn(),
      nack: jest.fn(),
      close: jest.fn()
    }),
    close: jest.fn()
  })
}));

beforeAll(async () => {
  // Setup test environment
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-jwt-secret-for-testing-purposes-only';
  process.env.DB_NAME = 'threat_modeling_test';
  process.env.DB_HOST = 'localhost';
  process.env.DB_PORT = '5432';
  process.env.DB_USER = 'test_user';
  process.env.DB_PASSWORD = 'test_password';
  process.env.REDIS_URL = 'redis://localhost:6379/15';
  process.env.RABBITMQ_URL = 'amqp://localhost:5672';
  
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
global.mockThreatModel = {
  id: 'tm-1',
  name: 'Test Threat Model',
  description: 'A test threat model for unit testing',
  user_id: 'user-1',
  status: 'draft',
  version: '1.0.0',
  methodology: 'STRIDE',
  created_at: new Date(),
  updated_at: new Date()
};

global.mockComponent = {
  id: 'comp-1',
  threat_model_id: 'tm-1',
  name: 'Web Application',
  type: 'web_application',
  description: 'Frontend web application',
  trust_level: 'medium',
  technologies: ['React', 'TypeScript'],
  created_at: new Date(),
  updated_at: new Date()
};

global.mockThreat = {
  id: 'threat-1',
  threat_model_id: 'tm-1',
  component_id: 'comp-1',
  title: 'SQL Injection',
  description: 'Malicious SQL injection attack',
  category: 'tampering',
  severity: 'high',
  likelihood: 'medium',
  impact: 'high',
  stride: ['T'],
  mitre_attack: ['T1190'],
  cvss_score: 8.5,
  status: 'open',
  created_at: new Date(),
  updated_at: new Date()
};

global.mockDataFlow = {
  id: 'df-1',
  threat_model_id: 'tm-1',
  source_component_id: 'comp-1',
  destination_component_id: 'comp-2',
  name: 'User Authentication',
  description: 'User login data flow',
  protocol: 'HTTPS',
  port: 443,
  authentication: 'OAuth2',
  encryption: 'TLS 1.3',
  data_classification: 'sensitive',
  created_at: new Date(),
  updated_at: new Date()
};

global.mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  role: 'user',
  is_active: true,
  created_at: new Date(),
  updated_at: new Date()
};