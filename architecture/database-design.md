# Database Design - Threat Modeling Application

## Overview
This document outlines the comprehensive database schema design for the Threat Modeling Application. The design supports multi-tenancy, scalability, and covers all functional requirements across the 14 microservices.

## Database Strategy

### Primary Database: PostgreSQL 15
- **Rationale**: ACID compliance, JSON support, extensions (pgvector, pgcrypto)
- **Configuration**: 
  - Connection pooling with PgBouncer
  - Read replicas for scalability
  - Partitioning for large tables

### Supporting Databases
- **Redis**: Session storage, caching, real-time features
- **pgvector**: AI/ML embeddings and similarity search
- **ClickHouse**: Analytics and time-series data
- **MinIO/S3**: Object storage for files and reports

## Core Schemas

### 1. User Management Schema

```sql
-- Organizations (Multi-tenancy support)
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    plan VARCHAR(50) DEFAULT 'free', -- free, pro, enterprise
    is_active BOOLEAN DEFAULT true,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    mfa_enabled BOOLEAN DEFAULT false,
    mfa_secret VARCHAR(255),
    last_login_at TIMESTAMP WITH TIME ZONE,
    password_changed_at TIMESTAMP WITH TIME ZONE,
    preferences JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Organization membership
CREATE TABLE organization_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL, -- owner, admin, member, viewer
    invited_by UUID REFERENCES users(id),
    invited_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    joined_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    UNIQUE(organization_id, user_id)
);

-- Teams within organizations
CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Team membership
CREATE TABLE team_members (
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'member', -- lead, member
    added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (team_id, user_id)
);

-- Roles and permissions
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    organization_id UUID REFERENCES organizations(id),
    is_system BOOLEAN DEFAULT false,
    permissions JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(name, organization_id)
);

-- User roles assignment
CREATE TABLE user_roles (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    granted_by UUID REFERENCES users(id),
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE,
    PRIMARY KEY (user_id, role_id, organization_id)
);

-- API keys for service accounts
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    key_hash VARCHAR(255) NOT NULL,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    permissions JSONB DEFAULT '[]',
    last_used_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Authentication sessions
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) UNIQUE NOT NULL,
    ip_address INET,
    user_agent TEXT,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_org_members_user ON organization_members(user_id);
CREATE INDEX idx_org_members_org ON organization_members(organization_id);
CREATE INDEX idx_sessions_token ON sessions(token_hash);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);
```

### 2. Project and Threat Model Schema

