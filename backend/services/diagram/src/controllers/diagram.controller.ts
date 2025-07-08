import { Request, Response, NextFunction } from 'express';
import { DiagramService } from '../services/diagram.service';
import { createAppError } from '../middleware/error-handler';
import { CreateDiagramRequest, UpdateDiagramRequest, ExportFormat } from '../types/diagram.types';
import { logger } from '../utils/logger';

export class DiagramController {
  private diagramService: DiagramService;

  constructor() {
    this.diagramService = new DiagramService();
  }

  async getAllDiagrams(req: Request, res: Response, next: NextFunction) {
    try {
      const { page = 1, limit = 10, threat_model_id } = req.query;
      
      const diagrams = await this.diagramService.getAllDiagrams({
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        threatModelId: threat_model_id as string
      });

      res.json(diagrams);
    } catch (error) {
      next(error);
    }
  }

  async getDiagramById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const diagram = await this.diagramService.getDiagramById(id);

      if (!diagram) {
        throw createAppError('Diagram not found', 404);
      }

      res.json(diagram);
    } catch (error) {
      next(error);
    }
  }

  async createDiagram(req: Request, res: Response, next: NextFunction) {
    try {
      const diagramData: CreateDiagramRequest = req.body;
      
      // Basic validation
      if (!diagramData.threat_model_id || !diagramData.name) {
        throw createAppError('Threat model ID and name are required', 400);
      }

      const diagram = await this.diagramService.createDiagram(diagramData);
      
      logger.info('Diagram created', { diagramId: diagram.id, name: diagram.name });
      res.status(201).json(diagram);
    } catch (error) {
      next(error);
    }
  }

  async updateDiagram(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const updateData: UpdateDiagramRequest = req.body;

      const diagram = await this.diagramService.updateDiagram(id, updateData);

      if (!diagram) {
        throw createAppError('Diagram not found', 404);
      }

      logger.info('Diagram updated', { diagramId: id });
      res.json(diagram);
    } catch (error) {
      next(error);
    }
  }

  async deleteDiagram(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      
      const deleted = await this.diagramService.deleteDiagram(id);

      if (!deleted) {
        throw createAppError('Diagram not found', 404);
      }

      logger.info('Diagram deleted', { diagramId: id });
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  async getDiagramsByThreatModel(req: Request, res: Response, next: NextFunction) {
    try {
      const { threatModelId } = req.params;
      const diagrams = await this.diagramService.getDiagramsByThreatModel(threatModelId);

      res.json(diagrams);
    } catch (error) {
      next(error);
    }
  }

  async validateDiagram(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const validation = await this.diagramService.validateDiagram(id);

      res.json(validation);
    } catch (error) {
      next(error);
    }
  }

  async exportDiagram(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const exportOptions: ExportFormat = req.body;

      if (!exportOptions.format) {
        throw createAppError('Export format is required', 400);
      }

      const exportResult = await this.diagramService.exportDiagram(id, exportOptions);

      // Set appropriate content type
      const contentTypes = {
        png: 'image/png',
        svg: 'image/svg+xml',
        pdf: 'application/pdf',
        json: 'application/json'
      };

      res.setHeader('Content-Type', contentTypes[exportOptions.format]);
      res.setHeader('Content-Disposition', `attachment; filename="diagram-${id}.${exportOptions.format}"`);
      
      logger.info('Diagram exported', { diagramId: id, format: exportOptions.format });
      res.send(exportResult);
    } catch (error) {
      next(error);
    }
  }

  async addElement(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const elementData = req.body;

      const element = await this.diagramService.addElement(id, elementData);
      res.status(201).json(element);
    } catch (error) {
      next(error);
    }
  }

  async updateElement(req: Request, res: Response, next: NextFunction) {
    try {
      const { id, elementId } = req.params;
      const updateData = req.body;

      const element = await this.diagramService.updateElement(id, elementId, updateData);
      
      if (!element) {
        throw createAppError('Element not found', 404);
      }

      res.json(element);
    } catch (error) {
      next(error);
    }
  }

  async deleteElement(req: Request, res: Response, next: NextFunction) {
    try {
      const { id, elementId } = req.params;
      
      const deleted = await this.diagramService.deleteElement(id, elementId);

      if (!deleted) {
        throw createAppError('Element not found', 404);
      }

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  async addConnection(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const connectionData = req.body;

      const connection = await this.diagramService.addConnection(id, connectionData);
      res.status(201).json(connection);
    } catch (error) {
      next(error);
    }
  }

  async updateConnection(req: Request, res: Response, next: NextFunction) {
    try {
      const { id, connectionId } = req.params;
      const updateData = req.body;

      const connection = await this.diagramService.updateConnection(id, connectionId, updateData);
      
      if (!connection) {
        throw createAppError('Connection not found', 404);
      }

      res.json(connection);
    } catch (error) {
      next(error);
    }
  }

  async deleteConnection(req: Request, res: Response, next: NextFunction) {
    try {
      const { id, connectionId } = req.params;
      
      const deleted = await this.diagramService.deleteConnection(id, connectionId);

      if (!deleted) {
        throw createAppError('Connection not found', 404);
      }

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
}