import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  CardActions,
  TextField,
  InputAdornment,
  Fab,
  Alert,
  Chip,
  IconButton,
  Menu,
  MenuItem,
} from '@mui/material';
import {
  Add,
  Search,
  FilterList,
  MoreVert,
  FolderOpen,
  Group,
  Security,
  Schedule,
  Edit,
  Delete,
  Star,
  StarBorder,
  Visibility,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { ProjectCreateDialog } from '../components/Projects/ProjectCreateDialog';
import { ProjectFilters } from '../components/Projects/ProjectFilters';
import { useRoleCheck } from '../hooks/useRoleCheck';

interface Project {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'archived' | 'draft';
  priority: 'low' | 'medium' | 'high' | 'critical';
  organization: string;
  owner: {
    id: string;
    name: string;
    email: string;
  };
  members: Array<{
    id: string;
    name: string;
    role: string;
  }>;
  threatModels: {
    total: number;
    active: number;
    completed: number;
  };
  lastModified: string;
  createdAt: string;
  tags: string[];
  isStarred: boolean;
  visibility: 'private' | 'team' | 'organization';
}

interface ProjectFilters {
  status: string[];
  priority: string[];
  tags: string[];
  organization: string;
  owner: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

export const Projects: React.FC = () => {
  const navigate = useNavigate();
  const { canManageProjects, hasRole } = useRoleCheck();

  const [projects, setProjects] = useState<Project[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  
  // Menu states
  const [projectMenuAnchor, setProjectMenuAnchor] = useState<null | HTMLElement>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  
  // Filters
  const [filters, setFilters] = useState<ProjectFilters>({
    status: [],
    priority: [],
    tags: [],
    organization: '',
    owner: '',
    sortBy: 'lastModified',
    sortOrder: 'desc',
  });

  const fetchProjects = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/projects', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setProjects(data);
      } else {
        setError('Failed to fetch projects');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const filterAndSortProjects = useCallback(() => {
    const filtered = projects.filter(project => {
      // Search query filter
      if (searchQuery) {
        const searchLower = searchQuery.toLowerCase();
        const matchesSearch = 
          project.name.toLowerCase().includes(searchLower) ||
          project.description.toLowerCase().includes(searchLower) ||
          project.tags.some(tag => tag.toLowerCase().includes(searchLower)) ||
          project.owner.name.toLowerCase().includes(searchLower);
        
        if (!matchesSearch) return false;
      }

      // Status filter
      if (filters.status.length > 0 && !filters.status.includes(project.status)) {
        return false;
      }

      // Priority filter
      if (filters.priority.length > 0 && !filters.priority.includes(project.priority)) {
        return false;
      }

      // Tags filter
      if (filters.tags.length > 0) {
        const hasMatchingTag = filters.tags.some(tag => 
          project.tags.some(projectTag => projectTag.toLowerCase().includes(tag.toLowerCase()))
        );
        if (!hasMatchingTag) return false;
      }

      // Organization filter
      if (filters.organization && project.organization !== filters.organization) {
        return false;
      }

      // Owner filter
      if (filters.owner && project.owner.id !== filters.owner) {
        return false;
      }

      return true;
    });

    // Sort projects
    filtered.sort((a, b) => {
      let aValue: string | number | Date = a[filters.sortBy as keyof Project] as string | number | Date;
      let bValue: string | number | Date = b[filters.sortBy as keyof Project] as string | number | Date;

      // Handle special cases
      if (filters.sortBy === 'owner') {
        aValue = a.owner.name;
        bValue = b.owner.name;
      } else if (filters.sortBy === 'threatModels') {
        aValue = a.threatModels.total;
        bValue = b.threatModels.total;
      }

      // Handle date sorting
      if (filters.sortBy === 'lastModified' || filters.sortBy === 'createdAt') {
        aValue = new Date(aValue).getTime();
        bValue = new Date(bValue).getTime();
      }

      // Handle string comparison
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (filters.sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    setFilteredProjects(filtered);
  }, [projects, searchQuery, filters]);

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    filterAndSortProjects();
  }, [filterAndSortProjects]);

  const handleProjectMenuOpen = (event: React.MouseEvent<HTMLElement>, project: Project) => {
    event.stopPropagation();
    setProjectMenuAnchor(event.currentTarget);
    setSelectedProject(project);
  };

  const handleProjectMenuClose = () => {
    setProjectMenuAnchor(null);
    setSelectedProject(null);
  };

  const handleProjectClick = (projectId: string) => {
    navigate(`/projects/${projectId}`);
  };

  const handleStarProject = async (projectId: string, isStarred: boolean) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/star`, {
        method: isStarred ? 'DELETE' : 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        setProjects(prev => prev.map(project => 
          project.id === projectId 
            ? { ...project, isStarred: !isStarred }
            : project
        ));
      }
    } catch {
      setError('Failed to update project star status');
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    if (!confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        setProjects(prev => prev.filter(project => project.id !== projectId));
        handleProjectMenuClose();
      } else {
        setError('Failed to delete project');
      }
    } catch {
      setError('Network error. Please try again.');
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'error';
      case 'high': return 'warning';
      case 'medium': return 'info';
      case 'low': return 'success';
      default: return 'default';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'success';
      case 'draft': return 'warning';
      case 'archived': return 'default';
      default: return 'default';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffInDays === 0) return 'Today';
    if (diffInDays === 1) return 'Yesterday';
    if (diffInDays < 7) return `${diffInDays} days ago`;
    if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} weeks ago`;
    return date.toLocaleDateString();
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">
          Projects
        </Typography>
        {canManageProjects() && (
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => setShowCreateDialog(true)}
          >
            New Project
          </Button>
        )}
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Box display="flex" gap={2} mb={3}>
        <TextField
          placeholder="Search projects..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
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
          onClick={() => setShowFilters(true)}
        >
          Filters
        </Button>
      </Box>

      <Grid container spacing={3}>
        {filteredProjects.map((project) => (
          <Grid item xs={12} sm={6} md={4} key={project.id}>
            <Card 
              sx={{ 
                height: '100%', 
                display: 'flex', 
                flexDirection: 'column',
                cursor: 'pointer',
                '&:hover': { boxShadow: 4 }
              }}
              onClick={() => handleProjectClick(project.id)}
            >
              <CardContent sx={{ flexGrow: 1 }}>
                <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <FolderOpen color="primary" />
                    <Typography variant="h6" noWrap>
                      {project.name}
                    </Typography>
                  </Box>
                  <Box display="flex" alignItems="center">
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStarProject(project.id, project.isStarred);
                      }}
                    >
                      {project.isStarred ? <Star color="warning" /> : <StarBorder />}
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={(e) => handleProjectMenuOpen(e, project)}
                    >
                      <MoreVert />
                    </IconButton>
                  </Box>
                </Box>

                <Typography 
                  variant="body2" 
                  color="text.secondary" 
                  sx={{ mb: 2, minHeight: 40 }}
                >
                  {project.description}
                </Typography>

                <Box display="flex" gap={1} mb={2} flexWrap="wrap">
                  <Chip 
                    label={project.status} 
                    size="small" 
                    color={getStatusColor(project.status) as 'success' | 'default'}
                    variant="outlined"
                  />
                  <Chip 
                    label={project.priority} 
                    size="small" 
                    color={getPriorityColor(project.priority) as 'error' | 'warning' | 'info' | 'success' | 'default'}
                  />
                  <Chip 
                    label={project.visibility} 
                    size="small" 
                    variant="outlined"
                    icon={<Visibility />}
                  />
                </Box>

                <Box display="flex" alignItems="center" gap={2} mb={2}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <Security fontSize="small" color="action" />
                    <Typography variant="body2" color="text.secondary">
                      {project.threatModels.total} models
                    </Typography>
                  </Box>
                  <Box display="flex" alignItems="center" gap={1}>
                    <Group fontSize="small" color="action" />
                    <Typography variant="body2" color="text.secondary">
                      {project.members.length} members
                    </Typography>
                  </Box>
                </Box>

                <Box display="flex" alignItems="center" gap={1}>
                  <Schedule fontSize="small" color="action" />
                  <Typography variant="body2" color="text.secondary">
                    Updated {formatDate(project.lastModified)}
                  </Typography>
                </Box>

                {project.tags.length > 0 && (
                  <Box mt={2}>
                    {project.tags.slice(0, 3).map((tag, index) => (
                      <Chip
                        key={index}
                        label={tag}
                        size="small"
                        variant="outlined"
                        sx={{ mr: 0.5, mb: 0.5 }}
                      />
                    ))}
                    {project.tags.length > 3 && (
                      <Chip
                        label={`+${project.tags.length - 3}`}
                        size="small"
                        variant="outlined"
                        sx={{ mr: 0.5, mb: 0.5 }}
                      />
                    )}
                  </Box>
                )}
              </CardContent>

              <CardActions>
                <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                  by {project.owner.name}
                </Typography>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>

      {filteredProjects.length === 0 && !isLoading && (
        <Box textAlign="center" py={8}>
          <FolderOpen sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            {searchQuery || filters.status.length > 0 || filters.priority.length > 0
              ? 'No projects match your search criteria'
              : 'No projects yet'}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {searchQuery || filters.status.length > 0 || filters.priority.length > 0
              ? 'Try adjusting your search or filters'
              : 'Create your first project to get started with threat modeling'}
          </Typography>
          {canManageProjects() && !searchQuery && (
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => setShowCreateDialog(true)}
            >
              Create Project
            </Button>
          )}
        </Box>
      )}

      {/* Floating Action Button for mobile */}
      {canManageProjects() && (
        <Fab
          color="primary"
          aria-label="add project"
          sx={{
            position: 'fixed',
            bottom: 16,
            right: 16,
            display: { xs: 'flex', sm: 'none' }
          }}
          onClick={() => setShowCreateDialog(true)}
        >
          <Add />
        </Fab>
      )}

      {/* Project Menu */}
      <Menu
        anchorEl={projectMenuAnchor}
        open={Boolean(projectMenuAnchor)}
        onClose={handleProjectMenuClose}
      >
        <MenuItem onClick={() => {
          if (selectedProject) {
            navigate(`/projects/${selectedProject.id}`);
          }
          handleProjectMenuClose();
        }}>
          <FolderOpen sx={{ mr: 1 }} />
          Open Project
        </MenuItem>
        {canManageProjects() && (
          <MenuItem onClick={() => {
            if (selectedProject) {
              navigate(`/projects/${selectedProject.id}/edit`);
            }
            handleProjectMenuClose();
          }}>
            <Edit sx={{ mr: 1 }} />
            Edit Project
          </MenuItem>
        )}
        {(canManageProjects() || hasRole('admin')) && (
          <MenuItem 
            onClick={() => {
              if (selectedProject) {
                handleDeleteProject(selectedProject.id);
              }
            }}
            sx={{ color: 'error.main' }}
          >
            <Delete sx={{ mr: 1 }} />
            Delete Project
          </MenuItem>
        )}
      </Menu>

      {/* Dialogs */}
      <ProjectCreateDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onProjectCreated={(project) => {
          setProjects(prev => [project, ...prev]);
          setShowCreateDialog(false);
        }}
      />

      <ProjectFilters
        open={showFilters}
        onClose={() => setShowFilters(false)}
        filters={filters}
        onFiltersChange={setFilters}
      />
    </Box>
  );
};