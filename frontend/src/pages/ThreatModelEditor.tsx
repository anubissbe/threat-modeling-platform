import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Alert, CircularProgress } from '@mui/material';
import { ThreatModelEditor as Editor } from '../components/ThreatModelEditor';
import { useAppDispatch } from '../hooks/redux';
import { loadDiagram } from '../store/slices/editorSlice';
import { showNotification } from '../store/slices/uiSlice';

// Mock data for demonstration
const mockThreatModel = {
  nodes: [
    {
      id: 'node-1',
      type: 'user',
      position: { x: 100, y: 100 },
      data: {
        label: 'End User',
        properties: {
          trustBoundary: 'Internet',
          description: 'External users accessing the application',
        },
      },
    },
    {
      id: 'node-2',
      type: 'webserver',
      position: { x: 400, y: 100 },
      data: {
        label: 'Web Server',
        properties: {
          trustBoundary: 'DMZ',
          technologies: 'Nginx, Node.js',
          authentication: 'jwt',
        },
      },
    },
    {
      id: 'node-3',
      type: 'database',
      position: { x: 700, y: 100 },
      data: {
        label: 'User Database',
        properties: {
          trustBoundary: 'Internal Network',
          technologies: 'PostgreSQL',
          dataClassification: 'Confidential',
        },
      },
    },
  ],
  connections: [
    {
      id: 'conn-1',
      source: 'node-1',
      target: 'node-2',
      type: 'dataflow',
      data: {
        label: 'HTTPS Request',
        properties: {
          protocol: 'HTTPS',
          encryption: 'TLS 1.3',
          dataTypes: 'User credentials, Session data',
        },
      },
    },
    {
      id: 'conn-2',
      source: 'node-2',
      target: 'node-3',
      type: 'dataflow',
      data: {
        label: 'Database Query',
        properties: {
          protocol: 'TCP',
          encryption: 'TLS 1.2',
          authentication: 'mutual-tls',
          dataTypes: 'User records, Authentication data',
        },
      },
    },
  ],
  threats: [
    {
      id: 'threat-1',
      name: 'SQL Injection',
      description: 'Attacker could inject malicious SQL through user input',
      category: 'Tampering',
      severity: 'high',
      likelihood: 'medium',
      affectedComponents: ['node-2'],
      affectedFlows: ['conn-2'],
      mitigations: [
        {
          id: 'mit-1',
          name: 'Parameterized Queries',
          description: 'Use prepared statements for all database queries',
          effectiveness: 'high',
          implemented: false,
          cost: 'low',
          effort: 'low',
        },
      ],
    },
    {
      id: 'threat-2',
      name: 'Man-in-the-Middle Attack',
      description: 'Attacker could intercept communication between user and server',
      category: 'Information Disclosure',
      severity: 'medium',
      likelihood: 'low',
      affectedComponents: [],
      affectedFlows: ['conn-1'],
      mitigations: [
        {
          id: 'mit-2',
          name: 'Certificate Pinning',
          description: 'Implement certificate pinning in mobile apps',
          effectiveness: 'high',
          implemented: true,
          cost: 'medium',
          effort: 'medium',
        },
      ],
    },
  ],
};

export const ThreatModelEditorPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  useEffect(() => {
    const loadThreatModel = async () => {
      try {
        setLoading(true);
        
        // TODO: Replace with actual API call
        // const response = await api.getThreatModel(id);
        
        // For now, load mock data
        setTimeout(() => {
          dispatch(loadDiagram(mockThreatModel));
          setLoading(false);
          dispatch(
            showNotification({
              message: 'Threat model loaded successfully',
              severity: 'success',
            })
          );
        }, 1000);
      } catch (err) {
        setError('Failed to load threat model');
        setLoading(false);
        dispatch(
          showNotification({
            message: 'Failed to load threat model',
            severity: 'error',
          })
        );
      }
    };

    if (id) {
      loadThreatModel();
    } else {
      setError('No threat model ID provided');
      setLoading(false);
    }
  }, [id, dispatch]);

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return <Editor />;
};