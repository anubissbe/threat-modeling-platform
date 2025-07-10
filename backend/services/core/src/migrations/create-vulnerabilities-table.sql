-- Create vulnerabilities table
CREATE TABLE IF NOT EXISTS vulnerabilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('Critical', 'High', 'Medium', 'Low')),
    status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'false_positive', 'wont_fix')),
    priority VARCHAR(10) NOT NULL CHECK (priority IN ('P1', 'P2', 'P3', 'P4')),
    
    -- CVE/CWE Information
    cve VARCHAR(50),
    cwe VARCHAR(50),
    cvss_score DECIMAL(3,1) CHECK (cvss_score >= 0 AND cvss_score <= 10),
    
    -- Component Information
    component VARCHAR(255) NOT NULL,
    version VARCHAR(50),
    
    -- Impact and Risk
    impact TEXT NOT NULL,
    exploitability VARCHAR(20) DEFAULT 'Not Defined' CHECK (exploitability IN ('Functional', 'Proof of Concept', 'Unproven', 'Not Defined')),
    remediation_complexity VARCHAR(10) DEFAULT 'Medium' CHECK (remediation_complexity IN ('Low', 'Medium', 'High')),
    business_impact VARCHAR(20) DEFAULT 'Medium' CHECK (business_impact IN ('Critical', 'High', 'Medium', 'Low')),
    
    -- Remediation
    remediation TEXT NOT NULL,
    references JSONB DEFAULT '[]'::jsonb,
    
    -- Assignment and Tracking
    assigned_to VARCHAR(255),
    discovered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    last_seen TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE,
    
    -- Project Association
    project_id UUID NOT NULL,
    threat_model_id UUID,
    affected_assets JSONB DEFAULT '[]'::jsonb,
    
    -- Classification
    tags JSONB DEFAULT '[]'::jsonb,
    notes TEXT DEFAULT '',
    
    -- Metadata
    created_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    organization_id UUID NOT NULL,
    
    -- Foreign key constraints (assuming these tables exist)
    CONSTRAINT fk_vulnerabilities_project_id FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    CONSTRAINT fk_vulnerabilities_threat_model_id FOREIGN KEY (threat_model_id) REFERENCES threat_models(id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_vulnerabilities_organization_id ON vulnerabilities(organization_id);
CREATE INDEX IF NOT EXISTS idx_vulnerabilities_project_id ON vulnerabilities(project_id);
CREATE INDEX IF NOT EXISTS idx_vulnerabilities_severity ON vulnerabilities(severity);
CREATE INDEX IF NOT EXISTS idx_vulnerabilities_status ON vulnerabilities(status);
CREATE INDEX IF NOT EXISTS idx_vulnerabilities_priority ON vulnerabilities(priority);
CREATE INDEX IF NOT EXISTS idx_vulnerabilities_assigned_to ON vulnerabilities(assigned_to);
CREATE INDEX IF NOT EXISTS idx_vulnerabilities_created_at ON vulnerabilities(created_at);
CREATE INDEX IF NOT EXISTS idx_vulnerabilities_discovered_at ON vulnerabilities(discovered_at);

-- Create partial indexes for performance
CREATE INDEX IF NOT EXISTS idx_vulnerabilities_open_critical ON vulnerabilities(project_id, created_at) 
WHERE status = 'open' AND severity = 'Critical';

CREATE INDEX IF NOT EXISTS idx_vulnerabilities_unresolved ON vulnerabilities(organization_id, severity, created_at) 
WHERE status IN ('open', 'in_progress');

-- Create index for full-text search
CREATE INDEX IF NOT EXISTS idx_vulnerabilities_search ON vulnerabilities 
USING gin(to_tsvector('english', title || ' ' || description || ' ' || component));

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_vulnerabilities_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_vulnerabilities_updated_at
    BEFORE UPDATE ON vulnerabilities
    FOR EACH ROW
    EXECUTE FUNCTION update_vulnerabilities_updated_at();

-- Insert sample data for testing
INSERT INTO vulnerabilities (
    title, description, severity, priority, component, impact, remediation,
    project_id, created_by, organization_id
) VALUES 
(
    'SQL Injection in User Authentication',
    'Unsanitized user input in the login endpoint allows SQL injection attacks, potentially leading to unauthorized access and data breach.',
    'Critical',
    'P1',
    'auth-service',
    'Complete database compromise, unauthorized access to all user accounts, potential data theft',
    'Implement parameterized queries, input validation, and prepared statements. Update to latest framework version.',
    (SELECT id FROM projects LIMIT 1),
    (SELECT id FROM users LIMIT 1),
    (SELECT organization FROM users LIMIT 1)
) ON CONFLICT DO NOTHING;

INSERT INTO vulnerabilities (
    title, description, severity, priority, component, impact, remediation,
    project_id, created_by, organization_id, status, cve, cwe
) VALUES 
(
    'Cross-Site Scripting (XSS) in Product Reviews',
    'Stored XSS vulnerability in product review comments allows attackers to inject malicious scripts.',
    'High',
    'P2',
    'review-service',
    'Session hijacking, credential theft, malicious redirects, defacement',
    'Implement proper input sanitization, output encoding, and Content Security Policy (CSP) headers.',
    (SELECT id FROM projects LIMIT 1),
    (SELECT id FROM users LIMIT 1),
    (SELECT organization FROM users LIMIT 1),
    'in_progress',
    'CVE-2023-5678',
    'CWE-79'
) ON CONFLICT DO NOTHING;

INSERT INTO vulnerabilities (
    title, description, severity, priority, component, impact, remediation,
    project_id, created_by, organization_id, status
) VALUES 
(
    'Insecure Direct Object References in Order API',
    'API endpoints allow users to access other users order details by manipulating order IDs.',
    'Medium',
    'P3',
    'order-service',
    'Unauthorized access to sensitive order information, privacy violations',
    'Implement proper authorization checks, use UUIDs instead of sequential IDs, validate user permissions.',
    (SELECT id FROM projects LIMIT 1),
    (SELECT id FROM users LIMIT 1),
    (SELECT organization FROM users LIMIT 1),
    'resolved'
) ON CONFLICT DO NOTHING;