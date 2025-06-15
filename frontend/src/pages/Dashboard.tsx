import React from 'react';
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

const mockStats = {
  totalProjects: 12,
  activeThreatModels: 8,
  criticalVulnerabilities: 3,
  resolvedThreats: 24,
};

const mockRecentActivity = [
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

const mockProjects = [
  {
    id: 1,
    name: 'E-commerce Platform',
    threatModels: 3,
    riskLevel: 'High',
    progress: 75,
    lastUpdated: '2 days ago',
  },
  {
    id: 2,
    name: 'Payment Gateway',
    threatModels: 2,
    riskLevel: 'Medium',
    progress: 60,
    lastUpdated: '1 week ago',
  },
  {
    id: 3,
    name: 'Mobile Application',
    threatModels: 1,
    riskLevel: 'Low',
    progress: 30,
    lastUpdated: '3 days ago',
  },
];

export const Dashboard: React.FC = () => {
  const { user } = useAppSelector((state) => state.auth);

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
                  <Typography variant="h4">{mockStats.totalProjects}</Typography>
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
                  <Typography variant="h4">{mockStats.activeThreatModels}</Typography>
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
                  <Typography variant="h4">{mockStats.criticalVulnerabilities}</Typography>
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
                  <Typography variant="h4">{mockStats.resolvedThreats}</Typography>
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
                <Button size="small">View All</Button>
              </Box>
              
              <List disablePadding>
                {mockRecentActivity.map((activity, index) => (
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
                          <Box>
                            <Typography variant="body2" color="text.secondary">
                              {activity.description}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {activity.timestamp}
                            </Typography>
                          </Box>
                        }
                      />
                    </ListItem>
                    {index < mockRecentActivity.length - 1 && <Divider />}
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
                <Button size="small">View All</Button>
              </Box>
              
              {mockProjects.map((project) => (
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
                    {project.threatModels} threat models • Updated {project.lastUpdated}
                  </Typography>
                  
                  <Box sx={{ mt: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2">Progress</Typography>
                      <Typography variant="body2">{project.progress}%</Typography>
                    </Box>
                    <LinearProgress 
                      variant="determinate" 
                      value={project.progress}
                      sx={{ height: 6, borderRadius: 3 }}
                    />
                  </Box>
                </Paper>
              ))}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};