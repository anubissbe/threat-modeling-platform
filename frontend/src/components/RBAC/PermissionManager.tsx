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
  TextField,
  Autocomplete,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Switch,
  Divider,
} from '@mui/material';
import {
  Edit,
  Delete,
  Add,
  Security,
  Group,
  Person,
  AdminPanelSettings,
} from '@mui/icons-material';

interface Role {
  id: string;
  name: string;
  displayName: string;
  description: string;
  permissions: string[];
  userCount: number;
  isSystem: boolean;
}

interface Permission {
  id: string;
  name: string;
  resource: string;
  action: string;
  description: string;
}

interface UserRole {
  userId: string;
  userEmail: string;
  userName: string;
  roles: string[];
}

export const PermissionManager: React.FC = () => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [activeTab, setActiveTab] = useState<'roles' | 'users'>('roles');
  
  // Role management state
  const [showRoleDialog, setShowRoleDialog] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [roleForm, setRoleForm] = useState({
    name: '',
    displayName: '',
    description: '',
    permissions: [] as string[],
  });

  // User role assignment state
  const [showUserRoleDialog, setShowUserRoleDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserRole | null>(null);

  useEffect(() => {
    fetchRoles();
    fetchPermissions();
    fetchUserRoles();
  }, []);

  const fetchRoles = async () => {
    try {
      const response = await fetch('/api/admin/roles', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setRoles(data);
      }
    } catch {
      setError('Failed to fetch roles');
    }
  };

  const fetchPermissions = async () => {
    try {
      const response = await fetch('/api/admin/permissions', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setPermissions(data);
      }
    } catch {
      setError('Failed to fetch permissions');
    }
  };

  const fetchUserRoles = async () => {
    try {
      const response = await fetch('/api/admin/user-roles', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setUserRoles(data);
      }
    } catch {
      setError('Failed to fetch user roles');
    }
  };

  const handleCreateRole = () => {
    setEditingRole(null);
    setRoleForm({
      name: '',
      displayName: '',
      description: '',
      permissions: [],
    });
    setShowRoleDialog(true);
  };

  const handleEditRole = (role: Role) => {
    setEditingRole(role);
    setRoleForm({
      name: role.name,
      displayName: role.displayName,
      description: role.description,
      permissions: role.permissions,
    });
    setShowRoleDialog(true);
  };

  const handleSaveRole = async () => {
    setIsLoading(true);
    try {
      const url = editingRole ? `/api/admin/roles/${editingRole.id}` : '/api/admin/roles';
      const method = editingRole ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(roleForm),
      });

      if (response.ok) {
        await fetchRoles();
        setShowRoleDialog(false);
        setSuccessMessage(editingRole ? 'Role updated successfully' : 'Role created successfully');
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        setError('Failed to save role');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    if (!confirm('Are you sure you want to delete this role? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/roles/${roleId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        await fetchRoles();
        setSuccessMessage('Role deleted successfully');
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        setError('Failed to delete role');
      }
    } catch {
      setError('Network error. Please try again.');
    }
  };

  const handleUserRoleUpdate = async (userId: string, roles: string[]) => {
    try {
      const response = await fetch(`/api/admin/user-roles/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ roles }),
      });

      if (response.ok) {
        await fetchUserRoles();
        setSuccessMessage('User roles updated successfully');
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        setError('Failed to update user roles');
      }
    } catch {
      setError('Network error. Please try again.');
    }
  };

  const getPermissionsByResource = () => {
    const grouped = permissions.reduce((acc, permission) => {
      if (!acc[permission.resource]) {
        acc[permission.resource] = [];
      }
      acc[permission.resource].push(permission);
      return acc;
    }, {} as Record<string, Permission[]>);
    return grouped;
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5">
          Role & Permission Management
        </Typography>
        <Box display="flex" gap={2}>
          <Button
            variant={activeTab === 'roles' ? 'contained' : 'outlined'}
            startIcon={<Security />}
            onClick={() => setActiveTab('roles')}
          >
            Roles
          </Button>
          <Button
            variant={activeTab === 'users' ? 'contained' : 'outlined'}
            startIcon={<Group />}
            onClick={() => setActiveTab('users')}
          >
            User Roles
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

      {activeTab === 'roles' && (
        <Card>
          <CardContent>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
              <Typography variant="h6">System Roles</Typography>
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={handleCreateRole}
              >
                Create Role
              </Button>
            </Box>

            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Role</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell>Permissions</TableCell>
                    <TableCell>Users</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {roles.map((role) => (
                    <TableRow key={role.id}>
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={1}>
                          <AdminPanelSettings color="action" />
                          <Box>
                            <Typography variant="body2" fontWeight="medium">
                              {role.displayName}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {role.name}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {role.description}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {role.permissions.length} permissions
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={`${role.userCount} users`}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell align="right">
                        <IconButton
                          size="small"
                          onClick={() => handleEditRole(role)}
                        >
                          <Edit />
                        </IconButton>
                        {!role.isSystem && (
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDeleteRole(role.id)}
                          >
                            <Delete />
                          </IconButton>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {activeTab === 'users' && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              User Role Assignments
            </Typography>

            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>User</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>Assigned Roles</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {userRoles.map((userRole) => (
                    <TableRow key={userRole.userId}>
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={1}>
                          <Person color="action" />
                          <Typography variant="body2">
                            {userRole.userName}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {userRole.userEmail}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box display="flex" gap={1} flexWrap="wrap">
                          {userRole.roles.map((roleName) => (
                            <Chip
                              key={roleName}
                              label={roleName}
                              size="small"
                              variant="outlined"
                            />
                          ))}
                        </Box>
                      </TableCell>
                      <TableCell align="right">
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => {
                            setSelectedUser(userRole);
                            setShowUserRoleDialog(true);
                          }}
                        >
                          Edit Roles
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* Role Creation/Edit Dialog */}
      <Dialog open={showRoleDialog} onClose={() => setShowRoleDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingRole ? 'Edit Role' : 'Create New Role'}
        </DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={3} mt={1}>
            <TextField
              fullWidth
              label="Role Name"
              value={roleForm.name}
              onChange={(e) => setRoleForm(prev => ({ ...prev, name: e.target.value }))}
              helperText="Internal role identifier (lowercase, no spaces)"
            />
            
            <TextField
              fullWidth
              label="Display Name"
              value={roleForm.displayName}
              onChange={(e) => setRoleForm(prev => ({ ...prev, displayName: e.target.value }))}
              helperText="Human-readable role name"
            />
            
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Description"
              value={roleForm.description}
              onChange={(e) => setRoleForm(prev => ({ ...prev, description: e.target.value }))}
              helperText="Describe what this role allows users to do"
            />

            <Box>
              <Typography variant="h6" gutterBottom>
                Permissions
              </Typography>
              {Object.entries(getPermissionsByResource()).map(([resource, resourcePermissions]) => (
                <Box key={resource} mb={2}>
                  <Typography variant="subtitle2" color="primary" gutterBottom>
                    {resource.charAt(0).toUpperCase() + resource.slice(1)}
                  </Typography>
                  <List dense>
                    {resourcePermissions.map((permission) => (
                      <ListItem key={permission.id}>
                        <ListItemText
                          primary={`${permission.action} ${permission.resource}`}
                          secondary={permission.description}
                        />
                        <ListItemSecondaryAction>
                          <Switch
                            checked={roleForm.permissions.includes(permission.name)}
                            onChange={(e) => {
                              const newPermissions = e.target.checked
                                ? [...roleForm.permissions, permission.name]
                                : roleForm.permissions.filter(p => p !== permission.name);
                              setRoleForm(prev => ({ ...prev, permissions: newPermissions }));
                            }}
                          />
                        </ListItemSecondaryAction>
                      </ListItem>
                    ))}
                  </List>
                  <Divider />
                </Box>
              ))}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowRoleDialog(false)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveRole}
            disabled={isLoading || !roleForm.name || !roleForm.displayName}
          >
            {editingRole ? 'Update Role' : 'Create Role'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* User Role Assignment Dialog */}
      <Dialog open={showUserRoleDialog} onClose={() => setShowUserRoleDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Edit User Roles - {selectedUser?.userName}
        </DialogTitle>
        <DialogContent>
          {selectedUser && (
            <Box mt={1}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {selectedUser.userEmail}
              </Typography>
              
              <Autocomplete
                multiple
                options={roles.map(role => role.name)}
                value={selectedUser.roles}
                onChange={(_, newRoles) => {
                  setSelectedUser(prev => prev ? { ...prev, roles: newRoles } : null);
                }}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => (
                    <Chip
                      variant="outlined"
                      label={option}
                      {...getTagProps({ index })}
                      key={option}
                    />
                  ))
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Assigned Roles"
                    placeholder="Select roles"
                  />
                )}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowUserRoleDialog(false)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              if (selectedUser) {
                handleUserRoleUpdate(selectedUser.userId, selectedUser.roles);
                setShowUserRoleDialog(false);
              }
            }}
          >
            Update Roles
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};