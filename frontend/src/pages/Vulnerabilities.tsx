import React, { useState } from 'react';
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
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  IconButton,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  OutlinedInput,
  InputAdornment,
  Tabs,
  Tab,
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  ListItemSecondaryAction,
  Divider,
  Badge,
  LinearProgress,
} from '@mui/material';
import {
  BugReport,
  Security,
  Warning,
  Error,
  CheckCircle,
  Add,
  Edit,
  Delete,
  Visibility,
  Search,
  FilterList,
  Download,
  Upload,
  Refresh,
  Assignment,
  Schedule,
  TrendingUp,
  TrendingDown,
  Info,
  Close,
  OpenInNew,
} from '@mui/icons-material';
import { projectsApi } from '@/services/api';
import { formatDistanceToNow } from 'date-fns';

interface Vulnerability {
  id: string;
  title: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  cve?: string;
  cwe?: string;
  component: string;
  version?: string;
  description: string;
  impact: string;
  remediation: string;
  references: string[];
  status: 'open' | 'in_progress' | 'resolved' | 'false_positive' | 'wont_fix';
  priority: 'P1' | 'P2' | 'P3' | 'P4';
  discoveredAt: string;
  lastSeen: string;
  assignedTo?: string;
  projectId: string;
  projectName: string;
  affectedAssets: string[];
  exploitability: 'Functional' | 'Proof of Concept' | 'Unproven' | 'Not Defined';
  remediationComplexity: 'Low' | 'Medium' | 'High';
  businessImpact: 'Critical' | 'High' | 'Medium' | 'Low';
  tags: string[];
  notes: string;
}

