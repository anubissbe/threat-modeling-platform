import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  TextField,
  MenuItem,
  Grid,
  Alert,
  CircularProgress,
  IconButton,
  Breadcrumbs,
  Link,
  Chip,
  FormControl,
  InputLabel,
  Select,
  OutlinedInput,
  FormHelperText,
} from '@mui/material';
import {
  ArrowBack,
  Save,
  Cancel,
  NavigateNext,
  Edit,
} from '@mui/icons-material';
import { projectsApi } from '@/services/api';

interface ProjectFormData {
  name: string;
  description: string;
  riskLevel: 'Critical' | 'High' | 'Medium' | 'Low';
  status: 'Active' | 'Inactive' | 'Completed' | 'Archived';
  owner: string;
  tags: string[];
}

export const ProjectEdit: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<ProjectFormData>({
    name: '',
    description: '',
    riskLevel: 'Medium',
    status: 'Active',
    owner: '',
    tags: [],
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notification, setNotification] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info';
  }>({
    open: false,
    message: '',
    severity: 'info',
  });

  // Fetch project details
  const { data: project, isLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: async () => {
      if (!id) throw new Error('Project ID is required');
      const response = await projectsApi.getProject(id);
      const projectData = response.data?.data || response.data;
      
      // Initialize form with project data
      setFormData({
        name: projectData.name || '',
        description: projectData.description || '',
        riskLevel: projectData.riskLevel || 'Medium',
        status: projectData.status || 'Active',
        owner: projectData.owner || '',
        tags: projectData.tags || [],
      });
      
      return projectData;
    },
    enabled: !!id,
  });

  // Update project mutation
  const updateProjectMutation = useMutation({
    mutationFn: async (data: Partial<ProjectFormData>) => {
      if (!id) throw new Error('Project ID is required');
      const response = await projectsApi.updateProject(id, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setNotification({
        open: true,
        message: 'Project updated successfully!',
        severity: 'success',
      });
      // Navigate back to project details after a short delay
      setTimeout(() => {
        navigate(`/projects/${id}`);
      }, 1500);
    },
    onError: (error: any) => {
      setNotification({
        open: true,
        message: error.response?.data?.message || 'Failed to update project',
        severity: 'error',
      });
    },
  });

  const handleFormChange = (field: keyof ProjectFormData) => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setFormData(prev => ({
      ...prev,
      [field]: event.target.value
    }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleTagsChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const tags = event.target.value.split(',').map(tag => tag.trim()).filter(tag => tag);
    setFormData(prev => ({
      ...prev,
      tags
    }));
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Project name is required';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    }

    if (!formData.owner.trim()) {
      newErrors.owner = 'Owner is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    
    if (validateForm()) {
      updateProjectMutation.mutate(formData);
    }
  };

  const handleCancel = () => {
    navigate(`/projects/${id}`);
  };

  const getRiskColor = (risk: string) => {
    switch (risk.toLowerCase()) {
      case 'critical': return 'error';
      case 'high': return 'warning';
      case 'medium': return 'info';
      case 'low': return 'success';
      default: return 'default';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active': return 'success';
      case 'inactive': return 'warning';
      case 'completed': return 'info';
      case 'archived': return 'default';
      default: return 'default';
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <IconButton onClick={() => navigate(`/projects/${id}`)} sx={{ mr: 2 }}>
            <ArrowBack />
          </IconButton>
          <Typography variant="h4" sx={{ flexGrow: 1 }}>
            Edit Project
          </Typography>
        </Box>

        <Breadcrumbs separator={<NavigateNext fontSize="small" />}>
          <Link
            component="button"
            variant="body2"
            onClick={() => navigate('/projects')}
            sx={{ textDecoration: 'none' }}
          >
            Projects
          </Link>
          <Link
            component="button"
            variant="body2"
            onClick={() => navigate(`/projects/${id}`)}
            sx={{ textDecoration: 'none' }}
          >
            {project?.name}
          </Link>
          <Typography color="text.primary">Edit</Typography>
        </Breadcrumbs>
      </Box>

      {/* Notification */}
      {notification.open && (
        <Alert 
          severity={notification.severity} 
          sx={{ mb: 4 }}
          onClose={() => setNotification(prev => ({ ...prev, open: false }))}
        >
          {notification.message}
        </Alert>
      )}

      {/* Form */}
      <Card>
        <CardContent>
          <Box component="form" onSubmit={handleSubmit}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={8}>
                <TextField
                  fullWidth
                  label="Project Name"
                  value={formData.name}
                  onChange={handleFormChange('name')}
                  error={!!errors.name}
                  helperText={errors.name}
                  margin="normal"
                  required
                />

                <TextField
                  fullWidth
                  label="Description"
                  value={formData.description}
                  onChange={handleFormChange('description')}
                  error={!!errors.description}
                  helperText={errors.description}
                  margin="normal"
                  multiline
                  rows={4}
                  required
                />

                <TextField
                  fullWidth
                  label="Owner"
                  value={formData.owner}
                  onChange={handleFormChange('owner')}
                  error={!!errors.owner}
                  helperText={errors.owner}
                  margin="normal"
                  required
                />

                <TextField
                  fullWidth
                  label="Tags (comma-separated)"
                  value={formData.tags.join(', ')}
                  onChange={handleTagsChange}
                  margin="normal"
                  placeholder="e.g., web-app, payment, critical"
                  helperText="Enter tags separated by commas"
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <FormControl fullWidth margin="normal">
                  <InputLabel>Risk Level</InputLabel>
                  <Select
                    value={formData.riskLevel}
                    onChange={handleFormChange('riskLevel')}
                    input={<OutlinedInput label="Risk Level" />}
                  >
                    <MenuItem value="Critical">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip
                          label="Critical"
                          color="error"
                          size="small"
                        />
                      </Box>
                    </MenuItem>
                    <MenuItem value="High">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip
                          label="High"
                          color="warning"
                          size="small"
                        />
                      </Box>
                    </MenuItem>
                    <MenuItem value="Medium">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip
                          label="Medium"
                          color="info"
                          size="small"
                        />
                      </Box>
                    </MenuItem>
                    <MenuItem value="Low">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip
                          label="Low"
                          color="success"
                          size="small"
                        />
                      </Box>
                    </MenuItem>
                  </Select>
                </FormControl>

                <FormControl fullWidth margin="normal">
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={formData.status}
                    onChange={handleFormChange('status')}
                    input={<OutlinedInput label="Status" />}
                  >
                    <MenuItem value="Active">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip
                          label="Active"
                          color="success"
                          size="small"
                          variant="outlined"
                        />
                      </Box>
                    </MenuItem>
                    <MenuItem value="Inactive">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip
                          label="Inactive"
                          color="warning"
                          size="small"
                          variant="outlined"
                        />
                      </Box>
                    </MenuItem>
                    <MenuItem value="Completed">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip
                          label="Completed"
                          color="info"
                          size="small"
                          variant="outlined"
                        />
                      </Box>
                    </MenuItem>
                    <MenuItem value="Archived">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip
                          label="Archived"
                          color="default"
                          size="small"
                          variant="outlined"
                        />
                      </Box>
                    </MenuItem>
                  </Select>
                </FormControl>

                {/* Current Settings Preview */}
                <Box sx={{ mt: 3, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Current Settings
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                    <Chip
                      label={formData.riskLevel}
                      color={getRiskColor(formData.riskLevel) as any}
                      size="small"
                    />
                    <Chip
                      label={formData.status}
                      color={getStatusColor(formData.status) as any}
                      size="small"
                      variant="outlined"
                    />
                  </Box>
                  {formData.tags.length > 0 && (
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                      {formData.tags.map((tag, index) => (
                        <Chip
                          key={index}
                          label={tag}
                          size="small"
                          variant="outlined"
                          color="primary"
                        />
                      ))}
                    </Box>
                  )}
                </Box>
              </Grid>
            </Grid>

            {/* Actions */}
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', mt: 4 }}>
              <Button
                variant="outlined"
                onClick={handleCancel}
                startIcon={<Cancel />}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="contained"
                disabled={updateProjectMutation.isPending}
                startIcon={updateProjectMutation.isPending ? <CircularProgress size={20} /> : <Save />}
              >
                {updateProjectMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};