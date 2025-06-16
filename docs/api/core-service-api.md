# Core Service API Documentation

## Base URL
```
http://localhost:3002/api
```

## Authentication
All endpoints require JWT authentication via Bearer token:
```
Authorization: Bearer <jwt_token>
```

## Endpoints

### Projects

#### List Projects
```http
GET /api/projects?status=active&search=security&limit=20&offset=0
```

**Query Parameters:**
- `status` (optional): Filter by status (active, in_review, completed, archived)
- `search` (optional): Search in name and description
- `limit` (optional): Number of results (default: 20)
- `offset` (optional): Pagination offset (default: 0)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "E-Commerce Platform",
      "description": "Threat model for e-commerce application",
      "organization_id": "uuid",
      "owner_id": "uuid",
      "status": "active",
      "risk_level": "high",
      "created_at": "2024-06-16T10:00:00Z",
      "updated_at": "2024-06-16T10:00:00Z"
    }
  ],
  "pagination": {
    "total": 42,
    "limit": 20,
    "offset": 0
  }
}
```

#### Create Project
```http
POST /api/projects
Content-Type: application/json

{
  "name": "E-Commerce Platform",
  "description": "Comprehensive threat model for our e-commerce application",
  "metadata": {
    "industry": "retail",
    "compliance_requirements": ["PCI-DSS", "GDPR"],
    "technology_stack": ["React", "Node.js", "PostgreSQL"],
    "deployment_environment": "AWS"
  }
}
```

### Threat Models

#### Create Threat Model
```http
POST /api/threat-models
Content-Type: application/json

{
  "project_id": "uuid",
  "name": "Payment Processing Flow",
  "description": "Threat model for payment processing system",
  "methodology": "STRIDE",
  "scope": {
    "systems": ["payment-api", "payment-gateway"],
    "boundaries": ["internet", "internal-network"],
    "assets": [
      {
        "id": "asset-1",
        "name": "Credit Card Data",
        "type": "data",
        "sensitivity": "secret",
        "description": "Customer payment information"
      }
    ],
    "actors": [
      {
        "id": "actor-1",
        "name": "Customer",
        "type": "user",
        "trust_level": "untrusted",
        "description": "End user making purchases"
      }
    ],
    "data_flows": [
      {
        "id": "flow-1",
        "name": "Payment Submission",
        "source": "customer-browser",
        "destination": "payment-api",
        "protocol": "HTTPS",
        "data_classification": "secret",
        "encryption": "TLS 1.3"
      }
    ]
  }
}
```

#### Validate Threat Model
```http
POST /api/threat-models/:id/validate
```

**Response:**
```json
{
  "success": true,
  "data": {
    "valid": true,
    "completeness": 85,
    "issues": [
      {
        "severity": "warning",
        "category": "missing_threats",
        "message": "No threats identified for asset: Database Server"
      }
    ],
    "statistics": {
      "total_assets": 12,
      "total_threats": 45,
      "mitigated_threats": 38,
      "high_risk_threats": 7
    }
  }
}
```

### Threats

#### Create Threat
```http
POST /api/threats
Content-Type: application/json

{
  "threat_model_id": "uuid",
  "name": "SQL Injection Attack",
  "description": "Attacker could inject malicious SQL queries through user input fields",
  "category": "Tampering",
  "severity": "high",
  "likelihood": "medium",
  "affected_assets": ["database-server", "api-server"],
  "methodology_specific": {
    "stride_category": "tampering",
    "attack_vector": "network"
  }
}
```

#### Get AI Threat Suggestions
```http
POST /api/threats/suggest
Content-Type: application/json

{
  "threat_model_id": "uuid",
  "methodology": "STRIDE",
  "context": {
    "assets": [
      {
        "id": "asset-1",
        "name": "User Database",
        "type": "data",
        "sensitivity": "confidential"
      }
    ],
    "actors": [
      {
        "id": "actor-1",
        "name": "External API",
        "type": "external_system",
        "trust_level": "partially_trusted"
      }
    ]
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "suggestions": [
      {
        "category": "Spoofing",
        "threats": [
          {
            "name": "API Key Theft",
            "description": "External systems could have their API keys compromised",
            "likelihood": "medium",
            "impact": "high",
            "methodology_specific": {
              "stride_category": "spoofing"
            }
          }
        ]
      }
    ],
    "methodology": "STRIDE",
    "generated_at": "2024-06-16T10:00:00Z"
  }
}
```

#### Add Mitigation
```http
POST /api/threats/:id/mitigations
Content-Type: application/json

{
  "name": "Input Validation",
  "description": "Implement parameterized queries and input sanitization",
  "type": "preventive",
  "effectiveness": "high",
  "cost": "low",
  "implementation_effort": "medium",
  "assigned_to": "dev-team@example.com"
}
```

### Methodologies

#### Get Methodology Recommendation
```http
POST /api/methodologies/recommend
Content-Type: application/json

{
  "project_type": "web-application",
  "industry": "healthcare",
  "compliance_requirements": ["HIPAA", "GDPR"],
  "team_expertise": "medium",
  "time_constraints": "normal"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "recommendation": {
      "primary": "LINDDUN",
      "alternatives": ["STRIDE", "PASTA"],
      "reasoning": "LINDDUN is specifically designed for privacy threat modeling",
      "factors_considered": [
        "Industry: healthcare",
        "Compliance: HIPAA, GDPR",
        "Team expertise: medium"
      ]
    }
  }
}
```

## Error Responses

All errors follow this format:
```json
{
  "success": false,
  "error": "Error message",
  "details": ["Additional error details"],
  "code": "ERROR_CODE"
}
```

Common HTTP status codes:
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (missing/invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `409` - Conflict (duplicate resources)
- `429` - Too Many Requests (rate limited)
- `500` - Internal Server Error

## Rate Limits

- Standard endpoints: 100 requests/minute
- Create operations: 20 requests/minute
- AI suggestions: 10 requests/minute
- Export operations: 5 requests/minute