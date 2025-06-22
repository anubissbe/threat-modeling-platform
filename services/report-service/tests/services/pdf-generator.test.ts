import { PDFGeneratorService } from '../../src/services/pdf-generator.service';

describe('PDFGeneratorService', () => {
  let pdfGenerator: PDFGeneratorService;

  beforeEach(() => {
    pdfGenerator = new PDFGeneratorService();
  });

  afterEach(async () => {
    await pdfGenerator.shutdown();
  });

  describe('generatePDF', () => {
    it('should generate PDF from HTML content', async () => {
      const html = `
        <html>
          <head><title>Test Report</title></head>
          <body>
            <h1>Test Threat Model Report</h1>
            <p>This is a test report.</p>
          </body>
        </html>
      `;

      const pdfBuffer = await pdfGenerator.generatePDF(html, {
        filename: 'test-report.pdf',
      });

      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(0);
      expect(pdfBuffer.toString()).toBe('mock-pdf-content');
    });

    it('should apply branding options', async () => {
      const html = '<html><body><h1>Test</h1></body></html>';
      const branding = {
        primaryColor: '#FF0000',
        fontFamily: 'Arial',
        watermark: 'CONFIDENTIAL',
      };

      const pdfBuffer = await pdfGenerator.generatePDF(html, {
        branding,
      });

      expect(pdfBuffer).toBeInstanceOf(Buffer);
    });

    it('should handle custom PDF options', async () => {
      const html = '<html><body><h1>Test</h1></body></html>';
      const pdfOptions = {
        format: 'Letter' as const,
        margin: {
          top: '2cm',
          bottom: '2cm',
          left: '2cm',
          right: '2cm',
        },
      };

      const pdfBuffer = await pdfGenerator.generatePDF(html, {
        pdfOptions,
      });

      expect(pdfBuffer).toBeInstanceOf(Buffer);
    });
  });

  describe('generatePDFFromURL', () => {
    it('should generate PDF from URL', async () => {
      const url = 'https://example.com/report';

      const pdfBuffer = await pdfGenerator.generatePDFFromURL(url);

      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(0);
    });

    it('should handle cookies', async () => {
      const url = 'https://example.com/report';
      const cookies = [
        { name: 'session', value: 'test-session' },
      ];

      const pdfBuffer = await pdfGenerator.generatePDFFromURL(url, {
        cookies,
      });

      expect(pdfBuffer).toBeInstanceOf(Buffer);
    });
  });

  describe('generateScreenshot', () => {
    it('should generate screenshot from HTML', async () => {
      const html = '<html><body><h1>Test Screenshot</h1></body></html>';

      const screenshot = await pdfGenerator.generateScreenshot(html);

      expect(screenshot).toBeInstanceOf(Buffer);
      expect(screenshot.toString()).toBe('mock-screenshot');
    });

    it('should generate screenshot from URL', async () => {
      const url = 'https://example.com';

      const screenshot = await pdfGenerator.generateScreenshot(url, {
        isUrl: true,
        fullPage: true,
      });

      expect(screenshot).toBeInstanceOf(Buffer);
    });

    it('should capture specific element', async () => {
      const html = '<html><body><div id="chart">Chart</div></body></html>';

      const screenshot = await pdfGenerator.generateScreenshot(html, {
        selector: '#chart',
      });

      expect(screenshot).toBeInstanceOf(Buffer);
      expect(screenshot.toString()).toBe('mock-element-screenshot');
    });
  });

  describe('addWatermark', () => {
    it('should add watermark to PDF', async () => {
      const pdfBuffer = Buffer.from('original-pdf');
      const watermarkText = 'CONFIDENTIAL';

      const watermarkedPdf = await pdfGenerator.addWatermark(pdfBuffer, watermarkText);

      expect(watermarkedPdf).toBeInstanceOf(Buffer);
      // In the mock, it returns the original buffer
      expect(watermarkedPdf).toBe(pdfBuffer);
    });
  });

  describe('shutdown', () => {
    it('should shutdown browser gracefully', async () => {
      await pdfGenerator.initialize();
      await pdfGenerator.shutdown();

      // Should not throw
      expect(true).toBe(true);
    });
  });
});