```sql
-- Projects
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    slug VARCHAR(255) NOT NULL,
    project_type VARCHAR(50), -- web_app, mobile_app, api, infrastructure
    tags TEXT[],
    risk_profile VARCHAR(50) DEFAULT 'medium', -- low, medium, high, critical
    compliance_frameworks TEXT[], -- GDPR, HIPAA, PCI-DSS, SOC2
    metadata JSONB DEFAULT '{}',
    is_archived BOOLEAN DEFAULT false,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(organization_id, slug)
);

-- Project collaborators
CREATE TABLE project_collaborators (
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'viewer', -- owner, editor, reviewer, viewer
    added_by UUID REFERENCES users(id),
    added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (project_id, user_id)
);

-- Threat models
CREATE TABLE threat_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    version INTEGER NOT NULL DEFAULT 1,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    methodology VARCHAR(50) NOT NULL, -- STRIDE, PASTA, LINDDUN, VAST, DREAD
    status VARCHAR(50) DEFAULT 'draft', -- draft, in_review, approved, archived
    scope TEXT,
    assumptions TEXT[],
    is_current BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}',
    created_by UUID REFERENCES users(id),
    reviewed_by UUID REFERENCES users(id),
    approved_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    approved_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(project_id, version)
);

-- System components
CREATE TABLE components (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    threat_model_id UUID REFERENCES threat_models(id) ON DELETE CASCADE,
    component_id VARCHAR(255) NOT NULL, -- Internal ID for diagrams
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, -- process, datastore, external_entity, data_flow
    technology_stack TEXT[],
    trust_level VARCHAR(50),
    properties JSONB DEFAULT '{}',
    position_x FLOAT,
    position_y FLOAT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(threat_model_id, component_id)
);

-- Data flows
CREATE TABLE data_flows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    threat_model_id UUID REFERENCES threat_models(id) ON DELETE CASCADE,
    flow_id VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    source_component_id UUID REFERENCES components(id),
    destination_component_id UUID REFERENCES components(id),
    protocol VARCHAR(50),
    data_classification VARCHAR(50), -- public, internal, confidential, secret
    data_types TEXT[],
    encryption_in_transit BOOLEAN DEFAULT false,
    authentication_required BOOLEAN DEFAULT false,
    properties JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(threat_model_id, flow_id)
);

-- Trust boundaries
CREATE TABLE trust_boundaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    threat_model_id UUID REFERENCES threat_models(id) ON DELETE CASCADE,
    boundary_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50), -- network, physical, process, cloud
    description TEXT,
    components UUID[], -- Array of component IDs within boundary
    properties JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(threat_model_id, boundary_id)
);

-- Identified threats
CREATE TABLE threats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    threat_model_id UUID REFERENCES threat_models(id) ON DELETE CASCADE,
    threat_id VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(50), -- STRIDE categories or custom
    threat_source VARCHAR(255),
    affected_component_id UUID REFERENCES components(id),
    affected_flow_id UUID REFERENCES data_flows(id),
    likelihood VARCHAR(20), -- very_low, low, medium, high, very_high
    impact VARCHAR(20), -- very_low, low, medium, high, very_high
    risk_score DECIMAL(3,2),
    status VARCHAR(50) DEFAULT 'identified', -- identified, analyzing, mitigated, accepted, transferred
    metadata JSONB DEFAULT '{}',
    identified_by UUID REFERENCES users(id),
    identified_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Mitigations
CREATE TABLE mitigations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    threat_id UUID REFERENCES threats(id) ON DELETE CASCADE,
    mitigation_id VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(50), -- preventive, detective, corrective
    implementation_status VARCHAR(50) DEFAULT 'planned', -- planned, in_progress, implemented, verified
    implementation_cost VARCHAR(20), -- low, medium, high
    effectiveness DECIMAL(3,2), -- 0.0 to 1.0
    responsible_team_id UUID REFERENCES teams(id),
    due_date DATE,
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Threat model reviews
CREATE TABLE threat_model_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    threat_model_id UUID REFERENCES threat_models(id) ON DELETE CASCADE,
    reviewer_id UUID REFERENCES users(id),
    review_type VARCHAR(50), -- peer, security_team, management
    status VARCHAR(50), -- pending, in_progress, completed
    comments TEXT,
    findings JSONB DEFAULT '[]',
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- TMAC (Threat Model as Code) storage
CREATE TABLE tmac_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    version VARCHAR(50) NOT NULL,
    format VARCHAR(20) NOT NULL, -- yaml, json, hcl, dsl
    content TEXT NOT NULL,
    content_hash VARCHAR(64) NOT NULL,
    is_valid BOOLEAN DEFAULT true,
    validation_errors JSONB,
    compiled_model JSONB,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(project_id, name, version)
);

-- Diagrams
CREATE TABLE diagrams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    threat_model_id UUID REFERENCES threat_models(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, -- dfd, attack_tree, architecture, sequence
    content JSONB NOT NULL,
    thumbnail TEXT,
    version INTEGER DEFAULT 1,
    is_current BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_projects_org ON projects(organization_id);
CREATE INDEX idx_projects_slug ON projects(slug);
CREATE INDEX idx_threat_models_project ON threat_models(project_id);
CREATE INDEX idx_threat_models_status ON threat_models(status);
CREATE INDEX idx_threats_model ON threats(threat_model_id);
CREATE INDEX idx_threats_status ON threats(status);
CREATE INDEX idx_components_model ON components(threat_model_id);
CREATE INDEX idx_data_flows_model ON data_flows(threat_model_id);
```

### 3. Threat Libraries Schema

