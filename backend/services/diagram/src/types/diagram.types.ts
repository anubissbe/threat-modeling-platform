export interface DiagramElement {
  id: string;
  type: 'process' | 'data_store' | 'external_entity' | 'data_flow' | 'trust_boundary';
  label: string;
  position: {
    x: number;
    y: number;
  };
  dimensions: {
    width: number;
    height: number;
  };
  properties: Record<string, any>;
  style?: {
    backgroundColor?: string;
    borderColor?: string;
    textColor?: string;
    fontSize?: number;
  } | undefined;
}

export interface DiagramConnection {
  id: string;
  sourceId: string;
  targetId: string;
  label?: string | undefined;
  style?: {
    strokeColor?: string;
    strokeWidth?: number;
    strokeStyle?: 'solid' | 'dashed' | 'dotted';
  } | undefined;
  properties: Record<string, any>;
}

export interface DiagramData {
  id: string;
  threat_model_id: string;
  name: string;
  description?: string;
  elements: DiagramElement[];
  connections: DiagramConnection[];
  canvas: {
    width: number;
    height: number;
    zoom: number;
    pan: {
      x: number;
      y: number;
    };
  };
  metadata: {
    version: string;
    created_at: string;
    updated_at: string;
    created_by: string;
  };
}

export interface CreateDiagramRequest {
  threat_model_id: string;
  name: string;
  description?: string;
  elements?: DiagramElement[];
  connections?: DiagramConnection[];
  canvas?: Partial<DiagramData['canvas']>;
}

export interface UpdateDiagramRequest {
  name?: string;
  description?: string;
  elements?: DiagramElement[];
  connections?: DiagramConnection[];
  canvas?: Partial<DiagramData['canvas']>;
}

export interface ExportFormat {
  format: 'png' | 'svg' | 'pdf' | 'json';
  quality?: number;
  scale?: number;
  includeMetadata?: boolean;
}

export interface DiagramValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}