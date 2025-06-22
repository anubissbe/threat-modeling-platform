import { useAppSelector } from '../store';

export const useRoleCheck = () => {
  const { user } = useAppSelector((state) => state.auth);

  const hasRole = (role: string): boolean => {
    return user?.roles?.includes(role) || false;
  };

  const hasAnyRole = (roles: string[]): boolean => {
    return roles.some(role => hasRole(role));
  };

  const hasAllRoles = (roles: string[]): boolean => {
    return roles.every(role => hasRole(role));
  };

  const isAdmin = (): boolean => {
    return hasRole('admin') || hasRole('super_admin');
  };

  const canManageUsers = (): boolean => {
    return hasAnyRole(['admin', 'super_admin', 'user_manager']);
  };

  const canManageProjects = (): boolean => {
    return hasAnyRole(['admin', 'super_admin', 'project_manager']);
  };

  const canViewReports = (): boolean => {
    return hasAnyRole(['admin', 'super_admin', 'analyst', 'viewer']);
  };

  return {
    hasRole,
    hasAnyRole,
    hasAllRoles,
    isAdmin,
    canManageUsers,
    canManageProjects,
    canViewReports,
    userRoles: user?.roles || [],
  };
};