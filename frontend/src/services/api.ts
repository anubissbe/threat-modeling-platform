import axios, { type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { store } from '@/store';
import { refreshTokens, clearAuth } from '@/store/slices/authSlice';
import { addNotification } from '@/store/slices/uiSlice';

// API base configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

// Create axios instance
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for token refresh
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Try to refresh the token
        await store.dispatch(refreshTokens()).unwrap();
        
        // Retry the original request with new token
        const newToken = localStorage.getItem('accessToken');
        if (newToken) {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return apiClient(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed, clear auth and redirect to login
        store.dispatch(clearAuth());
        store.dispatch(addNotification({
          type: 'error',
          title: 'Session Expired',
          message: 'Please log in again.',
        }));
        
        // Redirect to login if not already there
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
    }

    return Promise.reject(error);
  }
);

// API response interfaces
interface ApiResponse<T = any> {
  success: boolean;
  data: T;
  message?: string;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  organization: string;
  isActive: boolean;
  lastLogin?: string;
  createdAt: string;
  updatedAt: string;
}

// Auth API
export const authApi = {
  login: (credentials: { email: string; password: string }): Promise<ApiResponse<AuthTokens>> =>
    apiClient.post('/api/auth/login', credentials),

  register: (userData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    organization: string;
  }): Promise<ApiResponse<AuthTokens>> =>
    apiClient.post('/api/auth/register', userData),

  refreshToken: (data: { refreshToken: string }): Promise<ApiResponse<AuthTokens>> =>
    apiClient.post('/api/auth/refresh', data),

  logout: (data: { refreshToken: string }): Promise<ApiResponse<void>> =>
    apiClient.post('/api/auth/logout', data),

  logoutAll: (): Promise<ApiResponse<void>> =>
    apiClient.post('/api/auth/logout-all'),

  getProfile: (): Promise<ApiResponse<User>> =>
    apiClient.get('/api/auth/profile'),

  updateUserRole: (userId: string, role: string): Promise<ApiResponse<void>> =>
    apiClient.patch(`/api/auth/users/${userId}/role`, { role }),

  getUserById: (userId: string): Promise<ApiResponse<User>> =>
    apiClient.get(`/api/auth/users/${userId}`),
};

// Projects API (placeholder for future implementation)
export const projectsApi = {
  getProjects: (): Promise<ApiResponse<any[]>> =>
    apiClient.get('/api/projects'),

  getProject: (id: string): Promise<ApiResponse<any>> =>
    apiClient.get(`/api/projects/${id}`),

  createProject: (data: any): Promise<ApiResponse<any>> =>
    apiClient.post('/api/projects', data),

  updateProject: (id: string, data: any): Promise<ApiResponse<any>> =>
    apiClient.put(`/api/projects/${id}`, data),

  deleteProject: (id: string): Promise<ApiResponse<void>> =>
    apiClient.delete(`/api/projects/${id}`),
};

// Threat Models API (placeholder for future implementation)
export const threatModelsApi = {
  getThreatModels: (projectId?: string): Promise<ApiResponse<any[]>> =>
    apiClient.get('/api/threat-models', { params: { projectId } }),

  getThreatModel: (id: string): Promise<ApiResponse<any>> =>
    apiClient.get(`/api/threat-models/${id}`),

  createThreatModel: (data: any): Promise<ApiResponse<any>> =>
    apiClient.post('/api/threat-models', data),

  updateThreatModel: (id: string, data: any): Promise<ApiResponse<any>> =>
    apiClient.put(`/api/threat-models/${id}`, data),

  deleteThreatModel: (id: string): Promise<ApiResponse<void>> =>
    apiClient.delete(`/api/threat-models/${id}`),
};

// Export the configured axios instance for custom requests
export default apiClient;