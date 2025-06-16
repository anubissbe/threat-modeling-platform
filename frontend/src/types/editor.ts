export interface DiagramNode {
  id: string;
  type: string;
  position: {
    x: number;
    y: number;
  };
  data: {
    label: string;
    properties: Record<string, any>;
  };
}

export interface DiagramConnection {
  id: string;
  source: string;
  target: string;
  type: 'dataflow' | 'trust' | 'process';
  data: {
    label: string;
    properties: Record<string, any>;
  };
}

export interface Threat {
  id: string;
  name: string;
  description: string;
  category: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  likelihood: 'very_high' | 'high' | 'medium' | 'low' | 'very_low';
  affectedComponents: string[];
  affectedFlows: string[];
  mitigations: Mitigation[];
}

export interface Mitigation {
  id: string;
  name: string;
  description: string;
  effectiveness: 'high' | 'medium' | 'low';
  implemented: boolean;
  cost: 'high' | 'medium' | 'low';
  effort: 'high' | 'medium' | 'low';
}

export interface CanvasState {
  zoom: number;
  pan: {
    x: number;
    y: number;
  };
}

export interface EditorState {
  nodes: DiagramNode[];
  connections: DiagramConnection[];
  threats: Threat[];
  selectedElement: DiagramNode | DiagramConnection | null;
  canvasState: CanvasState;
}