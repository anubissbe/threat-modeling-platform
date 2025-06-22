// User types
export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
  organizationId?: string;
  roles: Role[];
  permissions: string[];
  isActive: boolean;
  emailVerified: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export interface CreateUserDto {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  organizationId?: string;
  roles?: string[];
}

export interface UpdateUserDto {
  firstName?: string;
  lastName?: string;
  avatar?: string;
  isActive?: boolean;
}

// Organization types
export interface Organization {
  id: string;
  name: string;
  slug: string;
  description?: string;
  logo?: string;
  website?: string;
  industry?: string;
  size?: string;
  settings: OrganizationSettings;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export interface OrganizationSettings {
  maxUsers?: number;
  maxProjects?: number;
  features: string[];
  ssoEnabled: boolean;
  mfaRequired: boolean;
}

export interface CreateOrganizationDto {
  name: string;
  description?: string;
  website?: string;
  industry?: string;
  size?: string;
}

export interface UpdateOrganizationDto {
  name?: string;
  description?: string;
  logo?: string;
  website?: string;
  industry?: string;
  size?: string;
  settings?: Partial<OrganizationSettings>;
}

// Team types
export interface Team {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  permissions: string[];
  memberCount?: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export interface CreateTeamDto {
  organizationId: string;
  name: string;
  description?: string;
  permissions?: string[];
}

export interface UpdateTeamDto {
  name?: string;
  description?: string;
  permissions?: string[];
}

export interface TeamMember {
  userId: string;
  teamId: string;
  role: 'member' | 'lead' | 'admin';
  joinedAt: Date;
}

// Role types
export interface Role {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  permissions: Permission[];
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateRoleDto {
  name: string;
  displayName: string;
  description?: string;
  permissions: string[];
}

export interface UpdateRoleDto {
  displayName?: string;
  description?: string;
  permissions?: string[];
}

// Permission types
export interface Permission {
  id: string;
  name: string;
  resource: string;
  action: string;
  description?: string;
  isSystem: boolean;
  createdAt: Date;
}

export interface PermissionCheck {
  userId: string;
  permission: string;
  resourceId?: string;
  organizationId?: string;
}

// Audit types
export interface AuditLog {
  id: string;
  userId: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  changes?: any;
  metadata?: any;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

// Pagination types
export interface PaginationParams {
  page?: number;
  pageSize?: number;
  orderBy?: string;
  orderDirection?: 'ASC' | 'DESC';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

// Filter types
export interface UserFilters {
  organizationId?: string;
  teamId?: string;
  roleId?: string;
  isActive?: boolean;
  emailVerified?: boolean;
  search?: string;
}

export interface OrganizationFilters {
  industry?: string;
  size?: string;
  search?: string;
}

export interface TeamFilters {
  organizationId?: string;
  userId?: string;
  search?: string;
}

// Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface ErrorResponse {
  error: string;
  message: string;
  statusCode: number;
  details?: any;
}