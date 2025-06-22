import { apiClient } from './api';

interface LoginCredentials {
  email: string;
  password: string;
}

interface LoginResponse {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    organization?: string;
  };
  token: string;
  refreshToken: string;
}

class AuthService {
  async login(credentials: LoginCredentials) {
    return apiClient.post<LoginResponse>('/auth/login', credentials);
  }

  async logout() {
    return apiClient.post('/auth/logout');
  }

  async refreshToken() {
    return apiClient.post('/auth/refresh');
  }

  async getCurrentUser() {
    return apiClient.get<{
      id: string;
      email: string;
      name: string;
      role: string;
      organization?: string;
    }>('/auth/me');
  }

  async register(userData: {
    email: string;
    password: string;
    name: string;
    organization?: string;
  }) {
    return apiClient.post('/auth/register', userData);
  }

  async forgotPassword(email: string) {
    return apiClient.post('/auth/forgot-password', { email });
  }

  async resetPassword(token: string, password: string) {
    return apiClient.post('/auth/reset-password', { token, password });
  }
}

export default new AuthService();