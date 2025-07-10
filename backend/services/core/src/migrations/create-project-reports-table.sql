-- Project Reports Table Migration
-- Creates a comprehensive reporting system for projects

CREATE TABLE IF NOT EXISTS project_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    project_name VARCHAR(255) NOT NULL,
    report_type VARCHAR(50) NOT NULL CHECK (
        report_type IN (
            'vulnerability_summary', 'threat_analysis', 'risk_assessment',
            'compliance_audit', 'security_posture', 'executive_summary',
            'technical_deep_dive', 'trend_analysis', 'comparison_report'
        )
    ),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    generated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    generated_by UUID NOT NULL REFERENCES users(id),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    metadata JSONB DEFAULT '{}',
    content JSONB DEFAULT '{}',
    status VARCHAR(20) NOT NULL DEFAULT 'generating' CHECK (status IN ('generating', 'completed', 'failed')),
    download_url TEXT,
    expires_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_project_reports_project_id ON project_reports(project_id);
CREATE INDEX IF NOT EXISTS idx_project_reports_organization_id ON project_reports(organization_id);
CREATE INDEX IF NOT EXISTS idx_project_reports_generated_by ON project_reports(generated_by);
CREATE INDEX IF NOT EXISTS idx_project_reports_report_type ON project_reports(report_type);
CREATE INDEX IF NOT EXISTS idx_project_reports_status ON project_reports(status);
CREATE INDEX IF NOT EXISTS idx_project_reports_generated_at ON project_reports(generated_at DESC);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_project_reports_project_generated_at ON project_reports(project_id, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_project_reports_org_type ON project_reports(organization_id, report_type);

-- Insert some sample report data for testing
INSERT INTO project_reports (
    project_id, project_name, report_type, title, description,
    generated_by, organization_id, metadata, content, status,
    generated_at, created_at, updated_at
) VALUES 
-- Vulnerability Summary Report
(
    (SELECT id FROM projects LIMIT 1),
    (SELECT name FROM projects LIMIT 1),
    'vulnerability_summary',
    'Monthly Vulnerability Summary Report',
    'Comprehensive overview of all vulnerabilities found in the project during the current month',
    (SELECT id FROM users LIMIT 1),
    (SELECT id FROM organizations LIMIT 1),
    '{"format": "pdf", "includeCharts": true, "includeSummary": true, "includeRecommendations": true}',
    '{
        "summary": {
            "totalProjects": 1,
            "totalVulnerabilities": 15,
            "totalThreats": 8,
            "riskScore": 67,
            "keyFindings": ["15 vulnerabilities identified", "3 critical issues require immediate attention", "Security posture improved by 12% this month"],
            "executiveSummary": "Security assessment reveals 15 vulnerabilities with 3 critical issues requiring immediate remediation.",
            "generationTime": 45
        },
        "vulnerabilities": {
            "total": 15,
            "bySeverity": {"critical": 3, "high": 5, "medium": 4, "low": 3},
            "byStatus": {"open": 8, "inProgress": 4, "resolved": 3, "falsePositive": 0, "wontFix": 0},
            "trending": {"newThisWeek": 2, "resolvedThisWeek": 5, "avgResolutionTime": 7.2},
            "topVulnerabilities": [
                {"id": "vuln-001", "title": "SQL Injection in Login", "severity": "Critical", "cvssScore": 9.8, "component": "Authentication"},
                {"id": "vuln-002", "title": "XSS in Search Function", "severity": "High", "cvssScore": 7.4, "component": "Search Module"}
            ]
        }
    }',
    'completed',
    NOW() - INTERVAL '2 hours',
    NOW() - INTERVAL '2 hours',
    NOW() - INTERVAL '1 hour'
),
-- Executive Summary Report
(
    (SELECT id FROM projects LIMIT 1),
    (SELECT name FROM projects LIMIT 1),
    'executive_summary',
    'Q4 Security Posture Executive Summary',
    'High-level security overview for executive stakeholders including risk assessment and strategic recommendations',
    (SELECT id FROM users LIMIT 1),
    (SELECT id FROM organizations LIMIT 1),
    '{"format": "pdf", "includeCharts": true, "includeSummary": true, "includeRecommendations": true, "dateRange": {"start": "2024-10-01", "end": "2024-12-31"}}',
    '{
        "summary": {
            "totalProjects": 1,
            "totalVulnerabilities": 15,
            "totalThreats": 8,
            "riskScore": 67,
            "complianceScore": 82,
            "keyFindings": ["Overall security posture: MODERATE", "3 critical vulnerabilities require immediate action", "Compliance score improved to 82%"],
            "executiveSummary": "The organization maintains a moderate security posture with focused attention needed on critical vulnerabilities and continued compliance improvements.",
            "generationTime": 120
        },
        "recommendations": {
            "immediate": ["Patch critical SQL injection vulnerability", "Implement multi-factor authentication"],
            "shortTerm": ["Conduct security awareness training", "Update incident response procedures"],
            "longTerm": ["Implement zero-trust architecture", "Establish security metrics dashboard"],
            "strategic": ["Develop 3-year security roadmap", "Invest in security automation tools"]
        }
    }',
    'completed',
    NOW() - INTERVAL '1 day',
    NOW() - INTERVAL '1 day',
    NOW() - INTERVAL '23 hours'
),
-- Risk Assessment Report
(
    (SELECT id FROM projects LIMIT 1),
    (SELECT name FROM projects LIMIT 1),
    'risk_assessment',
    'Annual Risk Assessment Report',
    'Comprehensive risk analysis including threat landscape and mitigation strategies',
    (SELECT id FROM users LIMIT 1),
    (SELECT id FROM organizations LIMIT 1),
    '{"format": "pdf", "includeCharts": true, "includeSummary": true, "includeRecommendations": true}',
    '{
        "summary": {
            "totalProjects": 1,
            "totalVulnerabilities": 15,
            "totalThreats": 8,
            "riskScore": 67,
            "keyFindings": ["Risk score: 67/100", "8 active threat vectors identified", "Mitigation strategies 75% implemented"],
            "executiveSummary": "Risk assessment indicates moderate exposure with key threats identified and mitigation strategies in progress.",
            "generationTime": 180
        }
    }',
    'completed',
    NOW() - INTERVAL '3 days',
    NOW() - INTERVAL '3 days',
    NOW() - INTERVAL '3 days'
);

-- Add comments to document the table
COMMENT ON TABLE project_reports IS 'Stores generated security and compliance reports for projects';
COMMENT ON COLUMN project_reports.report_type IS 'Type of report generated (vulnerability_summary, threat_analysis, etc.)';
COMMENT ON COLUMN project_reports.metadata IS 'Report generation parameters and configuration in JSON format';
COMMENT ON COLUMN project_reports.content IS 'Generated report content including charts, summaries, and analysis in JSON format';
COMMENT ON COLUMN project_reports.status IS 'Current status of report generation process';