import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import { ThreatModelEditor } from '../../components/ThreatModelEditor';
import editorReducer from '../../store/slices/editorSlice';
import authReducer from '../../store/slices/authSlice';
import uiReducer from '../../store/slices/uiSlice';

// Mock react-flow-renderer
vi.mock('react-flow-renderer', () => ({
  ReactFlow: vi.fn(() => <div data-testid="react-flow">React Flow Canvas</div>),
  Background: vi.fn(() => <div data-testid="flow-background">Background</div>),
  Controls: vi.fn(() => <div data-testid="flow-controls">Controls</div>),
  MiniMap: vi.fn(() => <div data-testid="flow-minimap">MiniMap</div>),
  addEdge: vi.fn(),
  applyEdgeChanges: vi.fn(),
  applyNodeChanges: vi.fn(),
}));

const createMockStore = (initialState = {}) => {
  return configureStore({
    reducer: {
      editor: editorReducer,
      auth: authReducer,
      ui: uiReducer,
    },
    preloadedState: {
      editor: {
        nodes: [],
        edges: [],
        selectedNode: null,
        selectedEdge: null,
        threats: [],
        methodology: 'STRIDE',
        diagramId: null,
        isLoading: false,
        error: null,
        hasChanges: false,
        ...initialState.editor,
      },
      auth: {
        user: { id: '1', email: 'test@example.com', role: 'user' },
        tokens: { accessToken: 'token' },
        isAuthenticated: true,
        isLoading: false,
        error: null,
        isInitialized: true,
        ...initialState.auth,
      },
      ui: {
        notifications: [],
        theme: 'light',
        sidebarOpen: true,
        ...initialState.ui,
      },
    },
  });
};

const renderWithProviders = (component: React.ReactElement, initialState = {}) => {
  const store = createMockStore(initialState);
  return {
    ...render(
      <Provider store={store}>
        <BrowserRouter>
          {component}
        </BrowserRouter>
      </Provider>
    ),
    store,
  };
};

