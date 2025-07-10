import axios, { type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { store } from '@/store';
import { refreshTokens, clearAuth } from '@/store/slices/authSlice';

// API base configuration with runtime config fallback
const getApiBaseUrl = (): string => {
  // Check runtime config injected by Docker
  if (typeof window !== 'undefined' && window.APP_CONFIG?.API_BASE_URL) {
    return window.APP_CONFIG.API_BASE_URL;
  }
  
  // Fallback to default
  return 'http://localhost:3000';
};

const API_BASE_URL = getApiBaseUrl();

// Create axios instance
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Helper to set auth token immediately
export const setAuthToken = (token: string | null) => {
  if (token) {
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    console.log('[API] Token set in axios defaults');
  } else {
    delete apiClient.defaults.headers.common['Authorization'];
    console.log('[API] Token removed from axios defaults');
  }
};

// Request interceptor to add auth token from localStorage as fallback
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Debug logging
    console.log('[API] Request interceptor:', {
      url: config.url,
      hasAuthHeader: !!config.headers.Authorization,
      authHeader: config.headers.Authorization ? String(config.headers.Authorization).substring(0, 50) + '...' : 'none'
    });
    
    // Only add from localStorage if not already set
    if (!config.headers.Authorization) {
      const token = localStorage.getItem('accessToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
        console.log('[API] Added token from localStorage');
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Track refresh attempts to prevent infinite loops
let isRefreshing = false;
let refreshAttempts = 0;
const MAX_REFRESH_ATTEMPTS = 1;

// Response interceptor for token refresh
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    // Reset refresh attempts on successful request
    refreshAttempts = 0;
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    console.log('[API] Response error:', {
      status: error.response?.status,
      url: originalRequest.url,
      message: error.response?.data?.message
    });

    // Don't retry auth endpoints to prevent loops
    if (originalRequest.url?.includes('/auth/')) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !originalRequest._retry && refreshAttempts < MAX_REFRESH_ATTEMPTS) {
      originalRequest._retry = true;

      // Prevent multiple simultaneous refresh attempts
      if (!isRefreshing) {
        isRefreshing = true;
        refreshAttempts++;

        try {
          await store.dispatch(refreshTokens()).unwrap();
          isRefreshing = false;
          
          // Retry the original request with new token
          const token = localStorage.getItem('accessToken');
          if (token) {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return apiClient(originalRequest);
          }
        } catch (refreshError) {
          isRefreshing = false;
          refreshAttempts = 0;
          
          // Clear auth and redirect to login
          store.dispatch(clearAuth());
          
          // Only redirect if not already on login page
          if (window.location.pathname !== '/login') {
            window.location.href = '/login';
          }
          
          return Promise.reject(refreshError);
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

// Export axios instance for direct use if needed
export default apiClient;