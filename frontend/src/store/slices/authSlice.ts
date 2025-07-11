import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';
import { authApi, setAuthToken } from '@/services/api';
import { debugAuth } from '@/utils/auth-debug';

export interface User {
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

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  organization: string;
}

interface AuthState {
  user: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  isInitialized: boolean;
}

const initialState: AuthState = {
  user: null,
  tokens: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  isInitialized: false,
};

// Async thunks
export const login = createAsyncThunk(
  'auth/login',
  async (credentials: LoginRequest, { rejectWithValue }) => {
    try {
      const loginResponse = await authApi.login(credentials);
      
      // Validate response
      if (!loginResponse.data?.accessToken || !loginResponse.data?.refreshToken) {
        throw new Error('Invalid login response - missing tokens');
      }
      
      // Store tokens in localStorage
      localStorage.setItem('accessToken', loginResponse.data.accessToken);
      localStorage.setItem('refreshToken', loginResponse.data.refreshToken);
      
      // Debug token storage
      console.log('[AUTH] Tokens stored in localStorage:', {
        accessToken: loginResponse.data.accessToken.substring(0, 50) + '...',
        refreshToken: loginResponse.data.refreshToken.substring(0, 50) + '...'
      });
      debugAuth.checkToken();
      
      // Set token in axios immediately
      setAuthToken(loginResponse.data.accessToken);
      
      // Now fetch profile with the token already set
      const profileResponse = await authApi.getProfile();
      
      return {
        tokens: loginResponse.data,
        user: profileResponse.data,
      };
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Login failed');
    }
  }
);

export const register = createAsyncThunk(
  'auth/register',
  async (userData: RegisterRequest, { rejectWithValue }) => {
    try {
      const response = await authApi.register(userData);
      
      // Store tokens in localStorage
      localStorage.setItem('accessToken', response.data.accessToken);
      localStorage.setItem('refreshToken', response.data.refreshToken);
      
      // Set token in axios immediately
      setAuthToken(response.data.accessToken);
      
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Registration failed');
    }
  }
);

export const getProfile = createAsyncThunk(
  'auth/getProfile',
  async (_, { rejectWithValue }) => {
    try {
      const response = await authApi.getProfile();
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to get profile');
    }
  }
);

export const refreshTokens = createAsyncThunk(
  'auth/refreshTokens',
  async (_, { rejectWithValue }) => {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await authApi.refreshToken({ refreshToken });
      
      // Update tokens in localStorage
      localStorage.setItem('accessToken', response.data.accessToken);
      localStorage.setItem('refreshToken', response.data.refreshToken);
      
      // Set the new token in axios immediately
      setAuthToken(response.data.accessToken);
      
      return response.data;
    } catch (error: any) {
      // Clear tokens on refresh failure
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      return rejectWithValue(error.response?.data?.error || 'Token refresh failed');
    }
  }
);

export const logout = createAsyncThunk(
  'auth/logout',
  async (_, { rejectWithValue }) => {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        await authApi.logout({ refreshToken });
      }
    } catch (error) {
      // Continue with logout even if API call fails
      console.warn('Logout API call failed:', error);
    } finally {
      // Always clear tokens
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      setAuthToken(null);
    }
  }
);

