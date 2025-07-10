import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { logger } from '../utils/logger';
import { RedisClientType } from 'redis';
import { Pool } from 'pg';
import { CollaborationEvent, UserPresence, CursorPosition, ThreatModelOperation } from '../types/collaboration';
import { ConflictResolutionService } from './conflict-resolution.service';
import { PermissionService } from './permission.service';

export class WebSocketService {
  private io: SocketIOServer;
  private conflictResolver: ConflictResolutionService;
  private permissionService: PermissionService;
  private activeUsers: Map<string, UserPresence> = new Map();
  private roomUsers: Map<string, Set<string>> = new Map(); // roomId -> Set of userIds
  private userSockets: Map<string, Socket> = new Map(); // userId -> Socket

  constructor(
    server: HTTPServer,
    private redis: RedisClientType,
    private db: Pool
  ) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true
      },
      pingTimeout: 60000,
      pingInterval: 25000,
      transports: ['websocket', 'polling']
    });

    this.conflictResolver = new ConflictResolutionService(redis, db);
    this.permissionService = new PermissionService(db);

    this.initializeEventHandlers();
    this.initializeRedisSubscriptions();
    
    logger.info('WebSocket service initialized');
  }

  private initializeEventHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      logger.info(`Client connected: ${socket.id}`);

      // Authentication
      socket.on('authenticate', async (data: { token: string, userId: string }) => {
        try {
          const isValid = await this.authenticateUser(data.token, data.userId);
          if (isValid) {
            socket.userId = data.userId;
            this.userSockets.set(data.userId, socket);
            socket.emit('authenticated', { success: true });
            logger.info(`User authenticated: ${data.userId}`);
          } else {
            socket.emit('authenticated', { success: false, error: 'Invalid token' });
            socket.disconnect();
          }
        } catch (error) {
          logger.error('Authentication error:', error);
          socket.emit('authenticated', { success: false, error: 'Authentication failed' });
          socket.disconnect();
        }
      });

      // Join threat model room
      socket.on('join-room', async (data: { threatModelId: string }) => {
        try {
          if (!socket.userId) {
            socket.emit('error', { message: 'Not authenticated' });
            return;
          }

          const hasPermission = await this.permissionService.canAccessThreatModel(
            socket.userId,
            data.threatModelId
          );

          if (!hasPermission) {
            socket.emit('error', { message: 'Access denied' });
            return;
          }

          const roomId = `threat-model-${data.threatModelId}`;
          await socket.join(roomId);

          // Add user to room tracking
          if (!this.roomUsers.has(roomId)) {
            this.roomUsers.set(roomId, new Set());
          }
          this.roomUsers.get(roomId)!.add(socket.userId);

          // Create user presence
          const userPresence: UserPresence = {
            userId: socket.userId,
            username: await this.getUsernameById(socket.userId),
            avatar: await this.getUserAvatarById(socket.userId),
            status: 'online',
            lastSeen: new Date(),
            currentRoom: roomId,
            cursor: null,
            permissions: await this.permissionService.getUserPermissions(socket.userId, data.threatModelId)
          };

          this.activeUsers.set(socket.userId, userPresence);

          // Notify room about new user
          socket.to(roomId).emit('user-joined', userPresence);

          // Send current room users to new user
          const roomUserList = Array.from(this.roomUsers.get(roomId) || [])
            .map(userId => this.activeUsers.get(userId))
            .filter(Boolean);

          socket.emit('room-users', roomUserList);

          logger.info(`User ${socket.userId} joined room ${roomId}`);
        } catch (error) {
          logger.error('Join room error:', error);
          socket.emit('error', { message: 'Failed to join room' });
        }
      });

      // Handle cursor movement
      socket.on('cursor-move', (data: { position: CursorPosition }) => {
        if (!socket.userId) return;

        const userPresence = this.activeUsers.get(socket.userId);
        if (userPresence && userPresence.currentRoom) {
          userPresence.cursor = data.position;
          userPresence.lastSeen = new Date();

          // Broadcast cursor position to room (except sender)
          socket.to(userPresence.currentRoom).emit('cursor-updated', {
            userId: socket.userId,
            position: data.position
          });
        }
      });

      // Handle threat model operations
      socket.on('threat-model-operation', async (data: ThreatModelOperation) => {
        try {
          if (!socket.userId) {
            socket.emit('error', { message: 'Not authenticated' });
            return;
          }

          const userPresence = this.activeUsers.get(socket.userId);
          if (!userPresence || !userPresence.currentRoom) {
            socket.emit('error', { message: 'Not in a room' });
            return;
          }

          // Check permissions for this operation
          const hasPermission = await this.permissionService.canPerformOperation(
            socket.userId,
            data.threatModelId,
            data.type
          );

          if (!hasPermission) {
            socket.emit('error', { message: 'Insufficient permissions' });
            return;
          }

          // Process operation with conflict resolution
          const result = await this.conflictResolver.processOperation(data);

          if (result.success) {
            // Broadcast successful operation to room
            const collaborationEvent: CollaborationEvent = {
              id: result.operationId!,
              type: 'operation',
              userId: socket.userId,
              timestamp: new Date(),
              data: {
                operation: data,
                result: result.data
              }
            };

            this.io.to(userPresence.currentRoom).emit('collaboration-event', collaborationEvent);

            // Store operation in history
            await this.storeOperationHistory(collaborationEvent);

            logger.info(`Operation processed: ${data.type} by ${socket.userId}`);
          } else {
            // Handle conflict - send conflict resolution dialog
            socket.emit('conflict-detected', {
              operationId: result.operationId,
              conflict: result.conflict,
              suggestions: result.suggestions
            });
          }
        } catch (error) {
          logger.error('Operation error:', error);
          socket.emit('error', { message: 'Operation failed' });
        }
      });

      // Handle conflict resolution
      socket.on('resolve-conflict', async (data: { 
        operationId: string, 
        resolution: 'accept' | 'reject' | 'merge',
        mergeData?: any 
      }) => {
        try {
          if (!socket.userId) return;

          const result = await this.conflictResolver.resolveConflict(
            data.operationId,
            data.resolution,
            data.mergeData
          );

          if (result.success) {
            const userPresence = this.activeUsers.get(socket.userId);
            if (userPresence?.currentRoom) {
              this.io.to(userPresence.currentRoom).emit('conflict-resolved', {
                operationId: data.operationId,
                resolution: data.resolution,
                result: result.data
              });
            }
          }
        } catch (error) {
          logger.error('Conflict resolution error:', error);
          socket.emit('error', { message: 'Conflict resolution failed' });
        }
      });

      // Handle typing indicators
      socket.on('typing-start', (data: { elementId: string, elementType: string }) => {
        if (!socket.userId) return;

        const userPresence = this.activeUsers.get(socket.userId);
        if (userPresence?.currentRoom) {
          socket.to(userPresence.currentRoom).emit('user-typing', {
            userId: socket.userId,
            username: userPresence.username,
            elementId: data.elementId,
            elementType: data.elementType
          });
        }
      });

      socket.on('typing-stop', (data: { elementId: string }) => {
        if (!socket.userId) return;

        const userPresence = this.activeUsers.get(socket.userId);
        if (userPresence?.currentRoom) {
          socket.to(userPresence.currentRoom).emit('user-stopped-typing', {
            userId: socket.userId,
            elementId: data.elementId
          });
        }
      });

      // Handle selections
      socket.on('selection-change', (data: { 
        elementIds: string[], 
        action: 'select' | 'deselect' 
      }) => {
        if (!socket.userId) return;

        const userPresence = this.activeUsers.get(socket.userId);
        if (userPresence?.currentRoom) {
          socket.to(userPresence.currentRoom).emit('selection-updated', {
            userId: socket.userId,
            username: userPresence.username,
            elementIds: data.elementIds,
            action: data.action
          });
        }
      });

      // Handle comments
      socket.on('add-comment', async (data: {
        threatModelId: string,
        elementId: string,
        comment: string,
        position?: { x: number, y: number }
      }) => {
        try {
          if (!socket.userId) return;

          const commentId = await this.addComment(
            data.threatModelId,
            data.elementId,
            socket.userId,
            data.comment,
            data.position
          );

          const userPresence = this.activeUsers.get(socket.userId);
          if (userPresence?.currentRoom) {
            this.io.to(userPresence.currentRoom).emit('comment-added', {
              commentId,
              userId: socket.userId,
              username: userPresence.username,
              elementId: data.elementId,
              comment: data.comment,
              position: data.position,
              timestamp: new Date()
            });
          }
        } catch (error) {
          logger.error('Add comment error:', error);
          socket.emit('error', { message: 'Failed to add comment' });
        }
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        this.handleUserDisconnect(socket);
      });

      // Handle custom disconnect
      socket.on('leave-room', () => {
        this.handleUserDisconnect(socket);
      });
    });
  }

  private initializeRedisSubscriptions(): void {
    // Subscribe to cross-instance events
    this.redis.subscribe('collaboration:events', (message) => {
      try {
        const event = JSON.parse(message) as CollaborationEvent;
        this.handleExternalEvent(event);
      } catch (error) {
        logger.error('Redis subscription error:', error);
      }
    });
  }

  private handleExternalEvent(event: CollaborationEvent): void {
    // Handle events from other server instances
    switch (event.type) {
      case 'user-joined':
      case 'user-left':
      case 'operation':
        // Broadcast to relevant rooms
        this.io.emit('collaboration-event', event);
        break;
      default:
        logger.warn(`Unknown external event type: ${event.type}`);
    }
  }

  private async authenticateUser(token: string, userId: string): Promise<boolean> {
    try {
      // Verify JWT token
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      return decoded.userId === userId;
    } catch (error) {
      logger.error('Token verification failed:', error);
      return false;
    }
  }

  private async getUsernameById(userId: string): Promise<string> {
    try {
      const result = await this.db.query('SELECT username FROM users WHERE id = $1', [userId]);
      return result.rows[0]?.username || 'Unknown User';
    } catch (error) {
      logger.error('Get username error:', error);
      return 'Unknown User';
    }
  }

  private async getUserAvatarById(userId: string): Promise<string | null> {
    try {
      const result = await this.db.query('SELECT avatar_url FROM users WHERE id = $1', [userId]);
      return result.rows[0]?.avatar_url || null;
    } catch (error) {
      logger.error('Get avatar error:', error);
      return null;
    }
  }

  private async addComment(
    threatModelId: string,
    elementId: string,
    userId: string,
    comment: string,
    position?: { x: number, y: number }
  ): Promise<string> {
    const result = await this.db.query(`
      INSERT INTO threat_model_comments (threat_model_id, element_id, user_id, comment, position, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING id
    `, [threatModelId, elementId, userId, comment, JSON.stringify(position)]);

    return result.rows[0].id;
  }

  private async storeOperationHistory(event: CollaborationEvent): Promise<void> {
    try {
      await this.db.query(`
        INSERT INTO collaboration_history (
          event_id, user_id, event_type, threat_model_id, data, timestamp
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        event.id,
        event.userId,
        event.type,
        event.data.operation.threatModelId,
        JSON.stringify(event.data),
        event.timestamp
      ]);
    } catch (error) {
      logger.error('Store operation history error:', error);
    }
  }

  private handleUserDisconnect(socket: Socket): void {
    if (!socket.userId) return;

    const userPresence = this.activeUsers.get(socket.userId);
    if (userPresence && userPresence.currentRoom) {
      // Remove from room tracking
      const roomUsers = this.roomUsers.get(userPresence.currentRoom);
      if (roomUsers) {
        roomUsers.delete(socket.userId);
        if (roomUsers.size === 0) {
          this.roomUsers.delete(userPresence.currentRoom);
        }
      }

      // Notify room about user leaving
      socket.to(userPresence.currentRoom).emit('user-left', {
        userId: socket.userId,
        username: userPresence.username
      });

      logger.info(`User ${socket.userId} left room ${userPresence.currentRoom}`);
    }

    // Clean up user data
    this.activeUsers.delete(socket.userId);
    this.userSockets.delete(socket.userId);

    logger.info(`Client disconnected: ${socket.id} (User: ${socket.userId})`);
  }

  // Public methods for external access
  public async broadcastToRoom(roomId: string, event: string, data: any): Promise<void> {
    this.io.to(roomId).emit(event, data);
  }

  public async getActiveUsers(roomId: string): Promise<UserPresence[]> {
    const roomUsers = this.roomUsers.get(roomId);
    if (!roomUsers) return [];

    return Array.from(roomUsers)
      .map(userId => this.activeUsers.get(userId))
      .filter(Boolean) as UserPresence[];
  }

  public async getUserPresence(userId: string): Promise<UserPresence | null> {
    return this.activeUsers.get(userId) || null;
  }

  public async kickUser(userId: string, reason?: string): Promise<void> {
    const socket = this.userSockets.get(userId);
    if (socket) {
      socket.emit('kicked', { reason: reason || 'Kicked by admin' });
      socket.disconnect();
    }
  }

  public async sendMessageToUser(userId: string, event: string, data: any): Promise<void> {
    const socket = this.userSockets.get(userId);
    if (socket) {
      socket.emit(event, data);
    }
  }

  public getStats(): {
    activeUsers: number,
    activeRooms: number,
    totalConnections: number
  } {
    return {
      activeUsers: this.activeUsers.size,
      activeRooms: this.roomUsers.size,
      totalConnections: this.io.sockets.sockets.size
    };
  }
}

// Extend Socket interface to include userId
declare module 'socket.io' {
  interface Socket {
    userId?: string;
  }
}