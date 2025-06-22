# API Specifications - Threat Modeling Application

## Overview
This document defines the comprehensive API specifications for the Threat Modeling Application, including RESTful APIs, GraphQL schema, and WebSocket events. The APIs follow industry best practices for security, scalability, and developer experience.

## API Design Principles

### Core Principles
1. **RESTful Design**: Resource-oriented architecture with standard HTTP methods
2. **GraphQL Alternative**: Flexible querying for complex data relationships
3. **Consistency**: Uniform naming conventions and response formats
4. **Security First**: Authentication, authorization, and encryption by default
5. **Versioning**: Backward compatibility with clear upgrade paths
6. **Documentation**: OpenAPI 3.0 specifications with examples
7. **Error Handling**: Informative error messages with problem details (RFC 7807)

### API Versioning Strategy
- **URL Path Versioning**: `/api/v1/`, `/api/v2/`
- **Sunset Policy**: 12-month deprecation notice
- **Header Support**: `API-Version: 2024-01-01` for date-based versioning
- **Backward Compatibility**: Minor versions maintain compatibility

## Authentication & Authorization

### Authentication Methods
```yaml
security:
  - bearerAuth: []
  - apiKey: []
  - oauth2:
      - read
      - write

components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
    apiKey:
      type: apiKey
      in: header
      name: X-API-Key
    oauth2:
      type: oauth2
      flows:
        authorizationCode:
          authorizationUrl: https://api.threatmodel.io/oauth/authorize
          tokenUrl: https://api.threatmodel.io/oauth/token
          scopes:
            read: Read access to resources
            write: Write access to resources
            admin: Administrative access
```

### JWT Token Structure
```json
{
  "sub": "user_id",
  "org": "organization_id",
  "roles": ["security_analyst", "project_manager"],
  "permissions": ["threat:read", "threat:write", "project:admin"],
  "iat": 1704067200,
  "exp": 1704070800,
  "jti": "unique_token_id"
}
```

## RESTful API Endpoints

### 1. Authentication Service API

#### POST /api/v1/auth/login
```yaml
requestBody:
  required: true
  content:
    application/json:
      schema:
        type: object
        required:
          - email
          - password
        properties:
          email:
            type: string
            format: email
          password:
            type: string
            format: password
          mfa_code:
            type: string
            pattern: '^[0-9]{6}$'
responses:
  '200':
    description: Successful authentication
    content:
      application/json:
        schema:
          type: object
          properties:
            access_token:
              type: string
            refresh_token:
              type: string
            token_type:
              type: string
              default: Bearer
            expires_in:
              type: integer
              description: Token lifetime in seconds
            user:
              $ref: '#/components/schemas/User'
```

#### POST /api/v1/auth/refresh
```yaml
requestBody:
  required: true
  content:
    application/json:
      schema:
        type: object
        required:
          - refresh_token
        properties:
          refresh_token:
            type: string
responses:
  '200':
    description: New access token
    content:
      application/json:
        schema:
          type: object
          properties:
            access_token:
              type: string
            expires_in:
              type: integer
```

#### POST /api/v1/auth/logout
```yaml
security:
  - bearerAuth: []
responses:
  '204':
    description: Successfully logged out
```

### 2. User Management API

#### GET /api/v1/users
```yaml
parameters:
  - name: page
    in: query
    schema:
      type: integer
      default: 1
  - name: limit
    in: query
    schema:
      type: integer
      default: 20
      maximum: 100
  - name: search
    in: query
    schema:
      type: string
  - name: role
    in: query
    schema:
      type: string
      enum: [admin, project_manager, security_analyst, developer, viewer]
responses:
  '200':
    description: List of users
    content:
      application/json:
        schema:
          type: object
          properties:
            data:
              type: array
              items:
                $ref: '#/components/schemas/User'
            pagination:
              $ref: '#/components/schemas/Pagination'
```

#### POST /api/v1/users
```yaml
requestBody:
  required: true
  content:
    application/json:
      schema:
        type: object
        required:
          - email
          - username
          - first_name
          - last_name
        properties:
          email:
            type: string
            format: email
          username:
            type: string
            pattern: '^[a-zA-Z0-9_-]{3,30}$'
          first_name:
            type: string
          last_name:
            type: string
          role_ids:
            type: array
            items:
              type: string
              format: uuid
responses:
  '201':
    description: User created successfully
    content:
      application/json:
        schema:
          $ref: '#/components/schemas/User'
```

### 3. Project Service API

#### GET /api/v1/projects
```yaml
parameters:
  - name: page
    in: query
    schema:
      type: integer
      default: 1
  - name: limit
    in: query
    schema:
      type: integer
      default: 20
  - name: status
    in: query
    schema:
      type: string
      enum: [active, archived]
  - name: risk_profile
    in: query
    schema:
      type: string
      enum: [low, medium, high, critical]
  - name: tags
    in: query
    schema:
      type: array
      items:
        type: string
    style: form
    explode: true
responses:
  '200':
    description: List of projects
    content:
      application/json:
        schema:
          type: object
          properties:
            data:
              type: array
              items:
                $ref: '#/components/schemas/Project'
            pagination:
              $ref: '#/components/schemas/Pagination'
```

#### POST /api/v1/projects
```yaml
requestBody:
  required: true
  content:
    application/json:
      schema:
        type: object
        required:
          - name
          - project_type
        properties:
          name:
            type: string
            maxLength: 255
          description:
            type: string
          project_type:
            type: string
            enum: [web_app, mobile_app, api, infrastructure, iot, desktop]
          tags:
            type: array
            items:
              type: string
          risk_profile:
            type: string
            enum: [low, medium, high, critical]
            default: medium
          compliance_frameworks:
            type: array
            items:
              type: string
              enum: [GDPR, HIPAA, PCI-DSS, SOC2, ISO27001]
responses:
  '201':
    description: Project created successfully
    content:
      application/json:
        schema:
          $ref: '#/components/schemas/Project'
```

