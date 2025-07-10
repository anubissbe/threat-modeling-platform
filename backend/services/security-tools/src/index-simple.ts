import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from 'dotenv';

// Load environment variables
config();

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'security-tools-service',
    version: '1.0.0'
  });
});

// Basic API endpoints
app.get('/api/security-tools/integrations', (req, res) => {
  res.json([]);
});

app.post('/api/security-tools/integrations', (req, res) => {
  res.status(201).json({
    id: 'test-integration-' + Date.now(),
    name: req.body.name || 'Test Integration',
    type: req.body.type || 'vulnerability-scanner',
    platform: req.body.platform || 'nessus',
    status: 'connected',
    createdAt: new Date()
  });
});

app.get('/api/security-tools/vulnerabilities', (req, res) => {
  res.json([]);
});

app.get('/api/security-tools/scans', (req, res) => {
  res.json([]);
});

// Error handling
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', error);
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

// Start server
const PORT = process.env.PORT || 3011;

app.listen(PORT, () => {
  console.log(`Security tools service listening on port ${PORT}`);
});

export default app;