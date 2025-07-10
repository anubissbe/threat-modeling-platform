import React, { useState, useCallback, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  ButtonGroup,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
  IconButton,
  Tooltip,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Stack
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  Download as DownloadIcon,
  CheckCircle as ValidateIcon,
  Assessment as AnalyzeIcon,
  Code as CodeIcon,
  Description as DescriptionIcon,
  MergeType as MergeIcon,
  Save as SaveIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import Editor from '@monaco-editor/react';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';

interface TMACEditorProps {
  initialContent?: string;
  onSave?: (content: string) => void;
  threatModelId?: string;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

interface AnalysisResult {
  summary: {
    totalComponents: number;
    totalThreats: number;
    criticalThreats: number;
    highThreats: number;
    unmitigatedThreats: number;
    coveragePercentage: number;
    riskScore: number;
  };
  findings: Array<{
    type: string;
    severity: string;
    title: string;
    description: string;
  }>;
  recommendations: Array<{
    priority: string;
    title: string;
    description: string;
  }>;
}

const TMACEditor: React.FC<TMACEditorProps> = ({ 
  initialContent = '', 
  onSave,
  threatModelId 
}) => {
  const [content, setContent] = useState(initialContent);
  const [format, setFormat] = useState<'yaml' | 'json'>('yaml');
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        setContent(text);
        setFormat(file.name.endsWith('.json') ? 'json' : 'yaml');
        setSuccess('File loaded successfully');
      };
      reader.readAsText(file);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/yaml': ['.yaml', '.yml', '.tmac'],
      'application/json': ['.json']
    },
    maxFiles: 1
  });

  const handleValidate = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const formData = new FormData();
      const blob = new Blob([content], { type: 'text/plain' });
      formData.append('file', blob, `model.${format}`);
      
      const response = await axios.post('/api/tmac/validate', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      setValidationResult(response.data.validation);
      setActiveTab(1);
      
      if (response.data.validation.valid) {
        setSuccess('Validation passed!');
      } else {
        setError('Validation failed. Check the validation tab for details.');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Validation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const formData = new FormData();
      const blob = new Blob([content], { type: 'text/plain' });
      formData.append('file', blob, `model.${format}`);
      
      const response = await axios.post('/api/tmac/analyze', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      setAnalysisResult(response.data.analysis);
      setActiveTab(2);
      setSuccess('Analysis complete!');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Analysis failed');
    } finally {
      setLoading(false);
    }
  };

  const handleConvert = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const formData = new FormData();
      const blob = new Blob([content], { type: 'text/plain' });
      formData.append('file', blob, `model.${format}`);
      formData.append('format', format === 'yaml' ? 'json' : 'yaml');
      
      const response = await axios.post('/api/tmac/convert', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      setContent(response.data.content);
      setFormat(response.data.format);
      setSuccess(`Converted to ${response.data.format.toUpperCase()}`);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Conversion failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `threat-model.${format === 'yaml' ? 'tmac.yaml' : 'tmac.json'}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportFromPlatform = async () => {
    if (!threatModelId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await axios.post('/api/tmac/export', {
        threatModelId,
        format
      });
      
      setContent(response.data.content);
      setSuccess('Threat model imported successfully');
      setImportDialogOpen(false);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Import failed');
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'error';
      case 'high': return 'warning';
      case 'medium': return 'info';
      case 'low': return 'default';
      default: return 'default';
    }
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Toolbar */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
          <ButtonGroup variant="contained" size="small">
            <Button
              startIcon={<ValidateIcon />}
              onClick={handleValidate}
              disabled={loading || !content}
            >
              Validate
            </Button>
            <Button
              startIcon={<AnalyzeIcon />}
              onClick={handleAnalyze}
              disabled={loading || !content}
            >
              Analyze
            </Button>
          </ButtonGroup>

          <ButtonGroup variant="outlined" size="small">
            <Button
              startIcon={<CodeIcon />}
              onClick={handleConvert}
              disabled={loading || !content}
            >
              Convert to {format === 'yaml' ? 'JSON' : 'YAML'}
            </Button>
          </ButtonGroup>

          <ButtonGroup variant="outlined" size="small">
            <Tooltip title="Upload TMAC file">
              <IconButton
                component="label"
                disabled={loading}
              >
                <UploadIcon />
                <input
                  ref={fileInputRef}
                  type="file"
                  hidden
                  accept=".yaml,.yml,.json,.tmac"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      onDrop([file]);
                    }
                  }}
                />
              </IconButton>
            </Tooltip>
            <Tooltip title="Download TMAC file">
              <IconButton
                onClick={handleDownload}
                disabled={loading || !content}
              >
                <DownloadIcon />
              </IconButton>
            </Tooltip>
          </ButtonGroup>

          {threatModelId && (
            <Button
              variant="outlined"
              size="small"
              startIcon={<RefreshIcon />}
              onClick={() => setImportDialogOpen(true)}
              disabled={loading}
            >
              Import from Platform
            </Button>
          )}

          {onSave && (
            <Button
              variant="contained"
              size="small"
              startIcon={<SaveIcon />}
              onClick={() => onSave(content)}
              disabled={loading || !content}
              color="success"
            >
              Save
            </Button>
          )}

          <FormControl size="small" sx={{ minWidth: 100 }}>
            <Select
              value={format}
              onChange={(e) => setFormat(e.target.value as 'yaml' | 'json')}
              disabled={loading}
            >
              <MenuItem value="yaml">YAML</MenuItem>
              <MenuItem value="json">JSON</MenuItem>
            </Select>
          </FormControl>

          {loading && <CircularProgress size={24} />}
        </Stack>
      </Paper>

      {/* Content Area */}
      <Paper sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}>
          <Tab label="Editor" icon={<CodeIcon />} iconPosition="start" />
          <Tab 
            label="Validation" 
            icon={<ValidateIcon />} 
            iconPosition="start"
            disabled={!validationResult}
          />
          <Tab 
            label="Analysis" 
            icon={<AnalyzeIcon />} 
            iconPosition="start"
            disabled={!analysisResult}
          />
        </Tabs>

        <Box sx={{ flex: 1, overflow: 'hidden' }}>
          {/* Editor Tab */}
          {activeTab === 0 && (
            <Box
              {...getRootProps()}
              sx={{
                height: '100%',
                position: 'relative',
                border: isDragActive ? '2px dashed #1976d2' : 'none',
                backgroundColor: isDragActive ? 'rgba(25, 118, 210, 0.08)' : 'transparent'
              }}
            >
              <input {...getInputProps()} />
              {isDragActive && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    zIndex: 10,
                    backgroundColor: 'background.paper',
                    p: 3,
                    borderRadius: 2,
                    boxShadow: 3
                  }}
                >
                  <Typography variant="h6">Drop TMAC file here</Typography>
                </Box>
              )}
              <Editor
                height="100%"
                language={format === 'yaml' ? 'yaml' : 'json'}
                value={content}
                onChange={(value) => setContent(value || '')}
                theme="vs-dark"
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  wordWrap: 'on',
                  automaticLayout: true
                }}
              />
            </Box>
          )}

          {/* Validation Tab */}
          {activeTab === 1 && validationResult && (
            <Box sx={{ p: 3, overflow: 'auto', height: '100%' }}>
              <Stack spacing={2}>
                {validationResult.valid ? (
                  <Alert severity="success" icon={<CheckCircle />}>
                    TMAC file is valid!
                  </Alert>
                ) : (
                  <Alert severity="error">
                    TMAC file has validation errors
                  </Alert>
                )}

                {validationResult.errors.length > 0 && (
                  <Box>
                    <Typography variant="h6" gutterBottom>
                      Errors ({validationResult.errors.length})
                    </Typography>
                    <Stack spacing={1}>
                      {validationResult.errors.map((error, index) => (
                        <Alert key={index} severity="error">
                          {error}
                        </Alert>
                      ))}
                    </Stack>
                  </Box>
                )}

                {validationResult.warnings.length > 0 && (
                  <Box>
                    <Typography variant="h6" gutterBottom>
                      Warnings ({validationResult.warnings.length})
                    </Typography>
                    <Stack spacing={1}>
                      {validationResult.warnings.map((warning, index) => (
                        <Alert key={index} severity="warning">
                          {warning}
                        </Alert>
                      ))}
                    </Stack>
                  </Box>
                )}
              </Stack>
            </Box>
          )}

          {/* Analysis Tab */}
          {activeTab === 2 && analysisResult && (
            <Box sx={{ p: 3, overflow: 'auto', height: '100%' }}>
              <Stack spacing={3}>
                {/* Summary */}
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="h6" gutterBottom>
                    Summary
                  </Typography>
                  <Stack direction="row" spacing={2} flexWrap="wrap">
                    <Chip 
                      label={`Risk Score: ${analysisResult.summary.riskScore}/100`}
                      color={analysisResult.summary.riskScore > 70 ? 'error' : 
                             analysisResult.summary.riskScore > 40 ? 'warning' : 'success'}
                    />
                    <Chip label={`Components: ${analysisResult.summary.totalComponents}`} />
                    <Chip label={`Threats: ${analysisResult.summary.totalThreats}`} />
                    <Chip 
                      label={`Critical: ${analysisResult.summary.criticalThreats}`}
                      color="error"
                    />
                    <Chip 
                      label={`High: ${analysisResult.summary.highThreats}`}
                      color="warning"
                    />
                    <Chip 
                      label={`Coverage: ${analysisResult.summary.coveragePercentage}%`}
                      color={analysisResult.summary.coveragePercentage < 50 ? 'error' : 'success'}
                    />
                  </Stack>
                </Paper>

                {/* Findings */}
                {analysisResult.findings.length > 0 && (
                  <Box>
                    <Typography variant="h6" gutterBottom>
                      Findings ({analysisResult.findings.length})
                    </Typography>
                    <Stack spacing={1}>
                      {analysisResult.findings.map((finding, index) => (
                        <Alert 
                          key={index} 
                          severity={getSeverityColor(finding.severity) as any}
                        >
                          <Typography variant="subtitle2">{finding.title}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            {finding.description}
                          </Typography>
                        </Alert>
                      ))}
                    </Stack>
                  </Box>
                )}

                {/* Recommendations */}
                {analysisResult.recommendations.length > 0 && (
                  <Box>
                    <Typography variant="h6" gutterBottom>
                      Recommendations
                    </Typography>
                    <Stack spacing={2}>
                      {analysisResult.recommendations.map((rec, index) => (
                        <Paper key={index} variant="outlined" sx={{ p: 2 }}>
                          <Stack direction="row" spacing={2} alignItems="center">
                            <Chip 
                              label={rec.priority.toUpperCase()} 
                              size="small"
                              color={getSeverityColor(rec.priority) as any}
                            />
                            <Typography variant="subtitle1">{rec.title}</Typography>
                          </Stack>
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                            {rec.description}
                          </Typography>
                        </Paper>
                      ))}
                    </Stack>
                  </Box>
                )}
              </Stack>
            </Box>
          )}
        </Box>
      </Paper>

      {/* Import Dialog */}
      <Dialog open={importDialogOpen} onClose={() => setImportDialogOpen(false)}>
        <DialogTitle>Import from Threat Model</DialogTitle>
        <DialogContent>
          <Typography>
            This will convert your current threat model to TMAC format. 
            The existing content in the editor will be replaced.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImportDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleImportFromPlatform} variant="contained">
            Import
          </Button>
        </DialogActions>
      </Dialog>

      {/* Notifications */}
      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError(null)}
      >
        <Alert onClose={() => setError(null)} severity="error">
          {error}
        </Alert>
      </Snackbar>

      <Snackbar
        open={!!success}
        autoHideDuration={3000}
        onClose={() => setSuccess(null)}
      >
        <Alert onClose={() => setSuccess(null)} severity="success">
          {success}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default TMACEditor;