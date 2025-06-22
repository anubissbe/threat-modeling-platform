# Report Generation Service

Professional report generation service for creating PDF, HTML, and other format reports from threat model data.

## Overview

The Report Generation Service provides comprehensive report generation capabilities with support for multiple formats, customizable templates, charts and visualizations, and queue-based processing for scalability.

## Features

### 1. Multiple Report Formats
- **PDF**: Professional PDF reports with full styling and branding
- **HTML**: Interactive HTML reports with embedded charts
- **Markdown**: Exportable markdown format
- **JSON**: Structured data export

### 2. Report Types
- **Threat Model Report**: Complete threat model documentation
- **Executive Summary**: High-level overview for management
- **Technical Detailed**: In-depth technical analysis
- **Compliance Report**: Compliance-focused documentation
- **Risk Assessment**: Risk analysis and scoring
- **Mitigation Plan**: Actionable mitigation strategies
- **Audit Log**: Historical audit trail

### 3. Advanced Features
- **Queue-based Processing**: Scalable report generation using BullMQ
- **Chart Generation**: Dynamic charts and visualizations
- **Template Engine**: Customizable Handlebars templates
- **Storage Options**: Local filesystem or S3 storage
- **Signed URLs**: Secure, time-limited download links
- **Branding**: Custom logos, colors, and styling
- **Watermarks**: Security watermarks for sensitive reports

## Architecture

```
report-service/
├── src/
│   ├── config/             # Configuration management
│   ├── controllers/        # API controllers
│   ├── middleware/         # Authentication middleware
│   ├── routes/            # API route definitions
│   ├── services/          # Core services
│   │   ├── pdf-generator.service.ts      # PDF generation
│   │   ├── html-generator.service.ts     # HTML generation
│   │   ├── chart-generator.service.ts    # Chart creation
│   │   ├── report-queue.service.ts       # Queue management
│   │   ├── report-generator.service.ts   # Main orchestrator
│   │   └── report-storage.service.ts     # Storage handling
│   ├── templates/         # Report templates
│   ├── types/             # TypeScript interfaces
│   ├── utils/             # Utilities
│   ├── app.ts            # Fastify application
│   └── server.ts         # Server entry point
├── templates/             # Report templates
│   ├── html/             # HTML templates
│   ├── pdf/              # PDF-specific templates
│   └── email/            # Email templates
├── tests/                # Test suites
└── assets/              # Static assets
```

## API Endpoints

### Report Generation

#### POST /api/reports/generate
Generate a new report.

```json
{
  "type": "threat-model",
  "format": "pdf",
  "projectId": "project-123",
  "threatModelId": "model-456",
  "options": {
    "includeExecutiveSummary": true,
    "includeDetailedThreats": true,
    "includeMitigations": true,
    "includeRiskMatrix": true,
    "includeCharts": true,
    "branding": {
      "logo": "https://example.com/logo.png",
      "primaryColor": "#1a73e8",
      "watermark": "CONFIDENTIAL"
    }
  }
}
```

#### GET /api/reports/status/:jobId
Check report generation status.

#### GET /api/reports/download/:reportId
Download a generated report.

#### GET /api/reports/url/:reportId
Get a signed URL for report download.

#### GET /api/reports
List user's reports with filtering options.

#### DELETE /api/reports/:reportId
Delete a report.

#### POST /api/reports/retry/:jobId
Retry a failed report generation job.

### Admin Endpoints

#### GET /api/reports/admin/queue/stats
Get queue statistics (admin only).

## Installation

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Start development server
npm run dev

# Start production server
npm start
```

## Configuration

### Environment Variables

```env
# Server Configuration
PORT=3007
HOST=0.0.0.0
NODE_ENV=development

# Security
JWT_SECRET=your-jwt-secret
CORS_ORIGINS=http://localhost:3000

# Redis Configuration
REDIS_URL=redis://localhost:6379
QUEUE_REDIS_URL=redis://localhost:6379

# Queue Configuration
QUEUE_CONCURRENCY=5
QUEUE_MAX_ATTEMPTS=3

# Storage Configuration
STORAGE_TYPE=local  # Options: local, s3
STORAGE_PATH=./reports

