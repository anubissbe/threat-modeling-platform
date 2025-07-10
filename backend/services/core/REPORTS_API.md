# Project Reports API Documentation

## Overview

The Reports API provides comprehensive reporting capabilities for threat modeling projects, enabling automated generation of security assessments, vulnerability summaries, risk analyses, and executive reports.

## Authentication

All endpoints require JWT authentication via the `Authorization: Bearer <token>` header.

## Base URL
```
http://localhost:3002/api/projects/{projectId}/reports
```

## Report Types

The system supports multiple report types for different audiences and purposes:

### Security Reports
- `vulnerability_summary` - Comprehensive vulnerability analysis
- `threat_analysis` - Threat landscape and attack vector analysis  
- `risk_assessment` - Risk evaluation and prioritization
- `security_posture` - Overall security posture assessment

### Business Reports
- `executive_summary` - High-level summary for executive stakeholders
- `compliance_audit` - Compliance status and gap analysis
- `comparison_report` - Comparative analysis across projects or time periods

### Technical Reports
- `technical_deep_dive` - Detailed technical analysis for security teams
- `trend_analysis` - Trend and pattern analysis over time

## API Endpoints

### GET /api/projects/{projectId}/reports
List all reports for a specific project.

**Path Parameters:**
- `projectId` (required) - UUID of the project

**Query Parameters:**
- `reportType` - Filter by report type
- `status` - Filter by status (generating|completed|failed)
- `generatedBy` - Filter by user who generated the report
- `startDate` - Filter by generation start date (ISO 8601)
- `endDate` - Filter by generation end date (ISO 8601)
- `limit` (default: 20) - Number of results per page
- `offset` (default: 0) - Pagination offset

**Example Request:**
```bash
curl -X GET "http://localhost:3002/api/projects/proj-123/reports?reportType=vulnerability_summary&limit=10" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Example Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "report-456",
      "projectId": "proj-123",
      "projectName": "E-commerce Web Application",
      "reportType": "vulnerability_summary",
      "title": "Q4 2024 Vulnerability Assessment",
      "description": "Comprehensive vulnerability analysis for the e-commerce platform",
      "generatedAt": "2025-07-10T14:00:00.000Z",
      "generatedBy": "user-789",
      "organizationId": "org-456",
      "status": "completed",
      "metadata": {
        "format": "pdf",
        "includeCharts": true,
        "includeSummary": true,
        "includeRecommendations": true,
        "filters": {
          "severity": ["Critical", "High"],
          "status": ["open", "in_progress"]
        }
      },
      "content": {
        "summary": {
          "totalProjects": 1,
          "totalVulnerabilities": 15,
          "totalThreats": 8,
          "riskScore": 67,
          "keyFindings": [
            "15 vulnerabilities identified",
            "3 critical issues require immediate attention",
            "Security posture improved by 12% this month"
          ],
          "executiveSummary": "Security assessment reveals 15 vulnerabilities with 3 critical issues requiring immediate remediation.",
          "generationTime": 45
        }
      },
      "downloadUrl": null,
      "expiresAt": null
    }
  ],
  "total": 5,
  "limit": 10,
  "offset": 0
}
```

### POST /api/projects/{projectId}/reports
Generate a new report for the project.

**Path Parameters:**
- `projectId` (required) - UUID of the project

**Request Body:**
```json
{
  "reportType": "vulnerability_summary",
  "title": "Monthly Security Assessment",
  "description": "Comprehensive security analysis for January 2025",
  "metadata": {
    "format": "pdf",
    "includeCharts": true,
    "includeSummary": true,
    "includeRecommendations": true,
    "dateRange": {
      "start": "2025-01-01T00:00:00.000Z",
      "end": "2025-01-31T23:59:59.999Z"
    },
    "filters": {
      "severity": ["Critical", "High", "Medium"],
      "status": ["open", "in_progress"],
      "components": ["Authentication", "Database"],
      "tags": ["web-security", "api-security"]
    },
    "customFields": {
      "includeMetrics": true,
      "includeTimeline": true,
      "confidentialityLevel": "internal"
    }
  }
}
```

**Required Fields:**
- `reportType` - Type of report to generate
- `title` - Report title
- `metadata` - Report configuration and parameters

