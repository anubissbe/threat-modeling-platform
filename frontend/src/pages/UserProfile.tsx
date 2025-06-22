import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Alert,
  Grid,
  Avatar,
  IconButton,
  Divider,
  Switch,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Chip,
  InputAdornment,
  Collapse,
  ListItemIcon,
} from '@mui/material';
import {
  Person,
  Email,
  Business,
  Edit,
  Save,
  Cancel,
  Visibility,
  VisibilityOff,
  Shield,
  Check,
  Clear,
} from '@mui/icons-material';
import { validateName, validatePassword, validateConfirmPassword } from '../utils/validation';
import { MFASetup } from '../components/MFA';

interface UserData {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  organization?: string;
  role: string;
  mfaEnabled: boolean;
  createdAt: string;
  lastLogin: string;
}

interface PasswordChangeData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export const UserProfile: React.FC = () => {

  const [userData, setUserData] = useState<UserData | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    firstName: '',
    lastName: '',
    organization: '',
  });
  const [passwordData, setPasswordData] = useState<PasswordChangeData>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [showPasswordRequirements, setShowPasswordRequirements] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showMFASetup, setShowMFASetup] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      const response = await fetch('/api/users/me', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUserData(data);
        setEditData({
          firstName: data.firstName,
          lastName: data.lastName,
          organization: data.organization || '',
        });
      }
    } catch (error) {
      console.error('Failed to fetch user data:', error);
    }
  };

  const handleEditToggle = () => {
    if (isEditing) {
      // Cancel editing - reset data
      setEditData({
        firstName: userData?.firstName || '',
        lastName: userData?.lastName || '',
        organization: userData?.organization || '',
      });
      setErrors({});
    }
    setIsEditing(!isEditing);
  };

  const validateProfileForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    const firstNameValidation = validateName(editData.firstName);
    if (!firstNameValidation.isValid) {
      newErrors.firstName = firstNameValidation.errors[0];
    }

    const lastNameValidation = validateName(editData.lastName);
    if (!lastNameValidation.isValid) {
      newErrors.lastName = lastNameValidation.errors[0];
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSaveProfile = async () => {
    if (!validateProfileForm()) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/users/me', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(editData),
      });

      if (response.ok) {
        const updatedData = await response.json();
        setUserData(updatedData);
        setIsEditing(false);
        setSuccessMessage('Profile updated successfully');
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        const errorData = await response.json();
        setErrors({ general: errorData.message || 'Failed to update profile' });
      }
    } catch {
      setErrors({ general: 'Network error. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  const passwordValidation = validatePassword(passwordData.newPassword);
  const confirmPasswordValidation = validateConfirmPassword(
    passwordData.newPassword,
    passwordData.confirmPassword
  );

  const passwordRequirements = [
    { label: 'At least 8 characters', met: passwordData.newPassword.length >= 8 },
    { label: 'One uppercase letter', met: /[A-Z]/.test(passwordData.newPassword) },
    { label: 'One lowercase letter', met: /[a-z]/.test(passwordData.newPassword) },
    { label: 'One number', met: /\d/.test(passwordData.newPassword) },
    { label: 'One special character', met: /[!@#$%^&*(),.?":{}|<>]/.test(passwordData.newPassword) },
  ];

  const handlePasswordChange = async () => {
    if (!passwordData.currentPassword || !passwordValidation.isValid || !confirmPasswordValidation.isValid) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/users/me/password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword,
        }),
      });

      if (response.ok) {
        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
        setShowPasswordDialog(false);
        setSuccessMessage('Password changed successfully');
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        const errorData = await response.json();
        setErrors({ password: errorData.message || 'Failed to change password' });
      }
    } catch {
      setErrors({ password: 'Network error. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleMFAToggle = async () => {
    if (userData?.mfaEnabled) {
      // Disable MFA
      try {
        const response = await fetch('/api/users/me/mfa', {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
        });

        if (response.ok) {
          setUserData(prev => prev ? { ...prev, mfaEnabled: false } : null);
          setSuccessMessage('Two-factor authentication disabled');
          setTimeout(() => setSuccessMessage(''), 3000);
        }
      } catch {
        setErrors({ mfa: 'Failed to disable MFA' });
      }
    } else {
      // Enable MFA
      setShowMFASetup(true);
    }
  };

  const handleMFASetupComplete = () => {
    setShowMFASetup(false);
    setUserData(prev => prev ? { ...prev, mfaEnabled: true } : null);
    setSuccessMessage('Two-factor authentication enabled successfully');
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  if (!userData) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <Typography>Loading profile...</Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        User Profile
      </Typography>

      {successMessage && (
        <Alert severity="success" sx={{ mb: 3 }}>
          {successMessage}
        </Alert>
      )}

      {errors.general && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {errors.general}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Profile Information */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between" mb={3}>
                <Typography variant="h6">
                  Profile Information
                </Typography>
                <IconButton onClick={handleEditToggle}>
                  {isEditing ? <Cancel /> : <Edit />}
                </IconButton>
              </Box>

              <Box display="flex" alignItems="center" mb={3}>
                <Avatar sx={{ width: 80, height: 80, mr: 2 }}>
                  <Person sx={{ fontSize: 40 }} />
                </Avatar>
                <Box>
                  <Typography variant="h6">
                    {userData.firstName} {userData.lastName}
                  </Typography>
                  <Chip 
                    label={userData.role} 
                    size="small" 
                    color="primary" 
                    variant="outlined" 
                  />
                </Box>
              </Box>

              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="First Name"
                    value={editData.firstName}
                    onChange={(e) => setEditData(prev => ({ ...prev, firstName: e.target.value }))}
                    disabled={!isEditing}
                    error={!!errors.firstName}
                    helperText={errors.firstName}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Person color="action" />
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="Last Name"
                    value={editData.lastName}
                    onChange={(e) => setEditData(prev => ({ ...prev, lastName: e.target.value }))}
                    disabled={!isEditing}
                    error={!!errors.lastName}
                    helperText={errors.lastName}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Email"
                    value={userData.email}
                    disabled
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Email color="action" />
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Organization"
                    value={editData.organization}
                    onChange={(e) => setEditData(prev => ({ ...prev, organization: e.target.value }))}
                    disabled={!isEditing}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Business color="action" />
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>
              </Grid>

              {isEditing && (
                <Box mt={2} display="flex" gap={2}>
                  <Button
                    variant="contained"
                    startIcon={<Save />}
                    onClick={handleSaveProfile}
                    disabled={isLoading}
                  >
                    Save Changes
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<Cancel />}
                    onClick={handleEditToggle}
                    disabled={isLoading}
                  >
                    Cancel
                  </Button>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Security Settings */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Security Settings
              </Typography>

              <List>
                <ListItem>
                  <ListItemText
                    primary="Password"
                    secondary="Last changed: Recently"
                  />
                  <ListItemSecondaryAction>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => setShowPasswordDialog(true)}
                    >
                      Change
                    </Button>
                  </ListItemSecondaryAction>
                </ListItem>

                <Divider />

                <ListItem>
                  <ListItemIcon>
                    <Shield color={userData.mfaEnabled ? 'success' : 'action'} />
                  </ListItemIcon>
                  <ListItemText
                    primary="Two-Factor Authentication"
                    secondary={
                      userData.mfaEnabled 
                        ? "Enabled - Your account is protected with 2FA"
                        : "Disabled - Enable 2FA for additional security"
                    }
                  />
                  <ListItemSecondaryAction>
                    <Switch
                      checked={userData.mfaEnabled}
                      onChange={handleMFAToggle}
                      color="primary"
                    />
                  </ListItemSecondaryAction>
                </ListItem>
              </List>

              <Divider sx={{ my: 2 }} />

              <Typography variant="body2" color="text.secondary" gutterBottom>
                Account Information
              </Typography>
              <Typography variant="body2">
                <strong>Member since:</strong> {new Date(userData.createdAt).toLocaleDateString()}
              </Typography>
              <Typography variant="body2">
                <strong>Last login:</strong> {new Date(userData.lastLogin).toLocaleDateString()}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Password Change Dialog */}
      <Dialog open={showPasswordDialog} onClose={() => setShowPasswordDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Change Password</DialogTitle>
        <DialogContent>
          {errors.password && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {errors.password}
            </Alert>
          )}

          <TextField
            fullWidth
            margin="normal"
            label="Current Password"
            type={showPasswords.current ? 'text' : 'password'}
            value={passwordData.currentPassword}
            onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={() => setShowPasswords(prev => ({ ...prev, current: !prev.current }))}
                    edge="end"
                  >
                    {showPasswords.current ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          <TextField
            fullWidth
            margin="normal"
            label="New Password"
            type={showPasswords.new ? 'text' : 'password'}
            value={passwordData.newPassword}
            onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
            onFocus={() => setShowPasswordRequirements(true)}
            error={!!passwordData.newPassword && !passwordValidation.isValid}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={() => setShowPasswords(prev => ({ ...prev, new: !prev.new }))}
                    edge="end"
                  >
                    {showPasswords.new ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          <Collapse in={showPasswordRequirements && passwordData.newPassword.length > 0}>
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
            fullWidth
            margin="normal"
            label="Confirm New Password"
            type={showPasswords.confirm ? 'text' : 'password'}
            value={passwordData.confirmPassword}
            onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
            error={!!passwordData.confirmPassword && !confirmPasswordValidation.isValid}
            helperText={
              passwordData.confirmPassword && !confirmPasswordValidation.isValid
                ? confirmPasswordValidation.errors[0]
                : undefined
            }
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={() => setShowPasswords(prev => ({ ...prev, confirm: !prev.confirm }))}
                    edge="end"
                  >
                    {showPasswords.confirm ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowPasswordDialog(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handlePasswordChange}
            variant="contained"
            disabled={
              isLoading ||
              !passwordData.currentPassword ||
              !passwordValidation.isValid ||
              !confirmPasswordValidation.isValid
            }
          >
            Change Password
          </Button>
        </DialogActions>
      </Dialog>

      {/* MFA Setup Dialog */}
      <Dialog open={showMFASetup} onClose={() => setShowMFASetup(false)} maxWidth="md" fullWidth>
        <MFASetup
          onComplete={handleMFASetupComplete}
          onCancel={() => setShowMFASetup(false)}
        />
      </Dialog>
    </Box>
  );
};