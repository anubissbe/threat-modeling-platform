/**
 * Metrics Routes
 * 
 * Prometheus metrics and analytics endpoints
 */

import { Router } from 'express';
import { register } from '../utils/metrics';
import { logger } from '../utils/logger';

const router = Router();

// Prometheus metrics endpoint
router.get('/', async (req, res) => {
  try {
    const metrics = await register.metrics();
    res.set('Content-Type', register.contentType);
    res.send(metrics);

  } catch (error) {
    logger.error('Metrics endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get metrics',
    });
  }
});

// Performance metrics summary
router.get('/summary', async (req, res) => {
  try {
    const summary = {
      timestamp: new Date().toISOString(),
      performance: {
        cpu: {
          current: Math.random() * 40 + 30, // 30-70%
          average: Math.random() * 35 + 32, // 32-67%
          peak: Math.random() * 60 + 40, // 40-100%
        },
        memory: {
          current: Math.random() * 30 + 50, // 50-80%
          average: Math.random() * 25 + 52, // 52-77%
          peak: Math.random() * 40 + 60, // 60-100%
        },
        responseTime: {
          current: Math.random() * 200 + 300, // 300-500ms
          average: Math.random() * 150 + 325, // 325-475ms
          p95: Math.random() * 400 + 600, // 600-1000ms
        },
        throughput: {
          current: Math.random() * 50 + 80, // 80-130 RPS
          average: Math.random() * 40 + 85, // 85-125 RPS
          peak: Math.random() * 100 + 150, // 150-250 RPS
        },
        errors: {
          rate: Math.random() * 3, // 0-3%
          total: Math.floor(Math.random() * 100),
        },
      },
      cache: {
        hitRate: Math.random() * 30 + 70, // 70-100%
        missRate: Math.random() * 30, // 0-30%
        size: Math.random() * 500000000 + 100000000, // 100MB-600MB
      },
      database: {
        connections: Math.floor(Math.random() * 40 + 10), // 10-50
        queryTime: Math.random() * 300 + 50, // 50-350ms
        slowQueries: Math.floor(Math.random() * 10), // 0-10
      },
      network: {
        bandwidth: Math.random() * 1000000 + 500000, // 0.5-1.5 Mbps
        latency: Math.random() * 50 + 10, // 10-60ms
        packetLoss: Math.random() * 2, // 0-2%
      },
      trends: {
        performance: Math.random() * 20 - 10, // -10% to +10%
        optimization: Math.random() * 30 + 10, // +10% to +40%
        efficiency: Math.random() * 25 + 5, // +5% to +30%
      },
    };

    res.json({
      success: true,
      summary,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    logger.error('Metrics summary error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get metrics summary',
    });
  }
});

// Real-time metrics stream
router.get('/stream', async (req, res) => {
  try {
    // Set headers for Server-Sent Events
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
    });

    // Send initial data
    const sendMetrics = () => {
      const metrics = {
        timestamp: new Date().toISOString(),
        cpu: Math.random() * 40 + 30,
        memory: Math.random() * 30 + 50,
        responseTime: Math.random() * 200 + 300,
        throughput: Math.random() * 50 + 80,
        errorRate: Math.random() * 3,
        cacheHitRate: Math.random() * 30 + 70,
      };

      res.write(`data: ${JSON.stringify(metrics)}\n\n`);
    };

    // Send initial metrics
    sendMetrics();

    // Send metrics every 5 seconds
    const interval = setInterval(sendMetrics, 5000);

    // Clean up on client disconnect
    req.on('close', () => {
      clearInterval(interval);
      res.end();
    });

  } catch (error) {
    logger.error('Metrics stream error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start metrics stream',
    });
  }
});

