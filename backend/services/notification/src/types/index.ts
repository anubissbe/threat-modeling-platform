import { Request } from 'express';

export type NotificationType = 'email' | 'slack' | 'teams' | 'sms' | 'webhook' | 'push';

export type NotificationStatus = 'pending' | 'sent' | 'failed' | 'cancelled' | 'scheduled';

export type NotificationPriority = 'low' | 'medium' | 'high' | 'urgent';

export type TemplateType = 
  | 'threat_model_created'
  | 'threat_model_updated'
  | 'threat_model_deleted'
  | 'threat_identified'
  | 'threat_mitigated'
  | 'collaboration_invited'
  | 'collaboration_mentioned'
  | 'report_generated'
  | 'system_maintenance'
  | 'custom';

export type SubscriptionFrequency = 'immediate' | 'daily' | 'weekly' | 'monthly' | 'never';

export interface BaseNotification {
  id: string;
  userId: string;
  type: NotificationType;
  channel: string;
  subject: string;
  message: string;
  htmlMessage?: string;
  metadata: Record<string, any>;
  status: NotificationStatus;
  priority: NotificationPriority;
  scheduledAt?: Date;
  sentAt?: Date;
  retryCount: number;
  maxRetries: number;
  errorMessage?: string;
  templateId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationTemplate {
  id: string;
  name: string;
  type: TemplateType;
  subject: string;
  body: string;
  htmlBody?: string;
  variables: Record<string, any>;
  isActive: boolean;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationPreference {
  id: string;
  userId: string;
  channel: NotificationType;
  enabled: boolean;
  frequency: SubscriptionFrequency;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  timezone: string;
  settings: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationSubscription {
  id: string;
  userId: string;
  eventType: string;
  channel: NotificationType;
  enabled: boolean;
  filterCriteria: Record<string, any>;
  settings: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationLog {
  id: string;
  notificationId: string;
  status: NotificationStatus;
  errorMessage?: string;
  responseData: Record<string, any>;
  attemptNumber: number;
  processingTimeMs?: number;
  createdAt: Date;
}

export interface NotificationChannel {
  id: string;
  organizationId: string;
  name: string;
  type: NotificationType;
  configuration: Record<string, any>;
  isActive: boolean;
  isDefault: boolean;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationQueue {
  id: string;
  notificationId: string;
  queueName: string;
  priority: number;
  maxAttempts: number;
  currentAttempt: number;
  nextRetryAt?: Date;
  processingStartedAt?: Date;
  processingCompletedAt?: Date;
  lockToken?: string;
  lockExpiresAt?: Date;
  createdAt: Date;
}

// Request/Response types
export interface SendNotificationRequest {
  userId: string;
  type: NotificationType;
  channel: string;
  subject: string;
  message: string;
  htmlMessage?: string;
  metadata?: Record<string, any>;
  priority?: NotificationPriority;
  templateId?: string;
  templateVariables?: Record<string, any>;
}

export interface ScheduleNotificationRequest extends SendNotificationRequest {
  scheduledAt: Date;
}

export interface CreateTemplateRequest {
  name: string;
  type: TemplateType;
  subject: string;
  body: string;
  htmlBody?: string;
  variables?: Record<string, any>;
}

export interface UpdateTemplateRequest extends Partial<CreateTemplateRequest> {
  isActive?: boolean;
}

export interface SetPreferencesRequest {
  userId: string;
  channel: NotificationType;
  enabled: boolean;
  frequency?: SubscriptionFrequency;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  timezone?: string;
  settings?: Record<string, any>;
}

export interface CreateSubscriptionRequest {
  userId: string;
  eventType: string;
  channel: NotificationType;
  enabled?: boolean;
  filterCriteria?: Record<string, any>;
  settings?: Record<string, any>;
}

export interface NotificationListResponse {
  notifications: BaseNotification[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface TemplateListResponse {
  templates: NotificationTemplate[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Event types
export interface NotificationEvent {
  type: string;
  userId: string;
  data: Record<string, any>;
  timestamp: Date;
}

export interface ThreatModelEvent extends NotificationEvent {
  type: 'threat_model_created' | 'threat_model_updated' | 'threat_model_deleted';
  data: {
    id: string;
    title: string;
    projectId: string;
    projectName: string;
    creatorId: string;
    creatorName: string;
    url: string;
  };
}

export interface ThreatEvent extends NotificationEvent {
  type: 'threat_identified' | 'threat_mitigated';
  data: {
    id: string;
    title: string;
    riskLevel: string;
    modelId: string;
    modelTitle: string;
    url: string;
  };
}

export interface CollaborationEvent extends NotificationEvent {
  type: 'collaboration_invited' | 'collaboration_mentioned';
  data: {
    projectId: string;
    projectName: string;
    modelId: string;
    modelTitle: string;
    inviterId: string;
    inviterName: string;
    url: string;
  };
}

export interface ReportEvent extends NotificationEvent {
  type: 'report_generated';
  data: {
    reportId: string;
    reportTitle: string;
    downloadUrl: string;
  };
}

export interface SystemEvent extends NotificationEvent {
  type: 'system_maintenance';
  data: {
    title: string;
    description: string;
    startTime: string;
    duration: string;
  };
}

// Provider interfaces
export interface NotificationProvider {
  type: NotificationType;
  send(notification: BaseNotification): Promise<void>;
  validateConfiguration(config: Record<string, any>): boolean;
}

export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: string;
}

export interface SlackConfig {
  botToken: string;
  signingSecret: string;
}

export interface TeamsConfig {
  webhookUrl: string;
}

export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  from: string;
}

export interface WebhookConfig {
  url: string;
  method: 'POST' | 'PUT' | 'PATCH';
  headers: Record<string, string>;
  timeout: number;
}

// Queue job types
export interface NotificationJob {
  id: string;
  notificationId: string;
  type: NotificationType;
  priority: number;
  attempts: number;
  maxAttempts: number;
  data: BaseNotification;
}

export interface RetryableError extends Error {
  retryable: boolean;
  retryAfter?: number;
}

// Middleware types
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    organizationId: string;
  };
}

export interface RateLimitConfig {
  windowMs: number;
  max: number;
  message: string;
  standardHeaders: boolean;
  legacyHeaders: boolean;
}

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: ValidationError[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Health check types
export interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: Date;
  details: {
    database: boolean;
    redis: boolean;
    providers: Record<NotificationType, boolean>;
  };
}

// Metrics types
export interface NotificationMetrics {
  total: number;
  sent: number;
  failed: number;
  pending: number;
  byType: Record<NotificationType, number>;
  byStatus: Record<NotificationStatus, number>;
  averageDeliveryTime: number;
  errorRate: number;
}

export interface SystemMetrics {
  notifications: NotificationMetrics;
  queues: {
    active: number;
    waiting: number;
    failed: number;
    completed: number;
  };
  performance: {
    avgResponseTime: number;
    throughput: number;
    errorRate: number;
  };
}