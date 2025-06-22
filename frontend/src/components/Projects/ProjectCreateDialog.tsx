import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Box,
  Typography,
  Autocomplete,
  FormControlLabel,
  Switch,
  Alert,
  Stepper,
  Step,
  StepLabel,
  StepContent,
} from '@mui/material';
import { Add, Close } from '@mui/icons-material';

interface ProjectFormData {
  name: string;
  description: string;
  status: 'draft' | 'active';
  priority: 'low' | 'medium' | 'high' | 'critical';
  visibility: 'private' | 'team' | 'organization';
  tags: string[];
  templateId?: string;
  enableNotifications: boolean;
  organization: string;
}

interface ProjectCreateDialogProps {
  open: boolean;
  onClose: () => void;
  onProjectCreated: (project: any) => void;
}

const PROJECT_TEMPLATES = [
  { id: 'web-app', name: 'Web Application', description: 'Standard web application threat model template' },
  { id: 'mobile-app', name: 'Mobile Application', description: 'Mobile app security assessment template' },
  { id: 'api', name: 'API Service', description: 'REST/GraphQL API threat modeling template' },
  { id: 'iot', name: 'IoT Device', description: 'Internet of Things device security template' },
  { id: 'cloud', name: 'Cloud Infrastructure', description: 'Cloud-native application template' },
  { id: 'blank', name: 'Blank Project', description: 'Start from scratch with no template' },
];

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low', color: 'success' },
  { value: 'medium', label: 'Medium', color: 'info' },
  { value: 'high', label: 'High', color: 'warning' },
  { value: 'critical', label: 'Critical', color: 'error' },
];

const COMMON_TAGS = [
  'web-application', 'mobile-app', 'api', 'cloud', 'iot', 'database',
  'authentication', 'payment', 'healthcare', 'financial', 'e-commerce',
  'internal', 'external', 'compliance', 'gdpr', 'hipaa', 'pci-dss'
];