#### GET /api/v1/projects/{projectId}/threat-models
```yaml
parameters:
  - name: projectId
    in: path
    required: true
    schema:
      type: string
      format: uuid
  - name: status
    in: query
    schema:
      type: string
      enum: [draft, in_review, approved, archived]
  - name: methodology
    in: query
    schema:
      type: string
      enum: [STRIDE, PASTA, LINDDUN, VAST, DREAD]
responses:
  '200':
    description: List of threat models for the project
    content:
      application/json:
        schema:
          type: object
          properties:
            data:
              type: array
              items:
                $ref: '#/components/schemas/ThreatModel'
```

### 4. Threat Modeling Engine API

#### POST /api/v1/threat-models
```yaml
requestBody:
  required: true
  content:
    application/json:
      schema:
        type: object
        required:
          - project_id
          - name
          - methodology
        properties:
          project_id:
            type: string
            format: uuid
          name:
            type: string
          description:
            type: string
          methodology:
            type: string
            enum: [STRIDE, PASTA, LINDDUN, VAST, DREAD]
          scope:
            type: string
          assumptions:
            type: array
            items:
              type: string
responses:
  '201':
    description: Threat model created
    content:
      application/json:
        schema:
          $ref: '#/components/schemas/ThreatModel'
```

#### POST /api/v1/threat-models/{modelId}/analyze
```yaml
parameters:
  - name: modelId
    in: path
    required: true
    schema:
      type: string
      format: uuid
requestBody:
  required: false
  content:
    application/json:
      schema:
        type: object
        properties:
          analysis_depth:
            type: string
            enum: [quick, standard, comprehensive]
            default: standard
          include_ai_suggestions:
            type: boolean
            default: true
          threat_libraries:
            type: array
            items:
              type: string
              format: uuid
responses:
  '200':
    description: Analysis results
    content:
      application/json:
        schema:
          type: object
          properties:
            threats_identified:
              type: array
              items:
                $ref: '#/components/schemas/Threat'
            risk_summary:
              type: object
              properties:
                high_risks:
                  type: integer
                medium_risks:
                  type: integer
                low_risks:
                  type: integer
                overall_score:
                  type: number
                  format: float
            recommendations:
              type: array
              items:
                type: object
                properties:
                  priority:
                    type: string
                    enum: [critical, high, medium, low]
                  recommendation:
                    type: string
                  affected_components:
                    type: array
                    items:
                      type: string
```

### 5. AI/ML Service API

#### POST /api/v1/ai/threats/suggest
```yaml
requestBody:
  required: true
  content:
    application/json:
      schema:
        type: object
        required:
          - component
        properties:
          component:
            $ref: '#/components/schemas/Component'
          context:
            type: object
            properties:
              technology_stack:
                type: array
                items:
                  type: string
              deployment_environment:
                type: string
              data_sensitivity:
                type: string
                enum: [public, internal, confidential, secret]
responses:
  '200':
    description: AI-suggested threats
    content:
      application/json:
        schema:
          type: object
          properties:
            suggestions:
              type: array
              items:
                type: object
                properties:
                  threat:
                    $ref: '#/components/schemas/Threat'
                  confidence:
                    type: number
                    format: float
                    minimum: 0
                    maximum: 1
                  reasoning:
                    type: string
                  similar_patterns:
                    type: array
                    items:
                      type: string
```

#### POST /api/v1/ai/threats/analyze-description
```yaml
requestBody:
  required: true
  content:
    application/json:
      schema:
        type: object
        required:
          - description
        properties:
          description:
            type: string
            description: Natural language description of system or component
          methodology:
            type: string
            enum: [STRIDE, PASTA, LINDDUN]
            default: STRIDE
responses:
  '200':
    description: Threats extracted from description
    content:
      application/json:
        schema:
          type: object
          properties:
            extracted_components:
              type: array
              items:
                type: object
                properties:
                  name:
                    type: string
                  type:
                    type: string
                  confidence:
                    type: number
            identified_threats:
              type: array
              items:
                $ref: '#/components/schemas/Threat'
            data_flows:
              type: array
              items:
                type: object
                properties:
                  source:
                    type: string
                  destination:
                    type: string
                  data_type:
                    type: string
```

### 6. Report Generation API

#### POST /api/v1/reports/generate
```yaml
requestBody:
  required: true
  content:
    application/json:
      schema:
        type: object
        required:
          - project_id
          - report_type
          - format
        properties:
          project_id:
            type: string
            format: uuid
          threat_model_id:
            type: string
            format: uuid
          report_type:
            type: string
            enum: [executive, technical, compliance, threat_model]
          format:
            type: string
            enum: [pdf, docx, html, json]
          template_id:
            type: string
            format: uuid
          parameters:
            type: object
            additionalProperties: true
          include_sections:
            type: array
            items:
              type: string
              enum: [summary, threats, mitigations, recommendations, compliance, appendix]
responses:
  '202':
    description: Report generation started
    content:
      application/json:
        schema:
          type: object
          properties:
            report_id:
              type: string
              format: uuid
            status:
              type: string
              enum: [pending, generating, completed, failed]
            estimated_completion:
              type: string
              format: date-time
            status_url:
              type: string
              format: uri
```

