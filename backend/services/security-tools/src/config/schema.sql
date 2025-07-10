-- Security Tools Integration Schema

-- Security tool integrations table
CREATE TABLE IF NOT EXISTS security_tool_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    platform VARCHAR(50) NOT NULL,
    description TEXT,
    connection_config JSONB NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'configuring',
    sync_enabled BOOLEAN DEFAULT false,
    sync_direction VARCHAR(20) DEFAULT 'inbound',
    sync_interval INTEGER, -- minutes
    sync_filter JSONB,
    field_mappings JSONB DEFAULT '[]'::jsonb,
    severity_mapping JSONB NOT NULL,
    features JSONB NOT NULL,
    last_connected TIMESTAMP,
    last_sync TIMESTAMP,
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    version VARCHAR(20) DEFAULT '1.0.0',
    CONSTRAINT valid_type CHECK (type IN ('siem', 'vulnerability-scanner', 'cloud-security', 'ticketing', 'soar', 'threat-intelligence', 'endpoint-protection', 'network-security')),
    CONSTRAINT valid_status CHECK (status IN ('connected', 'disconnected', 'error', 'configuring', 'testing')),
    CONSTRAINT valid_sync_direction CHECK (sync_direction IN ('inbound', 'outbound', 'bidirectional'))
);

-- Correlation engines table
CREATE TABLE IF NOT EXISTS correlation_engines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    rules JSONB NOT NULL DEFAULT '[]'::jsonb,
    correlation_window INTEGER NOT NULL DEFAULT 15, -- minutes
    lookback_period INTEGER NOT NULL DEFAULT 30, -- minutes
    deduplication_enabled BOOLEAN DEFAULT true,
    deduplication_fields JSONB DEFAULT '[]'::jsonb,
    enrichment_sources JSONB DEFAULT '[]'::jsonb,
    output_format VARCHAR(50) DEFAULT 'unified-threat',
    output_destinations JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Unified threats table
CREATE TABLE IF NOT EXISTS unified_threats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    correlation_id VARCHAR(255) NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    severity VARCHAR(20) NOT NULL,
    confidence INTEGER CHECK (confidence >= 0 AND confidence <= 100),
    sources JSONB NOT NULL,
    first_seen TIMESTAMP NOT NULL,
    last_seen TIMESTAMP NOT NULL,
    event_count INTEGER DEFAULT 0,
    actors JSONB DEFAULT '[]'::jsonb,
    campaigns JSONB DEFAULT '[]'::jsonb,
    techniques JSONB DEFAULT '[]'::jsonb,
    affected_assets JSONB DEFAULT '[]'::jsonb,
    affected_users JSONB DEFAULT '[]'::jsonb,
    business_impact TEXT,
    status VARCHAR(50) DEFAULT 'active',
    response_actions JSONB DEFAULT '[]'::jsonb,
    related_threats JSONB DEFAULT '[]'::jsonb,
    evidence JSONB DEFAULT '[]'::jsonb,
    risk_score INTEGER CHECK (risk_score >= 0 AND risk_score <= 100),
    risk_factors JSONB DEFAULT '[]'::jsonb,
    assignee VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_severity CHECK (severity IN ('critical', 'high', 'medium', 'low', 'info')),
    CONSTRAINT valid_status CHECK (status IN ('active', 'investigating', 'contained', 'resolved'))
);

-- Vulnerabilities table
CREATE TABLE IF NOT EXISTS vulnerabilities (
    id VARCHAR(255) PRIMARY KEY,
    scanner_vuln_id VARCHAR(255) NOT NULL,
    integration_id UUID REFERENCES security_tool_integrations(id) ON DELETE CASCADE,
    cve VARCHAR(50),
    cwe VARCHAR(50),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    severity VARCHAR(20) NOT NULL,
    cvss_score DECIMAL(3,1),
    cvss_vector VARCHAR(255),
    category VARCHAR(255),
    family VARCHAR(255),
    affected_assets JSONB DEFAULT '[]'::jsonb,
    exploit_available BOOLEAN DEFAULT false,
    exploit_maturity VARCHAR(50),
    malware_known BOOLEAN DEFAULT false,
    in_the_wild BOOLEAN DEFAULT false,
    solution TEXT,
    workaround TEXT,
    patches JSONB DEFAULT '[]'::jsonb,
    first_seen TIMESTAMP NOT NULL,
    last_seen TIMESTAMP NOT NULL,
    scan_id VARCHAR(255),
    risk_score INTEGER CHECK (risk_score >= 0 AND risk_score <= 100),
    business_impact TEXT,
    status VARCHAR(50) DEFAULT 'open',
    verification_status VARCHAR(50),
    linked_tickets JSONB DEFAULT '[]'::jsonb,
    linked_threats JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_severity CHECK (severity IN ('critical', 'high', 'medium', 'low', 'info')),
    CONSTRAINT valid_status CHECK (status IN ('open', 'remediated', 'mitigated', 'accepted', 'false-positive')),
    CONSTRAINT valid_exploit_maturity CHECK (exploit_maturity IN ('functional', 'poc', 'unproven'))
);

