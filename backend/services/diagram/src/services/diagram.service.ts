import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { DiagramData, CreateDiagramRequest, UpdateDiagramRequest, ExportFormat, DiagramValidationResult, DiagramElement, DiagramConnection } from '../types/diagram.types';
import { DiagramRenderer } from './diagram-renderer.service';
import { logger } from '../utils/logger';

interface PaginationOptions {
  page: number;
  limit: number;
  threatModelId?: string;
}

export class DiagramService {
  private pool: Pool;
  private renderer: DiagramRenderer;

  constructor() {
    this.pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'threat_modeling',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'password',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.renderer = new DiagramRenderer();
  }

  async getAllDiagrams(options: PaginationOptions): Promise<{ diagrams: DiagramData[]; total: number; page: number; limit: number }> {
    const offset = (options.page - 1) * options.limit;
    
    let query = `
      SELECT d.*, tm.name as threat_model_name
      FROM diagrams d
      LEFT JOIN threat_models tm ON d.threat_model_id = tm.id
    `;
    
    const params: any[] = [];
    
    if (options.threatModelId) {
      query += ' WHERE d.threat_model_id = $1';
      params.push(options.threatModelId);
    }
    
    query += ` ORDER BY d.updated_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(options.limit, offset);

    const result = await this.pool.query(query, params);
    
    // Get total count
    let countQuery = 'SELECT COUNT(*) FROM diagrams d';
    const countParams: any[] = [];
    
    if (options.threatModelId) {
      countQuery += ' WHERE d.threat_model_id = $1';
      countParams.push(options.threatModelId);
    }
    
    const countResult = await this.pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    const diagrams = result.rows.map(row => this.mapRowToDiagram(row));

    return {
      diagrams,
      total,
      page: options.page,
      limit: options.limit
    };
  }

  async getDiagramById(id: string): Promise<DiagramData | null> {
    const query = `
      SELECT d.*, tm.name as threat_model_name
      FROM diagrams d
      LEFT JOIN threat_models tm ON d.threat_model_id = tm.id
      WHERE d.id = $1
    `;
    
    const result = await this.pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToDiagram(result.rows[0]);
  }

  async createDiagram(diagramRequest: CreateDiagramRequest): Promise<DiagramData> {
    const id = uuidv4();
    const now = new Date().toISOString();
    
    const diagram: DiagramData = {
      id,
      threat_model_id: diagramRequest.threat_model_id,
      name: diagramRequest.name,
      description: diagramRequest.description || '',
      elements: diagramRequest.elements || [],
      connections: diagramRequest.connections || [],
      canvas: {
        width: diagramRequest.canvas?.width || 1200,
        height: diagramRequest.canvas?.height || 800,
        zoom: diagramRequest.canvas?.zoom || 1,
        pan: {
          x: diagramRequest.canvas?.pan?.x || 0,
          y: diagramRequest.canvas?.pan?.y || 0
        }
      },
      metadata: {
        version: '1.0',
        created_at: now,
        updated_at: now,
        created_by: 'system' // TODO: Get from auth context
      }
    };

    const diagramData = {
      elements: diagram.elements,
      connections: diagram.connections,
      canvas: diagram.canvas,
      metadata: diagram.metadata,
      description: diagram.description
    };

    const query = `
      INSERT INTO diagrams (id, threat_model_id, name, data, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const values = [
      diagram.id,
      diagram.threat_model_id,
      diagram.name,
      JSON.stringify(diagramData),
      diagram.metadata.created_at,
      diagram.metadata.updated_at
    ];

    const result = await this.pool.query(query, values);
    return this.mapRowToDiagram(result.rows[0]);
  }

  async updateDiagram(id: string, updateData: UpdateDiagramRequest): Promise<DiagramData | null> {
    const existingDiagram = await this.getDiagramById(id);
    if (!existingDiagram) {
      return null;
    }

    const updatedDiagram = {
      ...existingDiagram,
      ...updateData,
      metadata: {
        ...existingDiagram.metadata,
        updated_at: new Date().toISOString()
      }
    };

    const diagramData = {
      elements: updatedDiagram.elements,
      connections: updatedDiagram.connections,
      canvas: updatedDiagram.canvas,
      metadata: updatedDiagram.metadata,
      description: updatedDiagram.description
    };

    const query = `
      UPDATE diagrams
      SET name = $1, data = $2, updated_at = $3
      WHERE id = $4
      RETURNING *
    `;

    const values = [
      updatedDiagram.name,
      JSON.stringify(diagramData),
      updatedDiagram.metadata.updated_at,
      id
    ];

    const result = await this.pool.query(query, values);
    return this.mapRowToDiagram(result.rows[0]);
  }

  async deleteDiagram(id: string): Promise<boolean> {
    const query = 'DELETE FROM diagrams WHERE id = $1';
    const result = await this.pool.query(query, [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async getDiagramsByThreatModel(threatModelId: string): Promise<DiagramData[]> {
    const result = await this.getAllDiagrams({
      page: 1,
      limit: 1000, // Large limit to get all diagrams
      threatModelId
    });
    
    return result.diagrams;
  }

  async validateDiagram(id: string): Promise<DiagramValidationResult> {
    const diagram = await this.getDiagramById(id);
    
    if (!diagram) {
      return {
        isValid: false,
        errors: ['Diagram not found'],
        warnings: []
      };
    }

    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate elements
    if (diagram.elements.length === 0) {
      warnings.push('Diagram has no elements');
    }

    for (const element of diagram.elements) {
      if (!element.id || !element.type || !element.label) {
        errors.push(`Element ${element.id || 'unknown'} is missing required fields`);
      }
      
      if (element.position.x < 0 || element.position.y < 0) {
        warnings.push(`Element ${element.label} has negative position`);
      }
    }

    // Validate connections
    for (const connection of diagram.connections) {
      const sourceExists = diagram.elements.some(el => el.id === connection.sourceId);
      const targetExists = diagram.elements.some(el => el.id === connection.targetId);
      
      if (!sourceExists) {
        errors.push(`Connection ${connection.id} references non-existent source element`);
      }
      
      if (!targetExists) {
        errors.push(`Connection ${connection.id} references non-existent target element`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  async exportDiagram(id: string, format: ExportFormat): Promise<Buffer | string> {
    const diagram = await this.getDiagramById(id);
    
    if (!diagram) {
      throw new Error('Diagram not found');
    }

    switch (format.format) {
      case 'json':
        return JSON.stringify(diagram, null, 2);
      
      case 'png':
      case 'svg':
      case 'pdf':
        return await this.renderer.renderDiagram(diagram, format);
      
      default:
        throw new Error(`Unsupported export format: ${format.format}`);
    }
  }

  async addElement(diagramId: string, elementData: Partial<DiagramElement>): Promise<DiagramElement> {
    const diagram = await this.getDiagramById(diagramId);
    if (!diagram) {
      throw new Error('Diagram not found');
    }

    const element: DiagramElement = {
      id: uuidv4(),
      type: elementData.type || 'process',
      label: elementData.label || 'New Element',
      position: elementData.position || { x: 100, y: 100 },
      dimensions: elementData.dimensions || { width: 120, height: 80 },
      properties: elementData.properties || {},
      style: elementData.style
    };

    diagram.elements.push(element);
    await this.updateDiagram(diagramId, { elements: diagram.elements });

    return element;
  }

  async updateElement(diagramId: string, elementId: string, updateData: Partial<DiagramElement>): Promise<DiagramElement | null> {
    const diagram = await this.getDiagramById(diagramId);
    if (!diagram) {
      throw new Error('Diagram not found');
    }

    const elementIndex = diagram.elements.findIndex(el => el.id === elementId);
    if (elementIndex === -1) {
      return null;
    }

    diagram.elements[elementIndex] = { ...diagram.elements[elementIndex], ...updateData };
    await this.updateDiagram(diagramId, { elements: diagram.elements });

    return diagram.elements[elementIndex];
  }

  async deleteElement(diagramId: string, elementId: string): Promise<boolean> {
    const diagram = await this.getDiagramById(diagramId);
    if (!diagram) {
      throw new Error('Diagram not found');
    }

    const elementIndex = diagram.elements.findIndex(el => el.id === elementId);
    if (elementIndex === -1) {
      return false;
    }

    diagram.elements.splice(elementIndex, 1);
    
    // Remove connections that reference this element
    diagram.connections = diagram.connections.filter(
      conn => conn.sourceId !== elementId && conn.targetId !== elementId
    );

    await this.updateDiagram(diagramId, { 
      elements: diagram.elements, 
      connections: diagram.connections 
    });

    return true;
  }

  async addConnection(diagramId: string, connectionData: Partial<DiagramConnection>): Promise<DiagramConnection> {
    const diagram = await this.getDiagramById(diagramId);
    if (!diagram) {
      throw new Error('Diagram not found');
    }

    if (!connectionData.sourceId || !connectionData.targetId) {
      throw new Error('Source and target IDs are required for connections');
    }

    const connection: DiagramConnection = {
      id: uuidv4(),
      sourceId: connectionData.sourceId,
      targetId: connectionData.targetId,
      label: connectionData.label,
      style: connectionData.style,
      properties: connectionData.properties || {}
    };

    diagram.connections.push(connection);
    await this.updateDiagram(diagramId, { connections: diagram.connections });

    return connection;
  }

  async updateConnection(diagramId: string, connectionId: string, updateData: Partial<DiagramConnection>): Promise<DiagramConnection | null> {
    const diagram = await this.getDiagramById(diagramId);
    if (!diagram) {
      throw new Error('Diagram not found');
    }

    const connectionIndex = diagram.connections.findIndex(conn => conn.id === connectionId);
    if (connectionIndex === -1) {
      return null;
    }

    diagram.connections[connectionIndex] = { ...diagram.connections[connectionIndex], ...updateData };
    await this.updateDiagram(diagramId, { connections: diagram.connections });

    return diagram.connections[connectionIndex];
  }

  async deleteConnection(diagramId: string, connectionId: string): Promise<boolean> {
    const diagram = await this.getDiagramById(diagramId);
    if (!diagram) {
      throw new Error('Diagram not found');
    }

    const connectionIndex = diagram.connections.findIndex(conn => conn.id === connectionId);
    if (connectionIndex === -1) {
      return false;
    }

    diagram.connections.splice(connectionIndex, 1);
    await this.updateDiagram(diagramId, { connections: diagram.connections });

    return true;
  }

  private mapRowToDiagram(row: Record<string, any>): DiagramData {
    const data = JSON.parse(row.data || '{}');
    
    return {
      id: row.id,
      threat_model_id: row.threat_model_id,
      name: row.name,
      description: data.description || '',
      elements: data.elements || [],
      connections: data.connections || [],
      canvas: data.canvas || { width: 1200, height: 800, zoom: 1, pan: { x: 0, y: 0 } },
      metadata: data.metadata || {
        version: '1.0',
        created_at: row.created_at,
        updated_at: row.updated_at,
        created_by: row.created_by || 'system'
      }
    };
  }
}