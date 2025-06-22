-- Migration: 007_views_and_functions.sql
-- Description: Materialized views, functions, and stored procedures
-- Date: 2025-01-09

-- Project risk summary view
CREATE MATERIALIZED VIEW project_risk_summary AS
SELECT 
    p.id as project_id,
    p.organization_id,
    p.name as project_name,
    p.risk_profile,
    COUNT(DISTINCT tm.id) as threat_model_count,
    COUNT(DISTINCT t.id) as total_threats,
    COUNT(DISTINCT t.id) FILTER (WHERE t.risk_score >= 0.7) as high_risk_threats,
    COUNT(DISTINCT t.id) FILTER (WHERE t.risk_score >= 0.5 AND t.risk_score < 0.7) as medium_risk_threats,
    COUNT(DISTINCT t.id) FILTER (WHERE t.risk_score < 0.5) as low_risk_threats,
    COUNT(DISTINCT m.id) FILTER (WHERE m.implementation_status = 'implemented') as implemented_mitigations,
    COUNT(DISTINCT m.id) FILTER (WHERE m.implementation_status = 'planned') as planned_mitigations,
    AVG(t.risk_score) as avg_risk_score,
    MAX(tm.updated_at) as last_assessment_date
FROM projects p
LEFT JOIN threat_models tm ON p.id = tm.project_id AND tm.is_current = true
LEFT JOIN threats t ON tm.id = t.threat_model_id
LEFT JOIN mitigations m ON t.id = m.threat_id
GROUP BY p.id, p.organization_id, p.name, p.risk_profile;

CREATE INDEX idx_project_risk_summary_project ON project_risk_summary(project_id);
CREATE INDEX idx_project_risk_summary_org ON project_risk_summary(organization_id);

-- Organization metrics view
CREATE MATERIALIZED VIEW organization_metrics AS
SELECT 
    o.id as organization_id,
    o.name as organization_name,
    COUNT(DISTINCT p.id) as total_projects,
    COUNT(DISTINCT p.id) FILTER (WHERE p.is_archived = false) as active_projects,
    COUNT(DISTINCT u.id) as total_users,
    COUNT(DISTINCT tm.id) as total_threat_models,
    COUNT(DISTINCT t.id) as total_threats_identified,
    AVG(t.risk_score) as avg_organization_risk,
    COUNT(DISTINCT tm.methodology) as methodologies_used,
    MAX(tm.created_at) as last_threat_model_date
FROM organizations o
LEFT JOIN organization_members om ON o.id = om.organization_id
LEFT JOIN users u ON om.user_id = u.id
LEFT JOIN projects p ON o.id = p.organization_id
LEFT JOIN threat_models tm ON p.id = tm.project_id
LEFT JOIN threats t ON tm.id = t.threat_model_id
GROUP BY o.id, o.name;

CREATE INDEX idx_organization_metrics_org ON organization_metrics(organization_id);

-- Compliance status view
CREATE MATERIALIZED VIEW compliance_status_summary AS
SELECT 
    p.id as project_id,
    p.name as project_name,
    cr.framework,
    COUNT(DISTINCT cr.id) as total_requirements,
    COUNT(DISTINCT pc.id) FILTER (WHERE pc.status = 'compliant') as compliant_count,
    COUNT(DISTINCT pc.id) FILTER (WHERE pc.status = 'non_compliant') as non_compliant_count,
    COUNT(DISTINCT pc.id) FILTER (WHERE pc.status = 'partial') as partial_count,
    COUNT(DISTINCT pc.id) FILTER (WHERE pc.status = 'not_assessed') as not_assessed_count,
    ROUND(COUNT(DISTINCT pc.id) FILTER (WHERE pc.status = 'compliant')::numeric / 
          NULLIF(COUNT(DISTINCT cr.id), 0) * 100, 2) as compliance_percentage
FROM projects p
CROSS JOIN compliance_requirements cr
LEFT JOIN project_compliance pc ON p.id = pc.project_id AND cr.id = pc.requirement_id
GROUP BY p.id, p.name, cr.framework;

CREATE INDEX idx_compliance_status_project ON compliance_status_summary(project_id);
CREATE INDEX idx_compliance_status_framework ON compliance_status_summary(framework);

-- Function to calculate risk score
CREATE OR REPLACE FUNCTION calculate_risk_score(
    p_likelihood likelihood,
    p_impact impact
) RETURNS DECIMAL(3,2) AS $$
DECLARE
    likelihood_score INTEGER;
    impact_score INTEGER;
