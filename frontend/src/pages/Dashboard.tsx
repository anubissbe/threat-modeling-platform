import React from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  Button,
} from '@mui/material';
import {
  Security,
  Assessment,
  Warning,
  CheckCircle,
} from '@mui/icons-material';

const DashboardCard: React.FC<{
  title: string;
  value: string | number;
  icon: React.ReactElement;
  color: string;
}> = ({ title, value, icon, color }) => (
  <Card>
    <CardContent>
      <Box display="flex" alignItems="center" justifyContent="space-between">
        <Box>
          <Typography color="textSecondary" gutterBottom variant="body2">
            {title}
          </Typography>
          <Typography variant="h4" component="div">
            {value}
          </Typography>
        </Box>
        <Box sx={{ color, opacity: 0.7 }}>
          {icon}
        </Box>
      </Box>
    </CardContent>
  </Card>
);

export const Dashboard: React.FC = () => {
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Dashboard
      </Typography>
      
      <Grid container spacing={3}>
        {/* Stats Cards */}
        <Grid item xs={12} sm={6} md={3}>
          <DashboardCard
            title="Active Projects"
            value={12}
            icon={<Security fontSize="large" />}
            color="#1976d2"
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <DashboardCard
            title="Threat Models"
            value={47}
            icon={<Assessment fontSize="large" />}
            color="#2e7d32"
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <DashboardCard
            title="High Risk Threats"
            value={8}
            icon={<Warning fontSize="large" />}
            color="#d32f2f"
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <DashboardCard
            title="Mitigated"
            value={156}
            icon={<CheckCircle fontSize="large" />}
            color="#ed6c02"
          />
        </Grid>

        {/* Recent Activity */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Recent Activity
            </Typography>
            <Typography color="textSecondary">
              Recent threat modeling activities will be displayed here.
            </Typography>
          </Paper>
        </Grid>

        {/* Quick Actions */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Quick Actions
            </Typography>
            <Box display="flex" flexDirection="column" gap={1}>
              <Button variant="contained" fullWidth>
                New Threat Model
              </Button>
              <Button variant="outlined" fullWidth>
                New Project
              </Button>
              <Button variant="outlined" fullWidth>
                View Reports
              </Button>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};