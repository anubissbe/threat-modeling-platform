import { Router } from 'express';

const router = Router();

router.get('/', (_req, res) => {
  res.json({
    status: 'healthy',
    service: 'diagram-service',
    timestamp: new Date().toISOString(),
    version: '0.1.0'
  });
});

export { router as healthRoutes };