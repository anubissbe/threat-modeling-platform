import React, { useState } from 'react';
import {
  Drawer,
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  IconButton,
  Chip,
  TextField,
  InputAdornment,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Alert,
  Badge,
} from '@mui/material';
import {
  Close as CloseIcon,
  Warning as WarningIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  ExpandMore as ExpandMoreIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  LocationOn as LocationIcon,
  Timeline as TimelineIcon,
} from '@mui/icons-material';
import type { DiagramNode, DiagramConnection, Threat } from '../../types/editor';

interface ThreatPanelProps {
  open: boolean;
  threats: Threat[];
  nodes: DiagramNode[];
  connections: DiagramConnection[];
  onClose: () => void;
  onSelectElement: (element: DiagramNode | DiagramConnection) => void;
  onUpdateThreat: (threat: Threat) => void;
  onDeleteThreat: (id: string) => void;
}

const threatCategories = [
  'Spoofing',
  'Tampering',
  'Repudiation',
  'Information Disclosure',
  'Denial of Service',
  'Elevation of Privilege',
  'Privacy',
  'Other',
];

const severityLevels = ['critical', 'high', 'medium', 'low', 'info'];
const likelihoodLevels = ['very_high', 'high', 'medium', 'low', 'very_low'];

export const ThreatPanel: React.FC<ThreatPanelProps> = ({
  open,
  threats,
  nodes,
  connections,
  onClose,
  onSelectElement,
  onUpdateThreat,
  onDeleteThreat,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [filterSeverity, setFilterSeverity] = useState<string>('');
  const [editingThreat, setEditingThreat] = useState<Threat | null>(null);

  // Filter threats
  const filteredThreats = threats.filter((threat) => {
    const matchesSearch =
      searchTerm === '' ||
      threat.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      threat.description.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = filterCategory === '' || threat.category === filterCategory;
    const matchesSeverity = filterSeverity === '' || threat.severity === filterSeverity;
    
    return matchesSearch && matchesCategory && matchesSeverity;
  });

  // Group threats by category
  const groupedThreats = filteredThreats.reduce((acc, threat) => {
    const category = threat.category || 'Uncategorized';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(threat);
    return acc;
  }, {} as Record<string, Threat[]>);

  // Calculate statistics
  const stats = {
    total: threats.length,
    critical: threats.filter((t) => t.severity === 'critical').length,
    high: threats.filter((t) => t.severity === 'high').length,
    mitigated: threats.filter((t) => t.mitigations.length > 0).length,
  };

  const handleEditThreat = (threat: Threat) => {
    setEditingThreat(threat);
  };

  const handleSaveThreat = () => {
    if (editingThreat) {
      onUpdateThreat(editingThreat);
      setEditingThreat(null);
    }
  };

  const getAffectedElementName = (elementId: string) => {
    const node = nodes.find((n) => n.id === elementId);
    if (node) return node.data.label;
    
    const connection = connections.find((c) => c.id === elementId);
    if (connection) return connection.data.label;
    
    return 'Unknown';
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
      case 'high':
        return <ErrorIcon color="error" />;
      case 'medium':
        return <WarningIcon color="warning" />;
      case 'low':
        return <InfoIcon color="info" />;
      default:
        return <InfoIcon />;
    }
  };

  return (
    <>
      <Drawer
        anchor="left"
        open={open}
        onClose={onClose}
        sx={{
          width: 400,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: 400,
            boxSizing: 'border-box',
          },
        }}
      >
        <Box sx={{ p: 2 }}>
          {/* Header */}
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <Typography variant="h5" sx={{ flexGrow: 1 }}>
              Threat Analysis
            </Typography>
            <IconButton onClick={onClose}>
              <CloseIcon />
            </IconButton>
          </Box>

          {/* Statistics */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h4">{stats.total}</Typography>
                <Typography variant="caption" color="text.secondary">
                  Total
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h4" color="error.main">
                  {stats.critical}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Critical
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h4" color="warning.main">
                  {stats.high}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  High
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h4" color="success.main">
                  {stats.mitigated}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Mitigated
                </Typography>
              </Box>
            </Grid>
          </Grid>

          {/* Search and Filters */}
          <Box sx={{ mb: 2 }}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search threats..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
              sx={{ mb: 2 }}
            />
            
            <Box sx={{ display: 'flex', gap: 1 }}>
              <FormControl size="small" sx={{ flex: 1 }}>
                <InputLabel>Category</InputLabel>
                <Select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                >
                  <MenuItem value="">All Categories</MenuItem>
                  {threatCategories.map((cat) => (
                    <MenuItem key={cat} value={cat}>
                      {cat}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              
              <FormControl size="small" sx={{ flex: 1 }}>
                <InputLabel>Severity</InputLabel>
                <Select
                  value={filterSeverity}
                  onChange={(e) => setFilterSeverity(e.target.value)}
                >
                  <MenuItem value="">All Severities</MenuItem>
                  {severityLevels.map((level) => (
                    <MenuItem key={level} value={level}>
                      {level.charAt(0).toUpperCase() + level.slice(1)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          </Box>

          {/* Threat List */}
          {Object.keys(groupedThreats).length === 0 ? (
            <Alert severity="info">
              No threats found. Try adjusting your filters.
            </Alert>
          ) : (
            Object.entries(groupedThreats).map(([category, categoryThreats]) => (
              <Accordion key={category} defaultExpanded>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography sx={{ flexGrow: 1 }}>{category}</Typography>
                  <Badge badgeContent={categoryThreats.length} color="primary" />
                </AccordionSummary>
                <AccordionDetails sx={{ p: 0 }}>
                  <List>
                    {categoryThreats.map((threat) => (
                      <ListItem
                        key={threat.id}
                        sx={{
                          borderBottom: 1,
                          borderColor: 'divider',
                          '&:last-child': { borderBottom: 0 },
                        }}
                      >
                        <ListItemIcon>{getSeverityIcon(threat.severity)}</ListItemIcon>
                        <ListItemText
                          primary={threat.name}
                          secondary={
                            <Box sx={{ mt: 1 }}>
                              <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                                <Chip
                                  label={threat.severity}
                                  size="small"
                                  color={
                                    threat.severity === 'critical' ||
                                    threat.severity === 'high'
                                      ? 'error'
                                      : threat.severity === 'medium'
                                      ? 'warning'
                                      : 'default'
                                  }
                                />
                                <Chip
                                  label={`Likelihood: ${threat.likelihood}`}
                                  size="small"
                                  variant="outlined"
                                />
                                {threat.mitigations.length > 0 && (
                                  <Chip
                                    icon={<CheckCircleIcon />}
                                    label={`${threat.mitigations.length} mitigations`}
                                    size="small"
                                    color="success"
                                    variant="outlined"
                                  />
                                )}
                              </Box>
                              
                              {/* Affected Elements */}
                              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                {threat.affectedComponents.map((compId) => (
                                  <Chip
                                    key={compId}
                                    label={getAffectedElementName(compId)}
                                    size="small"
                                    icon={<LocationIcon />}
                                    onClick={() => {
                                      const node = nodes.find((n) => n.id === compId);
                                      if (node) onSelectElement(node);
                                    }}
                                    sx={{ cursor: 'pointer' }}
                                  />
                                ))}
                                {threat.affectedFlows.map((flowId) => (
                                  <Chip
                                    key={flowId}
                                    label={getAffectedElementName(flowId)}
                                    size="small"
                                    icon={<TimelineIcon />}
                                    onClick={() => {
                                      const conn = connections.find(
                                        (c) => c.id === flowId
                                      );
                                      if (conn) onSelectElement(conn);
                                    }}
                                    sx={{ cursor: 'pointer' }}
                                  />
                                ))}
                              </Box>
                            </Box>
                          }
                        />
                        <ListItemSecondaryAction>
                          <IconButton
                            size="small"
                            onClick={() => handleEditThreat(threat)}
                          >
                            <EditIcon />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => onDeleteThreat(threat.id)}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </ListItemSecondaryAction>
                      </ListItem>
                    ))}
                  </List>
                </AccordionDetails>
              </Accordion>
            ))
          )}
        </Box>
      </Drawer>

      {/* Edit Threat Dialog */}
      <Dialog
        open={editingThreat !== null}
        onClose={() => setEditingThreat(null)}
        maxWidth="sm"
        fullWidth
      >
        {editingThreat && (
          <>
            <DialogTitle>Edit Threat</DialogTitle>
            <DialogContent>
              <Box sx={{ pt: 2 }}>
                <TextField
                  fullWidth
                  label="Name"
                  value={editingThreat.name}
                  onChange={(e) =>
                    setEditingThreat({ ...editingThreat, name: e.target.value })
                  }
                  sx={{ mb: 2 }}
                />
                
                <TextField
                  fullWidth
                  label="Description"
                  multiline
                  rows={3}
                  value={editingThreat.description}
                  onChange={(e) =>
                    setEditingThreat({ ...editingThreat, description: e.target.value })
                  }
                  sx={{ mb: 2 }}
                />
                
                <Grid container spacing={2}>
                  <Grid item xs={4}>
                    <FormControl fullWidth>
                      <InputLabel>Category</InputLabel>
                      <Select
                        value={editingThreat.category}
                        onChange={(e) =>
                          setEditingThreat({
                            ...editingThreat,
                            category: e.target.value,
                          })
                        }
                      >
                        {threatCategories.map((cat) => (
                          <MenuItem key={cat} value={cat}>
                            {cat}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  
                  <Grid item xs={4}>
                    <FormControl fullWidth>
                      <InputLabel>Severity</InputLabel>
                      <Select
                        value={editingThreat.severity}
                        onChange={(e) =>
                          setEditingThreat({
                            ...editingThreat,
                            severity: e.target.value,
                          })
                        }
                      >
                        {severityLevels.map((level) => (
                          <MenuItem key={level} value={level}>
                            {level.charAt(0).toUpperCase() + level.slice(1)}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  
                  <Grid item xs={4}>
                    <FormControl fullWidth>
                      <InputLabel>Likelihood</InputLabel>
                      <Select
                        value={editingThreat.likelihood}
                        onChange={(e) =>
                          setEditingThreat({
                            ...editingThreat,
                            likelihood: e.target.value,
                          })
                        }
                      >
                        {likelihoodLevels.map((level) => (
                          <MenuItem key={level} value={level}>
                            {level.split('_').join(' ').charAt(0).toUpperCase() +
                              level.split('_').join(' ').slice(1)}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setEditingThreat(null)}>Cancel</Button>
              <Button onClick={handleSaveThreat} variant="contained">
                Save
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </>
  );
};