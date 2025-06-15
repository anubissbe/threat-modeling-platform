-- Threat Modeling Application Database Schema
-- Supports multiple methodologies: STRIDE, PASTA, LINDDUN, VAST, DREAD

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For text search
CREATE EXTENSION IF NOT EXISTS "btree_gin"; -- For compound indexes

-- Create custom types
CREATE TYPE user_role AS ENUM ('admin', 'architect', 'developer', 'reviewer', 'viewer');
CREATE TYPE project_status AS ENUM ('draft', 'active', 'review', 'approved', 'archived');
CREATE TYPE threat_status AS ENUM ('identified', 'analyzing', 'mitigated', 'accepted', 'transferred');
CREATE TYPE risk_level AS ENUM ('critical', 'high', 'medium', 'low', 'info');
CREATE TYPE methodology_type AS ENUM ('STRIDE', 'PASTA', 'LINDDUN', 'VAST', 'DREAD', 'OCTAVE', 'TRIKE', 'CUSTOM');
CREATE TYPE element_type AS ENUM ('process', 'data_store', 'external_entity', 'data_flow', 'trust_boundary');

-- Organizations table
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    role user_role DEFAULT 'developer',
    avatar_url TEXT,
    settings JSONB DEFAULT '{}',
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Teams table
CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Team members junction table
CREATE TABLE team_members (
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'member',
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (team_id, user_id)
);

-- Projects table
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status project_status DEFAULT 'draft',
    metadata JSONB DEFAULT '{}',
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Threat models table
CREATE TABLE threat_models (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    version INTEGER DEFAULT 1,
    methodology methodology_type NOT NULL,
    scope TEXT,
    assumptions TEXT[],
    dependencies JSONB DEFAULT '[]',
    metadata JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Diagrams table (DFDs)
CREATE TABLE diagrams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    threat_model_id UUID REFERENCES threat_models(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) DEFAULT 'dfd',
    level INTEGER DEFAULT 0, -- 0 for context, 1+ for detailed levels
    data JSONB NOT NULL, -- Stores the diagram JSON data
    thumbnail_url TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Diagram elements table
CREATE TABLE diagram_elements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    diagram_id UUID REFERENCES diagrams(id) ON DELETE CASCADE,
    element_id VARCHAR(255) NOT NULL, -- ID within the diagram
    type element_type NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    properties JSONB DEFAULT '{}',
    trust_boundary_id UUID, -- Self-reference for elements within boundaries
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(diagram_id, element_id)
);

-- Assets table
CREATE TABLE assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    threat_model_id UUID REFERENCES threat_models(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100),
    description TEXT,
    value_rating INTEGER CHECK (value_rating BETWEEN 1 AND 10),
    classification VARCHAR(50), -- public, internal, confidential, secret
    properties JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Methodology-specific tables for extensibility
-- STRIDE categories
CREATE TABLE stride_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    examples TEXT[]
);

-- Insert default STRIDE categories
INSERT INTO stride_categories (name, description) VALUES
('Spoofing', 'Pretending to be something or someone you are not'),
('Tampering', 'Modifying data or code'),
('Repudiation', 'Claiming you did not do something'),
('Information Disclosure', 'Exposing information to unauthorized people'),
('Denial of Service', 'Denying or degrading service to users'),
('Elevation of Privilege', 'Gaining capabilities without authorization');

-- Threats table (generic, works with all methodologies)
CREATE TABLE threats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    threat_model_id UUID REFERENCES threat_models(id) ON DELETE CASCADE,
    diagram_element_id UUID REFERENCES diagram_elements(id) ON DELETE SET NULL,
    asset_id UUID REFERENCES assets(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100), -- STRIDE category or other methodology-specific
    status threat_status DEFAULT 'identified',
    likelihood INTEGER CHECK (likelihood BETWEEN 1 AND 5),
    impact INTEGER CHECK (impact BETWEEN 1 AND 5),
    risk_level risk_level,
    risk_score DECIMAL(4,2), -- Calculated based on methodology
    methodology_data JSONB DEFAULT '{}', -- Methodology-specific data
    identified_by UUID REFERENCES users(id),
    identified_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Mitigations table
