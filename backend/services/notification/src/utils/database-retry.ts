import { logger } from './logger';
import database from '../config/database';

export async function connectWithRetry(maxRetries = 10, retryDelay = 5000): Promise<void> {
  let retries = 0;
  
  while (retries < maxRetries) {
    try {
      logger.info(`Attempting database connection... (attempt ${retries + 1}/${maxRetries})`);
      await database.connect();
      logger.info('Database connected successfully');
      return;
    } catch (error) {
      retries++;
      if (retries === maxRetries) {
        logger.error('Maximum retries reached. Database connection failed:', error);
        throw error;
      }
      logger.warn(`Database connection failed, retrying in ${retryDelay / 1000} seconds...`, error);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }
}