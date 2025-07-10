import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Box, Paper, Typography, Avatar, Chip, Tooltip, IconButton, Menu, MenuItem } from '@mui/material';
import { 
  People as PeopleIcon, 
  Chat as ChatIcon, 
  Sync as SyncIcon,
  Warning as WarningIcon,
  Check as CheckIcon,
  MoreVert as MoreVertIcon
} from '@mui/icons-material';
import { io, Socket } from 'socket.io-client';
import { UserPresence, ThreatModelOperation, CollaborationEvent, ConflictInfo } from '../../types/collaboration';
import { CollaborationService } from '../../services/collaborationService';
import ConflictResolutionDialog from './ConflictResolutionDialog';
import UserPresenceIndicator from './UserPresenceIndicator';
import CommentSystem from './CommentSystem';
import RealtimeNotifications from './RealtimeNotifications';

interface CollaborativeCanvasProps {
  threatModelId: string;
  userId: string;
  userToken: string;
  onStateChange: (newState: any) => void;
  onConflictDetected: (conflict: ConflictInfo) => void;
  className?: string;
}

interface CursorInfo {
  userId: string;
  username: string;
  position: { x: number; y: number };
  color: string;
  elementId?: string | undefined;
}

const CollaborativeCanvas: React.FC<CollaborativeCanvasProps> = ({
  threatModelId,
  userId,
  userToken,
  onStateChange,
  onConflictDetected,
  className
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [activeUsers, setActiveUsers] = useState<UserPresence[]>([]);
  const [cursors, setCursors] = useState<Map<string, CursorInfo>>(new Map());
  const [conflictDialog, setConflictDialog] = useState<{
    open: boolean;
    operationId: string;
    conflict: ConflictInfo;
    suggestions: string[];
  } | null>(null);
  const [typingUsers, setTypingUsers] = useState<Map<string, { username: string; elementId: string }>>(new Map());
  const [selectedElements, setSelectedElements] = useState<Set<string>>(new Set());
  const [collaborationService] = useState(() => new CollaborationService(threatModelId, userId, userToken));
  const [showComments, setShowComments] = useState(false);
  const [userMenuAnchor, setUserMenuAnchor] = useState<HTMLElement | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting');

  // User colors for cursors and selections
  const userColors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'];

  useEffect(() => {
    initializeSocket();
    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, []);

  const initializeSocket = useCallback(() => {
    const newSocket = io(process.env.REACT_APP_WEBSOCKET_URL || 'http://localhost:3001', {
      transports: ['websocket'],
      timeout: 20000,
    });

    newSocket.on('connect', () => {
      setIsConnected(true);
      setConnectionStatus('connected');
      
      // Authenticate
      newSocket.emit('authenticate', { token: userToken, userId });
    });

    newSocket.on('authenticated', (data: { success: boolean; error?: string }) => {
      if (data.success) {
        // Join threat model room
        newSocket.emit('join-room', { threatModelId });
      } else {
        console.error('Authentication failed:', data.error);
        setConnectionStatus('error');
      }
    });

    newSocket.on('room-users', (users: UserPresence[]) => {
      setActiveUsers(users);
      users.forEach((user, index) => {
        if (user.cursor) {
          setCursors(prev => new Map(prev).set(user.userId, {
            userId: user.userId,
            username: user.username,
            position: user.cursor!,
            color: userColors[index % userColors.length],
            elementId: user.cursor!.elementId || undefined
          }));
        }
      });
    });

    newSocket.on('user-joined', (user: UserPresence) => {
      setActiveUsers(prev => [...prev, user]);
      collaborationService.showNotification(`${user.username} joined the session`, 'info');
    });

    newSocket.on('user-left', (data: { userId: string; username: string }) => {
      setActiveUsers(prev => prev.filter(u => u.userId !== data.userId));
      setCursors(prev => {
        const newCursors = new Map(prev);
        newCursors.delete(data.userId);
        return newCursors;
      });
      collaborationService.showNotification(`${data.username} left the session`, 'info');
    });

    newSocket.on('cursor-updated', (data: { userId: string; position: { x: number; y: number; elementId?: string } }) => {
      const user = activeUsers.find(u => u.userId === data.userId);
      if (user) {
        const userIndex = activeUsers.findIndex(u => u.userId === data.userId);
        setCursors(prev => new Map(prev).set(data.userId, {
          userId: data.userId,
          username: user.username,
          position: data.position,
          color: userColors[userIndex % userColors.length],
          elementId: data.position.elementId || undefined
        }));
      }
    });

    newSocket.on('collaboration-event', (event: CollaborationEvent) => {
      handleCollaborationEvent(event);
    });

    newSocket.on('conflict-detected', (data: {
      operationId: string;
      conflict: ConflictInfo;
      suggestions: string[];
    }) => {
      setConflictDialog({
        open: true,
        operationId: data.operationId,
        conflict: data.conflict,
        suggestions: data.suggestions
      });
      onConflictDetected(data.conflict);
    });

    newSocket.on('conflict-resolved', (data: {
      operationId: string;
      resolution: string;
      result: any;
    }) => {
      setConflictDialog(null);
      onStateChange(data.result);
      collaborationService.showNotification(`Conflict resolved: ${data.resolution}`, 'success');
    });

    newSocket.on('user-typing', (data: { userId: string; username: string; elementId: string; elementType: string }) => {
      setTypingUsers(prev => new Map(prev).set(data.userId, {
        username: data.username,
        elementId: data.elementId
      }));
    });

    newSocket.on('user-stopped-typing', (data: { userId: string; elementId: string }) => {
      setTypingUsers(prev => {
        const newTyping = new Map(prev);
        newTyping.delete(data.userId);
        return newTyping;
      });
    });

    newSocket.on('selection-updated', (data: {
      userId: string;
      username: string;
      elementIds: string[];
      action: 'select' | 'deselect';
    }) => {
      // Handle remote selections
      collaborationService.handleRemoteSelection(data);
    });

    newSocket.on('comment-added', (data: any) => {
      collaborationService.showNotification(`${data.username} added a comment`, 'info');
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
      setConnectionStatus('disconnected');
    });

    newSocket.on('error', (error: any) => {
      console.error('Socket error:', error);
      setConnectionStatus('error');
    });

    setSocket(newSocket);
  }, [threatModelId, userId, userToken, activeUsers, onStateChange, onConflictDetected]);

  const handleCollaborationEvent = useCallback((event: CollaborationEvent) => {
    switch (event.type) {
      case 'operation':
        // Apply the operation to the local state
        onStateChange(event.data.result);
        break;
      
      case 'cursor-move':
        // Update cursor position
        const user = activeUsers.find(u => u.userId === event.userId);
        if (user) {
          const userIndex = activeUsers.findIndex(u => u.userId === event.userId);
          setCursors(prev => new Map(prev).set(event.userId, {
            userId: event.userId,
            username: user.username,
            position: event.data.position,
            color: userColors[userIndex % userColors.length],
            elementId: event.data.position.elementId
          }));
        }
        break;
      
      default:
        console.log('Unknown collaboration event:', event);
    }
  }, [activeUsers, onStateChange]);

  const handleMouseMove = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (socket && isConnected) {
      const canvas = canvasRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        socket.emit('cursor-move', {
          position: { x, y }
        });
      }
    }
  }, [socket, isConnected]);

  const handleElementClick = useCallback((elementId: string) => {
    if (socket && isConnected) {
      socket.emit('selection-change', {
        elementIds: [elementId],
        action: 'select'
      });
    }
  }, [socket, isConnected]);

  const handleOperation = useCallback((operation: ThreatModelOperation) => {
    if (socket && isConnected) {
      socket.emit('threat-model-operation', operation);
    }
  }, [socket, isConnected]);

  const handleTypingStart = useCallback((elementId: string, elementType: string) => {
    if (socket && isConnected) {
      socket.emit('typing-start', { elementId, elementType });
    }
  }, [socket, isConnected]);

  const handleTypingStop = useCallback((elementId: string) => {
    if (socket && isConnected) {
      socket.emit('typing-stop', { elementId });
    }
  }, [socket, isConnected]);

  const handleConflictResolution = useCallback((
    operationId: string,
    resolution: 'accept' | 'reject' | 'merge',
    mergeData?: any
  ) => {
    if (socket && isConnected) {
      socket.emit('resolve-conflict', {
        operationId,
        resolution,
        mergeData
      });
      setConflictDialog(null);
    }
  }, [socket, isConnected]);

  const handleAddComment = useCallback((elementId: string, comment: string, position?: { x: number; y: number }) => {
    if (socket && isConnected) {
      socket.emit('add-comment', {
        threatModelId,
        elementId,
        comment,
        position
      });
    }
  }, [socket, isConnected, threatModelId]);

  const renderCursors = () => {
    return Array.from(cursors.values()).map(cursor => (
      <Box
        key={cursor.userId}
        sx={{
          position: 'absolute',
          left: cursor.position.x,
          top: cursor.position.y,
          pointerEvents: 'none',
          zIndex: 1000,
          transform: 'translate(-50%, -50%)'
        }}
      >
        <Box
          sx={{
            width: 12,
            height: 12,
            borderRadius: '50%',
            backgroundColor: cursor.color,
            border: '2px solid white',
            boxShadow: '0 0 4px rgba(0,0,0,0.3)'
          }}
        />
        <Typography
          variant="caption"
          sx={{
            position: 'absolute',
            top: -30,
            left: 15,
            backgroundColor: cursor.color,
            color: 'white',
            padding: '2px 6px',
            borderRadius: '4px',
            fontSize: '10px',
            whiteSpace: 'nowrap'
          }}
        >
          {cursor.username}
        </Typography>
      </Box>
    ));
  };

  const renderTypingIndicators = () => {
    return Array.from(typingUsers.values()).map((typing, index) => (
      <Chip
        key={index}
        label={`${typing.username} is typing...`}
        size="small"
        sx={{
          position: 'absolute',
          top: 60 + (index * 35),
          right: 20,
          backgroundColor: 'rgba(0,0,0,0.7)',
          color: 'white',
          zIndex: 1000
        }}
      />
    ));
  };

  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'success';
      case 'connecting': return 'warning';
      case 'disconnected': return 'error';
      case 'error': return 'error';
      default: return 'default';
    }
  };

  const getConnectionStatusText = () => {
    switch (connectionStatus) {
      case 'connected': return 'Connected';
      case 'connecting': return 'Connecting...';
      case 'disconnected': return 'Disconnected';
      case 'error': return 'Connection Error';
      default: return 'Unknown';
    }
  };

  return (
    <Paper className={className || ''} sx={{ position: 'relative', height: '100%', overflow: 'hidden' }}>
      {/* Collaboration Header */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 60,
          backgroundColor: 'rgba(255,255,255,0.95)',
          borderBottom: '1px solid #e0e0e0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          zIndex: 500
        }}
      >
        <Box display="flex" alignItems="center">
          <Chip
            icon={connectionStatus === 'connected' ? <CheckIcon /> : <SyncIcon />}
            label={getConnectionStatusText()}
            color={getConnectionStatusColor()}
            size="small"
            sx={{ mr: 2 }}
          />
          
          <Box display="flex" alignItems="center">
            <PeopleIcon sx={{ mr: 1 }} />
            <Typography variant="body2" sx={{ mr: 2 }}>
              {activeUsers.length} active
            </Typography>
            
            <Box display="flex" alignItems="center">
              {activeUsers.slice(0, 5).map((user, index) => (
                <Tooltip key={user.userId} title={user.username}>
                  <Avatar
                    src={user.avatar || ''}
                    sx={{
                      width: 32,
                      height: 32,
                      ml: index > 0 ? -1 : 0,
                      border: '2px solid white',
                      backgroundColor: userColors[index % userColors.length]
                    }}
                  >
                    {user.username.charAt(0).toUpperCase()}
                  </Avatar>
                </Tooltip>
              ))}
              
              {activeUsers.length > 5 && (
                <Typography variant="caption" sx={{ ml: 1 }}>
                  +{activeUsers.length - 5} more
                </Typography>
              )}
            </Box>
          </Box>
        </Box>

        <Box display="flex" alignItems="center">
          <IconButton
            size="small"
            onClick={() => setShowComments(!showComments)}
            color={showComments ? 'primary' : 'default'}
          >
            <ChatIcon />
          </IconButton>
          
          <IconButton
            size="small"
            onClick={(e) => setUserMenuAnchor(e.currentTarget)}
          >
            <MoreVertIcon />
          </IconButton>
        </Box>
      </Box>

      {/* Main Canvas */}
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        style={{
          position: 'absolute',
          top: 60,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          height: 'calc(100% - 60px)',
          cursor: 'crosshair'
        }}
      />

      {/* User Cursors */}
      {renderCursors()}

      {/* Typing Indicators */}
      {renderTypingIndicators()}

      {/* User Presence Indicators */}
      <UserPresenceIndicator
        users={activeUsers}
        currentUserId={userId}
        onUserClick={handleElementClick}
      />

      {/* Comment System */}
      {showComments && (
        <CommentSystem
          threatModelId={threatModelId}
          onAddComment={handleAddComment}
          onClose={() => setShowComments(false)}
          currentUserId={userId}
          currentUsername="Current User"
        />
      )}

      {/* Conflict Resolution Dialog */}
      {conflictDialog && (
        <ConflictResolutionDialog
          open={conflictDialog.open}
          operationId={conflictDialog.operationId}
          conflict={conflictDialog.conflict}
          suggestions={conflictDialog.suggestions}
          onResolve={handleConflictResolution}
          onCancel={() => setConflictDialog(null)}
        />
      )}

      {/* Real-time Notifications */}
      <RealtimeNotifications />

      {/* User Menu */}
      <Menu
        anchorEl={userMenuAnchor}
        open={Boolean(userMenuAnchor)}
        onClose={() => setUserMenuAnchor(null)}
      >
        <MenuItem onClick={() => collaborationService.exportCollaborationData()}>
          Export Session Data
        </MenuItem>
        <MenuItem onClick={() => collaborationService.showSessionStats()}>
          Show Session Stats
        </MenuItem>
        <MenuItem onClick={() => collaborationService.managePermissions()}>
          Manage Permissions
        </MenuItem>
      </Menu>
    </Paper>
  );
};

export default CollaborativeCanvas;