```sql
-- Threat library definitions
CREATE TABLE threat_libraries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    version VARCHAR(50) NOT NULL,
    type VARCHAR(50) NOT NULL, -- standard, custom, commercial
    source VARCHAR(100), -- OWASP, MITRE, CAPEC, custom
    methodology VARCHAR(50),
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    is_public BOOLEAN DEFAULT false,
    organization_id UUID REFERENCES organizations(id),
    metadata JSONB DEFAULT '{}',
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(name, version, organization_id)
);

-- Library threats
CREATE TABLE library_threats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    library_id UUID REFERENCES threat_libraries(id) ON DELETE CASCADE,
    threat_id VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    sub_category VARCHAR(100),
    severity VARCHAR(20),
    likelihood VARCHAR(20),
    cwe_ids TEXT[],
    capec_ids TEXT[],
    kill_chain_phases TEXT[],
    platforms TEXT[],
    prerequisites TEXT,
    examples TEXT,
    detection_methods TEXT,
    references JSONB DEFAULT '[]',
    metadata JSONB DEFAULT '{}',
    vector_embedding vector(768), -- For AI similarity
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(library_id, threat_id)
);

-- Library mitigations
CREATE TABLE library_mitigations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    library_id UUID REFERENCES threat_libraries(id) ON DELETE CASCADE,
    mitigation_id VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(50),
    nist_controls TEXT[],
    implementation_guide TEXT,
    effectiveness_score DECIMAL(3,2),
    cost_estimate VARCHAR(20),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(library_id, mitigation_id)
);

-- Threat to mitigation mapping
CREATE TABLE library_threat_mitigations (
    threat_id UUID REFERENCES library_threats(id) ON DELETE CASCADE,
    mitigation_id UUID REFERENCES library_mitigations(id) ON DELETE CASCADE,
    effectiveness DECIMAL(3,2),
    notes TEXT,
    PRIMARY KEY (threat_id, mitigation_id)
);

-- Attack patterns
CREATE TABLE attack_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    library_id UUID REFERENCES threat_libraries(id) ON DELETE CASCADE,
    pattern_id VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    severity VARCHAR(20),
    prerequisites TEXT[],
    attack_steps JSONB,
    typical_defenses TEXT[],
    indicators TEXT[],
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(library_id, pattern_id)
);

-- Indexes
CREATE INDEX idx_library_threats_vector ON library_threats 
    USING ivfflat (vector_embedding vector_cosine_ops);
CREATE INDEX idx_library_threats_category ON library_threats(category);
CREATE INDEX idx_library_threats_severity ON library_threats(severity);
```

### 4. Privacy and Compliance Schema

```sql
-- Privacy assessments (LINDDUN)
CREATE TABLE privacy_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    threat_model_id UUID REFERENCES threat_models(id) ON DELETE CASCADE,
    assessment_type VARCHAR(50), -- linddun_go, linddun_pro, linddun_maestro
    status VARCHAR(50) DEFAULT 'in_progress',
    data_subjects JSONB DEFAULT '[]',
    processing_activities JSONB DEFAULT '[]',
    privacy_threats JSONB DEFAULT '[]',
    privacy_controls JSONB DEFAULT '[]',
    risk_matrix JSONB DEFAULT '{}',
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Data inventory
CREATE TABLE data_inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    data_category VARCHAR(255) NOT NULL,
    data_type VARCHAR(100), -- personal, sensitive, confidential
    description TEXT,
    sources TEXT[],
    purposes TEXT[],
    retention_period INTERVAL,
    deletion_method VARCHAR(100),
    encryption_at_rest BOOLEAN DEFAULT false,
    encryption_in_transit BOOLEAN DEFAULT false,
    access_controls TEXT[],
    third_party_sharing BOOLEAN DEFAULT false,
    cross_border_transfer BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Compliance tracking
CREATE TABLE compliance_requirements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    framework VARCHAR(100) NOT NULL, -- GDPR, CCPA, HIPAA, etc.
    requirement_id VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    priority VARCHAR(20),
    verification_method TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(framework, requirement_id)
);

-- Project compliance status
CREATE TABLE project_compliance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    requirement_id UUID REFERENCES compliance_requirements(id),
    status VARCHAR(50) DEFAULT 'not_assessed', -- not_assessed, compliant, non_compliant, partial
    evidence TEXT,
    notes TEXT,
    assessed_by UUID REFERENCES users(id),
    assessed_at TIMESTAMP WITH TIME ZONE,
    next_review_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(project_id, requirement_id)
);

-- Privacy Impact Assessments (PIA)
CREATE TABLE privacy_impact_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    version INTEGER DEFAULT 1,
    status VARCHAR(50) DEFAULT 'draft',
    purpose_of_processing TEXT,
    legal_basis VARCHAR(100),
    legitimate_interests TEXT,
    data_subjects TEXT[],
    personal_data_categories TEXT[],
    recipients TEXT[],
    international_transfers JSONB DEFAULT '[]',
    retention_periods JSONB DEFAULT '[]',
    security_measures JSONB DEFAULT '[]',
    privacy_risks JSONB DEFAULT '[]',
    risk_mitigation JSONB DEFAULT '[]',
    dpo_opinion TEXT,
    created_by UUID REFERENCES users(id),
    approved_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    approved_at TIMESTAMP WITH TIME ZONE
);

-- Consent records
CREATE TABLE consent_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id),
    purpose VARCHAR(255) NOT NULL,
    legal_basis VARCHAR(100),
    data_categories TEXT[],
    retention_period INTERVAL,
    third_parties TEXT[],
    withdrawal_method TEXT,
    version INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### 5. Audit and Activity Schema

```sql
-- Audit logs (append-only)
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id UUID,
    resource_name VARCHAR(255),
    changes JSONB,
    ip_address INET,
    user_agent TEXT,
    session_id UUID,
    status VARCHAR(20), -- success, failure
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
) PARTITION BY RANGE (created_at);

