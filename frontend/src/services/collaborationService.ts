import { io, Socket } from 'socket.io-client';
import { 
  UserPresence, 
  ThreatModelOperation, 
  ConflictInfo, 
  Comment, 
  CollaborationEvent,
  NotificationSettings,
  CollaborationMetrics,
  ActivityLog,
  ThreatModelState,
  CollaborationSettings
} from '../types/collaboration';

export interface CollaborationServiceConfig {
  websocketUrl?: string;
  autoReconnect?: boolean;
  reconnectAttempts?: number;
  reconnectDelay?: number;
  heartbeatInterval?: number;
  operationTimeout?: number;
  batchOperations?: boolean;
  batchDelay?: number;
}

export interface CollaborationServiceCallbacks {
  onUserJoined?: (user: UserPresence) => void;
  onUserLeft?: (data: { userId: string; username: string }) => void;
  onUserPresenceChanged?: (users: UserPresence[]) => void;
  onCursorMoved?: (data: { userId: string; position: { x: number; y: number; elementId?: string } }) => void;
  onOperationApplied?: (operation: ThreatModelOperation) => void;
  onConflictDetected?: (conflict: ConflictInfo) => void;
  onConflictResolved?: (data: { operationId: string; resolution: string; result: any }) => void;
  onCommentAdded?: (comment: Comment) => void;
  onStateChanged?: (newState: ThreatModelState) => void;
  onConnectionStateChanged?: (connected: boolean) => void;
  onError?: (error: Error) => void;
}

export class CollaborationService {
  private socket: Socket | null = null;
  private config: CollaborationServiceConfig;
  private callbacks: CollaborationServiceCallbacks;
  private threatModelId: string;
  private userId: string;
  private userToken: string;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private operationQueue: ThreatModelOperation[] = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private metrics: CollaborationMetrics = this.initializeMetrics();

  constructor(
    threatModelId: string,
    userId: string,
    userToken: string,
    config: CollaborationServiceConfig = {},
    callbacks: CollaborationServiceCallbacks = {}
  ) {
    this.threatModelId = threatModelId;
    this.userId = userId;
    this.userToken = userToken;
    this.config = {
      websocketUrl: process.env.REACT_APP_WEBSOCKET_URL || 'http://localhost:3001',
      autoReconnect: true,
      reconnectAttempts: 5,
      reconnectDelay: 1000,
      heartbeatInterval: 30000,
      operationTimeout: 10000,
      batchOperations: true,
      batchDelay: 100,
      ...config
    };
    this.callbacks = callbacks;

    this.initialize();
  }

  private initializeMetrics(): CollaborationMetrics {
    return {
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      conflictedOperations: 0,
      averageOperationTime: 0,
      activeCollaborators: 0,
      peakConcurrentUsers: 0,
      operationTypes: {} as Record<any, number>,
      conflictTypes: {} as Record<any, number>,
      resolutionTypes: {} as Record<string, number>
    };
  }

  private initialize() {
    this.connect();
  }

  private connect() {
    if (this.socket) {
      this.socket.disconnect();
    }

    this.socket = io(this.config.websocketUrl!, {
      transports: ['websocket'],
      timeout: 20000,
      forceNew: true
    });

    this.setupSocketListeners();
    this.startHeartbeat();
  }

  private setupSocketListeners() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.callbacks.onConnectionStateChanged?.(true);
      
