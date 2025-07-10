// Mock API server to demonstrate frontend integration
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(express.json());

// Mock data - support multiple valid credentials
const users = [
  {
    id: '1',
    email: 'admin@threatmodel.com',
    password: 'admin123',
    firstName: 'Admin',
    lastName: 'User',
    role: 'admin',
    organization: 'ThreatModel Inc'
  },
  {
    id: '2',
    email: 'admin@example.com',
    password: 'admin123',
    firstName: 'Admin',
    lastName: 'User',
    role: 'admin',
    organization: 'ThreatModel Inc'
  },
  {
    id: '3',
    email: 'test@example.com',
    password: 'password123',
    firstName: 'Test',
    lastName: 'User',
    role: 'user',
    organization: 'ThreatModel Inc'
  }
];

let projects = [
  {
    id: '1',
    name: 'E-Commerce Platform',
    description: 'Security assessment for our new e-commerce platform',
    riskLevel: 'High',
    status: 'Active',
    progress: 75,
    threatModels: 3,
    collaborators: 5,
    owner: 'John Doe',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: '2',
    name: 'Mobile Banking App',
    description: 'Threat modeling for mobile banking application',
    riskLevel: 'Critical',
    status: 'In Review',
    progress: 90,
    threatModels: 5,
    collaborators: 8,
    owner: 'Jane Smith',
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
  }
];

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'mock-api-gateway' });
});

// Auth endpoints
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  console.log('Login attempt:', { email, password });
  
  // For demo purposes, accept any password for admin@threatmodel.com
  let user = users.find(u => u.email === email && u.password === password);
  
  // If exact match fails, allow admin@threatmodel.com with any password for testing
  if (!user && email === 'admin@threatmodel.com') {
    user = users[0]; // Use the first admin user
    console.log('Allowing admin@threatmodel.com with any password for demo');
  }
  
  if (!user) {
    console.log('Login failed - valid credentials:', users.map(u => ({ email: u.email, password: u.password })));
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  const token = jwt.sign({ userId: user.id, email: user.email }, 'secret', { expiresIn: '24h' });
  
  res.json({
    success: true,
    data: {
      accessToken: token,
      refreshToken: token,
      expiresIn: 86400
    }
  });
});

app.get('/api/auth/profile', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  // Find the logged in user based on the token (simplified for demo)
  const user = users[0]; // In real app, decode JWT to get user
  
  if (!user) {
    return res.status(401).json({ error: 'User not found' });
  }
  
  res.json({
    success: true,
    data: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      organization: user.organization,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  });
});

// Projects endpoints
app.get('/api/projects', (req, res) => {
  res.json({
    success: true,
    data: projects
  });
});

app.get('/api/projects/:id', (req, res) => {
  const { id } = req.params;
  const project = projects.find(p => p.id === id);
  
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }
  
  res.json({
    success: true,
    data: project
  });
});

