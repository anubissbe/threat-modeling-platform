# Database Design Document

## Overview
This document describes the database design for the Threat Modeling Application that supports multiple methodologies (STRIDE, PASTA, LINDDUN, VAST, DREAD) with extensibility for custom methodologies.

## Design Principles

1. **Multi-Methodology Support**: Generic schema that accommodates different threat modeling methodologies
2. **Extensibility**: JSONB fields for methodology-specific data
3. **Performance**: Proper indexing for common queries and full-text search
4. **Multi-Tenancy**: Organization-based data isolation with Row Level Security
5. **Audit Trail**: Comprehensive activity logging
6. **Collaboration**: Support for comments, team workflows, and real-time updates

## Core Entities

### Organizations & Users
- **organizations**: Top-level tenant isolation
- **users**: System users with role-based access
- **teams**: Collaborative groups within organizations
- **team_members**: Many-to-many relationship for team membership

### Projects & Threat Models
- **projects**: Container for threat modeling initiatives
- **threat_models**: Specific threat model instances with methodology selection
- **diagrams**: DFD and other diagram storage
- **diagram_elements**: Individual components within diagrams (processes, data stores, etc.)

### Threats & Mitigations
- **threats**: Identified threats with flexible categorization
- **mitigations**: Countermeasures for threats
- **assets**: Things of value being protected
- **threat_templates**: Reusable threat patterns

### Supporting Tables
- **comments**: Collaboration on any entity
- **activity_logs**: Audit trail
- **reports**: Generated documentation
- **integrations**: External system configurations
- **compliance_mappings**: Regulatory framework mappings

## Methodology Support Strategy

### Generic Fields
All methodologies share common fields:
- Title and description
- Risk scoring (likelihood × impact)
- Status tracking
- Categorization

### Methodology-Specific Data
The `methodology_data` JSONB field stores methodology-specific attributes:

#### STRIDE Example
```json
{
  "category": "Spoofing",
  "affected_element": "auth-service",
  "attack_vector": "credential_theft"
}
```

#### PASTA Example
```json
{
  "stage": 3,
  "attack_scenario": "...",
  "business_objective": "...",
  "technical_impact": "..."
}
```

#### DREAD Example
```json
{
  "damage_potential": 8,
  "reproducibility": 7,
  "exploitability": 6,
  "affected_users": 9,
  "discoverability": 5,
  "dread_score": 7.0
}
```

## Key Design Decisions

### 1. JSONB vs Normalized Tables
- **Decision**: Use JSONB for methodology-specific data
- **Rationale**: 
  - Flexibility for adding new methodologies
  - Avoids complex table inheritance
  - PostgreSQL's JSONB performance is excellent
  - Can still index and query JSON fields

### 2. Diagram Storage
- **Decision**: Store diagram data as JSONB
- **Rationale**:
  - Diagrams are complex nested structures
  - Easier to sync with frontend libraries
  - Version control friendly

### 3. Soft Deletes vs Hard Deletes
- **Decision**: Use status fields and activity logs
- **Rationale**:
  - Maintain audit trail
  - Support "undo" operations
  - Compliance requirements

### 4. UUID Primary Keys
- **Decision**: Use UUIDs instead of serial integers
- **Rationale**:
  - Better for distributed systems
  - No information leakage
  - Easier data migration

## Performance Optimizations

### Indexes
1. **Primary Keys**: Automatic B-tree indexes
2. **Foreign Keys**: Indexed for JOIN performance
3. **Search**: GIN indexes for full-text search
4. **Filtering**: B-tree indexes on status, risk_level, methodology
5. **Time-based**: Indexes on created_at for time-series queries

### Query Patterns
Common query patterns optimized:
- Find all threats for a project
- Search threats by text
- Filter by risk level and status
- Time-based activity reports
- User's assigned mitigations

## Security Considerations

### Row Level Security (RLS)
```sql
-- Example policy for projects
CREATE POLICY project_access ON projects
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = current_user_id()
            AND users.organization_id = projects.organization_id
        )
    );
```

### Sensitive Data
- Integration credentials stored encrypted in `config` JSONB
- User passwords handled by auth service (not stored in main DB)
- API keys hashed before storage

## Scalability Considerations

### Partitioning Strategy
For large deployments, consider partitioning:
- **activity_logs**: Partition by created_at (monthly)
- **threats**: Partition by organization_id for large multi-tenant deployments

### Read Replicas
- Use read replicas for:
  - Report generation
  - Search operations
  - Analytics queries

### Caching Strategy
- Cache frequently accessed data:
  - User permissions
  - Organization settings
  - Methodology configurations

## Migration Strategy

### Version Control
- All schema changes through versioned migration files
- Rollback scripts for each migration
- Test migrations on staging before production

### Data Migration
- JSONB allows gradual migration of methodology-specific fields
- Background jobs for large data transformations
- Zero-downtime migrations using PostgreSQL features

## Backup and Recovery

### Backup Strategy
- Daily full backups
- Continuous WAL archiving
- Point-in-time recovery capability

### Data Retention
- Activity logs: 2 years
- Deleted projects: 90 days (soft delete)
- Generated reports: 1 year

## Example Queries

### Find High-Risk Threats
```sql
SELECT t.*, tm.name as model_name, p.name as project_name
FROM threats t
JOIN threat_models tm ON t.threat_model_id = tm.id
JOIN projects p ON tm.project_id = p.id
WHERE t.risk_level IN ('critical', 'high')
AND t.status != 'mitigated'
AND p.organization_id = ?
ORDER BY t.risk_score DESC;
```

### Methodology Distribution
```sql
SELECT methodology, COUNT(*) as count
FROM threat_models
WHERE project_id IN (
    SELECT id FROM projects WHERE organization_id = ?
)
GROUP BY methodology
ORDER BY count DESC;
```

### Search Threats
```sql
SELECT * FROM threats
WHERE to_tsvector('english', title || ' ' || description) 
  @@ plainto_tsquery('english', ?)
AND threat_model_id IN (
    SELECT id FROM threat_models WHERE project_id = ?
)
ORDER BY ts_rank(
    to_tsvector('english', title || ' ' || description),
    plainto_tsquery('english', ?)
) DESC;
```

## Future Considerations

1. **Graph Database Integration**: For complex relationship analysis
2. **Time-Series Data**: Separate storage for metrics and analytics
3. **Document Storage**: Consider external blob storage for large attachments
4. **Multi-Region**: Database replication for global deployments