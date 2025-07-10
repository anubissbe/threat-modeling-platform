import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  Chip,
  Tabs,
  Tab,
  IconButton,
  Avatar,
  AvatarGroup,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  ListItemSecondaryAction,
  Paper,
  Divider,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Skeleton,
  Alert,
  Tooltip,
  Menu,
  MenuItem,
} from '@mui/material';
import {
  ArrowBack,
  Edit,
  Delete,
  Security,
  People,
  Schedule,
  Assessment,
  Description,
  Timeline,
  Add,
  MoreVert,
  CheckCircle,
  Warning,
  Error as ErrorIcon,
  Info,
  PersonAdd,
  FileCopy,
  Archive,
  Refresh,
} from '@mui/icons-material';
import { projectsApi, threatModelsApi } from '@/services/api';
import { format, formatDistanceToNow } from 'date-fns';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`project-tabpanel-${index}`}
      aria-labelledby={`project-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

export const ProjectDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tabValue, setTabValue] = useState(0);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [inviteDialog, setInviteDialog] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');

  // Fetch project details
  const { data: project, isLoading, error } = useQuery({
    queryKey: ['project', id],
    queryFn: async () => {
      if (!id) throw new Error('Project ID is required');
      const response = await projectsApi.getProject(id);
      // Handle API response structure
      if (response.data?.data) {
        return response.data.data;
      }
      return response.data;
    },
    enabled: !!id,
  });

  // Fetch threat models for this project
  const { data: threatModels = [] } = useQuery({
    queryKey: ['threatModels', id],
    queryFn: async () => {
      if (!id) return [];
      const response = await threatModelsApi.getThreatModels(id);
      // Handle API response structure
      if (response.data?.data && Array.isArray(response.data.data)) {
        return response.data.data;
      } else if (Array.isArray(response.data)) {
        return response.data;
      }
      return [];
    },
    enabled: !!id,
  });

  // Archive project mutation
  const archiveProjectMutation = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error('Project ID is required');
      return projectsApi.updateProject(id, { status: 'Archived' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setMenuAnchor(event.currentTarget);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
  };

  const handleEdit = () => {
    navigate(`/projects/${id}/edit`);
    handleMenuClose();
  };

  const handleArchive = () => {
    archiveProjectMutation.mutate();
    handleMenuClose();
  };

  const handleDelete = () => {
    // In a real app, show confirmation dialog
    if (window.confirm('Are you sure you want to delete this project?')) {
      // Delete logic here
      navigate('/projects');
    }
    handleMenuClose();
  };

  const handleInviteUser = () => {
    // In a real app, send invitation
    console.log('Inviting user:', inviteEmail);
    setInviteDialog(false);
    setInviteEmail('');
  };

  const getRiskColor = (risk: string) => {
    switch (risk.toLowerCase()) {
      case 'critical': return 'error';
      case 'high': return 'error';
      case 'medium': return 'warning';
      case 'low': return 'success';
      default: return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active': return <CheckCircle color="success" />;
      case 'in review': return <Warning color="warning" />;
      case 'completed': return <Info color="info" />;
      case 'archived': return <Archive color="disabled" />;
      default: return null;
    }
  };

  if (isLoading) {
    return (
      <Box>
        <Skeleton variant="rectangular" height={200} sx={{ mb: 3 }} />
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <Skeleton variant="rectangular" height={400} />
          </Grid>
          <Grid item xs={12} md={4}>
            <Skeleton variant="rectangular" height={400} />
          </Grid>
        </Grid>
      </Box>
    );
  }

  if (error || !project) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <ErrorIcon sx={{ fontSize: 64, color: 'error.main', mb: 2 }} />
        <Typography variant="h6" gutterBottom>
          Failed to load project
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {error?.message || 'Project not found'}
        </Typography>
        <Button variant="contained" onClick={() => navigate('/projects')}>
          Back to Projects
        </Button>
      </Box>
    );
  }

  // Mock data for demonstration
  const activities = [
    {
      id: '1',
      user: 'John Doe',
      action: 'created threat model',
      target: 'Login Flow',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
    },
    {
      id: '2',
      user: 'Jane Smith',
      action: 'updated risk level',
      target: 'API Authentication',
      timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000),
    },
    {
      id: '3',
      user: 'Admin User',
      action: 'added team member',
      target: 'Bob Wilson',
      timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
    },
  ];

  const teamMembers = [
    { id: '1', name: 'John Doe', role: 'Project Lead', avatar: 'JD' },
    { id: '2', name: 'Jane Smith', role: 'Security Analyst', avatar: 'JS' },
    { id: '3', name: 'Bob Wilson', role: 'Developer', avatar: 'BW' },
    { id: '4', name: 'Alice Brown', role: 'Reviewer', avatar: 'AB' },
  ];

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <IconButton onClick={() => navigate('/projects')} sx={{ mr: 2 }}>
            <ArrowBack />
          </IconButton>
          <Typography variant="h4" sx={{ flexGrow: 1 }}>
            {project.name}
          </Typography>
          <IconButton onClick={handleMenuOpen}>
            <MoreVert />
          </IconButton>
        </Box>

        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <Chip
            label={project.riskLevel}
            color={getRiskColor(project.riskLevel) as any}
            size="small"
          />
          <Chip
            icon={getStatusIcon(project.status)}
            label={project.status}
            variant="outlined"
            size="small"
          />
          <Typography variant="body2" color="text.secondary">
            Created {formatDistanceToNow(new Date(project.createdAt))} ago
          </Typography>
        </Box>
      </Box>

      {/* Progress Card */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={3} alignItems="center">
            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom>
                Project Progress
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box sx={{ flexGrow: 1 }}>
                  <LinearProgress
                    variant="determinate"
                    value={project.progress || 0}
                    sx={{ height: 10, borderRadius: 5 }}
                  />
                </Box>
                <Typography variant="body2" color="text.secondary">
                  {project.progress || 0}%
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', justifyContent: 'space-around' }}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h4">{project.threatModels || 0}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Threat Models
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h4">{teamMembers.length}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Team Members
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h4">
                    {threatModels.filter((tm: any) => tm.status === 'completed').length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Completed
                  </Typography>
                </Box>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs value={tabValue} onChange={handleTabChange}>
          <Tab label="Overview" icon={<Info />} iconPosition="start" />
          <Tab label="Threat Models" icon={<Security />} iconPosition="start" />
          <Tab label="Team" icon={<People />} iconPosition="start" />
          <Tab label="Activity" icon={<Timeline />} iconPosition="start" />
        </Tabs>
      </Paper>

      {/* Tab Panels */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <TabPanel value={tabValue} index={0}>
            {/* Overview Tab */}
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Description
                </Typography>
                <Typography variant="body1" paragraph>
                  {project.description}
                </Typography>

                <Divider sx={{ my: 3 }} />

                <Typography variant="h6" gutterBottom>
                  Project Details
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      Owner
                    </Typography>
                    <Typography variant="body1">{project.owner || 'Unassigned'}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      Last Updated
                    </Typography>
                    <Typography variant="body1">
                      {format(new Date(project.updatedAt), 'PPP')}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      Organization
                    </Typography>
                    <Typography variant="body1">{project.organization || 'N/A'}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      Compliance Framework
                    </Typography>
                    <Typography variant="body1">{project.compliance || 'None'}</Typography>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </TabPanel>

          <TabPanel value={tabValue} index={1}>
            {/* Threat Models Tab */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6">Threat Models</Typography>
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={() => navigate(`/projects/${id}/threat-models/new`)}
              >
                New Threat Model
              </Button>
            </Box>

            {threatModels.length === 0 ? (
              <Card>
                <CardContent sx={{ textAlign: 'center', py: 6 }}>
                  <Security sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                  <Typography variant="h6" gutterBottom>
                    No threat models yet
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    Start by creating your first threat model for this project
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={<Add />}
                    onClick={() => navigate(`/projects/${id}/threat-models/new`)}
                  >
                    Create Threat Model
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <List>
                {threatModels.map((model: any) => (
                  <Card key={model.id} sx={{ mb: 2 }}>
                    <ListItem>
                      <ListItemAvatar>
                        <Avatar>
                          <Security />
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={model.name}
                        secondary={
                          <Box>
                            <Typography variant="body2" color="text.secondary">
                              {model.description}
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                              <Chip
                                label={model.methodology || 'STRIDE'}
                                size="small"
                                variant="outlined"
                              />
                              <Chip
                                label={`${model.threats || 0} threats`}
                                size="small"
                                color="warning"
                              />
                            </Box>
                          </Box>
                        }
                      />
                      <ListItemSecondaryAction>
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={() => navigate(`/threat-models/${model.id}`)}
                        >
                          Open
                        </Button>
                      </ListItemSecondaryAction>
                    </ListItem>
                  </Card>
                ))}
              </List>
            )}
          </TabPanel>

          <TabPanel value={tabValue} index={2}>
            {/* Team Tab */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6">Team Members</Typography>
              <Button
                variant="outlined"
                startIcon={<PersonAdd />}
                onClick={() => setInviteDialog(true)}
              >
                Invite Member
              </Button>
            </Box>

            <List>
              {teamMembers.map((member) => (
                <Card key={member.id} sx={{ mb: 1 }}>
                  <ListItem>
                    <ListItemAvatar>
                      <Avatar>{member.avatar}</Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={member.name}
                      secondary={member.role}
                    />
                    <ListItemSecondaryAction>
                      <IconButton edge="end">
                        <MoreVert />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                </Card>
              ))}
            </List>
          </TabPanel>

          <TabPanel value={tabValue} index={3}>
            {/* Activity Tab */}
            <Typography variant="h6" gutterBottom>
              Recent Activity
            </Typography>
            <List>
              {activities.map((activity) => (
                <Card key={activity.id} sx={{ mb: 1 }}>
                  <ListItem>
                    <ListItemAvatar>
                      <Avatar>{activity.user.split(' ').map(n => n[0]).join('')}</Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Box>
                          <strong>{activity.user}</strong> {activity.action}{' '}
                          <strong>{activity.target}</strong>
                        </Box>
                      }
                      secondary={formatDistanceToNow(activity.timestamp, { addSuffix: true })}
                    />
                  </ListItem>
                </Card>
              ))}
            </List>
          </TabPanel>
        </Grid>

        {/* Sidebar */}
        <Grid item xs={12} md={4}>
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Quick Actions
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<Security />}
                  onClick={() => navigate(`/projects/${id}/threat-models/new`)}
                >
                  Create Threat Model
                </Button>
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<Assessment />}
                  onClick={() => navigate(`/projects/${id}/reports`)}
                >
                  Generate Report
                </Button>
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<FileCopy />}
                >
                  Clone Project
                </Button>
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<Refresh />}
                  onClick={() => queryClient.invalidateQueries({ queryKey: ['project', id] })}
                >
                  Refresh
                </Button>
              </Box>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Risk Summary
              </Typography>
              <List dense>
                <ListItem>
                  <ListItemText primary="Critical Risks" />
                  <Chip label="0" color="error" size="small" />
                </ListItem>
                <ListItem>
                  <ListItemText primary="High Risks" />
                  <Chip label="3" color="error" size="small" variant="outlined" />
                </ListItem>
                <ListItem>
                  <ListItemText primary="Medium Risks" />
                  <Chip label="7" color="warning" size="small" />
                </ListItem>
                <ListItem>
                  <ListItemText primary="Low Risks" />
                  <Chip label="12" color="success" size="small" />
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Context Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleEdit}>
          <Edit sx={{ mr: 1 }} />
          Edit Project
        </MenuItem>
        <MenuItem onClick={handleArchive}>
          <Archive sx={{ mr: 1 }} />
          Archive Project
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>
          <Delete sx={{ mr: 1 }} />
          Delete Project
        </MenuItem>
      </Menu>

      {/* Invite Member Dialog */}
      <Dialog open={inviteDialog} onClose={() => setInviteDialog(false)}>
        <DialogTitle>Invite Team Member</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Email Address"
            type="email"
            fullWidth
            variant="outlined"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setInviteDialog(false)}>Cancel</Button>
          <Button onClick={handleInviteUser} variant="contained">
            Send Invitation
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};