#### GET /api/v1/reports/{reportId}/download
```yaml
parameters:
  - name: reportId
    in: path
    required: true
    schema:
      type: string
      format: uuid
responses:
  '200':
    description: Report file
    content:
      application/pdf:
        schema:
          type: string
          format: binary
      application/vnd.openxmlformats-officedocument.wordprocessingml.document:
        schema:
          type: string
          format: binary
      text/html:
        schema:
          type: string
      application/json:
        schema:
          $ref: '#/components/schemas/Report'
  '202':
    description: Report still generating
    content:
      application/json:
        schema:
          type: object
          properties:
            status:
              type: string
              enum: [generating]
            progress:
              type: integer
              minimum: 0
              maximum: 100
            estimated_completion:
              type: string
              format: date-time
```

### 7. TMAC Service API

#### POST /api/v1/tmac/parse
```yaml
requestBody:
  required: true
  content:
    application/yaml:
      schema:
        type: string
        description: YAML threat model definition
    application/json:
      schema:
        type: object
        description: JSON threat model definition
    text/plain:
      schema:
        type: string
        description: DSL threat model definition
responses:
  '200':
    description: Parsed threat model
    content:
      application/json:
        schema:
          type: object
          properties:
            valid:
              type: boolean
            parsed_model:
              $ref: '#/components/schemas/ThreatModel'
            warnings:
              type: array
              items:
                type: object
                properties:
                  line:
                    type: integer
                  column:
                    type: integer
                  message:
                    type: string
            errors:
              type: array
              items:
                type: object
                properties:
                  line:
                    type: integer
                  column:
                    type: integer
                  message:
                    type: string
```

#### POST /api/v1/tmac/generate
```yaml
requestBody:
  required: true
  content:
    application/json:
      schema:
        type: object
        required:
          - model_id
          - outputs
        properties:
          model_id:
            type: string
            format: uuid
          outputs:
            type: array
            items:
              type: string
              enum: [diagram, requirements, tests, terraform, kubernetes]
          format:
            type: string
            enum: [yaml, json, hcl]
            default: yaml
responses:
  '200':
    description: Generated artifacts
    content:
      application/json:
        schema:
          type: object
          properties:
            artifacts:
              type: object
              additionalProperties:
                type: object
                properties:
                  type:
                    type: string
                  content:
                    type: string
                  format:
                    type: string
```

### 8. Diagramming Service API

#### POST /api/v1/diagrams
```yaml
requestBody:
  required: true
  content:
    application/json:
      schema:
        type: object
        required:
          - threat_model_id
          - name
          - type
        properties:
          threat_model_id:
            type: string
            format: uuid
          name:
            type: string
          type:
            type: string
            enum: [dfd, attack_tree, architecture, sequence]
          content:
            type: object
            description: Diagram definition
responses:
  '201':
    description: Diagram created
    content:
      application/json:
        schema:
          $ref: '#/components/schemas/Diagram'
```

#### GET /api/v1/diagrams/{diagramId}/export
```yaml
parameters:
  - name: diagramId
    in: path
    required: true
    schema:
      type: string
      format: uuid
  - name: format
    in: query
    required: true
    schema:
      type: string
      enum: [png, svg, pdf, visio, drawio]
  - name: resolution
    in: query
    schema:
      type: integer
      default: 300
      minimum: 72
      maximum: 600
responses:
  '200':
    description: Exported diagram
    content:
      image/png:
        schema:
          type: string
          format: binary
      image/svg+xml:
        schema:
          type: string
      application/pdf:
        schema:
          type: string
          format: binary
      application/vnd.visio:
        schema:
          type: string
          format: binary
```

### 9. Threat Libraries API

#### GET /api/v1/threat-libraries
```yaml
parameters:
  - name: type
    in: query
    schema:
      type: string
      enum: [standard, custom, commercial]
  - name: source
    in: query
    schema:
      type: string
      enum: [OWASP, MITRE, CAPEC, CSA, custom]
  - name: methodology
    in: query
    schema:
      type: string
      enum: [STRIDE, PASTA, LINDDUN, VAST, DREAD]
  - name: include_inactive
    in: query
    schema:
      type: boolean
      default: false
responses:
  '200':
    description: List of threat libraries
    content:
      application/json:
        schema:
          type: object
          properties:
            data:
              type: array
              items:
                $ref: '#/components/schemas/ThreatLibrary'
```

#### POST /api/v1/threat-libraries/search
```yaml
requestBody:
  required: true
  content:
    application/json:
      schema:
        type: object
        required:
          - query
        properties:
          query:
            type: string
            description: Search query
          libraries:
            type: array
            items:
              type: string
              format: uuid
            description: Limit search to specific libraries
          filters:
            type: object
            properties:
              severity:
                type: array
                items:
                  type: string
                  enum: [critical, high, medium, low, info]
              category:
                type: array
                items:
                  type: string
              platforms:
                type: array
                items:
                  type: string
          limit:
            type: integer
            default: 50
            maximum: 200
responses:
  '200':
    description: Search results
    content:
      application/json:
        schema:
          type: object
          properties:
            results:
              type: array
              items:
                type: object
                properties:
                  threat:
                    $ref: '#/components/schemas/LibraryThreat'
                  library:
                    type: object
                    properties:
                      id:
                        type: string
                        format: uuid
                      name:
                        type: string
                      version:
                        type: string
                  relevance_score:
                    type: number
                    format: float
            total_count:
              type: integer
```

### 10. Privacy Service API

#### POST /api/v1/privacy/assessments
```yaml
requestBody:
  required: true
  content:
    application/json:
      schema:
        type: object
        required:
          - threat_model_id
          - assessment_type
        properties:
          threat_model_id:
            type: string
            format: uuid
          assessment_type:
            type: string
            enum: [linddun_go, linddun_pro, linddun_maestro]
responses:
  '201':
    description: Privacy assessment created
    content:
      application/json:
        schema:
          $ref: '#/components/schemas/PrivacyAssessment'
```

