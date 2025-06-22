-- Migration: 003_threat_libraries_schema.sql
-- Description: Threat libraries and knowledge base schema
-- Date: 2025-01-09

-- Threat library definitions
CREATE TABLE threat_libraries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    version VARCHAR(50) NOT NULL,
    type VARCHAR(50) NOT NULL,
    source VARCHAR(100),
    methodology VARCHAR(50),
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    is_public BOOLEAN DEFAULT false,
    organization_id UUID REFERENCES organizations(id),
    metadata JSONB DEFAULT '{}',
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(name, version, organization_id)
);

-- Library threats
CREATE TABLE library_threats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    library_id UUID REFERENCES threat_libraries(id) ON DELETE CASCADE,
    threat_id VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    sub_category VARCHAR(100),
    severity VARCHAR(20),
    likelihood VARCHAR(20),
    cwe_ids TEXT[],
    capec_ids TEXT[],
    kill_chain_phases TEXT[],
    platforms TEXT[],
    prerequisites TEXT,
    examples TEXT,
    detection_methods TEXT,
    references JSONB DEFAULT '[]',
    metadata JSONB DEFAULT '{}',
    vector_embedding vector(768),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(library_id, threat_id)
);

-- Library mitigations
CREATE TABLE library_mitigations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    library_id UUID REFERENCES threat_libraries(id) ON DELETE CASCADE,
    mitigation_id VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(50),
    nist_controls TEXT[],
    implementation_guide TEXT,
    effectiveness_score DECIMAL(3,2),
    cost_estimate VARCHAR(20),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(library_id, mitigation_id)
);

-- Threat to mitigation mapping
CREATE TABLE library_threat_mitigations (
    threat_id UUID REFERENCES library_threats(id) ON DELETE CASCADE,
    mitigation_id UUID REFERENCES library_mitigations(id) ON DELETE CASCADE,
    effectiveness DECIMAL(3,2),
    notes TEXT,
    PRIMARY KEY (threat_id, mitigation_id)
);

-- Attack patterns
CREATE TABLE attack_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    library_id UUID REFERENCES threat_libraries(id) ON DELETE CASCADE,
    pattern_id VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    severity VARCHAR(20),
    prerequisites TEXT[],
    attack_steps JSONB,
    typical_defenses TEXT[],
    indicators TEXT[],
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(library_id, pattern_id)
);

-- Threat intelligence feeds
CREATE TABLE threat_intelligence_feeds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    source VARCHAR(255) NOT NULL,
    feed_url TEXT,
    feed_type VARCHAR(50),
    last_fetched_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    configuration JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Pattern matching rules
CREATE TABLE pattern_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    rule_type VARCHAR(50),
    rule_definition JSONB NOT NULL,
    threat_mappings JSONB DEFAULT '[]',
    confidence DECIMAL(3,2),
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_library_threats_vector ON library_threats 
    USING ivfflat (vector_embedding vector_cosine_ops)
    WITH (lists = 100);
CREATE INDEX idx_library_threats_category ON library_threats(category);
CREATE INDEX idx_library_threats_severity ON library_threats(severity);
CREATE INDEX idx_library_threats_library ON library_threats(library_id);
CREATE INDEX idx_attack_patterns_library ON attack_patterns(library_id);
CREATE INDEX idx_pattern_rules_active ON pattern_rules(is_active);

-- Full-text search indexes
CREATE INDEX idx_library_threats_search ON library_threats 
    USING gin(to_tsvector('english', name || ' ' || COALESCE(description, '')));
CREATE INDEX idx_library_mitigations_search ON library_mitigations 
    USING gin(to_tsvector('english', name || ' ' || COALESCE(description, '')));

-- Add triggers
CREATE TRIGGER update_threat_libraries_updated_at BEFORE UPDATE ON threat_libraries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_library_threats_updated_at BEFORE UPDATE ON library_threats
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_library_mitigations_updated_at BEFORE UPDATE ON library_mitigations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_attack_patterns_updated_at BEFORE UPDATE ON attack_patterns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_threat_intelligence_feeds_updated_at BEFORE UPDATE ON threat_intelligence_feeds
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pattern_rules_updated_at BEFORE UPDATE ON pattern_rules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();