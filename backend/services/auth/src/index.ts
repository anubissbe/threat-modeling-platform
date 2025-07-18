import express from 'express';
import dotenv from 'dotenv';
import { createAuthRouter } from './routes/auth';
import { createHealthRouter } from './routes/health';
import { createEnterpriseSSORouter } from './routes/enterprise-sso';
import { createSSOManagementRouter } from './routes/sso-management';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import { logger } from './utils/logger';
import { applySecurityMiddleware } from './middleware/security.middleware';
import { auditService, AuditEventType } from './services/audit.service';

dotenv.config();

const app = express();
const PORT = process.env['PORT'] || 3001;

// Apply comprehensive security middleware
applySecurityMiddleware(app);

// Body parsing
app.use(express.json({ 
  limit: '10mb'
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Routes
app.use('/health', createHealthRouter());
app.use('/api/auth', createAuthRouter());
app.use('/api/auth/sso', createEnterpriseSSORouter());
app.use('/api/auth/sso', createSSOManagementRouter());

// 404 handler
app.use(notFoundHandler);

// Error handling
app.use(errorHandler);

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  logger.info(`${signal} received, shutting down gracefully`);
  
  // Flush audit logs
  await auditService.shutdown();
  
  // Log system shutdown
  await auditService.logEvent({
    eventType: AuditEventType.SYSTEM_STOP,
    action: `System shutdown via ${signal}`,
    result: 'SUCCESS',
  });
  
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Unhandled rejection handling
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  auditService.logSecurityAlert({
    alertType: 'UNHANDLED_REJECTION',
    severity: 'HIGH',
    details: { reason: reason?.toString() },
  });
});

// Start server
app.listen(PORT, async () => {
  logger.info(`Auth service listening on port ${PORT}`);
  logger.info(`Environment: ${process.env['NODE_ENV'] || 'development'}`);
  
  // Log system start
  await auditService.logEvent({
    eventType: AuditEventType.SYSTEM_START,
    action: 'Auth service started',
    result: 'SUCCESS',
    metadata: {
      port: PORT,
      environment: process.env['NODE_ENV'] || 'development',
    },
  });
});

export default app;