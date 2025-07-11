-- Create threat_models table
CREATE TABLE IF NOT EXISTS threat_models (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    methodology VARCHAR(50) DEFAULT 'STRIDE',
    version VARCHAR(50) DEFAULT '1.0',
    status VARCHAR(50) DEFAULT 'draft',
    scope JSONB,
    assets JSONB,
    data_flows JSONB,
    trust_boundaries JSONB,
    entry_points JSONB,
    metadata JSONB,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    published_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_threat_models_project_id ON threat_models(project_id);
CREATE INDEX IF NOT EXISTS idx_threat_models_status ON threat_models(status);
CREATE INDEX IF NOT EXISTS idx_threat_models_created_by ON threat_models(created_by);

-- Create threats table
CREATE TABLE IF NOT EXISTS threats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    threat_model_id UUID NOT NULL REFERENCES threat_models(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(100) NOT NULL,
    status VARCHAR(50) DEFAULT 'identified',
    likelihood VARCHAR(50) DEFAULT 'Medium',
    impact VARCHAR(50) DEFAULT 'Medium',
    risk_level VARCHAR(50) DEFAULT 'Medium',
    affected_component VARCHAR(255),
    affected_assets TEXT[],
    threat_sources TEXT[],
    prerequisites TEXT[],
    metadata JSONB,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    identified_at TIMESTAMP DEFAULT NOW(),
    resolved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_threats_threat_model_id ON threats(threat_model_id);
CREATE INDEX IF NOT EXISTS idx_threats_status ON threats(status);
CREATE INDEX IF NOT EXISTS idx_threats_risk_level ON threats(risk_level);
CREATE INDEX IF NOT EXISTS idx_threats_assigned_to ON threats(assigned_to);

-- Create mitigations table
CREATE TABLE IF NOT EXISTS mitigations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    threat_id UUID NOT NULL REFERENCES threats(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    type VARCHAR(100) NOT NULL,
    status VARCHAR(50) DEFAULT 'proposed',
    effectiveness VARCHAR(50) DEFAULT 'High',
    implementation_cost VARCHAR(50) DEFAULT 'Medium',
    implementation_time VARCHAR(50) DEFAULT 'Medium',
    priority INTEGER,
    requirements TEXT[],
    validation_steps JSONB,
    metadata JSONB,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    implemented_by UUID REFERENCES users(id) ON DELETE SET NULL,
    implemented_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_mitigations_threat_id ON mitigations(threat_id);
CREATE INDEX IF NOT EXISTS idx_mitigations_status ON mitigations(status);
CREATE INDEX IF NOT EXISTS idx_mitigations_type ON mitigations(type);

-- Create threat_templates table
CREATE TABLE IF NOT EXISTS threat_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(100) NOT NULL,
    methodology VARCHAR(50) NOT NULL,
    severity VARCHAR(50) DEFAULT 'Medium',
    applicable_to JSONB,
    example_instances JSONB,
    common_mitigations JSONB,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_threat_templates_category ON threat_templates(category);
CREATE INDEX IF NOT EXISTS idx_threat_templates_methodology ON threat_templates(methodology);
CREATE INDEX IF NOT EXISTS idx_threat_templates_is_active ON threat_templates(is_active);

-- Create attack_patterns table
CREATE TABLE IF NOT EXISTS attack_patterns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pattern_id VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(100) NOT NULL,
    severity VARCHAR(50) DEFAULT 'Medium',
    platforms TEXT[],
    techniques JSONB,
    mitigations JSONB,
    detection_methods JSONB,
    references JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_attack_patterns_pattern_id ON attack_patterns(pattern_id);
CREATE INDEX IF NOT EXISTS idx_attack_patterns_category ON attack_patterns(category);

-- Create threat_model_reviews table
CREATE TABLE IF NOT EXISTS threat_model_reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    threat_model_id UUID NOT NULL REFERENCES threat_models(id) ON DELETE CASCADE,
    reviewer_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    status VARCHAR(50) DEFAULT 'pending',
    comments TEXT,
    findings JSONB,
    risk_rating INTEGER,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_threat_model_reviews_threat_model_id ON threat_model_reviews(threat_model_id);
CREATE INDEX IF NOT EXISTS idx_threat_model_reviews_reviewer_id ON threat_model_reviews(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_threat_model_reviews_status ON threat_model_reviews(status);

-- Create threat_model_history table
CREATE TABLE IF NOT EXISTS threat_model_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    threat_model_id UUID NOT NULL REFERENCES threat_models(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL,
    changes JSONB,
    comment TEXT,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    version VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_threat_model_history_threat_model_id ON threat_model_history(threat_model_id);
CREATE INDEX IF NOT EXISTS idx_threat_model_history_user_id ON threat_model_history(user_id);
CREATE INDEX IF NOT EXISTS idx_threat_model_history_created_at ON threat_model_history(created_at);