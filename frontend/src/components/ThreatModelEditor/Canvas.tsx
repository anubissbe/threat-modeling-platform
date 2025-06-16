import React, { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Box } from '@mui/material';
import type { DiagramNode, DiagramConnection } from '../../types/editor';

interface CanvasProps {
  nodes: DiagramNode[];
  connections: DiagramConnection[];
  selectedElement: DiagramNode | DiagramConnection | null;
  showGrid: boolean;
  zoom: number;
  pan: { x: number; y: number };
  onDrop: (e: React.DragEvent, componentType: string) => void;
  onSelectElement: (element: DiagramNode | DiagramConnection | null) => void;
  onUpdateElement: (element: DiagramNode | DiagramConnection) => void;
  onConnect: (sourceId: string, targetId: string) => void;
  onContextMenu: (e: React.MouseEvent, element?: DiagramNode | DiagramConnection) => void;
  onPanChange: (pan: { x: number; y: number }) => void;
}

export const Canvas = forwardRef<HTMLCanvasElement, CanvasProps>(
  (
    {
      nodes,
      connections,
      selectedElement,
      showGrid,
      zoom,
      pan,
      onDrop,
      onSelectElement,
      onUpdateElement,
      onConnect,
      onContextMenu,
      onPanChange,
    },
    ref
  ) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const dragState = useRef<{
      isDragging: boolean;
      isConnecting: boolean;
      draggedNode: DiagramNode | null;
      connectionStart: string | null;
      mouseStart: { x: number; y: number };
      elementStart: { x: number; y: number };
    }>({
      isDragging: false,
      isConnecting: false,
      draggedNode: null,
      connectionStart: null,
      mouseStart: { x: 0, y: 0 },
      elementStart: { x: 0, y: 0 },
    });

    useImperativeHandle(ref, () => canvasRef.current!);

    // Helper function to convert screen coordinates to canvas coordinates
    const screenToCanvas = (x: number, y: number) => {
      const rect = canvasRef.current!.getBoundingClientRect();
      return {
        x: (x - rect.left - pan.x) / zoom,
        y: (y - rect.top - pan.y) / zoom,
      };
    };

    // Helper function to check if a point is inside a node
    const isPointInNode = (x: number, y: number, node: DiagramNode) => {
      const nodeWidth = 200;
      const nodeHeight = 100;
      return (
        x >= node.position.x &&
        x <= node.position.x + nodeWidth &&
        y >= node.position.y &&
        y <= node.position.y + nodeHeight
      );
    };

    // Helper function to find node at position
    const findNodeAtPosition = (x: number, y: number) => {
      const canvasPos = screenToCanvas(x, y);
      for (let i = nodes.length - 1; i >= 0; i--) {
        if (isPointInNode(canvasPos.x, canvasPos.y, nodes[i])) {
          return nodes[i];
        }
      }
      return null;
    };

    // Helper function to draw a node
    const drawNode = (ctx: CanvasRenderingContext2D, node: DiagramNode) => {
      const { x, y } = node.position;
      const width = 200;
      const height = 100;
      const radius = 8;

      // Background
      ctx.fillStyle = selectedElement?.id === node.id ? '#e3f2fd' : '#ffffff';
      ctx.strokeStyle = selectedElement?.id === node.id ? '#1976d2' : '#bdbdbd';
      ctx.lineWidth = selectedElement?.id === node.id ? 2 : 1;

      // Draw rounded rectangle
      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + width - radius, y);
      ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
      ctx.lineTo(x + width, y + height - radius);
      ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
      ctx.lineTo(x + radius, y + height);
      ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Icon based on type
      ctx.fillStyle = '#424242';
      ctx.font = '32px Material Icons';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      const icons: Record<string, string> = {
        user: '\ue7fd', // person icon
        process: '\ue8b8', // computer icon
        database: '\ue8b8', // storage icon
        external: '\ue30a', // cloud icon
        api: '\ue8f5', // api icon
      };
      
      ctx.fillText(icons[node.type] || '\ue8b8', x + width / 2, y + height / 2 - 10);

      // Label
      ctx.font = '14px Roboto, sans-serif';
      ctx.fillStyle = '#212121';
      ctx.fillText(node.data.label, x + width / 2, y + height - 20);

      // Connection points
      if (selectedElement?.id === node.id) {
        ctx.fillStyle = '#1976d2';
        ctx.beginPath();
        ctx.arc(x + width / 2, y, 6, 0, 2 * Math.PI);
        ctx.arc(x + width, y + height / 2, 6, 0, 2 * Math.PI);
        ctx.arc(x + width / 2, y + height, 6, 0, 2 * Math.PI);
        ctx.arc(x, y + height / 2, 6, 0, 2 * Math.PI);
        ctx.fill();
      }
    };

    // Helper function to draw a connection
    const drawConnection = (ctx: CanvasRenderingContext2D, connection: DiagramConnection) => {
      const sourceNode = nodes.find((n) => n.id === connection.source);
      const targetNode = nodes.find((n) => n.id === connection.target);
      
      if (!sourceNode || !targetNode) return;

      const sourceX = sourceNode.position.x + 200;
      const sourceY = sourceNode.position.y + 50;
      const targetX = targetNode.position.x;
      const targetY = targetNode.position.y + 50;

      // Draw line
      ctx.strokeStyle = selectedElement?.id === connection.id ? '#1976d2' : '#757575';
      ctx.lineWidth = selectedElement?.id === connection.id ? 2 : 1;
      ctx.setLineDash(connection.type === 'trust' ? [5, 5] : []);
      
      ctx.beginPath();
      ctx.moveTo(sourceX, sourceY);
      
      // Draw smooth curve
      const controlX = (sourceX + targetX) / 2;
      ctx.bezierCurveTo(controlX, sourceY, controlX, targetY, targetX, targetY);
      
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw arrow
      const angle = Math.atan2(targetY - sourceY, targetX - sourceX);
      const arrowLength = 10;
      ctx.beginPath();
      ctx.moveTo(targetX, targetY);
      ctx.lineTo(
        targetX - arrowLength * Math.cos(angle - Math.PI / 6),
        targetY - arrowLength * Math.sin(angle - Math.PI / 6)
      );
      ctx.moveTo(targetX, targetY);
      ctx.lineTo(
        targetX - arrowLength * Math.cos(angle + Math.PI / 6),
        targetY - arrowLength * Math.sin(angle + Math.PI / 6)
      );
      ctx.stroke();

      // Label
      if (connection.data.label) {
        const midX = (sourceX + targetX) / 2;
        const midY = (sourceY + targetY) / 2;
        
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(midX - 40, midY - 10, 80, 20);
        
        ctx.fillStyle = '#424242';
        ctx.font = '12px Roboto, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(connection.data.label, midX, midY);
      }
    };

    // Draw function
    const draw = () => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return;

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Save context
      ctx.save();

      // Apply pan and zoom
      ctx.translate(pan.x, pan.y);
      ctx.scale(zoom, zoom);

      // Draw grid
      if (showGrid) {
        const gridSize = 20;
        const width = canvas.width / zoom;
        const height = canvas.height / zoom;
        const offsetX = -pan.x / zoom;
        const offsetY = -pan.y / zoom;

        ctx.strokeStyle = '#e0e0e0';
        ctx.lineWidth = 0.5;

        for (let x = -offsetX % gridSize; x < width; x += gridSize) {
          ctx.beginPath();
          ctx.moveTo(x + offsetX, offsetY);
          ctx.lineTo(x + offsetX, height + offsetY);
          ctx.stroke();
        }

        for (let y = -offsetY % gridSize; y < height; y += gridSize) {
          ctx.beginPath();
          ctx.moveTo(offsetX, y + offsetY);
          ctx.lineTo(width + offsetX, y + offsetY);
          ctx.stroke();
        }
      }

      // Draw connections
      connections.forEach((connection) => drawConnection(ctx, connection));

      // Draw nodes
      nodes.forEach((node) => drawNode(ctx, node));

      // Restore context
      ctx.restore();
    };

    // Handle mouse down
    const handleMouseDown = (e: React.MouseEvent) => {
      const node = findNodeAtPosition(e.clientX, e.clientY);
      
      if (node) {
        onSelectElement(node);
        
        if (e.shiftKey) {
          // Start connection
          dragState.current = {
            ...dragState.current,
            isConnecting: true,
            connectionStart: node.id,
          };
        } else {
          // Start dragging
          const canvasPos = screenToCanvas(e.clientX, e.clientY);
          dragState.current = {
            isDragging: true,
            isConnecting: false,
            draggedNode: node,
            connectionStart: null,
            mouseStart: { x: e.clientX, y: e.clientY },
            elementStart: { x: node.position.x, y: node.position.y },
          };
        }
      } else {
        onSelectElement(null);
        
        // Start panning
        dragState.current = {
          ...dragState.current,
          isDragging: true,
          mouseStart: { x: e.clientX, y: e.clientY },
          elementStart: { x: pan.x, y: pan.y },
        };
      }
    };

    // Handle mouse move
    const handleMouseMove = (e: React.MouseEvent) => {
      if (dragState.current.isDragging) {
        if (dragState.current.draggedNode) {
          // Move node
          const deltaX = (e.clientX - dragState.current.mouseStart.x) / zoom;
          const deltaY = (e.clientY - dragState.current.mouseStart.y) / zoom;
          
          const updatedNode = {
            ...dragState.current.draggedNode,
            position: {
              x: dragState.current.elementStart.x + deltaX,
              y: dragState.current.elementStart.y + deltaY,
            },
          };
          
          onUpdateElement(updatedNode);
        } else {
          // Pan canvas
          const deltaX = e.clientX - dragState.current.mouseStart.x;
          const deltaY = e.clientY - dragState.current.mouseStart.y;
          
          onPanChange({
            x: dragState.current.elementStart.x + deltaX,
            y: dragState.current.elementStart.y + deltaY,
          });
        }
      }
    };

    // Handle mouse up
    const handleMouseUp = (e: React.MouseEvent) => {
      if (dragState.current.isConnecting && dragState.current.connectionStart) {
        const targetNode = findNodeAtPosition(e.clientX, e.clientY);
        if (targetNode && targetNode.id !== dragState.current.connectionStart) {
          onConnect(dragState.current.connectionStart, targetNode.id);
        }
      }
      
      dragState.current = {
        isDragging: false,
        isConnecting: false,
        draggedNode: null,
        connectionStart: null,
        mouseStart: { x: 0, y: 0 },
        elementStart: { x: 0, y: 0 },
      };
    };

    // Handle drag over
    const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
    };

    // Handle drop
    const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      const componentType = e.dataTransfer.getData('componentType');
      if (componentType) {
        onDrop(e, componentType);
      }
    };

    // Handle resize
    useEffect(() => {
      const handleResize = () => {
        if (canvasRef.current && containerRef.current) {
          canvasRef.current.width = containerRef.current.clientWidth;
          canvasRef.current.height = containerRef.current.clientHeight;
          draw();
        }
      };

      handleResize();
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Redraw on changes
    useEffect(() => {
      draw();
    }, [nodes, connections, selectedElement, showGrid, zoom, pan]);

    return (
      <Box
        ref={containerRef}
        sx={{
          width: '100%',
          height: '100%',
          cursor: dragState.current.isDragging ? 'grabbing' : 'grab',
          bgcolor: 'grey.50',
        }}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <canvas
          ref={canvasRef}
          style={{ display: 'block' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onContextMenu={(e) => {
            e.preventDefault();
            const node = findNodeAtPosition(e.clientX, e.clientY);
            onContextMenu(e, node || undefined);
          }}
        />
      </Box>
    );
  }
);