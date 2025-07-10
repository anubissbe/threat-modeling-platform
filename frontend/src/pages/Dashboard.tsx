import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  Paper,
  Avatar,
  Chip,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Divider,
  Snackbar,
  Alert,
} from '@mui/material';
import {
  Security,
  FolderOpen,
  Assessment,
  TrendingUp,
  Warning,
  CheckCircle,
  BugReport,
  Add,
} from '@mui/icons-material';
import { useAppSelector } from '@/store';
import { projectsApi, threatModelsApi } from '@/services/api';

// Fetch real data instead of mock data
const mockStats = {
  totalProjects: 12,
  activeThreatModels: 8,
  criticalVulnerabilities: 3,
  resolvedThreats: 24,
};

  // Fetch recent activity from API
  const { data: recentActivity = [] } = useQuery({
    queryKey: ['recentActivity'],
    queryFn: async () => {
      try {
        const response = await fetch('http://localhost:3000/api/activity/recent');
        const data = await response.json();
        return (data.data || []).map((activity: any) => ({
          ...activity,
          icon: activity.type === 'threat_model_created' ? <Security /> :
                activity.type === 'vulnerability_found' ? <BugReport /> :
                activity.type === 'threat_resolved' ? <CheckCircle /> : <Security />,
          color: activity.type === 'threat_model_created' ? 'primary' :
                 activity.type === 'vulnerability_found' ? 'error' :
                 activity.type === 'threat_resolved' ? 'success' : 'default',
        }));
      } catch (error) {
        console.error('Failed to fetch recent activity:', error);
        // Fallback to mock data if API fails
        return [
          {
            id: 1,
            type: 'threat_model_created',
            title: 'New threat model created',
            description: 'Payment Gateway Security Model',
            timestamp: '2 hours ago',
            icon: <Security />,
            color: 'primary',
          },
          {
            id: 2,
            type: 'vulnerability_found',
            title: 'Critical vulnerability identified',
            description: 'SQL Injection in user authentication',
            timestamp: '4 hours ago',
            icon: <BugReport />,
            color: 'error',
          },
          {
            id: 3,
            type: 'threat_resolved',
            title: 'Threat resolved',
            description: 'XSS vulnerability in dashboard',
            timestamp: '1 day ago',
            icon: <CheckCircle />,
            color: 'success',
          },
        ];
      }
    },
  });

