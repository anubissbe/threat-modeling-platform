import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Alert,
  Divider,
  CircularProgress,
} from '@mui/material';
import {
  Security,
  Refresh,
  ArrowBack,
} from '@mui/icons-material';
import { validateMfaToken } from '../../utils/validation';

interface MFAVerificationProps {
  email: string;
  onSuccess: () => void;
  onBack: () => void;
  onUseBackupCode: () => void;
}

export const MFAVerification: React.FC<MFAVerificationProps> = ({
  email,
  onSuccess,
  onBack,
  onUseBackupCode,
}) => {
  const [token, setToken] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [attemptCount, setAttemptCount] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);

  const tokenValidation = validateMfaToken(token);
  const maxAttempts = 5;
  const lockoutDuration = 300; // 5 minutes in seconds

  useEffect(() => {
    let interval: number;
    if (timeRemaining > 0) {
      interval = window.setInterval(() => {
        setTimeRemaining(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timeRemaining]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!tokenValidation.isValid || timeRemaining > 0) {
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/mfa/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          token,
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
          setTimeRemaining(lockoutDuration);
          setError(`Too many failed attempts. Please wait ${Math.ceil(lockoutDuration / 60)} minutes before trying again.`);
        } else {
          setError(errorData.message || 'Invalid verification code');
        }
        setToken('');
      }
    } catch {
      setError('Network error. Please try again.');
      setAttemptCount(prev => prev + 1);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendNotification = async () => {
    // This would typically send a push notification or SMS if supported
    setError('');
    try {
      await fetch('/api/auth/mfa/resend-notification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });
    } catch {
      // Silent fail for now
    }
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const isLocked = timeRemaining > 0;

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
            color: 'primary.main', 
            mb: 2 
          }} 
        />
        <Typography component="h1" variant="h4" gutterBottom>
          Two-Factor Authentication
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Enter the verification code from your authenticator app
        </Typography>
      </Box>
      
      <Card sx={{ width: '100%', maxWidth: 400, boxShadow: 3 }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h6" align="center" gutterBottom>
            Verification Required
          </Typography>
          
          <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 3 }}>
            We sent a verification request to the authenticator app registered to{' '}
            <strong>{email}</strong>
          </Typography>
          
          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}
          
          {isLocked && (
            <Alert severity="warning" sx={{ mb: 3 }}>
              Account temporarily locked due to multiple failed attempts.
              Time remaining: <strong>{formatTime(timeRemaining)}</strong>
            </Alert>
          )}
          
          <Box component="form" onSubmit={handleSubmit} noValidate>
            <TextField
              fullWidth
              label="Verification Code"
              value={token}
              onChange={(e) => {
                setToken(e.target.value.replace(/\D/g, '').slice(0, 6));
                setError('');
              }}
              error={!!token && !tokenValidation.isValid}
              helperText={
                token && !tokenValidation.isValid 
                  ? tokenValidation.errors[0]
                  : `Enter the 6-digit code from your authenticator app`
              }
              disabled={isLoading || isLocked}
              inputProps={{
                style: { 
                  textAlign: 'center', 
                  fontSize: '1.5rem', 
                  letterSpacing: '0.5rem' 
                },
                maxLength: 6,
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
                !tokenValidation.isValid || 
                isLocked
              }
              startIcon={isLoading ? <CircularProgress size={20} color="inherit" /> : null}
            >
              {isLoading ? 'Verifying...' : 'Verify Code'}
            </Button>
            
            <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 2 }}>
              Attempts remaining: <strong>{maxAttempts - attemptCount}</strong>
            </Typography>
            
            <Divider sx={{ my: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Having trouble?
              </Typography>
            </Divider>
            
            <Box display="flex" flexDirection="column" gap={1}>
              <Button
                variant="text"
                size="small"
                startIcon={<Refresh />}
                onClick={handleResendNotification}
                disabled={isLoading || isLocked}
              >
                Resend notification
              </Button>
              
              <Button
                variant="text"
                size="small"
                onClick={onUseBackupCode}
                disabled={isLoading || isLocked}
              >
                Use backup code instead
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