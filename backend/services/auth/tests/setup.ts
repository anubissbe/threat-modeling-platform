import { beforeAll, afterAll } from '@jest/globals';

beforeAll(async () => {
  // Setup test environment
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-jwt-secret';
  process.env.REFRESH_TOKEN_SECRET = 'test-refresh-secret';
  process.env.DB_NAME = 'threat_modeling_test';
});

afterAll(async () => {
  // Cleanup after tests
});