-- Create monthly partitions for audit logs
CREATE TABLE audit_logs_2024_01 PARTITION OF audit_logs
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
-- ... create more partitions as needed

-- Security events
CREATE TABLE security_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(100) NOT NULL, -- login_failure, suspicious_activity, etc.
    severity VARCHAR(20) NOT NULL, -- info, warning, error, critical
    user_id UUID REFERENCES users(id),
    organization_id UUID REFERENCES organizations(id),
    description TEXT,
    source_ip INET,
    target_resource VARCHAR(255),
    event_data JSONB DEFAULT '{}',
    investigated BOOLEAN DEFAULT false,
    investigation_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Activity feed
CREATE TABLE activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id),
    project_id UUID REFERENCES projects(id),
    user_id UUID REFERENCES users(id),
    activity_type VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    metadata JSONB DEFAULT '{}',
    is_public BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Notifications
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT,
    data JSONB DEFAULT '{}',
    read_at TIMESTAMP WITH TIME ZONE,
    action_url TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_audit_logs_org ON audit_logs(organization_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);
CREATE INDEX idx_security_events_type ON security_events(event_type);
CREATE INDEX idx_security_events_severity ON security_events(severity);
CREATE INDEX idx_activities_org ON activities(organization_id);
CREATE INDEX idx_activities_project ON activities(project_id);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(user_id, read_at);
```

### 6. Reports and Analytics Schema

```sql
-- Generated reports
CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    threat_model_id UUID REFERENCES threat_models(id),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, -- threat_model, compliance, executive, technical
    format VARCHAR(20) NOT NULL, -- pdf, docx, html, json
    template_id UUID,
    file_path TEXT,
    file_size BIGINT,
    status VARCHAR(50) DEFAULT 'pending', -- pending, generating, completed, failed
    parameters JSONB DEFAULT '{}',
    error_message TEXT,
    generated_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Report templates
CREATE TABLE report_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    description TEXT,
    template_content TEXT,
    parameters_schema JSONB,
    is_default BOOLEAN DEFAULT false,
    organization_id UUID REFERENCES organizations(id),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Analytics metrics
CREATE TABLE analytics_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id),
    metric_type VARCHAR(100) NOT NULL,
    metric_name VARCHAR(255) NOT NULL,
    metric_value DECIMAL,
    dimensions JSONB DEFAULT '{}',
    period_start TIMESTAMP WITH TIME ZONE,
    period_end TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Dashboard configurations
CREATE TABLE dashboards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50), -- organization, project, personal
    owner_id UUID REFERENCES users(id),
    organization_id UUID REFERENCES organizations(id),
    project_id UUID REFERENCES projects(id),
    configuration JSONB NOT NULL,
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### 7. Integration and Workflow Schema