#### POST /api/v1/privacy/pia/generate
```yaml
requestBody:
  required: true
  content:
    application/json:
      schema:
        type: object
        required:
          - project_id
        properties:
          project_id:
            type: string
            format: uuid
          include_sections:
            type: array
            items:
              type: string
              enum: [
                purpose_of_processing,
                legal_basis,
                data_inventory,
                data_flows,
                third_parties,
                international_transfers,
                security_measures,
                privacy_risks,
                mitigations
              ]
responses:
  '200':
    description: Generated Privacy Impact Assessment
    content:
      application/json:
        schema:
          $ref: '#/components/schemas/PrivacyImpactAssessment'
```

## GraphQL Schema

```graphql
type Query {
  # User queries
  me: User!
  user(id: ID!): User
  users(
    page: Int = 1
    limit: Int = 20
    search: String
    role: UserRole
  ): UserConnection!
  
  # Project queries
  project(id: ID!): Project
  projects(
    page: Int = 1
    limit: Int = 20
    status: ProjectStatus
    riskProfile: RiskProfile
    tags: [String!]
  ): ProjectConnection!
  
  # Threat model queries
  threatModel(id: ID!): ThreatModel
  threatModels(
    projectId: ID!
    status: ThreatModelStatus
    methodology: Methodology
  ): [ThreatModel!]!
  
  # Threat queries
  threat(id: ID!): Threat
  threats(
    threatModelId: ID!
    status: ThreatStatus
    minRiskScore: Float
  ): [Threat!]!
  
  # Search
  searchThreats(
    query: String!
    libraries: [ID!]
    limit: Int = 50
  ): ThreatSearchResults!
}

type Mutation {
  # Authentication
  login(email: String!, password: String!, mfaCode: String): AuthPayload!
  logout: Boolean!
  refreshToken(refreshToken: String!): AuthPayload!
  
  # User management
  createUser(input: CreateUserInput!): User!
  updateUser(id: ID!, input: UpdateUserInput!): User!
  deleteUser(id: ID!): Boolean!
  
  # Project management
  createProject(input: CreateProjectInput!): Project!
  updateProject(id: ID!, input: UpdateProjectInput!): Project!
  archiveProject(id: ID!): Project!
  
  # Threat modeling
  createThreatModel(input: CreateThreatModelInput!): ThreatModel!
  updateThreatModel(id: ID!, input: UpdateThreatModelInput!): ThreatModel!
  analyzeThreatModel(id: ID!, depth: AnalysisDepth = STANDARD): AnalysisResult!
  
  # Threats
  createThreat(input: CreateThreatInput!): Threat!
  updateThreat(id: ID!, input: UpdateThreatInput!): Threat!
  deleteThreat(id: ID!): Boolean!
  
  # Mitigations
  createMitigation(threatId: ID!, input: CreateMitigationInput!): Mitigation!
  updateMitigation(id: ID!, input: UpdateMitigationInput!): Mitigation!
  deleteMitigation(id: ID!): Boolean!
}

type Subscription {
  # Real-time updates
  threatModelUpdated(id: ID!): ThreatModel!
  threatIdentified(threatModelId: ID!): Threat!
  collaboratorJoined(projectId: ID!): User!
  reportGenerated(reportId: ID!): Report!
}

# Types
type User {
  id: ID!
  email: String!
  username: String!
  firstName: String!
  lastName: String!
  avatarUrl: String
  roles: [Role!]!
  organizations: [Organization!]!
  createdAt: DateTime!
  updatedAt: DateTime!
}

type Project {
  id: ID!
  name: String!
  description: String
  slug: String!
  projectType: ProjectType!
  tags: [String!]!
  riskProfile: RiskProfile!
  complianceFrameworks: [ComplianceFramework!]!
  threatModels: [ThreatModel!]!
  collaborators: [ProjectCollaborator!]!
  createdBy: User!
  createdAt: DateTime!
  updatedAt: DateTime!
}

type ThreatModel {
  id: ID!
  project: Project!
  version: Int!
  name: String!
  description: String
  methodology: Methodology!
  status: ThreatModelStatus!
  components: [Component!]!
  dataFlows: [DataFlow!]!
  threats: [Threat!]!
  diagrams: [Diagram!]!
  createdBy: User!
  createdAt: DateTime!
  updatedAt: DateTime!
}

type Threat {
  id: ID!
  threatId: String!
  name: String!
  description: String!
  category: String!
  likelihood: Likelihood!
  impact: Impact!
  riskScore: Float!
  status: ThreatStatus!
  affectedComponent: Component
  affectedFlow: DataFlow
  mitigations: [Mitigation!]!
  identifiedBy: User!
  identifiedAt: DateTime!
}

# Enums
enum UserRole {
  ADMIN
  PROJECT_MANAGER
  SECURITY_ANALYST
  DEVELOPER
  VIEWER
}

enum ProjectStatus {
  ACTIVE
  ARCHIVED
}

enum RiskProfile {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}

enum Methodology {
  STRIDE
  PASTA
  LINDDUN
  VAST
  DREAD
}

enum ThreatModelStatus {
  DRAFT
  IN_REVIEW
  APPROVED
  ARCHIVED
}

enum ThreatStatus {
  IDENTIFIED
  ANALYZING
  MITIGATED
  ACCEPTED
  TRANSFERRED
}

enum Likelihood {
  VERY_LOW
  LOW
  MEDIUM
  HIGH
  VERY_HIGH
}

enum Impact {
  VERY_LOW
  LOW
  MEDIUM
  HIGH
  VERY_HIGH
}

enum AnalysisDepth {
  QUICK
  STANDARD
  COMPREHENSIVE
}
```

## WebSocket Events

### Connection
```javascript
// Client connection
const socket = io('wss://api.threatmodel.io', {
  auth: {
    token: 'jwt_token'
  }
});

// Join project room
socket.emit('join', { projectId: 'project_uuid' });
```

