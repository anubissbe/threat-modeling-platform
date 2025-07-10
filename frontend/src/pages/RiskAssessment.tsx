import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  LinearProgress,
  Alert,
  CircularProgress,
  Tab,
  Tabs,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  IconButton,
  Tooltip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Avatar,
  Badge,
} from '@mui/material';
import {
  Assessment,
  Security,
  Warning,
  Error,
  CheckCircle,
  BugReport,
  Shield,
  Timeline,
  Refresh,
  FilterList,
  Download,
  Share,
  TrendingUp,
  TrendingDown,
  Info,
  Delete,
  Edit,
  Add,
  Visibility,
  Close,
} from '@mui/icons-material';
import { projectsApi, threatModelsApi } from '@/services/api';
import { formatDistanceToNow } from 'date-fns';

interface RiskAssessment {
  id: string;
  projectId: string;
  projectName: string;
  overallRisk: 'Critical' | 'High' | 'Medium' | 'Low';
  score: number;
  vulnerabilities: Vulnerability[];
  threats: Threat[];
  recommendations: string[];
  lastUpdated: string;
  status: 'completed' | 'in_progress' | 'pending';
}

interface Vulnerability {
  id: string;
  title: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  cve?: string;
  component: string;
  description: string;
  impact: string;
  remediation: string;
  status: 'open' | 'in_progress' | 'resolved' | 'false_positive';
  discoveredAt: string;
  assignedTo?: string;
}

interface Threat {
  id: string;
  name: string;
  category: string;
  likelihood: 'Very High' | 'High' | 'Medium' | 'Low' | 'Very Low';
  impact: 'Very High' | 'High' | 'Medium' | 'Low' | 'Very Low';
  riskLevel: 'Critical' | 'High' | 'Medium' | 'Low';
  description: string;
  mitigation: string;
  status: 'identified' | 'mitigated' | 'accepted' | 'transferred';
}

const mockRiskAssessments: RiskAssessment[] = [
  {
    id: '1',
    projectId: '1',
    projectName: 'E-Commerce Platform',
    overallRisk: 'High',
    score: 78,
    vulnerabilities: [
      {
        id: 'vuln-1',
        title: 'SQL Injection in User Authentication',
        severity: 'Critical',
        cve: 'CVE-2023-1234',
        component: 'auth-service',
        description: 'Unsanitized input in login endpoint allows SQL injection attacks',
        impact: 'Full database compromise, user data theft',
        remediation: 'Implement parameterized queries and input validation',
        status: 'open',
        discoveredAt: new Date().toISOString(),
        assignedTo: 'security-team'
      },
      {
        id: 'vuln-2',
        title: 'Cross-Site Scripting (XSS) in Product Reviews',
        severity: 'High',
        component: 'review-service',
        description: 'Stored XSS vulnerability in product review comments',
        impact: 'Session hijacking, phishing attacks',
        remediation: 'Implement proper output encoding and CSP headers',
        status: 'in_progress',
        discoveredAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        assignedTo: 'dev-team'
      },
      {
        id: 'vuln-3',
        title: 'Insecure Direct Object References',
        severity: 'Medium',
        component: 'order-service',
        description: 'Users can access other users\' order details by manipulating IDs',
        impact: 'Unauthorized access to sensitive order information',
        remediation: 'Implement proper authorization checks',
        status: 'open',
        discoveredAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      }
    ],
    threats: [
      {
        id: 'threat-1',
        name: 'Data Breach via API Exploitation',
        category: 'Information Disclosure',
        likelihood: 'High',
        impact: 'Very High',
        riskLevel: 'Critical',
        description: 'Attackers exploit API vulnerabilities to access customer data',
        mitigation: 'Implement rate limiting, authentication, and monitoring',
        status: 'identified'
      },
      {
        id: 'threat-2',
        name: 'Payment Processing Fraud',
        category: 'Tampering',
        likelihood: 'Medium',
        impact: 'High',
        riskLevel: 'High',
        description: 'Manipulation of payment processing logic',
        mitigation: 'Enhanced payment verification and fraud detection',
        status: 'mitigated'
      }
    ],
    recommendations: [
      'Implement regular security code reviews',
      'Set up automated vulnerability scanning',
      'Enhance API security with rate limiting',
      'Implement comprehensive logging and monitoring',
      'Conduct regular penetration testing'
    ],
    lastUpdated: new Date().toISOString(),
    status: 'completed'
  },
  {
    id: '2',
    projectId: '2',
    projectName: 'Mobile Banking App',
    overallRisk: 'Critical',
    score: 92,
    vulnerabilities: [
      {
        id: 'vuln-4',
        title: 'Insecure Cryptographic Storage',
        severity: 'Critical',
        component: 'mobile-app',
        description: 'Sensitive data stored with weak encryption',
        impact: 'Customer financial data exposure',
        remediation: 'Implement AES-256 encryption for sensitive data',
        status: 'open',
        discoveredAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        assignedTo: 'mobile-team'
      }
    ],
    threats: [
      {
        id: 'threat-3',
        name: 'Mobile Malware Attack',
        category: 'Elevation of Privilege',
        likelihood: 'High',
        impact: 'Critical',
        riskLevel: 'Critical',
        description: 'Malware targeting mobile banking application',
        mitigation: 'Implement runtime application self-protection (RASP)',
        status: 'identified'
      }
    ],
    recommendations: [
      'Implement mobile application security testing',
      'Add certificate pinning',
      'Implement biometric authentication',
      'Add transaction monitoring'
    ],
    lastUpdated: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'completed'
  }
];

