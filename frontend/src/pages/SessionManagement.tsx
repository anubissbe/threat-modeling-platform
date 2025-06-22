import React from 'react';
import { Box, Typography } from '@mui/material';
import { SessionManager } from '../components/Session';

export const SessionManagement: React.FC = () => {
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Session Management
      </Typography>
      <SessionManager />
    </Box>
  );
};