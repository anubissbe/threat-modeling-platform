import { WebSocketService } from '../services/websocket.service';
import { ConflictResolutionService } from '../services/conflict-resolution.service';
import { PermissionService } from '../services/permission.service';
import { Server } from 'socket.io';
import { createServer } from 'http';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import jwt from 'jsonwebtoken';

describe('WebSocketService', () => {
  let wsService: WebSocketService;
  let httpServer: any;
  let clientSocket: ClientSocket;
  let serverSocket: any;
  const TEST_PORT = 3099;
  const TEST_JWT_SECRET = 'test-secret';
  const TEST_USER_ID = 'test-user-123';
  const TEST_THREAT_MODEL_ID = 'test-model-456';

  const validToken = jwt.sign(
    { userId: TEST_USER_ID, username: 'Test User' },
    TEST_JWT_SECRET,
    { expiresIn: '1h' }
  );

  beforeAll((done) => {
    // Create HTTP server
    httpServer = createServer();
    
    // Initialize WebSocket service
    wsService = new WebSocketService(httpServer);
    
    // Start server
    httpServer.listen(TEST_PORT, () => {
      done();
    });
  });

  afterAll((done) => {
    httpServer.close();
    done();
  });

  beforeEach((done) => {
    // Create client socket
    clientSocket = ioClient(`http://localhost:${TEST_PORT}`, {
      transports: ['websocket']
    });

    // Wait for connection
    clientSocket.on('connect', () => {
      done();
    });
  });

  afterEach(() => {
    if (clientSocket.connected) {
      clientSocket.disconnect();
    }
  });

  describe('Authentication', () => {
    it('should authenticate with valid token', (done) => {
      clientSocket.emit('authenticate', {
        token: validToken,
        userId: TEST_USER_ID
      });

      clientSocket.on('authenticated', (data) => {
        expect(data.success).toBe(true);
        expect(data.error).toBeUndefined();
        done();
      });
    });

    it('should reject invalid token', (done) => {
      clientSocket.emit('authenticate', {
        token: 'invalid-token',
        userId: TEST_USER_ID
      });

      clientSocket.on('authenticated', (data) => {
        expect(data.success).toBe(false);
        expect(data.error).toBeDefined();
        done();
      });
    });

    it('should disconnect unauthenticated users after timeout', (done) => {
      // Don't authenticate, just wait for disconnect
      clientSocket.on('disconnect', () => {
        done();
      });

      // Trigger timeout by sending a non-auth message
      clientSocket.emit('join-room', { threatModelId: TEST_THREAT_MODEL_ID });
    });
  });

  describe('Room Management', () => {
    beforeEach((done) => {
      // Authenticate first
      clientSocket.emit('authenticate', {
        token: validToken,
        userId: TEST_USER_ID
      });

      clientSocket.on('authenticated', () => {
        done();
      });
    });

    it('should join threat model room', (done) => {
      clientSocket.emit('join-room', {
        threatModelId: TEST_THREAT_MODEL_ID
      });

      clientSocket.on('room-joined', (data) => {
        expect(data.users).toBeDefined();
        expect(Array.isArray(data.users)).toBe(true);
        done();
      });
    });

    it('should broadcast user joined to other users', (done) => {
      // Create second client
      const secondClient = ioClient(`http://localhost:${TEST_PORT}`, {
        transports: ['websocket']
      });

      const secondToken = jwt.sign(
        { userId: 'second-user', username: 'Second User' },
        TEST_JWT_SECRET,
        { expiresIn: '1h' }
      );

      // First client joins room
      clientSocket.emit('join-room', {
        threatModelId: TEST_THREAT_MODEL_ID
      });

      clientSocket.on('room-joined', () => {
        // Second client authenticates and joins
        secondClient.emit('authenticate', {
          token: secondToken,
          userId: 'second-user'
        });

        secondClient.on('authenticated', () => {
          secondClient.emit('join-room', {
            threatModelId: TEST_THREAT_MODEL_ID
          });
        });
      });

      // First client should receive user-joined event
      clientSocket.on('user-joined', (user) => {
        expect(user.userId).toBe('second-user');
        expect(user.username).toBe('Second User');
        secondClient.disconnect();
        done();
      });
    });

    it('should handle user leaving room', (done) => {
      clientSocket.emit('join-room', {
        threatModelId: TEST_THREAT_MODEL_ID
      });

      clientSocket.on('room-joined', () => {
        clientSocket.emit('leave-room', {
          threatModelId: TEST_THREAT_MODEL_ID
        });
      });

      clientSocket.on('room-left', () => {
        done();
      });
    });
  });

  describe('Cursor Tracking', () => {
    beforeEach((done) => {
      // Authenticate and join room
      clientSocket.emit('authenticate', {
        token: validToken,
        userId: TEST_USER_ID
      });

      clientSocket.on('authenticated', () => {
        clientSocket.emit('join-room', {
          threatModelId: TEST_THREAT_MODEL_ID
        });
      });

      clientSocket.on('room-joined', () => {
        done();
      });
    });

    it('should broadcast cursor position', (done) => {
      const cursorPosition = {
        x: 100,
        y: 200,
        elementId: 'element-123'
      };

      // Create second client to receive cursor update
      const secondClient = ioClient(`http://localhost:${TEST_PORT}`, {
        transports: ['websocket']
      });

      const secondToken = jwt.sign(
        { userId: 'second-user', username: 'Second User' },
        TEST_JWT_SECRET,
        { expiresIn: '1h' }
      );

      secondClient.emit('authenticate', {
        token: secondToken,
        userId: 'second-user'
      });

      secondClient.on('authenticated', () => {
        secondClient.emit('join-room', {
          threatModelId: TEST_THREAT_MODEL_ID
        });
      });

      secondClient.on('room-joined', () => {
        // First client sends cursor position
        clientSocket.emit('cursor-move', {
          position: cursorPosition
        });
      });

      // Second client should receive cursor update
      secondClient.on('cursor-updated', (data) => {
        expect(data.userId).toBe(TEST_USER_ID);
        expect(data.position).toEqual(cursorPosition);
        secondClient.disconnect();
        done();
      });
    });
  });

  describe('Operations', () => {
    beforeEach((done) => {
      // Authenticate and join room
      clientSocket.emit('authenticate', {
        token: validToken,
        userId: TEST_USER_ID
      });

      clientSocket.on('authenticated', () => {
        clientSocket.emit('join-room', {
          threatModelId: TEST_THREAT_MODEL_ID
        });
      });

      clientSocket.on('room-joined', () => {
        done();
      });
    });

    it('should process threat model operation', (done) => {
      const operation = {
        type: 'create_component',
        threatModelId: TEST_THREAT_MODEL_ID,
        userId: TEST_USER_ID,
        timestamp: new Date(),
        data: {
          name: 'Test Component',
          type: 'process'
        }
      };

      clientSocket.emit('threat-model-operation', operation);

      clientSocket.on('operation-result', (result) => {
        expect(result.success).toBe(true);
        expect(result.operationId).toBeDefined();
        done();
      });
    });

    it('should handle batch operations', (done) => {
      const operations = [
        {
          type: 'create_component',
          threatModelId: TEST_THREAT_MODEL_ID,
          userId: TEST_USER_ID,
          timestamp: new Date(),
          data: { name: 'Component 1', type: 'process' }
        },
        {
          type: 'create_component',
          threatModelId: TEST_THREAT_MODEL_ID,
          userId: TEST_USER_ID,
          timestamp: new Date(),
          data: { name: 'Component 2', type: 'data_store' }
        }
      ];

      let resultsReceived = 0;

      clientSocket.on('operation-result', (result) => {
        resultsReceived++;
        expect(result.success).toBe(true);
        
        if (resultsReceived === operations.length) {
          done();
        }
      });

      clientSocket.emit('batch-operations', operations);
    });
  });

  describe('Conflict Resolution', () => {
    beforeEach((done) => {
      // Authenticate and join room
      clientSocket.emit('authenticate', {
        token: validToken,
        userId: TEST_USER_ID
      });

      clientSocket.on('authenticated', () => {
        clientSocket.emit('join-room', {
          threatModelId: TEST_THREAT_MODEL_ID
        });
      });

      clientSocket.on('room-joined', () => {
        done();
      });
    });

    it('should detect conflicts', (done) => {
      // Simulate a conflict scenario
      const operation = {
        type: 'update_component',
        threatModelId: TEST_THREAT_MODEL_ID,
        userId: TEST_USER_ID,
        timestamp: new Date(),
        data: {
          componentId: 'component-123',
          updates: { name: 'Updated Name' }
        }
      };

      clientSocket.on('conflict-detected', (data) => {
        expect(data.operationId).toBeDefined();
        expect(data.conflict).toBeDefined();
        expect(data.conflict.type).toBeDefined();
        expect(data.suggestions).toBeDefined();
        expect(Array.isArray(data.suggestions)).toBe(true);
        done();
      });

      // Force a conflict by sending an operation that will conflict
      clientSocket.emit('threat-model-operation', operation);
    });

    it('should resolve conflicts', (done) => {
      const operationId = 'test-operation-123';
      const resolution = {
        operationId,
        resolution: 'merge',
        mergeData: {
          strategy: 'keep_both'
        }
      };

      clientSocket.emit('resolve-conflict', resolution);

      clientSocket.on('conflict-resolved', (data) => {
        expect(data.operationId).toBe(operationId);
        expect(data.resolution).toBe('merge');
        expect(data.result).toBeDefined();
        done();
      });
    });
  });

  describe('Comments', () => {
    beforeEach((done) => {
      // Authenticate and join room
      clientSocket.emit('authenticate', {
        token: validToken,
        userId: TEST_USER_ID
      });

      clientSocket.on('authenticated', () => {
        clientSocket.emit('join-room', {
          threatModelId: TEST_THREAT_MODEL_ID
        });
      });

      clientSocket.on('room-joined', () => {
        done();
      });
    });

    it('should add comment', (done) => {
      const commentData = {
        threatModelId: TEST_THREAT_MODEL_ID,
        elementId: 'element-123',
        comment: 'This is a test comment',
        position: { x: 100, y: 200 }
      };

      clientSocket.emit('add-comment', commentData);

      clientSocket.on('comment-added', (comment) => {
        expect(comment.userId).toBe(TEST_USER_ID);
        expect(comment.content).toBe(commentData.comment);
        expect(comment.elementId).toBe(commentData.elementId);
        expect(comment.position).toEqual(commentData.position);
        done();
      });
    });
  });

  describe('Typing Indicators', () => {
    beforeEach((done) => {
      // Authenticate and join room
      clientSocket.emit('authenticate', {
        token: validToken,
        userId: TEST_USER_ID
      });

      clientSocket.on('authenticated', () => {
        clientSocket.emit('join-room', {
          threatModelId: TEST_THREAT_MODEL_ID
        });
      });

      clientSocket.on('room-joined', () => {
        done();
      });
    });

    it('should broadcast typing status', (done) => {
      const typingData = {
        elementId: 'element-123',
        elementType: 'component'
      };

      // Create second client to receive typing status
      const secondClient = ioClient(`http://localhost:${TEST_PORT}`, {
        transports: ['websocket']
      });

      const secondToken = jwt.sign(
        { userId: 'second-user', username: 'Second User' },
        TEST_JWT_SECRET,
        { expiresIn: '1h' }
      );

      secondClient.emit('authenticate', {
        token: secondToken,
        userId: 'second-user'
      });

      secondClient.on('authenticated', () => {
        secondClient.emit('join-room', {
          threatModelId: TEST_THREAT_MODEL_ID
        });
      });

      secondClient.on('room-joined', () => {
        // First client starts typing
        clientSocket.emit('typing-start', typingData);
      });

      // Second client should receive typing indicator
      secondClient.on('user-typing', (data) => {
        expect(data.userId).toBe(TEST_USER_ID);
        expect(data.elementId).toBe(typingData.elementId);
        expect(data.elementType).toBe(typingData.elementType);
        
        // First client stops typing
        clientSocket.emit('typing-stop', {
          elementId: typingData.elementId
        });
      });

      secondClient.on('user-stopped-typing', (data) => {
        expect(data.userId).toBe(TEST_USER_ID);
        expect(data.elementId).toBe(typingData.elementId);
        secondClient.disconnect();
        done();
      });
    });
  });

  describe('Selection Management', () => {
    beforeEach((done) => {
      // Authenticate and join room
      clientSocket.emit('authenticate', {
        token: validToken,
        userId: TEST_USER_ID
      });

      clientSocket.on('authenticated', () => {
        clientSocket.emit('join-room', {
          threatModelId: TEST_THREAT_MODEL_ID
        });
      });

      clientSocket.on('room-joined', () => {
        done();
      });
    });

    it('should broadcast selection changes', (done) => {
      const selectionData = {
        elementIds: ['element-1', 'element-2'],
        action: 'select'
      };

      // Create second client to receive selection update
      const secondClient = ioClient(`http://localhost:${TEST_PORT}`, {
        transports: ['websocket']
      });

      const secondToken = jwt.sign(
        { userId: 'second-user', username: 'Second User' },
        TEST_JWT_SECRET,
        { expiresIn: '1h' }
      );

      secondClient.emit('authenticate', {
        token: secondToken,
        userId: 'second-user'
      });

      secondClient.on('authenticated', () => {
        secondClient.emit('join-room', {
          threatModelId: TEST_THREAT_MODEL_ID
        });
      });

      secondClient.on('room-joined', () => {
        // First client selects elements
        clientSocket.emit('selection-change', selectionData);
      });

      // Second client should receive selection update
      secondClient.on('selection-updated', (data) => {
        expect(data.userId).toBe(TEST_USER_ID);
        expect(data.elementIds).toEqual(selectionData.elementIds);
        expect(data.action).toBe(selectionData.action);
        secondClient.disconnect();
        done();
      });
    });
  });

  describe('Error Handling', () => {
    beforeEach((done) => {
      // Authenticate and join room
      clientSocket.emit('authenticate', {
        token: validToken,
        userId: TEST_USER_ID
      });

      clientSocket.on('authenticated', () => {
        clientSocket.emit('join-room', {
          threatModelId: TEST_THREAT_MODEL_ID
        });
      });

      clientSocket.on('room-joined', () => {
        done();
      });
    });

    it('should handle operation timeout', (done) => {
      // Send an operation that will timeout
      const operation = {
        type: 'slow_operation',
        threatModelId: TEST_THREAT_MODEL_ID,
        userId: TEST_USER_ID,
        timestamp: new Date(),
        data: {}
      };

      clientSocket.emit('threat-model-operation', operation);

      clientSocket.on('operation-timeout', (data) => {
        expect(data.operationId).toBeDefined();
        done();
      });
    });

    it('should handle rate limiting', (done) => {
      let operationsSent = 0;
      const maxOperations = 200; // Exceed rate limit

      clientSocket.on('rate-limit-exceeded', (data) => {
        expect(data.message).toBeDefined();
        expect(data.retryAfter).toBeDefined();
        done();
      });

      // Send many operations quickly
      const sendOperation = () => {
        clientSocket.emit('threat-model-operation', {
          type: 'create_component',
          threatModelId: TEST_THREAT_MODEL_ID,
          userId: TEST_USER_ID,
          timestamp: new Date(),
          data: { name: `Component ${operationsSent}` }
        });

        operationsSent++;
        if (operationsSent < maxOperations) {
          setImmediate(sendOperation);
        }
      };

      sendOperation();
    });
  });

  describe('Heartbeat', () => {
    beforeEach((done) => {
      // Authenticate and join room
      clientSocket.emit('authenticate', {
        token: validToken,
        userId: TEST_USER_ID
      });

      clientSocket.on('authenticated', () => {
        done();
      });
    });

    it('should respond to heartbeat', (done) => {
      clientSocket.emit('heartbeat', {
        timestamp: Date.now()
      });

      clientSocket.on('heartbeat-response', (data) => {
        expect(data.timestamp).toBeDefined();
        expect(data.serverTime).toBeDefined();
        done();
      });
    });
  });
});