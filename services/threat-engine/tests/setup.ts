// Test setup file

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.PORT = '3004';
process.env.HOST = '0.0.0.0';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
process.env.JWT_ACCESS_TOKEN_TTL = '3600';
process.env.CORS_ORIGINS = 'http://localhost:3000';
process.env.LOG_LEVEL = 'error'; // Reduce noise in tests

// Mock logger to prevent actual logging during tests
jest.mock('../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
  auditLogger: {
    analysisStarted: jest.fn(),
    analysisCompleted: jest.fn(),
    analysisFailed: jest.fn(),
    threatIdentified: jest.fn(),
    mitigationRecommended: jest.fn(),
    riskCalculated: jest.fn(),
    patternMatched: jest.fn(),
    knowledgeBaseUpdated: jest.fn(),
  },
}));

// Global test timeout
jest.setTimeout(30000);