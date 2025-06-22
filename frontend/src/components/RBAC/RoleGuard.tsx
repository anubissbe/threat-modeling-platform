import React from 'react';
import { Alert } from '@mui/material';
import { useAppSelector } from '../../store';

interface RoleGuardProps {
  requiredRoles: string[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
  mode?: 'any' | 'all'; // 'any' = user needs at least one role, 'all' = user needs all roles
}

export const RoleGuard: React.FC<RoleGuardProps> = ({
  requiredRoles,
  children,
  fallback,
  mode = 'any',
}) => {
  const { user } = useAppSelector((state) => state.auth);

  if (!user) {
    return fallback || (
      <Alert severity="error">
        Authentication required
      </Alert>
    );
  }

  const userRoles = user.roles || [];
  const hasAccess = mode === 'any'
    ? requiredRoles.some(role => userRoles.includes(role))
    : requiredRoles.every(role => userRoles.includes(role));

  if (!hasAccess) {
    return fallback || (
      <Alert severity="warning">
        You don't have permission to access this content. Required role(s): {requiredRoles.join(', ')}
      </Alert>
    );
  }

  return <>{children}</>;
};

