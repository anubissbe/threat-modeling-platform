import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type {
  DiagramNode,
  DiagramConnection,
  Threat,
  CanvasState,
  EditorState,
} from '../../types/editor';

const initialState: EditorState = {
  nodes: [],
  connections: [],
  threats: [],
  selectedElement: null,
  canvasState: {
    zoom: 1,
    pan: { x: 0, y: 0 },
  },
};

const editorSlice = createSlice({
  name: 'editor',
  initialState,
  reducers: {
    // Node actions
    addNode: (state, action: PayloadAction<DiagramNode>) => {
      state.nodes.push(action.payload);
    },
    updateNode: (state, action: PayloadAction<DiagramNode>) => {
      const index = state.nodes.findIndex((n) => n.id === action.payload.id);
      if (index !== -1) {
        state.nodes[index] = action.payload;
      }
    },
    deleteNode: (state, action: PayloadAction<string>) => {
      state.nodes = state.nodes.filter((n) => n.id !== action.payload);
      // Also remove connections involving this node
      state.connections = state.connections.filter(
        (c) => c.source !== action.payload && c.target !== action.payload
      );
      // Remove node from threats
      state.threats.forEach((threat) => {
        threat.affectedComponents = threat.affectedComponents.filter(
          (id) => id !== action.payload
        );
      });
    },

    // Connection actions
    addConnection: (state, action: PayloadAction<DiagramConnection>) => {
      state.connections.push(action.payload);
    },
    updateConnection: (state, action: PayloadAction<DiagramConnection>) => {
      const index = state.connections.findIndex((c) => c.id === action.payload.id);
      if (index !== -1) {
        state.connections[index] = action.payload;
      }
    },
    deleteConnection: (state, action: PayloadAction<string>) => {
      state.connections = state.connections.filter((c) => c.id !== action.payload);
      // Remove connection from threats
      state.threats.forEach((threat) => {
        threat.affectedFlows = threat.affectedFlows.filter(
          (id) => id !== action.payload
        );
      });
    },

    // Threat actions
    addThreat: (state, action: PayloadAction<Threat>) => {
      state.threats.push(action.payload);
    },
    updateThreat: (state, action: PayloadAction<Threat>) => {
      const index = state.threats.findIndex((t) => t.id === action.payload.id);
      if (index !== -1) {
        state.threats[index] = action.payload;
      }
    },
    deleteThreat: (state, action: PayloadAction<string>) => {
      state.threats = state.threats.filter((t) => t.id !== action.payload);
    },

    // Selection actions
    setSelectedElement: (
      state,
      action: PayloadAction<DiagramNode | DiagramConnection | null>
    ) => {
      state.selectedElement = action.payload;
    },

    // Canvas actions
    updateCanvasState: (state, action: PayloadAction<Partial<CanvasState>>) => {
      state.canvasState = { ...state.canvasState, ...action.payload };
    },

    // Bulk actions
    loadDiagram: (
      state,
      action: PayloadAction<{
        nodes: DiagramNode[];
        connections: DiagramConnection[];
        threats: Threat[];
      }>
    ) => {
      state.nodes = action.payload.nodes;
      state.connections = action.payload.connections;
      state.threats = action.payload.threats;
      state.selectedElement = null;
    },
    clearDiagram: (state) => {
      state.nodes = [];
      state.connections = [];
      state.threats = [];
      state.selectedElement = null;
      state.canvasState = initialState.canvasState;
    },
  },
});

export const {
  addNode,
  updateNode,
  deleteNode,
  addConnection,
  updateConnection,
  deleteConnection,
  addThreat,
  updateThreat,
  deleteThreat,
  setSelectedElement,
  updateCanvasState,
  loadDiagram,
  clearDiagram,
} = editorSlice.actions;

export default editorSlice.reducer;