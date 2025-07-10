import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { Pool } from 'pg';
import Redis from 'ioredis';
import { Server } from 'http';
import { WebSocketServer } from 'ws';

import securityToolsRoutes from './routes/security-tools.routes';
import { errorHandler, notFound } from './middleware/error-handler';
import { logger, logApiRequest, logApiResponse } from './utils/logger';
import { SecurityToolsService } from './services/security-tools.service';
import { CorrelationService } from './services/correlation.service';

// Load environment variables
dotenv.config();

// Configuration
const PORT = process.env.PORT || 3024;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'threat_modeling',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

// Redis configuration
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0'),
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  }
};

// Initialize services
const db = new Pool(dbConfig);
const redis = new Redis(redisConfig);

// Test database connection
db.query('SELECT NOW()', (err, res) => {
  if (err) {
    logger.error('Database connection failed:', err);
    process.exit(1);
  } else {
    logger.info('Database connected successfully');
  }
});

// Test Redis connection
redis.ping((err, res) => {
  if (err) {
    logger.error('Redis connection failed:', err);
    process.exit(1);
  } else {
    logger.info('Redis connected successfully');
  }
});

// Create Express app
const app = express();

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  
  // Log request
  logApiRequest(req.method, req.path, (req as any).user?.userId);
  
  // Capture response
  const originalSend = res.send;
  res.send = function(data) {
    res.send = originalSend;
    logApiResponse(req.method, req.path, res.statusCode, Date.now() - start);
    return res.send(data);
  };
  
  next();
});

// Health check route
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'security-tools',
    version: process.env.npm_package_version || '1.0.0',
    environment: NODE_ENV,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  });
});

// API routes
app.use('/api/security-tools', securityToolsRoutes);

// 404 handler
app.use(notFound);

// Error handler
app.use(errorHandler);

// Create HTTP server
const server = new Server(app);

// WebSocket server for real-time updates
const wss = new WebSocketServer({ 
  server,
  path: '/ws/security-tools'
});

// WebSocket connection handler
wss.on('connection', (ws, req) => {
  logger.info('WebSocket client connected');
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      // Handle WebSocket messages
      handleWebSocketMessage(ws, data);
    } catch (error) {
      logger.error('WebSocket message error:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Invalid message format'
      }));
    }
  });
  
  ws.on('close', () => {
    logger.info('WebSocket client disconnected');
  });
  
  ws.on('error', (error) => {
    logger.error('WebSocket error:', error);
  });
  
  // Send initial connection confirmation
  ws.send(JSON.stringify({
    type: 'connected',
    timestamp: new Date().toISOString()
  }));
});

// WebSocket message handler
function handleWebSocketMessage(ws: any, data: any) {
  switch (data.type) {
    case 'subscribe':
      // Handle subscription to specific events
      // Implementation would manage subscriptions
      ws.send(JSON.stringify({
        type: 'subscribed',
        channel: data.channel
      }));
      break;
      
    case 'unsubscribe':
      // Handle unsubscription
      ws.send(JSON.stringify({
        type: 'unsubscribed',
        channel: data.channel
      }));
      break;
      
    default:
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Unknown message type'
      }));
  }
}

// Broadcast function for real-time updates
export function broadcast(type: string, data: any) {
  const message = JSON.stringify({
    type,
    data,
    timestamp: new Date().toISOString()
  });
  
  wss.clients.forEach((client) => {
    if (client.readyState === 1) { // WebSocket.OPEN
      client.send(message);
    }
  });
}

// Initialize services
const securityToolsService = new SecurityToolsService({
  redis,
  db,
  maxConcurrentSyncs: parseInt(process.env.MAX_CONCURRENT_SYNCS || '3'),
  correlationWindowMinutes: parseInt(process.env.CORRELATION_WINDOW_MINUTES || '15')
});

const correlationService = new CorrelationService({
  redis,
  db,
  correlationIntervalMs: parseInt(process.env.CORRELATION_INTERVAL_MS || '60000')
});

// Set up event listeners for real-time updates
securityToolsService.on('integration.connected', (data) => {
  broadcast('integration.connected', data);
});

securityToolsService.on('integration.error', (data) => {
  broadcast('integration.error', data);
});

securityToolsService.on('sync.completed', (data) => {
  broadcast('sync.completed', data);
});

securityToolsService.on('threat.detected', (data) => {
  broadcast('threat.detected', data);
});

correlationService.on('threat.correlated', (data) => {
  broadcast('threat.correlated', data);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  
  server.close(() => {
    logger.info('HTTP server closed');
  });
  
  wss.close(() => {
    logger.info('WebSocket server closed');
  });
  
  await securityToolsService.shutdown();
  await correlationService.shutdown();
  await db.end();
  await redis.quit();
  
  process.exit(0);
});

// Start server
server.listen(PORT, () => {
  logger.info(`Security Tools service started on port ${PORT} in ${NODE_ENV} mode`);
  logger.info(`WebSocket server available at ws://localhost:${PORT}/ws/security-tools`);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

export { app, server, db, redis };