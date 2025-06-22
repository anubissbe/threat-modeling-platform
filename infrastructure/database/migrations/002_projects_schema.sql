-- Migration: 002_projects_schema.sql
-- Description: Projects and threat models schema
-- Date: 2025-01-09

-- Projects
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    slug VARCHAR(255) NOT NULL,
    project_type VARCHAR(50),
    tags TEXT[],
    risk_profile project_risk DEFAULT 'medium',
    compliance_frameworks TEXT[],
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
    role VARCHAR(50) DEFAULT 'viewer',
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
    methodology VARCHAR(50) NOT NULL,
    status VARCHAR(50) DEFAULT 'draft',
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
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(project_id, version)
);

-- System components
CREATE TABLE components (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    threat_model_id UUID REFERENCES threat_models(id) ON DELETE CASCADE,
    component_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
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
    data_classification VARCHAR(50),
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
    type VARCHAR(50),
    description TEXT,
    components UUID[],
    properties JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(threat_model_id, boundary_id)
);

-- Threats
CREATE TABLE threats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    threat_model_id UUID REFERENCES threat_models(id) ON DELETE CASCADE,
    threat_id VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(50),
    threat_source VARCHAR(255),
    affected_component_id UUID REFERENCES components(id),
    affected_flow_id UUID REFERENCES data_flows(id),
    likelihood likelihood DEFAULT 'medium',
    impact impact DEFAULT 'medium',
    risk_score DECIMAL(3,2),
    status threat_status DEFAULT 'identified',
    metadata JSONB DEFAULT '{}',
    identified_by UUID REFERENCES users(id),
    identified_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(threat_model_id, threat_id)
);

-- Mitigations
CREATE TABLE mitigations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    threat_id UUID REFERENCES threats(id) ON DELETE CASCADE,
    mitigation_id VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(50),
    implementation_status VARCHAR(50) DEFAULT 'planned',
    implementation_cost VARCHAR(20),
    effectiveness DECIMAL(3,2),
    responsible_team_id UUID REFERENCES teams(id),
    due_date DATE,
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(threat_id, mitigation_id)
);

-- TMAC models
CREATE TABLE tmac_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    version VARCHAR(50) NOT NULL,
    format VARCHAR(20) NOT NULL,
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
    type VARCHAR(50) NOT NULL,
    content JSONB NOT NULL,
    thumbnail TEXT,
    version INTEGER DEFAULT 1,
    is_current BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_projects_org ON projects(organization_id);
CREATE INDEX idx_projects_slug ON projects(slug);
CREATE INDEX idx_projects_archived ON projects(is_archived);
CREATE INDEX idx_threat_models_project ON threat_models(project_id);
CREATE INDEX idx_threat_models_current ON threat_models(is_current);
CREATE INDEX idx_threats_model ON threats(threat_model_id);
CREATE INDEX idx_threats_status ON threats(status);
CREATE INDEX idx_components_model ON components(threat_model_id);
CREATE INDEX idx_data_flows_model ON data_flows(threat_model_id);
CREATE INDEX idx_mitigations_threat ON mitigations(threat_id);
CREATE INDEX idx_mitigations_status ON mitigations(implementation_status);

-- Add triggers
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_threat_models_updated_at BEFORE UPDATE ON threat_models
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_threats_updated_at BEFORE UPDATE ON threats
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_mitigations_updated_at BEFORE UPDATE ON mitigations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tmac_models_updated_at BEFORE UPDATE ON tmac_models
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_diagrams_updated_at BEFORE UPDATE ON diagrams
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();