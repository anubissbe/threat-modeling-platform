export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  organizationId?: string;
  preferences?: NotificationPreferences;
}

export enum NotificationType {
  EMAIL = 'email',
  SMS = 'sms',
  SLACK = 'slack',
  WEBHOOK = 'webhook',
  IN_APP = 'in-app',
}

export enum NotificationChannel {
  EMAIL = 'email',
  SMS = 'sms',
  SLACK = 'slack',
  WEBHOOK = 'webhook',
  PUSH = 'push',
}

export enum NotificationPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
}

export enum NotificationStatus {
  PENDING = 'pending',
  QUEUED = 'queued',
  SENDING = 'sending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  FAILED = 'failed',
  BOUNCED = 'bounced',
  UNSUBSCRIBED = 'unsubscribed',
}

export enum NotificationEvent {
  // Threat Model Events
  THREAT_MODEL_CREATED = 'threat-model.created',
  THREAT_MODEL_UPDATED = 'threat-model.updated',
  THREAT_MODEL_REVIEWED = 'threat-model.reviewed',
  THREAT_MODEL_APPROVED = 'threat-model.approved',
  THREAT_MODEL_REJECTED = 'threat-model.rejected',
  
  // Threat Events
  THREAT_IDENTIFIED = 'threat.identified',
  THREAT_MITIGATED = 'threat.mitigated',
  THREAT_ACCEPTED = 'threat.accepted',
  CRITICAL_THREAT_FOUND = 'threat.critical',
  
  // Report Events
  REPORT_GENERATED = 'report.generated',
  REPORT_FAILED = 'report.failed',
  REPORT_SHARED = 'report.shared',
  
  // User Events
  USER_INVITED = 'user.invited',
  USER_ACTIVATED = 'user.activated',
  USER_PASSWORD_RESET = 'user.password-reset',
  USER_MFA_ENABLED = 'user.mfa-enabled',
  
  // Project Events
  PROJECT_CREATED = 'project.created',
  PROJECT_MEMBER_ADDED = 'project.member-added',
  PROJECT_MEMBER_REMOVED = 'project.member-removed',
  PROJECT_ROLE_CHANGED = 'project.role-changed',
  
  // System Events
  SYSTEM_MAINTENANCE = 'system.maintenance',
  SYSTEM_UPDATE = 'system.update',
  SYSTEM_ALERT = 'system.alert',
}

export interface NotificationRequest {
  id?: string;
  type: NotificationType;
  channel?: NotificationChannel;
  recipient: NotificationRecipient;
  template: string;
  data: Record<string, any>;
  priority?: NotificationPriority;
  event?: NotificationEvent;
  metadata?: NotificationMetadata;
  options?: NotificationOptions;
  scheduledFor?: Date;
}

export interface NotificationRecipient {
  userId?: string;
  email?: string;
  phone?: string;
  slackChannel?: string;
  slackUserId?: string;
  webhookUrl?: string;
  name?: string;
  preferences?: NotificationPreferences;
}

export interface NotificationMetadata {
  projectId?: string;
  threatModelId?: string;
  reportId?: string;
  organizationId?: string;
  correlationId?: string;
  source?: string;
  tags?: string[];
}

export interface NotificationOptions {
  retryAttempts?: number;
  retryDelay?: number;
  ttl?: number;
  deduplicationKey?: string;
  groupKey?: string;
  attachments?: NotificationAttachment[];
  replyTo?: string;
  cc?: string[];
  bcc?: string[];
}

export interface NotificationAttachment {
  filename: string;
  content?: string | Buffer;
  path?: string;
  contentType?: string;
  encoding?: string;
}

export interface Notification {
  id: string;
  type: NotificationType;
  channel: NotificationChannel;
  recipient: NotificationRecipient;
  subject?: string;
  content: NotificationContent;
  status: NotificationStatus;
  priority: NotificationPriority;
  event?: NotificationEvent;
  attempts: number;
  lastAttempt?: Date;
  deliveredAt?: Date;
  failureReason?: string;
  metadata?: NotificationMetadata;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
}

export interface NotificationContent {
  subject?: string;
  text: string;
  html?: string;
  templateData?: Record<string, any>;
  actions?: NotificationAction[];
}

export interface NotificationAction {
  label: string;
  url: string;
  style?: 'primary' | 'secondary' | 'danger';
}

