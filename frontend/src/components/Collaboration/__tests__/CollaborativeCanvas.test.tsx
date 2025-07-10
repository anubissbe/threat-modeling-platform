import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import CollaborativeCanvas from '../CollaborativeCanvas';
import { io } from 'socket.io-client';

// Mock socket.io-client
vi.mock('socket.io-client', () => ({
  io: vi.fn()
}));

// Mock CollaborationService
vi.mock('../../../services/collaborationService', () => ({
  CollaborationService: vi.fn().mockImplementation(() => ({
    showNotification: vi.fn(),
    handleRemoteSelection: vi.fn(),
    exportCollaborationData: vi.fn(),
    showSessionStats: vi.fn(),
    managePermissions: vi.fn()
  }))
}));

describe('CollaborativeCanvas', () => {
  const mockSocket = {
    on: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
    connected: true,
    disconnected: false
  };

  const defaultProps = {
    threatModelId: 'test-model-123',
    userId: 'test-user-456',
    userToken: 'test-token',
    onStateChange: vi.fn(),
    onConflictDetected: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (io as any).mockReturnValue(mockSocket);
  });

  it('should render collaboration canvas', () => {
    render(<CollaborativeCanvas {...defaultProps} />);
    
    expect(screen.getByText(/active/i)).toBeInTheDocument();
  });

  it('should establish WebSocket connection on mount', () => {
    render(<CollaborativeCanvas {...defaultProps} />);
    
    expect(io).toHaveBeenCalledWith(
      expect.stringContaining('localhost:3001'),
      expect.objectContaining({
        transports: ['websocket'],
        timeout: 20000
      })
    );
  });

  it('should authenticate when connected', () => {
    render(<CollaborativeCanvas {...defaultProps} />);
    
    // Simulate connection
    const connectCallback = mockSocket.on.mock.calls.find(call => call[0] === 'connect')?.[1];
    connectCallback?.();
    
    expect(mockSocket.emit).toHaveBeenCalledWith('authenticate', {
      token: 'test-token',
      userId: 'test-user-456'
    });
  });

  it('should join room after authentication', () => {
    render(<CollaborativeCanvas {...defaultProps} />);
    
    // Simulate authentication success
    const authCallback = mockSocket.on.mock.calls.find(call => call[0] === 'authenticated')?.[1];
    authCallback?.({ success: true });
    
    expect(mockSocket.emit).toHaveBeenCalledWith('join-room', {
      threatModelId: 'test-model-123'
    });
  });

  it('should handle user joined events', () => {
    render(<CollaborativeCanvas {...defaultProps} />);
    
    // Simulate user joined
    const userJoinedCallback = mockSocket.on.mock.calls.find(call => call[0] === 'user-joined')?.[1];
    userJoinedCallback?.({
      userId: 'new-user',
      username: 'New User',
      avatar: null,
      status: 'online',
      lastSeen: new Date(),
      currentRoom: 'test-model-123',
      cursor: null,
      permissions: { canEdit: true, role: 'editor' }
    });
    
    // Check if notification was shown
    expect(screen.getByText(/active/i)).toBeInTheDocument();
  });

  it('should handle cursor movement', () => {
    const { container } = render(<CollaborativeCanvas {...defaultProps} />);
    
    const canvas = container.querySelector('canvas');
    expect(canvas).toBeInTheDocument();
    
    fireEvent.mouseMove(canvas!, {
      clientX: 100,
      clientY: 200
    });
    
    // Should emit cursor position
    expect(mockSocket.emit).toHaveBeenCalledWith('cursor-move', {
      position: expect.objectContaining({
        x: expect.any(Number),
        y: expect.any(Number)
      })
    });
  });

  it('should handle conflict detection', () => {
    render(<CollaborativeCanvas {...defaultProps} />);
    
    const conflictData = {
      operationId: 'op-123',
      conflict: {
        hasConflict: true,
        type: 'concurrent_modification',
        conflictingElements: ['element-1', 'element-2'],
        description: 'Concurrent modification detected'
      },
      suggestions: ['Accept remote changes', 'Keep local changes']
    };
    
    // Simulate conflict
    const conflictCallback = mockSocket.on.mock.calls.find(call => call[0] === 'conflict-detected')?.[1];
    conflictCallback?.(conflictData);
    
    expect(defaultProps.onConflictDetected).toHaveBeenCalledWith(conflictData.conflict);
  });

  it('should toggle comment system', () => {
    render(<CollaborativeCanvas {...defaultProps} />);
    
    const chatButton = screen.getByRole('button', { name: /chat/i });
    fireEvent.click(chatButton);
    
    // Comment system should be visible
    expect(screen.getByText('Comments')).toBeInTheDocument();
  });

  it('should handle disconnection', () => {
    render(<CollaborativeCanvas {...defaultProps} />);
    
    // Simulate disconnection
    const disconnectCallback = mockSocket.on.mock.calls.find(call => call[0] === 'disconnect')?.[1];
    disconnectCallback?.();
    
    // Connection status should update
    expect(screen.getByText(/Disconnected/i)).toBeInTheDocument();
  });

  it('should cleanup on unmount', () => {
    const { unmount } = render(<CollaborativeCanvas {...defaultProps} />);
    
    unmount();
    
    expect(mockSocket.disconnect).toHaveBeenCalled();
  });

  it('should handle remote cursor updates', () => {
    render(<CollaborativeCanvas {...defaultProps} />);
    
    // Set active users first
    const roomUsersCallback = mockSocket.on.mock.calls.find(call => call[0] === 'room-users')?.[1];
    roomUsersCallback?.([
      {
        userId: 'remote-user',
        username: 'Remote User',
        avatar: null,
        status: 'online',
        lastSeen: new Date(),
        currentRoom: 'test-model-123',
        cursor: { x: 150, y: 250 },
        permissions: { canEdit: true, role: 'editor' }
      }
    ]);
    
    // Update cursor position
    const cursorCallback = mockSocket.on.mock.calls.find(call => call[0] === 'cursor-updated')?.[1];
    cursorCallback?.({
      userId: 'remote-user',
      position: { x: 200, y: 300, elementId: 'element-123' }
    });
    
    // Should render remote cursor
    expect(screen.getByText('Remote User')).toBeInTheDocument();
  });

  it('should handle collaboration events', () => {
    render(<CollaborativeCanvas {...defaultProps} />);
    
    const event = {
      id: 'event-123',
      type: 'operation',
      userId: 'test-user',
      timestamp: new Date(),
      data: {
        result: { components: [], threats: [] }
      }
    };
    
    // Simulate collaboration event
    const eventCallback = mockSocket.on.mock.calls.find(call => call[0] === 'collaboration-event')?.[1];
    eventCallback?.(event);
    
    expect(defaultProps.onStateChange).toHaveBeenCalledWith(event.data.result);
  });

  it('should handle typing indicators', () => {
    render(<CollaborativeCanvas {...defaultProps} />);
    
    // Simulate typing start
    const typingCallback = mockSocket.on.mock.calls.find(call => call[0] === 'user-typing')?.[1];
    typingCallback?.({
      userId: 'typing-user',
      username: 'Typing User',
      elementId: 'element-123',
      elementType: 'component'
    });
    
    // Should show typing indicator
    expect(screen.getByText(/Typing User is typing.../i)).toBeInTheDocument();
    
    // Simulate typing stop
    const stopTypingCallback = mockSocket.on.mock.calls.find(call => call[0] === 'user-stopped-typing')?.[1];
    stopTypingCallback?.({
      userId: 'typing-user',
      elementId: 'element-123'
    });
    
    // Typing indicator should be removed
    expect(screen.queryByText(/Typing User is typing.../i)).not.toBeInTheDocument();
  });

  it('should handle selection updates', () => {
    render(<CollaborativeCanvas {...defaultProps} />);
    
    const selectionData = {
      userId: 'selecting-user',
      username: 'Selecting User',
      elementIds: ['element-1', 'element-2'],
      action: 'select' as const
    };
    
    // Simulate selection update
    const selectionCallback = mockSocket.on.mock.calls.find(call => call[0] === 'selection-updated')?.[1];
    selectionCallback?.(selectionData);
    
    // Should handle remote selection through collaboration service
    // (actual rendering would depend on the diagram implementation)
  });

  it('should export collaboration data', async () => {
    render(<CollaborativeCanvas {...defaultProps} />);
    
    // Open menu
    const menuButton = screen.getAllByRole('button').find(btn => 
      btn.querySelector('[data-testid="MoreVertIcon"]')
    );
    fireEvent.click(menuButton!);
    
    // Click export option
    const exportButton = await screen.findByText('Export Session Data');
    fireEvent.click(exportButton);
    
    // Should trigger export
    // (actual export would create a file download)
  });

  it('should handle connection errors', () => {
    render(<CollaborativeCanvas {...defaultProps} />);
    
    // Simulate error
    const errorCallback = mockSocket.on.mock.calls.find(call => call[0] === 'error')?.[1];
    errorCallback?.('Connection error');
    
    // Should show error status
    expect(screen.getByText(/Connection Error/i)).toBeInTheDocument();
  });
});