### Real-time Collaboration Events

#### Diagram Collaboration
```javascript
// Cursor movement
socket.on('cursor:move', (data) => {
  // data: { userId, x, y, diagramId }
});

// Element changes
socket.on('diagram:element:update', (data) => {
  // data: { elementId, changes, userId, timestamp }
});

// User presence
socket.on('presence:update', (data) => {
  // data: { users: [{ id, name, avatar, status }] }
});
```

#### Threat Model Updates
```javascript
// New threat identified
socket.on('threat:identified', (data) => {
  // data: { threat, modelId, identifiedBy }
});

// Threat status change
socket.on('threat:status:changed', (data) => {
  // data: { threatId, oldStatus, newStatus, changedBy }
});

// Model approval
socket.on('model:approved', (data) => {
  // data: { modelId, approvedBy, timestamp }
});
```

## Error Handling

### Error Response Format (RFC 7807)
```json
{
  "type": "https://api.threatmodel.io/errors/validation-failed",
  "title": "Validation Failed",
  "status": 400,
  "detail": "The request body contains invalid fields",
  "instance": "/api/v1/projects",
  "errors": [
    {
      "field": "name",
      "code": "required",
      "message": "Project name is required"
    },
    {
      "field": "project_type",
      "code": "invalid_enum",
      "message": "Project type must be one of: web_app, mobile_app, api, infrastructure"
    }
  ]
}
```

### Common Error Types
- `https://api.threatmodel.io/errors/authentication-failed`
- `https://api.threatmodel.io/errors/authorization-failed`
- `https://api.threatmodel.io/errors/resource-not-found`
- `https://api.threatmodel.io/errors/validation-failed`
- `https://api.threatmodel.io/errors/conflict`
- `https://api.threatmodel.io/errors/rate-limit-exceeded`
- `https://api.threatmodel.io/errors/internal-server-error`

## Rate Limiting

### Headers
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1704070800
X-RateLimit-Reset-After: 3600
```

### Limits by Endpoint
- Authentication: 10 requests per minute
- Resource Creation: 100 requests per hour
- Resource Reading: 1000 requests per hour
- AI/ML Endpoints: 50 requests per hour
- Report Generation: 10 requests per hour

## Pagination

### Request Parameters
```
GET /api/v1/projects?page=2&limit=20&sort=created_at&order=desc
```

### Response Format
```json
{
  "data": [...],
  "pagination": {
    "page": 2,
    "limit": 20,
    "total": 150,
    "pages": 8,
    "has_next": true,
    "has_prev": true
  },
  "links": {
    "self": "/api/v1/projects?page=2&limit=20",
    "first": "/api/v1/projects?page=1&limit=20",
    "prev": "/api/v1/projects?page=1&limit=20",
    "next": "/api/v1/projects?page=3&limit=20",
    "last": "/api/v1/projects?page=8&limit=20"
  }
}
```

## API Versioning

### Deprecation Notice Headers
```
Sunset: Sat, 1 Jan 2025 00:00:00 GMT
Deprecation: true
Link: <https://api.threatmodel.io/v2/docs>; rel="successor-version"
```

### Version Negotiation
```
# Via URL path (preferred)
GET /api/v1/projects

# Via header (alternative)
GET /api/projects
API-Version: 2024-01-01

# Via query parameter (discouraged)
GET /api/projects?version=1
```

## Security Headers

All API responses include:
```
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Content-Security-Policy: default-src 'none'
X-Request-ID: 550e8400-e29b-41d4-a716-446655440000
```

### 11. Integration Service API

#### GET /api/v1/integrations
```yaml
parameters:
  - name: type
    in: query
    schema:
      type: string
      enum: [source_control, ci_cd, issue_tracking, security_tools, communication]
  - name: status
    in: query
    schema:
      type: string
      enum: [active, inactive, error]
responses:
  '200':
    description: List of configured integrations
    content:
      application/json:
        schema:
          type: object
          properties:
            data:
              type: array
              items:
                $ref: '#/components/schemas/Integration'
```

#### POST /api/v1/integrations/github/sync
```yaml
requestBody:
  required: true
  content:
    application/json:
      schema:
        type: object
        required:
          - repository
          - action
        properties:
          repository:
            type: string
            pattern: '^[\w-]+/[\w-]+$'
          action:
            type: string
            enum: [import_issues, export_threats, sync_bidirectional]
          branch:
            type: string
            default: main
          filters:
            type: object
            properties:
              labels:
                type: array
                items:
                  type: string
              assignees:
                type: array
                items:
                  type: string
responses:
  '202':
    description: Sync operation started
    content:
      application/json:
        schema:
          type: object
          properties:
            sync_id:
              type: string
              format: uuid
            status:
              type: string
              enum: [pending, running, completed, failed]
            items_to_sync:
              type: integer
```

#### POST /api/v1/integrations/jira/import
```yaml
requestBody:
  required: true
  content:
    application/json:
      schema:
        type: object
        required:
          - project_key
          - issue_types
        properties:
          project_key:
            type: string
          issue_types:
            type: array
            items:
              type: string
              enum: [bug, security_issue, risk, task]
          jql_filter:
            type: string
            description: JIRA Query Language filter
          map_to_threats:
            type: boolean
            default: true
responses:
  '200':
    description: Import results
    content:
      application/json:
        schema:
          type: object
          properties:
            imported:
              type: integer
            skipped:
              type: integer
            errors:
              type: array
              items:
                type: object
                properties:
                  issue_key:
                    type: string
                  error:
                    type: string
```

### 12. Notification Service API

#### GET /api/v1/notifications/preferences
```yaml
security:
  - bearerAuth: []
