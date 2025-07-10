import React, { useState, useCallback, useRef } from 'react';
import {
  Box,
  Paper,
  IconButton,
  Toolbar,
  Typography,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Button,
  Menu,
  MenuItem,
  Tooltip,
  Fab,
  Badge,
} from '@mui/material';
import {
  Save as SaveIcon,
  Undo as UndoIcon,
  Redo as RedoIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  FitScreen as FitScreenIcon,
  GridOn as GridOnIcon,
  Delete as DeleteIcon,
  ContentCopy as CopyIcon,
  ContentPaste as PasteIcon,
  Warning as ThreatIcon,
  Security as SecurityIcon,
  Storage as StorageIcon,
  Cloud as CloudIcon,
  Person as PersonIcon,
  Computer as ComputerIcon,
  Api as ApiIcon,
  VpnKey as VpnKeyIcon,
  ArrowForward as ArrowIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { Canvas } from './Canvas';
import { ComponentPalette } from './ComponentPalette';
import { PropertiesPanel } from './PropertiesPanel';
import { ThreatPanel } from './ThreatPanel';
import { useAppSelector, useAppDispatch } from '../../hooks/redux';
import {
  addNode,
  updateNode,
  deleteNode,
  addConnection,
  updateConnection,
  deleteConnection,
  setSelectedElement,
  updateCanvasState,
  addThreat,
  updateThreat,
  deleteThreat,
} from '../../store/slices/editorSlice';
import type { DiagramNode, DiagramConnection, Threat } from '../../types/editor';

const drawerWidth = 280;

export const ThreatModelEditor: React.FC = () => {
  const dispatch = useAppDispatch();
  const { nodes, connections, selectedElement, threats, canvasState } = useAppSelector(
    (state) => state.editor
  );
  
  const [showGrid, setShowGrid] = useState(true);
  const [showThreats, setShowThreats] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    element?: DiagramNode | DiagramConnection;
  } | null>(null);

  const canvasRef = useRef<any>(null);

  // Handle component drop from palette
  const handleDrop = useCallback(
    (e: React.DragEvent, componentType: string) => {
      e.preventDefault();
      const canvasRect = canvasRef.current?.getBoundingClientRect();
      if (!canvasRect) return;

      const x = e.clientX - canvasRect.left - canvasState.pan.x;
      const y = e.clientY - canvasRect.top - canvasState.pan.y;

      const newNode: DiagramNode = {
        id: `node-${Date.now()}`,
        type: componentType,
        position: { x: x / canvasState.zoom, y: y / canvasState.zoom },
        data: {
          label: `New ${componentType}`,
          properties: {},
        },
      };

      dispatch(addNode(newNode));
    },
    [dispatch, canvasState]
  );

  // Handle element selection
  const handleSelectElement = useCallback(
    (element: DiagramNode | DiagramConnection | null) => {
      dispatch(setSelectedElement(element));
    },
    [dispatch]
  );

  // Handle element update
  const handleUpdateElement = useCallback(
    (element: DiagramNode | DiagramConnection) => {
      if ('position' in element) {
        dispatch(updateNode(element));
      } else {
        dispatch(updateConnection(element));
      }
    },
    [dispatch]
  );

  // Handle element deletion
  const handleDeleteElement = useCallback(() => {
    if (selectedElement) {
      if ('position' in selectedElement) {
        dispatch(deleteNode(selectedElement.id));
      } else {
        dispatch(deleteConnection(selectedElement.id));
      }
      dispatch(setSelectedElement(null));
    }
  }, [dispatch, selectedElement]);

  // Handle connection creation
  const handleConnect = useCallback(
    (sourceId: string, targetId: string) => {
      const newConnection: DiagramConnection = {
        id: `connection-${Date.now()}`,
        source: sourceId,
        target: targetId,
        type: 'dataflow',
        data: {
          label: 'Data Flow',
          properties: {
            protocol: 'HTTPS',
            encryption: 'TLS 1.3',
          },
        },
      };
      dispatch(addConnection(newConnection));
    },
    [dispatch]
  );

  // Handle zoom
  const handleZoom = useCallback(
    (delta: number) => {
      const newZoom = Math.max(0.1, Math.min(2, canvasState.zoom + delta));
      dispatch(updateCanvasState({ zoom: newZoom }));
    },
    [dispatch, canvasState.zoom]
  );

  // Handle fit to screen
  const handleFitToScreen = useCallback(() => {
    // Calculate bounding box of all nodes
    if (nodes.length === 0) return;

    const bounds = nodes.reduce(
      (acc, node) => ({
        minX: Math.min(acc.minX, node.position.x),
        minY: Math.min(acc.minY, node.position.y),
        maxX: Math.max(acc.maxX, node.position.x + 200),
        maxY: Math.max(acc.maxY, node.position.y + 100),
      }),
      {
        minX: Infinity,
        minY: Infinity,
        maxX: -Infinity,
        maxY: -Infinity,
      }
    );

    // Calculate zoom and pan to fit
    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (!canvasRect) return;

    const padding = 50;
    const scaleX = (canvasRect.width - 2 * padding) / (bounds.maxX - bounds.minX);
    const scaleY = (canvasRect.height - 2 * padding) / (bounds.maxY - bounds.minY);
    const zoom = Math.min(scaleX, scaleY, 1);

    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;
    const pan = {
      x: canvasRect.width / 2 - centerX * zoom,
      y: canvasRect.height / 2 - centerY * zoom,
    };

    dispatch(updateCanvasState({ zoom, pan }));
  }, [dispatch, nodes]);

  // Handle context menu
  const handleContextMenu = useCallback(
    (e: React.MouseEvent, element?: DiagramNode | DiagramConnection) => {
      e.preventDefault();
      if (element) {
        setContextMenu({ x: e.clientX, y: e.clientY, element });
      } else {
        setContextMenu({ x: e.clientX, y: e.clientY });
      }
    },
    []
  );

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  // Handle save
  const handleSave = useCallback(() => {
    // TODO: Implement save functionality
    console.log('Saving threat model...', { nodes, connections, threats });
  }, [nodes, connections, threats]);

  // Calculate threat count for selected element
  const selectedElementThreats = selectedElement
    ? threats.filter((t) =>
        'position' in selectedElement
          ? t.affectedComponents.includes(selectedElement.id)
          : t.affectedFlows.includes(selectedElement.id)
      )
    : [];

  return (
    <Box sx={{ display: 'flex', height: '100vh', bgcolor: 'background.default' }}>
      {/* Component Palette */}
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
            position: 'relative',
            height: '100%',
          },
        }}
      >
        <Toolbar>
          <Typography variant="h6">Components</Typography>
        </Toolbar>
        <Divider />
        <ComponentPalette />
      </Drawer>

      {/* Main Canvas Area */}
      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Toolbar */}
        <Paper elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Toolbar variant="dense">
            <IconButton onClick={handleSave} size="small">
              <SaveIcon />
            </IconButton>
            <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
            <IconButton size="small" disabled>
              <UndoIcon />
            </IconButton>
            <IconButton size="small" disabled>
              <RedoIcon />
            </IconButton>
            <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
            <IconButton onClick={() => handleZoom(0.1)} size="small">
              <ZoomInIcon />
            </IconButton>
            <IconButton onClick={() => handleZoom(-0.1)} size="small">
              <ZoomOutIcon />
            </IconButton>
            <IconButton onClick={handleFitToScreen} size="small">
              <FitScreenIcon />
            </IconButton>
            <IconButton
              onClick={() => setShowGrid(!showGrid)}
              size="small"
              color={showGrid ? 'primary' : 'default'}
            >
              <GridOnIcon />
            </IconButton>
            <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
            <IconButton
              onClick={handleDeleteElement}
              size="small"
              disabled={!selectedElement}
            >
              <DeleteIcon />
            </IconButton>
            <Box sx={{ flexGrow: 1 }} />
            <Typography variant="body2" sx={{ mr: 2 }}>
              Zoom: {Math.round(canvasState.zoom * 100)}%
            </Typography>
          </Toolbar>
        </Paper>

        {/* Canvas */}
        <Box sx={{ flexGrow: 1, position: 'relative', overflow: 'hidden' }}>
          <Canvas
            ref={canvasRef}
            nodes={nodes}
            connections={connections}
            selectedElement={selectedElement}
            showGrid={showGrid}
            zoom={canvasState.zoom}
            pan={canvasState.pan}
            onDrop={handleDrop}
            onSelectElement={handleSelectElement}
            onUpdateElement={handleUpdateElement}
            onConnect={handleConnect}
            onContextMenu={handleContextMenu}
            onPanChange={(pan) => dispatch(updateCanvasState({ pan }))}
          />

          {/* Floating Action Button for Threats */}
          <Tooltip title="View Threats">
            <Fab
              color="secondary"
              sx={{ position: 'absolute', bottom: 16, right: 16 }}
              onClick={() => setShowThreats(!showThreats)}
            >
              <Badge badgeContent={threats.length} color="error">
                <ThreatIcon />
              </Badge>
            </Fab>
          </Tooltip>
        </Box>
      </Box>

      {/* Properties Panel */}
      {selectedElement && (
        <PropertiesPanel
          element={selectedElement}
          threats={selectedElementThreats}
          onUpdate={handleUpdateElement}
          onAddThreat={(threat) => dispatch(addThreat(threat))}
        />
      )}

      {/* Threat Panel */}
      <ThreatPanel
        open={showThreats}
        threats={threats}
        nodes={nodes}
        connections={connections}
        onClose={() => setShowThreats(false)}
        onSelectElement={handleSelectElement}
        onUpdateThreat={(threat) => dispatch(updateThreat(threat))}
        onDeleteThreat={(id) => dispatch(deleteThreat(id))}
      />

      {/* Context Menu */}
      <Menu
        open={contextMenu !== null}
        onClose={handleCloseContextMenu}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenu !== null
            ? { top: contextMenu.y, left: contextMenu.x }
            : { top: 0, left: 0 }
        }
      >
        <MenuItem onClick={() => {
          // TODO: Implement copy
          handleCloseContextMenu();
        }}>
          <ListItemIcon>
            <CopyIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Copy</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => {
          // TODO: Implement paste
          handleCloseContextMenu();
        }}>
          <ListItemIcon>
            <PasteIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Paste</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => {
          handleDeleteElement();
          handleCloseContextMenu();
        }}>
          <ListItemIcon>
            <DeleteIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
      </Menu>
    </Box>
  );
};