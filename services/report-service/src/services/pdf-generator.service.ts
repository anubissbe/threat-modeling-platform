import puppeteer, { Browser, Page, PDFOptions } from 'puppeteer';
import { config } from '../config';
import { logger, reportLogger } from '../utils/logger';
import { ReportGenerationResult, BrandingOptions } from '../types';
import * as fs from 'fs/promises';
import * as path from 'path';

export class PDFGeneratorService {
  private browser: Browser | null = null;
  private isInitialized = false;

  /**
   * Initialize Puppeteer browser
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      this.browser = await puppeteer.launch({
        headless: config.PUPPETEER_HEADLESS,
        executablePath: config.PUPPETEER_EXECUTABLE_PATH,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
        ],
      });
      
      this.isInitialized = true;
      logger.info('PDF generator initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize PDF generator:', error);
      throw error;
    }
  }

  /**
   * Generate PDF from HTML content
   */
  async generatePDF(
    html: string,
    options?: {
      filename?: string;
      pdfOptions?: PDFOptions;
      branding?: BrandingOptions;
      metadata?: Record<string, string>;
    }
  ): Promise<Buffer> {
    const startTime = Date.now();
    
    if (!this.browser) {
      await this.initialize();
    }

    let page: Page | null = null;

    try {
      page = await this.browser!.newPage();

      // Set viewport
      await page.setViewport({
        width: 1200,
        height: 1600,
        deviceScaleFactor: 2,
      });

      // Apply branding styles if provided
      if (options?.branding) {
        const brandingStyles = this.generateBrandingStyles(options.branding);
        html = this.injectStyles(html, brandingStyles);
      }

      // Set content
      await page.setContent(html, {
        waitUntil: ['domcontentloaded', 'networkidle0'],
        timeout: 30000,
      });

      // Wait for any charts or images to render
      await page.waitForTimeout(2000);

      // Generate PDF
      const pdfOptions: PDFOptions = {
        format: config.PDF_PAGE_SIZE as any,
        margin: {
          top: config.PDF_MARGIN,
          right: config.PDF_MARGIN,
          bottom: config.PDF_MARGIN,
          left: config.PDF_MARGIN,
        },
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: this.generateHeaderTemplate(options?.branding),
        footerTemplate: this.generateFooterTemplate(options?.branding),
        preferCSSPageSize: false,
        ...options?.pdfOptions,
      };

      const pdfBuffer = await page.pdf(pdfOptions);

      const duration = Date.now() - startTime;
      reportLogger.performanceMetric('pdf-generation', duration, {
        size: pdfBuffer.length,
        pages: await this.countPDFPages(pdfBuffer),
      });

      return pdfBuffer;

    } catch (error) {
      logger.error('PDF generation failed:', error);
      throw error;
    } finally {
      if (page) {
        await page.close();
      }
    }
  }

  /**
   * Generate PDF from URL
   */
  async generatePDFFromURL(
    url: string,
    options?: {
      filename?: string;
      pdfOptions?: PDFOptions;
      waitForSelector?: string;
      cookies?: Array<{ name: string; value: string; domain?: string }>;
    }
  ): Promise<Buffer> {
    const startTime = Date.now();
    
    if (!this.browser) {
      await this.initialize();
    }

    let page: Page | null = null;

    try {
      page = await this.browser!.newPage();

      // Set cookies if provided
      if (options?.cookies) {
        await page.setCookie(...options.cookies);
      }

      // Navigate to URL
      await page.goto(url, {
        waitUntil: ['domcontentloaded', 'networkidle0'],
        timeout: 60000,
      });

      // Wait for specific selector if provided
      if (options?.waitForSelector) {
        await page.waitForSelector(options.waitForSelector, {
          timeout: 30000,
        });
      }

      // Generate PDF
      const pdfBuffer = await page.pdf({
        format: 'A4',
        margin: {
          top: '20mm',
          right: '20mm',
          bottom: '20mm',
          left: '20mm',
        },
        printBackground: true,
        ...options?.pdfOptions,
      });

      const duration = Date.now() - startTime;
      reportLogger.performanceMetric('pdf-from-url-generation', duration, {
        url,
        size: pdfBuffer.length,
      });

      return pdfBuffer;

    } catch (error) {
      logger.error('PDF from URL generation failed:', error);
      throw error;
    } finally {
      if (page) {
        await page.close();
      }
    }
  }

