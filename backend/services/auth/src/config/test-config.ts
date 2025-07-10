/**
 * Test Configuration for SSO Testing
 * Switches to mock database when testing mode is enabled
 */

// Use mock database for testing
export const USE_MOCK_DATABASE = process.env.NODE_ENV === 'test' || process.env.USE_MOCK_DB === 'true';

// Test database configuration
export const TEST_DATABASE_CONFIG = {
  connectionString: 'mock://test-database',
  testUser: {
    email: 'admin@threat-modeling.com',
    password: 'TestPassword123@',
    role: 'admin',
    organization: 'test-org'
  }
};

// Mock JWT secret for testing
export const TEST_JWT_SECRET = 'test-jwt-secret-for-sso-testing-only';

export const TEST_CONFIG = {
  port: 3001,
  jwtSecret: TEST_JWT_SECRET,
  jwtExpiresIn: '24h',
  database: TEST_DATABASE_CONFIG
};