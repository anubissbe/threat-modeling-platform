import { connectDatabase, closeDatabase } from '../src/database';
import { logger } from '../src/utils/logger';

// Global test setup
beforeAll(async () => {
  try {
    await connectDatabase();
    logger.info('Test database connected');
  } catch (error) {
    logger.error('Failed to connect to test database:', error);
    throw error;
  }
});

// Global test teardown
afterAll(async () => {
  try {
    await closeDatabase();
    logger.info('Test database disconnected');
  } catch (error) {
    logger.error('Failed to disconnect from test database:', error);
  }
});

// Silence console output during tests unless explicitly enabled
if (!process.env.VERBOSE_TESTS) {
  console.log = jest.fn();
  console.warn = jest.fn();
  console.error = jest.fn();
}