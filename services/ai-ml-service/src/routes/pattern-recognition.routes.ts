/**
 * Pattern Recognition API Routes for Task 3.3
 * Comprehensive pattern detection and analysis endpoints
 */

import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../middleware/auth.middleware';
import { PatternRecognitionController } from '../controllers/pattern-recognition.controller';
import {
  PredictionRequest,
  PatternAnalysisRequest,
  BehavioralAnalysisRequest,
  PatternMatch,
  BehavioralAnalysisResult,
  PatternVisualizationRequest,
  RealTimeMonitoringRequest
} from '../types';

export async function patternRecognitionRoutes(
  fastify: FastifyInstance,
  controller: PatternRecognitionController
): Promise<void> {
  
  // Comprehensive pattern analysis endpoint
  fastify.post<{ Body: PatternAnalysisRequest; Reply: { success: boolean; patterns: PatternMatch[]; metadata: any } }>(
    '/patterns/analyze',
    {
      preValidation: [authMiddleware],
      schema: {
        description: 'Perform comprehensive pattern analysis on threat data',
        tags: ['Pattern Recognition'],
        body: {
          type: 'object',
          required: ['data'],
          properties: {
            data: {
              type: 'object',
              description: 'Input data for pattern analysis'
            },
            analysis_type: {
              type: 'string',
              enum: ['sequential', 'behavioral', 'temporal', 'statistical', 'all'],
              default: 'all',
              description: 'Type of pattern analysis to perform'
            },
            confidence_threshold: {
              type: 'number',
              minimum: 0,
              maximum: 1,
              default: 0.6,
              description: 'Minimum confidence threshold for pattern matches'
            },
            time_window: {
              type: 'string',
              default: '24h',
              description: 'Time window for analysis (e.g., 1h, 24h, 7d)'
            },
            include_predictions: {
              type: 'boolean',
              default: true,
              description: 'Include attack predictions in analysis'
            },
            enable_learning: {
              type: 'boolean',
              default: false,
              description: 'Enable pattern learning and adaptation'
            }
          }
        },
        response: {
          200: {
            description: 'Pattern analysis results',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              patterns: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    pattern_id: { type: 'string' },
                    pattern_name: { type: 'string' },
                    match_type: { type: 'string' },
                    confidence: { type: 'number' },
                    completion_percentage: { type: 'number' },
                    risk_assessment: { type: 'object' },
                    predictions: { type: 'array' },
                    evidence_chain: { type: 'array' },
                    timeline: { type: 'array' }
                  }
                }
              },
              metadata: {
                type: 'object',
                properties: {
                  analysis_duration: { type: 'number' },
                  patterns_evaluated: { type: 'number' },
                  active_matches: { type: 'number' },
                  confidence_distribution: { type: 'object' },
                  performance_metrics: { type: 'object' }
                }
              }
            }
          }
        }
      }
    },
    async (request, reply) => controller.analyzePatterns(request, reply)
  );

  // Behavioral pattern analysis for insider threats
  fastify.post<{ Body: BehavioralAnalysisRequest; Reply: BehavioralAnalysisResult }>(
    '/patterns/behavioral',
    {
      preValidation: [authMiddleware],
      schema: {
        description: 'Analyze behavioral patterns for insider threat detection',
        tags: ['Behavioral Analysis'],
        body: {
          type: 'object',
          required: ['user_id', 'behavior_data'],
          properties: {
            user_id: {
              type: 'string',
              description: 'Unique identifier for the user'
            },
            behavior_data: {
              type: 'object',
              description: 'User behavioral data for analysis'
            },
            time_window: {
              type: 'string',
              default: '30d',
              description: 'Analysis time window (e.g., 7d, 30d, 90d)'
            },
            baseline_update: {
              type: 'boolean',
              default: false,
              description: 'Update behavioral baselines with new data'
            },
            context: {
              type: 'object',
              properties: {
                organizational_events: { type: 'array' },
                user_lifecycle_events: { type: 'array' },
                security_events: { type: 'array' }
              },
              description: 'Contextual information for analysis'
            }
          }
        },
        response: {
          200: {
            description: 'Behavioral analysis result',
            type: 'object',
            properties: {
              user_id: { type: 'string' },
              analysis_timestamp: { type: 'string' },
              overall_risk_score: { type: 'number' },
              risk_category: { type: 'string' },
              behavioral_deviations: { type: 'array' },
              anomaly_summary: { type: 'object' },
              pattern_matches: { type: 'array' },
              trend_analysis: { type: 'object' },
              recommendations: { type: 'array' },
              confidence_metrics: { type: 'object' }
            }
          }
        }
      }
    },
    async (request, reply) => controller.analyzeBehavioralPatterns(request, reply)
  );

  // Pattern sequence detection
  fastify.post<{ Body: { events: any[]; sequence_type?: string }; Reply: { sequences: any[]; predictions: any[] } }>(
    '/patterns/sequences',
    {
      preValidation: [authMiddleware],
      schema: {
        description: 'Detect attack sequences and temporal patterns',
        tags: ['Sequence Analysis'],
        body: {
          type: 'object',
          required: ['events'],
          properties: {
            events: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  timestamp: { type: 'string' },
                  event_type: { type: 'string' },
                  source: { type: 'string' },
                  data: { type: 'object' },
                  context: { type: 'object' }
                }
              },
              description: 'Sequence of events to analyze'
            },
            sequence_type: {
              type: 'string',
              enum: ['attack_chain', 'behavioral_sequence', 'temporal_pattern', 'all'],
              default: 'all',
              description: 'Type of sequence analysis'
            },
            window_size: {
              type: 'number',
              default: 3600,
              description: 'Time window size in seconds'
            },
            step_tolerance: {
              type: 'number',
              default: 0.8,
              description: 'Tolerance for sequence step matching'
            }
          }
        }
      }
    },
    async (request, reply) => controller.detectSequences(request, reply)
  );

  // Anomaly detection in patterns
  fastify.post<{ Body: { data: any; sensitivity?: number }; Reply: { anomalies: any[]; statistics: any } }>(
    '/patterns/anomalies',
    {
      preValidation: [authMiddleware],
      schema: {
        description: 'Detect anomalous patterns in security data',
        tags: ['Anomaly Detection'],
        body: {
          type: 'object',
          required: ['data'],
          properties: {
            data: {
              type: 'object',
              description: 'Data to analyze for anomalies'
            },
            sensitivity: {
              type: 'number',
              minimum: 0.1,
              maximum: 1.0,
              default: 0.7,
              description: 'Anomaly detection sensitivity'
            },
            detection_method: {
              type: 'string',
              enum: ['statistical', 'ml_based', 'hybrid'],
              default: 'hybrid',
              description: 'Anomaly detection method'
            },
            baseline_period: {
              type: 'string',
              default: '30d',
              description: 'Baseline period for normal behavior'
            }
          }
        }
      }
    },
    async (request, reply) => controller.detectAnomalies(request, reply)
  );

  // Pattern visualization generation
  fastify.post<{ Body: PatternVisualizationRequest; Reply: { visualization: any; metadata: any } }>(
    '/patterns/visualize',
    {
      preValidation: [authMiddleware],
      schema: {
        description: 'Generate pattern visualization data',
        tags: ['Visualization'],
        body: {
          type: 'object',
          required: ['pattern_id'],
          properties: {
            pattern_id: {
              type: 'string',
              description: 'ID of the pattern to visualize'
            },
            visualization_type: {
              type: 'string',
              enum: ['timeline', 'network_graph', 'heatmap', 'flow_diagram', 'statistical_chart'],
              default: 'timeline',
              description: 'Type of visualization to generate'
            },
            time_range: {
              type: 'object',
              properties: {
                start: { type: 'string' },
                end: { type: 'string' }
              },
              description: 'Time range for visualization'
            },
            detail_level: {
              type: 'string',
              enum: ['summary', 'detailed', 'comprehensive'],
              default: 'detailed',
              description: 'Level of detail in visualization'
            }
          }
        }
      }
    },
    async (request, reply) => controller.generateVisualization(request, reply)
  );

  // Real-time pattern monitoring
  fastify.post<{ Body: RealTimeMonitoringRequest; Reply: { monitoring_id: string; status: string } }>(
    '/patterns/monitor/start',
    {
      preValidation: [authMiddleware],
      schema: {
        description: 'Start real-time pattern monitoring',
        tags: ['Real-time Monitoring'],
        body: {
          type: 'object',
          required: ['patterns'],
          properties: {
            patterns: {
              type: 'array',
              items: { type: 'string' },
              description: 'Pattern IDs to monitor'
            },
            monitoring_config: {
              type: 'object',
              properties: {
                check_interval: { type: 'number', default: 60 },
                alert_threshold: { type: 'number', default: 0.8 },
                notification_channels: { type: 'array', items: { type: 'string' } }
              },
              description: 'Monitoring configuration'
            },
            data_sources: {
              type: 'array',
              items: { type: 'string' },
              description: 'Data sources to monitor'
            }
          }
        }
      }
    },
    async (request, reply) => controller.startMonitoring(request, reply)
  );

  // Stop real-time monitoring
  fastify.delete<{ Params: { monitoring_id: string }; Reply: { success: boolean; message: string } }>(
    '/patterns/monitor/:monitoring_id',
    {
      preValidation: [authMiddleware],
      schema: {
        description: 'Stop real-time pattern monitoring',
        tags: ['Real-time Monitoring'],
        params: {
          type: 'object',
          properties: {
            monitoring_id: { type: 'string' }
          }
        }
      }
    },
    async (request, reply) => controller.stopMonitoring(request, reply)
  );

  // Get pattern statistics and metrics
  fastify.get<{ Reply: { statistics: any; performance: any; active_patterns: any[] } }>(
    '/patterns/statistics',
    {
      preValidation: [authMiddleware],
      schema: {
        description: 'Get pattern recognition statistics and metrics',
        tags: ['Statistics'],
        response: {
          200: {
            description: 'Pattern recognition statistics',
            type: 'object',
            properties: {
              statistics: {
                type: 'object',
                properties: {
                  total_patterns: { type: 'number' },
                  active_matches: { type: 'number' },
                  pattern_types: { type: 'object' },
                  average_confidence: { type: 'number' },
                  learning_progress: { type: 'number' }
                }
              },
              performance: {
                type: 'object',
                properties: {
                  analysis_time_avg: { type: 'number' },
                  throughput: { type: 'number' },
                  accuracy_metrics: { type: 'object' },
                  resource_usage: { type: 'object' }
                }
              },
              active_patterns: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    pattern_id: { type: 'string' },
                    pattern_name: { type: 'string' },
                    last_match: { type: 'string' },
                    match_frequency: { type: 'number' },
                    confidence_trend: { type: 'array' }
                  }
                }
              }
            }
          }
        }
      }
    },
    async (request, reply) => controller.getStatistics(request, reply)
  );

  // Pattern search and discovery
  fastify.post<{ Body: { query: string; filters?: any }; Reply: { patterns: any[]; total: number } }>(
    '/patterns/search',
    {
      preValidation: [authMiddleware],
      schema: {
        description: 'Search and discover threat patterns',
        tags: ['Search'],
        body: {
          type: 'object',
          required: ['query'],
          properties: {
            query: {
              type: 'string',
              description: 'Search query for patterns'
            },
            filters: {
              type: 'object',
              properties: {
                pattern_type: { type: 'string' },
                severity: { type: 'string' },
                confidence_min: { type: 'number' },
                time_range: { type: 'object' },
                mitre_tactics: { type: 'array' }
              },
              description: 'Search filters'
            },
            sort_by: {
              type: 'string',
              enum: ['relevance', 'confidence', 'last_seen', 'frequency'],
              default: 'relevance',
              description: 'Sort results by'
            },
            limit: {
              type: 'number',
              default: 50,
              maximum: 500,
              description: 'Maximum number of results'
            }
          }
        }
      }
    },
    async (request, reply) => controller.searchPatterns(request, reply)
  );

  // Pattern learning and adaptation
  fastify.post<{ Body: { pattern_id: string; feedback: any }; Reply: { success: boolean; updated_pattern: any } }>(
    '/patterns/learn',
    {
      preValidation: [authMiddleware],
      schema: {
        description: 'Provide feedback for pattern learning',
        tags: ['Learning'],
        body: {
          type: 'object',
          required: ['pattern_id', 'feedback'],
          properties: {
            pattern_id: {
              type: 'string',
              description: 'ID of the pattern to update'
            },
            feedback: {
              type: 'object',
              properties: {
                accuracy: { type: 'number' },
                false_positive: { type: 'boolean' },
                false_negative: { type: 'boolean' },
                suggested_improvements: { type: 'array' },
                context_corrections: { type: 'object' }
              },
              description: 'Learning feedback data'
            },
            evidence: {
              type: 'array',
              items: { type: 'object' },
              description: 'Supporting evidence for feedback'
            }
          }
        }
      }
    },
    async (request, reply) => controller.learnFromFeedback(request, reply)
  );

  // Export pattern definitions
  fastify.get<{ Querystring: { format?: string; pattern_ids?: string } }>(
    '/patterns/export',
    {
      preValidation: [authMiddleware],
      schema: {
        description: 'Export pattern definitions',
        tags: ['Export'],
        querystring: {
          type: 'object',
          properties: {
            format: {
              type: 'string',
              enum: ['json', 'yaml', 'xml', 'stix'],
              default: 'json',
              description: 'Export format'
            },
            pattern_ids: {
              type: 'string',
              description: 'Comma-separated pattern IDs to export'
            }
          }
        }
      }
    },
    async (request, reply) => controller.exportPatterns(request, reply)
  );

  // Import pattern definitions
  fastify.post<{ Body: { patterns: any[]; format?: string }; Reply: { imported: number; errors: any[] } }>(
    '/patterns/import',
    {
      preValidation: [authMiddleware],
      schema: {
        description: 'Import pattern definitions',
        tags: ['Import'],
        body: {
          type: 'object',
          required: ['patterns'],
          properties: {
            patterns: {
              type: 'array',
              items: { type: 'object' },
              description: 'Pattern definitions to import'
            },
            format: {
              type: 'string',
              enum: ['json', 'yaml', 'stix'],
              default: 'json',
              description: 'Import format'
            },
            merge_strategy: {
              type: 'string',
              enum: ['overwrite', 'merge', 'skip_existing'],
              default: 'merge',
              description: 'Strategy for handling existing patterns'
            }
          }
        }
      }
    },
    async (request, reply) => controller.importPatterns(request, reply)
  );

  // Health check for pattern recognition service
  fastify.get(
    '/patterns/health',
    {
      schema: {
        description: 'Get pattern recognition service health',
        tags: ['Health'],
        response: {
          200: {
            description: 'Pattern recognition service health',
            type: 'object',
            properties: {
              status: { type: 'string' },
              engines: {
                type: 'object',
                properties: {
                  sequence_analyzer: { type: 'string' },
                  behavioral_analyzer: { type: 'string' },
                  temporal_engine: { type: 'string' },
                  statistical_engine: { type: 'string' },
                  learning_engine: { type: 'string' },
                  prediction_engine: { type: 'string' },
                  visualization_engine: { type: 'string' }
                }
              },
              performance: {
                type: 'object',
                properties: {
                  patterns_loaded: { type: 'number' },
                  active_matches: { type: 'number' },
                  analysis_queue: { type: 'number' },
                  avg_processing_time: { type: 'number' }
                }
              },
              models: {
                type: 'object',
                properties: {
                  lstm_model: { type: 'string' },
                  behavioral_model: { type: 'string' },
                  anomaly_model: { type: 'string' }
                }
              },
              timestamp: { type: 'string' }
            }
          }
        }
      }
    },
    async (request, reply) => controller.getHealth(request, reply)
  );
}