-- Migration: 004_privacy_compliance_schema.sql
-- Description: Privacy (LINDDUN) and compliance schema
-- Date: 2025-01-09

-- Privacy assessments
CREATE TABLE privacy_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    threat_model_id UUID REFERENCES threat_models(id) ON DELETE CASCADE,
    assessment_type VARCHAR(50),
    status VARCHAR(50) DEFAULT 'in_progress',
    data_subjects JSONB DEFAULT '[]',
    processing_activities JSONB DEFAULT '[]',
    privacy_threats JSONB DEFAULT '[]',
    privacy_controls JSONB DEFAULT '[]',
    risk_matrix JSONB DEFAULT '{}',
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Data inventory
CREATE TABLE data_inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    data_category VARCHAR(255) NOT NULL,
    data_type VARCHAR(100),
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

-- Compliance requirements
CREATE TABLE compliance_requirements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    framework VARCHAR(100) NOT NULL,
    requirement_id VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    priority VARCHAR(20),
    verification_method TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(framework, requirement_id)
);

-- Project compliance status
CREATE TABLE project_compliance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    requirement_id UUID REFERENCES compliance_requirements(id),
    status VARCHAR(50) DEFAULT 'not_assessed',
    evidence TEXT,
    notes TEXT,
    assessed_by UUID REFERENCES users(id),
    assessed_at TIMESTAMP WITH TIME ZONE,
    next_review_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(project_id, requirement_id)
);

-- Privacy Impact Assessments
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
    approved_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Privacy patterns
CREATE TABLE privacy_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    description TEXT,
    context TEXT,
    implementation JSONB,
    privacy_properties JSONB,
    linddun_categories TEXT[],
    examples JSONB,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Privacy controls catalog
CREATE TABLE privacy_controls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    control_id VARCHAR(100) UNIQUE,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    description TEXT,
    implementation_guide TEXT,
    effectiveness JSONB,
    cost VARCHAR(20),
    complexity VARCHAR(20),
    pet_technologies TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_privacy_assessments_model ON privacy_assessments(threat_model_id);
CREATE INDEX idx_privacy_assessments_status ON privacy_assessments(status);
CREATE INDEX idx_data_inventory_project ON data_inventory(project_id);
CREATE INDEX idx_data_inventory_type ON data_inventory(data_type);
CREATE INDEX idx_project_compliance_project ON project_compliance(project_id);
CREATE INDEX idx_project_compliance_status ON project_compliance(status);
CREATE INDEX idx_pia_project ON privacy_impact_assessments(project_id);
CREATE INDEX idx_pia_status ON privacy_impact_assessments(status);

-- Add triggers
CREATE TRIGGER update_privacy_assessments_updated_at BEFORE UPDATE ON privacy_assessments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_data_inventory_updated_at BEFORE UPDATE ON data_inventory
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_compliance_requirements_updated_at BEFORE UPDATE ON compliance_requirements
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_project_compliance_updated_at BEFORE UPDATE ON project_compliance
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pia_updated_at BEFORE UPDATE ON privacy_impact_assessments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_consent_records_updated_at BEFORE UPDATE ON consent_records
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_privacy_patterns_updated_at BEFORE UPDATE ON privacy_patterns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_privacy_controls_updated_at BEFORE UPDATE ON privacy_controls
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();