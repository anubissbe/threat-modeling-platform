export interface ActivityLog {
  id: string;
  type: ActivityType;
  action: string;
  description: string;
  entityType: 'project' | 'threat_model' | 'vulnerability' | 'user' | 'organization' | 'system';
  entityId: string;
  entityName?: string;
  metadata?: {
    oldValue?: any;
    newValue?: any;
    severity?: string;
    status?: string;
    assignedTo?: string;
    [key: string]: any;
  };
  userId: string;
  userName?: string;
  userEmail?: string;
  organizationId: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

export type ActivityType = 
  | 'project.created'
  | 'project.updated'
  | 'project.deleted'
  | 'project.archived'
  | 'threat_model.created'
  | 'threat_model.updated'
  | 'threat_model.deleted'
  | 'threat_model.published'
  | 'vulnerability.created'
  | 'vulnerability.updated'
  | 'vulnerability.deleted'
  | 'vulnerability.assigned'
  | 'vulnerability.resolved'
  | 'user.login'
  | 'user.logout'
  | 'user.registered'
  | 'user.password_changed'
  | 'system.backup'
  | 'system.maintenance'
  | 'security.scan_completed'
  | 'security.threat_detected';

export interface CreateActivityRequest {
  type: ActivityType;
  action: string;
  description: string;
  entityType: 'project' | 'threat_model' | 'vulnerability' | 'user' | 'organization' | 'system';
  entityId: string;
  entityName?: string;
  metadata?: any;
  ipAddress?: string;
  userAgent?: string;
}

export interface ActivityFilters {
  type?: ActivityType;
  entityType?: string;
  entityId?: string;
  userId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface ActivityStatistics {
  totalActivities: number;
  todayActivities: number;
  weekActivities: number;
  monthActivities: number;
  byType: {
    [key in ActivityType]?: number;
  };
  byEntityType: {
    project: number;
    threat_model: number;
    vulnerability: number;
    user: number;
    organization: number;
    system: number;
  };
  mostActiveUsers: Array<{
    userId: string;
    userName: string;
    activityCount: number;
  }>;
  recentTrends: Array<{
    date: string;
    count: number;
  }>;
}