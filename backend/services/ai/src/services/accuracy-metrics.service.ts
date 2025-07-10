import { logger } from '../utils/logger';
import { ThreatPattern } from './ml-threat-detector.service';

export interface MetricsData {
  timestamp: string;
  predictions_count: number;
  true_positives: number;
  false_positives: number;
  false_negatives: number;
  accuracy: number;
  average_confidence: number;
  average_processing_time: number;
}

interface PredictionResult {
  id: string;
  timestamp: Date;
  predicted_threats: ThreatPattern[];
  actual_threats?: ThreatPattern[];
  confidence_score: number;
  processing_time_ms: number;
  feedback_received: boolean;
  true_positives?: number;
  false_positives?: number;
  false_negatives?: number;
}

interface ModelMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1_score: number;
  total_predictions: number;
  average_confidence: number;
  average_processing_time: number;
}

/**
 * Service for tracking and calculating ML model accuracy metrics
 */
export class AccuracyMetricsService {
  private predictions: Map<string, PredictionResult> = new Map();
  private readonly MAX_HISTORY_SIZE = 10000;
  
  constructor() {
    logger.info('Accuracy Metrics Service initialized');
  }

  /**
   * Record a new prediction
   */
  public recordPrediction(
    id: string,
    predictedThreats: ThreatPattern[],
    confidenceScore: number,
    processingTime: number
  ): void {
    const prediction: PredictionResult = {
      id,
      timestamp: new Date(),
      predicted_threats: predictedThreats,
      confidence_score: confidenceScore,
      processing_time_ms: processingTime,
      feedback_received: false
    };
    
    this.predictions.set(id, prediction);
    
    // Maintain history size
    if (this.predictions.size > this.MAX_HISTORY_SIZE) {
      const oldestKey = this.predictions.keys().next().value;
      this.predictions.delete(oldestKey);
    }
    
    logger.debug('Prediction recorded', { id, threat_count: predictedThreats.length });
  }

  /**
   * Record feedback for a prediction
   */
  public recordFeedback(
    predictionId: string,
    actualThreats: ThreatPattern[],
    isAccurate: boolean
  ): void {
    const prediction = this.predictions.get(predictionId);
    if (!prediction) {
      logger.warn('Prediction not found for feedback', { predictionId });
      return;
    }
    
    prediction.actual_threats = actualThreats;
    prediction.feedback_received = true;
    
    // Calculate true/false positives and negatives
    const metrics = this.calculatePredictionMetrics(
      prediction.predicted_threats,
      actualThreats
    );
    
    prediction.true_positives = metrics.true_positives;
    prediction.false_positives = metrics.false_positives;
    prediction.false_negatives = metrics.false_negatives;
    
    logger.info('Feedback recorded', {
      predictionId,
      accurate: isAccurate,
      metrics
    });
  }

  /**
   * Calculate metrics for a single prediction
   */
  private calculatePredictionMetrics(
    predicted: ThreatPattern[],
    actual: ThreatPattern[]
  ): { true_positives: number; false_positives: number; false_negatives: number } {
    const predictedCategories = new Set(predicted.map(t => t.category));
    const actualCategories = new Set(actual.map(t => t.category));
    
    let truePositives = 0;
    let falsePositives = 0;
    let falseNegatives = 0;
    
    // Count true positives and false positives
    predictedCategories.forEach(category => {
      if (actualCategories.has(category)) {
        truePositives++;
      } else {
        falsePositives++;
      }
    });
    
    // Count false negatives
    actualCategories.forEach(category => {
      if (!predictedCategories.has(category)) {
        falseNegatives++;
      }
    });
    
    return {
      true_positives: truePositives,
      false_positives: falsePositives,
      false_negatives: falseNegatives
    };
  }

