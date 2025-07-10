import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Breadcrumbs,
  Link,
} from '@mui/material';
import {
  ArrowBack,
  Download,
  Share,
  Print,
  Assessment,
  Security,
  BugReport,
  NavigateNext,
  PictureAsPdf,
  TableChart,
  Description,
  Refresh,
} from '@mui/icons-material';
import { projectsApi, threatModelsApi } from '@/services/api';
import { formatDistanceToNow } from 'date-fns';

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  type: 'executive' | 'technical' | 'compliance' | 'detailed';
  sections: string[];
  format: 'pdf' | 'html' | 'docx' | 'csv';
}

const reportTemplates: ReportTemplate[] = [
  {
    id: 'executive-summary',
    name: 'Executive Summary',
    description: 'High-level overview for stakeholders and decision makers',
    type: 'executive',
    sections: ['Overview', 'Risk Assessment', 'Key Findings', 'Recommendations', 'Next Steps'],
    format: 'pdf'
  },
  {
    id: 'technical-detailed',
    name: 'Technical Detailed Report',
    description: 'Comprehensive technical analysis with full vulnerability details',
    type: 'technical',
    sections: ['Technical Overview', 'Threat Models', 'Vulnerabilities', 'Risk Analysis', 'Mitigation Strategies'],
    format: 'pdf'
  },
  {
    id: 'compliance-report',
    name: 'Compliance Report',
    description: 'Compliance-focused report for regulatory requirements',
    type: 'compliance',
    sections: ['Compliance Status', 'Security Controls', 'Audit Findings', 'Remediation Plan'],
    format: 'pdf'
  },
  {
    id: 'vulnerability-csv',
    name: 'Vulnerability Export',
    description: 'CSV export of all vulnerabilities for analysis',
    type: 'technical',
    sections: ['Vulnerabilities'],
    format: 'csv'
  }
];

