// Test setup file
import dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Set test environment
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error'; // Reduce logging noise in tests

// Mock Redis for tests
jest.mock('redis', () => ({
  createClient: jest.fn(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    quit: jest.fn().mockResolvedValue(undefined),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    setEx: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    exists: jest.fn().mockResolvedValue(0),
    keys: jest.fn().mockResolvedValue([]),
    flushAll: jest.fn().mockResolvedValue('OK'),
    on: jest.fn(),
    isOpen: true,
  })),
}));

// Mock BullMQ
jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: jest.fn().mockResolvedValue({ id: 'test-job-id' }),
    getJob: jest.fn().mockResolvedValue(null),
    getWaiting: jest.fn().mockResolvedValue([]),
    getActive: jest.fn().mockResolvedValue([]),
    getCompleted: jest.fn().mockResolvedValue([]),
    getFailed: jest.fn().mockResolvedValue([]),
    getWaitingCount: jest.fn().mockResolvedValue(0),
    getActiveCount: jest.fn().mockResolvedValue(0),
    getCompletedCount: jest.fn().mockResolvedValue(0),
    getFailedCount: jest.fn().mockResolvedValue(0),
    getDelayedCount: jest.fn().mockResolvedValue(0),
    isPaused: jest.fn().mockResolvedValue(false),
    pause: jest.fn().mockResolvedValue(undefined),
    resume: jest.fn().mockResolvedValue(undefined),
    clean: jest.fn().mockResolvedValue([]),
    close: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
  })),
  Worker: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    close: jest.fn().mockResolvedValue(undefined),
  })),
  QueueEvents: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    close: jest.fn().mockResolvedValue(undefined),
  })),
}));

// Mock Puppeteer
jest.mock('puppeteer', () => ({
  launch: jest.fn().mockResolvedValue({
    newPage: jest.fn().mockResolvedValue({
      setViewport: jest.fn().mockResolvedValue(undefined),
      setContent: jest.fn().mockResolvedValue(undefined),
      goto: jest.fn().mockResolvedValue(undefined),
      waitForTimeout: jest.fn().mockResolvedValue(undefined),
      waitForSelector: jest.fn().mockResolvedValue(undefined),
      pdf: jest.fn().mockResolvedValue(Buffer.from('mock-pdf-content')),
      screenshot: jest.fn().mockResolvedValue(Buffer.from('mock-screenshot')),
      close: jest.fn().mockResolvedValue(undefined),
      setCookie: jest.fn().mockResolvedValue(undefined),
      $: jest.fn().mockResolvedValue({
        screenshot: jest.fn().mockResolvedValue(Buffer.from('mock-element-screenshot')),
      }),
    }),
    close: jest.fn().mockResolvedValue(undefined),
  }),
}));

// Set test timeout
jest.setTimeout(30000);

// Global test utilities
global.testUtils = {
  generateMockThreatModel: () => ({
    id: 'test-model-id',
    name: 'Test Threat Model',
    description: 'Test threat model description',
    version: '1.0.0',
    createdAt: new Date(),
    updatedAt: new Date(),
    components: [
      {
        id: 'comp-1',
        name: 'Web API',
        type: 'Service',
        description: 'REST API service',
        trustLevel: 'trusted',
        technologies: ['Node.js', 'Express'],
        interfaces: ['REST', 'HTTP'],
      },
    ],
    dataFlows: [
      {
        id: 'flow-1',
        name: 'User Authentication',
        source: 'User',
        destination: 'Web API',
        protocol: 'HTTPS',
        dataClassification: 'Sensitive',
        authentication: 'JWT',
        encryption: 'TLS 1.3',
      },
    ],
    threats: [
      {
        id: 'threat-1',
        title: 'SQL Injection',
        description: 'Potential SQL injection vulnerability',
        category: 'Injection',
        severity: 'high',
        likelihood: 'medium',
        impact: 'major',
        riskScore: 7.5,
        status: 'identified',
        affectedComponents: ['comp-1'],
        mitigations: [],
      },
    ],
    mitigations: [
      {
        id: 'mit-1',
        title: 'Input Validation',
        description: 'Implement strict input validation',
        type: 'preventive',
        status: 'proposed',
        priority: 'high',
        effort: 'medium',
        effectiveness: 85,
      },
    ],
    assumptions: ['All users are authenticated'],
    dependencies: ['Authentication service'],
  }),
  
  generateMockReportRequest: () => ({
    type: 'threat-model',
    format: 'pdf',
    projectId: 'test-project-id',
    threatModelId: 'test-model-id',
    userId: 'test-user-id',
    options: {
      includeExecutiveSummary: true,
      includeDetailedThreats: true,
      includeMitigations: true,
      includeCharts: true,
    },
  }),
};