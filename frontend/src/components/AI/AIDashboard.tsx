import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Alert,
  LinearProgress,
  Chip,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Tooltip,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Badge
} from '@mui/material';
import {
  Psychology as PsychologyIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Refresh as RefreshIcon,
  Timeline as TimelineIcon,
  Speed as SpeedIcon,
  Assessment as AssessmentIcon,
  Cloud as CloudIcon,
  Security as SecurityIcon,
  Info as InfoIcon,
  TrendingUp as TrendingUpIcon
} from '@mui/icons-material';
import { AIServiceAPI, AIHealthStatus, AIMetrics, ThreatIntelligenceStats } from '../../services/aiService';

const AIDashboard: React.FC = () => {
  const [healthStatus, setHealthStatus] = useState<AIHealthStatus | null>(null);
  const [metrics, setMetrics] = useState<AIMetrics | null>(null);
  const [threatIntelStats, setThreatIntelStats] = useState<ThreatIntelligenceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchDashboardData = async () => {
    try {
      setError(null);
      const [healthResponse, metricsResponse, threatIntelResponse] = await Promise.allSettled([
        AIServiceAPI.getHealthStatus(),
        AIServiceAPI.getMetrics(),
        AIServiceAPI.getThreatIntelligenceStats()
      ]);

      if (healthResponse.status === 'fulfilled' && healthResponse.value.data.success) {
        setHealthStatus(healthResponse.value.data.data);
      }

      if (metricsResponse.status === 'fulfilled' && metricsResponse.value.data.success) {
        setMetrics(metricsResponse.value.data.data);
      }

      if (threatIntelResponse.status === 'fulfilled' && threatIntelResponse.value.data.success) {
        setThreatIntelStats(threatIntelResponse.value.data.data);
      }
    } catch (err: any) {
      setError('Failed to fetch dashboard data');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchDashboardData();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'success';
      case 'degraded': return 'warning';
      case 'unhealthy': return 'error';
      default: return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircleIcon color="success" />;
      case 'degraded': return <WarningIcon color="warning" />;
      case 'unhealthy': return <ErrorIcon color="error" />;
      default: return <InfoIcon />;
    }
  };

  const formatPercentage = (value: number) => {
    return `${(value * 100).toFixed(1)}%`;
  };

  const formatNumber = (value: number) => {
    return value.toLocaleString();
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString();
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box display="flex" justifyContent="between" alignItems="center" mb={3}>
        <Typography variant="h4" display="flex" alignItems="center">
          <PsychologyIcon sx={{ mr: 2 }} />
          AI Service Dashboard
        </Typography>
        <Button
          variant="outlined"
          startIcon={isRefreshing ? <CircularProgress size={20} /> : <RefreshIcon />}
          onClick={handleRefresh}
          disabled={isRefreshing}
        >
          Refresh
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Health Status */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom display="flex" alignItems="center">
                <SecurityIcon sx={{ mr: 1 }} />
                Service Health
              </Typography>
              
              {healthStatus ? (
                <Box>
                  <Box display="flex" alignItems="center" mb={2}>
                    {getStatusIcon(healthStatus.status)}
                    <Typography variant="h6" sx={{ ml: 1 }}>
                      {healthStatus.status.toUpperCase()}
                    </Typography>
                  </Box>
                  
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">
                        Response Time
                      </Typography>
                      <Typography variant="h6">
                        {healthStatus.response_time_ms}ms
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">
                        Error Rate
                      </Typography>
                      <Typography variant="h6">
                        {formatPercentage(healthStatus.error_rate)}
                      </Typography>
                    </Grid>
                  </Grid>

                  <Box mt={2}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Available Models
                    </Typography>
                    <Box display="flex" flexWrap="wrap" gap={1}>
                      {healthStatus.models_available.map((model, index) => (
                        <Chip
                          key={index}
                          label={model}
                          size="small"
                          color="primary"
                          variant="outlined"
                        />
                      ))}
                    </Box>
                  </Box>

                  <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
                    Last Updated: {formatDate(healthStatus.last_updated)}
                  </Typography>
                </Box>
              ) : (
                <Typography color="text.secondary">Health data unavailable</Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Performance Metrics */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom display="flex" alignItems="center">
                <SpeedIcon sx={{ mr: 1 }} />
                Performance Metrics
              </Typography>
              
              {metrics ? (
                <Box>
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">
                        Requests Processed
                      </Typography>
                      <Typography variant="h6">
                        {formatNumber(metrics.requests_processed)}
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">
                        Avg Processing Time
                      </Typography>
                      <Typography variant="h6">
                        {metrics.average_processing_time.toFixed(0)}ms
                      </Typography>
                    </Grid>
                  </Grid>

                  <Box mt={2}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Accuracy Metrics
                    </Typography>
                    {Object.entries(metrics.accuracy_metrics).map(([key, value]) => (
                      <Box key={key} display="flex" justifyContent="space-between" alignItems="center">
                        <Typography variant="body2">{key.replace('_', ' ')}</Typography>
                        <Typography variant="body2" fontWeight="bold">
                          {formatPercentage(value)}
                        </Typography>
                      </Box>
                    ))}
                  </Box>

                  <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
                    Threat Intelligence: {formatDate(metrics.threat_intelligence_freshness)}
                  </Typography>
                </Box>
              ) : (
                <Typography color="text.secondary">Metrics data unavailable</Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Model Performance */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom display="flex" alignItems="center">
                <AssessmentIcon sx={{ mr: 1 }} />
                Model Performance
              </Typography>
              
              {metrics && Object.keys(metrics.model_performance).length > 0 ? (
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Model</TableCell>
                        <TableCell align="right">Accuracy</TableCell>
                        <TableCell align="right">Precision</TableCell>
                        <TableCell align="right">Recall</TableCell>
                        <TableCell align="right">F1 Score</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {Object.entries(metrics.model_performance).map(([model, performance]) => (
                        <TableRow key={model}>
                          <TableCell component="th" scope="row">
                            {model}
                          </TableCell>
                          <TableCell align="right">{formatPercentage(performance.accuracy)}</TableCell>
                          <TableCell align="right">{formatPercentage(performance.precision)}</TableCell>
                          <TableCell align="right">{formatPercentage(performance.recall)}</TableCell>
                          <TableCell align="right">{formatPercentage(performance.f1_score)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Typography color="text.secondary">Model performance data unavailable</Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Threat Intelligence */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom display="flex" alignItems="center">
                <CloudIcon sx={{ mr: 1 }} />
                Threat Intelligence
              </Typography>
              
              {threatIntelStats ? (
                <Grid container spacing={3}>
                  <Grid item xs={12} md={4}>
                    <Box textAlign="center">
                      <Typography variant="h4" color="primary">
                        {formatNumber(threatIntelStats.total_indicators)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Total Indicators
                      </Typography>
                    </Box>
                  </Grid>
                  
                  <Grid item xs={12} md={4}>
                    <Box textAlign="center">
                      <Typography variant="h4" color="success.main">
                        {threatIntelStats.feeds_active}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Active Feeds
                      </Typography>
                    </Box>
                  </Grid>
                  
                  <Grid item xs={12} md={4}>
                    <Box textAlign="center">
                      <Typography variant="body2" color="text.secondary">
                        Last Updated
                      </Typography>
                      <Typography variant="body1">
                        {formatDate(threatIntelStats.last_update)}
                      </Typography>
                    </Box>
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" gutterBottom>
                      Indicators by Type
                    </Typography>
                    <List dense>
                      {Object.entries(threatIntelStats.indicators_by_type).map(([type, count]) => (
                        <ListItem key={type}>
                          <ListItemIcon>
                            <TrendingUpIcon fontSize="small" />
                          </ListItemIcon>
                          <ListItemText
                            primary={type}
                            secondary={formatNumber(count)}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" gutterBottom>
                      Top Sources
                    </Typography>
                    <List dense>
                      {threatIntelStats.top_sources.map((source, index) => (
                        <ListItem key={index}>
                          <ListItemIcon>
                            <Badge badgeContent={source.count} color="primary">
                              <SecurityIcon fontSize="small" />
                            </Badge>
                          </ListItemIcon>
                          <ListItemText
                            primary={source.source}
                            secondary={`${formatNumber(source.count)} indicators`}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </Grid>
                </Grid>
              ) : (
                <Typography color="text.secondary">Threat intelligence data unavailable</Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default AIDashboard;