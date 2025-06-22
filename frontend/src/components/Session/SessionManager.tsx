import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
} from '@mui/material';
import {
  Computer,
  Smartphone,
  Tablet,
  Delete,
  LocationOn,
  AccessTime,
  Security,
  Refresh,
} from '@mui/icons-material';

interface Session {
  id: string;
  deviceType: 'desktop' | 'mobile' | 'tablet';
  deviceName: string;
  browser: string;
  location: string;
  ipAddress: string;
  loginTime: string;
  lastActivity: string;
  isCurrent: boolean;
}

export const SessionManager: React.FC = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [sessionToRevoke, setSessionToRevoke] = useState<string | null>(null);

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/users/me/sessions', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setSessions(data);
      } else {
        setError('Failed to fetch sessions');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/users/me/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        setSessions(prev => prev.filter(session => session.id !== sessionId));
        setSuccessMessage('Session revoked successfully');
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        setError('Failed to revoke session');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSessionToRevoke(null);
    }
  };

  const handleRevokeAllOtherSessions = async () => {
    try {
      const response = await fetch('/api/users/me/sessions/revoke-all', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        setSessions(prev => prev.filter(session => session.isCurrent));
        setSuccessMessage('All other sessions revoked successfully');
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        setError('Failed to revoke sessions');
      }
    } catch {
      setError('Network error. Please try again.');
    }
  };

  const getDeviceIcon = (deviceType: string) => {
    switch (deviceType) {
      case 'mobile':
        return <Smartphone color="action" />;
      case 'tablet':
        return <Tablet color="action" />;
      default:
        return <Computer color="action" />;
    }
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getTimeSince = (dateString: string) => {
    const now = new Date();
    const then = new Date(dateString);
    const diffInMinutes = Math.floor((now.getTime() - then.getTime()) / (1000 * 60));

    if (diffInMinutes < 60) {
      return `${diffInMinutes} minutes ago`;
    } else if (diffInMinutes < 1440) {
      return `${Math.floor(diffInMinutes / 60)} hours ago`;
    } else {
      return `${Math.floor(diffInMinutes / 1440)} days ago`;
    }
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5">
          Active Sessions
        </Typography>
        <Box display="flex" gap={2}>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={fetchSessions}
            disabled={isLoading}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            color="error"
            startIcon={<Security />}
            onClick={handleRevokeAllOtherSessions}
            disabled={isLoading || sessions.filter(s => !s.isCurrent).length === 0}
          >
            Revoke All Other Sessions
          </Button>
        </Box>
      </Box>

      {successMessage && (
        <Alert severity="success" sx={{ mb: 3 }}>
          {successMessage}
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Card>
        <CardContent>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            These are the devices that are currently signed in to your account. 
            If you see any sessions you don't recognize, revoke them immediately.
          </Typography>

          <TableContainer component={Paper} sx={{ mt: 2 }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Device</TableCell>
                  <TableCell>Location</TableCell>
                  <TableCell>Last Activity</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sessions.map((session) => (
                  <TableRow key={session.id}>
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={2}>
                        {getDeviceIcon(session.deviceType)}
                        <Box>
                          <Typography variant="body2" fontWeight="medium">
                            {session.deviceName}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {session.browser}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={1}>
                        <LocationOn fontSize="small" color="action" />
                        <Box>
                          <Typography variant="body2">
                            {session.location}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {session.ipAddress}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={1}>
                        <AccessTime fontSize="small" color="action" />
                        <Box>
                          <Typography variant="body2">
                            {getTimeSince(session.lastActivity)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Signed in: {formatDateTime(session.loginTime)}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      {session.isCurrent ? (
                        <Chip 
                          label="Current Session" 
                          color="success" 
                          size="small"
                          variant="outlined"
                        />
                      ) : (
                        <Chip 
                          label="Active" 
                          color="primary" 
                          size="small"
                          variant="outlined"
                        />
                      )}
                    </TableCell>
                    <TableCell align="right">
                      {!session.isCurrent && (
                        <Tooltip title="Revoke this session">
                          <IconButton
                            color="error"
                            onClick={() => setSessionToRevoke(session.id)}
                            size="small"
                          >
                            <Delete />
                          </IconButton>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {sessions.length === 0 && !isLoading && (
            <Box textAlign="center" py={4}>
              <Typography variant="body2" color="text.secondary">
                No active sessions found
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Revoke Session Confirmation Dialog */}
      <Dialog
        open={sessionToRevoke !== null}
        onClose={() => setSessionToRevoke(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Revoke Session</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to revoke this session? The user will be signed out 
            immediately and will need to sign in again.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSessionToRevoke(null)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => sessionToRevoke && handleRevokeSession(sessionToRevoke)}
          >
            Revoke Session
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};