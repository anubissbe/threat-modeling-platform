import { logger } from '../src/utils/logger';

// Set test environment
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';

// Mock console methods in tests
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;

beforeAll(() => {
  // Allow console.log in tests for verification output
  console.log = originalLog;
  console.error = jest.fn();
  console.warn = jest.fn();
});

afterAll(() => {
  // Restore original console methods
  console.log = originalLog;
  console.error = originalError;
  console.warn = originalWarn;
});

// Global test timeout
jest.setTimeout(30000);

// Mock Redis for testing
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    setex: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    exists: jest.fn().mockResolvedValue(0),
    expire: jest.fn().mockResolvedValue(1),
    keys: jest.fn().mockResolvedValue([]),
    flushdb: jest.fn().mockResolvedValue('OK'),
    ping: jest.fn().mockResolvedValue('PONG'),
    quit: jest.fn().mockResolvedValue('OK'),
    on: jest.fn(),
    connect: jest.fn().mockResolvedValue(undefined)
  }));
});

// Mock system information
jest.mock('systeminformation', () => ({
  cpu: jest.fn().mockResolvedValue({
    usage: 50,
    cores: 4
  }),
  mem: jest.fn().mockResolvedValue({
    total: 8589934592,
    used: 4294967296,
    free: 4294967296,
    buffers: 0,
    cached: 0
  }),
  fsSize: jest.fn().mockResolvedValue([{
    size: 1000000000,
    used: 500000000,
    available: 500000000,
    use: 50
  }]),
  networkStats: jest.fn().mockResolvedValue([{
    rx_bytes: 1000000,
    tx_bytes: 2000000,
    rx_packets: 1000,
    tx_packets: 2000,
    rx_errors: 0
  }])
}));

// Mock process usage
jest.mock('pidusage', () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue({
    cpu: 50,
    memory: 1024 * 1024 * 100 // 100MB
  })
}));

// Mock cluster
jest.mock('cluster', () => ({
  isMaster: true,
  fork: jest.fn().mockReturnValue({
    id: 1,
    process: { pid: 1234 },
    on: jest.fn()
  }),
  on: jest.fn(),
  workers: {}
}));

// Suppress Winston logging during tests
logger.transports.forEach(transport => {
  transport.silent = true;
});