  /**
   * Calculate overall model metrics
   */
  public calculateMetrics(): ModelMetrics {
    const predictionsWithFeedback = Array.from(this.predictions.values())
      .filter(p => p.feedback_received);
    
    if (predictionsWithFeedback.length === 0) {
      return {
        accuracy: 0,
        precision: 0,
        recall: 0,
        f1_score: 0,
        total_predictions: this.predictions.size,
        average_confidence: 0,
        average_processing_time: 0
      };
    }
    
    // Aggregate metrics
    let totalTruePositives = 0;
    let totalFalsePositives = 0;
    let totalFalseNegatives = 0;
    let totalConfidence = 0;
    let totalProcessingTime = 0;
    
    predictionsWithFeedback.forEach(prediction => {
      totalTruePositives += prediction.true_positives || 0;
      totalFalsePositives += prediction.false_positives || 0;
      totalFalseNegatives += prediction.false_negatives || 0;
      totalConfidence += prediction.confidence_score;
      totalProcessingTime += prediction.processing_time_ms;
    });
    
    // Calculate metrics
    const precision = totalTruePositives / (totalTruePositives + totalFalsePositives) || 0;
    const recall = totalTruePositives / (totalTruePositives + totalFalseNegatives) || 0;
    const f1Score = 2 * (precision * recall) / (precision + recall) || 0;
    
    // Calculate accuracy (correct predictions / total predictions)
    const accuracy = predictionsWithFeedback.reduce((acc, pred) => {
      const correct = (pred.true_positives || 0) / 
        ((pred.true_positives || 0) + (pred.false_positives || 0) + (pred.false_negatives || 0));
      return acc + (correct || 0);
    }, 0) / predictionsWithFeedback.length;
    
    return {
      accuracy: Number(accuracy.toFixed(4)),
      precision: Number(precision.toFixed(4)),
      recall: Number(recall.toFixed(4)),
      f1_score: Number(f1Score.toFixed(4)),
      total_predictions: this.predictions.size,
      average_confidence: Number((totalConfidence / predictionsWithFeedback.length).toFixed(4)),
      average_processing_time: Number((totalProcessingTime / predictionsWithFeedback.length).toFixed(2))
    };
  }

  /**
   * Get metrics over time
   */
  public getMetricsOverTime(hours: number = 24): MetricsData[] {
    const now = new Date();
    const cutoffTime = new Date(now.getTime() - hours * 60 * 60 * 1000);
    
    const recentPredictions = Array.from(this.predictions.values())
      .filter(p => p.timestamp > cutoffTime && p.feedback_received)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    
    // Group by hour
    const hourlyMetrics: Map<string, MetricsData> = new Map();
    
    recentPredictions.forEach(prediction => {
      const hourKey = new Date(
        prediction.timestamp.getFullYear(),
        prediction.timestamp.getMonth(),
        prediction.timestamp.getDate(),
        prediction.timestamp.getHours()
      ).toISOString();
      
      if (!hourlyMetrics.has(hourKey)) {
        hourlyMetrics.set(hourKey, {
          timestamp: hourKey,
          predictions_count: 0,
          true_positives: 0,
          false_positives: 0,
          false_negatives: 0,
          accuracy: 0,
          average_confidence: 0,
          average_processing_time: 0
        });
      }
      
      const metrics = hourlyMetrics.get(hourKey)!;
      metrics.predictions_count++;
      metrics.true_positives += prediction.true_positives || 0;
      metrics.false_positives += prediction.false_positives || 0;
      metrics.false_negatives += prediction.false_negatives || 0;
      metrics.average_confidence += prediction.confidence_score;
      metrics.average_processing_time += prediction.processing_time_ms;
    });
    
    // Calculate averages and accuracy for each hour
    hourlyMetrics.forEach(metrics => {
      metrics.average_confidence /= metrics.predictions_count;
      metrics.average_processing_time /= metrics.predictions_count;
      
      const total = metrics.true_positives + metrics.false_positives + metrics.false_negatives;
      metrics.accuracy = total > 0 ? metrics.true_positives / total : 0;
    });
    
    return Array.from(hourlyMetrics.values());
  }