# S3 Configuration (if using S3)
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1
S3_BUCKET=threat-model-reports

# Report Configuration
REPORT_EXPIRY_DAYS=30
MAX_REPORT_SIZE_MB=50
REPORT_TIMEOUT_MS=300000

# PDF Generation
PUPPETEER_HEADLESS=true
PDF_PAGE_SIZE=A4
PDF_MARGIN=1cm

# Template Configuration
TEMPLATE_PATH=./templates
TEMPLATE_CACHE_TTL=3600

# Service URLs
AUTH_SERVICE_URL=http://localhost:3001
PROJECT_SERVICE_URL=http://localhost:3003
THREAT_ENGINE_URL=http://localhost:3004

# Rate Limiting
RATE_LIMIT_MAX=50
RATE_LIMIT_WINDOW=60000
```

## Template Customization

### HTML Templates

Templates are stored in `templates/html/` and use Handlebars syntax:

```handlebars
<!DOCTYPE html>
<html>
<head>
    <title>{{metadata.title}}</title>
</head>
<body>
    <h1>{{threatModel.name}}</h1>
    
    {{#each threats}}
    <div class="threat">
        <h3>{{title}}</h3>
        <p>{{description}}</p>
        {{severityBadge severity}}
    </div>
    {{/each}}
</body>
</html>
```

### Available Helpers

- `formatDate`: Format dates
- `severityBadge`: Render severity badges
- `statusBadge`: Render status badges
- `markdown`: Render markdown content
- `percentage`: Calculate percentages
- `riskColor`: Get color for risk scores

## Queue Management

The service uses BullMQ for reliable job processing:

```javascript
// Job priorities
const HIGH_PRIORITY = 10;
const NORMAL_PRIORITY = 0;
const LOW_PRIORITY = -10;

// Add job with options
await queueService.addReportJob(jobData, {
  priority: HIGH_PRIORITY,
  delay: 5000, // Delay 5 seconds
  attempts: 5,
  backoff: {
    type: 'exponential',
    delay: 2000,
  },
});
```

## Storage Options

### Local Storage
Reports are stored in the filesystem:
```
reports/
├── report-id-1/
│   ├── report.pdf
│   └── metadata.json
└── report-id-2/
    ├── report.html
    └── metadata.json
```

### S3 Storage
Reports are stored in S3 with the structure:
```
s3://bucket/reports/report-id/filename.pdf
```

## Chart Generation

The service generates various charts:

1. **Severity Distribution**: Pie chart of threat severities
2. **Risk Matrix**: Heat map of likelihood vs impact
3. **Component Risks**: Bar chart of component risk scores
4. **STRIDE Analysis**: Distribution of STRIDE categories
5. **Mitigation Progress**: Progress tracking charts

## Performance Optimization

1. **Template Caching**: Templates are cached in memory
2. **Queue Concurrency**: Configurable worker concurrency
3. **PDF Generation Pool**: Reusable Puppeteer instances
4. **Storage Streaming**: Stream large files efficiently

## Security

1. **JWT Authentication**: All endpoints require authentication
2. **Role-based Access**: Admin endpoints require admin role
3. **Project Access Control**: Users can only access their reports
4. **Signed URLs**: Time-limited download links
5. **Rate Limiting**: Protection against abuse

## Monitoring

The service provides comprehensive logging:

- Report generation metrics
- Queue statistics
- Storage operations
- Performance metrics

## Docker Support

```dockerfile
FROM node:18-alpine

# Install Puppeteer dependencies
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3007

CMD ["npm", "start"]
```

## Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test
npm test -- report.controller.test.ts
```

## Troubleshooting

### PDF Generation Issues
- Ensure Puppeteer dependencies are installed
- Check `PUPPETEER_EXECUTABLE_PATH` for custom Chrome
- Verify sufficient memory for PDF generation

### Queue Issues
- Check Redis connection
- Monitor queue dashboard
- Verify worker concurrency settings

### Storage Issues
- Check file permissions for local storage
- Verify S3 credentials and bucket access
- Monitor storage space

## Contributing

1. Follow TypeScript best practices
2. Add tests for new features
3. Update templates documentation
4. Test with multiple report formats

## License

MIT