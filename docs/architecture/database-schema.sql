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

-- =============================================
-- NOTIFICATION SERVICE SCHEMA
-- =============================================

-- Create notification types and statuses
CREATE TYPE notification_type AS ENUM (
    'email',
    'slack',
    'teams',
    'sms',
    'webhook',
    'push'
);

CREATE TYPE notification_status AS ENUM (
    'pending',
    'sent',
    'failed',
    'cancelled',
    'scheduled'
);

CREATE TYPE notification_priority AS ENUM (
    'low',
    'medium',
    'high',
    'urgent'
);

CREATE TYPE template_type AS ENUM (
    'threat_model_created',
    'threat_model_updated',
    'threat_model_deleted',
    'threat_identified',
    'threat_mitigated',
    'collaboration_invited',
    'collaboration_mentioned',
    'report_generated',
    'system_maintenance',
    'custom'
);

CREATE TYPE subscription_frequency AS ENUM (
    'immediate',
    'daily',
    'weekly',
    'monthly',
    'never'
);

-- Notifications table - stores all notifications
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type notification_type NOT NULL,
    channel VARCHAR(255) NOT NULL, -- specific channel (email address, slack channel, etc.)
    subject VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    html_message TEXT,
    metadata JSONB DEFAULT '{}',
    status notification_status DEFAULT 'pending',
    priority notification_priority DEFAULT 'medium',
    scheduled_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    error_message TEXT,
    template_id UUID REFERENCES notification_templates(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notification templates table
CREATE TABLE IF NOT EXISTS notification_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    type template_type NOT NULL,
    subject VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    html_body TEXT,
    variables JSONB DEFAULT '{}', -- Available template variables
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notification preferences table - user preferences for different channels
CREATE TABLE IF NOT EXISTS notification_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    channel notification_type NOT NULL,
    enabled BOOLEAN DEFAULT true,
    frequency subscription_frequency DEFAULT 'immediate',
    quiet_hours_start TIME,
    quiet_hours_end TIME,
    timezone VARCHAR(50) DEFAULT 'UTC',
    settings JSONB DEFAULT '{}', -- Channel-specific settings
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id, channel)
);

-- Notification subscriptions table - what events users are subscribed to
CREATE TABLE IF NOT EXISTS notification_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL, -- e.g., 'threat_model_created', 'threat_identified'
    channel notification_type NOT NULL,
    enabled BOOLEAN DEFAULT true,
    filter_criteria JSONB DEFAULT '{}', -- Conditions for when to send notifications
    settings JSONB DEFAULT '{}', -- Event-specific settings
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id, event_type, channel)
);

-- Notification logs table - audit trail of all notification activities
CREATE TABLE IF NOT EXISTS notification_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
    status notification_status NOT NULL,
    error_message TEXT,
    response_data JSONB DEFAULT '{}',
    attempt_number INTEGER DEFAULT 1,
    processing_time_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notification channels table - configuration for different channels
CREATE TABLE IF NOT EXISTS notification_channels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    type notification_type NOT NULL,
    configuration JSONB NOT NULL, -- Channel-specific configuration (encrypted)
    is_active BOOLEAN DEFAULT true,
    is_default BOOLEAN DEFAULT false,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(organization_id, name)
);

-- Notification queue table - for managing notification queues
CREATE TABLE IF NOT EXISTS notification_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
    queue_name VARCHAR(100) NOT NULL,
    priority INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    current_attempt INTEGER DEFAULT 0,
    next_retry_at TIMESTAMPTZ,
    processing_started_at TIMESTAMPTZ,
    processing_completed_at TIMESTAMPTZ,
    lock_token VARCHAR(255),
    lock_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for notification tables
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_scheduled_at ON notifications(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);

CREATE INDEX IF NOT EXISTS idx_templates_name ON notification_templates(name);
CREATE INDEX IF NOT EXISTS idx_templates_type ON notification_templates(type);
CREATE INDEX IF NOT EXISTS idx_templates_active ON notification_templates(is_active);