```sql
-- External integrations
CREATE TABLE integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- jira, github, gitlab, slack, webhook
    name VARCHAR(255) NOT NULL,
    configuration JSONB NOT NULL, -- encrypted sensitive data
    is_active BOOLEAN DEFAULT true,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    sync_status VARCHAR(50),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Integration mappings
CREATE TABLE integration_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    integration_id UUID REFERENCES integrations(id) ON DELETE CASCADE,
    external_id VARCHAR(255) NOT NULL,
    external_type VARCHAR(50) NOT NULL,
    internal_id UUID NOT NULL,
    internal_type VARCHAR(50) NOT NULL,
    sync_direction VARCHAR(20), -- inbound, outbound, bidirectional
    last_synced_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(integration_id, external_id, external_type)
);

-- Webhooks
CREATE TABLE webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    url TEXT NOT NULL,
    secret VARCHAR(255),
    events TEXT[] NOT NULL,
    is_active BOOLEAN DEFAULT true,
    failure_count INTEGER DEFAULT 0,
    last_triggered_at TIMESTAMP WITH TIME ZONE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Webhook deliveries
CREATE TABLE webhook_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    webhook_id UUID REFERENCES webhooks(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    response_status INTEGER,
    response_body TEXT,
    attempt_count INTEGER DEFAULT 1,
    delivered_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Scheduled jobs
CREATE TABLE scheduled_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id),
    job_type VARCHAR(100) NOT NULL,
    schedule VARCHAR(100) NOT NULL, -- cron expression
    parameters JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    last_run_at TIMESTAMP WITH TIME ZONE,
    next_run_at TIMESTAMP WITH TIME ZONE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

## Database Optimization

### Indexing Strategy
```sql
-- Full-text search indexes
CREATE INDEX idx_projects_search ON projects 
    USING gin(to_tsvector('english', name || ' ' || COALESCE(description, '')));
    
CREATE INDEX idx_threats_search ON threats 
    USING gin(to_tsvector('english', name || ' ' || COALESCE(description, '')));

-- JSON indexes
CREATE INDEX idx_components_properties ON components USING gin(properties);
CREATE INDEX idx_threats_metadata ON threats USING gin(metadata);

-- Partial indexes for common queries
CREATE INDEX idx_active_projects ON projects(organization_id) 
    WHERE is_archived = false;
    
CREATE INDEX idx_current_threat_models ON threat_models(project_id) 
    WHERE is_current = true;
    
CREATE INDEX idx_pending_mitigations ON mitigations(responsible_team_id) 
    WHERE implementation_status = 'planned';
```

### Materialized Views
```sql
-- Project risk summary
CREATE MATERIALIZED VIEW project_risk_summary AS
SELECT 
    p.id as project_id,
    p.name as project_name,
    COUNT(DISTINCT tm.id) as threat_model_count,
    COUNT(DISTINCT t.id) as total_threats,
    COUNT(DISTINCT t.id) FILTER (WHERE t.risk_score >= 0.7) as high_risk_threats,
    COUNT(DISTINCT m.id) FILTER (WHERE m.implementation_status = 'implemented') as implemented_mitigations,
    AVG(t.risk_score) as avg_risk_score
FROM projects p
LEFT JOIN threat_models tm ON p.id = tm.project_id AND tm.is_current = true
LEFT JOIN threats t ON tm.id = t.threat_model_id
LEFT JOIN mitigations m ON t.id = m.threat_id
GROUP BY p.id, p.name;

CREATE INDEX idx_project_risk_summary_project ON project_risk_summary(project_id);

-- Refresh strategy
CREATE OR REPLACE FUNCTION refresh_project_risk_summary()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY project_risk_summary;
END;
$$ LANGUAGE plpgsql;
```

### Partitioning Strategy
```sql
-- Partition audit logs by month
CREATE OR REPLACE FUNCTION create_monthly_audit_partition()
RETURNS void AS $$
DECLARE
    start_date date;
    end_date date;
    partition_name text;
BEGIN
    start_date := date_trunc('month', CURRENT_DATE);
    end_date := start_date + interval '1 month';
    partition_name := 'audit_logs_' || to_char(start_date, 'YYYY_MM');
    
    EXECUTE format('CREATE TABLE IF NOT EXISTS %I PARTITION OF audit_logs FOR VALUES FROM (%L) TO (%L)',
        partition_name, start_date, end_date);
END;
$$ LANGUAGE plpgsql;

-- Schedule monthly partition creation
SELECT cron.schedule('create-audit-partitions', '0 0 1 * *', 'SELECT create_monthly_audit_partition()');
```

## Data Migration Scripts

### Initial Schema Creation
```sql
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- Create schemas
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS projects;
CREATE SCHEMA IF NOT EXISTS threats;
CREATE SCHEMA IF NOT EXISTS compliance;
CREATE SCHEMA IF NOT EXISTS audit;
CREATE SCHEMA IF NOT EXISTS analytics;

-- Set search path
SET search_path TO public, auth, projects, threats, compliance, audit, analytics;
```

### Seed Data
```sql
-- Default roles
INSERT INTO roles (name, description, is_system, permissions) VALUES
('system_admin', 'System Administrator', true, '["*"]'),
('org_admin', 'Organization Administrator', true, '["org:*"]'),
('project_manager', 'Project Manager', true, '["project:*", "threat_model:*"]'),
('security_analyst', 'Security Analyst', true, '["threat_model:*", "threat:*", "report:read"]'),
('developer', 'Developer', true, '["project:read", "threat_model:read", "threat:read"]'),
('viewer', 'Viewer', true, '["*:read"]');

