import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import {
  ComplianceFramework,
  ComplianceControl,
  ComplianceAssessment,
  AssessmentScope,
  AssessmentConfiguration,
  ComplianceStatus,
  ControlAssessmentResult,
  ComplianceFinding,
  ComplianceRecommendation,
  RemediationPlan,
  ComplianceDashboard,
  FrameworkStatus,
  ComplianceSearchQuery,
  CreateAssessmentRequest,
  UpdateControlRequest,
  CreateRemediationPlanRequest,
  ComplianceEvent,
  ComplianceEventType,
  AutomatedTestResult,
  ManualTestResult,
  AssessmentEvidence,
  ComplianceTrend,
  UpcomingAssessment,
  ExpiringCertification
} from '../types/compliance';

export class ComplianceService {
  private controls: Map<string, ComplianceControl> = new Map();
  private assessments: Map<string, ComplianceAssessment> = new Map();
  private remediationPlans: Map<string, RemediationPlan> = new Map();
  private findings: Map<string, ComplianceFinding> = new Map();
  private recommendations: Map<string, ComplianceRecommendation> = new Map();
  private evidence: Map<string, AssessmentEvidence> = new Map();
  private events: ComplianceEvent[] = [];

  constructor() {
    this.initializeFrameworkControls();
    logger.info('Compliance service initialized with framework controls');
  }

  /**
   * Initialize controls for all supported compliance frameworks
   */
  private initializeFrameworkControls(): void {
    // GDPR Controls
    this.addGDPRControls();
    
    // HIPAA Controls
    this.addHIPAAControls();
    
    // SOC 2 Controls
    this.addSOC2Controls();
    
    // PCI-DSS Controls
    this.addPCIDSSControls();
    
    // ISO 27001 Controls
    this.addISO27001Controls();
    
    // NIST Controls
    this.addNISTControls();
    
    // OWASP Controls
    this.addOWASPControls();
    
    logger.info(`Initialized ${this.controls.size} compliance controls across all frameworks`);
  }

