# Activity Logging API Documentation

## Overview

The Activity API provides comprehensive audit trail functionality for the threat modeling platform, tracking all user actions and system events across the application.

## Authentication

All endpoints require JWT authentication via the `Authorization: Bearer <token>` header.

## Base URL
```
http://localhost:3002/api/activity
```

## Core Concepts

### Activity Types
The system tracks the following activity types:
- `project.created` / `project.updated` / `project.deleted` / `project.archived`
- `threat_model.created` / `threat_model.updated` / `threat_model.deleted` / `threat_model.published`
- `vulnerability.created` / `vulnerability.updated` / `vulnerability.deleted` / `vulnerability.assigned` / `vulnerability.resolved`
- `user.login` / `user.logout` / `user.registered` / `user.password_changed`
- `system.backup` / `system.maintenance`
- `security.scan_completed` / `security.threat_detected`

### Entity Types
- `project` - Project-related activities
- `threat_model` - Threat modeling activities
- `vulnerability` - Vulnerability management activities
- `user` - User account activities
- `organization` - Organization-level activities
- `system` - System maintenance and automated activities

## API Endpoints

### GET /api/activity/recent
Get recent activities for dashboard display.

**Query Parameters:**
- `limit` (optional, default: 20) - Number of activities to return

**Example Request:**
```bash
curl -X GET "http://localhost:3002/api/activity/recent?limit=10" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Example Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "type": "vulnerability.created",
      "action": "Create Vulnerability",
      "description": "Created new critical SQL injection vulnerability",
      "entityType": "vulnerability",
      "entityId": "vuln-001",
      "entityName": "SQL Injection in Login Form",
      "metadata": {
        "severity": "Critical",
        "cvssScore": 9.8,
        "component": "Authentication"
      },
      "userId": "user-123",
      "userName": "John Doe",
      "userEmail": "john.doe@example.com",
      "organizationId": "org-456",
      "ipAddress": "192.168.1.100",
      "userAgent": "Mozilla/5.0...",
      "createdAt": "2025-07-10T13:47:00.000Z"
    }
  ],
  "total": 1
}
```

### GET /api/activity
Get all activities with filtering and pagination.

**Query Parameters:**
- `type` - Filter by activity type (e.g., "vulnerability.created")
- `entityType` - Filter by entity type (project|vulnerability|user|system)
- `entityId` - Filter by specific entity ID
- `userId` - Filter by user who performed the action
- `startDate` - Filter by start date (ISO 8601 format)
- `endDate` - Filter by end date (ISO 8601 format)
- `limit` (default: 50) - Number of results per page
- `offset` (default: 0) - Pagination offset

**Example Request:**
```bash
curl -X GET "http://localhost:3002/api/activity?entityType=vulnerability&limit=20&offset=0" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Example Response:**
```json
{
  "success": true,
  "data": [
    // Array of activity objects
  ],
  "total": 150,
  "limit": 20,
  "offset": 0
}
```

### GET /api/activity/statistics
Get activity statistics and analytics.

**Query Parameters:**
- `days` (default: 30) - Number of days to analyze

**Example Request:**
```bash
curl -X GET "http://localhost:3002/api/activity/statistics?days=7" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "totalActivities": 150,
    "todayActivities": 12,
    "weekActivities": 45,
    "monthActivities": 150,
    "byType": {
      "vulnerability.created": 25,
      "project.created": 8,
      "user.login": 67,
      "system.maintenance": 5
    },
    "byEntityType": {
      "project": 15,
      "threat_model": 22,
      "vulnerability": 89,
      "user": 34,
      "organization": 8,
      "system": 12
    },
    "mostActiveUsers": [
      {
        "userId": "user-123",
        "userName": "John Doe",
        "activityCount": 23
      },
      {
        "userId": "user-456", 
        "userName": "Jane Smith",
        "activityCount": 18
      }
    ],
    "recentTrends": [
      {
        "date": "2025-07-10",
        "count": 12
      },
      {
        "date": "2025-07-09", 
        "count": 8
      }
    ]
  }
}
```

### POST /api/activity
Create a new activity log entry (typically used internally by other services).

**Request Body:**
```json
{
  "type": "vulnerability.created",
  "action": "Create Vulnerability",
  "description": "Created new SQL injection vulnerability during security assessment",
  "entityType": "vulnerability",
  "entityId": "vuln-001",
  "entityName": "SQL Injection in Login Form",
  "metadata": {
    "severity": "Critical",
    "cvssScore": 9.8,
    "component": "Authentication",
    "discoveryMethod": "manual_testing"
  }
}
```

**Example Request:**
```bash
curl -X POST "http://localhost:3002/api/activity" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "type": "project.created",
    "action": "Create Project", 
    "description": "Created new threat modeling project for web application",
    "entityType": "project",
    "entityId": "proj-001",
    "entityName": "E-commerce Web App"
  }'
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "id": "activity-789",
    "type": "project.created",
    "action": "Create Project",
    "description": "Created new threat modeling project for web application",
    "entityType": "project",
    "entityId": "proj-001",
    "entityName": "E-commerce Web App",
    "metadata": {},
    "userId": "user-123",
    "userName": "John Doe",
    "userEmail": "john.doe@example.com",
    "organizationId": "org-456",
    "ipAddress": "192.168.1.100",
    "userAgent": "Mozilla/5.0...",
    "createdAt": "2025-07-10T14:00:00.000Z"
  },
  "message": "Activity logged successfully"
}
```

### GET /api/activity/entity/{entityType}/{entityId}
Get activities for a specific entity.

**Path Parameters:**
- `entityType` - Type of entity (project|vulnerability|user|system)
- `entityId` - ID of the specific entity

**Query Parameters:**
- `limit` (default: 20) - Number of results

**Example Request:**
```bash
curl -X GET "http://localhost:3002/api/activity/entity/project/proj-001?limit=10" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### GET /api/activity/user/{userId}
Get activities performed by a specific user.