-- Default threat libraries
INSERT INTO threat_libraries (name, version, type, source, description) VALUES
('OWASP Top 10', '2021', 'standard', 'OWASP', 'OWASP Top 10 Web Application Security Risks'),
('MITRE ATT&CK', '13.1', 'standard', 'MITRE', 'Adversarial Tactics, Techniques, and Common Knowledge'),
('CAPEC', '3.9', 'standard', 'MITRE', 'Common Attack Pattern Enumeration and Classification'),
('CWE', '4.13', 'standard', 'MITRE', 'Common Weakness Enumeration');

-- Default report templates
INSERT INTO report_templates (name, type, description, is_default) VALUES
('Executive Summary', 'executive', 'High-level threat modeling report for executives', true),
('Technical Report', 'technical', 'Detailed technical threat modeling report', true),
('Compliance Report', 'compliance', 'Compliance-focused threat modeling report', true),
('STRIDE Analysis', 'threat_model', 'STRIDE methodology threat analysis report', true);

-- Default compliance frameworks
INSERT INTO compliance_requirements (framework, requirement_id, title, category) VALUES
('GDPR', 'Art25', 'Data protection by design and by default', 'Privacy'),
('GDPR', 'Art32', 'Security of processing', 'Security'),
('PCI-DSS', '6.3', 'Develop internal and external software applications securely', 'Security'),
('HIPAA', '164.308', 'Administrative safeguards', 'Security'),
('SOC2', 'CC6.1', 'Logical and Physical Access Controls', 'Security');
```

## Backup and Recovery

### Backup Strategy
```sql
-- Create backup function
CREATE OR REPLACE FUNCTION backup_threat_models(org_id UUID)
RETURNS JSON AS $$
DECLARE
    backup_data JSON;
BEGIN
    SELECT json_build_object(
        'organization_id', org_id,
        'backup_date', CURRENT_TIMESTAMP,
        'projects', (
            SELECT json_agg(p.*) 
            FROM projects p 
            WHERE p.organization_id = org_id
        ),
        'threat_models', (
            SELECT json_agg(tm.*) 
            FROM threat_models tm
            JOIN projects p ON tm.project_id = p.id
            WHERE p.organization_id = org_id
        ),
        'threats', (
            SELECT json_agg(t.*) 
            FROM threats t
            JOIN threat_models tm ON t.threat_model_id = tm.id
            JOIN projects p ON tm.project_id = p.id
            WHERE p.organization_id = org_id
        )
    ) INTO backup_data;
    
    RETURN backup_data;
END;
$$ LANGUAGE plpgsql;
```

### Point-in-Time Recovery
```bash
# PostgreSQL configuration for PITR
archive_mode = on
archive_command = 'test ! -f /backup/archive/%f && cp %p /backup/archive/%f'
wal_level = replica
max_wal_senders = 3
```

## Performance Considerations

1. **Connection Pooling**: Use PgBouncer with transaction pooling
2. **Read Replicas**: Implement read replicas for analytics queries
3. **Caching**: Use Redis for frequently accessed data
4. **Batch Operations**: Implement batch insert/update for bulk operations
5. **Query Optimization**: Regular EXPLAIN ANALYZE on slow queries
6. **Vacuum Strategy**: Aggressive autovacuum for high-write tables

## Security Considerations

1. **Encryption**: Enable Transparent Data Encryption (TDE)
2. **Row-Level Security**: Implement RLS for multi-tenancy
3. **Audit Logging**: All data modifications logged
4. **Backup Encryption**: Encrypt all backups at rest
5. **Network Security**: SSL/TLS for all connections
6. **Access Control**: Principle of least privilege

## Monitoring

```sql
-- Table size monitoring
CREATE VIEW table_sizes AS
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
    pg_total_relation_size(schemaname||'.'||tablename) AS size_bytes
FROM pg_tables
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY size_bytes DESC;

-- Slow query monitoring
CREATE VIEW slow_queries AS
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    max_time,
    rows
FROM pg_stat_statements
WHERE mean_time > 100 -- queries taking more than 100ms
ORDER BY mean_time DESC
LIMIT 20;
```