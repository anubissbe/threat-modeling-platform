import { Octokit } from '@octokit/rest';
import { createAppAuth } from '@octokit/auth-app';
import { throttling } from '@octokit/plugin-throttling';
import { retry } from '@octokit/plugin-retry';
import * as yaml from 'yaml';
import * as crypto from 'crypto';
import winston from 'winston';
import { PipelineConfig, PipelineRun, Finding, WebhookPayload } from '../types/devops';

const OctokitWithPlugins = Octokit.plugin(throttling, retry);

export class GitHubIntegration {
  private client: Octokit;
  private logger: winston.Logger;
  private webhookSecret: string;

  constructor(config: {
    auth: string | { appId: number; privateKey: string; installationId: number };
    webhookSecret?: string;
  }) {
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.json(),
      defaultMeta: { service: 'github-integration' }
    });

    this.webhookSecret = config.webhookSecret || '';

    // Initialize Octokit with plugins
    if (typeof config.auth === 'string') {
      // Personal Access Token
      this.client = new OctokitWithPlugins({
        auth: config.auth,
        throttle: {
          onRateLimit: (retryAfter: number, options: any) => {
            this.logger.warn(`Request quota exhausted for request ${options.method} ${options.url}`);
            return true;
          },
          onSecondaryRateLimit: (retryAfter: number, options: any) => {
            this.logger.warn(`Secondary rate limit triggered for request ${options.method} ${options.url}`);
            return true;
          }
        },
        retry: {
          doNotRetry: ["429"]
        }
      });
    } else {
      // GitHub App
      this.client = new OctokitWithPlugins({
        authStrategy: createAppAuth,
        auth: config.auth,
        throttle: {
          onRateLimit: (retryAfter: number, options: any) => {
            this.logger.warn(`Request quota exhausted for request ${options.method} ${options.url}`);
            return true;
          },
          onSecondaryRateLimit: (retryAfter: number, options: any) => {
            this.logger.warn(`Secondary rate limit triggered for request ${options.method} ${options.url}`);
            return true;
          }
        }
      });
    }
  }

  async createWorkflow(
    owner: string,
    repo: string,
    pipeline: PipelineConfig
  ): Promise<void> {
    const workflow = this.generateWorkflow(pipeline);
    const path = `.github/workflows/threat-model-scan-${pipeline.id}.yml`;

    try {
      // Check if file exists
      let sha: string | undefined;
      try {
        const { data } = await this.client.repos.getContent({
          owner,
          repo,
          path
        });
        sha = Array.isArray(data) ? undefined : data.sha;
      } catch (error: any) {
        if (error.status !== 404) throw error;
      }

      // Create or update workflow file
      await this.client.repos.createOrUpdateFileContents({
        owner,
        repo,
        path,
        message: `${sha ? 'Update' : 'Add'} threat model scanning workflow`,
        content: Buffer.from(workflow).toString('base64'),
        sha
      });

      this.logger.info(`Workflow created for ${owner}/${repo}`);
    } catch (error) {
      this.logger.error(`Failed to create workflow`, error);
      throw error;
    }
  }

  private generateWorkflow(pipeline: PipelineConfig): string {
    const workflow: any = {
      name: `Threat Model Scan - ${pipeline.name}`,
      on: this.generateTriggers(pipeline),
      env: {
        THREAT_MODEL_ID: pipeline.threatModelId,
        PIPELINE_ID: pipeline.id
      },
      jobs: {
        'threat-scan': {
          name: 'Threat Model Security Scan',
          'runs-on': 'ubuntu-latest',
          permissions: {
            contents: 'read',
            'security-events': 'write',
            issues: 'write',
            'pull-requests': 'write'
          },
          steps: this.generateSteps(pipeline)
        }
      }
    };

    return yaml.stringify(workflow);
  }

  private generateTriggers(pipeline: PipelineConfig): any {
    const triggers: any = {};

    for (const trigger of pipeline.triggers) {
      switch (trigger.type) {
        case 'push':
          triggers.push = {
            branches: trigger.branches || ['main', 'master']
          };
          break;
        case 'pull_request':
          triggers.pull_request = {
            branches: trigger.branches || ['main', 'master'],
            types: ['opened', 'synchronize', 'reopened']
          };
          break;
        case 'schedule':
          if (!triggers.schedule) triggers.schedule = [];
          triggers.schedule.push({ cron: trigger.schedule });
          break;
        case 'manual':
          triggers.workflow_dispatch = {};
          break;
      }
    }

    return triggers;
  }

  private generateSteps(pipeline: PipelineConfig): any[] {
    const steps: any[] = [
      {
        name: 'Checkout code',
        uses: 'actions/checkout@v4'
      },
      {
        name: 'Setup Node.js',
        uses: 'actions/setup-node@v4',
        with: {
          'node-version': '18'
        }
      },
      {
        name: 'Install Threat Model CLI',
        run: 'npm install -g @threat-modeling/cli'
      }
    ];

    // Add stage-specific steps
    for (const stage of pipeline.stages) {
      if (!stage.enabled) continue;

      steps.push(this.generateStageStep(stage));
    }

    // Add results upload
    steps.push({
      name: 'Upload scan results',
      if: 'always()',
      uses: 'actions/upload-artifact@v3',
      with: {
        name: 'threat-scan-results',
        path: 'threat-scan-results/',
        'retention-days': 30
      }
    });

    // Add SARIF upload for GitHub Security tab
    steps.push({
      name: 'Upload SARIF results',
      if: 'always()',
      uses: 'github/codeql-action/upload-sarif@v2',
      with: {
        'sarif_file': 'threat-scan-results/results.sarif'
      }
    });

    return steps;
  }

  private generateStageStep(stage: any): any {
    const step: any = {
      name: stage.name,
      id: stage.id,
      run: ''
    };

    switch (stage.type) {
      case 'threat-scan':
        step.run = `threat-model scan \\
          --model-id $THREAT_MODEL_ID \\
          --scan-type ${stage.config.threatScan?.scanType || 'full'} \\
          --output threat-scan-results/threats.json \\
          --format sarif`;
        break;

      case 'vulnerability-scan':
        step.run = `threat-model vuln-scan \\
          --scanners ${stage.config.vulnerabilityScan?.scanners.join(',')} \\
          --output threat-scan-results/vulnerabilities.json`;
        break;

      case 'compliance-check':
        step.run = `threat-model compliance \\
          --frameworks ${stage.config.complianceCheck?.frameworks.join(',')} \\
          --output threat-scan-results/compliance.json`;
        break;

      case 'custom':
        step.run = stage.config.custom?.script || 'echo "No custom script defined"';
        if (stage.config.custom?.environment) {
          step.env = stage.config.custom.environment;
        }
        break;
    }

    // Add timeout if specified
    if (stage.timeout) {
      step['timeout-minutes'] = Math.ceil(stage.timeout / 60000);
    }

    // Add continue-on-error for non-failing stages
    if (stage.failureAction !== 'fail') {
      step['continue-on-error'] = true;
    }

    return step;
  }

  async createCheck(
    owner: string,
    repo: string,
    sha: string,
    run: PipelineRun
  ): Promise<void> {
    try {
      // Create check run
      const { data: checkRun } = await this.client.checks.create({
        owner,
        repo,
        name: 'Threat Model Security Scan',
        head_sha: sha,
        status: this.mapRunStatus(run.status),
        started_at: run.startTime.toISOString(),
        conclusion: run.status === 'success' ? 'success' : 
                    run.status === 'failed' ? 'failure' : undefined,
        completed_at: run.endTime?.toISOString(),
        output: {
          title: 'Threat Model Scan Results',
          summary: this.generateCheckSummary(run),
          text: this.generateCheckDetails(run),
          annotations: this.generateAnnotations(run)
        },
        actions: this.generateCheckActions(run)
      });

      this.logger.info(`Check created: ${checkRun.id}`);
    } catch (error) {
      this.logger.error(`Failed to create check`, error);
      throw error;
    }
  }

  private mapRunStatus(status: PipelineRun['status']): 'queued' | 'in_progress' | 'completed' {
    switch (status) {
      case 'pending': return 'queued';
      case 'running': return 'in_progress';
      default: return 'completed';
    }
  }

  private generateCheckSummary(run: PipelineRun): string {
    const summary = run.summary;
    return `
## Security Scan Summary

- **Total Findings**: ${summary.totalFindings}
- **Threats Detected**: ${summary.threatsDetected}
- **Vulnerabilities Found**: ${summary.vulnerabilitiesFound}
- **Compliance Issues**: ${summary.complianceIssues}
- **Risk Score**: ${summary.riskScore}/100
- **Recommendation**: **${summary.recommendation.toUpperCase()}**

### Findings by Severity
${Object.entries(summary.findingsBySeverity)
  .map(([severity, count]) => `- **${severity}**: ${count}`)
  .join('\n')}
    `.trim();
  }

  private generateCheckDetails(run: PipelineRun): string {
    let details = '## Detailed Results\n\n';

    for (const stage of run.stages) {
      details += `### ${stage.name}\n`;
      details += `- **Status**: ${stage.status}\n`;
      details += `- **Duration**: ${stage.duration}ms\n`;
      
      if (stage.findings && stage.findings.length > 0) {
        details += `- **Findings**: ${stage.findings.length}\n\n`;
        
        // Group findings by severity
        const bySeverity = stage.findings.reduce((acc, finding) => {
          if (!acc[finding.severity]) acc[finding.severity] = [];
          acc[finding.severity].push(finding);
          return acc;
        }, {} as Record<string, Finding[]>);

        for (const [severity, findings] of Object.entries(bySeverity)) {
          details += `#### ${severity.toUpperCase()} (${findings.length})\n`;
          for (const finding of findings.slice(0, 5)) {
            details += `- **${finding.title}**\n`;
            details += `  - ${finding.description}\n`;
            if (finding.recommendation) {
              details += `  - **Recommendation**: ${finding.recommendation}\n`;
            }
          }
          if (findings.length > 5) {
            details += `- _...and ${findings.length - 5} more_\n`;
          }
          details += '\n';
        }
      }
    }

    return details;
  }

  private generateAnnotations(run: PipelineRun): any[] {
    const annotations: any[] = [];
    const maxAnnotations = 50; // GitHub limit

    for (const stage of run.stages) {
      if (!stage.findings) continue;

      for (const finding of stage.findings.slice(0, maxAnnotations - annotations.length)) {
        if (finding.file && finding.line) {
          annotations.push({
            path: finding.file,
            start_line: finding.line,
            end_line: finding.line,
            annotation_level: this.mapSeverityToLevel(finding.severity),
            message: finding.description,
            title: finding.title,
            raw_details: finding.recommendation
          });
        }
      }

      if (annotations.length >= maxAnnotations) break;
    }

    return annotations;
  }

  private mapSeverityToLevel(severity: Finding['severity']): 'notice' | 'warning' | 'failure' {
    switch (severity) {
      case 'low': return 'notice';
      case 'medium': return 'warning';
      case 'high':
      case 'critical': return 'failure';
    }
  }

  private generateCheckActions(run: PipelineRun): any[] {
    const actions: any[] = [];

    if (run.summary.recommendation === 'review') {
      actions.push({
        label: 'Request Security Review',
        description: 'Request a manual security review for these findings',
        identifier: 'request_review'
      });
    }

    if (run.summary.autoRemediations < run.summary.totalFindings) {
      actions.push({
        label: 'Apply Auto-Fixes',
        description: 'Automatically fix issues where possible',
        identifier: 'auto_fix'
      });
    }

    return actions;
  }

  async createIssue(
    owner: string,
    repo: string,
    run: PipelineRun
  ): Promise<void> {
    try {
      const { data: issue } = await this.client.issues.create({
        owner,
        repo,
        title: `Security Scan Alert: ${run.summary.totalFindings} findings detected`,
        body: this.generateIssueBody(run),
        labels: ['security', 'automated-scan', this.getSeverityLabel(run)],
        assignees: []
      });

      this.logger.info(`Issue created: ${issue.number}`);
    } catch (error) {
      this.logger.error(`Failed to create issue`, error);
      throw error;
    }
  }

  private generateIssueBody(run: PipelineRun): string {
    return `
## 🔒 Security Scan Results

A security scan has detected potential issues in your codebase.

### Summary
- **Pipeline Run**: ${run.id}
- **Trigger**: ${run.trigger.type} by ${run.trigger.user || 'system'}
- **Total Findings**: ${run.summary.totalFindings}
- **Risk Score**: ${run.summary.riskScore}/100
- **Recommendation**: **${run.summary.recommendation.toUpperCase()}**

### Findings Breakdown
| Type | Count |
|------|-------|
| Threats | ${run.summary.threatsDetected} |
| Vulnerabilities | ${run.summary.vulnerabilitiesFound} |
| Compliance Issues | ${run.summary.complianceIssues} |

### Top Priority Findings

${this.getTopPriorityFindings(run).map(finding => `
#### ${finding.severity.toUpperCase()}: ${finding.title}
- **Type**: ${finding.type}
- **Component**: ${finding.component || 'N/A'}
- **Description**: ${finding.description}
- **Recommendation**: ${finding.recommendation || 'Review and address this finding'}
${finding.cve ? `- **CVE**: ${finding.cve}` : ''}
${finding.cwe ? `- **CWE**: ${finding.cwe}` : ''}
`).join('\n---\n')}

### Next Steps
1. Review the findings in detail
2. Apply recommended fixes where possible
3. Mark false positives for future exclusion
4. Re-run the scan after making changes

[View Full Report](${process.env.APP_URL}/pipelines/${run.pipelineId}/runs/${run.id})
    `.trim();
  }

  private getSeverityLabel(run: PipelineRun): string {
    if (run.summary.findingsBySeverity.critical > 0) return 'severity:critical';
    if (run.summary.findingsBySeverity.high > 0) return 'severity:high';
    if (run.summary.findingsBySeverity.medium > 0) return 'severity:medium';
    return 'severity:low';
  }

  private getTopPriorityFindings(run: PipelineRun, limit: number = 5): Finding[] {
    const allFindings = run.stages.flatMap(s => s.findings || []);
    
    return allFindings
      .sort((a, b) => {
        const severityOrder = ['critical', 'high', 'medium', 'low'];
        return severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity);
      })
      .slice(0, limit);
  }

  async createPullRequestComment(
    owner: string,
    repo: string,
    pullNumber: number,
    run: PipelineRun
  ): Promise<void> {
    try {
      const { data: comment } = await this.client.issues.createComment({
        owner,
        repo,
        issue_number: pullNumber,
        body: this.generatePRComment(run)
      });

      this.logger.info(`PR comment created: ${comment.id}`);
    } catch (error) {
      this.logger.error(`Failed to create PR comment`, error);
      throw error;
    }
  }

  private generatePRComment(run: PipelineRun): string {
    const emoji = run.status === 'success' ? '✅' : 
                  run.status === 'failed' ? '❌' : '⏳';

    return `
## ${emoji} Threat Model Security Scan

${run.status === 'running' ? '**Scan in progress...**' : ''}

${run.status === 'success' || run.status === 'failed' ? `
### Results Summary

| Metric | Value |
|--------|-------|
| Total Findings | ${run.summary.totalFindings} |
| Critical | ${run.summary.findingsBySeverity.critical || 0} |
| High | ${run.summary.findingsBySeverity.high || 0} |
| Medium | ${run.summary.findingsBySeverity.medium || 0} |
| Low | ${run.summary.findingsBySeverity.low || 0} |
| Risk Score | ${run.summary.riskScore}/100 |

### Recommendation: ${run.summary.recommendation === 'pass' ? '✅ PASS' : 
                     run.summary.recommendation === 'review' ? '⚠️ REVIEW REQUIRED' : 
                     '❌ FAIL'}

