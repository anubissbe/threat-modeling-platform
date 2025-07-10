import React, { useState, useEffect, useCallback } from 'react';
import {
  Snackbar,
  Alert,
  AlertTitle,
  Box,
  Typography,
  IconButton,
  Slide,
  Fade,
  Paper,
  Badge,
  Avatar,
  Chip,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack
} from '@mui/material';
import {
  Close as CloseIcon,
  Person as PersonIcon,
  Chat as ChatIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Info as InfoIcon,
  Error as ErrorIcon,
  Notifications as NotificationsIcon,
  NotificationsOff as NotificationsOffIcon,
  Clear as ClearIcon,
  Settings as SettingsIcon,
  VolumeUp as VolumeUpIcon,
  VolumeOff as VolumeOffIcon
} from '@mui/icons-material';
import { TransitionProps } from '@mui/material/transitions';
import { formatDistanceToNow } from 'date-fns';

interface NotificationData {
  id: string;
  type: 'user-joined' | 'user-left' | 'operation' | 'conflict' | 'comment' | 'mention' | 'analysis' | 'error' | 'success' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: Date;
  userId?: string;
  username?: string;
  avatar?: string;
  data?: any;
  actions?: NotificationAction[];
  persistent?: boolean;
  sound?: boolean;
  priority?: 'low' | 'medium' | 'high' | 'critical';
}

interface NotificationAction {
  label: string;
  action: () => void;
  color?: 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success';
}

interface RealtimeNotificationsProps {
  maxNotifications?: number;
  autoHideDuration?: number;
  soundEnabled?: boolean;
  position?: {
    vertical: 'top' | 'bottom';
    horizontal: 'left' | 'center' | 'right';
  };
  className?: string;
}

const SlideTransition = React.forwardRef(function Transition(
  props: TransitionProps & {
    children: React.ReactElement<any, any>;
  },
  ref: React.Ref<unknown>,
) {
  return <Slide direction="left" ref={ref} {...props} />;
});