BEGIN
    -- Convert likelihood to numeric
    likelihood_score := CASE p_likelihood
        WHEN 'very_low' THEN 1
        WHEN 'low' THEN 2
        WHEN 'medium' THEN 3
        WHEN 'high' THEN 4
        WHEN 'very_high' THEN 5
        ELSE 3
    END;
    
    -- Convert impact to numeric
    impact_score := CASE p_impact
        WHEN 'very_low' THEN 1
        WHEN 'low' THEN 2
        WHEN 'medium' THEN 3
        WHEN 'high' THEN 4
        WHEN 'very_high' THEN 5
        ELSE 3
    END;
    
    -- Calculate risk score (normalized to 0-1)
    RETURN (likelihood_score * impact_score) / 25.0;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger to auto-calculate risk score
CREATE OR REPLACE FUNCTION update_threat_risk_score()
RETURNS TRIGGER AS $$
BEGIN
    NEW.risk_score := calculate_risk_score(NEW.likelihood, NEW.impact);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calculate_risk_score_trigger
BEFORE INSERT OR UPDATE OF likelihood, impact ON threats
FOR EACH ROW
EXECUTE FUNCTION update_threat_risk_score();

-- Function to refresh materialized views
CREATE OR REPLACE FUNCTION refresh_materialized_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY project_risk_summary;
    REFRESH MATERIALIZED VIEW CONCURRENTLY organization_metrics;
    REFRESH MATERIALIZED VIEW CONCURRENTLY compliance_status_summary;
END;
$$ LANGUAGE plpgsql;

-- Function to archive old audit logs
CREATE OR REPLACE FUNCTION archive_old_audit_logs()
RETURNS void AS $$
DECLARE
    archive_date DATE;
BEGIN
    archive_date := CURRENT_DATE - INTERVAL '90 days';
    
    -- Move old audit logs to archive table
    INSERT INTO audit_logs_archive
    SELECT * FROM audit_logs WHERE created_at < archive_date;
    
    -- Delete archived logs from main table
    DELETE FROM audit_logs WHERE created_at < archive_date;
END;
$$ LANGUAGE plpgsql;

-- Function to get user permissions
CREATE OR REPLACE FUNCTION get_user_permissions(
    p_user_id UUID,
    p_organization_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_permissions JSONB DEFAULT '[]'::JSONB;
BEGIN
    SELECT 
        jsonb_agg(DISTINCT perm)
    INTO v_permissions
    FROM (
        SELECT jsonb_array_elements(r.permissions) as perm
        FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = p_user_id 
        AND ur.organization_id = p_organization_id
        AND (ur.expires_at IS NULL OR ur.expires_at > CURRENT_TIMESTAMP)
    ) perms;
    
    RETURN COALESCE(v_permissions, '[]'::JSONB);
END;
$$ LANGUAGE plpgsql;

-- Function to log activity
CREATE OR REPLACE FUNCTION log_activity(
    p_organization_id UUID,
    p_project_id UUID,
    p_user_id UUID,
    p_activity_type VARCHAR(100),
    p_title VARCHAR(255),
    p_description TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
    v_activity_id UUID;
BEGIN
    INSERT INTO activities (
        organization_id,
        project_id,
        user_id,
        activity_type,
        title,
        description,
        metadata
    ) VALUES (
        p_organization_id,
        p_project_id,
        p_user_id,
        p_activity_type,
        p_title,
        p_description,
        p_metadata
    ) RETURNING id INTO v_activity_id;
    
    RETURN v_activity_id;
END;
$$ LANGUAGE plpgsql;

-- Function to create notification
CREATE OR REPLACE FUNCTION create_notification(
    p_user_id UUID,
    p_type VARCHAR(50),
    p_title VARCHAR(255),
    p_message TEXT,
    p_data JSONB DEFAULT '{}',
    p_action_url TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_notification_id UUID;
BEGIN
    INSERT INTO notifications (
        user_id,
        type,
        title,
        message,
        data,
        action_url
    ) VALUES (
        p_user_id,
        p_type,
        p_title,
        p_message,
        p_data,
        p_action_url
    ) RETURNING id INTO v_notification_id;
    
    RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql;

-- Table statistics view
CREATE VIEW table_statistics AS
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
    pg_size_pretty(pg_indexes_size(schemaname||'.'||tablename)) AS indexes_size,
    n_live_tup as row_count,
    n_dead_tup as dead_rows,
    last_vacuum,
    last_autovacuum
FROM pg_stat_user_tables
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;