responses:
  '200':
    description: User notification preferences
    content:
      application/json:
        schema:
          type: object
          properties:
            email:
              type: object
              properties:
                enabled:
                  type: boolean
                frequency:
                  type: string
                  enum: [immediate, hourly, daily, weekly]
                categories:
                  type: object
                  additionalProperties:
                    type: boolean
            slack:
              type: object
              properties:
                enabled:
                  type: boolean
                channel:
                  type: string
                mention_on_critical:
                  type: boolean
            in_app:
              type: object
              properties:
                enabled:
                  type: boolean
                show_desktop:
                  type: boolean
```

#### PUT /api/v1/notifications/preferences
```yaml
requestBody:
  required: true
  content:
    application/json:
      schema:
        $ref: '#/components/schemas/NotificationPreferences'
responses:
  '200':
    description: Preferences updated
    content:
      application/json:
        schema:
          $ref: '#/components/schemas/NotificationPreferences'
```

#### POST /api/v1/notifications/send
```yaml
requestBody:
  required: true
  content:
    application/json:
      schema:
        type: object
        required:
          - recipients
          - type
          - content
        properties:
          recipients:
            type: array
            items:
              type: string
              format: uuid
          type:
            type: string
            enum: [threat_identified, model_approved, review_required, report_ready, system_alert]
          content:
            type: object
            properties:
              title:
                type: string
              message:
                type: string
              data:
                type: object
                additionalProperties: true
          channels:
            type: array
            items:
              type: string
              enum: [email, slack, in_app, sms]
          priority:
            type: string
            enum: [low, medium, high, critical]
            default: medium
responses:
  '202':
    description: Notification queued
    content:
      application/json:
        schema:
          type: object
          properties:
            notification_id:
              type: string
              format: uuid
            status:
              type: string
              enum: [queued, sending, sent, failed]
```

### 13. Audit Service API

#### GET /api/v1/audit/logs
```yaml
parameters:
  - name: start_date
    in: query
    required: true
    schema:
      type: string
      format: date-time
  - name: end_date
    in: query
    required: true
    schema:
      type: string
      format: date-time
  - name: entity_type
    in: query
    schema:
      type: string
      enum: [user, project, threat_model, threat, report]
  - name: entity_id
    in: query
    schema:
      type: string
      format: uuid
  - name: user_id
    in: query
    schema:
      type: string
      format: uuid
  - name: action
    in: query
    schema:
      type: string
      enum: [create, read, update, delete, login, logout, export, approve, reject]
  - name: page
    in: query
    schema:
      type: integer
      default: 1
  - name: limit
    in: query
    schema:
      type: integer
      default: 50
      maximum: 1000
responses:
  '200':
    description: Audit log entries
    content:
      application/json:
        schema:
          type: object
          properties:
            data:
              type: array
              items:
                $ref: '#/components/schemas/AuditLogEntry'
            pagination:
              $ref: '#/components/schemas/Pagination'
```

#### POST /api/v1/audit/export
```yaml
requestBody:
  required: true
  content:
    application/json:
      schema:
        type: object
        required:
          - start_date
          - end_date
          - format
        properties:
          start_date:
            type: string
            format: date-time
          end_date:
            type: string
            format: date-time
          filters:
            type: object
            properties:
              entity_types:
                type: array
                items:
                  type: string
              user_ids:
                type: array
                items:
                  type: string
                  format: uuid
              actions:
                type: array
                items:
                  type: string
          format:
            type: string
            enum: [csv, json, xlsx]
          include_fields:
            type: array
            items:
              type: string
responses:
  '202':
    description: Export job created
    content:
      application/json:
        schema:
          type: object
          properties:
            export_id:
              type: string
              format: uuid
            status:
              type: string
              enum: [pending, processing, completed, failed]
            download_url:
              type: string
              format: uri
```

#### GET /api/v1/audit/compliance/report
```yaml
parameters:
  - name: framework
    in: query
    required: true
    schema:
      type: string
      enum: [GDPR, HIPAA, PCI-DSS, SOC2, ISO27001]
  - name: period
    in: query
    schema:
      type: string
      enum: [daily, weekly, monthly, quarterly, yearly]
      default: monthly
responses:
  '200':
    description: Compliance audit report
    content:
      application/json:
        schema:
          type: object
          properties:
            framework:
              type: string
            period:
              type: object
              properties:
                start:
                  type: string
                  format: date-time
                end:
                  type: string
                  format: date-time
            compliance_score:
              type: number
              format: float
              minimum: 0
              maximum: 100
            requirements:
              type: array
              items:
                type: object
                properties:
                  requirement_id:
                    type: string
                  status:
                    type: string
                    enum: [compliant, non_compliant, partial, not_applicable]
                  evidence:
                    type: array
                    items:
                      type: object
                      properties:
                        type:
                          type: string
                        description:
                          type: string
                        timestamp:
                          type: string
                          format: date-time
            recommendations:
              type: array
              items:
                type: string
```

### 14. Analytics Service API

#### GET /api/v1/analytics/dashboard
```yaml
parameters:
  - name: period
    in: query
    schema:
      type: string
      enum: [today, week, month, quarter, year]
      default: month
  - name: organization_id
    in: query
    schema:
      type: string
      format: uuid
responses:
  '200':
    description: Analytics dashboard data
    content:
      application/json:
        schema:
          type: object
          properties:
            summary:
              type: object
              properties:
                total_projects:
                  type: integer
                active_threat_models:
                  type: integer
                identified_threats:
                  type: integer
                mitigated_threats:
                  type: integer
                avg_risk_score:
                  type: number
                  format: float
            trends:
              type: object
              properties:
                threats_over_time:
                  type: array
                  items:
                    type: object
                    properties:
                      date:
                        type: string
                        format: date
                      count:
                        type: integer
                      risk_score:
                        type: number
                risk_distribution:
                  type: object
                  properties:
                    critical:
                      type: integer
                    high:
                      type: integer
                    medium:
                      type: integer
                    low:
                      type: integer
            top_threats:
              type: array
              items:
                type: object
                properties:
                  threat_id:
                    type: string
                  name:
                    type: string
                  occurrences:
                    type: integer
                  avg_risk_score:
                    type: number
            methodology_usage:
              type: object
              additionalProperties:
                type: integer
