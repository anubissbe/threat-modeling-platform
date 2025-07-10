import express, { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';
import { AccuracyMetricsService } from '../services/accuracy-metrics.service';

const router: Router = express.Router();
const metricsService = new AccuracyMetricsService();

/**
 * Get overall accuracy metrics
 */
router.get('/accuracy', async (req: Request, res: Response) => {
  try {
    const metrics = metricsService.calculateMetrics();
    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    logger.error('Error fetching accuracy metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch accuracy metrics'
    });
  }
});

/**
 * Get metrics over time
 */
router.get('/accuracy/time-series', async (req: Request, res: Response) => {
  try {
    const hours = parseInt(req.query.hours as string) || 24;
    const timeSeries = metricsService.getMetricsOverTime(hours);
    res.json({
      success: true,
      data: timeSeries
    });
  } catch (error) {
    logger.error('Error fetching time series metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch time series metrics'
    });
  }
});

/**
 * Get performance by threat category
 */
router.get('/accuracy/by-category', async (req: Request, res: Response) => {
  try {
    const categoryMetrics = metricsService.getPerformanceByCategory();
    res.json({
      success: true,
      data: categoryMetrics
    });
  } catch (error) {
    logger.error('Error fetching category metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch category metrics'
    });
  }
});

/**
 * Record feedback for a prediction
 */
router.post('/accuracy/feedback', async (req: Request, res: Response): Promise<Response> => {
  try {
    const { prediction_id, actual_threats, is_accurate } = req.body;
    
    if (!prediction_id) {
      return res.status(400).json({
        success: false,
        error: 'Prediction ID is required'
      });
    }
    
    metricsService.recordFeedback(prediction_id, actual_threats || [], is_accurate);
    
    return res.json({
      success: true,
      message: 'Feedback recorded successfully'
    });
  } catch (error) {
    logger.error('Error recording feedback:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to record feedback'
    });
  }
});

/**
 * Export all metrics data
 */
router.get('/accuracy/export', async (req: Request, res: Response) => {
  try {
    const exportData = metricsService.exportMetrics();
    res.json({
      success: true,
      data: exportData
    });
  } catch (error) {
    logger.error('Error exporting metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export metrics'
    });
  }
});

export default router;