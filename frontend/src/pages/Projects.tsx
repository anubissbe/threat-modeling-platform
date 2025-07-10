import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  CardActions,
  Grid,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  LinearProgress,
  Avatar,
  Fab,
  TextField,
  InputAdornment,
  Snackbar,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Skeleton,
} from '@mui/material';
import {
  Add,
  MoreVert,
  Edit,
  Delete,
  Security,
  People,
  Schedule,
  Search,
  FilterList,
  Visibility,
  Launch,
} from '@mui/icons-material';
import { projectsApi } from '@/services/api';

interface Project {
  id: string;
  name: string;
  description: string;
  riskLevel: 'High' | 'Medium' | 'Low';
  threatModels?: number;
  collaborators?: number;
  progress?: number;
  lastUpdated?: string;
  owner?: string;
  status: 'Active' | 'In Review' | 'Completed' | 'Archived';
  createdAt: string;
  updatedAt: string;
}

interface CreateProjectDialog {
  open: boolean;
  name: string;
  description: string;
  riskLevel: 'High' | 'Medium' | 'Low';
}

export const Projects: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [createDialog, setCreateDialog] = useState<CreateProjectDialog>({
    open: false,
    name: '',
    description: '',
    riskLevel: 'Medium',
  });
  const [editDialog, setEditDialog] = useState<CreateProjectDialog & { id?: string }>({
    open: false,
    name: '',
    description: '',
    riskLevel: 'Medium',
  });
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [notification, setNotification] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'info' | 'warning' | 'error';
  }>({
    open: false,
    message: '',
    severity: 'info',
  });

  // Fetch projects from API
  const { data: projects = [], isLoading, error } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const response = await projectsApi.getProjects();
      // Handle the API response structure { success: true, data: [...] }
      if (response.data && Array.isArray(response.data.data)) {
        return response.data.data;
      } else if (Array.isArray(response.data)) {
        return response.data;
      }
      return [];
    },
    retry: 1,
  });

  // Create project mutation
  const createProjectMutation = useMutation({
    mutationFn: async (data: Partial<Project>) => {
      const response = await projectsApi.createProject(data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setNotification({
        open: true,
        message: 'Project created successfully!',
        severity: 'success',
      });
      setCreateDialog({ open: false, name: '', description: '', riskLevel: 'Medium' });
    },
    onError: (error: any) => {
      setNotification({
        open: true,
        message: error.response?.data?.message || error.response?.data?.error || 'Failed to create project',
        severity: 'error',
      });
    },
  });

  // Update project mutation
  const updateProjectMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Project> }) => {
      const response = await projectsApi.updateProject(id, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setNotification({
        open: true,
        message: 'Project updated successfully!',
        severity: 'success',
      });
      setEditDialog({ open: false, name: '', description: '', riskLevel: 'Medium' });
    },
    onError: (error: any) => {
      setNotification({
        open: true,
        message: error.response?.data?.message || error.response?.data?.error || 'Failed to update project',
        severity: 'error',
      });
    },
  });

  // Delete project mutation
  const deleteProjectMutation = useMutation({
    mutationFn: (id: string) => projectsApi.deleteProject(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setNotification({
        open: true,
        message: 'Project deleted successfully!',
        severity: 'success',
      });
      setDeleteConfirmOpen(false);
      setSelectedProject(null);
    },
    onError: (error: any) => {
      setNotification({
        open: true,
        message: error.response?.data?.message || 'Failed to delete project',
        severity: 'error',
      });
    },
  });

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, projectId: string) => {
    setAnchorEl(event.currentTarget);
    setSelectedProject(projectId);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedProject(null);
  };

  const handleCreateProject = () => {
    createProjectMutation.mutate({
      name: createDialog.name,
      description: createDialog.description,
      riskLevel: createDialog.riskLevel,
      status: 'Active',
      progress: 0,
      threatModels: 0,
      collaborators: 1,
    });
  };

  const handleEditProject = (projectId: string) => {
    const project = projects.find((p: Project) => p.id === projectId);
    if (project) {
      setEditDialog({
        open: true,
        id: project.id,
        name: project.name,
        description: project.description,
        riskLevel: project.riskLevel,
      });
    }
    handleMenuClose();
  };

  const handleUpdateProject = () => {
    if (editDialog.id) {
      updateProjectMutation.mutate({
        id: editDialog.id,
        data: {
          name: editDialog.name,
          description: editDialog.description,
          riskLevel: editDialog.riskLevel,
        },
      });
    }
  };

  const handleDeleteProject = () => {
    if (selectedProject) {
      deleteProjectMutation.mutate(selectedProject);
    }
  };

  const handleViewDetails = (project: Project) => {
    navigate(`/projects/${project.id}`);
  };

  const handleOpenProject = (project: Project) => {
    navigate('/threat-models', { state: { projectId: project.id } });
  };

  const handleCloseNotification = () => {
    setNotification(prev => ({ ...prev, open: false }));
  };

  const getRiskColor = (risk: string) => {
    switch (risk.toLowerCase()) {
      case 'high': return 'error';
      case 'medium': return 'warning';
      case 'low': return 'success';
      default: return 'default';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active': return 'success';
      case 'in review': return 'warning';
      case 'completed': return 'info';
      case 'archived': return 'default';
      default: return 'default';
    }
  };

  const filteredProjects = projects.filter((project: Project) =>
    project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    project.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) return 'Today';
    if (diffInDays === 1) return 'Yesterday';
    if (diffInDays < 7) return `${diffInDays} days ago`;
    if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} weeks ago`;
    return `${Math.floor(diffInDays / 30)} months ago`;
  };

  if (error) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <Typography variant="h6" color="error" gutterBottom>
          Failed to load projects
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {(error as any).message}
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Projects
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage your threat modeling projects and security assessments
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Add />}
          size="large"
          onClick={() => setCreateDialog({ ...createDialog, open: true })}
        >
          New Project
        </Button>
      </Box>

      {/* Search and Filter */}
      <Box sx={{ display: 'flex', gap: 2, mb: 4 }}>
        <TextField
          placeholder="Search projects..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search />
              </InputAdornment>
            ),
          }}
          sx={{ flexGrow: 1 }}
        />
        <Button
          variant="outlined"
          startIcon={<FilterList />}
        >
          Filter
        </Button>
      </Box>

      {/* Projects Grid */}
      {isLoading ? (
        <Grid container spacing={3}>
          {[1, 2, 3, 4].map((i) => (
            <Grid item xs={12} md={6} lg={4} key={i}>
              <Card>
                <CardContent>
                  <Skeleton variant="rectangular" height={200} />
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      ) : (
        <Grid container spacing={3}>
          {filteredProjects.map((project: Project) => (
            <Grid item xs={12} md={6} lg={4} key={project.id}>
              <Card 
                sx={{ 
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: 4,
                  },
                }}
              >
                <CardContent sx={{ flexGrow: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Chip
                        label={project.riskLevel}
                        size="small"
                        color={getRiskColor(project.riskLevel) as any}
                      />
                      <Chip
                        label={project.status}
                        size="small"
                        color={getStatusColor(project.status) as any}
                        variant="outlined"
                      />
                    </Box>
                    <IconButton
                      size="small"
                      onClick={(e) => handleMenuOpen(e, project.id)}
                    >
                      <MoreVert />
                    </IconButton>
                  </Box>

                  <Typography variant="h6" gutterBottom>
                    {project.name}
                  </Typography>

                  <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    {project.description}
                  </Typography>

                  <Box sx={{ display: 'flex', gap: 3, mb: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Security fontSize="small" color="action" />
                      <Typography variant="body2">
                        {project.threatModels || 0} models
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <People fontSize="small" color="action" />
                      <Typography variant="body2">
                        {project.collaborators || 1} people
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Schedule fontSize="small" color="action" />
                      <Typography variant="body2">
                        {formatDate(project.updatedAt)}
                      </Typography>
                    </Box>
                  </Box>

                  {project.progress !== undefined && (
                    <Box sx={{ mb: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="body2" color="text.secondary">
                          Progress
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {project.progress}%
                        </Typography>
                      </Box>
                      <LinearProgress 
                        variant="determinate" 
                        value={project.progress}
                        sx={{ height: 6, borderRadius: 3 }}
                      />
                    </Box>
                  )}

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Avatar sx={{ width: 24, height: 24, fontSize: '0.75rem' }}>
                      {project.owner ? project.owner.split(' ').map(n => n[0]).join('') : 'U'}
                    </Avatar>
                    <Typography variant="body2" color="text.secondary">
                      {project.owner || 'Unknown'}
                    </Typography>
                  </Box>
                </CardContent>

                <CardActions>
                  <Button 
                    size="small" 
                    startIcon={<Visibility />}
                    onClick={() => handleViewDetails(project)}
                  >
                    View Details
                  </Button>
                  <Button 
                    size="small" 
                    startIcon={<Launch />}
                    onClick={() => handleOpenProject(project)}
                  >
                    Open
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Empty State */}
      {!isLoading && filteredProjects.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Security sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            {searchTerm ? 'No projects found' : 'No projects yet'}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {searchTerm 
              ? 'Try adjusting your search terms'
              : 'Create your first project to start threat modeling'
            }
          </Typography>
          {!searchTerm && (
            <Button 
              variant="contained" 
              startIcon={<Add />} 
              onClick={() => setCreateDialog({ ...createDialog, open: true })}
            >
              Create Project
            </Button>
          )}
        </Box>
      )}

      {/* Floating Action Button */}
      <Fab
        color="primary"
        aria-label="add project"
        onClick={() => setCreateDialog({ ...createDialog, open: true })}
        sx={{
          position: 'fixed',
          bottom: 24,
          right: 24,
        }}
      >
        <Add />
      </Fab>

      {/* Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => selectedProject && handleEditProject(selectedProject)}>
          <Edit sx={{ mr: 1 }} />
          Edit
        </MenuItem>
        <MenuItem onClick={() => {
          if (selectedProject) {
            const project = projects.find((p: Project) => p.id === selectedProject);
            if (project) handleOpenProject(project);
          }
        }}>
          <Security sx={{ mr: 1 }} />
          View Threat Models
        </MenuItem>
        <MenuItem 
          onClick={() => {
            setDeleteConfirmOpen(true);
            handleMenuClose();
          }} 
          sx={{ color: 'error.main' }}
        >
          <Delete sx={{ mr: 1 }} />
          Delete
        </MenuItem>
      </Menu>

      {/* Create Project Dialog */}
      <Dialog open={createDialog.open} onClose={() => setCreateDialog({ ...createDialog, open: false })}>
        <DialogTitle>Create New Project</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Project Name"
            fullWidth
            variant="outlined"
            value={createDialog.name}
            onChange={(e) => setCreateDialog({ ...createDialog, name: e.target.value })}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="Description"
            fullWidth
            multiline
            rows={4}
            variant="outlined"
            value={createDialog.description}
            onChange={(e) => setCreateDialog({ ...createDialog, description: e.target.value })}
            sx={{ mb: 2 }}
          />
          <TextField
            select
            margin="dense"
            label="Risk Level"
            fullWidth
            variant="outlined"
            value={createDialog.riskLevel}
            onChange={(e) => setCreateDialog({ ...createDialog, riskLevel: e.target.value as any })}
          >
            <MenuItem value="Low">Low</MenuItem>
            <MenuItem value="Medium">Medium</MenuItem>
            <MenuItem value="High">High</MenuItem>
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialog({ ...createDialog, open: false })}>Cancel</Button>
          <Button 
            onClick={handleCreateProject} 
            variant="contained"
            disabled={!createDialog.name || createProjectMutation.isPending}
          >
            {createProjectMutation.isPending ? <CircularProgress size={20} /> : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Project Dialog */}
      <Dialog open={editDialog.open} onClose={() => setEditDialog({ ...editDialog, open: false })}>
        <DialogTitle>Edit Project</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Project Name"
            fullWidth
            variant="outlined"
            value={editDialog.name}
            onChange={(e) => setEditDialog({ ...editDialog, name: e.target.value })}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="Description"
            fullWidth
            multiline
            rows={4}
            variant="outlined"
            value={editDialog.description}
            onChange={(e) => setEditDialog({ ...editDialog, description: e.target.value })}
            sx={{ mb: 2 }}
          />
          <TextField
            select
            margin="dense"
            label="Risk Level"
            fullWidth
            variant="outlined"
            value={editDialog.riskLevel}
            onChange={(e) => setEditDialog({ ...editDialog, riskLevel: e.target.value as any })}
          >
            <MenuItem value="Low">Low</MenuItem>
            <MenuItem value="Medium">Medium</MenuItem>
            <MenuItem value="High">High</MenuItem>
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialog({ ...editDialog, open: false })}>Cancel</Button>
          <Button 
            onClick={handleUpdateProject} 
            variant="contained"
            disabled={!editDialog.name || updateProjectMutation.isPending}
          >
            {updateProjectMutation.isPending ? <CircularProgress size={20} /> : 'Update'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
        <DialogTitle>Delete Project</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this project? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleDeleteProject} 
            color="error" 
            variant="contained"
            disabled={deleteProjectMutation.isPending}
          >
            {deleteProjectMutation.isPending ? <CircularProgress size={20} /> : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Notification Snackbar */}
      <Snackbar
        open={notification.open}
        autoHideDuration={4000}
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