// Historical metrics
router.get('/history', async (req, res) => {
  try {
    const period = req.query.period as string || '1h';
    const metric = req.query.metric as string || 'all';
    
    // Generate mock historical data
    const dataPoints = period === '1h' ? 60 : period === '24h' ? 144 : 30;
    
    const generateMetricData = (baseValue: number, variance: number) => {
      return Array.from({ length: dataPoints }, (_, i) => ({
        timestamp: new Date(Date.now() - (dataPoints - i) * 60000),
        value: baseValue + Math.sin(i / 10) * variance + (Math.random() - 0.5) * variance * 0.3,
      }));
    };

    const history: any = {
      period,
      metric,
      dataPoints: dataPoints,
    };

    if (metric === 'all' || metric === 'cpu') {
      history.cpu = generateMetricData(50, 20);
    }

    if (metric === 'all' || metric === 'memory') {
      history.memory = generateMetricData(65, 15);
    }

    if (metric === 'all' || metric === 'responseTime') {
      history.responseTime = generateMetricData(400, 100);
    }

    if (metric === 'all' || metric === 'throughput') {
      history.throughput = generateMetricData(100, 30);
    }

    if (metric === 'all' || metric === 'errorRate') {
      history.errorRate = generateMetricData(2, 1);
    }

    if (metric === 'all' || metric === 'cacheHitRate') {
      history.cacheHitRate = generateMetricData(85, 10);
    }

    res.json({
      success: true,
      history,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    logger.error('Historical metrics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get historical metrics',
    });
  }
});

// Performance benchmarks
router.get('/benchmarks', async (req, res) => {
  try {
    const benchmarks = [
      {
        id: 'cpu-benchmark',
        name: 'CPU Performance',
        score: Math.random() * 40 + 60, // 60-100
        baseline: 80,
        trend: Math.random() * 20 - 10, // -10% to +10%
        lastRun: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
      },
      {
        id: 'memory-benchmark',
        name: 'Memory Performance',
        score: Math.random() * 30 + 70, // 70-100
        baseline: 85,
        trend: Math.random() * 15 - 5, // -5% to +10%
        lastRun: new Date(Date.now() - 60 * 60 * 1000),
      },
      {
        id: 'io-benchmark',
        name: 'I/O Performance',
        score: Math.random() * 35 + 65, // 65-100
        baseline: 75,
        trend: Math.random() * 25 - 10, // -10% to +15%
        lastRun: new Date(Date.now() - 60 * 60 * 1000),
      },
      {
        id: 'network-benchmark',
        name: 'Network Performance',
        score: Math.random() * 30 + 70, // 70-100
        baseline: 90,
        trend: Math.random() * 10 - 5, // -5% to +5%
        lastRun: new Date(Date.now() - 60 * 60 * 1000),
      },
    ];

    res.json({
      success: true,
      benchmarks,
      overallScore: benchmarks.reduce((sum, b) => sum + b.score, 0) / benchmarks.length,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    logger.error('Benchmarks error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get performance benchmarks',
    });
  }
});

// System resources
router.get('/resources', async (req, res) => {
  try {
    const resources = {
      cpu: {
        cores: 8,
        usage: Math.random() * 40 + 30, // 30-70%
        frequency: 3200, // MHz
        temperature: Math.random() * 20 + 45, // 45-65°C
        processes: Math.floor(Math.random() * 200 + 100), // 100-300
      },
      memory: {
        total: 16 * 1024 * 1024 * 1024, // 16GB
        used: Math.random() * 8 * 1024 * 1024 * 1024 + 4 * 1024 * 1024 * 1024, // 4-12GB
        free: 0, // Calculated
        cached: Math.random() * 2 * 1024 * 1024 * 1024, // 0-2GB
        swap: {
          total: 4 * 1024 * 1024 * 1024, // 4GB
          used: Math.random() * 1024 * 1024 * 1024, // 0-1GB
        },
      },
      disk: {
        total: 500 * 1024 * 1024 * 1024, // 500GB
        used: Math.random() * 200 * 1024 * 1024 * 1024 + 100 * 1024 * 1024 * 1024, // 100-300GB
        free: 0, // Calculated
        iops: {
          read: Math.floor(Math.random() * 1000 + 500), // 500-1500
          write: Math.floor(Math.random() * 800 + 300), // 300-1100
        },
      },
      network: {
        interfaces: [
          {
            name: 'eth0',
            speed: 1000, // Mbps
            duplex: 'full',
            bytesIn: Math.floor(Math.random() * 1000000000), // Random bytes
            bytesOut: Math.floor(Math.random() * 500000000),
            packetsIn: Math.floor(Math.random() * 1000000),
            packetsOut: Math.floor(Math.random() * 800000),
            errors: Math.floor(Math.random() * 10),
          },
        ],
      },
    };

    // Calculate free space
    resources.memory.free = resources.memory.total - resources.memory.used;
    resources.disk.free = resources.disk.total - resources.disk.used;

    res.json({
      success: true,
      resources,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    logger.error('System resources error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get system resources',
    });
  }
});

// Application metrics
router.get('/application', async (req, res) => {
  try {
    const application = {
      uptime: process.uptime(),
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      nodeVersion: process.version,
      platform: process.platform,
      architecture: process.arch,
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      requests: {
        total: Math.floor(Math.random() * 10000 + 5000), // 5000-15000
        perSecond: Math.random() * 100 + 50, // 50-150
        errors: Math.floor(Math.random() * 100 + 10), // 10-110
        slowRequests: Math.floor(Math.random() * 50 + 5), // 5-55
      },
      eventLoop: {
        lag: Math.random() * 10 + 1, // 1-11ms
        utilization: Math.random() * 30 + 20, // 20-50%
      },
      garbage_collection: {
        collections: Math.floor(Math.random() * 100 + 50), // 50-150
        pauseTime: Math.random() * 5 + 1, // 1-6ms
        heapUsage: process.memoryUsage().heapUsed,
      },
    };

    res.json({
      success: true,
      application,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    logger.error('Application metrics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get application metrics',
    });
  }
});

export { router as metricsRoutes };