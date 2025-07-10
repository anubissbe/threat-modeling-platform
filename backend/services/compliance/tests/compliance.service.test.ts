import { ComplianceService } from '../src/services/compliance.service';
import { 
  CreateAssessmentRequest, 
  UpdateControlRequest, 
  CreateRemediationPlanRequest,
  ComplianceFramework 
} from '../src/types/compliance';

describe('ComplianceService', () => {
  let complianceService: ComplianceService;

  beforeEach(() => {
    complianceService = new ComplianceService();
  });

  describe('Initialization', () => {
    it('should initialize with framework controls', async () => {
      const allControls = await complianceService.getAllControls();
      expect(allControls.length).toBeGreaterThan(0);
      
      // Check if GDPR controls are loaded
      const gdprControls = await complianceService.getControlsByFramework('gdpr');
      expect(gdprControls.length).toBeGreaterThan(0);
      
      // Check if HIPAA controls are loaded
      const hipaaControls = await complianceService.getControlsByFramework('hipaa');
      expect(hipaaControls.length).toBeGreaterThan(0);
    });

    it('should have controls for all major frameworks', async () => {
      const frameworks: ComplianceFramework[] = ['gdpr', 'hipaa', 'soc2', 'pci-dss', 'iso27001', 'nist', 'owasp'];
      
      for (const framework of frameworks) {
        const controls = await complianceService.getControlsByFramework(framework);
        expect(controls.length).toBeGreaterThan(0);
        if (controls.length > 0) {
          expect(controls[0].framework).toBe(framework);
        }
      }
    });
  });

  describe('Assessment Management', () => {
    it('should create a new assessment', async () => {
      const request: CreateAssessmentRequest = {
        name: 'Test GDPR Assessment',
        description: 'Testing GDPR compliance assessment',
        framework: 'gdpr',
        scope: {
          frameworks: ['gdpr'],
          includeAutomated: true,
          includeManual: false,
          includeExternalAudit: false
        },
        configuration: {
          automatedTestsEnabled: true,
          evidenceCollectionEnabled: false,
          reportGeneration: true,
          notificationsEnabled: false,
          recurringAssessment: false,
          requireEvidence: false,
          requireReview: false,
          requireApproval: false
        }
      };

      const assessment = await complianceService.createAssessment(request, 'test-user');
      
      expect(assessment).toBeDefined();
      expect(assessment.name).toBe(request.name);
      expect(assessment.framework).toBe(request.framework);
      expect(assessment.status).toBe('planned');
      expect(assessment.totalControls).toBeGreaterThan(0);
    });

    it('should execute an assessment', async () => {
      // First create an assessment
      const request: CreateAssessmentRequest = {
        name: 'Test Execution Assessment',
        framework: 'gdpr',
        scope: {
          frameworks: ['gdpr'],
          includeAutomated: true,
          includeManual: false,
          includeExternalAudit: false
        },
        configuration: {
          automatedTestsEnabled: true,
          evidenceCollectionEnabled: false,
          reportGeneration: true,
          notificationsEnabled: false,
          recurringAssessment: false,
          requireEvidence: false,
          requireReview: false,
          requireApproval: false
        }
      };

      const assessment = await complianceService.createAssessment(request, 'test-user');
      
      // Execute the assessment
      const executedAssessment = await complianceService.executeAssessment(assessment.id, 'test-user');
      
      expect(executedAssessment.status).toBe('completed');
      expect(executedAssessment.complianceScore).toBeGreaterThanOrEqual(0);
      expect(executedAssessment.complianceScore).toBeLessThanOrEqual(100);
      expect(executedAssessment.controlResults.length).toBeGreaterThan(0);
    }, 10000); // Increase timeout for assessment execution

    it('should get all assessments', async () => {
      const assessments = await complianceService.getAllAssessments();
      expect(Array.isArray(assessments)).toBe(true);
    });
  });

  describe('Control Management', () => {
    it('should get a specific control', async () => {
      const allControls = await complianceService.getAllControls();
      expect(allControls.length).toBeGreaterThan(0);
      
      const firstControl = allControls[0];
      if (firstControl) {
        const retrievedControl = await complianceService.getControl(firstControl.id);
        
        expect(retrievedControl).toBeDefined();
        expect(retrievedControl!.id).toBe(firstControl.id);
      }
    });

    it('should update a control', async () => {
      const allControls = await complianceService.getAllControls();
      const control = allControls[0];
      
      if (control) {
        const updates: UpdateControlRequest = {
          status: 'compliant',
          implementationStatus: 'implemented',
          implementationNotes: 'Test implementation notes',
          owner: 'test-owner'
        };

        const updatedControl = await complianceService.updateControl(control.id, updates, 'test-user');
        
        expect(updatedControl.status).toBe('compliant');
        expect(updatedControl.implementationStatus).toBe('implemented');
        expect(updatedControl.implementationNotes).toBe('Test implementation notes');
        expect(updatedControl.owner).toBe('test-owner');
      }
    });

    it('should search controls', async () => {
      const result = await complianceService.searchControls({
        frameworks: ['gdpr'],
        status: ['compliant', 'non-compliant'],
        limit: 10,
        offset: 0
      });
      
      expect(result.controls).toBeDefined();
      expect(Array.isArray(result.controls)).toBe(true);
      expect(result.total).toBeGreaterThanOrEqual(0);
      expect(result.controls.length).toBeLessThanOrEqual(10);
    });
  });

  describe('Remediation Plan Management', () => {
    it('should create a remediation plan', async () => {
      const allControls = await complianceService.getAllControls();
      const control = allControls[0];
      
      if (control) {
        const request: CreateRemediationPlanRequest = {
          controlId: control.id,
          title: 'Test Remediation Plan',
          description: 'Testing remediation plan creation',
          priority: 'high',
          assignedTo: 'test-assignee',
          tasks: [
            {
              title: 'Task 1',
              description: 'First remediation task',
              priority: 'high',
              status: 'pending'
            },
            {
              title: 'Task 2',
              description: 'Second remediation task',
              priority: 'medium',
              status: 'pending'
            }
          ]
        };

        const plan = await complianceService.createRemediationPlan(request, 'test-user');
        
        expect(plan).toBeDefined();
        expect(plan.controlId).toBe(control.id);
        expect(plan.title).toBe(request.title);
        expect(plan.tasks.length).toBe(2);
        expect(plan.status).toBe('pending');
      }
    });

    it('should get a remediation plan', async () => {
      // First create a plan
      const allControls = await complianceService.getAllControls();
      const control = allControls[0];
      
      if (control) {
        const request: CreateRemediationPlanRequest = {
          controlId: control.id,
          title: 'Test Plan for Retrieval',
          description: 'Testing plan retrieval',
          priority: 'medium',
          tasks: []
        };

        const createdPlan = await complianceService.createRemediationPlan(request, 'test-user');
        
        // Now retrieve it
        const retrievedPlan = await complianceService.getRemediationPlan(createdPlan.id);
        
        expect(retrievedPlan).toBeDefined();
        expect(retrievedPlan!.id).toBe(createdPlan.id);
        expect(retrievedPlan!.title).toBe(request.title);
      }
    });
  });

  describe('Dashboard and Analytics', () => {
    it('should generate compliance dashboard', async () => {
      const dashboard = await complianceService.getComplianceDashboard('test-org');
      
      expect(dashboard).toBeDefined();
      expect(dashboard.organizationId).toBe('test-org');
      expect(dashboard.overallScore).toBeGreaterThanOrEqual(0);
      expect(dashboard.overallScore).toBeLessThanOrEqual(100);
      expect(dashboard.totalFrameworks).toBeGreaterThan(0);
      expect(dashboard.frameworkStatus.size).toBeGreaterThan(0);
    });

    it('should provide framework statistics', async () => {
      const dashboard = await complianceService.getComplianceDashboard('test-org');
      
      // Check GDPR framework status
      const gdprStatus = dashboard.frameworkStatus.get('gdpr');
      expect(gdprStatus).toBeDefined();
      expect(gdprStatus!.framework).toBe('gdpr');
      expect(gdprStatus!.totalControls).toBeGreaterThan(0);
    });
  });

  describe('Event Logging', () => {
    it('should log events during operations', async () => {
      const initialEventCount = (await complianceService.getEvents(100)).length;
      
      // Perform an operation that should generate events
      const request: CreateAssessmentRequest = {
        name: 'Event Test Assessment',
        framework: 'gdpr',
        scope: {
          frameworks: ['gdpr'],
          includeAutomated: true,
          includeManual: false,
          includeExternalAudit: false
        },
        configuration: {
          automatedTestsEnabled: true,
          evidenceCollectionEnabled: false,
          reportGeneration: true,
          notificationsEnabled: false,
          recurringAssessment: false,
          requireEvidence: false,
          requireReview: false,
          requireApproval: false
        }
      };

      await complianceService.createAssessment(request, 'test-user');
      
      const finalEventCount = (await complianceService.getEvents(100)).length;
      expect(finalEventCount).toBeGreaterThan(initialEventCount);
    });

    it('should retrieve event history', async () => {
      const events = await complianceService.getEvents(50);
      
      expect(Array.isArray(events)).toBe(true);
      expect(events.length).toBeLessThanOrEqual(50);
      
      if (events.length > 0) {
        const event = events[0];
        if (event) {
          expect(event.id).toBeDefined();
          expect(event.type).toBeDefined();
          expect(event.timestamp).toBeDefined();
          expect(event.userId).toBeDefined();
        }
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid control ID', async () => {
      const invalidControl = await complianceService.getControl('invalid-id');
      expect(invalidControl).toBeNull();
    });

    it('should handle invalid assessment ID', async () => {
      const invalidAssessment = await complianceService.getAssessment('invalid-id');
      expect(invalidAssessment).toBeNull();
    });

    it('should handle invalid remediation plan ID', async () => {
      const invalidPlan = await complianceService.getRemediationPlan('invalid-id');
      expect(invalidPlan).toBeNull();
    });

    it('should throw error for invalid control update', async () => {
      await expect(
        complianceService.updateControl('invalid-id', { status: 'compliant' }, 'test-user')
      ).rejects.toThrow();
    });

    it('should throw error for remediation plan with invalid control', async () => {
      const request: CreateRemediationPlanRequest = {
        controlId: 'invalid-control-id',
        title: 'Invalid Plan',
        description: 'This should fail',
        priority: 'low',
        tasks: []
      };

      await expect(
        complianceService.createRemediationPlan(request, 'test-user')
      ).rejects.toThrow();
    });
  });

  describe('Performance', () => {
    it('should handle large control searches efficiently', async () => {
      const startTime = Date.now();
      
      const result = await complianceService.searchControls({
        limit: 1000,
        offset: 0
      });
      
      const duration = Date.now() - startTime;
      
      expect(result.controls).toBeDefined();
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should generate dashboard efficiently', async () => {
      const startTime = Date.now();
      
      const dashboard = await complianceService.getComplianceDashboard('perf-test-org');
      
      const duration = Date.now() - startTime;
      
      expect(dashboard).toBeDefined();
      expect(duration).toBeLessThan(2000); // Should complete within 2 seconds
    });
  });

  describe('Data Consistency', () => {
    it('should maintain control count consistency', async () => {
      const allControls = await complianceService.getAllControls();
      
      let totalFrameworkControls = 0;
      const frameworks: ComplianceFramework[] = ['gdpr', 'hipaa', 'soc2', 'pci-dss', 'iso27001', 'nist', 'owasp'];
      
      for (const framework of frameworks) {
        const frameworkControls = await complianceService.getControlsByFramework(framework);
        totalFrameworkControls += frameworkControls.length;
      }
      
      expect(totalFrameworkControls).toBe(allControls.length);
    });

    it('should maintain assessment state consistency', async () => {
      const request: CreateAssessmentRequest = {
        name: 'Consistency Test Assessment',
        framework: 'gdpr',
        scope: {
          frameworks: ['gdpr'],
          includeAutomated: true,
          includeManual: false,
          includeExternalAudit: false
        },
        configuration: {
          automatedTestsEnabled: true,
          evidenceCollectionEnabled: false,
          reportGeneration: true,
          notificationsEnabled: false,
          recurringAssessment: false,
          requireEvidence: false,
          requireReview: false,
          requireApproval: false
        }
      };

      const assessment = await complianceService.createAssessment(request, 'test-user');
      
      // Check initial state
      expect(assessment.status).toBe('planned');
      expect(assessment.complianceScore).toBe(0);
      expect(assessment.notAssessedControls).toBe(assessment.totalControls);
      
      // Execute assessment
      const executedAssessment = await complianceService.executeAssessment(assessment.id, 'test-user');
      
      // Check final state consistency
      const totalAssessed = executedAssessment.compliantControls + 
                           executedAssessment.nonCompliantControls + 
                           executedAssessment.partiallyCompliantControls +
                           executedAssessment.notAssessedControls;
      
      expect(totalAssessed).toBe(executedAssessment.totalControls);
      expect(executedAssessment.status).toBe('completed');
    }, 10000);
  });
});