import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import dotenv from 'dotenv';
import { createProjectRouter } from './routes/projects';
import { createThreatModelRouter } from './routes/threat-models';
import { createMethodologyRouter } from './routes/methodologies';
import { createThreatRouter } from './routes/threats';
import { createVulnerabilityRouter } from './routes/vulnerabilities';
import { createActivityRouter } from './routes/activity';
import { createHealthRouter } from './routes/health';
import { createMetricsRouter, trackMetrics } from './routes/metrics';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import { authenticateToken } from './middleware/auth';
import { logger } from './utils/logger';
import { rateLimiter } from './middleware/rate-limiter';
import { initializeDatabase } from './config/database';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3002;

// Initialize database
initializeDatabase().catch((error) => {
  logger.error('Failed to initialize database:', error);
  process.exit(1);
});

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3006'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting
app.use(rateLimiter);

// Metrics tracking
app.use(trackMetrics);

// Body parsing
app.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf) => {
    try {
      JSON.parse(buf.toString());
    } catch (e) {
      throw new Error('Invalid JSON');
    }
  }
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  next();
});

// Public routes
app.use('/health', createHealthRouter());
app.use('/metrics', createMetricsRouter());

// Protected routes
app.use('/api/projects', authenticateToken, createProjectRouter());
app.use('/api/threat-models', authenticateToken, createThreatModelRouter());
app.use('/api/methodologies', authenticateToken, createMethodologyRouter());
app.use('/api/threats', authenticateToken, createThreatRouter());
app.use('/api/vulnerabilities', authenticateToken, createVulnerabilityRouter());
app.use('/api/activity', authenticateToken, createActivityRouter());

// 404 handler
app.use(notFoundHandler);

// Error handling
app.use(errorHandler);

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  logger.info(`Core service listening on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;