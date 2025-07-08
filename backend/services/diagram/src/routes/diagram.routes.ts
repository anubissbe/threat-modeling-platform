import { Router } from 'express';
import { DiagramController } from '../controllers/diagram.controller';
import { exportRateLimiter } from '../middleware/rate-limiter';

const router = Router();
const diagramController = new DiagramController();

// Diagram CRUD operations
router.get('/', diagramController.getAllDiagrams.bind(diagramController));
router.get('/:id', diagramController.getDiagramById.bind(diagramController));
router.post('/', diagramController.createDiagram.bind(diagramController));
router.put('/:id', diagramController.updateDiagram.bind(diagramController));
router.delete('/:id', diagramController.deleteDiagram.bind(diagramController));

// Diagram validation
router.post('/:id/validate', diagramController.validateDiagram.bind(diagramController));

// Diagram export (rate limited)
router.post('/:id/export', exportRateLimiter, diagramController.exportDiagram.bind(diagramController));

// Get diagrams by threat model
router.get('/threat-model/:threatModelId', diagramController.getDiagramsByThreatModel.bind(diagramController));

// Element operations
router.post('/:id/elements', diagramController.addElement.bind(diagramController));
router.put('/:id/elements/:elementId', diagramController.updateElement.bind(diagramController));
router.delete('/:id/elements/:elementId', diagramController.deleteElement.bind(diagramController));

// Connection operations
router.post('/:id/connections', diagramController.addConnection.bind(diagramController));
router.put('/:id/connections/:connectionId', diagramController.updateConnection.bind(diagramController));
router.delete('/:id/connections/:connectionId', diagramController.deleteConnection.bind(diagramController));

export { router as diagramRoutes };