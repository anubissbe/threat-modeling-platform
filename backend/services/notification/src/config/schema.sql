-- Notification Service Database Schema
-- This file contains the schema for notification-related tables

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
    channel VARCHAR(50) NOT NULL, -- specific channel (email address, slack channel, etc.)
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
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Indexes
    INDEX idx_notifications_user_id (user_id),
    INDEX idx_notifications_status (status),
    INDEX idx_notifications_type (type),
    INDEX idx_notifications_scheduled_at (scheduled_at),
    INDEX idx_notifications_created_at (created_at)
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
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Indexes
    INDEX idx_templates_name (name),
    INDEX idx_templates_type (type),
    INDEX idx_templates_active (is_active)
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
    
    UNIQUE(user_id, channel),
    INDEX idx_preferences_user_id (user_id),
    INDEX idx_preferences_channel (channel)
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
    
    UNIQUE(user_id, event_type, channel),
    INDEX idx_subscriptions_user_id (user_id),
    INDEX idx_subscriptions_event_type (event_type),
    INDEX idx_subscriptions_channel (channel)
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
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    INDEX idx_logs_notification_id (notification_id),
    INDEX idx_logs_status (status),
    INDEX idx_logs_created_at (created_at)
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
    
    UNIQUE(organization_id, name),
    INDEX idx_channels_organization_id (organization_id),
    INDEX idx_channels_type (type),
    INDEX idx_channels_active (is_active)
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
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    INDEX idx_queue_notification_id (notification_id),
    INDEX idx_queue_name (queue_name),
    INDEX idx_queue_priority (priority),
    INDEX idx_queue_next_retry (next_retry_at),
    INDEX idx_queue_lock_expires (lock_expires_at)
);

-- Create triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_notifications_updated_at 
    BEFORE UPDATE ON notifications 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_templates_updated_at 
    BEFORE UPDATE ON notification_templates 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_preferences_updated_at 
    BEFORE UPDATE ON notification_preferences 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_subscriptions_updated_at 
    BEFORE UPDATE ON notification_subscriptions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_channels_updated_at 
    BEFORE UPDATE ON notification_channels 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

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