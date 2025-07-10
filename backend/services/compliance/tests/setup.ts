// Jest test setup file
import { logger } from '../src/utils/logger';

// Mock console methods to reduce test noise
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// Mock logger to avoid file system operations during tests
jest.mock('../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  },
  complianceLogger: {
    assessmentCreated: jest.fn(),
    assessmentCompleted: jest.fn(),
    assessmentFailed: jest.fn(),
    controlUpdated: jest.fn(),
    controlImplemented: jest.fn(),
    findingCreated: jest.fn(),
    findingResolved: jest.fn(),
    remediationPlanCreated: jest.fn(),
    remediationCompleted: jest.fn(),
    remediationOverdue: jest.fn(),
    reportGenerated: jest.fn(),
    reportDownloaded: jest.fn(),
    unauthorizedAccess: jest.fn(),
    dataExport: jest.fn(),
    performanceMetric: jest.fn(),
    configurationChanged: jest.fn(),
    integrationEvent: jest.fn(),
    businessLogicError: jest.fn(),
    validationError: jest.fn(),
    complianceThresholdBreached: jest.fn(),
    auditEvent: jest.fn()
  },
  startPerformanceMonitor: jest.fn(() => ({
    end: jest.fn()
  })),
  createContextLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }))
}));

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.LOG_LEVEL = 'error';

// Increase timeout for longer running tests
jest.setTimeout(30000);

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});