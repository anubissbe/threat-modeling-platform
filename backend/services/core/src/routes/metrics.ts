import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';

const router = Router();

// Simple in-memory metrics storage
let metrics = {
  requests_total: 0,
  requests_duration_ms: 0,
  active_connections: 0,
  vulnerabilities_total: 0,
  threats_total: 0,
  projects_total: 0,
  users_total: 0,
  reports_generated_total: 0,
  last_updated: new Date().toISOString()
};

// Middleware to track request metrics
export const trackMetrics = (req: Request, res: Response, next: Function) => {
  const start = Date.now();
  metrics.requests_total++;
  metrics.active_connections++;
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    metrics.requests_duration_ms += duration;
    metrics.active_connections--;
    metrics.last_updated = new Date().toISOString();
  });
  
  next();
};

// GET /metrics - Prometheus format metrics
router.get('/', async (req: Request, res: Response) => {
  try {
    // Generate Prometheus format metrics
    const prometheusMetrics = `
# HELP http_requests_total Total number of HTTP requests
# TYPE http_requests_total counter
http_requests_total{service="core-service"} ${metrics.requests_total}

# HELP http_request_duration_ms Average HTTP request duration in milliseconds
# TYPE http_request_duration_ms gauge
http_request_duration_ms{service="core-service"} ${metrics.requests_total > 0 ? Math.round(metrics.requests_duration_ms / metrics.requests_total) : 0}

# HELP active_connections Current number of active connections
# TYPE active_connections gauge
active_connections{service="core-service"} ${metrics.active_connections}

# HELP vulnerabilities_total Total number of vulnerabilities
# TYPE vulnerabilities_total gauge
vulnerabilities_total{service="core-service"} ${metrics.vulnerabilities_total}

# HELP threats_total Total number of threats
# TYPE threats_total gauge
threats_total{service="core-service"} ${metrics.threats_total}

# HELP projects_total Total number of projects
# TYPE projects_total gauge
projects_total{service="core-service"} ${metrics.projects_total}

# HELP users_total Total number of users
# TYPE users_total gauge
users_total{service="core-service"} ${metrics.users_total}

# HELP reports_generated_total Total number of reports generated
# TYPE reports_generated_total counter
reports_generated_total{service="core-service"} ${metrics.reports_generated_total}

# HELP core_service_up Service health status
# TYPE core_service_up gauge
core_service_up{service="core-service"} 1

# HELP last_updated_timestamp Last metrics update timestamp
# TYPE last_updated_timestamp gauge
last_updated_timestamp{service="core-service"} ${Date.now()}
`.trim();

    res.set('Content-Type', 'text/plain');
    res.send(prometheusMetrics);
  } catch (error) {
    logger.error('Failed to generate metrics', { error });
    res.status(500).send('# Failed to generate metrics\n');
  }
});

// GET /metrics/health - Health check with metrics
router.get('/health', async (req: Request, res: Response) => {
  try {
    const healthMetrics = {
      status: 'healthy',
      service: 'core-service',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '0.1.0',
      metrics: {
        ...metrics,
        memory_usage: process.memoryUsage(),
        cpu_usage: process.cpuUsage()
      }
    };

    res.json(healthMetrics);
  } catch (error) {
    logger.error('Failed to generate health metrics', { error });
    res.status(500).json({
      status: 'unhealthy',
      error: 'Failed to generate health metrics'
    });
  }
});

// POST /metrics/update - Update metrics (internal use)
router.post('/update', async (req: Request, res: Response) => {
  try {
    const { type, value } = req.body;
    
    if (!type || value === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: type, value'
      });
    }
    
    switch (type) {
      case 'vulnerabilities_total':
      case 'threats_total':
      case 'projects_total':
      case 'users_total':
      case 'reports_generated_total':
        (metrics as any)[type] = parseInt(value);
        break;
      default:
        return res.status(400).json({
          success: false,
          error: `Unknown metric type: ${type}`
        });
    }
    
    metrics.last_updated = new Date().toISOString();
    
    return res.json({
      success: true,
      message: 'Metrics updated successfully',
      data: { type, value }
    });
  } catch (error) {
    logger.error('Failed to update metrics', { error });
    return res.status(500).json({
      success: false,
      error: 'Failed to update metrics'
    });
  }
});

// GET /metrics/json - JSON format metrics
router.get('/json', async (req: Request, res: Response) => {
  try {
    const jsonMetrics = {
      service: 'core-service',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      metrics: {
        ...metrics,
        memory_usage: process.memoryUsage(),
        cpu_usage: process.cpuUsage()
      }
    };

    res.json(jsonMetrics);
  } catch (error) {
    logger.error('Failed to generate JSON metrics', { error });
    res.status(500).json({
      error: 'Failed to generate JSON metrics'
    });
  }
});

export function createMetricsRouter(): Router {
  return router;
}

export { metrics };