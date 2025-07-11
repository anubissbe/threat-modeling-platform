import apiClient from './api';

export interface ThreatModel {
  id: string;
  name: string;
  description?: string;
  projectId: string;
  methodology: string;
  version: string;
  status: string;
  scope?: any;
  assets?: any;
  dataFlows?: any;
  trustBoundaries?: any;
  entryPoints?: any;
  metadata?: any;
  createdBy: string;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateThreatModelDto {
  name: string;
  description?: string;
  projectId: string;
  methodology?: string;
  version?: string;
  status?: string;
}

export interface UpdateThreatModelDto extends Partial<CreateThreatModelDto> {
  scope?: any;
  assets?: any;
  dataFlows?: any;
  trustBoundaries?: any;
  entryPoints?: any;
  metadata?: any;
}

export const threatModelsApi = {
  getThreatModels: (params?: {
    projectId?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }) => {
    return apiClient.get<{
      data: ThreatModel[];
      total: number;
      limit: number;
      offset: number;
    }>('/api/threat-models', { params });
  },

  getThreatModelById: (id: string) => {
    return apiClient.get<{ data: ThreatModel }>(`/api/threat-models/${id}`);
  },

  createThreatModel: (data: CreateThreatModelDto) => {
    return apiClient.post<{ data: ThreatModel }>('/api/threat-models', data);
  },

  updateThreatModel: (id: string, data: UpdateThreatModelDto) => {
    return apiClient.put<{ data: ThreatModel }>(`/api/threat-models/${id}`, data);
  },

  deleteThreatModel: (id: string) => {
    return apiClient.delete(`/api/threat-models/${id}`);
  },

  publishThreatModel: (id: string) => {
    return apiClient.post<{ data: ThreatModel }>(`/api/threat-models/${id}/publish`);
  },

  cloneThreatModel: (id: string, data: { name: string; projectId?: string }) => {
    return apiClient.post<{ data: ThreatModel }>(`/api/threat-models/${id}/clone`, data);
  },

  validateThreatModel: (id: string) => {
    return apiClient.post<{ data: { valid: boolean; errors?: string[] } }>(`/api/threat-models/${id}/validate`);
  },

  exportThreatModel: (id: string, format: 'json' | 'pdf' | 'docx') => {
    return apiClient.get(`/api/threat-models/${id}/export`, {
      params: { format },
      responseType: 'blob'
    });
  }
};