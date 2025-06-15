import React, { useState } from 'react';
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
} from '@mui/icons-material';

interface Project {
  id: string;
  name: string;
  description: string;
  riskLevel: 'High' | 'Medium' | 'Low';
  threatModels: number;
  collaborators: number;
  progress: number;
  lastUpdated: string;
  owner: string;
  status: 'Active' | 'In Review' | 'Completed' | 'Archived';
}

const mockProjects: Project[] = [
  {
    id: '1',
    name: 'E-commerce Platform Security',
    description: 'Comprehensive threat modeling for our main e-commerce platform including payment processing and user data management.',
    riskLevel: 'High',
    threatModels: 5,
    collaborators: 8,
    progress: 75,
    lastUpdated: '2 days ago',
    owner: 'John Smith',
    status: 'Active',
  },
  {
    id: '2',
    name: 'Mobile Banking Application',
    description: 'Security assessment for the new mobile banking app focusing on authentication and transaction security.',
    riskLevel: 'High',
    threatModels: 3,
    collaborators: 6,
    progress: 60,
    lastUpdated: '1 week ago',
    owner: 'Sarah Johnson',
    status: 'In Review',
  },
  {
    id: '3',
    name: 'Internal HR System',
    description: 'Threat modeling for employee data management and access control systems.',
    riskLevel: 'Medium',
    threatModels: 2,
    collaborators: 4,
    progress: 90,
    lastUpdated: '3 days ago',
    owner: 'Mike Wilson',
    status: 'Active',
  },
  {
    id: '4',
    name: 'IoT Device Network',
    description: 'Security analysis for connected devices and network infrastructure.',
    riskLevel: 'Medium',
    threatModels: 4,
    collaborators: 5,
    progress: 45,
    lastUpdated: '5 days ago',
    owner: 'Emily Davis',
    status: 'Active',
  },
  {
    id: '5',
    name: 'Legacy System Migration',
    description: 'Security considerations during migration from legacy systems to cloud infrastructure.',
    riskLevel: 'Low',
    threatModels: 1,
    collaborators: 3,
    progress: 100,
    lastUpdated: '2 weeks ago',
    owner: 'Alex Chen',
    status: 'Completed',
  },
];

export const Projects: React.FC = () => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, projectId: string) => {
    setAnchorEl(event.currentTarget);
    setSelectedProject(projectId);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedProject(null);
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

  const filteredProjects = mockProjects.filter(project =>
    project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    project.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
      <Grid container spacing={3}>
        {filteredProjects.map((project) => (
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
                      {project.threatModels} models
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <People fontSize="small" color="action" />
                    <Typography variant="body2">
                      {project.collaborators} people
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Schedule fontSize="small" color="action" />
                    <Typography variant="body2">
                      {project.lastUpdated}
                    </Typography>
                  </Box>
                </Box>

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

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Avatar sx={{ width: 24, height: 24, fontSize: '0.75rem' }}>
                    {project.owner.split(' ').map(n => n[0]).join('')}
                  </Avatar>
                  <Typography variant="body2" color="text.secondary">
                    {project.owner}
                  </Typography>
                </Box>
              </CardContent>

              <CardActions>
                <Button size="small">View Details</Button>
                <Button size="small">Open</Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Empty State */}
      {filteredProjects.length === 0 && (
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
            <Button variant="contained" startIcon={<Add />}>
              Create Project
            </Button>
          )}
        </Box>
      )}

      {/* Floating Action Button */}
      <Fab
        color="primary"
        aria-label="add project"
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
        <MenuItem onClick={handleMenuClose}>
          <Edit sx={{ mr: 1 }} />
          Edit
        </MenuItem>
        <MenuItem onClick={handleMenuClose}>
          <Security sx={{ mr: 1 }} />
          View Threat Models
        </MenuItem>
        <MenuItem onClick={handleMenuClose} sx={{ color: 'error.main' }}>
          <Delete sx={{ mr: 1 }} />
          Delete
        </MenuItem>
      </Menu>
    </Box>
  );
};