import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  CardActions,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Alert,
  Tabs,
  Tab,
  Avatar,
  AvatarGroup,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  ListItemSecondaryAction,
  Fab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from '@mui/material';
import {
  ArrowBack,
  Edit,
  Delete,
  MoreVert,
  Add,
  Security,
  Group,
  Timeline,
  Settings,
  Star,
  StarBorder,
  CheckCircle,
  Warning,
  Error,
  PlayArrow,
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { useRoleCheck } from '../hooks/useRoleCheck';

interface ThreatModel {
  id: string;
  name: string;
  description: string;
  status: 'draft' | 'in-progress' | 'completed' | 'archived';
  threatCount: number;
  riskScore: number;
  lastModified: string;
  assignee?: {
    id: string;
    name: string;
    avatar?: string;
  };
}

interface ProjectActivity {
  id: string;
  type: 'created' | 'updated' | 'threat_added' | 'threat_resolved' | 'model_created' | 'member_added';
  description: string;
  user: {
    id: string;
    name: string;
    avatar?: string;
  };
  timestamp: string;
  metadata?: Record<string, unknown>;
}

interface ProjectMember {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'admin' | 'editor' | 'viewer';
  avatar?: string;
  joinedAt: string;
  lastSeen: string;
}

interface ProjectData {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'archived' | 'draft';
  priority: 'low' | 'medium' | 'high' | 'critical';
  visibility: 'private' | 'team' | 'organization';
  organization: string;
  tags: string[];
  isStarred: boolean;
  owner: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };
  members: ProjectMember[];
  threatModels: ThreatModel[];
  activity: ProjectActivity[];
  createdAt: string;
  lastModified: string;
  statistics: {
    totalThreats: number;
    resolvedThreats: number;
    highRiskThreats: number;
    completionPercentage: number;
  };
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => {
  return (
    <div role="tabpanel" hidden={value !== index}>
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
};

export const ProjectDetail: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { canManageProjects, hasRole } = useRoleCheck();

  const [project, setProject] = useState<ProjectData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [tabValue, setTabValue] = useState(0);
  
  // Menu states
  const [projectMenuAnchor, setProjectMenuAnchor] = useState<null | HTMLElement>(null);
  const [threatModelMenuAnchor, setThreatModelMenuAnchor] = useState<null | HTMLElement>(null);
  const [selectedThreatModel, setSelectedThreatModel] = useState<ThreatModel | null>(null);

  // Dialog states
  const [showCreateThreatModelDialog, setShowCreateThreatModelDialog] = useState(false);
  const [threatModelForm, setThreatModelForm] = useState({ name: '', description: '' });

  const fetchProject = useCallback(async () => {
    if (!projectId) return;
    setIsLoading(true);
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setProject(data);
      } else {
        setError('Failed to fetch project details');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  const handleStarProject = async () => {
    if (!project) return;

    try {
      const response = await fetch(`/api/projects/${project.id}/star`, {
        method: project.isStarred ? 'DELETE' : 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        setProject(prev => prev ? { ...prev, isStarred: !prev.isStarred } : null);
      }
    } catch {
      setError('Failed to update project star status');
    }
  };

  const handleCreateThreatModel = async () => {
    if (!threatModelForm.name.trim()) return;

    try {
      const response = await fetch(`/api/projects/${projectId}/threat-models`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(threatModelForm),
      });

      if (response.ok) {
        const newThreatModel = await response.json();
        setProject(prev => prev ? {
          ...prev,
          threatModels: [...prev.threatModels, newThreatModel]
        } : null);
        setShowCreateThreatModelDialog(false);
        setThreatModelForm({ name: '', description: '' });
      } else {
        setError('Failed to create threat model');
      }
    } catch {
      setError('Network error. Please try again.');
    }
  };

  const getThreatModelStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle color="success" />;
      case 'in-progress':
        return <PlayArrow color="warning" />;
      case 'draft':
        return <Edit color="action" />;
      default:
        return <Security color="action" />;
    }
  };

  const getRiskScoreColor = (score: number) => {
    if (score >= 80) return 'error';
    if (score >= 60) return 'warning';
    if (score >= 40) return 'info';
    return 'success';
  };

  const getPriorityColor = (priority: string): 'error' | 'warning' | 'info' | 'success' | 'default' => {
    switch (priority) {
      case 'critical': return 'error';
      case 'high': return 'warning';
      case 'medium': return 'info';
      case 'low': return 'success';
      default: return 'default';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'created': return <Add color="success" />;
      case 'updated': return <Edit color="info" />;
      case 'threat_added': return <Warning color="warning" />;
      case 'threat_resolved': return <CheckCircle color="success" />;
      case 'model_created': return <Security color="primary" />;
      case 'member_added': return <Group color="info" />;
      default: return <Timeline color="action" />;
    }
  };

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <Typography>Loading project details...</Typography>
      </Box>
    );
  }

  if (error || !project) {
    return (
      <Box>
        <Alert severity="error" sx={{ mb: 3 }}>
          {error || 'Project not found'}
        </Alert>
        <Button startIcon={<ArrowBack />} onClick={() => navigate('/projects')}>
          Back to Projects
        </Button>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={3}>
        <Box>
          <Box display="flex" alignItems="center" gap={2} mb={1}>
            <Button
              startIcon={<ArrowBack />}
              onClick={() => navigate('/projects')}
              variant="outlined"
              size="small"
            >
              Projects
            </Button>
            <IconButton onClick={handleStarProject}>
              {project.isStarred ? <Star color="warning" /> : <StarBorder />}
            </IconButton>
          </Box>
          <Typography variant="h4" gutterBottom>
            {project.name}
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
            {project.description}
          </Typography>
          <Box display="flex" gap={1} flexWrap="wrap">
            <Chip 
              label={project.status} 
              color={project.status === 'active' ? 'success' : 'default'} 
              variant="outlined"
            />
            <Chip 
              label={project.priority} 
              color={getPriorityColor(project.priority)}
            />
            <Chip 
              label={project.visibility} 
              variant="outlined"
            />
            {project.tags.map((tag) => (
              <Chip key={tag} label={tag} variant="outlined" size="small" />
            ))}
          </Box>
        </Box>

        <Box display="flex" alignItems="center" gap={1}>
          <AvatarGroup max={4}>
            {project.members.map((member) => (
              <Avatar
                key={member.id}
                alt={member.name}
                src={member.avatar}
                sx={{ width: 32, height: 32 }}
              >
                {member.name.charAt(0)}
              </Avatar>
            ))}
          </AvatarGroup>
          {canManageProjects() && (
            <IconButton onClick={(e) => setProjectMenuAnchor(e.currentTarget)}>
              <MoreVert />
            </IconButton>
          )}
        </Box>
      </Box>

      {/* Statistics Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography variant="h4" color="primary">
                    {project.threatModels.length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Threat Models
                  </Typography>
                </Box>
                <Security color="primary" sx={{ fontSize: 40 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography variant="h4" color="warning.main">
                    {project.statistics.totalThreats}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Threats
                  </Typography>
                </Box>
                <Warning color="warning" sx={{ fontSize: 40 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography variant="h4" color="success.main">
                    {project.statistics.resolvedThreats}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Resolved
                  </Typography>
                </Box>
                <CheckCircle color="success" sx={{ fontSize: 40 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography variant="h4" color="error.main">
                    {project.statistics.highRiskThreats}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    High Risk
                  </Typography>
                </Box>
                <Error color="error" sx={{ fontSize: 40 }} />
              </Box>
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Completion: {project.statistics.completionPercentage}%
                </Typography>
                <LinearProgress 
                  variant="determinate" 
                  value={project.statistics.completionPercentage}
                  color={project.statistics.completionPercentage > 80 ? 'success' : 'primary'}
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)}>
          <Tab label="Threat Models" />
          <Tab label="Team Members" />
          <Tab label="Activity" />
          <Tab label="Settings" />
        </Tabs>
      </Box>

      {/* Tab Panels */}
      <TabPanel value={tabValue} index={0}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h6">Threat Models</Typography>
          {canManageProjects() && (
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => setShowCreateThreatModelDialog(true)}
            >
              New Threat Model
            </Button>
          )}
        </Box>

        <Grid container spacing={3}>
          {project.threatModels.map((threatModel) => (
            <Grid item xs={12} sm={6} md={4} key={threatModel.id}>
              <Card>
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                    <Box display="flex" alignItems="center" gap={1}>
                      {getThreatModelStatusIcon(threatModel.status)}
                      <Typography variant="h6" noWrap>
                        {threatModel.name}
                      </Typography>
                    </Box>
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        setThreatModelMenuAnchor(e.currentTarget);
                        setSelectedThreatModel(threatModel);
                      }}
                    >
                      <MoreVert />
                    </IconButton>
                  </Box>

                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {threatModel.description}
                  </Typography>

                  <Box display="flex" gap={1} mb={2}>
                    <Chip 
                      label={threatModel.status} 
                      size="small" 
                      variant="outlined"
                    />
                    <Chip 
                      label={`Risk: ${threatModel.riskScore}`} 
                      size="small" 
                      color={getRiskScoreColor(threatModel.riskScore) as 'error' | 'warning' | 'info' | 'success'}
                    />
                  </Box>

                  <Typography variant="body2" color="text.secondary">
                    {threatModel.threatCount} threats • Updated {formatDate(threatModel.lastModified)}
                  </Typography>

                  {threatModel.assignee && (
                    <Box display="flex" alignItems="center" gap={1} mt={2}>
                      <Avatar src={threatModel.assignee.avatar} sx={{ width: 24, height: 24 }}>
                        {threatModel.assignee.name.charAt(0)}
                      </Avatar>
                      <Typography variant="body2" color="text.secondary">
                        {threatModel.assignee.name}
                      </Typography>
                    </Box>
                  )}
                </CardContent>
                <CardActions>
                  <Button 
                    size="small" 
                    onClick={() => navigate(`/threat-models/${threatModel.id}`)}
                  >
                    Open
                  </Button>
                  <Button size="small">
                    View Report
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>

        {project.threatModels.length === 0 && (
          <Box textAlign="center" py={8}>
            <Security sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No threat models yet
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Create your first threat model to start analyzing security risks
            </Typography>
            {canManageProjects() && (
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={() => setShowCreateThreatModelDialog(true)}
              >
                Create Threat Model
              </Button>
            )}
          </Box>
        )}
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        <Typography variant="h6" gutterBottom>
          Team Members ({project.members.length})
        </Typography>
        
        <List>
          {project.members.map((member) => (
            <ListItem key={member.id}>
              <ListItemAvatar>
                <Avatar src={member.avatar}>
                  {member.name.charAt(0)}
                </Avatar>
              </ListItemAvatar>
              <ListItemText
                primary={member.name}
                secondary={
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      {member.email}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Joined {formatDate(member.joinedAt)} • Last seen {formatDate(member.lastSeen)}
                    </Typography>
                  </Box>
                }
              />
              <ListItemSecondaryAction>
                <Chip label={member.role} size="small" variant="outlined" />
              </ListItemSecondaryAction>
            </ListItem>
          ))}
        </List>
      </TabPanel>

      <TabPanel value={tabValue} index={2}>
        <Typography variant="h6" gutterBottom>
          Recent Activity
        </Typography>
        
        <List>
          {project.activity.map((activity) => (
            <ListItem key={activity.id}>
              <ListItemAvatar>
                {getActivityIcon(activity.type)}
              </ListItemAvatar>
              <ListItemText
                primary={activity.description}
                secondary={
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      by {activity.user.name} • {formatDate(activity.timestamp)}
                    </Typography>
                  </Box>
                }
              />
            </ListItem>
          ))}
        </List>
      </TabPanel>

      <TabPanel value={tabValue} index={3}>
        <Typography variant="h6" gutterBottom>
          Project Settings
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Project settings functionality will be implemented in the next phase.
        </Typography>
      </TabPanel>

      {/* Floating Action Button */}
      {canManageProjects() && tabValue === 0 && (
        <Fab
          color="primary"
          aria-label="add threat model"
          sx={{
            position: 'fixed',
            bottom: 16,
            right: 16,
            display: { xs: 'flex', sm: 'none' }
          }}
          onClick={() => setShowCreateThreatModelDialog(true)}
        >
          <Add />
        </Fab>
      )}

      {/* Menus */}
      <Menu
        anchorEl={projectMenuAnchor}
        open={Boolean(projectMenuAnchor)}
        onClose={() => setProjectMenuAnchor(null)}
      >
        <MenuItem onClick={() => navigate(`/projects/${project.id}/edit`)}>
          <Edit sx={{ mr: 1 }} />
          Edit Project
        </MenuItem>
        <MenuItem onClick={() => navigate(`/projects/${project.id}/settings`)}>
          <Settings sx={{ mr: 1 }} />
          Settings
        </MenuItem>
        {hasRole('admin') && (
          <MenuItem sx={{ color: 'error.main' }}>
            <Delete sx={{ mr: 1 }} />
            Delete Project
          </MenuItem>
        )}
      </Menu>

      <Menu
        anchorEl={threatModelMenuAnchor}
        open={Boolean(threatModelMenuAnchor)}
        onClose={() => setThreatModelMenuAnchor(null)}
      >
        <MenuItem onClick={() => {
          if (selectedThreatModel) {
            navigate(`/threat-models/${selectedThreatModel.id}`);
          }
          setThreatModelMenuAnchor(null);
        }}>
          Open
        </MenuItem>
        <MenuItem>Edit</MenuItem>
        <MenuItem>Duplicate</MenuItem>
        <MenuItem sx={{ color: 'error.main' }}>Delete</MenuItem>
      </Menu>

      {/* Create Threat Model Dialog */}
      <Dialog
        open={showCreateThreatModelDialog}
        onClose={() => setShowCreateThreatModelDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Create New Threat Model</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Name"
            fullWidth
            variant="outlined"
            value={threatModelForm.name}
            onChange={(e) => setThreatModelForm(prev => ({ ...prev, name: e.target.value }))}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="Description"
            fullWidth
            multiline
            rows={3}
            variant="outlined"
            value={threatModelForm.description}
            onChange={(e) => setThreatModelForm(prev => ({ ...prev, description: e.target.value }))}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCreateThreatModelDialog(false)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleCreateThreatModel}
            disabled={!threatModelForm.name.trim()}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};