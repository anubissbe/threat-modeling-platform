import React from 'react';
import {
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Typography,
  Box,
  Divider,
} from '@mui/material';
import {
  Person as PersonIcon,
  Computer as ComputerIcon,
  Storage as StorageIcon,
  Cloud as CloudIcon,
  Api as ApiIcon,
  VpnKey as VpnKeyIcon,
  Security as SecurityIcon,
  Smartphone as SmartphoneIcon,
  Web as WebIcon,
  Dns as DnsIcon,
  Router as RouterIcon,
  Shield as ShieldIcon,
} from '@mui/icons-material';

interface ComponentType {
  id: string;
  label: string;
  icon: React.ReactElement;
  category: string;
  description: string;
}

const componentTypes: ComponentType[] = [
  // Actors
  {
    id: 'user',
    label: 'User',
    icon: <PersonIcon />,
    category: 'Actors',
    description: 'Human user or external entity',
  },
  {
    id: 'admin',
    label: 'Administrator',
    icon: <VpnKeyIcon />,
    category: 'Actors',
    description: 'System administrator with elevated privileges',
  },
  {
    id: 'attacker',
    label: 'Threat Actor',
    icon: <SecurityIcon />,
    category: 'Actors',
    description: 'Potential attacker or malicious entity',
  },
  // Systems
  {
    id: 'process',
    label: 'Process',
    icon: <ComputerIcon />,
    category: 'Systems',
    description: 'Application process or service',
  },
  {
    id: 'webserver',
    label: 'Web Server',
    icon: <WebIcon />,
    category: 'Systems',
    description: 'Web server or application server',
  },
  {
    id: 'api',
    label: 'API',
    icon: <ApiIcon />,
    category: 'Systems',
    description: 'REST API or web service',
  },
  {
    id: 'mobile',
    label: 'Mobile App',
    icon: <SmartphoneIcon />,
    category: 'Systems',
    description: 'Mobile application',
  },
  // Data Stores
  {
    id: 'database',
    label: 'Database',
    icon: <StorageIcon />,
    category: 'Data Stores',
    description: 'Relational or NoSQL database',
  },
  {
    id: 'cache',
    label: 'Cache',
    icon: <DnsIcon />,
    category: 'Data Stores',
    description: 'In-memory cache like Redis',
  },
  {
    id: 'filestore',
    label: 'File Storage',
    icon: <CloudIcon />,
    category: 'Data Stores',
    description: 'File system or object storage',
  },
  // Infrastructure
  {
    id: 'firewall',
    label: 'Firewall',
    icon: <ShieldIcon />,
    category: 'Infrastructure',
    description: 'Network firewall or security appliance',
  },
  {
    id: 'loadbalancer',
    label: 'Load Balancer',
    icon: <RouterIcon />,
    category: 'Infrastructure',
    description: 'Load balancer or reverse proxy',
  },
  {
    id: 'external',
    label: 'External System',
    icon: <CloudIcon />,
    category: 'Infrastructure',
    description: 'Third-party service or external system',
  },
];

const categories = ['Actors', 'Systems', 'Data Stores', 'Infrastructure'];

export const ComponentPalette: React.FC = () => {
  const handleDragStart = (e: React.DragEvent, componentType: string) => {
    e.dataTransfer.setData('componentType', componentType);
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <List sx={{ pt: 0 }}>
      {categories.map((category) => (
        <Box key={category}>
          <Box sx={{ px: 2, py: 1, bgcolor: 'grey.100' }}>
            <Typography variant="subtitle2" color="text.secondary">
              {category}
            </Typography>
          </Box>
          {componentTypes
            .filter((comp) => comp.category === category)
            .map((component) => (
              <ListItem
                key={component.id}
                draggable
                onDragStart={(e) => handleDragStart(e, component.id)}
                sx={{
                  cursor: 'grab',
                  '&:hover': {
                    bgcolor: 'action.hover',
                  },
                  '&:active': {
                    cursor: 'grabbing',
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 40 }}>
                  {React.cloneElement(component.icon, {
                    fontSize: 'small',
                    color: 'action',
                  })}
                </ListItemIcon>
                <ListItemText
                  primary={component.label}
                  secondary={component.description}
                  primaryTypographyProps={{
                    variant: 'body2',
                  }}
                  secondaryTypographyProps={{
                    variant: 'caption',
                    sx: { display: 'block', mt: 0.5 },
                  }}
                />
              </ListItem>
            ))}
          <Divider />
        </Box>
      ))}
      
      <Box sx={{ p: 2, bgcolor: 'grey.50' }}>
        <Typography variant="caption" color="text.secondary">
          Drag components onto the canvas to add them to your threat model.
          Hold Shift and drag between components to create connections.
        </Typography>
      </Box>
    </List>
  );
};