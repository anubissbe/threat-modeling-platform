// Test Projects page API integration
const API_URL = 'http://localhost:3000/api';

async function testProjectsAPI() {
  console.log('🧪 Testing Projects API Integration...\n');

  try {
    // 1. Test if API is reachable
    console.log('1. Checking API availability...');
    const healthCheck = await fetch('http://localhost:3000/health').catch(() => null);
    if (!healthCheck || !healthCheck.ok) {
      console.log('❌ API Gateway is not running at http://localhost:3000');
      console.log('   The frontend will show loading state or error when trying to fetch projects');
      return;
    }
    console.log('✅ API Gateway is reachable\n');

    // 2. Test authentication
    console.log('2. Testing authentication...');
    const loginResponse = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@threatmodel.com',
        password: 'admin123'
      })
    });

    if (!loginResponse.ok) {
      console.log('❌ Login failed:', loginResponse.status, loginResponse.statusText);
      return;
    }

    const { accessToken } = await loginResponse.json();
    console.log('✅ Authentication successful\n');

    // 3. Test projects endpoint
    console.log('3. Testing projects endpoint...');
    const projectsResponse = await fetch(`${API_URL}/projects`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    if (!projectsResponse.ok) {
      console.log('❌ Failed to fetch projects:', projectsResponse.status, projectsResponse.statusText);
      return;
    }

    const projects = await projectsResponse.json();
    console.log('✅ Projects fetched successfully');
    console.log(`   Found ${projects.data?.length || 0} projects\n`);

    // 4. Test creating a project
    console.log('4. Testing project creation...');
    const newProject = {
      name: 'Test Project from Frontend',
      description: 'Testing API integration',
      riskLevel: 'Medium',
      status: 'Active'
    };

    const createResponse = await fetch(`${API_URL}/projects`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(newProject)
    });

    if (createResponse.ok) {
      const created = await createResponse.json();
      console.log('✅ Project created successfully:', created.data?.name);
    } else {
      console.log('❌ Failed to create project:', createResponse.status);
    }

  } catch (error) {
    console.error('❌ Error during testing:', error.message);
  }

  console.log('\n📋 Summary:');
  console.log('- Frontend is running at http://localhost:3006');
  console.log('- Projects page has been updated to use real API calls');
  console.log('- When API Gateway is running, projects will be fetched dynamically');
  console.log('- Without API, the page will show loading state or error message');
}

testProjectsAPI();