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
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Paper,
  Chip,
  IconButton,
  Breadcrumbs,
  Link,
} from '@mui/material';
import {
  ArrowBack,
  Security,
  Description,
  Settings,
  CheckCircle,
  NavigateNext,
} from '@mui/icons-material';
import { threatModelsApi, projectsApi } from '@/services/api';

interface CreateThreatModelForm {
  name: string;
  description: string;
  methodology: string;
  scope: string;
  assumptions: string;
  threats: string[];
}

const methodologies = [
  {
    value: 'STRIDE',
    label: 'STRIDE',
    description: 'Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Elevation of Privilege',
    color: 'primary'
  },
  {
    value: 'PASTA',
    label: 'PASTA',
    description: 'Process for Attack Simulation and Threat Analysis',
    color: 'secondary'
  },
  {
    value: 'LINDDUN',
    label: 'LINDDUN',
    description: 'Linkability, Identifiability, Non-repudiation, Detectability, Disclosure, Unawareness, Non-compliance',
    color: 'success'
  },
  {
    value: 'VAST',
    label: 'VAST',
    description: 'Visual, Agile, and Simple Threat modeling',
    color: 'warning'
  },
  {
    value: 'DREAD',
    label: 'DREAD',
    description: 'Damage, Reproducibility, Exploitability, Affected Users, Discoverability',
    color: 'error'
  }
];

const steps = [
  'Basic Information',
  'Methodology & Scope',
  'Review & Create'
];