  /**
   * Generate screenshot
   */
  async generateScreenshot(
    htmlOrUrl: string,
    options?: {
      isUrl?: boolean;
      fullPage?: boolean;
      selector?: string;
      format?: 'png' | 'jpeg' | 'webp';
      quality?: number;
    }
  ): Promise<Buffer> {
    if (!this.browser) {
      await this.initialize();
    }

    let page: Page | null = null;

    try {
      page = await this.browser!.newPage();

      if (options?.isUrl) {
        await page.goto(htmlOrUrl, {
          waitUntil: ['domcontentloaded', 'networkidle0'],
        });
      } else {
        await page.setContent(htmlOrUrl, {
          waitUntil: ['domcontentloaded', 'networkidle0'],
        });
      }

      const screenshotOptions: any = {
        fullPage: options?.fullPage ?? false,
        type: options?.format ?? 'png',
      };

      if (options?.quality && options.format === 'jpeg') {
        screenshotOptions.quality = options.quality;
      }

      let screenshotBuffer: Buffer;

      if (options?.selector) {
        const element = await page.$(options.selector);
        if (!element) {
          throw new Error(`Selector not found: ${options.selector}`);
        }
        screenshotBuffer = await element.screenshot(screenshotOptions);
      } else {
        screenshotBuffer = await page.screenshot(screenshotOptions);
      }

      return screenshotBuffer;

    } catch (error) {
      logger.error('Screenshot generation failed:', error);
      throw error;
    } finally {
      if (page) {
        await page.close();
      }
    }
  }

  /**
   * Generate branding styles
   */
  private generateBrandingStyles(branding: BrandingOptions): string {
    return `
      <style>
        :root {
          --primary-color: ${branding.primaryColor || '#1a73e8'};
          --secondary-color: ${branding.secondaryColor || '#5f6368'};
          --font-family: ${branding.fontFamily || 'Arial, sans-serif'};
        }
        
        body {
          font-family: var(--font-family);
        }
        
        h1, h2, h3, h4, h5, h6 {
          color: var(--primary-color);
        }
        
        .watermark {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%) rotate(-45deg);
          font-size: 120px;
          color: rgba(0, 0, 0, 0.05);
          z-index: -1;
          user-select: none;
        }
        
        ${branding.logo ? `
        .logo {
          max-height: 60px;
          max-width: 200px;
        }
        ` : ''}
      </style>
    `;
  }

  /**
   * Inject styles into HTML
   */
  private injectStyles(html: string, styles: string): string {
    // If there's already a </head> tag, inject before it
    if (html.includes('</head>')) {
      return html.replace('</head>', `${styles}</head>`);
    }
    
    // Otherwise, add at the beginning
    return styles + html;
  }

  /**
   * Generate header template
   */
  private generateHeaderTemplate(branding?: BrandingOptions): string {
    return `
      <div style="width: 100%; padding: 10px 30px; font-size: 10px; display: flex; justify-content: space-between; align-items: center;">
        <div style="display: flex; align-items: center;">
          ${branding?.logo ? `<img src="${branding.logo}" style="max-height: 30px; margin-right: 10px;" />` : ''}
          <span style="color: #666;">${branding?.headerText || 'Threat Modeling Report'}</span>
        </div>
        <div style="color: #666;">
          <span class="date"></span>
        </div>
      </div>
    `;
  }

  /**
   * Generate footer template
   */
  private generateFooterTemplate(branding?: BrandingOptions): string {
    return `
      <div style="width: 100%; padding: 10px 30px; font-size: 10px; display: flex; justify-content: space-between; align-items: center;">
        <div style="color: #666;">
          ${branding?.footerText || '© Threat Modeling Application'}
        </div>
        <div style="color: #666;">
          Page <span class="pageNumber"></span> of <span class="totalPages"></span>
        </div>
      </div>
    `;
  }

  /**
   * Count PDF pages (simplified - actual implementation would parse PDF)
   */
  private async countPDFPages(pdfBuffer: Buffer): Promise<number> {
    // This is a simplified version. In production, you'd use a PDF parsing library
    // to accurately count pages
    const size = pdfBuffer.length;
    const estimatedPages = Math.ceil(size / (1024 * 100)); // Rough estimate
    return Math.max(1, estimatedPages);
  }

  /**
   * Merge multiple PDFs
   */
  async mergePDFs(pdfBuffers: Buffer[]): Promise<Buffer> {
    // This would use a library like pdf-lib or pdfkit to merge PDFs
    // For now, returning a placeholder implementation
    logger.warn('PDF merging not yet implemented');
    return pdfBuffers[0] || Buffer.from('');
  }

  /**
   * Add watermark to PDF
   */
  async addWatermark(
    pdfBuffer: Buffer,
    watermarkText: string,
    options?: {
      opacity?: number;
      angle?: number;
      fontSize?: number;
    }
  ): Promise<Buffer> {
    // This would use a library like pdf-lib to add watermarks
    // For now, returning the original buffer
    logger.warn('PDF watermarking not yet implemented');
    return pdfBuffer;
  }

  /**
   * Shutdown browser
   */
  async shutdown(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.isInitialized = false;
      logger.info('PDF generator shut down');
    }
  }
}