CREATE INDEX IF NOT EXISTS idx_preferences_user_id ON notification_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_preferences_channel ON notification_preferences(channel);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON notification_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_event_type ON notification_subscriptions(event_type);
CREATE INDEX IF NOT EXISTS idx_subscriptions_channel ON notification_subscriptions(channel);

CREATE INDEX IF NOT EXISTS idx_logs_notification_id ON notification_logs(notification_id);
CREATE INDEX IF NOT EXISTS idx_logs_status ON notification_logs(status);
CREATE INDEX IF NOT EXISTS idx_logs_created_at ON notification_logs(created_at);

CREATE INDEX IF NOT EXISTS idx_channels_organization_id ON notification_channels(organization_id);
CREATE INDEX IF NOT EXISTS idx_channels_type ON notification_channels(type);
CREATE INDEX IF NOT EXISTS idx_channels_active ON notification_channels(is_active);

CREATE INDEX IF NOT EXISTS idx_queue_notification_id ON notification_queue(notification_id);
CREATE INDEX IF NOT EXISTS idx_queue_name ON notification_queue(queue_name);
CREATE INDEX IF NOT EXISTS idx_queue_priority ON notification_queue(priority);
CREATE INDEX IF NOT EXISTS idx_queue_next_retry ON notification_queue(next_retry_at);
CREATE INDEX IF NOT EXISTS idx_queue_lock_expires ON notification_queue(lock_expires_at);

-- Create triggers for notification tables
CREATE TRIGGER update_notifications_updated_at 
    BEFORE UPDATE ON notifications 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_notification_templates_updated_at 
    BEFORE UPDATE ON notification_templates 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_notification_preferences_updated_at 
    BEFORE UPDATE ON notification_preferences 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_notification_subscriptions_updated_at 
    BEFORE UPDATE ON notification_subscriptions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_notification_channels_updated_at 
    BEFORE UPDATE ON notification_channels 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Insert default notification templates
INSERT INTO notification_templates (name, type, subject, body, variables) VALUES
('threat_model_created', 'threat_model_created', 'New Threat Model Created: {{title}}', 
 'A new threat model "{{title}}" has been created by {{creator_name}} in project {{project_name}}.', 
 '{"title": "string", "creator_name": "string", "project_name": "string", "url": "string"}'),

('threat_model_updated', 'threat_model_updated', 'Threat Model Updated: {{title}}', 
 'The threat model "{{title}}" has been updated by {{updater_name}} in project {{project_name}}.', 
 '{"title": "string", "updater_name": "string", "project_name": "string", "url": "string"}'),

('threat_identified', 'threat_identified', 'New Threat Identified: {{threat_title}}', 
 'A new {{risk_level}} risk threat "{{threat_title}}" has been identified in threat model {{model_title}}.', 
 '{"threat_title": "string", "model_title": "string", "risk_level": "string", "url": "string"}'),

('threat_mitigated', 'threat_mitigated', 'Threat Mitigated: {{threat_title}}', 
 'The threat "{{threat_title}}" has been successfully mitigated by {{mitigator_name}}.', 
 '{"threat_title": "string", "mitigator_name": "string", "url": "string"}'),

('collaboration_invited', 'collaboration_invited', 'Collaboration Invitation: {{project_name}}', 
 'You have been invited to collaborate on the threat model "{{model_title}}" in project {{project_name}} by {{inviter_name}}.', 
 '{"project_name": "string", "model_title": "string", "inviter_name": "string", "url": "string"}'),

('report_generated', 'report_generated', 'Report Generated: {{report_title}}', 
 'The report "{{report_title}}" has been generated and is ready for download.', 
 '{"report_title": "string", "download_url": "string"}'),

('system_maintenance', 'system_maintenance', 'System Maintenance: {{title}}', 
 'System maintenance is scheduled: {{description}}. Expected downtime: {{duration}}.', 
 '{"title": "string", "description": "string", "duration": "string", "start_time": "string"}')

ON CONFLICT (name) DO NOTHING;