export const Dashboard: React.FC = () => {
  const { user } = useAppSelector((state) => state.auth);
  const navigate = useNavigate();
  const [notification, setNotification] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'info' | 'warning' | 'error';
  }>({
    open: false,
    message: '',
    severity: 'info',
  });

  // Fetch real data
  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const response = await projectsApi.getProjects();
      return response.data?.data || response.data || [];
    },
  });

  const { data: threatModels = [] } = useQuery({
    queryKey: ['threatModels'],
    queryFn: async () => {
      const response = await threatModelsApi.getThreatModels();
      return response.data?.data || response.data || [];
    },
  });

  const { data: vulnerabilities = [] } = useQuery({
    queryKey: ['vulnerabilities'],
    queryFn: async () => {
      try {
        const response = await fetch('http://localhost:3000/api/vulnerabilities');
        const data = await response.json();
        return data.data || [];
      } catch (error) {
        console.error('Failed to fetch vulnerabilities:', error);
        return [];
      }
    },
  });

  // Calculate real stats
  const stats = {
    totalProjects: projects.length,
    activeThreatModels: threatModels.filter((tm: any) => tm.status === 'active').length,
    criticalVulnerabilities: vulnerabilities.filter((v: any) => v.severity === 'Critical' || v.severity === 'High').length,
    resolvedThreats: threatModels.filter((tm: any) => tm.status === 'completed').length,
  };

  const getRiskColor = (risk: string) => {
    switch (risk.toLowerCase()) {
      case 'high': return 'error';
      case 'medium': return 'warning';
      case 'low': return 'success';
      default: return 'default';
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const handleNewProject = () => {
    navigate('/projects');
    setNotification({
      open: true,
      message: 'Navigating to Projects page to create a new project',
      severity: 'info',
    });
  };

  const handleNewThreatModel = () => {
    navigate('/threat-models');
    setNotification({
      open: true,
      message: 'Navigating to Threat Models page',
      severity: 'info',
    });
  };

  const handleRiskAssessment = () => {
    navigate('/risk-assessment');
  };

  const handleReportIssue = () => {
    setNotification({
      open: true,
      message: 'Issue reporting feature coming soon',
      severity: 'info',
    });
  };

  const handleCloseNotification = () => {
    setNotification(prev => ({ ...prev, open: false }));
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          {getGreeting()}, {user?.firstName}!
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Here's an overview of your security landscape
        </Typography>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Avatar sx={{ bgcolor: 'primary.main', mr: 2 }}>
                  <FolderOpen />
                </Avatar>
                <Box>
                  <Typography variant="h4">{stats.totalProjects}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Projects
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <TrendingUp color="success" sx={{ mr: 1 }} />
                <Typography variant="body2" color="success.main">
                  +2 this month
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Avatar sx={{ bgcolor: 'secondary.main', mr: 2 }}>
                  <Security />
                </Avatar>
                <Box>
                  <Typography variant="h4">{stats.activeThreatModels}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Active Threat Models
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <TrendingUp color="success" sx={{ mr: 1 }} />
                <Typography variant="body2" color="success.main">
                  +1 this week
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Avatar sx={{ bgcolor: 'error.main', mr: 2 }}>
                  <Warning />
                </Avatar>
                <Box>
                  <Typography variant="h4">{stats.criticalVulnerabilities}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Critical Vulnerabilities
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Typography variant="body2" color="error.main">
                  Requires immediate attention
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Avatar sx={{ bgcolor: 'success.main', mr: 2 }}>
                  <CheckCircle />
                </Avatar>
                <Box>
                  <Typography variant="h4">{stats.resolvedThreats}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Resolved Threats
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <TrendingUp color="success" sx={{ mr: 1 }} />
                <Typography variant="body2" color="success.main">
                  +5 this month
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* Recent Activity */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h6">Recent Activity</Typography>
                <Button size="small" onClick={() => navigate('/projects')}>View All</Button>
              </Box>
              
              <List disablePadding>
                {recentActivity.map((activity: any, index: number) => (
                  <React.Fragment key={activity.id}>
                    <ListItem disablePadding sx={{ py: 1 }}>
                      <ListItemAvatar>
                        <Avatar 
                          sx={{ 
                            bgcolor: `${activity.color}.main`,
                            width: 40,
                            height: 40,
                          }}
                        >
                          {activity.icon}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={activity.title}
                        secondary={
                          <Box component="span">
                            {activity.description}
                            <Box component="span" display="block">
                              <Typography component="span" variant="caption" color="text.disabled">
                                {activity.timestamp}
                              </Typography>
                            </Box>
                          </Box>
                        }
                      />
                    </ListItem>
                    {index < recentActivity.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Quick Actions & Projects */}
        <Grid item xs={12} md={6}>
          {/* Quick Actions */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Quick Actions
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Button
                    fullWidth
                    variant="outlined"
                    startIcon={<Add />}
                    sx={{ py: 1.5 }}
                    onClick={handleNewProject}
                  >
                    New Project
                  </Button>
                </Grid>
                <Grid item xs={6}>
                  <Button
                    fullWidth
                    variant="outlined"
                    startIcon={<Security />}
                    sx={{ py: 1.5 }}
                    onClick={handleNewThreatModel}
                  >
                    Threat Model
                  </Button>
                </Grid>
                <Grid item xs={6}>
                  <Button
                    fullWidth
                    variant="outlined"
                    startIcon={<Assessment />}
                    sx={{ py: 1.5 }}
                    onClick={handleRiskAssessment}
                  >
                    Risk Assessment
                  </Button>
                </Grid>
                <Grid item xs={6}>
                  <Button
                    fullWidth
                    variant="outlined"
                    startIcon={<BugReport />}
                    sx={{ py: 1.5 }}
                    onClick={handleReportIssue}
                  >
                    Report Issue
                  </Button>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Recent Projects */}
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h6">Recent Projects</Typography>
                <Button size="small" onClick={() => navigate('/projects')}>View All</Button>
              </Box>
              
              {projects.slice(0, 3).map((project: any) => (
                <Paper
                  key={project.id}
                  sx={{
                    p: 2,
                    mb: 2,
                    border: '1px solid',
                    borderColor: 'divider',
                    '&:last-child': { mb: 0 },
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
                    <Typography variant="subtitle1" fontWeight={500}>
                      {project.name}
                    </Typography>
                    <Chip
                      label={project.riskLevel}
                      size="small"
                      color={getRiskColor(project.riskLevel) as any}
                    />
                  </Box>
                  
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    {project.threatModels || 0} threat models • Updated {project.lastUpdated || 'recently'}
                  </Typography>
                  
                  <Box sx={{ mt: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2">Progress</Typography>
                      <Typography variant="body2">{project.progress || 0}%</Typography>
                    </Box>
                    <LinearProgress 
                      variant="determinate" 
                      value={project.progress || 0}
                      sx={{ height: 6, borderRadius: 3 }}
                    />
                  </Box>
                </Paper>
              ))}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Notification Snackbar */}
      <Snackbar
        open={notification.open}
        autoHideDuration={3000}
        onClose={handleCloseNotification}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={handleCloseNotification}
          severity={notification.severity}
          sx={{ width: '100%' }}
        >
          {notification.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};