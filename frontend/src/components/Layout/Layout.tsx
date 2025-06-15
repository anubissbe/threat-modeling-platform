import React from 'react';
import {
  Box,
  CssBaseline,
  Toolbar,
} from '@mui/material';
import { useAppSelector } from '@/store';
import { AppBar } from './AppBar';
import { Sidebar } from './Sidebar';
import { NotificationContainer } from '../Notifications/NotificationContainer';

interface LayoutProps {
  children: React.ReactNode;
}

const DRAWER_WIDTH = 280;

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const sidebarOpen = useAppSelector((state) => state.ui.sidebarOpen);

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      
      <AppBar 
        drawerWidth={DRAWER_WIDTH}
        sidebarOpen={sidebarOpen}
      />
      
      <Sidebar 
        drawerWidth={DRAWER_WIDTH}
        open={sidebarOpen}
      />
      
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { sm: `calc(100% - ${sidebarOpen ? DRAWER_WIDTH : 0}px)` },
          ml: { sm: sidebarOpen ? `${DRAWER_WIDTH}px` : 0 },
          transition: (theme) =>
            theme.transitions.create(['margin', 'width'], {
              easing: theme.transitions.easing.easeOut,
              duration: theme.transitions.duration.enteringScreen,
            }),
        }}
      >
        <Toolbar />
        
        {children}
        
        <NotificationContainer />
      </Box>
    </Box>
  );
};