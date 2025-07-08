import { createCanvas, loadImage, Canvas } from 'canvas';
import sharp from 'sharp';
import { DiagramData, ExportFormat } from '../types/diagram.types';
import { logger } from '../utils/logger';

export class DiagramRenderer {
  private readonly ELEMENT_STYLES = {
    process: {
      shape: 'ellipse',
      fillColor: '#E3F2FD',
      strokeColor: '#1976D2',
      strokeWidth: 2
    },
    data_store: {
      shape: 'rectangle',
      fillColor: '#F3E5F5',
      strokeColor: '#7B1FA2',
      strokeWidth: 2
    },
    external_entity: {
      shape: 'rectangle',
      fillColor: '#E8F5E8',
      strokeColor: '#388E3C',
      strokeWidth: 2
    },
    trust_boundary: {
      shape: 'dashed-rectangle',
      fillColor: 'transparent',
      strokeColor: '#F44336',
      strokeWidth: 3
    }
  };

  async renderDiagram(diagram: DiagramData, format: ExportFormat): Promise<Buffer> {
    const scale = format.scale || 1;
    const quality = format.quality || 90;
    
    const canvas = createCanvas(
      diagram.canvas.width * scale,
      diagram.canvas.height * scale
    );
    
    const ctx = canvas.getContext('2d');
    
    // Set scale
    ctx.scale(scale, scale);
    
    // Clear canvas with white background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, diagram.canvas.width, diagram.canvas.height);

    // Draw elements
    for (const element of diagram.elements) {
      await this.drawElement(ctx, element);
    }

    // Draw connections
    for (const connection of diagram.connections) {
      this.drawConnection(ctx, connection, diagram);
    }

    // Add metadata if requested
    if (format.includeMetadata) {
      this.drawMetadata(ctx, diagram);
    }

    return this.convertCanvas(canvas, format, quality);
  }

  private async drawElement(ctx: any, element: any): Promise<void> {
    const { position, dimensions, type, label, style } = element;
    const elementStyle = { ...this.ELEMENT_STYLES[type as keyof typeof this.ELEMENT_STYLES], ...style };

    ctx.save();
    
    // Set styles
    ctx.fillStyle = elementStyle.fillColor;
    ctx.strokeStyle = elementStyle.strokeColor;
    ctx.lineWidth = elementStyle.strokeWidth;

    // Draw shape based on type
    switch (elementStyle.shape) {
      case 'ellipse':
        this.drawEllipse(ctx, position.x, position.y, dimensions.width, dimensions.height);
        break;
      
      case 'rectangle':
        ctx.fillRect(position.x, position.y, dimensions.width, dimensions.height);
        ctx.strokeRect(position.x, position.y, dimensions.width, dimensions.height);
        break;
      
      case 'dashed-rectangle':
        ctx.setLineDash([10, 5]);
        ctx.strokeRect(position.x, position.y, dimensions.width, dimensions.height);
        ctx.setLineDash([]);
        break;
    }

    // Draw label
    this.drawText(ctx, label, {
      x: position.x + dimensions.width / 2,
      y: position.y + dimensions.height / 2,
      fontSize: style?.fontSize || 12,
      color: style?.textColor || '#000000',
      align: 'center'
    });

    ctx.restore();
  }

  private drawConnection(ctx: any, connection: any, diagram: DiagramData): void {
    const sourceElement = diagram.elements.find(el => el.id === connection.sourceId);
    const targetElement = diagram.elements.find(el => el.id === connection.targetId);

    if (!sourceElement || !targetElement) {
      logger.warn('Connection references missing element', { connectionId: connection.id });
      return;
    }

    const startPoint = {
      x: sourceElement.position.x + sourceElement.dimensions.width / 2,
      y: sourceElement.position.y + sourceElement.dimensions.height / 2
    };

    const endPoint = {
      x: targetElement.position.x + targetElement.dimensions.width / 2,
      y: targetElement.position.y + targetElement.dimensions.height / 2
    };

    ctx.save();
    
    // Set connection style
    ctx.strokeStyle = connection.style?.strokeColor || '#666666';
    ctx.lineWidth = connection.style?.strokeWidth || 2;
    
    if (connection.style?.strokeStyle === 'dashed') {
      ctx.setLineDash([8, 4]);
    } else if (connection.style?.strokeStyle === 'dotted') {
      ctx.setLineDash([2, 4]);
    }

    // Draw line
    ctx.beginPath();
    ctx.moveTo(startPoint.x, startPoint.y);
    ctx.lineTo(endPoint.x, endPoint.y);
    ctx.stroke();

    // Draw arrow head
    this.drawArrowHead(ctx, startPoint, endPoint);

    // Draw label if exists
    if (connection.label) {
      const midPoint = {
        x: (startPoint.x + endPoint.x) / 2,
        y: (startPoint.y + endPoint.y) / 2
      };
      
      this.drawText(ctx, connection.label, {
        x: midPoint.x,
        y: midPoint.y - 10,
        fontSize: 10,
        color: '#333333',
        align: 'center',
        background: true
      });
    }

    ctx.restore();
  }

