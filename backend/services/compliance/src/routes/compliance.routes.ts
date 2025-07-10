import { Router } from 'express';
import { ComplianceController } from '../controllers/compliance.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { rateLimitMiddleware } from '../middleware/rate-limit.middleware';
import {
  createAssessmentSchema,
  updateControlSchema,
  createRemediationPlanSchema,
  generateReportSchema
} from '../validators/compliance.validators';

const router = Router();
const complianceController = new ComplianceController();

// Apply authentication middleware to all routes
router.use(authMiddleware as any);

// Apply rate limiting
router.use(rateLimitMiddleware);

// Dashboard routes
router.get('/dashboard/:organizationId', complianceController.getDashboard.bind(complianceController));

// Control routes
router.get('/controls', complianceController.getControls.bind(complianceController));
router.get('/controls/:controlId', complianceController.getControl.bind(complianceController));
router.put('/controls/:controlId', 
  validateRequest(updateControlSchema), 
  complianceController.updateControl.bind(complianceController)
);
router.get('/frameworks/:framework/controls', complianceController.getControlsByFramework.bind(complianceController));

// Assessment routes
router.post('/assessments', 
  validateRequest(createAssessmentSchema), 
  complianceController.createAssessment.bind(complianceController)
);
router.get('/assessments', complianceController.getAssessments.bind(complianceController));
router.get('/assessments/:assessmentId', complianceController.getAssessment.bind(complianceController));
router.post('/assessments/:assessmentId/execute', complianceController.executeAssessment.bind(complianceController));

// Remediation plan routes
router.post('/remediation-plans', 
  validateRequest(createRemediationPlanSchema), 
  complianceController.createRemediationPlan.bind(complianceController)
);
router.get('/remediation-plans/:planId', complianceController.getRemediationPlan.bind(complianceController));

// Report routes
router.post('/reports', 
  validateRequest(generateReportSchema), 
  complianceController.generateReport.bind(complianceController)
);
router.get('/reports', complianceController.getReports.bind(complianceController));
router.get('/reports/:reportId', complianceController.getReport.bind(complianceController));
router.get('/reports/:reportId/download', complianceController.downloadReport.bind(complianceController));
router.delete('/reports/:reportId', complianceController.deleteReport.bind(complianceController));

// Framework and metadata routes
router.get('/frameworks', complianceController.getFrameworks.bind(complianceController));
router.get('/statistics', complianceController.getStatistics.bind(complianceController));
router.get('/events', complianceController.getEvents.bind(complianceController));

// Health check
router.get('/health', complianceController.getHealth.bind(complianceController));

export default router;