import React, { useState } from 'react';
import {
  AppBar as MuiAppBar,
  Toolbar,
  IconButton,
  Typography,
  Button,
  Menu,
  MenuItem,
  Avatar,
  Box,
  Divider,
  ListItemIcon,
  ListItemText,
  Badge,
} from '@mui/material';
import {
  Menu as MenuIcon,
  AccountCircle,
  Settings,
  Logout,
  Notifications,
  DarkMode,
  LightMode,
} from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '@/store';
import { toggleSidebar, toggleTheme } from '@/store/slices/uiSlice';
import { logout } from '@/store/slices/authSlice';

interface AppBarProps {
  drawerWidth: number;
  sidebarOpen: boolean;
}

export const AppBar: React.FC<AppBarProps> = ({ drawerWidth, sidebarOpen }) => {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const { theme } = useAppSelector((state) => state.ui);
  
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = async () => {
    handleMenuClose();
    await dispatch(logout());
  };

  const handleToggleTheme = () => {
    dispatch(toggleTheme());
  };

  const getUserInitials = (firstName?: string, lastName?: string): string => {
    if (!firstName && !lastName) return 'U';
    const first = firstName?.charAt(0) || '';
    const last = lastName?.charAt(0) || '';
    return `${first}${last}`.toUpperCase() || 'U';
  };

  const getRoleColor = (role: string): string => {
    switch (role) {
      case 'admin': return '#f44336';
      case 'security_analyst': return '#ff9800';
      case 'architect': return '#2196f3';
      case 'developer': return '#4caf50';
      case 'viewer': return '#9e9e9e';
      default: return '#9e9e9e';
    }
  };

  return (
    <MuiAppBar
      position="fixed"
      sx={{
        width: { sm: sidebarOpen ? `calc(100% - ${drawerWidth}px)` : '100%' },
        ml: { sm: sidebarOpen ? `${drawerWidth}px` : 0 },
        transition: (theme) =>
          theme.transitions.create(['margin', 'width'], {
            easing: theme.transitions.easing.easeOut,
            duration: theme.transitions.duration.enteringScreen,
          }),
      }}
    >
      <Toolbar>
        <IconButton
          color="inherit"
          aria-label="toggle sidebar"
          edge="start"
          onClick={() => dispatch(toggleSidebar())}
          sx={{ mr: 2 }}
        >
          <MenuIcon />
        </IconButton>

        <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
          Threat Modeling Platform
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {/* Theme toggle */}
          <IconButton
            color="inherit"
            onClick={handleToggleTheme}
            aria-label="toggle theme"
          >
            {theme === 'light' ? <DarkMode /> : <LightMode />}
          </IconButton>

          {/* Notifications */}
          <IconButton
            color="inherit"
            aria-label="notifications"
          >
            <Badge badgeContent={0} color="error">
              <Notifications />
            </Badge>
          </IconButton>

          {/* User menu */}
          <Button
            onClick={handleMenuOpen}
            color="inherit"
            startIcon={
              <Avatar
                sx={{
                  width: 32,
                  height: 32,
                  bgcolor: getRoleColor(user?.role || 'viewer'),
                  fontSize: '0.875rem',
                }}
              >
                {user ? getUserInitials(user.firstName, user.lastName) : 'U'}
              </Avatar>
            }
            sx={{
              textTransform: 'none',
              color: 'inherit',
              '&:hover': {
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
              },
            }}
          >
            <Box sx={{ textAlign: 'left', ml: 1 }}>
              <Typography variant="body2" sx={{ lineHeight: 1.2 }}>
                {user ? `${user.firstName} ${user.lastName}` : 'User'}
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.7, lineHeight: 1 }}>
                {user?.role?.replace('_', ' ') || 'Unknown'}
              </Typography>
            </Box>
          </Button>

          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'right',
            }}
            transformOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
            PaperProps={{
              sx: {
                minWidth: 200,
                mt: 1,
              },
            }}
          >
            <MenuItem onClick={handleMenuClose}>
              <ListItemIcon>
                <AccountCircle />
              </ListItemIcon>
              <ListItemText primary="Profile" />
            </MenuItem>
            
            <MenuItem onClick={handleMenuClose}>
              <ListItemIcon>
                <Settings />
              </ListItemIcon>
              <ListItemText primary="Settings" />
            </MenuItem>
            
            <Divider />
            
            <MenuItem onClick={handleLogout}>
              <ListItemIcon>
                <Logout />
              </ListItemIcon>
              <ListItemText primary="Logout" />
            </MenuItem>
          </Menu>
        </Box>
      </Toolbar>
    </MuiAppBar>
  );
};