  /**
   * Create a new compliance assessment
   */
  async createAssessment(request: CreateAssessmentRequest, userId: string): Promise<ComplianceAssessment> {
    try {
      const assessment: ComplianceAssessment = {
        id: uuidv4(),
        name: request.name,
        description: request.description,
        framework: request.framework,
        scope: request.scope,
        configuration: request.configuration,
        status: 'planned',
        scheduledDate: request.scheduledDate ? new Date(request.scheduledDate) : undefined,
        overallStatus: 'not-assessed',
        complianceScore: 0,
        totalControls: 0,
        compliantControls: 0,
        nonCompliantControls: 0,
        partiallyCompliantControls: 0,
        notAssessedControls: 0,
        controlResults: [],
        findings: [],
        recommendations: [],
        evidence: [],
        version: '1.0',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Calculate total controls based on scope
      assessment.totalControls = this.getControlsForAssessment(assessment).length;
      assessment.notAssessedControls = assessment.totalControls;

      this.assessments.set(assessment.id, assessment);

      // Log event
      await this.logEvent('assessment_created', `Assessment '${assessment.name}' created`, {
        assessmentId: assessment.id,
        framework: assessment.framework,
        userId
      });

      logger.info(`Created assessment: ${assessment.id} for framework: ${assessment.framework}`);
      return assessment;
    } catch (error) {
      logger.error('Error creating assessment:', error);
      throw new ComplianceError('ASSESSMENT_CREATE_ERROR', 'Failed to create assessment', { error });
    }
  }

  /**
   * Execute a compliance assessment
   */
  async executeAssessment(assessmentId: string, userId: string): Promise<ComplianceAssessment> {
    try {
      const assessment = this.assessments.get(assessmentId);
      if (!assessment) {
        throw new ComplianceError('ASSESSMENT_NOT_FOUND', 'Assessment not found', { assessmentId });
      }

      assessment.status = 'in-progress';
      assessment.startDate = new Date();
      assessment.updatedAt = new Date();

      // Get controls to assess
      const controlsToAssess = this.getControlsForAssessment(assessment);
      
      logger.info(`Starting assessment ${assessmentId} with ${controlsToAssess.length} controls`);

      // Execute automated tests if enabled
      if (assessment.configuration.automatedTestsEnabled) {
        await this.executeAutomatedTests(assessment, controlsToAssess);
      }

      // Calculate overall results
      this.calculateAssessmentResults(assessment);

      // Generate findings and recommendations
      await this.generateFindings(assessment, controlsToAssess);
      await this.generateRecommendations(assessment);

      assessment.status = 'completed';
      assessment.endDate = new Date();
      assessment.updatedAt = new Date();

      this.assessments.set(assessmentId, assessment);

      // Log event
      await this.logEvent('assessment_completed', `Assessment '${assessment.name}' completed`, {
        assessmentId,
        framework: assessment.framework,
        score: assessment.complianceScore,
        userId
      });

      logger.info(`Completed assessment ${assessmentId} with score: ${assessment.complianceScore}%`);
      return assessment;
    } catch (error) {
      logger.error('Error executing assessment:', error);
      throw new ComplianceError('ASSESSMENT_EXECUTION_ERROR', 'Failed to execute assessment', { assessmentId, error });
    }
  }

  /**
   * Get controls that should be included in an assessment
   */
  private getControlsForAssessment(assessment: ComplianceAssessment): ComplianceControl[] {
    const allControls = Array.from(this.controls.values());
    
    // Filter by framework
    let filteredControls = allControls.filter(control => 
      assessment.scope.frameworks.includes(control.framework)
    );

    // Filter by specific control IDs if specified
    if (assessment.scope.controls && assessment.scope.controls.length > 0) {
      filteredControls = filteredControls.filter(control =>
        assessment.scope.controls!.includes(control.id)
      );
    }

    // Exclude specified controls
    if (assessment.scope.excludedControls && assessment.scope.excludedControls.length > 0) {
      filteredControls = filteredControls.filter(control =>
        !assessment.scope.excludedControls!.includes(control.id)
      );
    }

    return filteredControls;
  }

  /**
   * Execute automated tests for controls
   */
  private async executeAutomatedTests(assessment: ComplianceAssessment, controls: ComplianceControl[]): Promise<void> {
    for (const control of controls) {
      if (control.assessmentType === 'automated' || control.assessmentType === 'hybrid') {
        const testResults = await this.runAutomatedTestsForControl(control);
        
        const controlResult: ControlAssessmentResult = {
          controlId: control.id,
          status: this.determineControlStatus(testResults),
          score: this.calculateControlScore(testResults),
          confidence: 90, // High confidence for automated tests
          automatedTestResults: testResults,
          evidence: [],
          evidenceQuality: 'good',
          findings: [],
          recommendations: [],
          assessmentMethod: 'automated',
          assessmentDate: new Date()
        };

        assessment.controlResults.push(controlResult);
      }
    }
  }

  /**
   * Run automated tests for a specific control
   */
  private async runAutomatedTestsForControl(control: ComplianceControl): Promise<AutomatedTestResult[]> {
    const results: AutomatedTestResult[] = [];
    
    try {
      // Simulate automated testing based on control type and framework
      const testCases = this.getAutomatedTestCases(control);
      
      for (const testCase of testCases) {
        const startTime = Date.now();
        const result = await this.executeAutomatedTest(control, testCase);
        const executionTime = Date.now() - startTime;
        
        results.push({
          testId: testCase.id,
          testName: testCase.name,
          status: result.status,
          score: result.score,
          message: result.message,
          details: result.details,
          executionTime,
          timestamp: new Date()
        });
      }
    } catch (error) {
      logger.error(`Error running automated tests for control ${control.id}:`, error);
      results.push({
        testId: 'error',
        testName: 'Test Execution Error',
        status: 'error',
        score: 0,
        message: `Failed to execute automated tests: ${error}`,
        executionTime: 0,
        timestamp: new Date()
      });
    }

    return results;
  }

  /**
   * Get automated test cases for a control
   */
  private getAutomatedTestCases(control: ComplianceControl): any[] {
    // This would integrate with actual testing frameworks
    // For now, return mock test cases based on control category
    const testCases: any[] = [];

    switch (control.category.toLowerCase()) {
      case 'access control':
        testCases.push(
          { id: 'ac-001', name: 'User Access Review', weight: 1.0 },
          { id: 'ac-002', name: 'Privileged Access Control', weight: 1.5 },
          { id: 'ac-003', name: 'Authentication Mechanisms', weight: 1.2 }
        );
        break;
      
      case 'data protection':
        testCases.push(
          { id: 'dp-001', name: 'Encryption at Rest', weight: 1.5 },
          { id: 'dp-002', name: 'Encryption in Transit', weight: 1.5 },
          { id: 'dp-003', name: 'Data Classification', weight: 1.0 }
        );
        break;
      
      case 'network security':
        testCases.push(
          { id: 'ns-001', name: 'Firewall Configuration', weight: 1.3 },
          { id: 'ns-002', name: 'Network Segmentation', weight: 1.4 },
          { id: 'ns-003', name: 'Intrusion Detection', weight: 1.2 }
        );
        break;
      
      default:
        testCases.push(
          { id: 'gen-001', name: 'General Compliance Check', weight: 1.0 }
        );
    }

    return testCases;
  }

  /**
   * Execute a single automated test
   */
  private async executeAutomatedTest(control: ComplianceControl, testCase: any): Promise<any> {
    // Simulate test execution with random results for demonstration
    // In production, this would integrate with actual testing tools
    
    const random = Math.random();
    
    if (random > 0.8) {
      return {
        status: 'pass',
        score: 85 + Math.random() * 15,
        message: `Test ${testCase.name} passed successfully`,
        details: { testCase: testCase.id, controlId: control.id }
      };
    } else if (random > 0.6) {
      return {
        status: 'warning',
        score: 60 + Math.random() * 25,
        message: `Test ${testCase.name} passed with warnings`,
        details: { warnings: ['Minor configuration issue'], testCase: testCase.id }
      };
    } else if (random > 0.3) {
      return {
        status: 'fail',
        score: Math.random() * 40,
        message: `Test ${testCase.name} failed`,
        details: { issues: ['Control implementation incomplete'], testCase: testCase.id }
      };
    } else {
      return {
        status: 'error',
        score: 0,
        message: `Test ${testCase.name} encountered an error`,
        details: { error: 'Test execution failed', testCase: testCase.id }
      };
    }
  }

  /**
   * Determine control status based on test results
   */
  private determineControlStatus(testResults: AutomatedTestResult[]): ComplianceStatus {
    if (testResults.length === 0) return 'not-assessed';
    
    const passCount = testResults.filter(r => r.status === 'pass').length;
    const failCount = testResults.filter(r => r.status === 'fail').length;
    const warningCount = testResults.filter(r => r.status === 'warning').length;
    const errorCount = testResults.filter(r => r.status === 'error').length;
    
    const totalTests = testResults.length;
    const passRate = passCount / totalTests;
    
    if (passRate >= 0.9 && failCount === 0) return 'compliant';
    if (passRate >= 0.7 && failCount <= 1) return 'partially-compliant';
    if (errorCount > totalTests * 0.5) return 'not-assessed';
    return 'non-compliant';
  }

  /**
   * Calculate control score based on test results
   */
  private calculateControlScore(testResults: AutomatedTestResult[]): number {
    if (testResults.length === 0) return 0;
    
    const totalScore = testResults.reduce((sum, result) => sum + result.score, 0);
    return Math.round(totalScore / testResults.length);
  }

  /**
   * Calculate overall assessment results
   */
  private calculateAssessmentResults(assessment: ComplianceAssessment): void {
    const results = assessment.controlResults;
    
    assessment.compliantControls = results.filter(r => r.status === 'compliant').length;
    assessment.nonCompliantControls = results.filter(r => r.status === 'non-compliant').length;
    assessment.partiallyCompliantControls = results.filter(r => r.status === 'partially-compliant').length;
    assessment.notAssessedControls = assessment.totalControls - results.length;
    
    // Calculate overall score
    const totalScore = results.reduce((sum, result) => sum + result.score, 0);
    assessment.complianceScore = results.length > 0 ? Math.round(totalScore / results.length) : 0;
    
    // Determine overall status
    if (assessment.complianceScore >= 90) {
      assessment.overallStatus = 'compliant';
    } else if (assessment.complianceScore >= 70) {
      assessment.overallStatus = 'partially-compliant';
    } else {
      assessment.overallStatus = 'non-compliant';
    }
  }

  /**
   * Generate findings based on assessment results
   */
  private async generateFindings(assessment: ComplianceAssessment, controls: ComplianceControl[]): Promise<void> {
    for (const result of assessment.controlResults) {
      if (result.status === 'non-compliant' || result.status === 'partially-compliant') {
        const control = controls.find(c => c.id === result.controlId);
        if (!control) continue;
        
        const finding: ComplianceFinding = {
          id: uuidv4(),
          controlId: result.controlId,
          title: `${control.framework.toUpperCase()} Control ${control.controlId} Non-Compliance`,
          description: `Control "${control.title}" is not fully compliant. Score: ${result.score}%`,
          severity: this.determineFindingSeverity(result.score, control.priority),
          category: 'non-compliance',
          type: this.determineIssueType(control.category),
          riskImpact: `Risk level: ${control.riskLevel}`,
          businessImpact: control.businessImpact,
          regulatoryImpact: control.regulatoryImpact,
          evidence: result.evidence,
          status: 'open',
          recommendedActions: this.generateRecommendedActions(control, result),
          discoveryDate: new Date(),
          lastUpdated: new Date()
        };
        
        this.findings.set(finding.id, finding);
        assessment.findings.push(finding);
      }
    }
  }

  /**
   * Determine finding severity based on score and priority
   */
  private determineFindingSeverity(score: number, priority: string): 'low' | 'medium' | 'high' | 'critical' {
    if (priority === 'critical' && score < 50) return 'critical';
    if (priority === 'high' && score < 30) return 'critical';
    if (score < 30) return 'high';
    if (score < 50) return 'medium';
    return 'low';
  }

  /**
   * Determine issue type based on control category
   */
  private determineIssueType(category: string): 'technical' | 'procedural' | 'policy' | 'documentation' | 'training' {
    const techCategories = ['network security', 'encryption', 'access control', 'system security'];
    const procCategories = ['incident response', 'business continuity', 'risk management'];
    const policyCategories = ['governance', 'policy', 'legal'];
    
    if (techCategories.some(cat => category.toLowerCase().includes(cat))) return 'technical';
    if (procCategories.some(cat => category.toLowerCase().includes(cat))) return 'procedural';
    if (policyCategories.some(cat => category.toLowerCase().includes(cat))) return 'policy';
    if (category.toLowerCase().includes('training')) return 'training';
    return 'documentation';
  }

  /**
   * Generate recommended actions for a control
   */
  private generateRecommendedActions(control: ComplianceControl, result: ControlAssessmentResult): string[] {
    const actions: string[] = [];
    
    // Add generic recommendations based on control status
    if (result.score < 30) {
      actions.push('Immediate remediation required');
      actions.push('Conduct thorough review of control implementation');
    }
    
    if (result.score < 70) {
      actions.push('Improve control implementation');
      actions.push('Provide additional training to responsible personnel');
    }
    
    // Add specific recommendations based on control category
    switch (control.category.toLowerCase()) {
      case 'access control':
        actions.push('Review user access rights and permissions');
        actions.push('Implement or improve multi-factor authentication');
        break;
      case 'data protection':
        actions.push('Verify encryption implementation');
        actions.push('Review data handling procedures');
        break;
      case 'network security':
        actions.push('Review firewall rules and network segmentation');
        actions.push('Update intrusion detection systems');
        break;
    }
    
    // Add framework-specific recommendations
    actions.push(`Ensure compliance with ${control.framework.toUpperCase()} requirements`);
    
    return actions;
  }

  /**
   * Generate recommendations based on assessment
   */
  private async generateRecommendations(assessment: ComplianceAssessment): Promise<void> {
    // Generate strategic recommendations based on overall score
    if (assessment.complianceScore < 70) {
      const recommendation: ComplianceRecommendation = {
        id: uuidv4(),
        title: 'Comprehensive Compliance Improvement Program',
        description: 'Implement a structured program to address compliance gaps and improve overall security posture',
        priority: 'high',
        category: 'corrective',
        type: 'organizational',
        effort: 'high',
        estimatedBenefit: 'Significant improvement in compliance score and risk reduction',
        implementationSteps: [
          'Conduct detailed gap analysis',
          'Develop remediation roadmap',
          'Allocate resources and assign responsibilities',
          'Implement priority controls',
          'Monitor progress and adjust plans'
        ],
        affectedControls: assessment.controlResults.map(r => r.controlId),
        expectedImprovement: 'Increase compliance score by 20-30%',
        riskReduction: 'Significant reduction in regulatory and operational risks',
        status: 'proposed',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      this.recommendations.set(recommendation.id, recommendation);
      assessment.recommendations.push(recommendation);
    }
    
    // Generate specific recommendations for failed controls
    const failedControls = assessment.controlResults.filter(r => r.status === 'non-compliant');
    if (failedControls.length > 0) {
      const recommendation: ComplianceRecommendation = {
        id: uuidv4(),
        title: 'Critical Control Remediation',
        description: 'Address non-compliant controls that pose highest risk to the organization',
        priority: 'critical',
        category: 'corrective',
        type: 'technical',
        effort: 'medium',
        estimatedBenefit: 'Immediate compliance improvement and risk reduction',
        implementationSteps: [
          'Prioritize controls by risk and regulatory impact',
          'Develop technical implementation plans',
          'Execute remediation activities',
          'Validate control effectiveness',
          'Update documentation and procedures'
        ],
        affectedControls: failedControls.map(r => r.controlId),
        expectedImprovement: 'Address immediate compliance gaps',
        riskReduction: 'Eliminate high-risk compliance violations',
        status: 'proposed',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      this.recommendations.set(recommendation.id, recommendation);
      assessment.recommendations.push(recommendation);
    }
  }

  /**
   * Update a compliance control
   */
  async updateControl(controlId: string, updates: UpdateControlRequest, userId: string): Promise<ComplianceControl> {
    try {
      const control = this.controls.get(controlId);
      if (!control) {
        throw new ComplianceError('CONTROL_NOT_FOUND', 'Control not found', { controlId });
      }

      const previousValue = { ...control };

      // Apply updates
      if (updates.status !== undefined) control.status = updates.status;
      if (updates.implementationStatus !== undefined) control.implementationStatus = updates.implementationStatus;
      if (updates.implementationNotes !== undefined) control.implementationNotes = updates.implementationNotes;
      if (updates.evidence !== undefined) control.implementationEvidence = updates.evidence;
      if (updates.owner !== undefined) control.owner = updates.owner;
      if (updates.reviewer !== undefined) control.reviewer = updates.reviewer;
      if (updates.customFields !== undefined) {
        control.customFields = { ...control.customFields, ...updates.customFields };
      }

      control.updatedAt = new Date();
      this.controls.set(controlId, control);

      // Log event
      await this.logEvent('control_updated', `Control ${control.controlId} updated`, {
        controlId,
        framework: control.framework,
        userId,
        previousValue,
        newValue: updates
      });

      logger.info(`Updated control: ${controlId}`);
      return control;
    } catch (error) {
      logger.error('Error updating control:', error);
      throw new ComplianceError('CONTROL_UPDATE_ERROR', 'Failed to update control', { controlId, error });
    }
  }

  /**
   * Create a remediation plan
   */
  async createRemediationPlan(request: CreateRemediationPlanRequest, userId: string): Promise<RemediationPlan> {
    try {
      const control = this.controls.get(request.controlId);
      if (!control) {
        throw new ComplianceError('CONTROL_NOT_FOUND', 'Control not found', { controlId: request.controlId });
      }

      const plan: RemediationPlan = {
        id: uuidv4(),
        controlId: request.controlId,
        title: request.title,
        description: request.description,
        priority: request.priority,
        effort: 'medium', // Default value
        status: 'pending',
        assignedTo: request.assignedTo,
        dueDate: request.dueDate ? new Date(request.dueDate) : undefined,
        tasks: request.tasks.map(task => ({
          ...task,
          id: uuidv4()
        })),
        progressPercentage: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      this.remediationPlans.set(plan.id, plan);

      // Update control with remediation plan
      control.remediationPlan = plan;
      this.controls.set(control.id, control);

      // Log event
      await this.logEvent('remediation_plan_created', `Remediation plan created for control ${control.controlId}`, {
        planId: plan.id,
        controlId: request.controlId,
        framework: control.framework,
        userId
      });

      logger.info(`Created remediation plan: ${plan.id} for control: ${request.controlId}`);
      return plan;
    } catch (error) {
      logger.error('Error creating remediation plan:', error);
      throw new ComplianceError('REMEDIATION_PLAN_ERROR', 'Failed to create remediation plan', { error });
    }
  }

  /**
   * Get compliance dashboard data
   */
  async getComplianceDashboard(organizationId: string): Promise<ComplianceDashboard> {
    try {
      const allControls = Array.from(this.controls.values());
      const allAssessments = Array.from(this.assessments.values());
      
      // Calculate framework status
      const frameworkStatus = new Map<ComplianceFramework, FrameworkStatus>();
      const frameworks: ComplianceFramework[] = ['gdpr', 'hipaa', 'soc2', 'pci-dss', 'iso27001', 'nist', 'owasp'];
      
      for (const framework of frameworks) {
        const frameworkControls = allControls.filter(c => c.framework === framework);
        const compliantCount = frameworkControls.filter(c => c.status === 'compliant').length;
        
        const recentAssessment = allAssessments
          .filter(a => a.framework === framework && a.status === 'completed')
          .sort((a, b) => (b.endDate?.getTime() || 0) - (a.endDate?.getTime() || 0))[0];
        
        frameworkStatus.set(framework, {
          framework,
          status: this.calculateFrameworkStatus(frameworkControls),
          score: this.calculateFrameworkScore(frameworkControls),
          totalControls: frameworkControls.length,
          compliantControls: compliantCount,
          lastAssessment: recentAssessment?.endDate,
          nextAssessment: this.calculateNextAssessmentDate(framework),
          certificationStatus: 'not-certified' // Would be determined by actual certification data
        });
      }
      
      // Calculate overall metrics
      const overallScore = this.calculateOverallComplianceScore(allControls);
      const totalFrameworks = frameworks.length;
      const compliantFrameworks = Array.from(frameworkStatus.values())
        .filter(f => f.status === 'compliant').length;
      
      // Calculate active findings
      const activeFindings = Array.from(this.findings.values()).filter(f => f.status === 'open');
      const criticalFindings = activeFindings.filter(f => f.severity === 'critical').length;
      const highFindings = activeFindings.filter(f => f.severity === 'high').length;
      const mediumFindings = activeFindings.filter(f => f.severity === 'medium').length;
      const lowFindings = activeFindings.filter(f => f.severity === 'low').length;
      
      // Generate trend data (mock data for demonstration)
      const trends: ComplianceTrend[] = frameworks.map(framework => ({
        framework,
        period: '2024-Q1',
        score: frameworkStatus.get(framework)?.score || 0,
        change: Math.random() * 10 - 5, // Random change for demo
        assessmentCount: allAssessments.filter(a => a.framework === framework).length
      }));
      
      const dashboard: ComplianceDashboard = {
        organizationId,
        generatedAt: new Date(),
        overallScore,
        totalFrameworks,
        compliantFrameworks,
        frameworkStatus,
        trends,
        criticalFindings,
        highFindings,
        mediumFindings,
        lowFindings,
        upcomingAssessments: this.getUpcomingAssessments(),
        expiringCertifications: this.getExpiringCertifications(),
        riskScore: this.calculateRiskScore(activeFindings),
        riskTrend: 'stable',
        averageRemediationTime: this.calculateAverageRemediationTime(),
        controlsImplemented: allControls.filter(c => c.implementationStatus === 'implemented').length,
        controlsPending: allControls.filter(c => c.implementationStatus === 'in-progress').length
      };
      
      return dashboard;
    } catch (error) {
      logger.error('Error generating compliance dashboard:', error);
      throw new ComplianceError('DASHBOARD_ERROR', 'Failed to generate compliance dashboard', { error });
    }
  }

  /**
   * Search compliance controls
   */
  async searchControls(query: ComplianceSearchQuery): Promise<{ controls: ComplianceControl[]; total: number }> {
    try {
      let controls = Array.from(this.controls.values());
      
      // Apply filters
      if (query.frameworks && query.frameworks.length > 0) {
        controls = controls.filter(c => query.frameworks!.includes(c.framework));
      }
      
      if (query.status && query.status.length > 0) {
        controls = controls.filter(c => query.status!.includes(c.status));
      }
      
      if (query.priority && query.priority.length > 0) {
        controls = controls.filter(c => query.priority!.includes(c.priority));
      }
      
      if (query.categories && query.categories.length > 0) {
        controls = controls.filter(c => query.categories!.includes(c.category));
      }
      
      if (query.owner) {
        controls = controls.filter(c => c.owner === query.owner);
      }
      
      if (query.searchTerm) {
        const term = query.searchTerm.toLowerCase();
        controls = controls.filter(c => 
          c.title.toLowerCase().includes(term) ||
          c.description.toLowerCase().includes(term) ||
          c.controlId.toLowerCase().includes(term)
        );
      }
      
      const total = controls.length;
      
      // Apply sorting
      if (query.sortBy) {
        controls.sort((a, b) => {
          let aValue: any, bValue: any;
          
          switch (query.sortBy) {
            case 'priority':
              const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
              aValue = priorityOrder[a.priority as keyof typeof priorityOrder];
              bValue = priorityOrder[b.priority as keyof typeof priorityOrder];
              break;
            case 'lastAssessed':
              aValue = a.lastAssessed?.getTime() || 0;
              bValue = b.lastAssessed?.getTime() || 0;
              break;
            case 'title':
              aValue = a.title;
              bValue = b.title;
              break;
            default:
              aValue = a.updatedAt.getTime();
              bValue = b.updatedAt.getTime();
          }
          
          if (query.sortOrder === 'desc') {
            return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
          } else {
            return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
          }
        });
      }
      
      // Apply pagination
      if (query.limit && query.offset !== undefined) {
        controls = controls.slice(query.offset, query.offset + query.limit);
      }
      
      return { controls, total };
    } catch (error) {
      logger.error('Error searching controls:', error);
      throw new ComplianceError('SEARCH_ERROR', 'Failed to search controls', { error });
    }
  }

  /**
   * Log compliance events for audit trail
   */
  private async logEvent(type: ComplianceEventType, description: string, metadata: any): Promise<void> {
    const event: ComplianceEvent = {
      id: uuidv4(),
      type,
      description,
      framework: metadata.framework,
      controlId: metadata.controlId,
      assessmentId: metadata.assessmentId,
      findingId: metadata.findingId,
      userId: metadata.userId,
      userEmail: metadata.userEmail || 'system@threat-modeling.com',
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      previousValue: metadata.previousValue,
      newValue: metadata.newValue,
      metadata: metadata,
      timestamp: new Date(),
      correlationId: metadata.correlationId
    };
    
    this.events.push(event);
    logger.info(`Compliance event logged: ${type} - ${description}`);
  }

  // Private helper methods for calculations and framework initialization
  
  private calculateFrameworkStatus(controls: ComplianceControl[]): ComplianceStatus {
    if (controls.length === 0) return 'not-assessed';
    
    const compliantCount = controls.filter(c => c.status === 'compliant').length;
    const complianceRate = compliantCount / controls.length;
    
    if (complianceRate >= 0.9) return 'compliant';
    if (complianceRate >= 0.7) return 'partially-compliant';
    return 'non-compliant';
  }
  
  private calculateFrameworkScore(controls: ComplianceControl[]): number {
    if (controls.length === 0) return 0;
    
    const scores = controls.map(c => {
      switch (c.status) {
        case 'compliant': return 100;
        case 'partially-compliant': return 70;
        case 'non-compliant': return 30;
        default: return 0;
      }
    });
    
    return Math.round(scores.reduce((sum: number, score: number) => sum + score, 0) / scores.length);
  }
  
  private calculateOverallComplianceScore(controls: ComplianceControl[]): number {
    return this.calculateFrameworkScore(controls);
  }
  
  private calculateNextAssessmentDate(framework: ComplianceFramework): Date {
    // Mock calculation - in reality this would be based on compliance requirements
    const now = new Date();
    const months = framework === 'pci-dss' ? 3 : 12; // PCI-DSS requires quarterly assessments
    return new Date(now.setMonth(now.getMonth() + months));
  }
  
  private getUpcomingAssessments(): UpcomingAssessment[] {
    return Array.from(this.assessments.values())
      .filter(a => a.status === 'planned' && a.scheduledDate)
      .map(a => ({
        id: a.id,
        framework: a.framework,
        type: 'automated' as const,
        scheduledDate: a.scheduledDate!,
        daysUntilDue: Math.ceil((a.scheduledDate!.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
        priority: 'medium' as const,
        status: 'scheduled' as const
      }));
  }
  
  private getExpiringCertifications(): ExpiringCertification[] {
    // Mock data - in reality this would come from a certification tracking system
    return [];
  }
  
  private calculateRiskScore(findings: ComplianceFinding[]): number {
    if (findings.length === 0) return 0;
    
    const severityScores = { critical: 100, high: 75, medium: 50, low: 25 };
    const totalScore = findings.reduce((sum, finding) => 
      sum + severityScores[finding.severity], 0);
    
    return Math.min(100, Math.round(totalScore / findings.length));
  }
  
  private calculateAverageRemediationTime(): number {
    const completedPlans = Array.from(this.remediationPlans.values())
      .filter(p => p.status === 'completed' && p.startDate && p.completionDate);
    
    if (completedPlans.length === 0) return 0;
    
    const totalDays = completedPlans.reduce((sum, plan) => {
      const days = Math.ceil((plan.completionDate!.getTime() - plan.startDate!.getTime()) / (1000 * 60 * 60 * 24));
      return sum + days;
    }, 0);
    
    return Math.round(totalDays / completedPlans.length);
  }

  // Framework-specific control initialization methods
  
  private addGDPRControls(): void {
    const gdprControls: Partial<ComplianceControl>[] = [
      {
        controlId: 'GDPR-7.1',
        title: 'Data Processing Lawfulness',
        description: 'Ensure all personal data processing has a valid legal basis',
        category: 'Data Protection',
        requirements: ['Identify legal basis for processing', 'Document processing purposes', 'Maintain processing records'],
        implementationGuidance: 'Establish clear legal basis for each data processing activity and maintain comprehensive records',
        evidenceRequirements: ['Processing register', 'Legal basis documentation', 'Privacy policies'],
        testProcedures: ['Review processing register', 'Validate legal basis documentation', 'Test data subject consent mechanisms'],
        riskLevel: 'high',
        businessImpact: 'Legal compliance, customer trust',
        technicalImpact: 'Data processing systems',
        regulatoryImpact: 'GDPR Article 6 compliance'
      },
      {
        controlId: 'GDPR-7.2',
        title: 'Data Subject Rights',
        description: 'Implement mechanisms to handle data subject rights requests',
        category: 'Data Protection',
        requirements: ['Rights request handling', 'Response timeframes', 'Identity verification'],
        implementationGuidance: 'Establish processes for handling data subject rights including access, rectification, erasure, and portability',
        evidenceRequirements: ['Rights request procedures', 'Response templates', 'Request logs'],
        testProcedures: ['Test rights request process', 'Verify response timeframes', 'Validate identity verification'],
        riskLevel: 'high',
        businessImpact: 'Customer satisfaction, legal compliance',
        technicalImpact: 'Data retrieval and deletion systems',
        regulatoryImpact: 'GDPR Articles 15-22 compliance'
      }
    ];

    this.addControlsForFramework('gdpr', gdprControls);
  }
  
  private addHIPAAControls(): void {
    const hipaaControls: Partial<ComplianceControl>[] = [
      {
        controlId: 'HIPAA-164.308',
        title: 'Administrative Safeguards',
        description: 'Implement administrative safeguards for PHI protection',
        category: 'Administrative',
        requirements: ['Security officer assignment', 'Workforce training', 'Access management procedures'],
        implementationGuidance: 'Establish comprehensive administrative controls for PHI handling',
        evidenceRequirements: ['Security policies', 'Training records', 'Access control procedures'],
        testProcedures: ['Review policies', 'Verify training completion', 'Test access controls'],
        riskLevel: 'high',
        businessImpact: 'Healthcare operations, patient trust',
        technicalImpact: 'PHI handling systems',
        regulatoryImpact: 'HIPAA Security Rule compliance'
      },
      {
        controlId: 'HIPAA-164.312',
        title: 'Technical Safeguards',
        description: 'Implement technical safeguards for PHI protection',
        category: 'Technical',
        requirements: ['Access control', 'Audit controls', 'Integrity controls', 'Transmission security'],
        implementationGuidance: 'Deploy technical controls to protect PHI in electronic systems',
        evidenceRequirements: ['Access control configurations', 'Audit logs', 'Encryption evidence'],
        testProcedures: ['Test access controls', 'Review audit logs', 'Verify encryption'],
        riskLevel: 'critical',
        businessImpact: 'Patient data protection, regulatory compliance',
        technicalImpact: 'Electronic PHI systems',
        regulatoryImpact: 'HIPAA Security Rule technical requirements'
      }
    ];

    this.addControlsForFramework('hipaa', hipaaControls);
  }
  
  private addSOC2Controls(): void {
    const soc2Controls: Partial<ComplianceControl>[] = [
      {
        controlId: 'SOC2-CC6.1',
        title: 'Logical and Physical Access Controls',
        description: 'Implement controls to restrict access to system resources',
        category: 'Access Control',
        requirements: ['Access provisioning', 'Access review', 'Access termination'],
        implementationGuidance: 'Establish comprehensive access control framework covering logical and physical access',
        evidenceRequirements: ['Access control matrix', 'Access review reports', 'Termination procedures'],
        testProcedures: ['Test access provisioning', 'Review access reports', 'Verify termination process'],
        riskLevel: 'high',
        businessImpact: 'Data security, operational integrity',
        technicalImpact: 'System access controls',
        regulatoryImpact: 'SOC 2 Trust Services Criteria'
      },
      {
        controlId: 'SOC2-CC7.1',
        title: 'System Monitoring',
        description: 'Implement monitoring to detect security events',
        category: 'Monitoring',
        requirements: ['Security monitoring', 'Incident detection', 'Response procedures'],
        implementationGuidance: 'Deploy comprehensive monitoring and alerting systems for security events',
        evidenceRequirements: ['Monitoring configurations', 'Alert logs', 'Incident reports'],
        testProcedures: ['Test monitoring systems', 'Verify alerting', 'Review incident response'],
        riskLevel: 'medium',
        businessImpact: 'Security posture, incident response',
        technicalImpact: 'Monitoring and alerting systems',
        regulatoryImpact: 'SOC 2 monitoring requirements'
      }
    ];

    this.addControlsForFramework('soc2', soc2Controls);
  }
  
  private addPCIDSSControls(): void {
    const pciControls: Partial<ComplianceControl>[] = [
      {
        controlId: 'PCI-3.4',
        title: 'Cardholder Data Protection',
        description: 'Protect stored cardholder data through strong encryption',
        category: 'Data Protection',
        requirements: ['Encryption of stored data', 'Key management', 'Secure key storage'],
        implementationGuidance: 'Implement strong encryption for all stored cardholder data',
        evidenceRequirements: ['Encryption configurations', 'Key management procedures', 'Security assessments'],
        testProcedures: ['Test encryption implementation', 'Review key management', 'Verify secure storage'],
        riskLevel: 'critical',
        businessImpact: 'Payment processing, customer trust',
        technicalImpact: 'Payment systems, data storage',
        regulatoryImpact: 'PCI DSS Requirement 3'
      },
      {
        controlId: 'PCI-11.2',
        title: 'Vulnerability Scanning',
        description: 'Perform quarterly vulnerability scans',
        category: 'Vulnerability Management',
        requirements: ['Quarterly scans', 'Remediation tracking', 'ASV scanning'],
        implementationGuidance: 'Conduct regular vulnerability scans and remediate identified issues',
        evidenceRequirements: ['Scan reports', 'Remediation evidence', 'ASV certification'],
        testProcedures: ['Review scan reports', 'Verify remediation', 'Validate scan scope'],
        riskLevel: 'high',
        businessImpact: 'Security posture, compliance status',
        technicalImpact: 'Network infrastructure, applications',
        regulatoryImpact: 'PCI DSS Requirement 11'
      }
    ];

    this.addControlsForFramework('pci-dss', pciControls);
  }
  
  private addISO27001Controls(): void {
    const iso27001Controls: Partial<ComplianceControl>[] = [
      {
        controlId: 'ISO-A.9.1.1',
        title: 'Access Control Policy',
        description: 'Establish and maintain an access control policy',
        category: 'Access Control',
        requirements: ['Policy development', 'Policy approval', 'Policy review'],
        implementationGuidance: 'Develop comprehensive access control policy aligned with business requirements',
        evidenceRequirements: ['Access control policy', 'Approval records', 'Review documentation'],
        testProcedures: ['Review policy content', 'Verify approval process', 'Check review schedule'],
        riskLevel: 'medium',
        businessImpact: 'Information security governance',
        technicalImpact: 'Access control systems',
        regulatoryImpact: 'ISO 27001 Annex A.9.1.1'
      }
    ];

    this.addControlsForFramework('iso27001', iso27001Controls);
  }
  
  private addNISTControls(): void {
    const nistControls: Partial<ComplianceControl>[] = [
      {
        controlId: 'NIST-AC-2',
        title: 'Account Management',
        description: 'Manage information system accounts',
        category: 'Access Control',
        requirements: ['Account provisioning', 'Account monitoring', 'Account termination'],
        implementationGuidance: 'Implement comprehensive account management procedures',
        evidenceRequirements: ['Account management procedures', 'Account listings', 'Review reports'],
        testProcedures: ['Test account provisioning', 'Review account status', 'Verify termination'],
        riskLevel: 'high',
        businessImpact: 'System security, access management',
        technicalImpact: 'Identity management systems',
        regulatoryImpact: 'NIST SP 800-53 AC-2'
      }
    ];

    this.addControlsForFramework('nist', nistControls);
  }
  
  private addOWASPControls(): void {
    const owaspControls: Partial<ComplianceControl>[] = [
      {
        controlId: 'OWASP-A01',
        title: 'Broken Access Control',
        description: 'Prevent broken access control vulnerabilities',
        category: 'Application Security',
        requirements: ['Access control implementation', 'Authorization testing', 'Privilege management'],
        implementationGuidance: 'Implement robust access control mechanisms in applications',
        evidenceRequirements: ['Access control designs', 'Test results', 'Code reviews'],
        testProcedures: ['Test access controls', 'Review authorization logic', 'Verify privilege separation'],
        riskLevel: 'high',
        businessImpact: 'Application security, data protection',
        technicalImpact: 'Web applications, APIs',
        regulatoryImpact: 'OWASP Top 10 A01'
      }
    ];

    this.addControlsForFramework('owasp', owaspControls);
  }
  
  private addControlsForFramework(framework: ComplianceFramework, controls: Partial<ComplianceControl>[]): void {
    for (const controlData of controls) {
      const control: ComplianceControl = {
        id: uuidv4(),
        framework,
        controlId: controlData.controlId!,
        title: controlData.title!,
        description: controlData.description!,
        category: controlData.category!,
        requirements: controlData.requirements!,
        implementationGuidance: controlData.implementationGuidance!,
        evidenceRequirements: controlData.evidenceRequirements!,
        testProcedures: controlData.testProcedures!,
        status: 'not-assessed',
        priority: 'medium',
        assessmentType: 'automated',
        riskLevel: controlData.riskLevel!,
        businessImpact: controlData.businessImpact!,
        technicalImpact: controlData.technicalImpact!,
        regulatoryImpact: controlData.regulatoryImpact!,
        implementationStatus: 'not-started',
        createdAt: new Date(),
        updatedAt: new Date(),
        version: '1.0'
      };
      
      this.controls.set(control.id, control);
    }
  }

  // Getter methods for retrieving data
  
  async getControl(controlId: string): Promise<ComplianceControl | null> {
    return this.controls.get(controlId) || null;
  }
  
  async getAssessment(assessmentId: string): Promise<ComplianceAssessment | null> {
    return this.assessments.get(assessmentId) || null;
  }
  
  async getRemediationPlan(planId: string): Promise<RemediationPlan | null> {
    return this.remediationPlans.get(planId) || null;
  }
  
  async getAllControls(): Promise<ComplianceControl[]> {
    return Array.from(this.controls.values());
  }
  
  async getAllAssessments(): Promise<ComplianceAssessment[]> {
    return Array.from(this.assessments.values());
  }
  
  async getControlsByFramework(framework: ComplianceFramework): Promise<ComplianceControl[]> {
    return Array.from(this.controls.values()).filter(control => control.framework === framework);
  }
  
  async getEvents(limit = 100): Promise<ComplianceEvent[]> {
    return this.events.slice(-limit);
  }
}

// Custom error class for compliance operations
class ComplianceError extends Error {
  public code: string;
  public details?: any;

  constructor(code: string, message: string, details?: any) {
    super(message);
    this.name = 'ComplianceError';
    this.code = code;
    this.details = details;
  }
}