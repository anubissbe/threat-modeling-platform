import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { config } from 'dotenv';

// Load environment variables
config();

const app = express();
const server = createServer(app);

// Initialize Socket.IO
const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3006',
    methods: ["GET", "POST"],
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ['websocket', 'polling']
});

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3006',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'collaboration-service',
    version: '1.0.0',
    websocket: 'ready'
  });
});

// API endpoints
app.get('/api/collaboration/stats', (req, res) => {
  res.json({
    activeUsers: io.sockets.sockets.size,
    activeRooms: io.sockets.adapter.rooms.size,
    totalConnections: io.sockets.sockets.size
  });
});

app.post('/api/collaboration/broadcast/:roomId', (req, res) => {
  const { roomId } = req.params;
  const { event, data } = req.body;
  
  io.to(roomId).emit(event, data);
  res.json({ success: true });
});

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // Authentication
  socket.on('authenticate', (data: { token: string, userId: string }) => {
    // In production, validate JWT token here
    console.log(`User ${data.userId} authenticated`);
    socket.emit('authenticated', { success: true });
  });

  // Join room
  socket.on('join-room', (data: { threatModelId: string }) => {
    const roomId = `threat-model-${data.threatModelId}`;
    socket.join(roomId);
    socket.to(roomId).emit('user-joined', { userId: 'user-' + socket.id });
    console.log(`Socket ${socket.id} joined room ${roomId}`);
  });

  // Handle cursor movement
  socket.on('cursor-move', (data: { position: any }) => {
    socket.broadcast.emit('cursor-updated', {
      userId: socket.id,
      position: data.position
    });
  });

  // Handle typing indicators
  socket.on('typing-start', (data: { elementId: string }) => {
    socket.broadcast.emit('user-typing', {
      userId: socket.id,
      elementId: data.elementId
    });
  });

  socket.on('typing-stop', (data: { elementId: string }) => {
    socket.broadcast.emit('user-stopped-typing', {
      userId: socket.id,
      elementId: data.elementId
    });
  });

  // Handle document operations
  socket.on('document-operation', (data: any) => {
    socket.broadcast.emit('document-operation', {
      ...data,
      userId: socket.id,
      timestamp: new Date()
    });
  });

  // Handle comments
  socket.on('add-comment', (data: { elementId: string, comment: string }) => {
    socket.broadcast.emit('comment-added', {
      ...data,
      userId: socket.id,
      timestamp: new Date()
    });
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

// Error handling
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: `Route ${req.originalUrl} not found`
  });
});

// Start server
const PORT = process.env.PORT || 3012;

server.listen(PORT, () => {
  console.log(`Collaboration service listening on port ${PORT}`);
  console.log(`WebSocket server ready for connections`);
});

export default app;