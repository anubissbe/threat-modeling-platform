import React from 'react';
import {
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Divider,
} from '@mui/material';
import {
  Dashboard,
  Security,
  Folder,
  Assessment,
  Settings,
  Help,
  Analytics,
  Group,
  AdminPanelSettings,
  History,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useRoleCheck } from '../hooks/useRoleCheck';

interface SidebarItem {
  text: string;
  icon: React.ReactElement;
  path: string;
}

const sidebarItems: SidebarItem[] = [
  { text: 'Dashboard', icon: <Dashboard />, path: '/dashboard' },
  { text: 'Projects', icon: <Folder />, path: '/projects' },
  { text: 'Threat Models', icon: <Security />, path: '/threat-models' },
  { text: 'Reports', icon: <Assessment />, path: '/reports' },
  { text: 'Analytics', icon: <Analytics />, path: '/analytics' },
  { text: 'Team', icon: <Group />, path: '/team' },
];

const bottomItems: SidebarItem[] = [
  { text: 'Sessions', icon: <History />, path: '/sessions' },
  { text: 'Admin Panel', icon: <AdminPanelSettings />, path: '/admin' },
  { text: 'Settings', icon: <Settings />, path: '/settings' },
  { text: 'Help', icon: <Help />, path: '/help' },
];

export const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAdmin } = useRoleCheck();

  const handleNavigation = (path: string) => {
    navigate(path);
  };

  const isActive = (path: string) => location.pathname === path;

  // Filter bottom items based on user roles
  const filteredBottomItems = bottomItems.filter(item => {
    if (item.path === '/admin') {
      return isAdmin();
    }
    return true;
  });

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Toolbar>
        <Typography variant="h6" noWrap component="div">
          ThreatModel
        </Typography>
      </Toolbar>
      
      <Divider />
      
      <List sx={{ flexGrow: 1 }}>
        {sidebarItems.map((item) => (
          <ListItem key={item.text} disablePadding>
            <ListItemButton
              selected={isActive(item.path)}
              onClick={() => handleNavigation(item.path)}
              sx={{
                '&.Mui-selected': {
                  backgroundColor: 'rgba(25, 118, 210, 0.08)',
                  borderRight: '3px solid #1976d2',
                },
              }}
            >
              <ListItemIcon
                sx={{
                  color: isActive(item.path) ? '#1976d2' : 'inherit',
                }}
              >
                {item.icon}
              </ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>

      <Divider />
      
      <List>
        {filteredBottomItems.map((item) => (
          <ListItem key={item.text} disablePadding>
            <ListItemButton
              selected={isActive(item.path)}
              onClick={() => handleNavigation(item.path)}
            >
              <ListItemIcon
                sx={{
                  color: isActive(item.path) ? '#1976d2' : 'inherit',
                }}
              >
                {item.icon}
              </ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Box>
  );
};