export const Reports: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [tabValue, setTabValue] = useState(0);
  const [generateDialog, setGenerateDialog] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);

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

  // Fetch threat models for the project
  const { data: threatModels = [] } = useQuery({
    queryKey: ['project-threat-models', projectId],
    queryFn: async () => {
      const response = await threatModelsApi.getThreatModels();
      const allModels = response.data?.data || response.data || [];
      return allModels.filter((model: any) => model.projectId === projectId);
    },
    enabled: !!projectId,
  });

  // Mock existing reports
  const existingReports = [
    {
      id: '1',
      name: 'Executive Summary - Q4 2023',
      type: 'executive',
      generatedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      size: '2.4 MB',
      format: 'pdf'
    },
    {
      id: '2',
      name: 'Technical Assessment Report',
      type: 'technical',
      generatedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
      size: '8.7 MB',
      format: 'pdf'
    },
    {
      id: '3',
      name: 'Vulnerability Export',
      type: 'technical',
      generatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      size: '125 KB',
      format: 'csv'
    }
  ];

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleGenerateReport = async () => {
    if (!selectedTemplate) return;
    
    setIsGenerating(true);
    
    // Simulate report generation
    try {
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // In a real app, this would trigger a download
      const template = reportTemplates.find(t => t.id === selectedTemplate);
      alert(`Report "${template?.name}" generated successfully!`);
      
      setGenerateDialog(false);
      setSelectedTemplate('');
    } catch (error) {
      console.error('Failed to generate report:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadReport = (reportId: string) => {
    // In a real app, this would download the actual file
    alert(`Downloading report ${reportId}...`);
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'executive': return 'primary';
      case 'technical': return 'secondary';
      case 'compliance': return 'warning';
      default: return 'default';
    }
  };

  const getFormatIcon = (format: string) => {
    switch (format) {
      case 'pdf': return <PictureAsPdf />;
      case 'csv': return <TableChart />;
      case 'docx': return <Description />;
      default: return <Description />;
    }
  };

  const renderReportTemplates = () => (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6">Available Report Templates</Typography>
        <Button
          variant="contained"
          startIcon={<Assessment />}
          onClick={() => setGenerateDialog(true)}
        >
          Generate New Report
        </Button>
      </Box>

      <Grid container spacing={3}>
        {reportTemplates.map((template) => (
          <Grid item xs={12} md={6} key={template.id}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
                  <Typography variant="h6" gutterBottom>
                    {template.name}
                  </Typography>
                  <Chip
                    label={template.type}
                    color={getTypeColor(template.type) as any}
                    size="small"
                  />
                </Box>
                
                <Typography variant="body2" color="text.secondary" paragraph>
                  {template.description}
                </Typography>

                <Typography variant="subtitle2" gutterBottom>
                  Sections Included:
                </Typography>
                <List dense sx={{ mb: 2 }}>
                  {template.sections.map((section) => (
                    <ListItem key={section} sx={{ py: 0.5 }}>
                      <ListItemIcon sx={{ minWidth: 30 }}>
                        <Security fontSize="small" />
                      </ListItemIcon>
                      <ListItemText 
                        primary={section}
                        primaryTypographyProps={{ variant: 'body2' }}
                      />
                    </ListItem>
                  ))}
                </List>

                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={getFormatIcon(template.format)}
                    onClick={() => {
                      setSelectedTemplate(template.id);
                      setGenerateDialog(true);
                    }}
                  >
                    Generate {template.format.toUpperCase()}
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );

  const renderExistingReports = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Generated Reports
      </Typography>
      
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Report Name</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Generated</TableCell>
              <TableCell>Size</TableCell>
              <TableCell>Format</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {existingReports.map((report) => (
              <TableRow key={report.id} hover>
                <TableCell>
                  <Typography variant="body2" fontWeight={500}>
                    {report.name}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip
                    label={report.type}
                    color={getTypeColor(report.type) as any}
                    size="small"
                    variant="outlined"
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="body2" color="text.secondary">
                    {formatDistanceToNow(new Date(report.generatedAt), { addSuffix: true })}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">{report.size}</Typography>
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {getFormatIcon(report.format)}
                    <Typography variant="body2">{report.format.toUpperCase()}</Typography>
                  </Box>
                </TableCell>
                <TableCell>
                  <IconButton
                    size="small"
                    onClick={() => handleDownloadReport(report.id)}
                  >
                    <Download />
                  </IconButton>
                  <IconButton size="small">
                    <Share />
                  </IconButton>
                  <IconButton size="small">
                    <Print />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {existingReports.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Assessment sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            No reports generated yet
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Generate your first report using the templates above
          </Typography>
          <Button
            variant="contained"
            startIcon={<Assessment />}
            onClick={() => setGenerateDialog(true)}
          >
            Generate Report
          </Button>
        </Box>
      )}
    </Box>
  );

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
            Reports
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
          <Typography color="text.primary">Reports</Typography>
        </Breadcrumbs>
      </Box>

      {/* Project Info */}
      <Alert severity="info" sx={{ mb: 4 }}>
        <Typography variant="body2">
          <strong>Project:</strong> {project?.name} • 
          <strong> Threat Models:</strong> {threatModels.length} • 
          <strong> Status:</strong> {project?.status}
        </Typography>
      </Alert>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabValue} onChange={handleTabChange}>
          <Tab label="Generate Reports" />
          <Tab label="Existing Reports" />
        </Tabs>
      </Box>

      {/* Content */}
      {tabValue === 0 && renderReportTemplates()}
      {tabValue === 1 && renderExistingReports()}

      {/* Generate Report Dialog */}
      <Dialog open={generateDialog} onClose={() => setGenerateDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Generate Report</DialogTitle>
        <DialogContent>
          <TextField
            select
            fullWidth
            margin="dense"
            label="Report Template"
            value={selectedTemplate}
            onChange={(e) => setSelectedTemplate(e.target.value)}
            helperText="Select a report template to generate"
          >
            {reportTemplates.map((template) => (
              <MenuItem key={template.id} value={template.id}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {getFormatIcon(template.format)}
                  <Box>
                    <Typography variant="body2">{template.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {template.description}
                    </Typography>
                  </Box>
                </Box>
              </MenuItem>
            ))}
          </TextField>
          
          {selectedTemplate && (
            <Alert severity="info" sx={{ mt: 2 }}>
              <Typography variant="body2">
                This report will include data from {project?.name} and its {threatModels.length} threat model(s).
              </Typography>
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setGenerateDialog(false)}>Cancel</Button>
          <Button
            onClick={handleGenerateReport}
            variant="contained"
            disabled={!selectedTemplate || isGenerating}
            startIcon={isGenerating ? <CircularProgress size={20} /> : <Assessment />}
          >
            {isGenerating ? 'Generating...' : 'Generate Report'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};