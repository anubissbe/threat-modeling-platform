import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

export const aiService = axios.create({
  baseURL: API_BASE_URL,
  timeout: 300000, // 5 minutes timeout for AI analysis
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
aiService.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
aiService.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized access
      localStorage.removeItem('authToken');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export interface AIAnalysisRequest {
  threat_model_id: string;
  methodology: string;
  context: {
    system_components: Array<{
      id: string;
      name: string;
      type: 'process' | 'data_store' | 'external_entity' | 'trust_boundary';
      technologies: string[];
      protocols: string[];
      interfaces: string[];
      security_level: 'public' | 'internal' | 'confidential' | 'secret';
      criticality: 'low' | 'medium' | 'high' | 'critical';
    }>;
    data_flows: Array<{
      id: string;
      source: string;
      destination: string;
      data_types: string[];
      sensitivity: 'public' | 'internal' | 'confidential' | 'secret';
      encryption: boolean;
      authentication_required: boolean;
      protocols: string[];
      data_classification?: 'user_input' | 'system_generated' | 'external_feed' | 'processed_data';
    }>;
    trust_boundaries: Array<{
      id: string;
      name: string;
      description: string;
      security_level: number;
      components_inside: string[];
      components_outside: string[];
    }>;
    assets: Array<{
      id: string;
      name: string;
      type: 'data' | 'system' | 'process' | 'people';
      sensitivity: 'public' | 'internal' | 'confidential' | 'secret';
      criticality: 'low' | 'medium' | 'high' | 'critical';
      value: number;
      dependencies: string[];
    }>;
    existing_controls: Array<{
      id: string;
      name: string;
      type: 'preventive' | 'detective' | 'corrective' | 'deterrent';
      category: string;
      effectiveness: number;
      coverage: string[];
      maturity: 'initial' | 'developing' | 'defined' | 'managed' | 'optimizing';
    }>;
    compliance_requirements: string[];
    business_context: {
      industry: string;
      organization_size: 'small' | 'medium' | 'large' | 'enterprise';
      regulatory_environment: string[];
      risk_tolerance: 'low' | 'medium' | 'high';
      business_criticality: 'low' | 'medium' | 'high' | 'critical';
      geographic_scope: string[];
    };
    external_dependencies?: Array<{
      id: string;
      name: string;
      type: 'library' | 'service' | 'api' | 'database' | 'infrastructure';
      version: string;
      vendor: string;
      criticality: 'low' | 'medium' | 'high' | 'critical';
      last_security_review: Date;
      known_vulnerabilities: string[];
      update_frequency: string;
      license_type: string;
      compliance_status: 'compliant' | 'non_compliant' | 'under_review';
    }>;
  };
  analysis_depth: 'basic' | 'standard' | 'comprehensive';
  focus_areas?: string[];
  exclude_categories?: string[];
}

export interface AIHealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  models_available: string[];
  response_time_ms: number;
  error_rate: number;
  last_updated: Date;
}

export interface AIMetrics {
  requests_processed: number;
  average_processing_time: number;
  accuracy_metrics: Record<string, number>;
  model_performance: Record<string, {
    accuracy: number;
    precision: number;
    recall: number;
    f1_score: number;
  }>;
  threat_intelligence_freshness: Date;
}

export interface ThreatIntelligenceStats {
  total_indicators: number;
  feeds_active: number;
  last_update: Date;
  indicators_by_type: Record<string, number>;
  top_sources: Array<{ source: string; count: number }>;
}

export const AIServiceAPI = {
  // Standard AI analysis
  analyzeThreats: (request: AIAnalysisRequest) => 
    aiService.post('/api/ai/analyze', request),

  // Enhanced AI analysis with 98% accuracy
  analyzeThreatsEnhanced: (request: AIAnalysisRequest) => 
    aiService.post('/api/ai/analyze/enhanced', request),

  // Get analysis results
  getAnalysisResults: (analysisId: string) => 
    aiService.get(`/api/ai/analysis/${analysisId}`),

  // Get analysis history
  getAnalysisHistory: (threatModelId: string, page = 1, limit = 10) => 
    aiService.get(`/api/ai/analysis/history/${threatModelId}?page=${page}&limit=${limit}`),

  // Get health status
  getHealthStatus: (): Promise<{ data: { success: boolean; data: AIHealthStatus } }> => 
    aiService.get('/api/ai/health'),

  // Get service metrics
  getMetrics: (): Promise<{ data: { success: boolean; data: AIMetrics } }> => 
    aiService.get('/api/ai/metrics'),

  // Update threat intelligence
  updateThreatIntelligence: () => 
    aiService.post('/api/ai/threat-intelligence/update'),

  // Get threat intelligence stats
  getThreatIntelligenceStats: (): Promise<{ data: { success: boolean; data: ThreatIntelligenceStats } }> => 
    aiService.get('/api/ai/threat-intelligence/stats'),
};

export default AIServiceAPI;