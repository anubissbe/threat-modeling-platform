import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Box, CircularProgress, Typography } from '@mui/material';
import { useAppDispatch, useAppSelector } from '@/store';
import { initializeAuth } from '@/store/slices/authSlice';

interface ProtectedRouteProps {
  children: React.ReactNode;
  roles?: string[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  roles = [] 
}) => {
  const dispatch = useAppDispatch();
  const location = useLocation();
  const { isAuthenticated, user, isLoading, isInitialized } = useAppSelector(
    (state) => state.auth
  );

  useEffect(() => {
    if (!isInitialized) {
      dispatch(initializeAuth());
    }
  }, [dispatch, isInitialized]);

  // Show loading while initializing authentication
  if (!isInitialized || isLoading) {
    return (
      <Box 
        className="flex-center full-height"
        sx={{ flexDirection: 'column', gap: 2 }}
      >
        <CircularProgress size={40} />
        <Typography variant="body2" color="text.secondary">
          Initializing...
        </Typography>
      </Box>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check role-based access
  if (roles.length > 0 && user) {
    const hasRequiredRole = roles.includes(user.role);
    if (!hasRequiredRole) {
      return (
        <Box className="flex-center full-height">
          <Box sx={{ textAlign: 'center', maxWidth: 400 }}>
            <Typography variant="h5" gutterBottom>
              Access Denied
            </Typography>
            <Typography variant="body1" color="text.secondary">
              You don't have permission to access this page.
            </Typography>
            <Typography variant="body2" sx={{ mt: 2 }}>
              Required roles: {roles.join(', ')}
            </Typography>
            <Typography variant="body2">
              Your role: {user.role}
            </Typography>
          </Box>
        </Box>
      );
    }
  }

  return <>{children}</>;
};