const mockVulnerabilities: Vulnerability[] = [
  {
    id: 'vuln-001',
    title: 'SQL Injection in User Authentication',
    severity: 'Critical',
    cve: 'CVE-2023-1234',
    cwe: 'CWE-89',
    component: 'auth-service',
    version: '1.2.3',
    description: 'Unsanitized user input in the login endpoint allows SQL injection attacks, potentially leading to unauthorized access and data breach.',
    impact: 'Complete database compromise, unauthorized access to all user accounts, potential data theft',
    remediation: 'Implement parameterized queries, input validation, and prepared statements. Update to latest framework version.',
    references: [
      'https://owasp.org/www-community/attacks/SQL_Injection',
      'https://cwe.mitre.org/data/definitions/89.html'
    ],
    status: 'open',
    priority: 'P1',
    discoveredAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    lastSeen: new Date().toISOString(),
    assignedTo: 'security-team',
    projectId: '1',
    projectName: 'E-Commerce Platform',
    affectedAssets: ['user-database', 'authentication-service', 'user-sessions'],
    exploitability: 'Functional',
    remediationComplexity: 'Medium',
    businessImpact: 'Critical',
    tags: ['injection', 'authentication', 'database'],
    notes: 'High priority - affects all user authentication. Immediate action required.'
  },
  {
    id: 'vuln-002',
    title: 'Cross-Site Scripting (XSS) in Product Reviews',
    severity: 'High',
    cve: 'CVE-2023-5678',
    cwe: 'CWE-79',
    component: 'review-service',
    version: '2.1.0',
    description: 'Stored XSS vulnerability in product review comments allows attackers to inject malicious scripts.',
    impact: 'Session hijacking, credential theft, malicious redirects, defacement',
    remediation: 'Implement proper input sanitization, output encoding, and Content Security Policy (CSP) headers.',
    references: [
      'https://owasp.org/www-community/attacks/xss/',
      'https://cwe.mitre.org/data/definitions/79.html'
    ],
    status: 'in_progress',
    priority: 'P2',
    discoveredAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    lastSeen: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    assignedTo: 'dev-team',
    projectId: '1',
    projectName: 'E-Commerce Platform',
    affectedAssets: ['review-system', 'product-pages', 'user-content'],
    exploitability: 'Proof of Concept',
    remediationComplexity: 'Low',
    businessImpact: 'High',
    tags: ['xss', 'injection', 'client-side'],
    notes: 'Fix in progress, estimated completion in 2 days.'
  },
  {
    id: 'vuln-003',
    title: 'Insecure Direct Object References in Order API',
    severity: 'Medium',
    cwe: 'CWE-639',
    component: 'order-service',
    version: '1.5.2',
    description: 'API endpoints allow users to access other users\' order details by manipulating order IDs.',
    impact: 'Unauthorized access to sensitive order information, privacy violations',
    remediation: 'Implement proper authorization checks, use UUIDs instead of sequential IDs, validate user permissions.',
    references: [
      'https://owasp.org/www-community/attacks/Insecure_Direct_Object_References',
      'https://cwe.mitre.org/data/definitions/639.html'
    ],
    status: 'open',
    priority: 'P3',
    discoveredAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    lastSeen: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    projectId: '1',
    projectName: 'E-Commerce Platform',
    affectedAssets: ['order-api', 'user-orders', 'order-history'],
    exploitability: 'Functional',
    remediationComplexity: 'Medium',
    businessImpact: 'Medium',
    tags: ['authorization', 'api', 'access-control'],
    notes: 'Need to review all API endpoints for similar issues.'
  },
  {
    id: 'vuln-004',
    title: 'Insecure Cryptographic Storage',
    severity: 'Critical',
    cwe: 'CWE-327',
    component: 'mobile-app',
    version: '3.0.1',
    description: 'Sensitive customer data stored on mobile devices using weak encryption algorithms.',
    impact: 'Customer financial data exposure, regulatory compliance violations',
    remediation: 'Implement AES-256 encryption, secure key management, and encrypted storage APIs.',
    references: [
      'https://owasp.org/www-community/vulnerabilities/Insecure_Cryptographic_Storage',
      'https://cwe.mitre.org/data/definitions/327.html'
    ],
    status: 'open',
    priority: 'P1',
    discoveredAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    lastSeen: new Date().toISOString(),
    assignedTo: 'mobile-team',
    projectId: '2',
    projectName: 'Mobile Banking App',
    affectedAssets: ['mobile-app', 'local-storage', 'user-credentials'],
    exploitability: 'Proof of Concept',
    remediationComplexity: 'High',
    businessImpact: 'Critical',
    tags: ['cryptography', 'mobile', 'storage'],
    notes: 'Regulatory requirement - must be fixed before next release.'
  },
  {
    id: 'vuln-005',
    title: 'Insufficient Session Expiration',
    severity: 'Medium',
    cwe: 'CWE-613',
    component: 'session-manager',
    version: '1.0.8',
    description: 'User sessions do not expire after reasonable time periods, increasing risk of session hijacking.',
    impact: 'Unauthorized access via session hijacking, especially on shared devices',
    remediation: 'Implement proper session timeout, idle timeout, and secure session invalidation.',
    references: [
      'https://owasp.org/www-community/vulnerabilities/Insufficient_Session_Expiration',
      'https://cwe.mitre.org/data/definitions/613.html'
    ],
    status: 'resolved',
    priority: 'P3',
    discoveredAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    lastSeen: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    assignedTo: 'backend-team',
    projectId: '2',
    projectName: 'Mobile Banking App',
    affectedAssets: ['session-manager', 'user-sessions'],
    exploitability: 'Unproven',
    remediationComplexity: 'Low',
    businessImpact: 'Medium',
    tags: ['session', 'timeout', 'security'],
    notes: 'Fixed in version 1.0.9 - session timeout set to 30 minutes.'
  },
  {
    id: 'vuln-006',
    title: 'Missing Security Headers',
    severity: 'Low',
    cwe: 'CWE-693',
    component: 'web-server',
    version: '2.4.1',
    description: 'Web application missing important security headers (HSTS, CSP, X-Frame-Options).',
    impact: 'Increased risk of clickjacking, MITM attacks, and content injection',
    remediation: 'Configure proper security headers in web server configuration.',
    references: [
      'https://owasp.org/www-project-secure-headers/',
      'https://cwe.mitre.org/data/definitions/693.html'
    ],
    status: 'false_positive',
    priority: 'P4',
    discoveredAt: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString(),
    lastSeen: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    assignedTo: 'devops-team',
    projectId: '1',
    projectName: 'E-Commerce Platform',
    affectedAssets: ['web-application'],
    exploitability: 'Not Defined',
    remediationComplexity: 'Low',
    businessImpact: 'Low',
    tags: ['headers', 'configuration', 'hardening'],
    notes: 'Marked as false positive - headers are configured at CDN level.'
  }
];