app.post('/api/projects', (req, res) => {
  const newProject = {
    id: String(Date.now()),
    ...req.body,
    progress: 0,
    threatModels: 0,
    collaborators: 1,
    owner: 'Current User',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  projects.push(newProject);
  
  res.status(201).json({
    success: true,
    data: newProject
  });
});

app.put('/api/projects/:id', (req, res) => {
  const { id } = req.params;
  const projectIndex = projects.findIndex(p => p.id === id);
  
  if (projectIndex === -1) {
    return res.status(404).json({ error: 'Project not found' });
  }
  
  projects[projectIndex] = {
    ...projects[projectIndex],
    ...req.body,
    id,
    updatedAt: new Date().toISOString()
  };
  
  res.json({
    success: true,
    data: projects[projectIndex]
  });
});

app.delete('/api/projects/:id', (req, res) => {
  const { id } = req.params;
  const projectIndex = projects.findIndex(p => p.id === id);
  
  if (projectIndex === -1) {
    return res.status(404).json({ error: 'Project not found' });
  }
  
  projects.splice(projectIndex, 1);
  
  res.json({
    success: true,
    data: { message: 'Project deleted successfully' }
  });
});

// Threat Models endpoints
let threatModels = [
  {
    id: '1',
    projectId: '1',
    name: 'User Authentication Flow',
    description: 'Threat model for the user login and authentication process',
    methodology: 'STRIDE',
    status: 'active',
    threats: 8,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: '2',
    projectId: '1',
    name: 'Payment Processing',
    description: 'Security analysis of payment handling and processing',
    methodology: 'PASTA',
    status: 'completed',
    threats: 12,
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: '3',
    projectId: '2',
    name: 'Mobile API Security',
    description: 'API threat modeling for mobile banking application',
    methodology: 'STRIDE',
    status: 'in_review',
    threats: 15,
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString()
  }
];

app.get('/api/threat-models', (req, res) => {
  const { projectId } = req.query;
  
  let filteredModels = threatModels;
  if (projectId) {
    filteredModels = threatModels.filter(tm => tm.projectId === projectId);
  }
  
  res.json({
    success: true,
    data: filteredModels
  });
});

app.get('/api/threat-models/:id', (req, res) => {
  const { id } = req.params;
  const threatModel = threatModels.find(tm => tm.id === id);
  
  if (!threatModel) {
    return res.status(404).json({ error: 'Threat model not found' });
  }
  
  res.json({
    success: true,
    data: threatModel
  });
});

app.post('/api/threat-models', (req, res) => {
  const newThreatModel = {
    id: String(Date.now()),
    ...req.body,
    threats: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  threatModels.push(newThreatModel);
  
  res.status(201).json({
    success: true,
    data: newThreatModel
  });
});

app.put('/api/threat-models/:id', (req, res) => {
  const { id } = req.params;
  const threatModelIndex = threatModels.findIndex(tm => tm.id === id);
  
  if (threatModelIndex === -1) {
    return res.status(404).json({ error: 'Threat model not found' });
  }
  
  threatModels[threatModelIndex] = {
    ...threatModels[threatModelIndex],
    ...req.body,
    id,
    updatedAt: new Date().toISOString()
  };
  
  res.json({
    success: true,
    data: threatModels[threatModelIndex]
  });
});

app.delete('/api/threat-models/:id', (req, res) => {
  const { id } = req.params;
  const threatModelIndex = threatModels.findIndex(tm => tm.id === id);
  
  if (threatModelIndex === -1) {
    return res.status(404).json({ error: 'Threat model not found' });
  }
  
  threatModels.splice(threatModelIndex, 1);
  
  res.json({
    success: true,
    data: { message: 'Threat model deleted successfully' }
  });
});

// Risk Assessment endpoints
let riskAssessments = [
  {
    id: '1',
    projectId: '1',
    projectName: 'E-Commerce Platform',
    overallRisk: 'High',
    score: 78,
    status: 'completed',
    vulnerabilities: 12,
    threats: 8,
    recommendations: [
      'Implement regular security code reviews',
      'Set up automated vulnerability scanning',
      'Enhance API security with rate limiting'
    ],
    lastUpdated: new Date().toISOString()
  },
  {
    id: '2',
    projectId: '2',
    projectName: 'Mobile Banking App',
    overallRisk: 'Critical',
    score: 92,
    status: 'completed',
    vulnerabilities: 6,
    threats: 4,
    recommendations: [
      'Implement mobile application security testing',
      'Add certificate pinning',
      'Implement biometric authentication'
    ],
    lastUpdated: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
  }
];

app.get('/api/risk-assessments', (req, res) => {
  res.json({
    success: true,
    data: riskAssessments
  });
});

app.get('/api/risk-assessments/:id', (req, res) => {
  const { id } = req.params;
  const assessment = riskAssessments.find(a => a.id === id);
  
  if (!assessment) {
    return res.status(404).json({ error: 'Risk assessment not found' });
  }
  
  res.json({
    success: true,
    data: assessment
  });
});

app.post('/api/risk-assessments', (req, res) => {
  const newAssessment = {
    id: String(Date.now()),
    ...req.body,
    status: 'in_progress',
    vulnerabilities: 0,
    threats: 0,
    recommendations: [],
    lastUpdated: new Date().toISOString()
  };
  
  riskAssessments.push(newAssessment);
  
  res.status(201).json({
    success: true,
    data: newAssessment
  });
});

// Vulnerabilities endpoints
let vulnerabilities = [
  {
    id: 'vuln-001',
    title: 'SQL Injection in User Authentication',
    severity: 'Critical',
    cve: 'CVE-2023-1234',
    cwe: 'CWE-89',
    component: 'auth-service',
    version: '1.2.3',
    description: 'Unsanitized user input in the login endpoint allows SQL injection attacks.',
    impact: 'Complete database compromise, unauthorized access to all user accounts',
    remediation: 'Implement parameterized queries, input validation, and prepared statements.',
    status: 'open',
    priority: 'P1',
    discoveredAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    lastSeen: new Date().toISOString(),
    assignedTo: 'security-team',
    projectId: '1',
    projectName: 'E-Commerce Platform',
    tags: ['injection', 'authentication', 'database']
  },
  {
    id: 'vuln-002',
    title: 'Cross-Site Scripting (XSS) in Product Reviews',
    severity: 'High',
    cve: 'CVE-2023-5678',
    cwe: 'CWE-79',
    component: 'review-service',
    version: '2.1.0',
    description: 'Stored XSS vulnerability in product review comments allows attackers to inject malicious scripts.',
    impact: 'Session hijacking, credential theft, malicious redirects',
    remediation: 'Implement proper input sanitization, output encoding, and CSP headers.',
    status: 'in_progress',
    priority: 'P2',
    discoveredAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    lastSeen: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    assignedTo: 'dev-team',
    projectId: '1',
    projectName: 'E-Commerce Platform',
    tags: ['xss', 'injection', 'client-side']
  }
];

app.get('/api/vulnerabilities', (req, res) => {
  res.json({
    success: true,
    data: vulnerabilities
  });
});

app.get('/api/vulnerabilities/:id', (req, res) => {
  const { id } = req.params;
  const vulnerability = vulnerabilities.find(v => v.id === id);
  
  if (!vulnerability) {
    return res.status(404).json({ error: 'Vulnerability not found' });
  }
  
  res.json({
    success: true,
    data: vulnerability
  });
});

app.post('/api/vulnerabilities', (req, res) => {
  const newVulnerability = {
    id: `vuln-${Date.now()}`,
    ...req.body,
    discoveredAt: new Date().toISOString(),
    lastSeen: new Date().toISOString()
  };
  
  vulnerabilities.push(newVulnerability);
  
  res.status(201).json({
    success: true,
    data: newVulnerability
  });
});

app.put('/api/vulnerabilities/:id', (req, res) => {
  const { id } = req.params;
  const vulnerabilityIndex = vulnerabilities.findIndex(v => v.id === id);
  
  if (vulnerabilityIndex === -1) {
    return res.status(404).json({ error: 'Vulnerability not found' });
  }
  
  vulnerabilities[vulnerabilityIndex] = {
    ...vulnerabilities[vulnerabilityIndex],
    ...req.body,
    id,
    lastSeen: new Date().toISOString()
  };
  
  res.json({
    success: true,
    data: vulnerabilities[vulnerabilityIndex]
  });
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🚀 Mock API server running on http://localhost:${PORT}`);
  console.log('\n📋 Available endpoints:');
  console.log('   POST /api/auth/login');
  console.log('   GET  /api/auth/profile');
  console.log('   GET  /api/projects');
  console.log('   GET  /api/projects/:id');
  console.log('   POST /api/projects');
  console.log('   PUT  /api/projects/:id');
  console.log('   DELETE /api/projects/:id');
  console.log('   GET  /api/threat-models');
  console.log('   GET  /api/threat-models/:id');
  console.log('   POST /api/threat-models');
  console.log('   PUT  /api/threat-models/:id');
  console.log('   DELETE /api/threat-models/:id');
  console.log('   GET  /api/risk-assessments');
  console.log('   GET  /api/risk-assessments/:id');
  console.log('   POST /api/risk-assessments');
  console.log('   GET  /api/vulnerabilities');
  console.log('   GET  /api/vulnerabilities/:id');
  console.log('   POST /api/vulnerabilities');
  console.log('   PUT  /api/vulnerabilities/:id');
  console.log('\n🔑 Login credentials:');
  console.log('   Email: admin@threatmodel.com');
  console.log('   Password: admin123');
});