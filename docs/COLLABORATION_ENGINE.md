# Real-Time Multi-User Collaboration Engine

## Overview

The Real-Time Multi-User Collaboration Engine enables seamless, real-time collaboration on threat models, allowing multiple users to work together simultaneously with advanced conflict resolution, live editing, and comprehensive communication features.

## 🚀 Features

### Core Capabilities
- **Real-time WebSocket Communication**: Instant synchronization across all connected users
- **Shared Live Cursors**: See where other users are working in real-time
- **Conflict Resolution System**: Intelligent conflict detection and resolution strategies
- **User Presence Indicators**: Visual indicators of active collaborators
- **Comment System**: Contextual commenting with threading and mentions
- **Real-time Notifications**: Instant alerts for all collaboration activities
- **Typing Indicators**: Live typing status for enhanced user experience
- **Selection Sharing**: See what elements other users have selected
- **Activity Logging**: Comprehensive audit trail of all collaboration events

### Advanced Features
- **Operational Transformation**: Seamless concurrent editing without conflicts
- **Distributed Locking**: Prevents editing conflicts with Redis-based locking
- **Circuit Breaker Pattern**: Resilient external service connections
- **Batch Operations**: Optimized performance for high-frequency operations
- **Auto-reconnection**: Automatic recovery from network disruptions
- **Rate Limiting**: Protection against spam and abuse
- **Permission System**: Role-based access control for collaborative features

## 🏗️ Architecture

### Backend Services

#### WebSocket Service (`/backend/services/collaboration/src/services/websocket.service.ts`)
- **Purpose**: Core real-time communication hub
- **Features**:
  - JWT-based authentication
  - Room-based collaboration sessions
  - Cursor tracking and broadcasting
  - Operation synchronization
  - Conflict detection and resolution
  - User presence management

#### Conflict Resolution Service (`/backend/services/collaboration/src/services/conflict-resolution.service.ts`)
- **Purpose**: Intelligent conflict detection and resolution
- **Strategies**:
  - **Accept**: Force apply changes (overwrite conflicts)
  - **Reject**: Cancel changes (keep current state)
  - **Merge**: Combine changes using various strategies
    - Keep both versions
    - Prefer user's changes
    - Prefer existing changes
    - Custom merge logic

#### Permission Service (`/backend/services/collaboration/src/services/permission.service.ts`)
- **Purpose**: Role-based access control
- **Roles**:
  - **Owner**: Full permissions
  - **Editor**: Create, edit, comment, analyze
  - **Viewer**: Read-only access
  - **Commenter**: View and comment only

### Frontend Components

#### CollaborativeCanvas (`/frontend/src/components/Collaboration/CollaborativeCanvas.tsx`)
- **Purpose**: Main collaboration interface
- **Features**:
  - Real-time cursor rendering
  - WebSocket connection management
  - Operation broadcasting
  - Conflict dialog integration
  - User presence display

#### ConflictResolutionDialog (`/frontend/src/components/Collaboration/ConflictResolutionDialog.tsx`)
- **Purpose**: Interactive conflict resolution interface
- **Features**:
  - Visual conflict representation
  - Multiple resolution strategies
  - AI-powered suggestions
  - Technical details expansion
  - User-friendly conflict explanations

#### UserPresenceIndicator (`/frontend/src/components/Collaboration/UserPresenceIndicator.tsx`)
- **Purpose**: Visual user presence and status
- **Features**:
  - Avatar stacking for multiple users
  - Status indicators (online, away, busy, offline)
  - Permission badges
  - User interaction menus
  - Responsive design for different screen sizes

#### CommentSystem (`/frontend/src/components/Collaboration/CommentSystem.tsx`)
- **Purpose**: Contextual commenting and discussions
- **Features**:
  - Threaded comments and replies
  - Mentions and notifications
  - Comment filtering and sorting
  - Emoji and rich text support
  - Comment resolution workflow