export const Vulnerabilities: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tabValue, setTabValue] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [createVulnDialog, setCreateVulnDialog] = useState(false);
  const [selectedVuln, setSelectedVuln] = useState<Vulnerability | null>(null);
  const [detailsDialog, setDetailsDialog] = useState(false);

  // Fetch projects for dropdown
  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const response = await projectsApi.getProjects();
      return response.data?.data || response.data || [];
    },
  });

  // Fetch vulnerabilities from API
  const { data: vulnerabilities = [], isLoading, refetch } = useQuery({
    queryKey: ['vulnerabilities'],
    queryFn: async () => {
      try {
        const response = await fetch('http://localhost:3000/api/vulnerabilities');
        const data = await response.json();
        return data.data || data || [];
      } catch (error) {
        console.error('Failed to fetch vulnerabilities:', error);
        // Fallback to mock data if API fails for development
        return mockVulnerabilities;
      }
    },
  });

  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'critical': return 'error';
      case 'high': return 'warning';
      case 'medium': return 'info';
      case 'low': return 'success';
      default: return 'default';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'error';
      case 'in_progress': return 'warning';
      case 'resolved': return 'success';
      case 'false_positive': return 'info';
      case 'wont_fix': return 'default';
      default: return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open': return <Error color="error" />;
      case 'in_progress': return <CircularProgress size={16} />;
      case 'resolved': return <CheckCircle color="success" />;
      case 'false_positive': return <Info color="info" />;
      case 'wont_fix': return <Close color="disabled" />;
      default: return <Warning />;
    }
  };

  const filteredVulnerabilities = vulnerabilities.filter((vuln: Vulnerability) => {
    const matchesSearch = vuln.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         vuln.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         vuln.component.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         vuln.cve?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         vuln.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesSeverity = selectedSeverity === 'all' || vuln.severity.toLowerCase() === selectedSeverity;
    const matchesStatus = selectedStatus === 'all' || vuln.status === selectedStatus;
    const matchesProject = selectedProject === 'all' || vuln.projectId === selectedProject;

    return matchesSearch && matchesSeverity && matchesStatus && matchesProject;
  });

  const vulnerabilityStats = {
    total: vulnerabilities.length,
    critical: vulnerabilities.filter(v => v.severity === 'Critical').length,
    high: vulnerabilities.filter(v => v.severity === 'High').length,
    medium: vulnerabilities.filter(v => v.severity === 'Medium').length,
    low: vulnerabilities.filter(v => v.severity === 'Low').length,
    open: vulnerabilities.filter(v => v.status === 'open').length,
    inProgress: vulnerabilities.filter(v => v.status === 'in_progress').length,
    resolved: vulnerabilities.filter(v => v.status === 'resolved').length,
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleViewDetails = (vulnerability: Vulnerability) => {
    setSelectedVuln(vulnerability);
    setDetailsDialog(true);
  };

  const handleEditVulnerability = (vulnerabilityId: string) => {
    // Find the vulnerability and open create/edit dialog
    const vuln = vulnerabilities.find(v => v.id === vulnerabilityId);
    if (vuln) {
      setSelectedVuln(vuln);
      setCreateVulnDialog(true);
    }
  };

  const handleExternalLink = (vulnerability: Vulnerability) => {
    // Open external link (e.g., CVE details, security advisory)
    if (vulnerability.cve) {
      window.open(`https://cve.mitre.org/cgi-bin/cvename.cgi?name=${vulnerability.cve}`, '_blank');
    } else {
      alert('No external link available for this vulnerability');
    }
  };

  const renderOverview = () => (
    <Box>
      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Avatar sx={{ bgcolor: 'primary.main', mr: 2 }}>
                  <BugReport />
                </Avatar>
                <Box>
                  <Typography variant="h4">{vulnerabilityStats.total}</Typography>
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
                <Avatar sx={{ bgcolor: 'error.main', mr: 2 }}>
                  <Error />
                </Avatar>
                <Box>
                  <Typography variant="h4">{vulnerabilityStats.critical + vulnerabilityStats.high}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Critical & High
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
                  <Schedule />
                </Avatar>
                <Box>
                  <Typography variant="h4">{vulnerabilityStats.open}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Open Issues
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
                  <CheckCircle />
                </Avatar>
                <Box>
                  <Typography variant="h4">{vulnerabilityStats.resolved}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Resolved
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Severity Distribution */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Severity Distribution
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h3" color="error.main">
                  {vulnerabilityStats.critical}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Critical
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h3" color="warning.main">
                  {vulnerabilityStats.high}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  High
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h3" color="info.main">
                  {vulnerabilityStats.medium}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Medium
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h3" color="success.main">
                  {vulnerabilityStats.low}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Low
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Recent Vulnerabilities */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Recent Vulnerabilities
          </Typography>
          <List>
            {vulnerabilities.slice(0, 5).map((vuln, index) => (
              <React.Fragment key={vuln.id}>
                <ListItem>
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: getSeverityColor(vuln.severity) + '.main' }}>
                      <BugReport />
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={vuln.title}
                    secondary={
                      <React.Fragment>
                        <Typography variant="caption" display="block">
                          {vuln.component} • {vuln.projectName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {formatDistanceToNow(new Date(vuln.discoveredAt), { addSuffix: true })}
                        </Typography>
                      </React.Fragment>
                    }
                  />
                  <ListItemSecondaryAction>
                    <Chip
                      label={vuln.severity}
                      color={getSeverityColor(vuln.severity) as any}
                      size="small"
                    />
                  </ListItemSecondaryAction>
                </ListItem>
                {index < 4 && <Divider />}
              </React.Fragment>
            ))}
          </List>
        </CardContent>
      </Card>
    </Box>
  );

  const renderVulnerabilities = () => (
    <Box>
      {/* Filters */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <TextField
          placeholder="Search vulnerabilities..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search />
              </InputAdornment>
            ),
          }}
          sx={{ flexGrow: 1, minWidth: 200 }}
        />
        <TextField
          select
          label="Severity"
          value={selectedSeverity}
          onChange={(e) => setSelectedSeverity(e.target.value)}
          sx={{ minWidth: 120 }}
        >
          <MenuItem value="all">All Severities</MenuItem>
          <MenuItem value="critical">Critical</MenuItem>
          <MenuItem value="high">High</MenuItem>
          <MenuItem value="medium">Medium</MenuItem>
          <MenuItem value="low">Low</MenuItem>
        </TextField>
        <TextField
          select
          label="Status"
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          sx={{ minWidth: 120 }}
        >
          <MenuItem value="all">All Status</MenuItem>
          <MenuItem value="open">Open</MenuItem>
          <MenuItem value="in_progress">In Progress</MenuItem>
          <MenuItem value="resolved">Resolved</MenuItem>
          <MenuItem value="false_positive">False Positive</MenuItem>
          <MenuItem value="wont_fix">Won't Fix</MenuItem>
        </TextField>
        <TextField
          select
          label="Project"
          value={selectedProject}
          onChange={(e) => setSelectedProject(e.target.value)}
          sx={{ minWidth: 150 }}
        >
          <MenuItem value="all">All Projects</MenuItem>
          {projects.map((project: any) => (
            <MenuItem key={project.id} value={project.id}>
              {project.name}
            </MenuItem>
          ))}
        </TextField>
      </Box>

      {/* Vulnerabilities Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Vulnerability</TableCell>
              <TableCell>Severity</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Component</TableCell>
              <TableCell>Project</TableCell>
              <TableCell>Assigned To</TableCell>
              <TableCell>Discovered</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredVulnerabilities.map((vuln) => (
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
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {getStatusIcon(vuln.status)}
                    <Chip
                      label={vuln.status.replace('_', ' ')}
                      color={getStatusColor(vuln.status) as any}
                      size="small"
                      variant="outlined"
                    />
                  </Box>
                </TableCell>
                <TableCell>
                  <Box>
                    <Typography variant="body2">{vuln.component}</Typography>
                    {vuln.version && (
                      <Typography variant="caption" color="text.secondary">
                        v{vuln.version}
                      </Typography>
                    )}
                  </Box>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">{vuln.projectName}</Typography>
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
                  <Tooltip title="View Details">
                    <IconButton size="small" onClick={() => handleViewDetails(vuln)}>
                      <Visibility />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Edit">
                    <IconButton size="small" onClick={() => handleEditVulnerability(vuln.id)}>
                      <Edit />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="External Link">
                    <IconButton size="small" onClick={() => handleExternalLink(vuln)}>
                      <OpenInNew />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {filteredVulnerabilities.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <BugReport sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            No vulnerabilities found
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Try adjusting your search and filter criteria
          </Typography>
        </Box>
      )}
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
            Vulnerabilities
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Track and manage security vulnerabilities across your projects
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button variant="outlined" startIcon={<Upload />}>
            Import
          </Button>
          <Button variant="outlined" startIcon={<Download />}>
            Export
          </Button>
          <Button
            variant="contained"
            startIcon={<Refresh />}
            onClick={() => refetch()}
          >
            Scan
          </Button>
        </Box>
      </Box>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabValue} onChange={handleTabChange}>
          <Tab label="Overview" />
          <Tab label="Vulnerabilities" />
        </Tabs>
      </Box>

      {/* Content */}
      {tabValue === 0 && renderOverview()}
      {tabValue === 1 && renderVulnerabilities()}

      {/* Vulnerability Details Dialog */}
      <Dialog open={detailsDialog} onClose={() => setDetailsDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">Vulnerability Details</Typography>
            <IconButton onClick={() => setDetailsDialog(false)}>
              <Close />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {selectedVuln && (
            <Box>
              <Grid container spacing={2}>
                <Grid item xs={12} md={8}>
                  <Typography variant="h6" gutterBottom>
                    {selectedVuln.title}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                    <Chip
                      label={selectedVuln.severity}
                      color={getSeverityColor(selectedVuln.severity) as any}
                      size="small"
                    />
                    <Chip
                      label={selectedVuln.status.replace('_', ' ')}
                      color={getStatusColor(selectedVuln.status) as any}
                      size="small"
                      variant="outlined"
                    />
                    <Chip
                      label={selectedVuln.priority}
                      color="primary"
                      size="small"
                      variant="outlined"
                    />
                  </Box>
                  <Typography variant="body2" paragraph>
                    {selectedVuln.description}
                  </Typography>
                  <Typography variant="subtitle2" gutterBottom>
                    Impact
                  </Typography>
                  <Typography variant="body2" paragraph>
                    {selectedVuln.impact}
                  </Typography>
                  <Typography variant="subtitle2" gutterBottom>
                    Remediation
                  </Typography>
                  <Typography variant="body2" paragraph>
                    {selectedVuln.remediation}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Paper sx={{ p: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Details
                    </Typography>
                    <Typography variant="body2">
                      <strong>Component:</strong> {selectedVuln.component}
                    </Typography>
                    {selectedVuln.version && (
                      <Typography variant="body2">
                        <strong>Version:</strong> {selectedVuln.version}
                      </Typography>
                    )}
                    {selectedVuln.cve && (
                      <Typography variant="body2">
                        <strong>CVE:</strong> {selectedVuln.cve}
                      </Typography>
                    )}
                    {selectedVuln.cwe && (
                      <Typography variant="body2">
                        <strong>CWE:</strong> {selectedVuln.cwe}
                      </Typography>
                    )}
                    <Typography variant="body2">
                      <strong>Project:</strong> {selectedVuln.projectName}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Assigned To:</strong> {selectedVuln.assignedTo || 'Unassigned'}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Discovered:</strong> {formatDistanceToNow(new Date(selectedVuln.discoveredAt), { addSuffix: true })}
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailsDialog(false)}>Close</Button>
          <Button variant="contained" startIcon={<Edit />}>
            Edit
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};