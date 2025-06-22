import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Alert,
  Link,
  Divider,
  CircularProgress,
} from '@mui/material';
import {
  Security,
  ArrowBack,
  Warning,
} from '@mui/icons-material';

interface BackupCodeVerificationProps {
  email: string;
  onSuccess: () => void;
  onBack: () => void;
  onBackToMFA: () => void;
}

export const BackupCodeVerification: React.FC<BackupCodeVerificationProps> = ({
  email,
  onSuccess,
  onBack,
  onBackToMFA,
}) => {
  const [backupCode, setBackupCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [attemptCount, setAttemptCount] = useState(0);

  const maxAttempts = 3;
  const isValidBackupCode = /^[a-f0-9]{8}$/i.test(backupCode);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isValidBackupCode) {
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/mfa/verify-backup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          backupCode: backupCode.toLowerCase(),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('token', data.token);
        onSuccess();
      } else {
        const errorData = await response.json();
        setAttemptCount(prev => prev + 1);
        
        if (attemptCount + 1 >= maxAttempts) {
          setError('Too many failed attempts. Please contact support for assistance.');
        } else {
          setError(errorData.message || 'Invalid backup code');
        }
        setBackupCode('');
      }
    } catch {
      setError('Network error. Please try again.');
      setAttemptCount(prev => prev + 1);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^a-f0-9]/gi, '').toLowerCase().slice(0, 8);
    setBackupCode(value);
    setError('');
  };

  return (
    <Box
      sx={{
        marginTop: 8,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        minHeight: '100vh',
      }}
    >
      <Box textAlign="center" mb={4}>
        <Security 
          sx={{ 
            fontSize: 48, 
            color: 'warning.main', 
            mb: 2 
          }} 
        />
        <Typography component="h1" variant="h4" gutterBottom>
          Backup Code Verification
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Enter one of your backup codes to access your account
        </Typography>
      </Box>
      
      <Card sx={{ width: '100%', maxWidth: 400, boxShadow: 3 }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h6" align="center" gutterBottom>
            Use Backup Code
          </Typography>
          
          <Alert severity="warning" sx={{ mb: 3 }}>
            <Typography variant="body2">
              <strong>Important:</strong> Each backup code can only be used once. 
              After using this code, make sure to generate new backup codes.
            </Typography>
          </Alert>
          
          <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 3 }}>
            Enter one of the 8-character backup codes you saved during MFA setup.
          </Typography>
          
          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}
          
          <Box component="form" onSubmit={handleSubmit} noValidate>
            <TextField
              fullWidth
              label="Backup Code"
              value={backupCode}
              onChange={handleInputChange}
              error={!!backupCode && !isValidBackupCode}
              helperText={
                backupCode && !isValidBackupCode 
                  ? 'Backup code must be 8 characters (letters and numbers)'
                  : 'Enter the 8-character backup code'
              }
              placeholder="e.g., a1b2c3d4"
              disabled={isLoading}
              inputProps={{
                style: { 
                  textAlign: 'center', 
                  fontSize: '1.2rem', 
                  letterSpacing: '0.2rem',
                  fontFamily: 'monospace'
                },
                maxLength: 8,
              }}
              sx={{ mb: 3 }}
              autoFocus
            />
            
            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              sx={{ mb: 2, height: 48 }}
              disabled={
                isLoading || 
                !isValidBackupCode ||
                attemptCount >= maxAttempts
              }
              startIcon={isLoading ? <CircularProgress size={20} color="inherit" /> : null}
            >
              {isLoading ? 'Verifying...' : 'Verify Backup Code'}
            </Button>
            
            <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 2 }}>
              Attempts remaining: <strong>{maxAttempts - attemptCount}</strong>
            </Typography>
            
            <Divider sx={{ my: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Other options
              </Typography>
            </Divider>
            
            <Box display="flex" flexDirection="column" gap={1}>
              <Button
                variant="text"
                size="small"
                onClick={onBackToMFA}
                disabled={isLoading}
              >
                Use authenticator app instead
              </Button>
              
              <Button
                variant="text"
                size="small"
                startIcon={<ArrowBack />}
                onClick={onBack}
                disabled={isLoading}
              >
                Back to sign in
              </Button>
            </Box>
          </Box>
          
          <Box sx={{ mt: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
            <Box display="flex" alignItems="flex-start" gap={1}>
              <Warning color="warning" fontSize="small" sx={{ mt: 0.5 }} />
              <Box>
                <Typography variant="body2" color="text.secondary">
                  <strong>Lost your backup codes?</strong>
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Contact your administrator or support team for assistance recovering your account.
                </Typography>
                <Link href="mailto:support@threatmodeling.com" variant="body2">
                  support@threatmodeling.com
                </Link>
              </Box>
            </Box>
          </Box>
        </CardContent>
      </Card>
      
      <Typography 
        variant="body2" 
        color="text.secondary" 
        align="center" 
        sx={{ mt: 4 }}
      >
        © 2025 Threat Modeling Platform. All rights reserved.
      </Typography>
    </Box>
  );
};