export const initializeAuth = createAsyncThunk(
  'auth/initialize',
  async (_, { rejectWithValue }) => {
    // Check for stored tokens
    const accessToken = localStorage.getItem('accessToken');
    const refreshToken = localStorage.getItem('refreshToken');
    
    if (!accessToken || !refreshToken) {
      return rejectWithValue('No tokens found');
    }
    
    // Set token in axios before making requests
    setAuthToken(accessToken);
    
    // Check if access token is expired
    try {
      const tokenPayload = JSON.parse(atob(accessToken.split('.')[1]));
      const currentTime = Date.now() / 1000;
      
      // If token is expired or expires within 5 minutes, refresh it
      if (tokenPayload.exp <= currentTime + 300) {
        console.log('Access token expired or expiring soon, refreshing...');
        
        try {
          const refreshResponse = await authApi.refreshToken({ refreshToken });
          const newTokens = refreshResponse.data;
          
          // Update tokens in localStorage
          localStorage.setItem('accessToken', newTokens.accessToken);
          localStorage.setItem('refreshToken', newTokens.refreshToken);
          
          // Set new token in axios
          setAuthToken(newTokens.accessToken);
          
          // Get user profile with new token
          const profileResponse = await authApi.getProfile();
          return {
            user: profileResponse.data,
            tokens: newTokens,
          };
        } catch (refreshError: any) {
          console.error('Token refresh failed:', refreshError);
          // Clear tokens and reject
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          return rejectWithValue('Token refresh failed');
        }
      }
      
      // Token is still valid, get profile
      const response = await authApi.getProfile();
      return {
        user: response.data,
        tokens: {
          accessToken,
          refreshToken,
          expiresIn: tokenPayload.exp - currentTime,
        },
      };
    } catch (error: any) {
      console.error('Error during authentication initialization:', error);
      
      // Try refreshing token if profile request failed
      try {
        const refreshResponse = await authApi.refreshToken({ refreshToken });
        const newTokens = refreshResponse.data;
        
        // Update tokens in localStorage
        localStorage.setItem('accessToken', newTokens.accessToken);
        localStorage.setItem('refreshToken', newTokens.refreshToken);
        
        // Set new token in axios
        setAuthToken(newTokens.accessToken);
        
        // Get user profile with new token
        const profileResponse = await authApi.getProfile();
        return {
          user: profileResponse.data,
          tokens: newTokens,
        };
      } catch (refreshError: any) {
        console.error('Token refresh failed during recovery:', refreshError);
        // Clear tokens and reject
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        return rejectWithValue('Authentication session expired');
      }
    }
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    setUser: (state, action: PayloadAction<User>) => {
      state.user = action.payload;
    },
    clearAuth: (state) => {
      state.user = null;
      state.tokens = null;
      state.isAuthenticated = false;
      state.error = null;
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      setAuthToken(null);
    },
  },
  extraReducers: (builder) => {
    // Login
    builder
      .addCase(login.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.isLoading = false;
        state.tokens = action.payload.tokens;
        state.user = action.payload.user;
        state.isAuthenticated = true;
        state.error = null;
      })
      .addCase(login.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
        state.isAuthenticated = false;
      });

    // Register
    builder
      .addCase(register.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(register.fulfilled, (state, action) => {
        state.isLoading = false;
        state.tokens = action.payload;
        state.isAuthenticated = true;
        state.error = null;
      })
      .addCase(register.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
        state.isAuthenticated = false;
      });

    // Get Profile
    builder
      .addCase(getProfile.fulfilled, (state, action) => {
        state.user = action.payload;
      })
      .addCase(getProfile.rejected, (state, action) => {
        state.error = action.payload as string;
      });

    // Refresh Tokens
    builder
      .addCase(refreshTokens.fulfilled, (state, action) => {
        state.tokens = action.payload;
        state.isAuthenticated = true;
      })
      .addCase(refreshTokens.rejected, (state) => {
        state.user = null;
        state.tokens = null;
        state.isAuthenticated = false;
      });

    // Logout
    builder.addCase(logout.fulfilled, (state) => {
      state.user = null;
      state.tokens = null;
      state.isAuthenticated = false;
      state.error = null;
    });

    // Initialize
    builder
      .addCase(initializeAuth.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(initializeAuth.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.user;
        state.tokens = action.payload.tokens;
        state.isAuthenticated = true;
        state.isInitialized = true;
      })
      .addCase(initializeAuth.rejected, (state) => {
        state.isLoading = false;
        state.isAuthenticated = false;
        state.isInitialized = true;
      });
  },
});

export const { clearError, setUser, clearAuth } = authSlice.actions;
export default authSlice.reducer;