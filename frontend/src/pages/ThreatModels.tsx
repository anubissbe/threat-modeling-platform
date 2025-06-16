import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Avatar,
  AvatarGroup,
  TextField,
  InputAdornment,
  Tab,
  Tabs,
  Paper,
} from '@mui/material';
import {
  Add,
  MoreVert,
  Edit,
  Delete,
  Share,
  Download,
  Search,
  FilterList,
  Security,
  Warning,
  CheckCircle,
  Schedule,
  Brush,
} from '@mui/icons-material';

interface ThreatModel {
  id: string;
  name: string;
  methodology: 'STRIDE' | 'PASTA' | 'LINDDUN' | 'VAST' | 'DREAD';
  project: string;
  status: 'Draft' | 'In Review' | 'Approved' | 'Published';
  threats: number;
  mitigations: number;
  riskLevel: 'High' | 'Medium' | 'Low';
  lastModified: string;
  createdBy: string;
  collaborators: string[];
  completionRate: number;
}

const mockThreatModels: ThreatModel[] = [
  {
    id: '1',
    name: 'Payment Processing Security',
    methodology: 'STRIDE',
    project: 'E-commerce Platform',
    status: 'In Review',
    threats: 12,
    mitigations: 8,
    riskLevel: 'High',
    lastModified: '2 hours ago',
    createdBy: 'John Smith',
    collaborators: ['JS', 'SJ', 'MW'],
    completionRate: 75,
  },
  {
    id: '2',
    name: 'User Authentication Flow',
    methodology: 'LINDDUN',
    project: 'Mobile Banking App',
    status: 'Published',
    threats: 8,
    mitigations: 7,
    riskLevel: 'Medium',
    lastModified: '1 day ago',
    createdBy: 'Sarah Johnson',
    collaborators: ['SJ', 'ED'],
    completionRate: 95,
  },
  {
    id: '3',
    name: 'Data Storage Security',
    methodology: 'PASTA',
    project: 'HR Management System',
    status: 'Draft',
    threats: 15,
    mitigations: 5,
    riskLevel: 'High',
    lastModified: '3 days ago',
    createdBy: 'Mike Wilson',
    collaborators: ['MW', 'AC', 'JS'],
    completionRate: 40,
  },
  {
    id: '4',
    name: 'API Gateway Security',
    methodology: 'VAST',
    project: 'Microservices Architecture',
    status: 'Approved',
    threats: 6,
    mitigations: 6,
    riskLevel: 'Low',
    lastModified: '1 week ago',
    createdBy: 'Emily Davis',
    collaborators: ['ED', 'MW'],
    completionRate: 100,
  },
];

const methodologyColors = {
  STRIDE: 'primary',
  PASTA: 'secondary',
  LINDDUN: 'success',
  VAST: 'warning',
  DREAD: 'error',
} as const;

