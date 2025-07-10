export interface UserPresence {
  userId: string;
  username: string;
  avatar: string | null;
  status: 'online' | 'away' | 'busy' | 'offline';
  lastSeen: Date;
  currentRoom: string | null;
  cursor: CursorPosition | null;
  permissions: UserPermissions;
}

export interface CursorPosition {
  x: number;
  y: number;
  elementId?: string;
  elementType?: string;
  color?: string;
}

export interface UserPermissions {
  canRead: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canComment: boolean;
  canAnalyze: boolean;
  canShare: boolean;
  canManageUsers: boolean;
  canExport: boolean;
  canImport: boolean;
  role: string;
}

export interface ThreatModelOperation {
  id?: string;
  type: OperationType;
  threatModelId: string;
  userId: string;
  timestamp: Date;
  data: any;
  metadata?: {
    clientId?: string;
    sessionId?: string;
    version?: number;
  };
}

export type OperationType = 
  | 'create_component'
  | 'update_component'
  | 'delete_component'
  | 'create_data_flow'
  | 'update_data_flow'
  | 'delete_data_flow'
  | 'create_threat'
  | 'update_threat'
  | 'delete_threat'
  | 'create_trust_boundary'
  | 'update_trust_boundary'
  | 'delete_trust_boundary'
  | 'create_asset'
  | 'update_asset'
  | 'delete_asset'
  | 'add_comment'
  | 'update_comment'
  | 'delete_comment'
  | 'run_analysis'
  | 'update_metadata';

export interface OperationResult {
  success: boolean;
  operationId: string;
  data?: any;
  error?: string;
  conflict?: ConflictInfo;
  suggestions?: string[];
}

export interface ConflictInfo {
  hasConflict: boolean;
  type: ConflictType;
  conflictingElements: string[];
  description: string;
}

export type ConflictType = 
  | 'none'
  | 'concurrent_modification'
  | 'position'
  | 'name'
  | 'dependency'
  | 'missing'
  | 'duplicate';

export interface ConflictResolution {
  operationId: string;
  resolution: 'accept' | 'reject' | 'merge';
  mergeData?: any;
  timestamp: Date;
}

export interface CollaborationEvent {
  id: string;
  type: EventType;
  userId: string;
  timestamp: Date;
  data: any;
}

export type EventType = 
  | 'user-joined'
  | 'user-left'
  | 'cursor-move'
  | 'operation'
  | 'conflict'
  | 'resolution'
  | 'typing'
  | 'selection'
  | 'comment';

export interface Comment {
  id: string;
  userId: string;
  username: string;
  avatar: string | null;
  content: string;
  elementId: string;
  elementType: string;
  position?: { x: number; y: number };
  timestamp: Date;
  replies?: Comment[];
  resolved: boolean;
  resolutionUserId?: string;
  resolutionTimestamp?: Date;
}

export interface Selection {
  userId: string;
  elementIds: string[];
  type: 'select' | 'multi-select';
  timestamp: Date;
}

export interface TypingIndicator {
  userId: string;
  username: string;
  elementId: string;
  elementType: string;
  timestamp: Date;
}

export interface LiveEditSession {
  sessionId: string;
  threatModelId: string;
  participants: string[];
  startTime: Date;
  endTime?: Date;
  operationCount: number;
  conflictCount: number;
  isActive: boolean;
}

export interface CollaborationStats {
  activeUsers: number;
  activeRooms: number;
  totalConnections: number;
  operationsPerSecond: number;
  conflictRate: number;
  averageResponseTime: number;
}

export interface RoomInfo {
  id: string;
  threatModelId: string;
  name: string;
  activeUsers: UserPresence[];
  createdAt: Date;
  lastActivity: Date;
  operationCount: number;
  conflictCount: number;
}

export interface ComponentData {
  id: string;
  name: string;
  type: 'process' | 'data_store' | 'external_entity' | 'trust_boundary';
  position: { x: number; y: number };
  size: { width: number; height: number };
  properties: Record<string, any>;
  style: {
    backgroundColor?: string;
    borderColor?: string;
    textColor?: string;
    borderWidth?: number;
  };
  metadata: {
    createdBy: string;
    createdAt: Date;
    lastModifiedBy: string;
    lastModified: Date;
    version: number;
  };
}

export interface DataFlowData {
  id: string;
  name: string;
  source: string;
  destination: string;
  dataTypes: string[];
  properties: Record<string, any>;
  style: {
    color?: string;
    width?: number;
    pattern?: 'solid' | 'dashed' | 'dotted';
  };
  metadata: {
    createdBy: string;
    createdAt: Date;
    lastModifiedBy: string;
    lastModified: Date;
    version: number;
  };
}

export interface ThreatData {
  id: string;
  name: string;
  description: string;
  category: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  likelihood: number;
  impact: number;
  riskScore: number;
  affectedComponents: string[];
  mitigations: string[];
  status: 'identified' | 'mitigated' | 'accepted' | 'transferred';
  metadata: {
    createdBy: string;
    createdAt: Date;
    lastModifiedBy: string;
    lastModified: Date;
    version: number;
  };
}

export interface ThreatModelState {
  id: string;
  name: string;
  description: string;
  methodology: string;
  components: ComponentData[];
  dataFlows: DataFlowData[];
  threats: ThreatData[];
  trustBoundaries: any[];
  assets: any[];
  comments: Comment[];
  metadata: {
    createdBy: string;
    createdAt: Date;
    lastModifiedBy: string;
    lastModified: Date;
    version: number;
    collaborators: string[];
  };
}

export interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: Date;
  userId?: string;
  sessionId?: string;
}

export interface ClientInfo {
  id: string;
  userId: string;
  username: string;
  sessionId: string;
  connectedAt: Date;
  lastActivity: Date;
  currentRoom: string | null;
  userAgent: string;
  ipAddress: string;
}

export interface CollaborationMetrics {
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  conflictedOperations: number;
  averageOperationTime: number;
  activeCollaborators: number;
  peakConcurrentUsers: number;
  operationTypes: Record<OperationType, number>;
  conflictTypes: Record<ConflictType, number>;
  resolutionTypes: Record<string, number>;
}

export interface NotificationSettings {
  userId: string;
  enableRealTimeNotifications: boolean;
  enableEmailNotifications: boolean;
  enablePushNotifications: boolean;
  notificationTypes: {
    userJoined: boolean;
    userLeft: boolean;
    operationPerformed: boolean;
    conflictDetected: boolean;
    commentAdded: boolean;
    mentionReceived: boolean;
    analysisCompleted: boolean;
  };
}

export interface MentionData {
  userId: string;
  username: string;
  displayName: string;
  avatar: string | null;
  position: number;
  length: number;
}

export interface RichTextContent {
  type: 'text' | 'mention' | 'link' | 'emoji';
  content: string;
  data?: any;
  style?: {
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    color?: string;
  };
}

export interface ActivityLog {
  id: string;
  userId: string;
  username: string;
  action: string;
  description: string;
  metadata: any;
  timestamp: Date;
  threatModelId: string;
  elementId?: string;
  elementType?: string;
}

export interface CollaborationSettings {
  threatModelId: string;
  maxConcurrentUsers: number;
  enableRealTimeEditing: boolean;
  enableConflictResolution: boolean;
  enableComments: boolean;
  enableMentions: boolean;
  enableActivityLog: boolean;
  autoSaveInterval: number;
  lockTimeout: number;
  conflictResolutionTimeout: number;
  notificationSettings: NotificationSettings;
}