**Optional Fields:**
- `description` - Report description

**Example Request:**
```bash
curl -X POST "http://localhost:3002/api/projects/proj-123/reports" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "reportType": "executive_summary",
    "title": "Q4 Security Executive Summary",
    "description": "High-level security overview for executive team",
    "metadata": {
      "format": "pdf",
      "includeCharts": true,
      "includeSummary": true,
      "includeRecommendations": true
    }
  }'
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "id": "report-789",
    "projectId": "proj-123",
    "projectName": "E-commerce Web Application",
    "reportType": "executive_summary",
    "title": "Q4 Security Executive Summary",
    "description": "High-level security overview for executive team",
    "generatedAt": "2025-07-10T14:15:00.000Z",
    "generatedBy": "user-456",
    "organizationId": "org-123",
    "status": "completed",
    "metadata": {
      "format": "pdf",
      "includeCharts": true,
      "includeSummary": true,
      "includeRecommendations": true
    },
    "content": {
      "summary": {
        "totalProjects": 1,
        "totalVulnerabilities": 15,
        "totalThreats": 8,
        "riskScore": 67,
        "complianceScore": 82,
        "keyFindings": [
          "Overall security posture: MODERATE",
          "3 critical vulnerabilities require immediate action",
          "Compliance score improved to 82%"
        ],
        "executiveSummary": "The organization maintains a moderate security posture with focused attention needed on critical vulnerabilities and continued compliance improvements.",
        "generationTime": 120
      },
      "vulnerabilities": {
        "total": 15,
        "bySeverity": {
          "critical": 3,
          "high": 5,
          "medium": 4,
          "low": 3
        },
        "byStatus": {
          "open": 8,
          "inProgress": 4,
          "resolved": 3,
          "falsePositive": 0,
          "wontFix": 0
        },
        "trending": {
          "newThisWeek": 2,
          "resolvedThisWeek": 5,
          "avgResolutionTime": 7.2
        },
        "topVulnerabilities": [
          {
            "id": "vuln-001",
            "title": "SQL Injection in Login",
            "severity": "Critical",
            "cvssScore": 9.8,
            "component": "Authentication"
          }
        ]
      },
      "recommendations": {
        "immediate": [
          "Patch critical SQL injection vulnerability",
          "Implement multi-factor authentication"
        ],
        "shortTerm": [
          "Conduct security awareness training",
          "Update incident response procedures"
        ],
        "longTerm": [
          "Implement zero-trust architecture",
          "Establish security metrics dashboard"
        ],
        "strategic": [
          "Develop 3-year security roadmap",
          "Invest in security automation tools"
        ]
      }
    }
  },
  "message": "Report generated successfully"
}
```

### GET /api/projects/{projectId}/reports/{reportId}
Get a specific report by ID.

**Path Parameters:**
- `projectId` (required) - UUID of the project
- `reportId` (required) - UUID of the report

**Example Request:**
```bash
curl -X GET "http://localhost:3002/api/projects/proj-123/reports/report-456" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    // Complete report object with full content
    "id": "report-456",
    "projectId": "proj-123",
    "content": {
      "summary": { ... },
      "vulnerabilities": { ... },
      "threats": { ... },
      "risks": { ... },
      "recommendations": { ... }
    }
  }
}
```

### DELETE /api/projects/{projectId}/reports/{reportId}
Delete a specific report.

**Path Parameters:**
- `projectId` (required) - UUID of the project
- `reportId` (required) - UUID of the report

