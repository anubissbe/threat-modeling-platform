import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Divider,
  Box,
  Typography,
  Chip,
} from '@mui/material';
import {
  Dashboard,
  FolderOpen,
  Security,
  Assessment,
  People,
  Settings,
  Help,
  BugReport,
  Code,
  Warning,
} from '@mui/icons-material';
import { useAppSelector } from '@/store';

interface SidebarProps {
  drawerWidth: number;
  open: boolean;
}

interface NavigationItem {
  text: string;
  path: string;
  icon: React.ReactElement;
  badge?: string;
  roles?: string[];
}

const navigationItems: NavigationItem[] = [
  {
    text: 'Dashboard',
    path: '/',
    icon: <Dashboard />,
  },
  {
    text: 'Projects',
    path: '/projects',
    icon: <FolderOpen />,
  },
  {
    text: 'Threat Models',
    path: '/threat-models',
    icon: <Security />,
  },
  {
    text: 'Threats',
    path: '/threats',
    icon: <Warning />,
  },
  {
    text: 'Risk Assessment',
    path: '/risk-assessment',
    icon: <Assessment />,
  },
  {
    text: 'Vulnerabilities',
    path: '/vulnerabilities',
    icon: <BugReport />,
  },
  {
    text: 'TMAC Editor',
    path: '/tmac',
    icon: <Code />,
  },
];

const adminItems: NavigationItem[] = [
  {
    text: 'User Management',
    path: '/admin/users',
    icon: <People />,
    roles: ['admin'],
  },
  {
    text: 'System Settings',
    path: '/admin/settings',
    icon: <Settings />,
    roles: ['admin'],
  },
];

const bottomItems: NavigationItem[] = [
  {
    text: 'Help & Support',
    path: '/help',
    icon: <Help />,
  },
];

export const Sidebar: React.FC<SidebarProps> = ({ drawerWidth, open }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAppSelector((state) => state.auth);

  const handleNavigation = (path: string) => {
    navigate(path);
  };

  const isSelected = (path: string): boolean => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  const canAccess = (item: NavigationItem): boolean => {
    if (!item.roles) return true;
    return item.roles.includes(user?.role || '');
  };

  const renderNavigationItems = (items: NavigationItem[]) => (
    <List>
      {items
        .filter(canAccess)
        .map((item) => (
          <ListItem key={item.text} disablePadding>
            <ListItemButton
              selected={isSelected(item.path)}
              onClick={() => handleNavigation(item.path)}
              sx={{
                mx: 1,
                borderRadius: 1,
                '&.Mui-selected': {
                  backgroundColor: 'primary.main',
                  color: 'primary.contrastText',
                  '&:hover': {
                    backgroundColor: 'primary.dark',
                  },
                  '& .MuiListItemIcon-root': {
                    color: 'primary.contrastText',
                  },
                },
                '&:hover': {
                  backgroundColor: 'action.hover',
                },
              }}
            >
              <ListItemIcon
                sx={{
                  color: isSelected(item.path) ? 'inherit' : 'action.active',
                }}
              >
                {item.icon}
              </ListItemIcon>
              <ListItemText 
                primary={item.text}
                primaryTypographyProps={{
                  fontSize: '0.875rem',
                  fontWeight: isSelected(item.path) ? 500 : 400,
                }}
              />
              {item.badge && (
                <Chip
                  label={item.badge}
                  size="small"
                  color={item.badge === 'New' ? 'error' : 'warning'}
                  sx={{
                    height: 20,
                    fontSize: '0.6875rem',
                    fontWeight: 500,
                  }}
                />
              )}
            </ListItemButton>
          </ListItem>
        ))
      }
    </List>
  );

  const drawerContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Toolbar>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Security color="primary" sx={{ fontSize: 32 }} />
          <Box>
            <Typography variant="h6" component="div" sx={{ fontWeight: 600 }}>
              ThreatModel
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Enterprise Security
            </Typography>
          </Box>
        </Box>
      </Toolbar>
      
      <Divider />
      
      {/* Main navigation */}
      <Box sx={{ flexGrow: 1, py: 1 }}>
        {renderNavigationItems(navigationItems)}
        
        {/* Admin section */}
        {adminItems.some(canAccess) && (
          <>
            <Divider sx={{ my: 1, mx: 2 }} />
            <Typography
              variant="overline"
              sx={{
                px: 2,
                py: 1,
                color: 'text.secondary',
                fontSize: '0.75rem',
                fontWeight: 600,
                letterSpacing: 1,
              }}
            >
              Administration
            </Typography>
            {renderNavigationItems(adminItems)}
          </>
        )}
      </Box>
      
      {/* Bottom navigation */}
      <Box>
        <Divider />
        {renderNavigationItems(bottomItems)}
        
        {/* User info */}
        <Box sx={{ p: 2, bgcolor: 'background.default' }}>
          <Typography variant="caption" color="text.secondary">
            Logged in as
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            {user?.email}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {user?.organization}
          </Typography>
        </Box>
      </Box>
    </Box>
  );

  return (
    <Drawer
      variant="persistent"
      anchor="left"
      open={open}
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: drawerWidth,
          boxSizing: 'border-box',
          borderRight: '1px solid',
          borderColor: 'divider',
        },
      }}
    >
      {drawerContent}
    </Drawer>
  );
};