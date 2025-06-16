export enum MethodologyType {
  STRIDE = 'STRIDE',
  PASTA = 'PASTA',
  LINDDUN = 'LINDDUN',
  VAST = 'VAST',
  DREAD = 'DREAD',
  OCTAVE = 'OCTAVE',
  TRIKE = 'TRIKE',
  CUSTOM = 'CUSTOM'
}

export interface Methodology {
  id: string;
  name: string;
  type: MethodologyType;
  description: string;
  version: string;
  categories: MethodologyCategory[];
  risk_calculation_method: RiskCalculationMethod;
  templates: MethodologyTemplate[];
  guidance: MethodologyGuidance;
  metadata: MethodologyMetadata;
}

export interface MethodologyCategory {
  id: string;
  name: string;
  description: string;
  parent_id?: string;
  examples: string[];
  questions: string[];
  indicators: string[];
}

export interface RiskCalculationMethod {
  type: 'matrix' | 'formula' | 'scoring' | 'custom';
  parameters: RiskParameter[];
  calculation_logic?: string;
  risk_levels: RiskLevelDefinition[];
}

export interface RiskParameter {
  name: string;
  description: string;
  type: 'number' | 'enum' | 'boolean';
  possible_values?: any[];
  weight?: number;
}

export interface RiskLevelDefinition {
  level: string;
  min_score: number;
  max_score: number;
  color: string;
  description: string;
  action_required: string;
}

export interface MethodologyTemplate {
  id: string;
  name: string;
  type: 'threat' | 'mitigation' | 'report';
  content: string;
  variables: TemplateVariable[];
}

export interface TemplateVariable {
  name: string;
  type: string;
  description: string;
  default_value?: any;
  required: boolean;
}

export interface MethodologyGuidance {
  overview: string;
  when_to_use: string;
  how_to_apply: string;
  best_practices: string[];
  common_mistakes: string[];
  references: string[];
}

export interface MethodologyMetadata {
  author?: string;
  organization?: string;
  created_date?: Date;
  last_updated?: Date;
  tags?: string[];
  compliance_frameworks?: string[];
  industry_focus?: string[];
}

// Specific methodology configurations
export interface STRIDEConfig extends Methodology {
  type: MethodologyType.STRIDE;
  stride_categories: {
    spoofing: STRIDECategoryConfig;
    tampering: STRIDECategoryConfig;
    repudiation: STRIDECategoryConfig;
    information_disclosure: STRIDECategoryConfig;
    denial_of_service: STRIDECategoryConfig;
    elevation_of_privilege: STRIDECategoryConfig;
  };
}

export interface STRIDECategoryConfig {
  description: string;
  common_threats: string[];
  common_mitigations: string[];
  analysis_questions: string[];
}

export interface PASTAConfig extends Methodology {
  type: MethodologyType.PASTA;
  stages: PASTAStageConfig[];
}

export interface PASTAStageConfig {
  stage_number: number;
  name: string;
  description: string;
  deliverables: string[];
  activities: string[];
  tools: string[];
  duration_estimate: string;
}

export interface LINDDUNConfig extends Methodology {
  type: MethodologyType.LINDDUN;
  privacy_categories: {
    linkability: PrivacyCategoryConfig;
    identifiability: PrivacyCategoryConfig;
    non_repudiation: PrivacyCategoryConfig;
    detectability: PrivacyCategoryConfig;
    disclosure: PrivacyCategoryConfig;
    unawareness: PrivacyCategoryConfig;
    non_compliance: PrivacyCategoryConfig;
  };
}

export interface PrivacyCategoryConfig {
  description: string;
  privacy_threats: string[];
  privacy_controls: string[];
  assessment_criteria: string[];
}

// Methodology comparison and selection
export interface MethodologyComparison {
  methodologies: MethodologySummary[];
  recommendation: MethodologyRecommendation;
}

export interface MethodologySummary {
  type: MethodologyType;
  strengths: string[];
  weaknesses: string[];
  best_for: string[];
  time_required: string;
  expertise_required: 'low' | 'medium' | 'high';
  output_types: string[];
}

export interface MethodologyRecommendation {
  primary: MethodologyType;
  alternatives: MethodologyType[];
  reasoning: string;
  factors_considered: string[];
}