  /**
   * Get performance by threat category
   */
  public getPerformanceByCategory(): Record<string, ModelMetrics> {
    const categoryMetrics: Record<string, any> = {};
    
    Array.from(this.predictions.values())
      .filter(p => p.feedback_received)
      .forEach(prediction => {
        prediction.predicted_threats.forEach(threat => {
          if (!categoryMetrics[threat.category]) {
            categoryMetrics[threat.category] = {
              true_positives: 0,
              false_positives: 0,
              false_negatives: 0,
              total_predictions: 0,
              total_confidence: 0,
              total_processing_time: 0
            };
          }
          
          const metrics = categoryMetrics[threat.category];
          metrics.total_predictions++;
          metrics.total_confidence += threat.confidence_score;
          metrics.total_processing_time += prediction.processing_time_ms;
          
          // Check if this threat was correct
          const wasCorrect = prediction.actual_threats?.some(
            actualThreat => actualThreat.category === threat.category
          );
          
          if (wasCorrect) {
            metrics.true_positives++;
          } else {
            metrics.false_positives++;
          }
        });
        
        // Count false negatives per category
        prediction.actual_threats?.forEach(actualThreat => {
          const wasPredicted = prediction.predicted_threats.some(
            predThreat => predThreat.category === actualThreat.category
          );
          
          if (!wasPredicted) {
            if (!categoryMetrics[actualThreat.category]) {
              categoryMetrics[actualThreat.category] = {
                true_positives: 0,
                false_positives: 0,
                false_negatives: 0,
                total_predictions: 0,
                total_confidence: 0,
                total_processing_time: 0
              };
            }
            categoryMetrics[actualThreat.category].false_negatives++;
          }
        });
      });
    
    // Calculate final metrics for each category
    const result: Record<string, ModelMetrics> = {};
    
    Object.entries(categoryMetrics).forEach(([category, metrics]) => {
      const precision = metrics.true_positives / 
        (metrics.true_positives + metrics.false_positives) || 0;
      const recall = metrics.true_positives / 
        (metrics.true_positives + metrics.false_negatives) || 0;
      const f1Score = 2 * (precision * recall) / (precision + recall) || 0;
      const accuracy = metrics.true_positives / 
        (metrics.true_positives + metrics.false_positives + metrics.false_negatives) || 0;
      
      result[category] = {
        accuracy: Number(accuracy.toFixed(4)),
        precision: Number(precision.toFixed(4)),
        recall: Number(recall.toFixed(4)),
        f1_score: Number(f1Score.toFixed(4)),
        total_predictions: metrics.total_predictions,
        average_confidence: Number((metrics.total_confidence / metrics.total_predictions).toFixed(4)),
        average_processing_time: Number((metrics.total_processing_time / metrics.total_predictions).toFixed(2))
      };
    });
    
    return result;
  }

  /**
   * Get recent predictions for review
   */
  public getRecentPredictions(limit: number = 10): PredictionResult[] {
    return Array.from(this.predictions.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Export metrics for analysis
   */
  public exportMetrics(): any {
    const overallMetrics = this.calculateMetrics();
    const categoryMetrics = this.getPerformanceByCategory();
    const timeSeriesMetrics = this.getMetricsOverTime(24 * 7); // Last 7 days
    
    return {
      export_timestamp: new Date().toISOString(),
      overall_metrics: overallMetrics,
      category_performance: categoryMetrics,
      time_series: timeSeriesMetrics,
      total_predictions: this.predictions.size,
      predictions_with_feedback: Array.from(this.predictions.values())
        .filter(p => p.feedback_received).length
    };
  }

  /**
   * Clear old predictions to free memory
   */
  public clearOldPredictions(daysToKeep: number = 30): number {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    let deletedCount = 0;
    this.predictions.forEach((prediction, id) => {
      if (prediction.timestamp < cutoffDate) {
        this.predictions.delete(id);
        deletedCount++;
      }
    });
    
    logger.info(`Cleared ${deletedCount} old predictions`);
    return deletedCount;
  }
}