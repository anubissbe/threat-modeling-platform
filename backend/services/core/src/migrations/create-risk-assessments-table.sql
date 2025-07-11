-- Create risk assessments table
CREATE TABLE IF NOT EXISTS risk_assessments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    overall_risk VARCHAR(20) NOT NULL CHECK (overall_risk IN ('Critical', 'High', 'Medium', 'Low')),
    score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
    assessment_type VARCHAR(20) NOT NULL DEFAULT 'automated' CHECK (assessment_type IN ('automated', 'manual')),
    created_by UUID NOT NULL REFERENCES users(id),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create recommendations table
CREATE TABLE IF NOT EXISTS risk_recommendations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assessment_id UUID NOT NULL REFERENCES risk_assessments(id) ON DELETE CASCADE,
    recommendation TEXT NOT NULL,
    priority VARCHAR(20) NOT NULL CHECK (priority IN ('Critical', 'High', 'Medium', 'Low')),
    category VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create assessment vulnerabilities junction table
CREATE TABLE IF NOT EXISTS assessment_vulnerabilities (
    assessment_id UUID NOT NULL REFERENCES risk_assessments(id) ON DELETE CASCADE,
    vulnerability_id UUID NOT NULL REFERENCES vulnerabilities(id) ON DELETE CASCADE,
    risk_contribution INTEGER NOT NULL DEFAULT 0 CHECK (risk_contribution >= 0 AND risk_contribution <= 100),
    PRIMARY KEY (assessment_id, vulnerability_id)
);

-- Create assessment threats junction table  
CREATE TABLE IF NOT EXISTS assessment_threats (
    assessment_id UUID NOT NULL REFERENCES risk_assessments(id) ON DELETE CASCADE,
    threat_id UUID NOT NULL REFERENCES threats(id) ON DELETE CASCADE,
    likelihood VARCHAR(20) NOT NULL CHECK (likelihood IN ('Very High', 'High', 'Medium', 'Low', 'Very Low')),
    impact VARCHAR(20) NOT NULL CHECK (impact IN ('Very High', 'High', 'Medium', 'Low', 'Very Low')),
    risk_level VARCHAR(20) NOT NULL CHECK (risk_level IN ('Critical', 'High', 'Medium', 'Low')),
    PRIMARY KEY (assessment_id, threat_id)
);

-- Create indexes
CREATE INDEX idx_risk_assessments_project ON risk_assessments(project_id);
CREATE INDEX idx_risk_assessments_org ON risk_assessments(organization_id);
CREATE INDEX idx_risk_assessments_status ON risk_assessments(status);
CREATE INDEX idx_risk_recommendations_assessment ON risk_recommendations(assessment_id);
CREATE INDEX idx_assessment_vulnerabilities_assessment ON assessment_vulnerabilities(assessment_id);
CREATE INDEX idx_assessment_threats_assessment ON assessment_threats(assessment_id);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_risk_assessments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER risk_assessments_updated_at_trigger
BEFORE UPDATE ON risk_assessments
FOR EACH ROW
EXECUTE FUNCTION update_risk_assessments_updated_at();