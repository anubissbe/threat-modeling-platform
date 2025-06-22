import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Link,
  Container,
  IconButton,
  InputAdornment,
  Divider,
  CircularProgress,
  Checkbox,
  FormControlLabel,
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
  Email,
  Lock,
  Person,
  Business,
  Check,
  Clear,
} from '@mui/icons-material';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { validateEmail, validatePassword, validateName, validateConfirmPassword } from '../utils/validation';

interface FormData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  organization?: string;
  acceptTerms: boolean;
  acceptPrivacy: boolean;
}

interface FormErrors {
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  organization?: string;
  acceptTerms?: string;
  acceptPrivacy?: string;
}

export const Register: React.FC = () => {
  const [formData, setFormData] = useState<FormData>({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    organization: '',
    acceptTerms: false,
    acceptPrivacy: false,
  });
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [showPasswordRequirements, setShowPasswordRequirements] = useState(false);
  
  const navigate = useNavigate();

  // Real-time password strength validation
  const passwordValidation = validatePassword(formData.password);
  const passwordRequirements = [
    { label: 'At least 8 characters', met: formData.password.length >= 8 },
    { label: 'One uppercase letter', met: /[A-Z]/.test(formData.password) },
    { label: 'One lowercase letter', met: /[a-z]/.test(formData.password) },
    { label: 'One number', met: /\d/.test(formData.password) },
    { label: 'One special character', met: /[!@#$%^&*(),.?":{}|<>]/.test(formData.password) },
  ];

  const handleInputChange = (field: keyof FormData) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = field === 'acceptTerms' || field === 'acceptPrivacy' 
      ? e.target.checked 
      : e.target.value;
      
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleBlur = (field: string) => () => {
    setTouched(prev => ({ ...prev, [field]: true }));
    validateField(field);
  };

  const validateField = (field: string) => {
    const newErrors = { ...errors };
    
    switch (field) {
      case 'firstName': {
        const firstNameValidation = validateName(formData.firstName);
        if (!firstNameValidation.isValid) {
          newErrors.firstName = firstNameValidation.errors[0];
        } else {
          delete newErrors.firstName;
        }
        break;
      }
        
      case 'lastName': {
        const lastNameValidation = validateName(formData.lastName);
        if (!lastNameValidation.isValid) {
          newErrors.lastName = lastNameValidation.errors[0];
        } else {
          delete newErrors.lastName;
        }
        break;
      }
        
      case 'email': {
        const emailValidation = validateEmail(formData.email);
        if (!emailValidation.isValid) {
          newErrors.email = emailValidation.errors[0];
        } else {
          delete newErrors.email;
        }
        break;
      }
        
      case 'password': {
        if (!passwordValidation.isValid) {
          newErrors.password = passwordValidation.errors[0];
        } else {
          delete newErrors.password;
        }
        break;
      }
        
      case 'confirmPassword': {
        const confirmPasswordValidation = validateConfirmPassword(
          formData.password, 
          formData.confirmPassword
        );
        if (!confirmPasswordValidation.isValid) {
          newErrors.confirmPassword = confirmPasswordValidation.errors[0];
        } else {
          delete newErrors.confirmPassword;
        }
        break;
      }
        
      case 'acceptTerms':
        if (!formData.acceptTerms) {
          newErrors.acceptTerms = 'You must accept the terms of service';
        } else {
          delete newErrors.acceptTerms;
        }
        break;
        
      case 'acceptPrivacy':
        if (!formData.acceptPrivacy) {
          newErrors.acceptPrivacy = 'You must accept the privacy policy';
        } else {
          delete newErrors.acceptPrivacy;
        }
        break;
    }
    
    setErrors(newErrors);
  };

  const validateForm = (): boolean => {
    const fields = ['firstName', 'lastName', 'email', 'password', 'confirmPassword', 'acceptTerms', 'acceptPrivacy'];
    fields.forEach(field => validateField(field));
    
    const touchedFields = fields.reduce((acc, field) => ({ ...acc, [field]: true }), {});
    setTouched(touchedFields);
    
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setIsLoading(true);
    
    try {
      // TODO: Implement registration API call
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          password: formData.password,
          organization: formData.organization,
        }),
      });
      
      if (response.ok) {
        navigate('/login', { 
          state: { 
            message: 'Registration successful! Please check your email to verify your account.' 
          } 
        });
      } else {
        const errorData = await response.json();
        setErrors({ email: errorData.message || 'Registration failed' });
      }
    } catch {
      setErrors({ email: 'Network error. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          marginTop: 4,
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
            Join Our Platform
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Start securing your applications today
          </Typography>
        </Box>
        
        <Card sx={{ width: '100%', maxWidth: 500, boxShadow: 3 }}>
          <CardContent sx={{ p: 4 }}>
            <Typography component="h2" variant="h5" align="center" gutterBottom>
              Create Account
            </Typography>
            
            <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 3 }}>
              Fill in your details to get started
            </Typography>
            
            <Box component="form" onSubmit={handleSubmit} noValidate>
              <Box display="flex" gap={2}>
                <TextField
                  margin="normal"
                  required
                  fullWidth
                  id="firstName"
                  label="First Name"
                  name="firstName"
                  autoComplete="given-name"
                  autoFocus
                  value={formData.firstName}
                  onChange={handleInputChange('firstName')}
                  onBlur={handleBlur('firstName')}
                  error={touched.firstName && !!errors.firstName}
                  helperText={touched.firstName && errors.firstName}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Person color="action" />
                      </InputAdornment>
                    ),
                  }}
                />
                
                <TextField
                  margin="normal"
                  required
                  fullWidth
                  id="lastName"
                  label="Last Name"
                  name="lastName"
                  autoComplete="family-name"
                  value={formData.lastName}
                  onChange={handleInputChange('lastName')}
                  onBlur={handleBlur('lastName')}
                  error={touched.lastName && !!errors.lastName}
                  helperText={touched.lastName && errors.lastName}
                />
              </Box>
              
              <TextField
                margin="normal"
                required
                fullWidth
                id="email"
                label="Email Address"
                name="email"
                autoComplete="email"
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
                fullWidth
                id="organization"
                label="Organization (Optional)"
                name="organization"
                autoComplete="organization"
                value={formData.organization}
                onChange={handleInputChange('organization')}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Business color="action" />
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
                autoComplete="new-password"
                value={formData.password}
                onChange={handleInputChange('password')}
                onBlur={handleBlur('password')}
                onFocus={() => setShowPasswordRequirements(true)}
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
                label="Confirm Password"
                type={showConfirmPassword ? 'text' : 'password'}
                id="confirmPassword"
                autoComplete="new-password"
                value={formData.confirmPassword}
                onChange={handleInputChange('confirmPassword')}
                onBlur={handleBlur('confirmPassword')}
                error={touched.confirmPassword && !!errors.confirmPassword}
                helperText={touched.confirmPassword && errors.confirmPassword}
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
              
              <Box sx={{ mt: 2 }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={formData.acceptTerms}
                      onChange={handleInputChange('acceptTerms')}
                      color="primary"
                    />
                  }
                  label={
                    <Typography variant="body2">
                      I accept the{' '}
                      <Link component={RouterLink} to="/terms" target="_blank">
                        Terms of Service
                      </Link>
                    </Typography>
                  }
                />
                {touched.acceptTerms && errors.acceptTerms && (
                  <Typography variant="body2" color="error" sx={{ ml: 4 }}>
                    {errors.acceptTerms}
                  </Typography>
                )}
                
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={formData.acceptPrivacy}
                      onChange={handleInputChange('acceptPrivacy')}
                      color="primary"
                    />
                  }
                  label={
                    <Typography variant="body2">
                      I accept the{' '}
                      <Link component={RouterLink} to="/privacy" target="_blank">
                        Privacy Policy
                      </Link>
                    </Typography>
                  }
                />
                {touched.acceptPrivacy && errors.acceptPrivacy && (
                  <Typography variant="body2" color="error" sx={{ ml: 4 }}>
                    {errors.acceptPrivacy}
                  </Typography>
                )}
              </Box>
              
              <Button
                type="submit"
                fullWidth
                variant="contained"
                size="large"
                sx={{ mt: 3, mb: 2, height: 48 }}
                disabled={isLoading || Object.keys(errors).length > 0}
                startIcon={isLoading ? <CircularProgress size={20} color="inherit" /> : null}
              >
                {isLoading ? 'Creating Account...' : 'Create Account'}
              </Button>
              
              <Divider sx={{ my: 3 }}>
                <Typography variant="body2" color="text.secondary">
                  Already have an account?
                </Typography>
              </Divider>
              
              <Box textAlign="center">
                <Link 
                  component={RouterLink} 
                  to="/login" 
                  variant="body2"
                  sx={{ textDecoration: 'none' }}
                >
                  Sign in to your account
                </Link>
              </Box>
            </Box>
          </CardContent>
        </Card>
        
        <Typography 
          variant="body2" 
          color="text.secondary" 
          align="center" 
          sx={{ mt: 4, mb: 4 }}
        >
          © 2025 Threat Modeling Platform. All rights reserved.
        </Typography>
      </Box>
    </Container>
  );
};