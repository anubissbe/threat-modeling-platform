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
  Divider,
  CircularProgress,
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  Security,
  Email,
  Lock,
} from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '../store';
import { login, clearError } from '../features/auth/authSlice';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { validateEmail } from '../utils/validation';

interface FormErrors {
  email?: string;
  password?: string;
  general?: string;
}

export const Login: React.FC = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { isLoading, error } = useAppSelector((state) => state.auth);

  // Clear errors when user starts typing
  useEffect(() => {
    if (Object.keys(errors).length > 0) {
      const newErrors = { ...errors };
      
      if (touched.email && formData.email) {
        const emailValidation = validateEmail(formData.email);
        if (emailValidation.isValid) {
          delete newErrors.email;
        }
      }
      
      if (touched.password && formData.password) {
        delete newErrors.password;
      }
      
      setErrors(newErrors);
    }
  }, [formData.email, formData.password, errors, touched.email, touched.password]);

  const handleInputChange = (field: keyof typeof formData) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setFormData(prev => ({
      ...prev,
      [field]: e.target.value
    }));
    
    // Clear global error when user starts typing
    if (error) {
      dispatch(clearError());
    }
  };

  const handleBlur = (field: string) => () => {
    setTouched(prev => ({ ...prev, [field]: true }));
    
    const newErrors = { ...errors };
    
    if (field === 'email') {
      const emailValidation = validateEmail(formData.email);
      if (!emailValidation.isValid) {
        newErrors.email = emailValidation.errors[0];
      } else {
        delete newErrors.email;
      }
    }
    
    if (field === 'password') {
      if (!formData.password) {
        newErrors.password = 'Password is required';
      } else {
        delete newErrors.password;
      }
    }
    
    setErrors(newErrors);
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};
    
    const emailValidation = validateEmail(formData.email);
    if (!emailValidation.isValid) {
      newErrors.email = emailValidation.errors[0];
    }
    
    if (!formData.password) {
      newErrors.password = 'Password is required';
    }
    
    setErrors(newErrors);
    setTouched({ email: true, password: true });
    
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    dispatch(clearError());
    
    if (!validateForm()) {
      return;
    }
    
    try {
      await dispatch(login({ 
        email: formData.email, 
        password: formData.password 
      })).unwrap();
      navigate('/dashboard');
    } catch (err) {
      // Error is handled by the slice
      console.error('Login failed:', err);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(prev => !prev);
  };

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
            Threat Modeling Platform
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Secure your applications with enterprise-grade threat modeling
          </Typography>
        </Box>
        
        <Card sx={{ width: '100%', maxWidth: 450, boxShadow: 3 }}>
          <CardContent sx={{ p: 4 }}>
            <Typography component="h2" variant="h5" align="center" gutterBottom>
              Sign In
            </Typography>
            
            <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 3 }}>
              Access your threat modeling workspace
            </Typography>
            
            {error && (
              <Alert 
                severity="error" 
                sx={{ mb: 3 }}
                onClose={() => dispatch(clearError())}
              >
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
                value={formData.email}
                onChange={handleInputChange('email')}
                onBlur={handleBlur('email')}
                error={touched.email && !!errors.email}
                helperText={touched.email && errors.email}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Email color="action" />
                    </InputAdornment>
                  ),
                }}
              />
              
              <TextField
                margin="normal"
                required
                fullWidth
                name="password"
                label="Password"
                type={showPassword ? 'text' : 'password'}
                id="password"
                autoComplete="current-password"
                value={formData.password}
                onChange={handleInputChange('password')}
                onBlur={handleBlur('password')}
                error={touched.password && !!errors.password}
                helperText={touched.password && errors.password}
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
                        onClick={togglePasswordVisibility}
                        edge="end"
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
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
                sx={{ mt: 3, mb: 2, height: 48 }}
                disabled={isLoading || Object.keys(errors).length > 0}
                startIcon={isLoading ? <CircularProgress size={20} color="inherit" /> : null}
              >
                {isLoading ? 'Signing In...' : 'Sign In'}
              </Button>
              
              <Divider sx={{ my: 3 }}>
                <Typography variant="body2" color="text.secondary">
                  Need help?
                </Typography>
              </Divider>
              
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Link 
                  component={RouterLink} 
                  to="/forgot-password" 
                  variant="body2"
                  sx={{ textDecoration: 'none' }}
                >
                  Forgot password?
                </Link>
                <Link 
                  component={RouterLink} 
                  to="/register" 
                  variant="body2"
                  sx={{ textDecoration: 'none' }}
                >
                  Create account
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