CREATE TABLE mitigations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    threat_id UUID REFERENCES threats(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(50), -- preventive, detective, corrective
    status VARCHAR(50) DEFAULT 'proposed', -- proposed, approved, implemented, tested
    effort_estimate INTEGER, -- in hours
    cost_estimate DECIMAL(10,2),
    effectiveness INTEGER CHECK (effectiveness BETWEEN 1 AND 5),
    implementation_notes TEXT,
    assigned_to UUID REFERENCES users(id),
    due_date DATE,
    completed_at TIMESTAMPTZ,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Attack patterns table (for AI/ML training)
CREATE TABLE attack_patterns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    mitre_att_ck_id VARCHAR(50),
    capec_id VARCHAR(50),
    severity risk_level,
    prerequisites TEXT[],
    example_instances JSONB DEFAULT '[]',
    related_weaknesses TEXT[],
    detection_methods TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Threat templates table (for reusability)
CREATE TABLE threat_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    methodology methodology_type,
    applies_to element_type[],
    template_data JSONB NOT NULL,
    is_public BOOLEAN DEFAULT false,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reports table
CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    threat_model_id UUID REFERENCES threat_models(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50), -- executive, technical, compliance
    format VARCHAR(20), -- pdf, html, json
    template_id VARCHAR(100),
    content JSONB,
    file_url TEXT,
    generated_by UUID REFERENCES users(id),
    generated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Comments table (for collaboration)
CREATE TABLE comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type VARCHAR(50) NOT NULL, -- threat, mitigation, diagram_element
    entity_id UUID NOT NULL,
    parent_comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_resolved BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activity log table
CREATE TABLE activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Integration configurations
CREATE TABLE integrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- jira, azure_devops, github, gitlab
    name VARCHAR(255) NOT NULL,
    config JSONB NOT NULL, -- Encrypted configuration
    is_active BOOLEAN DEFAULT true,
    last_sync TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI/ML training data
CREATE TABLE ml_training_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    threat_model_id UUID REFERENCES threat_models(id) ON DELETE CASCADE,
    input_data JSONB NOT NULL,
    output_data JSONB NOT NULL,
    model_version VARCHAR(50),
    accuracy_score DECIMAL(5,4),
    is_validated BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Compliance mappings
CREATE TABLE compliance_mappings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    threat_id UUID REFERENCES threats(id) ON DELETE CASCADE,
    framework VARCHAR(50) NOT NULL, -- ISO27001, NIST, GDPR, etc.
    control_id VARCHAR(50) NOT NULL,
    control_name VARCHAR(255),
    mapping_rationale TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_users_org ON users(organization_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_projects_org ON projects(organization_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_threat_models_project ON threat_models(project_id);
CREATE INDEX idx_threat_models_methodology ON threat_models(methodology);
CREATE INDEX idx_threats_model ON threats(threat_model_id);
CREATE INDEX idx_threats_status ON threats(status);
CREATE INDEX idx_threats_risk ON threats(risk_level);
CREATE INDEX idx_mitigations_threat ON mitigations(threat_id);
CREATE INDEX idx_mitigations_status ON mitigations(status);
CREATE INDEX idx_comments_entity ON comments(entity_type, entity_id);
CREATE INDEX idx_activity_logs_org ON activity_logs(organization_id);
CREATE INDEX idx_activity_logs_created ON activity_logs(created_at);

-- Full text search indexes
CREATE INDEX idx_threats_search ON threats USING gin(to_tsvector('english', title || ' ' || COALESCE(description, '')));
CREATE INDEX idx_assets_search ON assets USING gin(to_tsvector('english', name || ' ' || COALESCE(description, '')));
CREATE INDEX idx_projects_search ON projects USING gin(to_tsvector('english', name || ' ' || COALESCE(description, '')));

-- Create update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply update trigger to relevant tables
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON teams FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_threat_models_updated_at BEFORE UPDATE ON threat_models FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_diagrams_updated_at BEFORE UPDATE ON diagrams FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_threats_updated_at BEFORE UPDATE ON threats FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_mitigations_updated_at BEFORE UPDATE ON mitigations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_comments_updated_at BEFORE UPDATE ON comments FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Row Level Security policies (example for multi-tenancy)
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE threat_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE threats ENABLE ROW LEVEL SECURITY;

-- Create a function to check user access
CREATE OR REPLACE FUNCTION user_has_access(user_uuid UUID, org_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM users 
        WHERE id = user_uuid AND organization_id = org_uuid
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;