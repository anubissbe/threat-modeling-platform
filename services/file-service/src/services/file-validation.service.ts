import * as fs from 'fs/promises';
import { fileTypeFromBuffer } from 'file-type';
import * as crypto from 'crypto';
import { config, getAllowedMimeTypes, getValidationRules, getFileCategories } from '../config';
import { logger, fileLogger } from '../utils/logger';
import { FileValidationRule } from '../types';

export class FileValidationService {
  private validationRules: FileValidationRule[];
  private allowedMimeTypes: string[];
  private fileCategories: any[];

  constructor() {
    this.validationRules = getValidationRules();
    this.allowedMimeTypes = getAllowedMimeTypes();
    this.fileCategories = getFileCategories();
  }

  async validateFile(
    buffer: Buffer,
    originalName: string,
    userId: string
  ): Promise<{ valid: boolean; errors: string[]; warnings: string[]; metadata?: any }> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const metadata: any = {};

    try {
      // File size validation
      if (buffer.length > config.MAX_FILE_SIZE) {
        errors.push(`File size (${buffer.length} bytes) exceeds maximum allowed size (${config.MAX_FILE_SIZE} bytes)`);
        fileLogger.validationFailed(originalName, 'file_size', `Size: ${buffer.length}`, userId);
      }

      // Empty file validation
      if (buffer.length === 0) {
        errors.push('File is empty');
        fileLogger.validationFailed(originalName, 'empty_file', 'Zero bytes', userId);
      }

      // File type detection
      const detectedType = await fileTypeFromBuffer(buffer);
      const extension = this.getFileExtension(originalName);
      
      metadata.detectedMimeType = detectedType?.mime;
      metadata.detectedExtension = detectedType?.ext;
      metadata.originalExtension = extension;

      // MIME type validation
      if (!detectedType) {
        warnings.push('Could not detect file type, proceeding with caution');
      } else {
        // Check if detected type is allowed
        if (!this.isMimeTypeAllowed(detectedType.mime)) {
          errors.push(`File type '${detectedType.mime}' is not allowed`);
          fileLogger.validationFailed(originalName, 'mime_type', detectedType.mime, userId);
        }

        // Check extension mismatch
        if (extension && detectedType.ext && extension !== detectedType.ext) {
          warnings.push(`File extension '${extension}' does not match detected type '${detectedType.ext}'`);
        }
      }

      // Filename validation
      const filenameValidation = this.validateFilename(originalName);
      if (!filenameValidation.valid) {
        errors.push(...filenameValidation.errors);
      }

      // Content validation
      const contentValidation = await this.validateFileContent(buffer, detectedType?.mime, originalName);
      if (!contentValidation.valid) {
        errors.push(...contentValidation.errors);
      }
      warnings.push(...contentValidation.warnings);

      // Virus scanning (if enabled)
      if (config.ENABLE_VIRUS_SCAN) {
        const scanResult = await this.scanForViruses(buffer, originalName);
        if (!scanResult.clean) {
          errors.push(`File contains threats: ${scanResult.threats?.join(', ')}`);
        }
        metadata.virusScanResult = scanResult;
      }

      // Calculate file hash
      metadata.sha256 = this.calculateFileHash(buffer);
      metadata.md5 = this.calculateFileHash(buffer, 'md5');

      // Category classification
      const category = this.classifyFile(detectedType?.mime || '', originalName);
      metadata.category = category;

      // Category-specific validation
      if (category) {
        const categoryValidation = this.validateFileCategory(buffer, category, originalName);
        if (!categoryValidation.valid) {
          errors.push(...categoryValidation.errors);
        }
        warnings.push(...categoryValidation.warnings);
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        metadata,
      };
    } catch (error: any) {
      logger.error('File validation error:', error);
      return {
        valid: false,
        errors: [`Validation failed: ${error.message}`],
        warnings,
      };
    }
  }

  private validateFilename(filename: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Length check
    if (filename.length > 255) {
      errors.push('Filename is too long (max 255 characters)');
    }

    if (filename.length === 0) {
      errors.push('Filename cannot be empty');
    }

    // Character validation
    const invalidChars = /[<>:"/\\|?*\x00-\x1f]/;
    if (invalidChars.test(filename)) {
      errors.push('Filename contains invalid characters');
    }

    // Reserved names (Windows)
    const reservedNames = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\.|$)/i;
    if (reservedNames.test(filename)) {
      errors.push('Filename uses a reserved name');
    }

    // Leading/trailing spaces or dots
    if (filename.trim() !== filename || filename.endsWith('.')) {
      errors.push('Filename cannot start/end with spaces or end with dots');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  private async validateFileContent(
    buffer: Buffer,
    mimeType: string | undefined,
    filename: string
  ): Promise<{ valid: boolean; errors: string[]; warnings: string[] }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Image-specific validation
      if (mimeType?.startsWith('image/')) {
        const imageValidation = await this.validateImageContent(buffer);
        if (!imageValidation.valid) {
          errors.push(...imageValidation.errors);
        }
        warnings.push(...imageValidation.warnings);
      }

      // PDF validation
      if (mimeType === 'application/pdf') {
        const pdfValidation = this.validatePDFContent(buffer);
        if (!pdfValidation.valid) {
          errors.push(...pdfValidation.errors);
        }
      }

      // Text file validation
      if (mimeType?.startsWith('text/') || mimeType === 'application/json' || mimeType === 'application/xml') {
        const textValidation = this.validateTextContent(buffer);
        if (!textValidation.valid) {
          errors.push(...textValidation.errors);
        }
      }

      // Archive validation
      if (this.isArchiveType(mimeType)) {
        const archiveValidation = await this.validateArchiveContent(buffer, mimeType);
        if (!archiveValidation.valid) {
          errors.push(...archiveValidation.errors);
        }
        warnings.push(...archiveValidation.warnings);
      }

      return { valid: errors.length === 0, errors, warnings };
    } catch (error: any) {
      return {
        valid: false,
        errors: [`Content validation failed: ${error.message}`],
        warnings,
      };
    }
  }

  private async validateImageContent(buffer: Buffer): Promise<{ valid: boolean; errors: string[]; warnings: string[] }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Import sharp dynamically for image validation
      const sharp = await import('sharp');
      const metadata = await sharp.default(buffer).metadata();

      // Dimension validation
      if (!metadata.width || !metadata.height) {
        errors.push('Invalid image: no dimensions detected');
        return { valid: false, errors, warnings };
      }

      // Maximum dimension check
      const maxDimension = 50000; // 50k pixels
      if (metadata.width > maxDimension || metadata.height > maxDimension) {
        errors.push(`Image dimensions too large: ${metadata.width}x${metadata.height} (max: ${maxDimension}x${maxDimension})`);
      }

      // Aspect ratio check (very wide or very tall images might be suspicious)
      const aspectRatio = metadata.width / metadata.height;
      if (aspectRatio > 100 || aspectRatio < 0.01) {
        warnings.push('Unusual aspect ratio detected');
      }

      // Check for excessive number of channels
      if (metadata.channels && metadata.channels > 4) {
        warnings.push('Image has unusually high number of channels');
      }

      return { valid: errors.length === 0, errors, warnings };
    } catch (error: any) {
      return {
        valid: false,
        errors: [`Image validation failed: ${error.message}`],
        warnings,
      };
    }
  }

  private validatePDFContent(buffer: Buffer): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Basic PDF header validation
    if (!buffer.subarray(0, 4).equals(Buffer.from('%PDF'))) {
      errors.push('Invalid PDF: missing PDF header');
    }

    // Check for PDF trailer
    const trailer = buffer.subarray(-1024).toString('ascii');
    if (!trailer.includes('%%EOF')) {
      errors.push('Invalid PDF: missing EOF marker');
    }

    return { valid: errors.length === 0, errors };
  }

  private validateTextContent(buffer: Buffer): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    try {
      // Try to decode as UTF-8
      const text = buffer.toString('utf-8');
      
      // Check for null bytes (suspicious in text files)
      if (text.includes('\0')) {
        errors.push('Text file contains null bytes');
      }

      // Check for extremely long lines (potential DoS)
      const lines = text.split('\n');
      const maxLineLength = 100000; // 100k characters
      
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].length > maxLineLength) {
          errors.push(`Line ${i + 1} is too long (${lines[i].length} characters, max: ${maxLineLength})`);
          break;
        }
      }

    } catch (error) {
      errors.push('File is not valid UTF-8 text');
    }

    return { valid: errors.length === 0, errors };
  }

  private async validateArchiveContent(
    buffer: Buffer,
    mimeType: string | undefined
  ): Promise<{ valid: boolean; errors: string[]; warnings: string[] }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // ZIP file validation
    if (mimeType === 'application/zip') {
      // Check ZIP header
      if (!buffer.subarray(0, 2).equals(Buffer.from('PK'))) {
        errors.push('Invalid ZIP file: missing ZIP header');
      }

      // Check for ZIP bomb indicators (excessive compression ratio)
      const compressionRatio = this.estimateCompressionRatio(buffer);
      if (compressionRatio > 1000) {
        warnings.push('High compression ratio detected - potential ZIP bomb');
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  private async scanForViruses(buffer: Buffer, filename: string): Promise<{ clean: boolean; threats?: string[] }> {
    try {
      // Mock virus scanning - in production, integrate with ClamAV or similar
      // This is a placeholder implementation
      
      // Simple pattern-based detection for demo purposes
      const suspiciousPatterns = [
        Buffer.from('X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*'), // EICAR test
      ];

      const threats: string[] = [];
      
      for (const pattern of suspiciousPatterns) {
        if (buffer.includes(pattern)) {
          threats.push('EICAR-Test-File');
        }
      }

      const clean = threats.length === 0;
      fileLogger.scanResult(crypto.randomUUID(), filename, clean, threats);

      return { clean, threats: threats.length > 0 ? threats : undefined };
    } catch (error: any) {
      logger.error('Virus scan failed:', error);
      return { clean: false, threats: ['Scan failed'] };
    }
  }

  private isMimeTypeAllowed(mimeType: string): boolean {
    return this.allowedMimeTypes.some(allowed => {
      if (allowed.endsWith('/*')) {
        return mimeType.startsWith(allowed.slice(0, -1));
      }
      return mimeType === allowed;
    });
  }

  private getFileExtension(filename: string): string {
    const lastDot = filename.lastIndexOf('.');
    return lastDot === -1 ? '' : filename.slice(lastDot + 1).toLowerCase();
  }

  private classifyFile(mimeType: string, filename: string): any {
    return this.fileCategories.find(category => 
      category.mimeTypes.includes(mimeType) ||
      category.allowedExtensions.includes(`.${this.getFileExtension(filename)}`)
    );
  }

  private validateFileCategory(
    buffer: Buffer,
    category: any,
    filename: string
  ): { valid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Size validation for category
    if (category.maxSize && buffer.length > category.maxSize) {
      errors.push(`File size exceeds category limit: ${buffer.length} > ${category.maxSize} bytes`);
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  private calculateFileHash(buffer: Buffer, algorithm: string = 'sha256'): string {
    return crypto.createHash(algorithm).update(buffer).digest('hex');
  }

  private isArchiveType(mimeType: string | undefined): boolean {
    const archiveTypes = [
      'application/zip',
      'application/x-tar',
      'application/gzip',
      'application/x-rar-compressed',
      'application/x-7z-compressed',
    ];
    
    return mimeType ? archiveTypes.includes(mimeType) : false;
  }

  private estimateCompressionRatio(buffer: Buffer): number {
    // Simple heuristic for compression ratio estimation
    // In a real implementation, you would parse the archive structure
    const uniqueBytes = new Set(buffer);
    const entropy = uniqueBytes.size / 256;
    
    // Lower entropy suggests higher compression
    return entropy < 0.1 ? 1000 : 1;
  }

  // Security-focused validations
  async checkForMaliciousPatterns(buffer: Buffer, filename: string): Promise<{ safe: boolean; issues: string[] }> {
    const issues: string[] = [];

    try {
      // Check for embedded executables in non-executable files
      if (!this.isExecutableType(filename)) {
        if (this.containsExecutablePatterns(buffer)) {
          issues.push('File contains executable code patterns');
        }
      }

      // Check for script injection patterns
      const scriptPatterns = [
        /<script[\s\S]*?>[\s\S]*?<\/script>/i,
        /javascript:/i,
        /data:.*base64/i,
        /eval\s*\(/i,
        /document\.write/i,
      ];

      const content = buffer.toString('utf-8', 0, Math.min(buffer.length, 10000));
      for (const pattern of scriptPatterns) {
        if (pattern.test(content)) {
          issues.push('File contains potentially malicious script patterns');
          break;
        }
      }

      // Check for suspicious metadata
      if (this.hasSuspiciousMetadata(buffer)) {
        issues.push('File contains suspicious metadata');
      }

      return {
        safe: issues.length === 0,
        issues,
      };
    } catch (error) {
      return {
        safe: false,
        issues: ['Security validation failed'],
      };
    }
  }

  private isExecutableType(filename: string): boolean {
    const executableExtensions = ['.exe', '.bat', '.cmd', '.sh', '.ps1', '.scr', '.com', '.pif'];
    const extension = this.getFileExtension(filename);
    return executableExtensions.includes(`.${extension}`);
  }

  private containsExecutablePatterns(buffer: Buffer): boolean {
    // Check for PE header (Windows executables)
    if (buffer.length >= 64 && buffer.subarray(0, 2).equals(Buffer.from('MZ'))) {
      const peOffset = buffer.readUInt32LE(60);
      if (peOffset < buffer.length - 4 && buffer.subarray(peOffset, peOffset + 2).equals(Buffer.from('PE'))) {
        return true;
      }
    }

    // Check for ELF header (Linux executables)
    if (buffer.length >= 4 && buffer.subarray(0, 4).equals(Buffer.from([0x7f, 0x45, 0x4c, 0x46]))) {
      return true;
    }

    // Check for Mach-O header (macOS executables)
    const machOSignatures = [
      Buffer.from([0xfe, 0xed, 0xfa, 0xce]), // 32-bit big-endian
      Buffer.from([0xce, 0xfa, 0xed, 0xfe]), // 32-bit little-endian
      Buffer.from([0xfe, 0xed, 0xfa, 0xcf]), // 64-bit big-endian
      Buffer.from([0xcf, 0xfa, 0xed, 0xfe]), // 64-bit little-endian
    ];

    for (const signature of machOSignatures) {
      if (buffer.length >= 4 && buffer.subarray(0, 4).equals(signature)) {
        return true;
      }
    }

    return false;
  }

  private hasSuspiciousMetadata(buffer: Buffer): boolean {
    // Check for common metadata injection patterns
    const content = buffer.toString('utf-8', 0, Math.min(buffer.length, 1000));
    
    // EXIF injection patterns
    if (content.includes('<?php') || content.includes('<%') || content.includes('<script')) {
      return true;
    }

    return false;
  }
}

// Export singleton instance
export const fileValidationService = new FileValidationService();