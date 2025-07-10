-- Activity Logs Table Migration
-- Creates a comprehensive activity logging system for audit trails

CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(50) NOT NULL,
    action VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN ('project', 'threat_model', 'vulnerability', 'user', 'organization', 'system')),
    entity_id VARCHAR(255) NOT NULL,
    entity_name VARCHAR(255),
    metadata JSONB DEFAULT '{}',
    user_id UUID NOT NULL REFERENCES users(id),
    user_name VARCHAR(255),
    user_email VARCHAR(255),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_activity_logs_organization_id ON activity_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity ON activity_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_type ON activity_logs(type);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity_created_at ON activity_logs(entity_type, entity_id, created_at DESC);

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_activity_logs_org_created_at ON activity_logs(organization_id, created_at DESC);

-- Insert some sample activity data for testing
INSERT INTO activity_logs (
    type, action, description, entity_type, entity_id, entity_name,
    metadata, user_id, user_name, user_email, organization_id,
    created_at
) VALUES 
-- Recent system activities
(
    'system.maintenance', 
    'Database Maintenance', 
    'Routine database maintenance completed successfully',
    'system',
    'system',
    'Database System',
    '{"duration": "5 minutes", "tables_optimized": 12}',
    (SELECT id FROM users LIMIT 1),
    'System Admin',
    'admin@threatmodel.com',
    (SELECT id FROM organizations LIMIT 1),
    NOW() - INTERVAL '1 hour'
),
(
    'system.backup', 
    'Backup Created', 
    'Automated backup of threat modeling data completed',
    'system',
    'backup-001',
    'Daily Backup',
    '{"size": "2.4GB", "type": "incremental"}',
    (SELECT id FROM users LIMIT 1),
    'System Admin',
    'admin@threatmodel.com',
    (SELECT id FROM organizations LIMIT 1),
    NOW() - INTERVAL '3 hours'
),
-- User login activities
(
    'user.login', 
    'User Login', 
    'User successfully logged into the threat modeling platform',
    'user',
    (SELECT id FROM users LIMIT 1),
    'Test User',
    '{"login_method": "email", "browser": "Chrome", "location": "Unknown"}',
    (SELECT id FROM users LIMIT 1),
    'Test User',
    'test@example.com',
    (SELECT id FROM organizations LIMIT 1),
    NOW() - INTERVAL '30 minutes'
),
-- Project activities
(
    'project.created', 
    'Project Created', 
    'New threat modeling project was created',
    'project',
    (SELECT id FROM projects LIMIT 1),
    (SELECT name FROM projects LIMIT 1),
    '{"template": "web_application", "methodology": "STRIDE"}',
    (SELECT id FROM users LIMIT 1),
    'Test User',
    'test@example.com',
    (SELECT id FROM organizations LIMIT 1),
    NOW() - INTERVAL '2 hours'
),
-- Vulnerability activities  
(
    'vulnerability.created', 
    'Vulnerability Reported', 
    'New critical vulnerability discovered during security assessment',
    'vulnerability',
    (SELECT id FROM vulnerabilities LIMIT 1),
    (SELECT title FROM vulnerabilities LIMIT 1),
    '{"severity": "Critical", "cvss_score": 9.8, "discovery_method": "automated_scan"}',
    (SELECT id FROM users LIMIT 1),
    'Security Analyst',
    'security@example.com',
    (SELECT id FROM organizations LIMIT 1),
    NOW() - INTERVAL '45 minutes'
),
-- Security scan activities
(
    'security.scan_completed', 
    'Security Scan Completed', 
    'Automated vulnerability scan completed with findings',
    'system',
    'scan-001',
    'Daily Security Scan',
    '{"vulnerabilities_found": 3, "scan_duration": "15 minutes", "scan_type": "full"}',
    (SELECT id FROM users LIMIT 1),
    'Security Scanner',
    'scanner@threatmodel.com',
    (SELECT id FROM organizations LIMIT 1),
    NOW() - INTERVAL '1 hour'
);

-- Add a comment to document the table
COMMENT ON TABLE activity_logs IS 'Comprehensive activity logging for audit trails and user activity tracking';
COMMENT ON COLUMN activity_logs.type IS 'Activity type following dot notation (e.g., project.created, user.login)';
COMMENT ON COLUMN activity_logs.metadata IS 'Additional context and data about the activity in JSON format';
COMMENT ON COLUMN activity_logs.entity_type IS 'Type of entity the activity is related to';
COMMENT ON COLUMN activity_logs.entity_id IS 'ID of the specific entity affected by the activity';