```

#### POST /api/v1/analytics/custom-report
```yaml
requestBody:
  required: true
  content:
    application/json:
      schema:
        type: object
        required:
          - metrics
          - dimensions
          - date_range
        properties:
          metrics:
            type: array
            items:
              type: string
              enum: [
                threat_count,
                risk_score,
                mitigation_rate,
                model_completion_time,
                user_activity,
                compliance_score
              ]
          dimensions:
            type: array
            items:
              type: string
              enum: [
                project,
                methodology,
                threat_category,
                user,
                organization,
                time
              ]
          date_range:
            type: object
            properties:
              start:
                type: string
                format: date
              end:
                type: string
                format: date
          filters:
            type: object
            additionalProperties: true
          granularity:
            type: string
            enum: [hour, day, week, month]
            default: day
responses:
  '200':
    description: Custom analytics report
    content:
      application/json:
        schema:
          type: object
          properties:
            metadata:
              type: object
              properties:
                generated_at:
                  type: string
                  format: date-time
                query_time_ms:
                  type: integer
            data:
              type: array
              items:
                type: object
                additionalProperties: true
```

#### GET /api/v1/analytics/insights
```yaml
parameters:
  - name: project_id
    in: query
    schema:
      type: string
      format: uuid
  - name: limit
    in: query
    schema:
      type: integer
      default: 10
responses:
  '200':
    description: AI-generated insights
    content:
      application/json:
        schema:
          type: object
          properties:
            insights:
              type: array
              items:
                type: object
                properties:
                  type:
                    type: string
                    enum: [trend, anomaly, recommendation, prediction]
                  title:
                    type: string
                  description:
                    type: string
                  severity:
                    type: string
                    enum: [info, warning, critical]
                  data:
                    type: object
                    additionalProperties: true
                  confidence:
                    type: number
                    format: float
                    minimum: 0
                    maximum: 1
                  action_items:
                    type: array
                    items:
                      type: string
```

## Component Schemas

### Core Schemas

```yaml
components:
  schemas:
    User:
      type: object
      properties:
        id:
          type: string
          format: uuid
        email:
          type: string
          format: email
        username:
          type: string
        first_name:
          type: string
        last_name:
          type: string
        avatar_url:
          type: string
          format: uri
        roles:
          type: array
          items:
            $ref: '#/components/schemas/Role'
        organization:
          $ref: '#/components/schemas/Organization'
        created_at:
          type: string
          format: date-time
        updated_at:
          type: string
          format: date-time
    
    Project:
      type: object
      properties:
        id:
          type: string
          format: uuid
        name:
          type: string
        description:
          type: string
        slug:
          type: string
        project_type:
          type: string
          enum: [web_app, mobile_app, api, infrastructure, iot, desktop]
        tags:
          type: array
          items:
            type: string
        risk_profile:
          type: string
          enum: [low, medium, high, critical]
        compliance_frameworks:
          type: array
          items:
            type: string
        metadata:
          type: object
          additionalProperties: true
        created_by:
          type: string
          format: uuid
        created_at:
          type: string
          format: date-time
        updated_at:
          type: string
          format: date-time
    
    ThreatModel:
      type: object
      properties:
        id:
          type: string
          format: uuid
        project_id:
          type: string
          format: uuid
        version:
          type: integer
        name:
          type: string
        description:
          type: string
        methodology:
          type: string
          enum: [STRIDE, PASTA, LINDDUN, VAST, DREAD]
        status:
          type: string
          enum: [draft, in_review, approved, archived]
        scope:
          type: string
        assumptions:
          type: array
          items:
            type: string
        metadata:
          type: object
          additionalProperties: true
        created_by:
          type: string
          format: uuid
        created_at:
          type: string
          format: date-time
        updated_at:
          type: string
          format: date-time
    
    Threat:
      type: object
      properties:
        id:
          type: string
          format: uuid
        threat_model_id:
          type: string
          format: uuid
        threat_id:
          type: string
        name:
          type: string
        description:
          type: string
        category:
          type: string
        stride_category:
          type: string
          enum: [spoofing, tampering, repudiation, information_disclosure, denial_of_service, elevation_of_privilege]
        likelihood:
          type: string
          enum: [very_low, low, medium, high, very_high]
        impact:
          type: string
          enum: [very_low, low, medium, high, very_high]
        risk_score:
          type: number
          format: float
        status:
          type: string
          enum: [identified, analyzing, mitigated, accepted, transferred]
        mitigations:
          type: array
          items:
            $ref: '#/components/schemas/Mitigation'
        metadata:
          type: object
          additionalProperties: true
        identified_by:
          type: string
          format: uuid
        identified_at:
          type: string
          format: date-time
    
    Mitigation:
      type: object
      properties:
        id:
          type: string
          format: uuid
        name:
          type: string
        description:
          type: string
        implementation_status:
          type: string
          enum: [planned, in_progress, implemented, verified]
        cost_estimate:
          type: string
          enum: [low, medium, high]
        effectiveness:
          type: string
          enum: [low, medium, high]
        responsible_party:
          type: string
        due_date:
          type: string
          format: date
        verification_method:
          type: string
    
    Component:
      type: object
      properties:
        id:
          type: string
          format: uuid
        name:
          type: string
        type:
          type: string
          enum: [web_server, database, api, mobile_app, third_party_service, user, process]
        trust_level:
          type: string
          enum: [trusted, semi_trusted, untrusted]
        technologies:
          type: array
          items:
            type: string
        data_processed:
          type: array
          items:
            type: object
            properties:
              type:
                type: string
              classification:
                type: string
                enum: [public, internal, confidential, secret]
    
    DataFlow:
      type: object
      properties:
        id:
          type: string
          format: uuid
        source_id:
          type: string
          format: uuid
        destination_id:
          type: string
          format: uuid
        protocol:
          type: string
        data_classification:
          type: string
          enum: [public, internal, confidential, secret]
        authentication_required:
          type: boolean
        encryption_type:
          type: string
          enum: [none, tls, e2e_encryption]
    
    Diagram:
      type: object
      properties:
        id:
          type: string
          format: uuid
        threat_model_id:
          type: string
          format: uuid
        name:
          type: string
        type:
          type: string
          enum: [dfd, attack_tree, architecture, sequence]
        content:
          type: object
          additionalProperties: true
        version:
          type: integer
        created_by:
          type: string
          format: uuid
        created_at:
          type: string
          format: date-time
        updated_at:
          type: string
          format: date-time
    
    ThreatLibrary:
      type: object
      properties:
        id:
          type: string
          format: uuid
        name:
          type: string
        version:
          type: string
        type:
          type: string
          enum: [standard, custom, commercial]
        source:
          type: string
          enum: [OWASP, MITRE, CAPEC, CSA, custom]
        methodology:
          type: string
          enum: [STRIDE, PASTA, LINDDUN, VAST, DREAD]
        description:
          type: string
        is_active:
          type: boolean
        threat_count:
          type: integer
        last_updated:
          type: string
          format: date-time
    
    Report:
      type: object
      properties:
        id:
          type: string
          format: uuid
        project_id:
          type: string
          format: uuid
        threat_model_id:
          type: string
          format: uuid
        type:
          type: string
          enum: [executive, technical, compliance, threat_model]
        format:
          type: string
          enum: [pdf, docx, html, json]
        status:
          type: string
          enum: [pending, generating, completed, failed]
        download_url:
          type: string
          format: uri
        metadata:
          type: object
          additionalProperties: true
        generated_at:
          type: string
          format: date-time
        expires_at:
          type: string
          format: date-time
    
    AuditLogEntry:
      type: object
      properties:
        id:
          type: string
          format: uuid
        timestamp:
          type: string
          format: date-time
        user_id:
          type: string
          format: uuid
        organization_id:
          type: string
          format: uuid
        action:
          type: string
        entity_type:
          type: string
        entity_id:
          type: string
          format: uuid
        changes:
          type: object
          properties:
            before:
              type: object
              additionalProperties: true
            after:
              type: object
              additionalProperties: true
        ip_address:
          type: string
          format: ipv4
        user_agent:
          type: string
        session_id:
          type: string
    
    Pagination:
      type: object
      properties:
        page:
          type: integer
        limit:
          type: integer
        total:
          type: integer
        pages:
          type: integer
        has_next:
          type: boolean
        has_prev:
          type: boolean
