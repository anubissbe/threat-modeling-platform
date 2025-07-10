import { DevOpsService } from '../services/devops.service';
import { PipelineConfig, PipelineRun, Finding } from '../types/devops';
import Redis from 'ioredis';
import { Queue } from 'bullmq';

// Mock dependencies
jest.mock('ioredis');
jest.mock('bullmq');
jest.mock('@octokit/rest');
jest.mock('@gitbeaker/node');
jest.mock('jenkins');
jest.mock('axios');

describe('DevOpsService', () => {
  let service: DevOpsService;
  let mockRedis: jest.Mocked<Redis>;
  let mockQueue: jest.Mocked<Queue>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset environment variables
    process.env.REDIS_HOST = 'localhost';
    process.env.REDIS_PORT = '6379';
    process.env.GITHUB_TOKEN = 'test-github-token';
    process.env.THREAT_MODEL_API = 'http://localhost:3000';

    service = new DevOpsService();
    mockRedis = (service as any).redis;
    mockQueue = (service as any).queue;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Pipeline Management', () => {
    it('should create a new pipeline configuration', async () => {
      const pipelineConfig: Omit<PipelineConfig, 'id' | 'metadata'> = {
        name: 'Test Pipeline',
        platform: 'github',
        projectId: 'project-123',
        threatModelId: 'model-123',
        enabled: true,
        settings: {
          github: {
            owner: 'test-owner',
            repo: 'test-repo'
          }
        },
        triggers: [
          {
            type: 'push',
            branches: ['main', 'develop']
          }
        ],
        stages: [
          {
            id: 'stage-1',
            name: 'Threat Scan',
            type: 'threat-scan',
            order: 1,
            enabled: true,
            config: {
              threatScan: {
                modelId: 'model-123',
                scanType: 'full',
                severityThreshold: 'medium'
              }
            },
            failureAction: 'fail'
          }
        ],
        notifications: {
          channels: [],
          events: []
        }
      };

      mockRedis.set.mockResolvedValue('OK');

      const result = await service.createPipeline(pipelineConfig);

      expect(result).toHaveProperty('id');
      expect(result.name).toBe('Test Pipeline');
      expect(result.metadata.createdAt).toBeInstanceOf(Date);
      expect(mockRedis.set).toHaveBeenCalledWith(
        expect.stringContaining('pipeline:'),
        expect.any(String)
      );
    });

    it('should validate platform-specific settings', async () => {
      const invalidConfig: Omit<PipelineConfig, 'id' | 'metadata'> = {
        name: 'Invalid Pipeline',
        platform: 'github',
        projectId: 'project-123',
        threatModelId: 'model-123',
        enabled: true,
        settings: {
          github: {
            owner: '',
            repo: ''
          }
        },
        triggers: [],
        stages: [],
        notifications: {
          channels: [],
          events: []
        }
      };

      await expect(service.createPipeline(invalidConfig)).rejects.toThrow(
        'GitHub owner and repo are required'
      );
    });

    it('should trigger a pipeline run', async () => {
      const pipelineId = 'pipeline-123';
      const trigger = {
        type: 'manual',
        user: 'test-user'
      };

      const mockPipeline: PipelineConfig = {
        id: pipelineId,
        name: 'Test Pipeline',
        platform: 'github',
        projectId: 'project-123',
        threatModelId: 'model-123',
        enabled: true,
        settings: {},
        triggers: [],
        stages: [],
        notifications: {
          channels: [],
          events: []
        },
        metadata: {
          createdBy: 'system',
          createdAt: new Date(),
          lastModifiedBy: 'system',
          lastModified: new Date(),
          version: 1
        }
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(mockPipeline));
      mockRedis.incr.mockResolvedValue(1);
      mockRedis.set.mockResolvedValue('OK');
      mockRedis.rpush.mockResolvedValue(1);
      mockQueue.add.mockResolvedValue({} as any);

      const result = await service.triggerPipeline(pipelineId, trigger);

      expect(result).toHaveProperty('id');
      expect(result.pipelineId).toBe(pipelineId);
      expect(result.status).toBe('pending');
      expect(result.trigger).toEqual(trigger);
      expect(mockQueue.add).toHaveBeenCalledWith('execute-pipeline', {
        pipelineId,
        runId: result.id,
        trigger
      });
    });
  });

  describe('Pipeline Execution', () => {
    it('should execute pipeline stages in order', async () => {
      const pipelineId = 'pipeline-123';
      const runId = 'run-123';
      
      const mockPipeline: PipelineConfig = {
        id: pipelineId,
        name: 'Test Pipeline',
        platform: 'github',
        projectId: 'project-123',
        threatModelId: 'model-123',
        enabled: true,
        settings: {},
        triggers: [],
        stages: [
          {
            id: 'stage-1',
            name: 'Threat Scan',
            type: 'threat-scan',
            order: 1,
            enabled: true,
            config: {
              threatScan: {
                modelId: 'model-123',
                scanType: 'full',
                severityThreshold: 'medium'
              }
            },
            failureAction: 'warn'
          },
          {
            id: 'stage-2',
            name: 'Vulnerability Scan',
            type: 'vulnerability-scan',
            order: 2,
            enabled: true,
            config: {
              vulnerabilityScan: {
                scanners: ['npm-audit', 'snyk'],
                failOnCVSS: 7.0
              }
            },
            failureAction: 'fail'
          }
        ],
        notifications: {
          channels: [],
          events: []
        },
        metadata: {
          createdBy: 'system',
          createdAt: new Date(),
          lastModifiedBy: 'system',
          lastModified: new Date(),
          version: 1
        }
      };

      const mockRun: PipelineRun = {
        id: runId,
        pipelineId,
        runNumber: 1,
        status: 'pending',
        trigger: { type: 'manual', user: 'test' },
        startTime: new Date(),
        stages: [],
        summary: {
          totalFindings: 0,
          findingsBySeverity: {},
          findingsByType: {},
          threatsDetected: 0,
          vulnerabilitiesFound: 0,
          complianceIssues: 0,
          autoRemediations: 0,
          riskScore: 0,
          recommendation: 'pass'
        }
      };

      mockRedis.get
        .mockResolvedValueOnce(JSON.stringify(mockPipeline))
        .mockResolvedValueOnce(JSON.stringify(mockRun));
      mockRedis.set.mockResolvedValue('OK');

      // Mock axios for threat scan API
      const axios = require('axios');
      axios.post.mockResolvedValue({
        data: {
          threats: [
            {
              severity: 'high',
              title: 'SQL Injection Risk',
              description: 'Potential SQL injection vulnerability',
              component: 'database',
              mitigation: 'Use parameterized queries',
              references: ['CWE-89'],
              cwe: 'CWE-89',
              fixAvailable: true
            }
          ]
        }
      });

      const executePipeline = (service as any).executePipeline.bind(service);
      const result = await executePipeline(pipelineId, { runId });

      expect(result.status).toBe('success');
      expect(result.stages).toHaveLength(2);
      expect(result.summary.totalFindings).toBeGreaterThan(0);
      expect(result.summary.threatsDetected).toBe(1);
    });

    it('should handle stage failures according to failure action', async () => {
      const pipelineId = 'pipeline-fail-123';
      const runId = 'run-fail-123';
      
      const mockPipeline: PipelineConfig = {
        id: pipelineId,
        name: 'Test Pipeline with Failure',
        platform: 'github',
        projectId: 'project-123',
        threatModelId: 'model-123',
        enabled: true,
        settings: {},
        triggers: [],
        stages: [
          {
            id: 'stage-fail',
            name: 'Failing Stage',
            type: 'custom',
            order: 1,
            enabled: true,
            config: {
              custom: {
                script: 'exit 1'
              }
            },
            failureAction: 'fail'
          }
        ],
        notifications: {
          channels: [],
          events: []
        },
        metadata: {
          createdBy: 'system',
          createdAt: new Date(),
          lastModifiedBy: 'system',
          lastModified: new Date(),
          version: 1
        }
      };

      const mockRun: PipelineRun = {
        id: runId,
        pipelineId,
        runNumber: 1,
        status: 'pending',
        trigger: { type: 'manual', user: 'test' },
        startTime: new Date(),
        stages: [],
        summary: {
          totalFindings: 0,
          findingsBySeverity: {},
          findingsByType: {},
          threatsDetected: 0,
          vulnerabilitiesFound: 0,
          complianceIssues: 0,
          autoRemediations: 0,
          riskScore: 0,
          recommendation: 'pass'
        }
      };

      mockRedis.get
        .mockResolvedValueOnce(JSON.stringify(mockPipeline))
        .mockResolvedValueOnce(JSON.stringify(mockRun));
      mockRedis.set.mockResolvedValue('OK');

      // Mock custom script execution
      (service as any).executeScript = jest.fn().mockResolvedValue({
        stdout: '',
        stderr: 'Command failed',
        exitCode: 1
      });

      const executePipeline = (service as any).executePipeline.bind(service);
      const result = await executePipeline(pipelineId, { runId });

      expect(result.status).toBe('failed');
      expect(result.stages[0].status).toBe('failed');
      expect(result.stages[0].errors).toContain('Custom script failed with exit code 1');
    });
  });

  describe('Finding Analysis', () => {
    it('should calculate risk score correctly', async () => {
      const run: PipelineRun = {
        id: 'run-123',
        pipelineId: 'pipeline-123',
        runNumber: 1,
        status: 'success',
        trigger: { type: 'manual' },
        startTime: new Date(),
        stages: [
          {
            stageId: 'stage-1',
            name: 'Test Stage',
            status: 'success',
            startTime: new Date(),
            findings: [
              {
                id: '1',
                type: 'threat',
                severity: 'critical',
                title: 'Critical Threat',
                description: 'Critical security threat'
              },
              {
                id: '2',
                type: 'vulnerability',
                severity: 'high',
                title: 'High Vulnerability',
                description: 'High severity vulnerability'
              },
              {
                id: '3',
                type: 'vulnerability',
                severity: 'high',
                title: 'Another High Vulnerability',
                description: 'Another high severity vulnerability'
              },
              {
                id: '4',
                type: 'compliance_issue',
                severity: 'medium',
                title: 'Medium Compliance Issue',
                description: 'Medium severity compliance issue'
              },
              {
                id: '5',
                type: 'threat',
                severity: 'low',
                title: 'Low Threat',
                description: 'Low severity threat'
              }
            ] as Finding[]
          }
        ],
        summary: {
          totalFindings: 0,
          findingsBySeverity: {},
          findingsByType: {},
          threatsDetected: 0,
          vulnerabilitiesFound: 0,
          complianceIssues: 0,
          autoRemediations: 0,
          riskScore: 0,
          recommendation: 'pass'
        }
      };

      const calculateSummary = (service as any).calculateSummary.bind(service);
      const summary = calculateSummary(run);

      expect(summary.totalFindings).toBe(5);
      expect(summary.findingsBySeverity.critical).toBe(1);
      expect(summary.findingsBySeverity.high).toBe(2);
      expect(summary.findingsBySeverity.medium).toBe(1);
      expect(summary.findingsBySeverity.low).toBe(1);
      expect(summary.threatsDetected).toBe(2);
      expect(summary.vulnerabilitiesFound).toBe(2);
      expect(summary.complianceIssues).toBe(1);
      expect(summary.riskScore).toBe(22); // (1*10) + (2*5) + (1*2) + (1*1) = 23, capped at 100
      expect(summary.recommendation).toBe('fail'); // Due to critical finding
    });

    it('should map CVSS scores to severity levels correctly', async () => {
      const mapCVSSToSeverity = (service as any).mapCVSSToSeverity.bind(service);

      expect(mapCVSSToSeverity(9.5)).toBe('critical');
      expect(mapCVSSToSeverity(7.5)).toBe('high');
      expect(mapCVSSToSeverity(5.0)).toBe('medium');
      expect(mapCVSSToSeverity(2.0)).toBe('low');
    });
  });

  describe('Integration Status', () => {
    it('should check GitHub integration status', async () => {
      const Octokit = require('@octokit/rest').Octokit;
      const mockGetAuthenticated = jest.fn().mockResolvedValue({
        data: { login: 'test-user' }
      });
      
      Octokit.prototype.users = {
        getAuthenticated: mockGetAuthenticated
      };

      const status = await service.getIntegrationStatus('github');

      expect(status.platform).toBe('github');
      expect(status.connected).toBe(true);
      expect(status.capabilities).toContain('workflow');
      expect(status.capabilities).toContain('webhook');
      expect(mockGetAuthenticated).toHaveBeenCalled();
    });

    it('should handle integration errors gracefully', async () => {
      const Octokit = require('@octokit/rest').Octokit;
      Octokit.prototype.users = {
        getAuthenticated: jest.fn().mockRejectedValue(new Error('Unauthorized'))
      };

      const status = await service.getIntegrationStatus('github');

      expect(status.platform).toBe('github');
      expect(status.connected).toBe(false);
      expect(status.error).toBe('Unauthorized');
    });
  });

  describe('Metrics and Analytics', () => {
    it('should calculate pipeline metrics', async () => {
      const pipelineId = 'pipeline-123';
      const runs: PipelineRun[] = [
        {
          id: 'run-1',
          pipelineId,
          runNumber: 1,
          status: 'success',
          trigger: { type: 'push' },
          startTime: new Date(Date.now() - 3600000), // 1 hour ago
          endTime: new Date(Date.now() - 3000000),
          duration: 600000, // 10 minutes
          stages: [],
          summary: {
            totalFindings: 5,
            findingsBySeverity: { high: 2, medium: 3 },
            findingsByType: { threat: 3, vulnerability: 2 },
            threatsDetected: 3,
            vulnerabilitiesFound: 2,
            complianceIssues: 0,
            autoRemediations: 2,
            riskScore: 25,
            recommendation: 'review'
          }
        },
        {
          id: 'run-2',
          pipelineId,
          runNumber: 2,
          status: 'failed',
          trigger: { type: 'push' },
          startTime: new Date(Date.now() - 1800000), // 30 minutes ago
          endTime: new Date(Date.now() - 1500000),
          duration: 300000, // 5 minutes
          stages: [],
          summary: {
            totalFindings: 10,
            findingsBySeverity: { critical: 1, high: 4, medium: 5 },
            findingsByType: { threat: 5, vulnerability: 5 },
            threatsDetected: 5,
            vulnerabilitiesFound: 5,
            complianceIssues: 0,
            autoRemediations: 3,
            riskScore: 45,
            recommendation: 'fail'
          }
        }
      ];

      mockRedis.lrange.mockResolvedValue(['run-1', 'run-2']);
      mockRedis.get
        .mockResolvedValueOnce(JSON.stringify(runs[0]))
        .mockResolvedValueOnce(JSON.stringify(runs[1]));

      const metrics = await service.getMetrics(pipelineId, 'day');

      expect(metrics.pipelineId).toBe(pipelineId);
      expect(metrics.totalRuns).toBe(2);
      expect(metrics.successRate).toBe(50);
      expect(metrics.averageDuration).toBe(450000); // (600000 + 300000) / 2
      expect(metrics.remediationRate).toBe(33.33); // 5 remediations / 15 total findings
      expect(metrics.findingsOverTime).toBeDefined();
      expect(metrics.topFindings).toBeDefined();
    });
  });

  describe('Webhook Handling', () => {
    it('should handle GitHub webhook events', async () => {
      const platform = 'github';
      const payload = {
        ref: 'refs/heads/main',
        after: 'abc123',
        head_commit: { message: 'Test commit' },
        sender: { login: 'test-user' }
      };

      const mockPipeline: PipelineConfig = {
        id: 'pipeline-123',
        name: 'Test Pipeline',
        platform: 'github',
        projectId: 'project-123',
        threatModelId: 'model-123',
        enabled: true,
        settings: {
          github: { owner: 'test', repo: 'test' }
        },
        triggers: [{ type: 'webhook' }],
        stages: [],
        notifications: { channels: [], events: [] },
        metadata: {
          createdBy: 'system',
          createdAt: new Date(),
          lastModifiedBy: 'system',
          lastModified: new Date(),
          version: 1
        }
      };

      // Mock webhook verification
      (service as any).verifyWebhookSignature = jest.fn().mockResolvedValue(true);
      (service as any).findPipelinesForWebhook = jest.fn().mockResolvedValue([mockPipeline]);
      
      // Mock triggerPipeline
      service.triggerPipeline = jest.fn().mockResolvedValue({
        id: 'run-123',
        status: 'pending'
      } as PipelineRun);

      await service.handleWebhook(platform, payload, 'signature');

      expect(service.triggerPipeline).toHaveBeenCalledWith(
        'pipeline-123',
        expect.objectContaining({
          type: 'webhook',
          user: 'test-user',
          commit: 'abc123',
          branch: 'main',
          message: 'Test commit'
        })
      );
    });

    it('should reject webhooks with invalid signatures', async () => {
      const platform = 'github';
      const payload = { test: 'data' };
      
      (service as any).verifyWebhookSignature = jest.fn().mockResolvedValue(false);

      await expect(service.handleWebhook(platform, payload, 'invalid')).rejects.toThrow(
        'Invalid webhook signature'
      );
    });
  });
});