/**
 * World-Class Performance Optimization Service
 * 
 * Features:
 * - Real-time performance monitoring
 * - Intelligent caching strategies
 * - Auto-scaling recommendations
 * - Performance analytics
 * - Resource optimization
 * - Load balancing optimization
 * - Database query optimization
 * - Memory leak detection
 * - CPU usage optimization
 * - Network latency optimization
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { PerformanceOptimizer } from './services/performance-optimizer.service';
import { PerformanceMonitor } from './services/performance-monitor.service';
import { CacheOptimizer } from './services/cache-optimizer.service';
import { AutoScaler } from './services/auto-scaler.service';
import { ResourceOptimizer } from './services/resource-optimizer.service';
import { DatabaseOptimizer } from './services/database-optimizer.service';
import { NetworkOptimizer } from './services/network-optimizer.service';
import { LoadBalancer } from './services/load-balancer.service';
import { logger } from './utils/logger';
import { performanceRoutes } from './routes/performance.routes';
import { metricsRoutes } from './routes/metrics.routes';
import { healthRoutes } from './routes/health.routes';
import { register, collectDefaultMetrics } from './utils/metrics';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });
const PORT = process.env.PORT || 3018;

// Initialize services
const performanceOptimizer = new PerformanceOptimizer();
const performanceMonitor = new PerformanceMonitor();
const cacheOptimizer = new CacheOptimizer();
const autoScaler = new AutoScaler();
const resourceOptimizer = new ResourceOptimizer();
const databaseOptimizer = new DatabaseOptimizer();
const networkOptimizer = new NetworkOptimizer();
const loadBalancer = new LoadBalancer();

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
}));

// Enable compression for better performance
app.use(compression({
  level: 6,
  threshold: 1024,
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
}));

// Rate limiting with performance considerations
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Higher limit for performance service
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests from this IP, please try again later.',
  },
});

app.use('/api/', limiter);
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Performance monitoring middleware
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    performanceMonitor.recordRequest({
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      timestamp: new Date(),
    });
  });
  
  next();
});

// Routes
app.use('/health', healthRoutes);
app.use('/api/performance', performanceRoutes);
app.use('/api/metrics', metricsRoutes);

// Main performance optimization endpoint
app.get('/api/performance/optimize', async (req, res) => {
  try {
    const optimizations = await performanceOptimizer.getOptimizationRecommendations();
    res.json({
      success: true,
      optimizations,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Performance optimization error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get optimization recommendations',
    });
  }
});

// Real-time performance metrics
app.get('/api/performance/metrics/live', async (req, res) => {
  try {
    const metrics = await performanceMonitor.getLiveMetrics();
    res.json({
      success: true,
      metrics,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Live metrics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get live metrics',
    });
  }
});

// Cache optimization
app.post('/api/performance/cache/optimize', async (req, res) => {
  try {
    const result = await cacheOptimizer.optimizeCache();
    res.json({
      success: true,
      optimization: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Cache optimization error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to optimize cache',
    });
  }
});

// Auto-scaling recommendations
app.get('/api/performance/scaling/recommendations', async (req, res) => {
  try {
    const recommendations = await autoScaler.getScalingRecommendations();
    res.json({
      success: true,
      recommendations,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Scaling recommendations error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get scaling recommendations',
    });
  }
});

// Resource optimization
app.post('/api/performance/resources/optimize', async (req, res) => {
  try {
    const result = await resourceOptimizer.optimizeResources();
    res.json({
      success: true,
      optimization: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Resource optimization error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to optimize resources',
    });
  }
});

// Database optimization
app.post('/api/performance/database/optimize', async (req, res) => {
  try {
    const result = await databaseOptimizer.optimizeDatabase();
    res.json({
      success: true,
      optimization: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Database optimization error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to optimize database',
    });
  }
});

// Network optimization
app.post('/api/performance/network/optimize', async (req, res) => {
  try {
    const result = await networkOptimizer.optimizeNetwork();
    res.json({
      success: true,
      optimization: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Network optimization error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to optimize network',
    });
  }
});

// Load balancing optimization
app.post('/api/performance/loadbalancer/optimize', async (req, res) => {
  try {
    const result = await loadBalancer.optimizeLoadBalancing();
    res.json({
      success: true,
      optimization: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Load balancer optimization error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to optimize load balancing',
    });
  }
});

// Performance benchmarking
app.post('/api/performance/benchmark', async (req, res) => {
  try {
    const { target, options } = req.body;
    const result = await performanceOptimizer.runBenchmark(target, options);
    res.json({
      success: true,
      benchmark: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Benchmark error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to run benchmark',
    });
  }
});

// Performance analytics dashboard data
app.get('/api/performance/analytics', async (req, res) => {
  try {
    const analytics = await performanceMonitor.getAnalyticsDashboard();
    res.json({
      success: true,
      analytics,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get analytics',
    });
  }
});

// Memory leak detection
app.get('/api/performance/memory/leaks', async (req, res) => {
  try {
    const leaks = await resourceOptimizer.detectMemoryLeaks();
    res.json({
      success: true,
      memoryLeaks: leaks,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Memory leak detection error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to detect memory leaks',
    });
  }
});

// Performance alerts configuration
app.post('/api/performance/alerts/configure', async (req, res) => {
  try {
    const { alertConfig } = req.body;
    const result = await performanceMonitor.configureAlerts(alertConfig);
    res.json({
      success: true,
      configuration: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Alert configuration error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to configure alerts',
    });
  }
});

// Health check endpoint with performance status
app.get('/health', async (req, res) => {
  try {
    const healthStatus = await performanceMonitor.getHealthStatus();
    res.json({
      status: 'healthy',
      service: 'world-class-performance-optimization-service',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      performance: healthStatus,
      features: [
        'real-time-monitoring',
        'intelligent-caching',
        'auto-scaling',
        'resource-optimization',
        'database-optimization',
        'network-optimization',
        'load-balancing',
        'memory-leak-detection',
        'performance-analytics',
        'benchmark-testing'
      ],
    });
  } catch (error) {
    logger.error('Health check error:', error);
    res.status(500).json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// WebSocket for real-time performance updates
wss.on('connection', (ws) => {
  logger.info('WebSocket client connected for performance monitoring');
  
  const sendPerformanceUpdate = async () => {
    try {
      const metrics = await performanceMonitor.getLiveMetrics();
      ws.send(JSON.stringify({
        type: 'performance-update',
        data: metrics,
        timestamp: new Date().toISOString(),
      }));
    } catch (error) {
      logger.error('WebSocket performance update error:', error);
    }
  };
  
  // Send initial data
  sendPerformanceUpdate();
  
  // Send updates every 5 seconds
  const interval = setInterval(sendPerformanceUpdate, 5000);
  
  ws.on('close', () => {
    clearInterval(interval);
    logger.info('WebSocket client disconnected');
  });
  
  ws.on('error', (error) => {
    logger.error('WebSocket error:', error);
    clearInterval(interval);
  });
});

// Prometheus metrics collection
collectDefaultMetrics({ register });

// Initialize performance optimization system
async function initializePerformanceSystem() {
  try {
    logger.info('Initializing World-Class Performance Optimization System...');
    
    // Start all optimization services
    await performanceOptimizer.initialize();
    await performanceMonitor.start();
    await cacheOptimizer.initialize();
    await autoScaler.initialize();
    await resourceOptimizer.initialize();
    await databaseOptimizer.initialize();
    await networkOptimizer.initialize();
    await loadBalancer.initialize();
    
    logger.info('✅ Performance optimization system initialized successfully');
    
    // Start continuous optimization
    setInterval(async () => {
      try {
        await performanceOptimizer.runContinuousOptimization();
      } catch (error) {
        logger.error('Continuous optimization error:', error instanceof Error ? error.message : String(error));
      }
    }, 60000); // Run every minute
    
  } catch (error) {
    logger.error('Failed to initialize performance system:', error);
    process.exit(1);
  }
}

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', err instanceof Error ? err.message : String(err));
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    timestamp: new Date().toISOString(),
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Performance optimization service stopped');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.info('Performance optimization service stopped');
    process.exit(0);
  });
});

// Start server
server.listen(PORT, async () => {
  logger.info(`🚀 World-Class Performance Optimization Service running on port ${PORT}`);
  console.log(`🚀 Performance Service: http://localhost:${PORT}`);
  console.log(`📊 Health Check: http://localhost:${PORT}/health`);
  console.log(`⚡ Live Metrics: http://localhost:${PORT}/api/performance/metrics/live`);
  console.log(`🔧 Optimization: http://localhost:${PORT}/api/performance/optimize`);
  
  await initializePerformanceSystem();
});

export default app;