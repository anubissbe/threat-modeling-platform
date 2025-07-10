import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Paper,
  Breadcrumbs,
  Link,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Alert,
  Snackbar
} from '@mui/material';
import {
  Home as HomeIcon,
  Code as CodeIcon,
  ArrowBack as BackIcon,
  Save as SaveIcon
} from '@mui/icons-material';
import TMACEditor from '@/components/TMAC/TMACEditor';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

interface ThreatModel {
  id: string;
  name: string;
  description: string;
  tmacContent?: string;
}

export const TMACPage: React.FC = () => {
  const { threatModelId } = useParams<{ threatModelId?: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [tmacContent, setTmacContent] = useState<string>('');

  // Fetch threat model if we have an ID
  const { data: threatModel, isLoading } = useQuery<ThreatModel>({
    queryKey: ['threat-model', threatModelId],
    queryFn: async () => {
      if (!threatModelId) return null;
      const response = await axios.get(`/api/threat-models/${threatModelId}`);
      return response.data;
    },
    enabled: !!threatModelId,
  });

  // Save TMAC content mutation
  const saveTmacMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!threatModelId) {
        // Create new threat model with TMAC content
        const response = await axios.post('/api/threat-models', {
          name: 'New TMAC Model',
          description: 'Created from TMAC editor',
          tmacContent: content,
        });
        return response.data;
      } else {
        // Update existing threat model
        const response = await axios.put(`/api/threat-models/${threatModelId}`, {
          ...threatModel,
          tmacContent: content,
        });
        return response.data;
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['threat-model', threatModelId] });
      setSuccessMessage('TMAC content saved successfully!');
      setSaveDialogOpen(false);
      
      // If we created a new model, navigate to it
      if (!threatModelId && data.id) {
        navigate(`/tmac/${data.id}`);
      }
    },
    onError: (error: any) => {
      setErrorMessage(error.response?.data?.error || 'Failed to save TMAC content');
    },
  });

  const handleSave = (content: string) => {
    setTmacContent(content);
    setSaveDialogOpen(true);
  };

  const confirmSave = () => {
    saveTmacMutation.mutate(tmacContent);
  };

  const handleBreadcrumbClick = (event: React.MouseEvent<HTMLAnchorElement>, path: string) => {
    event.preventDefault();
    navigate(path);
  };

  if (isLoading) {
    return (
      <Container maxWidth="xl">
        <Box sx={{ py: 3 }}>
          <Typography>Loading...</Typography>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl">
      <Box sx={{ py: 3 }}>
        {/* Header */}
        <Box sx={{ mb: 3 }}>
          <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 2 }}>
            <Link
              color="inherit"
              href="/"
              onClick={(e) => handleBreadcrumbClick(e, '/')}
              sx={{ display: 'flex', alignItems: 'center' }}
            >
              <HomeIcon sx={{ mr: 0.5 }} fontSize="small" />
              Home
            </Link>
            {threatModel && (
              <Link
                color="inherit"
                href="/threat-models"
                onClick={(e) => handleBreadcrumbClick(e, '/threat-models')}
              >
                Threat Models
              </Link>
            )}
            <Typography color="text.primary" sx={{ display: 'flex', alignItems: 'center' }}>
              <CodeIcon sx={{ mr: 0.5 }} fontSize="small" />
              TMAC Editor
            </Typography>
          </Breadcrumbs>

          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h4" component="h1">
              {threatModel ? `TMAC: ${threatModel.name}` : 'TMAC Editor'}
            </Typography>
            <Button
              variant="outlined"
              startIcon={<BackIcon />}
              onClick={() => navigate(threatModel ? `/threat-models/${threatModelId}` : '/threat-models')}
            >
              Back to {threatModel ? 'Threat Model' : 'List'}
            </Button>
          </Box>

          {threatModel?.description && (
            <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
              {threatModel.description}
            </Typography>
          )}
        </Box>

        {/* Info Alert */}
        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="body2">
            <strong>TMAC (Threat Modeling as Code)</strong> allows you to define threat models in YAML or JSON format.
            Use the editor below to create, validate, and analyze your threat models.
          </Typography>
        </Alert>

        {/* TMAC Editor */}
        <Paper sx={{ height: 'calc(100vh - 300px)', display: 'flex', flexDirection: 'column' }}>
          <TMACEditor
            initialContent={threatModel?.tmacContent || ''}
            onSave={handleSave}
            threatModelId={threatModelId}
          />
        </Paper>

        {/* Save Confirmation Dialog */}
        <Dialog open={saveDialogOpen} onClose={() => setSaveDialogOpen(false)}>
          <DialogTitle>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <SaveIcon sx={{ mr: 1 }} />
              Save TMAC Content
            </Box>
          </DialogTitle>
          <DialogContent>
            <DialogContentText>
              {threatModelId
                ? 'This will save the TMAC content to the current threat model. Any existing TMAC content will be replaced.'
                : 'This will create a new threat model with the TMAC content you\'ve created.'}
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setSaveDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={confirmSave}
              variant="contained"
              disabled={saveTmacMutation.isPending}
            >
              {saveTmacMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Success/Error Messages */}
        <Snackbar
          open={!!successMessage}
          autoHideDuration={6000}
          onClose={() => setSuccessMessage(null)}
        >
          <Alert onClose={() => setSuccessMessage(null)} severity="success">
            {successMessage}
          </Alert>
        </Snackbar>

        <Snackbar
          open={!!errorMessage}
          autoHideDuration={6000}
          onClose={() => setErrorMessage(null)}
        >
          <Alert onClose={() => setErrorMessage(null)} severity="error">
            {errorMessage}
          </Alert>
        </Snackbar>
      </Box>
    </Container>
  );
};