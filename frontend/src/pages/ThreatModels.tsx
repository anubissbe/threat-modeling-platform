import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Avatar,
  AvatarGroup,
  TextField,
  InputAdornment,
  Tab,
  Tabs,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Alert,
  Skeleton,
  Snackbar,
  ListItemText,
  ListItemSecondaryAction,
  List,
  ListItem,
  ListItemAvatar,
  CardActions,
  LinearProgress,
} from '@mui/material';
import {
  Add,
  MoreVert,
  Edit,
  Delete,
  Share,
  Download,
  Search,
  FilterList,
  Security,
  Warning,
  CheckCircle,
  Schedule,
  Brush,
  Launch,
} from '@mui/icons-material';
import { threatModelsApi, projectsApi } from '@/services/api';
import { formatDistanceToNow } from 'date-fns';

interface ThreatModel {
  id: string;
  name: string;
  description: string;
  methodology: string;
  projectId: string;
  status: string;
  threats: number;
  createdAt: string;
  updatedAt: string;
}

interface Project {
  id: string;
  name: string;
}

export const ThreatModels: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedThreatModel, setSelectedThreatModel] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [tabValue, setTabValue] = useState(0);
  const [createDialog, setCreateDialog] = useState({
    open: false,
    name: '',
    description: '',
    methodology: 'STRIDE',
    projectId: '',
  });
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [notification, setNotification] = useState({
    open: false,
    message: '',
    severity: 'info' as 'success' | 'info' | 'warning' | 'error',
  });

  // Get projectId from location state if coming from project details
  const projectIdFromState = location.state?.projectId;

  // Fetch all threat models
  const { data: threatModels = [], isLoading, error } = useQuery({
    queryKey: ['threatModels'],
    queryFn: async () => {
      const response = await threatModelsApi.getThreatModels();
      if (response.data?.data && Array.isArray(response.data.data)) {
        return response.data.data;
      } else if (Array.isArray(response.data)) {
        return response.data;
      }
      return [];
    },
    retry: 1,
  });

  // Fetch projects for the dropdown
  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const response = await projectsApi.getProjects();
      if (response.data?.data && Array.isArray(response.data.data)) {
        return response.data.data;
      } else if (Array.isArray(response.data)) {
        return response.data;
      }
      return [];
    },
  });

  // Create threat model mutation
  const createThreatModelMutation = useMutation({
    mutationFn: async (data: Partial<ThreatModel>) => {
      const response = await threatModelsApi.createThreatModel(data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['threatModels'] });
      setNotification({
        open: true,
        message: 'Threat model created successfully!',
        severity: 'success',
      });
      setCreateDialog({
        open: false,
        name: '',
        description: '',
        methodology: 'STRIDE',
        projectId: '',
      });
    },
    onError: (error: any) => {
      setNotification({
        open: true,
        message: error.response?.data?.message || error.response?.data?.error || 'Failed to create threat model',
        severity: 'error',
      });
    },
  });

  // Delete threat model mutation
  const deleteThreatModelMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await threatModelsApi.deleteThreatModel(id);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['threatModels'] });
      setNotification({
        open: true,
        message: 'Threat model deleted successfully!',
        severity: 'success',
      });
      setDeleteConfirmOpen(false);
      setSelectedThreatModel(null);
    },
    onError: (error: any) => {
      setNotification({
        open: true,
        message: error.response?.data?.message || error.response?.data?.error || 'Failed to delete threat model',
        severity: 'error',
      });
    },
  });

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, threatModelId: string) => {
    setAnchorEl(event.currentTarget);
    setSelectedThreatModel(threatModelId);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedThreatModel(null);
  };

  const handleCreateThreatModel = () => {
    createThreatModelMutation.mutate({
      name: createDialog.name,
      description: createDialog.description,
      methodology: createDialog.methodology,
      projectId: createDialog.projectId,
      status: 'Draft',
    });
  };

  const handleEditThreatModel = (threatModelId: string) => {
    navigate(`/threat-models/${threatModelId}/edit`);
    handleMenuClose();
  };

  const handleDeleteThreatModel = () => {
    if (selectedThreatModel) {
      deleteThreatModelMutation.mutate(selectedThreatModel);
    }
  };

  const handleViewThreatModel = (threatModelId: string) => {
    navigate(`/threat-models/${threatModelId}`);
  };

  const handleCloseNotification = () => {
    setNotification(prev => ({ ...prev, open: false }));
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'draft': return 'default';
      case 'active': return 'primary';
      case 'in_review': return 'warning';
      case 'completed': return 'success';
      default: return 'default';
    }
  };

  const getMethodologyColor = (methodology: string) => {
    switch (methodology.toUpperCase()) {
      case 'STRIDE': return 'primary';
      case 'PASTA': return 'secondary';
      case 'LINDDUN': return 'success';
      case 'VAST': return 'warning';
      case 'DREAD': return 'error';
      default: return 'default';
    }
  };

  const filteredThreatModels = threatModels.filter((model: ThreatModel) =>
    model.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    model.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    model.methodology.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getProjectName = (projectId: string) => {
    const project = projects.find((p: Project) => p.id === projectId);
    return project?.name || 'Unknown Project';
  };

  if (error) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <Typography variant="h6" color="error" gutterBottom>
          Failed to load threat models
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
            Threat Models
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Create and manage threat models for your security assessments
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Add />}
          size="large"
          onClick={() => setCreateDialog({ ...createDialog, open: true })}
        >
          New Threat Model
        </Button>
      </Box>

      {/* Search and Filter */}
      <Box sx={{ display: 'flex', gap: 2, mb: 4 }}>
        <TextField
          placeholder="Search threat models..."
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

      {/* Threat Models Grid */}
      {isLoading ? (
        <Grid container spacing={3}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
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
          {filteredThreatModels.map((model: ThreatModel) => (
            <Grid item xs={12} md={6} lg={4} key={model.id}>
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
                        label={model.methodology}
                        size="small"
                        color={getMethodologyColor(model.methodology) as any}
                      />
                      <Chip
                        label={model.status}
                        size="small"
                        color={getStatusColor(model.status) as any}
                        variant="outlined"
                      />
                    </Box>
                    <IconButton
                      size="small"
                      onClick={(e) => handleMenuOpen(e, model.id)}
                    >
                      <MoreVert />
                    </IconButton>
                  </Box>

                  <Typography variant="h6" gutterBottom>
                    {model.name}
                  </Typography>

                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {model.description}
                  </Typography>

                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Project: {getProjectName(model.projectId)}
                  </Typography>

                  <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Security fontSize="small" color="action" />
                      <Typography variant="body2">
                        {model.threats || 0} threats
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Schedule fontSize="small" color="action" />
                      <Typography variant="body2">
                        {formatDistanceToNow(new Date(model.updatedAt), { addSuffix: true })}
                      </Typography>
                    </Box>
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Avatar sx={{ width: 24, height: 24, fontSize: '0.75rem' }}>
                      TM
                    </Avatar>
                    <Typography variant="body2" color="text.secondary">
                      Team Model
                    </Typography>
                  </Box>
                </CardContent>

                <CardActions>
                  <Button 
                    size="small" 
                    startIcon={<Launch />}
                    onClick={() => handleViewThreatModel(model.id)}
                  >
                    Open
                  </Button>
                  <Button 
                    size="small" 
                    startIcon={<Edit />}
                    onClick={() => handleEditThreatModel(model.id)}
                  >
                    Edit
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Empty State */}
      {!isLoading && filteredThreatModels.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Security sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            {searchTerm ? 'No threat models found' : 'No threat models yet'}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {searchTerm 
              ? 'Try adjusting your search terms'
              : 'Create your first threat model to start security analysis'
            }
          </Typography>
          {!searchTerm && (
            <Button 
              variant="contained" 
              startIcon={<Add />} 
              onClick={() => setCreateDialog({ ...createDialog, open: true })}
            >
              Create Threat Model
            </Button>
          )}
        </Box>
      )}

      {/* Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => selectedThreatModel && handleEditThreatModel(selectedThreatModel)}>
          <Edit sx={{ mr: 1 }} />
          Edit
        </MenuItem>
        <MenuItem onClick={() => selectedThreatModel && handleViewThreatModel(selectedThreatModel)}>
          <Security sx={{ mr: 1 }} />
          View Details
        </MenuItem>
        <MenuItem onClick={() => {
          setNotification({
            open: true,
            message: 'Threat model shared successfully',
            severity: 'info',
          });
          handleMenuClose();
        }}>
          <Share sx={{ mr: 1 }} />
          Share
        </MenuItem>
        <MenuItem onClick={() => {
          setNotification({
            open: true,
            message: 'Download started',
            severity: 'info',
          });
          handleMenuClose();
        }}>
          <Download sx={{ mr: 1 }} />
          Download
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

      {/* Create Threat Model Dialog */}
      <Dialog open={createDialog.open} onClose={() => setCreateDialog({ ...createDialog, open: false })} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Threat Model</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Threat Model Name"
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
            label="Methodology"
            fullWidth
            variant="outlined"
            value={createDialog.methodology}
            onChange={(e) => setCreateDialog({ ...createDialog, methodology: e.target.value })}
            sx={{ mb: 2 }}
          >
            <MenuItem value="STRIDE">STRIDE</MenuItem>
            <MenuItem value="PASTA">PASTA</MenuItem>
            <MenuItem value="LINDDUN">LINDDUN</MenuItem>
            <MenuItem value="VAST">VAST</MenuItem>
            <MenuItem value="DREAD">DREAD</MenuItem>
          </TextField>
          <TextField
            select
            margin="dense"
            label="Project"
            fullWidth
            variant="outlined"
            value={createDialog.projectId}
            onChange={(e) => setCreateDialog({ ...createDialog, projectId: e.target.value })}
          >
            {projects.map((project: Project) => (
              <MenuItem key={project.id} value={project.id}>
                {project.name}
              </MenuItem>
            ))}
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialog({ ...createDialog, open: false })}>
            Cancel
          </Button>
          <Button 
            onClick={handleCreateThreatModel} 
            variant="contained"
            disabled={!createDialog.name || !createDialog.projectId || createThreatModelMutation.isPending}
          >
            {createThreatModelMutation.isPending ? <CircularProgress size={20} /> : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
        <DialogTitle>Delete Threat Model</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this threat model? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleDeleteThreatModel} 
            color="error" 
            variant="contained"
            disabled={deleteThreatModelMutation.isPending}
          >
            {deleteThreatModelMutation.isPending ? <CircularProgress size={20} /> : 'Delete'}
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