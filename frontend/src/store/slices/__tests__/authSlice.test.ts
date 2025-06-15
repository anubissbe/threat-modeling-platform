import { describe, it, expect, beforeEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import authReducer, { clearError, setUser, clearAuth, type User } from '../authSlice';

const mockUser: User = {
  id: '1',
  email: 'test@example.com',
  firstName: 'John',
  lastName: 'Doe',
  role: 'developer',
  organization: 'Test Org',
  isActive: true,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

describe('authSlice', () => {
  let store: ReturnType<typeof configureStore>;

  beforeEach(() => {
    store = configureStore({
      reducer: {
        auth: authReducer,
      },
    });
  });

  it('should handle clearError', () => {
    // Set initial error
    store.dispatch(clearAuth());
    
    // Clear error
    store.dispatch(clearError());
    
    const state = store.getState().auth;
    expect(state.error).toBeNull();
  });

  it('should handle setUser', () => {
    store.dispatch(setUser(mockUser));
    
    const state = store.getState().auth;
    expect(state.user).toEqual(mockUser);
  });

  it('should handle clearAuth', () => {
    // Set some initial state
    store.dispatch(setUser(mockUser));
    
    // Clear auth
    store.dispatch(clearAuth());
    
    const state = store.getState().auth;
    expect(state.user).toBeNull();
    expect(state.tokens).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.error).toBeNull();
  });

  it('should have correct initial state', () => {
    const state = store.getState().auth;
    
    expect(state.user).toBeNull();
    expect(state.tokens).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
    expect(state.isInitialized).toBe(false);
  });
});