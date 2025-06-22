#!/usr/bin/env node

import { startApp } from './app';
import { logger } from './utils/logger';

// Start the application
startApp().catch((error) => {
  logger.fatal('Failed to start server:', error);
  process.exit(1);
});