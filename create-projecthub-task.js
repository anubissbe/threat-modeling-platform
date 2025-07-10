const axios = require('axios');

const API_BASE_URL = 'http://192.168.1.24:3009/api';

async function createTask() {
  try {
    // First login
    const loginResponse = await axios.post(`${API_BASE_URL}/auth/login`, {
      email: 'admin@projecthub.com',
      password: 'admin123'
    });

    const token = loginResponse.data.token;
    console.log('✅ Logged in to ProjectHub');

    // Get or create project
    const projectsResponse = await axios.get(`${API_BASE_URL}/projects`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    let projectId;
    const existingProject = projectsResponse.data.find(p => p.name === 'Threat Modeling Platform');
    
    if (existingProject) {
      projectId = existingProject.id;
      console.log('✅ Found existing project:', existingProject.name);
    } else {
      // Create project
      const createProjectResponse = await axios.post(`${API_BASE_URL}/projects`, {
        name: 'Threat Modeling Platform',
        description: 'Enterprise-grade threat modeling platform with AI integration',
        status: 'active'
      }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      projectId = createProjectResponse.data.id;
      console.log('✅ Created new project');
    }

    // Create task
    const taskResponse = await axios.post(`${API_BASE_URL}/tasks`, {
      project_id: projectId,
      title: 'Fix JWT Refresh Token Duplicate Key Error',
      description: `Fixed the JWT refresh token functionality that was failing with duplicate key constraint violations.

## Issue
- JWT refresh endpoint returning "Invalid refresh token" error
- Database logs showed: "duplicate key value violates unique constraint refresh_tokens_user_id_token_key"

## Root Cause
Refresh tokens were deterministic - same userId + timestamp generated identical tokens

## Solution
Added unique jti (JWT ID) field using crypto.randomBytes(16).toString('hex') to ensure token uniqueness

## Testing
- Created comprehensive test script (test-fresh-jwt-refresh.js)
- Verified multiple users can refresh without conflicts
- Confirmed old tokens are properly invalidated
- All tests pass consistently

## Documentation
Created detailed fix documentation at: /opt/projects/threat-modeling-platform/docs/JWT_REFRESH_FIX.md`,
      status: 'completed',
      priority: 'high',
      assigned_to: 'Claude',
      completed_at: new Date().toISOString()
    }, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    console.log('✅ Created task:', taskResponse.data.title);
    console.log('   Task ID:', taskResponse.data.id);
    console.log('   Project:', taskResponse.data.project_id);
    console.log('   Status:', taskResponse.data.status);
    console.log('   Priority:', taskResponse.data.priority);

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

createTask();
