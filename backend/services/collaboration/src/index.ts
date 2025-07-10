import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { createClient } from 'redis';
import { Pool } from 'pg';
import { config } from 'dotenv';
import { WebSocketService } from './services/websocket.service';
import { logger } from './utils/logger';

// Load environment variables
config();

const app = express();
const server = createServer(app);

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3006',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Database connection
const db = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'threatmodel_db',
  user: process.env.DB_USER || 'threatmodel',
  password: process.env.DB_PASSWORD || 'threatmodel123',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Redis connection
const redis = createClient({
  socket: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
  password: process.env.REDIS_PASSWORD || undefined,
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    // Check database connection
    await db.query('SELECT 1');
    
    // Check Redis connection
    await redis.ping();

    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'collaboration-service',
      version: process.env.npm_package_version || '1.0.0',
      dependencies: {
        database: 'healthy',
        redis: 'healthy',
        websocket: 'healthy'
      }
    });
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      service: 'collaboration-service',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// API endpoints
app.get('/api/collaboration/stats', (req, res) => {
  const stats = websocketService.getStats();
  res.json(stats);
});

app.post('/api/collaboration/broadcast/:roomId', (req, res) => {
  const { roomId } = req.params;
  const { event, data } = req.body;
  
  websocketService.broadcastToRoom(roomId, event, data);
  res.json({ success: true });
});

app.get('/api/collaboration/users/:roomId', async (req, res) => {
  const { roomId } = req.params;
  const users = await websocketService.getActiveUsers(roomId);
  res.json(users);
});

// Error handling
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: `Route ${req.originalUrl} not found`
  });
});

// Initialize services
let websocketService: WebSocketService;

async function initializeServices() {
  try {
    // Connect to Redis
    await redis.connect();
    logger.info('Redis connected successfully');

    // Test database connection
    await db.query('SELECT 1');
    logger.info('Database connected successfully');

    // Initialize WebSocket service
    websocketService = new WebSocketService(server, redis, db);
    logger.info('WebSocket service initialized');

  } catch (error) {
    logger.error('Failed to initialize services:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  
  if (websocketService && typeof websocketService.shutdown === 'function') {
    await websocketService.shutdown();
  }
  
  await redis.quit();
  await db.end();
  
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  
  if (websocketService && typeof websocketService.shutdown === 'function') {
    await websocketService.shutdown();
  }
  
  await redis.quit();
  await db.end();
  
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

// Start server
const PORT = process.env.PORT || 3012;

initializeServices().then(() => {
  server.listen(PORT, () => {
    logger.info(`Collaboration service listening on port ${PORT}`);
    logger.info(`WebSocket service available on port 8000`);
  });
});

export default app;