import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import dotenv from 'dotenv';
import { createAuthRouter } from './routes/auth';
import { createHealthRouter } from './routes/health';
import { errorHandler } from './middleware/error-handler';
import { logger } from './utils/logger';
import { rateLimiter } from './middleware/rate-limiter';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3006'],
  credentials: true
}));

// Rate limiting
app.use(rateLimiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/health', createHealthRouter());
app.use('/api/auth', createAuthRouter());

// Error handling
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  logger.info(`Auth service listening on port ${PORT}`);
});

export default app;