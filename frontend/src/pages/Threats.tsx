import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Alert,
  Tooltip,
  TablePagination,
  Menu,
  ListItemIcon,
  ListItemText,
  Divider,
  Card,
  CardContent,
  LinearProgress
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  FilterList as FilterIcon,
  MoreVert as MoreIcon,
  Assessment as AssessmentIcon,
  Shield as ShieldIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  Person as PersonIcon,
  Category as CategoryIcon,
  TrendingUp as TrendingUpIcon,
  Security as SecurityIcon
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { format } from 'date-fns';
import { threatsApi } from '../services/threatsApi';
import { projectsApi } from '../services/projectsApi';
import { threatModelsApi } from '../services/threatModelsApi';

interface ThreatFormData {
  name: string;
  description: string;
  threatModelId: string;
  category: string;
  likelihood: string;
  impact: string;
  affectedComponent: string;
  affectedAssets: string[];
  threatSources: string[];
  prerequisites: string[];
  status: string;
  assignedTo?: string;
}

const Threats: React.FC = () => {
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [filterProject, setFilterProject] = useState('');
  const [filterThreatModel, setFilterThreatModel] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterRiskLevel, setFilterRiskLevel] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingThreat, setEditingThreat] = useState<any>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedThreat, setSelectedThreat] = useState<any>(null);
  
  const [formData, setFormData] = useState<ThreatFormData>({
    name: '',
    description: '',
    threatModelId: '',
    category: 'Information Disclosure',
    likelihood: 'Medium',
    impact: 'Medium',
    affectedComponent: '',
    affectedAssets: [],
    threatSources: [],
    prerequisites: [],
    status: 'identified'
  });

  // Fetch projects
  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const response = await projectsApi.getProjects({ limit: 100 });
      return response.data.data || [];
    }
  });

  // Fetch threat models based on selected project
  const { data: threatModels = [] } = useQuery({
    queryKey: ['threat-models', filterProject],
    queryFn: async () => {
      if (!filterProject) return [];
      const response = await threatModelsApi.getThreatModels({ projectId: filterProject });
      return response.data.data || [];
    },
    enabled: !!filterProject
  });

  // Fetch threats
  const { data: threatsData, isLoading, refetch } = useQuery({
    queryKey: ['threats', filterProject, filterThreatModel, filterStatus, filterRiskLevel, page, rowsPerPage],
    queryFn: async () => {
      const params: any = {
        limit: rowsPerPage,
        offset: page * rowsPerPage
      };
      
      if (filterProject) params.projectId = filterProject;
      if (filterThreatModel) params.threatModelId = filterThreatModel;
      if (filterStatus) params.status = filterStatus;
      if (filterRiskLevel) params.riskLevel = filterRiskLevel;
      
      const response = await threatsApi.getThreats(params);
      return response.data;
    }
  });

  const threats = threatsData?.data || [];
  const totalCount = threatsData?.total || 0;

  // Create/Update threat mutation
  const createUpdateMutation = useMutation({
    mutationFn: async (data: ThreatFormData) => {
      if (editingThreat) {
        return await threatsApi.updateThreat(editingThreat.id, data);
      } else {
        return await threatsApi.createThreat(data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['threats'] });
      enqueueSnackbar(editingThreat ? 'Threat updated successfully' : 'Threat created successfully', { variant: 'success' });
      handleCloseDialog();
    },
    onError: (error: any) => {
      enqueueSnackbar(error.response?.data?.message || 'Operation failed', { variant: 'error' });
    }
  });

  // Delete threat mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await threatsApi.deleteThreat(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['threats'] });
      enqueueSnackbar('Threat deleted successfully', { variant: 'success' });
    },
    onError: (error: any) => {
      enqueueSnackbar(error.response?.data?.message || 'Failed to delete threat', { variant: 'error' });
    }
  });

  const handleOpenDialog = (threat?: any) => {
    if (threat) {
      setEditingThreat(threat);
      setFormData({
        name: threat.name,
        description: threat.description,
        threatModelId: threat.threatModelId,
        category: threat.category,
        likelihood: threat.likelihood,
        impact: threat.impact,
        affectedComponent: threat.affectedComponent || '',
        affectedAssets: threat.affectedAssets || [],
        threatSources: threat.threatSources || [],
        prerequisites: threat.prerequisites || [],
        status: threat.status,
        assignedTo: threat.assignedTo
      });
      // Set the project filter to load threat models
      const threatModel = threatModels.find((tm: any) => tm.id === threat.threatModelId);
      if (threatModel) {
        setFilterProject(threatModel.projectId);
      }
    } else {
      setEditingThreat(null);
      setFormData({
        name: '',
        description: '',
        threatModelId: filterThreatModel || '',
        category: 'Information Disclosure',
        likelihood: 'Medium',
        impact: 'Medium',
        affectedComponent: '',
        affectedAssets: [],
        threatSources: [],
        prerequisites: [],
        status: 'identified'
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingThreat(null);
  };

  const handleSubmit = () => {
    if (!formData.name || !formData.description || !formData.threatModelId) {
      enqueueSnackbar('Please fill in all required fields', { variant: 'error' });
      return;
    }
    createUpdateMutation.mutate(formData);
  };

  const handleDelete = (threat: any) => {
    if (window.confirm(`Are you sure you want to delete "${threat.name}"?`)) {
      deleteMutation.mutate(threat.id);
    }
    setAnchorEl(null);
  };

  const getRiskLevelColor = (level: string) => {
    switch (level) {
      case 'Critical': return 'error';
      case 'High': return 'warning';
      case 'Medium': return 'info';
      case 'Low': return 'success';
      default: return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'identified': return <WarningIcon />;
      case 'analyzing': return <AssessmentIcon />;
      case 'mitigating': return <ShieldIcon />;
      case 'mitigated': return <CheckCircleIcon />;
      case 'accepted': return <ScheduleIcon />;
      default: return null;
    }
  };

  const calculateRiskLevel = (likelihood: string, impact: string): string => {
    const likelihoodScore = likelihood === 'Very High' ? 5 :
                           likelihood === 'High' ? 4 :
                           likelihood === 'Medium' ? 3 :
                           likelihood === 'Low' ? 2 : 1;
    
    const impactScore = impact === 'Very High' ? 5 :
                       impact === 'High' ? 4 :
                       impact === 'Medium' ? 3 :
                       impact === 'Low' ? 2 : 1;
    
    const riskScore = likelihoodScore * impactScore;
    
    return riskScore >= 20 ? 'Critical' :
           riskScore >= 12 ? 'High' :
           riskScore >= 6 ? 'Medium' : 'Low';
  };

  const filteredThreats = threats.filter((threat: any) => {
    if (searchTerm && !threat.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !threat.description.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    return true;
  });

  return (
    <Box sx={{ p: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" fontWeight="bold">
          Threats
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          Add Threat
        </Button>
      </Box>

      {/* Statistics Cards */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="h6" color="text.secondary">
                    Total Threats
                  </Typography>
                  <Typography variant="h4">
                    {totalCount}
                  </Typography>
                </Box>
                <WarningIcon sx={{ fontSize: 40, color: 'warning.main' }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="h6" color="text.secondary">
                    Critical
                  </Typography>
                  <Typography variant="h4" color="error.main">
                    {threats.filter((t: any) => calculateRiskLevel(t.likelihood, t.impact) === 'Critical').length}
                  </Typography>
                </Box>
                <TrendingUpIcon sx={{ fontSize: 40, color: 'error.main' }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="h6" color="text.secondary">
                    Mitigated
                  </Typography>
                  <Typography variant="h4" color="success.main">
                    {threats.filter((t: any) => t.status === 'mitigated').length}
                  </Typography>
                </Box>
                <CheckCircleIcon sx={{ fontSize: 40, color: 'success.main' }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="h6" color="text.secondary">
                    In Progress
                  </Typography>
                  <Typography variant="h4" color="info.main">
                    {threats.filter((t: any) => t.status === 'analyzing' || t.status === 'mitigating').length}
                  </Typography>
                </Box>
                <AssessmentIcon sx={{ fontSize: 40, color: 'info.main' }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              label="Search threats"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              size="small"
            />
          </Grid>
          
          <Grid item xs={12} sm={6} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Project</InputLabel>
              <Select
                value={filterProject}
                onChange={(e) => {
                  setFilterProject(e.target.value);
                  setFilterThreatModel('');
                }}
                label="Project"
              >
                <MenuItem value="">All Projects</MenuItem>
                {projects.map((project: any) => (
                  <MenuItem key={project.id} value={project.id}>
                    {project.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} sm={6} md={2}>
            <FormControl fullWidth size="small" disabled={!filterProject}>
              <InputLabel>Threat Model</InputLabel>
              <Select
                value={filterThreatModel}
                onChange={(e) => setFilterThreatModel(e.target.value)}
                label="Threat Model"
              >
                <MenuItem value="">All Models</MenuItem>
                {threatModels.map((model: any) => (
                  <MenuItem key={model.id} value={model.id}>
                    {model.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} sm={6} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Status</InputLabel>
              <Select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                label="Status"
              >
                <MenuItem value="">All Statuses</MenuItem>
                <MenuItem value="identified">Identified</MenuItem>
                <MenuItem value="analyzing">Analyzing</MenuItem>
                <MenuItem value="mitigating">Mitigating</MenuItem>
                <MenuItem value="mitigated">Mitigated</MenuItem>
                <MenuItem value="accepted">Accepted</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} sm={6} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Risk Level</InputLabel>
              <Select
                value={filterRiskLevel}
                onChange={(e) => setFilterRiskLevel(e.target.value)}
                label="Risk Level"
              >
                <MenuItem value="">All Levels</MenuItem>
                <MenuItem value="Critical">Critical</MenuItem>
                <MenuItem value="High">High</MenuItem>
                <MenuItem value="Medium">Medium</MenuItem>
                <MenuItem value="Low">Low</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} sm={6} md={1}>
            <Button
              fullWidth
              variant="outlined"
              onClick={() => {
                setFilterProject('');
                setFilterThreatModel('');
                setFilterStatus('');
                setFilterRiskLevel('');
                setSearchTerm('');
              }}
            >
              Clear
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Threats Table */}
      <TableContainer component={Paper}>
        {isLoading && <LinearProgress />}
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Threat</TableCell>
              <TableCell>Category</TableCell>
              <TableCell>Risk Level</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Component</TableCell>
              <TableCell>Assigned To</TableCell>
              <TableCell>Created</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredThreats.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  <Box py={4}>
                    <Typography variant="body1" color="text.secondary">
                      No threats found. Create your first threat to get started.
                    </Typography>
                  </Box>
                </TableCell>
              </TableRow>
            ) : (
              filteredThreats.map((threat: any) => {
                const riskLevel = calculateRiskLevel(threat.likelihood, threat.impact);
                return (
                  <TableRow key={threat.id} hover>
                    <TableCell>
                      <Box>
                        <Typography variant="body1" fontWeight="medium">
                          {threat.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 300 }}>
                          {threat.description}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <CategoryIcon fontSize="small" />
                        <Typography variant="body2">{threat.category}</Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={riskLevel}
                        color={getRiskLevelColor(riskLevel) as any}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        icon={getStatusIcon(threat.status) as any}
                        label={threat.status}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {threat.affectedComponent || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {threat.assignedTo ? (
                        <Stack direction="row" spacing={1} alignItems="center">
                          <PersonIcon fontSize="small" />
                          <Typography variant="body2">{threat.assignedTo}</Typography>
                        </Stack>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {format(new Date(threat.createdAt), 'MMM dd, yyyy')}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <IconButton
                        onClick={(e) => {
                          setAnchorEl(e.currentTarget);
                          setSelectedThreat(threat);
                        }}
                      >
                        <MoreIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
        
        <TablePagination
          component="div"
          count={totalCount}
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
        />
      </TableContainer>

      {/* Actions Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
      >
        <MenuItem onClick={() => {
          handleOpenDialog(selectedThreat);
          setAnchorEl(null);
        }}>
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Edit</ListItemText>
        </MenuItem>
        
        <MenuItem onClick={() => {
          // Navigate to mitigations
          setAnchorEl(null);
        }}>
          <ListItemIcon>
            <ShieldIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Manage Mitigations</ListItemText>
        </MenuItem>
        
        <Divider />
        
        <MenuItem onClick={() => handleDelete(selectedThreat)} sx={{ color: 'error.main' }}>
          <ListItemIcon>
            <DeleteIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
      </Menu>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingThreat ? 'Edit Threat' : 'Create New Threat'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Threat Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                required
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth required>
                <InputLabel>Project</InputLabel>
                <Select
                  value={filterProject}
                  onChange={(e) => {
                    setFilterProject(e.target.value);
                    setFormData({ ...formData, threatModelId: '' });
                  }}
                  label="Project"
                  disabled={!!editingThreat}
                >
                  <MenuItem value="">Select Project</MenuItem>
                  {projects.map((project: any) => (
                    <MenuItem key={project.id} value={project.id}>
                      {project.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth required disabled={!filterProject}>
                <InputLabel>Threat Model</InputLabel>
                <Select
                  value={formData.threatModelId}
                  onChange={(e) => setFormData({ ...formData, threatModelId: e.target.value })}
                  label="Threat Model"
                  disabled={!!editingThreat}
                >
                  <MenuItem value="">Select Threat Model</MenuItem>
                  {threatModels.map((model: any) => (
                    <MenuItem key={model.id} value={model.id}>
                      {model.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth required>
                <InputLabel>Category</InputLabel>
                <Select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  label="Category"
                >
                  <MenuItem value="Spoofing">Spoofing</MenuItem>
                  <MenuItem value="Tampering">Tampering</MenuItem>
                  <MenuItem value="Repudiation">Repudiation</MenuItem>
                  <MenuItem value="Information Disclosure">Information Disclosure</MenuItem>
                  <MenuItem value="Denial of Service">Denial of Service</MenuItem>
                  <MenuItem value="Elevation of Privilege">Elevation of Privilege</MenuItem>
                  <MenuItem value="Other">Other</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Affected Component"
                value={formData.affectedComponent}
                onChange={(e) => setFormData({ ...formData, affectedComponent: e.target.value })}
              />
            </Grid>
            
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth required>
                <InputLabel>Likelihood</InputLabel>
                <Select
                  value={formData.likelihood}
                  onChange={(e) => setFormData({ ...formData, likelihood: e.target.value })}
                  label="Likelihood"
                >
                  <MenuItem value="Very Low">Very Low</MenuItem>
                  <MenuItem value="Low">Low</MenuItem>
                  <MenuItem value="Medium">Medium</MenuItem>
                  <MenuItem value="High">High</MenuItem>
                  <MenuItem value="Very High">Very High</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth required>
                <InputLabel>Impact</InputLabel>
                <Select
                  value={formData.impact}
                  onChange={(e) => setFormData({ ...formData, impact: e.target.value })}
                  label="Impact"
                >
                  <MenuItem value="Very Low">Very Low</MenuItem>
                  <MenuItem value="Low">Low</MenuItem>
                  <MenuItem value="Medium">Medium</MenuItem>
                  <MenuItem value="High">High</MenuItem>
                  <MenuItem value="Very High">Very High</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  label="Status"
                >
                  <MenuItem value="identified">Identified</MenuItem>
                  <MenuItem value="analyzing">Analyzing</MenuItem>
                  <MenuItem value="mitigating">Mitigating</MenuItem>
                  <MenuItem value="mitigated">Mitigated</MenuItem>
                  <MenuItem value="accepted">Accepted</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12}>
              <Alert severity="info">
                Risk Level: {' '}
                <Chip
                  label={calculateRiskLevel(formData.likelihood, formData.impact)}
                  color={getRiskLevelColor(calculateRiskLevel(formData.likelihood, formData.impact)) as any}
                  size="small"
                />
                {' '}(calculated based on Likelihood × Impact)
              </Alert>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={createUpdateMutation.isPending}
          >
            {editingThreat ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Threats;
export { Threats };