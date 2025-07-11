import apiClient from './api';

export interface Threat {
  id: string;
  threatModelId: string;
  name: string;
  description: string;
  category: string;
  status: string;
  likelihood: string;
  impact: string;
  riskLevel: string;
  affectedComponent?: string;
  affectedAssets?: string[];
  threatSources?: string[];
  prerequisites?: string[];
  metadata?: any;
  createdBy: string;
  assignedTo?: string;
  identifiedAt: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateThreatDto {
  name: string;
  description: string;
  threatModelId: string;
  category: string;
  likelihood: string;
  impact: string;
  affectedComponent?: string;
  affectedAssets?: string[];
  threatSources?: string[];
  prerequisites?: string[];
  status?: string;
  assignedTo?: string;
}

export interface UpdateThreatDto extends Partial<CreateThreatDto> {
  status?: string;
  resolvedAt?: string;
}

export const threatsApi = {
  getThreats: (params?: {
    projectId?: string;
    threatModelId?: string;
    status?: string;
    riskLevel?: string;
    limit?: number;
    offset?: number;
  }) => {
    return apiClient.get<{
      data: Threat[];
      total: number;
      limit: number;
      offset: number;
    }>('/api/threats', { params });
  },

  getThreatById: (id: string) => {
    return apiClient.get<{ data: Threat }>(`/api/threats/${id}`);
  },

  createThreat: (data: CreateThreatDto) => {
    return apiClient.post<{ data: Threat }>('/api/threats', data);
  },

  updateThreat: (id: string, data: UpdateThreatDto) => {
    return apiClient.put<{ data: Threat }>(`/api/threats/${id}`, data);
  },

  deleteThreat: (id: string) => {
    return apiClient.delete(`/api/threats/${id}`);
  },

  // Mitigation-related endpoints
  getMitigations: (threatId: string) => {
    return apiClient.get<{ data: any[] }>(`/api/threats/${threatId}/mitigations`);
  },

  createMitigation: (threatId: string, data: any) => {
    return apiClient.post<{ data: any }>(`/api/threats/${threatId}/mitigations`, data);
  },

  updateMitigation: (threatId: string, mitigationId: string, data: any) => {
    return apiClient.put<{ data: any }>(`/api/threats/${threatId}/mitigations/${mitigationId}`, data);
  },

  deleteMitigation: (threatId: string, mitigationId: string) => {
    return apiClient.delete(`/api/threats/${threatId}/mitigations/${mitigationId}`);
  },

  // AI-powered threat suggestions
  getSuggestedThreats: (threatModelId: string) => {
    return apiClient.get<{ data: any[] }>(`/api/threats/suggestions/${threatModelId}`);
  },

  // Bulk operations
  bulkUpdateStatus: (threatIds: string[], status: string) => {
    return apiClient.patch<{ data: { updated: number } }>('/api/threats/bulk/status', {
      threatIds,
      status
    });
  },

  bulkAssign: (threatIds: string[], assignedTo: string) => {
    return apiClient.patch<{ data: { updated: number } }>('/api/threats/bulk/assign', {
      threatIds,
      assignedTo
    });
  }
};