#### RealtimeNotifications (`/frontend/src/components/Collaboration/RealtimeNotifications.tsx`)
- **Purpose**: Real-time notification system
- **Features**:
  - Audio notifications with different sounds
  - Visual notification stacking
  - Notification history
  - Configurable notification types
  - Priority-based styling

#### CollaborationService (`/frontend/src/services/collaborationService.ts`)
- **Purpose**: Client-side collaboration logic
- **Features**:
  - WebSocket connection management
  - Operation queuing and batching
  - Automatic reconnection
  - Metrics collection
  - Error handling and recovery

## 🔧 Configuration

### Environment Variables

```bash
# WebSocket Configuration
WEBSOCKET_PORT=3001
WEBSOCKET_HOST=localhost
WEBSOCKET_PATH=/socket.io

# Redis Configuration (for distributed locking)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT Configuration
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=24h

# Rate Limiting
RATE_LIMIT_WINDOW=60000  # 1 minute
RATE_LIMIT_MAX=100       # 100 requests per minute

# Conflict Resolution
CONFLICT_RESOLUTION_TIMEOUT=30000  # 30 seconds
LOCK_TIMEOUT=10000                 # 10 seconds
```

### Frontend Configuration

```typescript
// CollaborationService configuration
const config: CollaborationServiceConfig = {
  websocketUrl: 'ws://localhost:3001',
  autoReconnect: true,
  reconnectAttempts: 5,
  reconnectDelay: 1000,
  heartbeatInterval: 30000,
  operationTimeout: 10000,
  batchOperations: true,
  batchDelay: 100
};
```

## 🚦 Usage

### Basic Integration

```typescript
import { CollaborativeCanvas } from './components/Collaboration/CollaborativeCanvas';

function ThreatModelEditor() {
  const [threatModelState, setThreatModelState] = useState<ThreatModelState>();
  
  const handleStateChange = (newState: ThreatModelState) => {
    setThreatModelState(newState);
  };
  
  const handleConflictDetected = (conflict: ConflictInfo) => {
    console.log('Conflict detected:', conflict);
  };
  
  return (
    <CollaborativeCanvas
      threatModelId="threat-model-123"
      userId="user-456"
      userToken="jwt-token"
      onStateChange={handleStateChange}
      onConflictDetected={handleConflictDetected}
    />
  );
}
```

### Advanced Usage with Custom Callbacks

```typescript
import { CollaborationService } from './services/collaborationService';

const collaborationService = new CollaborationService(
  'threat-model-123',
  'user-456',
  'jwt-token',
  {
    websocketUrl: 'ws://localhost:3001',
    autoReconnect: true,
    batchOperations: true
  },
  {
    onUserJoined: (user) => console.log('User joined:', user.username),
    onUserLeft: (data) => console.log('User left:', data.username),
    onConflictDetected: (conflict) => handleConflict(conflict),
    onOperationApplied: (operation) => applyOperation(operation)
  }
);

// Perform operations
collaborationService.performOperation({
  type: 'create_component',
  threatModelId: 'threat-model-123',
  userId: 'user-456',
  data: { name: 'New Component', type: 'process' }
});
```

## 📊 Monitoring and Metrics

### Collaboration Metrics

```typescript
const metrics = collaborationService.getMetrics();
console.log('Collaboration Stats:', {
  'Active Users': metrics.activeCollaborators,
  'Total Operations': metrics.totalOperations,
  'Success Rate': (metrics.successfulOperations / metrics.totalOperations * 100).toFixed(1) + '%',
  'Conflict Rate': (metrics.conflictedOperations / metrics.totalOperations * 100).toFixed(1) + '%'
});
```

### Health Monitoring

```bash
# Check WebSocket service health
curl http://localhost:3001/health

# Check collaboration service metrics
curl http://localhost:3001/metrics
```

## 🔒 Security

### Authentication
- JWT-based authentication for WebSocket connections
- Token validation on connection and for each operation
- Session management with automatic token refresh

### Authorization
- Role-based permissions for all collaboration features
- Operation-level access control
- Resource-based permissions (per threat model)

### Data Protection
- Input validation and sanitization
- XSS protection for user content
- Rate limiting to prevent abuse
- Audit logging for all activities

