import apiClient from './api';

export interface RiskAssessment {
  id: string;
  projectId: string;
  projectName: string;
  overallRisk: 'Critical' | 'High' | 'Medium' | 'Low';
  score: number;
  status: 'pending' | 'in_progress' | 'completed';
  assessmentType: 'automated' | 'manual';
  vulnerabilities: any[];
  threats: any[];
  recommendations: any[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateAssessmentDto {
  projectId: string;
  assessmentType: 'automated' | 'manual';
}

export const riskAssessmentApi = {
  getAssessments: (params?: {
    projectId?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }) => {
    return apiClient.get<{
      data: RiskAssessment[];
      total: number;
      limit: number;
      offset: number;
    }>('/api/risk-assessments', { params });
  },

  getAssessmentById: (id: string) => {
    return apiClient.get<{ data: RiskAssessment }>(`/api/risk-assessments/${id}`);
  },

  createAssessment: (data: CreateAssessmentDto) => {
    return apiClient.post<{ data: RiskAssessment }>('/api/risk-assessments', data);
  },

  refreshAssessment: (id: string) => {
    return apiClient.post<{ data: RiskAssessment }>(`/api/risk-assessments/${id}/refresh`);
  },

  getStatistics: (projectId?: string) => {
    return apiClient.get<{ data: any }>('/api/risk-assessments/statistics/overview', {
      params: projectId ? { projectId } : undefined,
    });
  },
};