${run.summary.totalFindings > 0 ? `
<details>
<summary>View Findings Details</summary>

${this.getTopPriorityFindings(run, 10).map(finding => `
- **${finding.severity}**: ${finding.title}
  - ${finding.description}
`).join('\n')}

</details>
` : ''}

[View Full Report](${process.env.APP_URL}/pipelines/${run.pipelineId}/runs/${run.id})
` : ''}
    `.trim();
  }

  async createStatus(
    owner: string,
    repo: string,
    sha: string,
    run: PipelineRun
  ): Promise<void> {
    try {
      await this.client.repos.createCommitStatus({
        owner,
        repo,
        sha,
        state: this.mapRunStatusToState(run.status),
        target_url: `${process.env.APP_URL}/pipelines/${run.pipelineId}/runs/${run.id}`,
        description: this.getStatusDescription(run),
        context: 'threat-model/scan'
      });

      this.logger.info(`Status created for ${sha}`);
    } catch (error) {
      this.logger.error(`Failed to create status`, error);
      throw error;
    }
  }

  private mapRunStatusToState(status: PipelineRun['status']): 'error' | 'failure' | 'pending' | 'success' {
    switch (status) {
      case 'pending': return 'pending';
      case 'running': return 'pending';
      case 'success': return 'success';
      case 'failed': return 'failure';
      case 'cancelled': return 'error';
    }
  }

  private getStatusDescription(run: PipelineRun): string {
    if (run.status === 'running') return 'Security scan in progress...';
    if (run.status === 'success' && run.summary.totalFindings === 0) return 'No security issues found';
    if (run.status === 'success') return `Found ${run.summary.totalFindings} issues (${run.summary.recommendation})`;
    if (run.status === 'failed') return 'Security scan failed';
    return 'Security scan cancelled';
  }

  verifyWebhook(payload: string, signature: string): boolean {
    if (!this.webhookSecret) return true;

    const hmac = crypto.createHmac('sha256', this.webhookSecret);
    hmac.update(payload);
    const calculatedSignature = `sha256=${hmac.digest('hex')}`;

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(calculatedSignature)
    );
  }

  parseWebhookEvent(headers: any, body: any): WebhookPayload {
    return {
      event: headers['x-github-event'],
      platform: 'github',
      data: body,
      signature: headers['x-hub-signature-256'],
      timestamp: new Date()
    };
  }

  async setupWebhook(
    owner: string,
    repo: string,
    config: {
      url: string;
      events: string[];
      secret?: string;
    }
  ): Promise<void> {
    try {
      const { data: webhook } = await this.client.repos.createWebhook({
        owner,
        repo,
        config: {
          url: config.url,
          content_type: 'json',
          secret: config.secret || this.webhookSecret,
          insecure_ssl: '0'
        },
        events: config.events,
        active: true
      });

      this.logger.info(`Webhook created: ${webhook.id}`);
    } catch (error) {
      this.logger.error(`Failed to create webhook`, error);
      throw error;
    }
  }

  async getRepositoryInfo(owner: string, repo: string): Promise<any> {
    try {
      const { data } = await this.client.repos.get({ owner, repo });
      return {
        id: data.id,
        name: data.name,
        fullName: data.full_name,
        description: data.description,
        private: data.private,
        defaultBranch: data.default_branch,
        language: data.language,
        topics: data.topics,
        archived: data.archived,
        disabled: data.disabled
      };
    } catch (error) {
      this.logger.error(`Failed to get repository info`, error);
      throw error;
    }
  }

  async getBranches(owner: string, repo: string): Promise<string[]> {
    try {
      const { data } = await this.client.repos.listBranches({
        owner,
        repo,
        per_page: 100
      });
      return data.map(branch => branch.name);
    } catch (error) {
      this.logger.error(`Failed to get branches`, error);
      throw error;
    }
  }

  async createDeployment(
    owner: string,
    repo: string,
    ref: string,
    environment: string,
    run: PipelineRun
  ): Promise<void> {
    try {
      // Create deployment
      const { data: deployment } = await this.client.repos.createDeployment({
        owner,
        repo,
        ref,
        environment,
        description: `Threat model scan for ${environment}`,
        auto_merge: false,
        required_contexts: ['threat-model/scan']
      });

      if (deployment && 'id' in deployment) {
        // Create deployment status
        await this.client.repos.createDeploymentStatus({
          owner,
          repo,
          deployment_id: deployment.id,
          state: run.status === 'success' ? 'success' : 'failure',
          description: `Security scan ${run.status}`,
          environment_url: `${process.env.APP_URL}/pipelines/${run.pipelineId}/runs/${run.id}`,
          log_url: `${process.env.APP_URL}/pipelines/${run.pipelineId}/runs/${run.id}/logs`
        });
      }
    } catch (error) {
      this.logger.error(`Failed to create deployment`, error);
      throw error;
    }
  }
}