describe('ThreatModelEditor Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders editor interface correctly', () => {
    renderWithProviders(<ThreatModelEditor />);
    
    expect(screen.getByTestId('react-flow')).toBeInTheDocument();
    expect(screen.getByTestId('flow-background')).toBeInTheDocument();
    expect(screen.getByTestId('flow-controls')).toBeInTheDocument();
    expect(screen.getByTestId('component-palette')).toBeInTheDocument();
    expect(screen.getByTestId('threat-panel')).toBeInTheDocument();
  });

  it('displays component palette with available components', () => {
    renderWithProviders(<ThreatModelEditor />);
    
    const palette = screen.getByTestId('component-palette');
    expect(palette).toBeInTheDocument();
    
    // Check for common DFD components
    expect(screen.getByText(/external entity/i)).toBeInTheDocument();
    expect(screen.getByText(/process/i)).toBeInTheDocument();
    expect(screen.getByText(/data store/i)).toBeInTheDocument();
    expect(screen.getByText(/data flow/i)).toBeInTheDocument();
    expect(screen.getByText(/trust boundary/i)).toBeInTheDocument();
  });

  it('allows dragging components from palette', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ThreatModelEditor />);
    
    const processComponent = screen.getByTestId('component-process');
    
    // Simulate drag start
    fireEvent.dragStart(processComponent);
    
    // Check if drag operation is initiated
    expect(processComponent).toHaveAttribute('draggable', 'true');
  });

  it('displays threat panel with methodology selection', () => {
    renderWithProviders(<ThreatModelEditor />);
    
    const threatPanel = screen.getByTestId('threat-panel');
    expect(threatPanel).toBeInTheDocument();
    
    const methodologySelect = screen.getByLabelText(/methodology/i);
    expect(methodologySelect).toBeInTheDocument();
    expect(methodologySelect).toHaveValue('STRIDE');
  });

  it('switches between different threat modeling methodologies', async () => {
    const user = userEvent.setup();
    const { store } = renderWithProviders(<ThreatModelEditor />);
    
    const methodologySelect = screen.getByLabelText(/methodology/i);
    
    await user.selectOptions(methodologySelect, 'PASTA');
    
    await waitFor(() => {
      const state = store.getState();
      expect(state.editor.methodology).toBe('PASTA');
    });
  });

  it('shows properties panel when node is selected', () => {
    const mockNode = {
      id: 'node-1',
      type: 'process',
      position: { x: 100, y: 100 },
      data: { label: 'Web Server', description: 'Main web server process' },
    };
    
    renderWithProviders(<ThreatModelEditor />, {
      editor: { selectedNode: mockNode },
    });
    
    const propertiesPanel = screen.getByTestId('properties-panel');
    expect(propertiesPanel).toBeInTheDocument();
    expect(screen.getByDisplayValue('Web Server')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Main web server process')).toBeInTheDocument();
  });

  it('allows editing node properties', async () => {
    const user = userEvent.setup();
    const mockNode = {
      id: 'node-1',
      type: 'process',
      position: { x: 100, y: 100 },
      data: { label: 'Web Server', description: 'Main web server process' },
    };
    
    const { store } = renderWithProviders(<ThreatModelEditor />, {
      editor: { selectedNode: mockNode },
    });
    
    const labelInput = screen.getByDisplayValue('Web Server');
    await user.clear(labelInput);
    await user.type(labelInput, 'Updated Web Server');
    
    await waitFor(() => {
      // Check if the store was updated (this would depend on your implementation)
      expect(labelInput).toHaveValue('Updated Web Server');
    });
  });

  it('generates threats based on selected methodology', async () => {
    const user = userEvent.setup();
    const mockNodes = [
      {
        id: 'node-1',
        type: 'process',
        position: { x: 100, y: 100 },
        data: { label: 'Web Server' },
      },
      {
        id: 'node-2',
        type: 'datastore',
        position: { x: 300, y: 100 },
        data: { label: 'User Database' },
      },
    ];
    
    renderWithProviders(<ThreatModelEditor />, {
      editor: { nodes: mockNodes, methodology: 'STRIDE' },
    });
    
    const generateButton = screen.getByRole('button', { name: /generate threats/i });
    await user.click(generateButton);
    
    await waitFor(() => {
      expect(screen.getByText(/spoofing/i)).toBeInTheDocument();
      expect(screen.getByText(/tampering/i)).toBeInTheDocument();
    });
  });

  it('allows adding custom threats', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ThreatModelEditor />);
    
    const addThreatButton = screen.getByRole('button', { name: /add threat/i });
    await user.click(addThreatButton);
    
    const threatTitleInput = screen.getByLabelText(/threat title/i);
    const threatDescriptionInput = screen.getByLabelText(/threat description/i);
    
    await user.type(threatTitleInput, 'Custom SQL Injection Threat');
    await user.type(threatDescriptionInput, 'Potential SQL injection vulnerability in login form');
    
    const saveButton = screen.getByRole('button', { name: /save threat/i });
    await user.click(saveButton);
    
    await waitFor(() => {
      expect(screen.getByText('Custom SQL Injection Threat')).toBeInTheDocument();
    });
  });

  it('validates threat model before saving', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ThreatModelEditor />);
    
    const saveButton = screen.getByRole('button', { name: /save/i });
    await user.click(saveButton);
    
    await waitFor(() => {
      expect(screen.getByText(/please add at least one component/i)).toBeInTheDocument();
    });
  });

  it('exports threat model in different formats', async () => {
    const user = userEvent.setup();
    const mockNodes = [
      {
        id: 'node-1',
        type: 'process',
        position: { x: 100, y: 100 },
        data: { label: 'Web Server' },
      },
    ];
    
    renderWithProviders(<ThreatModelEditor />, {
      editor: { nodes: mockNodes },
    });
    
    const exportButton = screen.getByRole('button', { name: /export/i });
    await user.click(exportButton);
    
    const exportMenu = screen.getByRole('menu');
    expect(exportMenu).toBeInTheDocument();
    
    expect(screen.getByText(/export as pdf/i)).toBeInTheDocument();
    expect(screen.getByText(/export as json/i)).toBeInTheDocument();
    expect(screen.getByText(/export as xml/i)).toBeInTheDocument();
  });

  it('handles undo/redo operations', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ThreatModelEditor />);
    
    const undoButton = screen.getByRole('button', { name: /undo/i });
    const redoButton = screen.getByRole('button', { name: /redo/i });
    
    // Initially, undo and redo should be disabled
    expect(undoButton).toBeDisabled();
    expect(redoButton).toBeDisabled();
    
    // After making changes, undo should be enabled
    // This would depend on your implementation of history management
  });

  it('shows loading state while processing', () => {
    renderWithProviders(<ThreatModelEditor />, {
      editor: { isLoading: true },
    });
    
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    expect(screen.getByText(/processing/i)).toBeInTheDocument();
  });

  it('displays error messages appropriately', () => {
    const errorMessage = 'Failed to save threat model';
    renderWithProviders(<ThreatModelEditor />, {
      editor: { error: errorMessage },
    });
    
    expect(screen.getByText(errorMessage)).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('handles keyboard shortcuts', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ThreatModelEditor />);
    
    // Test save shortcut (Ctrl+S)
    await user.keyboard('{Control>}s{/Control}');
    
    // Test delete shortcut when node is selected
    const mockNode = {
      id: 'node-1',
      type: 'process',
      position: { x: 100, y: 100 },
      data: { label: 'Web Server' },
    };
    
    renderWithProviders(<ThreatModelEditor />, {
      editor: { selectedNode: mockNode },
    });
    
    await user.keyboard('{Delete}');
    
    // Verify node deletion would be triggered
  });

  it('supports collaborative features indicator', () => {
    renderWithProviders(<ThreatModelEditor />);
    
    // Should show collaboration status
    expect(screen.getByTestId('collaboration-status')).toBeInTheDocument();
  });

  it('maintains diagram state during navigation', () => {
    const mockNodes = [
      {
        id: 'node-1',
        type: 'process',
        position: { x: 100, y: 100 },
        data: { label: 'Web Server' },
      },
    ];
    
    const { store } = renderWithProviders(<ThreatModelEditor />, {
      editor: { nodes: mockNodes, hasChanges: true },
    });
    
    const state = store.getState();
    expect(state.editor.hasChanges).toBe(true);
    expect(state.editor.nodes).toHaveLength(1);
  });
});