export const RiskAssessment: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tabValue, setTabValue] = useState(0);
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [createAssessmentDialog, setCreateAssessmentDialog] = useState(false);
  const [assessmentDetailsDialog, setAssessmentDetailsDialog] = useState(false);
  const [selectedAssessment, setSelectedAssessment] = useState<RiskAssessment | null>(null);
  const [newAssessment, setNewAssessment] = useState({
    projectId: '',
    type: 'automated' as 'automated' | 'manual'
  });

  // Fetch projects for dropdown
  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const response = await projectsApi.getProjects();
      return response.data?.data || response.data || [];
    },
  });

  // Mock risk assessments query
  const { data: assessments = [], isLoading, refetch } = useQuery({
    queryKey: ['risk-assessments'],
    queryFn: async () => {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      return mockRiskAssessments;
    },
  });

  // Mock vulnerability scan mutation
  const scanMutation = useMutation({
    mutationFn: async (projectId: string) => {
      // Simulate scanning
      await new Promise(resolve => setTimeout(resolve, 3000));
      return { success: true, message: 'Vulnerability scan completed' };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['risk-assessments'] });
    },
  });

  const getRiskColor = (risk: string) => {
    switch (risk.toLowerCase()) {
      case 'critical': return 'error';
      case 'high': return 'warning';
      case 'medium': return 'info';
      case 'low': return 'success';
      default: return 'default';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'critical': return 'error';
      case 'high': return 'warning';
      case 'medium': return 'info';
      case 'low': return 'success';
      default: return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open': return <Error color="error" />;
      case 'in_progress': return <CircularProgress size={20} />;
      case 'resolved': return <CheckCircle color="success" />;
      case 'false_positive': return <Info color="info" />;
      default: return <Warning />;
    }
  };

  const filteredAssessments = assessments.filter(assessment => {
    if (selectedProject !== 'all' && assessment.projectId !== selectedProject) return false;
    return true;
  });

  const allVulnerabilities = assessments.flatMap(a => a.vulnerabilities).filter(vuln => {
    if (selectedSeverity !== 'all' && vuln.severity.toLowerCase() !== selectedSeverity) return false;
    return true;
  });

  const allThreats = assessments.flatMap(a => a.threats);

  const handleCreateAssessment = () => {
    // Simulate creating assessment
    setCreateAssessmentDialog(false);
    scanMutation.mutate(newAssessment.projectId);
    setNewAssessment({ projectId: '', type: 'automated' });
  };

  const handleViewAssessment = (assessmentId: string) => {
    const assessment = assessments.find(a => a.id === assessmentId);
    if (assessment) {
      setSelectedAssessment(assessment);
      setAssessmentDetailsDialog(true);
    }
  };

  const handleEditVulnerability = (vulnerabilityId: string) => {
    // For now, show a notification - in a real app, this would open an edit dialog
    alert(`Edit vulnerability functionality coming soon for ID: ${vulnerabilityId}`);
  };

  const handleDeleteVulnerability = (vulnerabilityId: string) => {
    // For now, show a confirmation - in a real app, this would handle deletion
    if (window.confirm('Are you sure you want to delete this vulnerability?')) {
      alert(`Delete vulnerability functionality coming soon for ID: ${vulnerabilityId}`);
    }
  };

  const handleViewThreat = (threatId: string) => {
    // For now, show a notification - in a real app, this would open a threat details view
    alert(`View threat details functionality coming soon for ID: ${threatId}`);
  };

  const handleEditThreat = (threatId: string) => {
    // For now, show a notification - in a real app, this would open an edit dialog
    alert(`Edit threat functionality coming soon for ID: ${threatId}`);
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const renderOverview = () => (
    <Box>
      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Avatar sx={{ bgcolor: 'error.main', mr: 2 }}>
                  <Assessment />
                </Avatar>
                <Box>
                  <Typography variant="h4">{assessments.length}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Assessments
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Avatar sx={{ bgcolor: 'warning.main', mr: 2 }}>
                  <BugReport />
                </Avatar>
                <Box>
                  <Typography variant="h4">{allVulnerabilities.length}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Vulnerabilities
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Avatar sx={{ bgcolor: 'info.main', mr: 2 }}>
                  <Security />
                </Avatar>
                <Box>
                  <Typography variant="h4">{allThreats.length}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Identified Threats
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Avatar sx={{ bgcolor: 'success.main', mr: 2 }}>
                  <Shield />
                </Avatar>
                <Box>
                  <Typography variant="h4">
                    {Math.round(assessments.reduce((sum, a) => sum + a.score, 0) / assessments.length || 0)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Avg Risk Score
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Recent Assessments */}
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h6">Recent Risk Assessments</Typography>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => setCreateAssessmentDialog(true)}
            >
              New Assessment
            </Button>
          </Box>

          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Project</TableCell>
                  <TableCell>Overall Risk</TableCell>
                  <TableCell>Score</TableCell>
                  <TableCell>Vulnerabilities</TableCell>
                  <TableCell>Threats</TableCell>
                  <TableCell>Last Updated</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredAssessments.map((assessment) => (
                  <TableRow key={assessment.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={500}>
                        {assessment.projectName}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={assessment.overallRisk}
                        color={getRiskColor(assessment.overallRisk) as any}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2">{assessment.score}/100</Typography>
                        <LinearProgress
                          variant="determinate"
                          value={assessment.score}
                          sx={{ width: 60, height: 6, borderRadius: 3 }}
                          color={getRiskColor(assessment.overallRisk) as any}
                        />
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Badge badgeContent={assessment.vulnerabilities.length} color="error">
                        <BugReport />
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge badgeContent={assessment.threats.length} color="warning">
                        <Security />
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {formatDistanceToNow(new Date(assessment.lastUpdated), { addSuffix: true })}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={assessment.status}
                        color={assessment.status === 'completed' ? 'success' : 'warning'}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Tooltip title="View Details">
                        <IconButton size="small" onClick={() => handleViewAssessment(assessment.id)}>
                          <Visibility />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Refresh">
                        <IconButton 
                          size="small" 
                          onClick={() => scanMutation.mutate(assessment.projectId)}
                          disabled={scanMutation.isPending}
                        >
                          <Refresh />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Box>
  );

  const renderVulnerabilities = () => (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6">Vulnerabilities</Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <TextField
            select
            size="small"
            value={selectedSeverity}
            onChange={(e) => setSelectedSeverity(e.target.value)}
            label="Filter by Severity"
            sx={{ minWidth: 150 }}
          >
            <MenuItem value="all">All Severities</MenuItem>
            <MenuItem value="critical">Critical</MenuItem>
            <MenuItem value="high">High</MenuItem>
            <MenuItem value="medium">Medium</MenuItem>
            <MenuItem value="low">Low</MenuItem>
          </TextField>
          <Button variant="outlined" startIcon={<Download />}>
            Export
          </Button>
        </Box>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Vulnerability</TableCell>
              <TableCell>Severity</TableCell>
              <TableCell>Component</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Assigned To</TableCell>
              <TableCell>Discovered</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {allVulnerabilities.map((vuln) => (
              <TableRow key={vuln.id} hover>
                <TableCell>
                  <Box>
                    <Typography variant="body2" fontWeight={500}>
                      {vuln.title}
                    </Typography>
                    {vuln.cve && (
                      <Typography variant="caption" color="text.secondary">
                        {vuln.cve}
                      </Typography>
                    )}
                  </Box>
                </TableCell>
                <TableCell>
                  <Chip
                    label={vuln.severity}
                    color={getSeverityColor(vuln.severity) as any}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="body2">{vuln.component}</Typography>
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {getStatusIcon(vuln.status)}
                    <Typography variant="body2">{vuln.status.replace('_', ' ')}</Typography>
                  </Box>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {vuln.assignedTo || 'Unassigned'}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" color="text.secondary">
                    {formatDistanceToNow(new Date(vuln.discoveredAt), { addSuffix: true })}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Tooltip title="Edit">
                    <IconButton size="small" onClick={() => handleEditVulnerability(vuln.id)}>
                      <Edit />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete">
                    <IconButton size="small" color="error" onClick={() => handleDeleteVulnerability(vuln.id)}>
                      <Delete />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );

  const renderThreats = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Identified Threats
      </Typography>
      
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Threat</TableCell>
              <TableCell>Category</TableCell>
              <TableCell>Likelihood</TableCell>
              <TableCell>Impact</TableCell>
              <TableCell>Risk Level</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {allThreats.map((threat) => (
              <TableRow key={threat.id} hover>
                <TableCell>
                  <Typography variant="body2" fontWeight={500}>
                    {threat.name}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">{threat.category}</Typography>
                </TableCell>
                <TableCell>
                  <Chip
                    label={threat.likelihood}
                    color={getRiskColor(threat.likelihood) as any}
                    size="small"
                    variant="outlined"
                  />
                </TableCell>
                <TableCell>
                  <Chip
                    label={threat.impact}
                    color={getRiskColor(threat.impact) as any}
                    size="small"
                    variant="outlined"
                  />
                </TableCell>
                <TableCell>
                  <Chip
                    label={threat.riskLevel}
                    color={getRiskColor(threat.riskLevel) as any}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <Chip
                    label={threat.status}
                    color={threat.status === 'mitigated' ? 'success' : 'warning'}
                    size="small"
                    variant="outlined"
                  />
                </TableCell>
                <TableCell>
                  <Tooltip title="View Details">
                    <IconButton size="small" onClick={() => handleViewThreat(threat.id)}>
                      <Visibility />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Edit">
                    <IconButton size="small" onClick={() => handleEditThreat(threat.id)}>
                      <Edit />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Risk Assessment
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Monitor and manage security risks across your projects
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <TextField
            select
            size="small"
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            label="Filter by Project"
            sx={{ minWidth: 200 }}
          >
            <MenuItem value="all">All Projects</MenuItem>
            {projects.map((project: any) => (
              <MenuItem key={project.id} value={project.id}>
                {project.name}
              </MenuItem>
            ))}
          </TextField>
          <Button
            variant="contained"
            startIcon={<Refresh />}
            onClick={() => refetch()}
            disabled={scanMutation.isPending}
          >
            {scanMutation.isPending ? 'Scanning...' : 'Refresh'}
          </Button>
        </Box>
      </Box>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabValue} onChange={handleTabChange}>
          <Tab label="Overview" />
          <Tab label="Vulnerabilities" />
          <Tab label="Threats" />
        </Tabs>
      </Box>

      {/* Content */}
      {tabValue === 0 && renderOverview()}
      {tabValue === 1 && renderVulnerabilities()}
      {tabValue === 2 && renderThreats()}

      {/* Assessment Details Dialog */}
      <Dialog open={assessmentDetailsDialog} onClose={() => setAssessmentDetailsDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">Risk Assessment Details</Typography>
            <IconButton onClick={() => setAssessmentDetailsDialog(false)}>
              <Close />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {selectedAssessment && (
            <Box>
              <Grid container spacing={3}>
                <Grid item xs={12} md={8}>
                  <Typography variant="h6" gutterBottom>
                    {selectedAssessment.projectName}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
                    <Chip
                      label={selectedAssessment.overallRisk}
                      color={getRiskColor(selectedAssessment.overallRisk) as any}
                    />
                    <Chip
                      label={selectedAssessment.status}
                      color={selectedAssessment.status === 'completed' ? 'success' : 'warning'}
                      variant="outlined"
                    />
                  </Box>

                  <Typography variant="h6" gutterBottom>
                    Vulnerabilities ({selectedAssessment.vulnerabilities.length})
                  </Typography>
                  <Box sx={{ mb: 3 }}>
                    {selectedAssessment.vulnerabilities.map((vuln) => (
                      <Box key={vuln.id} sx={{ mb: 2, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 1 }}>
                          <Typography variant="subtitle1" fontWeight={500}>
                            {vuln.title}
                          </Typography>
                          <Chip
                            label={vuln.severity}
                            color={getSeverityColor(vuln.severity) as any}
                            size="small"
                          />
                        </Box>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          {vuln.description}
                        </Typography>
                        <Typography variant="body2">
                          <strong>Component:</strong> {vuln.component}
                        </Typography>
                        <Typography variant="body2">
                          <strong>Status:</strong> {vuln.status.replace('_', ' ')}
                        </Typography>
                        {vuln.assignedTo && (
                          <Typography variant="body2">
                            <strong>Assigned To:</strong> {vuln.assignedTo}
                          </Typography>
                        )}
                      </Box>
                    ))}
                  </Box>

                  <Typography variant="h6" gutterBottom>
                    Identified Threats ({selectedAssessment.threats.length})
                  </Typography>
                  <Box sx={{ mb: 3 }}>
                    {selectedAssessment.threats.map((threat) => (
                      <Box key={threat.id} sx={{ mb: 2, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 1 }}>
                          <Typography variant="subtitle1" fontWeight={500}>
                            {threat.name}
                          </Typography>
                          <Chip
                            label={threat.riskLevel}
                            color={getRiskColor(threat.riskLevel) as any}
                            size="small"
                          />
                        </Box>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          {threat.description}
                        </Typography>
                        <Typography variant="body2">
                          <strong>Category:</strong> {threat.category}
                        </Typography>
                        <Typography variant="body2">
                          <strong>Likelihood:</strong> {threat.likelihood}
                        </Typography>
                        <Typography variant="body2">
                          <strong>Impact:</strong> {threat.impact}
                        </Typography>
                        <Typography variant="body2">
                          <strong>Mitigation:</strong> {threat.mitigation}
                        </Typography>
                      </Box>
                    ))}
                  </Box>

                  <Typography variant="h6" gutterBottom>
                    Recommendations
                  </Typography>
                  <List>
                    {selectedAssessment.recommendations.map((rec, index) => (
                      <ListItem key={index}>
                        <ListItemText primary={rec} />
                      </ListItem>
                    ))}
                  </List>
                </Grid>

                <Grid item xs={12} md={4}>
                  <Paper sx={{ p: 2, mb: 2 }}>
                    <Typography variant="h6" gutterBottom>
                      Assessment Summary
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                      <Typography variant="body2">
                        <strong>Overall Risk Score:</strong>
                      </Typography>
                      <Typography variant="h6" color={getRiskColor(selectedAssessment.overallRisk) + '.main'}>
                        {selectedAssessment.score}/100
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={selectedAssessment.score}
                      sx={{ mb: 2, height: 8, borderRadius: 4 }}
                      color={getRiskColor(selectedAssessment.overallRisk) as any}
                    />
                    <Typography variant="body2">
                      <strong>Project:</strong> {selectedAssessment.projectName}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Status:</strong> {selectedAssessment.status}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Last Updated:</strong> {formatDistanceToNow(new Date(selectedAssessment.lastUpdated), { addSuffix: true })}
                    </Typography>
                  </Paper>

                  <Paper sx={{ p: 2 }}>
                    <Typography variant="h6" gutterBottom>
                      Quick Stats
                    </Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2">Vulnerabilities:</Typography>
                      <Typography variant="body2" fontWeight={500}>
                        {selectedAssessment.vulnerabilities.length}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2">Threats:</Typography>
                      <Typography variant="body2" fontWeight={500}>
                        {selectedAssessment.threats.length}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2">Recommendations:</Typography>
                      <Typography variant="body2" fontWeight={500}>
                        {selectedAssessment.recommendations.length}
                      </Typography>
                    </Box>
                  </Paper>
                </Grid>
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAssessmentDetailsDialog(false)}>Close</Button>
          <Button variant="outlined" startIcon={<Download />}>
            Export Report
          </Button>
          <Button variant="contained" startIcon={<Edit />}>
            Edit Assessment
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create Assessment Dialog */}
      <Dialog open={createAssessmentDialog} onClose={() => setCreateAssessmentDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Risk Assessment</DialogTitle>
        <DialogContent>
          <TextField
            select
            fullWidth
            margin="dense"
            label="Project"
            value={newAssessment.projectId}
            onChange={(e) => setNewAssessment({ ...newAssessment, projectId: e.target.value })}
            sx={{ mb: 2 }}
          >
            {projects.map((project: any) => (
              <MenuItem key={project.id} value={project.id}>
                {project.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            fullWidth
            margin="dense"
            label="Assessment Type"
            value={newAssessment.type}
            onChange={(e) => setNewAssessment({ ...newAssessment, type: e.target.value as any })}
          >
            <MenuItem value="automated">Automated Scan</MenuItem>
            <MenuItem value="manual">Manual Assessment</MenuItem>
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateAssessmentDialog(false)}>Cancel</Button>
          <Button 
            onClick={handleCreateAssessment} 
            variant="contained"
            disabled={!newAssessment.projectId || scanMutation.isPending}
          >
            {scanMutation.isPending ? <CircularProgress size={20} /> : 'Create Assessment'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};