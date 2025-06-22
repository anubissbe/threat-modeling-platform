import { vi } from 'vitest';

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-testing-purposes-only';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.EMAIL_FROM_ADDRESS = 'test@example.com';

// Mock external services
vi.mock('ioredis', () => {
  return {
    default: vi.fn(() => ({
      get: vi.fn(),
      set: vi.fn(),
      sadd: vi.fn(),
      srem: vi.fn(),
      sismember: vi.fn(),
      quit: vi.fn(),
    })),
  };
});

vi.mock('bullmq', () => ({
  Queue: vi.fn(() => ({
    add: vi.fn(),
    getWaitingCount: vi.fn(() => 0),
    getActiveCount: vi.fn(() => 0),
    getCompletedCount: vi.fn(() => 0),
    getFailedCount: vi.fn(() => 0),
    getDelayedCount: vi.fn(() => 0),
    pause: vi.fn(),
    resume: vi.fn(),
    drain: vi.fn(),
    close: vi.fn(),
  })),
  Worker: vi.fn(() => ({
    on: vi.fn(),
    close: vi.fn(),
  })),
  QueueEvents: vi.fn(() => ({
    on: vi.fn(),
    close: vi.fn(),
  })),
}));

vi.mock('nodemailer', () => ({
  createTransporter: vi.fn(() => ({
    verify: vi.fn(() => Promise.resolve(true)),
    sendMail: vi.fn(() => Promise.resolve({
      messageId: 'test-message-id',
      accepted: ['test@example.com'],
      rejected: [],
      response: 'OK',
    })),
  })),
}));

vi.mock('@sendgrid/mail', () => ({
  setApiKey: vi.fn(),
  send: vi.fn(() => Promise.resolve([{
    statusCode: 202,
    headers: { 'x-message-id': 'sg-test-id' },
  }])),
}));

vi.mock('twilio', () => ({
  default: vi.fn(() => ({
    api: {
      accounts: vi.fn(() => ({
        fetch: vi.fn(() => Promise.resolve({
          sid: 'test-account-sid',
          status: 'active',
        })),
      })),
    },
    messages: {
      create: vi.fn(() => Promise.resolve({
        sid: 'test-message-sid',
        status: 'sent',
      })),
    },
    accountSid: 'test-account-sid',
  })),
}));

vi.mock('@slack/webhook', () => ({
  IncomingWebhook: vi.fn(() => ({
    send: vi.fn(() => Promise.resolve({ ok: true })),
  })),
}));

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      request: vi.fn(() => Promise.resolve({
        status: 200,
        statusText: 'OK',
        data: { success: true },
      })),
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
    })),
    get: vi.fn(() => Promise.resolve({
      data: { user: { id: 'test-user' } },
    })),
    post: vi.fn(() => Promise.resolve({
      data: { ok: true },
    })),
  },
}));

vi.mock('jsonwebtoken', () => ({
  verify: vi.fn(() => ({
    sub: 'test-user-id',
    email: 'test@example.com',
    roles: ['user'],
    iat: Date.now(),
    exp: Date.now() + 3600000,
  })),
}));

// Mock file system operations
vi.mock('fs/promises', () => ({
  readdir: vi.fn(() => Promise.resolve(['threat_detected.hbs'])),
  readFile: vi.fn(() => Promise.resolve('{{threat.title}}')),
}));

// Global test setup
beforeEach(() => {
  vi.clearAllTimers();
});

afterEach(() => {
  vi.restoreAllMocks();
});