export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  organization_id: string;
  created_at: Date;
  updated_at: Date;
}

export enum UserRole {
  ADMIN = 'admin',
  SECURITY_LEAD = 'security_lead',
  DEVELOPER = 'developer',
  REVIEWER = 'reviewer',
  READ_ONLY = 'read_only'
}

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  organization_id: string;
}