export const ThreatModels: React.FC = () => {
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [tabValue, setTabValue] = useState(0);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, modelId: string) => {
    setAnchorEl(event.currentTarget);
    setSelectedModel(modelId);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedModel(null);
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const getRiskColor = (risk: string) => {
    switch (risk.toLowerCase()) {
      case 'high': return 'error';
      case 'medium': return 'warning';
      case 'low': return 'success';
      default: return 'default';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'draft': return 'default';
      case 'in review': return 'warning';
      case 'approved': return 'info';
      case 'published': return 'success';
      default: return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'draft': return <Edit fontSize="small" />;
      case 'in review': return <Schedule fontSize="small" />;
      case 'approved': return <CheckCircle fontSize="small" />;
      case 'published': return <Security fontSize="small" />;
      default: return <Security fontSize="small" />;
    }
  };

  const filteredModels = mockThreatModels.filter(model => {
    const matchesSearch = model.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         model.project.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (tabValue === 0) return matchesSearch; // All
    if (tabValue === 1) return matchesSearch && model.status === 'Draft';
    if (tabValue === 2) return matchesSearch && model.status === 'In Review';
    if (tabValue === 3) return matchesSearch && (model.status === 'Approved' || model.status === 'Published');
    
    return matchesSearch;
  });

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Threat Models
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Create and manage security threat models using various methodologies
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Add />}
          size="large"
        >
          New Threat Model
        </Button>
      </Box>

      {/* Tabs and Search */}
      <Paper sx={{ mb: 4 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={handleTabChange}>
            <Tab label="All Models" />
            <Tab label="Draft" />
            <Tab label="In Review" />
            <Tab label="Published" />
          </Tabs>
        </Box>
        
        <Box sx={{ p: 3, display: 'flex', gap: 2 }}>
          <TextField
            placeholder="Search threat models..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
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
          >
            Filter
          </Button>
        </Box>
      </Paper>

      {/* Threat Models Grid */}
      <Grid container spacing={3}>
        {filteredModels.map((model) => (
          <Grid item xs={12} lg={6} key={model.id}>
            <Card 
              sx={{ 
                height: '100%',
                transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: 3,
                },
              }}
            >
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Chip
                      label={model.methodology}
                      size="small"
                      color={methodologyColors[model.methodology] as any}
                      variant="outlined"
                    />
                    <Chip
                      icon={getStatusIcon(model.status)}
                      label={model.status}
                      size="small"
                      color={getStatusColor(model.status) as any}
                    />
                    <Chip
                      label={model.riskLevel}
                      size="small"
                      color={getRiskColor(model.riskLevel) as any}
                      variant="filled"
                    />
                  </Box>
                  <IconButton
                    size="small"
                    onClick={(e) => handleMenuOpen(e, model.id)}
                  >
                    <MoreVert />
                  </IconButton>
                </Box>

                <Typography variant="h6" gutterBottom>
                  {model.name}
                </Typography>

                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Project: {model.project}
                </Typography>

                <Box sx={{ display: 'flex', gap: 3, my: 2 }}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h6" color="error.main">
                      {model.threats}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Threats
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h6" color="success.main">
                      {model.mitigations}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Mitigations
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h6" color="primary.main">
                      {model.completionRate}%
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Complete
                    </Typography>
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 3 }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Created by {model.createdBy}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block">
                      Modified {model.lastModified}
                    </Typography>
                  </Box>
                  
                  <AvatarGroup max={3} sx={{ '& .MuiAvatar-root': { width: 28, height: 28, fontSize: '0.75rem' } }}>
                    {model.collaborators.map((collaborator, index) => (
                      <Avatar key={index}>
                        {collaborator}
                      </Avatar>
                    ))}
                  </AvatarGroup>
                </Box>

                <Box sx={{ mt: 3, display: 'flex', gap: 1 }}>
                  <Button 
                    size="small" 
                    variant="contained"
                    startIcon={<Brush />}
                    onClick={() => navigate(`/threat-models/${model.id}/edit`)}
                    sx={{ minWidth: 'auto' }}
                  >
                    Edit Model
                  </Button>
                  <Button 
                    size="small" 
                    startIcon={<Share />}
                    sx={{ minWidth: 'auto' }}
                  >
                    Share
                  </Button>
                  <Button 
                    size="small" 
                    startIcon={<Download />}
                    sx={{ minWidth: 'auto' }}
                  >
                    Export
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Empty State */}
      {filteredModels.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Security sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            {searchTerm ? 'No threat models found' : 'No threat models yet'}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {searchTerm 
              ? 'Try adjusting your search terms or filters'
              : 'Create your first threat model to identify security risks'
            }
          </Typography>
          {!searchTerm && (
            <Button variant="contained" startIcon={<Add />}>
              Create Threat Model
            </Button>
          )}
        </Box>
      )}

      {/* Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => {
          if (selectedModel) {
            navigate(`/threat-models/${selectedModel}/edit`);
          }
          handleMenuClose();
        }}>
          <Brush sx={{ mr: 1 }} />
          Edit in Visual Editor
        </MenuItem>
        <MenuItem onClick={handleMenuClose}>
          <Edit sx={{ mr: 1 }} />
          Edit Properties
        </MenuItem>
        <MenuItem onClick={handleMenuClose}>
          <Share sx={{ mr: 1 }} />
          Share
        </MenuItem>
        <MenuItem onClick={handleMenuClose}>
          <Download sx={{ mr: 1 }} />
          Export
        </MenuItem>
        <MenuItem onClick={handleMenuClose} sx={{ color: 'error.main' }}>
          <Delete sx={{ mr: 1 }} />
          Delete
        </MenuItem>
      </Menu>
    </Box>
  );
};