import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Alert,
  RadioGroup,
  FormControlLabel,
  Radio,
  TextField,
  Divider,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Paper,
  Grid,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import {
  Warning as WarningIcon,
  Error as ErrorIcon,
  CheckCircle as CheckCircleIcon,
  Merge as MergeIcon,
  Cancel as CancelIcon,
  Accept as AcceptIcon,
  ExpandMore as ExpandMoreIcon,
  Code as CodeIcon,
  Timeline as TimelineIcon,
  Person as PersonIcon
} from '@mui/icons-material';
import { ConflictInfo } from '../../types/collaboration';

interface ConflictResolutionDialogProps {
  open: boolean;
  operationId: string;
  conflict: ConflictInfo;
  suggestions: string[];
  onResolve: (operationId: string, resolution: 'accept' | 'reject' | 'merge', mergeData?: any) => void;
  onCancel: () => void;
}

const ConflictResolutionDialog: React.FC<ConflictResolutionDialogProps> = ({
  open,
  operationId,
  conflict,
  suggestions,
  onResolve,
  onCancel
}) => {
  const [resolution, setResolution] = useState<'accept' | 'reject' | 'merge'>('accept');
  const [mergeData, setMergeData] = useState<any>({});
  const [customNote, setCustomNote] = useState('');
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (conflict.type === 'concurrent_modification') {
      setResolution('merge');
    } else if (conflict.type === 'dependency' || conflict.type === 'missing') {
      setResolution('reject');
    }
  }, [conflict]);

  const getConflictIcon = () => {
    switch (conflict.type) {
      case 'concurrent_modification':
        return <MergeIcon color="warning" />;
      case 'dependency':
        return <ErrorIcon color="error" />;
      case 'missing':
        return <ErrorIcon color="error" />;
      case 'position':
        return <WarningIcon color="warning" />;
      case 'name':
        return <WarningIcon color="warning" />;
      case 'duplicate':
        return <WarningIcon color="warning" />;
      default:
        return <WarningIcon color="warning" />;
    }
  };

  const getConflictSeverity = () => {
    switch (conflict.type) {
      case 'dependency':
      case 'missing':
        return 'error';
      case 'concurrent_modification':
      case 'position':
      case 'name':
      case 'duplicate':
        return 'warning';
      default:
        return 'info';
    }
  };

  const getConflictTitle = () => {
    switch (conflict.type) {
      case 'concurrent_modification':
        return 'Concurrent Modification Detected';
      case 'dependency':
        return 'Dependency Conflict';
      case 'missing':
        return 'Missing Element';
      case 'position':
        return 'Position Conflict';
      case 'name':
        return 'Name Conflict';
      case 'duplicate':
        return 'Duplicate Element';
      default:
        return 'Conflict Detected';
    }
  };

  const getResolutionDescription = () => {
    switch (resolution) {
      case 'accept':
        return 'Apply your changes, potentially overwriting conflicting changes.';
      case 'reject':
        return 'Cancel your changes and keep the current state.';
      case 'merge':
        return 'Combine your changes with the current state.';
      default:
        return '';
    }
  };

  const handleResolve = () => {
    const resolveData = resolution === 'merge' ? {
      ...mergeData,
      customNote: customNote || undefined
    } : undefined;

    onResolve(operationId, resolution, resolveData);
  };

  const renderMergeOptions = () => {
    if (resolution !== 'merge') return null;

    return (
      <Box sx={{ mt: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Merge Configuration
        </Typography>
        
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Choose how to merge the conflicting changes:
          </Typography>
          
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={
                  <Radio
                    checked={mergeData.strategy === 'keep_both'}
                    onChange={() => setMergeData({ ...mergeData, strategy: 'keep_both' })}
                  />
                }
                label="Keep both versions"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={
                  <Radio
                    checked={mergeData.strategy === 'prefer_mine'}
                    onChange={() => setMergeData({ ...mergeData, strategy: 'prefer_mine' })}
                  />
                }
                label="Prefer my changes"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={
                  <Radio
                    checked={mergeData.strategy === 'prefer_theirs'}
                    onChange={() => setMergeData({ ...mergeData, strategy: 'prefer_theirs' })}
                  />
                }
                label="Prefer their changes"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={
                  <Radio
                    checked={mergeData.strategy === 'custom'}
                    onChange={() => setMergeData({ ...mergeData, strategy: 'custom' })}
                  />
                }
                label="Custom merge"
              />
            </Grid>
          </Grid>
        </Paper>

        <TextField
          fullWidth
          multiline
          rows={3}
          label="Custom merge note (optional)"
          value={customNote}
          onChange={(e) => setCustomNote(e.target.value)}
          placeholder="Describe how you want to merge the changes..."
          sx={{ mt: 1 }}
        />
      </Box>
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          minHeight: '400px',
          maxHeight: '80vh'
        }
      }}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center">
          {getConflictIcon()}
          <Box ml={2}>
            <Typography variant="h6">
              {getConflictTitle()}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Operation ID: {operationId}
            </Typography>
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Alert severity={getConflictSeverity() as any} sx={{ mb: 3 }}>
          <Typography variant="body1">
            {conflict.description}
          </Typography>
        </Alert>

        {/* Conflict Details */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            Affected Elements
          </Typography>
          <Box display="flex" flexWrap="wrap" gap={1}>
            {conflict.conflictingElements.map((elementId, index) => (
              <Chip
                key={index}
                label={elementId}
                size="small"
                variant="outlined"
                color="warning"
              />
            ))}
          </Box>
        </Box>

        {/* Resolution Options */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            Resolution Strategy
          </Typography>
          
          <RadioGroup
            value={resolution}
            onChange={(e) => setResolution(e.target.value as 'accept' | 'reject' | 'merge')}
          >
            <FormControlLabel
              value="accept"
              control={<Radio />}
              label={
                <Box>
                  <Box display="flex" alignItems="center">
                    <AcceptIcon sx={{ mr: 1, color: 'success.main' }} />
                    <Typography variant="body2" fontWeight="medium">
                      Accept (Force Apply)
                    </Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    Apply your changes, potentially overwriting conflicting changes
                  </Typography>
                </Box>
              }
            />
            
            <FormControlLabel
              value="reject"
              control={<Radio />}
              label={
                <Box>
                  <Box display="flex" alignItems="center">
                    <CancelIcon sx={{ mr: 1, color: 'error.main' }} />
                    <Typography variant="body2" fontWeight="medium">
                      Reject (Cancel)
                    </Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    Cancel your changes and keep the current state
                  </Typography>
                </Box>
              }
            />
            
            <FormControlLabel
              value="merge"
              control={<Radio />}
              label={
                <Box>
                  <Box display="flex" alignItems="center">
                    <MergeIcon sx={{ mr: 1, color: 'warning.main' }} />
                    <Typography variant="body2" fontWeight="medium">
                      Merge (Combine)
                    </Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    Combine your changes with the current state
                  </Typography>
                </Box>
              }
            />
          </RadioGroup>

          {renderMergeOptions()}
        </Box>

        {/* AI Suggestions */}
        {suggestions.length > 0 && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" gutterBottom>
              AI Suggestions
            </Typography>
            <List dense>
              {suggestions.map((suggestion, index) => (
                <ListItem key={index}>
                  <ListItemIcon>
                    <CheckCircleIcon color="info" fontSize="small" />
                  </ListItemIcon>
                  <ListItemText
                    primary={suggestion}
                    primaryTypographyProps={{
                      variant: 'body2'
                    }}
                  />
                </ListItem>
              ))}
            </List>
          </Box>
        )}

        {/* Advanced Details */}
        <Accordion expanded={showDetails} onChange={() => setShowDetails(!showDetails)}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle2">
              Technical Details
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    CONFLICT TYPE
                  </Typography>
                  <Typography variant="body2" fontWeight="medium">
                    {conflict.type}
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} md={6}>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    ELEMENTS AFFECTED
                  </Typography>
                  <Typography variant="body2" fontWeight="medium">
                    {conflict.conflictingElements.length}
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12}>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    RESOLUTION IMPACT
                  </Typography>
                  <Typography variant="body2">
                    {getResolutionDescription()}
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </AccordionDetails>
        </Accordion>
      </DialogContent>

      <DialogActions>
        <Button onClick={onCancel} color="inherit">
          Cancel
        </Button>
        <Button
          onClick={handleResolve}
          variant="contained"
          color={resolution === 'accept' ? 'success' : resolution === 'reject' ? 'error' : 'primary'}
          startIcon={
            resolution === 'accept' ? <AcceptIcon /> : 
            resolution === 'reject' ? <CancelIcon /> : 
            <MergeIcon />
          }
        >
          {resolution === 'accept' ? 'Accept Changes' : 
           resolution === 'reject' ? 'Reject Changes' : 
           'Merge Changes'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ConflictResolutionDialog;