  private drawEllipse(ctx: any, x: number, y: number, width: number, height: number): void {
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    const radiusX = width / 2;
    const radiusY = height / 2;

    ctx.beginPath();
    ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();
  }

  private drawArrowHead(ctx: any, start: { x: number; y: number }, end: { x: number; y: number }): void {
    const headLength = 10;
    const angle = Math.atan2(end.y - start.y, end.x - start.x);

    ctx.beginPath();
    ctx.moveTo(end.x, end.y);
    ctx.lineTo(
      end.x - headLength * Math.cos(angle - Math.PI / 6),
      end.y - headLength * Math.sin(angle - Math.PI / 6)
    );
    ctx.moveTo(end.x, end.y);
    ctx.lineTo(
      end.x - headLength * Math.cos(angle + Math.PI / 6),
      end.y - headLength * Math.sin(angle + Math.PI / 6)
    );
    ctx.stroke();
  }

  private drawText(ctx: any, text: string, options: {
    x: number;
    y: number;
    fontSize: number;
    color: string;
    align: string;
    background?: boolean;
  }): void {
    ctx.save();
    
    ctx.font = `${options.fontSize}px Arial`;
    ctx.fillStyle = options.color;
    ctx.textAlign = options.align;
    ctx.textBaseline = 'middle';

    // Draw background if requested
    if (options.background) {
      const metrics = ctx.measureText(text);
      const padding = 4;
      
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.fillRect(
        options.x - metrics.width / 2 - padding,
        options.y - options.fontSize / 2 - padding,
        metrics.width + padding * 2,
        options.fontSize + padding * 2
      );
      
      ctx.fillStyle = options.color;
    }

    ctx.fillText(text, options.x, options.y);
    ctx.restore();
  }

  private drawMetadata(ctx: any, diagram: DiagramData): void {
    const metadata = [
      `Name: ${diagram.name}`,
      `Updated: ${new Date(diagram.metadata.updated_at).toLocaleDateString()}`,
      `Elements: ${diagram.elements.length}`,
      `Connections: ${diagram.connections.length}`
    ];

    ctx.save();
    ctx.font = '10px Arial';
    ctx.fillStyle = '#666666';

    metadata.forEach((line, index) => {
      ctx.fillText(line, 10, diagram.canvas.height - 60 + (index * 15));
    });

    ctx.restore();
  }

  private async convertCanvas(canvas: Canvas, format: ExportFormat, quality: number): Promise<Buffer> {
    switch (format.format) {
      case 'png':
        return canvas.toBuffer('image/png');
      
      case 'svg':
        // Note: Canvas doesn't directly support SVG export
        // This would need a different approach using SVG libraries
        throw new Error('SVG export not yet implemented');
      
      case 'pdf':
        // For PDF, we'd convert PNG to PDF using a library like PDFKit
        const pngBuffer = canvas.toBuffer('image/png');
        return await this.convertToPDF(pngBuffer);
      
      default:
        throw new Error(`Unsupported format: ${format.format}`);
    }
  }

  private async convertToPDF(imageBuffer: Buffer): Promise<Buffer> {
    // This is a placeholder - would need PDFKit or similar library
    // For now, return the PNG buffer
    logger.warn('PDF conversion not implemented, returning PNG');
    return imageBuffer;
  }
}