import React, { useState } from 'react';
import {
  Box,
  Avatar,
  Typography,
  Tooltip,
  Badge,
  IconButton,
  Menu,
  MenuItem,
  Divider,
  Chip,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction
} from '@mui/material';
import {
  Circle as CircleIcon,
  MoreVert as MoreVertIcon,
  Message as MessageIcon,
  Block as BlockIcon,
  AdminPanelSettings as AdminIcon,
  Edit as EditIcon,
  Visibility as VisibilityIcon
} from '@mui/icons-material';
import { UserPresence } from '../../types/collaboration';

interface UserPresenceIndicatorProps {
  users: UserPresence[];
  currentUserId: string;
  onUserClick: (userId: string) => void;
  onUserMessage?: (userId: string) => void;
  onUserBlock?: (userId: string) => void;
  onUserPromote?: (userId: string) => void;
  expanded?: boolean;
  showPermissions?: boolean;
  className?: string;
}

interface UserMenuState {
  anchorEl: HTMLElement | null;
  userId: string | null;
}

const UserPresenceIndicator: React.FC<UserPresenceIndicatorProps> = ({
  users,
  currentUserId,
  onUserClick,
  onUserMessage,
  onUserBlock,
  onUserPromote,
  expanded = false,
  showPermissions = false,
  className
}) => {
  const [userMenu, setUserMenu] = useState<UserMenuState>({ anchorEl: null, userId: null });
  const [showAllUsers, setShowAllUsers] = useState(false);

  const getStatusColor = (status: UserPresence['status']) => {
    switch (status) {
      case 'online': return '#4caf50';
      case 'away': return '#ff9800';
      case 'busy': return '#f44336';
      case 'offline': return '#9e9e9e';
      default: return '#9e9e9e';
    }
  };

  const getStatusIcon = (status: UserPresence['status']) => {
    return (
      <CircleIcon
        sx={{
          fontSize: 12,
          color: getStatusColor(status)
        }}
      />
    );
  };

  const getPermissionIcon = (permissions: UserPresence['permissions']) => {
    if (permissions.role === 'owner') return <AdminIcon fontSize="small" color="warning" />;
    if (permissions.canEdit) return <EditIcon fontSize="small" color="primary" />;
    return <VisibilityIcon fontSize="small" color="action" />;
  };

  const getPermissionLabel = (permissions: UserPresence['permissions']) => {
    return permissions.role.charAt(0).toUpperCase() + permissions.role.slice(1);
  };

  const getTimeSinceLastSeen = (lastSeen: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - lastSeen.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const handleUserMenuOpen = (event: React.MouseEvent<HTMLElement>, userId: string) => {
    event.stopPropagation();
    setUserMenu({ anchorEl: event.currentTarget, userId });
  };

  const handleUserMenuClose = () => {
    setUserMenu({ anchorEl: null, userId: null });
  };

  const handleUserAction = (action: 'message' | 'block' | 'promote', userId: string) => {
    switch (action) {
      case 'message':
        onUserMessage?.(userId);
        break;
      case 'block':
        onUserBlock?.(userId);
        break;
      case 'promote':
        onUserPromote?.(userId);
        break;
    }
    handleUserMenuClose();
  };

  const renderUserAvatar = (user: UserPresence, size: 'small' | 'medium' | 'large' = 'medium') => {
    const avatarSize = size === 'small' ? 32 : size === 'medium' ? 40 : 48;
    const isCurrentUser = user.userId === currentUserId;

    return (
      <Badge
        overlap="circular"
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        badgeContent={getStatusIcon(user.status)}
        sx={{
          '& .MuiBadge-badge': {
            backgroundColor: 'white',
            borderRadius: '50%',
            border: '1px solid #e0e0e0',
            padding: '2px'
          }
        }}
      >
        <Avatar
          src={user.avatar || undefined}
          sx={{
            width: avatarSize,
            height: avatarSize,
            border: isCurrentUser ? '2px solid #1976d2' : '2px solid transparent',
            cursor: 'pointer',
            transition: 'all 0.2s ease-in-out',
            '&:hover': {
              transform: 'scale(1.1)',
              border: '2px solid #1976d2'
            }
          }}
          onClick={() => onUserClick(user.userId)}
        >
          {user.username.charAt(0).toUpperCase()}
        </Avatar>
      </Badge>
    );
  };

  const renderCompactView = () => {
    const visibleUsers = users.slice(0, 5);
    const remainingCount = users.length - 5;

    return (
      <Box className={className} display="flex" alignItems="center">
        <Box display="flex" alignItems="center" sx={{ mr: 2 }}>
          {visibleUsers.map((user, index) => (
            <Tooltip
              key={user.userId}
              title={
                <Box>
                  <Typography variant="body2" fontWeight="bold">
                    {user.username}
                  </Typography>
                  <Typography variant="caption">
                    {user.status} • {getTimeSinceLastSeen(user.lastSeen)}
                  </Typography>
                  {showPermissions && (
                    <Typography variant="caption" display="block">
                      {getPermissionLabel(user.permissions)}
                    </Typography>
                  )}
                </Box>
              }
            >
              <Box
                sx={{
                  ml: index > 0 ? -1 : 0,
                  zIndex: visibleUsers.length - index
                }}
              >
                {renderUserAvatar(user, 'small')}
              </Box>
            </Tooltip>
          ))}
        </Box>

        {remainingCount > 0 && (
          <Chip
            label={`+${remainingCount}`}
            size="small"
            onClick={() => setShowAllUsers(true)}
            sx={{ cursor: 'pointer' }}
          />
        )}
      </Box>
    );
  };

  const renderExpandedView = () => {
    return (
      <Card className={className} sx={{ minWidth: 300, maxWidth: 400 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Active Users ({users.length})
          </Typography>
          
          <List dense>
            {users.map((user) => (
              <ListItem
                key={user.userId}
                sx={{
                  px: 0,
                  py: 1,
                  borderRadius: 1,
                  '&:hover': {
                    backgroundColor: 'action.hover'
                  }
                }}
              >
                <ListItemAvatar>
                  {renderUserAvatar(user, 'medium')}
                </ListItemAvatar>
                
                <ListItemText
                  primary={
                    <Box display="flex" alignItems="center">
                      <Typography variant="body2" fontWeight="medium">
                        {user.username}
                      </Typography>
                      {user.userId === currentUserId && (
                        <Chip
                          label="You"
                          size="small"
                          color="primary"
                          sx={{ ml: 1, fontSize: '0.7rem' }}
                        />
                      )}
                    </Box>
                  }
                  secondary={
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        {user.status} • {getTimeSinceLastSeen(user.lastSeen)}
                      </Typography>
                      {showPermissions && (
                        <Box display="flex" alignItems="center" sx={{ mt: 0.5 }}>
                          {getPermissionIcon(user.permissions)}
                          <Typography variant="caption" sx={{ ml: 0.5 }}>
                            {getPermissionLabel(user.permissions)}
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  }
                />
                
                {user.userId !== currentUserId && (
                  <ListItemSecondaryAction>
                    <IconButton
                      edge="end"
                      size="small"
                      onClick={(e) => handleUserMenuOpen(e, user.userId)}
                    >
                      <MoreVertIcon />
                    </IconButton>
                  </ListItemSecondaryAction>
                )}
              </ListItem>
            ))}
          </List>
        </CardContent>
      </Card>
    );
  };

  const renderUserMenu = () => {
    if (!userMenu.anchorEl || !userMenu.userId) return null;

    const user = users.find(u => u.userId === userMenu.userId);
    if (!user) return null;

    return (
      <Menu
        anchorEl={userMenu.anchorEl}
        open={Boolean(userMenu.anchorEl)}
        onClose={handleUserMenuClose}
        PaperProps={{
          sx: { minWidth: 150 }
        }}
      >
        <MenuItem onClick={() => handleUserAction('message', user.userId)}>
          <MessageIcon sx={{ mr: 1 }} fontSize="small" />
          Send Message
        </MenuItem>
        
        <MenuItem onClick={() => onUserClick(user.userId)}>
          <VisibilityIcon sx={{ mr: 1 }} fontSize="small" />
          View Profile
        </MenuItem>
        
        <Divider />
        
        {onUserPromote && (
          <MenuItem onClick={() => handleUserAction('promote', user.userId)}>
            <AdminIcon sx={{ mr: 1 }} fontSize="small" />
            Manage Permissions
          </MenuItem>
        )}
        
        {onUserBlock && (
          <MenuItem 
            onClick={() => handleUserAction('block', user.userId)}
            sx={{ color: 'error.main' }}
          >
            <BlockIcon sx={{ mr: 1 }} fontSize="small" />
            Block User
          </MenuItem>
        )}
      </Menu>
    );
  };

  return (
    <>
      {expanded ? renderExpandedView() : renderCompactView()}
      {renderUserMenu()}
    </>
  );
};

export default UserPresenceIndicator;