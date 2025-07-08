export enum IntegrationProvider {
  JIRA = 'jira',
  GITHUB = 'github',
  GITLAB = 'gitlab',
  AZURE_DEVOPS = 'azure_devops',
}

export enum IntegrationStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ERROR = 'error',
}

export interface Integration {
  id: string;
  name: string;
  provider: IntegrationProvider;
  config: IntegrationConfig;
  credentials: string; // Encrypted
  status: IntegrationStatus;
  lastSyncAt?: Date;
  syncFrequencyMinutes: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IntegrationConfig {
  // Common fields
  baseUrl: string;
  webhookUrl?: string;
  
  // Provider-specific fields
  [key: string]: any;
}

export interface JiraConfig extends IntegrationConfig {
  projectKey: string;
  issueTypeId?: string;
  customFields?: Record<string, any>;
}

export interface GitHubConfig extends IntegrationConfig {
  owner: string;
  repo: string;
  labels?: string[];
}

export interface GitLabConfig extends IntegrationConfig {
  projectId: string | number;
  labels?: string[];
}

export interface AzureDevOpsConfig extends IntegrationConfig {
  organization: string;
  project: string;
  workItemType?: string;
}

export interface IntegrationCredentials {
  // Common fields
  type: 'basic' | 'token' | 'oauth2';
  
  // Type-specific fields
  [key: string]: any;
}

export interface BasicCredentials extends IntegrationCredentials {
  type: 'basic';
  username: string;
  password: string;
}

export interface TokenCredentials extends IntegrationCredentials {
  type: 'token';
  token: string;
}

export interface OAuth2Credentials extends IntegrationCredentials {
  type: 'oauth2';
  clientId: string;
  clientSecret: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
}

export interface IntegrationMapping {
  id: string;
  integrationId: string;
  threatModelId: string;
  externalId: string;
  externalUrl?: string;
  provider: IntegrationProvider;
  mappingType: 'threat_model' | 'threat' | 'component';
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface IntegrationLog {
  id: string;
  integrationId: string;
  action: string;
  status: 'success' | 'failure' | 'pending';
  details?: Record<string, any>;
  errorMessage?: string;
  startedAt: Date;
  completedAt?: Date;
  createdAt: Date;
}

export interface WebhookEvent {
  id: string;
  integrationId?: string;
  provider: IntegrationProvider;
  eventType: string;
  payload: any;
  signature?: string;
  processed: boolean;
  processedAt?: Date;
  errorMessage?: string;
  createdAt: Date;
}

export interface SyncResult {
  success: boolean;
  itemsSynced: number;
  itemsFailed: number;
  errors: Array<{
    item: string;
    error: string;
  }>;
  duration: number;
}

export interface ExternalItem {
  id: string;
  title: string;
  description?: string;
  status: string;
  url: string;
  metadata?: Record<string, any>;
  createdAt?: Date;
  updatedAt?: Date;
}

// Request/Response types
export interface CreateIntegrationRequest {
  name: string;
  provider: IntegrationProvider;
  config: IntegrationConfig;
  credentials: IntegrationCredentials;
  syncFrequencyMinutes?: number;
}

export interface UpdateIntegrationRequest {
  name?: string;
  config?: IntegrationConfig;
  credentials?: IntegrationCredentials;
  status?: IntegrationStatus;
  syncFrequencyMinutes?: number;
}

export interface ConnectIntegrationRequest {
  provider: IntegrationProvider;
  config: IntegrationConfig;
  credentials: IntegrationCredentials;
}

export interface TestConnectionResponse {
  success: boolean;
  message: string;
  details?: any;
}

export interface SyncRequest {
  threatModelIds?: string[];
  force?: boolean;
}

export interface WebhookPayload {
  provider: IntegrationProvider;
  event: string;
  data: any;
  timestamp: Date;
}