```

## API Testing Strategy

### Testing Levels

1. **Unit Tests**
   - Test individual endpoint handlers
   - Mock external dependencies
   - Validate request/response schemas
   - Test error handling

2. **Integration Tests**
   - Test complete API flows
   - Verify database interactions
   - Test authentication/authorization
   - Validate data consistency

3. **Contract Tests**
   - Ensure API matches OpenAPI specification
   - Test backward compatibility
   - Validate response formats

4. **Performance Tests**
   - Load testing with k6 or JMeter
   - Stress testing for rate limits
   - Latency measurements
   - Resource utilization monitoring

### Testing Tools

```yaml
tools:
  unit_testing:
    - Jest (Node.js)
    - pytest (Python)
    - go test (Go)
  
  api_testing:
    - Postman/Newman
    - REST Assured
    - Insomnia
    - Bruno
  
  contract_testing:
    - Dredd
    - Pact
    - Schemathesis
  
  load_testing:
    - k6
    - Apache JMeter
    - Gatling
    - Locust
  
  security_testing:
    - OWASP ZAP
    - Burp Suite
    - SQLMap
    - Nikto
```

### Test Data Management

1. **Fixtures**: Predefined test data sets
2. **Factories**: Dynamic test data generation
3. **Mocks**: External service simulation
4. **Sandbox**: Isolated test environments

## API Monitoring

### Health Checks

```yaml
# GET /health
responses:
  '200':
    description: Service health status
    content:
      application/json:
        schema:
          type: object
          properties:
            status:
              type: string
              enum: [healthy, degraded, unhealthy]
            version:
              type: string
            uptime:
              type: integer
            services:
              type: object
              additionalProperties:
                type: object
                properties:
                  status:
                    type: string
                  latency_ms:
                    type: integer
```

### Metrics Endpoints

- `/metrics` - Prometheus format metrics
- `/api/v1/status` - Detailed system status
- `/api/v1/health/dependencies` - External service health

## API SDK Generation

Automatic SDK generation for multiple languages:

```bash
# Generate TypeScript SDK
openapi-generator generate -i openapi.yaml -g typescript-axios -o ./sdk/typescript

# Generate Python SDK
openapi-generator generate -i openapi.yaml -g python -o ./sdk/python

# Generate Go SDK
openapi-generator generate -i openapi.yaml -g go -o ./sdk/go

# Generate Java SDK
openapi-generator generate -i openapi.yaml -g java -o ./sdk/java
```

## OpenAPI Specification

The complete OpenAPI 3.0 specification is available at:
- Development: `http://localhost:8000/openapi.json`
- Production: `https://api.threatmodel.io/openapi.json`

Interactive documentation:
- Development: `http://localhost:8000/docs`
- Production: `https://api.threatmodel.io/docs`