## 🧪 Testing

### Unit Tests
```bash
# Backend service tests
cd backend/services/collaboration
npm test

# Frontend component tests
cd frontend
npm test -- --testPathPattern=Collaboration
```

### Integration Tests
```bash
# WebSocket integration tests
npm run test:integration

# E2E collaboration tests
npm run test:e2e:collaboration
```

### Load Testing
```bash
# Test concurrent user capacity
npm run test:load:collaboration
```

## 📈 Performance

### Optimization Strategies
- **Operation Batching**: Reduces WebSocket message overhead
- **Selective Broadcasting**: Only sends updates to relevant users
- **Efficient Conflict Detection**: Optimized algorithms for large threat models
- **Connection Pooling**: Reuses WebSocket connections
- **Caching**: Redis-based caching for frequently accessed data

### Scaling Considerations
- **Horizontal Scaling**: Multiple WebSocket server instances
- **Load Balancing**: Sticky sessions for WebSocket connections
- **Database Optimization**: Indexed queries for fast conflict detection
- **Memory Management**: Efficient data structures for real-time operations

## 🔧 Troubleshooting

### Common Issues

#### Connection Problems
```bash
# Check WebSocket server status
curl http://localhost:3001/health

# Verify JWT token
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3001/auth/verify
```

#### Conflict Resolution Issues
```bash
# Check Redis connection
redis-cli ping

# Monitor conflict resolution logs
docker logs collaboration-service --tail=100 | grep "conflict"
```

#### Performance Issues
```bash
# Monitor WebSocket metrics
curl http://localhost:3001/metrics | grep websocket

# Check operation queue status
curl http://localhost:3001/status/operations
```

## 🚀 Future Enhancements

### Planned Features
- **Voice and Video Chat**: Integrated communication
- **Screen Sharing**: Share screens during collaboration
- **AI-Powered Suggestions**: Intelligent collaboration assistance
- **Offline Sync**: Work offline and sync when reconnected
- **Mobile Support**: Native mobile collaboration apps
- **Integration APIs**: Connect with external tools and services

### Performance Improvements
- **WebRTC**: Peer-to-peer communication for reduced latency
- **CDN Integration**: Global content distribution
- **Advanced Caching**: Predictive caching strategies
- **Compression**: Message compression for reduced bandwidth

## 📚 API Reference

### WebSocket Events

#### Client → Server
```typescript
// Authentication
socket.emit('authenticate', { token: 'jwt-token', userId: 'user-123' });

// Join collaboration room
socket.emit('join-room', { threatModelId: 'threat-123' });

// Send operation
socket.emit('threat-model-operation', {
  type: 'create_component',
  data: { name: 'Component', type: 'process' }
});

// Update cursor position
socket.emit('cursor-move', { position: { x: 100, y: 200 } });

// Resolve conflict
socket.emit('resolve-conflict', {
  operationId: 'op-123',
  resolution: 'merge',
  mergeData: { strategy: 'keep_both' }
});
```

#### Server → Client
```typescript
// Authentication response
socket.on('authenticated', (data) => {
  console.log('Auth success:', data.success);
});

// User joined room
socket.on('user-joined', (user) => {
  console.log('User joined:', user.username);
});

// Operation applied
socket.on('operation-applied', (operation) => {
  applyOperation(operation);
});

// Conflict detected
socket.on('conflict-detected', (data) => {
  showConflictDialog(data.conflict);
});
```

## 🤝 Contributing

### Development Setup
```bash
# Install dependencies
npm install

# Start development servers
npm run dev:collaboration

# Run tests
npm run test:collaboration

# Build for production
npm run build:collaboration
```

### Code Style
- Follow TypeScript best practices
- Use ESLint and Prettier configurations
- Write comprehensive tests for new features
- Document all public APIs

---

**The Real-Time Multi-User Collaboration Engine transforms threat modeling from a solo activity into a collaborative experience, enabling teams to work together seamlessly while maintaining data integrity and providing comprehensive conflict resolution capabilities.**