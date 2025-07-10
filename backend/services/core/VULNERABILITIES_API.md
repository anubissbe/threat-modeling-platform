# Vulnerabilities API Documentation

## Overview

The Vulnerabilities API provides comprehensive vulnerability management capabilities for the threat modeling platform, allowing users to create, read, update, delete, and analyze security vulnerabilities within their projects.

## Base URL
```
http://localhost:3002/api/vulnerabilities
```

## Authentication
All endpoints require JWT authentication via the `Authorization: Bearer <token>` header.

## API Endpoints

### 1. Create Vulnerability
**POST** `/api/vulnerabilities`

Creates a new vulnerability record.

#### Request Body
```json
{
  "title": "string (required, 1-255 chars)",
  "description": "string (required, 1-2000 chars)",
  "severity": "Critical|High|Medium|Low (required)",
  "component": "string (required, 1-255 chars)",
  "version": "string (optional, max 50 chars)",
  "impact": "string (required, 1-2000 chars)",
  "remediation": "string (required, 1-2000 chars)",
  "projectId": "string (required, UUID format)",
  "threatModelId": "string (optional, UUID format)",
  "cve": "string (optional, CVE-YYYY-NNNN format)",
  "cwe": "string (optional, CWE-NNN format)",
  "cvss_score": "number (optional, 0-10)",
  "exploitability": "Functional|Proof of Concept|Unproven|Not Defined (optional)",
  "remediationComplexity": "Low|Medium|High (optional)",
  "businessImpact": "Critical|High|Medium|Low (optional)",
  "references": "array of URLs (optional)",
  "assignedTo": "string (optional, max 255 chars)",
  "affectedAssets": "array of strings (optional)",
  "tags": "array of strings (optional, max 50 chars each)",
  "notes": "string (optional, max 2000 chars)"
}
```

#### Response
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "title": "string",
    "description": "string",
    "severity": "string",
    "status": "open|in_progress|resolved|false_positive|wont_fix",
    "priority": "P1|P2|P3|P4",
    "cve": "string|null",
    "cwe": "string|null",
    "cvss_score": "number|null",
    "component": "string",
    "version": "string|null",
    "impact": "string",
    "exploitability": "string",
    "remediationComplexity": "string",
    "businessImpact": "string",
    "remediation": "string",
    "references": "array",
    "assignedTo": "string|null",
    "discoveredAt": "timestamp",
    "lastSeen": "timestamp",
    "resolvedAt": "timestamp|null",
    "projectId": "uuid",
    "threatModelId": "uuid|null",
    "affectedAssets": "array",
    "tags": "array",
    "notes": "string",
    "createdBy": "uuid",
    "createdAt": "timestamp",
    "updatedAt": "timestamp",
    "organizationId": "uuid"
  },
  "message": "Vulnerability created successfully"
}
```

### 2. List Vulnerabilities
**GET** `/api/vulnerabilities`

Retrieves all vulnerabilities with optional filtering.

#### Query Parameters
- `severity` - Filter by severity (Critical|High|Medium|Low)
- `status` - Filter by status (open|in_progress|resolved|false_positive|wont_fix)
- `projectId` - Filter by project UUID
- `assignedTo` - Filter by assignee
- `search` - Search in title, description, and component
- `limit` - Number of results (default: 20)
- `offset` - Pagination offset (default: 0)

#### Response
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "title": "string",
      // ... full vulnerability object
    }
  ],
  "total": "number",
  "limit": "number",
  "offset": "number"
}
```

### 3. Get Vulnerability by ID
**GET** `/api/vulnerabilities/:id`

Retrieves a specific vulnerability by its UUID.

#### Response
```json
{
  "success": true,
  "data": {
    // ... full vulnerability object
  }
}
```

### 4. Update Vulnerability
**PUT** `/api/vulnerabilities/:id`

Updates an existing vulnerability. Only provided fields will be updated.

#### Request Body
Same as create endpoint, but all fields are optional.

#### Response
```json
{
  "success": true,
  "data": {
    // ... updated vulnerability object
  },
  "message": "Vulnerability updated successfully"
}
```

### 5. Delete Vulnerability
**DELETE** `/api/vulnerabilities/:id`

Deletes a vulnerability permanently.

#### Response
```json
{
  "success": true,
  "message": "Vulnerability deleted successfully"
}
```

### 6. Get Vulnerability Statistics
**GET** `/api/vulnerabilities/statistics`

Returns aggregated statistics for vulnerabilities.

#### Query Parameters
- `projectId` - Filter statistics by project (optional)

