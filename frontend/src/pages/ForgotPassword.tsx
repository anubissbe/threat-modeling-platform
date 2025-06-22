import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Link,
  Alert,
  Container,
  InputAdornment,
  CircularProgress,
} from '@mui/material';
import {
  Security,
  Email,
  ArrowBack,
} from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';
import { validateEmail } from '../utils/validation';

export const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [error, setError] = useState('');
  const [touched, setTouched] = useState(false);

  const emailValidation = validateEmail(email);
  const isValidEmail = emailValidation.isValid;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    
    if (!isValidEmail) {
      return;
    }
    
    setIsLoading(true);
    setError('');
    
    try {
      // TODO: Implement forgot password API call
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });
      
      if (response.ok) {
        setEmailSent(true);
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Failed to send reset email');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendEmail = async () => {
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });
      
      if (!response.ok) {
        setError('Failed to resend email');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (emailSent) {
    return (
      <Container maxWidth="sm">
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
                color: 'success.main', 
                mb: 2 
              }} 
            />
            <Typography component="h1" variant="h4" gutterBottom>
              Check Your Email
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Password reset instructions sent
            </Typography>
          </Box>
          
          <Card sx={{ width: '100%', maxWidth: 450, boxShadow: 3 }}>
            <CardContent sx={{ p: 4, textAlign: 'center' }}>
              <Email 
                sx={{ 
                  fontSize: 64, 
                  color: 'success.main', 
                  mb: 2 
                }} 
              />
              
              <Typography variant="h6" gutterBottom>
                Email Sent Successfully
              </Typography>
              
              <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                We've sent password reset instructions to{' '}
                <strong>{email}</strong>
              </Typography>
              
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Please check your email and follow the instructions to reset your password. 
                If you don't see the email, check your spam folder.
              </Typography>
              
              <Box sx={{ mb: 3 }}>
                <Button
                  onClick={handleResendEmail}
                  disabled={isLoading}
                  variant="outlined"
                  startIcon={isLoading ? <CircularProgress size={16} /> : null}
                >
                  {isLoading ? 'Sending...' : 'Resend Email'}
                </Button>
              </Box>
              
              <Typography variant="body2" color="text.secondary">
                Didn't receive the email? It may take a few minutes to arrive.
              </Typography>
              
              <Box sx={{ mt: 3, pt: 3, borderTop: 1, borderColor: 'divider' }}>
                <Link 
                  component={RouterLink} 
                  to="/login" 
                  sx={{ 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    textDecoration: 'none' 
                  }}
                >
                  <ArrowBack sx={{ mr: 1, fontSize: 20 }} />
                  Back to Sign In
                </Link>
              </Box>
            </CardContent>
          </Card>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="sm">
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
            Reset Password
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Enter your email to receive reset instructions
          </Typography>
        </Box>
        
        <Card sx={{ width: '100%', maxWidth: 450, boxShadow: 3 }}>
          <CardContent sx={{ p: 4 }}>
            <Typography component="h2" variant="h5" align="center" gutterBottom>
              Forgot Password?
            </Typography>
            
            <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 3 }}>
              Don't worry! It happens. Please enter the email address associated 
              with your account.
            </Typography>
            
            {error && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {error}
              </Alert>
            )}
            
            <Box component="form" onSubmit={handleSubmit} noValidate>
              <TextField
                margin="normal"
                required
                fullWidth
                id="email"
                label="Email Address"
                name="email"
                autoComplete="email"
                autoFocus
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError('');
                }}
                onBlur={() => setTouched(true)}
                error={touched && !isValidEmail}
                helperText={
                  touched && !isValidEmail 
                    ? emailValidation.errors[0] 
                    : "We'll send you a link to reset your password"
                }
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Email color="action" />
                    </InputAdornment>
                  ),
                }}
              />
              
              <Button
                type="submit"
                fullWidth
                variant="contained"
                size="large"
                sx={{ mt: 3, mb: 3, height: 48 }}
                disabled={isLoading || !isValidEmail}
                startIcon={isLoading ? <CircularProgress size={20} color="inherit" /> : null}
              >
                {isLoading ? 'Sending Reset Email...' : 'Send Reset Email'}
              </Button>
              
              <Box textAlign="center">
                <Link 
                  component={RouterLink} 
                  to="/login" 
                  sx={{ 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    textDecoration: 'none' 
                  }}
                >
                  <ArrowBack sx={{ mr: 1, fontSize: 20 }} />
                  Back to Sign In
                </Link>
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
    </Container>
  );
};