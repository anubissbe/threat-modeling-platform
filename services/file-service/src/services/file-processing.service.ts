import sharp from 'sharp';
import { promisify } from 'util';
import * as crypto from 'crypto';
import { config, getThumbnailSizes } from '../config';
import { logger, fileLogger } from '../utils/logger';
import { FileProcessingOptions } from '../types';

export class FileProcessingService {
  constructor() {}

  async processImage(
    buffer: Buffer,
    options: FileProcessingOptions
  ): Promise<{ processed: Buffer; metadata: any }> {
    const startTime = Date.now();

    try {
      let image = sharp(buffer);
      
      // Get original metadata
      const metadata = await image.metadata();
      
      // Apply resize
      if (options.resize) {
        image = image.resize(options.resize.width, options.resize.height, {
          fit: options.resize.fit || 'inside',
          withoutEnlargement: true,
        });
      }

      // Apply compression
      if (options.compress || options.resize?.quality) {
        const quality = options.resize?.quality || options.compress?.quality || config.IMAGE_QUALITY;
        const progressive = options.compress?.progressive ?? true;
        
        if (metadata.format === 'jpeg' || options.format === 'jpeg') {
          image = image.jpeg({ quality, progressive });
        } else if (metadata.format === 'png' || options.format === 'png') {
          image = image.png({ quality, progressive });
        } else if (options.format === 'webp') {
          image = image.webp({ quality });
        } else if (options.format === 'avif') {
          image = image.avif({ quality });
        }
      }

      // Apply format conversion
      if (options.format && options.format !== metadata.format) {
        switch (options.format) {
          case 'jpeg':
            image = image.jpeg();
            break;
          case 'png':
            image = image.png();
            break;
          case 'webp':
            image = image.webp();
            break;
          case 'avif':
            image = image.avif();
            break;
        }
      }

      // Apply watermark
      if (options.watermark) {
        if (options.watermark.text) {
          // Text watermark
          const textSvg = this.createTextWatermark(
            options.watermark.text,
            metadata.width || 800,
            metadata.height || 600,
            options.watermark.position,
            options.watermark.opacity
          );
          
          image = image.composite([{
            input: Buffer.from(textSvg),
            gravity: this.getSharpGravity(options.watermark.position),
          }]);
        } else if (options.watermark.image) {
          // Image watermark
          image = image.composite([{
            input: options.watermark.image,
            gravity: this.getSharpGravity(options.watermark.position),
            blend: 'over',
          }]);
        }
      }

      const processed = await image.toBuffer();
      const newMetadata = await sharp(processed).metadata();

      const duration = Date.now() - startTime;
      fileLogger.performanceMetric('image-processing', duration, {
        originalSize: buffer.length,
        processedSize: processed.length,
        format: newMetadata.format,
        width: newMetadata.width,
        height: newMetadata.height,
      });

      return {
        processed,
        metadata: {
          format: newMetadata.format,
          width: newMetadata.width,
          height: newMetadata.height,
          size: processed.length,
          compressionRatio: buffer.length / processed.length,
        },
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      fileLogger.performanceMetric('image-processing-failed', duration);
      logger.error('Image processing failed:', error);
      throw new Error(`Image processing failed: ${error.message}`);
    }
  }

  async generateThumbnails(
    buffer: Buffer,
    fileId: string
  ): Promise<Array<{ size: string; buffer: Buffer; width: number; height: number }>> {
    const thumbnails = [];
    const sizes = getThumbnailSizes();

    for (const size of sizes) {
      const startTime = Date.now();

      try {
        const processed = await sharp(buffer)
          .resize(size.width, size.height, {
            fit: 'inside',
            withoutEnlargement: true,
          })
          .jpeg({ quality: 80, progressive: true })
          .toBuffer();

        const duration = Date.now() - startTime;
        fileLogger.thumbnailGenerated(fileId, `${size.width}x${size.height}`, duration);

        thumbnails.push({
          size: `${size.width}x${size.height}`,
          buffer: processed,
          width: size.width,
          height: size.height,
        });
      } catch (error: any) {
        logger.error(`Failed to generate ${size.width}x${size.height} thumbnail:`, error);
      }
    }

    return thumbnails;
  }

  async compressFile(buffer: Buffer, mimeType: string): Promise<Buffer> {
    // Only compress images for now
    if (!mimeType.startsWith('image/')) {
      return buffer;
    }

    try {
      const result = await this.processImage(buffer, {
        compress: {
          quality: config.IMAGE_QUALITY,
          progressive: true,
        },
      });

      return result.processed;
    } catch (error: any) {
      logger.error('File compression failed:', error);
      return buffer; // Return original if compression fails
    }
  }

  calculateChecksum(buffer: Buffer, algorithm: string = 'sha256'): string {
    return crypto.createHash(algorithm).update(buffer).digest('hex');
  }

  async getImageMetadata(buffer: Buffer): Promise<any> {
    try {
      const metadata = await sharp(buffer).metadata();
      return {
        format: metadata.format,
        width: metadata.width,
        height: metadata.height,
        channels: metadata.channels,
        density: metadata.density,
        hasAlpha: metadata.hasAlpha,
        isAnimated: metadata.pages && metadata.pages > 1,
        orientation: metadata.orientation,
        colorSpace: metadata.space,
      };
    } catch (error: any) {
      logger.error('Failed to get image metadata:', error);
      return null;
    }
  }

  private createTextWatermark(
    text: string,
    imageWidth: number,
    imageHeight: number,
    position: string = 'bottom-right',
    opacity: number = 0.5
  ): string {
    const fontSize = Math.max(12, Math.min(imageWidth, imageHeight) * 0.03);
    const padding = fontSize;

    let x = padding;
    let y = padding;
    let anchor = 'start';

    switch (position) {
      case 'top-left':
        x = padding;
        y = padding + fontSize;
        anchor = 'start';
        break;
      case 'top-right':
        x = imageWidth - padding;
        y = padding + fontSize;
        anchor = 'end';
        break;
      case 'bottom-left':
        x = padding;
        y = imageHeight - padding;
        anchor = 'start';
        break;
      case 'bottom-right':
        x = imageWidth - padding;
        y = imageHeight - padding;
        anchor = 'end';
        break;
      case 'center':
        x = imageWidth / 2;
        y = imageHeight / 2;
        anchor = 'middle';
        break;
    }

    return `
      <svg width="${imageWidth}" height="${imageHeight}">
        <text 
          x="${x}" 
          y="${y}" 
          font-family="Arial, sans-serif" 
          font-size="${fontSize}" 
          fill="white" 
          fill-opacity="${opacity}"
          text-anchor="${anchor}"
          stroke="black" 
          stroke-width="1" 
          stroke-opacity="${opacity * 0.5}"
        >${text}</text>
      </svg>
    `;
  }

  private getSharpGravity(position: string = 'bottom-right'): string {
    const gravityMap: Record<string, string> = {
      'top-left': 'northwest',
      'top-right': 'northeast',
      'bottom-left': 'southwest',
      'bottom-right': 'southeast',
      'center': 'center',
    };

    return gravityMap[position] || 'southeast';
  }

  // Advanced image processing methods
  async createWebOptimizedVersions(
    buffer: Buffer,
    fileId: string
  ): Promise<Array<{ format: string; buffer: Buffer; size: number }>> {
    const versions = [];

    // Original optimized version
    try {
      const optimized = await this.processImage(buffer, {
        compress: { quality: config.IMAGE_QUALITY, progressive: true },
      });
      
      versions.push({
        format: 'optimized',
        buffer: optimized.processed,
        size: optimized.processed.length,
      });
    } catch (error) {
      logger.error('Failed to create optimized version:', error);
    }

    // WebP version
    try {
      const webp = await this.processImage(buffer, {
        format: 'webp',
        compress: { quality: config.IMAGE_QUALITY },
      });
      
      versions.push({
        format: 'webp',
        buffer: webp.processed,
        size: webp.processed.length,
      });
    } catch (error) {
      logger.error('Failed to create WebP version:', error);
    }

    // AVIF version (if supported)
    try {
      const avif = await this.processImage(buffer, {
        format: 'avif',
        compress: { quality: config.IMAGE_QUALITY },
      });
      
      versions.push({
        format: 'avif',
        buffer: avif.processed,
        size: avif.processed.length,
      });
    } catch (error) {
      // AVIF might not be supported, so we silently ignore
      logger.debug('AVIF processing not available or failed');
    }

    logger.info(`Generated ${versions.length} web-optimized versions for file ${fileId}`);
    return versions;
  }

  async extractImageColors(buffer: Buffer): Promise<string[]> {
    try {
      const image = sharp(buffer);
      const { data, info } = await image
        .resize(100, 100, { fit: 'inside' })
        .raw()
        .toBuffer({ resolveWithObject: true });

      const colors = new Set<string>();
      const sampleSize = Math.min(1000, data.length / info.channels);

      for (let i = 0; i < sampleSize * info.channels; i += info.channels) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        // Convert to hex and add to set
        const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
        colors.add(hex);
        
        if (colors.size >= 10) break; // Limit to 10 dominant colors
      }

      return Array.from(colors);
    } catch (error: any) {
      logger.error('Failed to extract image colors:', error);
      return [];
    }
  }

  isImageFormat(mimeType: string): boolean {
    return mimeType.startsWith('image/');
  }

  isSupportedImageFormat(mimeType: string): boolean {
    const supportedFormats = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml',
      'image/tiff',
      'image/bmp',
    ];
    
    return supportedFormats.includes(mimeType);
  }

  async validateImage(buffer: Buffer): Promise<{ valid: boolean; error?: string; metadata?: any }> {
    try {
      const metadata = await sharp(buffer).metadata();
      
      // Basic validation
      if (!metadata.width || !metadata.height) {
        return { valid: false, error: 'Invalid image dimensions' };
      }

      if (metadata.width > 10000 || metadata.height > 10000) {
        return { valid: false, error: 'Image dimensions too large' };
      }

      return { valid: true, metadata };
    } catch (error: any) {
      return { valid: false, error: `Invalid image format: ${error.message}` };
    }
  }
}

// Export singleton instance
export const fileProcessingService = new FileProcessingService();