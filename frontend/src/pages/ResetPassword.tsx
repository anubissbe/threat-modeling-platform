import React, { useState, useEffect } from 'react';
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
  IconButton,
  InputAdornment,
  CircularProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Collapse,
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  Security,
  Lock,
  Check,
  Clear,
  ArrowBack,
} from '@mui/icons-material';
import { Link as RouterLink, useSearchParams, useNavigate } from 'react-router-dom';
import { validatePassword, validateConfirmPassword } from '../utils/validation';

export const ResetPassword: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [showPasswordRequirements, setShowPasswordRequirements] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Invalid or missing reset token. Please request a new password reset.');
    }
  }, [token]);

  const passwordValidation = validatePassword(formData.password);
  const confirmPasswordValidation = validateConfirmPassword(
    formData.password, 
    formData.confirmPassword
  );

  const passwordRequirements = [
    { label: 'At least 8 characters', met: formData.password.length >= 8 },
    { label: 'One uppercase letter', met: /[A-Z]/.test(formData.password) },
    { label: 'One lowercase letter', met: /[a-z]/.test(formData.password) },
    { label: 'One number', met: /\d/.test(formData.password) },
    { label: 'One special character', met: /[!@#$%^&*(),.?":{}|<>]/.test(formData.password) },
  ];

  const handleInputChange = (field: keyof typeof formData) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setFormData(prev => ({
      ...prev,
      [field]: e.target.value
    }));
    setError('');
  };

  const handleBlur = (field: string) => () => {
    setTouched(prev => ({ ...prev, [field]: true }));
  };

  const isFormValid = passwordValidation.isValid && confirmPasswordValidation.isValid;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ password: true, confirmPassword: true });
    
    if (!isFormValid || !token) {
      return;
    }
    
    setIsLoading(true);
    setError('');
    
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          password: formData.password,
        }),
      });
      
      if (response.ok) {
        setSuccess(true);
        setTimeout(() => {
          navigate('/login', { 
            state: { 
              message: 'Password reset successful! Please sign in with your new password.' 
            } 
          });
        }, 3000);
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Failed to reset password');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
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
              Password Reset Successful
            </Typography>
          </Box>
          
          <Card sx={{ width: '100%', maxWidth: 450, boxShadow: 3 }}>
            <CardContent sx={{ p: 4, textAlign: 'center' }}>
              <Check 
                sx={{ 
                  fontSize: 64, 
                  color: 'success.main', 
                  mb: 2 
                }} 
              />
              
              <Typography variant="h6" gutterBottom>
                Your password has been reset!
              </Typography>
              
              <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                You can now sign in with your new password.
              </Typography>
              
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Redirecting to sign in page in a few seconds...
              </Typography>
              
              <Button
                component={RouterLink}
                to="/login"
                variant="contained"
                size="large"
                sx={{ mt: 2 }}
              >
                Go to Sign In
              </Button>
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
            Set New Password
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Create a strong password for your account
          </Typography>
        </Box>
        
        <Card sx={{ width: '100%', maxWidth: 450, boxShadow: 3 }}>
          <CardContent sx={{ p: 4 }}>
            <Typography component="h2" variant="h5" align="center" gutterBottom>
              Reset Password
            </Typography>
            
            <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 3 }}>
              Please enter your new password below
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
                name="password"
                label="New Password"
                type={showPassword ? 'text' : 'password'}
                id="password"
                autoComplete="new-password"
                autoFocus
                value={formData.password}
                onChange={handleInputChange('password')}
                onBlur={handleBlur('password')}
                onFocus={() => setShowPasswordRequirements(true)}
                error={touched.password && !passwordValidation.isValid}
                helperText={
                  touched.password && !passwordValidation.isValid 
                    ? passwordValidation.errors[0] 
                    : undefined
                }
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Lock color="action" />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label="toggle password visibility"
                        onClick={() => setShowPassword(prev => !prev)}
                        edge="end"
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
              
              <Collapse in={showPasswordRequirements && formData.password.length > 0}>
                <Box sx={{ mt: 1, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Password requirements:
                  </Typography>
                  <List dense>
                    {passwordRequirements.map((req, index) => (
                      <ListItem key={index} sx={{ py: 0 }}>
                        <ListItemIcon sx={{ minWidth: 32 }}>
                          {req.met ? (
                            <Check color="success" fontSize="small" />
                          ) : (
                            <Clear color="error" fontSize="small" />
                          )}
                        </ListItemIcon>
                        <ListItemText 
                          primary={req.label}
                          sx={{ 
                            '& .MuiListItemText-primary': { 
                              fontSize: '0.875rem',
                              color: req.met ? 'success.main' : 'text.secondary'
                            }
                          }}
                        />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              </Collapse>
              
              <TextField
                margin="normal"
                required
                fullWidth
                name="confirmPassword"
                label="Confirm New Password"
                type={showConfirmPassword ? 'text' : 'password'}
                id="confirmPassword"
                autoComplete="new-password"
                value={formData.confirmPassword}
                onChange={handleInputChange('confirmPassword')}
                onBlur={handleBlur('confirmPassword')}
                error={touched.confirmPassword && !confirmPasswordValidation.isValid}
                helperText={
                  touched.confirmPassword && !confirmPasswordValidation.isValid 
                    ? confirmPasswordValidation.errors[0] 
                    : undefined
                }
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Lock color="action" />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label="toggle confirm password visibility"
                        onClick={() => setShowConfirmPassword(prev => !prev)}
                        edge="end"
                      >
                        {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
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
                disabled={isLoading || !isFormValid || !token}
                startIcon={isLoading ? <CircularProgress size={20} color="inherit" /> : null}
              >
                {isLoading ? 'Resetting Password...' : 'Reset Password'}
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