export const CreateThreatModel: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeStep, setActiveStep] = useState(0);
  const [formData, setFormData] = useState<CreateThreatModelForm>({
    name: '',
    description: '',
    methodology: 'STRIDE',
    scope: '',
    assumptions: '',
    threats: []
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Fetch project details
  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      if (!projectId) throw new Error('Project ID is required');
      const response = await projectsApi.getProject(projectId);
      return response.data?.data || response.data;
    },
    enabled: !!projectId,
  });

  // Create threat model mutation
  const createThreatModelMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await threatModelsApi.createThreatModel({
        ...data,
        projectId,
        status: 'draft'
      });
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['threatModels'] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      // Navigate to the newly created threat model
      navigate(`/threat-models/${data.data?.id || data.id}`);
    },
    onError: (error: any) => {
      console.error('Failed to create threat model:', error);
    },
  });

  const handleNext = () => {
    if (validateCurrentStep()) {
      setActiveStep((prevActiveStep) => prevActiveStep + 1);
    }
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const handleCreate = () => {
    if (validateCurrentStep()) {
      createThreatModelMutation.mutate(formData);
    }
  };

  const validateCurrentStep = () => {
    const newErrors: Record<string, string> = {};

    if (activeStep === 0) {
      if (!formData.name.trim()) {
        newErrors.name = 'Threat model name is required';
      }
      if (!formData.description.trim()) {
        newErrors.description = 'Description is required';
      }
    }

    if (activeStep === 1) {
      if (!formData.methodology) {
        newErrors.methodology = 'Methodology is required';
      }
      if (!formData.scope.trim()) {
        newErrors.scope = 'Scope is required';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleFormChange = (field: keyof CreateThreatModelForm) => (
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

  const selectedMethodology = methodologies.find(m => m.value === formData.methodology);

  const renderStepContent = (step: number) => {
    switch (step) {
      case 0:
        return (
          <Box sx={{ mt: 2 }}>
            <TextField
              fullWidth
              label="Threat Model Name"
              value={formData.name}
              onChange={handleFormChange('name')}
              error={!!errors.name}
              helperText={errors.name}
              margin="normal"
              placeholder="e.g., User Authentication Flow"
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
              placeholder="Describe what this threat model covers..."
            />
          </Box>
        );

      case 1:
        return (
          <Box sx={{ mt: 2 }}>
            <TextField
              select
              fullWidth
              label="Methodology"
              value={formData.methodology}
              onChange={handleFormChange('methodology')}
              margin="normal"
              helperText="Choose the threat modeling methodology"
            >
              {methodologies.map((method) => (
                <MenuItem key={method.value} value={method.value}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip
                      label={method.label}
                      color={method.color as any}
                      size="small"
                    />
                    <Typography variant="body2">{method.description}</Typography>
                  </Box>
                </MenuItem>
              ))}
            </TextField>

            {selectedMethodology && (
              <Alert severity="info" sx={{ mt: 2 }}>
                <Typography variant="body2">
                  <strong>{selectedMethodology.label}</strong>: {selectedMethodology.description}
                </Typography>
              </Alert>
            )}

            <TextField
              fullWidth
              label="Scope"
              value={formData.scope}
              onChange={handleFormChange('scope')}
              error={!!errors.scope}
              helperText={errors.scope || "Define what parts of the system this threat model covers"}
              margin="normal"
              multiline
              rows={3}
              placeholder="e.g., User login system, API endpoints, data flows..."
            />

            <TextField
              fullWidth
              label="Assumptions"
              value={formData.assumptions}
              onChange={handleFormChange('assumptions')}
              margin="normal"
              multiline
              rows={3}
              placeholder="List key assumptions about the system or environment..."
            />
          </Box>
        );

      case 2:
        return (
          <Box sx={{ mt: 2 }}>
            <Typography variant="h6" gutterBottom>
              Review Your Threat Model
            </Typography>
            
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="subtitle1" gutterBottom>
                    Basic Information
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    <strong>Name:</strong> {formData.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    <strong>Description:</strong> {formData.description}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    <strong>Project:</strong> {project?.name}
                  </Typography>
                </Paper>
              </Grid>

              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="subtitle1" gutterBottom>
                    Methodology & Scope
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Chip
                      label={formData.methodology}
                      color={selectedMethodology?.color as any}
                      size="small"
                    />
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    <strong>Scope:</strong> {formData.scope}
                  </Typography>
                  {formData.assumptions && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      <strong>Assumptions:</strong> {formData.assumptions}
                    </Typography>
                  )}
                </Paper>
              </Grid>
            </Grid>
          </Box>
        );

      default:
        return null;
    }
  };

  if (projectLoading) {
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
          <IconButton onClick={() => navigate(`/projects/${projectId}`)} sx={{ mr: 2 }}>
            <ArrowBack />
          </IconButton>
          <Typography variant="h4" sx={{ flexGrow: 1 }}>
            Create Threat Model
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
            onClick={() => navigate(`/projects/${projectId}`)}
            sx={{ textDecoration: 'none' }}
          >
            {project?.name}
          </Link>
          <Typography color="text.primary">New Threat Model</Typography>
        </Breadcrumbs>
      </Box>

      {/* Main Content */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Stepper activeStep={activeStep} orientation="vertical">
                {steps.map((label, index) => (
                  <Step key={label}>
                    <StepLabel>
                      <Typography variant="h6">{label}</Typography>
                    </StepLabel>
                    <StepContent>
                      {renderStepContent(index)}
                      <Box sx={{ mt: 2 }}>
                        <Button
                          disabled={activeStep === 0}
                          onClick={handleBack}
                          sx={{ mr: 1 }}
                        >
                          Back
                        </Button>
                        {activeStep === steps.length - 1 ? (
                          <Button
                            variant="contained"
                            onClick={handleCreate}
                            disabled={createThreatModelMutation.isPending}
                            startIcon={createThreatModelMutation.isPending ? <CircularProgress size={20} /> : <CheckCircle />}
                          >
                            {createThreatModelMutation.isPending ? 'Creating...' : 'Create Threat Model'}
                          </Button>
                        ) : (
                          <Button variant="contained" onClick={handleNext}>
                            Next
                          </Button>
                        )}
                      </Box>
                    </StepContent>
                  </Step>
                ))}
              </Stepper>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Project Information
              </Typography>
              {project && (
                <Box>
                  <Typography variant="body1" gutterBottom>
                    {project.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" paragraph>
                    {project.description}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                    <Chip
                      label={project.riskLevel}
                      color={project.riskLevel === 'High' ? 'error' : project.riskLevel === 'Medium' ? 'warning' : 'success'}
                      size="small"
                    />
                    <Chip
                      label={project.status}
                      variant="outlined"
                      size="small"
                    />
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    <strong>Progress:</strong> {project.progress || 0}%
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    <strong>Threat Models:</strong> {project.threatModels || 0}
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>

          <Card sx={{ mt: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Methodology Guide
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Choose a methodology that best fits your project's needs:
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {methodologies.map((method) => (
                  <Box key={method.value} sx={{ p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <Chip
                        label={method.label}
                        color={method.color as any}
                        size="small"
                      />
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      {method.description}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};