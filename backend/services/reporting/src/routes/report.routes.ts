import { Router } from 'express';
import { ReportController } from '../controllers/report.controller';

const router = Router();
const reportController = new ReportController();

// Report CRUD operations
router.get('/', (req, res) => reportController.getAllReports(req, res));
router.get('/:id', (req, res) => reportController.getReportById(req, res));
router.post('/', (req, res) => reportController.createReport(req, res));
router.put('/:id', (req, res) => reportController.updateReport(req, res));
router.delete('/:id', (req, res) => reportController.deleteReport(req, res));

// Report generation and download
router.post('/:id/generate', (req, res) => reportController.generateReport(req, res));
router.get('/:id/download', (req, res) => reportController.downloadReport(req, res));

// Get reports by threat model
router.get('/threat-model/:threatModelId', (req, res) => reportController.getReportsByThreatModel(req, res));

export default router;