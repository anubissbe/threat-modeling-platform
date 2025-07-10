import { GitHubIntegration } from '../integrations/github.integration';
import { PipelineConfig, PipelineRun, Finding } from '../types/devops';
import * as crypto from 'crypto';

// Mock Octokit
jest.mock('@octokit/rest', () => ({
  Octokit: jest.fn().mockImplementation(() => ({
    repos: {
      createOrUpdateFileContents: jest.fn(),
      getContent: jest.fn(),
      createWebhook: jest.fn(),
      get: jest.fn(),
      listBranches: jest.fn(),
      createDeployment: jest.fn(),
      createDeploymentStatus: jest.fn(),
      createCommitStatus: jest.fn()
    },
    checks: {
      create: jest.fn()
    },
    issues: {
      create: jest.fn(),
      createComment: jest.fn()
    },
    users: {
      getAuthenticated: jest.fn()
    }
  }))
}));

jest.mock('@octokit/plugin-throttling', () => ({
  throttling: (octokit: any) => octokit
}));

jest.mock('@octokit/plugin-retry', () => ({
  retry: (octokit: any) => octokit
}));

describe('GitHubIntegration', () => {
  let integration: GitHubIntegration;
  let mockOctokit: any;

  beforeEach(() => {
    integration = new GitHubIntegration({
      auth: 'test-token',
      webhookSecret: 'test-secret'
    });
    
    mockOctokit = (integration as any).client;
  });

  describe('Workflow Creation', () => {
    it('should create a GitHub Actions workflow', async () => {
      const pipeline: PipelineConfig = {
        id: 'pipeline-123',
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
            branches: ['main']
          },
          {
            type: 'pull_request',
            branches: ['main']
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
        },
        metadata: {
          createdBy: 'system',
          createdAt: new Date(),
          lastModifiedBy: 'system',
          lastModified: new Date(),
          version: 1
        }
      };

      mockOctokit.repos.getContent.mockRejectedValue({ status: 404 });
      mockOctokit.repos.createOrUpdateFileContents.mockResolvedValue({
        data: { commit: { sha: 'new-sha' } }
      });

      await integration.createWorkflow('test-owner', 'test-repo', pipeline);

      expect(mockOctokit.repos.createOrUpdateFileContents).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        path: `.github/workflows/threat-model-scan-${pipeline.id}.yml`,
        message: 'Add threat model scanning workflow',
        content: expect.any(String),
        sha: undefined
      });

      // Verify workflow content includes expected triggers
      const callArgs = mockOctokit.repos.createOrUpdateFileContents.mock.calls[0][0];
      const workflowContent = Buffer.from(callArgs.content, 'base64').toString();
      expect(workflowContent).toContain('push:');
      expect(workflowContent).toContain('pull_request:');
      expect(workflowContent).toContain('Threat Scan');
    });

    it('should update existing workflow if it exists', async () => {
      const pipeline: PipelineConfig = {
        id: 'pipeline-123',
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

      mockOctokit.repos.getContent.mockResolvedValue({
        data: { sha: 'existing-sha' }
      });
      mockOctokit.repos.createOrUpdateFileContents.mockResolvedValue({
        data: { commit: { sha: 'updated-sha' } }
      });

      await integration.createWorkflow('test-owner', 'test-repo', pipeline);

      expect(mockOctokit.repos.createOrUpdateFileContents).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Update threat model scanning workflow',
          sha: 'existing-sha'
        })
      );
    });
  });

  describe('Check Runs', () => {
    it('should create a check run with findings', async () => {
      const run: PipelineRun = {
        id: 'run-123',
        pipelineId: 'pipeline-123',
        runNumber: 1,
        status: 'success',
        trigger: { type: 'push' },
        startTime: new Date('2024-01-01T10:00:00Z'),
        endTime: new Date('2024-01-01T10:10:00Z'),
        duration: 600000,
        stages: [
          {
            stageId: 'stage-1',
            name: 'Threat Scan',
            status: 'success',
            startTime: new Date(),
            findings: [
              {
                id: 'finding-1',
                type: 'threat',
                severity: 'high',
                title: 'SQL Injection Risk',
                description: 'Potential SQL injection vulnerability',
                file: 'src/database.js',
                line: 42,
                recommendation: 'Use parameterized queries'
              }
            ] as Finding[]
          }
        ],
        summary: {
          totalFindings: 1,
          findingsBySeverity: { high: 1 },
          findingsByType: { threat: 1 },
          threatsDetected: 1,
          vulnerabilitiesFound: 0,
          complianceIssues: 0,
          autoRemediations: 0,
          riskScore: 5,
          recommendation: 'review'
        }
      };

      mockOctokit.checks.create.mockResolvedValue({
        data: { id: 12345 }
      });

      await integration.createCheck('test-owner', 'test-repo', 'sha123', run);

      expect(mockOctokit.checks.create).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        name: 'Threat Model Security Scan',
        head_sha: 'sha123',
        status: 'completed',
        started_at: '2024-01-01T10:00:00.000Z',
        conclusion: 'success',
        completed_at: '2024-01-01T10:10:00.000Z',
        output: expect.objectContaining({
          title: 'Threat Model Scan Results',
          summary: expect.stringContaining('Total Findings: 1'),
          annotations: expect.arrayContaining([
            expect.objectContaining({
              path: 'src/database.js',
              start_line: 42,
              annotation_level: 'failure',
              message: 'Potential SQL injection vulnerability'
            })
          ])
        }),
        actions: expect.any(Array)
      });
    });
  });

  describe('Issue Creation', () => {
    it('should create an issue for security findings', async () => {
      const run: PipelineRun = {
        id: 'run-123',
        pipelineId: 'pipeline-123',
        runNumber: 1,
        status: 'failed',
        trigger: { type: 'push', user: 'developer' },
        startTime: new Date(),
        stages: [
          {
            stageId: 'stage-1',
            name: 'Security Scan',
            status: 'failed',
            startTime: new Date(),
            findings: [
              {
                id: '1',
                type: 'vulnerability',
                severity: 'critical',
                title: 'Critical Vulnerability',
                description: 'Remote code execution vulnerability',
                component: 'authentication',
                cve: 'CVE-2024-0001',
                recommendation: 'Update dependency immediately'
              }
            ] as Finding[]
          }
        ],
        summary: {
          totalFindings: 1,
          findingsBySeverity: { critical: 1 },
          findingsByType: { vulnerability: 1 },
          threatsDetected: 0,
          vulnerabilitiesFound: 1,
          complianceIssues: 0,
          autoRemediations: 0,
          riskScore: 10,
          recommendation: 'fail'
        }
      };

      mockOctokit.issues.create.mockResolvedValue({
        data: { number: 42 }
      });

      await integration.createIssue('test-owner', 'test-repo', run);

      expect(mockOctokit.issues.create).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        title: 'Security Scan Alert: 1 findings detected',
        body: expect.stringContaining('Critical Vulnerability'),
        labels: ['security', 'automated-scan', 'severity:critical'],
        assignees: []
      });

      const issueBody = mockOctokit.issues.create.mock.calls[0][0].body;
      expect(issueBody).toContain('CVE-2024-0001');
      expect(issueBody).toContain('Remote code execution vulnerability');
    });
  });

  describe('Pull Request Comments', () => {
    it('should create a PR comment with scan results', async () => {
      const run: PipelineRun = {
        id: 'run-123',
        pipelineId: 'pipeline-123',
        runNumber: 1,
        status: 'success',
        trigger: { type: 'pull_request' },
        startTime: new Date(),
        stages: [],
        summary: {
          totalFindings: 3,
          findingsBySeverity: { high: 1, medium: 2 },
          findingsByType: { threat: 2, vulnerability: 1 },
          threatsDetected: 2,
          vulnerabilitiesFound: 1,
          complianceIssues: 0,
          autoRemediations: 0,
          riskScore: 15,
          recommendation: 'review'
        }
      };

      mockOctokit.issues.createComment.mockResolvedValue({
        data: { id: 999 }
      });

      await integration.createPullRequestComment('test-owner', 'test-repo', 10, run);

      expect(mockOctokit.issues.createComment).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: 10,
        body: expect.stringContaining('⚠️ REVIEW REQUIRED')
      });

      const comment = mockOctokit.issues.createComment.mock.calls[0][0].body;
      expect(comment).toContain('Total Findings | 3');
      expect(comment).toContain('High | 1');
      expect(comment).toContain('Medium | 2');
    });
  });

  describe('Webhook Verification', () => {
    it('should verify valid webhook signatures', () => {
      const secret = 'test-secret';
      const payload = JSON.stringify({ test: 'data' });
      
      const hmac = crypto.createHmac('sha256', secret);
      hmac.update(payload);
      const signature = `sha256=${hmac.digest('hex')}`;

      const integration = new GitHubIntegration({
        auth: 'token',
        webhookSecret: secret
      });

      const isValid = integration.verifyWebhook(payload, signature);
      expect(isValid).toBe(true);
    });

    it('should reject invalid webhook signatures', () => {
      const integration = new GitHubIntegration({
        auth: 'token',
        webhookSecret: 'test-secret'
      });

      const isValid = integration.verifyWebhook('{"test":"data"}', 'sha256=invalid');
      expect(isValid).toBe(false);
    });

    it('should accept webhooks when no secret is configured', () => {
      const integration = new GitHubIntegration({
        auth: 'token'
      });

      const isValid = integration.verifyWebhook('{"test":"data"}', 'any-signature');
      expect(isValid).toBe(true);
    });
  });

  describe('Repository Information', () => {
    it('should get repository information', async () => {
      mockOctokit.repos.get.mockResolvedValue({
        data: {
          id: 123,
          name: 'test-repo',
          full_name: 'test-owner/test-repo',
          description: 'Test repository',
          private: false,
          default_branch: 'main',
          language: 'JavaScript',
          topics: ['security', 'testing'],
          archived: false,
          disabled: false
        }
      });

      const info = await integration.getRepositoryInfo('test-owner', 'test-repo');

      expect(info).toEqual({
        id: 123,
        name: 'test-repo',
        fullName: 'test-owner/test-repo',
        description: 'Test repository',
        private: false,
        defaultBranch: 'main',
        language: 'JavaScript',
        topics: ['security', 'testing'],
        archived: false,
        disabled: false
      });
    });

    it('should get repository branches', async () => {
      mockOctokit.repos.listBranches.mockResolvedValue({
        data: [
          { name: 'main' },
          { name: 'develop' },
          { name: 'feature/security-scan' }
        ]
      });

      const branches = await integration.getBranches('test-owner', 'test-repo');

      expect(branches).toEqual(['main', 'develop', 'feature/security-scan']);
    });
  });

  describe('Deployment Integration', () => {
    it('should create deployment with status', async () => {
      const run: PipelineRun = {
        id: 'run-123',
        pipelineId: 'pipeline-123',
        runNumber: 1,
        status: 'success',
        trigger: { type: 'push' },
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

      mockOctokit.repos.createDeployment.mockResolvedValue({
        data: { id: 999 }
      });
      mockOctokit.repos.createDeploymentStatus.mockResolvedValue({
        data: { id: 1000 }
      });

      await integration.createDeployment(
        'test-owner',
        'test-repo',
        'main',
        'production',
        run
      );

      expect(mockOctokit.repos.createDeployment).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        ref: 'main',
        environment: 'production',
        description: 'Threat model scan for production',
        auto_merge: false,
        required_contexts: ['threat-model/scan']
      });

      expect(mockOctokit.repos.createDeploymentStatus).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        deployment_id: 999,
        state: 'success',
        description: 'Security scan success',
        environment_url: expect.stringContaining('/pipelines/pipeline-123/runs/run-123'),
        log_url: expect.stringContaining('/pipelines/pipeline-123/runs/run-123/logs')
      });
    });
  });

  describe('Status Updates', () => {
    it('should create commit status', async () => {
      const run: PipelineRun = {
        id: 'run-123',
        pipelineId: 'pipeline-123',
        runNumber: 1,
        status: 'success',
        trigger: { type: 'push' },
        startTime: new Date(),
        stages: [],
        summary: {
          totalFindings: 2,
          findingsBySeverity: { low: 2 },
          findingsByType: { threat: 2 },
          threatsDetected: 2,
          vulnerabilitiesFound: 0,
          complianceIssues: 0,
          autoRemediations: 0,
          riskScore: 2,
          recommendation: 'pass'
        }
      };

      mockOctokit.repos.createCommitStatus.mockResolvedValue({
        data: { id: 123 }
      });

      await integration.createStatus('test-owner', 'test-repo', 'sha123', run);

      expect(mockOctokit.repos.createCommitStatus).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        sha: 'sha123',
        state: 'success',
        target_url: expect.stringContaining('/pipelines/pipeline-123/runs/run-123'),
        description: 'Found 2 issues (pass)',
        context: 'threat-model/scan'
      });
    });
  });
});