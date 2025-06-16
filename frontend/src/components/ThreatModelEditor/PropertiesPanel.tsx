import React, { useState, useEffect } from 'react';
import {
  Drawer,
  Box,
  Typography,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Button,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Badge,
  Tab,
  Tabs,
  Paper,
  Alert,
} from '@mui/material';
import {
  Close as CloseIcon,
  Warning as WarningIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Security as SecurityIcon,
} from '@mui/icons-material';
import type { DiagramNode, DiagramConnection, Threat } from '../../types/editor';

interface PropertiesPanelProps {
  element: DiagramNode | DiagramConnection;
  threats: Threat[];
  onUpdate: (element: DiagramNode | DiagramConnection) => void;
  onAddThreat: (threat: Threat) => void;
}

const trustBoundaries = ['Internet', 'DMZ', 'Internal Network', 'Secure Zone'];
const dataClassifications = ['Public', 'Internal', 'Confidential', 'Secret', 'Top Secret'];
const protocols = ['HTTP', 'HTTPS', 'TCP', 'UDP', 'WebSocket', 'gRPC'];
const encryptionTypes = ['None', 'TLS 1.2', 'TLS 1.3', 'IPSec', 'Custom'];

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  element,
  threats,
  onUpdate,
  onAddThreat,
}) => {
  const [activeTab, setActiveTab] = useState(0);
  const [localElement, setLocalElement] = useState(element);
  const [newThreatName, setNewThreatName] = useState('');

  useEffect(() => {
    setLocalElement(element);
  }, [element]);

  const handlePropertyChange = (key: string, value: any) => {
    const updated = {
      ...localElement,
      data: {
        ...localElement.data,
        properties: {
          ...localElement.data.properties,
          [key]: value,
        },
      },
    };
    setLocalElement(updated);
    onUpdate(updated);
  };

  const handleLabelChange = (label: string) => {
    const updated = {
      ...localElement,
      data: {
        ...localElement.data,
        label,
      },
    };
    setLocalElement(updated);
    onUpdate(updated);
  };

  const handleAddThreat = () => {
    if (!newThreatName.trim()) return;

    const newThreat: Threat = {
      id: `threat-${Date.now()}`,
      name: newThreatName,
      description: '',
      category: 'Uncategorized',
      severity: 'medium',
      likelihood: 'medium',
      affectedComponents: 'position' in element ? [element.id] : [],
      affectedFlows: 'source' in element ? [element.id] : [],
      mitigations: [],
    };

    onAddThreat(newThreat);
    setNewThreatName('');
  };

  const isNode = 'position' in element;

  return (
    <Drawer
      anchor="right"
      open={true}
      variant="persistent"
      sx={{
        width: 320,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: 320,
          boxSizing: 'border-box',
        },
      }}
    >
      <Box sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Properties
          </Typography>
          <Badge badgeContent={threats.length} color="error">
            <SecurityIcon />
          </Badge>
        </Box>

        <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ mb: 2 }}>
          <Tab label="General" />
          <Tab label="Security" />
          <Tab label={`Threats (${threats.length})`} />
        </Tabs>

        {/* General Tab */}
        {activeTab === 0 && (
          <Box>
            <TextField
              fullWidth
              label="Name"
              value={localElement.data.label}
              onChange={(e) => handleLabelChange(e.target.value)}
              sx={{ mb: 2 }}
            />

            {isNode ? (
              <>
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Trust Boundary</InputLabel>
                  <Select
                    value={localElement.data.properties?.trustBoundary || ''}
                    onChange={(e) => handlePropertyChange('trustBoundary', e.target.value)}
                  >
                    <MenuItem value="">None</MenuItem>
                    {trustBoundaries.map((boundary) => (
                      <MenuItem key={boundary} value={boundary}>
                        {boundary}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <TextField
                  fullWidth
                  label="Description"
                  multiline
                  rows={3}
                  value={localElement.data.properties?.description || ''}
                  onChange={(e) => handlePropertyChange('description', e.target.value)}
                  sx={{ mb: 2 }}
                />

                <TextField
                  fullWidth
                  label="Technologies"
                  placeholder="e.g., Node.js, PostgreSQL"
                  value={localElement.data.properties?.technologies || ''}
                  onChange={(e) => handlePropertyChange('technologies', e.target.value)}
                  sx={{ mb: 2 }}
                />
              </>
            ) : (
              <>
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Protocol</InputLabel>
                  <Select
                    value={localElement.data.properties?.protocol || 'HTTPS'}
                    onChange={(e) => handlePropertyChange('protocol', e.target.value)}
                  >
                    {protocols.map((protocol) => (
                      <MenuItem key={protocol} value={protocol}>
                        {protocol}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Data Classification</InputLabel>
                  <Select
                    value={localElement.data.properties?.dataClassification || 'Internal'}
                    onChange={(e) =>
                      handlePropertyChange('dataClassification', e.target.value)
                    }
                  >
                    {dataClassifications.map((classification) => (
                      <MenuItem key={classification} value={classification}>
                        {classification}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <TextField
                  fullWidth
                  label="Data Types"
                  placeholder="e.g., User credentials, PII"
                  value={localElement.data.properties?.dataTypes || ''}
                  onChange={(e) => handlePropertyChange('dataTypes', e.target.value)}
                  sx={{ mb: 2 }}
                />
              </>
            )}
          </Box>
        )}

        {/* Security Tab */}
        {activeTab === 1 && (
          <Box>
            {isNode ? (
              <>
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Authentication</InputLabel>
                  <Select
                    value={localElement.data.properties?.authentication || 'none'}
                    onChange={(e) => handlePropertyChange('authentication', e.target.value)}
                  >
                    <MenuItem value="none">None</MenuItem>
                    <MenuItem value="basic">Basic Auth</MenuItem>
                    <MenuItem value="jwt">JWT</MenuItem>
                    <MenuItem value="oauth2">OAuth 2.0</MenuItem>
                    <MenuItem value="saml">SAML</MenuItem>
                    <MenuItem value="mutual-tls">Mutual TLS</MenuItem>
                  </Select>
                </FormControl>

                <TextField
                  fullWidth
                  label="Security Controls"
                  multiline
                  rows={3}
                  placeholder="List security controls in place"
                  value={localElement.data.properties?.securityControls || ''}
                  onChange={(e) => handlePropertyChange('securityControls', e.target.value)}
                  sx={{ mb: 2 }}
                />

                <TextField
                  fullWidth
                  label="Compliance Requirements"
                  placeholder="e.g., PCI-DSS, GDPR"
                  value={localElement.data.properties?.compliance || ''}
                  onChange={(e) => handlePropertyChange('compliance', e.target.value)}
                  sx={{ mb: 2 }}
                />
              </>
            ) : (
              <>
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Encryption</InputLabel>
                  <Select
                    value={localElement.data.properties?.encryption || 'TLS 1.3'}
                    onChange={(e) => handlePropertyChange('encryption', e.target.value)}
                  >
                    {encryptionTypes.map((encryption) => (
                      <MenuItem key={encryption} value={encryption}>
                        {encryption}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Authentication</InputLabel>
                  <Select
                    value={localElement.data.properties?.authentication || 'none'}
                    onChange={(e) => handlePropertyChange('authentication', e.target.value)}
                  >
                    <MenuItem value="none">None</MenuItem>
                    <MenuItem value="api-key">API Key</MenuItem>
                    <MenuItem value="bearer-token">Bearer Token</MenuItem>
                    <MenuItem value="mutual-tls">Mutual TLS</MenuItem>
                    <MenuItem value="signature">Digital Signature</MenuItem>
                  </Select>
                </FormControl>

                <TextField
                  fullWidth
                  label="Rate Limiting"
                  placeholder="e.g., 1000 req/min"
                  value={localElement.data.properties?.rateLimiting || ''}
                  onChange={(e) => handlePropertyChange('rateLimiting', e.target.value)}
                  sx={{ mb: 2 }}
                />
              </>
            )}

            {localElement.data.properties?.securityScore && (
              <Alert severity="info" sx={{ mt: 2 }}>
                Security Score: {localElement.data.properties.securityScore}/100
              </Alert>
            )}
          </Box>
        )}

        {/* Threats Tab */}
        {activeTab === 2 && (
          <Box>
            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
              <TextField
                fullWidth
                size="small"
                placeholder="Add new threat..."
                value={newThreatName}
                onChange={(e) => setNewThreatName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddThreat()}
              />
              <IconButton onClick={handleAddThreat} color="primary">
                <AddIcon />
              </IconButton>
            </Box>

            {threats.length === 0 ? (
              <Paper sx={{ p: 3, textAlign: 'center', bgcolor: 'grey.50' }}>
                <WarningIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                <Typography variant="body2" color="text.secondary">
                  No threats identified yet
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Start by adding potential threats above
                </Typography>
              </Paper>
            ) : (
              <List>
                {threats.map((threat) => (
                  <ListItem
                    key={threat.id}
                    sx={{
                      border: 1,
                      borderColor: 'divider',
                      borderRadius: 1,
                      mb: 1,
                    }}
                  >
                    <ListItemText
                      primary={threat.name}
                      secondary={
                        <Box sx={{ mt: 1 }}>
                          <Chip
                            label={threat.severity}
                            size="small"
                            color={
                              threat.severity === 'critical' || threat.severity === 'high'
                                ? 'error'
                                : threat.severity === 'medium'
                                ? 'warning'
                                : 'default'
                            }
                            sx={{ mr: 1 }}
                          />
                          <Chip
                            label={`${threat.mitigations.length} mitigations`}
                            size="small"
                            variant="outlined"
                          />
                        </Box>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </Box>
        )}
      </Box>
    </Drawer>
  );
};