-- Cloud security findings table
CREATE TABLE IF NOT EXISTS cloud_security_findings (
    id VARCHAR(255) PRIMARY KEY,
    finding_id VARCHAR(255) NOT NULL,
    integration_id UUID REFERENCES security_tool_integrations(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    severity VARCHAR(20) NOT NULL,
    confidence INTEGER CHECK (confidence >= 0 AND confidence <= 100),
    resource_type VARCHAR(255),
    resource_id VARCHAR(255),
    resource_name VARCHAR(255),
    region VARCHAR(50),
    account_id VARCHAR(255),
    compliance_status VARCHAR(50),
    compliance_standards JSONB DEFAULT '[]'::jsonb,
    control_id VARCHAR(255),
    category VARCHAR(255),
    threat_intelligence JSONB,
    remediation JSONB,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    resolved_at TIMESTAMP,
    status VARCHAR(50) DEFAULT 'active',
    workflow_status VARCHAR(50),
    linked_vulnerabilities JSONB DEFAULT '[]'::jsonb,
    linked_tickets JSONB DEFAULT '[]'::jsonb,
    CONSTRAINT valid_platform CHECK (platform IN ('aws', 'azure', 'gcp', 'alibaba', 'oracle', 'ibm')),
    CONSTRAINT valid_severity CHECK (severity IN ('critical', 'high', 'medium', 'low', 'info')),
    CONSTRAINT valid_status CHECK (status IN ('active', 'resolved', 'suppressed'))
);

-- Security events table (for SIEM data)
CREATE TABLE IF NOT EXISTS security_events (
    id VARCHAR(255) PRIMARY KEY,
    integration_id UUID REFERENCES security_tool_integrations(id) ON DELETE CASCADE,
    timestamp TIMESTAMP NOT NULL,
    source VARCHAR(255),
    event_type VARCHAR(255),
    severity VARCHAR(20) NOT NULL,
    title VARCHAR(500),
    description TEXT,
    category VARCHAR(255),
    subcategory VARCHAR(255),
    source_ip VARCHAR(45),
    destination_ip VARCHAR(45),
    source_port INTEGER,
    destination_port INTEGER,
    protocol VARCHAR(50),
    user_name VARCHAR(255),
    host VARCHAR(255),
    threat_indicators JSONB DEFAULT '[]'::jsonb,
    mitre_techniques JSONB DEFAULT '[]'::jsonb,
    raw_event JSONB,
    normalized_event JSONB,
    correlation_id VARCHAR(255),
    related_events JSONB DEFAULT '[]'::jsonb,
    status VARCHAR(50) DEFAULT 'new',
    assignee VARCHAR(255),
    notes JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_severity CHECK (severity IN ('critical', 'high', 'medium', 'low', 'info')),
    CONSTRAINT valid_status CHECK (status IN ('new', 'investigating', 'resolved', 'false-positive'))
);

-- Security tickets table
CREATE TABLE IF NOT EXISTS security_tickets (
    id VARCHAR(255) PRIMARY KEY,
    external_id VARCHAR(255) NOT NULL,
    integration_id UUID REFERENCES security_tool_integrations(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    type VARCHAR(100),
    priority VARCHAR(50),
    severity VARCHAR(20),
    assignee VARCHAR(255),
    reporter VARCHAR(255) NOT NULL,
    watchers JSONB DEFAULT '[]'::jsonb,
    status VARCHAR(100) NOT NULL,
    resolution VARCHAR(100),
    linked_threats JSONB DEFAULT '[]'::jsonb,
    linked_vulnerabilities JSONB DEFAULT '[]'::jsonb,
    linked_findings JSONB DEFAULT '[]'::jsonb,
    linked_tickets JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    due_date TIMESTAMP,
    resolved_at TIMESTAMP,
    sla_status VARCHAR(50),
    time_to_resolution INTEGER, -- minutes
    custom_fields JSONB DEFAULT '{}'::jsonb,
    comments JSONB DEFAULT '[]'::jsonb,
    attachments JSONB DEFAULT '[]'::jsonb,
    history JSONB DEFAULT '[]'::jsonb,
    CONSTRAINT valid_platform CHECK (platform IN ('jira', 'servicenow', 'remedy', 'zendesk', 'freshservice', 'custom')),
    CONSTRAINT valid_severity CHECK (severity IN ('critical', 'high', 'medium', 'low', 'info')),
    CONSTRAINT valid_sla_status CHECK (sla_status IN ('on-track', 'at-risk', 'breached'))
);

-- Threat indicators table
CREATE TABLE IF NOT EXISTS threat_indicators (
    threat_id UUID REFERENCES unified_threats(id) ON DELETE CASCADE,
    indicator_type VARCHAR(50) NOT NULL,
    indicator_value VARCHAR(500) NOT NULL,
    confidence INTEGER CHECK (confidence >= 0 AND confidence <= 100),
    source VARCHAR(255),
    last_seen TIMESTAMP NOT NULL,
    tags JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (threat_id, indicator_type, indicator_value),
    CONSTRAINT valid_indicator_type CHECK (indicator_type IN ('ip', 'domain', 'url', 'hash', 'email', 'cve'))
);

-- Ticket mappings table
CREATE TABLE IF NOT EXISTS ticket_mappings (
    ticket_id VARCHAR(255) NOT NULL,
    external_id VARCHAR(255) NOT NULL,
    integration_id UUID REFERENCES security_tool_integrations(id) ON DELETE CASCADE,
    threat_id UUID REFERENCES unified_threats(id) ON DELETE SET NULL,
    vulnerability_id VARCHAR(255) REFERENCES vulnerabilities(id) ON DELETE SET NULL,
    finding_id VARCHAR(255) REFERENCES cloud_security_findings(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (ticket_id, integration_id)
);

-- Webhooks table
CREATE TABLE IF NOT EXISTS webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    url VARCHAR(500) NOT NULL,
    events JSONB NOT NULL DEFAULT '[]'::jsonb,
    headers JSONB DEFAULT '{}'::jsonb,
    secret VARCHAR(255),
    enabled BOOLEAN DEFAULT true,
    retry_attempts INTEGER DEFAULT 3,
    retry_delay INTEGER DEFAULT 5, -- seconds
    last_triggered TIMESTAMP,
    last_status INTEGER,
    failure_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sync logs table
CREATE TABLE IF NOT EXISTS sync_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    integration_id UUID REFERENCES security_tool_integrations(id) ON DELETE CASCADE,
    sync_type VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL,
    started_at TIMESTAMP NOT NULL,
    completed_at TIMESTAMP,
    records_processed INTEGER DEFAULT 0,
    records_created INTEGER DEFAULT 0,
    records_updated INTEGER DEFAULT 0,
    records_failed INTEGER DEFAULT 0,
    error_message TEXT,
    details JSONB DEFAULT '{}'::jsonb,
    CONSTRAINT valid_sync_type CHECK (sync_type IN ('full', 'incremental', 'manual')),
    CONSTRAINT valid_status CHECK (status IN ('running', 'completed', 'failed', 'cancelled'))
);

-- Reports table
CREATE TABLE IF NOT EXISTS security_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(50) NOT NULL,
    format VARCHAR(20) NOT NULL,
    status VARCHAR(50) DEFAULT 'queued',
    file_path VARCHAR(500),
    file_size INTEGER,
    parameters JSONB DEFAULT '{}'::jsonb,
    generated_by VARCHAR(255) NOT NULL,
    generated_at TIMESTAMP,
    expiration_date TIMESTAMP,
    version VARCHAR(20) DEFAULT '1.0',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_type CHECK (type IN ('assessment', 'gap-analysis', 'remediation', 'executive', 'detailed', 'custom')),
    CONSTRAINT valid_format CHECK (format IN ('pdf', 'html', 'excel', 'csv', 'json', 'xml')),
    CONSTRAINT valid_status CHECK (status IN ('queued', 'generating', 'completed', 'failed'))
);

-- Indexes for performance
CREATE INDEX idx_integrations_type ON security_tool_integrations(type);
CREATE INDEX idx_integrations_status ON security_tool_integrations(status);
CREATE INDEX idx_threats_severity ON unified_threats(severity);
CREATE INDEX idx_threats_status ON unified_threats(status);
CREATE INDEX idx_threats_created ON unified_threats(created_at DESC);
CREATE INDEX idx_vulnerabilities_severity ON vulnerabilities(severity);
CREATE INDEX idx_vulnerabilities_status ON vulnerabilities(status);
CREATE INDEX idx_vulnerabilities_cve ON vulnerabilities(cve);
CREATE INDEX idx_findings_severity ON cloud_security_findings(severity);
CREATE INDEX idx_findings_status ON cloud_security_findings(status);
CREATE INDEX idx_findings_account ON cloud_security_findings(account_id);
CREATE INDEX idx_events_timestamp ON security_events(timestamp DESC);
CREATE INDEX idx_events_severity ON security_events(severity);
CREATE INDEX idx_events_correlation ON security_events(correlation_id);
CREATE INDEX idx_tickets_status ON security_tickets(status);
CREATE INDEX idx_tickets_created ON security_tickets(created_at DESC);
CREATE INDEX idx_sync_logs_integration ON sync_logs(integration_id, started_at DESC);

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_integrations_updated_at BEFORE UPDATE ON security_tool_integrations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_engines_updated_at BEFORE UPDATE ON correlation_engines
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_threats_updated_at BEFORE UPDATE ON unified_threats
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_vulnerabilities_updated_at BEFORE UPDATE ON vulnerabilities
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_webhooks_updated_at BEFORE UPDATE ON webhooks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_reports_updated_at BEFORE UPDATE ON security_reports
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();