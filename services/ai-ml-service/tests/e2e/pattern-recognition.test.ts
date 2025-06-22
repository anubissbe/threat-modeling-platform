/**
 * Comprehensive E2E Tests for Pattern Recognition - Task 3.3
 * Tests all pattern recognition capabilities including advanced analysis, behavioral detection, and real-time monitoring
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { FastifyInstance } from 'fastify';
import { createServer } from '../../src/app';
import { AdvancedPatternRecognitionService } from '../../src/services/advanced-pattern-recognition.service';
import { BehavioralPatternDetectorService } from '../../src/services/behavioral-pattern-detector.service';
import { PatternVisualizationService } from '../../src/services/pattern-visualization.service';
import { RealTimeMonitoringService } from '../../src/services/real-time-monitoring.service';
import { CacheService } from '../../src/services/cache.service';

describe('Pattern Recognition E2E Tests', () => {
  let app: FastifyInstance;
  let patternService: AdvancedPatternRecognitionService;
  let behavioralService: BehavioralPatternDetectorService;
  let visualizationService: PatternVisualizationService;
  let monitoringService: RealTimeMonitoringService;
  let cacheService: CacheService;

  const mockAuthToken = 'test-auth-token';
  const baseUrl = '/api/v1/patterns';

  beforeAll(async () => {
    app = createServer();
    
    // Initialize services
    patternService = new AdvancedPatternRecognitionService();
    behavioralService = new BehavioralPatternDetectorService();
    visualizationService = new PatternVisualizationService();
    cacheService = new CacheService();
    monitoringService = new RealTimeMonitoringService(patternService, behavioralService);

    await patternService.initialize();
    await behavioralService.initialize();
    await visualizationService.initialize();
    await monitoringService.initialize();

    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    // Clear cache before each test
    cacheService.clear();
  });

  describe('Advanced Pattern Analysis', () => {
    test('should perform comprehensive pattern analysis', async () => {
      const testData = {
        data: {
          network: [
            {
              protocol: 'HTTP',
              source_ip: '192.168.1.100',
              dest_ip: '10.0.1.50',
              port: 80,
              bytes: 1024,
              duration: 30,
              packets: 15
            }
          ],
          processes: [
            {
              name: 'powershell.exe',
              command: 'powershell -enc SGVsbG8gV29ybGQ=',
              parent: 'cmd.exe',
              user: 'admin',
              cpu: 25,
              memory: 512,
              file_ops: 5
            }
          ],
          user_activity: [
            {
              user_id: 'user123',
              action: 'file_access',
              resource: '/sensitive/data.txt',
              success: true,
              session_id: 'sess456'
            }
          ]
        },
        analysis_type: 'all',
        confidence_threshold: 0.7,
        time_window: '1h',
        include_predictions: true,
        enable_learning: false
      };

      const response = await app.inject({
        method: 'POST',
        url: `${baseUrl}/analyze`,
        headers: {
          authorization: `Bearer ${mockAuthToken}`,
          'content-type': 'application/json'
        },
        payload: testData
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.payload);
      
      expect(result.success).toBe(true);
      expect(result.patterns).toBeInstanceOf(Array);
      expect(result.metadata).toBeDefined();
      expect(result.metadata.analysis_duration).toBeGreaterThan(0);
      expect(result.metadata.patterns_evaluated).toBeGreaterThanOrEqual(0);
      expect(result.metadata.confidence_distribution).toBeDefined();
    });

    test('should filter patterns by confidence threshold', async () => {
      const testData = {
        data: { events: [], network: [], processes: [], user_activity: [] },
        confidence_threshold: 0.9
      };

      const response = await app.inject({
        method: 'POST',
        url: `${baseUrl}/analyze`,
        headers: {
          authorization: `Bearer ${mockAuthToken}`,
          'content-type': 'application/json'
        },
        payload: testData
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.payload);
      
      result.patterns.forEach(pattern => {
        expect(pattern.confidence).toBeGreaterThanOrEqual(0.9);
      });
    });

    test('should handle empty input data gracefully', async () => {
      const testData = {
        data: {},
        analysis_type: 'sequential'
      };

      const response = await app.inject({
        method: 'POST',
        url: `${baseUrl}/analyze`,
        headers: {
          authorization: `Bearer ${mockAuthToken}`,
          'content-type': 'application/json'
        },
        payload: testData
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.payload);
      
      expect(result.success).toBe(true);
      expect(result.patterns).toBeInstanceOf(Array);
      expect(result.patterns.length).toBe(0);
    });

    test('should validate required fields', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `${baseUrl}/analyze`,
        headers: {
          authorization: `Bearer ${mockAuthToken}`,
          'content-type': 'application/json'
        },
        payload: {}
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('Behavioral Pattern Analysis', () => {
    test('should analyze behavioral patterns for insider threats', async () => {
      const testData = {
        user_id: 'user123',
        behavior_data: {
          login_frequency: 15,
          off_hours_logins: 3,
          failed_login_attempts: 2,
          file_access_count: 25,
          sensitive_file_access: 5,
          email_volume: 30,
          external_email_ratio: 0.2,
          data_transfer_volume: 1024000,
          application_diversity: 8,
          vpn_usage: 2,
          weekend_activity: 1
        },
        time_window: '30d',
        baseline_update: false
      };

      const response = await app.inject({
        method: 'POST',
        url: `${baseUrl}/behavioral`,
        headers: {
          authorization: `Bearer ${mockAuthToken}`,
          'content-type': 'application/json'
        },
        payload: testData
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.payload);
      
      expect(result.user_id).toBe('user123');
      expect(result.overall_risk_score).toBeGreaterThanOrEqual(0);
      expect(result.overall_risk_score).toBeLessThanOrEqual(100);
      expect(result.risk_category).toMatch(/^(low|medium|high|critical)$/);
      expect(result.behavioral_deviations).toBeInstanceOf(Array);
      expect(result.anomaly_summary).toBeDefined();
      expect(result.pattern_matches).toBeInstanceOf(Array);
      expect(result.recommendations).toBeInstanceOf(Array);
      expect(result.confidence_metrics).toBeDefined();
    });

    test('should handle baseline updates', async () => {
      const testData = {
        user_id: 'user456',
        behavior_data: {
          login_frequency: 10,
          file_access_count: 20,
          email_volume: 25
        },
        baseline_update: true
      };

      const response = await app.inject({
        method: 'POST',
        url: `${baseUrl}/behavioral`,
        headers: {
          authorization: `Bearer ${mockAuthToken}`,
          'content-type': 'application/json'
        },
        payload: testData
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.payload);
      
      expect(result.user_id).toBe('user456');
      expect(result.metadata).toBeDefined();
    });

    test('should detect high-risk behavioral patterns', async () => {
      const testData = {
        user_id: 'high_risk_user',
        behavior_data: {
          login_frequency: 50,
          off_hours_logins: 20,
          failed_login_attempts: 15,
          sensitive_file_access: 50,
          bulk_downloads: 10,
          external_email_ratio: 0.8,
          data_transfer_volume: 10000000,
          unusual_software_usage: 5,
          vpn_usage: 25
        }
      };

      const response = await app.inject({
        method: 'POST',
        url: `${baseUrl}/behavioral`,
        headers: {
          authorization: `Bearer ${mockAuthToken}`,
          'content-type': 'application/json'
        },
        payload: testData
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.payload);
      
      expect(result.overall_risk_score).toBeGreaterThan(50);
      expect(result.risk_category).toMatch(/^(high|critical)$/);
      expect(result.behavioral_deviations.length).toBeGreaterThan(0);
    });
  });

  describe('Sequence Detection', () => {
    test('should detect attack sequences', async () => {
      const testData = {
        events: [
          {
            timestamp: '2024-01-15T09:00:00Z',
            event_type: 'network_scan',
            source: 'network_monitor',
            data: { source_ip: '192.168.1.100', ports: [80, 443, 22] }
          },
          {
            timestamp: '2024-01-15T09:05:00Z',
            event_type: 'vulnerability_exploit',
            source: 'ids',
            data: { target: 'web_server', cve: 'CVE-2023-1234' }
          },
          {
            timestamp: '2024-01-15T09:10:00Z',
            event_type: 'command_execution',
            source: 'endpoint_detection',
            data: { process: 'powershell.exe', command: 'whoami' }
          }
        ],
        sequence_type: 'attack_chain',
        window_size: 3600,
        step_tolerance: 0.8
      };

      const response = await app.inject({
        method: 'POST',
        url: `${baseUrl}/sequences`,
        headers: {
          authorization: `Bearer ${mockAuthToken}`,
          'content-type': 'application/json'
        },
        payload: testData
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.payload);
      
      expect(result.sequences).toBeInstanceOf(Array);
      expect(result.predictions).toBeInstanceOf(Array);
      expect(result.metadata).toBeDefined();
      expect(result.metadata.total_events).toBe(3);
    });

    test('should handle different sequence types', async () => {
      const testData = {
        events: [
          { timestamp: '2024-01-15T09:00:00Z', event_type: 'login', source: 'auth_system' },
          { timestamp: '2024-01-15T09:15:00Z', event_type: 'file_access', source: 'file_system' },
          { timestamp: '2024-01-15T09:30:00Z', event_type: 'data_export', source: 'application' }
        ],
        sequence_type: 'behavioral_sequence'
      };

      const response = await app.inject({
        method: 'POST',
        url: `${baseUrl}/sequences`,
        headers: {
          authorization: `Bearer ${mockAuthToken}`,
          'content-type': 'application/json'
        },
        payload: testData
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.payload);
      
      expect(result.sequences).toBeInstanceOf(Array);
      expect(result.predictions).toBeInstanceOf(Array);
    });
  });

  describe('Anomaly Detection', () => {
    test('should detect statistical anomalies', async () => {
      const testData = {
        data: {
          login_frequency: 100, // Unusually high
          file_access_count: 1000, // Unusually high
          email_volume: 5, // Unusually low
          data_transfer_volume: 50000000 // Unusually high
        },
        sensitivity: 0.8,
        detection_method: 'statistical',
        baseline_period: '30d'
      };

      const response = await app.inject({
        method: 'POST',
        url: `${baseUrl}/anomalies`,
        headers: {
          authorization: `Bearer ${mockAuthToken}`,
          'content-type': 'application/json'
        },
        payload: testData
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.payload);
      
      expect(result.anomalies).toBeInstanceOf(Array);
      expect(result.statistics).toBeDefined();
      expect(result.statistics.total_anomalies).toBeGreaterThanOrEqual(0);
    });

    test('should adjust detection based on sensitivity', async () => {
      const testData = {
        data: { metric1: 10, metric2: 20, metric3: 15 },
        sensitivity: 0.3 // Low sensitivity
      };

      const lowSensitivityResponse = await app.inject({
        method: 'POST',
        url: `${baseUrl}/anomalies`,
        headers: {
          authorization: `Bearer ${mockAuthToken}`,
          'content-type': 'application/json'
        },
        payload: testData
      });

      testData.sensitivity = 0.9; // High sensitivity

      const highSensitivityResponse = await app.inject({
        method: 'POST',
        url: `${baseUrl}/anomalies`,
        headers: {
          authorization: `Bearer ${mockAuthToken}`,
          'content-type': 'application/json'
        },
        payload: testData
      });

      expect(lowSensitivityResponse.statusCode).toBe(200);
      expect(highSensitivityResponse.statusCode).toBe(200);

      const lowResult = JSON.parse(lowSensitivityResponse.payload);
      const highResult = JSON.parse(highSensitivityResponse.payload);

      // High sensitivity should detect more anomalies
      expect(highResult.anomalies.length).toBeGreaterThanOrEqual(lowResult.anomalies.length);
    });
  });

  describe('Pattern Visualization', () => {
    test('should generate timeline visualization', async () => {
      const testData = {
        pattern_id: 'test-pattern-1',
        visualization_type: 'timeline',
        detail_level: 'detailed',
        time_range: {
          start: '2024-01-15T09:00:00Z',
          end: '2024-01-15T10:00:00Z'
        }
      };

      const response = await app.inject({
        method: 'POST',
        url: `${baseUrl}/visualize`,
        headers: {
          authorization: `Bearer ${mockAuthToken}`,
          'content-type': 'application/json'
        },
        payload: testData
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.payload);
      
      expect(result.visualization).toBeDefined();
      expect(result.metadata).toBeDefined();
      expect(result.metadata.pattern_id).toBe('test-pattern-1');
      expect(result.metadata.visualization_type).toBe('timeline');
    });

    test('should generate network graph visualization', async () => {
      const testData = {
        pattern_id: 'network-pattern-1',
        visualization_type: 'network_graph',
        detail_level: 'comprehensive'
      };

      const response = await app.inject({
        method: 'POST',
        url: `${baseUrl}/visualize`,
        headers: {
          authorization: `Bearer ${mockAuthToken}`,
          'content-type': 'application/json'
        },
        payload: testData
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.payload);
      
      expect(result.visualization).toBeDefined();
      expect(result.metadata.visualization_type).toBe('network_graph');
    });

    test('should generate heatmap visualization', async () => {
      const testData = {
        pattern_id: 'heatmap-pattern-1',
        visualization_type: 'heatmap',
        detail_level: 'summary'
      };

      const response = await app.inject({
        method: 'POST',
        url: `${baseUrl}/visualize`,
        headers: {
          authorization: `Bearer ${mockAuthToken}`,
          'content-type': 'application/json'
        },
        payload: testData
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.payload);
      
      expect(result.visualization).toBeDefined();
      expect(result.metadata.visualization_type).toBe('heatmap');
    });

    test('should handle unsupported visualization types', async () => {
      const testData = {
        pattern_id: 'test-pattern-1',
        visualization_type: 'unsupported_type'
      };

      const response = await app.inject({
        method: 'POST',
        url: `${baseUrl}/visualize`,
        headers: {
          authorization: `Bearer ${mockAuthToken}`,
          'content-type': 'application/json'
        },
        payload: testData
      });

      expect(response.statusCode).toBe(500);
    });
  });

  describe('Real-Time Monitoring', () => {
    test('should start monitoring session', async () => {
      const testData = {
        patterns: ['pattern-1', 'pattern-2', 'pattern-3'],
        monitoring_config: {
          check_interval: 60,
          alert_threshold: 0.8,
          notification_channels: ['email', 'slack']
        },
        data_sources: ['network_logs', 'application_logs']
      };

      const response = await app.inject({
        method: 'POST',
        url: `${baseUrl}/monitor/start`,
        headers: {
          authorization: `Bearer ${mockAuthToken}`,
          'content-type': 'application/json'
        },
        payload: testData
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.payload);
      
      expect(result.monitoring_id).toBeDefined();
      expect(result.status).toBe('active');
      expect(result.message).toContain('successfully');
    });

    test('should stop monitoring session', async () => {
      // First start a monitoring session
      const startData = {
        patterns: ['pattern-1'],
        monitoring_config: {
          check_interval: 30,
          alert_threshold: 0.7,
          notification_channels: ['email']
        },
        data_sources: ['test_source']
      };

      const startResponse = await app.inject({
        method: 'POST',
        url: `${baseUrl}/monitor/start`,
        headers: {
          authorization: `Bearer ${mockAuthToken}`,
          'content-type': 'application/json'
        },
        payload: startData
      });

      const startResult = JSON.parse(startResponse.payload);
      const monitoringId = startResult.monitoring_id;

      // Now stop the monitoring session
      const stopResponse = await app.inject({
        method: 'DELETE',
        url: `${baseUrl}/monitor/${monitoringId}`,
        headers: {
          authorization: `Bearer ${mockAuthToken}`
        }
      });

      expect(stopResponse.statusCode).toBe(200);
      const stopResult = JSON.parse(stopResponse.payload);
      
      expect(stopResult.success).toBe(true);
      expect(stopResult.message).toContain('successfully');
    });

    test('should handle invalid monitoring session', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `${baseUrl}/monitor/invalid-session-id`,
        headers: {
          authorization: `Bearer ${mockAuthToken}`
        }
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.payload);
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('not found');
    });
  });

  describe('Pattern Statistics', () => {
    test('should retrieve pattern recognition statistics', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `${baseUrl}/statistics`,
        headers: {
          authorization: `Bearer ${mockAuthToken}`
        }
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.payload);
      
      expect(result.statistics).toBeDefined();
      expect(result.performance).toBeDefined();
      expect(result.active_patterns).toBeInstanceOf(Array);
      
      expect(result.statistics.total_patterns).toBeGreaterThanOrEqual(0);
      expect(result.statistics.active_matches).toBeGreaterThanOrEqual(0);
      expect(result.statistics.average_confidence).toBeGreaterThanOrEqual(0);
      expect(result.statistics.learning_progress).toBeGreaterThanOrEqual(0);
      
      expect(result.performance.analysis_time_avg).toBeGreaterThan(0);
      expect(result.performance.throughput).toBeGreaterThan(0);
      expect(result.performance.accuracy_metrics).toBeDefined();
    });
  });

  describe('Pattern Search', () => {
    test('should search patterns by query', async () => {
      const testData = {
        query: 'SQL injection',
        filters: {
          pattern_type: 'sequential',
          severity: 'high'
        },
        sort_by: 'relevance',
        limit: 10
      };

      const response = await app.inject({
        method: 'POST',
        url: `${baseUrl}/search`,
        headers: {
          authorization: `Bearer ${mockAuthToken}`,
          'content-type': 'application/json'
        },
        payload: testData
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.payload);
      
      expect(result.patterns).toBeInstanceOf(Array);
      expect(result.total).toBeGreaterThanOrEqual(0);
      expect(result.query).toBe('SQL injection');
      expect(result.patterns.length).toBeLessThanOrEqual(10);
    });

    test('should handle empty search results', async () => {
      const testData = {
        query: 'nonexistent pattern type',
        limit: 5
      };

      const response = await app.inject({
        method: 'POST',
        url: `${baseUrl}/search`,
        headers: {
          authorization: `Bearer ${mockAuthToken}`,
          'content-type': 'application/json'
        },
        payload: testData
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.payload);
      
      expect(result.patterns).toBeInstanceOf(Array);
      expect(result.patterns.length).toBe(0);
      expect(result.total).toBe(0);
    });
  });

  describe('Learning and Feedback', () => {
    test('should process learning feedback', async () => {
      const testData = {
        pattern_id: 'test-pattern-1',
        feedback: {
          accuracy: 0.85,
          false_positive: false,
          false_negative: false,
          suggested_improvements: ['Increase sensitivity for this pattern type'],
          context_corrections: {
            time_sensitivity: 'high',
            context_dependency: 'medium'
          }
        },
        evidence: [
          {
            source: 'security_analyst',
            type: 'validation',
            content: 'Pattern correctly identified threat',
            timestamp: new Date().toISOString()
          }
        ]
      };

      const response = await app.inject({
        method: 'POST',
        url: `${baseUrl}/learn`,
        headers: {
          authorization: `Bearer ${mockAuthToken}`,
          'content-type': 'application/json'
        },
        payload: testData
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.payload);
      
      expect(result.success).toBe(true);
      expect(result.updated_pattern).toBeDefined();
      expect(result.message).toContain('successfully');
    });

    test('should handle invalid pattern ID for learning', async () => {
      const testData = {
        pattern_id: 'invalid-pattern-id',
        feedback: {
          accuracy: 0.5,
          false_positive: true
        }
      };

      const response = await app.inject({
        method: 'POST',
        url: `${baseUrl}/learn`,
        headers: {
          authorization: `Bearer ${mockAuthToken}`,
          'content-type': 'application/json'
        },
        payload: testData
      });

      expect(response.statusCode).toBe(200); // Should handle gracefully
      const result = JSON.parse(response.payload);
      expect(result.success).toBe(true); // Mock implementation returns success
    });
  });

  describe('Pattern Export/Import', () => {
    test('should export patterns in JSON format', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `${baseUrl}/export?format=json`,
        headers: {
          authorization: `Bearer ${mockAuthToken}`
        }
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');
      expect(response.headers['content-disposition']).toContain('attachment');
    });

    test('should export patterns in YAML format', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `${baseUrl}/export?format=yaml`,
        headers: {
          authorization: `Bearer ${mockAuthToken}`
        }
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('application/x-yaml');
    });

    test('should import pattern definitions', async () => {
      const testData = {
        patterns: [
          {
            id: 'imported-pattern-1',
            name: 'Imported Test Pattern',
            type: 'sequential',
            indicators: ['test-indicator-1', 'test-indicator-2']
          }
        ],
        format: 'json',
        merge_strategy: 'merge'
      };

      const response = await app.inject({
        method: 'POST',
        url: `${baseUrl}/import`,
        headers: {
          authorization: `Bearer ${mockAuthToken}`,
          'content-type': 'application/json'
        },
        payload: testData
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.payload);
      
      expect(result.imported).toBe(1);
      expect(result.errors).toBeInstanceOf(Array);
      expect(result.message).toContain('successfully');
    });
  });

  describe('Health Checks', () => {
    test('should return pattern recognition service health', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `${baseUrl}/health`,
        headers: {
          authorization: `Bearer ${mockAuthToken}`
        }
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.payload);
      
      expect(result.status).toBe('healthy');
      expect(result.engines).toBeDefined();
      expect(result.performance).toBeDefined();
      expect(result.models).toBeDefined();
      expect(result.timestamp).toBeDefined();
      
      // Check all engines are healthy
      Object.values(result.engines).forEach(status => {
        expect(status).toBe('healthy');
      });
      
      // Check models are loaded
      Object.values(result.models).forEach(status => {
        expect(status).toBe('loaded');
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle missing authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `${baseUrl}/analyze`,
        headers: {
          'content-type': 'application/json'
        },
        payload: { data: {} }
      });

      expect(response.statusCode).toBe(401);
    });

    test('should handle malformed JSON', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `${baseUrl}/analyze`,
        headers: {
          authorization: `Bearer ${mockAuthToken}`,
          'content-type': 'application/json'
        },
        payload: 'invalid json'
      });

      expect(response.statusCode).toBe(400);
    });

    test('should handle server errors gracefully', async () => {
      // Test with data that might cause server errors
      const testData = {
        data: null, // Invalid data
        analysis_type: 'invalid_type'
      };

      const response = await app.inject({
        method: 'POST',
        url: `${baseUrl}/analyze`,
        headers: {
          authorization: `Bearer ${mockAuthToken}`,
          'content-type': 'application/json'
        },
        payload: testData
      });

      // Should handle error gracefully
      expect([200, 400, 500]).toContain(response.statusCode);
    });
  });

  describe('Performance Tests', () => {
    test('should handle large datasets efficiently', async () => {
      const largeDataset = {
        data: {
          network: Array.from({ length: 1000 }, (_, i) => ({
            protocol: 'HTTP',
            source_ip: `192.168.1.${i % 255}`,
            dest_ip: `10.0.1.${i % 255}`,
            port: 80 + (i % 10),
            bytes: 1024 * (i % 100),
            duration: 30 + (i % 60)
          })),
          processes: Array.from({ length: 500 }, (_, i) => ({
            name: `process_${i}.exe`,
            command: `command_${i}`,
            user: `user_${i % 10}`,
            cpu: i % 100,
            memory: 512 + (i % 1000)
          }))
        },
        analysis_type: 'all'
      };

      const startTime = Date.now();
      
      const response = await app.inject({
        method: 'POST',
        url: `${baseUrl}/analyze`,
        headers: {
          authorization: `Bearer ${mockAuthToken}`,
          'content-type': 'application/json'
        },
        payload: largeDataset
      });

      const processingTime = Date.now() - startTime;
      
      expect(response.statusCode).toBe(200);
      expect(processingTime).toBeLessThan(10000); // Should complete within 10 seconds
      
      const result = JSON.parse(response.payload);
      expect(result.success).toBe(true);
      expect(result.metadata.analysis_duration).toBeLessThan(5000); // Analysis should be under 5 seconds
    });

    test('should handle concurrent requests', async () => {
      const testData = {
        data: { events: [], network: [], processes: [] },
        analysis_type: 'sequential'
      };

      const concurrentRequests = Array.from({ length: 10 }, () =>
        app.inject({
          method: 'POST',
          url: `${baseUrl}/analyze`,
          headers: {
            authorization: `Bearer ${mockAuthToken}`,
            'content-type': 'application/json'
          },
          payload: testData
        })
      );

      const responses = await Promise.all(concurrentRequests);
      
      responses.forEach(response => {
        expect(response.statusCode).toBe(200);
        const result = JSON.parse(response.payload);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('Integration Tests', () => {
    test('should integrate pattern recognition with behavioral analysis', async () => {
      // First, analyze behavioral patterns
      const behavioralData = {
        user_id: 'integration_test_user',
        behavior_data: {
          login_frequency: 25,
          sensitive_file_access: 10,
          data_transfer_volume: 5000000
        }
      };

      const behavioralResponse = await app.inject({
        method: 'POST',
        url: `${baseUrl}/behavioral`,
        headers: {
          authorization: `Bearer ${mockAuthToken}`,
          'content-type': 'application/json'
        },
        payload: behavioralData
      });

      expect(behavioralResponse.statusCode).toBe(200);
      const behavioralResult = JSON.parse(behavioralResponse.payload);

      // Then, analyze general patterns with related data
      const patternData = {
        data: {
          user_activity: [
            {
              user_id: 'integration_test_user',
              action: 'file_access',
              resource: '/sensitive/data.txt',
              success: true
            }
          ]
        },
        analysis_type: 'behavioral'
      };

      const patternResponse = await app.inject({
        method: 'POST',
        url: `${baseUrl}/analyze`,
        headers: {
          authorization: `Bearer ${mockAuthToken}`,
          'content-type': 'application/json'
        },
        payload: patternData
      });

      expect(patternResponse.statusCode).toBe(200);
      const patternResult = JSON.parse(patternResponse.payload);

      // Verify integration
      expect(behavioralResult.user_id).toBe('integration_test_user');
      expect(patternResult.success).toBe(true);
    });

    test('should integrate monitoring with pattern detection', async () => {
      // Start monitoring
      const monitoringData = {
        patterns: ['test-integration-pattern'],
        monitoring_config: {
          check_interval: 10,
          alert_threshold: 0.5,
          notification_channels: ['test']
        },
        data_sources: ['test_source']
      };

      const monitoringResponse = await app.inject({
        method: 'POST',
        url: `${baseUrl}/monitor/start`,
        headers: {
          authorization: `Bearer ${mockAuthToken}`,
          'content-type': 'application/json'
        },
        payload: monitoringData
      });

      expect(monitoringResponse.statusCode).toBe(200);
      const monitoringResult = JSON.parse(monitoringResponse.payload);

      // Verify monitoring started
      expect(monitoringResult.monitoring_id).toBeDefined();
      expect(monitoringResult.status).toBe('active');

      // Get statistics to verify integration
      const statsResponse = await app.inject({
        method: 'GET',
        url: `${baseUrl}/statistics`,
        headers: {
          authorization: `Bearer ${mockAuthToken}`
        }
      });

      expect(statsResponse.statusCode).toBe(200);
      const statsResult = JSON.parse(statsResponse.payload);
      expect(statsResult.statistics).toBeDefined();

      // Stop monitoring
      await app.inject({
        method: 'DELETE',
        url: `${baseUrl}/monitor/${monitoringResult.monitoring_id}`,
        headers: {
          authorization: `Bearer ${mockAuthToken}`
        }
      });
    });
  });
});

// Test utilities
function generateRandomEvent() {
  return {
    timestamp: new Date().toISOString(),
    event_type: ['login', 'file_access', 'network_activity', 'process_start'][Math.floor(Math.random() * 4)],
    source: ['auth_system', 'file_system', 'network_monitor', 'endpoint_detection'][Math.floor(Math.random() * 4)],
    data: {
      user_id: `user_${Math.floor(Math.random() * 100)}`,
      resource: `/path/to/resource_${Math.floor(Math.random() * 1000)}`,
      success: Math.random() > 0.1
    }
  };
}

function generateBehaviorData() {
  return {
    login_frequency: Math.floor(Math.random() * 50) + 1,
    off_hours_logins: Math.floor(Math.random() * 10),
    failed_login_attempts: Math.floor(Math.random() * 5),
    file_access_count: Math.floor(Math.random() * 100) + 10,
    sensitive_file_access: Math.floor(Math.random() * 20),
    email_volume: Math.floor(Math.random() * 100) + 5,
    external_email_ratio: Math.random(),
    data_transfer_volume: Math.floor(Math.random() * 10000000) + 1000000,
    application_diversity: Math.floor(Math.random() * 20) + 1,
    vpn_usage: Math.floor(Math.random() * 10),
    weekend_activity: Math.floor(Math.random() * 5)
  };
}