      // Authenticate
      this.socket!.emit('authenticate', { 
        token: this.userToken, 
        userId: this.userId 
      });
    });

    this.socket.on('authenticated', (data: { success: boolean; error?: string }) => {
      if (data.success) {
        // Join threat model room
        this.socket!.emit('join-room', { threatModelId: this.threatModelId });
        this.showNotification('Connected to collaboration session', 'success');
      } else {
        this.handleError(new Error(`Authentication failed: ${data.error}`));
      }
    });

    this.socket.on('room-joined', (data: { users: UserPresence[] }) => {
      this.callbacks.onUserPresenceChanged?.(data.users);
      this.metrics.activeCollaborators = data.users.length;
      this.metrics.peakConcurrentUsers = Math.max(this.metrics.peakConcurrentUsers, data.users.length);
    });

    this.socket.on('room-users', (users: UserPresence[]) => {
      this.callbacks.onUserPresenceChanged?.(users);
      this.metrics.activeCollaborators = users.length;
    });

    this.socket.on('user-joined', (user: UserPresence) => {
      this.callbacks.onUserJoined?.(user);
      this.showNotification(`${user.username} joined the session`, 'info', {
        type: 'user-joined',
        userId: user.userId,
        username: user.username,
        avatar: user.avatar
      });
    });

    this.socket.on('user-left', (data: { userId: string; username: string }) => {
      this.callbacks.onUserLeft?.(data);
      this.showNotification(`${data.username} left the session`, 'info', {
        type: 'user-left',
        userId: data.userId,
        username: data.username
      });
    });

    this.socket.on('cursor-updated', (data: { userId: string; position: { x: number; y: number; elementId?: string } }) => {
      this.callbacks.onCursorMoved?.(data);
    });

    this.socket.on('operation-applied', (operation: ThreatModelOperation) => {
      this.callbacks.onOperationApplied?.(operation);
      this.updateMetrics('operation-applied', operation);
    });

    this.socket.on('conflict-detected', (data: { operationId: string; conflict: ConflictInfo; suggestions: string[] }) => {
      this.callbacks.onConflictDetected?.(data.conflict);
      this.updateMetrics('conflict-detected', data.conflict);
      this.showNotification('Conflict detected', 'warning', {
        type: 'conflict',
        title: 'Conflict Detected',
        message: data.conflict.description,
        persistent: true,
        priority: 'high'
      });
    });

    this.socket.on('conflict-resolved', (data: { operationId: string; resolution: string; result: any }) => {
      this.callbacks.onConflictResolved?.(data);
      this.updateMetrics('conflict-resolved', data);
      this.showNotification(`Conflict resolved: ${data.resolution}`, 'success', {
        type: 'success',
        title: 'Conflict Resolved',
        message: `Resolution: ${data.resolution}`
      });
    });

    this.socket.on('comment-added', (comment: Comment) => {
      this.callbacks.onCommentAdded?.(comment);
      this.showNotification(`${comment.username} added a comment`, 'info', {
        type: 'comment',
        userId: comment.userId,
        username: comment.username,
        avatar: comment.avatar
      });
    });

    this.socket.on('state-changed', (newState: ThreatModelState) => {
      this.callbacks.onStateChanged?.(newState);
    });

    this.socket.on('collaboration-event', (event: CollaborationEvent) => {
      this.handleCollaborationEvent(event);
    });

    this.socket.on('disconnect', () => {
      this.isConnected = false;
      this.callbacks.onConnectionStateChanged?.(false);
      this.showNotification('Disconnected from collaboration session', 'warning');
      
      if (this.config.autoReconnect && this.reconnectAttempts < this.config.reconnectAttempts!) {
        this.attemptReconnect();
      }
    });

    this.socket.on('error', (error: any) => {
      this.handleError(new Error(error));
    });

    this.socket.on('operation-timeout', (data: { operationId: string }) => {
      this.showNotification('Operation timed out', 'error', {
        type: 'error',
        title: 'Operation Timeout',
        message: `Operation ${data.operationId} timed out`
      });
    });

    this.socket.on('rate-limit-exceeded', (data: { message: string; retryAfter: number }) => {
      this.showNotification('Rate limit exceeded', 'warning', {
        type: 'warning',
        title: 'Rate Limit Exceeded',
        message: data.message,
        persistent: true
      });
    });
  }

  private handleCollaborationEvent(event: CollaborationEvent) {
    switch (event.type) {
      case 'user-joined':
        this.callbacks.onUserJoined?.(event.data);
        break;
      case 'user-left':
        this.callbacks.onUserLeft?.(event.data);
        break;
      case 'cursor-move':
        this.callbacks.onCursorMoved?.(event.data);
        break;
      case 'operation':
        this.callbacks.onOperationApplied?.(event.data);
        break;
      case 'conflict':
        this.callbacks.onConflictDetected?.(event.data);
        break;
      case 'resolution':
        this.callbacks.onConflictResolved?.(event.data);
        break;
      case 'comment':
        this.callbacks.onCommentAdded?.(event.data);
        break;
      default:
        console.log('Unknown collaboration event:', event);
    }
  }

  private attemptReconnect() {
    this.reconnectAttempts++;
    const delay = this.config.reconnectDelay! * Math.pow(2, this.reconnectAttempts - 1);
    
    setTimeout(() => {
      this.showNotification(`Attempting to reconnect... (${this.reconnectAttempts}/${this.config.reconnectAttempts})`, 'info');
      this.connect();
    }, delay);
  }

  private startHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }

    this.heartbeatTimer = setInterval(() => {
      if (this.socket && this.isConnected) {
        this.socket.emit('heartbeat', { timestamp: Date.now() });
      }
    }, this.config.heartbeatInterval!);
  }

  private updateMetrics(eventType: string, data: any) {
    this.metrics.totalOperations++;
    
    switch (eventType) {
      case 'operation-applied':
        this.metrics.successfulOperations++;
        const operationType = data.type as OperationType;
        this.metrics.operationTypes[operationType] = (this.metrics.operationTypes[operationType] || 0) + 1;
        break;
      case 'conflict-detected':
        this.metrics.conflictedOperations++;
        const conflictType = data.type as ConflictType;
        this.metrics.conflictTypes[conflictType] = (this.metrics.conflictTypes[conflictType] || 0) + 1;
        break;
      case 'conflict-resolved':
        const resolutionType = data.resolution;
        this.metrics.resolutionTypes[resolutionType] = (this.metrics.resolutionTypes[resolutionType] || 0) + 1;
        break;
    }
  }

  private handleError(error: Error) {
    console.error('Collaboration service error:', error);
    this.callbacks.onError?.(error);
    this.showNotification('Collaboration error occurred', 'error', {
      type: 'error',
      title: 'Collaboration Error',
      message: error.message
    });
  }

  // Public API methods
  
  public performOperation(operation: Omit<ThreatModelOperation, 'id' | 'timestamp'>) {
    if (!this.socket || !this.isConnected) {
      throw new Error('Not connected to collaboration service');
    }

    const fullOperation: ThreatModelOperation = {
      ...operation,
      id: `op-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date()
    };

    if (this.config.batchOperations) {
      this.operationQueue.push(fullOperation);
      this.scheduleBatch();
    } else {
      this.socket.emit('threat-model-operation', fullOperation);
    }
  }

  private scheduleBatch() {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
    }

    this.batchTimer = setTimeout(() => {
      if (this.operationQueue.length > 0) {
        this.socket!.emit('batch-operations', this.operationQueue);
        this.operationQueue = [];
      }
    }, this.config.batchDelay!);
  }

  public updateCursor(position: { x: number; y: number; elementId?: string }) {
    if (this.socket && this.isConnected) {
      this.socket.emit('cursor-move', { position });
    }
  }

  public updateSelection(elementIds: string[], action: 'select' | 'deselect' = 'select') {
    if (this.socket && this.isConnected) {
      this.socket.emit('selection-change', { elementIds, action });
    }
  }

  public startTyping(elementId: string, elementType: string) {
    if (this.socket && this.isConnected) {
      this.socket.emit('typing-start', { elementId, elementType });
    }
  }

  public stopTyping(elementId: string) {
    if (this.socket && this.isConnected) {
      this.socket.emit('typing-stop', { elementId });
    }
  }

  public addComment(elementId: string, comment: string, position?: { x: number; y: number }) {
    if (this.socket && this.isConnected) {
      this.socket.emit('add-comment', {
        threatModelId: this.threatModelId,
        elementId,
        comment,
        position
      });
    }
  }

  public resolveConflict(operationId: string, resolution: 'accept' | 'reject' | 'merge', mergeData?: any) {
    if (this.socket && this.isConnected) {
      this.socket.emit('resolve-conflict', {
        operationId,
        resolution,
        mergeData
      });
    }
  }

  public requestSnapshot() {
    if (this.socket && this.isConnected) {
      this.socket.emit('request-snapshot', { threatModelId: this.threatModelId });
    }
  }

  public handleRemoteSelection(data: { userId: string; username: string; elementIds: string[]; action: 'select' | 'deselect' }) {
    // Handle remote user selections - highlight selected elements
    const event = new CustomEvent('remote-selection', { detail: data });
    window.dispatchEvent(event);
  }

  public showNotification(message: string, type: 'info' | 'success' | 'warning' | 'error', options: any = {}) {
    const notification = {
      title: options.title || message,
      message: options.message || message,
      type: options.type || type,
      userId: options.userId,
      username: options.username,
      avatar: options.avatar,
      timestamp: new Date(),
      persistent: options.persistent || false,
      priority: options.priority || 'medium',
      sound: options.sound !== false
    };

    const event = new CustomEvent('collaboration-notification', { detail: notification });
    window.dispatchEvent(event);
  }

  public getMetrics(): CollaborationMetrics {
    return { ...this.metrics };
  }

  public exportCollaborationData() {
    const data = {
      threatModelId: this.threatModelId,
      userId: this.userId,
      metrics: this.metrics,
      timestamp: new Date()
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `collaboration-data-${this.threatModelId}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  public showSessionStats() {
    const stats = {
      'Active Collaborators': this.metrics.activeCollaborators,
      'Peak Concurrent Users': this.metrics.peakConcurrentUsers,
      'Total Operations': this.metrics.totalOperations,
      'Successful Operations': this.metrics.successfulOperations,
      'Failed Operations': this.metrics.failedOperations,
      'Conflicted Operations': this.metrics.conflictedOperations,
      'Success Rate': `${((this.metrics.successfulOperations / this.metrics.totalOperations) * 100).toFixed(1)}%`,
      'Conflict Rate': `${((this.metrics.conflictedOperations / this.metrics.totalOperations) * 100).toFixed(1)}%`
    };

    console.table(stats);
    this.showNotification('Session statistics logged to console', 'info');
  }

  public managePermissions() {
    // Open permissions management dialog
    const event = new CustomEvent('open-permissions-dialog');
    window.dispatchEvent(event);
  }

  public disconnect() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }
    
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
    }

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.isConnected = false;
    this.callbacks.onConnectionStateChanged?.(false);
  }

  // Getters
  public get connected(): boolean {
    return this.isConnected;
  }

  public get connectionState(): 'connected' | 'disconnected' | 'connecting' | 'error' {
    if (!this.socket) return 'disconnected';
    if (this.socket.connected) return 'connected';
    if (this.socket.disconnected === false && !this.socket.connected) return 'connecting';
    return 'error';
  }

  public get activeCollaborators(): number {
    return this.metrics.activeCollaborators;
  }
}

export default CollaborationService;