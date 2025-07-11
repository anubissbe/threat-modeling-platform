import apiClient from './api';

export interface Project {
  id: string;
  name: string;
  description?: string;
  type: string;
  riskLevel: string;
  status: string;
  organizationId: string;
  metadata?: any;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectDto {
  name: string;
  description?: string;
  type: string;
  riskLevel?: string;
  status?: string;
}

export interface UpdateProjectDto extends Partial<CreateProjectDto> {
  metadata?: any;
}

export const projectsApi = {
  getProjects: (params?: {
    limit?: number;
    offset?: number;
    search?: string;
    status?: string;
    type?: string;
  }) => {
    return apiClient.get<{
      data: Project[];
      total: number;
      limit: number;
      offset: number;
    }>('/api/projects', { params });
  },

  getProjectById: (id: string) => {
    return apiClient.get<{ data: Project }>(`/api/projects/${id}`);
  },

  createProject: (data: CreateProjectDto) => {
    return apiClient.post<{ data: Project }>('/api/projects', data);
  },

  updateProject: (id: string, data: UpdateProjectDto) => {
    return apiClient.put<{ data: Project }>(`/api/projects/${id}`, data);
  },

  deleteProject: (id: string) => {
    return apiClient.delete(`/api/projects/${id}`);
  },

  getProjectStatistics: (id: string) => {
    return apiClient.get<{
      data: {
        threatModels: number;
        threats: number;
        vulnerabilities: number;
        riskAssessments: number;
        lastActivity: string;
      }
    }>(`/api/projects/${id}/statistics`);
  },

  getProjectActivity: (id: string, params?: { limit?: number; offset?: number }) => {
    return apiClient.get<{
      data: any[];
      total: number;
    }>(`/api/projects/${id}/activity`, { params });
  }
};