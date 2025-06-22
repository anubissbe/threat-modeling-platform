import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Alert,
  Stepper,
  Step,
  StepLabel,
  Grid,
  Chip,
  Paper,
  IconButton,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  Security,
  QrCode,
  Smartphone,
  VerifiedUser,
  ContentCopy,
  CheckCircle,
  Download,
} from '@mui/icons-material';
import { validateMfaToken } from '../../utils/validation';

interface MFASetupProps {
  onComplete: () => void;
  onCancel: () => void;
}

interface MFASetupData {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
}

const steps = [
  'Download Authenticator App',
  'Scan QR Code',
  'Verify Setup',
  'Save Backup Codes'
];

export const MFASetup: React.FC<MFASetupProps> = ({ onComplete, onCancel }) => {
  const [activeStep, setActiveStep] = useState(0);
  const [setupData, setSetupData] = useState<MFASetupData | null>(null);
  const [verificationToken, setVerificationToken] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [backupCodesSaved, setBackupCodesSaved] = useState(false);

  const tokenValidation = validateMfaToken(verificationToken);

  useEffect(() => {
    initializeMFASetup();
  }, []);

  const initializeMFASetup = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/users/me/mfa/setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setSetupData(data);
      } else {
        setError('Failed to initialize MFA setup');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleNext = () => {
    if (activeStep === 2) {
      handleVerifyToken();
    } else {
      setActiveStep((prevStep) => prevStep + 1);
    }
  };

  const handleBack = () => {
    setActiveStep((prevStep) => prevStep - 1);
  };

  const handleVerifyToken = async () => {
    if (!tokenValidation.isValid) {
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/users/me/mfa/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          token: verificationToken,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setSetupData(prev => prev ? { ...prev, backupCodes: data.backupCodes } : null);
        setActiveStep(3);
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Invalid verification code');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadBackupCodes = () => {
    if (!setupData?.backupCodes) return;

    const content = [
      'Two-Factor Authentication Backup Codes',
      'Generated on: ' + new Date().toLocaleString(),
      '',
      'Keep these codes in a safe place. Each code can only be used once.',
      '',
      ...setupData.backupCodes.map((code, index) => `${index + 1}. ${code}`),
      '',
      'If you lose access to your authenticator app, you can use these',
      'codes to regain access to your account.',
    ].join('\n');

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'threat-modeling-backup-codes.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    setBackupCodesSaved(true);
  };

  const handleCopyBackupCodes = async () => {
    if (!setupData?.backupCodes) return;

    const text = setupData.backupCodes.join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setBackupCodesSaved(true);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setBackupCodesSaved(true);
    }
  };

  const handleComplete = () => {
    if (backupCodesSaved) {
      onComplete();
    }
  };

  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <Box textAlign="center" py={3}>
            <Smartphone sx={{ fontSize: 80, color: 'primary.main', mb: 3 }} />
            <Typography variant="h6" gutterBottom>
              Download an Authenticator App
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              You'll need an authenticator app to generate verification codes.
            </Typography>
            
            <Grid container spacing={2} justifyContent="center">
              <Grid item xs={12} sm={6}>
                <Paper sx={{ p: 2, textAlign: 'center' }}>
                  <Typography variant="subtitle1" gutterBottom>
                    Recommended Apps
                  </Typography>
                  <List dense>
                    <ListItem>
                      <ListItemIcon>
                        <CheckCircle color="success" />
                      </ListItemIcon>
                      <ListItemText primary="Google Authenticator" />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        <CheckCircle color="success" />
                      </ListItemIcon>
                      <ListItemText primary="Microsoft Authenticator" />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        <CheckCircle color="success" />
                      </ListItemIcon>
                      <ListItemText primary="Authy" />
                    </ListItem>
                  </List>
                </Paper>
              </Grid>
            </Grid>
          </Box>
        );

      case 1:
        return (
          <Box textAlign="center" py={3}>
            <QrCode sx={{ fontSize: 80, color: 'primary.main', mb: 3 }} />
            <Typography variant="h6" gutterBottom>
              Scan QR Code
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              Open your authenticator app and scan the QR code below.
            </Typography>
            
            {setupData?.qrCodeUrl && (
              <Box>
                <Paper sx={{ p: 3, display: 'inline-block', mb: 3 }}>
                  <img 
                    src={setupData.qrCodeUrl} 
                    alt="MFA QR Code"
                    style={{ display: 'block', maxWidth: '200px', height: 'auto' }}
                  />
                </Paper>
                
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Can't scan the code? Enter this key manually:
                </Typography>
                
                <Box display="flex" alignItems="center" justifyContent="center" gap={1}>
                  <Chip 
                    label={setupData.secret} 
                    variant="outlined"
                    sx={{ fontFamily: 'monospace' }}
                  />
                  <IconButton 
                    onClick={() => navigator.clipboard.writeText(setupData.secret)}
                    size="small"
                  >
                    <ContentCopy />
                  </IconButton>
                </Box>
              </Box>
            )}
          </Box>
        );

      case 2:
        return (
          <Box textAlign="center" py={3}>
            <VerifiedUser sx={{ fontSize: 80, color: 'primary.main', mb: 3 }} />
            <Typography variant="h6" gutterBottom>
              Verify Setup
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              Enter the 6-digit code from your authenticator app to complete setup.
            </Typography>
            
            {error && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {error}
              </Alert>
            )}
            
            <TextField
              fullWidth
              label="Verification Code"
              value={verificationToken}
              onChange={(e) => setVerificationToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
              error={!!verificationToken && !tokenValidation.isValid}
              helperText={
                verificationToken && !tokenValidation.isValid 
                  ? tokenValidation.errors[0]
                  : 'Enter the 6-digit code from your app'
              }
              inputProps={{
                style: { textAlign: 'center', fontSize: '1.5rem', letterSpacing: '0.5rem' },
                maxLength: 6,
              }}
              sx={{ maxWidth: 300, mb: 2 }}
            />
          </Box>
        );

      case 3:
        return (
          <Box py={3}>
            <Box textAlign="center" mb={3}>
              <Security sx={{ fontSize: 80, color: 'success.main', mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                Save Your Backup Codes
              </Typography>
              <Typography variant="body1" color="text.secondary">
                These codes will allow you to access your account if you lose your device.
                Each code can only be used once.
              </Typography>
            </Box>
            
            <Alert severity="warning" sx={{ mb: 3 }}>
              <Typography variant="body2">
                <strong>Important:</strong> Store these codes in a safe place. 
                You won't be able to see them again after this setup.
              </Typography>
            </Alert>
            
            <Paper sx={{ p: 3, mb: 3, bgcolor: 'grey.50' }}>
              <Grid container spacing={1}>
                {setupData?.backupCodes.map((code, index) => (
                  <Grid item xs={6} key={index}>
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        fontFamily: 'monospace',
                        p: 1,
                        bgcolor: 'white',
                        borderRadius: 1,
                        textAlign: 'center'
                      }}
                    >
                      {code}
                    </Typography>
                  </Grid>
                ))}
              </Grid>
            </Paper>
            
            <Box display="flex" gap={2} justifyContent="center">
              <Button
                variant="outlined"
                startIcon={<Download />}
                onClick={handleDownloadBackupCodes}
              >
                Download Codes
              </Button>
              <Button
                variant="outlined"
                startIcon={<ContentCopy />}
                onClick={handleCopyBackupCodes}
              >
                Copy to Clipboard
              </Button>
            </Box>
            
            {backupCodesSaved && (
              <Alert severity="success" sx={{ mt: 2 }}>
                Backup codes saved! You can now complete the MFA setup.
              </Alert>
            )}
          </Box>
        );

      default:
        return null;
    }
  };

  return (
    <Card sx={{ maxWidth: 600, mx: 'auto' }}>
      <CardContent sx={{ p: 4 }}>
        <Typography variant="h5" align="center" gutterBottom>
          Set Up Two-Factor Authentication
        </Typography>
        
        <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 4 }}>
          Add an extra layer of security to your account
        </Typography>
        
        <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
        
        {renderStepContent()}
        
        <Divider sx={{ my: 3 }} />
        
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Button
            onClick={onCancel}
            disabled={isLoading}
          >
            Cancel
          </Button>
          
          <Box display="flex" gap={1}>
            {activeStep > 0 && (
              <Button
                onClick={handleBack}
                disabled={isLoading}
              >
                Back
              </Button>
            )}
            
            {activeStep < steps.length - 1 ? (
              <Button
                variant="contained"
                onClick={handleNext}
                disabled={
                  isLoading || 
                  (activeStep === 2 && !tokenValidation.isValid)
                }
              >
                {activeStep === 2 ? 'Verify' : 'Next'}
              </Button>
            ) : (
              <Button
                variant="contained"
                onClick={handleComplete}
                disabled={!backupCodesSaved}
                color="success"
              >
                Complete Setup
              </Button>
            )}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};