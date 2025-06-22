import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  ListItemText,
  OutlinedInput,
  Box,
  Typography,
  Chip,
  TextField,
  Autocomplete,
  Divider,
} from '@mui/material';
import { Close, FilterList } from '@mui/icons-material';

interface ProjectFiltersProps {
  open: boolean;
  onClose: () => void;
  filters: {
    status: string[];
    priority: string[];
    tags: string[];
    organization: string;
    owner: string;
    sortBy: string;
    sortOrder: 'asc' | 'desc';
  };
  onFiltersChange: (filters: ProjectFiltersProps['filters']) => void;
}

interface FilterOptions {
  statuses: Array<{ value: string; label: string; count: number }>;
  priorities: Array<{ value: string; label: string; count: number }>;
  tags: string[];
  organizations: string[];
  owners: Array<{ id: string; name: string; email: string }>;
}

const SORT_OPTIONS = [
  { value: 'name', label: 'Name' },
  { value: 'lastModified', label: 'Last Modified' },
  { value: 'createdAt', label: 'Created Date' },
  { value: 'priority', label: 'Priority' },
  { value: 'status', label: 'Status' },
  { value: 'owner', label: 'Owner' },
  { value: 'threatModels', label: 'Threat Models Count' },
];

export const ProjectFilters: React.FC<ProjectFiltersProps> = ({
  open,
  onClose,
  filters,
  onFiltersChange,
}) => {
  const [localFilters, setLocalFilters] = useState(filters);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    statuses: [],
    priorities: [],
    tags: [],
    organizations: [],
    owners: [],
  });

  useEffect(() => {
    if (open) {
      setLocalFilters(filters);
      fetchFilterOptions();
    }
  }, [open, filters]);

  const fetchFilterOptions = async () => {
    try {
      const response = await fetch('/api/projects/filter-options', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        const options = await response.json();
        setFilterOptions(options);
      }
    } catch {
      // Handle error silently for now
    }
  };

  const handleFilterChange = (field: string, value: string | string[] | 'asc' | 'desc') => {
    setLocalFilters(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleApplyFilters = () => {
    onFiltersChange(localFilters);
    onClose();
  };

  const handleResetFilters = () => {
    const resetFilters = {
      status: [],
      priority: [],
      tags: [],
      organization: '',
      owner: '',
      sortBy: 'lastModified',
      sortOrder: 'desc' as const,
    };
    setLocalFilters(resetFilters);
    onFiltersChange(resetFilters);
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (localFilters.status.length > 0) count++;
    if (localFilters.priority.length > 0) count++;
    if (localFilters.tags.length > 0) count++;
    if (localFilters.organization) count++;
    if (localFilters.owner) count++;
    return count;
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box display="flex" alignItems="center" gap={1}>
            <FilterList />
            <Typography variant="h6">Filter Projects</Typography>
            {getActiveFilterCount() > 0 && (
              <Chip
                label={`${getActiveFilterCount()} active`}
                size="small"
                color="primary"
                variant="outlined"
              />
            )}
          </Box>
          <Button onClick={onClose} color="inherit">
            <Close />
          </Button>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Box display="flex" flexDirection="column" gap={3}>
          {/* Status Filter */}
          <FormControl fullWidth>
            <InputLabel>Status</InputLabel>
            <Select
              multiple
              value={localFilters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              input={<OutlinedInput label="Status" />}
              renderValue={(selected) => (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {(selected as string[]).map((value) => (
                    <Chip key={value} label={value} size="small" />
                  ))}
                </Box>
              )}
            >
              {filterOptions.statuses.map((status) => (
                <MenuItem key={status.value} value={status.value}>
                  <Checkbox checked={localFilters.status.includes(status.value)} />
                  <ListItemText 
                    primary={
                      <Box display="flex" justifyContent="space-between" alignItems="center">
                        <span>{status.label}</span>
                        <Chip label={status.count} size="small" variant="outlined" />
                      </Box>
                    }
                  />
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Priority Filter */}
          <FormControl fullWidth>
            <InputLabel>Priority</InputLabel>
            <Select
              multiple
              value={localFilters.priority}
              onChange={(e) => handleFilterChange('priority', e.target.value)}
              input={<OutlinedInput label="Priority" />}
              renderValue={(selected) => (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {(selected as string[]).map((value) => (
                    <Chip key={value} label={value} size="small" />
                  ))}
                </Box>
              )}
            >
              {filterOptions.priorities.map((priority) => (
                <MenuItem key={priority.value} value={priority.value}>
                  <Checkbox checked={localFilters.priority.includes(priority.value)} />
                  <ListItemText 
                    primary={
                      <Box display="flex" justifyContent="space-between" alignItems="center">
                        <span>{priority.label}</span>
                        <Chip label={priority.count} size="small" variant="outlined" />
                      </Box>
                    }
                  />
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Organization Filter */}
          <FormControl fullWidth>
            <InputLabel>Organization</InputLabel>
            <Select
              value={localFilters.organization}
              onChange={(e) => handleFilterChange('organization', e.target.value)}
              label="Organization"
            >
              <MenuItem value="">All Organizations</MenuItem>
              {filterOptions.organizations.map((org) => (
                <MenuItem key={org} value={org}>
                  {org}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Owner Filter */}
          <Autocomplete
            options={filterOptions.owners}
            getOptionLabel={(option) => `${option.name} (${option.email})`}
            value={filterOptions.owners.find(owner => owner.id === localFilters.owner) || null}
            onChange={(_, newValue) => handleFilterChange('owner', newValue?.id || '')}
            renderInput={(params) => (
              <TextField {...params} label="Owner" />
            )}
          />

          {/* Tags Filter */}
          <Autocomplete
            multiple
            freeSolo
            options={filterOptions.tags}
            value={localFilters.tags}
            onChange={(_, newValue) => handleFilterChange('tags', newValue)}
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
              <TextField {...params} label="Tags" placeholder="Add tags to filter by" />
            )}
          />

          <Divider />

          {/* Sorting Options */}
          <Typography variant="subtitle2" color="primary" gutterBottom>
            Sorting
          </Typography>

          <Box display="flex" gap={2}>
            <FormControl fullWidth>
              <InputLabel>Sort By</InputLabel>
              <Select
                value={localFilters.sortBy}
                onChange={(e) => handleFilterChange('sortBy', e.target.value)}
                label="Sort By"
              >
                {SORT_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Order</InputLabel>
              <Select
                value={localFilters.sortOrder}
                onChange={(e) => handleFilterChange('sortOrder', e.target.value)}
                label="Order"
              >
                <MenuItem value="asc">Ascending</MenuItem>
                <MenuItem value="desc">Descending</MenuItem>
              </Select>
            </FormControl>
          </Box>

          {/* Quick Filter Presets */}
          <Box>
            <Typography variant="subtitle2" color="primary" gutterBottom>
              Quick Filters
            </Typography>
            <Box display="flex" flexWrap="wrap" gap={1}>
              <Chip
                label="My Projects"
                variant={localFilters.owner ? 'filled' : 'outlined'}
                onClick={() => {
                  // This would set the owner to current user ID
                  // handleFilterChange('owner', currentUserId);
                }}
                clickable
              />
              <Chip
                label="High Priority"
                variant={localFilters.priority.includes('high') ? 'filled' : 'outlined'}
                onClick={() => {
                  const newPriority = localFilters.priority.includes('high')
                    ? localFilters.priority.filter(p => p !== 'high')
                    : [...localFilters.priority, 'high'];
                  handleFilterChange('priority', newPriority);
                }}
                clickable
              />
              <Chip
                label="Active Projects"
                variant={localFilters.status.includes('active') ? 'filled' : 'outlined'}
                onClick={() => {
                  const newStatus = localFilters.status.includes('active')
                    ? localFilters.status.filter(s => s !== 'active')
                    : [...localFilters.status, 'active'];
                  handleFilterChange('status', newStatus);
                }}
                clickable
              />
              <Chip
                label="Recently Modified"
                variant={localFilters.sortBy === 'lastModified' ? 'filled' : 'outlined'}
                onClick={() => {
                  handleFilterChange('sortBy', 'lastModified');
                  handleFilterChange('sortOrder', 'desc');
                }}
                clickable
              />
            </Box>
          </Box>
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleResetFilters} color="inherit">
          Reset All
        </Button>
        <Button onClick={onClose}>
          Cancel
        </Button>
        <Button variant="contained" onClick={handleApplyFilters}>
          Apply Filters
        </Button>
      </DialogActions>
    </Dialog>
  );
};