export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  organization: string;
  isActive: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export enum UserRole {
  ADMIN = 'admin',
  SECURITY_ANALYST = 'security_analyst',
  ARCHITECT = 'architect',
  DEVELOPER = 'developer',
  VIEWER = 'viewer'
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

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface SSOConfig {
  provider: 'saml' | 'oauth2' | 'oidc';
  entityId: string;
  ssoUrl: string;
  x509Certificate: string;
  attributeMapping: {
    email: string;
    firstName: string;
    lastName: string;
    role?: string;
  };
}

export interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
  organization: string;
  iat: number;
  exp: number;
}