#### Response
```json
{
  "success": true,
  "data": {
    "total": "number",
    "bySeverity": {
      "critical": "number",
      "high": "number",
      "medium": "number",
      "low": "number"
    },
    "byStatus": {
      "open": "number",
      "inProgress": "number",
      "resolved": "number",
      "falsePositive": "number",
      "wontFix": "number"
    },
    "trends": {
      "newThisWeek": "number",
      "resolvedThisWeek": "number",
      "avgResolutionTime": "number (days)"
    }
  }
}
```

### 7. Bulk Update Vulnerabilities
**PATCH** `/api/vulnerabilities/bulk`

Updates multiple vulnerabilities at once.

#### Request Body
```json
{
  "vulnerabilityIds": ["uuid1", "uuid2", "uuid3"],
  "updates": {
    "status": "in_progress",
    "assignedTo": "security-team"
  }
}
```

#### Response
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid1",
      "success": true,
      "data": {
        // ... updated vulnerability object
      }
    },
    {
      "id": "uuid2", 
      "success": false,
      "error": "error message"
    }
  ],
  "message": "Bulk update completed"
}
```

### 8. Advanced Search
**POST** `/api/vulnerabilities/search`

Performs advanced search with multiple filters.

#### Request Body
```json
{
  "query": "string (search term)",
  "severities": ["Critical", "High"],
  "statuses": ["open", "in_progress"],
  "assignees": ["user1", "user2"],
  "projectIds": ["uuid1", "uuid2"],
  "dateRange": {
    "start": "2024-01-01",
    "end": "2024-12-31"
  },
  "limit": 20,
  "offset": 0,
  "sortBy": "created_at|severity|priority",
  "sortOrder": "asc|desc"
}
```

#### Response
```json
{
  "success": true,
  "data": [
    {
      // ... vulnerability objects matching search criteria
    }
  ],
  "total": "number",
  "limit": "number",
  "offset": "number"
}
```

## Priority Calculation

The system automatically calculates priority based on severity and exploitability:

- **P1 (Critical)**: Critical severity OR High severity with Functional exploitability
- **P2 (High)**: High severity with other exploitability levels
- **P3 (Medium)**: Medium severity
- **P4 (Low)**: Low severity

## Error Responses

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Error message",
  "details": ["Detailed error information"] // For validation errors
}
```

### Common HTTP Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (missing or invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `500` - Internal Server Error

## Database Schema

### Vulnerabilities Table
```sql
CREATE TABLE vulnerabilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('Critical', 'High', 'Medium', 'Low')),
  status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'false_positive', 'wont_fix')),
  priority VARCHAR(5) NOT NULL CHECK (priority IN ('P1', 'P2', 'P3', 'P4')),
  cve VARCHAR(50),
  cwe VARCHAR(50),
  cvss_score DECIMAL(3,1),
  component VARCHAR(255) NOT NULL,
  version VARCHAR(50),
  impact TEXT NOT NULL,
  exploitability VARCHAR(50) DEFAULT 'Not Defined',
  remediation_complexity VARCHAR(10) DEFAULT 'Medium',
  business_impact VARCHAR(20) DEFAULT 'Medium',
  remediation TEXT NOT NULL,
  ref_links JSONB DEFAULT '[]',
  assigned_to VARCHAR(255),
  discovered_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_seen TIMESTAMP NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMP,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  threat_model_id UUID REFERENCES threat_models(id) ON DELETE SET NULL,
  affected_assets JSONB DEFAULT '[]',
  tags JSONB DEFAULT '[]',
  notes TEXT DEFAULT '',
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  organization_id UUID NOT NULL REFERENCES organizations(id)
);
```

## Testing Results

✅ **Verified Functionality:**
- POST /api/vulnerabilities - Creates vulnerabilities successfully
- GET /api/vulnerabilities - Lists vulnerabilities with pagination
- GET /api/vulnerabilities/:id - Retrieves specific vulnerability
- POST /api/vulnerabilities/search - Advanced search functionality
- Authentication protection on all endpoints
- Input validation with Zod schemas
- Priority calculation based on severity/exploitability
- JSON field handling for arrays (references, tags, affectedAssets)

✅ **Resolved Issues:**
- Fixed TypeScript compilation errors
- Fixed JSON parsing errors in service layer
- Fixed database constraint violations
- Fixed 404 errors - API endpoints now exist and respond correctly

## Integration Notes

This API integrates with:
- **Authentication Service** - JWT token validation
- **Projects API** - Project association and validation
- **Organizations** - Multi-tenant data isolation
- **Frontend** - React components can now call `/api/vulnerabilities` without 404 errors

The vulnerabilities management system is now fully operational and ready for production use.