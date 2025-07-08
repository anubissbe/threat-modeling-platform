import dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Set test environment
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';

// Mock Redis for tests
jest.mock('../src/config/redis', () => ({
  redisClient: {
    get: jest.fn(),
    set: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
    keys: jest.fn(),
    ping: jest.fn().mockResolvedValue('PONG'),
    quit: jest.fn(),
  },
  redisSubscriber: {
    subscribe: jest.fn(),
    unsubscribe: jest.fn(),
    on: jest.fn(),
    disconnect: jest.fn(),
  },
  initializeRedis: jest.fn().mockResolvedValue({
    get: jest.fn(),
    set: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
    keys: jest.fn(),
    ping: jest.fn().mockResolvedValue('PONG'),
    quit: jest.fn(),
  }),
  CacheKeys: {
    INTEGRATION: (id: string) => `integration:${id}`,
    INTEGRATION_BY_USER: (userId: string) => `integrations:user:${userId}`,
    INTEGRATION_MAPPINGS: (integrationId: string) => `mappings:integration:${integrationId}`,
    WEBHOOK_SECRET: (provider: string, integrationId: string) => `webhook:secret:${provider}:${integrationId}`,
    SYNC_LOCK: (integrationId: string) => `sync:lock:${integrationId}`,
    RATE_LIMIT: (key: string) => `rate_limit:${key}`,
  },
  PubSubChannels: {
    INTEGRATION_CREATED: 'integration:created',
    INTEGRATION_UPDATED: 'integration:updated',
    INTEGRATION_DELETED: 'integration:deleted',
    SYNC_STARTED: 'sync:started',
    SYNC_COMPLETED: 'sync:completed',
    SYNC_FAILED: 'sync:failed',
    WEBHOOK_RECEIVED: 'webhook:received',
    WEBHOOK_PROCESSED: 'webhook:processed',
  },
  setCache: jest.fn(),
  getCache: jest.fn(),
  deleteCache: jest.fn(),
  invalidateUserIntegrationCache: jest.fn(),
}));

// Mock database for tests
jest.mock('../src/config/database', () => ({
  pool: {
    connect: jest.fn().mockResolvedValue({
      query: jest.fn(),
      release: jest.fn(),
    }),
    query: jest.fn(),
    end: jest.fn(),
    on: jest.fn(),
  },
  query: jest.fn(),
  getClient: jest.fn().mockResolvedValue({
    query: jest.fn(),
    release: jest.fn(),
    client: {},
  }),
  initializeDatabase: jest.fn(),
}));

// Global test timeout
jest.setTimeout(10000);

// Clean up after all tests
afterAll(async () => {
  // Close any open handles
  await new Promise(resolve => setTimeout(resolve, 500));
});