**Path Parameters:**
- `userId` - ID of the user

**Query Parameters:**
- `limit` (default: 20) - Number of results

**Example Request:**
```bash
curl -X GET "http://localhost:3002/api/activity/user/user-123?limit=20" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### DELETE /api/activity/cleanup
Clean up old activity logs (admin only).

**Query Parameters:**
- `daysToKeep` (default: 90) - Number of days of activity to retain

**Example Request:**
```bash
curl -X DELETE "http://localhost:3002/api/activity/cleanup?daysToKeep=30" \
  -H "Authorization: Bearer ADMIN_JWT_TOKEN"
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "deletedCount": 245,
    "daysToKeep": 30
  },
  "message": "Deleted 245 old activity logs"
}
```

## Data Model

### Activity Object
```typescript
interface ActivityLog {
  id: string;
  type: ActivityType;
  action: string;
  description: string;
  entityType: 'project' | 'threat_model' | 'vulnerability' | 'user' | 'organization' | 'system';
  entityId: string;
  entityName?: string;
  metadata?: {
    [key: string]: any;
  };
  userId: string;
  userName?: string;
  userEmail?: string;
  organizationId: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}
```

### Metadata Examples
Different activity types include relevant metadata:

**Vulnerability Activities:**
```json
{
  "severity": "Critical",
  "cvssScore": 9.8,
  "component": "Authentication",
  "status": "open",
  "assignedTo": "security-team"
}
```

**Project Activities:**
```json
{
  "template": "web_application",
  "methodology": "STRIDE",
  "riskLevel": "high"
}
```

**User Activities:**
```json
{
  "loginMethod": "email",
  "browser": "Chrome",
  "location": "New York, US"
}
```

**System Activities:**
```json
{
  "duration": "5 minutes",
  "tablesOptimized": 12,
  "backupSize": "2.4GB"
}
```

## Error Handling

### Common Error Responses

**400 Bad Request:**
```json
{
  "success": false,
  "error": "Missing required fields: type, action, description",
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

**403 Forbidden:**
```json
{
  "success": false,
  "error": "Admin access required",
  "statusCode": 403
}
```

**500 Internal Server Error:**
```json
{
  "success": false,
  "error": "Failed to create activity log",
  "statusCode": 500
}
```

## Integration Examples

### Frontend Dashboard Integration
```javascript
// Fetch recent activities for dashboard
async function fetchRecentActivities() {
  const response = await fetch('/api/activity/recent?limit=10', {
    headers: {
      'Authorization': `Bearer ${getJWTToken()}`,
      'Content-Type': 'application/json'
    }
  });
  
  const data = await response.json();
  if (data.success) {
    displayActivities(data.data);
  }
}
```

### Backend Service Integration
```javascript
// Log activity when creating a vulnerability
async function createVulnerability(vulnerabilityData) {
  // Create the vulnerability
  const vulnerability = await vulnerabilityService.create(vulnerabilityData);
  
  // Log the activity
  await activityService.createActivity(userId, organizationId, {
    type: 'vulnerability.created',
    action: 'Create Vulnerability',
    description: `Created new ${vulnerabilityData.severity} vulnerability: ${vulnerabilityData.title}`,
    entityType: 'vulnerability',
    entityId: vulnerability.id,
    entityName: vulnerability.title,
    metadata: {
      severity: vulnerabilityData.severity,
      component: vulnerabilityData.component,
      cvssScore: vulnerabilityData.cvssScore
    }
  });
  
  return vulnerability;
}
```

## Performance Considerations

1. **Indexing:** Database indexes on commonly queried fields (organization_id, entity_type, created_at)
2. **Pagination:** All list endpoints support pagination to handle large datasets
3. **Filtering:** Server-side filtering reduces data transfer
4. **Cleanup:** Automated cleanup of old activities to manage database size
5. **Async Processing:** All operations are asynchronous for better performance

## Security Features

1. **Authentication:** JWT-based authentication required for all endpoints
2. **Authorization:** Organization-based access control - users can only see activities within their organization
3. **Input Validation:** Comprehensive validation of all input parameters
4. **Audit Trail:** Immutable audit trail - activities cannot be modified once created
5. **Data Privacy:** IP addresses and user agents are stored for security but can be sanitized
6. **Rate Limiting:** Built-in rate limiting to prevent abuse

## Best Practices

1. **Consistent Activity Types:** Use standardized activity type naming conventions
2. **Meaningful Descriptions:** Write clear, human-readable descriptions
3. **Relevant Metadata:** Include context-specific metadata for better analysis
4. **Entity Naming:** Provide entity names for better readability
5. **Regular Cleanup:** Implement regular cleanup of old activities based on retention policies
6. **Privacy Compliance:** Consider data privacy regulations when storing user activities