export interface NotificationTemplate {
  id: string;
  name: string;
  type: NotificationType;
  channel: NotificationChannel;
  subject?: string;
  template: string;
  variables: TemplateVariable[];
  active: boolean;
  version: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TemplateVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object';
  required: boolean;
  default?: any;
  description?: string;
}

export interface NotificationPreferences {
  email: ChannelPreferences;
  sms: ChannelPreferences;
  slack: ChannelPreferences;
  push: ChannelPreferences;
  webhook: ChannelPreferences;
  timezone?: string;
  language?: string;
  quietHours?: QuietHours;
}

export interface ChannelPreferences {
  enabled: boolean;
  events: Record<NotificationEvent, boolean>;
  frequency?: 'immediate' | 'hourly' | 'daily' | 'weekly';
  grouping?: boolean;
}

export interface QuietHours {
  enabled: boolean;
  start: string; // HH:mm format
  end: string; // HH:mm format
  timezone: string;
  daysOfWeek?: number[]; // 0-6, where 0 is Sunday
}

export interface EmailProvider {
  send(notification: EmailNotification): Promise<EmailResult>;
  verifyConnection(): Promise<boolean>;
}

export interface EmailNotification {
  to: string | string[];
  from: string;
  subject: string;
  text: string;
  html?: string;
  cc?: string[];
  bcc?: string[];
  replyTo?: string;
  attachments?: NotificationAttachment[];
  headers?: Record<string, string>;
}

export interface EmailResult {
  messageId: string;
  accepted: string[];
  rejected: string[];
  response?: string;
}

export interface SMSProvider {
  send(notification: SMSNotification): Promise<SMSResult>;
  verifyConnection(): Promise<boolean>;
}

export interface SMSNotification {
  to: string;
  from?: string;
  body: string;
  mediaUrl?: string[];
}

export interface SMSResult {
  messageId: string;
  status: string;
  errorCode?: string;
  errorMessage?: string;
}

export interface SlackProvider {
  send(notification: SlackNotification): Promise<SlackResult>;
  verifyConnection(): Promise<boolean>;
}

export interface SlackNotification {
  channel?: string;
  username?: string;
  text: string;
  blocks?: any[];
  attachments?: any[];
  iconEmoji?: string;
  iconUrl?: string;
}

export interface SlackResult {
  ok: boolean;
  ts?: string;
  channel?: string;
  error?: string;
}

export interface WebhookProvider {
  send(notification: WebhookNotification): Promise<WebhookResult>;
}

export interface WebhookNotification {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH';
  headers?: Record<string, string>;
  body: any;
  timeout?: number;
  retries?: number;
}

export interface WebhookResult {
  status: number;
  statusText: string;
  data?: any;
  headers?: Record<string, string>;
}

export interface NotificationQueue {
  add(notification: NotificationRequest, options?: QueueOptions): Promise<string>;
  process(handler: NotificationHandler): void;
  getJob(jobId: string): Promise<NotificationJob | null>;
  getJobs(status: NotificationStatus, limit?: number): Promise<NotificationJob[]>;
  retry(jobId: string): Promise<boolean>;
  remove(jobId: string): Promise<boolean>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  getStats(): Promise<QueueStats>;
}

export interface QueueOptions {
  priority?: number;
  delay?: number;
  attempts?: number;
  backoff?: {
    type: 'fixed' | 'exponential';
    delay: number;
  };
  removeOnComplete?: boolean;
  removeOnFail?: boolean;
}

export interface NotificationJob {
  id: string;
  data: NotificationRequest;
  status: NotificationStatus;
  progress: number;
  attempts: number;
  result?: any;
  error?: string;
  createdAt: Date;
  processedAt?: Date;
  completedAt?: Date;
  failedAt?: Date;
}

export interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
}

export type NotificationHandler = (
  notification: NotificationRequest
) => Promise<NotificationResult>;

export interface NotificationResult {
  success: boolean;
  notification?: Notification;
  error?: string;
  details?: any;
}

export interface NotificationHistory {
  id: string;
  notificationId: string;
  status: NotificationStatus;
  attempt: number;
  timestamp: Date;
  details?: string;
  error?: string;
}

export interface NotificationSubscription {
  id: string;
  userId: string;
  channel: NotificationChannel;
  event: NotificationEvent;
  enabled: boolean;
  filters?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationBatch {
  id: string;
  notifications: NotificationRequest[];
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  total: number;
  succeeded: number;
  failed: number;
  createdAt: Date;
  completedAt?: Date;
}