export const ProjectCreateDialog: React.FC<ProjectCreateDialogProps> = ({
  open,
  onClose,
  onProjectCreated,
}) => {
  const [activeStep, setActiveStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState<ProjectFormData>({
    name: '',
    description: '',
    status: 'draft',
    priority: 'medium',
    visibility: 'team',
    tags: [],
    templateId: 'blank',
    enableNotifications: true,
    organization: '',
  });

  const [tagInput, setTagInput] = useState('');

  const steps = [
    { label: 'Basic Information', description: 'Project name and description' },
    { label: 'Configuration', description: 'Priority, visibility, and settings' },
    { label: 'Template Selection', description: 'Choose a starting template' },
  ];

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      status: 'draft',
      priority: 'medium',
      visibility: 'team',
      tags: [],
      templateId: 'blank',
      enableNotifications: true,
      organization: '',
    });
    setActiveStep(0);
    setError('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleNext = () => {
    setActiveStep(prev => prev + 1);
  };

  const handleBack = () => {
    setActiveStep(prev => prev - 1);
  };

  const handleFormChange = (field: keyof ProjectFormData, value: string | string[] | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, tagInput.trim()],
      }));
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove),
    }));
  };

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 0:
        return formData.name.trim().length >= 3 && formData.description.trim().length >= 10;
      case 1:
        return true; // All fields have defaults
      case 2:
        return !!formData.templateId;
      default:
        return true;
    }
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const newProject = await response.json();
        onProjectCreated(newProject);
        handleClose();
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Failed to create project');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const renderStepContent = (step: number) => {
    switch (step) {
      case 0:
        return (
          <Box display="flex" flexDirection="column" gap={3}>
            <TextField
              fullWidth
              label="Project Name"
              value={formData.name}
              onChange={(e) => handleFormChange('name', e.target.value)}
              required
              error={formData.name.length > 0 && formData.name.length < 3}
              helperText={
                formData.name.length > 0 && formData.name.length < 3
                  ? 'Project name must be at least 3 characters'
                  : 'Enter a descriptive name for your project'
              }
            />

            <TextField
              fullWidth
              multiline
              rows={4}
              label="Description"
              value={formData.description}
              onChange={(e) => handleFormChange('description', e.target.value)}
              required
              error={formData.description.length > 0 && formData.description.length < 10}
              helperText={
                formData.description.length > 0 && formData.description.length < 10
                  ? 'Description must be at least 10 characters'
                  : 'Describe the purpose and scope of this project'
              }
            />

            <TextField
              fullWidth
              label="Organization"
              value={formData.organization}
              onChange={(e) => handleFormChange('organization', e.target.value)}
              helperText="Optional: Specify the organization this project belongs to"
            />
          </Box>
        );

      case 1:
        return (
          <Box display="flex" flexDirection="column" gap={3}>
            <FormControl fullWidth>
              <InputLabel>Priority</InputLabel>
              <Select
                value={formData.priority}
                onChange={(e) => handleFormChange('priority', e.target.value)}
                label="Priority"
              >
                {PRIORITY_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    <Box display="flex" alignItems="center" gap={1}>
                      <Chip 
                        label={option.label} 
                        size="small" 
                        color={option.color as 'success' | 'info' | 'warning' | 'error'}
                      />
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Visibility</InputLabel>
              <Select
                value={formData.visibility}
                onChange={(e) => handleFormChange('visibility', e.target.value)}
                label="Visibility"
              >
                <MenuItem value="private">
                  <Box>
                    <Typography variant="body2">Private</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Only you can access this project
                    </Typography>
                  </Box>
                </MenuItem>
                <MenuItem value="team">
                  <Box>
                    <Typography variant="body2">Team</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Team members can access this project
                    </Typography>
                  </Box>
                </MenuItem>
                <MenuItem value="organization">
                  <Box>
                    <Typography variant="body2">Organization</Typography>
                    <Typography variant="caption" color="text.secondary">
                      All organization members can access this project
                    </Typography>
                  </Box>
                </MenuItem>
              </Select>
            </FormControl>

            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Tags
              </Typography>
              <Box display="flex" flexWrap="wrap" gap={1} mb={2}>
                {formData.tags.map((tag) => (
                  <Chip
                    key={tag}
                    label={tag}
                    onDelete={() => handleRemoveTag(tag)}
                    size="small"
                    variant="outlined"
                  />
                ))}
              </Box>
              <Autocomplete
                freeSolo
                options={COMMON_TAGS}
                value={tagInput}
                onChange={(_, newValue) => {
                  if (typeof newValue === 'string') {
                    setTagInput(newValue);
                  }
                }}
                onInputChange={(_, newInputValue) => {
                  setTagInput(newInputValue);
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Add tags"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddTag();
                      }
                    }}
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {tagInput && (
                            <Button
                              size="small"
                              startIcon={<Add />}
                              onClick={handleAddTag}
                            >
                              Add
                            </Button>
                          )}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    }}
                  />
                )}
              />
            </Box>

            <FormControlLabel
              control={
                <Switch
                  checked={formData.enableNotifications}
                  onChange={(e) => handleFormChange('enableNotifications', e.target.checked)}
                />
              }
              label="Enable notifications for this project"
            />
          </Box>
        );

      case 2:
        return (
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Choose a Template
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Templates provide pre-configured threat models and components to help you get started quickly.
            </Typography>
            
            <Box display="flex" flexDirection="column" gap={2}>
              {PROJECT_TEMPLATES.map((template) => (
                <Box
                  key={template.id}
                  sx={{
                    p: 2,
                    border: 1,
                    borderColor: formData.templateId === template.id ? 'primary.main' : 'divider',
                    borderRadius: 1,
                    cursor: 'pointer',
                    '&:hover': { borderColor: 'primary.main' },
                    backgroundColor: formData.templateId === template.id ? 'primary.50' : 'transparent',
                  }}
                  onClick={() => handleFormChange('templateId', template.id)}
                >
                  <Typography variant="subtitle2" gutterBottom>
                    {template.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {template.description}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          Create New Project
          <Button onClick={handleClose} color="inherit">
            <Close />
          </Button>
        </Box>
      </DialogTitle>

      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        <Stepper activeStep={activeStep} orientation="vertical">
          {steps.map((step, index) => (
            <Step key={step.label}>
              <StepLabel>
                <Typography variant="subtitle1">{step.label}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {step.description}
                </Typography>
              </StepLabel>
              <StepContent>
                <Box sx={{ mt: 2, mb: 2 }}>
                  {renderStepContent(index)}
                </Box>
              </StepContent>
            </Step>
          ))}
        </Stepper>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={isLoading}>
          Cancel
        </Button>
        {activeStep > 0 && (
          <Button onClick={handleBack} disabled={isLoading}>
            Back
          </Button>
        )}
        {activeStep < steps.length - 1 ? (
          <Button
            variant="contained"
            onClick={handleNext}
            disabled={!validateStep(activeStep)}
          >
            Next
          </Button>
        ) : (
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={isLoading || !validateStep(activeStep)}
          >
            {isLoading ? 'Creating...' : 'Create Project'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};