**Example Request:**
```bash
curl -X DELETE "http://localhost:3002/api/projects/proj-123/reports/report-456" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Example Response:**
```json
{
  "success": true,
  "message": "Report deleted successfully"
}
```

### GET /api/projects/{projectId}/reports/statistics
Get report statistics for the project.

**Path Parameters:**
- `projectId` (required) - UUID of the project

**Example Request:**
```bash
curl -X GET "http://localhost:3002/api/projects/proj-123/reports/statistics" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "totalReports": 12,
    "reportsThisMonth": 4,
    "mostGeneratedType": "vulnerability_summary",
    "avgGenerationTime": 89.5,
    "byType": {
      "vulnerability_summary": 5,
      "threat_analysis": 2,
      "risk_assessment": 2,
      "executive_summary": 2,
      "compliance_audit": 1
    },
    "byStatus": {
      "generating": 0,
      "completed": 11,
      "failed": 1
    }
  }
}
```

## Report Content Structure

### Report Summary
All reports include a standardized summary section:

```json
{
  "summary": {
    "totalProjects": 1,
    "totalVulnerabilities": 15,
    "totalThreats": 8,
    "riskScore": 67,
    "complianceScore": 82,
    "keyFindings": [
      "15 vulnerabilities identified",
      "3 critical issues require immediate attention",
      "Security posture improved by 12% this month"
    ],
    "executiveSummary": "Security assessment reveals 15 vulnerabilities with 3 critical issues requiring immediate remediation.",
    "generationTime": 45
  }
}
```

### Vulnerability Section
Detailed vulnerability analysis (included in vulnerability_summary, security_posture, executive_summary):

```json
{
  "vulnerabilities": {
    "total": 15,
    "bySeverity": {
      "critical": 3,
      "high": 5,
      "medium": 4,
      "low": 3
    },
    "byStatus": {
      "open": 8,
      "inProgress": 4,
      "resolved": 3,
      "falsePositive": 0,
      "wontFix": 0
    },
    "trending": {
      "newThisWeek": 2,
      "resolvedThisWeek": 5,
      "avgResolutionTime": 7.2
    },
    "topVulnerabilities": [
      {
        "id": "vuln-001",
        "title": "SQL Injection in Login Form",
        "severity": "Critical",
        "cvssScore": 9.8,
        "component": "Authentication"
      }
    ]
  }
}
```

### Threat Section
Threat analysis data (included in threat_analysis, risk_assessment, executive_summary):

```json
{
  "threats": {
    "total": 8,
    "byCategory": {
      "spoofing": 2,
      "tampering": 2,
      "repudiation": 1,
      "information_disclosure": 2,
      "denial_of_service": 1,
      "elevation_of_privilege": 1
    },
    "byLikelihood": {
      "high": 3,
      "medium": 4,
      "low": 1
    },
    "byImpact": {
      "high": 4,
      "medium": 3,
      "low": 1
    },
    "topThreats": [
      {
        "id": "threat-001",
        "title": "SQL Injection Attack",
        "category": "tampering",
        "likelihood": "high",
        "impact": "high",
        "riskScore": 9.0
      }
    ]
  }
}
```

### Risk Section
Risk assessment data (included in risk_assessment, executive_summary):

```json
{
  "risks": {
    "overallRiskScore": 67,
    "riskDistribution": {
      "critical": 3,
      "high": 5,
      "medium": 7,
      "low": 12
    },
    "riskTrends": [
      {
        "date": "2025-07-10",
        "score": 67
      },
      {
        "date": "2025-07-03",
        "score": 71
      }
    ],
    "topRisks": [
      {
        "id": "risk-001",
        "description": "Unauthorized access to customer data",
        "likelihood": 8,
        "impact": 9,
        "riskScore": 8.5,
        "mitigation": "Implement multi-factor authentication and access controls"
      }
    ]
  }
}
```

### Recommendations Section
Actionable recommendations (included in executive_summary, security_posture):

```json
{
  "recommendations": {
    "immediate": [
      "Patch critical SQL injection vulnerability in login system",
      "Implement multi-factor authentication for admin accounts"
    ],
    "shortTerm": [
      "Conduct security awareness training for development team",
      "Update incident response procedures and playbooks",
      "Implement automated vulnerability scanning"
    ],
    "longTerm": [
      "Implement zero-trust security architecture",
      "Establish comprehensive security metrics dashboard",
      "Deploy advanced threat detection and response capabilities"
    ],
    "strategic": [
      "Develop comprehensive 3-year security roadmap",
      "Invest in security automation and orchestration tools",
      "Establish security center of excellence"
    ],
    "priorityMatrix": [
      {
        "recommendation": "Patch SQL injection vulnerability",
        "priority": "high",
        "effort": "low",
        "impact": "high"
      }
    ]
  }
}
```

## Metadata Configuration

### Format Options
- `pdf` - PDF document (future implementation)
- `html` - HTML report (future implementation)
- `json` - JSON data format (current implementation)
- `csv` - CSV data export (future implementation)
- `xlsx` - Excel spreadsheet (future implementation)

### Content Options
```json
{
  "includeCharts": true,
  "includeSummary": true,
  "includeRecommendations": true,
  "includeMetrics": true,
  "includeTimeline": true
}
```

### Filtering Options
```json
{
  "filters": {
    "severity": ["Critical", "High", "Medium", "Low"],
    "status": ["open", "in_progress", "resolved", "false_positive", "wont_fix"],
    "assignees": ["user-123", "security-team"],
    "components": ["Authentication", "Database", "API"],
    "tags": ["web-security", "api-security", "compliance"]
  }
}
```

### Date Range Options
```json
{
  "dateRange": {
    "start": "2025-01-01T00:00:00.000Z",
    "end": "2025-01-31T23:59:59.999Z"
  }
}
```

## Error Handling

### Common Error Responses

**400 Bad Request - Missing Required Fields:**
```json
{
  "success": false,
  "error": "Missing required fields: reportType, title, metadata",
  "statusCode": 400
}
```

**401 Unauthorized:**
```json
{
  "success": false,
  "error": "Access token required",
  "statusCode": 401
}
```

**403 Forbidden - Project Access Denied:**
```json
{
  "success": false,
  "error": "Project not found or access denied",
  "statusCode": 403
}
```

**404 Not Found:**
```json
{
  "success": false,
  "error": "Report not found or access denied",
  "statusCode": 404
}
```

**500 Internal Server Error:**
```json
{
  "success": false,
  "error": "Failed to generate report",
  "statusCode": 500
}
```

## Integration Examples

### Frontend Report Generation
```javascript
async function generateVulnerabilityReport(projectId) {
  const reportData = {
    reportType: 'vulnerability_summary',
    title: 'Monthly Vulnerability Assessment',
    description: 'Comprehensive vulnerability analysis for the current month',
    metadata: {
      format: 'pdf',
      includeCharts: true,
      includeSummary: true,
      includeRecommendations: true,
      filters: {
        severity: ['Critical', 'High'],
        status: ['open', 'in_progress']
      }
    }
  };

  const response = await fetch(`/api/projects/${projectId}/reports`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${getJWTToken()}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(reportData)
  });

  const result = await response.json();
  if (result.success) {
    console.log('Report generated:', result.data.id);
    return result.data;
  } else {
    throw new Error(result.error);
  }
}
```

### Dashboard Report Listing
```javascript
async function fetchProjectReports(projectId, filters = {}) {
  const queryParams = new URLSearchParams({
    limit: filters.limit || 10,
    offset: filters.offset || 0,
    ...filters
  });

  const response = await fetch(`/api/projects/${projectId}/reports?${queryParams}`, {
    headers: {
      'Authorization': `Bearer ${getJWTToken()}`,
      'Content-Type': 'application/json'
    }
  });

  const data = await response.json();
  if (data.success) {
    return {
      reports: data.data,
      total: data.total,
      hasMore: (data.offset + data.limit) < data.total
    };
  } else {
    throw new Error(data.error);
  }
}
```

## Performance Considerations

1. **Async Generation:** Reports are generated asynchronously to avoid blocking requests
2. **Caching:** Report content is cached to avoid regeneration
3. **Pagination:** Large report lists are paginated
4. **Database Optimization:** Optimized queries for report statistics
5. **Content Streaming:** Large reports can be streamed to reduce memory usage

## Security Features

1. **Authentication:** JWT-based authentication required
2. **Authorization:** Project-level access control
3. **Data Privacy:** Sensitive data can be excluded from reports
4. **Audit Trail:** Report generation is logged in activity system
5. **Content Validation:** Report content is validated before storage
6. **Access Logging:** Report access is logged for audit purposes

## Future Enhancements

1. **Export Formats:** PDF, Excel, and Word document generation
2. **Scheduled Reports:** Automated report generation on schedules
3. **Report Templates:** Customizable report templates
4. **Email Distribution:** Automated report distribution via email
5. **Watermarking:** Confidentiality watermarks for sensitive reports
6. **Version Control:** Report versioning and change tracking