const RealtimeNotifications: React.FC<RealtimeNotificationsProps> = ({
  maxNotifications = 5,
  autoHideDuration = 5000,
  soundEnabled = true,
  position = { vertical: 'top', horizontal: 'right' },
  className
}) => {
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [activeNotifications, setActiveNotifications] = useState<NotificationData[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [soundSettings, setSoundSettings] = useState({
    enabled: soundEnabled,
    volume: 0.5
  });
  const [notificationSettings, setNotificationSettings] = useState({
    showUserJoined: true,
    showUserLeft: true,
    showOperations: true,
    showConflicts: true,
    showComments: true,
    showMentions: true,
    showAnalysis: true,
    showErrors: true,
    showSuccess: true,
    showWarnings: true,
    showInfo: true
  });

  // Audio context for notification sounds
  const audioContext = useCallback(() => {
    if (typeof window !== 'undefined' && window.AudioContext) {
      return new window.AudioContext();
    }
    return null;
  }, []);

  useEffect(() => {
    // Listen for custom notification events
    const handleCustomNotification = (event: CustomEvent<NotificationData>) => {
      addNotification(event.detail);
    };

    window.addEventListener('collaboration-notification', handleCustomNotification as EventListener);
    
    return () => {
      window.removeEventListener('collaboration-notification', handleCustomNotification as EventListener);
    };
  }, []);

  const playNotificationSound = useCallback((type: NotificationData['type']) => {
    if (!soundSettings.enabled) return;

    const ctx = audioContext();
    if (!ctx) return;

    try {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      // Different sounds for different notification types
      switch (type) {
        case 'user-joined':
          oscillator.frequency.setValueAtTime(880, ctx.currentTime);
          oscillator.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);
          break;
        case 'user-left':
          oscillator.frequency.setValueAtTime(660, ctx.currentTime);
          oscillator.frequency.setValueAtTime(440, ctx.currentTime + 0.1);
          break;
        case 'conflict':
        case 'error':
          oscillator.frequency.setValueAtTime(400, ctx.currentTime);
          oscillator.frequency.setValueAtTime(350, ctx.currentTime + 0.1);
          oscillator.frequency.setValueAtTime(300, ctx.currentTime + 0.2);
          break;
        case 'success':
          oscillator.frequency.setValueAtTime(523, ctx.currentTime);
          oscillator.frequency.setValueAtTime(659, ctx.currentTime + 0.1);
          oscillator.frequency.setValueAtTime(784, ctx.currentTime + 0.2);
          break;
        case 'mention':
          oscillator.frequency.setValueAtTime(1000, ctx.currentTime);
          oscillator.frequency.setValueAtTime(1200, ctx.currentTime + 0.05);
          oscillator.frequency.setValueAtTime(1000, ctx.currentTime + 0.1);
          break;
        default:
          oscillator.frequency.setValueAtTime(800, ctx.currentTime);
      }

      gainNode.gain.setValueAtTime(0, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(soundSettings.volume * 0.1, ctx.currentTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.3);
    } catch (error) {
      console.warn('Could not play notification sound:', error);
    }
  }, [soundSettings, audioContext]);

  const addNotification = useCallback((notification: Omit<NotificationData, 'id' | 'timestamp'>) => {
    const newNotification: NotificationData = {
      ...notification,
      id: `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date()
    };

    // Check if this type of notification should be shown
    const shouldShow = checkNotificationSettings(newNotification.type);
    if (!shouldShow) return;

    setNotifications(prev => [newNotification, ...prev]);

    // Add to active notifications if not persistent
    if (!newNotification.persistent) {
      setActiveNotifications(prev => {
        const updated = [newNotification, ...prev];
        return updated.slice(0, maxNotifications);
      });

      // Auto-hide after duration
      setTimeout(() => {
        setActiveNotifications(prev => prev.filter(n => n.id !== newNotification.id));
      }, autoHideDuration);
    }

    // Play notification sound
    if (newNotification.sound !== false) {
      playNotificationSound(newNotification.type);
    }
  }, [maxNotifications, autoHideDuration, playNotificationSound]);

  const checkNotificationSettings = (type: NotificationData['type']): boolean => {
    switch (type) {
      case 'user-joined': return notificationSettings.showUserJoined;
      case 'user-left': return notificationSettings.showUserLeft;
      case 'operation': return notificationSettings.showOperations;
      case 'conflict': return notificationSettings.showConflicts;
      case 'comment': return notificationSettings.showComments;
      case 'mention': return notificationSettings.showMentions;
      case 'analysis': return notificationSettings.showAnalysis;
      case 'error': return notificationSettings.showErrors;
      case 'success': return notificationSettings.showSuccess;
      case 'warning': return notificationSettings.showWarnings;
      case 'info': return notificationSettings.showInfo;
      default: return true;
    }
  };

  const removeNotification = useCallback((id: string) => {
    setActiveNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const clearAllNotifications = useCallback(() => {
    setActiveNotifications([]);
  }, []);

  const getNotificationIcon = (type: NotificationData['type']) => {
    switch (type) {
      case 'user-joined':
      case 'user-left':
        return <PersonIcon />;
      case 'comment':
      case 'mention':
        return <ChatIcon />;
      case 'conflict':
        return <WarningIcon />;
      case 'success':
        return <CheckCircleIcon />;
      case 'error':
        return <ErrorIcon />;
      case 'warning':
        return <WarningIcon />;
      case 'info':
      default:
        return <InfoIcon />;
    }
  };

  const getNotificationColor = (type: NotificationData['type']) => {
    switch (type) {
      case 'error':
        return 'error';
      case 'success':
        return 'success';
      case 'warning':
      case 'conflict':
        return 'warning';
      case 'info':
      default:
        return 'info';
    }
  };

  const getPriorityColor = (priority: NotificationData['priority']) => {
    switch (priority) {
      case 'critical': return '#f44336';
      case 'high': return '#ff9800';
      case 'medium': return '#2196f3';
      case 'low': return '#4caf50';
      default: return '#2196f3';
    }
  };

  const renderNotificationContent = (notification: NotificationData) => (
    <Box>
      <Box display="flex" alignItems="center">
        {notification.avatar && (
          <Avatar
            src={notification.avatar}
            sx={{ width: 24, height: 24, mr: 1 }}
          >
            {notification.username?.charAt(0).toUpperCase()}
          </Avatar>
        )}
        <Typography variant="body2" fontWeight="medium">
          {notification.title}
        </Typography>
        {notification.priority && notification.priority !== 'medium' && (
          <Chip
            label={notification.priority}
            size="small"
            sx={{
              ml: 1,
              backgroundColor: getPriorityColor(notification.priority),
              color: 'white',
              fontSize: '0.7rem'
            }}
          />
        )}
      </Box>
      <Typography variant="body2" color="text.secondary">
        {notification.message}
      </Typography>
      {notification.actions && (
        <Box mt={1} display="flex" gap={1}>
          {notification.actions.map((action, index) => (
            <Button
              key={index}
              size="small"
              color={action.color || 'primary'}
              onClick={action.action}
            >
              {action.label}
            </Button>
          ))}
        </Box>
      )}
    </Box>
  );

  const renderNotificationHistory = () => (
    <Dialog
      open={showHistory}
      onClose={() => setShowHistory(false)}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { maxHeight: '80vh' }
      }}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant="h6">Notification History</Typography>
          <Box display="flex" alignItems="center">
            <IconButton
              size="small"
              onClick={() => setSoundSettings(prev => ({ ...prev, enabled: !prev.enabled }))}
              color={soundSettings.enabled ? 'primary' : 'default'}
            >
              {soundSettings.enabled ? <VolumeUpIcon /> : <VolumeOffIcon />}
            </IconButton>
            <IconButton size="small" onClick={() => setNotifications([])}>
              <ClearIcon />
            </IconButton>
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent>
        {notifications.length === 0 ? (
          <Box
            display="flex"
            alignItems="center"
            justifyContent="center"
            py={4}
          >
            <Typography variant="body2" color="text.secondary">
              No notifications yet
            </Typography>
          </Box>
        ) : (
          <List>
            {notifications.map((notification, index) => (
              <React.Fragment key={notification.id}>
                <ListItem alignItems="flex-start">
                  <ListItemAvatar>
                    <Avatar
                      sx={{
                        backgroundColor: `${getNotificationColor(notification.type)}.main`,
                        width: 32,
                        height: 32
                      }}
                    >
                      {getNotificationIcon(notification.type)}
                    </Avatar>
                  </ListItemAvatar>
                  
                  <ListItemText
                    primary={
                      <Box display="flex" alignItems="center">
                        <Typography variant="body2" fontWeight="medium">
                          {notification.title}
                        </Typography>
                        {notification.priority && notification.priority !== 'medium' && (
                          <Chip
                            label={notification.priority}
                            size="small"
                            sx={{
                              ml: 1,
                              backgroundColor: getPriorityColor(notification.priority),
                              color: 'white',
                              fontSize: '0.7rem'
                            }}
                          />
                        )}
                      </Box>
                    }
                    secondary={
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          {notification.message}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {formatDistanceToNow(notification.timestamp, { addSuffix: true })}
                        </Typography>
                      </Box>
                    }
                  />
                </ListItem>
                {index < notifications.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={() => setShowHistory(false)}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );

  // Expose notification methods globally
  useEffect(() => {
    (window as any).showNotification = addNotification;
    (window as any).clearNotifications = clearAllNotifications;
    
    return () => {
      delete (window as any).showNotification;
      delete (window as any).clearNotifications;
    };
  }, [addNotification, clearAllNotifications]);

  return (
    <Box className={className}>
      {/* Active Notifications */}
      {activeNotifications.map((notification) => (
        <Snackbar
          key={notification.id}
          open={true}
          autoHideDuration={notification.persistent ? null : autoHideDuration}
          onClose={() => removeNotification(notification.id)}
          anchorOrigin={position}
          TransitionComponent={SlideTransition}
          sx={{
            position: 'fixed',
            zIndex: 1400,
            mt: activeNotifications.indexOf(notification) * 8
          }}
        >
          <Alert
            severity={getNotificationColor(notification.type) as any}
            variant="filled"
            onClose={() => removeNotification(notification.id)}
            icon={getNotificationIcon(notification.type)}
            sx={{
              minWidth: 300,
              maxWidth: 400,
              '& .MuiAlert-message': {
                width: '100%'
              }
            }}
          >
            {renderNotificationContent(notification)}
          </Alert>
        </Snackbar>
      ))}

      {/* Notification History Button */}
      <Paper
        sx={{
          position: 'fixed',
          bottom: 20,
          right: 20,
          zIndex: 1300,
          borderRadius: '50%',
          width: 56,
          height: 56,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            transform: 'scale(1.1)',
            boxShadow: 4
          }
        }}
        onClick={() => setShowHistory(true)}
      >
        <Badge
          badgeContent={notifications.length}
          color="error"
          max={99}
          sx={{
            '& .MuiBadge-badge': {
              fontSize: '0.7rem'
            }
          }}
        >
          <NotificationsIcon color="primary" />
        </Badge>
      </Paper>

      {/* Quick Actions */}
      {activeNotifications.length > 1 && (
        <Paper
          sx={{
            position: 'fixed',
            bottom: 20,
            right: 90,
            zIndex: 1300,
            px: 2,
            py: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 1
          }}
        >
          <Typography variant="caption" color="text.secondary">
            {activeNotifications.length} active
          </Typography>
          <IconButton size="small" onClick={clearAllNotifications}>
            <ClearIcon fontSize="small" />
          </IconButton>
        </Paper>
      )}

      {/* Notification History Dialog */}
      {renderNotificationHistory()}
    </Box>
  );
};

export default RealtimeNotifications;